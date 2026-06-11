/**
 * messaging/bots/personas.ts — bot persona lookup
 *
 * Loads a bot's system prompt from the BomVirtualgroupPrompts table
 * (column: `prompt`, keyed by bot_id + lang with 'en' fallback).
 *
 * If no DB row is found, falls back to seed constants ported from the
 * legacy virtualgroup.ts "reformers" group (two representative bots seeded
 * here so the responder has something to work with even if the table is empty).
 *
 * Kysely (db, ...) signature — no singleton coupling; tests inject their own
 * connection.  No Sequelize/legacy imports.
 */

import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// Seed fallbacks (ported from src/api/virtualgroup.ts "reformers" bots)
// ─────────────────────────────────────────────────────────────────────────────

const SEED_PERSONAS: Record<string, string> = {
  '13b1c4fc58a87a68d4da51beb22a0ecd': `You are Martin Luther.
You are a German professor of theology, composer, priest, monk, and a seminal figure in the Protestant Reformation.
Your most prominent works, which you refer to and quote from frequently are:
- The 95 Theses
- The Bondage of the Will
- On the Freedom of a Christian
- The Large Catechism
- The Small Catechism

Temperament: Choleric, stern, and blunt

Pet topics:
- Sola Scriptura
- Sola Fide
- Sola Gratia`,

  '775edb314d6f7495b3b38a47c855988e': `You are John Calvin.
You are a French theologian, pastor and reformer in Geneva during the Protestant Reformation.
Your most prominent works and sermons, which you refer to and quote from frequently are:
- The Institutes of the Christian Religion
- The Bondage and Liberation of the Will
- The Necessity of Reforming the Church
- The Secret Providence of God
- The Eternal Predestination of God

Temperament: Gracious, humble, and kind, but sometimes quick witted and sharp tongued

Pet topics:
- Predestination
- The Sovereignty of God
- The Doctrine of Election`,
};

/**
 * Default system prompt for any bot not found in the DB or the seed map.
 * Keeps bot responses safe and on-topic if persona data is missing.
 */
const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful study assistant for the Book of Mormon. ' +
  'Respond thoughtfully and briefly to the conversation.';

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
 *   3. SEED_PERSONAS[botId]  (hardcoded fallback from legacy virtualgroup.ts)
 *   4. DEFAULT_SYSTEM_PROMPT (last-resort generic prompt)
 *
 * Returns null only if the db query itself fails unexpectedly — callers should
 * treat null as "use default behaviour / skip AI response".
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

    // DB has no persona — try seed constants.
    const seed = SEED_PERSONAS[botId];
    if (seed) {
      return { system: seed };
    }

    // Final fallback.
    return { system: DEFAULT_SYSTEM_PROMPT };
  } catch {
    // DB unavailable or unexpected schema issue — return null so the caller
    // can skip the AI response gracefully rather than crashing.
    return null;
  }
}
