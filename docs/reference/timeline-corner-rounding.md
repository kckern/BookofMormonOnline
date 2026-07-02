# Timeline band corner-rounding — heuristic

The standard for when a lineage-band tile corner is rounded vs square, derived from
the production timeline (discrete rounded-rectangle segments on a background, with
the background showing in the gaps) and KC's direction ("no hard corners except at
junctions and intersections; self-contained units / outer perimeters get rounded
edges").

## Model

A **band** is a maximal run of contiguous same-color cells. Each band should read as
a **self-contained rounded ribbon**: its true outer-perimeter corners are rounded
(revealing the parchment background, like prod's inter-segment gaps); where it
**connects to or meets another band** the corner stays **square** (a junction).

Reveal color is **always the parchment background** — never an adjacent band's color.
(The only place an underlying band shows through is a deliberate *overlay*: the battle
incursion tab, handled separately, not by this corner logic.)

## Flowchart — for one corner of a cell (band color `C`)

A corner touches three neighbor cells: the orthogonal **H** (horizontal, e.g. left),
the orthogonal **V** (vertical, e.g. up), and the **D** (diagonal, e.g. up-left).
`empty` = parchment (no fill).

```
              ┌─ H == C ?  ──yes──▶ SQUARE  (band continues horizontally → edge, not a corner)
corner X ─────┤
              └─no─▶ V == C ?  ──yes──▶ SQUARE  (band continues vertically → edge, not a corner)
                       │
                       └─no─▶ D == empty ?  ──no (D is another band)──▶ SQUARE
                                │                                       (junction/intersection —
                                │                                        ≥2 lineages meet here)
                                └─yes──▶ ROUND  (convex outer corner with open space
                                                 diagonally → reveal parchment)
```

In one line: **round iff `H≠C` AND `V≠C` AND `D` is empty parchment.**

## Why each branch

- **H==C or V==C** → the band continues straight along that edge; rounding would bite
  into the band's own body. Square.
- **D is another band** → this corner is where two (or more) different lineages meet —
  an *intersection/junction*. Square (flush handoff). This is the case R8 wrongly
  rounded, producing parchment/black "bite" notches and slivers between vertically
  stacked bands.
- **D is empty + both orthogonals not-C** → a genuine convex corner of the band's
  silhouette with open background diagonally. Round, revealing parchment.

## Consequences (what this fixes vs the over-rounded R8)

- Vertically stacked bands in one column (purple→maroon handoff) stay **flush**
  (D is the band above → square), no parchment sliver.
- Fully-enclosed "island" cells (all four neighbors another band) never round (every
  corner has D = a band → square).
- A band that genuinely protrudes past a neighbor (open diagonal) **does** round —
  more rounded than the original "both orthogonals must be parchment" rule, which is
  what KC meant by "many square corners that should be rounded."
- No band-color reveal layer (`.tg-cb`) → no mis-colored bite bugs.

## Cross-check method

Render, then for each band sample its silhouette corners against this table; spot
black/parchment notches (should be none), stacked-band slivers (none), and rounded
enclosed islands (none). Verify true outer corners and open-diagonal protrusions are
rounded.

## Rule v2 (2026-07) — SUPERSEDES the flowchart above

**Round a corner IFF both orthogonals AND the diagonal are empty parchment.**
(`timelineModel.cornerRadii`.) v1 still rounded flush handoffs whose edges align
exactly (other band on ONE orthogonal, diagonal empty), producing junction
notches observed in the 2026-07-01 dev captures. Ribbon ends and true
protrusions into fully open space keep rounding. Trade-off: v2 squares the
"band tip sliding alongside another band" case v1 deliberately rounded — KC
gate at plan Task 4. Radius is now size-aware: `min(13, h·20/2, w·26/2)` px
pre-scale (`radiusFor`), so 1-row bars get stadium caps instead of oversized
pills. Event bars round against the BAR layer only (caps at free ends; reveals
show whatever is genuinely beneath).

## Rule v2.1 (2026-07, Round 2) — SUPERSEDES v2

**Round a corner IFF BOTH orthogonal neighbours are empty parchment. The
diagonal is IGNORED.** (`timelineModel.cornerRadii`.)

v2 additionally required the diagonal empty. That over-squared **protrusion
corners** — a corner facing open space on both its edges but touching another
band only *diagonally*. Prod ROUNDS those: the diagonal gap is a pinch point
prod tolerates and it reads fine at 13px radii. KC flagged the v2 result as
"lots of square corners that should be rounded." Dropping the diagonal
condition restores the rounding.

The sliver bug v2 actually fixed was the **orthogonal flush handoff** (another
band sharing a full edge). v2.1 still keeps those SQUARE: a shared edge means
one orthogonal is occupied, so "both empty" fails and the corner squares. So:

- diagonal-only touch (both edges open) → **ROUND** (v2 wrongly squared this)
- edge-flush handoff (band shares an orthogonal edge) → **SQUARE** (unchanged)

Same-color staircases self-heal: between two cells of the same band that share
an edge, that orthogonal is occupied → the interior seam stays square → no
pinch notch appears *between* a band's own cells. Only the true convex step
corners (both edges facing parchment) round.

### Per-tile `rd` / `sq` overrides (data escape hatch)

`cornerStyleFor(rect, colorAt, {rd, sq})` merges data over the algorithm, JSON
wins: corners listed in `rd` force-round, in `sq` force-square, applied to fill
tiles in `gridTiles.json`. Use where the artwork rounds/squares a corner the
algorithm can't express (concave color-junction segment reveals the artwork
shows as discrete rounded ribbons — v2.1 squares those as junctions).

**Legacy-rd audit (Round 2):** the legacy build left 49 `rd` glyphs in
gridTiles.json (dormant since Task 1). Enabling them under v2.1: 18 are no-ops
(v2.1 rounds them anyway), 28 are valid color-junction segment reveals that
match the artwork (kept), and **5 were stripped** — they rounded a corner where
the SAME band continues along an orthogonal edge, biting a notch into the
band's own body (mid-ribbon): (4,7)/br, (4,31)/tl, (45,31)/bl, (47,31)/bl,
(61,30)/bl. Rule: never `rd` a corner whose orthogonal edge continues in the
same color.
