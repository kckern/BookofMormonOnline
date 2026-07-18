# Animated Map Story Tile — Design

**Status:** designed, not implemented
**Supersedes:** the static-path MVP described in `MapStoryTile.js:10-15`

## Problem

The map story tile renders a journey as one static polyline plus a numbered
list of moves. `pathCoords` (`MapStoryTileInner.js:31`) collapses the whole
journey into a single `LineString` through the first move's start followed by
every move's end. Three things go wrong.

### 1. The polyline fabricates legs that never happened — a correctness bug

Chaining all stops into one line assumes move *N* ends where move *N+1* begins.
It often doesn't. In the Amlicite War story, move 2 ends at `valley-of-gideon`
while move 3 starts at `hill-amnihu`, so the tile draws a
`valley-of-gideon → minon` connection that exists nowhere in the data.

Measured across the corpus:

```sql
SELECT COUNT(*) AS discontinuities, COUNT(DISTINCT a.parent) AS stories_affected
FROM bom_map_move a
JOIN bom_map_move b ON b.parent = a.parent AND b.seq = a.seq + 1
WHERE a.end <> b.start;
--  discontinuities: 47   stories_affected: 21   (of 55 stories)
```

**38% of stories render at least one invented leg.** This is the most serious
defect and the main reason to render per-move rather than as one path.

### 2. Markers stack on revisited places

The same collapse dedupes nothing. The Amlicite War visits `zarahemla` at both
index 0 and index 4, so marker 5 draws directly on top of marker 1 — in the
shipped tile, marker 1 is invisible.

### 3. The list is inert

Seven or eight moves of prose below the map is a wall of text, and nothing
connects a list item to the leg it describes.

Raw place slugs also leak into the UI (`hill-amnihu` where `Hill Amnihu`
belongs) because the sampler never selects `bom_places.name`.

## Shape

One story plays as a timed sequence. A shared playhead drives both the map and
a card carousel: leg N's dashed line grows into its destination while card N
slides in. After the last move a title card shows, then the loop restarts.

Rendering per-leg rather than as one polyline is what fixes problems 1 and 2
structurally: each leg is drawn from its own `start`→`end` pair, so no
connection is invented across a discontinuity, and markers dedupe by place
slug so revisits stop stacking.

## Verified data

All figures confirmed against `bom_prd` via the workspace read-only CLI
(`BoMOnlineWorkspace/cli/db.mjs`) on 2026-07-18.

| Table | Finding |
|---|---|
| `bom_map_story` | 55 stories |
| `bom_map_move` | 238 moves; 47 seq-adjacent discontinuities across 21 stories |
| `bom_map_move_people` | 617 rows covering 234 of 238 moves — travelers are near-universal; 4 moves have none |
| `bom_map_move_coords` | **0 rows.** Placeholder table; curved routes are a TODO, not available now |
| `bom_places.name` | Populated with display names ("City of Zarahemla", "Hill Amnihu") |

Travelers include both individuals (`alma2`, `amlici`) and collective groups
(`nephites`, `lamanites`, `amlicites`). Both have avatar images.

## Data layer

### Schema — `backend/schema/HomeSampler.graphql`

```graphql
type MapMoveSample {
  seq: Int
  start: String           # slug, retained as the /places/{slug} image key
  end: String
  startName: String       # NEW — bom_places.name
  endName: String         # NEW
  travelers: String       # retained; tile renders people[] instead
  people: [MoveTraveler]  # NEW
  description: String
  duration: String
  ref: String
  startLat: Float
  startLng: Float
  endLat: Float
  endLng: Float
}

type MoveTraveler {
  slug: String
  name: String
}
```

### Resolver — `sampleMapStory`, `backend/src/graphql/resolvers/homesampler.ts:339`

1. Add `'m.guid as moveGuid'`, `'sp.name as startName'`, `'ep.name as endName'`
   to the existing `.select([...])`. The `sp`/`ep` joins to `bom_places` are
   already present for the coord lookup, so the names cost no new joins.
2. Batch-load travelers with the existing `peopleByMoveGuid` DataLoader
   (`backend/src/data/loaders/maps.ts:240`), which already joins
   `bom_map_move_people` to `bom_people` and groups by `segment_guid`. No new
   query needs authoring.
3. Attach `people` to each move in the returned shape.

The seeded hub query (`ORDER BY MD5(...)`) is untouched, so a given seed still
selects the same story and the existing contract tests hold.

### TODO (not this change): curved routes

`bom_map_move_coords.coords` (Json, keyed by map + `segment_guid`,
`backend/codegen/db.d.ts:186`) is intended to hold true curved routes. It is
**empty — 0 rows against 238 moves** — and nothing in the codebase reads it.
Confirmed a placeholder awaiting authored path data.

Straight legs ship now. Because each leg is already its own Feature, swapping
in a multi-point `LineString` per leg later is contained to the geometry
construction in `MapStoryTileInner` — the animation interpolates along whatever
coordinate list it is handed.

## Components

### `MapStoryTile.js` — playhead owner

```
step:    0 … moves.length     // final index renders the title card
playing: IntersectionObserver visible ∧ !userPaused
```

A `useEffect` timer advances `step` every `DRAW_MS (1500) + DWELL_MS (4000)`,
wrapping to 0 after the title card. An `IntersectionObserver` at ~40% threshold
gates `playing`, so tiles below the fold in the infinite feed hold their timer
and burn no CPU.

**A pause control is required.** WCAG 2.2.2 (Pause, Stop, Hide) applies to any
auto-updating content that starts automatically, runs longer than five seconds,
and sits alongside other content. This loop qualifies regardless of the user's
motion preference. The tile carries a play/pause button; clicking a card also
pauses and pins to that step.

### `MapStoryTileInner.js` — map renderer, props `{ moves, step, animate }`

Replaces the single all-stops `LineString` with **one Feature per move**, built
from that move's own `start`→`end` coordinates. This is what stops
discontinuous stories from drawing invented connections.

- Legs `< step` — static dim dashes.
- Leg `step` — grows via `requestAnimationFrame`, interpolating along the
  segment and calling `setGeometry` per frame on that leg's Feature.
- Legs `> step` — not drawn.
- Markers dedupe by place slug; the current destination scales up and lights.

The view fits the **whole** story extent once on mount, not per step, so the
map does not jitter between legs. The existing finite-extent guard
(`MapStoryTileInner.js:94`) stays — a stray `NaN`/`Infinity` coordinate would
make `fit()` throw and take the tile down.

`animate={false}` short-circuits the rAF: the full path draws immediately, all
markers render, and `step` only controls which is highlighted.

### `MapStoryCard.js` — new

Per move: destination place image as backdrop, traveler avatars in a row from
`people[]`, `startName → endName` as the leg label, the `ref` button (existing
`openScripture`), and the description. Cards slide horizontally in a track.

The title card (final step) shows story title, description, and stop count.

Imagery is deliberately on the card rather than on map markers: place images
run 360–400 KB each, and putting them on markers would both pull every one
upfront and reintroduce the crowding this design exists to fix.

**Asset weight is the binding constraint.** Measured:

| Asset | Size |
|---|---|
| `${assetUrl}/places/{slug}` | 358–399 KB |
| `${assetUrl}/people/{slug}` — individuals | 63–197 KB |
| `${assetUrl}/people/{slug}` — groups (`nephites`, `lamanites`) | ~233 KB |

A move with five travelers (`alma2, amlici, amlicites, lamanites, nephites` —
a real row) would pull roughly 1 MB of avatars alone. So:

- Images render **only for the active step and its immediate neighbour**, not
  for every card in the track. Off-window cards hold a placeholder.
- Avatars are capped at 4 visible with a `+N` overflow chip.
- Every image is `loading="lazy"` with an `onError` hide, matching the existing
  tile convention (`FaxVerseTile.js:28`).

## Reduced motion

Under `prefers-reduced-motion`, `animate={false}`: no line growth, no sliding.
The full path draws, and cards cross-fade rather than slide. Auto-advance
continues, and the pause control remains available in both modes.

## Testing

- `sampleMapStory` returns `startName`/`endName`/`people` for a seeded story;
  same seed still selects the same story (regression on the existing contract).
- Moves with no `bom_map_move_people` rows yield `people: []` rather than
  null-crashing the card — 4 of 238 moves are in this state, so it is reachable.
- **Discontinuity guard:** a story whose move *N* `end` differs from move *N+1*
  `start` renders exactly `moves.length` leg Features and draws no segment
  between the mismatched pair. This is the regression test for the fabricated-leg
  bug and should use a fixture modelled on the Amlicite War rows.
- Marker count equals *distinct* place count, not point count — the regression
  guard for the stacking bug.
- Tile renders and does not start its timer while offscreen.
- `prefers-reduced-motion` renders the full path with no rAF scheduled.
