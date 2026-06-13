# Timeline grid — tabled data questions & discrepancies

**Date:** 2026-06-13
**Context:** Built the functional grid Timeline (placements + GraphQL labels). These are
known data gaps deferred for later resolution, not blockers for the working grid.
See `docs/plans/2026-06-13-timeline-grid-migration-design.md` and the reconciliation report
`docs/audits/2026-06-13-timeline-grid-reconciliation.md`.

## 1. Battle (💥) pairing is heuristic
- `💥` cells carry no name in the sheet, so each is paired to the **nearest matched named
  cell** and inherits that event's slug (per chosen strategy).
- **9 of 38** pairings are flagged `⚠️far` (Manhattan distance > 3) and are likely wrong —
  e.g. `r127 c34→moroni`, `r62 c16→ammon`, `r93 c34→nephite-recruits`.
- Consequence: battles point at a *nearby event*, not their own `bang.png` entry. The **32
  `bang.png` slugs remain unplaced** (they have their own headings/art/html we aren't using).
- **Resolution options:** annotate battle names in the sheet, or hand-map `💥`→`bang.png` slug
  in `overrides.json` (would need a battle-specific override channel).

## 2. Seven unmatched sheet cells
`Shiz`, `Lehi and Sariah`, `Waters of Mormon`, `East`, `West`, `Shilom`, `Reign of Judges`.
- `Waters of Mormon`, `Shilom` → exist in `labels.json` as **headless `p:false` place entries**;
  the matcher only considers entries with a `heading`. Quick fix: also match named cells
  against headless place entries.
- `East` / `West` → region band labels, no label entry. Probably belong as static grid chrome.
- `Shiz`, `Lehi and Sariah`, `Reign of Judges` → no corresponding `labels.json` entry; either
  add entries or accept as unlabeled.

## 3. 82 unplaced `labels.json` entries
The prototype sheet is **incomplete** — many real events (`captain-moroni`, `antionum`,
`cumorah`, `mulek`, the `lehite-voyage`/`mulekite-voyage`/`jaredite-voyage` ships, etc.) have
no cell yet. They will surface as the sheet is finished. (32 of the 82 are the `bang.png`
battles from item 1; 6 are duplicate-heading siblings from item 4.)

## 4. Duplicate headings — picked one, confirm
Several slugs share a heading; auto-match can't choose, so `overrides.json` picks one:
- `lehites` vs `lehite-family` (both "Lehi's Family") — chose `lehites` for the `Lehites` cell.
- `lamanite-recruits` vs `lamanite-recruits-2` (both "Lamanites Join Gadianton") — chose `-1`.
- `mulekites` ×2, `land-of-nephi` ×2 — still unplaced; need a cell-by-cell decision.

## 5. Override judgment calls
In `scripts/timeline-grid/overrides.json`, flagged under `_dup_heading_judgment_calls`:
- `52,28` `Amlicites / Amalekites` → chose `amalekites` (could be `amlicites` / `amlicite-battle`).
- `94,22` `Lamanite Recruits` → chose `lamanite-recruits`.
SKIPed (no label exists): `Jared`, `Sam`, `Lamanite Daughters`, `Lamanite Retreat`.

## 6. Colors: per-cell `fg` is unreliable
The spreadsheet's `s*` classes frequently set **text color == background color** (invisible
text — the label rode on a merged cell). The component **derives black/white contrast** from
the background instead of trusting `fg`. Open: confirm the lineage→color semantics
(greens/blues/reds/golds) we want long-term, rather than mirroring raw sheet colors.

## 7. Places are non-interactive
`p:false` place entries have no `text.slug`, so place cells render as labels only (no link).
Confirm that's desired (vs. linking places to a region/landing page).

## 8. Rounded corners — RESOLVED (tile model)
The `◜◝◟◞` glyphs are per-tile corner-rounding instructions on the color-fill bands
(`◗ = ◝+◞`, `◣ = bl`). `build_tiles.py` emits `rd:['tl',...]` per tile and the component
applies `border-radius`. Verified against the `Sheet1.html` render. Open sub-item: the rare
`◂` (1×) is treated as a continuation arrow / plain fill — confirm that's right.

## 9. World-history track excluded (by scope)
Cols 1–2 of `Sheet1.html` and all of `Sheet2.html` (Egypt/Assyria/Babylon/Persia/Greece) are
out of v1 scope and were filtered out. Future: a parallel secular band needs its own data
source.
