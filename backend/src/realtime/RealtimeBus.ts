/**
 * realtime/RealtimeBus.ts — singleton fan-out seam.
 *
 * Design
 * ------
 * A tiny module-level singleton that wraps the socket.io Server.
 * `setIo(io)` is called once by server.ts after the socket.io Server is
 * created.  `getBus()` returns an object with a single method:
 *
 *   emit(event, room, payload)   — broadcasts to every socket in `room`
 *
 * If `setIo` has not been called yet, `emit` is a no-op (logged once so the
 * first missing broadcast is visible in dev without spamming).  This lets
 * GraphQL resolvers import `getBus()` safely before the realtime server is
 * up (e.g. during unit tests or early startup).
 *
 * Usage (Phase 3 membership mutations):
 *
 *   import { getBus } from '../realtime/RealtimeBus.js';
 *   getBus().emit('user_joined', channelUrl, payload);
 */

import type { Server } from 'socket.io';

// ─── Module state ─────────────────────────────────────────────────────────────

let _io: Server | null = null;
let _warnedOnce = false;

// ─── Public API ───────────────────────────────────────────────────────────────

/** Called by server.ts after the socket.io Server is created and attached. */
export function setIo(io: Server): void {
  _io = io;
}

/** The bus interface exposed to GraphQL resolvers and other consumers. */
export interface Bus {
  emit(event: string, room: string, payload: unknown): void;
}

/**
 * Returns the RealtimeBus.  Before `setIo` is called the returned object's
 * `emit` is a no-op (logs once).  Always safe to import and call.
 */
export function getBus(): Bus {
  return {
    emit(event: string, room: string, payload: unknown): void {
      if (!_io) {
        if (!_warnedOnce) {
          console.warn('[RealtimeBus] emit called before setIo — no-op (this warning fires once)');
          _warnedOnce = true;
        }
        return;
      }
      _io.to(room).emit(event, payload);
    },
  };
}
