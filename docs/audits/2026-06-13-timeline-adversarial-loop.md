# Timeline — adversarial critique loop

Each round: a fresh adversarial design/UX critic loads `/timeline`, screenshots,
and delivers stern feedback; the highest-impact items are then implemented and
verified. Max 10 rounds; stops early when the critic runs out of substantive issues.

---

## Round 1

**Critic verdict (paraphrased):** Attractive but fails the core job of a timeline —
no legend (colors undecodable), time axis not to scale, battle medallions look
clickable but aren't, mobile unusable, no visible tile focus, wasted vertical space,
some label overflow/truncation, no "how to read" orientation, undersized modal,
cryptic zoom controls, black destruction band reads like a render error.

**Acted on (highest impact — the critic's own #1 pick):**
- Added a **legend / "How to read this"** overlay (collapsible, fixed, parchment-themed):
  orientation note (time top→bottom, dates approximate, columns = peoples/lands),
  a color key for all 12 lineage bands, and an icon key (📍 place, ⚔ battle).
- **Corrected the color→lineage mapping** — derived it from each event's real
  `grid_bg` because the migration design doc was wrong (e.g. maroon `#85200c` is
  **Lamanites**, not Nephites; `#1c4587` is Nephites; `#38761d` is the reign of the
  judges, etc.).
- Added `title` tooltips to the zoom controls (they already had aria-labels).

**Deferred to later rounds:** mobile responsive layout; to-scale (or explicitly
ordinal) time axis; modal sizing/art aspect; styling the black destruction band as
intentional; arrow-key grid navigation; remaining label overflow/truncation tooltips.

---

## Round 2

**Critic verdict:** R1 fixes confirmed working, but the data layer is leaking and
the legend has problems. Hard-data findings: battle medallions are aria-hidden
non-interactive decoration; legend (default-open) occludes the chart origin and is
catastrophic on mobile; legend↔band name mismatch ("The Great Destruction" vs
"Cataclysmic Destruction"); "After Christ" band 1.12:1 contrast (invisible); raw
slug suffixes ("Mosiah1", "Land of Bountiful1") + typos ("Nephties", "immiment");
~78% of labels overflow with no tooltip; grid not keyboard-reachable; two greens &
two blues in the legend are mutually indistinguishable; faint modal date.

**Acted on:**
- **Source typos fixed in prod DB:** "Nephties"→"Nephites", "immiment"→"imminent",
  "Mosiah1"→"Mosiah I".
- **Display cleanup** `cleanLabel()` strips disambiguation digits glued to names
  ("Land of Bountiful1"→"Land of Bountiful"), applied to labels + modal heading.
- **"After Christ" band now visible:** remap `#fff2cc`→`#e6cf8c` (`BG_FIX`/`fixBg`),
  applied to fills, events, and the legend swatch so the key still matches.
- **Battle medallions:** now `role="img" aria-label="Battle"` + `title` (honest,
  AT-announced marker) instead of silent `aria-hidden` decoration — there is no
  per-battle record to open, so they stay non-interactive by design.
- **Legend:** defaults collapsed on mobile (≤640px) so it no longer eats the
  viewport / occludes the origin; name now matches the band ("Cataclysmic
  Destruction").
- **Tooltips** (`title`) added to all labels (places + static, not just clickable).
- **Modal date** darkened + bolded for legibility.

**Deferred:** palette perceptual-separation for the two greens / two blues;
skip-link & arrow-key grid navigation; to-scale/ordinal axis treatment; deeper
mobile grid layout; label truncation (conflicts with the intentional overflow
"duration bar" design).

---

## Round 3

**Critic verdict:** R1-2 fixes hold; now "a mouse-only sighted-desktop artifact in
an accessibility costume." Findings: grid not keyboard-reachable (137 nav stops
before any cell, no skip-link/arrow nav); hit targets 52×20 / 26×20 px (below WCAG
2.2 24px); axis advertises false decade precision while compressing 2,500 yr into
one row; legend occludes live data; "Mosiah1" leaked into modal *body* prose; the
two greens (1.73:1) and two blues (1.71:1) still fused; mobile illegible; modal
close 23px / body 13.5px; stray "0.0% Completed" pill.

**Acted on:**
- **Palette separation:** remapped the fused pairs via `BG_FIX` — Nephite-kings
  `#274e13`→`#2f6f4f` (teal-green, distinct from the grass-green judges) and
  Gadianton `#6fa8dc`→`#7d8596` (slate, distinct from Zeniff's blue). Legend
  swatches updated to match.
- **Data-layer name fix:** "Mosiah1"→"Mosiah I" in the Zarahemla event's `html`
  body (R2's strip only covered titles/labels; now the body is clean too).
- **Hit targets:** clickable anchors get an invisible `::before` that expands the
  target to ≥24px tall/wide without shifting the 20px-row layout.
- **Skip-link** ("Skip to timeline") + focusable grid region (`#tg-grid`).
  Honest limitation: the global sidebar nav precedes this view in the DOM, so a
  per-component skip-link can't be the *first* focusable element — a true fix needs
  an app-shell-level skip link and/or roving-tabindex arrow navigation.
- **Modal polish:** close button now a 40px hit area; body text 13.5→15px, darker,
  left-aligned.

**Deferred:** roving-tabindex arrow-key grid nav + app-level skip link; to-scale or
honestly-coarse time axis (compression break for the 3100→600 BC void); deeper
mobile grid reflow; hiding the global "% Completed" pill on the timeline route.
(Not changing: horizontal centering / equal side margins — that was an explicit
earlier request, not a bug.)

---

## Round 4 — DIRECTED BY KC (supersedes the round-4 critic list)

Mid-loop, KC gave concrete direction (4 messages). This round did the **layout /
chrome cluster**; the harder **grid-internals cluster** (corner-rounding algorithm,
incursion battle chips, hover-highlight + status bar) is the explicit next round.

**KC's direction (full backlog):**
1. *Corners:* round only the outer perimeter of self-contained band units; square at
   junctions/connectors; a rounded corner must reveal the **underlying band color**,
   not parchment. Case-by-case, not blanket. (→ next round)
2. *Battles:* each battle sits on its underlying layer's color (Jaredite=teal,
   Mulekite=gold…); Lamanite-into-Nephite incursions = a self-contained red rounded
   chip (rounded top+bottom) on the blue band with the icon on top. (simple case
   done this round; incursion chips → next round)
3. *Legend → hover:* drop the floating legend; hovering a band lights it up (~10%
   brighter / outline) + a status bar names it. (floating legend removed this
   round; hover-highlight + status bar → next round)
4. *Responsive:* never need a horizontal scrollbar — shrink cells proportionally to
   fit; honor max-width when wider. (done)
5. *Font:* restore Roboto Condensed, no serif anywhere. (done)
6. *Title:* compact H1 "Book of Mormon Timeline"; an expandable info box under it
   (next to title) houses the how-to-read + legend. (done)

Reference: KC pointed at the live prod timeline (http://bookofmormon.online/timeline,
the old Leaflet design) as a model — rounded self-contained segments, square
junctions, battle icons on the band color.

**Done this round:**
- Removed all serif (Nanum Myeongjo) → Roboto Condensed throughout.
- Compact title bar: H1 "Book of Mormon Timeline" + "ⓘ How to read" toggle + zoom
  controls, all docked in one bar. Wrap is now a flex column (titlebar + scroller).
- Removed the floating legend; its content now lives in the expandable "How to
  read" info panel under the title (multi-column key grid).
- Responsive scale-to-fit via ResizeObserver: `scale = zoom × fitScale`,
  `fitScale = min(1, avail/naturalW)`. Verified no x-overflow at 1600/1000/700px.
- Battles render on their underlying band color (`background: fixBg(t.bg)`).
- Dropped the stray white `#ffffff` artifact fill cell.

**Round-4 critic findings folded in / still open:** axis honesty (compression break)
— open; `#073763` is a fill-only band with no events (name it during the hover work);
deep-link highlight invisible behind modal — open; modal art aria duplicates title —
open; trailing empty grid rows — open.

---

## Round 5 — KC grid-internals backlog (cont.)

**Done:**
- **Corner-rounding algorithm** (commit `7ffa17e0`): replaced the sparse static `rd`
  glyph data with rounding computed from band occupancy. A corner rounds only when
  both its orthogonal neighbour cells are empty parchment (true outer-perimeter
  corner of a self-contained band); any edge touching another band stays square (a
  junction). Bands now read as rounded ribbons with square joins — matches the prod
  model. Implemented as `colorAt` occupancy map + `cornerStyle(t, colorAt)`, radius
  scales via `calc(13px * var(--scale))`.
- **Hover-highlight + status bar** (this commit): dropped the persistent legend
  reliance — hovering anywhere on a band now lights up every tile of that lineage
  (`filter: brightness(1.15)`) and a bottom-left status bar names it. Delegated
  `onMouseOver` reads the nearest `data-lin`; `data-hover` on the grid + 13
  per-color CSS rules drive the highlight (no re-render of the ~3,200 tiles).
  `#073763` (the unkeyed fill-only band) named "Nephite lands" in `COLOR_NAMES`.

**Still open (next round):** incursion battle chips — Lamanite-into-Nephite battles
as a self-contained red rounded chip on the blue band (two-layer cell: band color
behind + rounded attacker chip + icon on top). Plus the remaining critic items
(axis compression break, deep-link highlight, modal art aria, trailing rows).

---

## Round 6 — KC grid-internals backlog (battles) + live KC feedback

**Done:**
- **Incursion battle chips:** a battle whose own color differs from its dominant
  surrounding band is an incursion (20/38, mostly Lamanite into Nephite/Judges
  land). It renders as the territory color filling the cell + a self-contained
  rounded attacker-color chip (`.tg-battle-chip`, pill) with white swords on top.
  Home-territory battles keep the gold medallion on their own band color.
  `dominantNeighbor()` resolves territory vs attacker.
- **Battles folded into the occupancy map** (KC: "chips … live ON TOP of the
  national areas that have the rounded corners; not transparent backgrounds").
  Battle cells now count toward band occupancy with their effective color (home →
  own band; incursion → territory), so the national area stays **continuous**
  beneath a battle instead of the corner algorithm rounding *around* the battle
  hole and leaving parchment notches. `colorAt`/`battleInfo` computed together.
- **Opaque medallion:** the gold coin's near-parchment cream center (`#fdf5dc`)
  read as a hole punched to the background; replaced with a richer fully-opaque
  struck gold so battles clearly sit *on top* of the band.

KC's grid-internals backlog (corners R5, hover R5, battles R4+R6) is now complete.

**Still open:** axis compression break / honesty; deep-link highlight visible after
modal close; modal art aria duplicates title; trailing empty grid rows.

---

## Round 7 — live KC feedback (5 messages, supersedes the R7 critic)

**CRITICAL fix (commit `1e12f869`):** the fit-to-width ResizeObserver mutated layout
inside its own callback → "ResizeObserver loop completed with undelivered
notifications", which CRA shows as a fatal full-screen overlay → the user saw NO
timeline/labels ("labels from db still not showing AT ALL"). Fixed by deferring the
recompute to requestAnimationFrame + an epsilon guard. (KC msgs #3 + #4, same root
cause — verified labels render and no error after hammering resizes.)

**Incursion pattern redo (KC msg #2):** the 580–200 BC Lamanite-vs-Nephite battles
(and similar elsewhere) now follow KC's exact spec — the attacker's land encroaches
ONE cell into the defender's territory as a tab of attacker color with TR+BR
rounding (territory revealed at the rounded corners), and the gold battle medallion
sits on top. Replaced the earlier inset red pill (`.tg-battle-chip` → `.tg-battle-tab`).

**Layers panel (KC msg #5):** a "⧉ Layers" dropdown in the title bar with a Battles
checkbox (extensible `layers` state). Toggling battles off keeps the band continuous
(renders the battle cell as a plain territory fill, no parchment hole) and removes
the markers.

**STILL OPEN (KC msg #1 — next round):** "many square corners that should be
rounded" (round outer-perimeter corners even where they abut another band, revealing
the underlying band color, not just against parchment) AND "fading area borders"
(gradient transitions where peoples merge, e.g. Lamanites + Nephites merging into
the Gadianton era) — a genuinely new visual feature needing a focused design pass.

---

## Round 8 — KC msg #1 (corner rounding, part 1)

**Done — band-on-band corner rounding with reveal:** rewrote the corner logic so a
corner rounds whenever BOTH its orthogonal neighbours differ from the band (parchment
OR another band), not just parchment. For a corner that bites toward another band, the
revealed (diagonal-neighbour) band color is layered behind a rounded base
(`.tg-fill-wrap` > corner backings `.tg-cb-*` + `.tg-fill-base`), so the rounding
looks like this band curving on top of the one beneath — never a parchment notch.
`cornerData()` replaces `cornerStyle()`; `--rad` drives both the base radius and the
backing box size. 208 band-junction tiles now layer correctly; outer perimeter
corners still reveal parchment. Verified no parchment notches at purple→blue→maroon
junctions.

**STILL OPEN (KC msg #1, part 2):** "fading area borders" — gradient transitions
where peoples merge (Lamanites + Nephites → Gadianton era / post-Christ unity). The
data doesn't encode merge zones, and the visual treatment is subjective, so this
needs KC's specifics (which transitions fade + the look) before implementing — doing
it blind risks building the wrong thing.

---

## Round 9 — KC: corner over-correction + a heuristic standard; and :8200

KC: "we're overcorrecting on the rounded corners ... screenshot prod and put together
a heuristic flowchart of what conditions rounded corners are warranted vs not, then
cross-check." The R8 band-on-band reveal over-rounded (the R9 critic confirmed: 10
mis-colored corner bites — 8 black, 2 parchment; orphan-island rounding; parchment
slivers between vertically-stacked bands).

**Done:**
- **Heuristic doc** `docs/reference/timeline-corner-rounding.md` — derived from prod
  (discrete rounded-rect segments, background in the gaps; underlying-band reveal
  only for true overlaps like battle tabs). Rule: **round a corner iff both
  orthogonal neighbours ≠ this band AND the diagonal is empty parchment** → reveal
  parchment. Square at edges (orthogonal == own) and at junctions/intersections
  (diagonal is another band / handoffs).
- **Reverted R8's two-layer reveal** (`.tg-fill-wrap`/`.tg-cb`) back to single-div
  `cornerStyle()` per the heuristic. Cross-checked: no black/parchment bite notches,
  no orphan-island rounding, no slivers between stacked bands; outer perimeters and
  open-diagonal protrusions round; handoffs square.

**:8200 (Next front door) "never gql's the timeline" — REAL root cause + fix:**
KC corrected my first wrong guess. Next is **SEO-only** (bots→SSR, humans→CRA via
`middleware.ts` rewrite). Two real bugs on the human path:
1. **Locale page routes:** the CRA uses bare routes (`/timeline`; language by
   subdomain). A human hitting `/en/timeline` was rewritten transparently to the
   CRA keeping `/en/timeline` in the browser → the CRA client router found no match
   → timeline never mounted (only the app-shell queries fired — exactly KC's "only
   2 gql calls on /en"). Fix: middleware now **redirects** locale-prefixed **GET**
   page URLs to the bare path (`/en/timeline` → `/timeline`).
2. **GraphQL endpoint collision:** the GraphQL API is **POSTed to `/{lang}`** (e.g.
   `POST /en`; setupProxy treats `/en`,`/ko`,… as API paths). My first redirect
   caught `/en` for *all* methods, so it redirected the GraphQL **POST /en → /** →
   `404` (KC's console: `POST http://10.0.0.10:8200/ 404`). Fix: the redirect is
   gated to **`GET` only**; API POSTs fall through to the CRA rewrite → backend.
Verified: human `/timeline`, `/en/timeline`, `/ko/timeline` all load 104 events
with no API errors; bots still get SSR.

**Open / noted from R9 critic (not yet done):** layers dropdown doesn't close on
outside-click; date-axis honesty + "1s AD/5s BC" seam labels; mobile legibility +
zoom controls dropped on narrow widths; deep-link highlight after modal close.

---

## Round 10 (final) — closing QA + KC layering note

**R10 critic** confirmed the corner heuristic now reads right (no notches/islands/
slivers at junctions; perimeters + protrusions round) — one HIGH issue left: the
**Helam** orange band showed parchment notches + a parchment rectangle from a real
interior **hole** in the tile data (`r40 c9-10`, enclosed by orange).

**Done:**
- **Enclosed-hole fill:** the occupancy memo now flood-fills interior empty regions
  not connected to the outside, filling ONLY those bordered by a single band color
  (the Helam hole + ~10 other 1-2-cell holes). Duration-bar gaps border 2+ colors
  (maroon+blue) so they're untouched. Fixes both the parchment rectangle and the
  notches (the corner algorithm no longer rounds into a now-filled hole). Patches
  render as plain interior fills.
- **Incursion cells are now a layer (KC):** the incursion cell's base carries the
  *territory* color (`data-lin = eff`, e.g. Nephite blue) and the attacker tab is
  its own layer (`data-lin = attacker`). So highlighting the blue band now also
  lights up the cell where red encroaches into blue — they behave as a layered
  unit, not separate painted areas.

Verified: 104 events, no runtime errors, Helam solid, hover propagates to incursion
cells. **Loop complete (10/10).**
