# Home-sampler tile UI tweaks — handoff

**Date:** 2026-07-23
**Status:** ✅ All four implemented (2026-07-23) + a fifth (anchor-phrase gloss). See per-item notes below.
**Scope:** Four home-sampler tiles under `frontend/webapp/src/views/Home/tiles/`.
Styling lives in `frontend/webapp/src/views/Home/Sampler.css`.

### Completion summary (2026-07-23)
1. ✅ FaxVerseTile — text chip replaced with the per-edition `/fax/tabs/{version}` graphic, centered and resting on the crop's top edge.
2. ✅ FaxTile — page bar shows the full verse span (backend `pageRangeRef` builds a contiguous range, e.g. "Alma 45:14–23"); tile en-dashes it.
3. ✅ CommentaryTile — reference centered over the cover (`.commentaryTileRef` → `align-self/text-align: center`).
4. ✅ WitnessTile — restored to a **single featured witness** (large portrait + statement + source), confirmed with KC. The prior multi-row "ripples" list is gone. Note: no earlier "single" design existed in git history; target confirmed by KC directly.
5. ✅ (bonus) NotesTile anchor phrase — ~61% of notes carry the annotated phrase in `title`; the tile now leads the bubble with it (bold) and highlights it in the passage via a new `ScriptureExcerpt` `highlight` prop. Also: in-tile section-header refs now open the scripture popup (`refAsPopup`).

Verify visually against `http://localhost:8200` (or a local dev server) — **not**
`bom.kckern.net`, which serves a CDN-cached bundle (see CLAUDE.md).

---

## 1. Fax verse-level tile — replace text chips with per-edition tab images

**File:** `views/Home/tiles/FaxVerseTile.js` · **CSS:** `Sampler.css` `.faxVerseTile .faxEditionLabel` / `.faxEditionRow` / `.faxEditionCrop` (~L1755–1790)

**Current:** each edition row renders a text chip `<span className="faxEditionLabel">{ed.title || ed.version}</span>` (line ~59) above the cropped facsimile image (`.faxEditionCrop`).

**Wanted:** drop the text chip. Use the existing per-edition **tab image** instead:
`${assetUrl}/fax/tabs/${ed.version}` (same asset used in `views/Page/Narration.js:186,851`). Position it **centered horizontally** and **touching the top border of the verse-level crop image** (the tab sits on the crop's top edge).

**Notes:**
- `FaxVerseTile.js` currently imports `renderBaseUrl` from `src/models/BoMOnlineAPI`; add `assetUrl` from the same module for the tab src.
- Add an `onError` to hide the tab img if a version has no tab asset (mirror the existing `hideRow`/crop error handling, but hide just the tab, not the row).
- Acceptance: no text chips remain; each crop has its edition's tab graphic centered and flush against its top edge; layout still deep-links to `/fax/{version}/{slug}`.

## 2. Two-page facsimile tile — page reference should be the RANGE the page covers

**File:** `views/Home/tiles/FaxTile.js` (`.faxPageBarRef`, line ~44) · **Data:** `payload.faxPages[].ref`

**Current:** each of the two page thumbnails shows a single scripture ref (`p.ref`) — currently just the page's starting (or ending) verse, not the full span.

**Wanted:** show the **verse range covered by that page**, e.g. `Alma 26:1–30:4` rather than `Alma 26:1`.

**Notes:**
- `p.ref` is supplied by the backend home-sampler resolver (`backend/src/graphql/resolvers/homesampler.ts` — the `faxPages` field). The per-page range = first indexed verse → last indexed verse on that page in `bom_xtras_fax_index`. This is likely a **backend/data change** (compute & return a range string) plus the tile just rendering it.
- Keep the existing `openScripture(p.ref)` click behavior; if the ref becomes a range, confirm `openScripture` accepts a range (it may need the start ref, or the popup may handle ranges — verify).
- Use the en-dash range style already used elsewhere (`enDash` in `tiles/textUtils`).
- Acceptance: each page bar shows the true first→last verse span for that page.

## 3. Commentary tile — center the reference above a narrower cover

**File:** `views/Home/tiles/CommentaryTile.js` (`.commentaryTileRef` above `.commentaryTileCover` in `.commentaryTileAside`) · **CSS:** `Sampler.css` `.commentaryTile*`

**Current:** the scripture ref (`.commentaryTileRef`) sits above the source cover image in the right-hand aside column. When the cover is narrower than the ref text, the ref isn't centered over the cover.

**Wanted:** the reference should be **horizontally centered above the source cover image** when the cover is smaller in width than the ref.

**Notes:**
- Likely a CSS-only fix on `.commentaryTileAside` (e.g. `align-items: center` / `text-align: center` on the ref) so the ref centers over the cover rather than left-aligning to the column. Confirm it doesn't disturb the attribution/cue below.
- Acceptance: ref is centered over the cover for narrow covers; unchanged when cover ≥ ref width.

## 4. Witnesses tile — regression: "single" reverted to "ripples"

**File:** `views/Home/tiles/WitnessTile.js`

**Report (from KC):** "we used to have a single, it reverted to ripples." The current tile renders a **list** of witness rows (`.witnessList` → multiple `.witnessRow`, portrait + statement + source). KC recalls a **single**-witness (featured-one) design that has regressed to the multi-row / "ripples" variant.

**Wanted:** investigate the regression and restore the intended single-witness presentation.

**Notes:**
- Start with `git log --oneline -- frontend/webapp/src/views/Home/tiles/WitnessTile.js` (current tile landed in `499ee1b9 feat(home): reserve-tile balancing + art/witness/map/profile tiles`) and any Sampler.css `.witness*` history to find the "single" design and what replaced it.
- Clarify with KC what "single" vs "ripples" means visually before reworking (one highlighted witness with a large portrait? a single rotating statement?).
- Acceptance: TBD pending the above; confirm target design with KC.

---

## Not in scope here
The 1920 facsimile **geometry re-registration** (verse-level fax data) is a separate
workstream — see `docs/bugs/2026-07-23-fax-1920-wrong-source-scan.md`. Do not touch
the fax render API or `bom_xtras_fax_index` as part of these tile tweaks.
