# Animated Map Story Tile — Design

**Status:** designed, not implemented
**Supersedes:** the static-path MVP described in `MapStoryTile.js:10-15`

## Problem

The map story tile renders a journey as one static polyline plus a numbered
list of moves. Two things go wrong, both visible in the shipped tile:

1. **Markers stack.** `pathCoords` (`MapStoryTileInner.js:31`) collapses the
   whole journey into a single `LineString` through every stop and dedupes
   nothing. A story that revisits a place — Alma 2's Amlicite War returns to
   zarahemla on moves 1, 4, and 5 — stacks markers on the same pixel and
   crosses legs over each other. The numbered circles become unreadable.
2. **The list is inert.** Eight moves of prose below the map is a wall of text,
   and nothing connects a list item to the leg it describes.

Raw place slugs also leak into the UI (`hill-amnihu` where `Hill Amnihu`
belongs) because the sampler never selects `bom_places.name`.

## Shape

One story plays as a timed sequence. A shared playhead drives both the map and
a card carousel: leg N's dashed line grows into its destination while card N
slides in. After the last move a title card shows, then the loop restarts.

Animating per-leg is what structurally fixes the overlap — only one leg is lit
at a time, and markers dedupe by place slug.

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

### Out of scope: real route geometry

`bom_map_move_coords.coords` (Json, keyed by map + `segment_guid`,
`backend/codegen/db.d.ts:186`) would give true curved routes instead of
straight legs. **Nothing in the codebase reads it**, and whether it is
populated could not be verified from the development laptop — no DB reachable.
Straight legs ship. If the table turns out to hold data, swapping the per-leg
`LineString` geometry is contained to one function in the map component.

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

Replaces the single all-stops `LineString`:

- Legs `< step` — static dim dashes.
- Leg `step` — grows via `requestAnimationFrame`, interpolating along the
  segment and calling `setGeometry` per frame on one Feature.
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
upfront and reintroduce the crowding this design exists to fix. On the card
they load one at a time as steps advance. Avatars are light (65–75 KB).

Asset paths, both verified live:
- `${assetUrl}/places/{slug}`
- `${assetUrl}/people/{slug}`

## Reduced motion

Under `prefers-reduced-motion`, `animate={false}`: no line growth, no sliding.
The full path draws, and cards cross-fade rather than slide. Auto-advance
continues, and the pause control remains available in both modes.

## Testing

- `sampleMapStory` returns `startName`/`endName`/`people` for a seeded story;
  same seed still selects the same story (regression on the existing contract).
- Moves whose places have no `bom_map_move_people` rows yield `people: []`
  rather than null-crashing the card.
- Tile renders and does not start its timer while offscreen.
- `prefers-reduced-motion` renders the full path with no rAF scheduled.
- Marker count equals *distinct* place count, not move count — the regression
  guard for the stacking bug.
