# SSR SEO Pass Implementation Plan (hreflang + JSON-LD + head audit)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the crawler-facing SSR layer (`frontend/next/`) hreflang alternates, JSON-LD structured data, and a passing head-tag audit — the final SEO pillar before prod cutover.

**Architecture:** (A) `buildMetadata` gains an `alternates.languages` map built from a new `LANG_HOST` table (backend-supported langs only), gated to `crawl` pages with a per-page opt-out. (B) A pure `lib/jsonld.ts` builds `BreadcrumbList` + `CreativeWork` objects, rendered by a `<JsonLd>` server component (with `<`-escaping) in content page bodies. (D) A Playwright audit asserts every route class's head is complete and that hreflang appears only where intended.

**Tech Stack:** Next.js 15 App Router (server components, `Metadata`), Playwright (the only test runner; bot-UA project routes requests to SSR).

**Spec:** `docs/specs/2026-08-27-ssr-seo-pass.md`. Crawlable scripture (`/read`) and per-language sitemaps are descoped (own specs).

---

## File Structure

- `frontend/next/lib/locales.ts` — add `LANG_HOST` (internal code → canonical host, supported langs only). Already exports `bcp47`.
- `frontend/next/lib/seo.ts` — add `hreflang?: boolean` to `SeoInput`; add `hreflangLanguages()`; wire `alternates.languages`; export `absoluteUrl()` + `currentLang()` (consumed by JSON-LD in bodies).
- `frontend/next/lib/jsonld.ts` — NEW. Pure builders: `breadcrumb()`, `creativeWork()`.
- `frontend/next/app/_components/JsonLd.tsx` — NEW. Server component; renders `<script type="application/ld+json">` with `<`→`<` escaping.
- Content page bodies (add `<JsonLd>`): `app/people/[slug]/page.tsx`, `app/place/PlaceView.tsx`, `app/art/[id]/page.tsx`, `app/commentary/[id]/page.tsx`, `app/history/[slug]/page.tsx`, `app/[...path]/page.tsx`, `app/_components/SectionView.tsx`.
- `app/%ED%8A%B9%EB%B3%84%EB%B0%98/page.tsx` — opt out of hreflang (`hreflang: false`).
- `frontend/next/test/helpers/meta.ts` — add `getHreflang()`.
- `frontend/next/test/routes/hreflang.test.ts`, `jsonld.test.ts`, `head-audit.test.ts` — NEW.

**Working directory for all commands:** `frontend/next/`. Run tests with `npx playwright test <file>`. The dev SSR server must be up (`systemctl --user status bom-dev`, SSR on `:8200`); Playwright's bot-UA project targets it.

---

## Task 1: hreflang alternates

**Files:**
- Modify: `frontend/next/lib/locales.ts`
- Modify: `frontend/next/lib/seo.ts:81-98` (`SeoInput`), `:114-164` (`buildMetadata`)
- Modify: `frontend/next/app/%ED%8A%B9%EB%B3%84%EB%B0%98/page.tsx:9-15`
- Modify: `frontend/next/test/helpers/meta.ts`
- Test: `frontend/next/test/routes/hreflang.test.ts`

- [ ] **Step 1: Add the `getHreflang` test helper**

In `frontend/next/test/helpers/meta.ts`, add (uses the existing module-private `escapeRe`):

```typescript
// <link rel="alternate" hreflang="ko" href="..."> — attribute order tolerant.
export function getHreflang(html: string, hreflang: string): string | null {
  const patterns = [
    new RegExp(`<link[^>]+hreflang=["']${escapeRe(hreflang)}["'][^>]+href=["']([^"']+)["']`, 'i'),
    new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+hreflang=["']${escapeRe(hreflang)}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return m[1]
  }
  return null
}
```

- [ ] **Step 2: Write the failing test**

Create `frontend/next/test/routes/hreflang.test.ts`:

```typescript
import { test, expect } from '@playwright/test'
import { getHreflang } from '../helpers/meta'

test.describe('hreflang alternates', () => {
  test('a content page emits supported-lang alternates + x-default', async ({ request }) => {
    const html = await (await request.get('/people/nephi1')).text()
    expect(getHreflang(html, 'ko')).toBe('https://xn--289a67xla.kr/people/nephi1')
    expect(getHreflang(html, 'es')).toBe('https://libromormon.es/people/nephi1')
    expect(getHreflang(html, 'sv')).toBe('https://swe.bookofmormon.online/people/nephi1')
    expect(getHreflang(html, 'vi')).toBe('https://sachmacmon.vn/people/nephi1')
    expect(getHreflang(html, 'en')).toBe('https://bookofmormon.online/people/nephi1')
    expect(getHreflang(html, 'x-default')).toBe('https://bookofmormon.online/people/nephi1')
  })

  test('non-backend-supported langs (slv/tr) are NOT emitted', async ({ request }) => {
    const html = await (await request.get('/people/nephi1')).text()
    expect(getHreflang(html, 'sl')).toBeNull()
    expect(getHreflang(html, 'tr')).toBeNull()
  })

  test('a noindex subtree (/history) emits no hreflang', async ({ request }) => {
    const html = await (await request.get('/history')).text()
    expect(getHreflang(html, 'ko')).toBeNull()
    expect(getHreflang(html, 'x-default')).toBeNull()
  })

  test('the /특별반 alias opts out of hreflang', async ({ request }) => {
    const html = await (await request.get('/%ED%8A%B9%EB%B3%84%EB%B0%98')).text()
    expect(getHreflang(html, 'ko')).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend/next && npx playwright test test/routes/hreflang.test.ts`
Expected: FAIL — `getHreflang(...,'ko')` is `null` (no hreflang emitted yet).

- [ ] **Step 4: Add `LANG_HOST` to `lib/locales.ts`**

Append after the `HOST_LANG` block (after line 25):

```typescript
// Backend-SUPPORTED languages → canonical host, for hreflang alternates. Excludes
// slv/tr (NOT in backend SUPPORTED_LANGUAGES — advertising them would mislabel
// English content as Slovenian/Turkish). ko/ru use the punycode host so the tag
// points at a stable ASCII origin.
export const LANG_HOST: Record<string, string> = {
  en: 'bookofmormon.online',
  ko: 'xn--289a67xla.kr',
  es: 'libromormon.es',
  fr: 'livredemormon.fr',
  de: 'buchmormon.de',
  swe: 'swe.bookofmormon.online',
  vn: 'sachmacmon.vn',
  ru: 'xn--80aahtjpadfibw.net',
  tgl: 'tgl.bookofmormon.online',
}
```

- [ ] **Step 5: Wire hreflang into `buildMetadata`**

In `frontend/next/lib/seo.ts`:

Update the imports at the top (lines 4-5) to add `LANG_HOST` + `bcp47` and `seoIntentForPath`:

```typescript
import { HOST_LANG, LANG_HOST, bcp47 } from './locales'
import { getLabels } from './labels'
import { seoIntentForPath } from './features'
```

Add the `hreflang` field to `SeoInput` (inside the interface, after `ogImgType` on line 97):

```typescript
  /** Emit hreflang alternates (default true; false for language-variant slugs, e.g. /특별반). */
  hreflang?: boolean
```

Add this helper just above `buildMetadata` (before line 114):

```typescript
// hreflang alternates for the backend-supported language domains + x-default.
// Slugs are language-invariant, so the path is identical across every domain.
function hreflangLanguages(path: string): Record<string, string> {
  const langs: Record<string, string> = {}
  for (const [code, host] of Object.entries(LANG_HOST)) {
    langs[bcp47(code)] = `https://${host}${path}`
  }
  langs['x-default'] = `https://${LANG_HOST.en}${path}`
  return langs
}
```

Add `hreflang` to the destructure on line 115:

```typescript
  const { title, description, path, withSuffix = true, preTruncated = false, ogSub, ogImg, ogImgType, hreflang = true } = input
```

Replace the `alternates: { canonical: abs },` line (line 142) with:

```typescript
    alternates: {
      canonical: abs,
      ...(hreflang && seoIntentForPath(path) === 'crawl'
        ? { languages: hreflangLanguages(path) }
        : {}),
    },
```

- [ ] **Step 6: Opt the /특별반 alias out of hreflang**

In `frontend/next/app/%ED%8A%B9%EB%B3%84%EB%B0%98/page.tsx`, add `hreflang: false` to the `buildMetadata` call (its `path: '/특별반'` differs from the en `/studyedition` alternate, so it must not advertise alternates):

```typescript
  return buildMetadata({
    title: STUDYEDITION_TITLE,
    description: STUDYEDITION_DESCRIPTION,
    path: '/특별반',
    hreflang: false,
  })
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd frontend/next && npx playwright test test/routes/hreflang.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 8: Commit**

```bash
git add frontend/next/lib/locales.ts frontend/next/lib/seo.ts \
  frontend/next/app/%ED%8A%B9%EB%B3%84%EB%B0%98/page.tsx \
  frontend/next/test/helpers/meta.ts frontend/next/test/routes/hreflang.test.ts
git commit -m "feat(ssr): hreflang alternates for supported language domains"
```

---

## Task 2: JSON-LD infrastructure + first page (people)

**Files:**
- Modify: `frontend/next/lib/seo.ts` (export `absoluteUrl`, `currentLang`; use `absoluteUrl` in `buildMetadata`)
- Create: `frontend/next/lib/jsonld.ts`
- Create: `frontend/next/app/_components/JsonLd.tsx`
- Modify: `frontend/next/app/people/[slug]/page.tsx`
- Test: `frontend/next/test/routes/jsonld.test.ts`

- [ ] **Step 1: Export `absoluteUrl` + `currentLang` from `lib/seo.ts`**

Add these two exported helpers to `frontend/next/lib/seo.ts` (place just above `buildMetadata`, after `safeHost` on line 109). They reuse `safeHost`; `headers()` is request-cached so extra calls are free:

```typescript
// Absolute URL for the current request host (self-referential, like the canonical).
export async function absoluteUrl(path: string): Promise<string> {
  const h = await headers()
  const host = safeHost(h.get('x-forwarded-host') ?? h.get('host'))
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}${path}`
}

// The host-derived language for this request (matches x-lang set in middleware).
export async function currentLang(): Promise<string> {
  return (await headers()).get('x-lang') ?? 'en'
}
```

Then DRY `buildMetadata`: replace lines 134-136 (the `host`/`proto`/`abs` trio) with:

```typescript
  const abs = await absoluteUrl(path)
```

(Leave the `const h = await headers()` / `const lang = ...` lines above intact — they are still used for `lang`.)

- [ ] **Step 2: Write the failing test**

Create `frontend/next/test/routes/jsonld.test.ts`:

```typescript
import { test, expect } from '@playwright/test'

function ldBlocks(html: string): any[] {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  const out: any[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) out.push(JSON.parse(m[1]))
  return out
}

test.describe('JSON-LD structured data', () => {
  test('/people/{slug} emits BreadcrumbList + Person', async ({ request }) => {
    const html = await (await request.get('/people/nephi1')).text()
    const blocks = ldBlocks(html)
    const crumb = blocks.find((b) => b['@type'] === 'BreadcrumbList')
    expect(crumb).toBeTruthy()
    expect(crumb.itemListElement.map((i: any) => i.name)).toContain('People')
    const person = blocks.find((b) => b['@type'] === 'Person')
    expect(person).toBeTruthy()
    expect(person.name).toContain('Nephi')
    expect(person.url).toContain('/people/nephi1')
    expect(person.inLanguage).toBe('en')
  })

  test('ld+json escapes < (prevents </script> breakout)', async ({ request }) => {
    const html = await (await request.get('/people/nephi1')).text()
    const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    let m: RegExpExecArray | null
    let found = false
    while ((m = re.exec(html))) {
      found = true
      expect(m[1]).not.toContain('<') // every '<' must be emitted as <
    }
    expect(found).toBe(true)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend/next && npx playwright test test/routes/jsonld.test.ts`
Expected: FAIL — `ldBlocks` finds no scripts (`crumb` undefined).

- [ ] **Step 4: Create `lib/jsonld.ts`**

```typescript
import { bcp47 } from './locales'

const SITE = 'https://bookofmormon.online'
const IS_PART_OF = { '@type': 'WebSite', name: 'Book of Mormon Online', url: `${SITE}/` }

export interface Crumb {
  name: string
  url: string
}

// schema.org BreadcrumbList from an explicit, data-driven crumb chain (callers
// pass real page names — never raw path segments, so a leaf like /lehites/1 is
// never a "1" crumb).
export function breadcrumb(items: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  }
}

export interface WorkInput {
  type: 'Article' | 'CreativeWork' | 'Person' | 'Place'
  name: string
  description?: string
  url: string
  lang: string
  image?: string
}

// A typed schema.org node for a content page (Article/CreativeWork/Person/Place).
export function creativeWork(input: WorkInput) {
  const { type, name, description, url, lang, image } = input
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    ...(type === 'Article' ? { headline: name } : {}),
    ...(description ? { description } : {}),
    url,
    inLanguage: bcp47(lang),
    isPartOf: IS_PART_OF,
    ...(image ? { image } : {}),
  }
}
```

- [ ] **Step 5: Create `app/_components/JsonLd.tsx`**

```tsx
// Renders one <script type="application/ld+json"> per object. JSON.stringify does
// NOT escape '<', so content text containing '</script>' could break out of the
// tag — escape every '<' to < (JSON parsers decode it back).
function safeJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function JsonLd({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data]
  return (
    <>
      {items.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJson(d) }}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 6: Wire JSON-LD into the people page**

In `frontend/next/app/people/[slug]/page.tsx`, add imports (after line 5):

```typescript
import { buildMetadata, stripMarkup, absoluteUrl, currentLang } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'
```

(Replace the existing `import { buildMetadata, stripMarkup } from '@/lib/seo'` line with the first line above.)

In `PeoplePage`, after `const name = superscript(person.name)` (line 30), build the nodes:

```typescript
  const url = await absoluteUrl(`/people/${slug}`)
  const lang = await currentLang()
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: 'People', url: await absoluteUrl('/people') },
      { name, url },
    ]),
    creativeWork({
      type: 'Person',
      name,
      description: stripMarkup(wikiToText(person.description ?? '')),
      url,
      lang,
      image: `https://media.bookofmormon.online/people/${slug}`,
    }),
  ]
```

Add `<JsonLd data={ld} />` as the first child of the returned fragment (immediately after `<>`):

```tsx
  return (
    <>
      <JsonLd data={ld} />
      <h1>{name}</h1>
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd frontend/next && npx playwright test test/routes/jsonld.test.ts`
Expected: PASS (both tests).

- [ ] **Step 8: Run the existing suite to confirm no regression from the `buildMetadata` refactor**

Run: `cd frontend/next && npx playwright test test/routes/og.test.ts test/routes/hreflang.test.ts`
Expected: PASS (canonical/og:url still correct via `absoluteUrl`).

- [ ] **Step 9: Commit**

```bash
git add frontend/next/lib/seo.ts frontend/next/lib/jsonld.ts \
  frontend/next/app/_components/JsonLd.tsx frontend/next/app/people/[slug]/page.tsx \
  frontend/next/test/routes/jsonld.test.ts
git commit -m "feat(ssr): JSON-LD infra + Person/breadcrumb on people pages"
```

---

## Task 3: JSON-LD for remaining content pages

Each step wires the same `breadcrumb` + `creativeWork` pattern into one page and extends the test. `absoluteUrl`/`currentLang` come from `@/lib/seo`; `breadcrumb`/`creativeWork` from `@/lib/jsonld`; `JsonLd` from the `_components` path (adjust `../` depth per file).

**Files:** `app/place/PlaceView.tsx`, `app/art/[id]/page.tsx`, `app/commentary/[id]/page.tsx`, `app/history/[slug]/page.tsx`, `app/[...path]/page.tsx`, `app/_components/SectionView.tsx`, `test/routes/jsonld.test.ts`.

- [ ] **Step 1: Place — `app/place/PlaceView.tsx`**

Add imports after line 5:

```typescript
import { buildMetadata, stripMarkup, absoluteUrl, currentLang } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from './_components/JsonLd'
```

Wait — `PlaceView.tsx` lives in `app/place/`, so the component path is `../_components/JsonLd`. Use:

```typescript
import { JsonLd } from '../_components/JsonLd'
```

(Replace the existing `import { buildMetadata, stripMarkup } from '@/lib/seo'` with the combined import above.)

In `PlaceView`, after `const name = superscript(place.name)` (line 25), add:

```typescript
  const url = await absoluteUrl(`/places/${slug}`)
  const lang = await currentLang()
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: 'Places', url: await absoluteUrl('/places') },
      { name, url },
    ]),
    creativeWork({
      type: 'Place',
      name,
      description: stripMarkup(wikiToText(place.description ?? '')),
      url,
      lang,
      image: `https://media.bookofmormon.online/places/${slug}`,
    }),
  ]
```

Insert `<JsonLd data={ld} />` as the first child of the fragment (after `<>` on line 28).

- [ ] **Step 2: Art — `app/art/[id]/page.tsx`**

Add imports after line 4:

```typescript
import { buildMetadata, absoluteUrl, currentLang } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'
```

(Replace the existing `import { buildMetadata } from '@/lib/seo'`.)

In `ArtPage`, after `if (!art) notFound()` (line 28), add:

```typescript
  const url = await absoluteUrl(`/art/${id}`)
  const lang = await currentLang()
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: art.title, url },
    ]),
    creativeWork({
      type: 'CreativeWork',
      name: art.title,
      description: `${art.artist} • ${art.descText}`,
      url,
      lang,
      image: `https://media.bookofmormon.online/art/${id}`,
    }),
  ]
```

Insert `<JsonLd data={ld} />` as the first child of the fragment (after `<>` on line 47).

- [ ] **Step 3: Commentary — `app/commentary/[id]/page.tsx`**

Add imports after line 4:

```typescript
import { buildMetadata, stripMarkup, absoluteUrl, currentLang } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'
```

(Replace the existing `import { buildMetadata, stripMarkup } from '@/lib/seo'`.)

In `CommentaryPage`, after the `const { source_id, ... } = c.publication` line (line 29), add:

```typescript
  const url = await absoluteUrl(`/commentary/${id}`)
  const lang = await currentLang()
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: c.title, url },
    ]),
    creativeWork({
      type: 'Article',
      name: c.title,
      description: stripMarkup(c.text),
      url,
      lang,
    }),
  ]
```

Insert `<JsonLd data={ld} />` as the first child of the fragment (after `<>` on line 50).

- [ ] **Step 4: History — `app/history/[slug]/page.tsx`**

Add imports after line 4:

```typescript
import { buildMetadata, absoluteUrl, currentLang } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'
```

(Replace the existing `import { buildMetadata } from '@/lib/seo'`.)

In `HistoryDocPage`, after `if (!doc) notFound()` (line 42), add:

```typescript
  const url = await absoluteUrl(`/history/${slug}`)
  const lang = await currentLang()
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: 'History', url: await absoluteUrl('/history') },
      { name: doc.document ?? '', url },
    ]),
    creativeWork({
      type: 'Article',
      name: doc.document ?? '',
      description: phpDescription(doc),
      url,
      lang,
    }),
  ]
```

Insert `<JsonLd data={ld} />` as the first child of the fragment (after `<>` on line 55).

Note: `/history/*` is `noindex`, but JSON-LD is harmless there and keeps the pattern uniform; no hreflang is emitted (Task 1 gate). Keep it.

- [ ] **Step 5: Catch-all textblock + page index — `app/[...path]/page.tsx`**

Add imports after line 10:

```typescript
import { buildMetadata, stripMarkup, defaultMetadata, absoluteUrl, currentLang } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../_components/JsonLd'
```

(Replace the existing `import { buildMetadata, stripMarkup, defaultMetadata } from '@/lib/seo'`.)

In `CatchAllPage`, in the `textblock` branch, after `const here = \`/${path.join('/')}\`` (line 68), add:

```typescript
    const url = await absoluteUrl(here)
    const lang = await currentLang()
    const ld = [
      breadcrumb([
        { name: 'Home', url: await absoluteUrl('/') },
        ...(block.sectionTitle ? [{ name: block.sectionTitle, url: await absoluteUrl(`/${block.sectionSlug}`) }] : []),
        { name: block.heading, url },
      ]),
      creativeWork({ type: 'Article', name: block.heading, description: stripMarkup(block.content), url, lang }),
    ]
```

Insert `<JsonLd data={ld} />` as the first child of the textblock fragment (after the `return (` `<>` on line 69).

In the `page` branch, after `if (!page) return <DefaultShell />` (line 120), add a breadcrumb-only node:

```typescript
    const pageLd = breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: page.title, url: await absoluteUrl(`/${page.slug}`) },
    ])
```

Insert `<JsonLd data={pageLd} />` as the first child of the page fragment (after its `<>` on line 122).

- [ ] **Step 6: Section view — `app/_components/SectionView.tsx`**

Add imports after line 4:

```typescript
import { absoluteUrl, currentLang } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from './JsonLd'
```

In `PageIndex`, this is a sync component — convert its JSON-LD to be computed by the caller instead. Simplest: give `SectionView`'s section branch its own JSON-LD (below) and leave `PageIndex` as-is (a page index is lower value; the catch-all `page` branch already covers page indexes). No change to `PageIndex`.

In `SectionView`, in the section branch, after `if (!data) notFound()` (line 76), add:

```typescript
  const url = await absoluteUrl(`/${slug}`)
  const lang = await currentLang()
  const ld = [
    breadcrumb([
      { name: 'Home', url: await absoluteUrl('/') },
      { name: data.parentTitle, url: await absoluteUrl(`/${data.parentSlug}`) },
      { name: data.title, url },
    ]),
    creativeWork({ type: 'Article', name: data.title, description: data.title, url, lang }),
  ]
```

Insert `<JsonLd data={ld} />` as the first child of the section fragment (after its `<>` on line 78).

- [ ] **Step 7: Extend the JSON-LD test**

Append to `frontend/next/test/routes/jsonld.test.ts` (reuse the `ldBlocks` helper — hoist it above both describe blocks if needed):

```typescript
test.describe('JSON-LD on other content pages', () => {
  test('/place/{slug} emits Place + breadcrumb', async ({ request }) => {
    const blocks = ldBlocks(await (await request.get('/place/jerusalem-1')).text())
    expect(blocks.find((b) => b['@type'] === 'Place')).toBeTruthy()
    expect(blocks.find((b) => b['@type'] === 'BreadcrumbList')).toBeTruthy()
  })
  test('/art/{id} emits CreativeWork', async ({ request }) => {
    const blocks = ldBlocks(await (await request.get('/art/1000')).text())
    const cw = blocks.find((b) => b['@type'] === 'CreativeWork')
    expect(cw).toBeTruthy()
    expect(cw.url).toContain('/art/1000')
  })
})
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd frontend/next && npx playwright test test/routes/jsonld.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/next/app/place/PlaceView.tsx frontend/next/app/art/[id]/page.tsx \
  frontend/next/app/commentary/[id]/page.tsx frontend/next/app/history/[slug]/page.tsx \
  frontend/next/app/[...path]/page.tsx frontend/next/app/_components/SectionView.tsx \
  frontend/next/test/routes/jsonld.test.ts
git commit -m "feat(ssr): JSON-LD on place/art/commentary/history/section/textblock"
```

---

## Task 4: head-tag audit

**Files:**
- Test: `frontend/next/test/routes/head-audit.test.ts`

- [ ] **Step 1: Write the audit test**

Create `frontend/next/test/routes/head-audit.test.ts`:

```typescript
import { test, expect } from '@playwright/test'
import { getTitle, getCanonical, getMeta, getRobots, getHreflang } from '../helpers/meta'

// One representative URL per crawl route class (all use buildMetadata).
const CRAWL = ['/people/nephi1', '/place/jerusalem-1', '/art/1000', '/contents', '/about']

for (const path of CRAWL) {
  test(`head is complete + hreflang present: ${path}`, async ({ request }) => {
    const html = await (await request.get(path)).text()
    expect(getTitle(html)).toBeTruthy()
    const canon = getCanonical(html)
    expect(canon).toMatch(/^https?:\/\//)
    expect(canon).toContain(path)
    expect(getMeta(html, 'og:title')).toBeTruthy()
    expect(getMeta(html, 'og:description')).toBeTruthy()
    expect(getMeta(html, 'og:image')).toBeTruthy()
    expect(getMeta(html, 'description')).toBeTruthy()
    expect(getHreflang(html, 'ko')).toBeTruthy()
    expect(getHreflang(html, 'x-default')).toBeTruthy()
  })
}

test('history subtree is noindex with no hreflang', async ({ request }) => {
  const html = await (await request.get('/history')).text()
  expect((getRobots(html) ?? '').toLowerCase()).toContain('noindex')
  expect(getHreflang(html, 'ko')).toBeNull()
})

test('the /특별반 alias opts out of hreflang but keeps a complete head', async ({ request }) => {
  const html = await (await request.get('/%ED%8A%B9%EB%B3%84%EB%B0%98')).text()
  expect(getTitle(html)).toBeTruthy()
  expect(getCanonical(html)).toBeTruthy()
  expect(getHreflang(html, 'ko')).toBeNull()
})
```

- [ ] **Step 2: Run the audit**

Run: `cd frontend/next && npx playwright test test/routes/head-audit.test.ts`
Expected: PASS. If any crawl URL fails a `getHreflang` assertion, that page's metadata does not route through `buildMetadata` — fix it by routing that route's `generateMetadata` through `buildMetadata` (the straggler fix D calls for), then re-run. Document any straggler fixed in the commit message.

- [ ] **Step 3: Run the FULL SSR suite (no regressions)**

Run: `cd frontend/next && npx playwright test`
Expected: PASS — the prior 126 tests plus the new hreflang/jsonld/head-audit tests. Investigate and fix any failure before committing.

- [ ] **Step 4: Commit**

```bash
git add frontend/next/test/routes/head-audit.test.ts
git commit -m "test(ssr): head-tag audit across route classes"
```

---

## Self-Review

**1. Spec coverage:**
- A (hreflang, supported langs only, opt-out, noindex-excluded) → Task 1. ✓
- B (JSON-LD BreadcrumbList + typed CreativeWork, `<`-escaped, data-driven crumbs) → Tasks 2-3. ✓
- D (head audit + straggler fix) → Task 4. ✓
- Deferred (scripture `/read`, per-language sitemaps) → not in plan, tracked separately. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows full code; test code is complete. ✓

**3. Type consistency:** `absoluteUrl(path): Promise<string>` and `currentLang(): Promise<string>` defined in Task 2, used identically in Task 3. `breadcrumb(items: Crumb[])` / `creativeWork(input: WorkInput)` signatures match every call site. `getHreflang(html, hreflang)` defined Task 1, used in Tasks 1 & 4. `LANG_HOST` keys are internal codes; `hreflangLanguages` maps them through `bcp47` (so the emitted tags are `sv`/`vi`/`tl`, matching the Task 1 test assertions). ✓

**Note for the executor:** the `PlaceView` JSON-LD `url` uses `/places/${slug}` (matches the body's `<h2>` link + portrait path) even though the shared route may be `/place/...`; both resolve 200 and this keeps the node self-consistent — intentional, not a bug.
