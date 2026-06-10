/**
 * test/messaging/bots.test.ts
 *
 * Integration tests for the messaging/bots/registry Kysely service (Task 4.1).
 *
 * Targets the real bom_prd DB.  Connection mirrors users.test.ts:
 *   MYSQL_HOST / MYSQL_PORT / MYSQL_DB — from backend/.env (dotenv auto-loaded)
 *   MYSQL_WRITE_USER     — writable user (falls back to MYSQL_USER)
 *   MYSQL_WRITE_PASSWORD — writable password (falls back to MYSQL_PASSWORD)
 *
 * Read paths (getBotUser non-existent → null) run live on the reader.
 * Write paths (addBotToChannel / removeBotFromChannel) are guarded with
 * `itWrite()` and skip-with-BLOCKED when only a read-only user is present.
 */

import 'dotenv/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import {
  addBotToChannel,
  removeBotFromChannel,
  getBotUser,
} from '../../src/messaging/bots/registry.js';

// ─── Write-capable Kysely instance ───────────────────────────────────────────

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

// ─── State ─────────────────────────────────────────────────────────────────────

let db: Kysely<DB>;
let canWrite = false;

const trackedUserIds: string[] = [];
const trackedChannelUrls: string[] = [];

function newBotId(): string {
  const id = `test_bot_${nanoid(10)}`;
  trackedUserIds.push(id);
  return id;
}

function newChannelUrl(): string {
  const url = `test_ch_bots_${nanoid(10)}`;
  trackedChannelUrls.push(url);
  return url;
}

async function cleanup(): Promise<void> {
  if (!canWrite) return;
  // Remove members first (FK: channel_url / user_id refs the user rows).
  if (trackedChannelUrls.length) {
    await db
      .deleteFrom('messenger_members')
      .where('channel_url', 'in', [...trackedChannelUrls])
      .execute();
    await db
      .deleteFrom('messenger_channels')
      .where('channel_url', 'in', [...trackedChannelUrls])
      .execute();
    trackedChannelUrls.length = 0;
  }
  if (trackedUserIds.length) {
    await db
      .deleteFrom('messenger_users')
      .where('user_id', 'in', [...trackedUserIds])
      .execute();
    trackedUserIds.length = 0;
  }
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  db = buildWriteDb();

  // Probe: can we reach the DB?
  try {
    await db.selectFrom('messenger_users').select('user_id').limit(1).execute();
  } catch (err) {
    console.warn('\n⚠  BLOCKED: cannot reach messenger_users —', String(err));
    await db.destroy();
    return;
  }

  // Probe: do we have write access?
  const probeId = `test_probe_bots_${nanoid(8)}`;
  try {
    await db
      .insertInto('messenger_users')
      .values({ user_id: probeId, nickname: 'probe' })
      .execute();
    await db
      .deleteFrom('messenger_users')
      .where('user_id', '=', probeId)
      .execute();
    canWrite = true;
  } catch (err) {
    console.warn(
      '\n⚠  BLOCKED: messenger_users is read-only for the current user' +
        ` (MYSQL_WRITE_USER=${
          process.env['MYSQL_WRITE_USER'] ??
          process.env['MYSQL_USER'] ??
          '?'
        }). Set MYSQL_WRITE_USER + MYSQL_WRITE_PASSWORD to run write tests.\n` +
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

// ─── Write-guard helper ───────────────────────────────────────────────────────

function itWrite(name: string, fn: () => Promise<void>) {
  it(name, async () => {
    if (!canWrite) {
      console.warn(`  ↳ SKIPPED (no write access): ${name}`);
      return;
    }
    await fn();
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getBotUser', () => {
  it('returns null for an unknown user_id', async () => {
    const result = await getBotUser(db, `test_ghost_${nanoid(8)}`);
    expect(result).toBeNull();
  });

  itWrite('returns null when user exists but is_bot is false', async () => {
    const id = newBotId();
    await db
      .insertInto('messenger_users')
      .values({ user_id: id, nickname: 'Human', is_bot: 0 })
      .execute();
    const result = await getBotUser(db, id);
    expect(result).toBeNull();
  });

  itWrite('returns UserDTO when user exists and is_bot is true', async () => {
    const id = newBotId();
    await db
      .insertInto('messenger_users')
      .values({ user_id: id, nickname: 'TestBot', is_bot: 1 })
      .execute();
    const result = await getBotUser(db, id);
    expect(result).not.toBeNull();
    expect(result!.user_id).toBe(id);
    expect(result!.is_bot).toBe(true);
    expect(result!.nickname).toBe('TestBot');
  });
});

describe('addBotToChannel', () => {
  itWrite('returns false when the bot user_id does not exist', async () => {
    const channelUrl = newChannelUrl();
    // Need a channel row for the FK (messenger_members.channel_url → messenger_channels)
    await db
      .insertInto('messenger_channels')
      .values({ channel_url: channelUrl, name: 'Test Channel', custom_type: 'open' })
      .execute();
    const success = await addBotToChannel(db, channelUrl, `test_ghost_bot_${nanoid(8)}`);
    expect(success).toBe(false);
  });

  itWrite('returns false when the user exists but is not a bot', async () => {
    const botId = newBotId();
    const channelUrl = newChannelUrl();
    await Promise.all([
      db.insertInto('messenger_users').values({ user_id: botId, nickname: 'NotABot', is_bot: 0 }).execute(),
      db.insertInto('messenger_channels').values({ channel_url: channelUrl, name: 'Test Channel', custom_type: 'open' }).execute(),
    ]);
    const success = await addBotToChannel(db, channelUrl, botId);
    expect(success).toBe(false);
  });

  itWrite('adds a bot to a channel and returns true', async () => {
    const botId = newBotId();
    const channelUrl = newChannelUrl();
    await Promise.all([
      db.insertInto('messenger_users').values({ user_id: botId, nickname: 'MyBot', is_bot: 1 }).execute(),
      db.insertInto('messenger_channels').values({ channel_url: channelUrl, name: 'Test Channel', custom_type: 'open' }).execute(),
    ]);

    const success = await addBotToChannel(db, channelUrl, botId);
    expect(success).toBe(true);

    // Confirm membership row exists
    const row = await db
      .selectFrom('messenger_members')
      .select(['user_id', 'role', 'state'])
      .where('channel_url', '=', channelUrl)
      .where('user_id', '=', botId)
      .executeTakeFirst();
    expect(row).not.toBeUndefined();
    expect(row!.role).toBe('member');
    expect(row!.state).toBe('joined');
  });

  itWrite('returns false on duplicate add (already a member)', async () => {
    const botId = newBotId();
    const channelUrl = newChannelUrl();
    await Promise.all([
      db.insertInto('messenger_users').values({ user_id: botId, nickname: 'DupBot', is_bot: 1 }).execute(),
      db.insertInto('messenger_channels').values({ channel_url: channelUrl, name: 'Test Channel', custom_type: 'open' }).execute(),
    ]);

    const first = await addBotToChannel(db, channelUrl, botId);
    expect(first).toBe(true);
    const second = await addBotToChannel(db, channelUrl, botId);
    expect(second).toBe(false);
  });
});

describe('removeBotFromChannel', () => {
  itWrite('removes an existing bot membership and returns true', async () => {
    const botId = newBotId();
    const channelUrl = newChannelUrl();
    await Promise.all([
      db.insertInto('messenger_users').values({ user_id: botId, nickname: 'RemoveBot', is_bot: 1 }).execute(),
      db.insertInto('messenger_channels').values({ channel_url: channelUrl, name: 'Test Channel', custom_type: 'open' }).execute(),
    ]);
    // Add first, then remove
    await addBotToChannel(db, channelUrl, botId);

    const success = await removeBotFromChannel(db, channelUrl, botId);
    expect(success).toBe(true);

    // Confirm row is gone
    const row = await db
      .selectFrom('messenger_members')
      .select('user_id')
      .where('channel_url', '=', channelUrl)
      .where('user_id', '=', botId)
      .executeTakeFirst();
    expect(row).toBeUndefined();
  });

  itWrite('returns false when the bot is not a member', async () => {
    const botId = newBotId();
    const channelUrl = newChannelUrl();
    await Promise.all([
      db.insertInto('messenger_users').values({ user_id: botId, nickname: 'NeverJoined', is_bot: 1 }).execute(),
      db.insertInto('messenger_channels').values({ channel_url: channelUrl, name: 'Test Channel', custom_type: 'open' }).execute(),
    ]);
    const success = await removeBotFromChannel(db, channelUrl, botId);
    expect(success).toBe(false);
  });
});
