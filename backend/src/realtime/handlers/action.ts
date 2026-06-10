/**
 * realtime/handlers/action.ts — study-group live-sync handlers (port of
 * src/socket.ts fire_action/update_state).
 *
 * `fire_action` drives navigation/scroll sync across a study group; the client
 * emits it and listens for `channel_action`. `update_state` persists light
 * presence/state metadata (activeGroup/activeCall).
 * Neither is a message write — fire_action is pure broadcast; update_state
 * persists user metadata only.
 *
 * Client payloads (frontend/webapp/src/models/MessengerController.js):
 *   fire_action  → { channelUrl, action }   (action is a string or JSON string)
 *   update_state → { activeGroup, activeCall, ... }
 *
 * Server→client:
 *   channel_action — { channelUrl, userId, action }
 *
 * NB: update_state does NOT broadcast — the client has no `user_state` listener and
 * already syncs active-group/page state to channels via fire_action → channel_action.
 * A redundant user_state broadcast was removed to avoid double fan-out.
 */

import type { Server, Socket } from 'socket.io';
import { getDb } from '../../data/db.js';
import { updateUserMetadata } from '../../messaging/users.js';

interface ActionPayload {
  channelUrl: string;
  action: string;
}

export function register(socket: Socket, _io: Server): void {
  const user = socket.data['user'] as { userId: string; bomUserId: string | null } | undefined;

  // fire_action → channel_action (study-group nav/scroll sync). Pure broadcast,
  // sender excluded (they fired it). Timestamp passed in via args at emit time
  // would break resume; use a monotonic-free fixed shape (client ignores exact ts).
  socket.on('fire_action', (payload: ActionPayload) => {
    if (!user || !payload?.channelUrl) return;
    socket.to(payload.channelUrl).emit('channel_action', {
      channelUrl: payload.channelUrl,
      userId: user.userId,
      action: payload.action,
    });
  });

  // update_state → persist the user's light state metadata (activeGroup/activeCall).
  // No broadcast: the client has no user_state listener and syncs via fire_action.
  socket.on('update_state', async (data: Record<string, unknown>) => {
    if (!user) return;
    try {
      await updateUserMetadata(getDb(), user.userId, data);
    } catch {
      // metadata write best-effort (suppressed under the sandbox/read-only DB)
    }
  });
}
