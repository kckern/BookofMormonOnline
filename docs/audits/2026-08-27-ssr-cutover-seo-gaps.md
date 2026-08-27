# SSR-layer SEO gaps blocking the prod cutover

**Date:** 2026-08-27
**Scope:** `frontend/next/` (the crawler-facing SSR layer) vs the live CRA + the
2026-08-27 CRA cutover feature flags.
**Method:** three parallel read-only code audits (History parity, metadata/canonical,
catch-all crawl surface). Nothing edited.
**Architecture context:** [`../reference/ssr.md`](../reference/ssr.md) — bots get Next
SSR, humans get the CRA; the `HIDE_*` flags run in the CRA only, so the SSR crawl surface
does not reflect them.

## Why this matters

At cutover, what search engines index is decided entirely by the SSR layer (route status
+ metadata) and `/sitemap.xml` — not by the CRA. Getting a status code or canonical wrong
here moves rankings and de-indexes content, and recovery is slow. The gaps below are
grouped by severity.

---

## CRITICAL (must fix before cutover)

### C1 — Every non-English language subdomain canonicalizes onto the English host (mass de-index risk)
- **Where:** `lib/seo.ts:84` emits `alternates.canonical = path` (bare, e.g. `/timeline`)
  and `openGraph.url = path`; `app/layout.tsx:7` hardcodes
  `metadataBase = new URL('https://bookofmormon.online')`. Next resolves the bare
  canonical against `metadataBase`, so **every** page on **every** language subdomain
  emits `<link rel="canonical" href="https://bookofmormon.online/…">`.
- **The language is known but never threaded in:** `middleware.ts:60-63` sets an `x-lang`
  request header, but no metadata function reads it (`grep x-lang app/ lib/` → nothing).
- **Impact:** `ko.bookofmormon.online/…` (and every other lang subdomain) tells Google its
  canonical is the English URL → Google drops the localized URLs and consolidates onto the
  English host. Translated content becomes uncrawlable duplicates. Costly, slow to reverse.
- **Fix direction:** make canonical/`metadataBase` host-aware — read the request host
  (via `x-lang`/`headers()`) so each localized page self-canonicalizes on its own
  subdomain.

## IMPORTANT

### I1 — Feature flags don't reach the SSR crawl surface (the cutover's core gap)
- **Where:** `frontend/webapp/config/features.yml` / `HIDE_*` are CRA-only; `frontend/next/`
  imports none of it. Route handlers, `lib/sitemap.ts`, and SSR internal links have no
  flag awareness.
- **Impact:** any feature "hidden" for humans stays fully crawlable/indexed for bots (and
  reachable via search results, since routes stay live). See per-feature state below.
- **Fix direction:** the Next layer reads the same flag config; flag intent (crawl /
  noindex / remove) drives route status + sitemap inclusion + link chrome. See
  [`../reference/ssr.md`](../reference/ssr.md) "Feature flags & the crawl surface."

### I2 — Bare `/matters` and `/home` are indexable soft-404s
- **Where:** `app/[...path]/page.tsx:117` — single-segment `page` branch returns
  `<DefaultShell />` at **HTTP 200** for unknown slugs; metadata from
  `defaultMetadata('/matters')` self-canonicals the junk page.
- **Detail:** `/matters/{slug}` and `/home/community` correctly `notFound()` (real 404);
  only the bare single-segment paths soft-200. Not in the sitemap, but a 200 is crawlable.
- **Impact:** thin/boilerplate pages get indexed, waste crawl budget. Also every such
  DefaultShell emits the `DEFAULT_NAV` `<a href="/history">` link (`lib/seo.ts:17`).
- **Fix direction:** the single-segment miss should `notFound()` (404) rather than render
  DefaultShell — or be flag-gated to the intended status.

### I3 — History: the redesigned CRA sections are invisible/broken for crawlers
The CRA History redesign (Routes.js:194-221) added real, archive-backed pages with **no
matching Next route**, so bots fall to the catch-all and `notFound()`:

| Live human URL | CRA component | Bot (Next) result |
|---|---|---|
| `/history/translation` | `TranslationSources.jsx` | **404** + empty metadata |
| `/history/reception`, `/history/reception/:slug` | `History.js` (reception archive) | **404** + empty metadata |
| `/history/lost-116-pages` | `LostPages.js` | **404** + empty metadata |

- **Impact:** live, indexable sections bot-404. They're also in no sitemap and have no SSR
  inbound link → **zero crawlable surface** for the new History hub's sections.

### I4 — `/history/{slug}` is a self-canonical 200 for bots but a redirect for humans
- **Where:** sitemap emits ~1024 `/history/{slug}` at 0.3 (`lib/sitemap.ts:70-75`); Next
  `app/history/[slug]/page.tsx` renders each as a self-canonical 200. But the CRA now
  **redirects** `/history/:slug` → `/history/reception/:slug`
  (`webapp/.../RedirectReceptionSlug.jsx`), whose target *also* bot-404s (I3).
- **Impact:** bot/human divergence on ~1024 sitemap URLs (cloaking-adjacent), and the
  human redirect target is a bot-404. Needs a real **301** at the SSR layer to the new
  canonical location — see [`../reference/ssr.md`](../reference/ssr.md) HTTP-status table.

### I5 — SSR `/history` index diverges from the redesigned hub
- **Where:** `app/history/page.tsx` → `_index.tsx` renders the **old flat `<ul>`** of every
  history doc linking `/history/{slug}`; the CRA `HistoryHub.jsx` is a 5-card hub linking
  the new section pages. Sitemap priority 0.7.
- **Impact:** the crawlable `/history` bears no resemblance to the live hub, and routes
  crawlers into the flat doc set instead of the new sections (which are already orphaned).

### I6 — `/history/joseph-smith` and `/history/witnesses` SSR are stubs
- **Where:** `app/history/joseph-smith/page.tsx` and `.../witnesses/page.tsx` both
  `return <HistoryIndex />` with the generic "Historical Sources…" title
  (`_index.tsx:10-17`). The CRA now serves rich distinct pages (`Witnesses.js` 344 lines,
  `JosephSmith.js`).
- **Impact:** weak/duplicative metadata + non-representative body for two now-substantial
  pages (parity gap, not a 404).

### I7 — No `hreflang` alternates for a multi-subdomain multilingual site
- **Where:** only `alternates.canonical` is set (`seo.ts:84`); `alternates.languages` never
  populated; sitemap enumerates only the English host (`sitemap.ts:10`,
  `app/sitemap.xml/route.ts:21`); no `xhtml:link` alternates.
- **Impact:** Google can't pair language variants; compounds C1. Localized URLs aren't
  submitted via sitemap at all. Non-fatal but a real multilingual gap.

## MINOR

- **M1 — Duplicate History titles:** `/history`, `/history/joseph-smith`, `/history/witnesses`
  share byte-identical title+description (`_index.tsx:10-17`), differing only in canonical.
- **M2 — Korean OG glyphs:** `app/og/route.ts:22` accepts a `lang` param to pick the Korean
  font, but `buildMetadata` never passes `lang` into the `/og?…` URL (`seo.ts:76-78`) → ko
  social cards may render tofu. Cosmetic (share cards, not ranking).
- **M3 — `/contents` empty description:** `app/contents/page.tsx:8` ships `description: ''`
  (PHP parity) on a priority-0.9 page. Thin-metadata signal, not harmful.
- **M4 — No structured data (JSON-LD):** none anywhere — zero rich-result error risk, but a
  missed enhancement (Article/Breadcrumb schema).

## Confirmed CORRECT (no action)
- `robots.txt` allow-all + sitemap pointer (`app/robots.txt/route.ts:4`); nothing
  unintentionally noindexed.
- `www.*` → bare host **301** (`middleware.ts:28-32`).
- No trailing-slash duplication (Next default 308 `/x/`→`/x`); HTTPS at the edge.
- OG image generation sound (`app/og/route.ts`: 1200×630, fonts at init, `revalidate`).
- `generateMetadata` returning `{}` on not-found is paired with `notFound()` (404), so the
  empty metadata attaches to a 404 — correct, not thin-metadata.
- `/history/[slug]` slug set is in parity with the sitemap's `history { slug }` query.

## Per-feature cutover state (flags vs crawl surface)
| Feature (CRA-hidden) | SSR route | Sitemap | SSR links | Aligned with… |
|---|---|---|---|---|
| **Matters** | soft-404 `/matters` (200); `/matters/{slug}` real 404 | absent | none | nearly **remove** (fix I2 soft-200) |
| **Home** | soft-404 `/home` (200); `/home/community` real 404 | absent | none | nearly **remove** (fix I2 soft-200) |
| **History** | full SSR (some stub/divergent) | ~1024 URLs + index | `DEFAULT_NAV` + self-links | **crawl** (needs an explicit intent decision) |

**The open product decision** (drives the whole History workstream): is hiding History
"hide the human nav but keep it indexed" (**crawl** — keep sitemap/routes, fix I3–I6 for
correctness) or "de-feature for cutover" (**remove** — pull sitemap + 404/410 routes +
drop the nav link)? History carried legacy SEO equity, so **remove** is a deliberate
de-index, not a no-op.
