# Authorized-host allowlist + canonical redirect — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redirect any host that is not on an explicit allowlist to the canonical English home (`bookofmormon.online`), preserving path + query, for both crawlers and browsers.

**Architecture:** A single source-of-truth host registry in `lib/locales.ts` (`HOST_LANG` ∪ `EN_EDITION_HOSTS`) classifies each request host. A new block in `middleware.ts`, placed after the existing `www` redirect and before the SSR/CRA branch, 301-redirects unauthorized non-infra hosts to canonical English. `safeHost()` in `lib/seo.ts` is tightened to defer to the same registry so SEO metadata shares one definition of "authorized."

**Tech Stack:** Next.js 14 middleware (edge), TypeScript, Playwright (route + unit tests run via `next dev` on port 3001).

**Spec:** `docs/superpowers/specs/2026-09-01-authorized-host-allowlist-redirect.md`

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `frontend/next/lib/locales.ts` | Host registry + classification helpers | Add `EN_EDITION_HOSTS`, `CANONICAL_EN_HOST`, `normalizeHost`, `isAuthorizedHost`, `isInfraHost` |
| `frontend/next/middleware.ts` | Request routing / redirects | Add unauthorized-host → canonical 301 block after the `www` redirect |
| `frontend/next/lib/seo.ts` | Canonical / og:url host validation | Tighten `safeHost` to use `isAuthorizedHost`; export it for unit test |
| `frontend/next/test/unit/locales.test.ts` | Unit tests for host helpers | Add `isAuthorizedHost` / `isInfraHost` describes |
| `frontend/next/test/unit/seo.test.ts` | Unit test for `safeHost` | **Create** |
| `frontend/next/test/routes/host-allowlist.test.ts` | Integration tests for the redirect | **Create** |
| `frontend/next/test/routes/korean.test.ts` | Existing host tests | Rewrite the `evil.example.com` case to expect 301 |
| `frontend/next/test/routes/seo-gating.test.ts` | Existing canonical tests | Rewrite both "canonical is host-aware" cases |

**Run tests from `frontend/next/`:**
- All: `npm test`
- One file: `npx playwright test test/unit/locales.test.ts`
- One case: `npx playwright test test/routes/host-allowlist.test.ts -g "preserves path"`

Unit tests (`test/unit/*`) import functions directly and need no server. Route tests (`test/routes/*`) auto-start `next dev` on :3001 via `playwright.config.ts`.

---

## Task 1: Host-classification helpers in `lib/locales.ts`

**Files:**
- Modify: `frontend/next/lib/locales.ts` (append after `langForHost`, ~line 49)
- Test: `frontend/next/test/unit/locales.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/next/test/unit/locales.test.ts` (and add the new imports to the top import line):

```ts
// top of file — extend the existing import:
import { langForHost, bcp47, isAuthorizedHost, isInfraHost, CANONICAL_EN_HOST } from '../../lib/locales'
```

```ts
test.describe('CANONICAL_EN_HOST', () => {
  test('is the apex and is itself authorized', () => {
    expect(CANONICAL_EN_HOST).toBe('bookofmormon.online')
    expect(isAuthorizedHost(CANONICAL_EN_HOST)).toBe(true) // never redirects to itself
  })
})

test.describe('isAuthorizedHost', () => {
  test('every HOST_LANG host is authorized', () => {
    expect(isAuthorizedHost('bookofmormon.online')).toBe(true)
    expect(isAuthorizedHost('swe.bookofmormon.online')).toBe(true)
    expect(isAuthorizedHost('buchmormon.de')).toBe(true)
    expect(isAuthorizedHost('몰몬경.kr')).toBe(true)
  })
  test('strips forwarded-chain, port, case', () => {
    expect(isAuthorizedHost('SWE.BOOKOFMORMON.ONLINE:443')).toBe(true)
    expect(isAuthorizedHost('buchmormon.de, proxy.internal')).toBe(true)
  })
  test('english aliases are NOT authorized', () => {
    expect(isAuthorizedHost('new.bookofmormon.online')).toBe(false)
    expect(isAuthorizedHost('opengraph.bookofmormon.online')).toBe(false)
    expect(isAuthorizedHost('sugardoodle.bookofmormon.online')).toBe(false)
    expect(isAuthorizedHost('ko.bookofmormon.online')).toBe(false) // ko host is 몰몬경.kr, not this
  })
  test('unrelated + empty hosts are NOT authorized', () => {
    expect(isAuthorizedHost('evil.example.com')).toBe(false)
    expect(isAuthorizedHost(null)).toBe(false)
    expect(isAuthorizedHost('')).toBe(false)
  })
})

test.describe('isInfraHost', () => {
  test('local / hostless / IP / single-label → infra (never redirected)', () => {
    expect(isInfraHost('localhost')).toBe(true)
    expect(isInfraHost('localhost:3001')).toBe(true)
    expect(isInfraHost('dev.local')).toBe(true)
    expect(isInfraHost('127.0.0.1')).toBe(true)
    expect(isInfraHost('10.0.1.12')).toBe(true)
    expect(isInfraHost('[::1]:8200')).toBe(true)
    expect(isInfraHost('bom-app')).toBe(true)  // single-label internal service name
    expect(isInfraHost('')).toBe(true)
    expect(isInfraHost(null)).toBe(true)
  })
  test('real public multi-label hosts → not infra', () => {
    expect(isInfraHost('new.bookofmormon.online')).toBe(false)
    expect(isInfraHost('bookofmormon.online')).toBe(false)
    expect(isInfraHost('evil.example.com')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend/next && npx playwright test test/unit/locales.test.ts`
Expected: FAIL — `isAuthorizedHost`/`isInfraHost`/`CANONICAL_EN_HOST` are not exported (`TypeError` / undefined).

- [ ] **Step 3: Implement the helpers**

Append to `frontend/next/lib/locales.ts` after `langForHost` ( end of file, before/after `bcp47`):

```ts
// Canonical English home — the redirect target for unauthorized hosts.
export const CANONICAL_EN_HOST = 'bookofmormon.online'

// Authorized English editions / brand-partner hosts. Empty for now.
// Future entries are hard-coded here, e.g. 'cofc.bookofmormon.online': 'en'.
// A host may SERVE only if it appears in HOST_LANG or here. (The value is a lang
// code for future use; langForHost still resolves these to 'en' until wired.)
export const EN_EDITION_HOSTS: Record<string, string> = {}

// Normalize a Host / x-forwarded-host value: first entry of a forwarded chain,
// no port, lowercased. Matches the stripping already done in langForHost/safeHost.
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? '').split(',')[0].trim().split(':')[0].toLowerCase()
}

// True only for explicitly-registered public site hosts.
export function isAuthorizedHost(host: string | null | undefined): boolean {
  const bare = normalizeHost(host)
  return bare in HOST_LANG || bare in EN_EDITION_HOSTS
}

// True for infra/local requests that must never be redirected (health checks,
// dev, IP literals, single-label internal names, hostless internal requests).
// Fails SAFE: an unrecognized internal host serves rather than 301s the site.
export function isInfraHost(host: string | null | undefined): boolean {
  const bare = normalizeHost(host)
  if (!bare) return true                                 // hostless / empty
  if (bare === 'localhost' || bare.endsWith('.local')) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bare)) return true   // IPv4 literal
  if (bare.startsWith('[')) return true                   // IPv6 literal, e.g. [::1]:port
  if (!bare.includes('.')) return true                    // single-label service name
  return false
}
```

Note: refactor `langForHost` (line 47) to reuse `normalizeHost` if you like, but it is optional — do not change its behavior.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend/next && npx playwright test test/unit/locales.test.ts`
Expected: PASS (all describes, including the pre-existing `langForHost`/`bcp47`).

- [ ] **Step 5: Commit**

```bash
git add frontend/next/lib/locales.ts frontend/next/test/unit/locales.test.ts
git commit -m "feat(next): host-classification helpers (isAuthorizedHost/isInfraHost)"
```

---

## Task 2: Middleware unauthorized-host redirect

**Files:**
- Modify: `frontend/next/middleware.ts` (insert after the `www` redirect, ~line 128)
- Test: `frontend/next/test/routes/host-allowlist.test.ts` (create)

- [ ] **Step 1: Write the failing integration tests**

Create `frontend/next/test/routes/host-allowlist.test.ts`:

```ts
import { test, expect } from '@playwright/test'

const bot = { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
// maxRedirects: 0 is REQUIRED — Playwright follows redirects by default, which
// would chase the 301 Location out to the live production site.
const noFollow = { maxRedirects: 0 as const }

test.describe('unauthorized host → canonical English 301', () => {
  test('preserves path + query', async ({ request }) => {
    const r = await request.get('/reign-of-judges/94?x=1', {
      headers: { ...bot, 'x-forwarded-host': 'sugardoodle.bookofmormon.online' },
      ...noFollow,
    })
    expect(r.status()).toBe(301)
    expect(r.headers()['location']).toBe('https://bookofmormon.online/reign-of-judges/94?x=1')
  })

  test('opengraph alias redirects even for a crawler UA (before SSR)', async ({ request }) => {
    const r = await request.get('/history/1841-03-15-x', {
      headers: { ...bot, 'x-forwarded-host': 'opengraph.bookofmormon.online' },
      ...noFollow,
    })
    expect(r.status()).toBe(301)
    expect(r.headers()['location']).toBe('https://bookofmormon.online/history/1841-03-15-x')
  })

  test('new alias redirects to canonical', async ({ request }) => {
    const r = await request.get('/read/1.nephi.1', {
      headers: { ...bot, 'x-forwarded-host': 'new.bookofmormon.online' },
      ...noFollow,
    })
    expect(r.status()).toBe(301)
    expect(r.headers()['location']).toBe('https://bookofmormon.online/read/1.nephi.1')
  })

  test('unrelated external domain redirects to canonical', async ({ request }) => {
    const r = await request.get('/people', {
      headers: { ...bot, 'x-forwarded-host': 'evil.example.com' },
      ...noFollow,
    })
    expect(r.status()).toBe(301)
    expect(r.headers()['location']).toBe('https://bookofmormon.online/people')
  })
})

test.describe('authorized + infra hosts are NOT redirected', () => {
  test('language host serves (200)', async ({ request }) => {
    const r = await request.get('/contents', {
      headers: { ...bot, 'x-forwarded-host': 'swe.bookofmormon.online' },
      ...noFollow,
    })
    expect(r.status()).toBe(200)
  })
  test('apex serves (200)', async ({ request }) => {
    const r = await request.get('/people', { headers: bot, ...noFollow })
    expect(r.status()).toBe(200)
  })
  test('localhost (no forwarded host) serves — harness default (200)', async ({ request }) => {
    const r = await request.get('/', { headers: bot, ...noFollow })
    expect(r.status()).toBe(200)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend/next && npx playwright test test/routes/host-allowlist.test.ts`
Expected: FAIL — the "301" cases currently return 200 (unauthorized hosts still serve).

- [ ] **Step 3: Add the import and the redirect block**

In `frontend/next/middleware.ts`, extend the locales import (line 2):

```ts
import { LANG_PREFIXES, LOCALE_SEGS, langForHost, isAuthorizedHost, isInfraHost, CANONICAL_EN_HOST } from '@/lib/locales'
```

Insert this block immediately after the `www.*` redirect (after line 128, before the Facsimiles block at ~line 130):

```ts
  // --- Host allowlist: unauthorized hosts → canonical English (path preserved) ---
  // Fires before the SSR/CRA branch, so crawlers AND browsers are forwarded.
  // Infra/local hosts (health checks, dev, IP literals, single-label names) pass
  // through. Keyed off x-forwarded-host because behind ALB→NPM the public host
  // arrives there, not in nextUrl.hostname (same reason langForHost reads it).
  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!isInfraHost(forwardedHost) && !isAuthorizedHost(forwardedHost)) {
    // Hardcode https — the site is HTTPS-only and markResponse sets HSTS; keying
    // off x-forwarded-proto risks emitting an http:// Location (extra upgrade hop).
    const target = `https://${CANONICAL_EN_HOST}${pathname}${request.nextUrl.search}`
    return markResponse(NextResponse.redirect(target, 301), clientClass)
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend/next && npx playwright test test/routes/host-allowlist.test.ts`
Expected: PASS (all 7 cases).

- [ ] **Step 5: Fix the two existing tests that this block breaks**

The middleware now 301s `evil.example.com` and `ko.bookofmormon.online` before SSR, so three existing assertions that expected a 200 + apex-fallback canonical must change.

In `frontend/next/test/routes/korean.test.ts`, replace the `untrusted host still falls back to apex` test (lines 51-54) with:

```ts
  test('untrusted host is redirected to canonical (not served)', async ({ request }) => {
    const r = await request.get('/people/nephi1', {
      headers: { ...bot, 'x-forwarded-host': 'evil.example.com' },
      maxRedirects: 0,
    })
    expect(r.status()).toBe(301)
    expect(r.headers()['location']).toBe('https://bookofmormon.online/people/nephi1')
  })
```

In `frontend/next/test/routes/seo-gating.test.ts`, replace the entire `canonical is host-aware` describe (lines 87-101) with:

```ts
test.describe('canonical is host-aware', () => {
  test('canonical uses x-forwarded-host + proto (authorized host)', async ({ request }) => {
    const r = await request.get('/people', {
      headers: { ...bot, 'x-forwarded-host': 'xn--289a67xla.kr', 'x-forwarded-proto': 'https' },
    })
    const html = await r.text()
    expect(html).toContain('rel="canonical" href="https://xn--289a67xla.kr/people"')
  })
  test('unauthorized x-forwarded-host is redirected to canonical (not served)', async ({ request }) => {
    const r = await request.get('/people', {
      headers: { ...bot, 'x-forwarded-host': 'evil.example.com', 'x-forwarded-proto': 'https' },
      maxRedirects: 0,
    })
    expect(r.status()).toBe(301)
    expect(r.headers()['location']).toBe('https://bookofmormon.online/people')
  })
})
```

- [ ] **Step 6: Run both affected files to verify green**

Run: `cd frontend/next && npx playwright test test/routes/host-allowlist.test.ts test/routes/korean.test.ts test/routes/seo-gating.test.ts`
Expected: PASS (all files).

- [ ] **Step 7: Commit**

```bash
git add frontend/next/middleware.ts frontend/next/test/routes/host-allowlist.test.ts frontend/next/test/routes/korean.test.ts frontend/next/test/routes/seo-gating.test.ts
git commit -m "feat(next): 301 unauthorized hosts to canonical English before SSR"
```

---

## Task 3: Tighten `safeHost()` to the single registry

**Files:**
- Modify: `frontend/next/lib/seo.ts` (`safeHost`, lines 113-118)
- Test: `frontend/next/test/unit/seo.test.ts` (create)

Rationale: unauthorized hosts no longer reach SSR (Task 2), but `safeHost` still trusts any `*.bookofmormon.online` for canonical/og:url. Route it through `isAuthorizedHost` so there is one definition of "authorized" (defense-in-depth for infra hosts that do reach SSR).

- [ ] **Step 1: Write the failing unit test**

Create `frontend/next/test/unit/seo.test.ts`:

```ts
import { test, expect } from '@playwright/test'
import { safeHost } from '../../lib/seo'

test.describe('safeHost', () => {
  test('authorized hosts pass through (with port preserved as today)', () => {
    expect(safeHost('bookofmormon.online')).toBe('bookofmormon.online')
    expect(safeHost('swe.bookofmormon.online')).toBe('swe.bookofmormon.online')
    expect(safeHost('xn--289a67xla.kr')).toBe('xn--289a67xla.kr')
  })
  test('localhost still allowed for dev/harness', () => {
    expect(safeHost('localhost')).toBe('localhost')
  })
  test('unregistered *.bookofmormon.online falls back to apex', () => {
    expect(safeHost('new.bookofmormon.online')).toBe('bookofmormon.online')
    expect(safeHost('ko.bookofmormon.online')).toBe('bookofmormon.online')
  })
  test('unrelated + empty fall back to apex', () => {
    expect(safeHost('evil.example.com')).toBe('bookofmormon.online')
    expect(safeHost(null)).toBe('bookofmormon.online')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend/next && npx playwright test test/unit/seo.test.ts`
Expected: FAIL — `safeHost` is not exported (import is `undefined`), and/or `new.bookofmormon.online` currently returns itself.

- [ ] **Step 3: Update `safeHost` and export it**

In `frontend/next/lib/seo.ts`, add `isAuthorizedHost` to the locales import at the top of the file (find the existing `from '@/lib/locales'` or `from './locales'` import and add it; if `HOST_LANG` is imported there, add alongside it), then replace `safeHost` (lines 113-118) with:

```ts
// x-forwarded-host is client-influenced; only trust registered hosts (+ localhost
// for dev/harness). Anything else falls back to the apex, so a crafted request
// can't inject an arbitrary canonical/og:url. Handles a comma-joined forwarded
// list and an optional :port. Shares one definition of "authorized" with the
// middleware allowlist (isAuthorizedHost).
export function safeHost(candidate: string | null): string {
  const host = (candidate ?? '').split(',')[0].trim()
  const bare = host.split(':')[0].toLowerCase()
  const ok = isAuthorizedHost(bare) || bare === 'localhost'
  return ok ? host : SITE_DOMAIN
}
```

(If `HOST_LANG` becomes unused in `seo.ts` after this change, remove it from the import to keep the lint clean.)

- [ ] **Step 4: Run the unit test + the SEO route suite**

Run: `cd frontend/next && npx playwright test test/unit/seo.test.ts test/routes/seo-gating.test.ts test/routes/hreflang.test.ts test/routes/read.test.ts`
Expected: PASS (canonical/og behavior unchanged for authorized hosts).

- [ ] **Step 5: Commit**

```bash
git add frontend/next/lib/seo.ts frontend/next/test/unit/seo.test.ts
git commit -m "refactor(next): safeHost defers to isAuthorizedHost (single allowlist)"
```

---

## Task 4: Full-suite regression + pre-ship note

**Files:** none (verification only)

- [ ] **Step 1: Run the entire Next test suite**

Run: `cd frontend/next && npm test`
Expected: PASS. If any test other than the three rewritten cases fails, it is a real regression — investigate before proceeding (grep that test for an injected `x-forwarded-host` not in `HOST_LANG`).

- [ ] **Step 2: Record the pre-ship verification requirement**

This change is safe to merge but MUST be validated against the real proxy chain before it is relied on in prod. The spec's acceptance criteria include: confirm whether prod ALB→NPM always sends `x-forwarded-host` and how `Host` is handled, so a dot-less/rewritten internal host can't 301 the whole site. Leave the spec's acceptance checklist as the source of truth; no code change here.

- [ ] **Step 3: Commit (only if `npm test` surfaced doc/nit fixes; otherwise skip)**

```bash
git add -A && git commit -m "test(next): green full suite after host allowlist"
```

---

## Self-Review Notes

- **Spec coverage:** registry + `EN_EDITION_HOSTS` (Task 1), middleware 301 before SSR with path/query + https + infra pass-through (Task 2), `safeHost` tightening (Task 3), rewritten breaking tests + `maxRedirects: 0` (Task 2 Step 5), full-suite + pre-ship note (Task 4). Loop safety asserted in Task 1 Step 1 (`isAuthorizedHost(CANONICAL_EN_HOST) === true`).
- **Type consistency:** helper names (`isAuthorizedHost`, `isInfraHost`, `normalizeHost`, `CANONICAL_EN_HOST`, `EN_EDITION_HOSTS`) are identical across locales.ts, middleware.ts, seo.ts, and all tests.
- **Deferred (future work, per spec):** `EN_EDITION_HOSTS` values are not yet consumed by `langForHost`; `www` redirect still keys off `nextUrl.hostname`. Neither blocks this feature.
