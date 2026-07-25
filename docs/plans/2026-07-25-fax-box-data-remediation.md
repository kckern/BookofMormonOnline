# Fax box-data remediation — verse_id relabel for the European plate cluster

**Status:** Preparation (safety + tooling + approach). Not yet executing writes. Two decisions
need KC before any DB write (see *Open decisions*).
**Root cause:** `docs/bugs/2026-07-25-fax-box-verseid-mismapping-euro-editions.md`
**Target table:** `bom_xtras_fax_index` on `bom_prd` (production).

## Goal

For each affected edition, a modern verse reference must crop the **correct physical page**,
verified by the render-crop harness against the 1920 control.

## Scope

| Group | Editions | Fix |
|---|---|---|
| **A — plate cluster** | 1852, 1854, 1854l, 1866, 1871, 1874, 1877 | Relabel `verse_id`; one derived map, applied per-edition. Geometry (`page,X,Y,W,H`) kept. |
| **B — 1849** | 1849 | Same *kind* of relabel, but its own map (different 401-page layout). |
| **C — render 502** | rebom, poetic | **Separate** — `/fax/render` 502s on every crop; diagnose before any relabel. Also offset≠0. |

Groups are independent; ship A first (largest impact, best understood).

## Why this is a relabel, not a re-index

The `(page, X, Y, W, H)` regions are correct physical boxes on each edition's own scan (35 boxes
tile 1871 page 24 in monotonic Y, each tightly around a printed verse). Only the `verse_id` on each
region is wrong. So **do not touch geometry** — update only `verse_id`. This keeps the blast radius
to one column and preserves the per-scan coordinate fits (which differ across the cluster:
`pageWidth` 959–2136).

## Deriving the correct labels (the crux — needs a spike)

We need, for the shared cluster layout, the correct modern `verse_id` for each box (in `page`,`Y`
reading order). Options, cheapest-first:

1. **Sequential-order hypothesis (test first, ~1 spike).** The boxes are already in reading order
   and locally sequential. IF the box reading-order is 1:1 with the canonical verse sequence
   (no missing/extra boxes, count-per-page matches modern verses-per-page), then correct labels =
   canonical `verse_id`s assigned in strict reading order. Test on 3–4 pages: OCR/eyeball the true
   modern verses on a page, compare their count+order to the boxes, render-crop-validate. If it
   holds book-wide, the relabel is a single ordered re-assignment — cheap and clean.
2. **OCR alignment (robust fallback).** Install `tesseract`; OCR each of the 289 unique cluster
   pages once; fuzzy-match each line to the project's canonical text (`bom_text`, which has
   `verse_id`↔text) to get the true verse sequence per page; assign to boxes in Y-order. Authoritative
   but heavier. Needed if (1) fails (i.e., box count ≠ modern verse count on some pages).
3. **Old→modern concordance.** If a pre-1879→modern versification map exists in the project/data,
   use it to label from the printed old refs. Fastest if such a table exists — check first.

Whatever derives the map, it is expressed once for the shared cluster and written per-edition-row.

## Safety (done / required)

- **Backup (done):** `backend/scripts/fax-box-backup.mjs` dumped all 10 affected editions
  (67,835 rows) to `docs/audits/data-backups/fax-box-backup-2026-07-25.ndjson` (gitignored — real
  data). Re-runnable. Restore is a deliberate manual step, not automated.
- **Writes hit production for real.** `bom_prd` is production data; the writable user is `bom_app`.
  Note (memory `sandbox_mode_writes`): the sandbox only intercepts Kysely Insert/Update/Delete —
  raw `sql.raw` / a direct `mysql2` script bypasses it and writes for real regardless of `SANDBOX`.
  So the write script must be run **deliberately**, against a confirmed target, with the backup in
  hand.
- **Per-edition, transactional, reversible.** Update one edition at a time inside a transaction;
  after each, run the harness; if a spot-check regresses vs the pre-write render, roll back that
  edition from the NDJSON backup before proceeding.
- **Update only `verse_id`**, keyed by `uid` (PK). Never rewrite geometry columns.

## Validation harness

`backend/scripts/fax-groundtruth-check.mjs` — renders a verses×editions grid + `index.html`:

```bash
cd backend && node scripts/fax-groundtruth-check.mjs \
  --editions 1852,1854,1854l,1866,1871,1874,1877 --control 1920 \
  --verses 1-nephi-11.18,2-nephi-2.25,mosiah-3.19,alma-52.20,3-nephi-11.10,moroni-10.4 \
  --out /tmp/fax-gt
```

Acceptance: every cell shows the **same verse text** as the control column. Run once **before** any
write (baseline breakage) and after **each** edition's relabel (must now match control). Use ≥6
anchor verses spread across the book (the mismap is nonlinear — early verses can look right while
later ones are chapters off). Cross-check a few full-page renders too. (OCR auto-diff is a future
enhancement — tesseract not currently installed.)

## Phased rollout

1. **Spike** the derivation (option 1 first) on 3–4 cluster pages; confirm the correct-label map
   method against render ground truth. Decide option 1 vs 2 vs 3.
2. **Author the cluster map** and a `mysql2` write script (`verse_id` by `uid`, transactional,
   `--dry-run` default that prints the diff and executes nothing).
3. **Baseline** harness run → save `/tmp/fax-gt-before`.
4. Apply to **one** cluster edition (e.g. 1871); harness-validate; if good, apply to the other 6.
5. Rebuild/verify the derived faxIndex still matches (it's computed from `verse_id`), and re-run the
   DOM-overlay check (hotspots should now sit on correct pages, closing the index-drift loop for
   real on these editions).
6. Repeat for **1849** (own map). Diagnose **rebom/poetic** 502s separately.

## Open decisions (need KC)

1. **Production write authorization.** These are writes to `bom_prd`. Confirm go-ahead and timing
   (coordinate like any prod data change).
2. **Derivation source.** Is there an existing pre-1879→modern versification concordance in the
   project (option 3)? If yes, that's the fastest authoritative path. If not, proceed spike →
   option 1, fall back to OCR (option 2, needs `tesseract` installed).

## Not in scope here

The frontend index-drift fix (`…-index-drift.md`, done, branch `fix/fax-verse-highlight-index-drift`)
and the offset≠0 DOM-key bug (`…-offset-keying-mismatch.md`). This plan is purely the box **data**.
