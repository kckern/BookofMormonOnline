/**
 * Messenger Service Tests
 * Phase 2: Sendbird Migration
 * 
 * Comprehensive test suite for the Messenger service layer
 */

import { messenger, Messenger, UserDTO, ChannelDTO, MessageDTO } from '../src/library/messenger';
import { models, sequelize } from '../src/config/database';
import { nanoid } from 'nanoid';

// Test data prefixes to identify test records
const TEST_PREFIX = 'test_';
const testUserId = () => `${TEST_PREFIX}user_${nanoid(8)}`;
const testChannelUrl = () => `${TEST_PREFIX}channel_${nanoid(8)}`;

// Track created test data for cleanup
const createdUsers: string[] = [];
const createdChannels: string[] = [];
const createdMessages: string[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// SETUP & TEARDOWN
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Ensure database connection is established
  await sequelize.authenticate();
});

afterAll(async () => {
  // Clean up all test data in reverse order
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
    console.log(`Cleaned up: ${createdUsers.length} users, ${createdChannels.length} channels, ${createdMessages.length} messages`);
  } catch (error) {
    // Ignore cleanup errors - connection may already be closed
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// USER TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Messenger User Operations', () => {
  
  test('upsertUser - should create a new user', async () => {
    const userId = testUserId();
    createdUsers.push(userId);
    
    const user = await messenger.upsertUser(userId, {
      nickname: 'Test User',
      profile_url: 'https://example.com/avatar.jpg'
    });
    
    expect(user).toBeDefined();
    expect(user.user_id).toBe(userId);
    expect(user.nickname).toBe('Test User');
    expect(user.profile_url).toBe('https://example.com/avatar.jpg');
  });
  
  test('upsertUser - should update an existing user', async () => {
    const userId = testUserId();
    createdUsers.push(userId);
    
    await messenger.upsertUser(userId, { nickname: 'Original Name' });
    const updated = await messenger.upsertUser(userId, { 
      nickname: 'Updated Name',
      profile_url: 'https://new-url.com/pic.jpg'
    });
    
    expect(updated.nickname).toBe('Updated Name');
  });
  
  test('getUser - should retrieve an existing user', async () => {
    const userId = testUserId();
    createdUsers.push(userId);
    
    await messenger.upsertUser(userId, { nickname: 'Findable User' });
    const user = await messenger.getUser(userId);
    
    expect(user).not.toBeNull();
    expect(user!.user_id).toBe(userId);
  });
  
  test('getUser - should return null for non-existent user', async () => {
    const user = await messenger.getUser('non_existent_user_xyz');
    expect(user).toBeNull();
  });
  
  test('getUsers - should retrieve multiple users', async () => {
    const userIds = [testUserId(), testUserId()];
    createdUsers.push(...userIds);
    
    await Promise.all(userIds.map((id, i) => 
      messenger.upsertUser(id, { nickname: `User ${i}` })
    ));
    
    const users = await messenger.getUsers(userIds);
    expect(users).toHaveLength(2);
  });
  
  test('updateUserNickname - should update nickname', async () => {
    const userId = testUserId();
    createdUsers.push(userId);
    
    await messenger.upsertUser(userId, { nickname: 'Old Nick' });
    const result = await messenger.updateUserNickname(userId, 'New Nick');
    
    expect(result).toBe(true);
    const user = await messenger.getUser(userId);
    expect(user!.nickname).toBe('New Nick');
  });
  
  test('generateUserId - should create MD5 hash', () => {
    const userId = Messenger.generateUserId('test@example.com');
    expect(userId).toHaveLength(32);
    expect(userId).toMatch(/^[a-f0-9]{32}$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Messenger Channel Operations', () => {
  
  test('createChannel - should create a channel with members', async () => {
    const userIds = [testUserId(), testUserId()];
    createdUsers.push(...userIds);
    
    await Promise.all(userIds.map((id, i) => 
      messenger.upsertUser(id, { nickname: `Channel User ${i}` })
    ));
    
    const channelUrl = testChannelUrl();
    createdChannels.push(channelUrl);
    
    const channel = await messenger.createChannel({
      channelUrl,
      name: 'Test Channel',
      customType: 'private',
      userIds,
      operatorIds: [userIds[0]],
      lang: 'en'
    });
    
    expect(channel).toBeDefined();
    expect(channel.name).toBe('Test Channel');
    expect(channel.members).toHaveLength(2);
  });
  
  test('getChannel - should retrieve channel with members', async () => {
    const userId = testUserId();
    createdUsers.push(userId);
    await messenger.upsertUser(userId, { nickname: 'Solo User' });
    
    const channelUrl = testChannelUrl();
    createdChannels.push(channelUrl);
    
    await messenger.createChannel({
      channelUrl,
      name: 'Retrievable Channel',
      customType: 'private',
      userIds: [userId],
      operatorIds: [userId]
    });
    
    const channel = await messenger.getChannel(channelUrl);
    expect(channel).not.toBeNull();
    expect(channel!.channel_url).toBe(channelUrl);
  });
  
  test('getChannel - should return null for non-existent', async () => {
    const channel = await messenger.getChannel('fake_channel_xyz');
    expect(channel).toBeNull();
  });
  
  test('addUserToChannel - should add member', async () => {
    const [user1, user2] = [testUserId(), testUserId()];
    createdUsers.push(user1, user2);
    
    await messenger.upsertUser(user1, { nickname: 'User 1' });
    await messenger.upsertUser(user2, { nickname: 'User 2' });
    
    const channelUrl = testChannelUrl();
    createdChannels.push(channelUrl);
    
    await messenger.createChannel({
      channelUrl,
      name: 'Add Member Channel',
      customType: 'private',
      userIds: [user1],
      operatorIds: [user1]
    });
    
    const added = await messenger.addUserToChannel(channelUrl, user2);
    expect(added).toBe(true);
    
    const channel = await messenger.getChannel(channelUrl);
    expect(channel!.members).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Messenger Message Operations', () => {
  
  let msgChannelUrl: string;
  let msgUserId: string;
  
  beforeAll(async () => {
    msgUserId = `${TEST_PREFIX}msg_user_${nanoid(8)}`;
    createdUsers.push(msgUserId);
    await messenger.upsertUser(msgUserId, { nickname: 'Message User' });
    
    msgChannelUrl = `${TEST_PREFIX}msg_channel_${nanoid(8)}`;
    createdChannels.push(msgChannelUrl);
    
    await messenger.createChannel({
      channelUrl: msgChannelUrl,
      name: 'Message Test Channel',
      customType: 'private',
      userIds: [msgUserId],
      operatorIds: [msgUserId]
    });
  });
  
  test('postMessage - should create a basic message', async () => {
    const message = await messenger.postMessage({
      channelUrl: msgChannelUrl,
      userId: msgUserId,
      message: 'Hello, World!'
    });
    createdMessages.push(message.message_id);
    
    expect(message).toBeDefined();
    expect(message.message_id).toHaveLength(11);
    expect(message.message).toBe('Hello, World!');
  });
  
  test('postMessage - should create message with link', async () => {
    const message = await messenger.postMessage({
      channelUrl: msgChannelUrl,
      userId: msgUserId,
      message: 'Check out this scripture',
      link: { type: 'text', target: '1-nephi-1', aux: 'verse1' }
    });
    createdMessages.push(message.message_id);
    
    const data = JSON.parse(message.data);
    expect(data.links).toBeDefined();
    expect(data.links.text).toBe('1-nephi-1.verse1');
  });
  
  test('postMessage - should create message with highlights', async () => {
    const highlights = ['faith in Christ', 'repentance'];
    const message = await messenger.postMessage({
      channelUrl: msgChannelUrl,
      userId: msgUserId,
      message: 'Key principles',
      highlights
    });
    createdMessages.push(message.message_id);
    
    const data = JSON.parse(message.data);
    expect(data.highlights).toEqual(highlights);
  });
  
  test('getMessage - should retrieve message by ID', async () => {
    const posted = await messenger.postMessage({
      channelUrl: msgChannelUrl,
      userId: msgUserId,
      message: 'Findable message'
    });
    createdMessages.push(posted.message_id);
    
    const retrieved = await messenger.getMessage(msgChannelUrl, posted.message_id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.message).toBe('Findable message');
  });
  
  test('getMessages - should retrieve messages', async () => {
    // Post a few messages
    for (let i = 0; i < 3; i++) {
      const msg = await messenger.postMessage({
        channelUrl: msgChannelUrl,
        userId: msgUserId,
        message: `Test message ${i}`
      });
      createdMessages.push(msg.message_id);
    }
    
    const messages = await messenger.getMessages(msgChannelUrl, { limit: 10 });
    expect(messages.length).toBeGreaterThanOrEqual(3);
  });
  
  test('deleteMessage - should soft delete', async () => {
    const msg = await messenger.postMessage({
      channelUrl: msgChannelUrl,
      userId: msgUserId,
      message: 'To be deleted'
    });
    createdMessages.push(msg.message_id);
    
    const deleted = await messenger.deleteMessage(msgChannelUrl, msg.message_id);
    expect(deleted).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REACTION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Messenger Reaction Operations', () => {
  
  let reactChannelUrl: string;
  let reactUserId: string;
  let reactMessageId: string;
  
  beforeAll(async () => {
    reactUserId = `${TEST_PREFIX}react_user_${nanoid(8)}`;
    createdUsers.push(reactUserId);
    await messenger.upsertUser(reactUserId, { nickname: 'Reaction User' });
    
    reactChannelUrl = `${TEST_PREFIX}react_channel_${nanoid(8)}`;
    createdChannels.push(reactChannelUrl);
    
    await messenger.createChannel({
      channelUrl: reactChannelUrl,
      name: 'Reaction Channel',
      customType: 'private',
      userIds: [reactUserId],
      operatorIds: [reactUserId]
    });
    
    const msg = await messenger.postMessage({
      channelUrl: reactChannelUrl,
      userId: reactUserId,
      message: 'React to this!'
    });
    reactMessageId = msg.message_id;
    createdMessages.push(reactMessageId);
  });
  
  test('addReaction - should add reaction', async () => {
    const added = await messenger.addReaction(reactMessageId, reactUserId, '👍');
    expect(added).toBe(true);
    
    const message = await messenger.getMessage(reactChannelUrl, reactMessageId);
    expect(message!.reactions.length).toBeGreaterThanOrEqual(1);
  });
  
  test('removeReaction - should remove reaction', async () => {
    await messenger.addReaction(reactMessageId, reactUserId, '👎');
    const removed = await messenger.removeReaction(reactMessageId, reactUserId, '👎');
    expect(removed).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EVENT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Messenger Events', () => {
  
  test('should emit messageCreated event', async () => {
    const userId = `${TEST_PREFIX}event_user_${nanoid(8)}`;
    createdUsers.push(userId);
    await messenger.upsertUser(userId, { nickname: 'Event User' });
    
    const channelUrl = `${TEST_PREFIX}event_channel_${nanoid(8)}`;
    createdChannels.push(channelUrl);
    
    await messenger.createChannel({
      channelUrl,
      name: 'Event Channel',
      customType: 'private',
      userIds: [userId],
      operatorIds: [userId]
    });
    
    let emittedMessage: MessageDTO | null = null;
    const handler = (msg: MessageDTO) => { emittedMessage = msg; };
    messenger.once('messageCreated', handler);
    
    const posted = await messenger.postMessage({
      channelUrl,
      userId,
      message: 'Event test'
    });
    createdMessages.push(posted.message_id);
    
    expect(emittedMessage).not.toBeNull();
    expect(emittedMessage!.message_id).toBe(posted.message_id);
  });
});
