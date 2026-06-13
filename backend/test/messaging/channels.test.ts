/**
 * test/messaging/channels.test.ts
 *
 * Integration tests for channels.ts + members.ts (Kysely port, Task 1.3).
 *
 * Targets the real bom_prd DB.  Connection mirrors users.test.ts:
 *   MYSQL_HOST / MYSQL_PORT / MYSQL_DB — from backend/.env (dotenv auto-loaded)
 *   MYSQL_WRITE_USER     — writable user (falls back to MYSQL_USER)
 *   MYSQL_WRITE_PASSWORD — writable password (falls back to MYSQL_PASSWORD)
 *
 * Write tests (INSERT/UPDATE/DELETE) are guarded with `itWrite()` and
 * automatically skip when only a read-only user is present, reporting BLOCKED.
 * Read-only assertions (e.g. getChannel returns null for a missing URL) run live.
 */

import 'dotenv/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import {
  getChannel,
  getMyChannels,
  getPublicChannels,
  createChannel,
  findDistinctChannel,
  updateChannelMetadata,
} from '../../src/messaging/channels.js';
import {
  getChannelMembers,
  addUserToChannel,
  removeUserFromChannel,
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
    // Delete members first (FK constraint)
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
  await db
    .insertInto('messenger_users')
    .values({ user_id: userId, nickname })
    .execute();
  return userId;
}

async function seedChannel(
  opts: Partial<{
    custom_type: 'private' | 'public' | 'open' | 'solo' | 'DM';
    name: string;
    lang: string;
    metadata: string;
  }> = {},
): Promise<string> {
  const channelUrl = newChannelUrl();
  await db
    .insertInto('messenger_channels')
    .values({
      channel_url: channelUrl,
      name: opts.name ?? 'Test Channel',
      custom_type: opts.custom_type ?? 'public',
      lang: opts.lang ?? 'en',
      metadata: opts.metadata ?? null,
    })
    .execute();
  return channelUrl;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  db = buildWriteDb();

  // Probe: can we reach the DB?
  try {
    await db.selectFrom('messenger_channels').select('channel_url').limit(1).execute();
  } catch (err) {
    console.warn('\n⚠  BLOCKED: cannot reach messenger_channels —', String(err));
    await db.destroy();
    return;
  }

  // Probe: do we have write access?
  const probeUrl = `test_probe_ch_${nanoid(8)}`;
  try {
    await db
      .insertInto('messenger_channels')
      .values({ channel_url: probeUrl, name: 'probe', custom_type: 'public' })
      .execute();
    await db
      .deleteFrom('messenger_channels')
      .where('channel_url', '=', probeUrl)
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

// ─── getChannel ───────────────────────────────────────────────────────────────

describe('getChannel', () => {
  it('returns null for an unknown channel_url', async () => {
    const result = await getChannel(db, `test_nonexistent_${nanoid(8)}`);
    expect(result).toBeNull();
  });

  itWrite('returns a ChannelDTO with the correct shape', async () => {
    const channelUrl = await seedChannel({
      name: 'My Channel',
      custom_type: 'public',
      lang: 'en',
      metadata: JSON.stringify({ topic: 'scripture' }),
    });

    const dto = await getChannel(db, channelUrl);

    expect(dto).not.toBeNull();
    expect(dto!.channel_url).toBe(channelUrl);
    expect(dto!.name).toBe('My Channel');
    expect(dto!.custom_type).toBe('public');
    expect(dto!.lang).toBe('en');
    expect(dto!.cover_url).toBe('');
    expect(typeof dto!.created_at).toBe('number');
    expect(dto!.created_at).toBeGreaterThan(0);
    expect(dto!.unread_message_count).toBe(0); // stubbed
    expect(dto!.last_message).toBeNull(); // no messages yet
    expect(Array.isArray(dto!.members)).toBe(true);
    expect(typeof dto!.member_count).toBe('number');

    // metadata round-trip
    expect(dto!.metadata).toEqual({ topic: 'scripture' });

    // data is JSON.stringify(metadata)
    expect(typeof dto!.data).toBe('string');
    const parsedData = JSON.parse(dto!.data) as Record<string, unknown>;
    expect(parsedData).toEqual({ topic: 'scripture' });
  });

  itWrite('data field is {} when metadata is null', async () => {
    const channelUrl = await seedChannel();
    const dto = await getChannel(db, channelUrl);
    expect(dto).not.toBeNull();
    expect(dto!.metadata).toBeNull();
    expect(JSON.parse(dto!.data)).toEqual({});
  });

  itWrite('members are included in the ChannelDTO', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser('Alice');

    await db
      .insertInto('messenger_members')
      .values({ channel_url: channelUrl, user_id: userId, role: 'member', state: 'joined' })
      .execute();

    const dto = await getChannel(db, channelUrl);
    expect(dto).not.toBeNull();
    expect(dto!.member_count).toBe(1);
    expect(dto!.members).toHaveLength(1);
    expect(dto!.members[0]!.user_id).toBe(userId);
    expect(dto!.members[0]!.nickname).toBe('Alice');
    expect(dto!.members[0]!.role).toBe('member');
    expect(dto!.members[0]!.state).toBe('joined');
    expect(typeof dto!.members[0]!.is_muted).toBe('boolean');
    expect(typeof dto!.members[0]!.is_online).toBe('boolean');
    expect(typeof dto!.members[0]!.is_bot).toBe('boolean');
  });

  itWrite('member_count reflects the number of members', async () => {
    const channelUrl = await seedChannel();
    const u1 = await seedUser('User1');
    const u2 = await seedUser('User2');

    await db
      .insertInto('messenger_members')
      .values([
        { channel_url: channelUrl, user_id: u1, role: 'operator', state: 'joined' },
        { channel_url: channelUrl, user_id: u2, role: 'member', state: 'joined' },
      ])
      .execute();

    const dto = await getChannel(db, channelUrl);
    expect(dto!.member_count).toBe(2);
    expect(dto!.members).toHaveLength(2);
  });
});

// ─── createChannel ────────────────────────────────────────────────────────────

describe('createChannel', () => {
  itWrite('creates a channel with members and returns ChannelDTO', async () => {
    const u1 = await seedUser('Operator');
    const u2 = await seedUser('Member');

    const dto = await createChannel(db, {
      name: 'New Channel',
      customType: 'private',
      userIds: [u1, u2],
      operatorIds: [u1],
      lang: 'en',
      metadata: { color: 'blue' },
    });

    // Track the channel for cleanup
    trackedChannels.push(dto.channel_url);

    expect(typeof dto.channel_url).toBe('string');
    expect(dto.name).toBe('New Channel');
    expect(dto.custom_type).toBe('private');
    expect(dto.lang).toBe('en');
    expect(dto.member_count).toBe(2);
    expect(dto.members).toHaveLength(2);

    const operator = dto.members.find((m) => m.user_id === u1);
    const member = dto.members.find((m) => m.user_id === u2);
    expect(operator).toBeDefined();
    expect(member).toBeDefined();
    expect(operator!.role).toBe('operator');
    expect(member!.role).toBe('member');

    expect(dto.metadata).toEqual({ color: 'blue' });
    expect(JSON.parse(dto.data)).toEqual({ color: 'blue' });
  });

  itWrite('respects a custom channelUrl when provided', async () => {
    const customUrl = `test_custom_${nanoid(8)}`;
    trackedChannels.push(customUrl);
    const u1 = await seedUser('Solo');

    const dto = await createChannel(db, {
      channelUrl: customUrl,
      name: 'Custom URL Channel',
      customType: 'solo',
      userIds: [u1],
      operatorIds: [u1],
    });

    expect(dto.channel_url).toBe(customUrl);
  });

  itWrite('isDistinct reuses an existing DM for the same member pair', async () => {
    const u1 = await seedUser('DM-A');
    const u2 = await seedUser('DM-B');

    const first = await createChannel(db, {
      name: 'DM A-B',
      customType: 'DM',
      userIds: [u1, u2],
      operatorIds: [u1],
      isDistinct: true,
    });
    trackedChannels.push(first.channel_url);

    // A second distinct create for the same pair must NOT mint a new channel.
    const second = await createChannel(db, {
      name: 'DM A-B again',
      customType: 'DM',
      userIds: [u1, u2],
      operatorIds: [u1],
      isDistinct: true,
    });

    expect(second.channel_url).toBe(first.channel_url);

    // Only one DM channel should exist for the pair.
    const dms = await getMyChannels(db, u1, { customTypes: ['DM'] });
    const pairDms = dms.filter(
      (c) =>
        c.members.length === 2 &&
        c.members.some((m) => m.user_id === u2),
    );
    expect(pairDms).toHaveLength(1);
  });

  itWrite('isDistinct ignores a forced channelUrl and dedupes anyway', async () => {
    const u1 = await seedUser('DM-C');
    const u2 = await seedUser('DM-D');

    const first = await createChannel(db, {
      name: 'DM C-D',
      customType: 'DM',
      userIds: [u1, u2],
      operatorIds: [u1],
      isDistinct: true,
    });
    trackedChannels.push(first.channel_url);

    const second = await createChannel(db, {
      channelUrl: `test_forced_${nanoid(8)}`,
      name: 'DM C-D forced',
      customType: 'DM',
      userIds: [u1, u2],
      operatorIds: [u1],
      isDistinct: true,
    });

    expect(second.channel_url).toBe(first.channel_url);
  });

  itWrite('findDistinctChannel matches only on the exact member set', async () => {
    const u1 = await seedUser('DM-E');
    const u2 = await seedUser('DM-F');
    const u3 = await seedUser('DM-G');

    const pair = await createChannel(db, {
      name: 'DM E-F',
      customType: 'DM',
      userIds: [u1, u2],
      operatorIds: [u1],
      isDistinct: true,
    });
    trackedChannels.push(pair.channel_url);

    // Same pair (order-independent) → match.
    const match = await findDistinctChannel(db, 'DM', [u2, u1]);
    expect(match?.channel_url).toBe(pair.channel_url);

    // Different member set (adds u3) → no match.
    const noMatch = await findDistinctChannel(db, 'DM', [u1, u2, u3]);
    expect(noMatch).toBeNull();
  });
});

// ─── updateChannelMetadata ────────────────────────────────────────────────────

describe('updateChannelMetadata', () => {
  itWrite('updates metadata and returns true', async () => {
    const channelUrl = await seedChannel();

    const ok = await updateChannelMetadata(db, channelUrl, { updated: true });
    expect(ok).toBe(true);

    const dto = await getChannel(db, channelUrl);
    expect(dto!.metadata).toEqual({ updated: true });
    expect(JSON.parse(dto!.data)).toEqual({ updated: true });
  });

  it('returns false for a non-existent channel', async () => {
    if (!canWrite) {
      console.warn('  ↳ SKIPPED (no write access): returns false for a non-existent channel');
      return;
    }
    const ok = await updateChannelMetadata(db, `test_ghost_${nanoid(8)}`, { x: 1 });
    expect(ok).toBe(false);
  });
});

// ─── getMyChannels ────────────────────────────────────────────────────────────

describe('getMyChannels', () => {
  itWrite('returns channels the user has joined', async () => {
    const userId = await seedUser('MyChannelsUser');
    const ch1 = await seedChannel({ name: 'Channel 1' });
    const ch2 = await seedChannel({ name: 'Channel 2' });
    const ch3 = await seedChannel({ name: 'Channel 3' }); // user not a member

    await db
      .insertInto('messenger_members')
      .values([
        { channel_url: ch1, user_id: userId, role: 'member', state: 'joined' },
        { channel_url: ch2, user_id: userId, role: 'operator', state: 'joined' },
      ])
      .execute();

    const channels = await getMyChannels(db, userId);

    const urls = channels.map((c) => c.channel_url);
    expect(urls).toContain(ch1);
    expect(urls).toContain(ch2);
    expect(urls).not.toContain(ch3);
  });

  itWrite('returns empty array when user has no memberships', async () => {
    const userId = await seedUser('LonelyUser');
    const channels = await getMyChannels(db, userId);
    expect(channels).toEqual([]);
  });

  itWrite('filters by customTypes when provided', async () => {
    const userId = await seedUser('FilterUser');
    const pubCh = await seedChannel({ custom_type: 'public', name: 'Public' });
    const privCh = await seedChannel({ custom_type: 'private', name: 'Private' });

    await db
      .insertInto('messenger_members')
      .values([
        { channel_url: pubCh, user_id: userId, role: 'member', state: 'joined' },
        { channel_url: privCh, user_id: userId, role: 'member', state: 'joined' },
      ])
      .execute();

    const filtered = await getMyChannels(db, userId, { customTypes: ['public'] });
    const urls = filtered.map((c) => c.channel_url);
    expect(urls).toContain(pubCh);
    expect(urls).not.toContain(privCh);
  });
});

// ─── getPublicChannels ────────────────────────────────────────────────────────

describe('getPublicChannels', () => {
  itWrite('returns public and open channels by default', async () => {
    const pubCh = await seedChannel({ custom_type: 'public', name: 'Public Channel' });
    const openCh = await seedChannel({ custom_type: 'open', name: 'Open Channel' });
    const privCh = await seedChannel({ custom_type: 'private', name: 'Private Channel' });

    const channels = await getPublicChannels(db);
    const urls = channels.map((c) => c.channel_url);
    expect(urls).toContain(pubCh);
    expect(urls).toContain(openCh);
    expect(urls).not.toContain(privCh);
  });

  itWrite('filters by lang when provided', async () => {
    const enCh = await seedChannel({ custom_type: 'public', name: 'English', lang: 'en' });
    const esCh = await seedChannel({ custom_type: 'public', name: 'Spanish', lang: 'es' });

    const enChannels = await getPublicChannels(db, { lang: 'en' });
    const enUrls = enChannels.map((c) => c.channel_url);
    expect(enUrls).toContain(enCh);
    expect(enUrls).not.toContain(esCh);
  });
});

// ─── getChannelMembers ────────────────────────────────────────────────────────

describe('getChannelMembers', () => {
  itWrite('returns all members with correct roles and states', async () => {
    const channelUrl = await seedChannel();
    const op = await seedUser('Operator');
    const mem = await seedUser('Member');

    await db
      .insertInto('messenger_members')
      .values([
        { channel_url: channelUrl, user_id: op, role: 'operator', state: 'joined' },
        { channel_url: channelUrl, user_id: mem, role: 'member', state: 'invited' },
      ])
      .execute();

    const members = await getChannelMembers(db, channelUrl);
    expect(members).toHaveLength(2);

    const opMember = members.find((m) => m.user_id === op);
    const memMember = members.find((m) => m.user_id === mem);

    expect(opMember!.role).toBe('operator');
    expect(opMember!.state).toBe('joined');
    expect(memMember!.role).toBe('member');
    expect(memMember!.state).toBe('invited');
  });

  itWrite('returns empty array for a channel with no members', async () => {
    const channelUrl = await seedChannel();
    const members = await getChannelMembers(db, channelUrl);
    expect(members).toEqual([]);
  });

  itWrite('is_muted is a boolean', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser('MutedUser');

    await db
      .insertInto('messenger_members')
      .values({ channel_url: channelUrl, user_id: userId, role: 'member', state: 'joined', is_muted: 1 })
      .execute();

    const members = await getChannelMembers(db, channelUrl);
    expect(members).toHaveLength(1);
    expect(typeof members[0]!.is_muted).toBe('boolean');
    expect(members[0]!.is_muted).toBe(true);
  });
});

// ─── addUserToChannel / removeUserFromChannel ─────────────────────────────────

describe('addUserToChannel', () => {
  itWrite('adds a user and returns true', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser('Joiner');

    const ok = await addUserToChannel(db, channelUrl, userId);
    expect(ok).toBe(true);

    const members = await getChannelMembers(db, channelUrl);
    expect(members.map((m) => m.user_id)).toContain(userId);
  });

  itWrite('returns false on duplicate (already a member)', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser('DupeUser');

    await addUserToChannel(db, channelUrl, userId);
    const second = await addUserToChannel(db, channelUrl, userId);
    expect(second).toBe(false);

    // Still only one membership row
    const members = await getChannelMembers(db, channelUrl);
    expect(members.filter((m) => m.user_id === userId)).toHaveLength(1);
  });

  itWrite('assigns the operator role when requested', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser('NewOperator');

    await addUserToChannel(db, channelUrl, userId, 'operator');

    const members = await getChannelMembers(db, channelUrl);
    const m = members.find((m) => m.user_id === userId);
    expect(m!.role).toBe('operator');
  });
});

describe('removeUserFromChannel', () => {
  itWrite('removes a member and returns true', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser('Leaver');

    await addUserToChannel(db, channelUrl, userId);
    const ok = await removeUserFromChannel(db, channelUrl, userId);
    expect(ok).toBe(true);

    const members = await getChannelMembers(db, channelUrl);
    expect(members.map((m) => m.user_id)).not.toContain(userId);
  });

  itWrite('returns false when the user is not a member', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser('NotAMember');

    const ok = await removeUserFromChannel(db, channelUrl, userId);
    expect(ok).toBe(false);
  });
});
