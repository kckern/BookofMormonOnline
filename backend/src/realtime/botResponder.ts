/**
 * realtime/botResponder.ts — AI bot auto-responder (Task 4.3)
 *
 * Called (fire-and-forget) by the send_message handler after every successful
 * human message persist + broadcast.  If the channel has bot members, each bot
 * loads its persona, builds a prompt from recent channel history, calls
 * LlmGateway.generate(), and posts the reply through the normal message path so
 * it broadcasts to all connected clients just like any message.
 *
 * Failure modes:
 *   - No bot members in the channel  → silent return.
 *   - LLM gateway returns null       → silent return (logged once per occurrence).
 *   - Persona lookup fails           → silent return.
 *   - Any thrown error              → caught; never propagates to the caller.
 *
 * Loop prevention:
 *   - Trigger message authored by a bot → immediate return (no bot-to-bot chains).
 *   - Per-channel in-flight Set: if a reply is already being generated for a
 *     channel, incoming triggers for that channel are dropped until the current
 *     reply settles (best-effort debounce; not a hard serialisation lock).
 *
 * Token / history budget:
 *   We cap history at HISTORY_LIMIT messages (default 10).  The legacy
 *   virtualgroup.ts used a token count from the GPT lib; a simple count cap is
 *   acceptable here because the adapter already handles truncation at the
 *   provider level.
 *
 * Imports: ESM `.js` extension on every local import (project convention).
 * No Sequelize / legacy src/ imports.
 */

import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { MessageDTO } from '../messaging/dto.js';
import { getPersona } from '../messaging/bots/personas.js';
import { getMessages, postMessage } from '../messaging/messages.js';
import { getLlmGateway } from '../messaging/ai/LlmGateway.js';
import { getBus } from './RealtimeBus.js';

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Maximum number of history messages to pass to the LLM.
 * Mirrors the legacy cap; simple count is acceptable (provider truncates tokens).
 */
const HISTORY_LIMIT = 10;

// ─── In-flight guard ─────────────────────────────────────────────────────────

/**
 * Channels currently awaiting a bot reply.
 * If a new human message arrives while a reply is in-flight for the same
 * channel, it is silently dropped to prevent reply pile-up under rapid input.
 */
const inFlight = new Set<string>();

// ─── Internal: find bot members of a channel ─────────────────────────────────

interface BotMember {
  user_id: string;
}

async function getBotMembers(
  db: Kysely<DB>,
  channelUrl: string,
): Promise<BotMember[]> {
  // Join messenger_members → messenger_users, filter is_bot = 1.
  const rows = await db
    .selectFrom('messenger_members as m')
    .innerJoin('messenger_users as u', 'u.user_id', 'm.user_id')
    .select('m.user_id')
    .where('m.channel_url', '=', channelUrl)
    .where('u.is_bot', '=', 1)
    .execute();

  return rows;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * maybeBotReply — fire-and-forget entry point called by the send_message handler.
 *
 * @param db            Kysely DB instance (from getDb())
 * @param channelUrl    The channel the human message was posted to
 * @param triggerMsg    The MessageDTO of the human message just posted
 */
export async function maybeBotReply(
  db: Kysely<DB>,
  channelUrl: string,
  triggerMsg: MessageDTO,
): Promise<void> {
  try {
    // 1. Bot-authored message → no bot-to-bot loops.
    if (triggerMsg.user?.is_bot) return;

    // 2. In-flight guard: drop if already generating a reply for this channel.
    if (inFlight.has(channelUrl)) return;
    inFlight.add(channelUrl);

    try {
      // 3. Find bot members of the channel.
      const bots = await getBotMembers(db, channelUrl);
      if (bots.length === 0) return;

      // Match legacy: one bot per channel — use the first bot found.
      const bot = bots[0]!;
      const botId = bot.user_id;

      // 4. Load persona.
      const persona = await getPersona(db, botId, 'en');
      if (!persona) {
        console.warn(`[botResponder] persona lookup returned null for bot ${botId} — skipping`);
        return;
      }

      // 5. Load recent channel history (top-level messages only, newest-first).
      //    getMessages returns newest-first; we reverse to chronological order for
      //    the LLM prompt.
      const rawHistory = await getMessages(db, channelUrl, { limit: HISTORY_LIMIT });
      const history = [...rawHistory].reverse();

      // 6. Map history to LLM messages.
      //    Messages authored by this bot → 'assistant'; all others → 'user'.
      const llmMessages = history.map((msg) => ({
        role: (msg.user?.user_id === botId ? 'assistant' : 'user') as 'assistant' | 'user',
        content: msg.message,
      }));

      // 7. Generate reply via LlmGateway.
      const reply = await getLlmGateway().generate({
        system: persona.system,
        messages: llmMessages,
      });

      // 8. Gateway returned null (no key, error, timeout) → silently return.
      if (reply === null) {
        console.warn(`[botResponder] LLM gateway returned null for channel ${channelUrl} — no reply`);
        return;
      }

      // 9. Post the bot's reply and broadcast it via the RealtimeBus.
      const botMsg = await postMessage(db, {
        channelUrl,
        userId: botId,
        message: reply,
      });

      getBus().emit('message_received', channelUrl, botMsg);
    } finally {
      // Always clear in-flight regardless of success/error path.
      inFlight.delete(channelUrl);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[botResponder] unexpected error for channel ${channelUrl}: ${msg}`);
    // Never rethrow — the handler's ack must not be blocked by bot errors.
  }
}
