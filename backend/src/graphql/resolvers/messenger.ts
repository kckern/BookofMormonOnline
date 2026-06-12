/**
 * messenger* resolvers — tasks 3 + 4 of docs/plans/2026-06-10-messenger-graphql-surface.md
 * Task 3: READ resolvers (Query block + field resolvers)
 * Task 4: WRITE resolvers (Mutation block — channel/user/member ops with RealtimeBus fan-out)
 */

import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { md5 } from '../../auth/identity.js';
import { getUser, getUsers, updateUserNickname, updateUserProfileUrl, updateUserMetadata } from '../../messaging/users.js';
import { getChannel, getMyChannels, getMyDMs, createChannel } from '../../messaging/channels.js';
import { getChannelMembers, addUserToChannel, removeUserFromChannel, setMemberMuted } from '../../messaging/members.js';
import { getMessages, getMessage, getThread } from '../../messaging/messages.js';
import { getPageComments } from '../../messaging/pagecomments.js';
import { getBus } from '../../realtime/RealtimeBus.js';
import { isDuplicateKeyError } from '../../data/errors.js';
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

/**
 * Gate a channel-admin action on the bearer user being an OPERATOR of the channel.
 * Returns the acting user_id when authorized, else null. Channel-admin mutations
 * (rename, role change, remove member) must not be open to any authenticated user.
 */
async function requireOperator(ctx: AppContext, channelUrl: string): Promise<string | null> {
  const actingUserId = await resolveActingUserId(ctx);
  if (!actingUserId) return null;
  const members = await getChannelMembers(ctx.db, channelUrl);
  const isOperator = members.some((m) => m.user_id === actingUserId && m.role === 'operator');
  return isOperator ? actingUserId : null;
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
     * messengerUsers(userIds) — bulk user lookup with presence resolved in one
     * round trip (backs the SendBird-compat user-list query and the Study
     * presence roster on the frontend).
     */
    messengerUsers: async (_root, args, ctx: AppContext) => {
      const userIds = (args.userIds ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0);
      if (!userIds.length) return [];
      return getUsers(ctx.db, userIds);
    },

    /**
     * messengerMyChannels(userId, customTypes) — all joined channels for a user,
     * with unread_message_count, last_message, and members pre-assembled by the
     * service. customTypes narrows by channel custom_type (e.g. the study-group
     * list excludes 'DM' channels — DMs are not study groups).
     */
    messengerMyChannels: async (_root, args, ctx: AppContext) => {
      const userId = args.userId ?? (await resolveActingUserId(ctx));
      if (!userId) return [];
      const customTypes = (args.customTypes ?? []).filter((t): t is string => typeof t === 'string' && t.length > 0);
      return getMyChannels(ctx.db, userId, customTypes.length ? { customTypes } : {});
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
      const customTypes = (args.customTypes ?? []).filter(
        (t): t is string => typeof t === 'string' && t.length > 0,
      );
      return getMessages(ctx.db, args.channelUrl, {
        limit: args.limit ?? 30,
        before: args.before ?? undefined,
        ...(customTypes.length ? { customTypes } : {}),
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

      const dmChannels = await getMyDMs(ctx.db, userId);

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

    /**
     * pagecomments(channelUrl, pageSlug) — page-scoped study comments plus
     * per-verse com/img counts resolved server-side (spec P1): one round trip
     * where the client previously needed messages + commentaryLocations/
     * imageLocations.
     */
    pagecomments: async (_root, args, ctx: AppContext) => {
      if (!args.channelUrl || !args.pageSlug) return null;
      return getPageComments(ctx.db, args.channelUrl, args.pageSlug);
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

  // ─── Mutations ────────────────────────────────────────────────────────────────

  Mutation: {
    /**
     * messengerCreateChannel — create a new channel with the acting user as operator.
     * operatorIds: explicit list of user_ids to flag as operators (in addition to
     * the acting user when available). userIds is seeded from operatorIds so all
     * operators are added as members on creation.
     * Returns the full ChannelDTO (null on failure — reader DB suppressed via catch).
     */
    messengerCreateChannel: async (_root, args, ctx: AppContext) => {
      const { name, customType, description, coverUrl, operatorIds, userIds: argUserIds, channelUrl: argChannelUrl } = args as {
        name?: string | null;
        customType?: string | null;
        description?: string | null;
        coverUrl?: string | null;
        operatorIds?: string[] | null;
        userIds?: string[] | null;
        channelUrl?: string | null;
      };
      if (!name) return null;

      try {
        const actingUserId = await resolveActingUserId(ctx);
        const operators: string[] = operatorIds?.filter(Boolean) as string[] ?? [];
        // Ensure acting user is included as operator when present
        if (actingUserId && !operators.includes(actingUserId)) {
          operators.push(actingUserId);
        }

        // Merge explicit userIds with operators — union of both, deduped
        const extraUsers: string[] = argUserIds?.filter(Boolean) as string[] ?? [];
        const allUserIds = [...new Set([...operators, ...extraUsers])];

        const validTypes = ['private', 'public', 'open', 'solo', 'DM'] as const;
        const resolvedType = (validTypes.includes(customType as typeof validTypes[number])
          ? customType
          : 'private') as 'private' | 'public' | 'open' | 'solo' | 'DM';

        return await createChannel(ctx.db, {
          name,
          customType: resolvedType,
          description: description ?? undefined,
          coverUrl: coverUrl ?? undefined,
          userIds: allUserIds,
          operatorIds: operators,
          ...(argChannelUrl ? { channelUrl: argChannelUrl } : {}),
        });
      } catch (err) {
        console.error('messengerCreateChannel error:', err);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return null as any;
      }
    },

    /**
     * messengerUpdateChannel — update name and/or description of an existing channel.
     * Uses inline Kysely (no dedicated service export for partial updates).
     * Returns the updated ChannelDTO (null on failure).
     */
    messengerUpdateChannel: async (_root, args, ctx: AppContext) => {
      const { channelUrl, name, description } = args as {
        channelUrl?: string | null;
        name?: string | null;
        description?: string | null;
      };
      if (!channelUrl) return null;
      // Operator-only: don't let any authenticated user rename a channel.
      if (!(await requireOperator(ctx, channelUrl))) return null;

      try {
        // Build the update set only from supplied fields
        const updates: Record<string, string> = {};
        if (name != null) updates['name'] = name;
        if (description != null) updates['description'] = description;

        if (Object.keys(updates).length > 0) {
          await ctx.db
            .updateTable('messenger_channels')
            .set(updates as { name?: string; description?: string })
            .where('channel_url', '=', channelUrl)
            .execute();
        }

        return await getChannel(ctx.db, channelUrl);
      } catch (err) {
        console.error('messengerUpdateChannel error:', err);
        return null;
      }
    },

    /**
     * messengerUpdateUser — update nickname and/or profileUrl for a messenger user.
     * Calls updateUserNickname + updateUserProfileUrl then re-fetches via getUser.
     * Returns the updated UserDTO (null on failure).
     */
    messengerUpdateUser: async (_root, args, ctx: AppContext) => {
      const { userId, nickname, profileUrl } = args as {
        userId?: string | null;
        nickname?: string | null;
        profileUrl?: string | null;
      };
      const targetUserId = userId ?? (await resolveActingUserId(ctx));
      if (!targetUserId) return null;

      try {
        if (nickname != null) {
          await updateUserNickname(ctx.db, targetUserId, nickname);
        }
        if (profileUrl != null) {
          await updateUserProfileUrl(ctx.db, targetUserId, profileUrl);
        }
        return await getUser(ctx.db, targetUserId);
      } catch (err) {
        console.error('messengerUpdateUser error:', err);
        return null;
      }
    },

    /**
     * messengerUpdateUserMetadata — replace a user's metadata JSON.
     * metadata arrives as a JSON string from the SDL (String scalar) — parse it here.
     * Returns true on success, false on parse error or DB failure (reader suppressed).
     */
    messengerUpdateUserMetadata: async (_root, args, ctx: AppContext) => {
      const { userId, metadata } = args as {
        userId?: string | null;
        metadata?: string | null;
      };
      const targetUserId = userId ?? (await resolveActingUserId(ctx));
      if (!targetUserId || metadata == null) return false;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(metadata) as Record<string, unknown>;
      } catch {
        console.error('messengerUpdateUserMetadata: invalid JSON in metadata arg');
        return false;
      }

      try {
        return await updateUserMetadata(ctx.db, targetUserId, parsed);
      } catch (err) {
        console.error('messengerUpdateUserMetadata error:', err);
        return false;
      }
    },

    /**
     * messengerUpdateMemberRole — change a member's role in a channel.
     * role is 'operator' | 'member'. Inline Kysely update on messenger_members.
     * Emits membership_changed on the RealtimeBus.
     * Returns true on success, false on failure.
     */
    messengerUpdateMemberRole: async (_root, args, ctx: AppContext) => {
      const { channelUrl, userId, role } = args as {
        channelUrl?: string | null;
        userId?: string | null;
        role?: string | null;
      };
      if (!channelUrl || !userId || !role) return false;

      const validRoles = ['operator', 'member'] as const;
      if (!validRoles.includes(role as typeof validRoles[number])) return false;
      // Operator-only: only an operator may promote/demote members.
      if (!(await requireOperator(ctx, channelUrl))) return false;

      try {
        const result = await ctx.db
          .updateTable('messenger_members')
          .set({ role: role as 'operator' | 'member' })
          .where('channel_url', '=', channelUrl)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        const updated = Number(result.numUpdatedRows) > 0;
        if (updated) {
          getBus().emit('membership_changed', channelUrl, { channelUrl, userId, role });
        }
        return updated;
      } catch (err) {
        console.error('messengerUpdateMemberRole error:', err);
        return false;
      }
    },

    /**
     * messengerSetMute — operator mutes/unmutes a member. A muted member's
     * send_message is rejected by the realtime handler. Emits membership_changed.
     */
    messengerSetMute: async (_root, args, ctx: AppContext) => {
      const { channelUrl, userId, muted } = args as {
        channelUrl?: string | null;
        userId?: string | null;
        muted?: boolean | null;
      };
      if (!channelUrl || !userId) return false;
      if (!(await requireOperator(ctx, channelUrl))) return false;

      try {
        const ok = await setMemberMuted(ctx.db, channelUrl, userId, !!muted);
        if (ok) {
          getBus().emit('membership_changed', channelUrl, { channelUrl, userId, muted: !!muted });
        }
        return ok;
      } catch (err) {
        console.error('messengerSetMute error:', err);
        return false;
      }
    },

    /**
     * messengerRemoveMember — remove a user from a channel entirely.
     * Delegates to removeUserFromChannel service.
     * Emits membership_changed on the RealtimeBus.
     * Returns true if a row was deleted, false otherwise.
     */
    messengerRemoveMember: async (_root, args, ctx: AppContext) => {
      const { channelUrl, userId } = args as {
        channelUrl?: string | null;
        userId?: string | null;
      };
      if (!channelUrl || !userId) return false;
      // Allow an operator to remove anyone, OR a user to remove themselves (leave).
      const actingUserId = await resolveActingUserId(ctx);
      if (!actingUserId) return false;
      if (actingUserId !== userId && !(await requireOperator(ctx, channelUrl))) return false;

      try {
        const removed = await removeUserFromChannel(ctx.db, channelUrl, userId);
        if (removed) {
          // Emit both: membership_changed (channel refresh) + user_left (symmetry with
          // user_joined; the client listens for both).
          getBus().emit('membership_changed', channelUrl, { channelUrl, userId });
          getBus().emit('user_left', channelUrl, { channelUrl, user: userId });
        }
        return removed;
      } catch (err) {
        console.error('messengerRemoveMember error:', err);
        return false;
      }
    },

    /**
     * messengerInviteMembers — insert membership rows with state='invited' for each userId.
     * addUserToChannel() always sets state='joined', so we insert inline with state='invited'.
     * Duplicate-key (already a member) is silently skipped per invitation semantics.
     * Emits membership_changed once per invited user.
     * Returns true if at least one invitation was recorded, false on complete failure.
     */
    messengerInviteMembers: async (_root, args, ctx: AppContext) => {
      const { channelUrl, userIds } = args as {
        channelUrl?: string | null;
        userIds?: string[] | null;
      };
      if (!channelUrl || !userIds?.length) return false;

      let anySuccess = false;
      for (const userId of userIds) {
        if (!userId) continue;
        try {
          await ctx.db
            .insertInto('messenger_members')
            .values({
              channel_url: channelUrl,
              user_id: userId,
              role: 'member',
              state: 'invited',
            })
            .execute();
          anySuccess = true;
          getBus().emit('membership_changed', channelUrl, { channelUrl, userId, state: 'invited' });
        } catch (err) {
          // Duplicate-key (already a member/invited) is fine; a real failure must NOT
          // be masked as success.
          if (!isDuplicateKeyError(err)) {
            console.error('messengerInviteMembers insert error:', err);
            return false;
          }
        }
      }
      return anySuccess;
    },

    /**
     * messengerAcceptInvitation — transition a member's state from 'invited' → 'joined'.
     * Inline Kysely update. Falls back to acting user when userId arg matches the bearer.
     * Emits user_joined + membership_changed on accept.
     * Returns true on success, false on failure.
     */
    messengerAcceptInvitation: async (_root, args, ctx: AppContext) => {
      const { channelUrl, userId } = args as {
        channelUrl?: string | null;
        userId?: string | null;
      };
      const targetUserId = userId ?? (await resolveActingUserId(ctx));
      if (!channelUrl || !targetUserId) return false;

      try {
        const result = await ctx.db
          .updateTable('messenger_members')
          .set({ state: 'joined' })
          .where('channel_url', '=', channelUrl)
          .where('user_id', '=', targetUserId)
          .where('state', '=', 'invited')
          .executeTakeFirst();

        const accepted = Number(result.numUpdatedRows) > 0;
        if (accepted) {
          getBus().emit('user_joined', channelUrl, { channelUrl, userId: targetUserId });
          getBus().emit('membership_changed', channelUrl, { channelUrl, userId: targetUserId, state: 'joined' });
        }
        return accepted;
      } catch (err) {
        console.error('messengerAcceptInvitation error:', err);
        return false;
      }
    },

    /**
     * messengerDeclineInvitation — remove the invited membership row.
     * Delegates to removeUserFromChannel (removes regardless of state).
     * Emits membership_changed on the RealtimeBus.
     * Returns true if the row was removed, false otherwise.
     */
    messengerDeclineInvitation: async (_root, args, ctx: AppContext) => {
      const { channelUrl, userId } = args as {
        channelUrl?: string | null;
        userId?: string | null;
      };
      const targetUserId = userId ?? (await resolveActingUserId(ctx));
      if (!channelUrl || !targetUserId) return false;

      try {
        const removed = await removeUserFromChannel(ctx.db, channelUrl, targetUserId);
        if (removed) {
          getBus().emit('membership_changed', channelUrl, { channelUrl, userId: targetUserId });
        }
        return removed;
      } catch (err) {
        console.error('messengerDeclineInvitation error:', err);
        return false;
      }
    },
  },
};
