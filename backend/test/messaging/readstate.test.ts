/**
 * test/messaging/readstate.test.ts
 *
 * Integration tests for the messaging/readstate Kysely service (Task 1.5).
 *
 * Targets the real bom_prd DB.  Connection mirrors users.test.ts:
 *   MYSQL_HOST / MYSQL_PORT / MYSQL_DB — from backend/.env (dotenv auto-loaded)
 *   MYSQL_WRITE_USER     — writable user (falls back to MYSQL_USER)
 *   MYSQL_WRITE_PASSWORD — writable password (falls back to MYSQL_PASSWORD)
 *
 * Write tests (INSERT/UPDATE) are guarded with `itWrite()` and automatically
 * skip when only a read-only user is present, reporting BLOCKED.
 * Read-only assertions (getUnreadCount returns 0 for unknown member) run live.
 *
 * Key contract verified:
 *   - markAsRead / markChannelAsRead stamp last_read_at
 *   - getUnreadCount excludes the user's own messages (legacy mirror)
 *   - getUnreadCount excludes threaded replies (parent_message_id IS NOT NULL)
 *   - getUnreadCount excludes soft-deleted messages (is_deleted = 1)
 *   - getUnreadCount returns 0 when member row absent or last_read_at is NULL
 */

import 'dotenv/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { markAsRead, markChannelAsRead, getUnreadCount } from '../../src/messaging/readstate.js';

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
  const url = `test_rs_ch_${nanoid(10)}`;
  trackedChannels.push(url);
  return url;
}

function newUserId(): string {
  const id = `test_rs_u_${nanoid(10)}`;
  trackedUsers.push(id);
  return id;
}

async function cleanup(): Promise<void> {
  if (!canWrite) return;

  if (trackedChannels.length) {
    await db
      .deleteFrom('messenger_members')
      .where('channel_url', 'in', [...trackedChannels])
      .execute()
      .catch(() => undefined);
    await db
      .deleteFrom('messenger_messages')
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

// ─── Guard helper ─────────────────────────────────────────────────────────────

function itWrite(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!canWrite) {
      console.warn(`  ↳ SKIPPED (no write access): ${name}`);
      return;
    }
    await fn();
  });
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedUser(nickname = 'Tester'): Promise<string> {
  const userId = newUserId();
  await db.insertInto('messenger_users').values({ user_id: userId, nickname }).execute();
  return userId;
}

async function seedChannel(): Promise<string> {
  const channelUrl = newChannelUrl();
  await db
    .insertInto('messenger_channels')
    .values({ channel_url: channelUrl, name: 'RS Test Channel', custom_type: 'private' })
    .execute();
  return channelUrl;
}

async function joinChannel(channelUrl: string, userId: string): Promise<void> {
  await db
    .insertInto('messenger_members')
    .values({ channel_url: channelUrl, user_id: userId, role: 'member', state: 'joined' })
    .execute();
}

async function postMessage(
  channelUrl: string,
  userId: string,
  opts: { parentMessageId?: string; isDeleted?: boolean } = {},
): Promise<string> {
  const messageId = `test_msg_${nanoid(8)}`;
  await db
    .insertInto('messenger_messages')
    .values({
      message_id: messageId,
      channel_url: channelUrl,
      user_id: userId,
      message: 'test message',
      ...(opts.parentMessageId ? { parent_message_id: opts.parentMessageId } : {}),
      ...(opts.isDeleted ? { is_deleted: 1 } : {}),
    })
    .execute();
  return messageId;
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
  const probeUrl = `test_probe_rs_${nanoid(8)}`;
  try {
    await db
      .insertInto('messenger_channels')
      .values({ channel_url: probeUrl, name: 'probe', custom_type: 'public' })
      .execute();
    await db.deleteFrom('messenger_channels').where('channel_url', '=', probeUrl).execute();
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

// ─── getUnreadCount — read-only safe ─────────────────────────────────────────

describe('getUnreadCount', () => {
  it('returns 0 for a non-existent member', async () => {
    const count = await getUnreadCount(db, `test_ghost_ch_${nanoid(6)}`, `test_ghost_u_${nanoid(6)}`);
    expect(count).toBe(0);
  });

  itWrite('returns 0 when last_read_at is NULL (never read)', async () => {
    const channelUrl = await seedChannel();
    const viewer = await seedUser('Viewer');
    const other = await seedUser('Other');

    await joinChannel(channelUrl, viewer);

    // Post a message by the other user BEFORE setting last_read_at
    await postMessage(channelUrl, other);

    // member row exists but last_read_at is NULL
    const count = await getUnreadCount(db, channelUrl, viewer);
    expect(count).toBe(0);
  });

  itWrite('counts messages posted after last_read_at by other users', async () => {
    const channelUrl = await seedChannel();
    const viewer = await seedUser('Viewer');
    const other = await seedUser('Other');

    await joinChannel(channelUrl, viewer);
    await joinChannel(channelUrl, other);

    // Stamp a past last_read_at
    const past = new Date(Date.now() - 10_000);
    await db
      .updateTable('messenger_members')
      .set({ last_read_at: past })
      .where('channel_url', '=', channelUrl)
      .where('user_id', '=', viewer)
      .execute();

    // Post 2 messages by the other user (these are after last_read_at)
    await postMessage(channelUrl, other);
    await postMessage(channelUrl, other);

    const count = await getUnreadCount(db, channelUrl, viewer);
    expect(count).toBe(2);
  });

  itWrite('does NOT count own messages as unread (legacy contract)', async () => {
    const channelUrl = await seedChannel();
    const viewer = await seedUser('Viewer');

    await joinChannel(channelUrl, viewer);

    const past = new Date(Date.now() - 10_000);
    await db
      .updateTable('messenger_members')
      .set({ last_read_at: past })
      .where('channel_url', '=', channelUrl)
      .where('user_id', '=', viewer)
      .execute();

    // Only own messages posted after last_read_at
    await postMessage(channelUrl, viewer);
    await postMessage(channelUrl, viewer);

    const count = await getUnreadCount(db, channelUrl, viewer);
    expect(count).toBe(0);
  });

  itWrite('does NOT count threaded replies (parent_message_id IS NOT NULL)', async () => {
    const channelUrl = await seedChannel();
    const viewer = await seedUser('Viewer');
    const other = await seedUser('Other');

    await joinChannel(channelUrl, viewer);
    await joinChannel(channelUrl, other);

    const past = new Date(Date.now() - 10_000);
    await db
      .updateTable('messenger_members')
      .set({ last_read_at: past })
      .where('channel_url', '=', channelUrl)
      .where('user_id', '=', viewer)
      .execute();

    // Post a top-level message, then a reply to it
    const parentId = await postMessage(channelUrl, other);
    await postMessage(channelUrl, other, { parentMessageId: parentId });

    // Only the top-level message counts
    const count = await getUnreadCount(db, channelUrl, viewer);
    expect(count).toBe(1);
  });

  itWrite('does NOT count soft-deleted messages (is_deleted = 1)', async () => {
    const channelUrl = await seedChannel();
    const viewer = await seedUser('Viewer');
    const other = await seedUser('Other');

    await joinChannel(channelUrl, viewer);
    await joinChannel(channelUrl, other);

    const past = new Date(Date.now() - 10_000);
    await db
      .updateTable('messenger_members')
      .set({ last_read_at: past })
      .where('channel_url', '=', channelUrl)
      .where('user_id', '=', viewer)
      .execute();

    // 1 live message + 1 deleted message
    await postMessage(channelUrl, other);
    await postMessage(channelUrl, other, { isDeleted: true });

    const count = await getUnreadCount(db, channelUrl, viewer);
    expect(count).toBe(1);
  });

  itWrite('returns 0 when all qualifying messages are before last_read_at', async () => {
    const channelUrl = await seedChannel();
    const viewer = await seedUser('Viewer');
    const other = await seedUser('Other');

    await joinChannel(channelUrl, viewer);
    await joinChannel(channelUrl, other);

    // Post a message first, then set last_read_at to now
    await postMessage(channelUrl, other);

    // Stamp last_read_at to current time (all messages are now "read")
    await db
      .updateTable('messenger_members')
      .set({ last_read_at: new Date() })
      .where('channel_url', '=', channelUrl)
      .where('user_id', '=', viewer)
      .execute();

    const count = await getUnreadCount(db, channelUrl, viewer);
    expect(count).toBe(0);
  });
});

// ─── markAsRead ───────────────────────────────────────────────────────────────

describe('markAsRead', () => {
  itWrite('returns true and stamps last_read_at for a known member', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser('Reader');

    await joinChannel(channelUrl, userId);

    const before = Date.now();
    const ok = await markAsRead(db, channelUrl, userId);
    const after = Date.now();

    expect(ok).toBe(true);

    const row = await db
      .selectFrom('messenger_members')
      .select('last_read_at')
      .where('channel_url', '=', channelUrl)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    expect(row).toBeDefined();
    expect(row!.last_read_at).not.toBeNull();
    const ts = new Date(row!.last_read_at!).getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 1000);
    expect(ts).toBeLessThanOrEqual(after + 1000);
  });

  itWrite('returns false when the member row does not exist', async () => {
    const ok = await markAsRead(db, `test_ghost_ch_${nanoid(6)}`, `test_ghost_u_${nanoid(6)}`);
    expect(ok).toBe(false);
  });
});

// ─── markChannelAsRead (alias) ────────────────────────────────────────────────

describe('markChannelAsRead', () => {
  itWrite('is functionally identical to markAsRead', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser('AliasReader');

    await joinChannel(channelUrl, userId);

    const ok = await markChannelAsRead(db, channelUrl, userId);
    expect(ok).toBe(true);

    const row = await db
      .selectFrom('messenger_members')
      .select('last_read_at')
      .where('channel_url', '=', channelUrl)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    expect(row!.last_read_at).not.toBeNull();
  });
});

// ─── getUnreadCount + markAsRead integration ──────────────────────────────────

describe('getUnreadCount + markAsRead integration', () => {
  itWrite('unread count drops to 0 after markAsRead', async () => {
    const channelUrl = await seedChannel();
    const viewer = await seedUser('IntegrationViewer');
    const other = await seedUser('IntegrationOther');

    await joinChannel(channelUrl, viewer);
    await joinChannel(channelUrl, other);

    // Stamp a past last_read_at so there are unread messages
    const past = new Date(Date.now() - 10_000);
    await db
      .updateTable('messenger_members')
      .set({ last_read_at: past })
      .where('channel_url', '=', channelUrl)
      .where('user_id', '=', viewer)
      .execute();

    await postMessage(channelUrl, other);
    await postMessage(channelUrl, other);

    const before = await getUnreadCount(db, channelUrl, viewer);
    expect(before).toBe(2);

    await markAsRead(db, channelUrl, viewer);

    const after = await getUnreadCount(db, channelUrl, viewer);
    expect(after).toBe(0);
  });
});
