/**
 * messaging/ai/OpenAiAdapter.ts — default LlmGateway ADAPTER
 *
 * This is the ONLY file in the codebase that may import `openai`.
 * All other code depends exclusively on the LlmGateway interface (the PORT).
 *
 * Behaviour
 * ---------
 * - Reads OPENAI_API_KEY from process.env; if absent returns null without
 *   throwing (silent degradation — the channel still works, bots just go quiet).
 * - Model from OPENAI_MODEL env, default 'gpt-3.5-turbo' (matches legacy usage
 *   in src/api/studybuddy.ts and src/api/virtualgroup.ts).
 * - Maps the LlmGateway messages array + system string to the chat completions
 *   format: system message first, then the conversation messages.
 * - Returns the text of the first choice, or null on any error/timeout/empty.
 * - Never throws into the domain.
 */

import OpenAI from 'openai';
import type { LlmGateway, GenerateOpts } from './LlmGateway.js';

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

export class OpenAiAdapter implements LlmGateway {
  private client: OpenAI | null = null;
  private model: string;

  /**
   * @param clientOverride — injectable for testing (pass a fake OpenAI client).
   */
  constructor(clientOverride?: OpenAI) {
    this.model = process.env['OPENAI_MODEL'] ?? 'gpt-3.5-turbo';

    if (clientOverride !== undefined) {
      this.client = clientOverride;
      return;
    }

    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      // No key → keep client null; generate() will return null immediately.
      return;
    }

    this.client = new OpenAI({ apiKey });
  }

  async generate(opts: GenerateOpts): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: opts.system },
          ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });

      const text = completion.choices[0]?.message?.content ?? null;
      return text && text.trim().length > 0 ? text : null;
    } catch {
      // Any error (network, quota, invalid key, timeout, etc.) → silent null.
      return null;
    }
  }
}
