/**
 * test/graphql/homeSamplerCache.test.ts
 *
 * Unit tests for the server-side Home sampler cache (src/graphql/homeSamplerCache.ts).
 *
 * These are pure unit tests: the L2 store and the clock are injected, so no DB is
 * touched. They pin the behaviors the stern review demanded:
 *   - deterministic window seed (content cycles across 6h buckets)
 *   - single-flight (concurrent cold misses compute ONCE — no thundering herd)
 *   - L1 freshness + L2 read-through + best-effort L2 write (failures swallowed)
 *   - deep-freeze (cached object can't be mutated across requests)
 *   - eviction (old buckets don't accumulate forever)
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createHomeSamplerCache,
  currentBucket,
  seedForBucket,
  TTL_MS,
  type L2Adapter,
} from '../../src/graphql/homeSamplerCache.js';

// A controllable clock and an in-memory L2 whose behavior each test can shape.
function memL2(): L2Adapter & { store: Map<string, { content: unknown; ts: number }>; writes: number } {
  const store = new Map<string, { content: unknown; ts: number }>();
  return {
    store,
    writes: 0,
    async read(key) {
      return store.get(key) ?? null;
    },
    async write(key, content, ts) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      (this as { writes: number }).writes++;
      store.set(key, { content, ts });
    },
    async evict() {
      /* no-op for most tests */
    },
  };
}

describe('window seed', () => {
  it('is deterministic for a bucket and in [1, 2^31-1]', () => {
    const s = seedForBucket(12345);
    expect(s).toBe(seedForBucket(12345));
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(2 ** 31 - 1);
  });

  it('cycles content: adjacent buckets yield different seeds', () => {
    expect(seedForBucket(100)).not.toBe(seedForBucket(101));
  });

  it('currentBucket advances every TTL window', () => {
    const t = 1_000 * TTL_MS + 5;
    expect(currentBucket(t)).toBe(currentBucket(t + 1));
    expect(currentBucket(t)).not.toBe(currentBucket(t + TTL_MS));
  });
});

describe('getOrCompute', () => {
  it('computes once then serves from L1 (no recompute)', async () => {
    const l2 = memL2();
    const cache = createHomeSamplerCache({ l2, now: () => 0 });
    const compute = vi.fn(async () => ({ seed: 1 }));

    const a = await cache.getOrCompute('k', compute);
    const b = await cache.getOrCompute('k', compute);

    expect(a).toEqual({ seed: 1 });
    expect(b).toEqual({ seed: 1 });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('single-flights concurrent cold misses (one compute, not a herd)', async () => {
    const l2 = memL2();
    const cache = createHomeSamplerCache({ l2, now: () => 0 });
    let running = 0;
    let maxConcurrent = 0;
    const compute = vi.fn(async () => {
      running++;
      maxConcurrent = Math.max(maxConcurrent, running);
      await new Promise((r) => setTimeout(r, 20));
      running--;
      return { seed: 7 };
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => cache.getOrCompute('k', compute)),
    );

    expect(compute).toHaveBeenCalledTimes(1);
    expect(maxConcurrent).toBe(1);
    expect(results.every((r) => (r as { seed: number }).seed === 7)).toBe(true);
  });

  it('reads through to L2 without computing when L1 is cold but L2 is warm', async () => {
    const l2 = memL2();
    l2.store.set('k', { content: { seed: 42 }, ts: 0 });
    const cache = createHomeSamplerCache({ l2, now: () => 0 });
    const compute = vi.fn(async () => ({ seed: -1 }));

    const r = await cache.getOrCompute('k', compute);

    expect(r).toEqual({ seed: 42 });
    expect(compute).not.toHaveBeenCalled();
  });

  it('recomputes once the entry is older than the TTL', async () => {
    const l2 = memL2();
    let now = 0;
    const cache = createHomeSamplerCache({ l2, now: () => now });
    const compute = vi.fn(async () => ({ seed: now }));

    await cache.getOrCompute('k', compute);
    now = TTL_MS + 1; // one full window later
    await cache.getOrCompute('k', compute);

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('writes to L2 with a seconds timestamp', async () => {
    const l2 = memL2();
    const cache = createHomeSamplerCache({ l2, now: () => 9_000 }); // 9s in ms
    await cache.getOrCompute('k', async () => ({ seed: 1 }));
    expect(l2.writes).toBe(1);
    expect(l2.store.get('k')?.ts).toBe(9); // seconds, not ms
  });

  it('swallows L2 write failures and still returns the computed value', async () => {
    const l2: L2Adapter = {
      read: async () => null,
      write: async () => {
        throw new Error('read-only DB / sandbox suppressed');
      },
      evict: async () => {},
    };
    const cache = createHomeSamplerCache({ l2, now: () => 0 });
    const r = await cache.getOrCompute('k', async () => ({ seed: 5 }));
    expect(r).toEqual({ seed: 5 });
    // and L1 still serves it
    const compute = vi.fn(async () => ({ seed: 999 }));
    expect(await cache.getOrCompute('k', compute)).toEqual({ seed: 5 });
    expect(compute).not.toHaveBeenCalled();
  });

  it('deep-freezes the cached result so requests cannot mutate shared state', async () => {
    const l2 = memL2();
    const cache = createHomeSamplerCache({ l2, now: () => 0 });
    const r = (await cache.getOrCompute('k', async () => ({
      nested: { list: [1, 2] },
    }))) as { nested: { list: number[] } };
    expect(() => {
      r.nested.list.push(3);
    }).toThrow();
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.nested)).toBe(true);
  });

  it('does not cache a rejected compute (next call retries)', async () => {
    const l2 = memL2();
    const cache = createHomeSamplerCache({ l2, now: () => 0 });
    const compute = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ seed: 3 });

    await expect(cache.getOrCompute('k', compute)).rejects.toThrow('boom');
    const r = await cache.getOrCompute('k', compute);
    expect(r).toEqual({ seed: 3 });
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('evicts L1 entries older than two windows on write', async () => {
    const l2 = memL2();
    let now = 0;
    const cache = createHomeSamplerCache({ l2, now: () => now });
    await cache.getOrCompute('old', async () => ({ v: 'old' }));
    now = 3 * TTL_MS; // well beyond two windows later
    await cache.getOrCompute('new', async () => ({ v: 'new' }));
    // 'old' should be gone from L1; a fresh compute is required to get it back
    const compute = vi.fn(async () => ({ v: 'recomputed' }));
    // L2 still has it, so read-through serves it without compute — but L1 must
    // have dropped it, proving eviction ran. Assert via the internal accessor.
    expect(cache._l1Has('old')).toBe(false);
    expect(cache._l1Has('new')).toBe(true);
    await compute(); // keep the mock referenced without asserting compute count
  });
});
