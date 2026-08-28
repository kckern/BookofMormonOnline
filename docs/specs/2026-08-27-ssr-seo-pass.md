# SSR SEO optimization pass (hreflang + JSON-LD + head audit)

**Date:** 2026-08-27
**Status:** Design (brainstormed + Fable-reviewed with KC), pending implementation plan
**Layer:** `frontend/next/` (crawler-facing SSR)
**Related:** [`../reference/ssr.md`](../reference/ssr.md);
[`2026-08-27-ssr-korean-localization.md`](./2026-08-27-ssr-korean-localization.md).

## Problem

The SSR layer is flag-gated, localized, and image-previewed. This final pass closes three
SEO gaps: (A) **no hreflang** — the localized language domains aren't paired, so Google
can't map the variants; (B) **no structured data** — zero JSON-LD, so no rich results; (D)
**no final head-tag audit** across route classes.

## Decisions (brainstorming + review)

- **Scope:** A (hreflang) + B (JSON-LD) + D (head-tag audit).
- **Crawlable scripture is DESCOPED to its own spec.** The Fable review showed it's not a
  small "revive dead code" task: the reader uses **dot-slug** URLs (`/read/alma.32`, verse
  `/read/alma.32/21`, range `…21~24`), the backend does **not** localize verse text (only the
  ref/headings), and it needs alias-canonicalization, verse/range handling, ref validation,
  discovery (sitemap/links), and outage-vs-404 distinction. Track as a separate feature.
- **hreflang coverage:** only backend-**supported** languages (`en,ko,es,fr,de,swe,vn,ru,tgl`);
  omit `slv`/`tr`. **Per-page opt-out** for pages whose slug isn't language-invariant or that
  shouldn't advertise alternates (see A).

## Verified facts (review)

- `Metadata.alternates.languages` serializes to `<link rel="alternate" hreflang=…>`; absolute
  URLs pass through; coexists with the existing per-request `alternates.canonical`.
- `LANG_HOST` hosts match `lib/locales.ts` and resolve in DNS; ko canonical host is the
  punycode `xn--289a67xla.kr`, ru is `xn--80aahtjpadfibw.net`.
- Content pages already have complete heads (title/canonical/og:image); the only intentional
  gates are `/home`,`/matters` (remove→404) and `/history` (noindex). So D fixes stragglers,
  not broad gaps.
- Two non-language-invariant/noindex cases exist: `app/%ED%8A%B9%EB%B3%84%EB%B0%98/page.tsx`
  (`/특별반`, a Korean alias of `/studyedition` with its own canonical) and the `/history`
  subtree (noindex). Both must **opt out** of hreflang.
- Rendering `<script type="application/ld+json">` in a server-component body is the
  Next-documented pattern; `JSON.stringify` does **not** escape `<`, so `</script>` in text
  content can break out — escape `<`→`<`.

## Workstream A — hreflang alternates (`lib/seo.ts`)

- Add **`LANG_HOST`** (internal code → canonical host) for supported langs:
  `en→bookofmormon.online`, `ko→xn--289a67xla.kr`, `es→libromormon.es`,
  `fr→livredemormon.fr`, `de→buchmormon.de`, `swe→swe.bookofmormon.online`,
  `vn→sachmacmon.vn`, `ru→xn--80aahtjpadfibw.net`, `tgl→tgl.bookofmormon.online`.
- `SeoInput` gains `hreflang?: boolean` (default `true`).
- In `buildMetadata`, when `hreflang !== false` **and** `seoIntentForPath(path) === 'crawl'`
  (skips the noindex `/history` subtree), set
  `alternates.languages = { [bcp47(code)]: https://{host}{path}, …, 'x-default':
  https://bookofmormon.online{path} }`. (Slugs are language-invariant; `path` is identical
  across domains.)
- **Opt-outs:** pass `hreflang: false` from `app/%ED%8A%B9%EB%B3%84%EB%B0%98/page.tsx` (its
  path differs from the en alternate). The `/history` pages are covered by the
  `seoIntentForPath === 'crawl'` guard automatically. `remove` pages 404 (no metadata).

## Workstream B — JSON-LD structured data

- `lib/jsonld.ts` — pure builders returning plain objects:
  - `breadcrumb(items: { name: string; url: string }[])` → `schema.org` `BreadcrumbList`.
    Callers pass **data-driven** crumbs (page title/name + parents), NOT raw path segments
    (a path leaf like `/lehites/1` must not become a `"1"` crumb).
  - `creativeWork({ type, name, description, url, lang })` → `Article` (text/section) or
    `CreativeWork`/`Person`/`Place` (entities) with `name`/`headline`, `description`, `url`,
    `inLanguage` (bcp47), `isPartOf` the site.
- `app/_components/JsonLd.tsx` — server component:
  `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(data) }} />`
  where `safeJson` = `JSON.stringify(data).replace(/</g, '\\u003c')` (prevents `</script>`
  breakout).
- Emit `<JsonLd data={…} />` in content page bodies: `app/[...path]` (page/section/textblock —
  Article + breadcrumb from the block's `heading`/`sectionTitle`/`pageTitle`), `people/[slug]`
  (Person + breadcrumb Home›People›{name}), `place/PlaceView` (Place), `history/[slug]`
  (Article), `art/[id]` (CreativeWork), `commentary/[id]` (Article). Index pages: breadcrumb
  only (Home›{Section}).

## Workstream D — head-tag audit + fixes

- Add a Playwright audit spec (`test/routes/head-audit.test.ts`) that fetches one
  representative URL per route class (bot UA) and asserts each head is complete + consistent:
  non-empty `<title>`, absolute self-`canonical`, `og:title`/`description`/`image`,
  **hreflang present** (post-A) on crawl pages and **absent** on `/history` (noindex) and
  `/특별반` (opt-out), and `robots noindex` only on `/history`. Fix any straggler the sweep
  finds (document each). Expect it to mostly enforce A's correctness, not find broad gaps.

## Testing
- **A:** a content page (`/people/nephi1`) head has `<link rel="alternate" hreflang="ko"
  href="https://xn--289a67xla.kr/people/nephi1">` (+ es/fr/de/swe/vn/ru/tgl + `x-default`);
  `slv`/`tr` absent; `/특별반` and `/history/*` have **no** hreflang.
- **B:** content pages carry a valid `application/ld+json` (`JSON.parse` succeeds) with a
  `BreadcrumbList` (real names, not `"1"`) + a typed `CreativeWork`/`Article`/`Person`/`Place`;
  a `<` in a description is `<`-escaped (no `</script>` breakout).
- **D:** the audit spec passes across all route classes.
- Full SSR suite stays green.

## Scope
**New:** `lib/jsonld.ts`, `app/_components/JsonLd.tsx`, `test/routes/head-audit.test.ts`.
**Modified:** `lib/seo.ts` (`LANG_HOST`, `hreflang` opt-out, `alternates.languages`),
`app/%ED%8A%B9%EB%B3%84%EB%B0%98/page.tsx` (`hreflang: false`), the content page bodies
(add `<JsonLd>`), plus any straggler fixes from D.
**Deferred / separate specs:** crawlable scripture (`/read`), per-language sitemaps.

## Acceptance criteria
- Every crawl content page emits hreflang alternates for the supported language domains
  (+ x-default); noindex/opt-out pages emit none.
- Content pages emit valid, injection-safe BreadcrumbList + typed CreativeWork JSON-LD with
  data-driven crumb names.
- The head-tag audit passes across all route classes; stragglers fixed.
- No regression to the existing SSR suite.

## Open items (resolve in planning)
- **Per-page JSON-LD `@type` + crumb map:** confirm the `@type` and the parent-crumb chain
  for each route class (Person/Place/Article/CreativeWork; Home›Section›Leaf), sourcing crumb
  names from each page's existing data.
- **hreflang host canonicalization:** ensure the emitted `canonical` host and the matching
  hreflang entry agree in form (punycode) for `ko`/`ru`.
