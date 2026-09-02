# SSR/CRA Gating Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ad-hoc browser-vs-crawler gate in the Next front door with one pure `classify.ts` module (isbot-based), fix the iOS/in-app-WebView misroutes, make responses cache-safe (`Vary`/`Cache-Control`), and make both misroute directions observable via richer logs + documented LogsQL queries.

**Architecture:** A pure `lib/classify.ts` owns the decision and returns a `Decision` object. `middleware.ts` calls it, routes (CRA/SSR/asset/redirect), sets cache headers, and logs one JSON line per navigation. `ops/telemetry/vector.yaml`'s `crawler_family` taxonomy is aligned to the app and guarded by a drift test. Observability is query-time `unpack_json` LogsQL over the existing Vector→VictoriaLogs stream.

**Tech Stack:** Next.js 15 (edge middleware), TypeScript, `isbot` v5, Playwright (test runner, incl. `test/unit/*.test.ts`), `js-yaml`, Vector + VictoriaLogs (LogsQL).

**Working directory for all commands:** `/home/bom/BookofMormonOnline/frontend/next` unless stated otherwise.

**Source of truth:** `docs/superpowers/specs/2026-09-02-ssr-cra-gating-redesign-design.md`.

---

## File structure

- **Create** `frontend/next/lib/classify.ts` — pure classifier; exports `classify()`, the `Decision`/`RenderMode`/`ClientClass`/`CrawlerFamily` types, and `BROWSER_UA_RE`. Single source of truth for the routing decision.
- **Create** `frontend/next/test/unit/classify.test.ts` — unit tests for `classify()`.
- **Create** `frontend/next/test/unit/vector-taxonomy-drift.test.ts` — asserts `classify()` families agree with `ops/telemetry/vector.yaml`.
- **Modify** `frontend/next/package.json` — add `isbot` dependency.
- **Modify** `frontend/next/middleware.ts` — use `classify()`; add `Vary`/`Cache-Control` on HTML branches; isNav-gated richer logging; delete the inlined regexes/helpers.
- **Modify** `frontend/next/test/routes/seo-gating.test.ts` — in-app-WebView→CRA, headless→SSR, `Vary` assertions.
- **Modify** `ops/telemetry/vector.yaml` — trust app `client_class` first in the `crawler_family` cascade.
- **Create** `docs/reference/render-decision-logsql.md` — documented query set.

---

## Task 1: Add the `isbot` dependency

**Files:**
- Modify: `frontend/next/package.json`

- [ ] **Step 1: Install isbot as a runtime dependency**

Run (in `frontend/next`):
```bash
npm install isbot@5
```
Expected: `package.json` `dependencies` gains `"isbot": "^5.x"`; `node_modules/isbot` exists.

- [ ] **Step 2: Verify isbot is importable and behaves as the spec assumes**

Run:
```bash
node -e "const {isbot}=require('isbot'); console.log(isbot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), isbot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'))"
```
Expected: `true false` (Googlebot is a bot; Safari is not).

- [ ] **Step 3: Commit**

```bash
git add frontend/next/package.json frontend/next/package-lock.json
git commit -m "build(next): add isbot dependency for crawler classification"
```

---

## Task 2: Create the pure classifier `lib/classify.ts`

**Files:**
- Create: `frontend/next/lib/classify.ts`
- Test: `frontend/next/test/unit/classify.test.ts`

**isbot behavior these tests rely on (verified against isbot 5.2.2):** isbot flags Googlebot, Bingbot, facebookexternalhit, GPTBot, AhrefsBot, Yeti, Daumoa, kakaotalk-scrap, HeadlessChrome, Chrome-Lighthouse, curl, python-requests, and `(compatible; …)` UAs. isbot does NOT flag the FB/Instagram/Naver/KakaoTalk in-app WebViews or normal desktop/mobile browsers.

- [ ] **Step 1: Write the failing test**

Create `frontend/next/test/unit/classify.test.ts`:
```ts
import { test, expect } from '@playwright/test'
import { classify } from '../../lib/classify'

const G = 'GET'

test.describe('classify — real browsers reach the CRA', () => {
  const browsers: Record<string, string> = {
    chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'safari-desktop': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'ios-safari': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'firefox-ios': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/605.1.15',
    'chrome-android': 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  }
  for (const [name, ua] of Object.entries(browsers)) {
    test(`${name} → browser/cra`, () => {
      const d = classify({ method: G, ua })
      expect(d.clientClass, name).toBe('browser')
      expect(d.renderMode, name).toBe('cra')
      expect(d.crawlerFamily, name).toBe('browser')
    })
  }
})

test.describe('classify — in-app WebViews reach the CRA (the fix)', () => {
  const webviews: Record<string, string> = {
    'facebook-ios': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/443.0]',
    instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0',
    'kakaotalk-android': 'Mozilla/5.0 (Linux; Android 13; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36;KAKAOTALK 2510020',
    'naver-app': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 1000; 12.9.5)',
  }
  for (const [name, ua] of Object.entries(webviews)) {
    test(`${name} → browser/cra`, () => {
      const d = classify({ method: G, ua })
      expect(d.clientClass, name).toBe('browser')
      expect(d.renderMode, name).toBe('cra')
    })
  }
})

test.describe('classify — crawlers get SSR with a family', () => {
  const crawlers: Record<string, [string, string]> = {
    googlebot: ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'google'],
    bingbot: ['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'bing'],
    facebookexternalhit: ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'meta'],
    gptbot: ['Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)', 'openai'],
    ahrefs: ['Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', 'seo-tool'],
    yeti: ['Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)', 'other-crawler'],
    daumoa: ['Mozilla/5.0 (compatible; Daumoa/4.0; +http://cs.daum.net/faq/15/4118.html)', 'other-crawler'],
    'kakaotalk-scrap': ['facebookexternalhit/1.1; kakaotalk-scrap/1.0; +https://devtalk.kakao.com/', 'meta'],
    'spoofed-scraper': ['Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)', 'seo-tool'],
  }
  for (const [name, [ua, family]] of Object.entries(crawlers)) {
    test(`${name} → known-crawler/ssr/${family}`, () => {
      const d = classify({ method: G, ua })
      expect(d.clientClass, name).toBe('known-crawler')
      expect(d.renderMode, name).toBe('ssr')
      expect(d.crawlerFamily, name).toBe(family)
    })
  }
})

test.describe('classify — headless clients stay on SSR (accepted)', () => {
  const headless: Record<string, string> = {
    'headless-chrome': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/119.0.0.0 Safari/537.36',
    lighthouse: 'Mozilla/5.0 (Linux; Android 7.0; Moto G4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
  }
  for (const [name, ua] of Object.entries(headless)) {
    test(`${name} → known-crawler/ssr`, () => {
      const d = classify({ method: G, ua })
      expect(d.clientClass, name).toBe('known-crawler')
      expect(d.renderMode, name).toBe('ssr')
    })
  }
})

test.describe('classify — unknown clients default to SSR', () => {
  for (const ua of ['', 'Acme-Monitor/1.0', 'Java/1.8.0_301-internal-fake']) {
    test(`"${ua.slice(0, 20)}" → unknown or crawler, always ssr`, () => {
      const d = classify({ method: G, ua })
      expect(d.renderMode).toBe('ssr')
      expect(['unknown', 'known-crawler']).toContain(d.clientClass)
    })
  }
})

test.describe('classify — tripwires', () => {
  test('browser POST is not suspect (non-nav)', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    const d = classify({ method: 'POST', ua })
    expect(d.isNav).toBe(false)
    expect(d.renderMode).toBe('ssr') // non-nav never routes to CRA
    expect(d.suspect).toBe(false)
  })
  test('leak is always false (structural invariant)', () => {
    const uas = ['Mozilla/5.0 (compatible; Googlebot/2.1)', 'Mozilla/5.0 (Macintosh) Safari/605.1.15', 'curl/8.4.0']
    for (const ua of uas) expect(classify({ method: 'GET', ua }).leak).toBe(false)
  })
})

test.describe('classify — isMobile from header or UA', () => {
  test('sec-ch-ua-mobile: ?1 → isMobile even on a desktop-looking UA', () => {
    const d = classify({ method: 'GET', ua: 'Mozilla/5.0 (X11; Linux) Chrome/120 Safari/537.36', secChUaMobile: '?1' })
    expect(d.isMobile).toBe(true)
  })
  test('iPhone UA → isMobile', () => {
    const d = classify({ method: 'GET', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1) AppleWebKit/605.1.15 Mobile Safari/604.1' })
    expect(d.isMobile).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx playwright test test/unit/classify.test.ts --reporter=line
```
Expected: FAIL — `Cannot find module '../../lib/classify'`.

- [ ] **Step 3: Create the classifier**

Create `frontend/next/lib/classify.ts`:
```ts
import { isbot } from 'isbot'

export type RenderMode = 'ssr' | 'cra' | 'asset' | 'analytics'
export type ClientClass = 'browser' | 'known-crawler' | 'unknown'
export type CrawlerFamily =
  | 'google' | 'bing' | 'meta' | 'openai' | 'screpy' | 'seo-tool'
  | 'other-crawler' | 'browser' | 'unknown'

export interface ClassifyInput {
  method: string
  ua: string
  secChUaMobile?: string | null
}

export interface Decision {
  /** Routing mode for a PAGE path (asset/SEO overrides live in middleware). */
  renderMode: 'ssr' | 'cra'
  clientClass: ClientClass
  crawlerFamily: CrawlerFamily
  isMobile: boolean
  isNav: boolean
  isbotHit: boolean
  browserUa: boolean
  signal: 'isbot' | 'browser-ua' | 'applewebkit' | 'no-browser-ua' | 'non-nav'
  suspect: boolean
  leak: boolean
}

// A real browser engine token. `applewebkit` is included so iOS/Android in-app
// WebViews (Facebook, Instagram, Naver, KakaoTalk) — which end in
// `Mobile/15E148 <App>` with NO Safari/CriOS token — still count as browsers.
// Safe because crawlers are screened by isbot() FIRST (Googlebot-smartphone
// contains AppleWebKit but is isbot-flagged before this test is reached).
export const BROWSER_UA_RE =
  /mozilla\/5\.0.*(?:chrome|chromium|crios|firefox|fxios|safari|edg|opr|applewebkit)\//i

// The classic engine tokens (no applewebkit): used only to label the `signal`
// so in-app WebViews (matched via applewebkit alone) are distinguishable in logs.
const CLASSIC_BROWSER_RE = /(?:chrome|chromium|crios|firefox|fxios|safari|edg|opr)\//i
const MOBILE_UA_RE = /iphone|ipad|ipod|android|mobile/i

// Crawler family — the regexes MIRROR ops/telemetry/vector.yaml's crawler_family
// cascade (guarded by test/unit/vector-taxonomy-drift.test.ts). Order = priority.
const FAMILY_RES: ReadonlyArray<readonly [CrawlerFamily, RegExp]> = [
  ['google', /googlebot|google-inspectiontool|adsbot-google/i],
  ['bing', /bingbot|adidxbot/i],
  ['meta', /facebookexternalhit|meta-externalagent|facebot/i],
  ['openai', /gptbot|chatgpt-user|oai-searchbot/i],
  ['screpy', /screpy/i],
  ['seo-tool', /ahrefs|semrush|mj12bot|dotbot/i],
]

function crawlerFamilyFor(ua: string): CrawlerFamily {
  for (const [family, re] of FAMILY_RES) if (re.test(ua)) return family
  return 'other-crawler'
}

export function classify(input: ClassifyInput): Decision {
  const { method, ua } = input
  const isNav = method === 'GET' || method === 'HEAD'
  const isbotHit = isbot(ua)
  const browserUa = BROWSER_UA_RE.test(ua)

  let clientClass: ClientClass
  if (isbotHit) clientClass = 'known-crawler'
  else if (browserUa) clientClass = 'browser'
  else clientClass = 'unknown'

  const renderMode: 'ssr' | 'cra' = clientClass === 'browser' && isNav ? 'cra' : 'ssr'

  const crawlerFamily: CrawlerFamily =
    clientClass === 'known-crawler' ? crawlerFamilyFor(ua)
    : clientClass === 'browser' ? 'browser'
    : 'unknown'

  const isMobile = input.secChUaMobile === '?1' || MOBILE_UA_RE.test(ua)

  let signal: Decision['signal']
  if (!isNav) signal = 'non-nav'
  else if (isbotHit) signal = 'isbot'
  else if (browserUa) signal = CLASSIC_BROWSER_RE.test(ua) ? 'browser-ua' : 'applewebkit'
  else signal = 'no-browser-ua'

  // Tripwires. suspect = the human→SSR direction UA can actually see. leak is a
  // structural invariant (isbot→ssr always) kept as a cheap logic-bug assertion;
  // the real bot→CRA leak signal lives on the IP-bearing NPM access stream.
  const suspect = isNav && renderMode === 'ssr' && browserUa && !isbotHit
  const leak = renderMode === 'cra' && isbotHit

  return { renderMode, clientClass, crawlerFamily, isMobile, isNav, isbotHit, browserUa, signal, suspect, leak }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npx playwright test test/unit/classify.test.ts --reporter=line
```
Expected: PASS (all cases). If a crawler fixture classifies as `unknown` instead of `known-crawler`, re-run the isbot check from Task 1 Step 2 with that UA and adjust the fixture — do NOT weaken `classify`.

- [ ] **Step 5: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add frontend/next/lib/classify.ts frontend/next/test/unit/classify.test.ts
git commit -m "feat(next): pure classify() module (isbot + in-app WebView support)"
```

---

## Task 3: Wire `classify()` into the middleware + cache safety + logging

**Files:**
- Modify: `frontend/next/middleware.ts`
- Modify: `frontend/next/test/routes/seo-gating.test.ts`

- [ ] **Step 1: Add failing integration tests**

In `frontend/next/test/routes/seo-gating.test.ts`, add these blocks immediately before the final `test.describe('canonical is host-aware', …)` block:
```ts
test.describe('in-app WebViews reach the CRA', () => {
  const webviews: Record<string, string> = {
    'facebook-ios': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/443.0]',
    'kakaotalk-android': 'Mozilla/5.0 (Linux; Android 13; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36;KAKAOTALK 2510020',
  }
  for (const [name, ua] of Object.entries(webviews)) {
    test(`${name} → CRA`, async ({ request }) => {
      const r = await request.get('/', { headers: { 'user-agent': ua } })
      expect(r.headers()['x-bom-render-mode'], name).toBe('cra')
      expect(r.headers()['x-bom-client-class'], name).toBe('browser')
    })
  }
})

test.describe('headless clients stay on SSR', () => {
  test('HeadlessChrome → SSR', async ({ request }) => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/119.0.0.0 Safari/537.36'
    const r = await request.get('/lehites', { headers: { 'user-agent': ua } })
    expect(r.headers()['x-bom-render-mode']).toBe('ssr')
    expect(r.headers()['x-bom-client-class']).toBe('known-crawler')
  })
})

test.describe('HTML responses vary by User-Agent (cache safety)', () => {
  test('SSR page sets Vary: User-Agent', async ({ request }) => {
    const r = await request.get('/lehites', { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } })
    expect((r.headers()['vary'] || '').toLowerCase()).toContain('user-agent')
  })
  test('CRA page sets Vary: User-Agent', async ({ request }) => {
    const r = await request.get('/', { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15' } })
    expect((r.headers()['vary'] || '').toLowerCase()).toContain('user-agent')
  })
})
```

- [ ] **Step 1b: Update two pre-existing assertions that isbot now reclassifies**

isbot flags `ResearchIndexer/1.0` as a bot (verified), so it becomes `known-crawler`, not `unknown`. In `test/routes/seo-gating.test.ts`, in BOTH the `'an unrecognized indexer gets SSR…'` test and the `'SEO assets identify the asset rendering path'` test, change:
```ts
    expect(r.headers()['x-bom-client-class']).toBe('unknown')
```
to:
```ts
    expect(r.headers()['x-bom-client-class']).toBe('known-crawler')
```
(The render-mode assertions — `ssr`/`asset` — are unchanged and still hold; only the class label changes. The genuine `unknown→ssr` path is covered by the empty-UA case in `classify.test.ts`.)

- [ ] **Step 2: Run the new tests to verify they fail**

Run:
```bash
npx playwright test test/routes/seo-gating.test.ts -g "in-app WebViews|headless clients|vary by User-Agent" --reporter=line
```
Expected: FAIL, in three groups — (a) the in-app-WebView cases return `ssr` today (KakaoTalk hits `kakao` in the old `KNOWN_CRAWLER_RE`; FB-iOS lacks a `Safari/` token so the old `BROWSER_UA_RE` misses it); (b) the HeadlessChrome case returns `cra`/`browser` today (old `BROWSER_UA_RE` matches `Chrome/`, old crawler regex doesn't match `HeadlessChrome`); (c) both `Vary` cases fail (header absent).

- [ ] **Step 3: Replace the middleware's inline classification with `classify()`**

In `frontend/next/middleware.ts`:

3a. Replace the import block and the crawler/browser constants. Change lines 1–4 to add the classify import, and DELETE lines 12–22 — that is BOTH comment blocks (the `Crawlers and social-preview fetchers…` block AND the `Korean bots…` block) plus BOTH regex constants (`KNOWN_CRAWLER_RE` and `BROWSER_UA_RE`). Leave nothing of the old gate behind. New top:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { LANG_PREFIXES, LOCALE_SEGS, langForHost, isAuthorizedHost, isInfraHost, CANONICAL_EN_HOST } from '@/lib/locales'
import { seoIntentForPath } from '@/lib/features'
import { proxyClickyJs, proxyClickyBeacon } from '@/lib/clicky'
import { classify, type Decision, type ClientClass, type RenderMode } from '@/lib/classify'

// The CRA uses bare routes (/timeline, not /en/timeline) — language is by
// subdomain, not URL path. So a locale-prefixed path must have that prefix
// stripped before proxying to the CRA, or its router finds no match and the
// page (e.g. the timeline) never mounts. 'en' included (it's the default and
// not in LANG_PREFIXES, but /en/* URLs still occur).
```

3b. DELETE the local `type RenderMode …` and `type ClientClass …` lines (originally lines 30–31) — they now come from `@/lib/classify`.

3c. DELETE `isInteractiveBrowserNavigation` (originally lines 84–104) and `classifyClient` (originally lines 106–110) entirely.

3d. Replace `logRenderDecision` (originally lines 112–149) with a version driven by the `Decision`, gated on `isNav`:
```ts
// Structured one-line log of the SSR-vs-CRA routing decision, per NAVIGATION,
// to the Next process stdout → Vector → VictoriaLogs. Purpose: make both
// misroute directions queryable (see docs/reference/render-decision-logsql.md).
// `suspect` = a browser served SSR (human→SSR). Headers only — no IP/PII.
// Non-navigations (POST/etc.), CRA assets, and SEO assets are skipped by the
// callers / this guard. Disable entirely with BOM_LOG_RENDER_DECISION=0.
function logRenderDecision(
  request: NextRequest,
  decision: Decision,
  servedMode: RenderMode,
  pathname: string,
): void {
  if (process.env.BOM_LOG_RENDER_DECISION === '0') return
  if (!decision.isNav) return
  const h = request.headers
  console.log(JSON.stringify({
    tag: 'render-decision',
    suspect: decision.suspect,
    leak: decision.leak,
    render: servedMode,
    class: decision.clientClass,
    crawlerFamily: decision.crawlerFamily,
    isMobile: decision.isMobile,
    isNav: decision.isNav,
    isbotHit: decision.isbotHit,
    browserUa: decision.browserUa,
    signal: decision.signal,
    host: h.get('x-forwarded-host') ?? h.get('host') ?? null,
    path: pathname,
    method: request.method,
    ua: h.get('user-agent') ?? '',
    secFetchMode: h.get('sec-fetch-mode'),
    secFetchDest: h.get('sec-fetch-dest'),
    secFetchSite: h.get('sec-fetch-site'),
    secFetchUser: h.get('sec-fetch-user'),
    secChUa: h.get('sec-ch-ua'),
    secChUaMobile: h.get('sec-ch-ua-mobile'),
    secChUaPlatform: h.get('sec-ch-ua-platform'),
  }))
}
```

3e. In `middleware()`, replace the classification line (originally line 167 `const clientClass = classifyClient(request, ua)`) with:
```ts
  const decision = classify({ method: request.method, ua, secChUaMobile: request.headers.get('sec-ch-ua-mobile') })
  const clientClass = decision.clientClass
```

3f. Update the CRA branch condition (originally line 216) to use `decision`:
```ts
  // --- Human visitor: proxy transparently to CRA ---
  if (!isSeoAsset && (isCraAsset(pathname) || decision.renderMode === 'cra')) {
```

3g. In that CRA branch, replace the log call + the proxy-response construction (originally lines 230–237) so real page navigations log with the `Decision` and the HTML response is cache-safe:
```ts
    // Log real page navigations only — not CRA static assets (/static/, fonts…).
    if (!isCraAsset(pathname)) logRenderDecision(request, decision, 'cra', pathname)
    const target = new URL(CRA_ORIGIN + pathname + request.nextUrl.search)
    const craRes = await fetch(target, { redirect: 'follow' })
    const craResponse = markResponse(new Response(craRes.body, {
      status: craRes.status,
      headers: responseHeadersForClient(craRes.headers),
    }), clientClass, 'cra')
    if (!isCraAsset(pathname)) {
      // The HTML shell is UA-routed. Cloudflare ignores Vary, so Cache-Control is
      // the real guard against a shared cache serving the wrong app; Vary covers
      // well-behaved caches. Hashed static assets keep their own long-lived caching.
      const craVary = craResponse.headers.get('Vary')
      craResponse.headers.set('Vary', craVary ? `${craVary}, User-Agent` : 'User-Agent')
      craResponse.headers.set('Cache-Control', 'private, no-cache')
    }
    return craResponse
```

3h. In the SSR branch, replace the log + mark block (originally lines 247–249) with cache-safety on real SSR pages:
```ts
  const ssrMode: RenderMode = isSeoAsset ? 'asset' : 'ssr'
  if (!isSeoAsset) logRenderDecision(request, decision, ssrMode, pathname)
  markResponse(res, clientClass, ssrMode)
  if (!isSeoAsset) {
    // Merge, not clobber: the app-router may set its own Vary (RSC/Next-Router-*).
    const ssrVary = res.headers.get('Vary')
    res.headers.set('Vary', ssrVary ? `${ssrVary}, User-Agent` : 'User-Agent')
    res.headers.set('Cache-Control', 'private, no-cache')
  }
```

- [ ] **Step 4: Run the gating tests to verify they pass**

Run:
```bash
npx playwright test test/routes/seo-gating.test.ts --reporter=line
```
Expected: PASS (all, including the 5 pre-existing browser cases, the new in-app-WebView/headless/Vary cases, and the crawler→SSR defaults).

- [ ] **Step 5: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: no output. If it complains about the unused `LANG_PREFIXES` import, that predates this change — leave it as-is (do not touch unrelated imports).

- [ ] **Step 6: Commit**

```bash
git add frontend/next/middleware.ts frontend/next/test/routes/seo-gating.test.ts
git commit -m "feat(next): route via classify(); add Vary/Cache-Control + isNav-gated logging"
```

---

## Task 4: Align `vector.yaml` taxonomy + drift guard test

**Files:**
- Modify: `ops/telemetry/vector.yaml`
- Test: `frontend/next/test/unit/vector-taxonomy-drift.test.ts`

**Note on TDD here:** the drift test is a *regression guard*, not a red-green driver — `classify.ts`'s `FAMILY_RES` (Task 2) already mirrors `vector.yaml`, so the guard passes as soon as both exist. The `vector.yaml` reorder is a correctness fix for the *access stream* (not expressible as a unit red state, since `browser` is assigned by `.client_class`, not a `match()`). So: apply the fix, add the guard, confirm it passes, then prove it actually bites with a mutation check.

- [ ] **Step 1: Reorder the `vector.yaml` cascade to trust the app's `client_class` first**

In `ops/telemetry/vector.yaml`, replace the `crawler_family` cascade (lines 40–59, from `ua = downcase(...)` through the closing `}` of the `else` unknown branch) with:
```yaml
      ua = downcase(string!(.user_agent))
      if .client_class == "browser" {
        .crawler_family = "browser"
      } else if match(ua, r'googlebot|google-inspectiontool|adsbot-google') {
        .crawler_family = "google"
      } else if match(ua, r'bingbot|adidxbot') {
        .crawler_family = "bing"
      } else if match(ua, r'facebookexternalhit|meta-externalagent|facebot') {
        .crawler_family = "meta"
      } else if match(ua, r'gptbot|chatgpt-user|oai-searchbot') {
        .crawler_family = "openai"
      } else if match(ua, r'screpy') {
        .crawler_family = "screpy"
      } else if match(ua, r'ahrefs|semrush|mj12bot|dotbot') {
        .crawler_family = "seo-tool"
      } else if match(ua, r'bot|crawl|spider|slurp|yeti|naver|daum|kakao|preview') {
        .crawler_family = "other-crawler"
      } else {
        .crawler_family = "unknown"
      }
```
The single change: the `.client_class == "browser"` branch moves to the TOP. Now the app's classification wins, so a KakaoTalk/Naver in-app WebView (which the app now classifies `browser`) is tagged `browser` on the access stream instead of `other-crawler`. The `naver|daum|kakao` tokens remain only as a fallback for genuine non-browser clients.

- [ ] **Step 2: Validate the reordered VRL with the real Vector binary (skip only if Docker is absent)**

Run (in `frontend/next`) — this separates "Docker missing" (skip) from "validate failed" (a real error that must NOT be swallowed):
```bash
if command -v docker >/dev/null; then
  docker run --rm -v "$PWD/../../ops/telemetry/vector.yaml:/etc/vector/vector.yaml:ro" timberio/vector:latest-alpine validate --no-environment /etc/vector/vector.yaml
else
  echo "docker unavailable — skipping VRL validation (js-yaml load in the drift test still checks YAML shape)"
fi
```
Expected: `Validated` (config OK) if Docker is present; a non-zero exit here means the reordered VRL is broken — fix it before continuing. The skip line only prints when Docker is genuinely absent.

- [ ] **Step 3: Add js-yaml types, then write the drift guard test**

The drift test imports `js-yaml`, which ships no types and has no `@types` installed — under `strict` + `tsc` that is a TS7016 error. Install the types first (in `frontend/next`):
```bash
npm install -D @types/js-yaml
```
Then create `frontend/next/test/unit/vector-taxonomy-drift.test.ts`:
```ts
import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import yaml from 'js-yaml'
import { classify } from '../../lib/classify'

// One representative UA per crawler family. Vector's regex cascade AND
// classify()'s FAMILY_RES must agree — this guards against the two copies
// drifting (they cannot share code: one is VRL, one is TS).
const FAMILY_FIXTURES: Record<string, string> = {
  google: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  bing: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  meta: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  openai: 'Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)',
  screpy: 'Mozilla/5.0 (compatible; Screpy/1.0)',
  'seo-tool': 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
}

function vectorSource(): string {
  // Playwright runs from frontend/next; repo root is two levels up.
  const path = resolve(process.cwd(), '../../ops/telemetry/vector.yaml')
  const doc = yaml.load(readFileSync(path, 'utf8')) as any
  return doc.transforms.bom_access.source as string
}

// Extract [family, RegExp] from each VRL `match(ua, r'...') { .crawler_family = "x" }`.
function vectorFamilyRes(src: string): Array<[string, RegExp]> {
  const re = /match\(ua,\s*r'([^']+)'\)\s*\{\s*\.crawler_family\s*=\s*"([^"]+)"/g
  const out: Array<[string, RegExp]> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) out.push([m[2], new RegExp(m[1], 'i')])
  return out
}

test.describe('classify() families agree with ops/telemetry/vector.yaml', () => {
  const pairs = vectorFamilyRes(vectorSource())

  test('vector.yaml yields the expected match-based family list, in order', () => {
    expect(pairs.map(([f]) => f)).toEqual(
      ['google', 'bing', 'meta', 'openai', 'screpy', 'seo-tool', 'other-crawler'],
    )
  })

  test('each fixture: classify() and the vector cascade assign the same family', () => {
    for (const [family, ua] of Object.entries(FAMILY_FIXTURES)) {
      expect(classify({ method: 'GET', ua }).crawlerFamily, `classify ${family}`).toBe(family)
      // Vector downcases the UA before matching, so mimic that here.
      const firstHit = pairs.find(([, r]) => r.test(ua.toLowerCase()))
      expect(firstHit?.[0], `vector ${family}`).toBe(family)
    }
  })
})
```

- [ ] **Step 4: Run the drift test to verify it passes, and typecheck**

Run:
```bash
npx playwright test test/unit/vector-taxonomy-drift.test.ts --reporter=line
npx tsc --noEmit
```
Expected: PASS (both tests); `tsc` clean (this confirms `@types/js-yaml` resolved the `import yaml from 'js-yaml'` typing).

- [ ] **Step 5: Prove the guard actually bites (mutation check)**

Temporarily break the mirror, confirm the guard fails, then revert:
```bash
# Change the seo-tool regex in classify.ts to drop 'ahrefs'
sed -i "s/ahrefs|semrush|mj12bot|dotbot/semrush|mj12bot|dotbot/" lib/classify.ts
npx playwright test test/unit/vector-taxonomy-drift.test.ts --reporter=line   # Expected: FAIL (seo-tool disagrees)
git checkout -- lib/classify.ts
npx playwright test test/unit/vector-taxonomy-drift.test.ts --reporter=line   # Expected: PASS again
```
Expected: FAIL then PASS — the guard detects drift.

- [ ] **Step 6: Commit**

```bash
git add ops/telemetry/vector.yaml frontend/next/test/unit/vector-taxonomy-drift.test.ts frontend/next/package.json frontend/next/package-lock.json
git commit -m "fix(telemetry): trust app client_class first in crawler_family; add drift test"
```

---

## Task 5: Document the LogsQL query set

**Files:**
- Create: `docs/reference/render-decision-logsql.md`

- [ ] **Step 1: Write the reference doc**

Create `docs/reference/render-decision-logsql.md`:
```markdown
# render-decision LogsQL queries

The Next front door (`frontend/next/middleware.ts`) emits one JSON line per page
navigation via `logRenderDecision`, shipped to VictoriaLogs by Vector's
`docker_logs` source. Fields live inside `_msg`; `unpack_json from _msg` extracts
them at query time (no ingest transform — decision 3a).

Base selector (prepend to every query below):

    _stream:{container_name=~"bookofmormon-online.*"} render-decision | unpack_json from _msg

Run against VictoriaLogs at `:9428/select/logsql/query` (on the prod box), e.g.

    curl -s http://localhost:9428/select/logsql/query \
      --data-urlencode 'query=<one line below>' --data-urlencode 'start=1h'

## 1. Human→SSR misroutes (the primary tripwire — should be ~0)
    … | filter suspect:true | stats by (ua) count() n
Any rows here are real browsers served the static page. Investigate the UA.

## 2. Render distribution (navigations only)
    … | filter isNav:true | stats by (render) count() n
Sanity check of cra vs ssr share.

## 3. Crawler family breakdown
    … | filter class:known-crawler | stats by (crawlerFamily) count() n

## 4. Mobile served the CRA (the originally-reported symptom — should be healthy)
    … | filter isMobile:true render:cra | stats count() n

## 5. Unknown-UA review (are any unknown→ssr actually browsers?)
    … | filter class:unknown | stats by (ua) count() n | sort by (n desc) | limit 50

## 6. isbot false-positives (real browsers flagged as bots → SSR, incl. headless)
    … | filter class:known-crawler browserUa:true | stats by (ua) count() n | sort by (n desc)
Expected: HeadlessChrome / Chrome-Lighthouse (accepted). An *interactive* browser
here is a real false-positive worth fixing.

## 7. Decisive-signal mix
    … | filter isNav:true | stats by (signal) count() n
Shows how often isbot vs the browser-UA test vs the applewebkit (in-app WebView)
path drives the decision.

## 8. Bot→CRA leak proxy — on the NPM ACCESS stream (has client IPs)
`leak` in the render-decision log is a structural invariant (always false): a
scraper spoofing a clean Chrome UA is undetectable from UA alone. Its signal is
IP-based, on the `bom_access` stream. That stream is parsed AT INGEST
(`parse_json!(.message)` in vector.yaml), so `client_class`/`client_ip`/`crawler_family`
are already first-class fields — do NOT `unpack_json` here (its `_msg` is a URI):

    _stream:{source_type="bom_access"} | filter client_class:browser | stats by (client_ip) count() n | sort by (n desc) | limit 50
Cross-reference high-volume IPs against known datacenter ASNs.
```

- [ ] **Step 2: Sanity-check the base query resolves against live VictoriaLogs (optional, requires prod access)**

If you have prod SSH/VictoriaLogs access, run query #2 and confirm it returns **non-zero grouped output** (proves `unpack_json` parses the lines — guards against any log-prefix regression). Otherwise this is verified in Task 7.

- [ ] **Step 3: Commit**

```bash
git add docs/reference/render-decision-logsql.md
git commit -m "docs(reference): render-decision LogsQL query set"
```

---

## Task 6: Full local verification

**Files:** none (verification only).

- [ ] **Step 1: Run the entire `next` test suite**

Run (in `frontend/next`):
```bash
npx playwright test --reporter=line
```
Expected: all suites PASS (classify unit, drift, seo-gating, host-allowlist, and the SSR route tests).

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 3: Confirm isbot bundles in the edge middleware build**

Run:
```bash
npm run build 2>&1 | tail -20
```
Expected: build completes; no "Module not found: isbot" or edge-runtime incompatibility error for the middleware.

- [ ] **Step 4: Live-probe the dev front door with the UA matrix**

Ensure the dev Next server is running (`systemctl --user status bom-nextjs` on the dev host serves `:8200`), then run:
```bash
probe(){ curl -s -o /dev/null -D - -X GET "http://localhost:8200/" -H "User-Agent: $2" | tr -d '\r' | awk -v l="$1" 'tolower($1)=="x-bom-render-mode:"{m=$2} tolower($1)=="x-bom-client-class:"{c=$2} tolower($1)=="vary:"{v=$2} END{printf "%-18s render=%-4s class=%-13s vary=%s\n", l, m, c, v}'; }
probe "safari-desktop" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"
probe "ios-safari"     "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1"
probe "kakaotalk-app"  "Mozilla/5.0 (Linux; Android 13; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36;KAKAOTALK 2510020"
probe "facebook-ios"   "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/443.0]"
probe "googlebot"      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
probe "headless"       "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/119.0.0.0 Safari/537.36"
```
Expected: browsers + both in-app WebViews → `render=cra class=browser vary=User-Agent`; googlebot + headless → `render=ssr class=known-crawler`.

- [ ] **Step 5: Confirm the enriched log line shape on dev**

Run:
```bash
curl -s -o /dev/null "http://localhost:8200/" -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/443.0]"
sleep 1
journalctl --user -u bom-nextjs -n 200 --no-pager | grep render-decision | tail -1
```
Expected: a JSON line containing `"crawlerFamily":"browser"`, `"isbotHit":false`, `"browserUa":true`, `"signal":"applewebkit"`, `"render":"cra"`.

---

## Task 7: Deploy to dev → prod and verify on real traffic

**Files:** none (deploy + verification). Follow the established flow (commit to `dev`, fast-forward `prod`, CI blue-green deploy). Only proceed after the user confirms deployment.

- [ ] **Step 1: Push dev**

Run (from repo root):
```bash
git push origin dev
```
Expected: `dev` updated on origin.

- [ ] **Step 2: Confirm fast-forward and deploy to prod**

Run (from repo root):
```bash
git merge-base --is-ancestor prod dev && echo "FF ok" || echo "NOT FF"
git push origin dev:prod
git branch -f prod dev
```
Expected: `FF ok`; `dev -> prod` pushed (triggers `deploy-prod` CI).

- [ ] **Step 3: Watch the deploy**

Run (from repo root):
```bash
gh run watch "$(gh run list --branch prod --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```
Expected: `Blue-green deploy` job succeeds.

- [ ] **Step 4: Verify the fix on live prod (header probes)**

Run:
```bash
prod(){ curl -s -o /dev/null -D - "https://bookofmormon.online/?cb=$RANDOM" -H "User-Agent: $2" | tr -d '\r' | awk -v l="$1" 'tolower($1)=="x-bom-render-mode:"{m=$2} tolower($1)=="x-bom-client-class:"{c=$2} tolower($1)=="vary:"{v=$2} END{printf "%-16s render=%-4s class=%-13s vary=%s\n", l, m, c, v}'; }
prod "ios-safari"    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1"
prod "kakaotalk-app" "Mozilla/5.0 (Linux; Android 13; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36;KAKAOTALK 2510020"
prod "googlebot"     "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
```
Expected: iOS Safari + KakaoTalk → `render=cra class=browser vary=User-Agent`; Googlebot → `render=ssr class=known-crawler`.

- [ ] **Step 5: Verify LogsQL queries resolve on live VictoriaLogs**

With prod access (SSH to the EC2, query `:9428`), run reference query #2 and confirm **non-zero grouped output** (proves `unpack_json` parses real prod lines), then query #1 (`suspect:true`) and query #4 (mobile→cra) and confirm `suspect` ≈ 0 and mobile→cra is healthy.
```bash
curl -s http://localhost:9428/select/logsql/query --data-urlencode 'query=_stream:{container_name=~"bookofmormon-online.*"} render-decision | unpack_json from _msg | filter isNav:true | stats by (render) count() n' --data-urlencode 'start=15m'
```
Expected: rows like `{"render":"cra","n":"…"}` and `{"render":"ssr","n":"…"}` with non-zero counts.

- [ ] **Step 6: Sync the reordered `vector.yaml` to the prod box (separate from the app deploy)**

The app image ships via CI, but `vector` runs as its own container reading
`/home/ubuntu/observability/vector.yaml` on the prod EC2 — the app deploy does NOT
update it, so the access-stream taxonomy fix (in-app WebViews tagged `browser`)
does not ship until this is done. Confirm whether the running copy matches the repo
copy; if not, copy `ops/telemetry/vector.yaml` to the box and reload Vector
(`docker kill -s HUP vector` or restart the `vector` container). Requires prod
access (Infisical `ba310d37` / SSH). If prod access is unavailable in this session,
STOP and hand this step to the operator with the diff — do not skip silently.

- [ ] **Step 7: Update the deploy note**

If a running deploy/ops note exists, record this rollout. Otherwise no action.

---

## Self-review checklist (completed by plan author)

- **Spec coverage:** classifier→T2; in-app WebView `applewebkit`→T2/T3; drop KR supplement (isbot only)→T2; Vary/Cache-Control (merge-not-clobber)→T3; isNav-gated + enriched logging (isbotHit/browserUa/signal/crawlerFamily/isMobile)→T3; suspect/leak semantics→T2; two pre-existing seo-gating assertions updated for isbot→T3 Step 1b; vector.yaml alignment + `@types/js-yaml` + drift test + VRL validate→T4; LogsQL query set (access-stream query un-`unpack_json`'d)→T5; prod vector.yaml sync caveat→T7 Step 6; test runner (Playwright test/unit)→T2/T4; isbot bundling check→T6; rollout + post-deploy LogsQL verification→T7. All spec sections mapped.
- **Placeholder scan:** none — every code/step shows full content and exact commands.
- **Type consistency:** `Decision`/`RenderMode`/`ClientClass`/`CrawlerFamily` defined in T2 `classify.ts`, imported unchanged in T3 middleware; `classify()` signature `{ method, ua, secChUaMobile? }` used identically in tests, drift test, and middleware; log field names (`crawlerFamily`, `isbotHit`, `browserUa`, `signal`, `suspect`, `leak`) match between `logRenderDecision` (T3) and the LogsQL queries (T5).
```
