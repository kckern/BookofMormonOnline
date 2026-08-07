/**
 * homeSamplerCache — synchronous localStorage cache for the Home sampler payload.
 * Design: docs/specs/2026-08-06-home-tiles-two-layer-cache-design.md
 *
 * Synchronous by design: the payload is available on the FIRST render, so a
 * returning visitor sees zero skeleton flash. Freshness is keyed to the SAME 6h
 * window the server uses (bucket = floor(now / TTL)), so client and server roll
 * over together — no savedAt-relative drift.
 *
 * The sampler payload is public content (verified: the homesampler resolver
 * samples only public data), so the cache is intentionally shared — no per-user
 * partitioning. Community/leaderboard are NOT cached (always live).
 *
 * Every access is guarded: accessing `localStorage` itself can throw
 * (SecurityError when storage is disabled) and we may run under SSR (Next's
 * bot path) where `window` is undefined — both degrade to a no-op / live fetch.
 */

// Version in the key invalidates old-shaped payloads on schema changes, the same
// pattern as the chiasmus/page guards in models/Cache.js. Bump on shape change.
const KEY = "bom:homeSampler:v1";
export const TTL_MS = 6 * 3600 * 1000; // 6h — matches the server window
// Real payload measures ~90-98KB; skip anything wildly larger rather than risk a
// quota error or a pathological blob.
const MAX_BYTES = 1_000_000;

export const currentBucket = (nowMs) => Math.floor(nowMs / TTL_MS);

/** Safe handle to localStorage, or null under SSR / disabled storage. */
function store() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage || null;
  } catch {
    return null; // property access itself can throw (SecurityError)
  }
}

/** Read the cached entry, or null. Never throws. */
export function read() {
  const ls = store();
  if (!ls) return null;
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== "object" || !entry.payload) return null;
    return entry; // { payload, seed, bucket }
  } catch {
    return null;
  }
}

/** True when the entry belongs to the current 6h window. */
export function isFresh(entry, nowMs = Date.now()) {
  return !!entry && entry.bucket === currentBucket(nowMs);
}

/** Best-effort write, stamped with the current bucket. Never throws. */
export function write(payload, seed, nowMs = Date.now()) {
  const ls = store();
  if (!ls) return;
  try {
    const serialized = JSON.stringify({ payload, seed, bucket: currentBucket(nowMs) });
    if (serialized.length > MAX_BYTES) return; // size guard
    ls.setItem(KEY, serialized);
  } catch {
    /* quota / security / SSR — degrade to no cache */
  }
}

/** Remove the cached entry. Never throws. */
export function clear() {
  const ls = store();
  if (!ls) return;
  try {
    ls.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
