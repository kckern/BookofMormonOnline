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
