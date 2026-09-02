/**
 * messaging/bots/personas.ts — bot persona lookup
 *
 * Loads a bot's system prompt from the BomVirtualgroupPrompts table
 * (column: `prompt`, keyed by bot_id + lang with 'en' fallback).
 *
 * Missing configuration fails closed: a bot without a DB persona does not run.
 *
 * Kysely (db, ...) signature — no singleton coupling; tests inject their own
 * connection.  No Sequelize/legacy imports.
 */

import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface Persona {
  /** The system prompt to pass to the LLM as the `system` message. */
  system: string;
}

/**
 * getPersona(db, botId, lang) — load the system prompt for a bot.
 *
 * Resolution order:
 *   1. BomVirtualgroupPrompts row where bot_id = botId AND lang = lang
 *   2. BomVirtualgroupPrompts row where bot_id = botId AND lang = 'en'  (fallback)
 * Returns null when configuration is absent or the query fails. Callers must
 * skip generation; inventing a generic personality would violate provenance.
 */
export async function getPersona(
  db: Kysely<DB>,
  botId: string,
  lang: string,
): Promise<Persona | null> {
  try {
    // Persona now lives in bom_bot.persona (the bot-specific table), repointed
    // from the always-null bom_virtualgroup_prompts.bot_id. lang is reserved for
    // future per-language personas.
    void lang;
    const row = await db
      .selectFrom('bom_bot')
      .select('persona')
      .where('bot_id', '=', botId)
      .executeTakeFirst();

    if (row?.persona && row.persona.trim().length > 0) {
      return { system: row.persona.trim() };
    }

    return null;
  } catch {
    // DB unavailable or unexpected schema issue — return null so the caller
    // can skip the AI response gracefully rather than crashing.
    return null;
  }
}
