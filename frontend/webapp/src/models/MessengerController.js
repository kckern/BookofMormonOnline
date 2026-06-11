/**
 * MessengerController.js
 * 
 * Replacement for SendbirdController that uses our custom backend.
 * Uses Socket.io for real-time updates and GraphQL for data fetching.
 * 
 * Maintains the same CustomEvent interface so UI components work unchanged.
 */

import { io } from 'socket.io-client';
import crypto from 'crypto-browserify';
import { refreshChannel, tokenImage } from './Utils';
import { shapeUser, shapeMember, shapeMessage, shapeChannelFields } from './messengerShapes';

// Helper for consistent user IDs (same as SendbirdController)
export const md5 = (string) => {
  const isMD5 = string.match(/^[a-f0-9]{32}$/i);
  if (isMD5) return string;
  return crypto
    .createHash('md5')
    .update(string)
    .digest('hex');
};

export const uuid4 = () => {
  let d = new Date().getTime();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/**
 * Normalize a reactions array to the shape messageReacters() reads: { key, userIds }.
 * Sources differ — GraphQL gives { reaction_key, user_ids }, the socket gives
 * { key, user_ids } — so accept both field spellings.
 */
const normalizeReactions = (raw) =>
  (raw || []).map((r) => ({
    key: r.key ?? r.reaction_key,
    userIds: r.userIds ?? r.user_ids ?? [],
  }));

export default class MessengerController {
  constructor(serverUrl, userId, token, appController) {
    this.userId = md5(userId);
    this.token = token;
    this.appController = appController;
    this.channels = new Map();
    // Synchronous stub so `sb.currentUser` is never null during the boot race:
    // connect() populates the real profile via a GraphQL roundtrip, but
    // getStudyGroups()->setStudyGroups() can resolve first, and
    // setActiveStudyGroup bails when currentUser is null — leaving any account
    // WITH a group stuck (activeGroup never set, the whole StudyGroupBar dead).
    // connect() overwrites this with the enriched user once it lands.
    this._currentUser = this._normalizeUser({ user_id: this.userId, metadata: {} });
    this.groupCallMap = {}; // Compatibility with SendbirdController
    
    // Determine server URL
    const baseUrl = serverUrl || window.location.origin;
    
    // Initialize Socket.io connection
    this.socket = io(baseUrl, {
      path: '/messenger',
      auth: { 
        userId: this.userId, 
        token: this.token 
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling']
    });
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Initial connection
    this.connect(this.userId, this.token);
  }

  // ─────────────────────────────────────────────────────────────────
  // SOCKET EVENT HANDLERS (Socket -> CustomEvents)
  // ─────────────────────────────────────────────────────────────────
  
  setupEventHandlers() {
    const appController = this.appController;
    
    // Connection events
    this.socket.on('connect', () => {
      console.log('Messenger: Connected via Socket.io');
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('Messenger: Disconnected -', reason);
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Messenger: Connection error -', error.message);
    });

    // Message received
    this.socket.on('message_received', (message) => {
      this._handleMessageReceived(message, appController);
    });

    // Message updated
    this.socket.on('message_updated', (message) => {
      this._handleMessageUpdated(message, appController);
    });

    // Message deleted
    this.socket.on('message_deleted', ({ channelUrl, messageId }) => {
      // Currently a no-op in SendbirdController, kept for compatibility
      console.log('Messenger: Message deleted', messageId);
    });

    // Typing indicator
    this.socket.on('typing', ({ channelUrl, userId, isTyping }) => {
      const event = new CustomEvent('typingStatusUpdated');
      event.channelUrl = channelUrl;
      event.typers = isTyping ? [{ userId }] : [];
      window.dispatchEvent(event);
    });

    // Reaction changed
    this.socket.on('reaction_changed', (data) => {
      const event = new CustomEvent('reactTo' + data.messageId);
      event.reactionEvent = data;
      window.dispatchEvent(event);
    });

    // Channel action (study group navigation/scroll sync)
    this.socket.on('channel_action', ({ channelUrl, action }) => {
      const channel = this.channels.get(channelUrl);
      const event = new CustomEvent('fireStudyGroupAction');
      event.action = typeof action === 'string' ? action : JSON.stringify(action);
      event.channelName = channel?.name;
      event.channel = channel;
      window.dispatchEvent(event);
    });

    // Membership changed
    this.socket.on('membership_changed', async (data) => {
      if (data.channelUrl) {
        const channel = this.channels.get(data.channelUrl);
        if (channel) {
          refreshChannel(channel, appController);
        }
      }
    });

    // User joined
    this.socket.on('user_joined', ({ channelUrl, user }) => {
      const channel = this.channels.get(channelUrl);
      if (channel) {
        refreshChannel(channel, appController);
      }
    });

    // User left
    this.socket.on('user_left', ({ channelUrl, user }) => {
      const channel = this.channels.get(channelUrl);
      if (channel) {
        refreshChannel(channel, appController);
      }
    });

    // Unread count changed
    this.socket.on('unread_count_changed', () => {
      const event = new CustomEvent('unreadMessageCountChanged');
      window.dispatchEvent(event);
    });
  }

  _handleMessageReceived(message, appController) {
    if (!message) return;

    // Thread message
    if (message.parent_message_id) {
      const event = new CustomEvent('addMessageToThread' + message.parent_message_id);
      event.message = this._normalizeMessage(message);
      window.dispatchEvent(event);
    } 
    // Regular message
    else {
      const event = new CustomEvent('addMessage');
      event.message = this._normalizeMessage(message);
      window.dispatchEvent(event);

      // Page-specific messages (Study Group)
      if (message.custom_type && 
          message.channel_url === appController.states.studyGroup.activeGroup?.url) {
        const pageEvent = new CustomEvent('addMessageToPage-' + message.custom_type);
        pageEvent.message = this._normalizeMessage(message);
        window.dispatchEvent(pageEvent);
        appController.functions.markPopUpComments(true);
      }
    }

    // Generic fire message event
    const fireEvent = new CustomEvent('fireMessage');
    fireEvent.message = this._normalizeMessage(message);
    fireEvent.channel = this.channels.get(message.channel_url);
    window.dispatchEvent(fireEvent);

    // Update unread DMs
    this.loadUnreadDMs()
      .then((unreadCounts) => appController.functions.setUnreadDMs(unreadCounts));

    // Refresh channel
    const channel = this.channels.get(message.channel_url);
    if (channel) {
      refreshChannel(channel, appController);
    }
  }

  _handleMessageUpdated(message, appController) {
    if (message.channel_url !== appController.states.studyGroup.activeGroup?.url) return;

    // Thread message
    if (message.parent_message_id) {
      const event = new CustomEvent('updateMessageInThread' + message.parent_message_id);
      event.message = this._normalizeMessage(message);
      window.dispatchEvent(event);
    } 
    // Regular message
    else {
      const event = new CustomEvent('updateMessage');
      event.message = this._normalizeMessage(message);
      window.dispatchEvent(event);

      if (message.custom_type) {
        const pageEvent = new CustomEvent('updateMessageToPage-' + message.custom_type);
        pageEvent.message = this._normalizeMessage(message);
        window.dispatchEvent(pageEvent);
      }
    }
  }

  /**
   * Normalize message format to match Sendbird SDK structure.
   * Delegates the core shape to shapeMessage() (messengerShapes.js), then
   * layers on the reaction/threadInfo wiring and compat methods that need
   * access to normalizeReactions and the controller instance.
   */
  _normalizeMessage(msg) {
    // Merge link_type/link_target into data so legacy socket messages (which
    // carry those fields instead of a JSON data blob) still surface correctly.
    const rawData = msg.data || JSON.stringify({
      links: msg.link_type ? { [msg.link_type]: msg.link_target } : undefined,
      highlights: msg.highlights || []
    });
    const msgWithData = { ...msg, data: rawData };

    const normalized = shapeMessage(msgWithData, {
      resolveUser: (id) => this._findKnownUser(id),
    });

    // Override timestamps to match the previous normalizer's behaviour
    // (millisecond getTime() for createdAt; 0 sentinel when updatedAt absent).
    normalized.createdAt = new Date(msg.created_at).getTime();
    normalized.updatedAt = msg.updated_at ? new Date(msg.updated_at).getTime() : 0;
    // parentMessageId: preserve the 0 sentinel (shapeMessage passes through undefined).
    normalized.parentMessageId = msg.parent_message_id || 0;

    // Reactions / thread info
    normalized.reactions = normalizeReactions(msg.reactions);
    normalized.threadInfo = msg.thread_info || { replyCount: 0 };

    // Compatibility methods
    normalized.applyThreadInfoUpdateEvent = () => {};
    /**
     * Apply a reaction event in-place (Sendbird SDK parity). Handles BOTH:
     *   - full-array form: socket reaction_changed / message_received → { reactions: [...] }
     *   - delta form: optimistic local add/delete → { key|reaction_key, userId, operation }
     * Keeps this.reactions in the { key, userIds } shape messageReacters() reads.
     */
    normalized.applyReactionEvent = function applyReactionEvent(event) {
      if (!event) return;
      if (Array.isArray(event.reactions)) {
        this.reactions = normalizeReactions(event.reactions);
        return;
      }
      const key = event.key ?? event.reaction_key;
      const userId = event.userId;
      if (!key || !userId) return;
      let r = this.reactions.find((x) => x.key === key);
      if (event.operation === 'delete') {
        if (r) r.userIds = r.userIds.filter((id) => id !== userId);
        this.reactions = this.reactions.filter((x) => x.userIds.length > 0);
      } else {
        if (!r) { r = { key, userIds: [] }; this.reactions.push(r); }
        if (!r.userIds.includes(userId)) r.userIds.push(userId);
      }
    };

    return normalized;
  }

  /**
   * Look up a shaped user from any cached channel's member list.
   * Used by _normalizeMessage to resolve mention IDs into user objects.
   */
  _findKnownUser(userId) {
    for (const ch of this.channels.values()) {
      const hit = (ch.members || []).find((m) => m.userId === userId);
      if (hit) return hit;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC API - Connection
  // ─────────────────────────────────────────────────────────────────

  async connect(userId, token) {
    if (!userId || !token) {
      console.log('Messenger: Failed to connect - missing userId or token');
      return false;
    }

    try {
      // Fetch user profile via GraphQL
      const query = `query { 
        messengerUser(userId: "${this.userId}") { 
          user_id 
          nickname 
          profile_url 
          metadata 
          is_online
        } 
      }`;
      const result = await this.gqlRequest(query);
      
      if (result?.messengerUser) {
        this._currentUser = this._normalizeUser(result.messengerUser);
        
        // Update profile image if empty
        if (!this._currentUser.profileUrl) {
          const tokenImg = tokenImage();
          await this.updateCurrentUserInfo(this._currentUser.nickname, tokenImg);
        }
      }
      
      return this._currentUser;
    } catch (error) {
      console.error('Messenger: Connect error', error);
      return null;
    }
  }

  disconnect() {
    this.socket.disconnect();
    this._currentUser = null;
  }

  getCurrentUser() {
    return this._currentUser;
  }

  get currentUser() {
    return this._currentUser;
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC API - Channels/Groups
  // ─────────────────────────────────────────────────────────────────

  async getStudyGroups() {
    try {
      const query = `query { 
        messengerMyChannels(userId: "${this.userId}") { 
          channel_url 
          name 
          cover_url 
          custom_type 
          description
          metadata 
          member_count
          unread_message_count
          last_message {
            message_id
            message
            created_at
          }
          members {
            user_id
            nickname
            profile_url
            role
            is_muted
          }
        } 
      }`;
      const result = await this.gqlRequest(query);
      
      const channels = (result?.messengerMyChannels || []).map(ch => this._normalizeChannel(ch));
      
      // Cache channels
      channels.forEach(ch => this.channels.set(ch.url, ch));
      
      return channels;
    } catch (error) {
      console.error('Messenger: getStudyGroups error', error);
      return [];
    }
  }

  async createNewGroup(group, userId) {
    try {
      const mutation = `mutation {
        messengerCreateChannel(
          name: "${group.name}"
          customType: "${group.type}"
          description: "${group.description || ''}"
          coverUrl: "${group.groupImage?.img || ''}"
          operatorIds: ["${userId}"]
        ) {
          channel_url
          name
          cover_url
          custom_type
        }
      }`;
      const result = await this.gqlRequest(mutation);
      
      if (result?.messengerCreateChannel) {
        const channel = this._normalizeChannel(result.messengerCreateChannel);
        this.channels.set(channel.url, channel);
        return { groupChannel: channel, room: null };
      }
      return null;
    } catch (error) {
      console.error('Messenger: createNewGroup error', error);
      return error;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC API - Messages
  // ─────────────────────────────────────────────────────────────────

  async loadGroupMessages(group) {
    const channelUrl = group.channel_url || group.url;
    try {
      const query = `query { 
        messengerMessages(channelUrl: "${channelUrl}", limit: 30) { 
          message_id 
          channel_url 
          user_id
          user {
            user_id
            nickname
            profile_url
          }
          message_type 
          message 
          custom_type 
          link_type
          link_target
          parent_message_id
          thread_info { reply_count }
          reactions { reaction_key user_ids }
          created_at
          updated_at
        } 
      }`;
      const result = await this.gqlRequest(query);
      
      return (result?.messengerMessages || [])
        .map(msg => this._normalizeMessage(msg))
        .reverse(); // Sendbird returns newest first, UI expects oldest first
    } catch (error) {
      console.error('Messenger: loadGroupMessages error', error);
      return [];
    }
  }

  async loadPreviousMessages({ group, id, prevResultSize }) {
    if (!id) return [];
    
    const channelUrl = group.channel_url || group.url;
    const limit = prevResultSize || 30;
    
    try {
      const query = `query { 
        messengerMessages(channelUrl: "${channelUrl}", before: "${id}", limit: ${limit}) {
          message_id 
          channel_url 
          user_id
          user {
            user_id
            nickname
            profile_url
          }
          message_type 
          message 
          custom_type 
          link_type
          link_target
          parent_message_id
          thread_info { reply_count }
          reactions { reaction_key user_ids }
          created_at
          updated_at
        } 
      }`;
      const result = await this.gqlRequest(query);
      
      return (result?.messengerMessages || [])
        .map(msg => this._normalizeMessage(msg))
        .reverse();
    } catch (error) {
      console.error('Messenger: loadPreviousMessages error', error);
      return [];
    }
  }

  async loadThreadedMessages(parentMessage) {
    const parentId = parentMessage.messageId || parentMessage.message_id;
    
    try {
      const query = `query { 
        messengerThreadMessages(parentMessageId: "${parentId}") {
          message_id 
          channel_url 
          user_id
          user {
            user_id
            nickname
            profile_url
          }
          message_type 
          message 
          custom_type
          parent_message_id
          reactions { reaction_key user_ids }
          created_at
        } 
      }`;
      const result = await this.gqlRequest(query);
      
      // Return format expected by UI: { parentMessage, threadedMessages }
      return {
        parentMessage: parentMessage,
        threadedMessages: (result?.messengerThreadMessages || [])
          .map(msg => this._normalizeMessage(msg))
      };
    } catch (error) {
      console.error('Messenger: loadThreadedMessages error', error);
      return { parentMessage, threadedMessages: [] };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC API - Send/Update Messages
  // ─────────────────────────────────────────────────────────────────

  sendUserMessage(channel, messageText, data = {}, customType = '') {
    return new Promise((resolve, reject) => {
      const channelUrl = channel.channel_url || channel.url;
      
      // Parse links from data
      let link = undefined;
      if (data.links) {
        const key = Object.keys(data.links)[0];
        link = {
          type: key,
          target: data.links[key]
        };
      }
      
      this.socket.emit('send_message', {
        channelUrl,
        message: messageText,
        link,
        highlights: data.highlights,
        customType
      }, (response) => {
        if (response.success) {
          resolve(this._normalizeMessage(response.message));
        } else {
          reject(new Error(response.error || 'Failed to send message'));
        }
      });
    });
  }

  // Alias for compatibility
  async sendMessage(channel, messageText, data, customType) {
    return this.sendUserMessage(channel, messageText, data, customType);
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC API - User State & Actions
  // ─────────────────────────────────────────────────────────────────

  fireStudyGroupAction(firedAction, channel) {
    if (!channel) return false;
    const channelUrl = channel.channel_url || channel.url;
    
    this.socket.emit('fire_action', {
      channelUrl,
      action: typeof firedAction === 'string' ? firedAction : JSON.stringify(firedAction)
    });
    
    return true;
  }

  updateUserState({ channels, activeGroup, activeCall, key }) {
    // Emit to socket for real-time sync
    this.socket.emit('update_state', { 
      activeGroup, 
      activeCall 
    });

    // Update local user state
    if (this._currentUser) {
      this._currentUser.metaData = { 
        ...this._currentUser.metaData, 
        activeGroup, 
        activeCall 
      };
    }

    // Fire action to all channels
    if (Array.isArray(channels) && key) {
      channels.forEach(channel => {
        this.fireStudyGroupAction({
          username: this.userId,
          key: key || 'updateUserState',
          val: { activeGroup, activeCall }
        }, channel);
      });
    }
    
    return true;
  }

  updatePagePosition({ channel, pageSlug, location, username }) {
    return this.fireStudyGroupAction({
      username,
      key: 'updatePagePosition',
      val: { pageSlug, location }
    }, channel);
  }

  updateTypingLocation({ channel, action, username }) {
    return this.fireStudyGroupAction({
      username,
      key: 'updateTypingLocation',
      val: action
    }, channel);
  }

  updateUserSummary({ channels, summaryData }) {
    if (!summaryData) return false;
    
    const {
      completed, started, first, duration, count,
      slug, pagetitle, heading, latest, finished
    } = summaryData;
    
    const updatedMetadata = {
      summary: JSON.stringify({ completed, started, first, duration, count, finished }),
      bookmark: JSON.stringify({ latest, slug, pagetitle, heading })
    };

    // Update via GraphQL
    this.gqlRequest(`mutation {
      messengerUpdateUserMetadata(
        userId: "${this.userId}"
        metadata: ${JSON.stringify(JSON.stringify(updatedMetadata))}
      )
    }`).catch(console.error);

    // Fire to channels
    if (Array.isArray(channels)) {
      channels.forEach(channel => {
        this.fireStudyGroupAction({
          username: this.userId,
          key: 'updateUserSummary',
          val: updatedMetadata
        }, channel);
      });
    }

    return true;
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC API - DMs & Unread
  // ─────────────────────────────────────────────────────────────────

  async loadUnreadDMs() {
    try {
      const query = `query { 
        messengerUnreadDMs(userId: "${this.userId}") {
          channel_url
          other_user_id
          unread_count
        }
      }`;
      const result = await this.gqlRequest(query);
      
      const unreadMap = {};
      (result?.messengerUnreadDMs || []).forEach(dm => {
        if (!unreadMap[dm.other_user_id]) {
          unreadMap[dm.other_user_id] = {
            unread: dm.unread_count,
            channel: dm.channel_url
          };
        }
      });
      
      return unreadMap;
    } catch (error) {
      console.error('Messenger: loadUnreadDMs error', error);
      return {};
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC API - Member Management
  // ─────────────────────────────────────────────────────────────────

  async inviteMembers(channel, userIds) {
    const channelUrl = channel.channel_url || channel.url;
    try {
      const mutation = `mutation {
        messengerInviteMembers(
          channelUrl: "${channelUrl}"
          userIds: ${JSON.stringify(userIds)}
        )
      }`;
      return await this.gqlRequest(mutation);
    } catch (error) {
      console.error('Messenger: inviteMembers error', error);
      throw error;
    }
  }

  async acceptInvitation(channel) {
    const channelUrl = channel.channel_url || channel.url;
    try {
      const mutation = `mutation {
        messengerAcceptInvitation(channelUrl: "${channelUrl}", userId: "${this.userId}")
      }`;
      return await this.gqlRequest(mutation);
    } catch (error) {
      console.error('Messenger: acceptInvitation error', error);
      throw error;
    }
  }

  async declineInvitation(channel) {
    const channelUrl = channel.channel_url || channel.url;
    try {
      const mutation = `mutation {
        messengerDeclineInvitation(channelUrl: "${channelUrl}", userId: "${this.userId}")
      }`;
      return await this.gqlRequest(mutation);
    } catch (error) {
      console.error('Messenger: declineInvitation error', error);
      throw error;
    }
  }

  async removeMember(channel, userId) {
    const channelUrl = channel.channel_url || channel.url;
    try {
      const mutation = `mutation {
        messengerRemoveMember(channelUrl: "${channelUrl}", userId: "${userId}")
      }`;
      return await this.gqlRequest(mutation);
    } catch (error) {
      console.error('Messenger: removeMember error', error);
      throw error;
    }
  }

  async banMember(channel, userId) {
    // For now, just remove the member (ban functionality can be added later)
    return this.removeMember(channel, userId);
  }

  async muteMember(channel, userId) {
    const channelUrl = channel.channel_url || channel.url;
    try {
      return await this.gqlRequest(`mutation {
        messengerSetMute(channelUrl: "${channelUrl}", userId: "${userId}", muted: true)
      }`);
    } catch (error) {
      console.error('Messenger: muteMember error', error);
      throw error;
    }
  }

  async unMuteMember(channel, userId) {
    const channelUrl = channel.channel_url || channel.url;
    try {
      return await this.gqlRequest(`mutation {
        messengerSetMute(channelUrl: "${channelUrl}", userId: "${userId}", muted: false)
      }`);
    } catch (error) {
      console.error('Messenger: unMuteMember error', error);
      throw error;
    }
  }

  async makeAdmin(channel, userId) {
    const channelUrl = channel.channel_url || channel.url;
    try {
      const mutation = `mutation {
        messengerUpdateMemberRole(
          channelUrl: "${channelUrl}"
          userId: "${userId}"
          role: "operator"
        )
      }`;
      return await this.gqlRequest(mutation);
    } catch (error) {
      console.error('Messenger: makeAdmin error', error);
      throw error;
    }
  }

  async removeAdmin(channel, userId) {
    const channelUrl = channel.channel_url || channel.url;
    try {
      const mutation = `mutation {
        messengerUpdateMemberRole(
          channelUrl: "${channelUrl}"
          userId: "${userId}"
          role: "member"
        )
      }`;
      return await this.gqlRequest(mutation);
    } catch (error) {
      console.error('Messenger: removeAdmin error', error);
      throw error;
    }
  }

  async fetchGroupOperators(groupChannel) {
    if (!groupChannel) return [];
    const channelUrl = groupChannel.channel_url || groupChannel.url;
    
    try {
      const query = `query {
        messengerChannelOperators(channelUrl: "${channelUrl}") {
          user_id
        }
      }`;
      const result = await this.gqlRequest(query);
      return (result?.messengerChannelOperators || []).map(u => u.user_id);
    } catch (error) {
      console.error('Messenger: fetchGroupOperators error', error);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC API - Channel Settings
  // ─────────────────────────────────────────────────────────────────

  async setGroupNameDescription(channel, newName, newDesc) {
    const channelUrl = channel.channel_url || channel.url;
    try {
      const mutation = `mutation {
        messengerUpdateChannel(
          channelUrl: "${channelUrl}"
          name: "${newName}"
          description: "${newDesc || ''}"
        ) {
          channel_url
          name
          description
        }
      }`;
      const result = await this.gqlRequest(mutation);
      
      // Update cache
      if (result?.messengerUpdateChannel) {
        const updated = this._normalizeChannel(result.messengerUpdateChannel);
        this.channels.set(channelUrl, { ...this.channels.get(channelUrl), ...updated });
      }
      
      return result?.messengerUpdateChannel;
    } catch (error) {
      console.error('Messenger: setGroupNameDescription error', error);
      throw error;
    }
  }

  async updateCurrentUserInfo(nickname, profileUrl) {
    try {
      const mutation = `mutation {
        messengerUpdateUser(
          userId: "${this.userId}"
          nickname: "${nickname || ''}"
          profileUrl: "${profileUrl || ''}"
        ) {
          user_id
          nickname
          profile_url
        }
      }`;
      const result = await this.gqlRequest(mutation);
      
      if (result?.messengerUpdateUser) {
        this._currentUser = this._normalizeUser(result.messengerUpdateUser);
      }
      
      return this._currentUser;
    } catch (error) {
      console.error('Messenger: updateCurrentUserInfo error', error);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC API - Room/Call (Stubs - calls not yet implemented)
  // ─────────────────────────────────────────────────────────────────

  async createNewRoom() {
    // Voice/video calls not implemented in messenger yet
    return null;
  }

  async fetchRoom(roomId) {
    return null;
  }

  async fetchRoomFromGroup(group, src) {
    return null;
  }

  async resetRoom(groupChannel) {
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // UTILITY METHODS
  // ─────────────────────────────────────────────────────────────────

  async gqlRequest(query) {
    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ query })
      });
      
      const { data, errors } = await response.json();
      
      if (errors && errors.length > 0) {
        console.error('GraphQL Errors:', errors);
        throw new Error(errors[0].message);
      }
      
      return data;
    } catch (error) {
      console.error('GraphQL Request Failed:', error);
      throw error;
    }
  }

  /**
   * Normalize channel format to match Sendbird SDK structure
   */
  _normalizeChannel(ch) {
    const self = this;
    // Compute member-derived fields (members, myRole, myMemberState, joinedMemberCount)
    // using the pure shapeChannelFields helper so the shapes stay in sync with tests.
    const channelShapedFields = shapeChannelFields(ch, this.userId);

    const channel = {
      url: ch.channel_url,
      channel_url: ch.channel_url,
      name: ch.name,
      coverUrl: ch.cover_url || '',
      cover_url: ch.cover_url || '',
      customType: ch.custom_type || '',
      custom_type: ch.custom_type || '',
      data: JSON.stringify({ description: ch.description || '' }),
      description: ch.description || '',
      // members, myRole, myMemberState, joinedMemberCount from shapeChannelFields
      ...channelShapedFields,
      memberCount: ch.member_count || 0,
      unreadMessageCount: ch.unread_message_count || 0,
      lastMessage: ch.last_message ? this._normalizeMessage(ch.last_message) : null,
      isGroupChannel: () => true,
      isOpenChannel: () => ch.custom_type === 'open',
      // Compatibility methods
      getCachedMetadata: () => ch.metadata || {},
      getMetaData: async (keys) => ch.metadata || {},
      updateMetaData: async (data, upsert) => {
        this.fireStudyGroupAction(data.action ? { action: data.action } : data, ch);
        return data;
      },
      // SendBird exposed both create + update; the new-group flow (generateGroupHash)
      // calls createMetaData. Alias it to updateMetaData so the post-create chain
      // (set-active → open study hall → refresh list) isn't aborted by a missing fn.
      createMetaData: async (data) => {
        this.fireStudyGroupAction(data.action ? { action: data.action } : data, ch);
        return data;
      },
      createPreviousMessageListQuery: (params) => ({
        load: () => this.loadGroupMessages(ch)
      }),
      getMessagesByMessageId: (id, params) => 
        this.loadPreviousMessages({ group: ch, id, prevResultSize: params.prevResultSize }),
      getTypingUsers: () => [],
      
      // ─── SEND USER MESSAGE (Sendbird Builder Pattern) ───
      sendUserMessage: (params) => {
        let successCallback = null;
        let failCallback = null;
        
        // Parse params
        const data = params.data ? JSON.parse(params.data) : {};
        
        // Send via socket
        const promise = new Promise((resolve, reject) => {
          self.socket.emit('send_message', {
            channelUrl: ch.channel_url,
            message: params.message,
            link: data.links ? {
              type: Object.keys(data.links)[0],
              target: Object.values(data.links)[0]
            } : undefined,
            highlights: data.highlights,
            customType: params.customType,
            parentMessageId: params.parentMessageId
          }, (response) => {
            if (response?.success) {
              const normalizedMsg = self._normalizeMessage(response.message);
              if (successCallback) successCallback(normalizedMsg);
              resolve(normalizedMsg);
            } else {
              const error = new Error(response?.error || 'Failed to send message');
              if (failCallback) failCallback(error);
              reject(error);
            }
          });
        });
        
        // Return builder pattern
        return {
          onSucceeded: (cb) => {
            successCallback = cb;
            return { onFailed: (cb2) => { failCallback = cb2; return promise; } };
          },
          onFailed: (cb) => {
            failCallback = cb;
            return { onSucceeded: (cb2) => { successCallback = cb2; return promise; } };
          },
          then: promise.then.bind(promise),
          catch: promise.catch.bind(promise)
        };
      },
      
      // ─── MARK AS READ ───
      markAsRead: () => {
        self.socket.emit('mark_read', { channelUrl: ch.channel_url });
      },
      
      inviteWithUserIds: (userIds, callback) => 
        this.inviteMembers(ch, userIds).then(r => callback?.(r, null)).catch(e => callback?.(null, e)),
      acceptInvitation: (callback) =>
        this.acceptInvitation(ch).then(r => callback?.(r, null)).catch(e => callback?.(null, e)),
      declineInvitation: (callback) =>
        this.declineInvitation(ch).then(r => callback?.(r, null)).catch(e => callback?.(null, e)),
      banUserWithUserId: (userId, seconds, desc, callback) =>
        this.banMember(ch, userId).then(r => callback?.(r, null)).catch(e => callback?.(null, e)),
      muteUserWithUserId: (userId, callback) =>
        this.muteMember(ch, userId).then(r => callback?.(r, null)).catch(e => callback?.(null, e)),
      unmuteUserWithUserId: (userId, callback) =>
        this.unMuteMember(ch, userId).then(r => callback?.(r, null)).catch(e => callback?.(null, e)),
      addOperators: (userIds, callback) =>
        this.makeAdmin(ch, userIds[0]).then(r => callback?.(r, null)).catch(e => callback?.(null, e)),
      removeOperators: (userIds, callback) =>
        this.removeAdmin(ch, userIds[0]).then(r => callback?.(r, null)).catch(e => callback?.(null, e)),
      createOperatorListQuery: () => ({
        next: () => this.fetchGroupOperators(ch).then(ids => ids.map(id => ({ userId: id })))
      }),
      updateChannel: (params) => this.setGroupNameDescription(ch, params.name, 
        JSON.parse(params.data || '{}').description),
      
      // ─── TYPING INDICATORS ───
      startTyping: () => {
        this.socket.emit('typing_start', { channelUrl: ch.channel_url });
      },
      endTyping: () => {
        this.socket.emit('typing_stop', { channelUrl: ch.channel_url });
      },
      
      // ─── REACTIONS ───
      addReaction: (message, emojiKey) => {
        return new Promise((resolve, reject) => {
          const messageId = message.messageId || message.message_id;
          this.socket.emit('add_reaction', {
            channelUrl: ch.channel_url,
            messageId,
            reactionKey: emojiKey
          }, (response) => {
            if (response?.success) {
              resolve({
                messageId,
                key: emojiKey,
                userId: this.userId,
                operation: 'add'
              });
            } else {
              reject(new Error(response?.error || 'Failed to add reaction'));
            }
          });
        });
      },
      deleteReaction: (message, emojiKey) => {
        return new Promise((resolve, reject) => {
          const messageId = message.messageId || message.message_id;
          this.socket.emit('remove_reaction', {
            channelUrl: ch.channel_url,
            messageId,
            reactionKey: emojiKey
          }, (response) => {
            if (response?.success) {
              resolve({
                messageId,
                key: emojiKey,
                userId: this.userId,
                operation: 'delete'
              });
            } else {
              reject(new Error(response?.error || 'Failed to remove reaction'));
            }
          });
        });
      },
      
      // ─── MESSAGE EDITING ───
      updateUserMessage: (messageId, params) => {
        return new Promise((resolve, reject) => {
          this.socket.emit('edit_message', {
            channelUrl: ch.channel_url,
            messageId,
            message: params.message,
            customType: params.customType,
            data: params.data
          }, (response) => {
            if (response?.success) {
              resolve(this._normalizeMessage(response.message));
            } else {
              reject(new Error(response?.error || 'Failed to update message'));
            }
          });
        });
      },
      
      // ─── MESSAGE DELETION ───
      deleteMessage: (message) => {
        return new Promise((resolve, reject) => {
          const messageId = message.messageId || message.message_id;
          this.socket.emit('delete_message', {
            channelUrl: ch.channel_url,
            messageId
          }, (response) => {
            if (response?.success) {
              resolve(true);
            } else {
              reject(new Error(response?.error || 'Failed to delete message'));
            }
          });
        });
      }
    };
    
    return channel;
  }

  // SendBird-user shape expected by the Study components (getFreshUsers et
  // al.): userId, user_id, nickname, profileUrl, plainProfileUrl,
  // metaData{isBot,activeGroup,summary}, connectionStatus, lastSeenAt.
  // Also attaches the updateMetaData compat method that some callers need.
  _normalizeUser(u) {
    const shaped = shapeUser(u);
    // Attach the compat updateMetaData method (needs controller `this`).
    shaped.updateMetaData = async (data, upsert, callback) => {
      try {
        await this.gqlRequest(`mutation {
          messengerUpdateUserMetadata(
            userId: "${u.user_id}"
            metadata: ${JSON.stringify(JSON.stringify(data))}
          )
        }`);
        if (callback) callback(data, null);
        return data;
      } catch (error) {
        if (callback) callback(null, error);
        throw error;
      }
    };
    return shaped;
  }

  async getUsersByIds(userIds = []) {
    const ids = (userIds || []).filter((id) => typeof id === 'string' && id.length);
    if (!ids.length) return [];
    const query = `query {
      messengerUsers(userIds: ${JSON.stringify(ids)}) {
        user_id
        nickname
        profile_url
        metadata
        is_online
        last_seen_at
        is_bot
      }
    }`;
    const result = await this.gqlRequest(query);
    return (result?.messengerUsers || []).map((u) => this._normalizeUser(u));
  }

  // Expose sb property for compatibility with code that accesses appController.sendbird.sb
  get sb() {
    const self = this;
    return {
      currentUser: this._currentUser,
      // SendBird-compat: the old SDK's user-list query, backed by our
      // messengerUsers GraphQL query. The Study call sites only use
      // userIdsFilter plus the hasNext/next() pager, so this is a one-shot
      // pager (everything arrives in the first page).
      createApplicationUserListQuery: (params = {}) => {
        const userIds = params.userIdsFilter || [];
        const pager = {
          hasNext: true,
          next: async (callback) => {
            pager.hasNext = false;
            try {
              const users = await self.getUsersByIds(userIds);
              if (callback) callback(users, null);
              return users;
            } catch (error) {
              if (callback) callback(null, error);
              throw error;
            }
          },
        };
        return pager;
      },
      connect: (userId, token, callback) => {
        return this.connect(userId, token).then(user => {
          if (callback) callback(user, null);
          return user;
        }).catch(err => {
          if (callback) callback(null, err);
          throw err;
        });
      },
      disconnect: () => this.disconnect(),
      groupChannel: {
        createMyGroupChannelListQuery: (params) => ({
          hasNext: true,
          next: (callback) => this.getStudyGroups().then(channels => {
            if (callback) return callback(channels, null);
            return channels;
          })
        }),
        createChannel: (params) => this.createNewGroup(params, this.userId),
        getChannel: async (channelUrl, callback) => {
          try {
            // Check cache first
            if (this.channels.has(channelUrl)) {
              const channel = this.channels.get(channelUrl);
              if (callback) callback(channel, null);
              return channel;
            }
            
            // Fetch from API
            const query = `query {
              messengerChannel(channelUrl: "${channelUrl}") {
                channel_url
                name
                cover_url
                custom_type
                description
                metadata
                member_count
                members {
                  user_id
                  nickname
                  profile_url
                  role
                }
              }
            }`;
            const result = await this.gqlRequest(query);
            if (result?.messengerChannel) {
              const channel = this._normalizeChannel(result.messengerChannel);
              this.channels.set(channelUrl, channel);
              if (callback) callback(channel, null);
              return channel;
            }
            throw new Error('Channel not found');
          } catch (error) {
            if (callback) callback(null, error);
            throw error;
          }
        }
      },
      // Capital G for compatibility with some code
      GroupChannel: {
        getChannel: async (channelUrl, callback) => {
          return this.sb.groupChannel.getChannel(channelUrl, callback);
        }
      },
      message: {
        getMessage: async (params) => {
          const query = `query {
            messengerMessage(messageId: "${params.messageId}") {
              message_id
              channel_url
              user_id
              message
              custom_type
              parent_message_id
              thread_info { reply_count }
              created_at
            }
          }`;
          const result = await this.gqlRequest(query);
          return result?.messengerMessage ? this._normalizeMessage(result.messengerMessage) : null;
        }
      }
    };
  }
}
