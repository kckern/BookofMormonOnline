/**
 * test/messaging/membership.test.ts
 *
 * Integration tests for getMembership (write-authz primitive).
 *
 * Mirrors the DB setup from messages.test.ts:
 *   MYSQL_HOST / MYSQL_PORT / MYSQL_DB — from backend/.env (dotenv auto-loaded)
 *   MYSQL_WRITE_USER     — writable user (falls back to MYSQL_USER)
 *   MYSQL_WRITE_PASSWORD — writable password (falls back to MYSQL_PASSWORD)
 *
 * Tests guarded with itWrite() automatically skip (BLOCKED) when only a
 * read-only DB user is present.
 */

import 'dotenv/config';
import { describe, expect, beforeAll, afterAll, afterEach, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import {
  getMembership,
  addUserToChannel,
  banUserFromChannel,
} from '../../src/messaging/members.js';

// ─── Write-capable DB instance ────────────────────────────────────────────────

function buildWriteDb(): Kysely<DB> {
  const host = process.env['MYSQL_HOST'] ?? '127.0.0.1';
  const port = Number(process.env['MYSQL_PORT'] ?? 3306);
  const database = process.env['MYSQL_DB'] ?? 'bom_prd';
  const user =
    process.env['MYSQL_WRITE_USER'] ?? process.env['MYSQL_USER'] ?? 'root';
  const password =
    process.env['MYSQL_WRITE_PASSWORD'] ?? process.env['MYSQL_PASSWORD'] ?? '';

  return new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({
        host,
        port,
        database,
        user,
        password,
        connectionLimit: 5,
      }) as unknown as MysqlDialectConfig['pool'],
    }),
  });
}

// ─── State ────────────────────────────────────────────────────────────────────

let db: Kysely<DB>;
let canWrite = false;

const trackedChannels: string[] = [];
const trackedUsers: string[] = [];

function newChannelUrl(): string {
  const url = `test_ch_${nanoid(12)}`;
  trackedChannels.push(url);
  return url;
}

function newUserId(): string {
  const id = `test_u_${nanoid(12)}`;
  trackedUsers.push(id);
  return id;
}

async function cleanup(): Promise<void> {
  if (!canWrite) return;

  if (trackedChannels.length) {
    // members are FK-constrained to channels; delete members first
    await db
      .deleteFrom('messenger_members')
      .where('channel_url', 'in', [...trackedChannels])
      .execute()
      .catch(() => undefined);
    await db
      .deleteFrom('messenger_channels')
      .where('channel_url', 'in', [...trackedChannels])
      .execute()
      .catch(() => undefined);
    trackedChannels.length = 0;
  }
  if (trackedUsers.length) {
    await db
      .deleteFrom('messenger_users')
      .where('user_id', 'in', [...trackedUsers])
      .execute()
      .catch(() => undefined);
    trackedUsers.length = 0;
  }
}

/** Insert a minimal channel + user and return their IDs. */
async function seedChannelAndUser(): Promise<{ channelUrl: string; userId: string }> {
  const channelUrl = newChannelUrl();
  const userId = newUserId();
  await db
    .insertInto('messenger_channels')
    .values({ channel_url: channelUrl, name: 'Test Channel', custom_type: 'public' })
    .execute();
  await db
    .insertInto('messenger_users')
    .values({ user_id: userId, nickname: 'Tester' })
    .execute();
  return { channelUrl, userId };
}

// ─── Guard helper (mirrors messages.test.ts itWrite) ─────────────────────────

function itWrite(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!canWrite) {
      console.warn(`  ↳ SKIPPED (no write access): ${name}`);
      return;
    }
    await fn();
  });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  db = buildWriteDb();

  // Probe: can we reach the DB?
  try {
    await db.selectFrom('messenger_members').select('user_id').limit(1).execute();
  } catch (err) {
    console.warn('\n⚠  BLOCKED: cannot reach messenger_members —', String(err));
    await db.destroy();
    return;
  }

  // Probe: do we have write access?
  const probeChannel = `test_probe_ch_${nanoid(8)}`;
  try {
    await db
      .insertInto('messenger_channels')
      .values({ channel_url: probeChannel, name: 'probe', custom_type: 'public' })
      .execute();
    await db
      .deleteFrom('messenger_channels')
      .where('channel_url', '=', probeChannel)
      .execute();
    canWrite = true;
  } catch (err) {
    console.warn(
      '\n⚠  BLOCKED: messenger tables are read-only for the current user' +
        ` (MYSQL_WRITE_USER=${process.env['MYSQL_WRITE_USER'] ?? process.env['MYSQL_USER'] ?? '?'}).` +
        ' Set MYSQL_WRITE_USER + MYSQL_WRITE_PASSWORD to a writable account to run these tests.\n' +
        `  Error: ${String(err)}`,
    );
  }
});

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.destroy();
});

// ─── getMembership ────────────────────────────────────────────────────────────

describe('getMembership', () => {
  itWrite('returns null for a non-member', async () => {
    const { channelUrl } = await seedChannelAndUser();
    expect(await getMembership(db, channelUrl, 'nobody-' + nanoid())).toBeNull();
  });

  itWrite('returns state=joined for a joined member and reflects a ban', async () => {
    const { channelUrl } = await seedChannelAndUser();
    const uid = newUserId();
    await db
      .insertInto('messenger_users')
      .values({ user_id: uid, nickname: 'BanTest' })
      .execute();

    await addUserToChannel(db, channelUrl, uid, 'member');
    expect((await getMembership(db, channelUrl, uid))?.state).toBe('joined');

    await banUserFromChannel(db, channelUrl, uid);
    expect((await getMembership(db, channelUrl, uid))?.state).toBe('banned');
  });
});
