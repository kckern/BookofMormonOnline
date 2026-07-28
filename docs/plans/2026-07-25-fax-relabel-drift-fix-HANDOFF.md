# Fax verse-label drift fix + gap-fill — HANDOFF

**Date:** 2026-07-25
**Status:** Root cause found & fixed. 1852 seed re-labeled and gap-filled to **91.7% coverage, 0 drift**
(applied to prod & verified against the 1920 control). Cluster + other editions NOT yet re-run through
the new pipeline. This doc is the pick-up point.
**Authorization on record:** KC approved prod writes limited to `bom_xtras_fax*` tables. $50 Gemini
credit topped up 2026-07-25 (was depleted; now live).

All scripts live in the **private** repo `~/Documents/GitHub/BoMOnlineWorkspace/scripts/`. Output SQL in
`scripts/out/families/`. Read alongside `docs/plans/2026-07-25-fax-box-data-remediation-HANDOFF.md`
(the box-data problem this fixes — see its ⚠️ CORRECTION header).

---

## 1. Root cause (settled — do not re-derive)

The European-cluster verse highlights were mislabeled by a **nonlinear drift** (~51 verses off in
1 Nephi, flipping sign by Alma). **It was NOT Gemini and NOT the geometry.** Gemini's per-line OCR is
correct; geometry framed the right regions. The bug was in the **labeling step** (`fax-ocr-index.mjs`
Phase B): a *stateful cursor* using a 35-verse peephole `[cursor, cursor+35]` that advanced by "last
verse anchored on this page." Any page that anchored short/long mis-placed the cursor, and every later
page inherited the error → accumulation. It hit 8/8 on 1842 (clean prose) but drifted on the numbered
old-versification cluster.

## 2. The fix (DONE, shipped)

**`scripts/fax-relabel-global.mjs`** — a STATELESS re-labeler. Each page is located *independently* in
the full BoM word stream (distinctive-word offset vote → windowed LCS anchor → verse-boundary
interpolation). No cross-page state ⇒ drift impossible by construction. Reports page-order
monotonicity (inversions) as a drift self-check — currently **0**. Computational, zero Gemini calls
(reads the OCR disk cache). Emits scoped `DELETE ... WHERE version=X` + `INSERT`.

Verified on the scans: 1852 page 24 → 31400 (1 Ne 13:10, was the wrong 31349); 31349 → page 20;
35177 (Alma 52:20) → page 355; 37706 (Moroni 10:34) → page 563. **1852 confirmed book-wide vs the
1920 control.**

## 3. Two OCR bugs also fixed in `fax-ocr-index.mjs` (durable — help every edition)

Both were behind the ~148 "empty" pages/edition that capped coverage:
1. **PNG-as-JPEG:** `ocrPage` hardcoded `mimeType:'image/jpeg'`; PNG editions (1849/1852/1871/1874/
   1877/1854) intermittently returned empty. Now auto-detects from the PNG magic bytes (`0x89 0x50`).
2. **Empty-result cache poisoning:** an empty `[]` (transient 429 exhaustion) was cached and never
   retried. Now **only non-empty results are cached**; retries bumped 6→10. So re-running the gap-fill
   converges.

Downside to know: with 10 retries + no-empty-cache, *genuinely blank* back-matter pages (>~520) spin
10× before giving up — kill the tail or ignore; they hold no verses.

## 4. Gap-fill tool + procedure

**`scripts/out/families/fill-gaps.sh <version> [concurrency]`** — finds empty-`lines` cache files,
deletes them (so they retry), re-OCRs *only* those pages. Convergence pattern that worked for 1852:
concurrency 5 → 3 → 2 (lower conc = fewer 429s). 1852 went 63% → 77% → 89% → 91.7%; all mid-book
(pages 19–519) content pages now OCR'd, cost ~$1 total by the tracker (**the tracker uses text rates
and undercounts image calls a few×** — do NOT quote it as authoritative; real spend is still small).

## 5. WHERE IT STANDS

| Edition | OCR cache | Re-labeled? | Coverage | In prod? |
|---|---|---|---|---|
| **1852** (cluster seed) | complete (mid: 0 empty) | ✅ `1852-relabeled.sql` | 91.7%, 0 drift | ✅ applied & verified |
| 1854, 1854l, 1866, 1871, 1874, 1877 | no own OCR (derive from seed) | ❌ still OLD drifted data | — | ❌ stale (1871 Alma 52:20 still wrong) |
| 1849 (standalone) | ~148 empty pages remain | partial (`1849-relabeled.sql`, ~74%) | needs gap-fill + re-relabel | ❌ |
| 1842 | ~189 empty pages | was believed OK; has gaps | verify | prod has old |
| 1858, 1899, 1902 | partial OCR | ❌ | needs gap-fill | ❌ |

Residual for 1852's missing ~8%: scattered short/edge verses dropped off labeled pages' anchor spans,
plus ~8 hard full pages that fail the ≥3-anchor gate. Not OCR gaps — matcher conservatism. Optional
recovery: a neighbour-seeded second pass (bound a failed page's window by its confirmed neighbours'
vids, then LCS — still no drift). Not yet built.

## 6. NEXT STEPS (in order)

1. **Snap + finalize 1852** (geometry quality — the relabel emits raw `verseGeom`, which cuts ink):
   `node scripts/fax-geometry-snap.mjs --version 1852 --sql out/families/1852-relabeled.sql --out out/families/1852-snapped.sql`
   then `node scripts/fax-remediate-finalize.mjs --version 1852 --sql out/families/1852-snapped.sql --out out/families/1852-remediated.sql`
   Gate with `fax-geometry-audit.mjs` (dark-spike ≤3%). Then load `1852-remediated.sql`.
2. **Re-register the cluster from the completed 1852 seed** (fixes 1871 etc., computational, no Gemini):
   `zsh scripts/out/families/reregister-cluster.sh` — it reads `1852-relabeled.sql` as `--seed-sql`,
   ink-fits each member (1854/1854l/1866/1871/1874/1877) to its own scans, emits `<ed>-relabeled.sql`.
   Formats: 1854l & 1866 are jpg, the rest png (already encoded in the script). Then snap+finalize each
   member against its OWN scans, then load.
3. **Gap-fill + re-relabel 1849**, then snap+finalize+load. Then 1842, 1858, 1899, 1902 likewise.
   Run gap-fills **sequentially** (not parallel) to avoid re-triggering the 429 throttle.
4. After each load, sanity-check with the prod agent's render-crop harness
   (`backend/scripts/fax-groundtruth-check.mjs`) — the label↔content gate (geometry audits do NOT
   catch mislabels).

## 7. Gotchas / environment

- DB read: `node cli/db.mjs --json "SELECT ..."` (reader). Writes hit prod for real.
- Prod currently holds MY 1852 relabel (per-edition counts already differ from the old shared set).
- Applying replaces *dense-but-wrong* with *sparse-but-correct*: verses on not-yet-covered pages lose
  their highlight until re-OCR. KC's explicit rule: **do not fabricate/gap-fill geometry** — real OCR
  boxes only, leave empty pages empty.
- Relabel self-check: `node scripts/fax-relabel-global.mjs --version X --check 20,24,326` prints the
  verse range assigned per page (dry run, no emit).
- Thresholds now in `labelPage`: vote len≥5, `best≥2`, anchor gate `≥3`. Loosening further risks
  mislabels — always confirm `0 inversions` and spot-check known anchors (1 Ne 13:10, Alma 52:20,
  Moroni 10:34) after any change.
