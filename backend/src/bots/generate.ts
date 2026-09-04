/**
 * generateBotReply — the single entry point for bot text generation. Runs the
 * bot's Mastra agent (persona + tools + model). Returns null when no agent/model
 * is available so callers (scheduler, botResponder) can skip gracefully.
 *
 * Fully traced: emits generate.start (with the full prompt), generate.done
 * (with the full output, latency, token usage, sentence count) and
 * generate.fail via the structured bot logger. Pass a correlated child logger
 * + label via `ctx` so a whole discussion is reconstructable from logs.
 */
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { getBotAgent } from './mastra/agents.js';
import { assertBotOutputRights } from './mastra/rag.js';
import { botLog, countSentences, type BotLogger } from './logger.js';

export interface BotTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateCtx {
  /** Correlated child logger (rootMessageId/turnId). Falls back to botLog. */
  log?: BotLogger;
  /** Human label for the log line, e.g. 'opener' or 'turn#2'. */
  label?: string;
  /** Model id, for log fidelity (generation itself uses the agent's model). */
  model?: string;
}

/** Best-effort token usage extraction across AI-SDK / Mastra result shapes. */
function extractUsage(result: unknown): Record<string, number> | undefined {
  const r = result as { usage?: unknown; response?: { usage?: unknown } } | null;
  const u = (r?.usage ?? r?.response?.usage) as Record<string, unknown> | undefined;
  if (!u || typeof u !== 'object') return undefined;
  const out: Record<string, number> = {};
  for (const k of ['inputTokens', 'outputTokens', 'totalTokens', 'promptTokens', 'completionTokens', 'reasoningTokens']) {
    if (typeof u[k] === 'number') out[k] = u[k] as number;
  }
  return Object.keys(out).length ? out : undefined;
}

export async function generateBotReply(
  db: Kysely<DB>,
  botId: string,
  messages: BotTurn[],
  ctx: GenerateCtx = {},
): Promise<string | null> {
  const log = ctx.log ?? botLog;
  // Reasoning models (gpt-5.x / gpt-5.6-luna) take a reasoning effort via the
  // OpenAI provider options. Default 'high'; override BOT_LLM_REASONING_EFFORT
  // (none|low|medium|high|xhigh|max). Harmless for non-reasoning models.
  const reasoningEffort = process.env['BOT_LLM_REASONING_EFFORT'] || 'high';
  const promptChars = messages.reduce((n, m) => n + m.content.length, 0);

  const agent = await getBotAgent(db, botId);
  if (!agent) {
    log.warn({ event: 'generate.skip', botId, label: ctx.label, reason: 'no-agent-or-model' }, 'bot generate skipped');
    return null;
  }

  const t0 = Date.now();
  log.info(
    {
      event: 'generate.start', botId, label: ctx.label, model: ctx.model,
      reasoningEffort, msgCount: messages.length, promptChars,
      prompt: messages.map((m) => ({ role: m.role, content: m.content })),
    },
    'bot generate start',
  );
  try {
    const result = await agent.generate(
      messages.map((m) => ({ role: m.role, content: m.content })),
      { providerOptions: { openai: { reasoningEffort } } },
    );
    const text = (result && (result.text ?? result.output)) as string | undefined;
    const trimmed = text?.trim();
    const latencyMs = Date.now() - t0;
    if (!trimmed) {
      log.warn({ event: 'generate.empty', botId, label: ctx.label, latencyMs }, 'bot generate returned empty');
      return null;
    }
    await assertBotOutputRights(db, botId, trimmed);
    log.info(
      {
        event: 'generate.done', botId, label: ctx.label, model: ctx.model, reasoningEffort,
        latencyMs, outputChars: trimmed.length, sentences: countSentences(trimmed),
        usage: extractUsage(result), output: trimmed,
      },
      'bot generate done',
    );
    return trimmed;
  } catch (err) {
    log.error(
      { event: 'generate.fail', botId, label: ctx.label, latencyMs: Date.now() - t0, err: (err as Error).message },
      'bot generate failed',
    );
    return null;
  }
}
