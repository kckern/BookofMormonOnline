/**
 * realtime/server.ts — socket.io Server attached to Fastify's HTTP server.
 *
 * Call `initRealtime(httpServer)` once from index.ts after the Fastify server
 * is listening.  The function:
 *
 *  1. Creates a socket.io Server (CORS open, path /messenger, same as legacy).
 *  2. Wires the Redis adapter (pub/sub pair via `getRedis()`) when REDIS_URL is
 *     set; gracefully degrades to single-instance when Redis is unavailable.
 *  3. Registers the `io.use` handshake-auth middleware:
 *       - reads `{userId, token}` from `socket.handshake.auth`
 *       - calls `verifyToken(db, userId, token)` (defined below)
 *       - sets `socket.data.user = { userId, bomUserId }` on success
 *       - calls `next(new Error('unauthorized'))` on failure
 *  4. On connect:  joins the user's channel rooms + `presence.setOnline`.
 *  5. On disconnect: `presence.setOffline`.
 *  6. Calls `setIo(io)` on the RealtimeBus so fan-out is live.
 *
 * verifyToken
 * -----------
 * Looks up `messenger_users` by `user_id` to get `bom_user_id`, then confirms
 * a `bom_user_token` row with `(user = bom_user_id, token = token)` exists.
 * Bots (null bom_user_id) may connect when `token === process.env.MESSENGER_BOT_TOKEN`.
 */

import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { getDb } from '../data/db.js';
import { isValidToken } from '../auth/identity.js';
import { getRedis } from '../config/redis.js';
import { setOnline, setOffline } from '../messaging/presence.js';
import { setIo } from './RealtimeBus.js';
import * as messageHandlers from './handlers/message.js';
import * as reactionHandlers from './handlers/reaction.js';
import * as typingHandlers from './handlers/typing.js';
import * as readHandlers from './handlers/read.js';
import * as actionHandlers from './handlers/action.js';

// ─── Token verification ───────────────────────────────────────────────────────

/**
 * Verify that `token` is valid for `userId`.
 *
 * Flow:
 *  1. Look up `messenger_users` by `user_id` → get `bom_user_id`.
 *  2. If `bom_user_id` is null → bot path: token must equal MESSENGER_BOT_TOKEN.
 *  3. Otherwise confirm a `bom_user_token` row with `(user, token)` exists.
 *
 * Returns `{ valid: true, bomUserId }` on success, `{ valid: false }` on any
 * failure (including DB errors — logged, never thrown).
 */
async function verifyToken(
  userId: string,
  token: string,
): Promise<{ valid: true; bomUserId: string | null } | { valid: false }> {
  try {
    // Reject junk tokens ("null"/""/...) up front — a stale bom_user_token row
    // with that literal value must never authenticate a socket as a real user.
    if (!isValidToken(token)) return { valid: false };

    const db = getDb();

    // Step 1: look up the messenger user row.
    const messengerUser = await db
      .selectFrom('messenger_users')
      .select(['user_id', 'bom_user_id'])
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!messengerUser) return { valid: false };

    const bomUserId = messengerUser.bom_user_id ?? null;

    // Step 2: bot path (bom_user_id is null).
    if (bomUserId === null) {
      const botToken = process.env['MESSENGER_BOT_TOKEN'];
      if (botToken && token === botToken) {
        return { valid: true, bomUserId: null };
      }
      return { valid: false };
    }

    // Step 3: real user path — confirm bom_user_token row.
    const tokenRow = await db
      .selectFrom('bom_user_token')
      .select('token')
      .where('user', '=', bomUserId)
      .where('token', '=', token)
      .executeTakeFirst();

    return tokenRow ? { valid: true, bomUserId } : { valid: false };
  } catch (err) {
    console.error('[realtime] verifyToken error:', err);
    return { valid: false };
  }
}

// ─── Channel room loader ──────────────────────────────────────────────────────

/**
 * Return all channel_urls the user is a member of (state = 'joined').
 * Used on connect to join the socket into the correct rooms.
 */
async function getUserChannelUrls(userId: string): Promise<string[]> {
  try {
    const db = getDb();
    const rows = await db
      .selectFrom('messenger_members')
      .select('channel_url')
      .where('user_id', '=', userId)
      .where('state', '=', 'joined')
      .execute();
    return rows.map((r) => r.channel_url);
  } catch (err) {
    console.error('[realtime] getUserChannelUrls error:', err);
    return [];
  }
}

// ─── Redis adapter wiring ─────────────────────────────────────────────────────

/**
 * Attempt to wire the Redis adapter onto the socket.io Server.
 * Creates a dedicated pub/sub client pair (separate from the app's singleton)
 * as required by @socket.io/redis-adapter.
 *
 * Degrades to single-instance (no adapter) when:
 *  - REDIS_URL is not set
 *  - the existing getRedis() singleton is unavailable (no Redis)
 *  - the pub/sub clients fail to connect
 *
 * Logs the outcome either way.
 */
async function maybeWireRedisAdapter(io: Server): Promise<void> {
  const url = process.env['REDIS_URL'];
  if (!url) {
    console.info('[realtime] REDIS_URL not set — socket.io running in single-instance mode');
    return;
  }

  // Confirm the shared client is reachable before spending resources on a pair.
  const sharedClient = await getRedis();
  if (!sharedClient) {
    console.warn('[realtime] Redis unavailable — socket.io running in single-instance mode');
    return;
  }

  try {
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err: Error) =>
      console.error('[realtime] redis pub error:', err.message),
    );
    subClient.on('error', (err: Error) =>
      console.error('[realtime] redis sub error:', err.message),
    );

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    console.info('[realtime] socket.io Redis adapter connected');
  } catch (err) {
    console.error(
      '[realtime] Redis adapter failed to connect — degrading to single-instance mode:',
      err,
    );
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Attach a socket.io Server to `httpServer` and configure auth + rooms +
 * presence.  Call this once from index.ts after Fastify is listening.
 */
export async function initRealtime(httpServer: HttpServer): Promise<Server> {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/messenger',
    transports: ['websocket', 'polling'],
    pingTimeout: 60_000,
    pingInterval: 25_000,
  });

  // Wire Redis adapter if available.
  await maybeWireRedisAdapter(io);

  // ── Handshake auth middleware ─────────────────────────────────────────────
  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    const auth = socket.handshake.auth as Record<string, unknown>;
    const userId = typeof auth['userId'] === 'string' ? auth['userId'] : undefined;
    const token = typeof auth['token'] === 'string' ? auth['token'] : undefined;

    if (!userId || !token) {
      return next(new Error('unauthorized'));
    }

    const result = await verifyToken(userId, token);
    if (!result.valid) {
      return next(new Error('unauthorized'));
    }

    socket.data['user'] = { userId, bomUserId: result.bomUserId };
    return next();
  });

  // ── Connection handler ────────────────────────────────────────────────────
  io.on('connection', async (socket: Socket) => {
    const user = socket.data['user'] as { userId: string; bomUserId: string | null };
    const { userId } = user;

    console.info(`[realtime] connected: ${userId} (${socket.id})`);

    try {
      // Join all of the user's channel rooms.
      const channelUrls = await getUserChannelUrls(userId);
      socket.data['channels'] = channelUrls; // used by update_state fan-out
      if (channelUrls.length > 0) {
        socket.join(channelUrls);
      }

      // Mark online in Redis presence.
      await setOnline(userId);
    } catch (err) {
      console.error('[realtime] connection setup error:', err);
      // Don't disconnect — the socket still functions for future joins.
    }

    // ── Live-write event handlers (task 2.3) ─────────────────────────────
    messageHandlers.register(socket, io);
    reactionHandlers.register(socket, io);
    typingHandlers.register(socket, io);
    readHandlers.register(socket, io);
    actionHandlers.register(socket, io); // study-group sync: fire_action/update_state

    socket.on('disconnect', async (reason: string) => {
      console.info(`[realtime] disconnected: ${userId} (${reason})`);
      try {
        await setOffline(userId);
      } catch (err) {
        console.error('[realtime] disconnect handler error:', err);
      }
    });
  });

  // Expose the io instance to the RealtimeBus fan-out seam.
  setIo(io);

  console.info('[realtime] socket.io server initialised on path /messenger');
  return io;
}
