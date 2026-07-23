# Witnesses feature — data & placement audit

**Date:** 2026-07-17
**Scope:** `frontend/webapp/src/views/History/Witnesses.js`, `WitnessLifeHeatmap.js`, and the backend `history(archive:"witnesses")` data path.
**Trigger:** "audit our witness history data and its placement" + "cards should lead with the money quote; data model seems off."

## Data flow (as-built)

- **Source documents** live in MySQL `bom_xtras_history` (444 rows with `archive = 'witnesses'`).
  Served via GraphQL `history(archive, principal)` → `backend/src/data/loaders/searchhist.ts:387-410`.
  Matching is **exact `WHERE principal IN (...)`** — no fuzzy/substring match.
- **Witness biographical data** (birthday, deathday, excommunication, group, `principalNames`)
  is **hardcoded in the frontend** at `Witnesses.js:11-37`. Nothing on the backend.
- The two halves are joined only by the fragile `principal` string.

## Findings

### 1. Money quote was hidden (FIXED 2026-07-17)
- 405/444 docs (91%) have `money_quote`; 100% have `teaser`.
- The card rendered `money_quote` as an `opacity:0` overlay on the thumbnail, revealed only on
  hover (`Witnesses.js` card block + `.css` `.thumb_money_quote`). The testimony — the whole point —
  was invisible by default.
- **Fix applied:** card now leads with the quote (serif, bordered blockquote + attribution),
  followed by source·date meta, document title, thumbnail, citation. Teaser is the fallback for
  the 9% with no quote.

### 2. `principal` column is overloaded (needs backend/data decision)
One column does three incompatible jobs:
1. **Witness grouping key** — `David Whitmer` (137), `Martin Harris` (80), etc.
2. **Group label** — `Three Witnesses`, `Eight Witnesses`, `Four Witnesses`.
3. **Quoted speaker inside another witness's account** — `Deacon Jessup`, `Mr. Huzzy`, `Moroni`,
   `Doctor Mcintyre`, `Luman Walters`. These are really `witness_label` values (recorded by Lucy
   Mack Smith), mis-filed as grouping keys.

Because grouping + attribution share one field, documents are unreachable:

| Problem | Docs |
|---|---|
| `principal` is NULL → no witness page can ever query them | 7 |
| `Joseph Smith, Jr.` — no witness card exists for the translator | 15 |
| Other orphaned principals with no card (Moroni, Luke Johnson, John C. Whitmer, Herbert S. Salisbury, Elizabeth Ann Whitmer Cowdery, Jane Manning James, Sarah Fowler Anderick, …) | ~15 |
| `william-hussey-azel-vandruver` card has `principalNames: []` → renders nothing, while a `Mr. Huzzy` doc exists | 1 orphaned |

### 3. Frontend biographical data quality nits
- `josiah-stoal` (name "Josiah Stoal") maps to principal `Josiah Stowell` — spelling split between
  slug/name and data.
- Year-only birthdays (`"1800"`, `"1771"`) for Hiram Page, Josiah Stoal, Hussey/Vandruver, Willard
  Chase feed `moment(w.birthday)` directly in the age calc (grid) → moment deprecation path.
- Willard Chase `deathday: "1871-01-01"` looks like a Jan-1 placeholder.
- Hussey/Vandruver has no `deathday` and empty `principalNames`.

### 4. Structural nits
- `data[group].sort(...)` mutates the module-level constant on every render (side effect in render).
- Hardcoded witness-event date `1829-06-28` duplicated between `Witnesses.js` (`dateofWitness`) and
  `SingleWitness` (`witnessAge`).
- Landing page has a dangling empty `<h4>Witness Statements</h4>` under other-witnesses
  (`Witnesses.js` other-witnesses block) with no content below it.

## Recommended next steps (need decisions)
1. **Split `principal`** into a grouping key (`witness_slug` / page owner) vs. the existing
   `witness_label`/`reporter_label` attribution fields. Backfill the 7 NULLs.
2. **Add a `Joseph Smith, Jr.` witness page** (15 orphaned docs) or deliberately route them elsewhere.
3. **Fix Hussey/Vandruver** — decide whether `Mr. Huzzy` == William T. Hussey and set `principalNames`
   accordingly; confirm Azel Vandruver has (or lacks) any source.
4. **Move biographical data** to a shared source (backend table or a committed data module) keyed to
   the same grouping key, so grouping/attribution/bios stop drifting.
