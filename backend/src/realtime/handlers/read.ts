/**
 * realtime/handlers/read.ts — socket.io handler for mark_read.
 *
 * Flow:
 *   1. Authenticate via socket.data.user.
 *   2. Call markChannelAsRead(db, channelUrl, userId) to stamp last_read_at.
 *   3. Fetch the updated unread count via getUnreadCount.
 *   4. Emit unread_count_changed to the acting user only (socket.emit, not broadcast).
 *   5. Ack the emitting socket.
 *
 * Client payload (from MessengerController.js):
 *   mark_read → { channelUrl }
 *
 * Server→client unicast event (to the acting user only):
 *   unread_count_changed — no specific payload required; the client re-fetches
 *   on receipt (see MessengerController.js setupEventHandlers).
 */

import type { Server, Socket } from 'socket.io';
import { getDb } from '../../data/db.js';
import { markChannelAsRead, getUnreadCount } from '../../messaging/readstate.js';

interface MarkReadPayload {
  channelUrl: string;
}

type Ack = (response: Record<string, unknown>) => void;

// ─── register ─────────────────────────────────────────────────────────────────

/**
 * Register the mark_read handler on the given socket.
 * Called once per connection from server.ts.
 */
export function register(socket: Socket, _io: Server): void {
  const user = socket.data['user'] as { userId: string; bomUserId: string | null } | undefined;

  socket.on('mark_read', async (payload: MarkReadPayload, ack?: Ack) => {
    try {
      if (!user) {
        ack?.({ success: false, error: 'not authenticated' });
        return;
      }

      const db = getDb();

      await markChannelAsRead(db, payload.channelUrl, user.userId);

      // Get the refreshed unread count for this channel so the client can
      // update its badge without an extra round-trip.
      const unreadCount = await getUnreadCount(db, payload.channelUrl, user.userId);

      // unread_count_changed is sent only to the acting user (unicast).
      socket.emit('unread_count_changed', {
        channelUrl: payload.channelUrl,
        unreadCount,
      });

      ack?.({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[handler:mark_read]', message);
      ack?.({ success: false, error: message });
    }
  });
}
