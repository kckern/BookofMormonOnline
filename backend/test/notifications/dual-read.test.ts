/**
 * test/notifications/dual-read.test.ts
 *
 * Integration tests for the dual-read merge in getNotifications:
 *   - stored-only rows (no derived twin) must still surface
 *   - an event that is both derived and stored appears exactly once
 */

import 'dotenv/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { getNotifications, pushNotificationForEvent } from '../../src/messaging/notifications.js';
import { persistNotification } from '../../src/notifications/store.js';

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
  const probeId = `test_dr_probe_${nanoid(8)}`;
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
  // Delete bom_notification rows BEFORE messenger_users (FK).
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
  const id = `test_dr_${nanoid(10)}`;
  userIds.push(id);
  await db.insertInto('messenger_users').values({ user_id: id, nickname }).execute();
  return id;
}

/** Create a throwaway channel + joined memberships. */
async function mkChannel(name: string, members: string[]): Promise<string> {
  const url = `test_dr_${nanoid(10)}`;
  channelUrls.push(url);
  await db.insertInto('messenger_channels').values({ channel_url: url, name, custom_type: 'private' }).execute();
  for (const u of members) {
    await db.insertInto('messenger_members').values({ channel_url: url, user_id: u, role: 'member', state: 'joined' }).execute();
  }
  return url;
}

/** Insert a message; track it. */
async function mkMessage(channelUrl: string, userId: string, message: string, parent?: string): Promise<string> {
  const id = nanoid(11);
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

describe('dual-read merge', () => {
  itWrite('surfaces a stored-only notification that has no derived twin', async () => {
    const me = await mkUser('Recipient');
    const actor = await mkUser('Ghost');
    const dedupeKey = `reply:${nanoid(11)}`; // source message does not exist → derived arm can never produce it
    await persistNotification(db, {
      userId: me, type: 'reply', actorId: actor, dedupeKey,
      payload: { text: 'orphan', channel_url: 'c', message_id: 'gone',
                 actor: { user_id: actor, nickname: 'Ghost', profile_url: '' } as any },
    });
    const notifs = await getNotifications(db, me);
    expect(notifs.some((n) => n.id === dedupeKey)).toBe(true);
  });

  itWrite('a reply that is both derived and stored appears exactly once', async () => {
    const me = await mkUser('Recipient');
    const actor = await mkUser('Replier');
    const ch = await mkChannel('Group A', [me, actor]);
    const parent = await mkMessage(ch, me, 'my comment');
    // Capture the reply id — both arms must produce reply:<replyId> to collide.
    const replyId = await mkMessage(ch, actor, 'nice point', parent);
    await pushNotificationForEvent(db, {
      type: 'reply',
      targetMessageId: parent,
      actorId: actor,
      sourceMessageId: replyId,
    });
    // Derived arm: reply:<replyId>; stored arm: reply:<replyId> — merged → exactly one.
    const replies = (await getNotifications(db, me)).filter((n) => n.id === `reply:${replyId}`);
    expect(replies.length).toBe(1);
  });

  itWrite('multiple replies to the same parent produce distinct notifications', async () => {
    const me = await mkUser('Recipient');
    const actor1 = await mkUser('Replier1');
    const actor2 = await mkUser('Replier2');
    const ch = await mkChannel('Group B', [me, actor1, actor2]);
    const parent = await mkMessage(ch, me, 'my original comment');
    const r1 = await mkMessage(ch, actor1, 'first reply', parent);
    const r2 = await mkMessage(ch, actor2, 'second reply', parent);

    // Each reply pushes with its own sourceMessageId — must NOT collapse to one row.
    await pushNotificationForEvent(db, {
      type: 'reply',
      targetMessageId: parent,
      actorId: actor1,
      sourceMessageId: r1,
    });
    await pushNotificationForEvent(db, {
      type: 'reply',
      targetMessageId: parent,
      actorId: actor2,
      sourceMessageId: r2,
    });

    // Both rows must exist in bom_notification — neither dropped by UNIQUE collision.
    const rows = await db
      .selectFrom('bom_notification')
      .select('dedupe_key')
      .where('user_id', '=', me)
      .where('type', '=', 'reply')
      .execute();
    const keys = rows.map((r) => r.dedupe_key);
    expect(keys).toContain(`reply:${r1}`);
    expect(keys).toContain(`reply:${r2}`);

    // getNotifications must surface both distinct ids.
    const notifs = await getNotifications(db, me);
    const ids = notifs.map((n) => n.id);
    expect(ids).toContain(`reply:${r1}`);
    expect(ids).toContain(`reply:${r2}`);
  });
});
