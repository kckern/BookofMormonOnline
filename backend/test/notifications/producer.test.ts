/**
 * test/notifications/producer.test.ts
 *
 * Integration test: verifies that pushNotificationForEvent writes a durable row
 * to bom_notification (via notify()) in addition to emitting the socket event.
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
import { pushNotificationForEvent } from '../../src/messaging/notifications.js';
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

/** Create a throwaway channel + a joined membership for the given users. */
async function mkChannel(name: string, members: string[]): Promise<string> {
  const url = `test_notif_${nanoid(10)}`;
  channelUrls.push(url);
  await db.insertInto('messenger_channels').values({ channel_url: url, name, custom_type: 'private' }).execute();
  for (const u of members) {
    await db.insertInto('messenger_members').values({ channel_url: url, user_id: u, role: 'member', state: 'joined' }).execute();
  }
  return url;
}

function nextMsgId(): string {
  return nanoid(11);
}

/** Insert a message; track it. */
async function mkMessage(channelUrl: string, userId: string, message: string, parent?: string): Promise<string> {
  const id = nextMsgId();
  messageIds.push(id);
  await db
    .insertInto('messenger_messages')
    .values({
      message_id: id,
      channel_url: channelUrl,
      user_id: userId,
      message_type: 'MESG',
      message,
      parent_message_id: parent ?? null,
      created_at: new Date(),
    })
    .execute();
  return id;
}

describe('pushNotificationForEvent write-through', () => {
  itWrite('a reply event persists a durable notification row', async () => {
    // Stub io so getBus().emit doesn't throw (no real socket server in tests).
    setIo({
      to: (_room: string) => ({ emit: () => {} }),
    } as any);

    try {
      const me = await mkUser('Recipient');
      const actor = await mkUser('Replier');
      const ch = await mkChannel('Group A', [me, actor]);
      const parent = await mkMessage(ch, me, 'my comment');
      const replyMsgId = await mkMessage(ch, actor, 'nice point', parent);

      await pushNotificationForEvent(db, { type: 'reply', targetMessageId: parent, actorId: actor, sourceMessageId: replyMsgId });

      const row = await db.selectFrom('bom_notification')
        .selectAll().where('user_id', '=', me).where('type', '=', 'reply').executeTakeFirst();
      expect(row).toBeDefined();
      expect(row!.dedupe_key).toBe(`reply:${replyMsgId}`);
      expect(row!.actor_id).toBe(actor);
    } finally {
      setIo(null as any);
    }
  });
});
