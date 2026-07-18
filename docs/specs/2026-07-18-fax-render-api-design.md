# Dynamic Facsimile-Highlight Render API — Design Spec

**Date:** 2026-07-18
**Status:** Approved design, pending implementation plan
**Author:** Claude (brainstormed with KC)

## 1. Background & motivation

Facsimile highlight images (e.g. `https://media.bookofmormon.online/fax/text/1837/ammon-132`)
show a scanned page of a historical Book of Mormon edition with a specific verse
passage highlighted. They are consumed by the frontend as plain `<img src>` /
CSS `background-image` URLs (`Narration.js`, `StudyInFeed.js`).

**Current reality (confirmed during design):**

- `media.bookofmormon.online` is **static S3 behind CloudFront** (Cloudflare in
  front). A request for a non-existent ref returns an S3 `NoSuchKey` XML error
  naming the key `fax/text/{version}/{ref}.jpg`.
- The highlight JPEGs are a **frozen, partial set** batch-generated **once in 2022**
  by a PHP/GD script on the old media box. That generator is **long deprecated /
  gone**. There is no live generation tier today.
- Source page scans live on the same S3, keyed `fax/pages/{version}/{nnn}.jpg`
  (3-digit zero-fill; `011` works, `11` 404s). Thumbnails at
  `fax/thumb/{version}/{nnn}.jpg`.

**Goal:** build the dynamic generation tier that no longer exists — an in-codebase
API that renders facsimile highlights on demand from the `bom_xtras_fax_index`
geometry, with two render modes, multi-page/column stitching, size guardrails,
a `maxWidth` parameter for thumbnails, a caching seam, and S3-backed persistence
that never blocks the response on S3 latency.

## 2. Data model (existing)

Table `bom_xtras_fax_index` — one row = the pixel bounding box of one verse on one
page of one edition. 92,839 rows across 13 editions × 6,604 verses.

| column | meaning |
|---|---|
| `version` | edition slug (`1829`, `1830`, `1837`, `1840`, `1841`, `1879`, `1920`, `1981`, `2013`, `earliest`, `poetic`, `printer`, `rebom`) |
| `verse_id` | global verse id (string) |
| `page` | zero-filled 3-digit page number of the scan |
| `pageWidth` | pixel width of that page's scan |
| `pageScale` | legacy constant (700 everywhere) — **ignored** by this design |
| `X, Y, W, H` | verse bounding box: top-left corner + width/height |
| `TLW, TLH` | top-left notch inset (verse starts mid-line) |
| `BRW, BRH` | bottom-right notch remainder (verse ends mid-line) |

**Confirmed coordinate space:** source scan `fax/pages/1837/011.jpg` is 756×1372
and its stored `pageWidth` is 756 — i.e. `X/Y/W/H` are in **native source-scan
pixels** and map 1:1 onto the page image (no scaling needed). Verified by cropping
a verse box from the native scan: it landed cleanly on complete lines of text.

A verse may have **multiple rows** when its text spans a **column break** (same
page, modern two-column editions) or a **page break** (single-column historical
editions). ~400–850 verses per edition have a second box.

## 3. Architecture

- A **pure, portable render module** in `backend/src/media/fax/` plus a thin
  **Express route**.
- All cache **hits** are served by CloudFront→S3 statically — Node never sees them.
- On a **miss** (S3 `NoSuchKey`), CloudFront falls through to the Node route
  (custom-error / second origin). Node renders, streams the bytes back (CloudFront
  caches the response immediately), and **asynchronously** writes the encoded image
  to S3 at the exact key so all future requests are static hits.
- The CloudFront error-origin wiring is a **later infra step**; the route works
  standalone in the meantime (direct request → generate → stream + write-back).
- The render core stays **pure** (buffers/geometry in, buffer out) so it is
  unit-testable and could be lifted into a Lambda later if edge scaling ever
  matters. No lock-in.

**Why in-codebase over Lambda@Edge (decision record):** generation is
write-once-then-static, so the generator only handles cold misses — low volume,
latency-insensitive. Edge compute is for hot paths. Lambda would add `sharp`
binary packaging, a Lambda→remote-MySQL VPC/pooling story, and a separate deploy
pipeline — cost with no matching benefit here. The in-repo path reuses existing
`sharp` (0.33.5), `backend/src/media/s3.ts` (S3 + CloudFront invalidation),
Kysely DB access, and Infisical secrets.

## 4. HTTP contract — the URL *is* the cache key

The path is fully self-describing so the CDN-miss origin can regenerate from the
URL alone:

```
/fax/render/{version}/{mode}/w{width}/{selector}.{ext}
```

- `version` — edition slug.
- `mode` — `page` (full-page dimmed) or `crop`.
- `width` — max output width in px (e.g. `w600`), or `full`.
- `selector` — canonical scripture-ref slug (e.g. `1-nephi-3.2-4`) **or**
  `ids/31103-31104-31108` for non-contiguous verse arrays.
- `ext` — `jpg` (default) or `webp`.

**Input resolution:** a `ref` string resolves via `scripture-guide`
`lookupReference` → verse-ID array; an explicit list is used as-is. Both converge
on a sorted verse-ID array, then canonicalize via `generateReference()` so
different spellings dedupe to one cache key. Non-canonical requests respond
`301` → canonical URL.

**Consumption:** the endpoint responds with image bytes (or 301 to canonical), so
it is a drop-in `<img src>` URL. It never returns JSON.

## 5. Render pipeline (shared)

1. Parse URL → resolve selector → sorted verse-ID array.
2. Query `bom_xtras_fax_index` for `(version, verse_id)` rows → boxes, grouped by
   `page`, ordered in reading order (page asc, then Y asc).
3. **Clamp** to the first N pages (default 5, configurable). Set response header
   `X-Fax-Clamped: true` if truncated. Never errors on size.
4. Fetch each needed source scan from S3 (`fax/pages/{version}/{nnn}.jpg`).
5. Per page, compute the **union region** of the selected verses' boxes, honoring
   the `TL*`/`BR*` notch geometry.
6. Compose per mode (§6), **stitch** multi-page/column fragments into one image (§7).
7. Downscale to `width` (never upscale), encode `jpg`/`webp`, stream out, then
   async S3 write-back.

## 6. Render modes

- **`page` (full-page dimmed):** render the full source scan, apply a dark overlay
  (default ~55% opacity black) everywhere **except** the highlight polygon, which
  stays at full brightness. Output aspect ratio = the page.
- **`crop`:** extract the union bounding box. The notch corners (where the verse
  starts/ends mid-line) are **paper-filled** — filled with a solid color sampled
  from the page's margin (fallback near-white) so the output is a clean opaque
  rectangle with neighboring verses' text erased. No transparency.

Default output format is **JPEG** (fastest to encode, universally safe, matches
existing assets and source scans). `format`/`ext` may select `webp` for smaller
thumbnails (paid once at generation since output is then static).

## 7. Spanning → one stitched image

- **`crop`:** fragments stacked **top-to-bottom** into a continuous ribbon in
  reading order (column break first, then page break).
- **`page`:** the touched pages placed **side-by-side as a 2-up spread**, each
  independently dimmed except its own fragment, with a small gutter between.

## 8. Limits & guardrails

- Clamp to the first **N pages** (default 5, configurable). Output is silently
  truncated to those pages; `X-Fax-Clamped: true` header signals it.
- A hard path-length ceiling on the `ids/...` selector form is the backstop for
  absurd inputs.

## 9. Caching & S3

- **Cache key = the URL path.** S3 key:
  `fax/render/{version}/{mode}/w{width}/{selector}.{ext}`.
- **Async write-back:** fire-and-forget `PUT` after the response is sent — the
  response never blocks on the S3 PUT. CloudFront caches the response immediately;
  S3 is the durable tier behind it.
- **Cache seam:** a thin `FaxRenderCache` interface (`keyFor`, `writeBack`, and a
  future `read`/`exists`) is the placeholder. Today it is S3-only; a Redis or
  in-process memory tier can slot in later without touching the route.
- **Sandbox:** when `ctx.sandbox` is set, skip the S3 write-back (per existing
  convention in `backend/src/media/s3.ts`) but still serve the generated bytes.

## 10. Module layout

```
backend/src/media/fax/
  geometry.ts     # verse-IDs -> boxes -> union regions, clamping, reading order
  render.ts       # pure: boxes + source images -> composed Buffer (both modes, stitching)
  cache.ts        # FaxRenderCache seam (S3 write-back, key derivation)
  route.ts        # Express handler: parse URL -> resolve -> render -> stream -> write-back
```

`render.ts` stays pure (buffers in, buffer out) — unit-testable and Lambda-liftable.

## 11. Error handling

- Unknown version or verse with no box row → skip missing boxes.
- Empty result (no boxes at all) → `404`.
- Malformed params → `400`.
- Source-scan fetch failure → `502`.
- Sandbox mode → serve bytes, skip S3 write-back.

## 12. Testing

- Unit-test `geometry.ts`: union math, page clamping, reading-order sorting, and
  the spanning (column-break, page-break) grouping.
- Unit-test `render.ts` with a fixture scan + fixture boxes → snapshot output
  dimensions and targeted pixel checks for both modes and a 2-up spread.
- Route test: param parsing, canonical `301` redirect, `X-Fax-Clamped` header,
  and error codes.

## 13. Open validation item (first implementation step)

The exact **notch direction/sign convention** encoded by `TLW/TLH` (top-left) and
`BRW/BRH` (bottom-right) is inferred but not yet pixel-verified. The first
implementation step is a visual fixture test against a known spanning verse to
lock the convention before building the paper-fill masking in `crop` mode.

## 14. Decisions locked during brainstorming

1. **Source images:** page scans already on S3, fronted by `media.bookofmormon.online`.
2. **Where it lives:** in-codebase portable generator in `backend/`, CloudFront
   serves S3 hits and falls through to Node on miss.
3. **Spanning:** stitch into one image (crop = vertical ribbon; page = 2-up spread).
4. **Crop notch corners:** paper-fill (opaque), not transparent.
5. **Format:** JPEG default, optional `webp`.
6. **Size limit:** clamp to first N pages (default ~5), never error; `X-Fax-Clamped`
   header.
7. **Caching:** async write-back + thin cache-interface seam (no Redis/memory tier yet).
8. **Coordinate space:** `X/Y/W/H` are native source-scan pixels (verified);
   `pageScale` ignored.
