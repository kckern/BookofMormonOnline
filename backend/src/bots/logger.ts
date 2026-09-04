/**
 * bots/logger.ts — structured logging for the bot discussion pipeline.
 *
 * Emits pino JSON to stdout (→ docker → vector → VictoriaLogs), matching the
 * app's Fastify logger shape. Query in VictoriaLogs by `component:"bots"` and
 * `event:"..."`. Every discussion is correlated by `runId` (whole run) and
 * `rootMessageId` (once the opener is posted); each turn adds `turnId`.
 *
 * TRACEABILITY: full prompts (the message array) and full model outputs ARE
 * logged, by design — the whole point is that a thread is reconstructable from
 * logs (prompt → output → refs → length → timing → tokens). Secrets/API keys
 * are NEVER logged (we log message content + env-derived scalars only).
 */
import pino from 'pino';
import { env } from '../config/env.js';

export const botLog = pino({
  level: env.LOG_LEVEL,
  name: 'bots',
  base: { component: 'bots' },
});

export type BotLogger = pino.Logger;

/** Count sentences in generated text (rough — terminal punctuation groups). */
export function countSentences(text: string): number {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(/[^.!?]+[.!?]+(?:["'”’)\]]*)?|\S[^.!?]*$/g);
  return matches ? matches.length : 1;
}
