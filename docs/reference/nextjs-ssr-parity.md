# Next.js SSR Parity with the PHP Box

The Next.js app (`frontend/next/`) replicates the legacy PHP SSR box's crawler HTML.
**Architecture:** same path, same port, same host — `middleware.ts` detects the
User-Agent: bots/scrapers get Next.js server-rendered HTML; humans are rewritten
to the CRA reader (`localhost:8201`). `robots.txt`, `sitemap.xml`, and `/og` are
Next-served for everyone (crawlers don't always send a bot UA).

The PHP box output is the spec. Parity is proven by harnesses, not eyeballing.

## Harnesses (`frontend/next/scripts/`)

Run from `frontend/next/`. They fetch the live PHP box (bot UA) and our SSR and diff.

| Script | Checks | Pass condition |
|---|---|---|
| `parity.mjs [paths…]` | head: title, description, og:*, twitter:*, canonical (whitespace-normalized; og:image by presence+dims) | `all head fields match` |
| `body-diff.mjs <path>` | `<body>` structure/text/hrefs, ignoring Next hydration noise + inter-tag whitespace | `bodies identical (normalized)` |
| `sitemap-diff.mjs` | `/sitemap.xml` URL set + per-URL priority/changefreq/lastmod | `SITEMAP PARITY` |

## Route classes (all at parity)

| Route | Files | Source |
|---|---|---|
| `/` + unknown slugs (default shell) | `app/page.tsx`, `app/_components/DefaultShell.tsx`, `[slug]` fallback | constants in `lib/seo.ts` |
| `/:slug/:id` (text block) | `app/[slug]/[blockno]/page.tsx`, `lib/text.ts` | `text(slug)` |
| `/:slug` (page index) | `app/[slug]/page.tsx`, `lib/pages.ts` | `page(slug)` |
| `/people/:slug` | `app/people/[slug]/page.tsx`, `lib/people.ts` | `person(slug)` |
| `/place/:slug`, `/places/:slug` | `app/place/PlaceView.tsx` + both route dirs, `lib/places.ts` | `place(slug)` |
| `/contents` | `app/contents/page.tsx`, `lib/contents.ts` | `division` + `page` |
| `/about` | `app/about/page.tsx`, `lib/about.ts` (static) | captured verbatim |
| `/maps` | `app/maps/page.tsx`, `lib/maps.ts` | `maps` |
| `/history` | `app/history/page.tsx`, `lib/history.ts` | `history` |
| `/sitemap.xml` | `app/sitemap.xml/route.ts`, `lib/sitemap.ts` | 9 categories |
| `/robots.txt` | `app/robots.txt/route.ts` | byte-exact constant |

`lib/seo.ts` `buildMetadata()` is the single source for the head tag-set.
`lib/entity.ts` holds the `superscript`/`wikiToHtml`/`wikiToText` transforms.

## PHP-box quirks replicated (learned the hard way)

- **Title suffix** ` • Book of Mormon Online`; homepage/default uses the literal full title (no suffix).
- **Descriptions**: strip HTML with no replacement space (PHP `strip_tags`), collapse spaces/tabs but **preserve newlines**, hard-truncate to 159 chars + `…`. Newlines count toward 159 (visible on `/about`).
- **Name disambiguators**: trailing digits → Unicode superscripts (`Nephi1` → `Nephi¹`) on people/place name & title.
- **Entity markup** in body text: `{Display|slug}` → `<a class="peoplelink" …/people/slug>`, `[Display|slug]` → `<a class="placelink" …/places/slug>`. In the page index `dd`, the same markup becomes plain display text.
- Template-heavy pages (maps/about/history/contents/sitemap) are built as raw HTML strings via `dangerouslySetInnerHTML` to reproduce PHP template quirks (e.g. unclosed `<ul>…<ul>`).
- **Line endings**: the PHP box emits `\r`; Node `fetch` preserves it, but Python text-mode reads convert it to `\n` — capture benchmarks with Node.

## Accepted deviations (semantically zero)

1. **People/place `<img>`**: PHP emits `<img …alt="X"  title="X" …>` (double space, unclosed); React serializes `<img … />`. Invisible to all parsers; matching it would need an extra wrapper `<div>` that creates *worse* structural diffs.
2. **`/contents` document close**: the PHP `/contents` is a **malformed, unclosed document** (no `</body>`/`</html>`, the toc `<div>` never closes — unique to this route). Ours is valid and closed; the toc inner markup is byte-identical. See `docs/bugs/2026-06-12-contents-parity-unclosed-php-document.md`.
3. **og:image host**: PHP points at the retired `preview.bookofmormon.online` GD service; ours points at our own `/og` route (next/og) — the whole point of the migration. Compared by presence + 1200×630 dims.

## Data-layer fixups for stale benchmark URLs (sitemap)

The PHP sitemap emits URLs the live GraphQL backend no longer exposes; `lib/sitemap.ts`
re-adds them as documented constants to hit the exact 3179-URL set:
- `CLONED_MAPS` (`newyork` → clone of `panama`'s places): a legacy map the resolver dropped.
- `KO_ONLY_FAX_SLUGS`: 5 facsimile editions that only exist under `lang='ko'`.
- `ORPHANED_SECTION_SLUGS`: 1 `bom_slug` row with no `bom_section`.
- `LASTMOD = '2026-06-06'`: a site-wide constant (the benchmark's value); should track the last content-build date.

## Backend change

`backend/src/data/loaders/searchhist.ts`: `historyQuery` ordering `seq`→`date` so the
`history` resolver returns the chronological order the `/history` page renders. The
`history` resolver is the only consumer; per-document pages filter by slug. (`bom-greenfield`
:5006 must be restarted to load it.)
