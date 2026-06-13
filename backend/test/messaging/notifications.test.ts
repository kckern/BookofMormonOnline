/**
 * test/messaging/notifications.test.ts
 *
 * Integration tests for the derived notification feed (messaging/notifications).
 * Targets the real bom_prd DB via MYSQL_WRITE_USER (falls back to MYSQL_USER).
 *
 * Each test creates a throwaway recipient user, an authored message, and a
 * reply/reaction/invite from a throwaway actor, then asserts the feed and the
 * mark-read behaviour. All inserted rows are tracked and deleted in afterEach;
 * the suite is SKIPPED (not faked) when the DB is read-only / unreachable.
 */

import 'dotenv/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../src/messaging/notifications.js';

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

// Tracked rows for cleanup (all tagged with __e2e__-style throwaway ids).
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

// message_id is varchar(11). Use an 11-char nanoid so test rows are unique even
// when this suite runs in parallel with other suites that also insert messages
// (the prod centisecond generator would otherwise collide across processes).
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

describe('getNotifications', () => {
  itWrite('surfaces a reply to the user\'s message as an unread notification', async () => {
    const me = await mkUser('Recipient');
    const actor = await mkUser('Replier');
    const ch = await mkChannel('Group A', [me, actor]);
    const parent = await mkMessage(ch, me, 'my comment');
    await mkMessage(ch, actor, 'nice point', parent);

    const notifs = await getNotifications(db, me);
    const reply = notifs.find((n) => n.type === 'reply');
    expect(reply).toBeDefined();
    expect(reply!.message_id).toBe(parent);
    expect(reply!.channel_url).toBe(ch);
    expect(reply!.actor?.nickname).toBe('Replier');
    expect(reply!.is_read).toBe(false);
  });

  itWrite('surfaces a reaction on the user\'s message', async () => {
    const me = await mkUser('Recipient');
    const actor = await mkUser('Reactor');
    const ch = await mkChannel('Group B', [me, actor]);
    const msg = await mkMessage(ch, me, 'my message');
    await db
      .insertInto('messenger_reactions')
      .values({ message_id: msg, user_id: actor, reaction_key: 'love', created_at: new Date() })
      .execute();

    const notifs = await getNotifications(db, me);
    const reaction = notifs.find((n) => n.type === 'reaction');
    expect(reaction).toBeDefined();
    expect(reaction!.message_id).toBe(msg);
    expect(reaction!.is_read).toBe(false);
  });

  itWrite('surfaces a pending group invite', async () => {
    const me = await mkUser('Invitee');
    const ch = `test_notif_${nanoid(10)}`;
    channelUrls.push(ch);
    await db.insertInto('messenger_channels').values({ channel_url: ch, name: 'Invited Group', custom_type: 'private' }).execute();
    await db.insertInto('messenger_members').values({ channel_url: ch, user_id: me, role: 'member', state: 'invited' }).execute();

    const notifs = await getNotifications(db, me);
    const invite = notifs.find((n) => n.type === 'invite');
    expect(invite).toBeDefined();
    expect(invite!.channel_url).toBe(ch);
  });

  itWrite('excludes the user\'s own replies and reactions', async () => {
    const me = await mkUser('Recipient');
    const ch = await mkChannel('Group C', [me]);
    const parent = await mkMessage(ch, me, 'my comment');
    await mkMessage(ch, me, 'replying to myself', parent); // own reply
    await db
      .insertInto('messenger_reactions')
      .values({ message_id: parent, user_id: me, reaction_key: 'like', created_at: new Date() })
      .execute();

    const notifs = await getNotifications(db, me);
    expect(notifs.filter((n) => n.type === 'reply' || n.type === 'reaction')).toHaveLength(0);
  });
});

describe('mark read', () => {
  itWrite('markNotificationRead flips a single notification to read', async () => {
    const me = await mkUser('Recipient');
    const actor = await mkUser('Replier');
    const ch = await mkChannel('Group D', [me, actor]);
    const parent = await mkMessage(ch, me, 'my comment');
    await mkMessage(ch, actor, 'reply', parent);

    let notifs = await getNotifications(db, me);
    const reply = notifs.find((n) => n.type === 'reply')!;
    expect(reply.is_read).toBe(false);

    const ok = await markNotificationRead(db, me, reply.id);
    expect(ok).toBe(true);

    notifs = await getNotifications(db, me);
    expect(notifs.find((n) => n.id === reply.id)!.is_read).toBe(true);
  });

  itWrite('markAllNotificationsRead zeroes the unread count', async () => {
    const me = await mkUser('Recipient');
    const actor = await mkUser('Replier');
    const ch = await mkChannel('Group E', [me, actor]);
    const parent = await mkMessage(ch, me, 'my comment');
    await mkMessage(ch, actor, 'reply', parent);

    expect(await getUnreadNotificationCount(db, me)).toBeGreaterThan(0);
    const ok = await markAllNotificationsRead(db, me);
    expect(ok).toBe(true);
    expect(await getUnreadNotificationCount(db, me)).toBe(0);
  });
});
