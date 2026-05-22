# Map Event URL Routes

**Status:** approved 2026-05-22
**Related reference:** `docs/reference/map-events-ux.md`

## Problem

Opening a map story today only updates the address bar via Redux `setSlug` — no
React Router route is registered, so a cold deep-link to a story drops the story
segment and lands on the map alone. Individual moves within a story have no
addressable form at all.

## Goal

Make stories and individual moves deep-linkable, so a user can share a URL that
opens the side panel directly on the right story (and optionally scrolls to a
specific move). Browser back/forward should round-trip cleanly through the
story-open / story-close transitions.

## Routes

Added to `frontend/webapp/src/models/Routes.js` before
`/map/:mapType/place/:placeName` so the more specific paths match first:

```
/map/:mapType/story/:storySlug/move/:moveSeq(\d+)
/map/:mapType/story/:storySlug
/map/:mapType/event/:storySlug/move/:moveSeq(\d+)    # alias of /story/
/map/:mapType/event/:storySlug                        # alias of /story/
```

All four mount the same `Map` component. The `(\d+)` constraint on `moveSeq`
mirrors the existing `/commentary/:commentaryId(\d+)` pattern.

The `event` variants are pure URL synonyms — they resolve the same way as
`story` and don't change panel content. The UI labels the surface "Events" so
both spellings should be shareable.

Identifier choices:

- **Story** → `slug` (already on `MapStory`; matches `/place/:placeName`
  convention).
- **Move** → `seq` (`MapMove` has no slug; `seq` is human-readable and stable
  within a story; `guid` would be globally unique but opaque/ugly).

## Component wiring

### `Map.js` (`MapContainer`)

- Extend `useParams()` to also read `storySlug` and `moveSeq`.
- Pass both through `mapController` so the panel can react to URL changes.
- When `storySlug` is in the URL but `panelContents.slug` is empty, default
  `panelContents.slug` to the story's first move's `startPlace.slug` so the
  side-panel wrapper opens (the `open` class on `.mappanel_wrapper` keys off
  `panelContents.slug`).

### `MapPanel.js`

- Add `useEffect([storySlug, currentMap?.slug])` — when `storySlug` is set and
  the story exists in `currentMap.stories`, call `setSelectedStory(story)`. When
  `storySlug` is cleared, call `setSelectedStory(null)`.
- The Events-tab click handler (`MapPanel.js:112` and the multi-story list
  click at `:135`) swaps from `mapController.updateUrl(...)` (Redux-only) to
  `history.push(...)` so the URL becomes a real history entry.
- `MapStoryPanel` back arrow — swap `setSelectedStory(null)` for
  `history.push('/map/{mapSlug}/place/{placeSlug}')` (or `/map/{mapSlug}` if no
  place). The existing effect will see the new params and clear
  `selectedStory`.

### `MapStoryPanel`

- Accept `moveSeq` as a prop.
- When `moveSeq` is set and a row matches, `scrollIntoView({ behavior: 'smooth',
  block: 'center' })` and apply a `.selected` class to that row.

### CSS

- Add `.map_story_move.selected` to `Map.css` — a subtle outline / background
  change to make the targeted row obvious without dominating.

## Behavior matrix

| URL                                              | Behavior on cold load                                       |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `/map/internal`                                  | Map only, no panel.                                         |
| `/map/internal/place/zarahemla`                  | Map + place panel (existing).                               |
| `/map/internal/story/lehis-journey`              | Map + story panel; place defaults to story's first start.   |
| `/map/internal/story/lehis-journey/move/3`       | As above, scrolled to move seq=3 with `.selected` highlight.|
| `/map/internal/event/lehis-journey`              | Identical to the `/story/` variant.                         |
| `/map/internal/event/lehis-journey/move/3`       | Identical to the `/story/.../move/3` variant.               |

Unknown story slug or out-of-range move seq → fall back gracefully (don't open
the story panel; render the map and any place context).

## Out of scope

- Rendering the event lines on the map (`MapContents.js:263` `features: []`).
- Animating/zooming to a story's bounds on selection.
- Mobile entry point into the Events UX (panel is desktop-only).
- Any backend / GraphQL schema changes — `MapMove.seq` is already exposed.

## Verification

- `npm test` — type check + existing suite still passes.
- Manual browser check at `http://localhost:8200`:
  - Click a story from the Events tab → URL becomes `/map/.../story/...`,
    browser back returns to place panel.
  - Paste `/map/internal/story/<known-slug>` into a new tab → story panel
    opens.
  - Paste `/map/internal/event/<known-slug>/move/2` → story panel opens
    scrolled to move 2.
  - Unknown slug / out-of-range seq → graceful fallback, no console errors.
