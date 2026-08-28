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
- **Path→ref mapping:** `decodeURIComponent` each `/read/[...ref]` path **segment**, then join
  with `.` to reconstruct the all-dots ref (`["alma.32","21"]`→`alma.32.21`); ranges are already
  one segment. The slash never reaches the query because Next splits it into segments.
- **Three live URL slug forms all survive the pipeline** (verified): the reader's dot form
  (`/read/alma.32`, `/read/alma.32/21`), and `ScriptureExcerpt.readPath`'s **hyphen** form
  (`frontend/webapp/src/views/_Common/ScriptureExcerpt.js:19` — `"Alma 17:7"`→`/read/alma-17/7`).
  `join('.')`→`alma-17.7`→`lookupReference` resolves → chapter `alma.17`. No design change; add
  to the test matrix.
- **`read()` prev_ref/next_ref never leave the BoM** (backend is BoM-scoped, unlike
  `scripture-guide`'s all-canon table): `1.nephi.1`→no `prev_ref`; `moroni.10`→no `next_ref`;
  `1.nephi.22`→next `2 Nephi 1`. The field is **absent from the JSON** (not `null`) when there is
  no neighbor — use falsy checks, not `=== null`.
- **`gql` throws on a GraphQL `errors` array** (`lib/graphql.ts:25-27`): junk/slash refs return
  HTTP 200 `{errors:[SQL error], data:{}}` which `gql` **throws** — so removing `getReadBlock`'s
  blanket catch genuinely surfaces outages as 5xx (never a silent `data.read === undefined`).
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

1. `rawRef = params.ref.map(decodeURIComponent).join('.')`.
2. `const { verse_ids } = lookupReference(rawRef)`. If `verse_ids.length === 0` → `notFound()`
   (404, no DB hit).
3. **Chapter from the FIRST verse only:** `chapterRef =
   generateReference([verse_ids[0]]).split(':')[0]` (`"Alma 32"`); `chapterSlug =
   slugify(chapterRef)` (`"alma.32"`). **(B1)** Using `[verse_ids[0]]` — not the full
   `verse_ids` — is load-bearing: a chapter-*range* ref like `alma.32~33` produces
   `generateReference` → `"Alma 32-33"` (no colon), which `split(':')[0]` would NOT truncate and
   `read()` **accepts** as a distinct self-canonical page → an unbounded indexable URL space.
   Deriving from the first verse collapses every range/verse/chapter form to a single chapter.
4. `block = await getReadBlock(chapterSlug)` — **always English** (see §2, B2). If `block` is
   null **because the backend errored**, that is an outage → propagate as 5xx (see §4). A
   structurally-absent chapter (shouldn't happen post-validation) → `notFound()`.

`slugify` is ported into `lib/scripture.ts` (1-liner: `text.replace(/ /g,'.').replace(/:/g,'.').replace(/-+/g,'~').toLowerCase()`) — matches the CRA byte-for-byte for chapter refs (no colon → just lowercase + `.`).

Resolution is shared by `generateMetadata` + the component via a `cache()`d
`resolveChapter(rawRef: string)` helper in `lib/scripture.ts` (**keyed on the joined string**,
not the segment array — `cache()` keys non-primitives by reference, so the array wouldn't dedupe
across the two separately-awaited `params`) returning `{ chapterSlug, block }` or a not-found
sentinel.

### 2. `lib/scripture.ts` — revive + harden
- Export `slugify(ref)` (ported).
- `resolveChapter(rawRef: string)`: does steps 1-4; `cache()`d on `rawRef`.
- **Pin the read query to English (B2).** `read()` returns **localized** `ref`/`prev_ref`/
  `next_ref` on a language endpoint (`/graphql/ko read(alma.32)` → `앨마서 32`, prev `앨마서 31`).
  Because `gql` derives lang from the `x-lang` header when the caller passes none
  (`lib/graphql.ts:14`) and `getReadBlock` currently **drops** its `lang` arg (`lib/scripture.ts:30`
  — the S1 bug), a ko-host bot would get Korean refs and prev/next hrefs `/read/앨마서.31` →
  percent-encoded → `lookupReference` fails → **404 on every nav link**, plus a Korean `<h1>`/
  `<title>` under an en-apex canonical (incoherent to Google). Fix: `getReadBlock` and
  `resolveChapter` **always call `read()` with `{ lang: 'en' }`** so verse text, refs, and nav are
  English on every host — matching the en-apex canonical. Only the shell chrome (`<html lang>`,
  nav labels) stays host-localized, which is defensible.
- **`getReadBlock` outage handling:** stop blanket-catching. Return `null` only when the
  GraphQL response's `read` field is genuinely `null`; let network/GraphQL **errors throw**
  (verified: `gql` throws on a GraphQL `errors` array) so a pre-validated chapter that fails is
  a 5xx, not a false 404. Also fixes S1 (the dropped `lang`).
- `scripturePreview(block)` unchanged.

### 3. Metadata — `generateMetadata` + a `lib/seo.ts` override
- Extend `SeoInput` with two optional fields: `canonicalUrl?: string` (absolute — when set,
  `buildMetadata` uses it for **both** `alternates.canonical` and `openGraph.url` instead of the
  request-derived `abs`) and `lang?: string` (overrides the `x-lang`-derived language used for the
  og-card `lang` param + the naver tag — **S3**, since `buildMetadata` otherwise reads `x-lang`
  from the header at `lib/seo.ts:147-154`).
- `/read` passes `canonicalUrl = https://bookofmormon.online/read/${chapterSlug}` (apex, always),
  `lang: 'en'` (content is English on every host), `hreflang: false` (the opt-out already exists —
  hreflang entries pointing at pages that canonical elsewhere would be contradictory), `title =
  block.ref`, `description = scripturePreview(block)`.
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
- Valid ref, backend read fails → **5xx** (throw; avoids deindex-on-blip). Confirmed reachable:
  `gql` throws on the GraphQL `errors` array, so an outage surfaces as a thrown error, not a
  silent null.
- A verse/range/chapter-range URL always renders its (single) chapter with canonical→chapter
  (consolidation, no 301).
- Bare `/read` (no segments) is **out of scope** — it falls through to the `[...path]` catch-all
  (soft-200 `DefaultShell`) today; accepted as-is (a `[[...ref]]` optional catch-all is a
  possible future refinement, not built here).

## Testing (Playwright, bot UA)
- `/read/alma.32` → 200; `<title>` starts `Alma 32`; `<h1>Alma 32`; verse text present;
  `canonical` = `https://bookofmormon.online/read/alma.32`; prev (`/read/alma.31`) + next
  (`/read/alma.33`) links present.
- `/read/alma.32/21` (verse) → 200 rendering the **whole chapter**; canonical → `/read/alma.32`.
- `/read/alma.32.21~24` (verse range) → 200 → chapter; canonical → `/read/alma.32`.
- **`/read/alma.32~33` (chapter range) → 200 → chapter Alma 32; canonical → `/read/alma.32`**
  (B1 regression guard — must NOT self-canonical to `alma.32~33`).
- `/read/alma-17/7` (hyphen slug form) → 200 → chapter Alma 17; canonical → `/read/alma.17`.
- Single-chapter book `/read/enos.1` → 200; over-numbered `/read/enos.2` → 200 → Enos 1
  (verse-fallback consolidates), canonical → `/read/enos.1`.
- Book boundaries: `/read/1.nephi.1` → no prev link; `/read/moroni.10` → no next link;
  `/read/1.nephi.22` → next link `/read/2.nephi.1`.
- `/read/zznotabook` (junk) → 404.
- **Language host (B2):** a request with `x-forwarded-host: xn--289a67xla.kr` to `/read/alma.32`
  → English `<h1>Alma 32>` + English verse text, canonical → the en apex, and prev/next hrefs are
  ASCII (`/read/alma.31`, resolvable) — NOT Korean/percent-encoded 404s. No hreflang tags on any
  `/read` page.
- `sitemap.xml` contains `/read/` chapter URLs — spot-check count (239), first (`1.nephi.1`),
  last (`moroni.10`).
- Full SSR suite stays green.

## Scope
**New:** `app/read/[...ref]/page.tsx`, tests (`test/routes/read.test.ts`), a BoM chapter table
(in `lib/scripture.ts` or `lib/sitemap.ts`). **Modified:** `lib/scripture.ts` (revive
`slugify`/`resolveChapter`, harden `getReadBlock` + pin `lang:'en'`), `lib/seo.ts` (`canonicalUrl`
+ `lang` overrides), `lib/sitemap.ts` (chapter entries). **New dep:** `scripture-guide` in
`frontend/next`.
**NOT in scope:** localizing verse text (backend limitation — English served on all hosts);
verse-level indexed pages (they render the chapter); per-language sitemaps (separate spec); a
bare `/read` handler.

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
- **Chapter-count verification (the 15 counts + 239 total are already confirmed correct).** The
  over-number check must NOT be "`${count+1}` fails" — for single-chapter books
  `lookupReference('Enos 2')` *succeeds* (falls back to verse `Enos 1:2`). Verify instead that
  `generateReference([verse_ids[0]])` for `${book} ${count+1}` is not the chapter `${book}
  ${count+1}` (i.e. it consolidated to an existing chapter). Book-name strings all round-trip
  (`words.of.mormon.1` works; `"W of M"` not needed).
- **`canonicalUrl` + `lang` overrides vs a dedicated helper** — confirm the two `SeoInput`
  fields are the minimal clean change (they disable the self-referential host + x-lang logic for
  `/read` only).
