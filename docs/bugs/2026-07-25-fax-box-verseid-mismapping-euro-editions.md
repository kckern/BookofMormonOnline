# Fax box data: wrong verse_id labels on geometrically-correct boxes (European plate cluster + 1849)

**Date:** 2026-07-25
**Status:** Root cause confirmed (live render + DB forensics). No data fix applied yet — see
`docs/plans/2026-07-25-fax-box-data-remediation.md`.
**Table:** `bom_xtras_fax_index` (columns: `uid, version, verse_id, page, pageWidth, pageScale, X, Y, W, H, TLW, TLH, BRW, BRH`)
**Surfaced by:** the render-crop exit criterion during verification of
`docs/bugs/2026-07-25-fax-verse-highlights-index-drift.md`. **This is a separate, deeper bug** —
the index-drift fix is about the frontend DOM-overlay join; this is about the underlying box data.

## Symptom

For a set of editions, rendering a known verse crops the **wrong physical page** — a different
chapter entirely. Ground-truth spot-checks (control = 1920, which is correct):

| Ref (verse_id) | 1920 control shows | 1871/1877/1852 show | verdict |
|---|---|---|---|
| Alma 52:20 (35177) | "…embassies… city of Mulek… Jacob… Zoramite" | modern Alma 43:22-24 ("…land of Manti… Moroni sent spies…") | ❌ wrong page |
| 1 Nephi 11:18 (31349) | "…the virgin… mother of the Son of God" | modern 1 Nephi 13:12 (old "CHAP. III:35", "…I looked and beheld many waters…") | ❌ wrong page |

## Affected editions

- **Shared-plate European cluster (7):** `1852, 1854, 1854l, 1866, 1871, 1874, 1877`. All carry
  the same verse→page structure: **6740 rows, 289 distinct pages, image pages 1–453** (1874/1877
  differ by a handful of rows). These are stereotype-plate reprints — page 24 is textually
  identical across them (verse "35 … many waters" in the same slot), only the scan images differ.
- **1849 (separate):** a *different* wrong dataset — 6840 rows, 401 pages, 1–549. Also renders
  wrong pages, but not the cluster's map.
- **rebom, poetic:** render **502** on every crop (a distinct render failure — not this mislabel;
  investigate separately). Both also have offset≠0 (−26, −47).

Editions rendering the **correct** page (control set): `1830, 1837, 1842, 1920` and the other
post-1879 editions.

## Root cause: correct box geometry, wrong verse_id labels

The boxes are **geometrically sound** — on 1871 physical page 24 there are 35 boxes with
monotonically increasing `Y` (102→903) and sensible heights, tiling the real printed page
top-to-bottom; the render shows each box tightly surrounding a real printed verse region. So the
`(page, X, Y, W, H)` tuple is a **correct physical region** on each edition's own scan (coordinates
are independently fit per scan — `pageWidth` varies 959–2136, `pageScale` 700).

What's wrong is the **`verse_id` attached to each region.** The box tiling page 24's real content
(old "CHAP. III:35" = modern 1 Nephi 13:12) is labeled `verse_id 31349` (= modern 1 Nephi 11:18).
The labels are a shared, wrong sequence across all 7 plate-mates (same physical verse in the same
page slot → same wrong id on every edition).

The mismatch is **nonlinear** — 1 Nephi 11:18 resolves ~2 chapters late, Alma 52:20 ~9 chapters
early; some verses land about right, others chapters off. This is the signature of **modern
verse_ids assigned in sequence over old-versification verse regions**: pre-1879 editions use the
old long chapters/verses, which don't align 1:1 with the modern versification, so a running
verse_id counter desynchronizes as it accumulates old/modern boundary differences.

Because the faxIndex (min/max verse per page) is *derived* from these `verse_id` labels, the index
is wrong in lockstep — which is why the earlier DOM-overlay check (hotspot count, `pageReference`)
looked internally consistent while being ground-truth wrong.

## Evidence / how to reproduce

- Render crops: `GET {backend:5006}/fax/render/{version}/crop/w800/{selector}.jpg`
  (e.g. `.../1871/crop/w800/alma-52.20.jpg` vs `.../1920/crop/w800/alma-52.20.jpg`). Full-page:
  `.../page/w800/...`. `:8200` does NOT proxy `/fax/render` — hit the backend `:5006` directly.
- Harness: `backend/scripts/fax-groundtruth-check.mjs` renders a verses×editions grid + `index.html`.
- DB forensics (read-only reader, raw SELECT — sandbox N/A): `backend/scripts/sql-cli.mjs`.
  - Shared signature: `SELECT version, COUNT(DISTINCT page), MIN(page), MAX(page), COUNT(*) FROM bom_xtras_fax_index GROUP BY version` → the 7 cluster editions all read `289 / 1 / 453`.
  - Geometry sanity: `SELECT verse_id, Y, H FROM bom_xtras_fax_index WHERE version='1871' AND page=24 ORDER BY Y` → 35 boxes, monotonic Y.
  - Per-scan coords: `SELECT version, page, X, Y, W, H, pageWidth FROM bom_xtras_fax_index WHERE verse_id='31349' AND version IN (...)` → same page 24, different X/Y/W/H per scan.
- Backup of all affected rows (67,835 rows, 10 editions) at
  `docs/audits/data-backups/fax-box-backup-2026-07-25.ndjson` (gitignored — real data).

## Fix direction (see the remediation plan)

Because geometry is correct and only labels are wrong, the fix is a **`verse_id` relabel** — the
existing `(page, X, Y, W, H)` regions are kept; each box's `verse_id` is corrected to the modern
verse actually printed at that region. Since the 7 cluster editions share the verse→page structure,
**one correction map covers all 7** (applied per-edition-row, keyed by the shared structure). Derive
correct labels from the actual page content (OCR alignment of the shared 289-page layout, and/or an
old→modern versification concordance), and validate per-edition with the render-crop harness.
`1849` needs its own map (different layout); `rebom`/`poetic` 502s are a separate render issue.

**Do not confuse with** `2026-07-25-fax-verse-highlights-index-drift.md` (frontend join, fixed) or
`2026-07-25-fax-boxes-offset-keying-mismatch.md` (offset≠0 DOM key, separate). This one is box data.
