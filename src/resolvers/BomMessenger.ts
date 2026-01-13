/**
 * BomMessenger GraphQL Resolvers
 * Phase 2: Sendbird Migration
 * 
 * Resolvers for the new messenger GraphQL schema
 */

import { messenger } from '../library/messenger';
import GraphQLJSON from 'graphql-type-json';

export default {
  // Custom scalar for JSON type
  JSON: GraphQLJSON,

  Query: {
    // ─────────────────────────────────────────────────────────────────
    // USER QUERIES
    // ─────────────────────────────────────────────────────────────────
    
    messengerUser: async (_: any, { userId }: { userId: string }) => {
      return messenger.getUser(userId);
    },

    messengerUsers: async (_: any, { userIds }: { userIds: string[] }) => {
      return messenger.getUsers(userIds);
    },

    messengerBots: async (_: any, { lang }: { lang?: string }) => {
      return messenger.listBotUsers(lang);
    },

    // ─────────────────────────────────────────────────────────────────
    // CHANNEL QUERIES
    // ─────────────────────────────────────────────────────────────────

    messengerChannel: async (_: any, { channelUrl }: { channelUrl: string }) => {
      return messenger.getChannel(channelUrl);
    },

    messengerMyChannels: async (_: any, { 
      userId, 
      customTypes, 
      limit 
    }: { 
      userId: string; 
      customTypes?: string[]; 
      limit?: number 
    }) => {
      return messenger.getMyChannels(userId, { customTypes, limit });
    },

    messengerPublicChannels: async (_: any, { 
      lang, 
      customTypes, 
      limit 
    }: { 
      lang?: string; 
      customTypes?: string[]; 
      limit?: number 
    }) => {
      return messenger.getPublicChannels({ lang, customTypes, limit });
    },

    messengerMembers: async (_: any, { channelUrl }: { channelUrl: string }) => {
      return messenger.getChannelMembers(channelUrl);
    },

    // ─────────────────────────────────────────────────────────────────
    // MESSAGE QUERIES
    // ─────────────────────────────────────────────────────────────────

    messengerMessages: async (_: any, { 
      channelUrl, 
      before, 
      limit 
    }: { 
      channelUrl: string; 
      before?: string; 
      limit?: number 
    }) => {
      return messenger.getMessages(channelUrl, { before, limit });
    },

    messengerMessage: async (_: any, { 
      channelUrl, 
      messageId 
    }: { 
      channelUrl: string; 
      messageId: string 
    }) => {
      return messenger.getMessage(channelUrl, messageId);
    },

    messengerThread: async (_: any, { parentMessageId }: { parentMessageId: string }) => {
      return messenger.getThread(parentMessageId);
    },

    messengerUnreadCount: async (_: any, { 
      channelUrl, 
      userId 
    }: { 
      channelUrl: string; 
      userId: string 
    }) => {
      return messenger.getUnreadCount(channelUrl, userId);
    }
  },

  Mutation: {
    // ─────────────────────────────────────────────────────────────────
    // USER MUTATIONS
    // ─────────────────────────────────────────────────────────────────

    messengerUpsertUser: async (_: any, { 
      userId, 
      nickname, 
      profileUrl, 
      bomUserId, 
      metadata, 
      isBot 
    }: { 
      userId: string; 
      nickname?: string; 
      profileUrl?: string;
      bomUserId?: string;
      metadata?: Record<string, any>;
      isBot?: boolean;
    }) => {
      return messenger.upsertUser(userId, {
        nickname,
        profile_url: profileUrl,
        bom_user_id: bomUserId,
        metadata,
        is_bot: isBot
      });
    },

    messengerUpdateNickname: async (_: any, { 
      userId, 
      nickname 
    }: { 
      userId: string; 
      nickname: string 
    }) => {
      return messenger.updateUserNickname(userId, nickname);
    },

    messengerUpdateProfileUrl: async (_: any, { 
      userId, 
      profileUrl 
    }: { 
      userId: string; 
      profileUrl: string 
    }) => {
      return messenger.updateUserProfileUrl(userId, profileUrl);
    },

    messengerUpdateUserMetadata: async (_: any, { 
      userId, 
      metadata 
    }: { 
      userId: string; 
      metadata: Record<string, any> 
    }) => {
      return messenger.updateUserMetadata(userId, metadata);
    },

    messengerSetOnline: async (_: any, { 
      userId, 
      isOnline 
    }: { 
      userId: string; 
      isOnline: boolean 
    }) => {
      await messenger.setUserOnline(userId, isOnline);
      return true;
    },

    // ─────────────────────────────────────────────────────────────────
    // CHANNEL MUTATIONS
    // ─────────────────────────────────────────────────────────────────

    messengerCreateChannel: async (_: any, { input }: { 
      input: {
        channelUrl?: string;
        name: string;
        customType: 'private' | 'public' | 'open' | 'solo' | 'DM';
        userIds: string[];
        operatorIds: string[];
        coverUrl?: string;
        description?: string;
        metadata?: Record<string, any>;
        lang?: string;
      }
    }) => {
      return messenger.createChannel(input);
    },

    messengerAddMember: async (_: any, { 
      channelUrl, 
      userId, 
      role 
    }: { 
      channelUrl: string; 
      userId: string; 
      role?: string 
    }) => {
      return messenger.addUserToChannel(
        channelUrl, 
        userId, 
        (role as 'operator' | 'member') || 'member'
      );
    },

    messengerRemoveMember: async (_: any, { 
      channelUrl, 
      userId 
    }: { 
      channelUrl: string; 
      userId: string 
    }) => {
      return messenger.removeUserFromChannel(channelUrl, userId);
    },

    // ─────────────────────────────────────────────────────────────────
    // MESSAGE MUTATIONS
    // ─────────────────────────────────────────────────────────────────

    messengerPostMessage: async (_: any, { input }: { 
      input: {
        channelUrl: string;
        userId: string;
        message: string;
        messageType?: 'MESG' | 'FILE' | 'ADMN';
        customType?: string;
        link?: { type: string; target: string; aux?: string };
        highlights?: string[];
        metadata?: Record<string, any>;
        parentMessageId?: string;
      }
    }) => {
      return messenger.postMessage(input);
    },

    messengerUpdateMessage: async (_: any, { 
      channelUrl, 
      messageId, 
      message, 
      customType, 
      link, 
      highlights, 
      metadata 
    }: { 
      channelUrl: string; 
      messageId: string;
      message?: string;
      customType?: string;
      link?: { type: string; target: string; aux?: string };
      highlights?: string[];
      metadata?: Record<string, any>;
    }) => {
      return messenger.updateMessage(channelUrl, messageId, {
        message,
        customType,
        link,
        highlights,
        metadata
      });
    },

    messengerDeleteMessage: async (_: any, { 
      channelUrl, 
      messageId 
    }: { 
      channelUrl: string; 
      messageId: string 
    }) => {
      return messenger.deleteMessage(channelUrl, messageId);
    },

    // ─────────────────────────────────────────────────────────────────
    // REACTION MUTATIONS
    // ─────────────────────────────────────────────────────────────────

    messengerAddReaction: async (_: any, { 
      messageId, 
      userId, 
      reactionKey 
    }: { 
      messageId: string; 
      userId: string; 
      reactionKey: string 
    }) => {
      return messenger.addReaction(messageId, userId, reactionKey);
    },

    messengerRemoveReaction: async (_: any, { 
      messageId, 
      userId, 
      reactionKey 
    }: { 
      messageId: string; 
      userId: string; 
      reactionKey: string 
    }) => {
      return messenger.removeReaction(messageId, userId, reactionKey);
    },

    // ─────────────────────────────────────────────────────────────────
    // READ STATUS MUTATIONS
    // ─────────────────────────────────────────────────────────────────

    messengerMarkAsRead: async (_: any, { 
      channelUrl, 
      userId 
    }: { 
      channelUrl: string; 
      userId: string 
    }) => {
      return messenger.markAsRead(channelUrl, userId);
    }
  }
};
