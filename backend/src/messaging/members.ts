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
  state: 'joined' | 'invited' | 'requested';
  is_muted: number | null;
  last_read_at: Date | null;
  created_at: Date | null;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return all members of a channel as MemberDTOs.
 * Assembles the UserDTO portion via getUsers() from users.ts.
 */
export async function getChannelMembers(
  db: Kysely<DB>,
  channelUrl: string,
): Promise<MemberDTO[]> {
  const rows = await db
    .selectFrom('messenger_members')
    .select(['channel_url', 'user_id', 'role', 'state', 'is_muted', 'last_read_at', 'created_at'])
    .where('channel_url', '=', channelUrl)
    .execute();

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
 * Add a user to a channel.
 * Returns false on duplicate-key (already a member) rather than throwing.
 * state is always 'joined' when called directly (invitation flows are higher-level).
 */
export async function addUserToChannel(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
  role: 'operator' | 'member' = 'member',
): Promise<boolean> {
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
    return false;
  }
}

/**
 * Remove a user from a channel.
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
