/**
 * generateBotReply — the single entry point for bot text generation. Runs the
 * bot's Mastra agent (persona + tools + model). Returns null when no agent/model
 * is available so callers (scheduler, botResponder) can skip gracefully.
 */
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { getBotAgent } from './mastra/agents.js';

export interface BotTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function generateBotReply(
  db: Kysely<DB>,
  botId: string,
  messages: BotTurn[],
): Promise<string | null> {
  const agent = await getBotAgent(db, botId);
  if (!agent) return null;
  try {
    const result = await agent.generate(
      messages.map((m) => ({ role: m.role, content: m.content })),
    );
    const text = (result && (result.text ?? result.output)) as string | undefined;
    return text && text.trim().length > 0 ? text.trim() : null;
  } catch (err) {
    console.error(`[bots] mastra generate failed for ${botId}:`, (err as Error).message);
    return null;
  }
}
