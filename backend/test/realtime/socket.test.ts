/**
 * test/realtime/socket.test.ts
 *
 * Integration tests for the Socket.io real-time layer (`/messenger`) — the
 * transport `MessengerController` uses for everything live. Drives a real
 * `socket.io-client` against an in-process server started by the actual
 * `initRealtime()`, so handshake auth, room joins, handler acks, and room
 * broadcasts are all exercised end to end.
 *
 * Auth needs a real member: token from MESSENGER_TEST_TOKEN (gitignored .env);
 * the suite skips when absent. Broadcasts are verified with TWO connections of
 * the same user (both join that user's channel rooms; `socket.to(room)` excludes
 * only the emitting socket, so the second connection receives).
 *
 * Writes ride the sandbox driver (SANDBOX=1) → no persistence; we assert the
 * handler responds + the broadcast wiring fires, not durable state.
 */

import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { Server as IoServer } from 'socket.io';
import { sql } from 'kysely';
import { initRealtime } from '../../src/realtime/server.js';
import { getDb, closeDb } from '../../src/data/db.js';
import { md5 } from '../../src/auth/identity.js';

const TOKEN = process.env['MESSENGER_TEST_TOKEN'] ?? '';
const describeSocket = TOKEN ? describe : describe.skip;

let httpServer: HttpServer;
let io: IoServer;
let port = 0;
let uid = '';
let channelUrl = '';
const open: ClientSocket[] = [];

/** Open a client connection (tracked for teardown). */
function connect(auth: Record<string, unknown>): ClientSocket {
  const c = ioClient(`http://localhost:${port}`, {
    path: '/messenger',
    auth,
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  open.push(c);
  return c;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resolve on the next `event`, reject after `ms`. */
function waitFor<T = unknown>(socket: ClientSocket, event: string, ms = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Connect and wait until the handshake completes. */
async function connectReady(auth: Record<string, unknown>): Promise<ClientSocket> {
  const c = connect(auth);
  await waitFor(c, 'connect');
  return c;
}

beforeAll(async () => {
  const db = getDb();
  const who = await sql<{ user: string }>`
    SELECT bu.user FROM bom_user_token t JOIN bom_user bu ON bu.user = t.user WHERE t.token = ${TOKEN}`.execute(db);
  uid = who.rows[0] ? md5(who.rows[0].user) : '';
  const ch = await sql<{ channel_url: string }>`
    SELECT channel_url FROM messenger_members WHERE user_id = ${uid} AND state = 'joined' LIMIT 1`.execute(db);
  channelUrl = ch.rows[0]?.channel_url ?? '';

  httpServer = createServer();
  io = await initRealtime(httpServer);
  await new Promise<void>((res) => httpServer.listen(0, res));
  port = (httpServer.address() as { port: number }).port;
});

afterAll(async () => {
  for (const c of open) c.close();
  if (io) await io.close();
  await new Promise<void>((res) => httpServer?.close(() => res()));
  await closeDb();
});

describeSocket('socket /messenger — auth', () => {
  it('rejects a connection with a bad token', async () => {
    const c = connect({ userId: uid, token: 'definitely-not-valid' });
    const err = await waitFor<Error>(c, 'connect_error');
    expect(err).toBeTruthy();
    expect(c.connected).toBe(false);
  });

  it('rejects a connection with missing auth', async () => {
    const c = connect({});
    const err = await waitFor<Error>(c, 'connect_error');
    expect(err).toBeTruthy();
  });

  it('accepts a connection with a valid userId + token', async () => {
    const c = await connectReady({ userId: uid, token: TOKEN });
    expect(c.connected).toBe(true);
  });
});

describeSocket('socket /messenger — broadcasts', () => {
  it('typing_start fans out as "typing" to other sockets in the channel room', async () => {
    expect(channelUrl, 'no joined channel for the test user').toBeTruthy();
    const a = await connectReady({ userId: uid, token: TOKEN });
    const b = await connectReady({ userId: uid, token: TOKEN });
    await delay(300); // let the async room-join in the connection handler settle

    const received = waitFor<{ channelUrl: string; userId: string }>(b, 'typing');
    a.emit('typing_start', { channelUrl });
    const payload = await received;

    expect(payload.channelUrl).toBe(channelUrl);
    expect(payload.userId).toBe(uid);
  });

  it('fire_action relays as "channel_action" to other sockets (study-group sync)', async () => {
    const a = await connectReady({ userId: uid, token: TOKEN });
    const b = await connectReady({ userId: uid, token: TOKEN });
    await delay(300);

    const received = waitFor<{ channelUrl: string; userId: string; action: string }>(b, 'channel_action');
    a.emit('fire_action', { channelUrl, action: JSON.stringify({ key: 'updatePagePosition', val: { location: 1 } }) });
    const payload = await received;

    expect(payload.channelUrl).toBe(channelUrl);
    expect(payload.userId).toBe(uid);
    expect(typeof payload.action).toBe('string');
  });
});

describeSocket('socket /messenger — acked handlers', () => {
  it('send_message invokes its ack callback with a {success} result', async () => {
    const a = await connectReady({ userId: uid, token: TOKEN });
    await delay(200);

    const ack = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      a.emit('send_message', { channelUrl, message: 'socket test (sandbox — not persisted)' }, resolve);
    });
    // Under the sandbox driver the write is suppressed (read-after-write reload yields
    // nothing), so success may be false — the point is the handler RESPONDS, doesn't hang.
    expect(typeof ack.success).toBe('boolean');
  });

  it('mark_read acks and the actor receives unread_count_changed', async () => {
    const a = await connectReady({ userId: uid, token: TOKEN });
    await delay(200);

    const unread = waitFor<{ channelUrl: string }>(a, 'unread_count_changed');
    const ack = await new Promise<{ success: boolean }>((resolve) => {
      a.emit('mark_read', { channelUrl }, resolve);
    });
    expect(typeof ack.success).toBe('boolean');
    const payload = await unread;
    expect(payload.channelUrl).toBe(channelUrl);
  });
});
