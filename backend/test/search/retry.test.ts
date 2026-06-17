import { describe, expect, test } from 'vitest';
import { withRetry } from '../../src/search/retry.js';

describe('withRetry', () => {
  test('resolves if the fn succeeds on the first try', async () => {
    let calls = 0;
    const r = await withRetry(async () => { calls++; return 'ok'; }, { attempts: 3, delayMs: 1 });
    expect(r).toBe('ok');
    expect(calls).toBe(1);
  });
  test('retries then succeeds (fails twice, succeeds third)', async () => {
    let calls = 0;
    const r = await withRetry(async () => { calls++; if (calls < 3) throw new Error('socket'); return calls; }, { attempts: 3, delayMs: 1 });
    expect(r).toBe(3);
    expect(calls).toBe(3);
  });
  test('throws the last error after exhausting attempts', async () => {
    let calls = 0;
    await expect(withRetry(async () => { calls++; throw new Error(`fail-${calls}`); }, { attempts: 3, delayMs: 1 }))
      .rejects.toThrow('fail-3');
    expect(calls).toBe(3);
  });
});
