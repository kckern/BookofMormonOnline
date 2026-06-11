/**
 * test/messaging/botResponder.test.ts
 *
 * Unit tests for botResponder.maybeBotReply.
 *
 * Fully hermetic — no live DB, no live LLM. The Kysely DB query surface and the
 * Mastra generation entry point (generateBotReply) are stubbed so the suite is
 * deterministic and needs no env credentials.
 *
 * Bot text generation now runs through each bot's Mastra agent. botResponder no
 * longer loads a persona or calls an LlmGateway directly — it hands the channel
 * history to generateBotReply(db, botId, turns), which resolves the persona +
 * model + tools internally. These tests therefore mock generateBotReply.
 *
 * Test cases:
 *   1. Bot-authored trigger → early return (no generation, no post).
 *   2. No bot members in the channel → early return, no generation, no post.
 *   3. generateBotReply returns null → no message posted, no throw.
 *   4. generateBotReply returns text → postMessage called with the reply.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageDTO } from '../../src/messaging/dto.js';

// ─── Module mocks ─────────────────────────────────────────────────────────────
//
// Mock the messaging service + the Mastra generation entry point so botResponder
// never touches the DB or a model. vi.mock calls are hoisted before this module
// body executes.

vi.mock('../../src/messaging/messages.js', () => ({
  getMessages: vi.fn(),
  postMessage: vi.fn(),
}));

vi.mock('../../src/bots/generate.js', () => ({
  generateBotReply: vi.fn(),
}));

// After mocks are declared, import the subjects under test.
import { maybeBotReply } from '../../src/realtime/botResponder.js';
import { getMessages, postMessage } from '../../src/messaging/messages.js';
import { generateBotReply } from '../../src/bots/generate.js';

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
 * Build a fake Kysely DB whose selectFrom chain returns the provided bot member
 * rows. postMessage / getMessages / generateBotReply are mocked, so no deeper
 * query surface is exercised.
 */
function buildFakeDb(botRows: { user_id: string }[] = []) {
  const chain = {
    innerJoin: () => chain,
    select: () => chain,
    where: () => chain,
    execute: vi.fn().mockResolvedValue(botRows),
  };
  return { selectFrom: () => chain };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('maybeBotReply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Bot-authored trigger → early return ──────────────────────────────────

  it('returns immediately when the trigger message was authored by a bot (no-loop guard)', async () => {
    const db = buildFakeDb([{ user_id: 'bot_001' }]);

    await maybeBotReply(db as never, 'channel_test', botMsg('bot_001'));

    expect(postMessage).not.toHaveBeenCalled();
    expect(getMessages).not.toHaveBeenCalled();
    expect(generateBotReply).not.toHaveBeenCalled();
  });

  // ── 2. No bot members → early return ───────────────────────────────────────

  it('returns without posting when the channel has no bot members', async () => {
    const db = buildFakeDb([]);

    await maybeBotReply(db as never, 'channel_no_bots', humanMsg());

    expect(postMessage).not.toHaveBeenCalled();
    expect(generateBotReply).not.toHaveBeenCalled();
  });

  // ── 3. generateBotReply returns null → no post, no throw ───────────────────

  it('does not post a reply and does not throw when generation returns null', async () => {
    const db = buildFakeDb([{ user_id: 'bot_001' }]);

    vi.mocked(getMessages).mockResolvedValue([humanMsg()]);
    vi.mocked(generateBotReply).mockResolvedValue(null);

    await expect(
      maybeBotReply(db as never, 'channel_null_gen', humanMsg()),
    ).resolves.toBeUndefined();

    expect(generateBotReply).toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  // ── 4. Happy path: generation returns text → post + broadcast ──────────────

  it('posts the bot reply when its Mastra agent returns text', async () => {
    const BOT_ID = 'bot_happy';
    const CHANNEL = 'channel_happy';
    const REPLY_TEXT = 'Sola fide!';

    const db = buildFakeDb([{ user_id: BOT_ID }]);

    vi.mocked(getMessages).mockResolvedValue([humanMsg()]);
    vi.mocked(postMessage).mockResolvedValue(botMsg(BOT_ID));
    vi.mocked(generateBotReply).mockResolvedValue(REPLY_TEXT);

    await maybeBotReply(db as never, CHANNEL, humanMsg());

    // History was loaded (newest-first, capped at HISTORY_LIMIT).
    expect(getMessages).toHaveBeenCalledWith(expect.anything(), CHANNEL, { limit: 10 });

    // The bot's Mastra agent was asked to generate, keyed by botId, given the
    // mapped conversation turns.
    expect(generateBotReply).toHaveBeenCalledWith(
      expect.anything(),
      BOT_ID,
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'Hello bot!' }),
      ]),
    );

    // The reply was persisted under the bot's identity.
    expect(postMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ channelUrl: CHANNEL, userId: BOT_ID, message: REPLY_TEXT }),
    );
  });
});
