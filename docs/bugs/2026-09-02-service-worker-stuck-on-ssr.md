# Service worker serves a stale SSR shell forever ("stuck on SSR")

**Date:** 2026-09-02
**Area:** `frontend/webapp/public/sw.js` (hand-written service worker)
**Symptom:** A real browser (observed in Firefox) loads `https://bookofmormon.online/` and gets the **SSR page** (bare server-rendered HTML — big serif `<h1>`, description, unstyled link list) instead of the CRA React app. No `GET /` reaches the origin (confirmed in VictoriaLogs `bom_access` by client IP), the page runs a **stale JS bundle** (POSTs the old `/graphql` → 415 instead of `/graphql/en`), and Clicky never fires. Incognito (no SW/cache) loads the CRA correctly.

## Root cause — three compounding SW bugs
1. **Navigations were cache-first.** The catch-all fetch handler did `caches.match(request) || fetch(request)` for *all* requests including top-level document navigations, so `/` was served from cache before the network.
2. **`/` was precached as HTML.** `urlsToCache` included `'/'`; `cache.addAll(['/'])` at install fetched `/` and stored whatever came back. When that install happened for a client the front door classified as a crawler (the pre-2026-09-02 WebKit/Firefox gating bug — see [[gating-redesign-shipped]]), it cached the **SSR shell as the homepage**.
3. **The cache name never changed.** `const BUILD_VERSION = '{{BUILD_VERSION}}'` was a template that **nothing ever replaced**; the literal string is truthy so the `|| Date.now()` fallback never fired. Every deploy reused `bom-online-v{{BUILD_VERSION}}`, and `activate` only deletes caches with a *different* name — so the poisoned cache persisted **indefinitely**.

Net effect: any user who received SSR once was pinned to that stale SSR shell across deploys. The server-side gating fix corrected the *origin* (a clean/incognito request gets the CRA) but could not evict an already-poisoned client cache.

## Fix
`frontend/webapp/public/sw.js`:
- **Navigations → network-first**: added an `event.request.mode === 'navigate'` branch that fetches from the network first and falls back to cache only when offline; HTML is never written to the cache. A browser always gets the live app HTML while online.
- **Removed `'/'` from `urlsToCache`** — never precache HTML.
- **Robust cache versioning**: `CACHE_VERSION = BUILD_VERSION.indexOf('{{') === -1 ? BUILD_VERSION : String(Date.now())` (never reuse a constant name), plus a real per-build stamp.

`frontend/webapp/scripts/stamp-sw-version.js` (new) + `package.json` `postbuild`: replaces `{{BUILD_VERSION}}` in `build/sw.js` with `GITHUB_SHA` (else a build timestamp) so every deploy gets a unique cache name and `activate` evicts the previous cache.

## Self-heal
Shipping the changed `sw.js` makes browsers install the new SW on their next update check (≤24h). New SW = network-first navigations (poison can only serve as an offline fallback) + new cache name (activate deletes the poisoned cache). No user action required; a hard reload / clearing site data heals immediately.

## Follow-ups
- Ensure `/sw.js` is served with a short/no-cache `Cache-Control` so update checks aren't delayed.
- The SW has substantial half-built code (push, periodic-sync, badges — all TODO stubs); worth an audit later, out of scope here.
