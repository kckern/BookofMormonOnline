# Crawlable Scripture `/read` Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Book of Mormon chapter a crawlable, canonical SSR page at `/read/{slug}`, so search engines can index the site's primary content.

**Architecture:** A new `app/read/[...ref]/page.tsx` catch-all resolves any ref form (chapter/verse/range/alias, dot- or hyphen-slug) to its single chapter via `scripture-guide` validation + first-verse derivation, renders the whole chapter from the backend `read()` query (pinned to English), canonicals every page to the en apex (no hreflang), and lists all 239 chapters in `sitemap.xml`.

**Tech Stack:** Next.js 15 App Router (server components, `Metadata`), the backend Fastify GraphQL `read(ref)` resolver, the `scripture-guide` npm lib (ref parsing), Playwright (bot-UA SSR tests).

**Spec:** `docs/specs/2026-08-27-ssr-crawlable-scripture.md`.

**Working dir for all commands:** `/home/bom/BookofMormonOnline/frontend/next`. The dev SSR server is live on `http://localhost:8200` (Playwright's bot-UA project targets it); backend GraphQL on `:5006`. Run tests with `npx playwright test <file>`.

---

## File Structure

- `frontend/next/package.json` — add `scripture-guide` dependency.
- `frontend/next/lib/scripture.ts` — revive + harden: export `slugify`, add `resolveChapter(rawRef)`, pin `getReadBlock` to English + stop blanket-catching, add the `BOM_BOOKS` chapter table + `bomChapterSlugs()` enumerator.
- `frontend/next/lib/seo.ts` — add `canonicalUrl?` + `lang?` overrides to `SeoInput`/`buildMetadata`.
- `frontend/next/app/read/[...ref]/page.tsx` — NEW. The route (metadata + render + JSON-LD).
- `frontend/next/lib/sitemap.ts` — add a scripture category (`/read/{slug}` × 239).
- `frontend/next/test/routes/read.test.ts` — NEW. Route behavior matrix.
- `frontend/next/test/unit/scripture-slug.test.ts` — NEW. Pure `slugify` + chapter-table unit tests.

---

## Task 1: Revive + harden `lib/scripture.ts` (slugify, resolveChapter, English-pinned read, chapter table)

**Files:**
- Modify: `frontend/next/package.json` (add dep)
- Modify: `frontend/next/lib/scripture.ts`
- Test: `frontend/next/test/unit/scripture-slug.test.ts`

- [ ] **Step 1: Add the `scripture-guide` dependency**

Run from `frontend/next`:
```bash
npm install scripture-guide@1.0.88
```
Expected: `package.json` gains `"scripture-guide": "1.0.88"` (or `^1.0.88`) under `dependencies`, and it installs into `frontend/next/node_modules`. Verify:
```bash
node -e "console.log(require('scripture-guide').lookupReference('alma.32.21').ref)"
```
Expected output: `Alma 32:21`

- [ ] **Step 2: Write the failing unit test**

Create `frontend/next/test/unit/scripture-slug.test.ts`:

```typescript
import { test, expect } from '@playwright/test'
import { slugify, BOM_BOOKS, bomChapterSlugs } from '../../lib/scripture'

test.describe('slugify (ported from the CRA reader)', () => {
  test('chapter refs → dot slug', () => {
    expect(slugify('Alma 32')).toBe('alma.32')
    expect(slugify('1 Nephi 3')).toBe('1.nephi.3')
    expect(slugify('Words of Mormon 1')).toBe('words.of.mormon.1')
  })
  test('colons → dots, hyphens → tildes, lowercased', () => {
    expect(slugify('Alma 32:21')).toBe('alma.32.21')
    expect(slugify('Alma 32:21-24')).toBe('alma.32.21~24')
  })
})

test.describe('BoM chapter table', () => {
  test('has 15 books totalling 239 chapters', () => {
    expect(BOM_BOOKS.length).toBe(15)
    expect(BOM_BOOKS.reduce((n, b) => n + b.chapters, 0)).toBe(239)
  })
  test('enumerates 239 chapter slugs, first and last correct', () => {
    const slugs = bomChapterSlugs()
    expect(slugs.length).toBe(239)
    expect(slugs[0]).toBe('1.nephi.1')
    expect(slugs[slugs.length - 1]).toBe('moroni.10')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx playwright test test/unit/scripture-slug.test.ts`
Expected: FAIL — `slugify`/`BOM_BOOKS`/`bomChapterSlugs` are not exported yet.

- [ ] **Step 4: Rewrite `lib/scripture.ts`**

Replace the entire file `frontend/next/lib/scripture.ts` with:

```typescript
import { cache } from 'react'
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { lookupReference, generateReference } from 'scripture-guide'
import { gql } from './graphql'

interface ReadLine { text: string; verse_num: number }
interface ReadUnit { lines: ReadLine[] }
interface ReadSection { heading: string | null; blocks: ReadUnit[] }
export interface ReadBlock {
  ref: string
  sections: ReadSection[]
  next_ref: string | null
  prev_ref: string | null
}

const READ_QUERY = `
  query Read($ref: String!) {
    read(ref: $ref) {
      ref
      next_ref
      prev_ref
      sections {
        heading
        blocks {
          lines {
            text
            verse_num
          }
        }
      }
    }
  }
`

// Ported verbatim from the CRA reader (frontend/webapp/src/utils/scriptureUtils.js:25):
// spaces & colons → '.', runs of hyphens → '~', lowercased. For a chapter ref (no
// colon) this is just lowercase + space→'.', matching the reader's chapter URLs.
export function slugify(ref: string): string {
  return ref.replace(/ /g, '.').replace(/:/g, '.').replace(/-+/g, '~').toLowerCase()
}

// Fetch a chapter. ALWAYS English: read() returns localized ref/prev_ref/next_ref on a
// language endpoint, which would produce non-ASCII prev/next hrefs that 404 and a title
// incoherent with the en-apex canonical. Pinning lang:'en' keeps verse text + nav English
// on every host. Let gql throw (network / GraphQL errors) so a backend outage surfaces as
// a 5xx, not a false 404 — return null ONLY when read is genuinely null.
export const getReadBlock = cache(async (ref: string): Promise<ReadBlock | null> => {
  const data = await gql<{ read: ReadBlock | null }>(READ_QUERY, { ref }, { revalidate: 3600, lang: 'en' })
  return data.read ?? null
})

export interface ChapterResolution {
  chapterSlug: string
  block: ReadBlock
}

// Resolve any /read ref form to its single chapter. Keyed on the joined string (cache()
// keys non-primitives by reference, so an array arg would not dedupe across the two
// separately-awaited params in generateMetadata + the page component).
export const resolveChapter = cache(async (rawRef: string): Promise<ChapterResolution | null> => {
  const { verse_ids } = lookupReference(rawRef)
  if (!verse_ids || verse_ids.length === 0) return null
  // FIRST verse only: a chapter-range ref (e.g. "alma.32~33") yields a colon-less
  // "Alma 32-33" that read() would accept as a distinct self-canonical page. Deriving
  // from verse_ids[0] collapses every verse/range/chapter form to one chapter.
  const chapterRef = generateReference([verse_ids[0]]).split(':')[0]
  const chapterSlug = slugify(chapterRef)
  const block = await getReadBlock(chapterSlug)
  if (!block) return null
  return { chapterSlug, block }
})

// First non-empty body text as a meta/JSON-LD description.
export function scripturePreview(block: ReadBlock, maxWords = 20): string {
  for (const section of block.sections) {
    for (const unit of section.blocks) {
      const words = unit.lines.flatMap((l) => l.text.split(/\s+/)).filter(Boolean)
      if (words.length > 0) return words.slice(0, maxWords).join(' ') + '…'
    }
  }
  return ''
}

// ── BoM chapter enumeration (for the sitemap) ────────────────────────────────
// The canon is immutable: 15 books, 239 chapters. Counts verified against
// scripture-guide (see the plan's Task 1 Step 6 check).
export const BOM_BOOKS: ReadonlyArray<{ name: string; chapters: number }> = [
  { name: '1 Nephi', chapters: 22 },
  { name: '2 Nephi', chapters: 33 },
  { name: 'Jacob', chapters: 7 },
  { name: 'Enos', chapters: 1 },
  { name: 'Jarom', chapters: 1 },
  { name: 'Omni', chapters: 1 },
  { name: 'Words of Mormon', chapters: 1 },
  { name: 'Mosiah', chapters: 29 },
  { name: 'Alma', chapters: 63 },
  { name: 'Helaman', chapters: 16 },
  { name: '3 Nephi', chapters: 30 },
  { name: '4 Nephi', chapters: 1 },
  { name: 'Mormon', chapters: 9 },
  { name: 'Ether', chapters: 15 },
  { name: 'Moroni', chapters: 10 },
]

// Every chapter slug in canonical order: ['1.nephi.1', …, 'moroni.10'] (239 entries).
export function bomChapterSlugs(): string[] {
  const slugs: string[] = []
  for (const book of BOM_BOOKS) {
    for (let n = 1; n <= book.chapters; n++) slugs.push(slugify(`${book.name} ${n}`))
  }
  return slugs
}
```

- [ ] **Step 5: Run the unit test to verify it passes**

Run: `npx playwright test test/unit/scripture-slug.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Verify the chapter counts against `scripture-guide` (one-off sanity check)**

Run from `frontend/next`:
```bash
node -e "
const { lookupReference, generateReference } = require('scripture-guide');
const { BOM_BOOKS } = require('./lib/scripture.ts') || {};
const books = [['1 Nephi',22],['2 Nephi',33],['Jacob',7],['Enos',1],['Jarom',1],['Omni',1],['Words of Mormon',1],['Mosiah',29],['Alma',63],['Helaman',16],['3 Nephi',30],['4 Nephi',1],['Mormon',9],['Ether',15],['Moroni',10]];
let bad=0;
for (const [name,ch] of books) {
  const last = lookupReference(name+' '+ch);
  if (!last.verse_ids.length) { console.log('MISSING last', name, ch); bad++; }
  // over-number must CONSOLIDATE (not be its own chapter): generateReference(first verse) != '{name} {ch+1}'
  const over = lookupReference(name+' '+(ch+1));
  if (over.verse_ids.length) {
    const derived = generateReference([over.verse_ids[0]]).split(':')[0];
    if (derived === name+' '+(ch+1)) { console.log('OVER is real chapter', name, ch+1); bad++; }
  }
}
console.log(bad===0 ? 'COUNTS OK' : ('BAD='+bad));
"
```
Expected output: `COUNTS OK`. (If `require('./lib/scripture.ts')` fails under plain node, ignore that line — the check only needs the inlined `books` array. The point is `COUNTS OK`.) If any book prints `MISSING`/`OVER is real chapter`, fix that book's count in `BOM_BOOKS` before committing.

- [ ] **Step 7: Commit**

```bash
git add frontend/next/package.json frontend/next/package-lock.json frontend/next/lib/scripture.ts frontend/next/test/unit/scripture-slug.test.ts
git commit -m "feat(ssr): revive scripture lib — slugify, resolveChapter (en-pinned), BoM chapter table"
```

---

## Task 2: `canonicalUrl` + `lang` overrides in `buildMetadata`

**Files:**
- Modify: `frontend/next/lib/seo.ts` (`SeoInput` interface; `buildMetadata` body)
- Test: covered by the route test in Task 3 (these overrides have no route yet; a dedicated micro-test is not worth a new fixture).

- [ ] **Step 1: Add the two optional fields to `SeoInput`**

In `frontend/next/lib/seo.ts`, inside the `SeoInput` interface, after the `hreflang?: boolean` field, add:

```typescript
  /** Absolute canonical URL override (used for both canonical + og:url). For pages that
   *  consolidate cross-host to a fixed origin, e.g. /read → the en apex. */
  canonicalUrl?: string
  /** Language override for the og-card lang param + naver tag (defaults to the x-lang
   *  header). /read passes 'en' because its content is English on every host. */
  lang?: string
```

- [ ] **Step 2: Use the overrides in `buildMetadata`**

In `buildMetadata`, the destructure currently reads:
```typescript
  const { title, description, path, withSuffix = true, preTruncated = false, ogSub, ogImg, ogImgType, hreflang = true } = input
```
Add `canonicalUrl` and `langOverride`:
```typescript
  const { title, description, path, withSuffix = true, preTruncated = false, ogSub, ogImg, ogImgType, hreflang = true, canonicalUrl, lang: langOverride } = input
```

Find the line that derives the request language (currently `const lang = h.get('x-lang') ?? 'en'`) and make the override win:
```typescript
  const lang = langOverride ?? h.get('x-lang') ?? 'en'
```

Find where `abs` is computed (`const abs = await absoluteUrl(path)`) and make the canonical override win:
```typescript
  const abs = canonicalUrl ?? (await absoluteUrl(path))
```
`abs` already feeds both `alternates.canonical` and `openGraph.url`, so both pick up the override. Leave the hreflang gate as-is (the route passes `hreflang: false`, so no alternates are emitted regardless).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (a clean exit, or only pre-existing unrelated errors — compare against a run on the prior commit if unsure).

- [ ] **Step 4: Commit**

```bash
git add frontend/next/lib/seo.ts
git commit -m "feat(ssr): buildMetadata canonicalUrl + lang overrides"
```

---

## Task 3: The `/read/[...ref]` route

**Files:**
- Create: `frontend/next/app/read/[...ref]/page.tsx`
- Test: `frontend/next/test/routes/read.test.ts`

- [ ] **Step 1: Write the failing route test**

Create `frontend/next/test/routes/read.test.ts`:

```typescript
import { test, expect } from '@playwright/test'
import { getTitle, getCanonical, getMeta, getHreflang } from '../helpers/meta'

const APEX = 'https://bookofmormon.online'

function ldBlocks(html: string): any[] {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  const out: any[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) out.push(JSON.parse(m[1]))
  return out
}

test.describe('/read chapter route', () => {
  test('chapter URL renders the chapter with apex canonical', async ({ request }) => {
    const html = await (await request.get('/read/alma.32')).text()
    expect(getTitle(html)).toContain('Alma 32')
    expect(html).toMatch(/<h1[^>]*>\s*Alma 32/)
    expect(getCanonical(html)).toBe(`${APEX}/read/alma.32`)
    // verse text present (Alma 32 is the faith-as-a-seed chapter)
    expect(html.toLowerCase()).toContain('seed')
    // prev/next chapter links
    expect(html).toContain('/read/alma.31')
    expect(html).toContain('/read/alma.33')
  })

  test('verse URL renders the whole chapter, canonical → chapter', async ({ request }) => {
    const html = await (await request.get('/read/alma.32/21')).text()
    expect(html).toMatch(/<h1[^>]*>\s*Alma 32/)
    expect(getCanonical(html)).toBe(`${APEX}/read/alma.32`)
  })

  test('verse-range URL → chapter, canonical → chapter', async ({ request }) => {
    const html = await (await request.get('/read/alma.32.21~24')).text()
    expect(getCanonical(html)).toBe(`${APEX}/read/alma.32`)
  })

  test('chapter-range URL does NOT self-canonical (B1 guard)', async ({ request }) => {
    const html = await (await request.get('/read/alma.32~33')).text()
    expect(getCanonical(html)).toBe(`${APEX}/read/alma.32`)
    expect(getCanonical(html)).not.toContain('~')
  })

  test('hyphen-slug form resolves', async ({ request }) => {
    const html = await (await request.get('/read/alma-17/7')).text()
    expect(getCanonical(html)).toBe(`${APEX}/read/alma.17`)
  })

  test('single-chapter book + over-number consolidate', async ({ request }) => {
    expect(getCanonical(await (await request.get('/read/enos.1')).text())).toBe(`${APEX}/read/enos.1`)
    expect(getCanonical(await (await request.get('/read/enos.2')).text())).toBe(`${APEX}/read/enos.1`)
  })

  test('book boundaries: first has no prev, last no next, cross-book next', async ({ request }) => {
    const first = await (await request.get('/read/1.nephi.1')).text()
    expect(first).not.toContain('/read/1.nephi.0')
    const last = await (await request.get('/read/moroni.10')).text()
    expect(last).not.toContain('/read/moroni.11')
    const cross = await (await request.get('/read/1.nephi.22')).text()
    expect(cross).toContain('/read/2.nephi.1')
  })

  test('junk ref → 404', async ({ request }) => {
    expect((await request.get('/read/zznotabook')).status()).toBe(404)
  })

  test('no hreflang on /read; language host still canonicals to apex with English text', async ({ request }) => {
    const html = await (await request.get('/read/alma.32', {
      headers: { 'x-forwarded-host': 'xn--289a67xla.kr' },
    })).text()
    expect(getHreflang(html, 'ko')).toBeNull()
    expect(getCanonical(html)).toBe(`${APEX}/read/alma.32`)
    expect(html).toMatch(/<h1[^>]*>\s*Alma 32/) // English ref, not 앨마서
    // prev link is ASCII, resolvable
    expect(html).toContain('/read/alma.31')
  })

  test('JSON-LD: Article + BreadcrumbList', async ({ request }) => {
    const blocks = ldBlocks(await (await request.get('/read/alma.32')).text())
    const article = blocks.find((b) => b['@type'] === 'Article')
    expect(article).toBeTruthy()
    expect(article.headline).toContain('Alma 32')
    expect(article.url).toBe(`${APEX}/read/alma.32`)
    expect(article.inLanguage).toBe('en')
    expect(blocks.find((b) => b['@type'] === 'BreadcrumbList')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test test/routes/read.test.ts`
Expected: FAIL — `/read/alma.32` 404s today (no route).

- [ ] **Step 3: Create the route**

Create `frontend/next/app/read/[...ref]/page.tsx`:

```tsx
import { Fragment } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolveChapter, slugify, scripturePreview, type ReadBlock } from '@/lib/scripture'
import { buildMetadata } from '@/lib/seo'
import { breadcrumb, creativeWork } from '@/lib/jsonld'
import { JsonLd } from '../../_components/JsonLd'

const APEX = 'https://bookofmormon.online'

interface Props {
  params: Promise<{ ref: string[] }>
}

// Rebuild the all-dots ref read() accepts: decode each segment (hosts may percent-encode),
// join with '.'. ['alma.32','21'] → 'alma.32.21'; a single-segment range stays intact.
function rawRefOf(segments: string[]): string {
  return segments.map(decodeURIComponent).join('.')
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ref } = await params
  const res = await resolveChapter(rawRefOf(ref))
  if (!res) return {}
  const { chapterSlug, block } = res
  return buildMetadata({
    title: block.ref,
    description: scripturePreview(block),
    path: `/read/${chapterSlug}`,
    canonicalUrl: `${APEX}/read/${chapterSlug}`,
    lang: 'en',
    hreflang: false,
  })
}

export default async function ReadPage({ params }: Props) {
  const { ref } = await params
  const res = await resolveChapter(rawRefOf(ref))
  if (!res) notFound()
  const { chapterSlug, block } = res

  const canonical = `${APEX}/read/${chapterSlug}`
  const ld = [
    creativeWork({
      type: 'Article',
      name: block.ref,
      description: scripturePreview(block),
      url: canonical,
      lang: 'en',
    }),
    breadcrumb([
      { name: 'Home', url: `${APEX}/` },
      { name: block.ref, url: canonical },
    ]),
  ]

  return (
    <>
      <JsonLd data={ld} />
      <h1>{block.ref}</h1>
      {block.sections.map((section, si) => (
        <Fragment key={si}>
          {section.heading && <h2>{section.heading}</h2>}
          {section.blocks.map((unit, ui) => (
            <p key={ui}>
              {unit.lines.map((line) => (
                <Fragment key={line.verse_num}>
                  <sup>{line.verse_num}</sup> {line.text}{' '}
                </Fragment>
              ))}
            </p>
          ))}
        </Fragment>
      ))}
      <nav className="prevnext">
        {block.prev_ref && <a href={`/read/${slugify(block.prev_ref)}`}>❮ {block.prev_ref}</a>}
        {block.next_ref && <a href={`/read/${slugify(block.next_ref)}`}>{block.next_ref} ❯</a>}
      </nav>
    </>
  )
}
```

Note the `type ReadBlock` import is only for clarity if the engineer wants it; if the linter flags it as unused, drop it from the import.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test test/routes/read.test.ts`
Expected: PASS (all cases). If the `'seed'` body-text assertion fails, `curl -s -A Googlebot http://localhost:8200/read/alma.32 | grep -o seed` to confirm the word is present; if the chapter text genuinely lacks it, replace the assertion with another word verified present in Alma 32.

- [ ] **Step 5: Confirm route precedence + no regression to the catch-all**

Run: `npx playwright test test/routes/scripture.test.ts`
Expected: PASS — the existing textblock route (`/lehites/64`) is unaffected; `/read/*` is now claimed by the new route, not the `[...path]` catch-all.

- [ ] **Step 6: Commit**

```bash
git add frontend/next/app/read/[...ref]/page.tsx frontend/next/test/routes/read.test.ts
git commit -m "feat(ssr): crawlable /read chapter route (resolve-any-ref-to-chapter, apex canonical)"
```

---

## Task 4: Chapters in `sitemap.xml`

**Files:**
- Modify: `frontend/next/lib/sitemap.ts`
- Test: `frontend/next/test/routes/read.test.ts` (append a sitemap block) — or the existing sitemap test if present; this plan appends to `read.test.ts` to keep scripture assertions together.

- [ ] **Step 1: Write the failing test**

Append to `frontend/next/test/routes/read.test.ts`:

```typescript
test.describe('/read chapters in sitemap.xml', () => {
  test('sitemap lists all 239 chapter URLs, first and last present', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()
    const readUrls = [...xml.matchAll(/<loc>([^<]*\/read\/[^<]+)<\/loc>/g)].map((m) => m[1])
    expect(readUrls.length).toBe(239)
    expect(readUrls).toContain('https://bookofmormon.online/read/1.nephi.1')
    expect(readUrls).toContain('https://bookofmormon.online/read/moroni.10')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test test/routes/read.test.ts -g sitemap`
Expected: FAIL — `readUrls.length` is 0 (no `/read/` entries yet).

- [ ] **Step 3: Add the scripture category to `lib/sitemap.ts`**

In `frontend/next/lib/sitemap.ts`:

Add to the imports at the top (after `import { seoIntentForPath } from './features'`):
```typescript
import { bomChapterSlugs } from './scripture'
```

Add a synchronous producer near the other category functions (e.g. after `timelineUrls`):
```typescript
// ── scripture (0.8) ──────────────────────────────────────────────────────────
// All 239 BoM chapters as crawlable /read pages (primary content). Static list —
// the canon is immutable — so no GraphQL call.
function scriptureUrls(): SitemapUrl[] {
  return bomChapterSlugs().map((slug) => ({ path: `/read/${slug}`, priority: '0.8' }))
}
```

In `getSitemapUrls`, add the scripture list to the final concatenation. Change:
```typescript
  const all = [...statics, ...content, ...people, ...places, ...history, ...fax, ...maps, ...timeline]
```
to:
```typescript
  const all = [...statics, ...content, ...people, ...places, ...history, ...fax, ...maps, ...timeline, ...scriptureUrls()]
```

(`scriptureUrls()` is sync — no need to add it to the `Promise.all`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test test/routes/read.test.ts -g sitemap`
Expected: PASS — 239 `/read/` URLs including first and last.

- [ ] **Step 5: Run the FULL SSR suite (no regressions)**

Run: `npx playwright test`
Expected: PASS — the prior suite (142) plus the new scripture unit + route + sitemap tests. Investigate and fix any failure before committing. In particular confirm the sitemap total grew by exactly 239 and no existing sitemap-count test hardcodes a total that this breaks (if one does, update it to include the 239 scripture URLs and note it in the commit body).

- [ ] **Step 6: Commit**

```bash
git add frontend/next/lib/sitemap.ts frontend/next/test/routes/read.test.ts
git commit -m "feat(ssr): list all 239 BoM chapters in sitemap.xml"
```

---

## Self-Review

**1. Spec coverage:**
- Route `app/read/[...ref]` + resolve-any-ref-to-chapter → Task 3. ✓
- `scripture-guide` validation, first-verse chapter derivation (B1), decode segments → Task 1 (`resolveChapter`) + Task 3 (`rawRefOf`). ✓
- English-pinned `read()` (B2) + outage-vs-404 hardening + slugify port → Task 1. ✓
- Canonical→en apex + `lang: 'en'` + `hreflang: false` (SeoInput `canonicalUrl`/`lang`) → Task 2 + Task 3. ✓
- Render chapter + prev/next + Article/BreadcrumbList JSON-LD → Task 3. ✓
- Sitemap 239 chapters from static table → Task 1 (`BOM_BOOKS`/`bomChapterSlugs`) + Task 4. ✓
- Testing matrix (chapter/verse/range/chapter-range/hyphen/single-chapter/over-number/boundaries/junk/lang-host/JSON-LD/sitemap) → Tasks 1,3,4. ✓
- Out of scope (verse-level pages, verse localization, bare `/read`, per-lang sitemaps) → not built. ✓

**2. Placeholder scan:** No TBD/TODO; every code step has full code; test code is complete. The one conditional (`'seed'` fallback in Task 3 Step 4) gives an explicit remedy, not a vague instruction. ✓

**3. Type consistency:** `resolveChapter(rawRef: string): Promise<ChapterResolution | null>` (defined Task 1) is called with `rawRefOf(ref)` (string) in Task 3. `getReadBlock` no longer takes a `lang` arg (dropped — always English); no caller passes one. `slugify`, `scripturePreview`, `ReadBlock`, `BOM_BOOKS`, `bomChapterSlugs` names match across Tasks 1/3/4. `buildMetadata` `canonicalUrl`/`lang` fields (Task 2) match the route's call (Task 3). `creativeWork`/`breadcrumb`/`JsonLd` signatures match the existing `lib/jsonld.ts` + `_components/JsonLd.tsx` (unchanged from the SEO pass). ✓

**Decisions locked (from the spec's open items):** BreadcrumbList is **2-level** (Home › {chapter}) — no book-index page exists to link a 3rd crumb to. The `SeoInput` `canonicalUrl` + `lang` extension is the minimal clean change (it overrides the self-referential host + x-lang logic for `/read` only, touching no other caller).
