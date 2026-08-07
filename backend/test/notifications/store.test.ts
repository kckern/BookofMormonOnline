/**
 * test/notifications/store.test.ts
 *
 * Integration tests for the notification persistence layer (src/notifications/store).
 * Targets the real bom_prd DB via MYSQL_WRITE_USER (falls back to MYSQL_USER).
 *
 * All inserted rows are tracked and deleted in afterEach; the suite is SKIPPED
 * (not faked) when the DB is read-only / unreachable.
 */

import 'dotenv/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { persistNotification, rowToDTO } from '../../src/notifications/store.js';
import { notify } from '../../src/notifications/notify.js';
import { setIo } from '../../src/realtime/RealtimeBus.js';

function buildWriteDb(): Kysely<DB> {
  const host = process.env['MYSQL_HOST'] ?? '127.0.0.1';
  const port = Number(process.env['MYSQL_PORT'] ?? 3306);
  const database = process.env['MYSQL_DB'] ?? 'bom_prd';
  const user = process.env['MYSQL_WRITE_USER'] ?? process.env['MYSQL_USER'] ?? 'root';
  const password = process.env['MYSQL_WRITE_PASSWORD'] ?? process.env['MYSQL_PASSWORD'] ?? '';
  return new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({ host, port, database, user, password, connectionLimit: 5 }) as unknown as MysqlDialectConfig['pool'],
    }),
  });
}

let db: Kysely<DB>;
let canWrite = false;

// Tracked rows for cleanup.
const userIds: string[] = [];
const channelUrls: string[] = [];
const messageIds: string[] = [];

beforeAll(async () => {
  db = buildWriteDb();
  try {
    await db.selectFrom('messenger_users').select('user_id').limit(1).execute();
  } catch (err) {
    console.warn('\n⚠  BLOCKED: cannot reach DB —', String(err));
    await db.destroy();
    return;
  }
  const probeId = `test_notif_probe_${nanoid(8)}`;
  try {
    await db.insertInto('messenger_users').values({ user_id: probeId, nickname: 'probe' }).execute();
    await db.deleteFrom('messenger_users').where('user_id', '=', probeId).execute();
    canWrite = true;
  } catch (err) {
    console.warn('\n⚠  BLOCKED: DB is read-only for the current user —', String(err));
  }
});

async function cleanup(): Promise<void> {
  if (!canWrite) return;
  if (userIds.length) await db.deleteFrom('bom_notification').where('user_id', 'in', userIds).execute();
  if (messageIds.length) {
    await db.deleteFrom('messenger_reactions').where('message_id', 'in', [...messageIds]).execute();
    await db.deleteFrom('messenger_messages').where('message_id', 'in', [...messageIds]).execute();
    await db.deleteFrom('messenger_messages').where('parent_message_id', 'in', [...messageIds]).execute();
  }
  if (channelUrls.length) {
    await db.deleteFrom('messenger_members').where('channel_url', 'in', [...channelUrls]).execute();
    await db.deleteFrom('messenger_channels').where('channel_url', 'in', [...channelUrls]).execute();
  }
  if (userIds.length) {
    await db.deleteFrom('messenger_users').where('user_id', 'in', [...userIds]).execute();
  }
  messageIds.length = 0;
  channelUrls.length = 0;
  userIds.length = 0;
}

afterEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.destroy();
});

function itWrite(name: string, fn: () => Promise<void>) {
  it(name, async () => {
    if (!canWrite) {
      console.warn(`  ↳ SKIPPED (no write access): ${name}`);
      return;
    }
    await fn();
  });
}

/** Create a throwaway user and track it. */
async function mkUser(nickname: string): Promise<string> {
  const id = `test_notif_${nanoid(10)}`;
  userIds.push(id);
  await db.insertInto('messenger_users').values({ user_id: id, nickname }).execute();
  return id;
}

describe('persistNotification', () => {
  itWrite('inserts once and is idempotent on (user_id, dedupe_key)', async () => {
    const me = await mkUser('Recipient');
    const actor = await mkUser('Actor');
    const input = {
      userId: me, type: 'reply', actorId: actor, dedupeKey: `reply:${nanoid(11)}`,
      payload: { text: 'nice point', channel_url: 'ch1', message_id: 'm1',
                 actor: { user_id: actor, nickname: 'Actor', profile_url: '' } as any },
    };
    const first = await persistNotification(db, input);
    const second = await persistNotification(db, input);
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    const rows = await db.selectFrom('bom_notification').selectAll().where('user_id', '=', me).execute();
    expect(rows.length).toBe(1);
  });
});

describe('rowToDTO', () => {
  it('parses a string payload correctly', () => {
    const payload = { text: 'hello', channel_url: 'ch1', message_id: 'm1', actor: null };
    const row = {
      type: 'reply',
      dedupe_key: 'reply:abc123',
      payload: JSON.stringify(payload),
      created_at: new Date('2025-01-01T00:00:00Z'),
      read_at: null,
    };
    const dto = rowToDTO(row);
    expect(dto.id).toBe('reply:abc123');
    expect(dto.type).toBe('reply');
    expect(dto.text).toBe('hello');
    expect(dto.channel_url).toBe('ch1');
    expect(dto.message_id).toBe('m1');
    expect(dto.actor).toBeNull();
    expect(dto.is_read).toBe(false);
    expect(dto.created_at).toBe(new Date('2025-01-01T00:00:00Z').getTime());
  });

  it('parses an already-parsed object payload correctly', () => {
    const payload = { text: 'world', channel_url: null, message_id: null, actor: null };
    const row = {
      type: 'invite',
      dedupe_key: 'invite:xyz789',
      payload: payload,
      created_at: new Date('2025-06-01T12:00:00Z'),
      read_at: new Date('2025-06-01T13:00:00Z'),
    };
    const dto = rowToDTO(row);
    expect(dto.id).toBe('invite:xyz789');
    expect(dto.type).toBe('invite');
    expect(dto.is_read).toBe(true);
  });
});

describe('notify', () => {
  itWrite('emits notification_received exactly once for a fresh row, never for a duplicate', async () => {
    const me = await mkUser('Recipient');
    const events: Array<{ room: string; dto: any }> = [];
    const input = {
      userId: me, type: 'reply', actorId: me, dedupeKey: `reply:${nanoid(11)}`,
      payload: { text: 't', channel_url: 'c', message_id: 'm', actor: null },
    };
    // Stub the io singleton so RealtimeBus.emit routes here.
    setIo({
      to: (room: string) => ({
        emit: (event: string, dto: any) => {
          if (event === 'notification_received') events.push({ room, dto });
        },
      }),
    } as any);
    try {
      await notify(db, input);
      await notify(db, input); // duplicate → no emit
    } finally {
      setIo(null as any);
    }
    expect(events.length).toBe(1);
    expect(events[0]!.room).toBe(`user:${me}`);
    expect(events[0]!.dto.id).toBe(input.dedupeKey);
  });
});
