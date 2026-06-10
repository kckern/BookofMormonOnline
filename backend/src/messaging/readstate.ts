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
