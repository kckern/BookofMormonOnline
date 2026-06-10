/**
 * test/messaging/ai.test.ts
 *
 * Unit tests for:
 *   - OpenAiAdapter (LlmGateway adapter) — mocked openai client
 *   - getLlmGateway() factory — returns an LlmGateway instance
 *   - personas.ts read path — SELECT from BomVirtualgroupPrompts (read-only DB)
 *
 * Mocking strategy
 * ----------------
 * OpenAiAdapter accepts an optional `clientOverride` constructor argument so
 * tests can inject a fake OpenAI client without touching `vi.mock('openai')`.
 * This avoids hoisting complexity in the ESM module graph and keeps each test
 * hermetic.  The fake client is a plain object that satisfies the subset of
 * the OpenAI API surface that OpenAiAdapter calls:
 *   client.chat.completions.create({ ... }) → Promise<ChatCompletion>
 *
 * DB personas test
 * ----------------
 * Uses the real bom_prd DB (read-only, no writes) via dotenv.  If the DB is
 * unreachable the test is skipped (same pattern as users/channels tests).
 * The personas test exercises the lang-fallback path by querying a real bot_id
 * that exists in bom_virtualgroup_prompts, plus an unknown bot_id to confirm
 * the seed/default fallback.
 */

import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Kysely, MysqlDialect, type MysqlDialectConfig } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from '../../codegen/db.js';
import { OpenAiAdapter } from '../../src/messaging/ai/OpenAiAdapter.js';
import { getLlmGateway, resetLlmGateway } from '../../src/messaging/ai/LlmGateway.js';
import type { LlmGateway } from '../../src/messaging/ai/LlmGateway.js';
import { getPersona } from '../../src/messaging/bots/personas.js';

// ─────────────────────────────────────────────────────────────────────────────
// Fake OpenAI client helpers
// ─────────────────────────────────────────────────────────────────────────────

type FakeCompletion = {
  choices: Array<{ message: { content: string | null } }>;
};

function makeFakeClient(
  response: FakeCompletion | null,
  shouldThrow = false,
): object {
  return {
    chat: {
      completions: {
        create: async (_opts: unknown): Promise<FakeCompletion> => {
          if (shouldThrow) throw new Error('openai network error');
          if (response === null) throw new Error('null response sentinel');
          return response;
        },
      },
    },
  };
}

function successClient(text: string): object {
  return makeFakeClient({ choices: [{ message: { content: text } }] });
}

function throwingClient(): object {
  return makeFakeClient(null, true);
}

function emptyContentClient(): object {
  return makeFakeClient({ choices: [{ message: { content: null } }] });
}

function emptyChoicesClient(): object {
  return makeFakeClient({ choices: [] });
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAiAdapter tests
// ─────────────────────────────────────────────────────────────────────────────

describe('OpenAiAdapter', () => {
  it('returns the mocked text on a successful completion', async () => {
    const adapter = new OpenAiAdapter(successClient('Hello, world!') as never);
    const result = await adapter.generate({
      system: 'You are a test bot.',
      messages: [{ role: 'user', content: 'Say hello.' }],
    });
    expect(result).toBe('Hello, world!');
  });

  it('returns null when the client throws (network error, quota, etc.)', async () => {
    const adapter = new OpenAiAdapter(throwingClient() as never);
    const result = await adapter.generate({
      system: 'You are a test bot.',
      messages: [{ role: 'user', content: 'Say hello.' }],
    });
    expect(result).toBeNull();
  });

  it('returns null when the completion has no choices', async () => {
    const adapter = new OpenAiAdapter(emptyChoicesClient() as never);
    const result = await adapter.generate({
      system: 'You are a test bot.',
      messages: [{ role: 'user', content: 'Say hello.' }],
    });
    expect(result).toBeNull();
  });

  it('returns null when the message content is null', async () => {
    const adapter = new OpenAiAdapter(emptyContentClient() as never);
    const result = await adapter.generate({
      system: 'You are a test bot.',
      messages: [{ role: 'user', content: 'Say hello.' }],
    });
    expect(result).toBeNull();
  });

  it('returns null when OPENAI_API_KEY is absent (no client injected)', async () => {
    const savedKey = process.env['OPENAI_API_KEY'];
    delete process.env['OPENAI_API_KEY'];
    try {
      const adapter = new OpenAiAdapter();
      const result = await adapter.generate({
        system: 'system',
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(result).toBeNull();
    } finally {
      if (savedKey !== undefined) process.env['OPENAI_API_KEY'] = savedKey;
    }
  });

  it('passes system + messages to the client in the expected format', async () => {
    let capturedOpts: unknown = null;
    const capturingClient = {
      chat: {
        completions: {
          create: async (opts: unknown) => {
            capturedOpts = opts;
            return { choices: [{ message: { content: 'ok' } }] };
          },
        },
      },
    };

    const adapter = new OpenAiAdapter(capturingClient as never);
    await adapter.generate({
      system: 'You are Martin Luther.',
      messages: [
        { role: 'user', content: 'What do you think of justification?' },
        { role: 'assistant', content: 'Sola fide!' },
        { role: 'user', content: 'Elaborate.' },
      ],
    });

    expect(capturedOpts).toMatchObject({
      messages: [
        { role: 'system', content: 'You are Martin Luther.' },
        { role: 'user', content: 'What do you think of justification?' },
        { role: 'assistant', content: 'Sola fide!' },
        { role: 'user', content: 'Elaborate.' },
      ],
    });
  });

  it('uses OPENAI_MODEL env var when set', async () => {
    let capturedModel: string | undefined;
    const modelCapturingClient = {
      chat: {
        completions: {
          create: async (opts: { model: string }) => {
            capturedModel = opts.model;
            return { choices: [{ message: { content: 'ok' } }] };
          },
        },
      },
    };

    const savedModel = process.env['OPENAI_MODEL'];
    process.env['OPENAI_MODEL'] = 'gpt-4o';
    try {
      const adapter = new OpenAiAdapter(modelCapturingClient as never);
      await adapter.generate({ system: 'sys', messages: [] });
      expect(capturedModel).toBe('gpt-4o');
    } finally {
      if (savedModel !== undefined) process.env['OPENAI_MODEL'] = savedModel;
      else delete process.env['OPENAI_MODEL'];
    }
  });

  it('defaults to gpt-3.5-turbo when OPENAI_MODEL is unset', async () => {
    let capturedModel: string | undefined;
    const modelCapturingClient = {
      chat: {
        completions: {
          create: async (opts: { model: string }) => {
            capturedModel = opts.model;
            return { choices: [{ message: { content: 'ok' } }] };
          },
        },
      },
    };

    const savedModel = process.env['OPENAI_MODEL'];
    delete process.env['OPENAI_MODEL'];
    try {
      const adapter = new OpenAiAdapter(modelCapturingClient as never);
      await adapter.generate({ system: 'sys', messages: [] });
      expect(capturedModel).toBe('gpt-3.5-turbo');
    } finally {
      if (savedModel !== undefined) process.env['OPENAI_MODEL'] = savedModel;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getLlmGateway() factory tests
// ─────────────────────────────────────────────────────────────────────────────

describe('getLlmGateway()', () => {
  afterAll(() => {
    // Clean up injected singleton so other test files start fresh.
    resetLlmGateway(null);
  });

  it('returns an object that satisfies the LlmGateway interface', () => {
    // Inject a known fake so the factory does not need OPENAI_API_KEY.
    const fake: LlmGateway = {
      generate: async () => 'test',
    };
    resetLlmGateway(fake);

    const gw = getLlmGateway();
    expect(gw).toBeDefined();
    expect(typeof gw.generate).toBe('function');
  });

  it('returns the same singleton on repeated calls', () => {
    const fake: LlmGateway = { generate: async () => null };
    resetLlmGateway(fake);
    const a = getLlmGateway();
    const b = getLlmGateway();
    expect(a).toBe(b);
  });

  it('re-creates after resetLlmGateway(null)', () => {
    const fake: LlmGateway = { generate: async () => 'first' };
    resetLlmGateway(fake);
    const first = getLlmGateway();

    resetLlmGateway(null);
    // After reset the factory will try to build OpenAiAdapter.
    // We set OPENAI_API_KEY to something so the adapter is created successfully,
    // or we just confirm getLlmGateway() doesn't throw.
    const savedKey = process.env['OPENAI_API_KEY'];
    process.env['OPENAI_API_KEY'] = 'sk-test';
    try {
      const second = getLlmGateway();
      expect(second).not.toBe(first);
      expect(typeof second.generate).toBe('function');
    } finally {
      if (savedKey !== undefined) process.env['OPENAI_API_KEY'] = savedKey;
      else delete process.env['OPENAI_API_KEY'];
      resetLlmGateway(null);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// personas.ts DB read path
// ─────────────────────────────────────────────────────────────────────────────

describe('getPersona()', () => {
  let db: Kysely<DB> | null = null;
  let canRead = false;

  beforeAll(async () => {
    const host = process.env['MYSQL_HOST'] ?? '127.0.0.1';
    const port = Number(process.env['MYSQL_PORT'] ?? 3306);
    const database = process.env['MYSQL_DB'] ?? 'bom_prd';
    const user = process.env['MYSQL_USER'] ?? 'reader';
    const password = process.env['MYSQL_PASSWORD'] ?? '';

    db = new Kysely<DB>({
      dialect: new MysqlDialect({
        pool: createPool({
          host,
          port,
          database,
          user,
          password,
          connectionLimit: 3,
        }) as unknown as MysqlDialectConfig['pool'],
      }),
    });

    // Probe DB connectivity with a lightweight query.
    try {
      await db.selectFrom('bom_virtualgroup_prompts').select('guid').limit(1).execute();
      canRead = true;
    } catch {
      canRead = false;
    }
  });

  afterAll(async () => {
    await db?.destroy();
  });

  it('returns a Persona with system prompt from DB when bot_id exists', async () => {
    if (!canRead) {
      console.warn('BLOCKED: DB unreachable — skipping personas DB test');
      return;
    }

    // Fetch the first real bot_id from the table so the test is DB-driven.
    const [firstRow] = await db!
      .selectFrom('bom_virtualgroup_prompts')
      .select(['bot_id', 'lang'])
      .where('bot_id', 'is not', null)
      .where('prompt', 'is not', null)
      .limit(1)
      .execute();

    if (!firstRow?.bot_id) {
      console.warn('BLOCKED: no bot rows in bom_virtualgroup_prompts — skipping');
      return;
    }

    const persona = await getPersona(db!, firstRow.bot_id, firstRow.lang ?? 'en');
    expect(persona).not.toBeNull();
    expect(typeof persona!.system).toBe('string');
    expect(persona!.system.trim().length).toBeGreaterThan(0);
  });

  it('falls back to English prompt when requested lang has no row', async () => {
    if (!canRead) {
      console.warn('BLOCKED: DB unreachable — skipping lang-fallback test');
      return;
    }

    // Find a bot that has an 'en' row but (almost certainly) no 'xx' row.
    const [enRow] = await db!
      .selectFrom('bom_virtualgroup_prompts')
      .select(['bot_id', 'prompt'])
      .where('bot_id', 'is not', null)
      .where('lang', '=', 'en')
      .where('prompt', 'is not', null)
      .limit(1)
      .execute();

    if (!enRow?.bot_id) {
      console.warn('BLOCKED: no en bot row — skipping lang-fallback test');
      return;
    }

    const persona = await getPersona(db!, enRow.bot_id, 'xx_nonexistent_lang');
    expect(persona).not.toBeNull();
    // Should have fallen back to the 'en' prompt.
    expect(persona!.system).toBe(enRow.prompt!.trim());
  });

  it('returns a Persona from seed constants for known bot_id not in DB', async () => {
    if (!canRead) {
      console.warn('BLOCKED: DB unreachable — using null-db fallback path instead');
    }
    const dbToUse = db ?? buildNullDb();
    // Martin Luther's hardcoded bot_id from virtualgroup.ts
    const martinLutherId = '13b1c4fc58a87a68d4da51beb22a0ecd';

    // Delete any real DB row temporarily? No — we can't write.
    // Instead, if the DB has a row for this bot, the DB path runs (also fine).
    // If no row, the seed fallback runs.  Either way a non-null Persona is returned.
    const persona = await getPersona(dbToUse, martinLutherId, 'en');
    expect(persona).not.toBeNull();
    expect(typeof persona!.system).toBe('string');
    expect(persona!.system.length).toBeGreaterThan(10);
  });

  it('returns a Persona with the default prompt for a completely unknown bot_id', async () => {
    if (!canRead) {
      console.warn('BLOCKED: DB unreachable — skipping unknown-bot test');
      return;
    }

    const persona = await getPersona(db!, 'totally_unknown_bot_id_zzz', 'en');
    expect(persona).not.toBeNull();
    expect(typeof persona!.system).toBe('string');
    expect(persona!.system.length).toBeGreaterThan(0);
  });

  it('returns null gracefully when the DB throws (broken connection)', async () => {
    const brokenDb = buildBrokenDb();
    const persona = await getPersona(brokenDb, 'some_bot', 'en');
    expect(persona).toBeNull();
    await brokenDb.destroy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test DB helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a Kysely instance that will always fail on query (bad host). */
function buildBrokenDb(): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({
        host: '0.0.0.1',
        port: 1,
        database: 'no',
        user: 'no',
        password: 'no',
        connectTimeout: 500,
        connectionLimit: 1,
      }) as unknown as MysqlDialectConfig['pool'],
    }),
  });
}

/** A null-safe DB stand-in used in the Martin Luther seed-fallback test when DB is unavailable. */
function buildNullDb(): Kysely<DB> {
  return buildBrokenDb();
}
