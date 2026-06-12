/**
 * test/messaging/inviteAuth.test.ts
 *
 * Invite-authorization tests for canUserInvite() (Task 1 of
 * docs/plans/2026-06-12-social-hardening.md; spec §1).
 *
 * Authorization contract:
 *   - operators may always invite
 *   - joined members may invite only when channel metadata membersCanInvite === true
 *   - everyone else (non-members, invited/requested/banned rows) may not
 *
 * Targets the real bom_prd DB; seeding/cleanup pattern mirrors messages.test.ts.
 * Tests skip (BLOCKED) when only a read-only user is available.
 */

import 'dotenv/config';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { canUserInvite } from '../../src/messaging/members.js';
import { updateChannelMetadataKey } from '../../src/messaging/channels.js';

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

/**
 * Seed a channel (with optional metadata) and one user; optionally insert a
 * membership row with the given role/state.
 */
async function seedScenario(opts: {
  metadata?: Record<string, unknown>;
  member?: {
    role: 'operator' | 'member';
    state: 'joined' | 'invited' | 'requested' | 'banned';
  };
}): Promise<{ channelUrl: string; userId: string }> {
  const channelUrl = newChannelUrl();
  const userId = newUserId();

  await db
    .insertInto('messenger_channels')
    .values({
      channel_url: channelUrl,
      name: 'Invite Auth Test Channel',
      custom_type: 'private',
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
    })
    .execute();
  await db
    .insertInto('messenger_users')
    .values({ user_id: userId, nickname: 'InviteTester' })
    .execute();

  if (opts.member) {
    await db
      .insertInto('messenger_members')
      .values({
        channel_url: channelUrl,
        user_id: userId,
        role: opts.member.role,
        state: opts.member.state,
      })
      .execute();
  }

  return { channelUrl, userId };
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

// ─── canUserInvite ────────────────────────────────────────────────────────────

describe('canUserInvite', () => {
  itWrite('operator → true (regardless of membersCanInvite flag)', async () => {
    const { channelUrl, userId } = await seedScenario({
      member: { role: 'operator', state: 'joined' },
    });
    expect(await canUserInvite(db, channelUrl, userId)).toBe(true);
  });

  itWrite('joined member without the flag → false', async () => {
    const { channelUrl, userId } = await seedScenario({
      member: { role: 'member', state: 'joined' },
    });
    expect(await canUserInvite(db, channelUrl, userId)).toBe(false);
  });

  itWrite('joined member + membersCanInvite flag → true', async () => {
    const { channelUrl, userId } = await seedScenario({
      metadata: { membersCanInvite: true },
      member: { role: 'member', state: 'joined' },
    });
    expect(await canUserInvite(db, channelUrl, userId)).toBe(true);
  });

  itWrite('non-member + membersCanInvite flag → false', async () => {
    const { channelUrl, userId } = await seedScenario({
      metadata: { membersCanInvite: true },
      // no membership row
    });
    expect(await canUserInvite(db, channelUrl, userId)).toBe(false);
  });

  itWrite('banned member + membersCanInvite flag → false', async () => {
    const { channelUrl, userId } = await seedScenario({
      metadata: { membersCanInvite: true },
      member: { role: 'member', state: 'banned' },
    });
    expect(await canUserInvite(db, channelUrl, userId)).toBe(false);
  });
});

// ─── updateChannelMetadataKey ─────────────────────────────────────────────────

describe('updateChannelMetadataKey', () => {
  itWrite(
    'merges the key into existing metadata (preserving other keys) and flips canUserInvite',
    async () => {
      const { channelUrl, userId } = await seedScenario({
        metadata: { lang: 'en' },
        member: { role: 'member', state: 'joined' },
      });

      // No flag yet → member cannot invite
      expect(await canUserInvite(db, channelUrl, userId)).toBe(false);

      const updated = await updateChannelMetadataKey(
        db,
        channelUrl,
        'membersCanInvite',
        true,
      );
      expect(updated).toBe(true);

      // Existing keys preserved, new key present
      const row = await db
        .selectFrom('messenger_channels')
        .select('metadata')
        .where('channel_url', '=', channelUrl)
        .executeTakeFirst();
      const metadata =
        typeof row?.metadata === 'string'
          ? (JSON.parse(row.metadata) as Record<string, unknown>)
          : ((row?.metadata ?? {}) as Record<string, unknown>);
      expect(metadata['lang']).toBe('en');
      expect(metadata['membersCanInvite']).toBe(true);

      // Flag now grants invite ability to the joined member
      expect(await canUserInvite(db, channelUrl, userId)).toBe(true);
    },
  );

  itWrite('returns false for a nonexistent channel', async () => {
    expect(
      await updateChannelMetadataKey(db, `test_ch_missing_${nanoid(8)}`, 'membersCanInvite', true),
    ).toBe(false);
  });
});
