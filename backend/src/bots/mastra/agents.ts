/**
 * Mastra agent factory — turns a `bom_bot` row into a Mastra Agent (persona →
 * instructions, model, RAG tool). The bots literally run on Mastra: generation
 * goes through agent.generate(), which applies instructions + tools + the model.
 */
import { Agent } from '@mastra/core/agent';
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import { resolveBotModel } from './model.js';
import { createBotRagTool } from './rag.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, any>();

/**
 * Build (and cache) the Mastra agent for a bot. Returns null when no bom_bot row
 * exists or no model provider is configured (caller falls back / skips).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getBotAgent(db: Kysely<DB>, botId: string): Promise<any | null> {
  const cached = cache.get(botId);
  if (cached) return cached;

  const row = await db
    .selectFrom('bom_bot')
    .select(['display_name', 'persona', 'model'])
    .where('bot_id', '=', botId)
    .executeTakeFirst();
  if (!row) return null;

  const model = resolveBotModel(row.model, { mockVoice: row.display_name || 'a reformer' });
  if (!model) return null;

  // Cast: Mastra's AgentConfig generics are very strict about tool/model shapes;
  // the runtime accepts this config (verified by the smoke test).
  const agent = new Agent({
    name: row.display_name || botId,
    instructions: row.persona || 'You are a thoughtful participant in a scripture study group. Keep replies to one short paragraph.',
    model,
    tools: { bot_rag: createBotRagTool(db, botId) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  cache.set(botId, agent);
  return agent;
}

/** Clear the agent cache (e.g. after a persona edit). */
export function clearBotAgentCache(botId?: string): void {
  if (botId) cache.delete(botId);
  else cache.clear();
}
