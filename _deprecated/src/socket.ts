/**
 * WebSocket Server Implementation
 * Phase 3: Sendbird Migration
 * 
 * Socket.io server with Redis adapter for horizontal scaling
 */

import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import http from 'http';
import { messenger, MessageDTO, ChannelDTO, UserDTO } from './library/messenger';
import { models } from './config/database';

let io: Server | null = null;
let pubClient: RedisClientType | null = null;
let subClient: RedisClientType | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface SocketData {
  userId: string;
  channels: string[];
}

interface SendMessagePayload {
  channelUrl: string;
  message: string;
  customType?: string;
  link?: { type: string; target: string; aux?: string };
  highlights?: string[];
  parentMessageId?: string;
}

interface ActionPayload {
  channelUrl: string;
  action: string;
}

interface StatePayload {
  activeGroup?: string;
  activeCall?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify user token against bom_user_token table
 * Returns true if token is valid for the given userId
 */
async function verifyToken(token: string | undefined, userId: string): Promise<boolean> {
  if (!token) return false;
  
  try {
    // Look up user by their messenger user_id (MD5 hash)
    const messengerUser = await models.MessengerUser.findByPk(userId);
    if (!messengerUser || !messengerUser.bom_user_id) {
      // Allow bots or users without bom_user_id to connect with special token
      return token === process.env.MESSENGER_BOT_TOKEN;
    }
    
    // Verify token against bom_user_token table
    const userToken = await models.BomUserToken.findOne({
      where: { 
        user: messengerUser.bom_user_id,
        token: token
      }
    });
    
    return !!userToken;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize the WebSocket server
 * @param httpServer - The HTTP server to attach Socket.io to
 */
export async function initializeWebSocket(httpServer: http.Server): Promise<Server> {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: '/messenger',
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // ─────────────────────────────────────────────────────────────────
  // REDIS ADAPTER (for horizontal scaling)
  // ─────────────────────────────────────────────────────────────────
  if (process.env.REDIS_URL) {
    try {
      pubClient = createClient({ url: process.env.REDIS_URL });
      subClient = pubClient.duplicate();
      
      pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
      subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));
      
      await Promise.all([pubClient.connect(), subClient.connect()]);
      
      io.adapter(createAdapter(pubClient, subClient));
      console.log('🔌 Socket.io Redis Adapter connected');
    } catch (error) {
      console.error('❌ Redis Adapter failed to connect:', error);
      console.log('⚠️  Running Socket.io without Redis adapter (single-instance mode)');
    }
  } else {
    console.log('⚠️  REDIS_URL not set - running Socket.io in single-instance mode');
  }

  // ─────────────────────────────────────────────────────────────────
  // AUTHENTICATION MIDDLEWARE
  // ─────────────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    const userId = socket.handshake.auth.userId as string | undefined;

    if (!userId) {
      return next(new Error('User ID required'));
    }

    const isValid = await verifyToken(token, userId);
    
    if (isValid) {
      socket.data.userId = userId;
      socket.data.channels = [];
      next();
    } else {
      next(new Error('Authentication failed'));
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // CONNECTION HANDLER
  // ─────────────────────────────────────────────────────────────────
  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as string;
    console.log(`🔗 User connected: ${userId} (${socket.id})`);

    // Set up event handlers IMMEDIATELY (before any async work)
    setupEventHandlers(socket, userId);

    try {
      // 1. Mark user online
      await messenger.setUserOnline(userId, true);

      // 2. Auto-join user's channels
      const channels = await messenger.getMyChannels(userId);
      const channelUrls = channels.map(c => c.channel_url);
      
      if (channelUrls.length > 0) {
        socket.join(channelUrls);
        socket.data.channels = channelUrls;
      }

      // 3. Handle disconnect
      socket.on('disconnect', async (reason) => {
        console.log(`🔌 User disconnected: ${userId} (${reason})`);
        
        try {
          await messenger.setUserOnline(userId, false);
          
          // Notify all channels this user was in
          for (const channelUrl of socket.data.channels || []) {
            socket.to(channelUrl).emit('user_presence', {
              channelUrl,
              userId,
              isOnline: false,
              timestamp: Date.now()
            });
          }
        } catch (error) {
          console.error('Disconnect handler error:', error);
        }
      });

    } catch (error) {
      console.error('Connection setup error:', error);
      socket.disconnect(true);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // EVENT BRIDGE (Messenger Service -> Socket.io)
  // ─────────────────────────────────────────────────────────────────
  setupEventBridge(io);

  console.log('✅ WebSocket server initialized');
  return io;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT HANDLERS (Client -> Server)
// ─────────────────────────────────────────────────────────────────────────────

function setupEventHandlers(socket: Socket, userId: string) {
  
  // ─────────────────────────────────────────────────────────────────
  // MESSAGING
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Send a message to a channel
   */
  socket.on('send_message', async (payload: SendMessagePayload, ack?: (response: any) => void) => {
    try {
      const msg = await messenger.postMessage({
        channelUrl: payload.channelUrl,
        userId,
        message: payload.message,
        customType: payload.customType,
        link: payload.link,
        highlights: payload.highlights,
        parentMessageId: payload.parentMessageId
      });
      
      // Acknowledge success to sender
      if (ack) ack({ success: true, message: msg });
    } catch (error: any) {
      console.error('send_message error:', error);
      if (ack) ack({ success: false, error: error.message });
    }
  });

  /**
   * Mark channel as read
   */
  socket.on('mark_read', async (channelUrl: string, ack?: (response: any) => void) => {
    try {
      await messenger.markAsRead(channelUrl, userId);
      if (ack) ack({ success: true });
    } catch (error: any) {
      if (ack) ack({ success: false, error: error.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // TYPING INDICATORS
  // ─────────────────────────────────────────────────────────────────
  
  socket.on('typing_start', ({ channelUrl }: { channelUrl: string }) => {
    socket.to(channelUrl).emit('typing', {
      channelUrl,
      userId,
      isTyping: true,
      timestamp: Date.now()
    });
  });

  socket.on('typing_stop', ({ channelUrl }: { channelUrl: string }) => {
    socket.to(channelUrl).emit('typing', {
      channelUrl,
      userId,
      isTyping: false,
      timestamp: Date.now()
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // READ RECEIPTS
  // ─────────────────────────────────────────────────────────────────
  
  socket.on('mark_read', async ({ channelUrl }: { channelUrl: string }) => {
    try {
      await messenger.markChannelAsRead(channelUrl, userId);
      // Notify others in channel about read receipt
      socket.to(channelUrl).emit('read_receipt', {
        channelUrl,
        userId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('mark_read error:', error);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // USER STATE (Study Group sync)
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Update user's active state (which group/page they're viewing)
   */
  socket.on('update_state', async (data: StatePayload) => {
    try {
      await messenger.updateUserMetadata(userId, data);
      
      // Broadcast to all channels the user is in
      for (const channelUrl of socket.data.channels || []) {
        socket.to(channelUrl).emit('user_state', {
          channelUrl,
          userId,
          ...data,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('update_state error:', error);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // CHANNEL ACTIONS (Study Group navigation sync)
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Fire an action to sync study group members (e.g., navigate to page)
   */
  socket.on('fire_action', async (data: ActionPayload) => {
    try {
      // Broadcast immediately to channel
      socket.to(data.channelUrl).emit('channel_action', {
        channelUrl: data.channelUrl,
        userId,
        action: data.action,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('fire_action error:', error);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // ROOM MANAGEMENT
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Join a channel room (subscribe to updates)
   */
  socket.on('join_channel', async (channelUrl: string) => {
    socket.join(channelUrl);
    if (!socket.data.channels?.includes(channelUrl)) {
      socket.data.channels = [...(socket.data.channels || []), channelUrl];
    }
    
    // Notify others in channel
    socket.to(channelUrl).emit('user_presence', {
      channelUrl,
      userId,
      isOnline: true,
      timestamp: Date.now()
    });
  });

  /**
   * Leave a channel room (unsubscribe from updates)
   */
  socket.on('leave_channel', (channelUrl: string) => {
    socket.leave(channelUrl);
    socket.data.channels = (socket.data.channels || []).filter((c: string) => c !== channelUrl);
    
    // Notify others in channel
    socket.to(channelUrl).emit('user_presence', {
      channelUrl,
      userId,
      isOnline: false, // They left this specific channel
      timestamp: Date.now()
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // REACTIONS
  // ─────────────────────────────────────────────────────────────────
  
  socket.on('add_reaction', async (data: { messageId: string; channelUrl: string; reactionKey: string }, ack?: (response: any) => void) => {
    try {
      await messenger.addReaction(data.messageId, userId, data.reactionKey);
      if (ack) ack({ success: true });
    } catch (error: any) {
      if (ack) ack({ success: false, error: error.message });
    }
  });

  socket.on('remove_reaction', async (data: { messageId: string; channelUrl: string; reactionKey: string }, ack?: (response: any) => void) => {
    try {
      await messenger.removeReaction(data.messageId, userId, data.reactionKey);
      if (ack) ack({ success: true });
    } catch (error: any) {
      if (ack) ack({ success: false, error: error.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE EDITING
  // ─────────────────────────────────────────────────────────────────
  
  socket.on('edit_message', async (data: { 
    channelUrl: string; 
    messageId: string; 
    message?: string;
    customType?: string;
    data?: string;
  }, ack?: (response: any) => void) => {
    try {
      const updated = await messenger.updateMessage(data.channelUrl, data.messageId, {
        message: data.message,
        customType: data.customType
      });
      if (ack) ack({ success: true, message: updated });
    } catch (error: any) {
      if (ack) ack({ success: false, error: error.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE DELETION
  // ─────────────────────────────────────────────────────────────────
  
  socket.on('delete_message', async (data: { channelUrl: string; messageId: string }, ack?: (response: any) => void) => {
    try {
      await messenger.deleteMessage(data.channelUrl, data.messageId);
      if (ack) ack({ success: true });
    } catch (error: any) {
      if (ack) ack({ success: false, error: error.message });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT BRIDGE (Messenger Service -> Socket.io)
// ─────────────────────────────────────────────────────────────────────────────

function setupEventBridge(io: Server) {
  
  // New message created (via GraphQL or REST)
  messenger.on('messageCreated', (message: MessageDTO) => {
    io.to(message.channel_url).emit('message_received', message);
  });

  // Message updated
  messenger.on('messageUpdated', (message: MessageDTO) => {
    io.to(message.channel_url).emit('message_updated', message);
  });

  // Message deleted
  messenger.on('messageDeleted', (data: { channelUrl: string; messageId: string }) => {
    io.to(data.channelUrl).emit('message_deleted', data);
  });

  // Member joined channel
  messenger.on('memberJoined', (data: { channelUrl: string; userId: string }) => {
    io.to(data.channelUrl).emit('member_joined', {
      ...data,
      timestamp: Date.now()
    });
  });

  // Member left channel
  messenger.on('memberLeft', (data: { channelUrl: string; userId: string }) => {
    io.to(data.channelUrl).emit('member_left', {
      ...data,
      timestamp: Date.now()
    });
  });

  // Reaction added
  messenger.on('reactionAdded', (data: { messageId: string; userId: string; reactionKey: string }) => {
    // Need to look up channel for this message - emit to all for now
    // In production, would cache messageId -> channelUrl mapping
    io.emit('reaction_added', {
      ...data,
      timestamp: Date.now()
    });
  });

  // Reaction removed
  messenger.on('reactionRemoved', (data: { messageId: string; userId: string; reactionKey: string }) => {
    io.emit('reaction_removed', {
      ...data,
      timestamp: Date.now()
    });
  });

  // Channel created
  messenger.on('channelCreated', (channel: ChannelDTO) => {
    // Notify all members of the new channel
    for (const member of channel.members) {
      // Find sockets for this user and have them join the room
      // This is handled by the client calling join_channel
    }
  });

  // User status changed
  messenger.on('userStatusChanged', (data: { userId: string; isOnline: boolean }) => {
    // Broadcast to relevant channels (expensive without optimization)
    // For now, handled by individual socket disconnect handlers
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the Socket.io server instance
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Gracefully shutdown WebSocket server
 */
export async function shutdownWebSocket(): Promise<void> {
  if (io) {
    console.log('🔌 Shutting down WebSocket server...');
    
    // Disconnect all clients
    io.disconnectSockets(true);
    
    // Close Redis connections
    if (pubClient) await pubClient.quit();
    if (subClient) await subClient.quit();
    
    // Close server
    io.close();
    io = null;
    
    console.log('✅ WebSocket server shut down');
  }
}
