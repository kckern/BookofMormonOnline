# 1920 facsimile highlights drift — wrong source-scan generation

**Date:** 2026-07-23
**Component:** `backend/src/media/fax/` (verse-level facsimile render API)
**Status:** Root cause confirmed; fix is a one-value config change (not applied — needs DB write from workspace/prod).

## Symptom

For the **1920** edition only, rendered verse-highlight boxes are systematically
loose: ~1–2 text-lines too tall with an upward bias, right edge overshooting the
column rule, and — worst case — the last fragment on a page drifting off the body
text entirely onto the footnote band (e.g. Alma 26:1 verse `34345`, page 268→file
260, landed on "BETWEEN B.C. 90 AND 77"). All other editions render tight (1879
Alma 26:1 is pixel-perfect).

## Root cause

The geometry is correct. The renderer fetches the **wrong source scan**.

- Coordinates in `bom_xtras_fax_index` are authored in a 700-wide space and mapped
  to scan pixels isotropically by `k = servedScanWidth / pageScale(700)`
  (`render.ts`). This is only correct if the served scan has the **same aspect
  ratio** as the scan the geometry was captured from.
- `imageScanMeta` (`resolve.ts:50`) reads the source format from
  `bom_xtras_fax.format`. For 1920 that column is **`png`**, so it serves
  `fax/pages/1920/{nnn}.png`.
- The served **PNG is a different scan generation**: **1484×2075, aspect 0.715**.
  But `bom_xtras_fax_index.pageWidth` for 1920 is a uniform **1200**. Mismatch.
- The **same folder** holds `fax/pages/1920/{nnn}.jpg` = **1200×1799, aspect
  0.667**, which matches the recorded `pageWidth=1200` exactly. It covers the full
  range (pages 001–530).
- Because the PNG's aspect (0.715) differs from the authoring scan's (0.667), the
  single isotropic scale factor mis-scales vertically, and the error **accumulates
  down the page** — mid-page verses are 1–2 lines off, bottom-of-page fragments
  land on footnotes.

### Evidence

| edition | recorded `pageWidth` | served scan (`format`) | match? | boxes |
|---|---|---|---|---|
| 1879 | 936 | 936×1488 (jpg) | ✓ | tight |
| 1981 | 1200 | 1200×1636 (png) | ✓ | tight |
| 2013 | 1200 | 1200×1800 (png) | ✓ | tight |
| **1920** | **1200** | **1484×2075 (png)** | **✗** | **drifts** |
| 1920 (jpg) | 1200 | **1200×1799 (jpg)** | ✓ | **pixel-tight** |

Overlaying the **identical** geometry on the 1200-wide JPG makes every sampled box
pixel-tight — including the two worst PNG cases (Alma 26:1 on footnotes →
perfect; Helaman 5:43 verse `35706` ~2 lines high → perfect).

### Ruled out

- **"Authored against a 1921/1923 printing"** — false. `fax/pages/1921/` exists
  (1700×2342) and `1923/` (1356×2093), and the DB lists separate `1921`/`1923`
  editions, but overlaying 1920 geometry on the 1921 scan is **worse** (box falls
  into the black scan border below the footnotes). Neither matches `pageWidth=1200`.
- **Offset / per-page remeasurement** — not needed for the fix. The correct source
  already exists; no coordinate math required.

## Why not just migrate the geometry onto the (higher-res) PNG?

The PNG is a newer, sharper re-scan (1484px bitonal vs 1200px grayscale), so it is
tempting to keep it and re-fit the boxes. Rejected — it is **not a pure aspect-ratio
scale**. Measured mapping of the printed text-block (ink-projection bounding box)
from JPG-space to PNG-space across 10 spread pages, per axis `png = s·x + c`:

| param | mean | sd | range |
|---|---|---|---|
| scale x | 1.076 | 0.020 | 1.03–1.12 |
| **offset x** | **+80 px** | 10.5 | 69–97 |
| scale y | 1.084 | 0.008 | 1.07–1.10 |
| **offset y** | **+65 px** | 15.7 | 45–92 |

- The PNG carries **real extra padding** (~80px left, ~65px top) a scaled JPG does
  not — a pure scale (offset 0) misplaces every box. The true scale is ~1.08, not
  the 1.237 width-ratio the renderer applies, so the code model is wrong on both
  scale and offset for the PNG.
- **Offsets are not constant page-to-page** (offset-y spans 45→92 ≈ 1.5–2 lines):
  scan-registration jitter. A single global affine lands ~0.5 line off at best and
  up to ~1 line off on the worst pages (empirically verified by rendering the
  global-fit transform on the PNG).
- Migrating would also require **rewriting all 7,453 rows** *and* a **renderer
  change** (add per-edition scale+offset — there is no offset term today).

The JPG needs none of that: geometry already renders pixel-tight, fix is one config
value. If the PNG's resolution is ever wanted, it needs **per-page registration**
(detect each page's text-block origin+scale, rewrite that page's boxes), not a
global transform.

## Chosen path: keep the sharp PNG via automated per-page re-registration

To retain the higher-res PNG, the geometry is re-registered onto it **per page**,
100% computationally (no LLM, no OCR). Method: for each verse box, the known-correct
JPG text patch is located in the PNG by **binary ink-overlap correlation**
(coarse-to-fine image-pyramid search); several boxes per page give correspondences,
and a **least-squares fit solves the per-page transform** (anisotropic scale sx/sy +
translation) — scale is measured, not assumed. Fit residual = per-page confidence;
pages that don't register are flagged and left unchanged, never silently rewritten.

A reusable tool for this (parameterized by version + ref/target scan) lives in the
**private workspace repo** (`scripts/`), since it needs DB creds and emits a
migration `UPDATE`. It reads geometry + both scan sets, writes an `UPDATE ... WHERE
uid=N` per box (pageWidth → target width; pageScale unchanged), a per-page report,
and validation overlays.

**Gotcha found during dev:** the stored `page` column is NOT the image-file number —
`imageFile = page + (pgfirstVerse − MIN(page))` (1920 = −8). Registration must fetch
`page + offset` for *both* ref and target; using `page` directly matches a scan
against itself on the wrong physical page and produces confident-but-wrong results.

Verified: with the offset applied, page 268 → file 260 (Alma 26) re-registers tight
on the PNG, including the Alma 26:1 box that originally drifted onto the footnotes.

**Full-edition result (all 522 pages):** 519 self-registered ≤10px, 1 weak (17px),
2 interpolated from neighbors, 0 left unchanged — **all 7,453 boxes updated**.
OK-page residuals: median 2.5px, p90 4.5px, max 7.9px (sub-line on a 1484px page).
sx/sy ≈ 1.07–1.08. Before/after spot-checks tight across the book (Alma 26/38, 3 Ne
21) and on all three review pages (p327/p487 interp, p523 weak).

Two tuning lessons for the reusable tool: (1) the initial content-scale estimate
`A0` must be sampled across pages spread through the edition — seeding it from the
first N (front-matter) pages biased it high and produced spurious 30–80px "gross
fail" residuals that vanished with a stable A0; (2) a neighbor-interpolation fallback
(scale ~global, translation drifts smoothly) recovers the handful of pages whose own
ink won't correlate, so coverage is 100% instead of ~90%.

**Staged output:** `<version>-reregister.sql` (one `UPDATE … WHERE uid=N` per box,
pageWidth → target width, pageScale unchanged, format stays png) + a per-page report.
Applying needs the workspace write DB user; read-only access only generates/stages it.

## Fix (one value)

Point 1920 at the JPG source. 1981/2013 are also `png` but their PNGs *are* the
correct 1200-wide scans, so leave them.

- **Preferred (data):** `UPDATE bom_xtras_fax SET format='' WHERE slug='1920';`
  (empty string → `.jpg` per `resolve.ts:60`). Run from the workspace repo /
  prod — read-only from the laptop.
- **Alt (code):** special-case `'1920' → 'jpg'` in `imageScanMeta` (`resolve.ts`).

## Follow-ups

- The §5.5 scan-width assertion (design spec) was meant to catch exactly this
  (`metadata.width !== pageWidth`), but the implementation only **warns and
  isotropically rescales**, which cannot correct an aspect/crop change. Consider
  hard-failing (or logging loudly) on a width mismatch so a future source swap is
  caught, not silently drifted.
- Audit the other `png` editions and any future edition adds by asserting served
  scan width == recorded `pageWidth` at ingest.

## Repro artifacts

Overlay script + renders produced during investigation (scratchpad, not committed):
`fax-overlay.mjs` — fetches a scan, scales DB boxes by `servedWidth/700`, draws
red rects. Compare `overlay-1920-*.png` (png, drifted) vs `overlay-JPG-*.png`
(jpg, tight).
