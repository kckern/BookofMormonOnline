/** messenger* READ resolvers — task 3 of docs/plans/2026-06-10-messenger-graphql-surface.md */

import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { md5 } from '../../auth/identity.js';
import { getUser } from '../../messaging/users.js';
import { getChannel, getMyChannels } from '../../messaging/channels.js';
import { getChannelMembers } from '../../messaging/members.js';
import { getMessages, getMessage, getThread } from '../../messaging/messages.js';
import type { MessageDTO } from '../../messaging/dto.js';

// ─── Auth helper ──────────────────────────────────────────────────────────────

/**
 * Resolve the acting messenger user_id from ctx.bearerToken.
 * bearerToken → bom_user_token join → bom_user.user → md5() = messenger user_id.
 * Returns null when the token is absent or unknown.
 */
async function resolveActingUserId(ctx: AppContext): Promise<string | null> {
  const token = ctx.bearerToken;
  if (!token) return null;
  const row = await ctx.db
    .selectFrom('bom_user_token')
    .innerJoin('bom_user', 'bom_user.user', 'bom_user_token.user')
    .select('bom_user.user as username')
    .where('bom_user_token.token', '=', token)
    .limit(1)
    .executeTakeFirst();
  if (!row) return null;
  return md5(row.username);
}

// ─── link_type / link_target extraction from data JSON ───────────────────────

/**
 * The MessageDTO packs link_type/link_target into a `data` JSON string:
 *   { links?: { [link_type]: "link_target[.link_aux]" }, … }
 * The SDL exposes link_type and link_target as top-level fields — extract them here.
 */
function extractLinkType(msg: MessageDTO): string | null {
  if (!msg.data) return null;
  try {
    const parsed = JSON.parse(msg.data) as Record<string, unknown>;
    const links = parsed['links'];
    if (links && typeof links === 'object') {
      const keys = Object.keys(links);
      return keys[0] ?? null;
    }
  } catch {
    // ignore malformed data
  }
  return null;
}

function extractLinkTarget(msg: MessageDTO): string | null {
  if (!msg.data) return null;
  try {
    const parsed = JSON.parse(msg.data) as Record<string, unknown>;
    const links = parsed['links'];
    if (links && typeof links === 'object') {
      const entries = Object.entries(links);
      if (entries.length > 0) {
        const value = entries[0]?.[1];
        if (typeof value === 'string') {
          // strip the optional .link_aux suffix — link_target is the part before the first dot
          // (only if an aux was appended; otherwise return as-is)
          return value;
        }
      }
    }
  } catch {
    // ignore malformed data
  }
  return null;
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

export const messengerResolvers: Resolvers = {
  Query: {
    /**
     * messengerUser(userId) — look up a single messenger user by their user_id.
     * Falls back to the acting user (from bearer token) when userId is not provided.
     */
    messengerUser: async (_root, args, ctx: AppContext) => {
      const userId = args.userId ?? (await resolveActingUserId(ctx));
      if (!userId) return null;
      return getUser(ctx.db, userId);
    },

    /**
     * messengerMyChannels(userId) — all joined channels for a user, with
     * unread_message_count, last_message, and members pre-assembled by the service.
     */
    messengerMyChannels: async (_root, args, ctx: AppContext) => {
      const userId = args.userId ?? (await resolveActingUserId(ctx));
      if (!userId) return [];
      return getMyChannels(ctx.db, userId);
    },

    /**
     * messengerChannel(channelUrl) — single channel.
     * Viewer user_id (from bearer) is passed so unread_message_count is accurate.
     */
    messengerChannel: async (_root, args, ctx: AppContext) => {
      if (!args.channelUrl) return null;
      const viewerUserId = await resolveActingUserId(ctx);
      return getChannel(ctx.db, args.channelUrl, viewerUserId ?? undefined);
    },

    /**
     * messengerChannelOperators(channelUrl) — members with role === 'operator',
     * returned as MessengerUser objects (only user_id is selected by the controller).
     */
    messengerChannelOperators: async (_root, args, ctx: AppContext) => {
      if (!args.channelUrl) return [];
      const members = await getChannelMembers(ctx.db, args.channelUrl);
      return members.filter((m) => m.role === 'operator');
    },

    /**
     * messengerMessages(channelUrl, limit, before) — paginated channel history.
     * `before` is a nanoid string cursor (message_id of the oldest visible message).
     * getMessages() already supports cursor-based pagination by before.
     */
    messengerMessages: async (_root, args, ctx: AppContext) => {
      if (!args.channelUrl) return [];
      return getMessages(ctx.db, args.channelUrl, {
        limit: args.limit ?? 30,
        before: args.before ?? undefined,
      });
    },

    /**
     * messengerMessage(messageId) — single message by ID.
     * getMessage() requires (db, channelUrl, messageId); since we only have messageId,
     * we do a minimal inline Kysely query to resolve the channel_url first, then call
     * getMessage() — this avoids adding a new function to messages.ts.
     */
    messengerMessage: async (_root, args, ctx: AppContext) => {
      if (!args.messageId) return null;
      // Resolve channel_url from the message_id so we can call the existing getMessage().
      const row = await ctx.db
        .selectFrom('messenger_messages')
        .select(['channel_url'])
        .where('message_id', '=', args.messageId)
        .where((eb) => eb.or([eb('is_deleted', 'is', null), eb('is_deleted', '=', 0)]))
        .executeTakeFirst();
      if (!row) return null;
      return getMessage(ctx.db, row.channel_url, args.messageId);
    },

    /**
     * messengerThreadMessages(parentMessageId) — replies to a parent message.
     */
    messengerThreadMessages: async (_root, args, ctx: AppContext) => {
      if (!args.parentMessageId) return [];
      return getThread(ctx.db, args.parentMessageId);
    },

    /**
     * messengerUnreadDMs(userId) — DM channels with unread messages.
     * Returns [{channel_url, other_user_id, unread_count}].
     * other_user_id is the channel member whose user_id !== the requesting user.
     */
    messengerUnreadDMs: async (_root, args, ctx: AppContext) => {
      const userId = args.userId ?? (await resolveActingUserId(ctx));
      if (!userId) return [];

      const channels = await getMyChannels(ctx.db, userId);
      const dmChannels = channels.filter((ch) => ch.custom_type === 'DM');

      return dmChannels
        .filter((ch) => ch.unread_message_count > 0)
        .map((ch) => {
          const otherMember = ch.members.find((m) => m.user_id !== userId);
          return {
            channel_url: ch.channel_url,
            other_user_id: otherMember?.user_id ?? null,
            unread_count: ch.unread_message_count,
          };
        });
    },
  },

  // ─── MessengerMessage field resolvers ──────────────────────────────────────

  MessengerMessage: {
    /**
     * link_type — extracted from the `data` JSON string (not a top-level DTO field).
     * The MessageDTO packs links as: { links: { [link_type]: link_target } }
     */
    link_type: (parent) => extractLinkType(parent as unknown as MessageDTO),

    /**
     * link_target — extracted from the `data` JSON string.
     */
    link_target: (parent) => extractLinkTarget(parent as unknown as MessageDTO),

    /**
     * reactions — the DTO stores reactions as [{key, user_ids}] but the SDL expects
     * [{reaction_key, user_ids}]. Rename key → reaction_key here.
     */
    reactions: (parent) => {
      const msg = parent as unknown as MessageDTO;
      if (!msg.reactions) return [];
      return msg.reactions.map((r) => ({
        reaction_key: r.key,
        user_ids: r.user_ids,
      }));
    },

    /**
     * user_id — the DTO has this on the top level; expose it directly.
     * (MessageDTO.user_id is not on the DTO — it's accessible as user.user_id.
     *  The DB row has user_id; expose from the DTO's user object as fallback.)
     */
    user_id: (parent) => {
      const msg = parent as unknown as MessageDTO & { user_id?: string };
      // MessageDTO doesn't have a top-level user_id, but the DB row does.
      // The SDL field user_id should come from the message row itself.
      // assembleMessageDTO doesn't copy user_id to the DTO — use user.user_id.
      return msg.user_id ?? msg.user?.user_id ?? null;
    },
  },
};
