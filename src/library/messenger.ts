/**
 * Messenger Service
 * Phase 2: Sendbird Migration
 * 
 * Core messaging service that replaces Sendbird SDK calls with local database operations.
 * Extends EventEmitter for WebSocket integration in Phase 3.
 */

import { EventEmitter } from 'events';
import { models, sequelize } from '../config/database';
import { Op } from 'sequelize';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// DATA TRANSFER OBJECTS (DTOs)
// These mirror Sendbird's API structure for backward compatibility
// ─────────────────────────────────────────────────────────────────────────────

export interface UserDTO {
  user_id: string;
  nickname: string;
  profile_url: string;
  metadata: Record<string, any> | null;
  is_online: boolean;
  last_seen_at: number | null; // timestamp
  is_bot: boolean;
}

export interface MemberDTO extends UserDTO {
  role: 'operator' | 'member';
  state: 'joined' | 'invited' | 'requested';
  is_muted: boolean;
}

export interface ChannelDTO {
  channel_url: string;
  name: string;
  cover_url: string;
  custom_type: string;
  data: string; // JSON string for backward compat
  metadata: Record<string, any> | null;
  members: MemberDTO[];
  member_count: number;
  unread_message_count: number;
  last_message: MessageDTO | null;
  created_at: number;
  lang: string;
}

export interface MessageDTO {
  message_id: string; // nanoid
  channel_url: string;
  user: UserDTO | null;
  message_type: 'MESG' | 'FILE' | 'ADMN';
  message: string;
  custom_type: string;
  data: string; // JSON string containing links/highlights for backward compat
  parent_message_id: string | null;
  thread_info: {
    reply_count: number;
    most_replies: UserDTO[];
  } | null;
  reactions: { key: string; user_ids: string[] }[];
  created_at: number; // timestamp
  updated_at: number;
}

export interface HighlightDTO {
  id: string;
  message_id: string;
  ordinal: number;
  text: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSENGER SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class Messenger extends EventEmitter {

  // ─────────────────────────────────────────────────────────────────
  // USER METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get a user by ID
   */
  async getUser(userId: string): Promise<UserDTO | null> {
    const user = await models.MessengerUser.findByPk(userId);
    return user ? this.toUserDTO(user) : null;
  }

  /**
   * Get multiple users by IDs
   */
  async getUsers(userIds: string[]): Promise<UserDTO[]> {
    if (!userIds.length) return [];
    const users = await models.MessengerUser.findAll({
      where: { user_id: { [Op.in]: userIds } }
    });
    return users.map(u => this.toUserDTO(u));
  }

  /**
   * Create or update a user
   */
  async upsertUser(userId: string, data: {
    nickname?: string;
    profile_url?: string;
    bom_user_id?: string;
    metadata?: Record<string, any>;
    is_bot?: boolean;
  }): Promise<UserDTO> {
    const [user] = await models.MessengerUser.upsert({
      user_id: userId,
      nickname: data.nickname || userId,
      profile_url: data.profile_url || '',
      bom_user_id: data.bom_user_id || null,
      metadata: data.metadata || null,
      is_bot: data.is_bot || false
    });
    return this.toUserDTO(user);
  }

  /**
   * Update user's nickname
   */
  async updateUserNickname(userId: string, nickname: string): Promise<boolean> {
    const [count] = await models.MessengerUser.update(
      { nickname },
      { where: { user_id: userId } }
    );
    return count > 0;
  }

  /**
   * Update user's profile URL
   */
  async updateUserProfileUrl(userId: string, profileUrl: string): Promise<boolean> {
    const [count] = await models.MessengerUser.update(
      { profile_url: profileUrl },
      { where: { user_id: userId } }
    );
    return count > 0;
  }

  /**
   * Update user metadata
   */
  async updateUserMetadata(userId: string, metadata: Record<string, any>): Promise<boolean> {
    const [count] = await models.MessengerUser.update(
      { metadata },
      { where: { user_id: userId } }
    );
    return count > 0;
  }

  /**
   * Get user metadata
   */
  async getUserMetadata(userId: string): Promise<Record<string, any> | null> {
    const user = await models.MessengerUser.findByPk(userId, {
      attributes: ['metadata']
    });
    return user?.metadata || null;
  }

  /**
   * Update user online status
   */
  async setUserOnline(userId: string, isOnline: boolean): Promise<void> {
    await models.MessengerUser.update(
      { 
        is_online: isOnline,
        last_seen_at: isOnline ? null : new Date()
      },
      { where: { user_id: userId } }
    );
    this.emit('userStatusChanged', { userId, isOnline });
  }

  /**
   * List bot users, optionally filtered by language
   */
  async listBotUsers(lang?: string): Promise<UserDTO[]> {
    const where: any = { is_bot: true };
    // If lang filter needed, could check metadata.lang
    const users = await models.MessengerUser.findAll({ where });
    return users.map(u => this.toUserDTO(u));
  }

  /**
   * Generate user_id from bom_user.user (MD5 hash)
   */
  static generateUserId(bomUser: string): string {
    return crypto.createHash('md5').update(bomUser).digest('hex');
  }

  // ─────────────────────────────────────────────────────────────────
  // CHANNEL METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get a channel with members
   */
  async getChannel(channelUrl: string): Promise<ChannelDTO | null> {
    const channel = await models.MessengerChannel.findByPk(channelUrl, {
      include: [{
        model: models.MessengerMember,
        as: 'members',
        include: [{
          model: models.MessengerUser,
          as: 'user'
        }]
      }]
    });
    if (!channel) return null;
    
    // Get last message
    const lastMessage = await models.MessengerMessage.findOne({
      where: { channel_url: channelUrl, parent_message_id: null },
      order: [['created_at', 'DESC']],
      include: [{
        model: models.MessengerUser,
        as: 'sender'
      }]
    });

    return this.toChannelDTO(channel, lastMessage);
  }

  /**
   * Get channels for a user
   */
  async getMyChannels(userId: string, options: {
    customTypes?: string[];
    limit?: number;
  } = {}): Promise<ChannelDTO[]> {
    const memberships = await models.MessengerMember.findAll({
      where: { 
        user_id: userId, 
        state: 'joined' 
      },
      include: [{
        model: models.MessengerChannel,
        as: 'channel',
        where: options.customTypes?.length 
          ? { custom_type: { [Op.in]: options.customTypes } }
          : undefined
      }],
      limit: options.limit || 100
    });

    // Fetch full channel data for each
    const channels = await Promise.all(
      memberships.map(m => this.getChannel((m as any).channel_url))
    );
    
    return channels.filter(Boolean) as ChannelDTO[];
  }

  /**
   * Get public/open channels (for discovery)
   */
  async getPublicChannels(options: {
    lang?: string;
    customTypes?: string[];
    limit?: number;
  } = {}): Promise<ChannelDTO[]> {
    const where: any = {
      custom_type: { [Op.in]: options.customTypes || ['public', 'open'] }
    };
    if (options.lang) {
      where.lang = options.lang;
    }

    const channels = await models.MessengerChannel.findAll({
      where,
      limit: options.limit || 100,
      order: [['updated_at', 'DESC']]
    });

    return Promise.all(channels.map(c => this.getChannel(c.channel_url))) as Promise<ChannelDTO[]>;
  }

  /**
   * Create a new channel
   */
  async createChannel(params: {
    channelUrl?: string;
    name: string;
    customType: 'private' | 'public' | 'open' | 'solo' | 'DM';
    userIds: string[];
    operatorIds: string[];
    coverUrl?: string;
    description?: string;
    metadata?: Record<string, any>;
    lang?: string;
  }): Promise<ChannelDTO> {
    const channelUrl = params.channelUrl || nanoid(11);

    const transaction = await sequelize.transaction();
    try {
      // Create channel
      await models.MessengerChannel.create({
        channel_url: channelUrl,
        name: params.name,
        custom_type: params.customType,
        cover_url: params.coverUrl || '',
        description: params.description || null,
        metadata: params.metadata || null,
        lang: params.lang || 'en'
      }, { transaction });

      // Add members
      const memberRecords = params.userIds.map(userId => ({
        channel_url: channelUrl,
        user_id: userId,
        role: params.operatorIds.includes(userId) ? 'operator' : 'member',
        state: 'joined'
      }));
      
      await models.MessengerMember.bulkCreate(memberRecords, { transaction });

      await transaction.commit();

      const channel = await this.getChannel(channelUrl);
      this.emit('channelCreated', channel);
      return channel!;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Update channel metadata
   */
  async updateChannelMetadata(channelUrl: string, metadata: Record<string, any>): Promise<boolean> {
    const [count] = await models.MessengerChannel.update(
      { metadata },
      { where: { channel_url: channelUrl } }
    );
    return count > 0;
  }

  /**
   * Add user to channel
   */
  async addUserToChannel(channelUrl: string, userId: string, role: 'operator' | 'member' = 'member'): Promise<boolean> {
    try {
      await models.MessengerMember.create({
        channel_url: channelUrl,
        user_id: userId,
        role,
        state: 'joined'
      });
      this.emit('memberJoined', { channelUrl, userId });
      return true;
    } catch (error) {
      // Handle duplicate key error (already a member)
      return false;
    }
  }

  /**
   * Remove user from channel
   */
  async removeUserFromChannel(channelUrl: string, userId: string): Promise<boolean> {
    const count = await models.MessengerMember.destroy({
      where: { channel_url: channelUrl, user_id: userId }
    });
    if (count > 0) {
      this.emit('memberLeft', { channelUrl, userId });
    }
    return count > 0;
  }

  /**
   * Get channel members
   */
  async getChannelMembers(channelUrl: string): Promise<MemberDTO[]> {
    const members = await models.MessengerMember.findAll({
      where: { channel_url: channelUrl },
      include: [{
        model: models.MessengerUser,
        as: 'user'
      }]
    });
    return members.map(m => this.toMemberDTO(m));
  }

  // ─────────────────────────────────────────────────────────────────
  // MESSAGE METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Post a new message
   */
  async postMessage(params: {
    channelUrl: string;
    userId: string;
    message: string;
    messageType?: 'MESG' | 'FILE' | 'ADMN';
    customType?: string;
    link?: { type: string; target: string; aux?: string };
    highlights?: string[];
    metadata?: Record<string, any>;
    parentMessageId?: string;
  }): Promise<MessageDTO> {
    const messageId = nanoid(11);

    const transaction = await sequelize.transaction();
    try {
      // Create message
      await models.MessengerMessage.create({
        message_id: messageId,
        channel_url: params.channelUrl,
        user_id: params.userId,
        message_type: params.messageType || 'MESG',
        message: params.message,
        custom_type: params.customType || '',
        link_type: params.link?.type || null,
        link_target: params.link?.target || null,
        link_aux: params.link?.aux || null,
        metadata: params.metadata || null,
        parent_message_id: params.parentMessageId || null
      }, { transaction });

      // Create highlights if any
      if (params.highlights?.length) {
        const highlightRecords = params.highlights.map((text, i) => ({
          id: nanoid(11),
          message_id: messageId,
          ordinal: i,
          text
        }));
        await models.MessengerHighlight.bulkCreate(highlightRecords, { transaction });
      }

      // Update channel updated_at
      await models.MessengerChannel.update(
        { updated_at: new Date() },
        { where: { channel_url: params.channelUrl }, transaction }
      );

      await transaction.commit();

      // Fetch the complete message with associations
      const message = await this.getMessage(params.channelUrl, messageId);
      this.emit('messageCreated', message);
      return message!;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get a single message by ID
   */
  async getMessage(channelUrl: string, messageId: string): Promise<MessageDTO | null> {
    const message = await models.MessengerMessage.findOne({
      where: { message_id: messageId, channel_url: channelUrl },
      include: [
        { model: models.MessengerUser, as: 'sender' },
        { model: models.MessengerHighlight, as: 'highlights' },
        { model: models.MessengerReaction, as: 'reactions' }
      ]
    });
    if (!message) return null;

    // Get thread info if this is a parent message
    const threadInfo = await this.getThreadInfo(messageId);
    
    return this.toMessageDTO(message, threadInfo);
  }

  /**
   * Get messages for a channel (paginated)
   */
  async getMessages(channelUrl: string, options: {
    before?: string; // message_id to paginate from
    limit?: number;
    includeReplies?: boolean;
  } = {}): Promise<MessageDTO[]> {
    const where: any = { 
      channel_url: channelUrl,
      is_deleted: false
    };
    
    if (!options.includeReplies) {
      where.parent_message_id = null;
    }

    if (options.before) {
      const beforeMsg = await models.MessengerMessage.findByPk(options.before);
      if (beforeMsg) {
        where.created_at = { [Op.lt]: beforeMsg.created_at };
      }
    }

    const messages = await models.MessengerMessage.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: options.limit || 30,
      include: [
        { model: models.MessengerUser, as: 'sender' },
        { model: models.MessengerHighlight, as: 'highlights' },
        { model: models.MessengerReaction, as: 'reactions' }
      ]
    });

    // Get thread info for each message
    const messageDTOs = await Promise.all(
      messages.map(async (msg) => {
        const threadInfo = await this.getThreadInfo(msg.message_id);
        return this.toMessageDTO(msg, threadInfo);
      })
    );

    return messageDTOs;
  }

  /**
   * Get thread (replies to a message)
   */
  async getThread(parentMessageId: string): Promise<MessageDTO[]> {
    const messages = await models.MessengerMessage.findAll({
      where: { 
        parent_message_id: parentMessageId,
        is_deleted: false
      },
      order: [['created_at', 'ASC']],
      include: [
        { model: models.MessengerUser, as: 'sender' },
        { model: models.MessengerHighlight, as: 'highlights' },
        { model: models.MessengerReaction, as: 'reactions' }
      ]
    });

    return messages.map(msg => this.toMessageDTO(msg, null));
  }

  /**
   * Get thread info (reply count and most active repliers)
   */
  private async getThreadInfo(messageId: string): Promise<{ reply_count: number; most_replies: UserDTO[] } | null> {
    const replies = await models.MessengerMessage.findAll({
      where: { parent_message_id: messageId },
      attributes: ['user_id'],
      include: [{ model: models.MessengerUser, as: 'sender' }]
    });

    if (replies.length === 0) return null;

    // Get unique repliers (most recent first, max 3)
    const seen = new Set<string>();
    const uniqueRepliers: UserDTO[] = [];
    for (const reply of replies.reverse()) {
      if (!seen.has((reply as any).user_id) && uniqueRepliers.length < 3) {
        seen.add((reply as any).user_id);
        uniqueRepliers.push(this.toUserDTO((reply as any).sender));
      }
    }

    return {
      reply_count: replies.length,
      most_replies: uniqueRepliers
    };
  }

  /**
   * Update a message
   */
  async updateMessage(channelUrl: string, messageId: string, params: {
    message?: string;
    customType?: string;
    link?: { type: string; target: string; aux?: string };
    highlights?: string[];
    metadata?: Record<string, any>;
  }): Promise<MessageDTO | null> {
    const transaction = await sequelize.transaction();
    try {
      const updateData: any = {};
      if (params.message !== undefined) updateData.message = params.message;
      if (params.customType !== undefined) updateData.custom_type = params.customType;
      if (params.link) {
        updateData.link_type = params.link.type;
        updateData.link_target = params.link.target;
        updateData.link_aux = params.link.aux || null;
      }
      if (params.metadata !== undefined) updateData.metadata = params.metadata;

      await models.MessengerMessage.update(updateData, {
        where: { message_id: messageId, channel_url: channelUrl },
        transaction
      });

      // Update highlights if provided
      if (params.highlights !== undefined) {
        await models.MessengerHighlight.destroy({
          where: { message_id: messageId },
          transaction
        });
        if (params.highlights.length) {
          const highlightRecords = params.highlights.map((text, i) => ({
            id: nanoid(11),
            message_id: messageId,
            ordinal: i,
            text
          }));
          await models.MessengerHighlight.bulkCreate(highlightRecords, { transaction });
        }
      }

      await transaction.commit();

      const message = await this.getMessage(channelUrl, messageId);
      this.emit('messageUpdated', message);
      return message;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(channelUrl: string, messageId: string): Promise<boolean> {
    const [count] = await models.MessengerMessage.update(
      { is_deleted: true },
      { where: { message_id: messageId, channel_url: channelUrl } }
    );
    if (count > 0) {
      this.emit('messageDeleted', { channelUrl, messageId });
    }
    return count > 0;
  }

  // ─────────────────────────────────────────────────────────────────
  // REACTION METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add a reaction to a message
   */
  async addReaction(messageId: string, userId: string, reactionKey: string): Promise<boolean> {
    try {
      await models.MessengerReaction.create({
        message_id: messageId,
        user_id: userId,
        reaction_key: reactionKey
      });
      this.emit('reactionAdded', { messageId, userId, reactionKey });
      return true;
    } catch (error) {
      return false; // Already exists
    }
  }

  /**
   * Remove a reaction from a message
   */
  async removeReaction(messageId: string, userId: string, reactionKey: string): Promise<boolean> {
    const count = await models.MessengerReaction.destroy({
      where: { message_id: messageId, user_id: userId, reaction_key: reactionKey }
    });
    if (count > 0) {
      this.emit('reactionRemoved', { messageId, userId, reactionKey });
    }
    return count > 0;
  }

  // ─────────────────────────────────────────────────────────────────
  // READ STATUS METHODS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Mark channel as read for a user
   */
  async markAsRead(channelUrl: string, userId: string): Promise<boolean> {
    const [count] = await models.MessengerMember.update(
      { last_read_at: new Date() },
      { where: { channel_url: channelUrl, user_id: userId } }
    );
    return count > 0;
  }

  /**
   * Mark a channel as read for a user
   */
  async markChannelAsRead(channelUrl: string, userId: string): Promise<boolean> {
    const [count] = await models.MessengerMember.update(
      { last_read_at: new Date() },
      { where: { channel_url: channelUrl, user_id: userId } }
    );
    return count > 0;
  }

  /**
   * Get unread message count for a user in a channel
   */
  async getUnreadCount(channelUrl: string, userId: string): Promise<number> {
    const member = await models.MessengerMember.findOne({
      where: { channel_url: channelUrl, user_id: userId }
    });
    if (!member || !member.last_read_at) return 0;

    const count = await models.MessengerMessage.count({
      where: {
        channel_url: channelUrl,
        created_at: { [Op.gt]: member.last_read_at },
        user_id: { [Op.ne]: userId }, // Don't count own messages
        parent_message_id: null // Only count top-level messages
      }
    });
    return count;
  }

  // ─────────────────────────────────────────────────────────────────
  // DTO TRANSFORMERS
  // ─────────────────────────────────────────────────────────────────

  private toUserDTO(model: any): UserDTO {
    return {
      user_id: model.user_id,
      nickname: model.nickname || model.user_id,
      profile_url: model.profile_url || '',
      metadata: model.metadata || null,
      is_online: model.is_online || false,
      last_seen_at: model.last_seen_at ? new Date(model.last_seen_at).getTime() : null,
      is_bot: model.is_bot || false
    };
  }

  private toMemberDTO(model: any): MemberDTO {
    const user = model.user ? this.toUserDTO(model.user) : {
      user_id: model.user_id,
      nickname: model.user_id,
      profile_url: '',
      metadata: null,
      is_online: false,
      last_seen_at: null,
      is_bot: false
    };
    return {
      ...user,
      role: model.role,
      state: model.state,
      is_muted: model.is_muted || false
    };
  }

  private toChannelDTO(model: any, lastMessage?: any): ChannelDTO {
    const members = model.members?.map((m: any) => this.toMemberDTO(m)) || [];
    return {
      channel_url: model.channel_url,
      name: model.name,
      cover_url: model.cover_url || '',
      custom_type: model.custom_type,
      data: JSON.stringify(model.metadata || {}), // For backward compat
      metadata: model.metadata || null,
      members,
      member_count: members.length,
      unread_message_count: 0, // Calculated separately per user
      last_message: lastMessage ? this.toMessageDTO(lastMessage, null) : null,
      created_at: new Date(model.created_at).getTime(),
      lang: model.lang || 'en'
    };
  }

  private toMessageDTO(model: any, threadInfo: { reply_count: number; most_replies: UserDTO[] } | null): MessageDTO {
    // Build data object for backward compatibility
    const dataObj: any = {};
    if (model.link_type && model.link_target) {
      dataObj.links = { [model.link_type]: model.link_target };
      if (model.link_aux) {
        dataObj.links[model.link_type] += '.' + model.link_aux;
      }
    }
    if (model.highlights?.length) {
      dataObj.highlights = model.highlights.map((h: any) => h.text);
    }

    // Group reactions by key
    const reactionsMap: Record<string, string[]> = {};
    for (const r of model.reactions || []) {
      if (!reactionsMap[r.reaction_key]) {
        reactionsMap[r.reaction_key] = [];
      }
      reactionsMap[r.reaction_key].push(r.user_id);
    }
    const reactions = Object.entries(reactionsMap).map(([key, user_ids]) => ({
      key,
      user_ids
    }));

    return {
      message_id: model.message_id,
      channel_url: model.channel_url,
      user: model.sender ? this.toUserDTO(model.sender) : null,
      message_type: model.message_type,
      message: model.message,
      custom_type: model.custom_type || '',
      data: JSON.stringify(dataObj),
      parent_message_id: model.parent_message_id || null,
      thread_info: threadInfo,
      reactions,
      created_at: new Date(model.created_at).getTime(),
      updated_at: new Date(model.updated_at).getTime()
    };
  }
}

// Export singleton instance
export const messenger = new Messenger();
