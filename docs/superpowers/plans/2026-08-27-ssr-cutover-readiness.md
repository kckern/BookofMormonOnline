# SSR Cutover-Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Next SSR layer (`frontend/next/`) honor each feature's SEO intent (`crawl`/`noindex`/`remove`) from the shared `features.yml`, and make canonical URLs host-aware — so crawler-facing status codes, `/sitemap.xml`, robots, links, and canonicals match the cutover decisions.

**Architecture:** A shared `features.yml` (already the CRA's flag source) gains a `seo` intent + `paths` per feature. A Next **prebuild** step compiles it to a committed JSON that a pure resolver `lib/features.ts#seoIntentForPath()` reads. Three consumers apply intent: catch-all route (`remove`→404), `app/history/layout.tsx` meta + `middleware.ts` `X-Robots-Tag` (`noindex`), and `lib/sitemap.ts` (drop non-`crawl`). Separately, `buildMetadata` becomes async and emits a host-aware absolute canonical/og:url.

**Tech Stack:** Next.js 15.3.3 (App Router, TS), Playwright (the only test runner — used for both pure-unit and bot-UA integration tests), js-yaml (new Next devDep, prebuild only).

**Spec:** `docs/specs/2026-08-27-ssr-cutover-readiness.md`
**All paths are relative to the repo root** `/home/bom/BookofMormonOnline`. Run Next commands from `frontend/next/`, CRA commands from `frontend/webapp/`.

---

## File Structure

**Create:**
- `frontend/next/scripts/gen-features.mjs` — prebuild: `features.yml` → committed JSON.
- `frontend/next/config/features.generated.json` — generated + committed; imported by the resolver.
- `frontend/next/lib/features.ts` — pure `seoIntentForPath()` resolver.
- `frontend/next/app/history/layout.tsx` — `/history` subtree noindex meta.
- `frontend/next/test/unit/features.test.ts` — resolver unit tests.
- `frontend/next/test/routes/seo-gating.test.ts` — bot-UA integration tests.

**Modify:**
- `frontend/webapp/config/features.yml` (+ regenerated CRA `src/config/features.generated.json`) — add `seo`/`paths`.
- `frontend/next/package.json` — `predev`/`prebuild` hooks + `js-yaml` devDep.
- `frontend/next/middleware.ts` — `X-Robots-Tag` for `noindex` paths.
- `frontend/next/app/[...path]/page.tsx` — `remove`→404 guard (both entry points).
- `frontend/next/lib/sitemap.ts` — drop non-`crawl` URLs.
- `frontend/next/lib/seo.ts` — async `buildMetadata`/`defaultMetadata`, host-aware canonical/og:url, drop `/history` from `DEFAULT_NAV`.
- `frontend/next/app/history/_index.tsx` — `historyMetadata` sync→async.
- `frontend/next/app/page.tsx`, `app/about/page.tsx`, `app/studyedition/page.tsx`, `app/%ED%8A%B9%EB%B3%84%EB%B0%98/page.tsx` — static `metadata` → `generateMetadata`.
- `frontend/next/scripts/sitemap-diff.mjs` — carve-out for intentionally-removed URLs.
- `.gitignore` — negation for the new committed JSON.

---

## Task 1: Extend `features.yml` with SEO intent

**Files:**
- Modify: `frontend/webapp/config/features.yml`
- Modify (regenerated): `frontend/webapp/src/config/features.generated.json`

- [ ] **Step 1: Add `seo` + `paths` to the three gated features**

Replace the body of `frontend/webapp/config/features.yml` (keep the existing comment header) so the four feature entries read exactly:
```yaml
homeNav:      { hidden: true, seo: remove,  paths: [/home] }
mattersNav:   { hidden: true, seo: remove,  paths: [/matters] }
historyNav:   { hidden: true, seo: noindex, paths: [/history] }
passageNotes: { hidden: true }   # reader panel — no SSR/crawl surface; SSR ignores it
```

- [ ] **Step 2: Regenerate the CRA's committed JSON**

Run: `cd frontend/webapp && node scripts/gen-features.js && cat src/config/features.generated.json`
Expected: prints `[gen-features] wrote src/config/features.generated.json`, and the JSON now contains the `seo`/`paths` keys, e.g.:
```json
{
  "homeNav": {
    "hidden": true,
    "seo": "remove",
    "paths": [
      "/home"
    ]
  },
  ...
}
```

- [ ] **Step 3: Confirm the CRA still builds/tests (extra keys are inert)**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false src/views/_Common/__tests__/menuFilter.test.js`
Expected: PASS (7 tests) — the CRA reads only `*.hidden`; `seo`/`paths` are ignored.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/config/features.yml frontend/webapp/src/config/features.generated.json
git commit -m "$(printf 'feat(flags): add SSR seo intent + paths to features.yml\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Next prebuild — compile `features.yml` into the Next app

**Files:**
- Create: `frontend/next/scripts/gen-features.mjs`
- Create: `frontend/next/config/features.generated.json`
- Modify: `frontend/next/package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add `js-yaml` as a Next devDependency**

Run: `cd frontend/next && npm install --save-dev js-yaml@^4.1.0`
Expected: `frontend/next/package.json` `devDependencies` gains `js-yaml`; installs cleanly.

- [ ] **Step 2: Create the prebuild script**

Create `frontend/next/scripts/gen-features.mjs`:
```js
// Compile the shared CRA flag config into a JSON the Next app imports. Run by
// package.json predev/prebuild. Uses import.meta.url (a .mjs has no __dirname).
import fs from 'node:fs'
import yaml from 'js-yaml'

const SRC = new URL('../../webapp/config/features.yml', import.meta.url)
const OUT = new URL('../config/features.generated.json', import.meta.url)

const parsed = yaml.load(fs.readFileSync(SRC, 'utf8')) || {}
const json = JSON.stringify(parsed, null, 2) + '\n'

let current = null
try { current = fs.readFileSync(OUT, 'utf8') } catch { /* first run */ }
if (current === json) {
  console.log('[gen-features] up to date')
} else {
  fs.mkdirSync(new URL('../config/', import.meta.url), { recursive: true })
  fs.writeFileSync(OUT, json)
  console.log('[gen-features] wrote config/features.generated.json')
}
```

- [ ] **Step 3: Run it and verify output**

Run: `cd frontend/next && node scripts/gen-features.mjs && cat config/features.generated.json`
Expected: `[gen-features] wrote config/features.generated.json`, then JSON containing `homeNav`/`mattersNav`/`historyNav` with their `seo`/`paths`, and `passageNotes` with only `hidden`.

- [ ] **Step 4: Verify idempotency**

Run: `cd frontend/next && node scripts/gen-features.mjs`
Expected: `[gen-features] up to date`.

- [ ] **Step 5: Wire predev/prebuild hooks**

In `frontend/next/package.json` `scripts`, add:
```json
    "predev": "node scripts/gen-features.mjs",
    "prebuild": "node scripts/gen-features.mjs",
```
(Keep the existing `dev`/`build`/`start`/`test`/`fonts` scripts.)

- [ ] **Step 6: Un-ignore the committed JSON**

The root `.gitignore` has a global `*.json` ignore with a CRA negation already present. Add, immediately after the existing `!frontend/webapp/src/config/features.generated.json` line:
```
!frontend/next/config/features.generated.json
```

Verify it's tracked: `git check-ignore -v frontend/next/config/features.generated.json`
Expected: **no output** (exit 1 = not ignored).

- [ ] **Step 7: Commit**

```bash
git add frontend/next/package.json frontend/next/package-lock.json frontend/next/scripts/gen-features.mjs frontend/next/config/features.generated.json .gitignore
git commit -m "$(printf 'build(next): compile shared features.yml into the SSR app\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Intent resolver `lib/features.ts` (TDD)

**Files:**
- Create: `frontend/next/lib/features.ts`
- Test: `frontend/next/test/unit/features.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `frontend/next/test/unit/features.test.ts`:
```ts
import { test, expect } from '@playwright/test'
import { seoIntentForPath } from '../../lib/features'

test.describe('seoIntentForPath', () => {
  test('un-gated path → crawl', () => {
    expect(seoIntentForPath('/people')).toBe('crawl')
    expect(seoIntentForPath('/')).toBe('crawl')
  })
  test('remove features → remove', () => {
    expect(seoIntentForPath('/matters')).toBe('remove')
    expect(seoIntentForPath('/matters/swords')).toBe('remove')
    expect(seoIntentForPath('/home')).toBe('remove')
    expect(seoIntentForPath('/home/community')).toBe('remove')
  })
  test('history → noindex, incl. deep + slug paths', () => {
    expect(seoIntentForPath('/history')).toBe('noindex')
    expect(seoIntentForPath('/history/lost-116-pages')).toBe('noindex')
  })
  test('segment-prefix only — /historyfoo is NOT history', () => {
    expect(seoIntentForPath('/historyfoo')).toBe('crawl')
    expect(seoIntentForPath('/matterspedia')).toBe('crawl')
  })
  test('locale prefix is stripped before matching', () => {
    expect(seoIntentForPath('/ko/history')).toBe('noindex')
    expect(seoIntentForPath('/en/matters')).toBe('remove')
    expect(seoIntentForPath('/fr/home/community')).toBe('remove')
  })
  test('trailing slash + query are ignored', () => {
    expect(seoIntentForPath('/history/')).toBe('noindex')
    expect(seoIntentForPath('/matters?q=x')).toBe('remove')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend/next && npx playwright test test/unit/features.test.ts`
Expected: FAIL — cannot resolve `../../lib/features`.

- [ ] **Step 3: Implement the resolver**

Create `frontend/next/lib/features.ts`:
```ts
import features from '@/config/features.generated.json'

export type SeoIntent = 'crawl' | 'noindex' | 'remove'

// Language segments stripped before matching. For bots the middleware does NOT
// strip the locale prefix, so a subdomain-language URL arrives as /{lang}/…;
// mirror the middleware's CRA_LOCALE_SEG (which includes 'en').
const LOCALE_SEGS = new Set(['en', 'ko', 'fr', 'de', 'es', 'pt', 'ja', 'zh'])

interface FeatureCfg {
  seo?: SeoIntent
  paths?: string[]
}

function normalize(input: string): string {
  let path = input.split('?')[0]
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  const segs = path.split('/').filter(Boolean)
  if (segs.length && LOCALE_SEGS.has(segs[0])) segs.shift()
  return '/' + segs.join('/')
}

// Flatten non-crawl features into [normalized prefix, intent] once at module load.
const GATES: Array<{ prefix: string; intent: SeoIntent }> = Object.values(
  features as Record<string, FeatureCfg>,
)
  .filter((f) => f && f.seo && f.seo !== 'crawl' && Array.isArray(f.paths))
  .flatMap((f) => f.paths!.map((p) => ({ prefix: normalize(p), intent: f.seo! })))

function isSegmentPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + '/')
}

// Longest-prefix wins; default 'crawl' when no gate owns the path.
export function seoIntentForPath(pathname: string): SeoIntent {
  const path = normalize(pathname)
  let best: { prefix: string; intent: SeoIntent } | null = null
  for (const g of GATES) {
    if (isSegmentPrefix(path, g.prefix) && (!best || g.prefix.length > best.prefix.length)) {
      best = g
    }
  }
  return best ? best.intent : 'crawl'
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd frontend/next && npx playwright test test/unit/features.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/next/lib/features.ts frontend/next/test/unit/features.test.ts
git commit -m "$(printf 'feat(next): seoIntentForPath resolver from shared flag config\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: `remove` → 404 in the catch-all (both entry points)

**Files:**
- Modify: `frontend/next/app/[...path]/page.tsx`
- Test: `frontend/next/test/routes/seo-gating.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `frontend/next/test/routes/seo-gating.test.ts`:
```ts
import { test, expect } from '@playwright/test'

const BOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const bot = { 'User-Agent': BOT }

test.describe('remove-intent features 404 for bots', () => {
  test('/matters → 404', async ({ request }) => {
    const r = await request.get('/matters', { headers: bot })
    expect(r.status()).toBe(404)
  })
  test('/home → 404', async ({ request }) => {
    const r = await request.get('/home', { headers: bot })
    expect(r.status()).toBe(404)
  })
  test('deliberate fallbacks stay 200 (regression guard)', async ({ request }) => {
    for (const p of ['/search', '/user']) {
      const r = await request.get(p, { headers: bot })
      expect(r.status(), p).toBe(200)
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend/next && npx playwright test test/routes/seo-gating.test.ts -g "remove-intent"`
Expected: FAIL — `/matters` and `/home` return 200 (current soft-404), not 404.

- [ ] **Step 3: Add the `remove` guard to both entry points**

In `frontend/next/app/[...path]/page.tsx`, add the import near the top (with the other `@/lib` imports):
```ts
import { seoIntentForPath } from '@/lib/features'
```
In `generateMetadata` (currently `export async function generateMetadata({ params }: Props)`), immediately after `const { path } = await params`, add:
```ts
  if (seoIntentForPath('/' + path.join('/')) === 'remove') notFound()
```
In `CatchAllPage` (currently `export default async function CatchAllPage({ params }: Props)`), immediately after its `const { path } = await params`, add the identical line:
```ts
  if (seoIntentForPath('/' + path.join('/')) === 'remove') notFound()
```
(`notFound` is already imported in this file.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend/next && npx playwright test test/routes/seo-gating.test.ts -g "remove-intent"`
Expected: PASS (3 tests) — `/matters`, `/home` → 404; `/search`, `/user` → 200.

- [ ] **Step 5: Commit**

```bash
git add frontend/next/app/\[...path\]/page.tsx frontend/next/test/routes/seo-gating.test.ts
git commit -m "$(printf 'feat(next): 404 remove-intent features for crawlers\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: Drop non-`crawl` URLs from the sitemap

**Files:**
- Modify: `frontend/next/lib/sitemap.ts`
- Test: `frontend/next/test/routes/seo-gating.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `frontend/next/test/routes/seo-gating.test.ts`:
```ts
test.describe('sitemap excludes non-crawl features', () => {
  test('/sitemap.xml has no /history URLs but keeps content', async ({ request }) => {
    const r = await request.get('/sitemap.xml', { headers: bot })
    const xml = await r.text()
    expect(xml).not.toContain('<loc>https://bookofmormon.online/history')
    expect(xml).toContain('<loc>https://bookofmormon.online/people</loc>')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend/next && npx playwright test test/routes/seo-gating.test.ts -g "sitemap excludes"`
Expected: FAIL — the sitemap currently contains `/history` URLs.

- [ ] **Step 3: Filter the URL list by intent**

In `frontend/next/lib/sitemap.ts`, add near the top imports:
```ts
import { seoIntentForPath } from './features'
```
In `getSitemapUrls`, change the final `return [...statics, ...content, ...]` line to filter out non-`crawl` paths:
```ts
  const all = [...statics, ...content, ...people, ...places, ...history, ...fax, ...maps, ...timeline]
  return all.filter((u) => seoIntentForPath(u.path) === 'crawl')
```
(Keep the `Promise.all` and `statics` blocks unchanged; only the final assembly changes. `historyUrls()` may keep running — its output is simply filtered out.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend/next && npx playwright test test/routes/seo-gating.test.ts -g "sitemap excludes"`
Expected: PASS — no `/history` `<loc>`; `/people` present.

- [ ] **Step 5: Commit**

```bash
git add frontend/next/lib/sitemap.ts frontend/next/test/routes/seo-gating.test.ts
git commit -m "$(printf 'feat(next): exclude non-crawl features from sitemap\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: Remove `/history` from the SSR default nav

**Files:**
- Modify: `frontend/next/lib/seo.ts:11-20` (`DEFAULT_NAV`)
- Test: `frontend/next/test/routes/seo-gating.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `frontend/next/test/routes/seo-gating.test.ts`:
```ts
test.describe('default shell does not link noindexed sections', () => {
  test('/ shell has no History nav link', async ({ request }) => {
    const r = await request.get('/', { headers: bot })
    const html = await r.text()
    expect(html).not.toContain('href="/history"')
    expect(html).toContain('href="/people"') // sanity: other nav links present
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend/next && npx playwright test test/routes/seo-gating.test.ts -g "default shell"`
Expected: FAIL — the shell currently renders `href="/history"`.

- [ ] **Step 3: Remove the History entry from `DEFAULT_NAV`**

In `frontend/next/lib/seo.ts`, delete this line from the `DEFAULT_NAV` array (currently line 17):
```ts
  { href: '/history', label: 'History' },
```
Leave the other seven entries unchanged.

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend/next && npx playwright test test/routes/seo-gating.test.ts -g "default shell"`
Expected: PASS — no `href="/history"`; `href="/people"` present.

- [ ] **Step 5: Commit**

```bash
git add frontend/next/lib/seo.ts frontend/next/test/routes/seo-gating.test.ts
git commit -m "$(printf 'feat(next): drop History from default-shell nav (noindexed)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 7: `noindex` History — layout meta + middleware header

**Files:**
- Create: `frontend/next/app/history/layout.tsx`
- Modify: `frontend/next/middleware.ts:59-64`
- Test: `frontend/next/test/routes/seo-gating.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `frontend/next/test/routes/seo-gating.test.ts`:
```ts
test.describe('history is noindex for bots', () => {
  test('/history → 200 + noindex meta + header', async ({ request }) => {
    const r = await request.get('/history', { headers: bot })
    expect(r.status()).toBe(200)
    expect(r.headers()['x-robots-tag']).toBe('noindex, follow')
    expect(await r.text()).toContain('noindex')
  })
  test('/ko/history → noindex header (locale stripped)', async ({ request }) => {
    const r = await request.get('/ko/history', { headers: bot })
    expect(r.headers()['x-robots-tag']).toBe('noindex, follow')
  })
  test('crawl pages have no noindex header', async ({ request }) => {
    const r = await request.get('/people', { headers: bot })
    expect(r.headers()['x-robots-tag']).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend/next && npx playwright test test/routes/seo-gating.test.ts -g "history is noindex"`
Expected: FAIL — no `x-robots-tag` header, no noindex meta.

- [ ] **Step 3: Add the History subtree layout (noindex meta)**

Create `frontend/next/app/history/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// The whole /history subtree is noindex during cutover (feature is 'noindex' in
// features.yml). This metadata cascades to every history page; none sets its own
// `robots`, so it is not clobbered. The matching X-Robots-Tag header is set in
// middleware (App Router layouts cannot set response headers).
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function HistoryLayout({ children }: { children: ReactNode }) {
  return children
}
```

- [ ] **Step 4: Set the `X-Robots-Tag` header in middleware**

In `frontend/next/middleware.ts`, add the import at the top (with the other imports):
```ts
import { seoIntentForPath } from '@/lib/features'
```
Replace the bot-branch return (currently the last two lines before the closing brace of `middleware`):
```ts
  requestHeaders.set('x-lang', lang)
  return NextResponse.next({ request: { headers: requestHeaders } })
```
with:
```ts
  requestHeaders.set('x-lang', lang)
  const res = NextResponse.next({ request: { headers: requestHeaders } })
  if (seoIntentForPath(pathname) === 'noindex') {
    res.headers.set('X-Robots-Tag', 'noindex, follow')
  }
  return res
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd frontend/next && npx playwright test test/routes/seo-gating.test.ts -g "history is noindex"`
Expected: PASS (3 tests) — `/history` 200 + header + noindex meta; `/ko/history` header; `/people` no header.

- [ ] **Step 6: Commit**

```bash
git add frontend/next/app/history/layout.tsx frontend/next/middleware.ts frontend/next/test/routes/seo-gating.test.ts
git commit -m "$(printf 'feat(next): noindex the History subtree for crawlers\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 8: Host-aware canonical (async `buildMetadata`)

**Files:**
- Modify: `frontend/next/lib/seo.ts:69-116`
- Modify: `frontend/next/app/history/_index.tsx:10-17`
- Modify: `frontend/next/app/page.tsx:7`, `app/about/page.tsx:5-9`, `app/studyedition/page.tsx:6-10`, `app/%ED%8A%B9%EB%B3%84%EB%B0%98/page.tsx:9-13`
- Test: `frontend/next/test/routes/seo-gating.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `frontend/next/test/routes/seo-gating.test.ts`:
```ts
test.describe('canonical is host-aware', () => {
  test('canonical uses x-forwarded-host + proto', async ({ request }) => {
    const r = await request.get('/people', {
      headers: { ...bot, 'x-forwarded-host': 'ko.bookofmormon.online', 'x-forwarded-proto': 'https' },
    })
    const html = await r.text()
    expect(html).toContain('rel="canonical" href="https://ko.bookofmormon.online/people"')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend/next && npx playwright test test/routes/seo-gating.test.ts -g "canonical is host-aware"`
Expected: FAIL — canonical is currently the bare/apex path, not host-aware.

- [ ] **Step 3: Make `buildMetadata`/`defaultMetadata` async + host-aware**

In `frontend/next/lib/seo.ts`, add at the top (after the existing `import type { Metadata }`):
```ts
import { headers } from 'next/headers'
```
Change `buildMetadata` to `async` and compute an absolute base from request headers. Replace the function signature line
`export function buildMetadata(input: SeoInput): Metadata {`
with
`export async function buildMetadata(input: SeoInput): Promise<Metadata> {`
Then, immediately after the existing `const ogImage = ...` line and before `return {`, insert:
```ts
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? SITE_DOMAIN
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const abs = `${proto}://${host}${path}`
```
Change the returned `alternates` and `openGraph.url`:
```ts
    alternates: { canonical: abs },
```
```ts
      url: abs,
```
(Leave `ogImage` relative — `og:image`/`twitter:domain` staying apex is an accepted deviation, documented in the spec.)

Change `defaultMetadata` to async. Replace
`export function defaultMetadata(path = '/'): Metadata {`
with
`export async function defaultMetadata(path = '/'): Promise<Metadata> {`
and change its body `return buildMetadata({...})` to `return await buildMetadata({...})` (or leave `return buildMetadata(...)` — it already returns the promise; add `await` only if you prefer explicitness).

- [ ] **Step 4: Make `historyMetadata` async**

In `frontend/next/app/history/_index.tsx`, change (line 10):
```ts
export function historyMetadata(path: string): Metadata {
  return buildMetadata({
```
to:
```ts
export async function historyMetadata(path: string): Promise<Metadata> {
  return buildMetadata({
```
(Its three callers — `app/history/page.tsx`, `joseph-smith/page.tsx`, `witnesses/page.tsx` — already `return historyMetadata(...)` inside `async generateMetadata`, so they now return a promise: no edit needed.)

- [ ] **Step 5: Convert the four static `metadata` exports to `generateMetadata`**

`frontend/next/app/page.tsx` — replace:
```ts
export const metadata: Metadata = defaultMetadata('/')
```
with:
```ts
export async function generateMetadata(): Promise<Metadata> {
  return defaultMetadata('/')
}
```

`frontend/next/app/about/page.tsx` — replace the `export const metadata: Metadata = buildMetadata({ ... })` block with:
```ts
export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'About Book of Mormon Online',
    description: stripMarkup(ABOUT_HTML),
    path: '/about',
  })
}
```

`frontend/next/app/studyedition/page.tsx` — replace its `export const metadata` block with:
```ts
export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: STUDYEDITION_TITLE,
    description: STUDYEDITION_DESCRIPTION,
    path: '/studyedition',
  })
}
```

`frontend/next/app/%ED%8A%B9%EB%B3%84%EB%B0%98/page.tsx` — replace its `export const metadata` block with:
```ts
export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: STUDYEDITION_TITLE,
    description: STUDYEDITION_DESCRIPTION,
    path: '/특별반',
  })
}
```

- [ ] **Step 6: Typecheck to prove the ripple is complete**

Run: `cd frontend/next && npx tsc --noEmit`
Expected: no errors. (If any other site called `buildMetadata`/`defaultMetadata`/`historyMetadata` synchronously, `tsc` fails here — fix by `await`ing or returning the promise from an async `generateMetadata`. Per the spec, none are expected beyond the ones above.)

- [ ] **Step 7: Run the canonical test**

Run: `cd frontend/next && npx playwright test test/routes/seo-gating.test.ts -g "canonical is host-aware"`
Expected: PASS — canonical is `https://ko.bookofmormon.online/people`.

- [ ] **Step 8: Commit**

```bash
git add frontend/next/lib/seo.ts frontend/next/app/history/_index.tsx frontend/next/app/page.tsx frontend/next/app/about/page.tsx frontend/next/app/studyedition/page.tsx "frontend/next/app/%ED%8A%B9%EB%B3%84%EB%B0%98/page.tsx" frontend/next/test/routes/seo-gating.test.ts
git commit -m "$(printf 'feat(next): host-aware absolute canonical + og:url\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 9: sitemap-diff carve-out for intentionally-removed URLs

**Files:**
- Modify: `frontend/next/scripts/sitemap-diff.mjs:39`

- [ ] **Step 1: Add a gate loader + filter to the missing-URL computation**

In `frontend/next/scripts/sitemap-diff.mjs`, add after the imports/consts near the top (after the `OURS` const, ~line 7):
```js
import { readFileSync } from 'node:fs'
// Intent gates from the shared flag config: bench URLs owned by a non-crawl
// feature are INTENTIONALLY absent from ours — don't count them as MISSING.
const cfg = JSON.parse(readFileSync(new URL('../config/features.generated.json', import.meta.url), 'utf8'))
const GATES = Object.values(cfg)
  .filter((f) => f && f.seo && f.seo !== 'crawl' && Array.isArray(f.paths))
  .flatMap((f) => f.paths)
const intentionallyRemoved = (p) =>
  GATES.some((prefix) => p === prefix || p.startsWith(prefix + '/'))
```
Then change the `missing` line (currently line 39):
```js
const missing = [...bm.keys()].filter((k) => !om.has(k))
```
to:
```js
const missing = [...bm.keys()].filter((k) => !om.has(k) && !intentionallyRemoved(k))
```

- [ ] **Step 2: Verify the script runs and no longer flags History as missing**

Run (needs the dev server up on :8200 and network to the bench; if unavailable, this is a manual/CI check — note it and skip):
`cd frontend/next && node scripts/sitemap-diff.mjs`
Expected: `SITEMAP PARITY: …` (History's ~1024 bench URLs are no longer counted as MISSING because they're intentionally removed). If the bench/live server is unreachable in this environment, record that this step is verified in CI/manually and proceed.

- [ ] **Step 3: Commit**

```bash
git add frontend/next/scripts/sitemap-diff.mjs
git commit -m "$(printf 'test(next): sitemap-diff carve-out for intentionally-removed URLs\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `cd frontend/next && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full SSR gating suite (bot UA)**

Run: `cd frontend/next && npx playwright test test/routes/seo-gating.test.ts test/unit/features.test.ts`
Expected: all PASS (resolver unit tests + remove-404 + sitemap-exclude + default-nav + history-noindex + canonical-host).

- [ ] **Step 3: Full existing Next suite (regression triage)**

Run: `cd frontend/next && npx playwright test`
Expected: the new suites PASS. Some **pre-existing** route tests may fail because they run under a Chrome UA and hit the CRA proxy rather than the SSR (a known pre-existing harness issue, per the spec — NOT caused by this work). For any failure, confirm it reproduces on the pre-work commit (`git stash` or check `HEAD~9`) before attributing it here; report the pre-existing-failure set.

- [ ] **Step 4: Manual crawler smoke checks**

With the dev server running (`cd frontend/next && npm run dev`), in another shell:
```bash
curl -s -A Googlebot -o /dev/null -w "%{http_code}\n" http://localhost:8200/matters   # expect 404
curl -s -A Googlebot -o /dev/null -w "%{http_code}\n" http://localhost:8200/search    # expect 200
curl -s -A Googlebot -D - http://localhost:8200/history | grep -i x-robots-tag        # expect: X-Robots-Tag: noindex, follow
curl -s -A Googlebot http://localhost:8200/history | grep -io 'noindex'               # expect: noindex
curl -s -A Googlebot http://localhost:8200/sitemap.xml | grep -c '/history'           # expect: 0
```

- [ ] **Step 5: Config drift check**

Run: `cd frontend/next && node scripts/gen-features.mjs && git diff --exit-code config/features.generated.json`
Expected: exit 0 (committed JSON matches the YAML).

---

## Self-Review

**Spec coverage:**
- Config model (`seo`/`paths`, CRA-safe) → Task 1. ✓
- Prebuild delivery + committed JSON + gitignore + js-yaml devDep (A6/O1) → Task 2. ✓
- Intent resolver `seoIntentForPath` w/ locale-strip, segment-prefix, longest-match (A1) → Task 3. ✓
- `remove`→404 both entry points (A2) → Task 4. ✓
- Sitemap filter (A4) → Task 5. ✓
- Drop `/history` from `DEFAULT_NAV` (A5) → Task 6. ✓
- `noindex` meta (layout) + `X-Robots-Tag` (middleware), locale-aware (A3) → Task 7. ✓
- Host-aware async canonical/og:url, 4 static→generateMetadata, historyMetadata async, x-forwarded-host/proto (C1) → Task 8. ✓
- sitemap-diff carve-out → Task 9. ✓
- Bot-UA harness, drift, typecheck, manual (Verify) → Tasks 4/7/8/10; pre-existing-failure triage → Task 10 Step 3. ✓
- SSR-applies-flags-in-all-envs (no NODE_ENV gate): the resolver has no env gate by construction; nothing to add. ✓
- Deferred (B, hreflang, per-lang sitemap, og:image host): intentionally NOT tasks. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full content; commands have expected output. Task 9 Step 2 notes a legitimate environment dependency (live bench) rather than a placeholder.

**Type/name consistency:** `seoIntentForPath(pathname: string): SeoIntent` defined in Task 3, called identically in Tasks 4/5/7 and mirrored (JS) in Task 9. `SeoIntent = 'crawl'|'noindex'|'remove'` consistent. `buildMetadata`/`defaultMetadata`/`historyMetadata` async signatures consistent across Task 8. Config keys `seo`/`paths` consistent between Task 1 (YAML) and Task 3 (resolver).
