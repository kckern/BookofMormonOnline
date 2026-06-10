/**
 * messaging/ai/LlmGateway.ts — PORT (DDD hexagonal port/adapter)
 *
 * The domain depends only on this interface.  NO business logic or AI SDK
 * imports live here.  Provider-specific code belongs exclusively in adapters
 * (e.g. OpenAiAdapter.ts).
 *
 * Note: getLlmGateway() imports OpenAiAdapter at module load time (static
 * import at top of file).  This is intentional — it keeps the openai SDK
 * import confined to OpenAiAdapter.ts while giving getLlmGateway() a concrete
 * default.  Tests that want to swap the gateway call resetLlmGateway(fake)
 * BEFORE calling getLlmGateway(), which bypasses the OpenAiAdapter entirely.
 *
 * Factory
 * -------
 * getLlmGateway() returns the configured adapter.  Currently always returns
 * OpenAiAdapter; a future `LLM_PROVIDER` env var can steer to other adapters
 * without touching domain code.
 */

import { OpenAiAdapter } from './OpenAiAdapter.js';

// ─────────────────────────────────────────────────────────────────────────────
// Port interface
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateOpts {
  system: string;
  messages: ChatMessage[];
}

/**
 * LlmGateway — the provider-agnostic port.
 *
 * generate() resolves to the assistant text, or null when no response can be
 * produced (provider error, timeout, missing credentials, empty response).
 * Implementations MUST NOT throw; all errors are swallowed and returned as null
 * so that callers (botResponder, etc.) can safely ignore them.
 */
export interface LlmGateway {
  generate(opts: GenerateOpts): Promise<string | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

let _instance: LlmGateway | null = null;

/**
 * getLlmGateway() — returns the singleton adapter instance.
 *
 * Lazy-initialised on first call.  Tests can inject a fake before first use by
 * calling resetLlmGateway(fake) — getLlmGateway() will return that fake and
 * never construct OpenAiAdapter.
 */
export function getLlmGateway(): LlmGateway {
  if (!_instance) {
    // STUB_LLM_REPLY: a deterministic fixed-reply gateway for tests/dev — lets
    // the bot-reply integration test assert a known response without a real key.
    const stub = process.env['STUB_LLM_REPLY'];
    _instance = stub
      ? { generate: async () => stub }
      : new OpenAiAdapter();
  }
  return _instance;
}

/**
 * resetLlmGateway() — replace or clear the singleton.
 *
 * Pass a fake adapter to inject it; pass null (the default) to clear the
 * instance so the next getLlmGateway() call re-creates the default adapter.
 */
export function resetLlmGateway(adapter: LlmGateway | null = null): void {
  _instance = adapter;
}
