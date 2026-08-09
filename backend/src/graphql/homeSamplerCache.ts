/**
 * homeSamplerCache — two-tier, single-flight cache for the `homesampler` payload.
 * Design: docs/specs/2026-08-06-home-tiles-two-layer-cache-design.md
 *
 * L1 = in-process Map (instant, always writable — carries dev where L2 writes are
 *      sandbox-suppressed) + an in-flight Promise map so concurrent cold misses
 *      share ONE compute (no thundering herd at a window roll).
 * L2 = the `bom_cache` table (durable, shared across instances), reached through
 *      an injected adapter so this core stays unit-testable without a DB.
 *
 * The cache is keyed by a string the caller builds (e.g.
 * `homesampler:v2:${lang}:${bucket}`). Freshness is a 6h window; results are
 * deep-frozen before caching so a field resolver can't mutate state shared across
 * every request in the window.
 */

/** 6-hour content window. Both the server cache and the client cache pivot on it. */
export const TTL_MS = 6 * 3600 * 1000;
const TTL_S = TTL_MS / 1000;

/** Which 6h window a millisecond timestamp falls in. */
export const currentBucket = (nowMs: number): number => Math.floor(nowMs / TTL_MS);

/**
 * Deterministic, arbitrary-looking positive seed for a window bucket, in
 * [1, 2^31-1]. Every visitor in the same window derives the same seed → the same
 * shared, cacheable homepage that cycles automatically as buckets advance.
 * Knuth multiplicative hashing.
 */
export const seedForBucket = (bucket: number): number =>
  (((bucket * 2654435761) % 2147483647) + 2147483647) % 2147483647 || 1;

/** The durable second tier. Timestamps are Unix SECONDS (bom_cache.timestamp is INT). */
export interface L2Adapter {
  read(key: string): Promise<{ content: unknown; ts: number } | null>;
  write(key: string, content: unknown, ts: number): Promise<void>;
  evict(beforeTs: number): Promise<void>;
}

export interface CacheDeps {
  l2: L2Adapter;
  /** Current time in ms. Injected so tests control the clock. */
  now: () => number;
}

/** Recursively freeze so no request can mutate the object shared across the window. */
function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

export function createHomeSamplerCache(deps: CacheDeps) {
  const l1 = new Map<string, { content: unknown; ts: number }>(); // ts in seconds
  const inflight = new Map<string, Promise<unknown>>();

  const nowS = () => Math.floor(deps.now() / 1000);
  const fresh = (ts: number) => nowS() - ts < TTL_S;

  function evictL1(beforeTs: number): void {
    for (const [k, v] of l1) if (v.ts < beforeTs) l1.delete(k);
  }

  async function getOrCompute<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = l1.get(key);
    if (hit && fresh(hit.ts)) return hit.content as T;

    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;

    // Register the in-flight promise SYNCHRONOUSLY (before any await) so
    // concurrent cold callers share this one — otherwise they all slip past the
    // in-flight check while the first is awaiting L2/compute (the thundering herd).
    const p = (async () => {
      // L2 read-through (best-effort: a read fault degrades to a compute).
      try {
        const row = await deps.l2.read(key);
        if (row && fresh(row.ts)) {
          const frozen = deepFreeze(row.content);
          l1.set(key, { content: frozen, ts: row.ts });
          return frozen;
        }
      } catch {
        /* ignore L2 read faults */
      }
      const result = deepFreeze(await compute());
      const ts = nowS();
      l1.set(key, { content: result, ts });
      evictL1(ts - 2 * TTL_S);
      try {
        await deps.l2.write(key, result, ts);
        await deps.l2.evict(ts - 2 * TTL_S);
      } catch {
        /* best-effort: read-only user / sandbox-suppressed write / etc. */
      }
      return result;
    })();
    inflight.set(key, p);
    try {
      return (await p) as T;
    } finally {
      inflight.delete(key);
    }
  }

  return {
    getOrCompute,
    /** Test-only: is this key currently in L1? */
    _l1Has: (key: string) => l1.has(key),
  };
}

export type HomeSamplerCache = ReturnType<typeof createHomeSamplerCache>;
