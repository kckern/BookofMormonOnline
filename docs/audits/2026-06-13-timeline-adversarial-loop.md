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
