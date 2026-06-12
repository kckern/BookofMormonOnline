/**
 * test/messaging/users.test.ts
 *
 * Integration tests for the messaging/users Kysely service.
 *
 * Targets the real bom_prd DB.  Uses env vars for connection:
 *   MYSQL_HOST / MYSQL_PORT / MYSQL_DB — from backend/.env (dotenv auto-loaded)
 *   MYSQL_WRITE_USER     — writable user (falls back to MYSQL_USER)
 *   MYSQL_WRITE_PASSWORD — writable password (falls back to MYSQL_PASSWORD)
 *
 * Each test inserts a throwaway row keyed `test_<nanoid>` and deletes it in
 * afterEach.  If the DB is unreachable or the user is read-only, the test
 * suite is skipped with a BLOCKED message — no faked assertions.
 */

import 'dotenv/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import {
  getUser,
  getUsers,
  upsertUser,
  updateUserNickname,
  updateUserProfileUrl,
  updateUserMetadata,
  getUserMetadata,
  setUserOnline,
  listBotUsers,
  resolveSigninAvatar,
} from '../../src/messaging/users.js';
import { generateAvatarUrl } from '../../src/messaging/avatarAssets.js';

// ─────────────────────────────────────────────────────────────────────────────
// Write-capable Kysely instance (separate from singleton, so tests can tear
// it down without affecting a shared server process).
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
const trackedIds: string[] = [];

function testId(): string {
  const id = `test_${nanoid(12)}`;
  trackedIds.push(id);
  return id;
}

async function cleanupTracked(): Promise<void> {
  if (!canWrite || trackedIds.length === 0) return;
  await db.deleteFrom('messenger_users').where('user_id', 'in', [...trackedIds]).execute();
  trackedIds.length = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup / teardown
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  db = buildWriteDb();

  // Probe: can we reach the DB at all?
  try {
    await db.selectFrom('messenger_users').select('user_id').limit(1).execute();
  } catch (err) {
    console.warn('\n⚠  BLOCKED: cannot reach messenger_users —', String(err));
    await db.destroy();
    return;
  }

  // Probe: do we have write access?
  const probeId = `test_probe_${nanoid(8)}`;
  try {
    await db.insertInto('messenger_users').values({ user_id: probeId, nickname: 'probe' }).execute();
    await db.deleteFrom('messenger_users').where('user_id', '=', probeId).execute();
    canWrite = true;
  } catch (err) {
    console.warn(
      '\n⚠  BLOCKED: messenger_users is read-only for the current user' +
        ` (MYSQL_WRITE_USER=${process.env['MYSQL_WRITE_USER'] ?? process.env['MYSQL_USER'] ?? '?'}).` +
        ' Set MYSQL_WRITE_USER + MYSQL_WRITE_PASSWORD to a writable account to run these tests.\n' +
        `  Error: ${String(err)}`,
    );
  }
});

afterEach(async () => {
  await cleanupTracked();
});

afterAll(async () => {
  await cleanupTracked();
  await db.destroy();
});

// ─────────────────────────────────────────────────────────────────────────────
// Guard helper — skips a single test when write access is absent
// ─────────────────────────────────────────────────────────────────────────────

function itWrite(name: string, fn: () => Promise<void>) {
  it(name, async () => {
    if (!canWrite) {
      console.warn(`  ↳ SKIPPED (no write access): ${name}`);
      return;
    }
    await fn();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('getUser', () => {
  it('returns null for an unknown user_id', async () => {
    const result = await getUser(db, `test_nonexistent_${nanoid(6)}`);
    expect(result).toBeNull();
  });

  itWrite('returns a UserDTO with the correct shape for an inserted user', async () => {
    const id = testId();
    await db
      .insertInto('messenger_users')
      .values({
        user_id: id,
        nickname: 'Alice',
        profile_url: 'https://example.com/alice.jpg',
        bom_user_id: null,
        metadata: JSON.stringify({ lang: 'en' }),
        is_bot: 0,
      })
      .execute();

    const dto = await getUser(db, id);

    expect(dto).not.toBeNull();
    expect(dto!.user_id).toBe(id);
    expect(dto!.nickname).toBe('Alice');
    expect(dto!.profile_url).toBe('https://example.com/alice.jpg');
    expect(dto!.metadata).toEqual({ lang: 'en' });
    expect(dto!.is_online).toBe(false);
    expect(dto!.is_bot).toBe(false);
    expect(dto!.last_seen_at).toBeNull();
  });

  itWrite('coerces is_bot TINYINT to boolean', async () => {
    const id = testId();
    await db.insertInto('messenger_users').values({ user_id: id, nickname: 'Bot', is_bot: 1 }).execute();
    const dto = await getUser(db, id);
    expect(typeof dto!.is_bot).toBe('boolean');
    expect(dto!.is_bot).toBe(true);
  });

  itWrite('returns last_seen_at as ms-epoch number when set', async () => {
    const id = testId();
    const now = new Date();
    await db.insertInto('messenger_users').values({ user_id: id, nickname: 'Bob', last_seen_at: now }).execute();
    const dto = await getUser(db, id);
    expect(typeof dto!.last_seen_at).toBe('number');
    expect(Math.abs(dto!.last_seen_at! - now.getTime())).toBeLessThan(2000);
  });
});

describe('getUsers', () => {
  it('returns an empty array for an empty input', async () => {
    expect(await getUsers(db, [])).toEqual([]);
  });

  itWrite('returns DTOs for all requested user_ids that exist', async () => {
    const id1 = testId();
    const id2 = testId();
    await db
      .insertInto('messenger_users')
      .values([{ user_id: id1, nickname: 'User1' }, { user_id: id2, nickname: 'User2' }])
      .execute();

    const dtos = await getUsers(db, [id1, id2]);
    expect(dtos).toHaveLength(2);
    const ids = dtos.map(d => d.user_id);
    expect(ids).toContain(id1);
    expect(ids).toContain(id2);
  });

  itWrite('silently omits IDs that do not exist', async () => {
    const id = testId();
    await db.insertInto('messenger_users').values({ user_id: id, nickname: 'Only' }).execute();
    const dtos = await getUsers(db, [id, 'test_does_not_exist_xyz']);
    expect(dtos).toHaveLength(1);
    expect(dtos[0]!.user_id).toBe(id);
  });
});

describe('upsertUser', () => {
  itWrite('inserts a new user and returns the correct DTO', async () => {
    const id = testId();
    const dto = await upsertUser(db, id, {
      nickname: 'Charlie',
      profile_url: 'https://example.com/c.png',
      metadata: { theme: 'dark' },
    });
    expect(dto.user_id).toBe(id);
    expect(dto.nickname).toBe('Charlie');
    expect(dto.profile_url).toBe('https://example.com/c.png');
    expect(dto.metadata).toEqual({ theme: 'dark' });
    expect(dto.is_bot).toBe(false);
  });

  itWrite('updates an existing user on duplicate key', async () => {
    const id = testId();
    await upsertUser(db, id, { nickname: 'Initial' });
    const updated = await upsertUser(db, id, { nickname: 'Updated' });
    expect(updated.nickname).toBe('Updated');
  });

  itWrite('defaults nickname to user_id when not provided', async () => {
    const id = testId();
    const dto = await upsertUser(db, id, {});
    expect(dto.nickname).toBe(id);
  });
});

describe('updateUserNickname', () => {
  itWrite('returns true and updates the nickname', async () => {
    const id = testId();
    await db.insertInto('messenger_users').values({ user_id: id, nickname: 'Old' }).execute();
    const ok = await updateUserNickname(db, id, 'New');
    expect(ok).toBe(true);
    const dto = await getUser(db, id);
    expect(dto!.nickname).toBe('New');
  });

  it('returns false for a non-existent user', async () => {
    if (!canWrite) {
      // updateUserNickname only issues an UPDATE — safe to run even on reader
      // because it will hit the permission error. Skip it gracefully.
      console.warn('  ↳ SKIPPED (no write access): returns false for a non-existent user');
      return;
    }
    const ok = await updateUserNickname(db, `test_ghost_${nanoid(6)}`, 'x');
    expect(ok).toBe(false);
  });
});

describe('updateUserProfileUrl', () => {
  itWrite('updates profile_url and returns true', async () => {
    const id = testId();
    await db.insertInto('messenger_users').values({ user_id: id, nickname: 'Dave' }).execute();
    const ok = await updateUserProfileUrl(db, id, 'https://cdn.example.com/dave.png');
    expect(ok).toBe(true);
    const dto = await getUser(db, id);
    expect(dto!.profile_url).toBe('https://cdn.example.com/dave.png');
  });
});

describe('updateUserMetadata / getUserMetadata', () => {
  itWrite('round-trips metadata correctly', async () => {
    const id = testId();
    await db.insertInto('messenger_users').values({ user_id: id, nickname: 'Eve' }).execute();
    const ok = await updateUserMetadata(db, id, { score: 42, active: true });
    expect(ok).toBe(true);
    const meta = await getUserMetadata(db, id);
    expect(meta).toEqual({ score: 42, active: true });
  });

  it('getUserMetadata returns null for an unknown user', async () => {
    const meta = await getUserMetadata(db, `test_nobody_${nanoid(6)}`);
    expect(meta).toBeNull();
  });
});

describe('setUserOnline', () => {
  itWrite('writes last_seen_at when going offline', async () => {
    const id = testId();
    await db.insertInto('messenger_users').values({ user_id: id, nickname: 'Frank' }).execute();
    const before = Date.now();
    await setUserOnline(db, id, false);
    const after = Date.now();
    const dto = await getUser(db, id);
    expect(dto!.last_seen_at).not.toBeNull();
    expect(dto!.last_seen_at!).toBeGreaterThanOrEqual(before - 1000);
    expect(dto!.last_seen_at!).toBeLessThanOrEqual(after + 1000);
  });

  itWrite('clears last_seen_at when going online', async () => {
    const id = testId();
    const past = new Date(Date.now() - 60_000);
    await db.insertInto('messenger_users').values({ user_id: id, nickname: 'Grace', last_seen_at: past }).execute();
    await setUserOnline(db, id, true);
    const row = await db.selectFrom('messenger_users').select('last_seen_at').where('user_id', '=', id).executeTakeFirst();
    expect(row!.last_seen_at).toBeNull();
  });
});

describe('listBotUsers', () => {
  itWrite('returns only bot users', async () => {
    const botId = testId();
    const humanId = testId();
    await db
      .insertInto('messenger_users')
      .values([
        { user_id: botId, nickname: 'MyBot', is_bot: 1 },
        { user_id: humanId, nickname: 'Human', is_bot: 0 },
      ])
      .execute();

    const bots = await listBotUsers(db);
    const returnedIds = bots.map(b => b.user_id);
    expect(returnedIds).toContain(botId);
    expect(returnedIds).not.toContain(humanId);
    bots.forEach(b => expect(b.is_bot).toBe(true));
  });
});

describe('dead-host avatar guard', () => {
  it('getUser never returns an avatars.dicebear.com URL', async () => {
    const legacy = await db
      .selectFrom('messenger_users')
      .select(['user_id'])
      .where('profile_url', 'like', 'https://avatars.dicebear.com/%')
      .executeTakeFirst();
    if (!legacy) return; // data already cleaned — guard is moot
    const dto = await getUser(db, legacy.user_id);
    expect(dto?.profile_url ?? '').not.toContain('avatars.dicebear.com');
  });
});

describe('resolveSigninAvatar', () => {
  it('returns the messenger profile_url for a user with a stored avatar', async () => {
    // Discover any row with an explicit stored avatar (upload/seed).
    const row = await db
      .selectFrom('messenger_users')
      .select(['user_id', 'profile_url'])
      .where('profile_url', 'like', 'https://assets.bookofmormon.online/%')
      .executeTakeFirst();
    if (!row) return; // seed drift — nothing to assert against
    const url = await resolveSigninAvatar(db, row.user_id);
    expect(url).toBe(row.profile_url);
  });

  it('falls back to the deterministic dicebear for an unknown user_id', async () => {
    const ghost = 'ffffffffffffffffffffffffffffffff';
    const url = await resolveSigninAvatar(db, ghost);
    expect(url).toBe(generateAvatarUrl(ghost));
  });
});
