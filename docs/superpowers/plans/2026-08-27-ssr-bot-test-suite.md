# Bot-UA SSR Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Playwright suite test the Next SSR layer by sending a bot User-Agent, fix the misconfigured/mis-targeted existing tests, and add representative coverage for every SSR route class.

**Architecture:** One config change sets a bot UA at the Playwright project level so every `request` hits the SSR (not the CRA). Shared helpers (`test/helpers/meta.ts` getters + `test/helpers/ssr.ts#expectSsrPage`) DRY a status+head+body-sanity contract. Two existing tests are corrected (scripture retargeted to a real textblock URL; the generic-unknown soft-404 turned into a characterization test). Ten new route-class files use the shared helper.

**Tech Stack:** Next.js 15.3.3 SSR, Playwright (the only runner; `request` fixture over the live dev server + GraphQL backend on :5006).

**Spec:** `docs/specs/2026-08-27-ssr-bot-test-suite.md`
**All paths relative to `frontend/next/`.** Run all commands from `frontend/next/`.

**Verified representative URLs (from the spec's empirical review — use these exact ones):**
`/people/nephi1`, `/place/jerusalem-1`, `/places/jerusalem-1`, `/jaredites` (page),
`/lehites/64` (textblock), `/lehites/lehis-prophetic-call` (section), `/fax/original`,
`/timeline/lehite-family`, `/map` (index), `/maps`, `/map/neareast`,
`/map/neareast/place/assyria`, `/commentary/1012904101`, `/art/1000`, `/history`,
`/history/1836-03-oliver-cowdery`, `/history/joseph-smith`, `/history/witnesses`,
`/contents`, `/about`, `/studyedition`, `/특별반`, `/`.

---

## File Structure

**Create:** `test/helpers/ssr.ts` (`expectSsrPage`); `test/unit/meta.test.ts` (helper unit tests); `test/routes/{history,fax,timeline,map,places,commentary,art,contents,about,studyedition,default-shell}.test.ts`.

**Modify:** `playwright.config.ts` (project bot UA); `test/helpers/meta.ts` (add `getCanonical`/`getRobots`/`getH1`/`BOT_UA`); `test/routes/scripture.test.ts` (retarget `/1-nephi/1` → `/lehites/64`); `test/routes/pages.test.ts` (soft-404 characterization + section-kind case).

---

## Task 1: Shared helpers (meta getters + `expectSsrPage`) — TDD

**Files:**
- Modify: `test/helpers/meta.ts`
- Create: `test/helpers/ssr.ts`
- Test: `test/unit/meta.test.ts`

- [ ] **Step 1: Write the failing helper unit test.** Create `test/unit/meta.test.ts`:
```ts
import { test, expect } from '@playwright/test'
import { getCanonical, getRobots, getH1 } from '../helpers/meta'

const HTML = `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://bookofmormon.online/people/nephi1"/>
<meta name="robots" content="noindex, follow"/>
</head><body><h1><a href="/x">Nephi <sup>1</sup></a></h1><p>body</p></body></html>`

test.describe('meta helpers', () => {
  test('getCanonical extracts the canonical href', () => {
    expect(getCanonical(HTML)).toBe('https://bookofmormon.online/people/nephi1')
    expect(getCanonical('<html></html>')).toBeNull()
  })
  test('getRobots extracts the robots content', () => {
    expect(getRobots(HTML)).toBe('noindex, follow')
    expect(getRobots('<html></html>')).toBeNull()
  })
  test('getH1 extracts h1 text, stripping nested tags', () => {
    expect(getH1(HTML)).toBe('Nephi 1')
    expect(getH1('<html></html>')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails.**
Run: `npx playwright test test/unit/meta.test.ts`
Expected: FAIL — `getCanonical`/`getRobots`/`getH1` not exported.

- [ ] **Step 3: Add the getters to `test/helpers/meta.ts`.** Append to the file (keep the existing `getMeta`, `getTitle`, `escapeRe`):
```ts
// The Googlebot UA — middleware routes this to the SSR (not the CRA).
export const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

export function getCanonical(html: string): string | null {
  const patterns = [
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return m[1]
  }
  return null
}

// robots meta is a name= tag; reuse getMeta.
export function getRobots(html: string): string | null {
  return getMeta(html, 'robots')
}

export function getH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (!m) return null
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || null
}
```

- [ ] **Step 4: Run to verify the unit test passes.**
Run: `npx playwright test test/unit/meta.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create the shared page-contract helper** `test/helpers/ssr.ts`:
```ts
import { expect, type APIRequestContext } from '@playwright/test'
import { getTitle, getMeta, getCanonical, getH1 } from './meta'

// Asserts the common SSR-page contract for a bot request:
//   200, non-empty <title> (optionally containing a substring), a path-correct
//   absolute canonical, og:title, (optional) og:description, an og:image that
//   resolves to a PNG, and a body <h1>. Returns the HTML for extra assertions.
// canonicalPath defaults to `path`; pass it when the emitted canonical is
// percent-encoded (e.g. /특별반). Host-awareness is covered by seo-gating.test.ts;
// here we assert the canonical PATHNAME only, so it's environment-agnostic.
export async function expectSsrPage(
  request: APIRequestContext,
  path: string,
  opts: { titleIncludes?: string; canonicalPath?: string; requireDescription?: boolean } = {},
): Promise<string> {
  const requireDescription = opts.requireDescription ?? true
  const res = await request.get(path)
  expect(res.status(), `${path} status`).toBe(200)
  const html = await res.text()

  const title = getTitle(html)
  expect(title, `${path} <title>`).toBeTruthy()
  if (opts.titleIncludes) {
    expect(title!.toLowerCase(), `${path} <title> includes`).toContain(opts.titleIncludes.toLowerCase())
  }

  const canonical = getCanonical(html)
  expect(canonical, `${path} canonical present`).toBeTruthy()
  expect(canonical!, `${path} canonical absolute`).toMatch(/^https?:\/\//)
  expect(new URL(canonical!).pathname, `${path} canonical pathname`).toBe(opts.canonicalPath ?? path)

  expect(getMeta(html, 'og:title'), `${path} og:title`).toBeTruthy()
  if (requireDescription) {
    expect(getMeta(html, 'og:description'), `${path} og:description`).toBeTruthy()
  }

  const img = getMeta(html, 'og:image')
  expect(img, `${path} og:image present`).toBeTruthy()
  expect(img!, `${path} og:image absolute`).toMatch(/^https?:\/\//)
  const imgPath = new URL(img!).pathname + new URL(img!).search
  const imgRes = await request.get(imgPath)
  expect(imgRes.status(), `${path} og:image resolves`).toBe(200)
  expect(imgRes.headers()['content-type'], `${path} og:image png`).toContain('image/png')

  expect(getH1(html), `${path} <h1>`).toBeTruthy()
  return html
}
```

- [ ] **Step 6: Commit**
```bash
git add test/helpers/meta.ts test/helpers/ssr.ts test/unit/meta.test.ts
git commit -m "$(printf 'test(next): SSR test helpers (meta getters + expectSsrPage)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Flip the harness to a bot UA + correct the two broken tests

**Files:**
- Modify: `playwright.config.ts`
- Modify: `test/routes/scripture.test.ts`
- Modify: `test/routes/pages.test.ts`

- [ ] **Step 1: Set the bot UA on the Playwright project.** In `playwright.config.ts`, add the import at the top:
```ts
import { BOT_UA } from './test/helpers/meta'
```
Then change the `chromium` project's `use` (currently `use: { ...devices['Desktop Chrome'] }`) to:
```ts
      use: { ...devices['Desktop Chrome'], userAgent: BOT_UA },
```
(The later `userAgent` key overrides the device UA; the `request` fixture inherits it, so every request now hits the SSR.)

- [ ] **Step 2: Retarget the scripture (textblock) test.** In `test/routes/scripture.test.ts`, change the ref + comment (lines 4-5):
```ts
// A real textblock URL: /{pageSlug}/{blockno}. /1-nephi/1 is NOT an SSR route
// (there is no book/chapter route — see the spec's recorded gap); /lehites/64 is
// the real textblock form (also used by scripts/parity.mjs).
const REF = '/lehites/64'
```
(Leave the rest of the file unchanged — the assertions are generic and pass against a real textblock.)

- [ ] **Step 3: Replace the soft-404 test + add a section-kind case** in `test/routes/pages.test.ts`. Add the import near the top (with the existing imports):
```ts
import { expectSsrPage } from '../helpers/ssr'
```
Replace the `unknown page returns 404` test (currently lines 39-42) with:
```ts
  // Generic unknown single-segment slugs are a 200 "soft-404" DefaultShell — this
  // is intentional PHP-box parity (see docs/reference/ssr.md). KNOWN soft-404.
  test('generic unknown single-segment is a 200 soft-404 (PHP-box parity)', async ({ request }) => {
    const r = await request.get('/zzz-no-such-page-xyz')
    expect(r.status()).toBe(200)
    expect(await r.text()).toContain('Book of Mormon Online')
  })

  test('unknown entity slug (2-segment) is a real 404', async ({ request }) => {
    expect((await request.get('/people/zzz-no-such-person-xyz')).status()).toBe(404)
  })

  // Section kind: 2-segment non-numeric — the bulk of the sitemap.
  test('section route /{page}/{section} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/lehites/lehis-prophetic-call')
  })
```

- [ ] **Step 4: Run the full existing route suite — all green now.**
Run: `npx playwright test test/routes/pages.test.ts test/routes/scripture.test.ts test/routes/people.test.ts test/routes/place.test.ts test/routes/sitemap.test.ts test/routes/og.test.ts test/routes/robots.test.ts test/routes/seo-gating.test.ts test/unit`
Expected: ALL PASS. (The UA flip moves the previously-failing people/place/pages/scripture assertions onto the SSR; the two corrections handle the soft-404 and the scripture URL.) If any test still fails, read its assertion vs the live SSR (`curl -A Googlebot http://localhost:3001<path>`) and report — do not mask a real gap.

- [ ] **Step 5: Commit**
```bash
git add playwright.config.ts test/routes/scripture.test.ts test/routes/pages.test.ts
git commit -m "$(printf 'test(next): bot-UA Playwright project + fix scripture URL & soft-404 expectation\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: History route coverage

**Files:**
- Create: `test/routes/history.test.ts`

- [ ] **Step 1: Write the file.** Create `test/routes/history.test.ts`:
```ts
import { test, expect } from '@playwright/test'
import { getRobots } from '../helpers/meta'
import { expectSsrPage } from '../helpers/ssr'

test.describe('History routes (noindex subtree)', () => {
  test('/history index renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/history', { titleIncludes: 'histor' })
  })
  test('/history/{doc} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/history/1836-03-oliver-cowdery')
  })
  test('/history/joseph-smith renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/history/joseph-smith')
  })
  test('/history/witnesses renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/history/witnesses')
  })
  test('/history is noindex (meta + X-Robots-Tag)', async ({ request }) => {
    const r = await request.get('/history')
    expect(r.headers()['x-robots-tag']).toBe('noindex, follow')
    expect(getRobots(await r.text())).toBe('noindex, follow')
  })
})
```

- [ ] **Step 2: Run it.**
Run: `npx playwright test test/routes/history.test.ts`
Expected: PASS (5 tests). If a test fails, inspect the live SSR for that path and report (a real gap, not something to mask).

- [ ] **Step 3: Commit**
```bash
git add test/routes/history.test.ts
git commit -m "$(printf 'test(next): SSR coverage for /history routes\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: Fax + Timeline coverage

**Files:**
- Create: `test/routes/fax.test.ts`, `test/routes/timeline.test.ts`

- [ ] **Step 1: Write `test/routes/fax.test.ts`:**
```ts
import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Fax routes', () => {
  test('/fax index renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/fax')
  })
  test('/fax/{slug} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/fax/original')
  })
})
```

- [ ] **Step 2: Write `test/routes/timeline.test.ts`:**
```ts
import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Timeline routes', () => {
  test('/timeline index renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/timeline')
  })
  test('/timeline/{marker} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/timeline/lehite-family')
  })
})
```

- [ ] **Step 3: Run both.**
Run: `npx playwright test test/routes/fax.test.ts test/routes/timeline.test.ts`
Expected: PASS (4 tests). Report any failure against the live SSR.

- [ ] **Step 4: Commit**
```bash
git add test/routes/fax.test.ts test/routes/timeline.test.ts
git commit -m "$(printf 'test(next): SSR coverage for /fax and /timeline routes\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: Map + Places coverage

**Files:**
- Create: `test/routes/map.test.ts`, `test/routes/places.test.ts`

- [ ] **Step 1: Write `test/routes/map.test.ts`:**
```ts
import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Map routes', () => {
  test('/map index renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/map')
  })
  test('/maps (distinct index) renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/maps')
  })
  test('/map/{type} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/map/neareast')
  })
  test('/map/{type}/place/{slug} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/map/neareast/place/assyria')
  })
})
```

- [ ] **Step 2: Write `test/routes/places.test.ts`** (the `/places` variant — distinct route/canonical base from `/place`):
```ts
import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Places route /places/{slug}', () => {
  test('/places/{slug} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/places/jerusalem-1')
  })
})
```

- [ ] **Step 3: Run both.**
Run: `npx playwright test test/routes/map.test.ts test/routes/places.test.ts`
Expected: PASS (5 tests). If `/places/jerusalem-1`'s canonical pathname isn't `/places/jerusalem-1` (e.g. it self-canonicalizes to `/place/…`), read the emitted canonical and either pass `canonicalPath` or report the finding — do not mask.

- [ ] **Step 4: Commit**
```bash
git add test/routes/map.test.ts test/routes/places.test.ts
git commit -m "$(printf 'test(next): SSR coverage for /map, /maps and /places routes\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: Commentary + Art coverage

**Files:**
- Create: `test/routes/commentary.test.ts`, `test/routes/art.test.ts`

- [ ] **Step 1: Write `test/routes/commentary.test.ts`** (id has no index/sitemap; hardcoded, derived from a textblock page):
```ts
import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

// /commentary/{id} — 10-digit content key, reachable via textblock pages
// (e.g. /lehites/64 links to it). No index/sitemap to derive from.
test.describe('Commentary route /commentary/{id}', () => {
  test('/commentary/{id} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/commentary/1012904101')
  })
})
```

- [ ] **Step 2: Write `test/routes/art.test.ts`** (no index/sitemap; hardcoded verified id):
```ts
import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

// /art/{id} — no index page or sitemap entry; /art/1000 is a verified existing id.
test.describe('Art route /art/{id}', () => {
  test('/art/{id} renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/art/1000')
  })
})
```

- [ ] **Step 3: Run both.**
Run: `npx playwright test test/routes/commentary.test.ts test/routes/art.test.ts`
Expected: PASS (2 tests). If `/commentary/1012904101` or `/art/1000` 404s (data drift), find a live id: `curl -s -A Googlebot http://localhost:3001/lehites/64 | grep -o '/commentary/[0-9]*' | head -1` for commentary; report for art (no index) and skip with a note if none is found.

- [ ] **Step 4: Commit**
```bash
git add test/routes/commentary.test.ts test/routes/art.test.ts
git commit -m "$(printf 'test(next): SSR coverage for /commentary and /art routes\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 7: Static/simple pages (contents, about, studyedition, default shell)

**Files:**
- Create: `test/routes/contents.test.ts`, `test/routes/about.test.ts`, `test/routes/studyedition.test.ts`, `test/routes/default-shell.test.ts`

- [ ] **Step 1: Write `test/routes/contents.test.ts`** (contents ships an empty og:description by design — parity):
```ts
import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Contents route /contents', () => {
  test('/contents renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/contents', { requireDescription: false })
  })
})
```

- [ ] **Step 2: Write `test/routes/about.test.ts`:**
```ts
import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('About route /about', () => {
  test('/about renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/about', { titleIncludes: 'about' })
  })
})
```

- [ ] **Step 3: Write `test/routes/studyedition.test.ts`** (the `/특별반` alias emits a percent-encoded canonical):
```ts
import { test } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Study edition routes', () => {
  test('/studyedition renders SSR content', async ({ request }) => {
    await expectSsrPage(request, '/studyedition')
  })
  test('/특별반 alias renders SSR content (percent-encoded canonical)', async ({ request }) => {
    await expectSsrPage(request, '/특별반', { canonicalPath: '/%ED%8A%B9%EB%B3%84%EB%B0%98' })
  })
})
```

- [ ] **Step 4: Write `test/routes/default-shell.test.ts`:**
```ts
import { test, expect } from '@playwright/test'
import { expectSsrPage } from '../helpers/ssr'

test.describe('Default shell /', () => {
  test('/ renders the default study-resource shell', async ({ request }) => {
    const html = await expectSsrPage(request, '/', { canonicalPath: '/' })
    // Default nav is present in the shell.
    expect(html).toContain('href="/contents"')
  })
})
```

- [ ] **Step 5: Run all four.**
Run: `npx playwright test test/routes/contents.test.ts test/routes/about.test.ts test/routes/studyedition.test.ts test/routes/default-shell.test.ts`
Expected: PASS (5 tests). If `/특별반`'s canonical pathname differs from the encoded literal, read the actual value and adjust `canonicalPath` (or decode-compare) — report the exact emitted form.

- [ ] **Step 6: Commit**
```bash
git add test/routes/contents.test.ts test/routes/about.test.ts test/routes/studyedition.test.ts test/routes/default-shell.test.ts
git commit -m "$(printf 'test(next): SSR coverage for contents/about/studyedition/default-shell\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check.**
Run: `npx tsc --noEmit`
Expected: no errors (the helpers + test files type-check).

- [ ] **Step 2: Full suite green.**
Run: `npx playwright test`
Expected: ALL tests pass — the previously-22-failing tests now pass (UA flip + corrections), plus the ~25 new coverage tests, plus the existing seo-gating and unit suites. No test relies on the CRA (`:8201`).

- [ ] **Step 3: Confirm no reliance on the CRA.**
Confirm the run above did not require anything on `:8201`. (The bot UA means every request goes to the SSR; the CRA is never proxied to.)

- [ ] **Step 4: Report coverage.**
List the route classes now covered (people, place, places, page, section, textblock, sitemap, og, robots, history[+joseph-smith/witnesses], fax, timeline, map[+maps+type+place], commentary, art, contents, about, studyedition[+특별반], default-shell, plus the gating in seo-gating). Note the recorded out-of-scope gap: `/{book}/{chapter}` (e.g. `/1-nephi/1`) is a bot 404 (no SSR chapter route) — tracked in the spec for a future fix, not addressed here.

---

## Self-Review

**Spec coverage:**
- Harness UA flip (project-level bot UA) → Task 2. ✓
- Helpers (`getCanonical`/`getRobots`/`getH1`/`BOT_UA` + `expectSsrPage`) → Task 1. ✓
- Correct the 2 broken tests (scripture retarget, soft-404 characterization + entity-404) → Task 2. ✓
- Section-kind coverage → Task 2 (in pages.test.ts). ✓
- Every route class: history(+js/witnesses) T3; fax/timeline T4; map(+maps+type+place)/places T5; commentary/art T6; contents/about/studyedition(+특별반)/default-shell T7. ✓
- Per-route assertions: status + path-correct absolute canonical + og:title/description + og:image→PNG + `<h1>` → `expectSsrPage` (T1), used everywhere. ✓
- Env-agnostic canonical (pathname compare, not hardcoded host) → `expectSsrPage`. ✓
- og:image apex strip-host-refetch → `expectSsrPage`. ✓
- Empty og:description for /contents → `requireDescription:false` (T7). ✓
- `/특별반` percent-encoded canonical → `canonicalPath` opt (T7). ✓
- Recorded book/chapter gap, not masked → T2 scripture comment + T8 report. ✓
- Verification (tsc, full suite, no-CRA) → T8. ✓

**Placeholder scan:** No TBD/TODO. Every test file shows full content. Commands have expected output. The "if a test fails, inspect the live SSR and report" steps are deliberate gap-surfacing (as scripture proved), not vague fillers.

**Type/name consistency:** `expectSsrPage(request, path, { titleIncludes?, canonicalPath?, requireDescription? })` defined in T1, called with those exact opts in T2–T7. `getCanonical`/`getRobots`/`getH1`/`BOT_UA` defined in T1, imported unchanged after. `BOT_UA` imported by `playwright.config.ts` (T2) from `test/helpers/meta.ts` (T1).
