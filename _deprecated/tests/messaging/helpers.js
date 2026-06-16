/**
 * tests/messaging/helpers.js
 *
 * Shared utilities for the messaging integration suite.
 *
 * Responsibilities:
 *  - probeCreds()        : query bom_user_token + messenger_users to find a valid
 *                          (userId, token) pair for socket auth; returns null if none found.
 *  - probeWriteAccess()  : try a dummy INSERT to detect writable DB; sets global canWrite.
 *  - connectSocket()     : open a socket.io-client to the backend on MESSENGER_URL.
 *  - gql()               : POST a GraphQL query/mutation to the backend.
 *  - itWrite()           : jest.it wrapper that skips (with BLOCKED notice) when !canWrite.
 *  - createTestFixtures(): create a disposable channel + two test users (write-guarded).
 *  - teardownFixtures()  : delete the rows created by createTestFixtures().
 *
 * No Sequelize / legacy imports.  Uses mysql2 (root dep) for the credential probe.
 */

'use strict';

const { io } = require('socket.io-client');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const axios = require('axios');

// ─── Constants ────────────────────────────────────────────────────────────────

const MESSENGER_URL = process.env.MESSENGER_URL || 'http://localhost:5006';
const SOCKET_PATH   = '/messenger';
const GQL_URL       = `${MESSENGER_URL}/graphql`;
const CONNECT_TIMEOUT_MS = 5_000;

// ─── md5 helper ───────────────────────────────────────────────────────────────

/**
 * md5 of a string → 32-char hex (matches MessengerController.js line 17).
 * Idempotent: if the input already looks like an md5 it is returned as-is.
 */
function md5(str) {
  if (/^[a-f0-9]{32}$/i.test(str)) return str.toLowerCase();
  return crypto.createHash('md5').update(str).digest('hex');
}

// ─── DB connection (read-only probe) ─────────────────────────────────────────

function buildPool() {
  return mysql.createPool({
    host:            process.env.MYSQL_HOST     || '127.0.0.1',
    port:            Number(process.env.MYSQL_PORT || 3306),
    user:            process.env.MYSQL_USER     || 'root',
    password:        process.env.MYSQL_PASSWORD || '',
    database:        process.env.MYSQL_DB       || 'bom_prd',
    connectionLimit: 3,
    connectTimeout:  8_000,
  });
}

// ─── Backend availability check ───────────────────────────────────────────────

/**
 * Returns true when the backend's /health endpoint answers within
 * CONNECT_TIMEOUT_MS.  Tests that require the backend gate on this.
 */
async function isBackendUp() {
  try {
    const res = await axios.get(`${MESSENGER_URL}/health`, { timeout: CONNECT_TIMEOUT_MS });
    return res.status === 200;
  } catch {
    return false;
  }
}

// ─── Credential probe ─────────────────────────────────────────────────────────

/**
 * Query the read-only DB for a (userId, token, username) triple where:
 *   - messenger_users.user_id  = md5(username) [the MessengerController convention]
 *   - messenger_users.bom_user_id = bom_user_token.user
 *   - bom_user_token.token is the session credential
 *
 * Returns { userId, token, username } on success, or null if none found.
 * Accepts an optional mysql2 pool to reuse the caller's connection.
 */
async function probeCreds(pool) {
  const ownPool = pool == null;
  const p = pool || buildPool();
  let conn;
  try {
    conn = await p.getConnection();

    // Attempt the joined query first (fast path when data exists).
    const [rows] = await conn.query(`
      SELECT mu.user_id, t.token, mu.bom_user_id AS username
      FROM   messenger_users mu
      JOIN   bom_user_token  t  ON t.user = mu.bom_user_id
      WHERE  mu.bom_user_id IS NOT NULL
      LIMIT  20
    `);

    // Filter to rows where user_id == md5(bom_user_id) — the real auth requirement.
    const validRow = rows.find(r => md5(r.username) === r.user_id);
    if (validRow) {
      return { userId: validRow.user_id, token: validRow.token, username: validRow.username };
    }

    // Fallback: scan bom_user_token usernames and compute expected user_id.
    // This is slower but handles a DB state where messenger_users weren't seeded
    // by the MessengerController convention yet.
    const [tokenRows] = await conn.query(
      'SELECT DISTINCT user AS username, token FROM bom_user_token LIMIT 100'
    );
    for (const row of tokenRows) {
      const expectedId = md5(row.username);
      const [muRows] = await conn.query(
        'SELECT user_id FROM messenger_users WHERE user_id = ? LIMIT 1',
        [expectedId]
      );
      if (muRows.length > 0) {
        return { userId: expectedId, token: row.token, username: row.username };
      }
    }

    return null;
  } catch (err) {
    console.warn('[helpers] probeCreds error:', err.message);
    return null;
  } finally {
    if (conn) conn.release();
    if (ownPool) await p.end().catch(() => {});
  }
}

// ─── Write-access probe ───────────────────────────────────────────────────────

let _canWrite = null; // cached after first probe

/**
 * Attempt a dummy INSERT+DELETE on messenger_users to detect write access.
 * The result is memoised for the process lifetime.
 *
 * Uses MYSQL_WRITE_USER / MYSQL_WRITE_PASSWORD when set; falls back to the
 * default MYSQL_USER / MYSQL_PASSWORD (the read-only `reader` in dev).
 *
 * Also honours the MESSAGING_WRITE_TESTS=1 env override (skips the probe and
 * returns true, trusting the caller has wired a writable connection).
 */
async function probeWriteAccess() {
  if (_canWrite !== null) return _canWrite;

  // Honour explicit opt-in env flag.
  if (process.env.MESSAGING_WRITE_TESTS === '1') {
    _canWrite = true;
    return true;
  }

  const writePool = mysql.createPool({
    host:            process.env.MYSQL_HOST          || '127.0.0.1',
    port:            Number(process.env.MYSQL_PORT   || 3306),
    user:            process.env.MYSQL_WRITE_USER    || process.env.MYSQL_USER    || 'root',
    password:        process.env.MYSQL_WRITE_PASSWORD|| process.env.MYSQL_PASSWORD|| '',
    database:        process.env.MYSQL_DB            || 'bom_prd',
    connectionLimit: 2,
    connectTimeout:  8_000,
  });

  let conn;
  try {
    conn = await writePool.getConnection();
    const probeId = `_msg_probe_${Date.now()}`;
    await conn.query(
      'INSERT INTO messenger_users (user_id, nickname) VALUES (?, ?)',
      [probeId, 'probe']
    );
    await conn.query('DELETE FROM messenger_users WHERE user_id = ?', [probeId]);
    _canWrite = true;
    console.log('[helpers] write access: YES');
  } catch {
    _canWrite = false;
    console.warn(
      '[helpers] write access: NO — write-guarded tests will be SKIPPED.\n' +
      '         Set MESSAGING_WRITE_TESTS=1 + MYSQL_WRITE_USER + MYSQL_WRITE_PASSWORD to run them.'
    );
  } finally {
    if (conn) conn.release();
    await writePool.end().catch(() => {});
  }
  return _canWrite;
}

// ─── Socket connect helper ────────────────────────────────────────────────────

/**
 * Open a socket.io connection to the backend.
 *
 * @param {object} opts
 * @param {string} opts.userId  — messenger user_id (md5 of username)
 * @param {string} opts.token   — bom_user_token.token
 * @param {number} [opts.timeout] — ms to wait for connect/error (default 5 s)
 * @returns {Promise<import('socket.io-client').Socket>} — resolves on 'connect',
 *          rejects with the connect_error Error on auth failure / timeout.
 */
function connectSocket({ userId, token, timeout = CONNECT_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    const socket = io(MESSENGER_URL, {
      path:       SOCKET_PATH,
      auth:       { userId, token },
      transports: ['websocket'],
      reconnection: false,
      timeout,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Socket connect timed out after ${timeout} ms`));
    }, timeout + 500);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(err);
    });
  });
}

// ─── GraphQL POST helper ──────────────────────────────────────────────────────

/**
 * POST a raw GraphQL query/mutation body string to the backend.
 * Wraps the string in `{ ... }` (same as the legacy harness) unless it already
 * starts with `{` or `mutation`.
 *
 * Returns the parsed `{ data, errors }` object.
 * Throws on transport failure.
 */
async function gql(queryString, { token } = {}) {
  // Wrap query like the legacy harness (handles compound query style).
  let body = queryString.trimStart();
  if (!body.startsWith('{') && !body.startsWith('mutation') && !body.startsWith('query')) {
    body = `{ ${body} }`;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await axios.post(GQL_URL, { query: body }, {
    headers,
    timeout: 15_000,
    validateStatus: () => true,
  });

  if (!response.data || typeof response.data !== 'object') {
    throw new Error(
      `Non-GraphQL response (HTTP ${response.status}) from ${GQL_URL}: ` +
      JSON.stringify(response.data).slice(0, 200)
    );
  }
  return response.data;
}

// ─── itWrite — write-guarded test helper ─────────────────────────────────────

/**
 * Like jest's `it()`, but skips the test (with a BLOCKED console notice) when
 * `canWrite` is false.  Mirrors the `itWrite` pattern in
 * backend/test/messaging/users.test.ts.
 *
 * Usage:
 *   const { itWrite } = require('./helpers');
 *   itWrite('sends a message and receives message_received', async () => { ... });
 */
function itWrite(name, fn) {
  // Honestly SKIP (pending, not a vacuous pass) unless write tests are opted in —
  // the flag is known synchronously at registration, so jest reports these as
  // skipped rather than green. Set MESSAGING_WRITE_TESTS=1 (+ writable DB creds)
  // to run the live write round-trips.
  if (!process.env.MESSAGING_WRITE_TESTS) {
    it.skip(`${name}  [needs MESSAGING_WRITE_TESTS=1 + writable DB]`, fn);
    return;
  }
  it(name, async () => {
    const ok = await probeWriteAccess();
    if (!ok) throw new Error(`${name}: MESSAGING_WRITE_TESTS set but DB is not writable`);
    await fn();
  });
}

// ─── Disposable fixture helpers (write-guarded) ───────────────────────────────

/**
 * Create a disposable test channel + two test users in messenger_users.
 * Returns { channelUrl, userId1, userId2, token1, token2 }.
 *
 * Must only be called inside a write-guarded block (after probeWriteAccess()).
 * Use teardownFixtures(fixtures) in afterAll/afterEach.
 */
async function createTestFixtures(writePool) {
  const { nanoid } = await import('nanoid');
  const channelUrl = `test_msg_${nanoid(8)}`;
  const userId1    = md5(`testuser1_${nanoid(8)}`);
  const userId2    = md5(`testuser2_${nanoid(8)}`);
  // Fake tokens — real auth path checks bom_user_token but fixtures use direct DB rows
  // so the backend verifyToken will validate them as real test credentials.
  // For write tests we insert matching bom_user_token rows too.
  const fakeUser1 = `_test_mu1_${nanoid(8)}`;
  const fakeUser2 = `_test_mu2_${nanoid(8)}`;
  const token1    = crypto.randomBytes(16).toString('hex');
  const token2    = crypto.randomBytes(16).toString('hex');

  const conn = await writePool.getConnection();
  try {
    // Insert messenger_users (bom_user_id = fake username for token lookup)
    await conn.query(
      'INSERT INTO messenger_users (user_id, nickname, bom_user_id) VALUES (?, ?, ?), (?, ?, ?)',
      [userId1, 'TestUser1', fakeUser1, userId2, 'TestUser2', fakeUser2]
    );
    // Insert bom_user_token rows so verifyToken passes
    await conn.query(
      'INSERT INTO bom_user_token (token, user) VALUES (?, ?), (?, ?)',
      [token1, fakeUser1, token2, fakeUser2]
    );
    // Insert channel
    await conn.query(
      'INSERT INTO messenger_channels (channel_url, name, custom_type) VALUES (?, ?, ?)',
      [channelUrl, 'Test Channel', 'private']
    );
    // Add both users as members
    await conn.query(
      'INSERT INTO messenger_members (channel_url, user_id, role, state) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
      [channelUrl, userId1, 'operator', 'joined', channelUrl, userId2, 'member', 'joined']
    );
  } finally {
    conn.release();
  }

  return { channelUrl, userId1, userId2, token1, token2, fakeUser1, fakeUser2 };
}

/**
 * Delete all rows created by createTestFixtures().
 */
async function teardownFixtures(fixtures, writePool) {
  if (!fixtures) return;
  const { channelUrl, userId1, userId2, token1, token2, fakeUser1, fakeUser2 } = fixtures;
  const conn = await writePool.getConnection();
  try {
    await conn.query('DELETE FROM messenger_members WHERE channel_url = ?', [channelUrl]);
    await conn.query('DELETE FROM messenger_messages WHERE channel_url = ?', [channelUrl]).catch(() => {});
    await conn.query('DELETE FROM messenger_channels WHERE channel_url = ?', [channelUrl]);
    await conn.query('DELETE FROM messenger_users WHERE user_id IN (?, ?)', [userId1, userId2]);
    await conn.query('DELETE FROM bom_user_token WHERE token IN (?, ?)', [token1, token2]);
  } catch (err) {
    console.warn('[helpers] teardownFixtures error:', err.message);
  } finally {
    conn.release();
  }
}

/**
 * Build a write-capable mysql2 pool (uses MYSQL_WRITE_USER when available).
 * Only call after probeWriteAccess() has returned true.
 */
function buildWritePool() {
  return mysql.createPool({
    host:            process.env.MYSQL_HOST          || '127.0.0.1',
    port:            Number(process.env.MYSQL_PORT   || 3306),
    user:            process.env.MYSQL_WRITE_USER    || process.env.MYSQL_USER    || 'root',
    password:        process.env.MYSQL_WRITE_PASSWORD|| process.env.MYSQL_PASSWORD|| '',
    database:        process.env.MYSQL_DB            || 'bom_prd',
    connectionLimit: 5,
    connectTimeout:  8_000,
  });
}

module.exports = {
  md5,
  MESSENGER_URL,
  SOCKET_PATH,
  GQL_URL,
  isBackendUp,
  probeCreds,
  probeWriteAccess,
  connectSocket,
  gql,
  itWrite,
  createTestFixtures,
  teardownFixtures,
  buildWritePool,
};
