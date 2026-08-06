# Home Tiles — Two-Layer Instant-Load Cache

**Date:** 2026-08-06
**Status:** Design approved, ready for implementation plan
**Author:** Claude (brainstorming session with KC)

## Problem

The Home sampler (`frontend/webapp/src/views/Home/tiles/`) always waits on the
network before it can paint. `Sampler.js` calls `BoMOnlineAPI(..., { useCache:
false })` for `homesampler` / `homegroups` / `leaderboard`, so every visit shows
skeletons until the compound GraphQL call resolves. The backend `homesampler`
resolver runs ~20 seeded DB queries per request (`backend/src/graphql/resolvers/homesampler.ts`),
which is the dominant cold-start cost.

**Goal:** the homepage should **always load instantly**, refresh on its own every
few hours, and be manually refreshable. Instant load is the primary requirement —
including for a cold client (empty local cache), which requires the server
response itself to be fast.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Background-revalidate UX | **Don't touch the current view** — fresh content applies on the *next* load (classic stale-while-revalidate) |
| Content stability | **Stable for the TTL** across tabs/sessions, then rolls over |
| TTL | **6 hours** |
| Social data (community/leaderboard) | **Not cached** — always fetched live each load; community tile shows its skeleton until it lands |
| Server cache store | **`bom_cache` table + in-process L1 Map** (best-effort writes, degrade gracefully on read-only DB) |
| Cold-start | Even a brand-new visitor should hit a fast server cache; the first visitor in a freshly-rolled window eats one full-compute request (acceptable) |

## The unifying mechanism: a 6-hour window seed

Both cache layers pivot on one idea.

- `bucket = Math.floor(now / TTL)` where `TTL = 6 * 3600 * 1000` ms.
- `windowSeed` = deterministic-but-arbitrary-looking positive int derived from
  `bucket` via Knuth multiplicative hashing, mapped into `[1, 2^31 - 1]`.

Every visitor in the same 6h window resolves the **same** `windowSeed` → the same
homepage → shared, cacheable, auto-rolling every 6 hours.

- **Front-door load** = client **omits** `seed` → server uses `windowSeed` and
  caches the result.
- **Manual refresh / infinite-scroll** = client sends an **explicit** random seed
  → server computes fresh, **uncached** (variety and freshness preserved).

This is the one behavioral change to the seed model. Today the client always
sends a session-random seed (`getSessionSeed` in `Sampler.js`); now the initial
load omits it to opt into the shared cached window.

## Architecture

Two independent data streams, two cache layers.

```
                         ┌─────────────────────────────────────────┐
   Sampler.js (client)   │  SAMPLER stream (cacheable)              │
                         │                                          │
   mount ──► read()  ────┤  localStorage  bom:homeSampler:v1        │  L-client
             │           │  { payload, seed, savedAt, authKey }     │  (instant paint)
             │ hit?      └─────────────────────────────────────────┘
             ▼
        paint instantly ──► fresh (<6h)?  yes ► no network
                            stale/cold?   ► fetch homesampler (NO seed)
                                             ├ cold  ► setPayload + write()
                                             └ stale ► write() only (apply next load)
                                     │
                                     ▼  GraphQL homesampler (no seed)
                         ┌─────────────────────────────────────────┐
   homesampler resolver  │  homeSamplerCache.get(key)               │
                         │   L1  in-process Map (instant, writable) │  L-server
                         │   L2  bom_cache table (durable, shared)  │
                         │  miss ► run ~20 seeded queries ► set()   │
                         │  key = homesampler:v1:${lang}:${bucket}  │
                         └─────────────────────────────────────────┘

                         ┌─────────────────────────────────────────┐
                         │  COMMUNITY stream (always live)          │
   mount ──────────────► │  GraphQL homegroups + leaderboard        │  never cached
             merge on    │  (token-aware)                           │
             arrival ◄───┤  community tile skeleton until it lands  │
                         └─────────────────────────────────────────┘
```

### Component 1 — `backend/src/graphql/homeSamplerCache.ts` (new)

Two-tier key/value cache. One clear purpose: cache serialized homesampler
payloads by key with a 6h freshness window.

- **L1** — module-level `Map<string, { content, timestamp }>`. Instant, always
  writable (covers the read-only dev DB case).
- **L2** — the `bom_cache` table (`key: string`, `content: Json`, `hash: string`,
  `timestamp: number`). Durable and shared across backend instances via the DB.
- `get(key)`:
  1. L1 entry fresh (`now - timestamp < TTL`)? → return it.
  2. else read `bom_cache` where `key = ?`; fresh? → populate L1, return.
  3. else miss (`null`).
- `set(key, content)`:
  1. Always write L1.
  2. Best-effort `bom_cache` upsert (`INSERT ... ON DUPLICATE KEY UPDATE`, or
     delete+insert per kysely capability). Wrap in `try/catch`; **swallow write
     errors** — a read-only dev DB silently no-ops and degrades to L1-only
     caching. Never throw into the resolver.
- `hash` column: store a content hash (e.g. length + cheap digest) for
  debugging/integrity; not required for correctness.

Because the cache key embeds `bucket`, TTL is effectively enforced by the key
(a new window = a new key = a miss). The `timestamp` freshness check is a
secondary guard against clock skew and stale L2 rows.

**Interface:** `get(key: string): Promise<Json | null>`, `set(key: string,
content: Json): Promise<void>`. Depends on: `ctx.db` (kysely) for L2. Testable in
isolation with a fake db.

### Component 2 — window-seed helper + resolver change (`homesampler.ts`)

New helper (co-located or in the cache module):

```
const TTL_MS = 6 * 3600 * 1000;
const currentBucket = (nowMs) => Math.floor(nowMs / TTL_MS);
const seedForBucket = (bucket) =>
  (((bucket * 2654435761) % 2147483647) + 2147483647) % 2147483647 || 1;
```

`homesampler` resolver:
- If `args.seed` is a valid positive integer → **explicit path**: compute fresh
  with that seed, no cache (today's behavior, unchanged). Covers manual refresh
  and infinite-scroll batches.
- Else → **front-door path**: `bucket = currentBucket(Date.now())`,
  `seed = seedForBucket(bucket)`, `key = homesampler:v1:${lang}:${bucket}`.
  - `cache.get(key)` hit → return it.
  - miss → run the existing `Promise.all` over `samplers`, assemble
    `{ seed, ...entries }`, `cache.set(key, result)`, return.
- `lang` is resolved the same way the samplers already resolve it (`ctx.lang`
  normalized to `en` for non-language paths); it is part of the key because
  `sampleCommentaries` / `sampleNotes` filter by `source_lang`.

### Component 3 — `frontend/webapp/src/views/Home/tiles/homeSamplerCache.js` (new)

Synchronous localStorage wrapper. Synchronous read is deliberate: it makes the
cached payload available on the **first** render, so a returning visitor sees
zero skeleton flash.

- `KEY = "bom:homeSampler:v1"`, `TTL_MS = 6 * 3600 * 1000`.
- Stored shape: `{ payload, seed, savedAt, authKey }`.
- `read(authKey)`:
  - `JSON.parse` inside `try/catch` → corrupt → `null`.
  - `entry.authKey !== authKey` → `null` (privacy: never paint another user's
    notes; `authKey = token || "guest"`).
  - returns `{ payload, seed, savedAt }` or `null`.
- `isStale(entry, nowMs)`: `nowMs - entry.savedAt > TTL_MS`.
- `write(payload, seed, authKey)`:
  - serialize; if over a size cap (~2 MB) skip silently.
  - `localStorage.setItem` inside `try/catch` → quota/errors swallowed.
- `clear()`.
- Version (`v1` in the key) invalidates old-shaped caches on schema changes —
  the same pattern as the chiasmus/page guards in `models/Cache.js`.

### Component 4 — `Sampler.js` orchestration

Split today's single combined call into two streams and add the cache flow.

**Payload assembly** — split `assemblePayload(r)` into:
- `assembleSampler(r)` → `{ ...sampler, commentary, commentary2, commentary3 }`
  (the cacheable content tiles).
- `assembleCommunity(r)` → the merged `community` object (from `homegroups` +
  `leaderboard`).
Render state merges them: `payload = { ...sampler, community }`.

**Sampler stream (cacheable):**
- Initial state seeds from `homeSamplerCache.read(authKey)`:
  - `useState(cached?.payload ?? null)` → instant first paint when warm.
  - `seed` initialized from `cached?.seed`.
- On mount:
  - **fresh cache** (`!isStale`): no sampler network call.
  - **stale cache**: fetch front-door (`{ homesampler: {} }`, no seed). On
    success `write()` the new payload+seed but **do not** `setPayload` — the
    current view is untouched; the fresh content applies on the next load. Only
    write on success, so a failed refetch simply stays stale and retries next
    load.
  - **cold** (no cache): fetch front-door; on success `setPayload` + `write()`.
    Skeletons show during this fetch (today's behavior).

**Community stream (always live):**
- Always fetch `{ homegroups: { token }, leaderboard: { token } }` each load.
- On arrival, `setPayload(prev => ({ ...prev, community }))` — fills the community
  tile; sampler tiles are untouched.

**Manual refresh (`home:resample`):**
- Generate a fresh random seed, fetch `{ homesampler: { seed } }` (explicit →
  server-fresh), `setPayload` (**swap the view** — explicit user action),
  `write()` the result, and reset the infinite-scroll accumulation as today.

**Infinite-scroll batches:** unchanged. They already pass explicit derived seeds
(`nextBatchSeed`) → server-fresh, uncached.

All API calls keep `{ useCache: false }` for the shared `BoMOnlineAPI`
IndexedDB cache — the new caching is purpose-built and lives outside that path,
so the shared per-query cache behavior is not altered.

## Cold-start behavior

| Visitor | First paint |
|---|---|
| Returning, client cache warm | **Instant** — synchronous localStorage paint, no network on the critical path |
| New visitor, server cache warm | Skeletons → **fast** server response (cache read, no 20-query recompute) → paint |
| First visitor in a freshly-rolled window (both layers cold) | One request pays the full compute and populates both layers for everyone else that window |

## Error handling & edge cases

- **Read-only dev DB**: `bom_cache` writes are best-effort; a failed write is
  swallowed and the server degrades to L1 (in-process) caching. Reads still work,
  so a warm row populated elsewhere is still served.
- **Corrupt/oversized localStorage**: `read` returns `null`, `write` swallows
  quota errors → degrades to today's live-fetch behavior.
- **Auth mismatch**: cache entry tagged with `authKey`; a different user (or
  guest ↔ logged-in transition) is a cache miss → live fetch.
- **Failed background revalidate**: cache not overwritten (`savedAt` unchanged) →
  stays stale → retried next load.
- **Schema changes**: bump the `v1` version in both the client key and the server
  key to invalidate old-shaped payloads.
- **Clock skew**: server freshness uses `bucket` in the key plus a `timestamp`
  guard; client freshness uses its own clock for paint only — revalidation always
  re-hits the authoritative server.

## Testing

**Backend** (vitest):
- `homeSamplerCache`: L1 hit; L2 hit re-populates L1; `set` writes L1 and attempts
  L2; L2 write failure is swallowed (read-only simulation); freshness window.
- `seedForBucket` / `currentBucket`: deterministic per bucket, distinct across
  buckets, always in `[1, 2^31-1]`.
- `homesampler` resolver: no-seed → cached and stable within a window, distinct
  across windows; explicit seed → fresh and not written to cache.

**Frontend** (jest/jsdom — localStorage available):
- `homeSamplerCache.js`: read/write round-trip; TTL staleness; version mismatch;
  authKey mismatch → miss; quota/oversize → silent skip.
- `Sampler`: paints from a warm cache with **no** network call on the sampler
  stream; a stale-triggered background fetch does **not** swap the visible tiles;
  manual refresh **does** swap; community stream merges without disturbing
  sampler tiles.

## Files touched

**New:**
- `backend/src/graphql/homeSamplerCache.ts`
- `frontend/webapp/src/views/Home/tiles/homeSamplerCache.js`
- backend + frontend test files for the above

**Modified:**
- `backend/src/graphql/resolvers/homesampler.ts` — window-seed front-door path +
  cache wrap
- `frontend/webapp/src/views/Home/Sampler.js` — split streams, instant paint,
  stale-while-revalidate, manual-refresh cache write

## Out of scope

- Caching the community/leaderboard streams (explicitly always-live).
- Changing the shared `BoMOnlineAPI` IndexedDB cache path.
- Infinite-scroll batch caching (batches stay fresh/uncached).
- Purging/precomputing windows via a cron warmer (possible future enhancement:
  a scheduled job that pre-populates `bom_cache` for the next window so no
  visitor ever eats the cold-window compute).
