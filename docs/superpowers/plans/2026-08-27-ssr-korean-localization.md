# SSR Host-Based Localization (Korean-first) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Next SSR layer serve each language domain in its own language — detected from the host — so crawlers on `몰몬경.kr` get Korean content, chrome, `<html lang>`, og-image font, and self-canonical, matching the live PHP box.

**Architecture:** One resolver maps the request **host → internal language code**; middleware puts it on `x-lang`; `gql()` reads `x-lang` and POSTs to `${GRAPHQL_URL}/{lang}` (localized content); chrome comes from the backend `labels` query (+ a per-language body table); `<html lang>`, og `lang`, canonical host, and a Naver meta all key off `x-lang`.

**Tech Stack:** Next.js 15 SSR (App Router), Playwright, live Fastify GraphQL on :5006 (localized at `/{lang}`).

**Spec:** `docs/specs/2026-08-27-ssr-korean-localization.md`
**All paths relative to `frontend/next/`.** Run all commands from `frontend/next/`.

**Verified facts (do not re-derive):** `POST /graphql/ko` → `니파이1`; unknown codes clamp to `en` **silently** (assert Korean strings, not just 200); labels are `{ labels { key val } }` with `home_title=몰몬경·KR`, `home_heading=몰몬경 학습 자원`, seven `menu_*` keys, and `title_*` keys; `home_title + ': ' + home_heading` composes both the Korean and English default titles; en labels are byte-identical to the current constants; Naver token = `2e4aebbde9e85f415075e53c9ebcad129e3a83e4`; the KR box nav has 6 items (no fax).

---

## File Structure

**Modify:** `lib/locales.ts` (host→lang + bcp47), `middleware.ts` (host-based x-lang + debug header), `lib/graphql.ts` (lang endpoint + override), `lib/sitemap.ts` (pin en), `lib/entity.ts` + `app/people/page.tsx` (unicode superscript), `lib/seo.ts` (safeHost allowlist, `getSiteChrome`, og lang, naver), `app/layout.tsx` (`<html lang>`), `app/_components/DefaultShell.tsx` (async + nav labels), the index/static page metadata (`app/people`, `contents`, `about`, `fax`, `timeline`, `places`, `map`, `history/_index`).
**Create:** `lib/labels.ts`, `test/routes/korean.test.ts`, unit tests under `test/unit/`.

---

## Task 1: Host→lang resolver (`lib/locales.ts`) — TDD

**Files:** Modify `lib/locales.ts`; Test `test/unit/locales.test.ts`.

- [ ] **Step 1: Write the failing test.** Create `test/unit/locales.test.ts`:
```ts
import { test, expect } from '@playwright/test'
import { langForHost, bcp47 } from '../../lib/locales'

test.describe('langForHost', () => {
  test('apex → en', () => { expect(langForHost('bookofmormon.online')).toBe('en') })
  test('korean punycode + utf8 → ko', () => {
    expect(langForHost('xn--289a67xla.kr')).toBe('ko')
    expect(langForHost('몰몬경.kr')).toBe('ko')
  })
  test('strips port + lowercases', () => { expect(langForHost('XN--289A67XLA.KR:443')).toBe('ko') })
  test('internal codes verbatim from CRA', () => {
    expect(langForHost('swe.bookofmormon.online')).toBe('swe')
    expect(langForHost('sachmacmon.vn')).toBe('vn')
    expect(langForHost('mormonovaknjiga.si')).toBe('slv')
  })
  test('unknown host → en', () => { expect(langForHost('evil.example.com')).toBe('en'); expect(langForHost(null)).toBe('en') })
})
test.describe('bcp47', () => {
  test('maps internal→tag', () => { expect(bcp47('swe')).toBe('sv'); expect(bcp47('vn')).toBe('vi'); expect(bcp47('ko')).toBe('ko') })
})
```

- [ ] **Step 2: Run — fails.**
Run: `npx playwright test test/unit/locales.test.ts`
Expected: FAIL — `langForHost`/`bcp47` not exported.

- [ ] **Step 3: Implement.** APPEND to `lib/locales.ts` (keep the existing `LANG_PREFIXES`/`LOCALE_SEGS`):
```ts
// Host → backend INTERNAL language code (GraphQL endpoint, labels, og lang).
// Verbatim from the CRA LanguageSelect (webapp Sidebar.js). NOTE: 'slv' and 'tr'
// are NOT in the backend SUPPORTED_LANGUAGES and silently clamp to English —
// documented pre-existing gap, out of scope.
export const HOST_LANG: Record<string, string> = {
  'bookofmormon.online': 'en',
  '몰몬경.kr': 'ko',
  'xn--289a67xla.kr': 'ko',
  'libromormon.es': 'es',
  'livredemormon.fr': 'fr',
  'buchmormon.de': 'de',
  'swe.bookofmormon.online': 'swe',
  'sachmacmon.vn': 'vn',
  'xn--80aahtjpadfibw.net': 'ru',
  'mormonovaknjiga.si': 'slv',
  'tr.bookofmormon.online': 'tr',
  'tgl.bookofmormon.online': 'tgl',
}

// Internal code → BCP47 tag for <html lang>. Identity unless listed.
const BCP47_MAP: Record<string, string> = { swe: 'sv', jpn: 'ja', vn: 'vi', tgl: 'tl', slv: 'sl' }

export function langForHost(host: string | null | undefined): string {
  const bare = (host ?? '').split(',')[0].trim().split(':')[0].toLowerCase()
  return HOST_LANG[bare] ?? 'en'
}

export function bcp47(code: string): string {
  return BCP47_MAP[code] ?? code
}
```

- [ ] **Step 4: Run — passes.**
Run: `npx playwright test test/unit/locales.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit.**
```bash
git add lib/locales.ts test/unit/locales.test.ts
git commit -m "$(printf 'feat(next): host→lang resolver (langForHost + bcp47)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Middleware host-based `x-lang` + `X-Resolved-Lang` header

**Files:** Modify `middleware.ts`; Test `test/routes/korean.test.ts` (new).

- [ ] **Step 1: Write the failing test.** Create `test/routes/korean.test.ts`:
```ts
import { test, expect } from '@playwright/test'

const bot = { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
const ko = { ...bot, 'x-forwarded-host': 'xn--289a67xla.kr', 'x-forwarded-proto': 'https' }

test.describe('host→lang middleware', () => {
  test('korean host resolves to ko', async ({ request }) => {
    const r = await request.get('/', { headers: ko })
    expect(r.headers()['x-resolved-lang']).toBe('ko')
  })
  test('apex host resolves to en', async ({ request }) => {
    const r = await request.get('/', { headers: bot })
    expect(r.headers()['x-resolved-lang']).toBe('en')
  })
})
```

- [ ] **Step 2: Run — fails.**
Run: `npx playwright test test/routes/korean.test.ts -g "host→lang"`
Expected: FAIL — no `x-resolved-lang` header.

- [ ] **Step 3: Implement.** In `middleware.ts`, add to the top imports:
```ts
import { langForHost } from '@/lib/locales'
```
Replace the bot-branch lang computation (currently `const segments = pathname.split('/').filter(Boolean)` and `const lang = LANG_PREFIXES.includes(segments[0]) ? segments[0] : 'en'`) with:
```ts
  // Language is by HOST (subdomain/domain), not URL path.
  const lang = langForHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'))
```
and add the debug header on the returned response (right after `const res = NextResponse.next(...)`):
```ts
  res.headers.set('X-Resolved-Lang', lang)
```
(Leave the existing `x-lang` set, the `X-Robots-Tag` block, and the human-branch `LOCALE_SEGS` logic unchanged.)

- [ ] **Step 4: Run — passes.**
Run: `npx playwright test test/routes/korean.test.ts -g "host→lang"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit.**
```bash
git add middleware.ts test/routes/korean.test.ts
git commit -m "$(printf 'feat(next): resolve SSR language from host, expose X-Resolved-Lang\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Lang-aware GraphQL (`lib/graphql.ts`)

**Files:** Modify `lib/graphql.ts`; append to `test/routes/korean.test.ts`.

- [ ] **Step 1: Add the failing test.** Append to `test/routes/korean.test.ts`:
```ts
test.describe('lang-aware content', () => {
  test('korean host serves Korean person name', async ({ request }) => {
    const html = await (await request.get('/people/nephi1', { headers: ko })).text()
    expect(html).toContain('니파이') // Nephi in Korean (assert the STRING — unknown codes clamp to en)
  })
  test('apex host still English', async ({ request }) => {
    const html = await (await request.get('/people/nephi1', { headers: bot })).text()
    expect(html.toLowerCase()).toContain('nephi')
  })
})
```

- [ ] **Step 2: Run — fails.**
Run: `npx playwright test test/routes/korean.test.ts -g "lang-aware content"`
Expected: FAIL — korean request still returns English `Nephi`.

- [ ] **Step 3: Implement.** In `lib/graphql.ts`, add the import:
```ts
import { headers } from 'next/headers'
```
Change the `gql` signature's options type to include `lang`, and resolve + use it:
```ts
export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: { revalidate?: number | false; lang?: string } = {}
): Promise<T> {
  // Override short-circuits BEFORE headers() so pinned callers (sitemap) stay static/ISR.
  const lang = options.lang ?? (await headers()).get('x-lang') ?? 'en'
  const url = `${GRAPHQL_URL}${lang === 'en' ? '' : '/' + lang}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next:
      options.revalidate === false
        ? { revalidate: 0 }
        : { revalidate: options.revalidate ?? 3600 },
  })
  if (!res.ok) throw new Error(`GraphQL fetch failed: ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data as T
}
```

- [ ] **Step 4: Run — passes.**
Run: `npx playwright test test/routes/korean.test.ts -g "lang-aware content"`
Expected: PASS — korean `/people/nephi1` contains `니파이`, apex contains `nephi`.

- [ ] **Step 5: Commit.**
```bash
git add lib/graphql.ts test/routes/korean.test.ts
git commit -m "$(printf 'feat(next): lang-aware GraphQL endpoint from x-lang\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: Pin the sitemap to English (preserve ISR)

**Files:** Modify `lib/sitemap.ts`; append to `test/routes/korean.test.ts`.

- [ ] **Step 1: Add the failing/lock-in test.** Append to `test/routes/korean.test.ts`:
```ts
test.describe('sitemap stays English + valid', () => {
  test('/sitemap.xml has content URLs regardless of host', async ({ request }) => {
    const r = await request.get('/sitemap.xml', { headers: ko })
    expect(r.status()).toBe(200)
    expect(await r.text()).toContain('<loc>https://bookofmormon.online/people</loc>')
  })
})
```

- [ ] **Step 2: Run — verify current state.**
Run: `npx playwright test test/routes/korean.test.ts -g "sitemap stays"`
Expected: likely PASS already (slug set is language-invariant); this locks it in against the Step-3 change.

- [ ] **Step 3: Pin lang.** In `lib/sitemap.ts`, add `lang: 'en'` to the options object of **all 8** `gql(...)` calls (lines 43, 45, 63, 67, 74, 87, 102, 124). Each currently passes `{ revalidate: 3600 }`; change to `{ revalidate: 3600, lang: 'en' }`. READ the file first to confirm each call site's exact options argument. (This keeps the sitemap English and, because the override skips `headers()`, preserves the route's `revalidate = 3600` ISR.)

- [ ] **Step 4: Run — passes.**
Run: `npx playwright test test/routes/korean.test.ts -g "sitemap stays"`
Expected: PASS — sitemap 200 + apex `/people` present.

- [ ] **Step 5: Commit.**
```bash
git add lib/sitemap.ts test/routes/korean.test.ts
git commit -m "$(printf 'fix(next): pin sitemap gql to en to preserve ISR under lang-aware fetch\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: Unicode superscript (Korean disambiguators) — TDD

**Files:** Modify `lib/entity.ts`, `app/people/page.tsx`; Test `test/unit/entity.test.ts`.

- [ ] **Step 1: Write the failing test.** Create `test/unit/entity.test.ts`:
```ts
import { test, expect } from '@playwright/test'
import { superscript } from '../../lib/entity'

test.describe('superscript (unicode)', () => {
  test('Korean disambiguator', () => { expect(superscript('니파이1')).toBe('니파이¹') })
  test('English still works', () => { expect(superscript('Nephi1')).toBe('Nephi¹') })
  test('does not mangle years/standalone numbers', () => {
    expect(superscript('1830')).toBe('1830')
    expect(superscript('Alma 32')).toBe('Alma 32')
  })
})
```

- [ ] **Step 2: Run — fails.**
Run: `npx playwright test test/unit/entity.test.ts`
Expected: FAIL — `니파이1` stays `니파이1` (ASCII-only regex).

- [ ] **Step 3: Implement.** In `lib/entity.ts:11`, change `/([A-Za-z])(\d+)/g` to `/(\p{L})(\d+)/gu`. Also in `app/people/page.tsx`'s `supTitle` (~line 16), change `/([A-Za-z])(\s*)(\d+)/g` to `/(\p{L})(\s*)(\d+)/gu`.

- [ ] **Step 4: Run — passes.**
Run: `npx playwright test test/unit/entity.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit.**
```bash
git add lib/entity.ts app/people/page.tsx test/unit/entity.test.ts
git commit -m "$(printf 'fix(next): unicode superscript for non-ASCII disambiguators\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: Self-on-host canonical (`safeHost` allowlist)

**Files:** Modify `lib/seo.ts`; append to `test/routes/korean.test.ts`.

- [ ] **Step 1: Add the failing test.** Append to `test/routes/korean.test.ts`:
```ts
import { getCanonical } from '../helpers/meta'
test.describe('self-on-host canonical', () => {
  test('korean host self-canonicalizes', async ({ request }) => {
    const html = await (await request.get('/people/nephi1', { headers: ko })).text()
    expect(getCanonical(html)).toBe('https://xn--289a67xla.kr/people/nephi1')
  })
  test('untrusted host still falls back to apex', async ({ request }) => {
    const html = await (await request.get('/people/nephi1', { headers: { ...bot, 'x-forwarded-host': 'evil.example.com' } })).text()
    expect(getCanonical(html)!).toContain('bookofmormon.online/people/nephi1')
  })
})
```

- [ ] **Step 2: Run — fails.**
Run: `npx playwright test test/routes/korean.test.ts -g "self-on-host"`
Expected: FAIL — korean canonical currently bounces to apex (safeHost rejects the .kr host).

- [ ] **Step 3: Implement.** In `lib/seo.ts`, add the import:
```ts
import { HOST_LANG } from './locales'
```
Change `safeHost` to also allow any host in the language map:
```ts
function safeHost(candidate: string | null): string {
  const host = (candidate ?? '').split(',')[0].trim()
  const bare = host.split(':')[0].toLowerCase()
  const ok = bare === SITE_DOMAIN || bare.endsWith('.' + SITE_DOMAIN) || bare === 'localhost' || bare in HOST_LANG
  return ok ? host : SITE_DOMAIN
}
```

- [ ] **Step 4: Run — passes.**
Run: `npx playwright test test/routes/korean.test.ts -g "self-on-host"`
Expected: PASS — korean self-canonical; evil host → apex.

- [ ] **Step 5: Commit.**
```bash
git add lib/seo.ts test/routes/korean.test.ts
git commit -m "$(printf 'feat(next): allow language domains to self-canonicalize (safeHost)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 7: Labels + `getSiteChrome` + localized chrome in metadata

**Files:** Create `lib/labels.ts`; Modify `lib/seo.ts`; append to `test/routes/korean.test.ts`.

- [ ] **Step 1: Capture the Korean default body from the live box.**
Run: `curl -s -A Googlebot "https://xn--289a67xla.kr/" | grep -oiE '<p>[^<]{40,}</p>' | head -1`
Record the full Korean body paragraph text (used in Step 4's `DEFAULT_BODY_BY_LANG.ko`). If the `<p>` is split, also capture the home `<meta name="description">` content as a fallback.

- [ ] **Step 2: Add the failing test.** Append to `test/routes/korean.test.ts`:
```ts
import { getTitle } from '../helpers/meta'
test.describe('localized chrome', () => {
  test('korean home title uses Korean suffix', async ({ request }) => {
    const html = await (await request.get('/', { headers: ko })).text()
    expect(getTitle(html)).toBe('몰몬경·KR: 몰몬경 학습 자원')
  })
  test('korean person title has Korean suffix', async ({ request }) => {
    const html = await (await request.get('/people/nephi1', { headers: ko })).text()
    expect(getTitle(html)).toContain('몰몬경·KR')
  })
  test('apex home title unchanged', async ({ request }) => {
    const html = await (await request.get('/', { headers: bot })).text()
    expect(getTitle(html)).toBe('Book of Mormon Online: A Book of Mormon Study Resource')
  })
})
```

- [ ] **Step 3: Run — fails.**
Run: `npx playwright test test/routes/korean.test.ts -g "localized chrome"`
Expected: FAIL — korean home title still English.

- [ ] **Step 4: Implement `lib/labels.ts`.** Create it:
```ts
import { cache } from 'react'
import { gql } from './graphql'

interface LabelRow { key: string; val: string }

// Localized UI labels for the serving language (gql reads x-lang). Cached per request.
export const getLabels = cache(async (): Promise<Record<string, string>> => {
  const data = await gql<{ labels: LabelRow[] }>(`{ labels { key val } }`, {}, { revalidate: 3600 })
  const map: Record<string, string> = {}
  for (const row of data.labels ?? []) map[row.key] = row.val
  return map
})

export async function label(key: string, fallback: string): Promise<string> {
  return (await getLabels())[key] ?? fallback
}
```

- [ ] **Step 5: Add `getSiteChrome` to `lib/seo.ts`.** Add the imports:
```ts
import { getLabels } from './labels'
```
and (near the top-level constants) the per-language body table + getter (paste the Korean body captured in Step 1):
```ts
// Default body paragraph is NOT in the labels table (verified) — per-language here.
// English = the existing DEFAULT_BODY constant; Korean captured from 몰몬경.kr.
const DEFAULT_BODY_BY_LANG: Record<string, string> = {
  en: DEFAULT_BODY,
  ko: '<<PASTE KOREAN BODY FROM STEP 1>>',
}

// English short-circuits to the existing sync constants (labels are byte-identical);
// other languages compose from labels + the body table.
export async function getSiteChrome(): Promise<{ siteSuffix: string; defaultTitle: string; defaultBody: string }> {
  const lang = (await headers()).get('x-lang') ?? 'en'
  if (lang === 'en') return { siteSuffix: SITE_SUFFIX, defaultTitle: DEFAULT_TITLE, defaultBody: DEFAULT_BODY }
  const labels = await getLabels()
  const homeTitle = labels['home_title'] ?? SITE_SUFFIX
  const homeHeading = labels['home_heading']
  return {
    siteSuffix: homeTitle,
    defaultTitle: homeHeading ? `${homeTitle}: ${homeHeading}` : DEFAULT_TITLE,
    defaultBody: DEFAULT_BODY_BY_LANG[lang] ?? DEFAULT_BODY,
  }
}
```

- [ ] **Step 6: Use it in `buildMetadata` + `defaultMetadata`.** In `buildMetadata`, replace `const fullTitle = withSuffix ? \`${title} • ${SITE_SUFFIX}\` : title` with:
```ts
  const { siteSuffix } = await getSiteChrome()
  const fullTitle = withSuffix ? `${title} • ${siteSuffix}` : title
```
In `defaultMetadata`, replace its body with:
```ts
export async function defaultMetadata(path = '/'): Promise<Metadata> {
  const { defaultTitle, defaultBody } = await getSiteChrome()
  return buildMetadata({ title: defaultTitle, description: defaultBody, path, withSuffix: false })
}
```

- [ ] **Step 7: Run — passes.**
Run: `npx playwright test test/routes/korean.test.ts -g "localized chrome"`
Expected: PASS — korean home `몰몬경·KR: 몰몬경 학습 자원`; korean person suffix `몰몬경·KR`; apex unchanged.

- [ ] **Step 8: Commit.**
```bash
git add lib/labels.ts lib/seo.ts test/routes/korean.test.ts
git commit -m "$(printf 'feat(next): localized site chrome from labels + per-lang body\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 8: Localize index/static page titles

**Files:** Modify `app/people/page.tsx`, `app/contents/page.tsx`, `app/about/page.tsx`, `app/fax/page.tsx`, `app/timeline/page.tsx`, `app/places/page.tsx`, `app/map/page.tsx`, `app/history/_index.tsx`; append to `test/routes/korean.test.ts`.

- [ ] **Step 1: Find the title label keys.** Fetch the ko labels and locate the `title_*` keys and the live titles:
Run: `curl -s -X POST http://localhost:5006/graphql/ko -H 'content-type: application/json' -d '{"query":"{ labels { key val } }"}' | tr ',' '\n' | grep -iE 'title_|목차|인물|장소|사본|소개|연대'`
Record the key→Korean-value map (e.g. `title_people`→`몰몬경에 나오는 인물`, `table_of_contents`→`목차`). Cross-check each against the live box title (`curl -s -A Googlebot https://xn--289a67xla.kr/people | grep -o '<title>[^<]*'`).

- [ ] **Step 2: Add the failing test.** Append to `test/routes/korean.test.ts`:
```ts
test.describe('localized index titles', () => {
  test('/people index is Korean', async ({ request }) => {
    const html = await (await request.get('/people', { headers: ko })).text()
    expect(getTitle(html)).toContain('몰몬경에 나오는 인물')
  })
  test('/contents index is Korean', async ({ request }) => {
    const html = await (await request.get('/contents', { headers: ko })).text()
    expect(getTitle(html)).toContain('목차')
  })
})
```

- [ ] **Step 3: Run — fails.**
Run: `npx playwright test test/routes/korean.test.ts -g "localized index titles"`
Expected: FAIL — mixed-language `People in the Book of Mormon • 몰몬경·KR`.

- [ ] **Step 4: Implement.** In each index/static route's `generateMetadata`, replace the hardcoded English `title:` with a `label(key, englishFallback)` lookup, using the keys found in Step 1. Add `import { label } from '@/lib/labels'` to each file. Example for `app/people/page.tsx`:
```ts
export async function generateMetadata(): Promise<Metadata> {
  const people = await getPeopleList()
  return buildMetadata({
    title: await label('title_people', 'People in the Book of Mormon'),
    description: people.map((p) => p.name).join(' • '),
    path: '/people',
  })
}
```
Repeat for `contents` (`table_of_contents`), `about`, `fax`, `timeline`, `places`, `map`, `history/_index` — each with its key from Step 1 and the current English string as the fallback. (If a route has no matching label key, keep the English string via the fallback — the `label()` fallback handles it.)

- [ ] **Step 5: Run — passes.**
Run: `npx playwright test test/routes/korean.test.ts -g "localized index titles"`
Expected: PASS — `/people` → `몰몬경에 나오는 인물`, `/contents` → `목차`.

- [ ] **Step 6: Commit.**
```bash
git add app/people/page.tsx app/contents/page.tsx app/about/page.tsx app/fax/page.tsx app/timeline/page.tsx app/places/page.tsx app/map/page.tsx app/history/_index.tsx test/routes/korean.test.ts
git commit -m "$(printf 'feat(next): localize index/static page titles via labels\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 9: DefaultShell — async + localized body/nav

**Files:** Modify `app/_components/DefaultShell.tsx`; append to `test/routes/korean.test.ts`.

- [ ] **Step 1: Add the failing test.** Append to `test/routes/korean.test.ts`:
```ts
test.describe('localized default shell', () => {
  test('korean unknown-slug shell has Korean nav + body', async ({ request }) => {
    const html = await (await request.get('/zzz-no-such-page-xyz', { headers: ko })).text()
    expect(html).toContain('목차')       // Contents nav label, Korean
    expect(html).not.toContain('Table of Contents')
  })
  test('english shell unchanged', async ({ request }) => {
    const html = await (await request.get('/zzz-no-such-page-xyz', { headers: bot })).text()
    expect(html).toContain('Table of Contents')
  })
})
```

- [ ] **Step 2: Run — fails.**
Run: `npx playwright test test/routes/korean.test.ts -g "localized default shell"`
Expected: FAIL — Korean shell still English nav.

- [ ] **Step 3: Implement.** Rewrite `app/_components/DefaultShell.tsx` as an async server component that localizes for non-English (English keeps the current hardcoded `DEFAULT_NAV` labels):
```tsx
import { headers } from 'next/headers'
import { DEFAULT_NAV, getSiteChrome } from '@/lib/seo'
import { label } from '@/lib/labels'

// Nav href → CRA label key (labels localize the visible text; hrefs are stable).
const NAV_LABEL_KEY: Record<string, string> = {
  '/contents': 'menu_contents', '/timeline': 'menu_timeline', '/map': 'menu_map',
  '/people': 'menu_people', '/places': 'menu_places', '/fax': 'menu_fax', '/about': 'menu_about',
}

export async function DefaultShell() {
  const lang = (await headers()).get('x-lang') ?? 'en'
  const { defaultTitle, defaultBody } = await getSiteChrome()
  const nav = await Promise.all(
    DEFAULT_NAV.map(async (item) => ({
      href: item.href,
      label: lang === 'en' ? item.label : await label(NAV_LABEL_KEY[item.href] ?? '', item.label),
    })),
  )
  return (
    <>
      <h1>{defaultTitle}</h1>
      <p>{defaultBody}</p>
      <ul>
        {nav.map((item) => (
          <li key={item.href}>
            <a href={item.href}>{item.label}</a>
          </li>
        ))}
      </ul>
    </>
  )
}
```
(`app/page.tsx:12` and `app/[...path]/page.tsx:120` render `<DefaultShell />`; a sync server parent may render an async server child — no change needed there.)

- [ ] **Step 4: Run — passes.**
Run: `npx playwright test test/routes/korean.test.ts -g "localized default shell"`
Expected: PASS — Korean shell shows `목차`; English shell keeps `Table of Contents`.

- [ ] **Step 5: Commit.**
```bash
git add app/_components/DefaultShell.tsx test/routes/korean.test.ts
git commit -m "$(printf 'feat(next): localize DefaultShell body + nav (non-en)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 10: `<html lang>` from the resolved language

**Files:** Modify `app/layout.tsx`; append to `test/routes/korean.test.ts`.

- [ ] **Step 1: Add the failing test.** Append to `test/routes/korean.test.ts`:
```ts
test.describe('html lang', () => {
  test('korean host → <html lang="ko">', async ({ request }) => {
    const html = await (await request.get('/people/nephi1', { headers: ko })).text()
    expect(html).toMatch(/<html[^>]*lang="ko"/)
  })
  test('apex → <html lang="en">', async ({ request }) => {
    const html = await (await request.get('/people/nephi1', { headers: bot })).text()
    expect(html).toMatch(/<html[^>]*lang="en"/)
  })
})
```

- [ ] **Step 2: Run — fails.**
Run: `npx playwright test test/routes/korean.test.ts -g "html lang"`
Expected: FAIL — always `lang="en"`.

- [ ] **Step 3: Implement.** In `app/layout.tsx`, add imports and make `RootLayout` async reading the language (keep the static `metadata` export unchanged):
```ts
import { headers } from 'next/headers'
import { bcp47 } from '@/lib/locales'
```
```tsx
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = bcp47((await headers()).get('x-lang') ?? 'en')
  return (
    <html lang={lang}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Run — passes.**
Run: `npx playwright test test/routes/korean.test.ts -g "html lang"`
Expected: PASS — korean `lang="ko"`, apex `lang="en"`.

- [ ] **Step 5: Commit.**
```bash
git add app/layout.tsx test/routes/korean.test.ts
git commit -m "$(printf 'feat(next): set <html lang> from the resolved language\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 11: og:image language + Naver verification

**Files:** Modify `lib/seo.ts`; append to `test/routes/korean.test.ts`.

- [ ] **Step 1: Add the failing test.** Append to `test/routes/korean.test.ts`:
```ts
import { getMeta } from '../helpers/meta'
test.describe('og lang + naver', () => {
  test('korean og:image carries lang=ko', async ({ request }) => {
    const html = await (await request.get('/people/nephi1', { headers: ko })).text()
    expect(getMeta(html, 'og:image')).toContain('lang=ko')
  })
  test('korean home has naver-site-verification', async ({ request }) => {
    const html = await (await request.get('/', { headers: ko })).text()
    expect(getMeta(html, 'naver-site-verification')).toBe('2e4aebbde9e85f415075e53c9ebcad129e3a83e4')
  })
  test('apex has no lang param and no naver', async ({ request }) => {
    const html = await (await request.get('/people/nephi1', { headers: bot })).text()
    expect(getMeta(html, 'og:image')).not.toContain('lang=')
    expect(getMeta(html, 'naver-site-verification')).toBeNull()
  })
})
```

- [ ] **Step 2: Run — fails.**
Run: `npx playwright test test/routes/korean.test.ts -g "og lang"`
Expected: FAIL — no `lang=` on og:image, no naver meta.

- [ ] **Step 3: Implement.** In `lib/seo.ts` `buildMetadata`, after the existing `const h = await headers()` line, read the language and use it. Add:
```ts
  const lang = h.get('x-lang') ?? 'en'
```
Append the lang to the og params (after the existing `if (ogSub) ogParams.set('sub', ogSub)`):
```ts
  if (lang !== 'en') ogParams.set('lang', lang)
```
And add the Naver meta to the returned `other` block (Korean host only), changing:
```ts
    other: {
      'fb:app_id': FB_APP_ID,
      'twitter:domain': SITE_DOMAIN,
    },
```
to:
```ts
    other: {
      'fb:app_id': FB_APP_ID,
      'twitter:domain': SITE_DOMAIN,
      ...(lang === 'ko' ? { 'naver-site-verification': '2e4aebbde9e85f415075e53c9ebcad129e3a83e4' } : {}),
    },
```

- [ ] **Step 4: Run — passes.**
Run: `npx playwright test test/routes/korean.test.ts -g "og lang"`
Expected: PASS — korean og:image has `lang=ko` + naver meta; apex has neither.

- [ ] **Step 5: Commit.**
```bash
git add lib/seo.ts test/routes/korean.test.ts
git commit -m "$(printf 'feat(next): og:image lang param + Naver verification (ko host)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 12: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Type-check.**
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full Korean + unit suites.**
Run: `npx playwright test test/routes/korean.test.ts test/unit/locales.test.ts test/unit/entity.test.ts`
Expected: ALL pass (host→lang, content, sitemap, superscript, canonical, chrome, index titles, shell, html lang, og lang + naver).

- [ ] **Step 3: Whole SSR suite (no regressions).**
Run: `npx playwright test`
Expected: the existing bot-UA suite (people/place/history/…/seo-gating) stays green; the only pre-existing failures (if any) are the known Chrome-UA harness ones — confirm the set is unchanged from before this work.

- [ ] **Step 4: Manual live parity spot-check.**
Run (dev server up):
```bash
curl -s -A Googlebot -H 'x-forwarded-host: xn--289a67xla.kr' -H 'x-forwarded-proto: https' http://localhost:8200/people/nephi1 \
  | grep -oiE '<html[^>]*lang="[^"]*"|<title>[^<]*|rel="canonical" href="[^"]*"|og:image[^>]*content="[^"]*"|naver-site-verification[^>]*content="[^"]*"'
```
Expected (matching `몰몬경.kr`): `lang="ko"`, `<title>니파이¹ • 몰몬경·KR`, canonical on `xn--289a67xla.kr`, og:image with `lang=ko`, naver meta present.

- [ ] **Step 5: Pre-rollout proxy note (record, not a code step).** Add a one-line reminder to the PR/rollout notes: verify NPM forwards the public host via `x-forwarded-host` (curl through the proxy, check the `X-Resolved-Lang` response header) — if it doesn't, every domain silently stays English.

---

## Self-Review

**Spec coverage:**
- §1 host→lang resolver → T1. §2 middleware host-based x-lang + debug header → T2. §3 lang-aware gql (override-before-headers) → T3. §8 sitemap pin en → T4. §6 superscript (both regexes) → T5. §7 safeHost allowlist → T6. §4 labels + getSiteChrome + body table (+ en short-circuit, dual-export) → T7. §4 index/static titles (#11) → T8. §4 DefaultShell nav+body → T9. §5 `<html lang>` → T10. §6 og lang + §5 naver → T11. Verification (parity, apex regression, tsc) → T12. ✓
- Deferred (hreflang, per-lang sitemaps, art OG, slv/tr backend gap) → intentionally no tasks. ✓

**Placeholder scan:** Two values are captured via concrete curl commands in-step (Korean body T7-S1; title label keys T8-S1) rather than guessed — these are live-data lookups with exact commands, not vague fillers. Everything else is complete code + expected output.

**Type/name consistency:** `langForHost`/`bcp47`/`HOST_LANG` (T1) used in T2/T6/T10. `gql(..., { lang })` (T3) used in T4. `getLabels`/`label` (T7) used in T8/T9. `getSiteChrome` (T7) used in T9. `x-lang` header set in T2, read in T3/T7/T9/T10/T11. Naver token identical in T11 + test.
