/**
 * realtime/handlers/typing.ts — socket.io handlers for typing_start and
 * typing_stop.
 *
 * Typing indicators are purely in-memory; nothing is persisted.  The handler
 * broadcasts a `typing` event to the channel room via socket.to() (which
 * excludes the sender — matching the legacy src/socket.ts behaviour where the
 * emitter already knows it is typing and doesn't need an echo).
 *
 * Client payloads (from MessengerController.js):
 *   typing_start → { channelUrl }
 *   typing_stop  → { channelUrl }
 *
 * Server→client broadcast event:
 *   typing — { channelUrl, userId, isTyping }
 *
 * No ack callback is required for typing events (fire-and-forget).
 */

import type { Server, Socket } from 'socket.io';

interface TypingPayload {
  channelUrl: string;
}

// ─── register ─────────────────────────────────────────────────────────────────

/**
 * Register typing handlers on the given socket.
 * Called once per connection from server.ts.
 */
export function register(socket: Socket, _io: Server): void {
  const user = socket.data['user'] as { userId: string; bomUserId: string | null } | undefined;

  // ── typing_start ──────────────────────────────────────────────────────────
  socket.on('typing_start', (payload: TypingPayload) => {
    if (!user || !payload?.channelUrl) return;

    // Exclude sender — they already know they're typing.
    socket.to(payload.channelUrl).emit('typing', {
      channelUrl: payload.channelUrl,
      userId: user.userId,
      isTyping: true,
    });
  });

  // ── typing_stop ───────────────────────────────────────────────────────────
  socket.on('typing_stop', (payload: TypingPayload) => {
    if (!user || !payload?.channelUrl) return;

    socket.to(payload.channelUrl).emit('typing', {
      channelUrl: payload.channelUrl,
      userId: user.userId,
      isTyping: false,
    });
  });
}
