/**
 * messaging/bots/registry.ts — bot membership operations (Task 4.1).
 *
 * Ports addBot / removeBot from src/resolvers/BomCommunity.ts (~:544, ~:561).
 *
 * Design:
 *   - `bot` arg arriving from GraphQL is already the messenger user_id (the
 *     same md5-hashed string passed directly to sendbird.addUserToChannel in
 *     the legacy resolver — no further lookup needed).
 *   - A bot is a messenger_users row with is_bot = 1; to be *pluggable* it
 *     must also be registered in bom_bot as bot_class='study' (enabled).
 *     Membership ops delegate to members.ts (addUserToChannel /
 *     removeUserFromChannel) since bots are ordinary members from the
 *     schema's perspective.
 *   - Role: 'member' (matches legacy — the legacy call passes no role override).
 *
 * All functions accept `db: Kysely<DB>` for explicit injection (consistent with
 * every other messaging service in this package).
 */

import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { UserDTO } from '../dto.js';
import { addUserToChannel, removeUserFromChannel } from '../members.js';
import { getUser } from '../users.js';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Add a bot (identified by its messenger user_id) to a channel.
 *
 * Returns true on success, false when:
 *   - the bot user_id does not exist in messenger_users
 *   - the user exists but is_bot is false (not a bot)
 *   - the bot is already a member of the channel (duplicate-key)
 *   - any DB error
 *
 * Role is always 'member' (mirrors legacy behaviour).
 */
export async function addBotToChannel(
  db: Kysely<DB>,
  channelUrl: string,
  botId: string,
): Promise<boolean> {
  // Validate: the user must exist and be flagged as a bot.
  const user = await getBotUser(db, botId);
  if (!user) return false;

  // Only registered study bots are pluggable — community bots (scheduled
  // persona conversations) and unregistered is_bot rows are rejected.
  const registered = await db
    .selectFrom('bom_bot')
    .select('bot_id')
    .where('bot_id', '=', botId)
    .where('bot_class', '=', 'study')
    .where('enabled', '=', 1)
    .executeTakeFirst();
  if (!registered) return false;

  return addUserToChannel(db, channelUrl, botId, 'member');
}

/**
 * Remove a bot from a channel.
 *
 * Returns true if the membership row was deleted, false otherwise.
 * Does NOT gate on is_bot — a caller that mistakenly passes a human user_id
 * will still have the membership removed (matches legacy; the gate is in the
 * GraphQL resolver via the operator check).
 */
export async function removeBotFromChannel(
  db: Kysely<DB>,
  channelUrl: string,
  botId: string,
): Promise<boolean> {
  return removeUserFromChannel(db, channelUrl, botId);
}

/**
 * Look up a bot user by its messenger user_id.
 * Returns the UserDTO when the user exists AND is_bot is true, null otherwise.
 *
 * Useful for the resolver to confirm the `bot` arg is valid before acting.
 */
export async function getBotUser(
  db: Kysely<DB>,
  botId: string,
): Promise<UserDTO | null> {
  const user = await getUser(db, botId);
  if (!user || !user.is_bot) return null;
  return user;
}
