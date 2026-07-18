# Dynamic Facsimile-Highlight Render API — Design Spec (v2)

**Date:** 2026-07-18
**Status:** Approved design v2 (post stern-review), pending implementation plan
**Author:** Claude (brainstormed with KC)
**Revision:** v2 folds in a grouchy adversarial review — see §16 for the changelog.

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
  X — must be merged/deduped with tolerance.
- **Negative notch values:** 2 rows have `BRW=-1` (`1829`/`36874`, `printer`/`36874`)
  — clamp negatives to 0.

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

**Canonicalization (explicit rules):**

1. Resolve input → sorted, de-duplicated verse-ID array (`ref` via `scripture-guide`
   `lookupReference`; explicit list used as-is).
2. If the array is a single contiguous run, canonical form is the **ref slug**
   produced by `generateReference()` then slugified: lowercase; spaces→`-`;
   `:`→`.`; verse ranges use `-`; drop commas. (e.g. `1 Nephi 3:2–4` → `1-nephi-3.2-4`.)
3. If non-contiguous, canonical form is the **`ids/` list**, ascending, `-`-joined.
4. Any request whose path is not already canonical responds **`301`** → canonical
   URL, with `Cache-Control: public, max-age=86400` so redirects are cheap. (301s are
   not written to S3; non-canonical URLs always fail over to Node — acceptable.)

Direction is deterministic: contiguous ⇒ ref slug; non-contiguous ⇒ ids list.

## 5. Render pipeline (shared)

1. Parse + validate URL (§6) → resolve selector → sorted verse-ID array.
2. Query `bom_xtras_fax_index` for `(version, verse_id in [...])`, grouped by page.
3. **Dedupe** near-identical boxes per (page, verse) with a small pixel tolerance
   (merge boxes whose corners are within ~2px). **Clamp negative** `TL*/BR*` to 0.
4. **Reading order (§5.3).** Group by page; within a page infer columns; order
   page → column → Y-asc.
5. **Clamp** to the first N pages (default 5, configurable) in reading order.
6. Fetch each needed source scan from S3 (`fax/pages/{version}/{nnn}.jpg`, page
   zero-filled to 3).
7. **Assert scan width (§5.5).**
8. Per page, compute the highlight region as a **rectangle set** (§5.4) and the
   selection-level outer notches (§7).
9. Compose per mode (§7), **stitch** fragments into one image (§8).
10. Downscale to `width` (never upscale), encode `jpg`/`webp`, stream out, async
    S3 write-back (§9).

### 5.3 Column-aware reading order (fixes the core bug)

`page → column → Y` — NOT `page → Y`. Within a page:

- Cluster boxes into columns by **X-start value gap detection** (sort by `X`; start
  a new column when the gap between consecutive `X` values exceeds a threshold, e.g.
  ~15% of `pageWidth`). Do **not** use a `pageWidth/2` midpoint — verified to
  misclassify `2013`/`34284` (right-column box at X=357 on a 1200px page).
- Order columns left→right by their min `X`; within a column order boxes by `Y` asc;
  concatenate columns.
- Verified correct on `34284`: left column (X≈56, Y=795) is emitted before right
  column (X≈357, Y=70/71), matching reading order even though the continuation has a
  smaller Y.
- The exact gap threshold is an **empirical parameter validated against golden
  assets** (§14), since single-column editions must resolve to one column.

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
- **Rate limit** on the render route (per-IP; Fastify plugin).
- Invalid input → `400`; nothing renderable → `404`.

## 7. Render modes

- **`page` (full-page dimmed):** render the full source scan; apply a dark overlay
  (default ~55% opacity black) everywhere **except** the highlight rectangle-set,
  which stays at full brightness. Output aspect = the page.
- **`crop`:** extract the union bounding box. **Paper-fill only the exterior notch
  corners** (start of first verse, end of last verse) — sampled from the page margin
  color (fallback near-white). Interior notches are left lit (§5.4). Output is a clean
  opaque rectangle.

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
  `Cache-Control: public, max-age=31536000, immutable` (mirroring `s3.ts:68-69`).
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

## 12. Legacy-compat alias (secondary goal — vetoable)

To reconnect the existing frontend without changes, serve
`fax/text/{version}/{slug}-{id}(.jpg)` as an alias:

- Resolve the reader **text-unit** `{slug}/{id}` → its verse-ID range via `bom_text`
  (the unit groups verses shown as one reader "page"), then feed those verse IDs into
  the shared pipeline with `mode=page`, `width=full`, `ext=jpg`.
- This matches the 2022 renders (full-page, page-shaped output).
- **Validate against the surviving golden asset** `fax/text/1837/ammon-132` (still
  serves 200) — geometric/visual parity check (§14).

If you'd rather **migrate the two frontend call sites** to the rich `/fax/render/...`
path instead of maintaining this alias, we drop this section. Recommended: keep the
alias (lowest risk, immediate win); frontend can migrate opt-in later.

## 13. Module layout

```
backend/src/media/fax/
  geometry.ts     # verse-IDs -> boxes -> dedupe/clamp -> columns/reading order -> union rects, clamping
  render.ts       # pure: rect-sets + source images -> composed Buffer (both modes, stitching)
  cache.ts        # FaxRenderCache seam (S3 write-back w/ retry, key derivation, inFlight coalescing)
  resolve.ts      # selector -> verse-IDs (ref via scripture-guide; ids list; legacy text-unit via bom_text)
  route.ts        # Fastify handler: validate -> resolve -> render -> stream -> write-back
```

`render.ts` stays pure (buffers in, buffer out) — unit-testable and Lambda-liftable.

## 14. Open validation items (do these FIRST in implementation)

1. **Notch sign convention** — which corner and direction `TLW/TLH` vs `BRW/BRH`
   encode; pixel-verify against a known verse before building crop paper-fill.
2. **Column gap threshold (§5.3)** — tune against multiple editions incl.
   single-column (must yield one column) and `2013`/`34284` (two columns); lock via test.
3. **Legacy text-unit resolution (§12)** — confirm the exact `bom_text` mapping from
   `{slug}/{id}` → verse-ID range; validate against golden `fax/text/1837/ammon-132`.
4. **Fax S3 bucket/host (§3)** — confirm whether fax assets share `S3_BUCKET` or need
   `FAX_S3_BUCKET`/`FAX_S3_PUBLIC_URL`.

## 15. Testing

- **`geometry.ts` units:** dedupe of near-identical rows (`34284`), negative-notch
  clamping (`36874`), column-aware reading order (`34284` — the exact case v1 got
  wrong), page clamping, 3-box verses.
- **`render.ts` units:** fixture scan + fixture boxes → snapshot output dimensions +
  targeted pixel checks for `page`, `crop`, and an N-up spread; interior-notch-not-
  paper-filled check.
- **Golden-parity test:** compare a render against the surviving 2022 asset
  `fax/text/1837/ammon-132` (free ground truth for highlight geometry).
- **Route:** param validation/whitelists, canonical `301` redirect (both directions),
  error codes, coalescing (concurrent cold requests → one render).
- **Perf/memory budget:** worst-case `1829` (~2500px scans) N-up spread stays within a
  set memory ceiling; concurrency semaphore enforced.

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
10. Legacy `fax/text` alias: recommended (vetoable, §12).
