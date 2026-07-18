# Dynamic Facsimile-Highlight Render API — Design Spec (v3)

**Date:** 2026-07-18
**Status:** Approved design v3 (post two stern-review rounds), pending implementation plan
**Author:** Claude (brainstormed with KC)
**Revision:** v3 folds in a second adversarial review round — see §16 for the changelog.
All three v2-round blockers are now closed with verified DB/library evidence,
including the legacy-alias verse mapping (§12), which is fully solved (no spike).

## 1. Background & motivation

Facsimile highlight images (e.g. `https://media.bookofmormon.online/fax/text/1837/ammon-132`)
show a scanned page of a historical Book of Mormon edition with a verse passage
highlighted. They are consumed by the frontend as plain `<img>` / CSS
`background-image` URLs.

**Current reality (verified during design):**

- `media.bookofmormon.online` is **static S3 behind CloudFront** (Cloudflare in
  front). A miss returns an S3 `NoSuchKey` XML error naming the key.
- The highlight JPEGs are a **frozen, partial set** batch-generated **once in 2022**
  by a now-deprecated PHP/GD script. There is no live generation tier today.
- Source page scans: `fax/pages/{version}/{nnn}.jpg` (3-digit zero-fill; `011`
  works, `11` 404s). Thumbnails: `fax/thumb/{version}/{nnn}.jpg`.
- **The existing consumers request an extensionless legacy path.** `Narration.js:185`
  and `StudyInFeed.js:190` build `${assetUrl}/fax/text/${version}/${m[1]}-${m[2]}`,
  where `m` matches a reader text-unit slug `([a-z-]+)/(\d+)` → `{slug}-{id}`. An
  **existing edge rewrite appends `.jpg`** before hitting S3 (a miss for
  `fax/text/1837/zzz-nonexistent` reports key `fax/text/1837/zzz-nonexistent.jpg`).

**Goals:**

1. **Primary:** a dynamic in-codebase render API that produces facsimile highlights
   on demand from `bom_xtras_fax_index`, taking **a verse-ID array or a scripture
   reference** plus an edition, with two render modes, multi-page/column stitching,
   size clamping, a `maxWidth` for thumbnails, a caching seam, and S3-backed
   persistence that does not block the response on S3 latency.
2. **Secondary (recommended, vetoable — see §12):** a **legacy-compat alias** at
   `fax/text/{version}/{slug}-{id}` so the two existing frontend call sites are
   reconnected with zero frontend changes once fallthrough is wired.

## 2. Data model (existing) — with the messy realities

Table `bom_xtras_fax_index`: one row = the pixel bounding box of one verse on one
page of one edition. 92,839 rows across 13 editions × 6,604 verses.

| column | meaning |
|---|---|
| `version` | edition slug (13: `1829`,`1830`,`1837`,`1840`,`1841`,`1879`,`1920`,`1981`,`2013`,`earliest`,`poetic`,`printer`,`rebom`) |
| `verse_id` | global verse id — **`VARCHAR(100)`**, string-match it |
| `page` | **`INT UNSIGNED ZEROFILL`** — Kysely returns `11`; S3 key needs `011` (re-zero-fill to width 3) |
| `pageWidth` | pixel width of that page's scan |
| `pageScale` | legacy constant (700 everywhere) — **ignored** |
| `X, Y, W, H` | verse bounding box: top-left corner + width/height, native scan pixels |
| `TLW, TLH` | top-left notch inset (verse starts mid-line) |
| `BRW, BRH` | bottom-right notch remainder (verse ends mid-line) |

**Verified data hazards the algorithm MUST handle:**

- **Coordinate space:** `X/Y/W/H` are native source-scan pixels. Verified: `1837`
  page 11 scan is 756×1372 and stored `pageWidth`=756; a native-space crop landed
  cleanly on complete text lines. **But `pageWidth` varies widely per page** —
  `1829` alone has 134 distinct widths (2000–2570), `1841` has 127. See §5.5 for
  the mandatory scan-vs-stored width assertion.
- **Up to 3 boxes per verse** (not "a second box"): e.g. `1829`/`34176`, `1920`/`37543`.
- **Column breaks with counter-intuitive X:** `2013`/`34284` page 276 has fragments
  at (X=56, Y=795) and (X=357, Y=70/71). The continuation is at a *smaller* Y and an
  X **left of page center** (357 < 600). A `pageWidth/2` threshold misclassifies it.
  See §5.3.
- **Near-duplicate rows:** `2013`/`34284` has (Y=70,H=87) and (Y=71,H=86) at the same
  X — must be merged/deduped with tolerance. (~20 near-dup pairs across 9 editions;
  a 2px all-corners rule catches them and never merges legitimately-distinct boxes,
  which differ by at least a line height.)
- **Negative notch values:** 2 rows have `BRW=-1` (`1829`/`36874`, `printer`/`36874`).
- **Negative box origin (`X`/`Y` < 0):** ~20+ rows — `printer` pages 5/7/8/11 (X=−1…−4),
  `1920` p33, `1830` p481. `sharp.extract` with a negative `left`/`top` **throws**.
- **All-zero boxes:** `1840`/33418 and `poetic`/37440 have `X=Y=W=H=0`. Zero-size
  extract throws, and a zero box must not count its page toward the N-page clamp.
- **Overlapping/nested boxes on one page:** `1829` p40 — verse 31631's box (X=18,
  Y=45) lies *inside* verse 31632's box (Y=37, spanning down). Naive `Y asc` ordering
  emits 31632 before 31631 — wrong reading order. Requires merged-run ordering (§5.3).

## 3. Architecture

- A **pure, portable render core** in `backend/src/media/fax/` plus a thin
  **Fastify** route (the backend is **Fastify 5.2**, not Express — `index.ts:1`).
- The backend registers a catch-all `app.route({url:'/*'})` → GraphQL at
  `index.ts:100`. The new route registers a **more specific** `url: '/fax/render/*'`
  (and `/fax/text/*` for the alias), which wins by Fastify precedence. The selector
  contains literal `/` in the `ids/...` form, so use wildcard capture + manual parse.
- All cache **hits** are served by CloudFront→S3 statically — Node never sees them.
- On a **miss**, CloudFront routes to the Node route via **origin-group failover**
  (see §10 for the exact CloudFront semantics — this is not "custom error responses").
  Node renders, streams bytes back (CloudFront caches per response headers), and
  **asynchronously** writes the encoded image to S3 at the exact key.
- The CloudFront failover wiring is a **later infra step**; the route works
  standalone (direct request → generate → stream + write-back).
- The render core stays **pure** (geometry + source buffers in, buffer out) —
  unit-testable and Lambda-liftable. Rationale for in-codebase over Lambda@Edge
  unchanged: generation is write-once-then-static, so only cold misses hit compute;
  edge compute is for hot paths and would add `sharp` packaging, a Lambda→remote-MySQL
  VPC story, and a separate deploy. Reuses existing `sharp` 0.33.5, `s3.ts`, Kysely,
  Infisical secrets.

**Bucket note:** `s3.ts` writes to `S3_BUCKET` / `S3_PUBLIC_URL`
(`assets.bookofmormon.online`). The fax assets live on `media.bookofmormon.online`
— **likely a different bucket**. The write-back path needs a `FAX_S3_BUCKET` /
`FAX_S3_PUBLIC_URL` (or confirmation the bucket is shared). This is a config item to
resolve before implementation, not an assumption.

## 4. HTTP contract — the URL *is* the cache key

Path is fully self-describing so the failover origin can regenerate from the URL
alone:

```
/fax/render/{version}/{mode}/w{width}/{selector}.{ext}
```

- `version` — edition slug, **validated against the 13-slug whitelist** (§6).
- `mode` — `page` (full-page dimmed) or `crop`.
- `width` — from a **fixed whitelist**: `200`, `400`, `800`, `1600`, or `full`
  (free-form widths rejected — caps cache-key cardinality, see §6).
- `selector` — either:
  - a **canonical scripture-ref slug** for contiguous ranges, e.g. `1-nephi-3.2-4`, or
  - `ids/{id}(-{id})*` for arbitrary/non-contiguous verse arrays, e.g.
    `ids/31103-31104-31108`.
- `ext` — `jpg` (default) or `webp`.

**Canonicalization (round-trip-safe — fixes v2's broken scheme):**

v2 assumed "contiguous ⇒ ref slug" always works. Verified false against the real
`scripture-guide`: `words-of-mormon-1.3-5` → 0 verses (the book slug doesn't parse),
and cross-book contiguous runs like `1-nephi-22.30-2-nephi-1.2` → 0 verses (verse IDs
are globally sequential, so a contiguous run crosses book seams). Either mints a
canonical URL that then 400s. The rule is therefore **round-trip-gated**:

1. Resolve input → sorted, de-duplicated verse-ID array (`ref` via `lookupReference`,
   de-slugified against a fixed book-slug table derived from `scripture-guide`'s
   `canon`; explicit list used as-is).
2. **Attempt** a ref slug: `generateReference(ids)` → slugify (lowercase; spaces→`-`;
   `:`→`.`; ranges use **ASCII hyphen**; drop commas). Accept it **only if it
   round-trips**: `lookupReference(deslugify(slug))` returns exactly the same verse-ID
   set (a fixed point). This automatically rejects Words-of-Mormon and cross-book
   runs, which fall through to step 3.
3. Otherwise canonical form is the **`ids/` list**, ascending, `-`-joined.
4. Any request whose path is not already canonical responds **`301`** → canonical
   URL, `Cache-Control: public, max-age=86400`. (301s aren't written to S3;
   non-canonical URLs always fail over to Node — acceptable.) **Exception:** legacy
   alias paths (§12) are never 301'd — they serve directly.

A property test over all 6,604 verses asserts `slug→ids→slug` is a fixed point for
every accepted ref slug (§15).

## 5. Render pipeline (shared)

1. Parse + validate URL (§6) → resolve selector → sorted verse-ID array.
2. Query `bom_xtras_fax_index` for `(version, verse_id in [...])`, grouped by page.
3. **Sanitize boxes:** clamp `X,Y ≥ 0`; clip `X+W`/`Y+H` to scan bounds; clamp
   negative `TL*/BR*` to 0; **drop** any box with `W ≤ 0` or `H ≤ 0` (a dropped box
   does not count toward the page clamp in step 5). **Dedupe** near-identical boxes
   per (page, verse) within ~2px on all corners.
4. **Reading order (§5.3).** Group by page; within a page infer columns by X-interval
   overlap; order page → column → merged-run Y.
5. **Clamp** to the first N pages (default 5, configurable) in reading order.
6. Fetch each needed source scan from S3 (`fax/pages/{version}/{nnn}.jpg`, page
   zero-filled to 3).
7. **Assert scan width (§5.5).**
8. Per page, compute the highlight region as a **rectangle set** (§5.4) and the
   selection-level exterior notches (§7).
9. **Per page**, compose per mode (§7) → **downscale that page to `width`** (never
   upscale). Downscaling *before* stitching bounds peak memory (a 5-up `1829` spread
   at native width is ~12,500px wide).
10. **Stitch** the per-page results into one image (§8), encode `jpg`/`webp`, stream
    out, async S3 write-back (§9).

### 5.3 Column-aware reading order (fixes the core bug — v3)

`page → column → merged-run Y` — NOT `page → Y`, and NOT the v2 X-start-gap scheme.

**Why not X-start gaps (v2):** verified against the table, a start-gap threshold that
splits real two-column pages also *falsely* splits single-column ones. Max
consecutive X-start gap as a fraction of `pageWidth` exceeds 15% on **~450
single-column pages** (e.g. `1830` p459 at 58.8% — a one-word verse-start fragment at
X=482 vs the column at X=38), while the real `2013`/`34284` two-column gap is only
25.1%. No single start-gap threshold separates these. The algorithm shape was wrong.

**Column inference by X-interval overlap:** treat each box as the horizontal interval
`[X, X+W]`. Two boxes share a column if their intervals overlap by more than a small
ε. Columns are the transitive-closure clusters of overlapping intervals. Verified:
- `1830` p459: fragment `[482,512]` ⊂ column `[38,513]` → **one column** (correct).
- `2013`/`34284`: `[56,341]` vs `[357,646]` disjoint → **two columns** (correct).
- `1920` two-column pages: `[6,323]` vs `[325,642]` (2px apart) → split via the ε rule.

Order columns left→right by min `X`.

**Merged-run ordering within a column** (fixes the `1829` p40 overlap case): merge the
column's boxes into maximal **vertical runs** (union of vertically-overlapping/adjacent
rectangles), then order runs by top `Y`. This prevents a small tail fragment nested
inside a taller box from sorting ahead of it. A "fragment" for stitching (§7/§8) is
exactly one such merged run.

The ε overlap tolerance is a small fixed pixel value validated against golden assets
(§14); single-column editions must always collapse to one column.

### 5.4 Union / notch geometry

A verse's box minus its notches decomposes into rectangles:
`fullBox − topLeftNotch(TLW,TLH) − bottomRightNotch(BRW,BRH)`. For a multi-verse
selection on a page, the highlight is the **union of the per-verse rectangle sets**.
Interior verse-to-verse boundaries within the selection stay lit (their notches are
*internal* and must NOT be paper-filled). Only the notches at the very **start of the
first verse** and **end of the last verse** of the whole selection are exterior. See
§7 for how each mode uses this.

### 5.5 Scan-width assertion (cheap correctness guard)

After decoding each scan, assert `metadata.width === row.pageWidth`. On mismatch,
scale every coordinate for that page by `metadata.width / pageWidth` (and log a
warning). Prevents silent geometry corruption if any scan was ever re-scanned
relative to the 2022 capture.

## 6. Input validation & abuse controls

The endpoint is unauthenticated and creates permanent S3 objects, so inputs are
strictly validated (closes the DoS-amplification / path-traversal surface):

- `version` ∈ the 13-slug whitelist. Rejecting unknown slugs also prevents path
  traversal into the `fax/pages/{version}/…` S3 fetch (which is built from this input).
- `mode` ∈ {`page`,`crop`}; `ext` ∈ {`jpg`,`webp`}; `width` ∈ the fixed whitelist.
- `ids/` selector matches `^\d+(-\d+){0,K}$` with a low `K` (e.g. 40); over `K` → `400`.
- Ref slug matches a strict `^[a-z0-9.\-]+$` and must resolve via `scripture-guide`.
- **Global sharp concurrency semaphore** (bounded worker slots) so a burst of cold
  misses can't exhaust memory decoding many large scans (1829 scans are ~2500px wide).
- **Rate limit** on the render route (per-IP; `@fastify/rate-limit` — a **new
  dependency** to add to `backend/package.json`). The alias route (§12) shares it.
- Invalid input → `400`; nothing renderable → `404`.

## 7. Render modes

A **fragment** = one maximal merged vertical run of the selection's rectangle-union
per (page, column), as defined in §5.3. A single-verse, single-page selection is one
fragment; a column/page-spanning selection is several, emitted in reading order.

- **`page` (full-page dimmed):** render the full source scan; apply a dark overlay
  (default ~55% opacity black) everywhere **except** the highlight rectangle-set,
  which stays at full brightness. Output aspect = the page.
- **`crop`:** crop **each fragment's** bounding box (not a single union bbox across
  columns — that would span the gutter). **Paper-fill only the exterior notch corners
  of the whole selection** — the top-left notch of the **first verse's first box**
  (by verse-id order) and the bottom-right notch of the **last verse's last box**;
  fill sampled from the page margin color (fallback near-white). Interior
  verse-to-verse notches stay lit (§5.4). Each fragment crop is a clean opaque
  rectangle; fragments are stitched per §8.

Default format **JPEG**; `webp` optional (smaller thumbnails, paid once at
generation). Set `quality` sensibly (~82).

## 8. Spanning → one stitched image

- **`crop`:** fragments stacked **top-to-bottom** into a continuous ribbon in reading
  order (§5.3).
- **`page`:** touched pages placed **side-by-side as a spread** (may be up to N pages
  wide — §9 clamp — so "N-up", not strictly 2-up). Each page independently dimmed
  except its fragment; uniform gutter; align on top edge and pad differing heights.
  Spread composition happens **after** per-page downscale to bound peak memory.

## 9. Limits & guardrails

- Clamp to the first **N pages** (default 5, configurable), in reading order.
- The clamp is **silent** to the consumer (an `<img>`/CSS-background cannot read
  headers). The `X-Fax-Clamped` header is therefore **dropped** from the contract as
  observability theater; clamping is instead **logged/metered** server-side. (If a
  visible cue is ever wanted, bake a "+N pages" strip into the image — out of scope.)
- Hard `K`-cap on the `ids/` list (§6) is the backstop for absurd selections.

## 10. Caching, S3 & CloudFront

- **Cache key = the URL path.** S3 key:
  `fax/render/{version}/{mode}/w{width}/{selector}.{ext}`.
- **Async write-back with durability guarantees.** After `res` is sent, `PUT` the
  bytes fire-and-forget so the response never waits on S3 — BUT: on PUT failure,
  **retry** (small bounded backoff) and **log + increment a failure counter**; silent
  write-loss is not acceptable (its degraded mode is "re-render forever on every
  CDN-expiry miss"). The `PUT` sets `Content-Type` and
  `Cache-Control: public, max-age=31536000, immutable` (`s3.ts:68-69` sets the same
  `max-age` **without** `immutable`; we add it deliberately). Render paths write the
  `fax/render/...` key; **alias paths (§12) write the legacy
  `fax/text/{version}/{slug}-{id}.jpg` key.**
- **Request coalescing.** In standalone mode (no CDN dedup), N concurrent requests
  for one cold key would spawn N sharp pipelines. Reuse the **`inFlight` promise-map
  pattern from `avatarAssets.ts:30`**: keyed by the canonical path, so concurrent
  callers await one render.
- **Response headers from Node:** `Content-Type`, `Cache-Control: public,
  max-age=31536000, immutable`, and an `ETag` (hash of the bytes). Required or
  "CloudFront caches immediately" (§3) is false.
- **CloudFront specifics (record so infra doesn't guess):**
  - Mechanism is an **origin group with origin failover** (primary S3, secondary Node
    origin), failing over on configured status codes. It is *not* Custom Error
    Responses (those serve static error pages, they don't proxy).
  - Failover status codes: today a miss is a genuine **404** (public-read bucket). If
    the bucket goes OAC-private without `s3:ListBucket`, misses become **403** — the
    failover config must then include both 403 and 404.
  - **Error caching:** Node's own `400/404/502` (§11) get cached by CloudFront's Error
    Caching Min-TTL *and* Cloudflare's error caching. Set these TTLs deliberately so a
    transient `502` (source-scan hiccup) isn't pinned at the edge.
  - **Cache policy must strip/normalize the query string** (else `?x=1..n` fragments
    the cache key and re-opens the abuse surface in §6).
  - The failover origin receives the **original path**; confirm the existing `.jpg`
    edge-append rewrite (§1) does not mangle `/fax/render/...` paths.
- **`FaxRenderCache` seam:** thin interface (`keyFor`, `writeBack`, and a future
  `read`/`exists`) as the placeholder. S3-only today; a Redis/memory tier slots in
  later without touching the route.
- **Sandbox:** when `ctx.sandbox`, skip S3 write-back (per `s3.ts` convention) but
  still serve bytes.

## 11. Error handling

- Unknown version → `400` (whitelist). Verse with no box row → skip it.
- Empty result (no boxes) → `404`. Malformed params → `400`.
- Source-scan fetch failure → `502` (mind the edge error-TTL, §10).
- Sandbox mode → serve bytes, skip write-back.

## 12. Legacy-compat alias (secondary goal — mechanism SOLVED)

Serve `fax/text/{version}/{slug}-{id}(.jpg)` as an alias so the existing frontend
(`Narration.js:185`, `StudyInFeed.js:190`) is reconnected with zero changes. The
verse-resolution mechanism is now fully identified and verified against the golden
asset (no spike remaining):

**Resolution chain (verified end-to-end for `ammon-132`):**
1. `bom_slug` WHERE `slug = {slug}` AND `type = 'PG'` → its `link` column = the **page
   guid**. (v2 wrongly said "via `bom_text`" and omitted this hop.)
2. `bom_text` WHERE `page = {pageGuid}` AND `link = {id}` → the text-unit row; take its
   **`heading`** (e.g. `"Alma 26:1–9"`).
3. Normalize the heading (en-dash/em-dash → ASCII hyphen) and parse via
   `scripture-guide` `lookupReference` → the verse-ID set (Alma 26:1–9 → 9 IDs
   `34345…34353`). **The heading is the source of truth** — `bom_lookup` returns only
   the unit's anchor verse (1), and `min_verse_id` is non-monotonic across units;
   both are red herrings.
4. Feed the verse IDs into the shared pipeline with `mode=page`, `width=full`,
   `ext=jpg`. Verified: those 9 verses' `1837` boxes are all on page 317, Y-band
   ~163–828, matching the golden's bright band (modulo the known different-scan-
   generation scale — §15).

**Topical-heading units need no fallback.** 15.4% of unit headings are topical
("A rod of iron") and don't parse. Verified: those units **return 404 in the frozen
2022 set** (`lehites-83` → 404) while parseable ones exist (`lehites-1` → 206). So a
non-parsing heading → the alias returns **404**, which is *exactly* today's behavior.
No fallback derivation is required.

**Serving semantics (S4):**
- Validate `{slug}` (`^[a-z-]{1,50}$`), `{id}` (`^\d{1,6}$`), and `version`
  (whitelist); the alias route shares the §6 rate limiter and sharp semaphore.
- Alias paths **serve the image directly** (they are never 301'd — see §4 exception),
  and write back to the **legacy S3 key** `fax/text/{version}/{slug}-{id}.jpg`, so
  future hits are static exactly like the 2022 set. (The `.jpg` matches the existing
  edge-append rewrite in §1.)
- Empty/again-404 when the heading doesn't resolve.

Recommended: keep the alias (lowest risk, immediate win, reproduces the golden
mechanism); the frontend can migrate to the rich `/fax/render/...` path opt-in later.

## 13. Module layout

```
backend/src/media/fax/
  geometry.ts     # verse-IDs -> boxes -> dedupe/clamp -> columns/reading order -> union rects, clamping
  render.ts       # pure: rect-sets + source images -> composed Buffer (both modes, stitching)
  cache.ts        # FaxRenderCache seam (S3 write-back w/ retry, key derivation, inFlight coalescing)
  resolve.ts      # selector -> verse-IDs (ref via scripture-guide; ids list; legacy unit via bom_slug->bom_text.heading->lookupReference)
  route.ts        # Fastify handler: validate -> resolve -> render -> stream -> write-back
```

`render.ts` stays pure (buffers in, buffer out) — unit-testable and Lambda-liftable.

## 14. Open validation items (do these FIRST in implementation)

Only two design unknowns remain (the v2-round blockers are resolved and evidenced):

1. **Notch sign convention** — which corner/direction `TLW/TLH` vs `BRW/BRH` encode;
   pixel-verify against a known verse before building crop paper-fill.
2. **Column ε overlap tolerance (§5.3)** — lock the small interval-overlap ε against a
   test matrix incl. single-column editions (must yield one column, e.g. `1830` p459)
   and two-column pages (`2013`/`34284`, `1920`); tune once, freeze via test.
3. **Fax S3 bucket/host (§3)** — confirm whether fax assets share `S3_BUCKET` or need
   `FAX_S3_BUCKET`/`FAX_S3_PUBLIC_URL`.

(The legacy text-unit resolution, a v2 open item, is now **solved** — see §12.)

## 15. Testing

- **`geometry.ts` units:** dedupe near-identical rows (`34284`); clamp negative notch
  (`36874`) and negative `X`/`Y` (`printer` p5/`1920` p33); drop all-zero boxes
  (`1840`/33418, `poetic`/37440); **column inference by interval overlap** — single
  column collapses (`1830` p459), two columns split (`2013`/34284, `1920`);
  **merged-run ordering** with a nested box (`1829` p40: 31631 inside 31632); page
  clamping; 3-box verses.
- **Canonicalization property test:** for **all 6,604 verses**, any accepted ref slug
  satisfies `slug→ids→slug` fixed point; Words-of-Mormon and cross-book contiguous
  runs fall to the `ids/` form (regression for the v2 B2 bug).
- **`render.ts` units:** fixture scan + fixture boxes → snapshot output dimensions +
  targeted pixel checks for `page`, `crop`, and an N-up spread; interior-notch-not-
  paper-filled check; downscale-before-stitch order.
- **Golden-parity test (scale-normalized):** the golden `fax/text/1837/ammon-132` is
  981×1500 while today's scan is 768×1192 — **different scan generations**, so the
  test must **normalize scale and compare highlight-band geometry** (relative Y-band,
  verse set), NOT raw pixels or absolute dimensions. Asserts the §12 heading→verses
  chain reproduces the Alma 26:1–9 band.
- **Route:** param validation/whitelists, canonical `301` (both directions) + alias
  paths **not** 301'd, error codes, coalescing (concurrent cold requests → one render).
- **Perf/memory budget:** worst-case `1829` (~2500px scans) N-up spread (downscaled
  per-page first) stays within a set memory ceiling; concurrency semaphore enforced.

## 16. Changelog v1 → v2 (from stern review)

- **B1** Reading order corrected to column-aware (`page→column→Y`) with X-gap
  clustering; `pageWidth/2` rejected as insufficient (§5.3).
- **B2** Added legacy-compat alias + frontend-migration decision so the actually-broken
  `fax/text/...` consumers get reconnected (§1, §12).
- **B3** Added input-validation & abuse-control section: whitelists, ids regex/cap,
  path-traversal guard, sharp semaphore, rate limit (§6).
- **B4** Specified union/notch algorithm (rect decomposition), interior-vs-exterior
  notch rule, dedupe, negative-clamp, 3-box handling (§2, §5.3–5.4, §7).
- **S1** Fastify (not Express) + route-precedence vs the `/*` catch-all (§3).
- **S2** CloudFront origin-group failover semantics, 403-vs-404, error-TTL, query-string
  stripping, response/PUT headers (§10).
- **S3** Async write-back keeps async (per KC) but adds retry + failure metric +
  request coalescing (§10).
- **S4** Mandatory scan-width-vs-`pageWidth` assertion + rescale (§5.5).
- **S5** Explicit canonicalization/slug rules + 301 direction + Cache-Control (§4).
- **S6** Dropped the unreachable `X-Fax-Clamped` header; clamp is silent + logged (§9).
- **Nits** page zero-fill, N-up (not 2-up) naming + memory budget, golden-parity test.

### Changelog v2 → v3 (second stern-review round)

- **B1 (reopened)** Reading order re-fixed: X-*start*-gap clustering replaced with
  **X-interval-overlap** clustering + **merged-run** Y-ordering. Start-gap provably
  fails on ~450 single-column pages (`1830` p459 = 58.8%); overlap handles both it and
  `2013`/34284, and merged runs fix the nested-box case (`1829` p40) (§5.3).
- **B2 (reopened)** Canonicalization made **round-trip-gated** — a ref slug is used
  only if `slug→ids→slug` is a fixed point; Words-of-Mormon and cross-book runs (both
  verified to yield 0 verses) now fall to the `ids/` form (§4).
- **B3/§12 (solved)** Legacy-alias verse mapping identified and verified:
  `bom_slug(PG)` → page guid → `bom_text.heading` → `lookupReference`. Topical headings
  404 in the frozen set, so no fallback needed (§12).
- **New — pipeline order:** compose → **downscale per page** → stitch → encode (§5, §8
  contradiction resolved).
- **New — bad-geometry rows:** clamp negative `X`/`Y`, clip to bounds, drop zero-size
  boxes (would crash `sharp.extract`) (§2, §5 step 3).
- **New — fragment defined:** = maximal merged vertical run per (page, column); crops
  per fragment, not one cross-gutter union bbox; exterior-notch attribution by
  verse-id order (§5.3, §7).
- **New — alias serving:** validated inputs, shares limiter, **served directly (not
  301'd)**, writes the legacy S3 key (§4, §12).
- **New — golden-parity test** must be scale-normalized (different scan generations)
  (§15).
- **Nits:** `immutable` citation corrected; `@fastify/rate-limit` is a new dependency;
  `fax/tabs` is static and out of scope; ASCII hyphen in slugs.

## 17. Decisions locked

1. Source scans already on S3, fronted by `media.bookofmormon.online`.
2. In-codebase portable generator in `backend/`; CloudFront origin-failover to Node on miss.
3. Spanning → one stitched image (crop = vertical ribbon; page = N-up spread).
4. Crop notch corners: paper-fill (opaque), exterior notches only.
5. Format: JPEG default, optional `webp`.
6. Size limit: clamp to first N pages (default ~5), silent + logged.
7. Caching: async write-back (+retry/metric/coalescing) + thin cache seam.
8. Coordinate space: native scan pixels (verified); `pageScale` ignored; scan-width asserted.
9. Framework: Fastify.
10. Legacy `fax/text` alias: recommended, and its verse-mapping mechanism is **solved
    & verified** (`bom_slug`→`bom_text.heading`→`lookupReference`); topical headings 404
    as today, no fallback needed (§12).
11. Canonicalization is round-trip-gated (ref slug only if `slug→ids→slug` is a fixed
    point; else `ids/` form) (§4).
