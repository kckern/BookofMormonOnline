# Timeline — Object/Layer Model Redesign (Design Doc)

**Status:** Validated design (brainstormed with KC 2026-07-02). Supersedes the flat
cell-grid rendering. Not yet implemented — see "Implementation handoff" at the end.

## Why

The current `/timeline` renders ~3,700 individual grid-cell `<div>`s. Every visual
concept the design actually needs — **overlap, layering, negative space, rounded
corners, diagonal bevels, fades, and ribbons weaving over/under each other** — has to
be faked per-cell (wedge-color heuristics, hole-filling, pass-under flags). That fight
is the root cause of the "cream holes / cream wedges / looks like crap" churn. The cell
grid is the wrong abstraction. The design is a **scene of objects**, and layering should
do the work the hand-painting has been doing.

## Core model

Two object types, everything anchored to the **grid: x = geography, y = time**.

### 1. Region (the primary object)

A **region is an affiliation** (a people/lineage) plotted over geography (x) and time (y).
It is **one connected shape**, not a rectangle and not a pile of cells:

- **Body** — the main mass of the people over time.
- **Appendages** — arms that grow *out of the body*, across the x-axis, into another
  region's territory. An appendage represents an individual or small group **leaving the
  larger body and crossing geography** to war on / preach to / migrate into / integrate
  with another people. It is **the same region, same color, physically continuous with the
  body** — an appendage, NOT an overlay, NOT a wire laid on top. (Old model called these
  "ribbons"; they are not a separate type.)
- Appendage lifecycles: **one-off** (juts out and stops — e.g. a war), **round-trip**
  (reaches in and returns to the body), **permanent** (stays extended), or **fading** —
  the arm dissolves into another color at its tip, and *that fade IS the integration* of
  the group into the other region.
- **Silhouette treatments**, per edge/corner: `round` (◜◝◟◞ in the source), `bevel`
  (diagonal), and `fade` (gradient edge dissolving into an adjacent region).
- **z / weaving:** a region has a base z-layer. Where an appendage crosses another region
  the two overlap, and z is decided **per crossing, not globally** — an arm can pass
  **over** the crossed band at one cell and **under** it at the next, like a paper strip
  woven through threads. This per-crossing z is a first-class property of the appendage.

**Corner-reveal falls out for free:** a region's rounded/beveled corner is transparent, so
it reveals whatever is beneath it in z — a lower region, or the backdrop. No wedge-color,
no hole-filling. **Negative space** = wherever no region draws; the backdrop shows through
(intentional, not a hole).

### 2. Markers

Float above regions, anchored to grid coords.

- **Icon markers** — a glyph in a medallion/pin: `battle` (swords), `death` (skull),
  `voyage` (ship), `unknown` ("?"), `place` (pin). Extensible. Apex-scaled variants
  (Cumorah, Coriantumr) allowed.
- **Text labels**, styled by **class** (the class carries meaning via typography):
  `title` (big region/band names), `people` (person/lineage names), `geography` (quiet
  place/land captions), `event` (wars, death, bondage, captivity…). Each class = its own
  font/size/weight/color/halo, defined once in CSS, selected by data.

## Rendering — grid-strict SVG

- **One SVG** with a **grid coordinate system**: `viewBox` (or a fixed per-cell size, e.g.
  26×20 px/cell) so 1 SVG unit maps to grid cells. **Every path vertex snaps to the grid**
  — SVG is not allowed to go rogue. Corner radii / bevel offsets are a fixed fraction of a
  cell.
- **Regions** render as SVG `<path>` — the connected silhouette traced from its cells, with
  rounded/beveled corners (arc/line commands) and **gradient fills** for fades (`linearGradient`).
  One people = one path (or a few, split only where weaving needs different z).
- **Weaving** = draw order. Flatten all region-pieces + markers into draw-ops, **sort by z**,
  emit `<path>`s in that order. An appendage that goes under band B is emitted before B;
  the piece that pops over C is emitted after C.
- **Zoom** = scale the SVG coordinate system (viewBox width/height, or a CSS `transform:
  scale`) — crisp at any zoom, no per-cell re-layout, no ResizeObserver tile math.
- **Markers/labels** = HTML overlays (or `<foreignObject>`) positioned by the *same* grid
  transform, so they stay pixel-aligned and remain clickable/hoverable for the popover.
- Accessibility: regions get `role="img"`/`aria-label`; interactive markers stay `<button>`.

## Migration from today's data

- **Source of truth:** the color-per-cell grid (today `gridTiles.json`; the KC workspace
  `timeline.json` is a *draft*, not authoritative — don't trust it blindly).
- **Step 1 — trace regions:** group contiguous same-color cells (what `group.js` reached
  for), then **trace each group's boundary** into a grid-aligned polygon (marching-squares
  or edge-walk), not a convex hull (regions are concave — arms, notches).
- **Step 2 — derive treatments:** map the source's `◜◝◟◞` corner glyphs and existing
  `bevel`/`fade` tiles onto the traced polygon's corners/edges.
- **Step 3 — author the semantics that cells can't express:** which arms are appendages vs
  body, appendage lifecycle (one-off/round-trip/permanent/fade), per-crossing weave z, and
  label classes. This is the editorial layer — a `scene.json` of Region + Marker objects.
- **Step 4 — parity gate:** the new SVG scene must reproduce the current signed-off look
  (reuse the adversarial 4-dimension sign-off + the screenshot diff harness) before cutover.
- Keep the current cell renderer until parity is proven; feature-flag the SVG scene.

## Non-goals (YAGNI)

- No physics/animation of ribbons. No arbitrary free-form (non-grid) shapes. No runtime
  data fetch (stays baked). No new color system — reuse the existing lineage tokens.

## Open questions for implementation

1. Boundary tracer output format — inline the polygon in `scene.json`, or trace at build time
   from the color grid each run?
2. Fade direction/stops — express as edge metadata on the region, or explicit gradient defs?
3. Weave encoding — per-appendage `[{fromCell, toCell, z}]`, or a global crossing table?

## Implementation handoff

This is a substantial rewrite (new data model, SVG renderer, boundary tracer, parity
harness) and should be done in an **isolated worktree** with a **step-by-step plan**, not
continued in the current exhausted session. Next: `superpowers:using-git-worktrees` →
`superpowers:writing-plans` → `superpowers:executing-plans`, gated by the existing
adversarial sign-off for visual parity.
