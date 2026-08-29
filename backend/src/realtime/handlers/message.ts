/**
 * realtime/handlers/message.ts — socket.io handler for send_message, edit_message,
 * delete_message.
 *
 * Each event:
 *   1. Authenticates via socket.data.user (set by the 2.2 handshake middleware).
 *   2. Calls the relevant messaging service function.
 *   3. Broadcasts to the channel room via RealtimeBus.
 *   4. Acks the emitting socket.
 *
 * Errors are caught; on failure ack({success:false, error}) and never crash the socket.
 *
 * Client payloads (from MessengerController.js):
 *   send_message   → { channelUrl, message, link?, highlights?, customType?, parentMessageId? }
 *   edit_message   → { channelUrl, messageId, message?, customType? }
 *   delete_message → { channelUrl, messageId }
 *
 * Server→client broadcast events (the client listens for these):
 *   message_received  — MessageDTO  (after send)
 *   message_updated   — MessageDTO  (after edit)
 *   message_deleted   — { channelUrl, messageId }  (after delete)
 */

import type { Server, Socket } from 'socket.io';
import { getDb } from '../../data/db.js';
import {
  postMessage,
  updateMessage,
  deleteMessage,
  getMessage,
} from '../../messaging/messages.js';
import { getBus } from '../RealtimeBus.js';
import { maybeBotReply } from '../botResponder.js';
import { isMemberMuted, getMembership } from '../../messaging/members.js';
import { pushNotificationForEvent, pushNotificationToUser } from '../../messaging/notifications.js';

// ─── send_message ─────────────────────────────────────────────────────────────

interface SendMessagePayload {
  channelUrl: string;
  message: string;
  link?: { type: string; target: string; aux?: string };
  highlights?: string[];
  customType?: string;
  parentMessageId?: string;
  // Raw client `data` JSON string (SendBird passthrough — carries mentions).
  data?: string;
}

// ─── edit_message ─────────────────────────────────────────────────────────────

interface EditMessagePayload {
  channelUrl: string;
  messageId: string;
  message?: string;
  customType?: string;
}

// ─── delete_message ───────────────────────────────────────────────────────────

interface DeleteMessagePayload {
  channelUrl: string;
  messageId: string;
}

// ─── Ack callback type ────────────────────────────────────────────────────────

type Ack = (response: Record<string, unknown>) => void;

// ─── register ─────────────────────────────────────────────────────────────────

/**
 * Register message handlers on the given socket.
 * Called once per connection from server.ts.
 */
export function register(socket: Socket, _io: Server): void {
  const user = socket.data['user'] as { userId: string; bomUserId: string | null } | undefined;

  // ── send_message ──────────────────────────────────────────────────────────
  socket.on(
    'send_message',
    async (payload: SendMessagePayload, ack?: Ack) => {
      try {
        if (!user) {
          ack?.({ success: false, error: 'not authenticated' });
          return;
        }

        const db = getDb();

        const membership = await getMembership(db, payload.channelUrl, user.userId);
        if (!membership || membership.state !== 'joined') {
          ack?.({ success: false, error: 'not a joined member of this channel' });
          return;
        }

        // Muted members can't post.
        if (await isMemberMuted(db, payload.channelUrl, user.userId)) {
          ack?.({ success: false, error: 'You are muted in this channel' });
          return;
        }

        const msg = await postMessage(db, {
          channelUrl: payload.channelUrl,
          userId: user.userId,
          message: payload.message,
          customType: payload.customType,
          link: payload.link,
          highlights: payload.highlights,
          data: payload.data,
          parentMessageId: payload.parentMessageId,
        });

        // Broadcast to channel room (including sender — legacy behaviour).
        getBus().emit('message_received', payload.channelUrl, msg);

        // Notify all channel members that unread counts may have changed.
        getBus().emit('unread_count_changed', payload.channelUrl, { channelUrl: payload.channelUrl });

        // Fire-and-forget bot reply (no await — must not block the ack).
        void maybeBotReply(db, payload.channelUrl, msg);

        // A reply notifies the parent message's author (per-user push, in-place
        // bell patch). Fire-and-forget; self-replies are filtered downstream.
        if (payload.parentMessageId) {
          void pushNotificationForEvent(db, {
            type: 'reply',
            targetMessageId: payload.parentMessageId,
            actorId: user.userId,
            sourceMessageId: msg.message_id,
          });
        }

        // Mentions are explicit recipient ids carried in the legacy SendBird
        // data JSON. Message bodies are never copied into email payloads.
        let mentionedUserIds: string[] = [];
        try {
          const data = payload.data ? JSON.parse(payload.data) as { mentionedUserIds?: unknown } : null;
          if (Array.isArray(data?.mentionedUserIds)) {
            mentionedUserIds = data.mentionedUserIds.filter((id): id is string => typeof id === 'string');
          }
        } catch { /* malformed optional metadata is ignored */ }
        for (const recipientId of new Set(mentionedUserIds)) {
          void pushNotificationToUser(db, {
            userId: recipientId, type: 'mention', actorId: user.userId,
            dedupeKey: `mention:${msg.message_id}:${recipientId}`,
            channelUrl: payload.channelUrl, messageId: msg.message_id,
            text: `${msg.user?.nickname ?? 'Someone'} mentioned you`,
          });
        }

        // A DM notifies every other joined participant. Public/private study
        // groups rely on replies and explicit mentions instead of mail blasts.
        const channel = await db.selectFrom('messenger_channels').select('custom_type')
          .where('channel_url', '=', payload.channelUrl).executeTakeFirst();
        if (channel?.custom_type === 'DM') {
          const recipients = await db.selectFrom('messenger_members').select('user_id')
            .where('channel_url', '=', payload.channelUrl).where('state', '=', 'joined')
            .where('user_id', '!=', user.userId).execute();
          for (const recipient of recipients) {
            void pushNotificationToUser(db, {
              userId: recipient.user_id, type: 'direct_message', actorId: user.userId,
              dedupeKey: `direct_message:${msg.message_id}:${recipient.user_id}`,
              channelUrl: payload.channelUrl, messageId: msg.message_id,
              text: `${msg.user?.nickname ?? 'Someone'} sent you a message`,
            });
          }
        }

        ack?.({ success: true, message: msg });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[handler:send_message]', message);
        ack?.({ success: false, error: message });
      }
    },
  );

  // ── edit_message ──────────────────────────────────────────────────────────
  socket.on(
    'edit_message',
    async (payload: EditMessagePayload, ack?: Ack) => {
      try {
        if (!user) {
          ack?.({ success: false, error: 'not authenticated' });
          return;
        }

        const db = getDb();
        const membership = await getMembership(db, payload.channelUrl, user.userId);
        if (!membership || membership.state !== 'joined') {
          ack?.({ success: false, error: 'not a joined member of this channel' });
          return;
        }
        const existing = await getMessage(db, payload.channelUrl, payload.messageId);
        if (!existing) { ack?.({ success: false, error: 'message not found' }); return; }
        if (existing.user?.user_id !== user.userId) {
          ack?.({ success: false, error: 'not the author' });
          return;
        }

        const updated = await updateMessage(db, payload.channelUrl, payload.messageId, {
          message: payload.message,
          customType: payload.customType,
        });

        if (!updated) {
          ack?.({ success: false, error: 'message not found' });
          return;
        }

        getBus().emit('message_updated', payload.channelUrl, updated);

        ack?.({ success: true, message: updated });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[handler:edit_message]', message);
        ack?.({ success: false, error: message });
      }
    },
  );

  // ── delete_message ────────────────────────────────────────────────────────
  socket.on(
    'delete_message',
    async (payload: DeleteMessagePayload, ack?: Ack) => {
      try {
        if (!user) {
          ack?.({ success: false, error: 'not authenticated' });
          return;
        }

        const db = getDb();
        const membership = await getMembership(db, payload.channelUrl, user.userId);
        if (!membership || membership.state !== 'joined') {
          ack?.({ success: false, error: 'not a joined member of this channel' });
          return;
        }
        const existing = await getMessage(db, payload.channelUrl, payload.messageId);
        if (!existing) { ack?.({ success: false, error: 'message not found' }); return; }
        if (existing.user?.user_id !== user.userId && membership.role !== 'operator') {
          ack?.({ success: false, error: 'not the author or an operator' });
          return;
        }

        const deleted = await deleteMessage(db, payload.channelUrl, payload.messageId);

        if (!deleted) {
          ack?.({ success: false, error: 'message not found or already deleted' });
          return;
        }

        getBus().emit('message_deleted', payload.channelUrl, {
          channelUrl: payload.channelUrl,
          messageId: payload.messageId,
        });

        ack?.({ success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[handler:delete_message]', message);
        ack?.({ success: false, error: message });
      }
    },
  );
}
