/**
 * test/messaging/bans.test.ts
 *
 * Real-ban tests (Task 2 of docs/plans/2026-06-12-social-hardening.md; spec §2).
 *
 * Contract:
 *   - banUserFromChannel upserts the membership row to state='banned' AND
 *     role='member' (a banned former operator must NOT retain operator rights —
 *     requireOperator / canUserInvite check role without state).
 *   - banned rows are EXCLUDED from getChannelMembers / getChannelMembersBulk
 *     by default (rosters, member_count, operator gates); retrievable only via
 *     the explicit { includeBanned: true } option (admin Banned section).
 *   - all re-entry paths refuse: addUserToChannel returns false and leaves the
 *     row banned; acceptChannelInvitation only transitions state='invited'.
 *   - unbanUserFromChannel deletes the row ONLY when state='banned' (a kick
 *     stays a kick; a joined row is never deleted by unban) — after unban the
 *     user may rejoin.
 *
 * Targets the real bom_prd DB; seeding/cleanup mirrors inviteAuth.test.ts /
 * messages.test.ts. Tests skip (BLOCKED) when only a read-only user is available.
 */

import 'dotenv/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import {
  addUserToChannel,
  acceptChannelInvitation,
  banUserFromChannel,
  canUserInvite,
  getChannelMembers,
  getChannelMembersBulk,
  isUserBanned,
  unbanUserFromChannel,
} from '../../src/messaging/members.js';
import { getChannel } from '../../src/messaging/channels.js';

// ─── Write-capable DB instance (mirrors messages.test.ts) ─────────────────────

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

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedChannel(): Promise<string> {
  const channelUrl = newChannelUrl();
  await db
    .insertInto('messenger_channels')
    .values({
      channel_url: channelUrl,
      name: 'Bans Test Channel',
      custom_type: 'private',
    })
    .execute();
  return channelUrl;
}

async function seedUser(): Promise<string> {
  const userId = newUserId();
  await db
    .insertInto('messenger_users')
    .values({ user_id: userId, nickname: 'BanTester' })
    .execute();
  return userId;
}

async function addMemberRow(
  channelUrl: string,
  userId: string,
  role: 'operator' | 'member',
  state: 'joined' | 'invited' | 'requested' | 'banned',
): Promise<void> {
  await db
    .insertInto('messenger_members')
    .values({ channel_url: channelUrl, user_id: userId, role, state })
    .execute();
}

async function getMemberRow(
  channelUrl: string,
  userId: string,
): Promise<{ role: string; state: string } | undefined> {
  return db
    .selectFrom('messenger_members')
    .select(['role', 'state'])
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .executeTakeFirst();
}

// ─── Guard helper (mirrors messages.test.ts itWrite) ──────────────────────────

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

  try {
    await db.selectFrom('messenger_members').select('user_id').limit(1).execute();
  } catch (err) {
    console.warn('\n⚠  BLOCKED: cannot reach messenger_members —', String(err));
    await db.destroy();
    return;
  }

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

// ─── banUserFromChannel ───────────────────────────────────────────────────────

describe('banUserFromChannel', () => {
  itWrite('bans a non-member: inserts a row with state=banned, role=member', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser();

    expect(await banUserFromChannel(db, channelUrl, userId)).toBe(true);

    const row = await getMemberRow(channelUrl, userId);
    expect(row).toEqual({ role: 'member', state: 'banned' });
  });

  itWrite(
    'bans a joined OPERATOR: upsert flips state→banned AND role→member, so operator-gated actions fail',
    async () => {
      const channelUrl = await seedChannel();
      const userId = await seedUser();
      await addMemberRow(channelUrl, userId, 'operator', 'joined');

      expect(await banUserFromChannel(db, channelUrl, userId)).toBe(true);

      // Row demoted in the same upsert (REVIEWER-MANDATED: requireOperator and
      // canUserInvite check role without state).
      const row = await getMemberRow(channelUrl, userId);
      expect(row).toEqual({ role: 'member', state: 'banned' });

      // requireOperator-equivalent check over the default member list: the
      // banned ex-operator must NOT pass the operator gate.
      const members = await getChannelMembers(db, channelUrl);
      const passesOperatorGate = members.some(
        (m) => m.user_id === userId && m.role === 'operator',
      );
      expect(passesOperatorGate).toBe(false);

      // ...and cannot invite either.
      expect(await canUserInvite(db, channelUrl, userId)).toBe(false);
    },
  );

  itWrite('returns false for a user with no messenger_users row (FK)', async () => {
    const channelUrl = await seedChannel();
    expect(await banUserFromChannel(db, channelUrl, `test_u_missing_${nanoid(8)}`)).toBe(false);
  });
});

// ─── Re-entry guards ──────────────────────────────────────────────────────────

describe('re-entry guards', () => {
  itWrite('addUserToChannel on a banned row → false, state stays banned', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser();
    await addMemberRow(channelUrl, userId, 'member', 'banned');

    expect(await addUserToChannel(db, channelUrl, userId)).toBe(false);

    const row = await getMemberRow(channelUrl, userId);
    expect(row).toEqual({ role: 'member', state: 'banned' });
  });

  itWrite('acceptChannelInvitation refuses a banned row (state stays banned)', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser();
    await addMemberRow(channelUrl, userId, 'member', 'banned');

    expect(await acceptChannelInvitation(db, channelUrl, userId)).toBe(false);

    const row = await getMemberRow(channelUrl, userId);
    expect(row?.state).toBe('banned');
  });

  itWrite('acceptChannelInvitation accepts an invited row (positive control)', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser();
    await addMemberRow(channelUrl, userId, 'member', 'invited');

    expect(await acceptChannelInvitation(db, channelUrl, userId)).toBe(true);

    const row = await getMemberRow(channelUrl, userId);
    expect(row?.state).toBe('joined');
  });

  itWrite('isUserBanned: true for banned row; false for joined row and non-member', async () => {
    const channelUrl = await seedChannel();
    const banned = await seedUser();
    const joined = await seedUser();
    const outsider = await seedUser();
    await addMemberRow(channelUrl, banned, 'member', 'banned');
    await addMemberRow(channelUrl, joined, 'member', 'joined');

    expect(await isUserBanned(db, channelUrl, banned)).toBe(true);
    expect(await isUserBanned(db, channelUrl, joined)).toBe(false);
    expect(await isUserBanned(db, channelUrl, outsider)).toBe(false);
  });
});

// ─── unbanUserFromChannel ─────────────────────────────────────────────────────

describe('unbanUserFromChannel', () => {
  itWrite('deletes the banned row; the user may then rejoin', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser();
    await addMemberRow(channelUrl, userId, 'member', 'banned');

    expect(await unbanUserFromChannel(db, channelUrl, userId)).toBe(true);
    expect(await getMemberRow(channelUrl, userId)).toBeUndefined();

    // Re-entry restored
    expect(await addUserToChannel(db, channelUrl, userId)).toBe(true);
    expect((await getMemberRow(channelUrl, userId))?.state).toBe('joined');
  });

  itWrite('returns false and leaves the row intact when state is not banned', async () => {
    const channelUrl = await seedChannel();
    const userId = await seedUser();
    await addMemberRow(channelUrl, userId, 'member', 'joined');

    expect(await unbanUserFromChannel(db, channelUrl, userId)).toBe(false);
    expect((await getMemberRow(channelUrl, userId))?.state).toBe('joined');
  });
});

// ─── Roster filtering ─────────────────────────────────────────────────────────

describe('roster filtering (banned hidden by default)', () => {
  itWrite(
    'getChannelMembers excludes banned rows by default; includeBanned surfaces them',
    async () => {
      const channelUrl = await seedChannel();
      const joined = await seedUser();
      const banned = await seedUser();
      await addMemberRow(channelUrl, joined, 'member', 'joined');
      await addMemberRow(channelUrl, banned, 'member', 'banned');

      const defaults = await getChannelMembers(db, channelUrl);
      expect(defaults.map((m) => m.user_id)).toEqual([joined]);

      const all = await getChannelMembers(db, channelUrl, { includeBanned: true });
      expect(all.map((m) => m.user_id).sort()).toEqual([banned, joined].sort());
      expect(all.find((m) => m.user_id === banned)?.state).toBe('banned');
    },
  );

  itWrite('getChannelMembersBulk excludes banned rows by default', async () => {
    const channelUrl = await seedChannel();
    const joined = await seedUser();
    const banned = await seedUser();
    await addMemberRow(channelUrl, joined, 'member', 'joined');
    await addMemberRow(channelUrl, banned, 'member', 'banned');

    const byChannel = await getChannelMembersBulk(db, [channelUrl]);
    expect((byChannel.get(channelUrl) ?? []).map((m) => m.user_id)).toEqual([joined]);
  });

  itWrite('channel DTO members/member_count exclude banned rows', async () => {
    const channelUrl = await seedChannel();
    const a = await seedUser();
    const b = await seedUser();
    const banned = await seedUser();
    await addMemberRow(channelUrl, a, 'operator', 'joined');
    await addMemberRow(channelUrl, b, 'member', 'joined');
    await addMemberRow(channelUrl, banned, 'member', 'banned');

    const channel = await getChannel(db, channelUrl);
    expect(channel?.member_count).toBe(2);
    expect(channel?.members.map((m) => m.user_id).sort()).toEqual([a, b].sort());
  });
});
