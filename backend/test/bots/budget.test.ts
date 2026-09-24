import { afterEach, describe, expect, test } from 'vitest';
import { consumeBotGenerationBudget } from '../../src/bots/budget.js';

const saved = { ...process.env };
afterEach(() => {
  for (const key of ['BOT_LLM_MOCK', 'BOT_LLM_HOURLY_LIMIT', 'BOT_LLM_DAILY_LIMIT']) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('bot generation budget', () => {
  test('fails closed without Redis', async () => {
    delete process.env.BOT_LLM_MOCK;
    await expect(consumeBotGenerationBudget(null)).resolves.toEqual({
      allowed: false,
      reason: 'limiter-unavailable',
    });
  });

  test('does not charge deterministic mock generation', async () => {
    process.env.BOT_LLM_MOCK = '1';
    await expect(consumeBotGenerationBudget(null)).resolves.toEqual({ allowed: true });
  });

  test('reports an hourly limit from the atomic Redis result', async () => {
    const redis = { eval: async () => [0, 31, 31, 1] };
    await expect(consumeBotGenerationBudget(redis)).resolves.toEqual({
      allowed: false,
      reason: 'hourly-limit',
      hourlyCount: 31,
      dailyCount: 31,
    });
  });

  test('fails closed when Redis errors', async () => {
    const redis = { eval: async () => { throw new Error('offline'); } };
    await expect(consumeBotGenerationBudget(redis)).resolves.toEqual({
      allowed: false,
      reason: 'limiter-error',
    });
  });
});
