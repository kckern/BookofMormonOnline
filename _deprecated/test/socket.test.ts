/**
 * WebSocket Server Tests
 * Phase 3: Sendbird Migration
 * 
 * Tests for Socket.io server functionality
 */

import { createServer, Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { messenger } from '../src/library/messenger';
import { models, sequelize } from '../src/config/database';
import { nanoid } from 'nanoid';

// Disable Redis for tests - must be done before importing socket
delete process.env.REDIS_URL;
process.env.MESSENGER_BOT_TOKEN = 'test_bot_token_123';

// Test data
const TEST_PREFIX = 'ws_test_';
const makeTestUserId = () => `${TEST_PREFIX}user_${nanoid(8)}`;
const makeTestChannelUrl = () => `${TEST_PREFIX}channel_${nanoid(8)}`;

// Track created test data for cleanup
const createdUsers: string[] = [];
const createdChannels: string[] = [];
const createdMessages: string[] = [];

// Server setup
let httpServer: HttpServer;
let io: Server;
let serverPort: number;

// Test fixtures
let testUser1Id: string;
let testUser2Id: string;
let testChannelUrlStr: string;

// ─────────────────────────────────────────────────────────────────────────────
// SETUP & TEARDOWN
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await sequelize.authenticate();
  
  // Create test users
  testUser1Id = makeTestUserId();
  testUser2Id = makeTestUserId();
  createdUsers.push(testUser1Id, testUser2Id);
  
  await messenger.upsertUser(testUser1Id, { nickname: 'WS Test User 1' });
  await messenger.upsertUser(testUser2Id, { nickname: 'WS Test User 2' });
  
  // Create test channel with both users
  testChannelUrlStr = makeTestChannelUrl();
  createdChannels.push(testChannelUrlStr);
  
  await messenger.createChannel({
    channelUrl: testChannelUrlStr,
    name: 'WebSocket Test Channel',
    customType: 'private',
    userIds: [testUser1Id, testUser2Id],
    operatorIds: [testUser1Id]
  });
  
  // Create HTTP server
  httpServer = createServer();
  
  // Import and initialize Socket.io
  const { initializeWebSocket } = await import('../src/socket');
  io = await initializeWebSocket(httpServer);
  
  // Start on random port
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      serverPort = typeof addr === 'object' && addr ? addr.port : 0;
      resolve();
    });
  });
}, 30000);

afterAll(async () => {
  // Shutdown
  const { shutdownWebSocket } = await import('../src/socket');
  await shutdownWebSocket();
  
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
  
  // Cleanup test data
  try {
    if (createdMessages.length) {
      await models.MessengerHighlight.destroy({ where: { message_id: createdMessages } });
      await models.MessengerReaction.destroy({ where: { message_id: createdMessages } });
      await models.MessengerMessage.destroy({ where: { message_id: createdMessages } });
    }
    if (createdChannels.length) {
      await models.MessengerMember.destroy({ where: { channel_url: createdChannels } });
      await models.MessengerChannel.destroy({ where: { channel_url: createdChannels } });
    }
    if (createdUsers.length) {
      await models.MessengerUser.destroy({ where: { user_id: createdUsers } });
    }
  } catch { /* ignore cleanup errors */ }
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function createClient(userId: string): ClientSocket {
  return Client(`http://localhost:${serverPort}`, {
    path: '/messenger',
    auth: { userId, token: 'test_bot_token_123' },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    timeout: 5000
  });
}

function connectClient(userId: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const client = createClient(userId);
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
    
    client.on('connect', () => {
      clearTimeout(timeout);
      resolve(client);
    });
    client.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('WebSocket Connection', () => {
  
  test('connects with valid credentials', async () => {
    const client = await connectClient(testUser1Id);
    expect(client.connected).toBe(true);
    client.disconnect();
  });

  test('rejects connection without userId', async () => {
    const client = Client(`http://localhost:${serverPort}`, {
      path: '/messenger',
      auth: { token: 'test_bot_token_123' }, // Missing userId
      transports: ['websocket'],
      forceNew: true,
      timeout: 5000
    });
    
    await expect(new Promise((resolve, reject) => {
      client.on('connect', () => reject(new Error('Should not connect')));
      client.on('connect_error', (err) => resolve(err.message));
    })).resolves.toBe('User ID required');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGING TESTS  
// ─────────────────────────────────────────────────────────────────────────────

describe('WebSocket Messaging', () => {
  
  test('sends message and receives acknowledgment', async () => {
    const client = await connectClient(testUser1Id);
    console.log('Client connected, rooms:', client.id);
    
    // Add listener for any event to debug
    client.onAny((event, ...args) => {
      console.log(`Client received event: ${event}`, args?.length);
    });
    
    const response = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Ack timeout - message not acknowledged'));
      }, 5000);
      
      console.log('Emitting send_message...');
      client.emit('send_message', {
        channelUrl: testChannelUrlStr,
        message: 'Hello via WebSocket!'
      }, (res: any) => {
        console.log('Received ack:', res);
        clearTimeout(timeout);
        resolve(res);
      });
    });
    
    expect(response.success).toBe(true);
    expect(response.message.message).toBe('Hello via WebSocket!');
    createdMessages.push(response.message.message_id);
    
    client.disconnect();
  });

  test('broadcasts message to channel members', async () => {
    const client1 = await connectClient(testUser1Id);
    const client2 = await connectClient(testUser2Id);
    
    // Set up listener first
    const messagePromise = new Promise<any>((resolve) => {
      client2.once('message_received', resolve);
    });
    
    // Send message
    client1.emit('send_message', {
      channelUrl: testChannelUrlStr,
      message: 'Broadcast test'
    }, (res: any) => {
      if (res.message) createdMessages.push(res.message.message_id);
    });
    
    // Wait for broadcast
    const received = await messagePromise;
    expect(received.message).toBe('Broadcast test');
    
    client1.disconnect();
    client2.disconnect();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TYPING INDICATOR TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('WebSocket Typing', () => {
  
  test('broadcasts typing start to channel', async () => {
    const client1 = await connectClient(testUser1Id);
    const client2 = await connectClient(testUser2Id);
    
    const typingPromise = new Promise<any>((resolve) => {
      client2.once('typing', resolve);
    });
    
    client1.emit('typing_start', { channelUrl: testChannelUrlStr });
    
    const typing = await typingPromise;
    expect(typing.userId).toBe(testUser1Id);
    expect(typing.isTyping).toBe(true);
    
    client1.disconnect();
    client2.disconnect();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL ACTION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('WebSocket Actions', () => {
  
  test('broadcasts channel action to members', async () => {
    const client1 = await connectClient(testUser1Id);
    const client2 = await connectClient(testUser2Id);
    
    const actionPromise = new Promise<any>((resolve) => {
      client2.once('channel_action', resolve);
    });
    
    client1.emit('fire_action', {
      channelUrl: testChannelUrlStr,
      action: 'navigate:1-nephi/1'
    });
    
    const action = await actionPromise;
    expect(action.action).toBe('navigate:1-nephi/1');
    expect(action.userId).toBe(testUser1Id);
    
    client1.disconnect();
    client2.disconnect();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRESENCE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('WebSocket Presence', () => {
  
  test('sets user online on connect', async () => {
    const client = await connectClient(testUser1Id);
    
    // Wait for online status to update (with retry)
    let isOnline = false;
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 100));
      const user = await messenger.getUser(testUser1Id);
      if (user?.is_online) {
        isOnline = true;
        break;
      }
    }
    
    expect(isOnline).toBe(true);
    client.disconnect();
  });

  test('sets user offline on disconnect', async () => {
    const client = await connectClient(testUser1Id);
    
    // Ensure user is online first
    await new Promise(r => setTimeout(r, 100));
    
    client.disconnect();
    
    // Wait for offline status to update (with retry)
    let isOffline = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 200));
      const user = await messenger.getUser(testUser1Id);
      if (user && !user.is_online) {
        isOffline = true;
        break;
      }
    }
    
    expect(isOffline).toBe(true);
  });
});
