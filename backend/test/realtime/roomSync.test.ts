/**
 * test/realtime/roomSync.test.ts
 *
 * Unit tests for RealtimeBus.joinRoom/leaveRoom — the mid-session room-sync
 * seam the membership mutations call so live sockets track channel membership
 * without a reconnect. Runs against a bare socket.io Server (no auth stack, no
 * DB, no MESSENGER_TEST_TOKEN), unlike socket.test.ts which drives the full
 * initRealtime() handshake and skips without a token.
 *
 * The server side seeds only the personal `user:<id>` room (exactly what
 * server.ts guarantees at connect); joinRoom/leaveRoom must reach the user's
 * sockets through it.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as IoServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { setIo, getBus } from '../../src/realtime/RealtimeBus.js';

let httpServer: HttpServer;
let io: IoServer;
let port = 0;
const open: ClientSocket[] = [];

const USER = 'room-sync-user';
const CHANNEL = 'room-sync-channel';
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function waitFor<T = unknown>(socket: ClientSocket, event: string, ms = 500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Resolves 'received' | 'timeout' — for asserting a broadcast does NOT arrive. */
function probe(socket: ClientSocket, event: string, ms = 400): Promise<string> {
  return waitFor(socket, event, ms).then(() => 'received', () => 'timeout');
}

async function connectClient(): Promise<ClientSocket> {
  const c = ioClient(`http://localhost:${port}`, {
    path: '/messenger',
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  open.push(c);
  await waitFor(c, 'connect', 2000);
  return c;
}

beforeAll(async () => {
  httpServer = createServer();
  io = new IoServer(httpServer, { path: '/messenger' });
  // Mirror server.ts's connect-time guarantee: every socket sits in its
  // personal room. (No auth here — this suite tests room mechanics only.)
  io.on('connection', (socket) => {
    socket.join(`user:${USER}`);
  });
  setIo(io);
  await new Promise<void>((res) => httpServer.listen(0, res));
  port = (httpServer.address() as { port: number }).port;
});

afterAll(async () => {
  for (const c of open) c.close();
  await io.close();
  await new Promise<void>((res) => httpServer.close(() => res()));
});

describe('RealtimeBus room sync', () => {
  it('a socket not in the channel room does not receive its broadcasts', async () => {
    const a = await connectClient();
    getBus().emit('probe', CHANNEL, { n: 1 });
    expect(await probe(a, 'probe')).toBe('timeout');
  });

  it('joinRoom subscribes every socket of the user, mid-session', async () => {
    const a = await connectClient();
    const b = await connectClient(); // second tab / device

    getBus().joinRoom(USER, CHANNEL);
    await delay(50);

    const gotA = waitFor<{ n: number }>(a, 'probe');
    const gotB = waitFor<{ n: number }>(b, 'probe');
    getBus().emit('probe', CHANNEL, { n: 2 });
    expect((await gotA).n).toBe(2);
    expect((await gotB).n).toBe(2);
  });

  it('leaveRoom evicts the user\'s sockets from the room', async () => {
    const a = await connectClient();
    getBus().joinRoom(USER, CHANNEL);
    await delay(50);

    getBus().leaveRoom(USER, CHANNEL);
    await delay(50);

    getBus().emit('probe', CHANNEL, { n: 3 });
    expect(await probe(a, 'probe')).toBe('timeout');
  });

  it('personal-room broadcasts still reach the user after leaveRoom', async () => {
    const a = await connectClient();
    getBus().leaveRoom(USER, CHANNEL); // must not touch the personal room

    const got = waitFor<{ n: number }>(a, 'probe');
    getBus().emit('probe', `user:${USER}`, { n: 4 });
    expect((await got).n).toBe(4);
  });
});
