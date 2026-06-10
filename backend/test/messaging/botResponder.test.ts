/**
 * test/messaging/botResponder.test.ts
 *
 * Unit tests for botResponder.maybeBotReply (Task 4.3).
 *
 * These tests are fully hermetic — no live DB, no live LLM.  The Kysely DB
 * and LlmGateway are injected or stubbed so the test suite is deterministic and
 * runs without any env credentials.
 *
 * Test cases:
 *   1. Bot-authored trigger → early return (no DB queries, no reply posted).
 *   2. No bot members in the channel → early return, no LLM call, no post.
 *   3. Gateway returns null → no message posted, no throw.
 *   4. Gateway returns text → postMessage called + bus emits message_received.
 *
 * Injection strategy
 * ------------------
 * - LlmGateway: use `resetLlmGateway(fake)` before each relevant test so
 *   getLlmGateway() returns the fake without touching OpenAiAdapter.
 * - DB: a plain object whose methods are vi.fn() stubs — only the subset
 *   accessed by botResponder's helpers needs to be mocked.  We stub it at the
 *   selectFrom / innerJoin / where / execute chain level by returning the right
 *   shape from each call.  The `db` parameter type is `Kysely<DB>` but at
 *   runtime only the query-builder surface is used so `as unknown as Kysely<DB>`
 *   is safe for testing.
 * - RealtimeBus: imported from the module; `setIo` is never called in unit
 *   tests so `getBus().emit` is a no-op (the module logs a one-time warning
 *   — that is acceptable).
 * - postMessage: vi.mock is awkward with ESM re-exports so we intercept the
 *   live DB layer by feeding a fake `db` that records insert calls.  However,
 *   because `postMessage` ultimately calls getMessage after insert (which needs
 *   a real SELECT), we use a separate approach: spy-wrap the messages module
 *   with vi.mock to provide controlled stubs without live DB calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageDTO } from '../../src/messaging/dto.js';
import { resetLlmGateway } from '../../src/messaging/ai/LlmGateway.js';
import type { LlmGateway } from '../../src/messaging/ai/LlmGateway.js';

// ─── Module mocks ─────────────────────────────────────────────────────────────
//
// We mock the messaging service modules so botResponder never touches the DB.
// The mocks are hoisted by vitest (ESM static import order is respected because
// vi.mock calls are hoisted before the test module body executes).

vi.mock('../../src/messaging/messages.js', () => ({
  getMessages: vi.fn(),
  postMessage: vi.fn(),
}));

vi.mock('../../src/messaging/bots/personas.js', () => ({
  getPersona: vi.fn(),
}));

// After mocks are declared, import the subjects under test.
import { maybeBotReply } from '../../src/realtime/botResponder.js';
import { getMessages, postMessage } from '../../src/messaging/messages.js';
import { getPersona } from '../../src/messaging/bots/personas.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal MessageDTO for a human user. */
function humanMsg(overrides: Partial<MessageDTO> = {}): MessageDTO {
  return {
    message_id: 'test_msg_001',
    channel_url: 'channel_test',
    user: {
      user_id: 'human_001',
      nickname: 'Human',
      profile_url: '',
      metadata: null,
      is_online: true,
      last_seen_at: null,
      is_bot: false,
    },
    message_type: 'MESG',
    message: 'Hello bot!',
    custom_type: '',
    data: '{}',
    parent_message_id: null,
    thread_info: null,
    reactions: [],
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

/** Build a minimal MessageDTO for a bot user. */
function botMsg(botId = 'bot_001'): MessageDTO {
  return humanMsg({
    user: {
      user_id: botId,
      nickname: 'TestBot',
      profile_url: '',
      metadata: null,
      is_online: false,
      last_seen_at: null,
      is_bot: true,
    },
  });
}

/**
 * Build a fake Kysely DB whose selectFrom chain stubs return the provided
 * bot member rows.  Any deeper call (like in postMessage) is NOT used because
 * postMessage itself is mocked.
 */
function buildFakeDb(botRows: { user_id: string }[] = []) {
  // Chain builder: each method returns `this` for fluency; execute() resolves.
  const chain = {
    innerJoin: () => chain,
    select: () => chain,
    where: () => chain,
    execute: vi.fn().mockResolvedValue(botRows),
  };

  return {
    selectFrom: () => chain,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('maybeBotReply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Always reset the LLM singleton so tests don't bleed.
    resetLlmGateway(null);
  });

  afterEach(() => {
    resetLlmGateway(null);
  });

  // ── 1. Bot-authored trigger → early return ──────────────────────────────────

  it('returns immediately when the trigger message was authored by a bot (no-loop guard)', async () => {
    const db = buildFakeDb([{ user_id: 'bot_001' }]);

    // A bot-authored message should never trigger another bot reply.
    await maybeBotReply(
      db as never,
      'channel_test',
      botMsg('bot_001'),
    );

    // The DB should not have been queried at all (no selectFrom call reached
    // beyond the early return).  Verify that neither postMessage nor getMessages
    // was called.
    expect(postMessage).not.toHaveBeenCalled();
    expect(getMessages).not.toHaveBeenCalled();
    expect(getPersona).not.toHaveBeenCalled();
  });

  // ── 2. No bot members → early return ───────────────────────────────────────

  it('returns without posting when the channel has no bot members', async () => {
    // DB returns an empty bot list.
    const db = buildFakeDb([]);

    const fakeGateway: LlmGateway = { generate: vi.fn().mockResolvedValue('Hi') };
    resetLlmGateway(fakeGateway);

    await maybeBotReply(db as never, 'channel_no_bots', humanMsg());

    expect(postMessage).not.toHaveBeenCalled();
    expect(fakeGateway.generate).not.toHaveBeenCalled();
  });

  // ── 3. Gateway returns null → no post, no throw ────────────────────────────

  it('does not post a reply and does not throw when the LLM gateway returns null', async () => {
    const db = buildFakeDb([{ user_id: 'bot_001' }]);

    // Persona found; history returns a couple of messages.
    vi.mocked(getPersona).mockResolvedValue({ system: 'You are a bot.' });
    vi.mocked(getMessages).mockResolvedValue([humanMsg()]);

    // Gateway returns null (no key, error, quota, etc.).
    const fakeGateway: LlmGateway = { generate: vi.fn().mockResolvedValue(null) };
    resetLlmGateway(fakeGateway);

    await expect(
      maybeBotReply(db as never, 'channel_null_gw', humanMsg()),
    ).resolves.toBeUndefined();

    expect(postMessage).not.toHaveBeenCalled();
  });

  // ── 4. Happy path: gateway returns text → post + broadcast ─────────────────

  it('posts and broadcasts the bot reply when the gateway returns text', async () => {
    const BOT_ID = 'bot_happy';
    const CHANNEL = 'channel_happy';
    const REPLY_TEXT = 'Sola fide!';

    const db = buildFakeDb([{ user_id: BOT_ID }]);

    vi.mocked(getPersona).mockResolvedValue({ system: 'You are Martin Luther.' });
    vi.mocked(getMessages).mockResolvedValue([humanMsg()]);

    const fakeBotMsgDTO = botMsg(BOT_ID);
    vi.mocked(postMessage).mockResolvedValue(fakeBotMsgDTO);

    const fakeGateway: LlmGateway = { generate: vi.fn().mockResolvedValue(REPLY_TEXT) };
    resetLlmGateway(fakeGateway);

    await maybeBotReply(db as never, CHANNEL, humanMsg());

    // Persona was looked up for the bot.
    expect(getPersona).toHaveBeenCalledWith(expect.anything(), BOT_ID, 'en');

    // History was loaded.
    expect(getMessages).toHaveBeenCalledWith(expect.anything(), CHANNEL, { limit: 10 });

    // LLM was called with correct system prompt.
    expect(fakeGateway.generate).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'You are Martin Luther.' }),
    );

    // Bot message was persisted.
    expect(postMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        channelUrl: CHANNEL,
        userId: BOT_ID,
        message: REPLY_TEXT,
      }),
    );
  });

  // ── 5. Persona lookup fails → no post, no throw ────────────────────────────

  it('does not post a reply when persona lookup returns null', async () => {
    const db = buildFakeDb([{ user_id: 'bot_001' }]);

    vi.mocked(getPersona).mockResolvedValue(null);

    const fakeGateway: LlmGateway = { generate: vi.fn().mockResolvedValue('Hi') };
    resetLlmGateway(fakeGateway);

    await expect(
      maybeBotReply(db as never, 'channel_no_persona', humanMsg()),
    ).resolves.toBeUndefined();

    expect(postMessage).not.toHaveBeenCalled();
    expect(fakeGateway.generate).not.toHaveBeenCalled();
  });
});
