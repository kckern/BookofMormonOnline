/**
 * readstate.ts — Kysely port of Messenger read-state / unread methods
 * (src/library/messenger.ts:677-721).
 *
 * Accepts `db: Kysely<DB>` — no module-level singleton.
 *
 * markAsRead / markChannelAsRead: UPDATE messenger_members.last_read_at = NOW()
 * for the given (channel_url, user_id) pair. Both names are exported for
 * backward-compatible call-site aliasing; they execute identically.
 *
 * getUnreadCount: count top-level, non-deleted messages in the channel posted
 * after last_read_at by someone other than the requesting user (mirrors legacy
 * exactly — own messages are excluded from the unread count).
 * Returns 0 when the member row is absent or last_read_at is NULL.
 *
 * getUnreadCounts: bulk variant of getUnreadCount — one query for all channels.
 * Returns a Map<channelUrl, count>. Channels with no member row or NULL
 * last_read_at for this user map to 0 (same semantics as the single-channel
 * version). Use this in assembleChannels to replace the 2×N per-channel queries
 * with a single JOIN query (M-6 fix).
 */

import { type Kysely, sql } from 'kysely';
import type { DB } from '../../codegen/db.js';

// ─── markAsRead ───────────────────────────────────────────────────────────────

/**
 * Stamp last_read_at = NOW() for (channelUrl, userId).
 * Returns true if a member row was found and updated.
 */
export async function markAsRead(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .updateTable('messenger_members')
    .set({ last_read_at: sql<Date>`NOW()` })
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return Number(result.numUpdatedRows) > 0;
}

/**
 * Alias for markAsRead — legacy code exposes both names.
 */
export const markChannelAsRead = markAsRead;

// ─── getUnreadCount ───────────────────────────────────────────────────────────

/**
 * Count top-level, non-deleted messages in a channel posted after the user's
 * last_read_at by someone other than the user themselves.
 *
 * Mirrors legacy messenger.ts:706 exactly:
 *   - own messages (user_id = userId) are NOT counted as unread
 *   - threaded replies (parent_message_id IS NOT NULL) are excluded
 *   - soft-deleted messages (is_deleted = 1) are excluded
 *   - returns 0 when the member row is absent or last_read_at is NULL
 */
export async function getUnreadCount(
  db: Kysely<DB>,
  channelUrl: string,
  userId: string,
): Promise<number> {
  // Step 1: fetch the member's last_read_at
  const member = await db
    .selectFrom('messenger_members')
    .select('last_read_at')
    .where('channel_url', '=', channelUrl)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!member || !member.last_read_at) return 0;

  const lastReadAt = member.last_read_at;

  // Step 2: count qualifying messages
  const result = await db
    .selectFrom('messenger_messages')
    .select((eb) => eb.fn.countAll<string>().as('cnt'))
    .where('channel_url', '=', channelUrl)
    .where('created_at', '>', lastReadAt)
    .where('user_id', '!=', userId)
    .where('parent_message_id', 'is', null)
    .where((eb) => eb.or([eb('is_deleted', 'is', null), eb('is_deleted', '=', 0)]))
    .executeTakeFirst();

  return Number(result?.cnt ?? 0);
}

// ─── getUnreadCounts (bulk) ───────────────────────────────────────────────────

/**
 * Bulk variant of getUnreadCount for multiple channels in a single round-trip.
 *
 * Semantics match getUnreadCount exactly:
 *   - own messages (user_id = userId) are NOT counted as unread
 *   - threaded replies (parent_message_id IS NOT NULL) are excluded
 *   - soft-deleted messages (is_deleted = 1) are excluded
 *   - channels with no member row or NULL last_read_at for this user → 0
 *
 * Implementation: JOIN messenger_members (for last_read_at per channel) with
 * messenger_messages (for qualifying messages), GROUP BY channel_url. A single
 * SQL query replaces 2×N per-channel queries from assembleChannels (M-6 fix).
 *
 * Returns a Map<channelUrl, count>. Every input channelUrl is present in the
 * result (missing entries from the DB are filled with 0).
 */
export async function getUnreadCounts(
  db: Kysely<DB>,
  userId: string,
  channelUrls: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (channelUrls.length === 0) return result;

  // Initialise all requested channels to 0 so callers never see undefined.
  for (const url of channelUrls) result.set(url, 0);

  // Single JOIN query: for each channel where this user has a non-NULL
  // last_read_at, count qualifying messages posted after that timestamp.
  const rows = await db
    .selectFrom('messenger_members as m')
    .innerJoin('messenger_messages as msg', 'msg.channel_url', 'm.channel_url')
    .select((eb) => [
      'm.channel_url',
      eb.fn.count<string>('msg.message_id').as('cnt'),
    ])
    .where('m.channel_url', 'in', channelUrls)
    .where('m.user_id', '=', userId)
    .whereRef('msg.created_at', '>', 'm.last_read_at')
    .where('msg.user_id', '!=', userId)
    .where('msg.parent_message_id', 'is', null)
    .where((eb) =>
      eb.or([eb('msg.is_deleted', 'is', null), eb('msg.is_deleted', '=', 0)]),
    )
    .groupBy('m.channel_url')
    .execute();

  for (const row of rows) {
    result.set(row.channel_url, Number(row.cnt));
  }

  return result;
}
