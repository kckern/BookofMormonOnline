/**
 * test/messaging/presence.test.ts
 *
 * Tests for the presence service (src/messaging/presence.ts).
 *
 * No-Redis path (REDIS_URL unset)
 * --------------------------------
 * These tests run unconditionally and assert the safe fallbacks:
 *   - isOnline  → false
 *   - onlineUserIds → []
 *   - setOnline / setOffline → no-op / don't throw
 *
 * With-Redis path (REDIS_URL set)
 * --------------------------------
 * The full round-trip tests (setOnline → isOnline true, setOffline → false,
 * last_seen_at DB write) are SKIPPED when REDIS_URL is unset — matching the
 * pattern used in users.test.ts for write-guarded tests.
 *
 * DB writes (last_seen_at) require a writable connection.  The same
 * MYSQL_WRITE_USER / MYSQL_WRITE_PASSWORD guards from users.test.ts apply.
 */

import 'dotenv/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { closeRedis, getRedis } from '../../src/config/redis.js';
import { isOnline, onlineUserIds, setOffline, setOnline } from '../../src/messaging/presence.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — write-capable DB (mirrors users.test.ts pattern)
// ─────────────────────────────────────────────────────────────────────────────

function buildWriteDb(): Kysely<DB> {
  const host = process.env['MYSQL_HOST'] ?? '127.0.0.1';
  const port = Number(process.env['MYSQL_PORT'] ?? 3306);
  const database = process.env['MYSQL_DB'] ?? 'bom_prd';
  const user = process.env['MYSQL_WRITE_USER'] ?? process.env['MYSQL_USER'] ?? 'root';
  const password =
    process.env['MYSQL_WRITE_PASSWORD'] ?? process.env['MYSQL_PASSWORD'] ?? '';

  return new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({ host, port, database, user, password, connectionLimit: 5 }) as unknown as MysqlDialectConfig['pool'],
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

let db: Kysely<DB>;
let canWrite = false;
const hasRedis = Boolean(process.env['REDIS_URL']);
const trackedIds: string[] = [];

function testId(): string {
  const id = `test_${nanoid(12)}`;
  trackedIds.push(id);
  return id;
}

async function cleanupTracked(): Promise<void> {
  // Remove from Redis online set if Redis is available.
  const redis = await getRedis();
  if (redis && trackedIds.length > 0) {
    try {
      await Promise.all(trackedIds.map((id) => setOffline(id)));
    } catch {
      // best effort
    }
  }

  // Remove from DB.
  if (canWrite && trackedIds.length > 0) {
    await db.deleteFrom('messenger_users').where('user_id', 'in', [...trackedIds]).execute();
  }

  trackedIds.length = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup / teardown
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  db = buildWriteDb();

  // Probe read access.
  try {
    await db.selectFrom('messenger_users').select('user_id').limit(1).execute();
  } catch (err) {
    console.warn('\n⚠  BLOCKED: cannot reach messenger_users —', String(err));
    await db.destroy();
    return;
  }

  // Probe write access.
  const probeId = `test_probe_${nanoid(8)}`;
  try {
    await db.insertInto('messenger_users').values({ user_id: probeId, nickname: 'probe' }).execute();
    await db.deleteFrom('messenger_users').where('user_id', '=', probeId).execute();
    canWrite = true;
  } catch {
    console.warn(
      '\n⚠  BLOCKED: messenger_users is read-only — DB write assertions will be skipped.',
    );
  }
});

afterEach(async () => {
  await cleanupTracked();
});

afterAll(async () => {
  await cleanupTracked();
  await closeRedis();
  await db.destroy();
});

// ─────────────────────────────────────────────────────────────────────────────
// Guard helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Skip a test when REDIS_URL is not configured. */
function itRedis(name: string, fn: () => Promise<void>) {
  it(name, async () => {
    if (!hasRedis) {
      console.warn(`  ↳ SKIPPED (no REDIS_URL): ${name}`);
      return;
    }
    await fn();
  });
}

/** Skip a test when write access or Redis is absent. */
function itRedisWrite(name: string, fn: () => Promise<void>) {
  it(name, async () => {
    if (!hasRedis) {
      console.warn(`  ↳ SKIPPED (no REDIS_URL): ${name}`);
      return;
    }
    if (!canWrite) {
      console.warn(`  ↳ SKIPPED (no write access): ${name}`);
      return;
    }
    await fn();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// No-Redis fallback tests — run unconditionally
// ─────────────────────────────────────────────────────────────────────────────

describe('no-redis fallbacks (unconditional)', () => {
  // These tests verify the degraded-mode contract without needing Redis.
  // They call the presence functions directly; when Redis IS available the
  // functions will actually use Redis, but the same assertions still hold for
  // a user who has never been marked online.

  it('isOnline returns false for an unknown user', async () => {
    const result = await isOnline(`test_never_online_${nanoid(6)}`);
    expect(result).toBe(false);
  });

  it('onlineUserIds returns an array', async () => {
    const ids = await onlineUserIds();
    expect(Array.isArray(ids)).toBe(true);
  });

  it('setOnline does not throw when called', async () => {
    await expect(setOnline(`test_noop_${nanoid(6)}`)).resolves.not.toThrow();
  });

  it('setOffline does not throw when called for an unknown user', async () => {
    // DB update against a non-existent row is a silent no-op in MySQL.
    await expect(setOffline(`test_ghost_${nanoid(6)}`)).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// In-process fallback round-trips — skipped when REDIS_URL is set
// (these specifically exercise the module-level Set path, not Redis)
// ─────────────────────────────────────────────────────────────────────────────

describe('in-process fallback round-trips (skipped when REDIS_URL is set)', () => {
  it('setOnline → isOnline returns true (no Redis)', async () => {
    if (hasRedis) {
      console.warn('  ↳ SKIPPED (REDIS_URL present): in-process fallback test');
      return;
    }
    const id = `u_test_${nanoid(8)}`;
    await setOnline(id);
    try {
      expect(await isOnline(id)).toBe(true);
    } finally {
      // cleanup: setOffline may fail the DB write (read-only user) but must
      // still remove from the in-memory Set — the try/catch in setOffline
      // ensures this.
      await setOffline(id).catch(() => {/* best-effort */});
    }
  });

  it('onlineUserIds includes the user after setOnline (no Redis)', async () => {
    if (hasRedis) {
      console.warn('  ↳ SKIPPED (REDIS_URL present): in-process fallback test');
      return;
    }
    const id = `u_test_${nanoid(8)}`;
    await setOnline(id);
    try {
      expect(await onlineUserIds()).toContain(id);
    } finally {
      await setOffline(id).catch(() => {/* best-effort */});
    }
  });

  it('setOffline → isOnline returns false (no Redis)', async () => {
    if (hasRedis) {
      console.warn('  ↳ SKIPPED (REDIS_URL present): in-process fallback test');
      return;
    }
    const id = `u_test_${nanoid(8)}`;
    await setOnline(id);
    // setOffline DB write will fail (read-only user) but must NOT prevent the
    // in-memory Set deletion — the existing try/catch in setOffline handles this.
    await setOffline(id).catch(() => {/* DB write may fail; Set delete still happens */});
    expect(await isOnline(id)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// With-Redis round-trip tests — skipped when REDIS_URL unset
// ─────────────────────────────────────────────────────────────────────────────

describe('with-redis round-trips (skipped without REDIS_URL)', () => {
  itRedis('setOnline → isOnline returns true', async () => {
    const id = testId();
    await setOnline(id);
    expect(await isOnline(id)).toBe(true);
  });

  itRedis('setOffline → isOnline returns false', async () => {
    const id = testId();
    await setOnline(id);
    await setOffline(id);
    expect(await isOnline(id)).toBe(false);
  });

  itRedis('setOnline → appears in onlineUserIds', async () => {
    const id = testId();
    await setOnline(id);
    const ids = await onlineUserIds();
    expect(ids).toContain(id);
  });

  itRedis('setOffline → removed from onlineUserIds', async () => {
    const id = testId();
    await setOnline(id);
    await setOffline(id);
    const ids = await onlineUserIds();
    expect(ids).not.toContain(id);
  });

  itRedis('multiple users online simultaneously', async () => {
    const id1 = testId();
    const id2 = testId();
    await Promise.all([setOnline(id1), setOnline(id2)]);
    const ids = await onlineUserIds();
    expect(ids).toContain(id1);
    expect(ids).toContain(id2);
    expect(await isOnline(id1)).toBe(true);
    expect(await isOnline(id2)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// last_seen_at DB write — requires Redis + write access
// ─────────────────────────────────────────────────────────────────────────────

describe('setOffline writes last_seen_at to the DB', () => {
  itRedisWrite('last_seen_at is set when going offline', async () => {
    const id = testId();
    // Insert a test user with no last_seen_at.
    await db.insertInto('messenger_users').values({ user_id: id, nickname: 'PresenceTest' }).execute();

    // Mark online then offline so the DB write fires.
    await setOnline(id);
    const before = Date.now();
    await setOffline(id);
    const after = Date.now();

    const row = await db
      .selectFrom('messenger_users')
      .select('last_seen_at')
      .where('user_id', '=', id)
      .executeTakeFirst();

    expect(row).not.toBeUndefined();
    const ts = row!.last_seen_at ? new Date(row!.last_seen_at).getTime() : null;
    expect(ts).not.toBeNull();
    expect(ts!).toBeGreaterThanOrEqual(before - 1000);
    expect(ts!).toBeLessThanOrEqual(after + 1000);
  });

  it('setOffline writes last_seen_at even without Redis (DB-only path)', async () => {
    if (!canWrite) {
      console.warn('  ↳ SKIPPED (no write access): setOffline DB-only path');
      return;
    }
    const id = testId();
    await db.insertInto('messenger_users').values({ user_id: id, nickname: 'OfflineOnly' }).execute();

    const before = Date.now();
    await setOffline(id);
    const after = Date.now();

    const row = await db
      .selectFrom('messenger_users')
      .select('last_seen_at')
      .where('user_id', '=', id)
      .executeTakeFirst();

    expect(row).not.toBeUndefined();
    const ts = row!.last_seen_at ? new Date(row!.last_seen_at).getTime() : null;
    expect(ts).not.toBeNull();
    expect(ts!).toBeGreaterThanOrEqual(before - 1000);
    expect(ts!).toBeLessThanOrEqual(after + 1000);
  });
});
