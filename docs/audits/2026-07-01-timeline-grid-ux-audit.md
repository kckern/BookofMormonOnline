# Timeline tile-grid — full UX audit (dev WIP vs. production legacy)

**Date:** 2026-07-01
**Scope:** `frontend/webapp/src/views/Timeline/{Timeline.js,Timeline.css,gridTiles.json}`, the
`Event.grid`/`Event.label` GraphQL data, and side-by-side headless screenshots of
**prod** (`bookofmormon.online/timeline`, legacy Leaflet image-map) and **dev**
(`localhost:8201/timeline`, tile grid).
**Screenshots:** `docs/audits/timeline-ux-screenshots-2026-07-01/`
**Prior docs:** `docs/reference/timeline-grid-handoff.md`,
`docs/reference/timeline-corner-rounding.md`,
`docs/plans/2026-06-13-timeline-grid-migration-design.md`.

This audit is the input to the next planning round. It inventories what the legacy
design does well (the benchmark), then catalogs every observed defect and design gap
in the WIP grid, with root causes in code/data and a prioritized roadmap.

---

## 1. What we are trying to achieve

The legacy timeline is a **hand-drawn Leaflet image-map**: one giant raster where
lineage bands flow top-to-bottom through time, plus 183 GraphQL rows
(`x/y/w/h/o/z/p` + a per-entry GIF hotspot) that overlay clickable regions with
anchored Leaflet speech-bubble popups. It is beautiful but frozen: pixel edits
require redrawing the raster, it isn't translatable, isn't accessible, isn't
responsive, and the data isn't queryable.

The grid rebuild's goal: **reproduce the legacy design's narrative richness from
structured DB data** — rows = time, columns = lineage/place, `bom_timeline.grid_*`
placements + translated labels — so the timeline becomes editable, translatable,
accessible, and themable, **without losing the visual storytelling** that makes the
original read like a map of the whole book.

The WIP gets the skeleton right (bands render from data, events are keyboard
accessible, labels translate/humanize, zoom + fit work). But the current render is
still far from the legacy's visual quality. The gap is not one bug; it is a set of
systematic issues cataloged below.

## 2. The benchmark: legacy design-language inventory

From the prod captures (`prod-full.png`, `prod-detail-*.png`), the legacy design
system has these load-bearing conventions the grid must reproduce or consciously
replace:

1. **Dark, quiet canvas.** Charcoal + subtle grain. Bands glow against it; empty
   space reads as "unrecorded time", not blank paper. (Dev's parchment is a
   defensible re-theme — but see §3.4 contrast failures it causes.)
2. **Bands are characters.** Each lineage is a continuous ribbon that widens,
   narrows, splits, and **drifts diagonally** (the Lamanite red mass slides left as
   it grows; Lehi's purple splits into red/navy at the schism; Ammon's converts
   diverge from the red band into green). Diagonals carry the story of migration
   and divergence. The grid is 100% rectilinear today.
3. **A typographic hierarchy, not one label style:**
   - *Band names* ("Jaredites", "Lamanites", "Lehites"): white, set **inside** the
     band, roughly centered in the segment's visual mass, soft drop shadow.
   - *People rosters* (Nephi/Sam/Zoram/Jacob/Enos/Jarom/Omni): small stacked names
     inside the band, one per line, battle starbursts aligned to them.
   - *Place captions* ("Great Tower", "Land of First Inheritance", "Jersualem"
     [sic — prod has the typo; we fixed the content, keep it fixed]): **muted
     gray, small, OUTSIDE/above the band** on the canvas. Quiet, non-competing.
   - *Movement chips* ("Nephites ▶", "◀ Colonial Expedition", "◀ Sons of
     Mosiah"): label + **directional arrow** on a small rounded chip riding the
     migration bar, pointing the direction of travel.
4. **Battles are content, not decoration.** White starburst markers sit exactly at
   the event's band-edge/row, and each is **clickable with its own popup + art**
   (`amalickiah-vs-nephites-1`, `cumorah-battle`, … all have `heading/html/file`).
5. **Anchored speech-bubble popups** (Leaflet): click an event → a callout with a
   pointer tail anchored at the marker, art + text + "read" link. Context stays
   visible around it. No full-screen dimming.
6. **Continuous shapes.** Bands abut flush; corner rounding appears only on true
   outer silhouette corners; no white slivers between segments.

## 3. Findings — dev WIP defects

Severity: **P0** = content/comprehension regression vs prod · **P1** = clearly
broken/sloppy visual · **P2** = polish/design-system gap.

### 3.1 Content coverage regression — 65 legacy entries unreachable (P0)

Cross-referencing prod GraphQL (183 rows; 176 unique slugs — prod itself carries 7
extra rows across 5 duplicated slugs) with dev placements (`grid` non-null on 111/183):

- **65 prod slugs have no grid placement**, and most have real popup content
  (`heading`, `html`, art). The list is dominated by **battles and armies**:
  `cumorah-battle`, `amalickiah-vs-nephites-1/2`, `amlicite-battle`,
  `jaredite-battle`, `attack-on-ammonihah`, `eastern-war`, `gadianton-*`,
  `convert-massacre`, plus people/things like `captain-moroni`, `ammaron`,
  `amaleki`, `jaredite-voyage`, `arabia`.
- Compounding it: the grid's battle markers are **hardcoded canvas tiles with no
  slug** (`gridTiles.json` `k:"battle"`), rendered `role="img"
  aria-label="Battle" title="Battle"` — **non-interactive**. In prod every
  starburst opens a story. In dev they are all mute decoration with a generic
  "Battle" tooltip — even the ones that *do* correspond to placed DB rows.
- Net: a prod user can open ~168 stories; a dev user can open ~104, and none of
  the conflict narrative. This is the single largest regression and must anchor
  the next plan: **every canvas battle/pin needs a slug → DB row binding, and the
  65 unplaced rows need grid placements (or an explicit editorial decision to
  retire each one).**

### 3.2 Layering & compositing are wrong (P0)

The root architectural flaw: **the corner/occupancy algorithm only knows about
`gridTiles.json` fill tiles.** API-driven event bars, battle cells, and labels are
composited with no knowledge of each other, so every overlap is an accident.
KC's direction: *the background is NOT part of the battle icon/label — layering
must be explicit.*

Observed instances (see `dev-battles-incursions.png`, `dev-migration-bars-barcode.png`):

- **Battle cells punch parchment holes in event bars.** A battle placed on an
  API-rendered bar (e.g. the Ill-Fated Expedition row) gets
  `dominantNeighbor() = null` because the bar isn't a fill tile → the battle cell
  renders `background: null` → a parchment square sits **on top of** the blue bar
  with a floating medallion in it. The "revealed corner" color behind an incursion
  tab is likewise parchment whenever the defender's territory isn't a canvas fill.
- **Incursion tabs are cosmetically rounded but not layered.** The tab is a span
  inside the battle cell; its rounded TR/BR "reveal" shows whatever happens to be
  behind the *cell* (often parchment), not the defender band. Correct model: the
  territory band is the bottom layer, the attacker tab is a layer above it, the
  medallion a layer above that — each with its own geometry, never
  cell-background tricks.
- **Nested/overlapping bars produce slivers.** Green (Amalekite/Nephite) pills
  overlap maroon migration bars ("Amalickiah", "Lamanite Servants"): the pill's
  rounded cap reveals parchment *inside* the maroon bar. Same class of bug the
  corner-rounding doc fixed for stacked fills, now recurring one layer up because
  bars aren't in the occupancy map.
- **Labels straddle color boundaries.** "Lamanites Join Gadianton" starts on the
  maroon field, crosses onto parchment, and ends on its bar; "Lamanites vs.
  Abinadom" spills off the navy band onto parchment. White text + halo crossing
  three backgrounds mid-word reads as sloppy even when technically legible.

**Recommendation:** build ONE unified occupancy/compositing model per cell —
canvas fills + hole patches + API event bars + battle layers — with explicit
z-tiers (band < duration bar < incursion tab < marker < label). Corner logic,
reveal colors, `data-lin` highlighting, and label contrast should all consume that
single model. (This also restores the legacy `z`/`o` semantics the grid dropped —
see §5.)

### 3.3 Corner rounding — right rule, wrong granularity (P1)

The per-corner heuristic (round iff H≠C ∧ V≠C ∧ D empty) is correctly implemented
against fill tiles, and flush junctions are indeed flush now. Remaining problems:

- **"Wedding-cake" scalloping.** Bands that shift width via stacked 1-row steps
  (maroon block above "Lamanite Remnant", slate Gadianton band bottom, gold
  mission block tongues — `dev-wedding-cake-corners.png`) round every step's
  outer corner, producing a run of quarter-round moldings. Per-corner each is
  "correct"; as a silhouette it's busy noise prod never has, because prod draws
  those transitions as **diagonals** (§3.6). Fix is data/shape-level, not another
  corner rule tweak: merge steps into diagonal edges or coarser multi-row steps.
- **Enclosed islands read as flat patches.** All-square is the documented rule for
  enclosed cells (navy block inside maroon, maroon islands inside the gold mission
  block), but visually they look like untextured leftovers rather than intentional
  enclaves. Consider a 1px inner hairline or slight inset for enclosed islands so
  they read as deliberate.
- **Radius doesn't respect tile size.** `--rad` is fixed (13px × scale); a 1-row
  bar gets the same nominal radius as a 40-row band, so thin bars become
  stadium-capped pills while huge blocks look barely rounded. Radius should scale
  with min(tileW, tileH) (clamped), as prod's hand-drawn corners implicitly did.
- Event bars from the API get **no corner logic at all** (flat 4px CSS radius on
  `.tg-event`), which is why the migration bars look like UI buttons instead of
  band segments.

### 3.4 Fades & contrast (P1)

- **Sticky-gutter fade smears bands** (`dev-gutter-fade-smear.png`). The date
  gutter's backing is `linear-gradient(to right, #f0e6c8 78%, transparent)`. When
  zoomed/scrolled horizontally, band fills slide under the 22% translucent zone
  and blur into a brown smudge down the whole left edge. The gutter needs a
  **hard opaque edge** (full-opacity backing + its existing 1px rule; if a soft
  transition is wanted, fade *over* a solid backing so band pixels never bleed
  through).
- **Post-Christ band is still near-invisible.** The remap (#fff2cc → #e6cf8c)
  isn't enough against parchment #f0e6c8 — the band reads as slightly dirty
  background, and its black labels ("Twelve Disciples", "The People of Christ")
  appear to float on nothing. Needs a genuinely distinct value (or an outline
  treatment for light-on-light bands).
- Duration-bar gaps punched in band interiors (the right-edge white slots in the
  big maroon band; the alternating bar/parchment "barcode" in the war chapters)
  read as rendering errors, not negative space. Legacy avoids this because bars
  sit *inside* the band color. Decide per case: keep the gap only where the
  parchment moat is truly meant (band absence), otherwise render duration bars as
  **in-band tints/overlays** (again: unified layering, §3.2).
- The top vignette and scroller inset shadows are fine — keep.

### 3.5 Label & icon design system (P1) — currently one-size-fits-none

Today every label is the same thing: 11px Roboto Condensed 600, white-or-black,
halo, **left-anchored at its tile's left edge**. Prod's four-tier hierarchy (§2.3)
is lost. Specific defects:

- **No anchoring model.** KC direction: *anchor/float must be a parameter;
  default center.* Band names should center in the band segment's visual mass;
  roster names row-align; movement chips anchor to the bar tip they travel
  toward; place captions float outside the band. Today `justify-content` is
  hardcoded flex-start (events) and the only centered label on the whole canvas
  is "Cataclysmic Destruction" (a canvas tile that happens to span symmetric).
  → Add `anchor` (`center|start|end|above|below`, default **center**) to the
  grid data model + renderer.
- **Labels don't fit their chips.** "The Great Tower" renders half on a grey chip
  and half spilling onto parchment (`dev-great-tower-chip-clip.png`); the chip is
  the tile's fixed 2-col width while the text overflows it. Either size chips to
  content (inline-block pill, not tile-width) or clip/ellipsize with full text on
  hover — never a mid-word background cut.
- **`#5a5a5a` fallback chips.** Events with no `grid_bg` get a hardcoded dark-grey
  chip that matches nothing in the palette ("The Great Tower", "Limhi's
  Explorers"). Fallback should derive from the underlying band or a themed
  neutral (sepia ink), and missing `grid_bg` rows should be data-fixed.
- **📍 emoji as the place icon.** Renders as tofu/tick marks in headless Chromium
  (the flanking "ticks" around 'Land of Ishmael', 'Jerusalem' in the captures)
  and inconsistently across platforms; red-pin + red text also makes places the
  *loudest* thing on the canvas when prod made them the quietest. Replace with a
  small inline SVG pin (like the SWORDS pattern), muted sepia, and restyle place
  captions to the prod convention (small, gray-brown, italic, outside the band).
- **No directional language for movement.** Prod's ◀/▶ chips told you Zeniff went
  *back* to Nephi and the Sons of Mosiah went *out*. Dev's migration bars are
  arrow-less; direction is implied only by geometry. Add an SVG chevron to the
  movement-chip label style (direction as a data param, e.g. `dir: 'l'|'r'`).
- **Halo artifacts.** The 4-way ±0.6px text-shadow on place labels produces dirty
  corner ticks around glyphs at 1× (visible on 'Jerusalem'). Prefer a single
  blurred halo (as `.tg-on-light` already does) or paint-order stroke.
- **Zoom LOD is binary.** All labels vanish below scale 0.55; above it,
  everything shows. KC direction: *some labels should not be visible when zoomed
  out.* Add an importance tier to placements (e.g. `1` era/band names, `2` major
  events, `3` minor roster/detail) and gate visibility per tier by effective
  scale — band names persist at every zoom (they're the wayfinding layer),
  detail appears progressively. This also fixes the zoomed-out view
  (`dev-zoomed-out.png`) currently being an unlabeled abstract.
- **Typography.** The handoff says era/headings use the app serif, but every
  canvas label renders Roboto Condensed; the only serif on the page is the modal.
  Define the type ramp explicitly: serif display for band/era names, condensed
  sans for detail labels, and use tabular sizes per tier (not one 11px size).

### 3.6 Shape language — rectilinear-only loses the story (P2, high design value)

Prod's diagonals are semantic: divergence (Ammon's converts leaving the Lamanite
mass, red/green re-diverging), drift (Lamanite westward slide), and schism
(purple→red/navy split) are all drawn as slanted band edges. The grid's stair-steps
turn these into wedding-cake noise (§3.3) or abrupt column jumps. KC is open to
diagonals — options for the plan, cheapest first:

1. **CSS `clip-path` bevels on transition tiles**: a fill tile flagged
   `bevel: 'tl'|'tr'|'bl'|'br'` clips that corner at 45° (or matched to the
   step's rise/run), replacing N stacked steps with one slanted edge. Data change:
   generator emits bevel tiles where the sheet shows a drift.
2. SVG overlay layer for band edges (full freedom, more work — the grid stays for
   hit-testing/layout, an SVG path draws each band silhouette).
Recommend prototyping (1) on the two highest-value sites: the Lehi schism and the
Ammonite divergence.

### 3.7 Time axis & vertical rhythm (P2)

- Axis labels are inconsistent and sometimes nonsensical: `~3100 BC`, `600s BC`,
  `545s BC` (not a decade), `75s BC`, `65s BC`. Normalize the generator: century
  granularity where rows are sparse (`500s BC`), decade where dense (`90s BC`),
  exact years in dense war chapters if warranted (`74 BC`) — never a plural "s"
  glued to a non-decade number.
- The 3100 BC → 600 BC compression leaves a ~20-row featureless void under the
  Jaredite elbow, and the 450–200 BC stretch is a giant empty maroon field. Prod
  fills these with quiet captions ("400 years pass…" style wayfinding could work)
  or compresses rows. Options: variable row height per era (grid-template-rows
  with explicit tracks), or a "time break" glyph (double squiggle) marking
  compressed centuries.
- Consider faint horizontal century rules across the canvas (prod's dark canvas
  didn't need them; parchment can carry hairlines) to make row = time legible.

### 3.8 Popup/detail surface (P2 — direction decided)

KC prefers a **Google-Maps-style speech-bubble callout** anchored to the clicked
tile over the current centered modal + backdrop blur (`dev-modal.png`). Plan:

- Anchored popover (Popper-style placement within the scroller, pointer tail to
  the tile, auto-flip at viewport edges), art + heading + date + html + read
  link — same content as today's modal.
- Keep the URL-driven selection (`/timeline/:slug`), focus management, and Escape
  behaviors already built — they're good — but retarget them to the popover.
  Keep a full-screen fallback only for small viewports where a callout can't fit.
- Selected tile stays highlighted (existing `is-selected` ring) and
  `scrollIntoView` centering already works.

### 3.9 Interaction polish (P2)

- Band hover (`brightness(1.15)`) + statusbar naming works and is subtle-good.
  But battle medallions/tabs light with their `data-lin` band while the *label*
  bars they belong to don't participate (not in the model — §3.2 again).
- Hover ink-chip on labels is a decent collision reliever but fires on sparse
  labels too, where it's churn; tie it to the LOD tier (only detail-tier labels
  chip on hover).
- `title=` tooltips on every tile duplicate the label (native tooltip + ink chip
  + modal). Once the popover lands, drop `title` from clickable tiles (a11y label
  already covers SRs).

## 4. What's working — keep

- Data-driven render, `grid { row col rowSpan colSpan bg }` + `label`, translated
  labels with humanize fallback, `label_category` routing.
- Fit-to-width + zoom architecture (`--scale` var everywhere), no-h-scroll rest
  state, ResizeObserver guard.
- A11y skeleton: skip link, keyboard focusable events, focus trap, URL-selection,
  WCAG 24px target floor, `aria-label`s with dates.
- Hover-band discovery + statusbar; battle layer toggle keeping territory
  continuity; hole-patch fill for enclosed gaps.
- Corner heuristic as the *base* rule (junction squareness is right); parchment
  re-theme is a legitimate identity (with §3.4 contrast fixes).

## 5. Data-model deltas for the next plan

Legacy model (still served: `x y w h o z p` + `file` GIF per row) vs new
(`grid_row/col/w/h/bg` + `label_category`). The rebuild dropped four legacy
semantics that the defects above trace back to, and needs three new ones:

| Need | Legacy analog | Proposal |
|---|---|---|
| Explicit z-layering (band < bar < tab < marker < label) | `z` | `grid_layer` tinyint or derived from tile kind; unified compositor consumes it |
| De-emphasis / tint (places were `o: 0.5`) | `o` | style tier via `label_category` or explicit `grid_emphasis` |
| Label anchoring (center default; start/end/above/below) | baked into raster | `label_anchor` enum, default `center` |
| Zoom LOD tier (band > major > minor) | n/a (single zoom) | `grid_tier` tinyint 1–3, renderer gates by scale |
| Movement direction (◀/▶ chips) | baked into raster | `grid_dir` enum `l/r` (null = none) for expedition/migration rows |
| Diagonal/bevel transitions | hand-drawn | `bevel` flag on generator-emitted fill tiles (`gridTiles.json` only, not DB) |
| Battle → content binding | every battle row had `x/y/file` | give canvas battle tiles slugs (they exist in the 65 unplaced rows); battles become clickable |

Plus the **placement backlog**: 65 unplaced prod slugs — full table in
`2026-07-01-timeline-grid-unplaced-rows.md` (feed through
`scripts/timeline-grid/` + `overrides.json`) — and 5 duplicate-slug rows in prod
data worth cleaning while we're in the table.

## 6. Prioritized roadmap (proposed for the next plan doc)

1. **P0a — Unified layer/occupancy model** (fills + hole patches + API bars +
   battles + labels in one map; explicit z-tiers; reveal colors always correct;
   corner logic and `data-lin` consume it). Fixes §3.2 wholesale and unblocks
   everything below.
2. **P0b — Content parity**: slugs on battle tiles → clickable battles; place the
   65 missing rows (or retire each deliberately); backfill missing `grid_bg`.
3. **P1a — Label/icon design system**: anchor param (center default), four label
   tiers with type ramp, content-sized chips, SVG pin + chevrons, halo cleanup,
   LOD tiers by zoom.
4. **P1b — Fades/contrast**: opaque gutter edge, post-Christ band color,
   duration-bar in-band treatment, size-aware corner radius.
5. **P2a — Speech-bubble popover** replacing the modal (keep URL/focus plumbing).
6. **P2b — Shape language**: bevel/diagonal prototype at the schism + Ammonite
   divergence; de-scallop stepped bands.
7. **P2c — Time axis**: normalized tick generator, era rhythm/compression
   treatment.

Each of 1–3 is prerequisite-ordered; 4–7 are parallelizable after 1.

## 7. Method note

Captures: Playwright headless Chromium, 1440–1600px wide, tall viewports
(2800–3000px) for full-column context plus 2× device-scale strips for corner/label
forensics; prod data via the public GraphQL (`x/y/w/h/o/z/p` query), dev data via
`:5006` (`grid` query). Headless has no emoji font — the 📍 tofu finding was
confirmed as a real cross-platform risk, not just a harness artifact (emoji
rendering varies per OS regardless).
