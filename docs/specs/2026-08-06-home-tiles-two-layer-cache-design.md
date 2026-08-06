# Home Tiles — Two-Layer Instant-Load Cache

**Date:** 2026-08-06
**Status:** Design approved (revised after stern review), ready for implementation plan
**Author:** Claude (brainstorming session with KC)

> **Revision note (2026-08-06):** a stern review verified this design against the
> live DB and running resolver and found the first draft's L2 section written
> against a wrong-shaped table, a synchronized thundering-herd, and two client
> race conditions. This revision fixes all of them. Facts below (DDL, timings,
> payload size, query count) are measured, not assumed — see **Verified facts**.

## Problem

The Home sampler (`frontend/webapp/src/views/Home/tiles/`) always waits on the
network before it can paint. `Sampler.js` calls `BoMOnlineAPI(..., { useCache:
false })` for `homesampler` / `homegroups` / `leaderboard`, so every visit shows
skeletons until the compound GraphQL call resolves. The `homesampler` resolver
(`backend/src/graphql/resolvers/homesampler.ts`) runs ~25 seeded DB queries per
request and was measured at **~10 s** uncached on dev — the dominant cold-start
cost.

**Goal:** the homepage should **always load instantly**, refresh itself every few
hours, and be manually refreshable. Instant load is the primary requirement,
*including* a cold client (empty local cache), which requires the server response
itself to be fast.

## Verified facts (checked against live system, 2026-08-06)

- **`bom_cache` DDL** (`SHOW CREATE TABLE`):
  ```sql
  `key` varchar(255) NOT NULL,
  `hash` varchar(32) NOT NULL,
  `timestamp` int NOT NULL,      -- Unix SECONDS
  `content` json NOT NULL,
  PRIMARY KEY (`hash`),
  KEY `key` (`key`)              -- non-unique secondary index
  ```
  15 rows, all stale from Aug 2025 (`timestamp` ~1.7556e9 → seconds). No code in
  `backend/` references this table today. Consequences the design MUST respect:
  the upsert target is **`hash`** (not `key`); `hash` and `content` are
  `NOT NULL`; `timestamp` is **seconds** in a signed `INT` (max 2147483647 — a
  millisecond `Date.now()` overflows it).
- **Resolver timing:** ~10 s uncached (three dev runs). The full sampler payload
  is **~90–98 KB** of JSON. `samplers` runs ~25 queries (a few samplers re-invoke
  others: `sampleFaxPages`/`sampleFaxMore` re-run `sampleFax`; `sampleSectionNext`
  re-runs `sampleSection`).
- **Payload is fully public.** Every entry in the `samplers` map is public
  content (people, places, commentary, `notes`=scholarly annotations, art,
  witnesses, mapstory, …). `mybookmark` is a *separate* resolver Sampler.js does
  not call; the `homesampler` resolver ignores `args.token`. → **No per-user cache
  partitioning is needed; the cache is intentionally shared across all users.**
- **Dev writes are suppressed twice over.** `sandboxDialect` (db.ts:48) drops
  every kysely write at the driver when `env.SANDBOX` is set (dev), and the dev
  DB user may be read-only. → The durable L2 layer only truly exercises in prod;
  in dev, the in-process L1 carries caching. This is accepted, not a bug.
- **Client `token` is async.** `appController.states.user.token` is `null` at
  mount (appController.js:95) and set after `tokenSignIn` resolves. But it is
  irrelevant here: the sampler stream is public and needs no token (see above).

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Background-revalidate UX | **Don't touch the current view** — fresh content applies on the *next* load (stale-while-revalidate) |
| Content stability | **Stable for the TTL window**, then rolls over; shared across tabs/sessions |
| TTL | **6 hours** |
| Social data (community/leaderboard) | **Not cached** — always fetched live; community tile shows its skeleton until it lands |
| Server cache store | **`bom_cache` table (L2) + in-process Map (L1)**, single-flight, best-effort writes |
| Cold-start | New visitor hits a fast server cache; the first visitor per window pays one compute — *deduplicated by single-flight* so it is genuinely one, not a herd |

### Why `bom_cache`, not Redis (recorded per review)

Redis (`backend/src/config/redis.ts`) was considered and rejected: `REDIS_URL` is
unset in dev so `getRedis()` returns `null` (no caching there), and it is
ephemeral across restarts. `bom_cache` is durable, shared across backend
instances via the DB with no extra infra, and its **reads work on a read-only DB**.
Honest trade-off: for *writes*, both are inert in dev (Redis null; `bom_cache`
sandbox-suppressed), so dev caching is L1-only either way; L2 is a prod
optimization. Accepted.

## The unifying mechanism: a 6-hour window seed

- `bucket = Math.floor(nowMs / TTL_MS)`, `TTL_MS = 6 * 3600 * 1000`.
- `windowSeed = seedForBucket(bucket)` — deterministic positive int in
  `[1, 2^31-1]` via Knuth multiplicative hashing.

Everyone in a window resolves the same `windowSeed` → the same homepage → shared,
cacheable, auto-rolling every 6 h.

- **Front-door load** = client **omits** `seed` → server uses `windowSeed`.
- **Manual refresh** = client sends an explicit random seed → unique → misses
  cache → fresh compute (freshness preserved; eviction bounds these one-off rows).
- **Infinite-scroll batches** = deterministic seeds derived from `windowSeed`
  (`nextBatchSeed`) → identical for all visitors in the window → cacheable.

This is the one behavioral change to the seed model: today the client always
sends a session-random seed (`getSessionSeed`); now the initial load omits it.
`sessionStorage.samplerSeed` / `getSessionSeed` become vestigial and are removed;
downstream batch seeds derive from the payload's returned `seed` (= `windowSeed`).

## Architecture

Two independent data streams; the sampler stream is cached at two levels.

```
   Sampler.js (client)          SAMPLER stream (cacheable, PUBLIC)
   ───────────────────
   mount ─► cacheRead()  ── localStorage  bom:homeSampler:v1
            │                { payload, seed, bucket }        L-client (instant paint)
            │ entry.bucket === currentBucket ?
            ▼
   fresh ► paint, NO network
   stale/absent ► fetch homesampler (NO seed)
                   ├ absent ► setSamplerPayload + cacheWrite   (skeletons until land)
                   └ stale  ► cacheWrite only, DON'T setState   (applies next load)
                        │
                        ▼ GraphQL homesampler (no seed)
   homesampler resolver ── homeSamplerCache.getOrCompute(key, compute)
                            L1 in-process Map + in-flight Promise (single-flight)
                            L2 bom_cache  (hash=md5(key) PK upsert, seconds TTL)
                            key = homesampler:v1:${lang}:${bucket}

   COMMUNITY stream (always live, never cached)
   ───────────────────
   mount ─► GraphQL homegroups + leaderboard (token) ─► setCommunity(...)
            merged into render payload only; sampler tiles untouched
```

### Component 1 — `backend/src/graphql/homeSamplerCache.ts` (new)

A two-tier, single-flight cache. One purpose: memoize `homesampler` payloads by a
string key with a 6 h window.

**State (module-level):**
- `l1: Map<string, { content: unknown; ts: number /*seconds*/ }>`
- `inflight: Map<string, Promise<unknown>>`

**`getOrCompute(db, key, computeFn): Promise<unknown>`**
1. `l1` entry with `now - ts < TTL_seconds`? → return its `content`.
2. `inflight.get(key)`? → return that promise (**single-flight**: concurrent
   misses share one compute — fixes the thundering herd).
3. Read L2: `SELECT content, timestamp FROM bom_cache WHERE hash = ?`
   (`hash = md5(key)`, PK lookup). Fresh (`now_s - timestamp < TTL_s`)? → populate
   L1, return. (mysql2 auto-parses the `json` column → `content` is already an
   object; do **not** double-parse.)
4. Miss: create `p = computeFn()`, store in `inflight`. On resolve:
   - **deep-freeze** the result (prevents a child field resolver from mutating the
     object shared across all requests in the window), store in L1 with `ts`,
     best-effort L2 write, `evict()`, `inflight.delete(key)`, return.
   - On reject: `inflight.delete(key)`, rethrow (caller falls back to a fresh
     uncached compute for that request).

**L2 write (best-effort, `try/catch` swallowed):**
```sql
INSERT INTO bom_cache (`hash`, `key`, `timestamp`, `content`)
VALUES (?, ?, ?, CAST(? AS JSON))
ON DUPLICATE KEY UPDATE `timestamp` = VALUES(`timestamp`), `content` = VALUES(`content`)
```
- `hash = md5(key)` (32 hex) → PK, so the upsert actually fires.
- `timestamp = Math.floor(Date.now() / 1000)` (**seconds**, fits INT).
- `content` = `JSON.stringify(result)` bound as a string and `CAST … AS JSON`
  (explicit stringify on write; mysql2 does not auto-stringify for us).
- Errors (sandbox suppression, read-only user, INT edge) are caught and ignored →
  degrades to L1-only.

**`evict()`** (bounds growth — the table already has abandoned rows):
- L1: delete entries with `ts < now_s - 2*TTL_s`.
- L2 (best-effort): `DELETE FROM bom_cache WHERE \`key\` LIKE 'homesampler:v1:%'
  AND \`timestamp\` < ?` (`now_s - 2*TTL_s`). Keeps at most ~2 windows per lang
  plus transient manual-refresh rows.

**Cross-instance note:** single-flight is per-process. Two backend instances can
each compute once at a window roll (bounded, ≤ instance count), then share via L2.
Acceptable.

### Component 2 — window-seed helper + resolver change (`homesampler.ts`)

```
const TTL_MS = 6 * 3600 * 1000;
const currentBucket = (nowMs) => Math.floor(nowMs / TTL_MS);
const seedForBucket = (bucket) =>
  (((bucket * 2654435761) % 2147483647) + 2147483647) % 2147483647 || 1;
```

`homesampler` resolver:
- **Explicit valid `seed`** → today's fresh path, **but** still routed through
  `getOrCompute(db, \`homesampler:v1:${lang}:seed:${seed}\`, …)`. Manual-refresh
  random seeds miss-then-evict (bounded); deterministic batch seeds shared per
  window get cached — fixing the "every visitor recomputes batch-1" waste.
- **No/invalid `seed`** (front-door) → `bucket = currentBucket(Date.now())`,
  `seed = seedForBucket(bucket)`, key `homesampler:v1:${lang}:${bucket}`,
  `getOrCompute(...)`.
- `computeFn` = the existing `Promise.all` over `samplers`, returning
  `{ seed, ...entries }`.
- `lang` (from `ctx.lang`, normalized to `en` for non-language paths, exactly as
  the samplers already do) is part of every key — commentaries/notes are
  language-filtered.
- If `getOrCompute` throws, the resolver falls back to a direct uncached compute
  so a cache fault never fails the request.

### Component 3 — `frontend/webapp/src/views/Home/tiles/homeSamplerCache.js` (new)

Synchronous localStorage wrapper — sync read makes the payload available on the
**first** render (measured payload ~90–98 KB; `JSON.parse` is sub-millisecond).

- `KEY = "bom:homeSampler:v1"`, `TTL_MS = 6 * 3600 * 1000`.
- Stored shape: `{ payload, seed, bucket }` (**bucket, not savedAt** — client
  freshness aligns exactly to the server window; no "up to 12 h old" drift).
- **SSR-safe:** every entry point guards `typeof window === "undefined"` and
  wraps the *whole* `localStorage` access (property access itself can throw
  `SecurityError` when storage is disabled) in `try/catch`. (Next's bot-SSR path
  server-renders without `localStorage`; must no-op there.)
- `read()`: guarded parse → `{ payload, seed, bucket } | null`. No authKey — the
  payload is public and the cache is deliberately shared.
- `isFresh(entry, nowMs)`: `entry.bucket === Math.floor(nowMs / TTL_MS)`.
- `write(payload, seed)`: stamps `bucket = current`; size-guard (skip if the
  serialized entry is implausibly large, e.g. > 1 MB — real is ~90 KB);
  guarded `setItem`.
- `clear()`. Version (`v1`) invalidates old-shaped caches, mirroring the
  chiasmus/page guards in `models/Cache.js`.

### Component 4 — `Sampler.js` orchestration

**Split state (fixes the community-first race).** Keep two independent pieces of
state and derive the render payload — never let community presence make the render
payload truthy before the sampler is loaded:
```
const [samplerPayload, setSamplerPayload] = useState(() => cacheRead()?.payload ?? null);
const [community, setCommunity] = useState(null);
const payload = useMemo(
  () => (samplerPayload ? { ...samplerPayload, community } : null),
  [samplerPayload, community],
);
```
`renderTile`'s skeleton branch stays keyed on `!payload`, which is now driven by
`samplerPayload` only. The primer, IntersectionObserver, and balancer already gate
on `payload` and therefore correctly wait for the sampler, not for community.

**Payload assembly** — split `assemblePayload` into `assembleSampler(r)`
(`{ ...sampler, commentary, commentary2, commentary3 }`) and `assembleCommunity(r)`
(the merged `community` object from `homegroups` + `leaderboard`).

**Sampler stream (cacheable, no token):**
- Initial state seeds from `cacheRead()` → instant paint when a fresh (same-bucket)
  entry exists.
- On mount:
  - **fresh** (`isFresh`): no sampler network call.
  - **stale or absent**: fetch `{ homesampler: {} }` (no seed).
    - absent → `setSamplerPayload` + `write`.
    - stale → `write` only, **don't** `setState` (applies next load; only write on
      success, so a failed revalidate stays stale and retries next load).
  - **Preserve today's failure path**: the cold fetch keeps the existing
    retry-once-then-`SamplerFallback` behavior (Sampler.js:300-311, 515). A failed
    cold fetch must not spin skeletons forever.

**Community stream (always live):** always fetch `{ homegroups: { token },
leaderboard: { token } }`; `setCommunity(assembleCommunity(r))` on arrival. Never
cached.

**Manual refresh (`home:resample`):** random seed → fetch `{ homesampler: { seed } }`
→ `setSamplerPayload` (**swap the view** — explicit action) → `write` stamped with
the current bucket (so a reload keeps the just-refreshed sample until the window
rolls, then it returns to the shared window sample — consistent with "stable for
the TTL"). Reset infinite-scroll accumulation as today.

**Infinite scroll:** **defer the prefetch until scroll intent** — remove the
mount-time primer (today Sampler.js:233 fires `prefetchBatch()` the instant the
payload lands, i.e. on *every* load including warm instant-paints). Prefetch only
when the sentinel/observer indicates the reader is approaching the bottom. Batch
requests use deterministic derived seeds and now hit the server cache (Component 2),
so the first scroller per window computes batch-1 and everyone else gets it warm.

All calls keep `{ useCache: false }` for the shared `BoMOnlineAPI` IndexedDB path —
this caching is purpose-built and lives outside it.

## Cold-start behavior

| Visitor | First paint |
|---|---|
| Returning, client cache fresh (same bucket) | **Instant** — sync localStorage paint, no network on the critical path |
| New visitor, server cache warm | Skeletons → **fast** server response (cache read, no ~25-query recompute) → paint |
| First visitor per window (both layers cold) | **One** full compute (single-flight dedups all concurrent arrivals), populating both layers for the rest of the window |

## Error handling & edge cases

- **Thundering herd** → L1 in-flight-Promise single-flight; concurrent front-door
  misses share one compute.
- **Community-first race** → split state; render payload derives from
  `samplerPayload`; skeletons keyed on sampler presence, not merged truthiness.
- **Read-only / sandbox dev DB** → L2 writes best-effort and swallowed; reads work;
  degrades to L1-only. No error surfaces.
- **`bom_cache` shape** → `hash=md5(key)` PK upsert; seconds `timestamp`; explicit
  `JSON.stringify` + `CAST AS JSON` on write; parsed object on read.
- **Cross-request mutation** → compute result deep-frozen before entering L1.
- **Unbounded growth** → `evict()` on L1 and L2 (≤ 2 windows + transient refresh
  rows).
- **Client freshness drift** → client stores/compares `bucket`, aligned to the
  server window (no savedAt-relative 12 h drift).
- **SSR / storage-disabled** → `typeof window` guard + `try/catch` around the whole
  localStorage access.
- **Corrupt / oversized localStorage** → `read` returns `null`, `write` silently
  skips → degrades to live fetch.
- **Failed background revalidate** → cache not overwritten → stays stale → retried
  next load.
- **Failed cold fetch** → existing retry-once + `SamplerFallback` preserved.
- **Schema changes** → bump `v1` in both the client key and the server key prefix.

## Testing

**Backend** (vitest):
- `homeSamplerCache`: L1 fresh hit; L2 hit repopulates L1; **single-flight** (two
  concurrent `getOrCompute` on a cold key → `computeFn` called once); `set` writes
  L1 and attempts the L2 upsert with `hash=md5(key)` and seconds `timestamp`; L2
  write failure swallowed; deep-freeze prevents mutation; `evict` drops >2-window
  entries.
- `seedForBucket`/`currentBucket`: deterministic per bucket, distinct across
  buckets, always in `[1, 2^31-1]`.
- `homesampler` resolver: no-seed → cached & stable within a bucket, distinct
  across buckets; explicit random seed → computed then evicted; deterministic
  batch seed → shared/cached; a thrown cache fault → fresh fallback, request still
  succeeds.

**Frontend** (jest/jsdom):
- `homeSamplerCache.js`: read/write round-trip; **bucket-based** freshness (same
  bucket fresh, next bucket stale); version mismatch → miss; oversize → skip;
  storage-disabled/SSR (`window` undefined, `setItem` throws) → no-throw no-op.
- `Sampler`: warm-cache mount paints with **no** sampler network call; a
  stale-triggered background fetch does **not** swap the visible tiles; manual
  refresh **does** swap; **community arriving before the sampler does not blank the
  page** (skeletons remain until `samplerPayload` lands); prefetch does **not**
  fire on a warm instant-paint mount.

## Files touched

**New:**
- `backend/src/graphql/homeSamplerCache.ts`
- `frontend/webapp/src/views/Home/tiles/homeSamplerCache.js`
- backend + frontend test files for the above

**Modified:**
- `backend/src/graphql/resolvers/homesampler.ts` — window-seed front-door path,
  `getOrCompute` wrap for both seeded and unseeded requests, fresh fallback
- `frontend/webapp/src/views/Home/Sampler.js` — split state/streams, instant paint,
  stale-while-revalidate, deferred prefetch, manual-refresh cache write; remove
  `getSessionSeed`/`sessionStorage.samplerSeed`

## Out of scope

- Caching the community/leaderboard streams (explicitly always-live).
- Changing the shared `BoMOnlineAPI` IndexedDB cache path.
- **Cron warmer** (future): a scheduled job that pre-populates `bom_cache` for the
  *next* bucket just before it rolls, so even the first visitor per window never
  eats the compute. Not needed given single-flight, but the highest-value follow-up.
- Cross-instance single-flight (a distributed lock); the per-process guard + L2
  sharing is sufficient here.
