/**
 * Bot model resolution for the Mastra agent runtime.
 *
 * - OPENAI_API_KEY set  → the Vercel AI SDK OpenAI provider (real generation).
 * - BOT_LLM_MOCK set    → a deterministic MockLanguageModel that still runs
 *                          THROUGH the Mastra agent (instructions/tools/pipeline)
 *                          so the bot framework is exercised without a key.
 * - neither             → null (caller skips generation).
 */
import { openai } from '@ai-sdk/openai';
import { MockLanguageModelV3 } from 'ai/test';

const DEFAULT_MODEL = process.env['BOT_LLM_MODEL'] || 'gpt-4o-mini';

/** A model (real or mock) is available. */
export function hasLlmProvider(): boolean {
  return !!process.env['OPENAI_API_KEY'] || !!process.env['BOT_LLM_MOCK'];
}

/** Resolve a model for a bot agent, or null when nothing is configured. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveBotModel(modelId?: string | null, opts?: { mockVoice?: string }): any {
  if (process.env['BOT_LLM_MOCK']) {
    const voice = opts?.mockVoice || 'a reformer';
    return new MockLanguageModelV3({
      doGenerate: async () => ({
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text', text: `As ${voice}, here is my reflection on the passage. [mock]` }],
        warnings: [],
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }
  if (process.env['OPENAI_API_KEY']) return openai(modelId || DEFAULT_MODEL);
  return null;
}
