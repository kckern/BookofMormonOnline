/**
 * reactions.ts — Kysely port of Messenger.addReaction / removeReaction
 * (src/library/messenger.ts:650-683).
 *
 * Accepts `db: Kysely<DB>` — no module-level singleton.
 *
 * addReaction: idempotent insert (ignore duplicate key); returns true on first insert,
 * false if the reaction already exists (mirrors legacy try/catch on a unique constraint).
 *
 * removeReaction: deletes by (message_id, user_id, reaction_key); returns true if a row
 * was actually removed.
 *
 * getReactions: returns the aggregated DTO shape used in MessageDTO.reactions:
 *   [{ key: string; user_ids: string[] }]
 * Useful for callers who need a fresh reaction snapshot after a mutation.
 */

import { type Kysely, sql } from 'kysely';
import type { DB } from '../../codegen/db.js';

// ─── addReaction ──────────────────────────────────────────────────────────────

/**
 * Add a reaction. Returns true on success, false if the reaction already exists.
 * mysql2: unique constraint violations → error code ER_DUP_ENTRY (1062).
 */
export async function addReaction(
  db: Kysely<DB>,
  messageId: string,
  userId: string,
  reactionKey: string,
): Promise<boolean> {
  try {
    await db
      .insertInto('messenger_reactions')
      .values({
        message_id: messageId,
        user_id: userId,
        reaction_key: reactionKey,
      })
      .execute();
    return true;
  } catch (err: unknown) {
    // Duplicate key → reaction already exists; treat as no-op (legacy behaviour)
    const e = err as { code?: string; errno?: number };
    if (e.code === 'ER_DUP_ENTRY' || e.errno === 1062) return false;
    throw err;
  }
}

// ─── removeReaction ───────────────────────────────────────────────────────────

/**
 * Remove a reaction. Returns true if a row was deleted, false if it didn't exist.
 */
export async function removeReaction(
  db: Kysely<DB>,
  messageId: string,
  userId: string,
  reactionKey: string,
): Promise<boolean> {
  const result = await db
    .deleteFrom('messenger_reactions')
    .where('message_id', '=', messageId)
    .where('user_id', '=', userId)
    .where('reaction_key', '=', reactionKey)
    .execute();

  // Kysely DeleteResult uses numDeletedRows (BigInt)
  return Number(result[0]?.numDeletedRows ?? 0) > 0;
}

// ─── getReactions ─────────────────────────────────────────────────────────────

/**
 * Return the aggregated reaction list for a message, identical to the reactions
 * field on MessageDTO:  [{ key, user_ids }]
 */
export async function getReactions(
  db: Kysely<DB>,
  messageId: string,
): Promise<{ key: string; user_ids: string[] }[]> {
  const rows = await db
    .selectFrom('messenger_reactions')
    .select(['reaction_key', 'user_id'])
    .where('message_id', '=', messageId)
    .execute();

  const map: Record<string, string[]> = {};
  for (const r of rows) {
    if (!map[r.reaction_key]) map[r.reaction_key] = [];
    map[r.reaction_key]!.push(r.user_id);
  }

  return Object.entries(map).map(([key, user_ids]) => ({ key, user_ids }));
}
