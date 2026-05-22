# Map Story — Participants UI + Move Animation

**Status:** approved 2026-05-22
**Related reference:** `docs/reference/map-events-ux.md`
**Related spec:** `docs/specs/2026-05-22-map-event-url-routes.md`

## Problem

The story side-panel and the map are static today. We want to:

1. Pull `MapMove.people` into the panel so users see *who* travelled each leg.
2. Reframe the row layout so the description text reads as a *transition* description, not a location description.
3. When a specific move is selected, draw that move's segment on the map with a marching-ants line and a perpetually-moving participant avatar — pacman-style — so the journey feels alive.

## Goal

A user landing on `/map/internal/story/ammonites` or `…/move/3` should:

- See round participant avatars on the right side of the currently selected row.
- Watch those avatars slide down the list as they pick further moves.
- See the selected move's segment on the map with a dotted/animated stroke and a small circular avatar walking the line in a loop.

## Section 1 — Side-panel layout

### Row geometry

Each `.map_story_move` becomes:

```
[place tile]  [description block (vertically dropped)]  ........  [avatars slot]
```

- `.map_story_move { align-items: flex-end; }` — desc/avatars hug the bottom of the row.
- `.map_story_move_desc { margin-bottom: -1rem; }` — pulls the text down into the connector gap, so it visually annotates the *transition* rather than the place tile above.
- The avatars slot is `position: relative; flex: 0 0 auto; min-width: 6rem;` on the right end of the row. It does **not** contain per-row content — see the floating-avatar section below.

### Travelers header (existing collapse rule, unchanged)

The `<b>{travelers}</b>` header keeps its current behavior: hidden when `move.travelers === prevMove.travelers`. Per-row inline avatars are removed (we use the floating set instead).

### Floating avatars (one DOM node, slides between rows)

A single `<div class="map_story_avatars">` is rendered as a sibling of the move rows inside the story-panel `<CardBody>`. It's absolutely positioned within that card body, right-anchored, and contains one `<img>` per participant on the currently selected move:

```jsx
<div className="map_story_avatars" style={{ top: avatarTop }}>
  {selectedMove.people.map(p => (
    <img key={p.slug} src={`${assetUrl}/people/${p.slug}`} alt={p.name} />
  ))}
</div>
```

Sizing: each avatar is 28×28px, rounded, white border, subtle drop-shadow; the row of avatars sits at the row's bottom-right.

### Slide animation

- A ref-map of row index → DOM element is built during render.
- On `selectedSeq` change, a `useEffect` measures `rowRef.offsetTop` (relative to `CardBody`) and writes that value into the floating div's `top` style.
- CSS: `.map_story_avatars { transition: top 0.4s ease; }` does the slide.

Within a contiguous-same-travelers group the avatar children are identical, so the visual is one continuous slide. When seq crosses into a different-traveler group, the children re-render at the new position — the slide still happens; the faces just change at the destination.

## Section 2 — Default selection + URL

- `mapController.selectedMoveSeq = params.moveSeq ? parseInt(params.moveSeq, 10) : 1`.
- The single value drives: the `.selected` row highlight, the floating avatars' target row, and the map animation.
- URLs are unchanged from spec `2026-05-22-map-event-url-routes.md`:
  - `/story/:storySlug` → seq defaults to 1, URL stays as-is (no silent rewrite).
  - `/story/:storySlug/move/:seq` → that seq is selected; URL preserved.

## Section 3 — Map segment animation

Only active when `selectedStory && selectedMoveSeq` resolves to a valid move (which, given the default, is always true when a story is open).

### Layer setup

A dedicated `VectorLayer` is added to `MapContents` and reused across selections (only its source is cleared and re-populated). Source contains one `LineString` feature built from the selected move's `[startPlace.lat, startPlace.lng] → [endPlace.lat, endPlace.lng]` after `OlProj.fromLonLat`.

```js
const segmentStyle = new Style({
  stroke: new Stroke({
    color: '#b31312',
    width: 3,
    lineDash: [8, 8],
    lineDashOffset: 0,
  }),
});
```

### Marching ants

Standard OL trick: register a `map.on('postrender', cb)`. The callback increments `lineDashOffset` by 0.5 each frame and calls `segmentLayer.changed()` to force a redraw. The line appears to crawl in the travel direction.

### View fit

When `selectedMoveSeq` changes (or the story opens), call:

```js
map.getView().fit(line.getGeometry().getExtent(), {
  duration: 500,
  padding: [80, 80, 80, 80],
  maxZoom: currentMap.maxzoom,
});
```

### Moving avatar (approach A)

An `ol/Overlay` is created once and reused. Its element is `<div class="map_story_walker"><img src="${assetUrl}/people/${heroSlug}"/></div>`, where `heroSlug = selectedMove.people[0]?.slug` (first listed person; falls back to a generic circle if `people` is empty).

CSS gives the walker a 32px round, bordered look with a slight halo.

A `requestAnimationFrame` loop runs while a segment is active:

```js
function tick(now) {
  const t = ((now - startTime) % DURATION_MS) / DURATION_MS; // 0..1
  const [a, b] = line.getCoordinates();
  const pos = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  overlay.setPosition(pos);
  rafId = requestAnimationFrame(tick);
}
```

`DURATION_MS = 4000` (slow, leisurely pace). At `t = 1` the loop wraps to 0 — pacman wrap. The avatar simply disappears at the far end and reappears at the start; no easing back across.

### Tear-down

When the selected story or move clears (back arrow, navigation away, story close):

- Clear segment source features.
- Hide / un-position the walker overlay (`overlay.setPosition(undefined)`).
- `cancelAnimationFrame(rafId)`.
- Remove the `postrender` listener.

## Components touched

- `frontend/webapp/src/views/Map/MapPanel.js` — row layout, floating avatars + slide logic, pass `selectedMoveSeq` through `mapController`.
- `frontend/webapp/src/views/Map/Map.js` — derive `selectedMoveSeq` with default = 1, expose on `mapController`.
- `frontend/webapp/src/views/Map/MapContents.js` — segment layer, postrender marching ants, walker overlay, rAF loop, view fit.
- `frontend/webapp/src/views/Map/Map.css` — `align-items: flex-end`, desc negative margin, `.map_story_avatars`, `.map_story_walker`, transitions.

## Out of scope

- Animating between moves on the map (e.g., a smooth pan from move 3 to move 4 — we just `view.fit` each leg).
- Multi-participant trains/clusters on the map (single representative only).
- Mobile (panel is desktop-only per the reference doc; no new mobile entry point).
- Background music or sound on animation.
- Story-level "play the whole journey" mode.

## Verification

- `npm test` — type check + existing suite still passes.
- Playwright e2e — extend `e2e/map-event-url.spec.js`:
  - Assert `.map_story_avatars` exists, contains ≥ 1 `<img>` from `${assetUrl}/people/…` on the selected row.
  - Assert it slides: click move N, click move M (M > N), check the `top` style changes monotonically over a sampled frame.
  - Assert the OL segment is in the DOM (`canvas` content is hard to introspect; assert the walker overlay's `<div class="map_story_walker">` is positioned within the map container and has its `transform` changing across two frames sampled ~300ms apart).
- Manual: load `/story/ammonites`, watch the walker traverse Middoni → Nephi → Shilom; click move 3, see view auto-fit + walker on the new leg.
