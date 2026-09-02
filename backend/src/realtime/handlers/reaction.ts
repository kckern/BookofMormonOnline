/**
 * realtime/handlers/reaction.ts — socket.io handlers for add_reaction and
 * remove_reaction.
 *
 * Each event:
 *   1. Authenticates via socket.data.user.
 *   2. Calls addReaction / removeReaction in the messaging service.
 *   3. Fetches the updated reaction list for the message.
 *   4. Broadcasts reaction_changed to the channel room via RealtimeBus.
 *   5. Acks the emitting socket.
 *
 * Client payloads (from MessengerController.js):
 *   add_reaction    → { channelUrl, messageId, reactionKey }
 *   remove_reaction → { channelUrl, messageId, reactionKey }
 *
 * Server→client broadcast event:
 *   reaction_changed — { channelUrl, messageId, reactions: { key, user_ids }[] }
 */

import type { Server, Socket } from 'socket.io';
import { getDb } from '../../data/db.js';
import { addReaction, removeReaction, getReactions } from '../../messaging/reactions.js';
import { pushNotificationForEvent } from '../../messaging/notifications.js';
import { allowsRealtimeClientWrite, emitPublicChannelEvent, getChannelAccess } from '../../messaging/policy.js';
import { getMessage } from '../../messaging/messages.js';
import { consumeRealtimeRateLimit } from '../rateLimit.js';

// ─── Shared payload type ──────────────────────────────────────────────────────

interface ReactionPayload {
  channelUrl: string;
  messageId: string;
  reactionKey: string;
}

type Ack = (response: Record<string, unknown>) => void;

// ─── Shared helper ────────────────────────────────────────────────────────────

async function broadcastReactionChanged(channelUrl: string, messageId: string): Promise<void> {
  const db = getDb();
  const reactions = await getReactions(db, messageId);
  emitPublicChannelEvent('reaction_changed', channelUrl, { channelUrl, messageId, reactions });
}

// ─── register ─────────────────────────────────────────────────────────────────

/**
 * Register reaction handlers on the given socket.
 * Called once per connection from server.ts.
 */
export function register(socket: Socket, _io: Server): void {
  const user = socket.data['user'] as { userId: string; bomUserId: string | null } | undefined;

  // ── add_reaction ──────────────────────────────────────────────────────────
  socket.on('add_reaction', async (payload: ReactionPayload, ack?: Ack) => {
    try {
      if (!user) {
        ack?.({ success: false, error: 'not authenticated' });
        return;
      }

      const db = getDb();
      if (!payload?.channelUrl || !payload.messageId || !payload.reactionKey || payload.reactionKey.length > 64) {
        ack?.({ success: false, error: 'invalid reaction' });
        return;
      }
      if (!(await consumeRealtimeRateLimit(user.userId, 'reaction', 30, 60))) {
        ack?.({ success: false, error: 'rate limit exceeded' });
        return;
      }
      const access = await getChannelAccess(db, payload.channelUrl, user.userId);
      if (!allowsRealtimeClientWrite(access, user.bomUserId === null)) {
        ack?.({ success: false, error: 'non-member bots may react only through managed orchestration' });
        return;
      }
      const target = await getMessage(db, payload.channelUrl, payload.messageId);
      if (!access.canReact || !target) {
        ack?.({ success: false, error: 'reactions are not allowed' });
        return;
      }

      await addReaction(db, payload.messageId, user.userId, payload.reactionKey);

      // Broadcast updated reaction snapshot to the channel room.
      await broadcastReactionChanged(payload.channelUrl, payload.messageId);

      // Notify the reacted-to message's author (per-user push). Fire-and-forget;
      // self-reactions are filtered downstream.
      void pushNotificationForEvent(db, {
        type: 'reaction',
        targetMessageId: payload.messageId,
        actorId: user.userId,
        reactionKey: payload.reactionKey,
      });

      ack?.({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[handler:add_reaction]', message);
      ack?.({ success: false, error: message });
    }
  });

  // ── remove_reaction ───────────────────────────────────────────────────────
  socket.on('remove_reaction', async (payload: ReactionPayload, ack?: Ack) => {
    try {
      if (!user) {
        ack?.({ success: false, error: 'not authenticated' });
        return;
      }

      const db = getDb();
      if (!payload?.channelUrl || !payload.messageId || !payload.reactionKey || payload.reactionKey.length > 64) {
        ack?.({ success: false, error: 'invalid reaction' });
        return;
      }
      if (!(await consumeRealtimeRateLimit(user.userId, 'reaction', 30, 60))) {
        ack?.({ success: false, error: 'rate limit exceeded' });
        return;
      }
      const access = await getChannelAccess(db, payload.channelUrl, user.userId);
      if (!allowsRealtimeClientWrite(access, user.bomUserId === null)) {
        ack?.({ success: false, error: 'non-member bots may react only through managed orchestration' });
        return;
      }
      const target = await getMessage(db, payload.channelUrl, payload.messageId);
      if (!access.canReact || !target) {
        ack?.({ success: false, error: 'reactions are not allowed' });
        return;
      }

      await removeReaction(db, payload.messageId, user.userId, payload.reactionKey);

      await broadcastReactionChanged(payload.channelUrl, payload.messageId);

      ack?.({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[handler:remove_reaction]', message);
      ack?.({ success: false, error: message });
    }
  });
}
