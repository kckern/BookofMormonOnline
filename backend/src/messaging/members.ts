/**
 * messaging/members.ts — Kysely port of Messenger membership operations
 * (src/library/messenger.ts:351-392).
 *
 * Accepts `db: Kysely<DB>` so callers (channels.ts, socket handlers, tests)
 * supply their own connection.
 *
 * is_muted: TINYINT(1); coerce to boolean.
 * role/state: ENUM columns; mysql2 returns them as strings — cast via 'as'.
 * created_at: DATETIME; returned as ms-epoch number.
 */

import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { MemberDTO } from './dto.js';
import { getUsers } from './users.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

type RawMember = {
  channel_url: string;
  user_id: string;
  role: 'operator' | 'member';
  state: 'joined' | 'invited' | 'requested' | 'banned';
  is_muted: number | null;
  last_read_at: Date | null;
  created_at: Date | null;
};

/**
 * Parse the messenger_channels.metadata JSON column. mysql2 may deliver it
 * pre-parsed (object) or as a string — mirrors parseMetadata in channels.ts
 * (kept local to avoid a members ⇄ channels import cycle).
 */
function parseChannelMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return all members of a channel as MemberDTOs.
 * Assembles the UserDTO portion via getUsers() from users.ts.
 */
/**
 * getPublicUserIds — of the given messenger user_ids, return the set that are
 * "public": a joined member of at least one public/open channel.
 *
 * This is the live, code-owned definition of user visibility, replacing the
 * read-only-and-unmaintained bom_user.visibility column. A user becomes public
 * by being in a public group and stops being public when they leave it — which
 * is the product's actual model. Used to decide leaderboard masking.
 */
export async function getPublicUserIds(
  db: Kysely<DB>,
  userIds: string[],
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await db
    .selectFrom('messenger_members as m')
    .innerJoin('messenger_channels as c', 'c.channel_url', 'm.channel_url')
    .select('m.user_id as user_id')
    .distinct()
    .where('m.user_id', 'in', userIds)
    .where('m.state', '=', 'joined')
    .where('c.custom_type', 'in', ['public', 'open'])
    .execute();
  return new Set(rows.map((r) => r.user_id));
}

export async function getChannelMembers(
  db: Kysely<DB>,
  channelUrl: string,
  options: { includeBanned?: boolean } = {},
): Promise<MemberDTO[]> {
  let query = db
    .selectFrom('messenger_members')
    .select(['channel_url', 'user_id', 'role', 'state', 'is_muted', 'last_read_at', 'created_at'])
    .where('channel_url', '=', channelUrl);

  // Banned rows are hidden from every normal roster/count/operator-gate by
  // default (spec §2). Only the admin Banned section opts in.
  if (!options.includeBanned) {
    query = query.where('state', '!=', 'banned');
  }

  const rows = await query.execute();

  if (rows.length === 0) return [];

  const userIds = rows.map((r) => r.user_id);
  const users = await getUsers(db, userIds);
  const userMap = new Map(users.map((u) => [u.user_id, u]));

  const members: MemberDTO[] = [];
  for (const row of rows as RawMember[]) {
    const user = userMap.get(row.user_id);
    if (!user) continue; // orphaned membership — skip
    members.push({
      ...user,
      role: row.role,
      state: row.state,
      is_muted: Boolean(row.is_muted),
    });
  }
  return members;
}

/**
 * Bulk variant of getChannelMembers for MANY channels: one members query +
 * one getUsers() for every member across all channels. Returns a Map
 * channel_url → MemberDTO[]. Eliminates the per-channel member N+1 in the
 * channel-list / homefeed assembly.
 */
export async function getChannelMembersBulk(
  db: Kysely<DB>,
  channelUrls: string[],
): Promise<Map<string, MemberDTO[]>> {
  const result = new Map<string, MemberDTO[]>();
  if (channelUrls.length === 0) return result;

  // Banned rows hidden by default — same contract as getChannelMembers.
  const rows = (await db
    .selectFrom('messenger_members')
    .select(['channel_url', 'user_id', 'role', 'state', 'is_muted', 'last_read_at', 'created_at'])
    .where('channel_url', 'in', channelUrls)
    .where('state', '!=', 'banned')
    .execute()) as RawMember[];

  if (rows.length === 0) return result;

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const users = await getUsers(db, userIds);
  const userMap = new Map(users.map((u) => [u.user_id, u]));

  for (const row of rows) {
    const user = userMap.get(row.user_id);
    if (!user) continue; // orphaned membership
    const arr = result.get(row.channel_url) ?? [];
    arr.push({ ...user, role: row.role, state: row.state, is_muted: Boolean(row.is_muted) });
    result.set(row.channel_url, arr);
  }
  return result;
}

/**
 * canUserInvite — invite-authorization gate (spec §1, social hardening):
 *   - operators may always invite;
 *   - joined members may invite only when channel metadata
 *     `membersCanInvite === true`;
 *   - everyone else (non-members, invited/requested/banned rows) may not.
 */
export async function canUserInvite(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
): Promise<boolean> {
  if (!channelUrl || !userId) return false;

  const member = await db
    .selectFrom('messenger_members')
    .select(['role', 'state'])
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!member) return false;
  if (member.role === 'operator') return true;
  if (member.state !== 'joined') return false;

  const channel = await db
    .selectFrom('messenger_channels')
    .select('metadata')
    .where('channel_url', '=', channelUrl)
    .executeTakeFirst();

  const metadata = parseChannelMetadata(channel?.metadata);
  return metadata?.['membersCanInvite'] === true;
}

/** Set/unset a member's muted flag. Returns true if a row was updated. */
export async function setMemberMuted(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
  muted: boolean,
): Promise<boolean> {
  const result = await db
    .updateTable('messenger_members')
    .set({ is_muted: muted ? 1 : 0 })
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

export interface Membership {
  role: 'operator' | 'member';
  state: 'joined' | 'invited' | 'requested' | 'banned';
  is_muted: boolean;
}

/** Single-row membership lookup — the write-authz primitive. null = no row. */
export async function getMembership(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
): Promise<Membership | null> {
  const row = await db
    .selectFrom('messenger_members')
    .select(['role', 'state', 'is_muted'])
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!row) return null;
  return {
    role: row.role as Membership['role'],
    state: row.state as Membership['state'],
    is_muted: Boolean(row.is_muted),
  };
}

/** True when the member is currently muted in the channel. */
export async function isMemberMuted(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
): Promise<boolean> {
  const row = await db
    .selectFrom('messenger_members')
    .select('is_muted')
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return Boolean(row?.is_muted);
}

/**
 * Add a user to a channel.
 * Returns false when a membership row already exists in ANY state — including
 * 'banned' (re-entry guard, spec §2: a banned row must never be overwritten by
 * a join) — rather than throwing.
 * state is always 'joined' when called directly (invitation flows are higher-level).
 */
export async function addUserToChannel(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
  role: 'operator' | 'member' = 'member',
): Promise<boolean> {
  // Explicit pre-check: an existing row (joined/invited/requested/banned)
  // blocks the join. The PK would reject the insert anyway, but the explicit
  // check documents the banned re-entry guard and never mutates the row.
  const existing = await db
    .selectFrom('messenger_members')
    .select('state')
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (existing) return false;

  try {
    await db
      .insertInto('messenger_members')
      .values({
        channel_url: channelUrl,
        user_id: userId,
        role,
        state: 'joined',
      })
      .execute();
    return true;
  } catch {
    // Duplicate-key constraint (channel_url + user_id PK) → already a member
    // (race between the pre-check and the insert)
    return false;
  }
}

/**
 * Ban a user from a channel (spec §2). Upserts the membership row to
 * state='banned' AND role='member' in one statement — the role demotion is
 * mandatory: requireOperator and canUserInvite check role without state, so a
 * banned former operator would otherwise retain admin/invite rights.
 * Returns false when the messenger user does not exist (FK) or the write fails.
 */
export async function banUserFromChannel(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
): Promise<boolean> {
  try {
    await db
      .insertInto('messenger_members')
      .values({
        channel_url: channelUrl,
        user_id: userId,
        role: 'member',
        state: 'banned',
      })
      .onDuplicateKeyUpdate({ role: 'member', state: 'banned' })
      .execute();
    return true;
  } catch (err) {
    console.error('banUserFromChannel error:', err);
    return false;
  }
}

/**
 * Unban a user: delete the membership row ONLY when state='banned'.
 * (Never deletes a joined/invited/requested row — unban is not a kick.)
 * Returns true when a banned row was removed; the user may then rejoin.
 */
export async function unbanUserFromChannel(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .deleteFrom('messenger_members')
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .where('state', '=', 'banned')
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

/** True when the user has a state='banned' membership row in the channel. */
export async function isUserBanned(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
): Promise<boolean> {
  const row = await db
    .selectFrom('messenger_members')
    .select('state')
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return row?.state === 'banned';
}

/**
 * Accept a channel invitation: transition state 'invited' → 'joined'.
 * The WHERE state='invited' clause is the explicit re-entry guard — a
 * 'banned' (or 'requested'/'joined') row never transitions (spec §2:
 * acceptInvitation is an UPDATE path, so the duplicate-key skip that protects
 * the insert paths does not apply here).
 * Returns true when an invited row was transitioned.
 */
export async function acceptChannelInvitation(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .updateTable('messenger_members')
    .set({ state: 'joined' })
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .where('state', '=', 'invited')
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

/**
 * Remove a user from a channel — deletes the row REGARDLESS OF STATE,
 * including 'banned'.
 *
 * This is the OPERATOR KICK path only (messengerRemoveMember with an operator
 * actor). It and unbanUserFromChannel must stay the only ways a banned row
 * dies: every self-service delete (leave, decline-invitation, withdraw-request,
 * deny-request) must use the state-scoped variants below, or a banned user
 * could delete their own ban row and simply rejoin (spec §2 ban escape).
 *
 * Returns true if a row was deleted, false if the user was not a member.
 */
export async function removeUserFromChannel(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .deleteFrom('messenger_members')
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return Number(result.numDeletedRows) > 0;
}

/**
 * Self-service "leave": delete the membership row UNLESS it is banned.
 * A banned user leaving must NOT delete the ban row — that would be a ban
 * escape (delete + rejoin). Returns true when a non-banned row was deleted.
 */
export async function removeUserFromChannelUnlessBanned(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .deleteFrom('messenger_members')
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .where('state', '!=', 'banned')
    .executeTakeFirst();

  return Number(result.numDeletedRows) > 0;
}

/**
 * Delete the membership row ONLY when it is in the given state — the
 * state-scoped delete for single-purpose paths: declineInvitation ('invited'),
 * withdrawRequest / processRequest-deny ('requested'). A row in any other
 * state — banned above all — survives. Returns true when a row was deleted.
 */
export async function deleteMembershipRowInState(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
  state: 'joined' | 'invited' | 'requested' | 'banned',
): Promise<boolean> {
  const result = await db
    .deleteFrom('messenger_members')
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .where('state', '=', state)
    .executeTakeFirst();

  return Number(result.numDeletedRows) > 0;
}
