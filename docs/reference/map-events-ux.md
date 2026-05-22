# Map "Events" UX

Reference for the events surface inside `frontend/webapp/src/views/Map/`. "Events" is the
user-facing label; the underlying domain has no `Event` entity — every "event" in the UI
is a **`MapStory`** containing ordered **`MapMove`** rows. Knowing the vocabulary mismatch
up front is half the doc.

## Where the word "Events" appears

`MapPanel.js:120` — a `<NavItem>` labelled `Events` with a numeric badge counting matching
stories. That tab, plus the story panel it opens, is the entire feature.

## Data contract

GraphQL types live in `src/typeDefs/BomPeoplePlaces.ts:119`:

```graphql
type MapStory {
  slug: String
  guid: String
  title: String
  description: String
  moves: [MapMove]
}

type MapMove {
  guid: String
  seq: Int
  start: String        # raw start-place slug
  startPlace: Place    # resolved place w/ lat/lng/label
  end: String
  endPlace: Place
  travelers: String    # e.g. "Lehi's family"
  people: [People]
  duration: String     # free-form, e.g. "8 years"
  description: String
  verse_ids: [Int]     # scripture range, rendered via scripture-guide
}
```

Resolver: `src/resolvers/BomPeoplePlace.ts:258` → `Models.BomMapStory.findAll`.
Model: `src/database/models/bom_map_story.ts`. A story `hasMany` moves
(`src/config/database.ts:585`).

## Fetch + stitch

`Map.js:88` issues a single combined query:

```js
BoMOnlineAPI({ map: type, mapstories: [type] }, { useCache: false })
```

`Map.js:93` then attaches the stories to the map object so consumers read a single shape:

```js
result.map[type].stories = result?.mapstories || [];
```

There is no per-story fetch — every story for the active map ships in the initial load.

## Tab gating

`MapPanel.js:101`:

```js
const matchingStories = currentMap?.stories?.filter(story =>
  story.moves.some(move =>
    move.startPlace.slug === slug || move.endPlace.slug === slug
  )
) || [];
```

The Events `<NavItem>` only renders when `storyCount > 0`. The badge shows `storyCount`.

## Click behavior

`MapPanel.js:112` — opening the tab branches on count:

- **1 story**: skip the list, jump straight to `MapStoryPanel` and `updateUrl` to
  `/map/{mapSlug}/story/{storySlug}`.
- **>1 stories**: switch to tab "2", render a list of `.map_story` cards (title +
  description). Clicking a card calls the same `updateUrl` + `setSelectedStory`.

`MapPanel.js:205` short-circuits the whole panel render when `selectedStory` is set:

```js
if (selectedStory) return <MapStoryPanel mapController={mapController} />
```

## `MapStoryPanel` (`MapPanel.js:431`)

- Header: a `⬅` back-arrow that calls `setSelectedStory(null)`, plus the story title.
- Body: story description, an `{N} Movements` heading, then one `.map_story_move` row
  per move.
- Each row: start-place tile (`MapEventImageCaption`) ▸ description block ▸ end-place
  tile.
- Description block: `<b>{travelers}</b> · {miles} miles · {duration}` plus the move
  description with an inline scripture link.
- **Distance**: computed in-browser with `geolib.getDistance(startPoint, endPoint)`,
  converted via the local `metersToMiles` helper (`MapPanel.js:34`). It is straight-line
  point-to-point; not route-aware.
- **Scripture refs**: `verse_ids` → `generateReference(verse_ids, lang)` from
  `scripture-guide`. The reference is wrapped as `<a className="scripture_link">` and
  intercepted by `getHtmlScriptureLinkParserOptions`; clicking opens
  `ScripturePanelSingle` (imported from `views/Page/Narration`) in the right-hand
  scripture pane.

Place tiles are rendered by the local helper `MapEventImageCaption` (`MapPanel.js:488`)
using `${assetUrl}/places/${location.slug}` and a `<caption>` over the bottom of the
image with `(label || name).replace(/\//g, " ")`.

## URL behavior — important caveats

`mapController.updateUrl(...)` is defined at `Map.js:102` as a thin wrapper:

```js
const updateUrl = (pageUrl) => {
  appController.functions.setSlug(pageUrl);
};
```

`setSlug` (`models/appController.js:216`) is a Redux dispatcher. It writes the slug into
app state and the address-bar reflection is driven from there — it does **not** push a
React Router history entry on its own (callers pass `{ replace: true }` when they want
that). Consequence:

- Opening a story updates the address bar to `/map/{mapSlug}/story/{storySlug}` for the
  current session.
- The registered routes (`models/Routes.js:230`) are only:
  - `/map/:mapType/place/:placeName`
  - `/map/:mapType`
  - `/maps`
  - `/map`
- **There is no `/map/:mapType/story/:slug` route.** A cold deep-link to that URL hits
  the map route's fallback and drops the story segment — the story panel does not
  auto-open from a fresh load.

For comparison, the place panel's close button does push history explicitly
(`MapPanel.js:406`):

```js
history.push({ pathname: `/map/${currentMap.slug}` })
```

The story panel's back arrow only flips local state (`setSelectedStory(null)`) — it
neither pushes nor pops history. Browser back from inside a story therefore depends on
whichever history entry preceded the panel open.

## Map-layer rendering of moves — currently a no-op

`MapContents.js:232` builds `LineString` features from every move of every story:

```js
const moves = stories?.map(s => s.moves).flat() || [];
const lines = moves.map((m) => [
  [m.startPlace.lat, m.startPlace.lng],
  [m.endPlace.lat, m.endPlace.lng]
]).map(([start, end]) =>
  new Feature({ geometry: new LineString([
    OlProj.fromLonLat(start),
    OlProj.fromLonLat(end)
  ]) })
);
```

…but the vector layer that would display them is added with an empty source
(`MapContents.js:260`):

```js
new VectorLayer({
  source: new VectorSource({
    features: []           // [...lines]  ← commented out
  }),
  style: () => new Style({
    stroke: new Stroke({ color: '#FF000044', lineDash: [10, 10], width: 3 })
  })
});
```

So the dashed red stroke style exists, the geometry is computed every redraw, and the
layer is wired in — but **no lines are drawn**. Even if `[...lines]` were re-enabled,
there is no per-story filter: *all* moves from *all* stories on the map would render
simultaneously.

There is also no story-driven map navigation: selecting a story in the panel does not
pan, zoom, sequence through moves, or highlight markers.

## Mobile

`MapPanel.js:384`:

```js
if (isMobile()) return null;
```

The entire panel — Description / Events / References tabs and `MapStoryPanel` — is
desktop-only. Mobile users tapping a marker get a generic popup instead
(`Map.js:141`, `MapContents.js:329`):

```js
mapController.appController.functions.setPopUp({ type: "places", ids: [slug] });
```

There is no mobile entry point into the Events UX.

## Tab numbering

`MapPanel.js:128`:

| `tabId` | Label        | Notes                                                       |
| ------- | ------------ | ----------------------------------------------------------- |
| "1"     | Description  | Default                                                     |
| "2"     | Events       | NavItem only renders when `storyCount > 0`                  |
| "3"     | (vicinity)   | TabPane exists at `:143` but **no NavItem** — orphaned code |
| "4"     | References   | Counts `placeDetails.index?.length`                         |

## Styling

Story/event-specific classes in `Map.css:660`:

- `.map_story`, `.map_story:hover` — story cards in the multi-story list
- `.map_story_move` — flex row for one movement
- `.map_story_move_place` — 4rem square place tile
- `.map_story_move_desc`, `.map_story_move_desc p.desc` — text column
- `.map_story_move_place caption` — black-overlay label on the place image

## Summary of current gaps

The data and UI scaffolding for richer event UX is mostly in place, but several pieces
are unfinished:

1. No real React Router route for `/map/:mapType/story/:slug`; deep-linking does not
   open a story on cold load.
2. No route at all for individual moves.
3. The line layer for move geometry is wired but disabled (`features: []`).
4. Selecting a story does not animate or restrict the map view.
5. The vicinity tab (id "3") has a TabPane but no NavItem — dead code path.
6. The Events UX is desktop-only — no mobile surface.
