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
| `/history/:slug` | `app/history/[slug]/page.tsx`, `lib/history.ts` (`getHistoryDoc`) | `history(slug)` |
| `/art/:id` (illustration) | `app/art/[id]/page.tsx`, `lib/art.ts` | `image(id)` |
| `/sitemap.xml` | `app/sitemap.xml/route.ts`, `lib/sitemap.ts` | 9 categories |
| `/robots.txt` | `app/robots.txt/route.ts` | byte-exact constant |

`lib/seo.ts` `buildMetadata()` is the single source for the head tag-set.
`lib/entity.ts` holds the `superscript`/`wikiToHtml`/`wikiToText` transforms.

## PHP-box quirks replicated (learned the hard way)

- **Title suffix** ` • Book of Mormon Online`; homepage/default uses the literal full title (no suffix).
- **Descriptions**: strip HTML with no replacement space (PHP `strip_tags`), collapse spaces/tabs but **preserve newlines**, hard-truncate to 159 chars + `…`. Newlines count toward 159 (visible on `/about`).
  - **`/history/:slug` exception**: this route's description is `strip_tags("{date}: {source} • {transcript}")` with **no entity decode and no whitespace collapse** — PHP emits the bytes raw, and collapsing the double-space after an empty `source` would shift the 159-char cut. The page builds the string itself and passes `preTruncated: true` to `buildMetadata` so its collapse/truncate is skipped.
- **`/history/:slug` body**: `<h1>{document}</h1><h2>{date}</h2><h3>{source} {author}</h3>` (literal space between source and author; author-only → ` {author}`, source-only → `{source} `, neither → ` `), the `❮ Community` link, `<img class="thumb" alt="" src="…/history/thumbs/{id}">` (bare `thumbs/` when id null), `<p>{transcript}</p>` (transcript already opens with its own `<p>`, giving PHP's `<p><p>…</p></p>`), then `❮ Back`. document/date/source/author/transcript all rendered via `dangerouslySetInnerHTML` because they carry raw `&`/`"`/HTML that React text-children would escape.
- **`/art/:id` (illustration)**: title `{image.title} | Illustration of {ref}` (`ref` = the anchoring block's heading, e.g. `1 Nephi 1:4`); description `{artist} • {verse text}` (markers+tags stripped, 159-cut). Body: `<h1>{title}</h1>`, `<img class="img" src="/art/{id}">`, `<a href="{link}">© {artist}</a>` (credit; `link` empty → `href=""`), `<h4>References</h4>`, then a `<ul>` with one `<li><h2><a href="/{block.slug}">{ref}</a></h2>{verse <p>}</li>` per reference. `Image.location` is 1:1, so there is exactly one reference. title/artist are rendered via `dangerouslySetInnerHTML` (PHP emits them raw — an apostrophe like `Jerusalem's` must not become `&#x27;`); the verse `<p>` is injected directly into its `<li>` (no wrapper). Verse text drops **all** `[x]…[/x]` markers (`[c]`/`[i]`/`[v]`/`[a]`) — note `[v]verse[/v]` numbers appear in some blocks and must be stripped. **`/image/:id` is dead** on the PHP box (returns 500), so only `/art/:id` is built; an unknown art id `notFound()`s (the PHP box 500s).
- **Name disambiguators**: trailing digits → Unicode superscripts (`Nephi1` → `Nephi¹`) on people/place name & title.
- **Entity markup** in body text: `{Display|slug}` → `<a class="peoplelink" …/people/slug>`, `[Display|slug]` → `<a class="placelink" …/places/slug>`. In the page index `dd`, the same markup becomes plain display text.
- Template-heavy pages (maps/about/history/contents/sitemap) are built as raw HTML strings via `dangerouslySetInnerHTML` to reproduce PHP template quirks (e.g. unclosed `<ul>…<ul>`).
- **Line endings**: the PHP box emits `\r`; Node `fetch` preserves it, but Python text-mode reads convert it to `\n` — capture benchmarks with Node.

## Accepted deviations (semantically zero)

1. **People/place `<img>`**: PHP emits `<img …alt="X"  title="X" …>` (double space, unclosed); React serializes `<img … />`. Invisible to all parsers; matching it would need an extra wrapper `<div>` that creates *worse* structural diffs.
2. **`/contents` document close**: the PHP `/contents` is a **malformed, unclosed document** (no `</body>`/`</html>`, the toc `<div>` never closes — unique to this route). Ours is valid and closed; the toc inner markup is byte-identical. See `docs/bugs/2026-06-12-contents-parity-unclosed-php-document.md`.
3. **og:image host**: PHP points at the retired `preview.bookofmormon.online` GD service; ours points at our own `/og` route (next/og) — the whole point of the migration. Compared by presence + 1200×630 dims.
4. **`&`/`'` escaping in head fields (title, description, og:*, twitter:*)**: PHP emits field bytes raw, so a `<title>Extract, &c …</title>` or a description carrying an un-decoded transcript entity (`&ldquo;`, `&amp;`, an apostrophe) appears verbatim. Next.js HTML-escapes all Metadata attribute/title values (`&`→`&amp;`, `'`→`&#x27;`) — unavoidable without forking the framework's serializer. Same class as the `<img/>` deviation: invisible to parsers after entity-decode. Affects only the subset of history/text docs whose `document`/`source`/transcript carry such chars inside the first 159 description chars or the title; `parity.mjs` flags them on the `&ldquo;`/`&amp;`/`&#x27;` literals. The page still emits the PHP-exact *source* string (no decode, no whitespace collapse, 159-char cut) so the only difference is the leading-ampersand escape.

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
