# Crawlable scripture — SSR `/read` route

**Date:** 2026-08-27
**Status:** Design (brainstormed with KC), pending implementation plan
**Layer:** `frontend/next/` (crawler-facing SSR)
**Related:** [`../reference/ssr.md`](../reference/ssr.md); descoped from the SEO pass
([`2026-08-27-ssr-seo-pass.md`](./2026-08-27-ssr-seo-pass.md)).

## Problem

The Book of Mormon text — the site's **primary content** — is not crawlable. The reader's
shareable URLs (`/read/alma.32`) 404 for bots on the SSR layer (the legacy PHP box
500s/serves a generic soft-200). Search engines can't index a single chapter of scripture.
This route makes every chapter a crawlable, canonical SSR page.

## Verified facts (probed live)

- **Reader URL scheme** (`frontend/webapp/src/utils/scriptureUtils.js:25,44`; `Routes.js:138`
  `/read/:bookCh?/:verseNum?`): `slugify` = spaces/colons→`.`, `-`→`~`, lowercased. Real URLs:
  chapter `/read/alma.32` (one segment), verse `/read/alma.32/21` (final `.N`→`/N`), range
  `/read/alma.32.21~24` (one segment, `~`).
- **Backend `read(ref)`** (:5006): accepts the **all-dots** form (`alma.32`, `alma.32.21`) and
  aliases (`1ne1`), returns canonical `ref` (`"Alma 32:21"`) + `prev_ref`/`next_ref`
  (chapter-level for a chapter query: `Alma 32`→prev `Alma 31`, next `Alma 33`). The **slash**
  form (`alma.32/21`) and garbage throw a raw MySQL error.
- **Path→ref mapping:** joining the `/read/[...ref]` path **segments** with `.` reconstructs
  the all-dots ref (`["alma.32","21"]`→`alma.32.21`); ranges are already one segment. The slash
  never reaches the query because Next splits it into segments.
- **`scripture-guide`** (v1.0.88, the CRA's ref lib — NOT yet a `frontend/next` dep):
  `lookupReference(ref)` → `{ref, verse_ids, error?}` (junk/slash → `verse_ids: []`);
  `generateReference(verse_ids)` → `"Alma 32:21"`; tilde ranges validate
  (`alma.32.21~24`→4 verse_ids). `generateReference(verse_ids).split(':')[0]` → chapter ref
  (`"Alma 32"`). `canon` spans all standard works (not BoM-scoped), so chapter enumeration uses
  a fixed BoM book→chapter-count table.
- `lib/scripture.ts` `getReadBlock(ref)` (cache()d, lang-aware via `gql`) + `scripturePreview`
  exist but are imported by **no route** (dead code to revive). No `app/read` dir exists;
  `/read/*` currently 404s on SSR.
- Middleware UA-splits bots→SSR for **all** paths (not path-gated), so no middleware change; a
  new `app/read/[...ref]` route claims the bot branch, humans still rewrite to the CRA reader.

## Decisions (brainstorming)

- **Granularity: chapters only.** Verse/range URLs resolve but render the **whole chapter** and
  canonical→the chapter URL. One strong page per chapter (~239), no thin single-verse dupes.
- **Language hosts: serve all, canonical→en apex.** Backend serves English verse text on every
  host (only ref/headings localize). Language-host `/read` pages render (localized chrome,
  English verses) but their `canonical`/`og:url` point at `https://bookofmormon.online/read/…`,
  consolidating to one indexed English URL. **No hreflang** on `/read` (opt out).
- **Validation via `scripture-guide`.** Reject junk with no DB hit; derive the canonical
  chapter; distinguish invalid-ref (404) from backend-outage (5xx).
- **Discovery: sitemap all chapters + prev/next nav.**
- **Resolve/render = render-with-canonical (approach A), not 301-redirect.**

## Architecture

### 1. Route — `app/read/[...ref]/page.tsx` (new)
Catch-all under `/read/` (beats the `[...path]` catch-all). Both `generateMetadata` and the
page component run the same **resolution**:

1. `rawRef = params.ref.join('.')`.
2. `const { verse_ids } = lookupReference(rawRef)`. If `verse_ids.length === 0` → `notFound()`
   (404, no DB hit).
3. `chapterRef = generateReference(verse_ids).split(':')[0]` (`"Alma 32"`);
   `chapterSlug = slugify(chapterRef)` (`"alma.32"`).
4. `block = await getReadBlock(chapterSlug)`. If `block` is null **because the backend
   errored**, that is an outage → propagate as 5xx (see §4). A structurally-absent chapter
   (shouldn't happen post-validation) → `notFound()`.

`slugify` is ported into `lib/scripture.ts` (1-liner: `text.replace(/ /g,'.').replace(/:/g,'.').replace(/-+/g,'~').toLowerCase()`) — matches the CRA byte-for-byte for chapter refs (no colon → just lowercase + `.`).

Resolution is shared by `generateMetadata` + the component via a `cache()`d
`resolveChapter(refSegments)` helper in `lib/scripture.ts` returning `{ chapterSlug, block }`
(or a not-found sentinel), so the two calls dedupe within a request.

### 2. `lib/scripture.ts` — revive + harden
- Export `slugify(ref)` (ported).
- `resolveChapter(segments: string[])`: does steps 1-4; `cache()`d.
- **`getReadBlock` outage handling:** stop blanket-catching. Return `null` only when the
  GraphQL response's `read` field is genuinely `null`; let network/GraphQL **errors throw** so
  a pre-validated chapter that fails is a 5xx, not a false 404.
- `scripturePreview(block)` unchanged.

### 3. Metadata — `generateMetadata` + a `lib/seo.ts` override
- Extend `SeoInput` with `canonicalUrl?: string` (absolute). When set, `buildMetadata` uses it
  for **both** `alternates.canonical` and `openGraph.url` instead of the request-derived `abs`.
- `/read` passes `canonicalUrl = https://bookofmormon.online/read/${chapterSlug}` (apex, always),
  `hreflang: false`, `title = block.ref`, `description = scripturePreview(block)`. The og card
  `lang` is `en` for `/read` regardless of host (content is English).
- 404 path returns `{}` / triggers `notFound()` as the other routes do.

### 4. Rendering (page body)
- `<h1>{block.ref}</h1>`; for each `section`: optional `<h2>{heading}</h2>`, then verse
  paragraphs (`<p>` with the `verse_num` label + `text`).
- Footer prev/next: `block.prev_ref`/`next_ref` → `/read/${slugify(prev_ref)}` /
  `${slugify(next_ref)}` (chapter slugs, no verse segment), rendered when present.
- `<JsonLd data={[article, breadcrumb]}>`: `Article` (headline=`block.ref`, url=apex canonical,
  `inLanguage: 'en'`, description=preview) + `BreadcrumbList` (Home › {book name} › {chapter}).
  Book name = the chapter ref minus its trailing number (`"Alma 32"`→`"Alma"`); book crumb
  links to the chapter's canonical (no dedicated book index exists) — acceptable, or Home →
  chapter (2-level) if simpler; plan picks one.

### 5. Discovery — `lib/sitemap.ts`
- Add all 239 BoM chapter URLs (`https://bookofmormon.online/read/${slug}`) from a static
  `BOM_BOOKS: { name: string; chapters: number }[]` table (1 Nephi 22, 2 Nephi 33, Jacob 7,
  Enos 1, Jarom 1, Omni 1, Words of Mormon 1, Mosiah 29, Alma 63, Helaman 16, 3 Nephi 30,
  4 Nephi 1, Mormon 9, Ether 15, Moroni 10 — **plan verifies each count against
  `scripture-guide`**). Slug = `slugify(\`${name} ${n}\`)`.
- Entries are apex-host, `seoIntentForPath` already returns `crawl` for `/read/*`.

## Error handling
- Empty `verse_ids` (junk/slash/unknown book) → **404**, no DB query.
- Valid ref, backend read fails → **5xx** (throw; avoids deindex-on-blip).
- A verse/range URL always renders its chapter with canonical→chapter (consolidation, no 301).

## Testing (Playwright, bot UA)
- `/read/alma.32` → 200; `<title>` starts `Alma 32`; `<h1>Alma 32`; verse text present;
  `canonical` = `https://bookofmormon.online/read/alma.32`; prev (`/read/alma.31`) + next
  (`/read/alma.33`) links present.
- `/read/alma.32/21` (verse) → 200 rendering the **whole chapter**; canonical → `/read/alma.32`.
- `/read/alma.32.21~24` (range) → 200 → chapter; canonical → `/read/alma.32`.
- `/read/zznotabook` (junk) → 404.
- No hreflang tags on any `/read` page; a Korean-host request to `/read/alma.32` still
  canonicals to the apex and shows English verse text.
- `sitemap.xml` contains `/read/` chapter URLs — spot-check count (≈239), first (`1.nephi.1`),
  last (`moroni.10`).
- Full SSR suite stays green.

## Scope
**New:** `app/read/[...ref]/page.tsx`, tests (`test/routes/read.test.ts`), a BoM chapter table
(in `lib/scripture.ts` or `lib/sitemap.ts`). **Modified:** `lib/scripture.ts` (revive
`slugify`/`resolveChapter`, harden `getReadBlock`), `lib/seo.ts` (`canonicalUrl` override),
`lib/sitemap.ts` (chapter entries). **New dep:** `scripture-guide` in `frontend/next`.
**NOT in scope:** localizing verse text (backend limitation — English served on all hosts);
verse-level indexed pages (they render the chapter); per-language sitemaps (separate spec).

## Acceptance criteria
- Every BoM chapter is a crawlable 200 SSR page with real title/canonical/description, verse
  text, prev/next nav, and Article + BreadcrumbList JSON-LD.
- Verse/range URLs render the containing chapter and canonical to the chapter URL (no thin
  dupes); junk refs 404 without a DB hit; backend outages 5xx (no false 404).
- `/read` pages canonical to the en apex on every language host and emit no hreflang.
- All 239 chapters appear in `sitemap.xml`; full SSR suite green; no regression.

## Open items (resolve in planning)
- **BreadcrumbList shape:** 3-level (Home › {book} › {chapter}) with the book crumb pointing at
  the chapter canonical, vs 2-level (Home › {chapter}). Pick one.
- **Verify the 15 chapter counts** against `scripture-guide` at build/plan time (a tiny script:
  `lookupReference(\`${book} ${count}\`)` succeeds and `${count+1}` fails).
- **`canonicalUrl` override vs a dedicated apex-canonical helper** — confirm the `SeoInput`
  extension is the minimal clean change (it also disables the self-referential host logic for
  that page only).
