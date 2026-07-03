# Timeline Grid — Design/Rendering Audit vs. Reference Bitmap

**Date:** 2026-07-01
**Scope:** `/timeline` CSS-grid rebuild vs. the original hand-drawn bitmap timeline (the design-language reference).
**Goal (KC):** locally working `/timeline` in parity with the reference screenshots, with adversarial agents signing off on design system, layout, presentation, and data completion.

The theme change (parchment canvas, gold sword-medallions instead of white starbursts) is deliberate and NOT a defect. Everything below is about design **grammar** parity: fades, corners, icon placement/scale, label hierarchy, data coverage.

---

## Root causes (why it looked "thrown together")

The design-system vocabulary exists in code but the **data barely used it**:

1. **All 7 defection/join gradient bars were authored as 1×1 cells** (`lamanite-recruits`, `nephite-recruits`, `zoramite-defection`, `nephite-defectors`, `amalekites`, `people-of-alma`, `ammon-and-the-people-of-limhi`). A 26×20 px cell with a full linear gradient + stadium corner caps renders as a tiny elliptical **blob** floating on the bar — the "what are you trying to achieve with these fades" screenshots. The reference renders these as long bars, solid origin color, dissolving into the destination over the arrival tail.
2. **Zero `bevel` tiles authored** in the whole canvas (the vocabulary supports diagonals) → every diagonal transition in the reference rendered as square stair-steps.
3. **One `fade` tile and 5 `grad` tiles in a 3,068-tile canvas** — the reference uses long soft dissolves everywhere (band succession, record-end fades).
4. **`barPaint` rendered a full-length 50/50 gradient** instead of the reference grammar (solid ~55%, dissolve over the tail).
5. **Battle icons all identical 1-cell size** — the reference scales the starburst to the event's weight (Cumorah is huge); the final battle was 4 (+1) scattered coins instead of one large icon.
6. **Per-cell hairline outline on the light "After Christ" band** (`.tg-fill[data-lin='fff2cc'] box-shadow`) — because the band is authored as many 1×1 tiles, each cell got its own outline → the "railroad tracks."
7. **Placement/data errors** — e.g. `convert-massacre` ("Convert Massacre in Ammonihah") placed at col 2 (deep Lamanite territory, far left) when Ammonihah content lives at col ~31; oversized text label instead of an icon.
8. **Canvas holes** — the Pahoran-in-Zarahemla ring (rows 71–76) missing interior/side cells → parchment holes punched in the ring.
9. **Row collisions** — e.g. `zoramite-defection` and `zerahemnah` both on row 65 (reference puts them on adjacent rows).
10. **Labels on gradient regions painted solid chips** ("Jesus Christ", "Twelve Disciples", "People of Christ", "Lamanite Remnant") → gray boxes on the dissolve instead of floating text.
11. **Band-hover dimming** on area fills (KC: hover belongs to labels only).

## Fixed in this pass (commit pending)

| Fix | Where |
|---|---|
| Removed band-hover dimming + hover statusbar; hover affordances now only on labels | `Timeline.css`, `Timeline.js` |
| Removed per-cell railroad outline on `fff2cc` band | `Timeline.css` |
| `barPaint`: solid origin 0–55%, dissolve to destination by 100% | `timelineModel.js` (+tests) |
| Markers carry `colSpan`/`rowSpan`; medallion scales to spanned area (`markerIconSize`) | `timelineModel.js`, `Timeline.js` |
| 7 gradient bars given real extents + directional chevrons (dir l/r) | `timelineData.json`, `data-overrides.json` |
| `convert-massacre` → battle icon-event at (row 56, col 31), between Alma's ministry (55) and the attack (58) | `timelineData.json`, overrides |
| Final battle: one 4×2 icon bound to `cumorah-battle` content (clickable); 4 synthetic markers + tiny 5th removed | `timelineData.json`, `battleTiles.json`, overrides |
| Bevel diagonals at post-destruction stair-steps (rows 114–115 both sides) | `gridTiles.json` |
| Pahoran ring interior/sides completed (rows 72, 75) | `gridTiles.json` |
| `zoramite-defection` moved to row 64 (decollides `zerahemnah`) | `timelineData.json`, overrides |
| `grid.chip:'none'` param: clickable label paints no chip on dissolve regions (Christ trio, Lamanite Remnant) | `Timeline.js`, data |
| screenshot.js: `PLAYWRIGHT_MODULE` env override (laptop has no repo-root playwright) | `scripts/timeline-grid/screenshot.js` |

## Adversarial review round 1 (4 dimensions, 31 agents, 27 confirmed findings)

All four dimensions failed against the v3 build. Confirmed findings, remediated in rounds 4–6:

- **Data/story errors:** final-era Moroni (366 AD) was rendered inside the 74 BC war band; Benjamin's battle medallion was backed by the Lamanites-vs-Noah event (real Benjamin battle unplaced); Jerusalem caption orphaned over the Jaredites at ~3100 BC; Amaleki in the wrong record-keeper column; Ill-Fated Expedition chevron inverted (and its destruction battle unplaced); East/West front captions swapped; "Trave Northward" typo.
- **Missing content:** Lehi-party roster, both voyage ship markers, Desolation skull, Land Northward (x2), second Jerusalem, first strike vs. Zeniff, Sons-of-Mosiah return-bar label, round-trip chevrons on Explorers.
- **Icon system:** vocabulary had collapsed to a single battle glyph — added `voyage` (ship) and `skull` medallion variants + `dir:'lr'`; apex battles scaled (Cumorah 4×3 ≈ 58 px, Final Jaredite Battle 2×2).
- **Rendering:** bracket-shaped slivers at bar ends (root cause: pill end-caps rounded against `barAt` while the square canvas bar beneath peeked past — now rounded against `surfaceAt`); overflow-label occlusion (verifier corrected the mechanism: labels are painted over by later sibling chips, not clipped — mitigated with collision-aware anchors); band holes at the Nephite-defector army, Gathering-in-Desolation moat, unity notch; mid-band battle stub de-incursioned; place captions illegible over dark bands (auto ink flip); destruction band given material depth; chip:'none' halo glow.
- **Hierarchy:** Gid/Mulek/Bountiful/Antionum/Middoni/Lamanite Prison/Jerusalem converted from person-weight chips to quiet place captions.
- **Diagonals:** schism wedge stair-steps beveled (6 cells) in addition to the post-destruction shoulders.
- Refuted/declined: kings→judges gradient "wrong color" (reviewer misread the kings token — `#274e13` *is* the kings green).

## Known-remaining (minors, acknowledged)

- Label collisions/truncations: "War on the Eastern F…/Moroni on the Eastern Front", "Lamanite Convert Relocatio…/People of Ammon", "Lamanites Join Gadianto…/Giddianhi's Advance", "Jerusale…" under Amalekite Defection.
- `lamanite-prison` green bar spans far longer than reference; reference treats "Lamanite Prison" as a gray *place caption* heading with people beneath (design-language: place ≠ person label).
- Reference elements possibly missing from data: ship/voyage icons, Desolation skull glyph, "?" unknown-event glyph, "Land Northward", "Arabia" caption, Lehite family roster (Lehi, Sariah, Laman, Lemuel, Sam, Nephi), "Aminadab", "Hagoth" (present?), chevron coverage on remaining expedition bars.
- Diagonal pass: only the two post-destruction staircases converted; a systematic sweep for other reference diagonals (e.g. Nephite/Lamanite schism wedge) is pending.
- Long band-succession fades are shorter/harsher than reference in places (fade tile inventory is tiny).
- Cream "negative space" tongues between incursion bars read as solid bars on parchment (theme consequence — needs a judgment call: darker parchment, subtle texture, or accept).

## Adversarial sign-off round 2 (v6, 4 dimension judges)

**All four dimensions PASS** with zero blocking findings:
- **design-system** — pass. Bands, dissolves, corner language, icon vocabulary (battle/ship/skull + apex scaling), typography hierarchy, chevrons all read as the reference's grammar.
- **layout** — pass. Chronological story reads correctly top→bottom; every band/bar/ring/caption in the right relative position and direction; no label collisions/truncations at readable zoom.
- **presentation** — pass. No band holes, no orphan slivers, readable contrast throughout.
- **data-completion** — pass. Band names, rosters, place captions (Jerusalem ×2, Land Northward, Bountiful, Desolation+skull, Cumorah), expedition directions, apex battles, no wrong-era placements.

Residual minors the judges flagged, then resolved in a final pass:
- Final Jaredite Battle was a text chip clipping "Coriantumr" → converted to an apex gold medallion (2×3, ~50px, mirroring Cumorah) with Coriantumr anchored beside it. Removed the redundant synthetic coin.
- `convert-massacre` heading "Convert Massacre in Ammonihah" conflated two events → renamed "Convert Massacre".

Remaining taste-level minors (non-blocking, deferred): "Lamanite Servants"/"War on the Eastern Front" share one bar a touch tightly; a couple of italic captions sit mid-color-boundary; no Old-World Arabia caption (reference presence uncertain; the ~ wave glyph stands in for the crossing).

## Final sign-off (2026-07-02)

**All four adversarial dimensions PASS with zero blocking findings** (sonnet judges,
each cross-checking the parchment build's `full.png` + 5 detail strips against the
legacy dark-theme model bundle, pixel-cropping every joint/merge/end-cap):

- **design-system** — pass. Rounded corners reveal the wrapping territory (not cream),
  clean two-color diagonals, colored movement bars with chevrons→medallions, apex-scaled
  Coriantumr/Cumorah, Mosiah I bar reveals gold + green below.
- **layout** — pass. Full chronological/geographic parity; no collisions or truncations.
- **presentation** — pass. No cream holes in bands, solid figure/ground on the deeper
  aged-tan canvas, no orphan artifacts.
- **data-completion** — pass. Full rosters, all captions (Jerusalem ×2, Arabia, Land
  Northward, Bountiful, Desolation+skull, Cumorah, Zarahemla), 3 voyage ships, "?" glyph,
  short timeline labels vs full popup headings.

The convergence took several rounds; the decisive systemic fix was filling ~181 interior
negative-space cells (leftover from the bitmap conversion) with their territory color plus
closing the ~380-year gold Zarahemla void — parchment makes cream "holes" read as defects
where the dark model let them recede.

### Residual minors (non-blocking, deferred)
- Record-keeper connector lines (model draws a thin line seam→medallion; build seats
  medallions on the seam). Decorative.
- Two Helaman West/East medallions touch at ~65 BC — a few px separation would polish.
- Christ peace-era band shows more cream at the unity-gradient top than other bands —
  likely intentional (light/unity); a design call for KC.
- Applied: "The Nephites ▶" chevron (5.3); battle medallions already carry title/aria-label (5.4).

### Production readiness
See `docs/plans/2026-07-02-timeline-production-ready.md` and
`docs/reference/timeline-data-pipeline.md`. Status: pipeline source-of-truth documented
(gridTiles frozen, timelineData via overrides, regen-stability guard passing); model +
data-integrity tests added (69 timeline tests pass); timeline a11y clean (axe serious/
critical violations are all pre-existing app-shell chrome); perf 4962 DOM nodes / smooth
scroll; responsive with no overflow at 390/768px.

## Object/layer SVG rewrite — final parity (2026-07-03)

The flat cell-grid renderer (each cell one color, boundaries traced between all of
them) was replaced by a **stacked-layer SVG model** (`scripts/timeline-grid/trace_regions.py`
→ `scene.json`, rendered by `Timeline.js` as `<path>` layers). KC's decisive feedback:
"the red region covers all of that and everything else overlays on top — you're still
forcing the grid, causing perforations where corners don't match."

**Model:** regions are opaque shapes stacked by z. `layer_regions()` classifies each
region as a BASE (fronts the backdrop, exterior exposure ≥ ~15%) or an ENCLAVE (almost
fully enclosed → sits on its largest-area neighbour, whose fill is extended beneath it).
The red Lamanite territory is one continuous base under Amulon/Zeniff/Ammon/record-keepers;
a rounded corner or gap on any enclave reveals the layer **beneath** (red), never the
parchment void. Sibling bases (red|green) abut and stay independent.

**Corner rule (kills junction cream):** `rounded_loop` rounds a convex corner only into
open backdrop or a layer drawn *before* it (revealed legitimately); it squares corners
that abut a region drawn *after* (higher z), so the pair meets flush instead of both
receding and baring parchment.

**Cleanups (tracer):** `apply_solidify` (weld authored weave bodies), `absorb_islands`
(merge weave slivers), `fill_enclosed_holes` (patch enclosed gaps incl. small multi-colour),
`despur` (trim 1-cell edge protrusions), `absorb_enclosed` (drop stray unlabeled incursion
blocks; `WASH_COLORS` like `--c-nephilands #073763` merge at any size — they are land
shading, never a people-line). Markers dropped their legacy cell-grid backing (the heavy
red incursion "tab" pills behind record-keeper medallions).

**Final adversarial sign-off: all four dimensions PASS, zero blocking findings** (design
system / layout / presentation / data completion, sonnet judges vs the 4 dark-theme
reference screenshots in `BoMOnlineWorkspace/content/timeline`). 16 regions, interior
cream perforations eliminated (full-scene scan clean above the label band), 70 timeline
tests pass. Deferred non-blocking residuals: Ammon hexagon diamond-notch shape variety,
Helaman/Pahoran hollow-ring war-council motif, Hagoth westward loop bump, longer/softer
integration fades. Commits `3f3de27`→`f8ecf88`.

## Verification setup

- Local dev: `cd frontend/webapp && BROWSER=none PORT=8201 npm start` (needed `npm install` — `dompurify` was missing post-pull; app-shell XHR 400s are unrelated to the baked-JSON timeline).
- Screenshots: `python3.14 scratchpad/shot.py http://localhost:8201/timeline <outdir>` (Python playwright; chromium headless installed).
- Adversarial review workflow: 4 dimension reviewers (design system / layout / presentation / data completion) + per-finding refuters, comparing reference images vs. current strips.
