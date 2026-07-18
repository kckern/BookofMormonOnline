# Objects View & Resolver — Design Spec

**Date:** 2026-05-12
**Status:** Approved (brainstorming complete; implementation plan to follow)
**Touches:** `src/resolvers/`, `src/typeDefs/`, `src/database/`, `frontend/webapp/src/views/Objects/`, `frontend/webapp/src/models/`, `frontend/webapp/src/views/_Common/PopUp.js`

---

## Goal

Add a new "Objects" entity surface to BoM Online — parallel in shape to the existing People and Places features — backed by the newly-populated `bom_objects`, `bom_xrels`, and `type='object'` rows in `bom_index`. Surface objects as a filterable index page, a detail popup, and as side-panel context in the Reader/passagenotes flow.

## Data prerequisites (not in this PR)

The `00-run-all.sql` from the YAML→SQL pipeline must already have been run against `bom_prd`, populating:

- `bom_objects` (198 rows)
- `bom_xrels` (1,811 rows, all `src_type='object'` currently)
- `bom_index` (additional 2,182 `type='object'` rows alongside existing `people`/`place`)

This spec assumes those tables exist.

## Architecture

**Backend:** A new resolver file `src/resolvers/BomObjects.ts` mirrors `BomPeoplePlace.ts` in shape (Sequelize-only, no raw SQL, AST-driven selective translation, exported helpers for cross-resolver use). A new typeDef file `src/typeDefs/BomObjects.ts` reuses the existing `Index` type from `BomPeoplePlaces.ts`. Two new Sequelize models — `BomObjects` and `BomXrels` — are added to `src/database/models/` and registered in `src/config/database.ts`. The existing `passagenotes` resolver is extended to surface objects alongside people/places.

**Frontend:** A new `views/Objects/` folder mirrors `views/Places/` — `Objects.js` (list view + masonry grid + filter), `Objects.css`, `ObjectsFilter.js` (5-axis chip filter), `objectsFilterData.js` (chip→icon mappings), and per-category SVG icons in `svg/`. The shared `PopUp.js` modal gains an `Object` component branch. Routes for `/objects` and `/objects/:objectSlug` are added to `Routes.js`. `GraphQLQueries.js` gains `object` (detail) and `objectList` (preload) templates.

## Schema additions

### GraphQL — new `Object` and `Xrel` types

```graphql
extend type Query {
  object(slug: [String]): [Object]
}

type Object {
  guid: String
  slug: String
  name: String
  subtitle: String
  category: String
  specificity: String
  usage: String
  era: String
  provenance: String
  aliases: String
  tags: String
  description: String
  verse_id: Int
  weight: Int
  index: [Index]
  xrels: [Xrel]
}

type Xrel {
  rel: String
  srcweight: Int
  dst_type: String
  dst_slug: String
  dst_name: String
  dst_title: String
  note: String
  verse_id: Int
}
```

The existing `Index` type from `BomPeoplePlaces.ts:109-117` is reused — its `type` field will now also carry `"object"` in production. No new fragment of `Index` is defined.

### Sequelize models

Two new model files in `src/database/models/`:

**`bom_objects.ts`** — PK `guid` (varchar 50), indexed `slug` (varchar 100 UNI), all other columns as documented in the data spec. Mirrors `bom_places.ts` shape.

**`bom_xrels.ts`** — PK `uid` (autoincrement int), indexed `(src_type, src_slug)`, `(dst_type, dst_slug)`, `(rel)`. Mirrors `bom_people_rels.ts` shape.

Both models registered in `src/config/database.ts` alongside existing entries. No association statements required (this PR avoids Sequelize associations for xrels — we use programmatic batch lookup instead).

## Resolver behavior

### `Query.object(slug)`

```ts
Models.BomObjects.findAll({
  where: slug ? { slug } : undefined,
  order: [['weight', 'DESC']],
});
```

Returns most-weighty objects first when no slug filter is provided.

### Field resolver `Object.index`

```ts
Models.BomIndex.findAll({
  where: { type: 'object', slug: object.slug },
  order: [['verse_id', 'ASC']],
});
```

Loaded only when `index` is requested (AST detection via `getRequestedFields` helper already in `BomPeoplePlace.ts:10`).

### Field resolver `Object.xrels` — the centerpiece

Steps:

1. Fetch raw xrel rows: `Models.BomXrels.findAll({ where: { src_type: 'object', src_slug: object.slug } })`.
2. Bucket rows by `dst_type` into `peopleSlugs`, `placeSlugs`, `objectSlugs` (skip `'group'` — no lookup table).
3. Three parallel batch lookups: `Models.BomPeople.findAll({where:{slug:peopleSlugs}})`, `Models.BomPlaces.findAll({where:{slug:placeSlugs}})`, `Models.BomObjects.findAll({where:{slug:objectSlugs}})`. Build a `slug→name+title` map per type.
4. For each xrel row, resolve `dst_name` and `dst_title`:
   - `people`: `dst_name = person.name`, `dst_title = person.title`
   - `place`: `dst_name = place.name`, `dst_title = place.info`
   - `object`: `dst_name = obj.name`, `dst_title = obj.subtitle`
   - `group`: `dst_name = dst_slug` (echo), `dst_title = null`
   - missing target: `dst_name = dst_slug`, `dst_title = null`, `console.warn` once per unique missing slug
5. Derive `verse_id` from `note` using `scripture-guide`'s `lookupReference` (already imported in `BomPeoplePlace.ts:4`). Extract the first scripture-like token from `note`; on parse failure, set `verse_id = null`. Wrap in try/catch.
6. Sort: `verse_id ASC NULLS LAST, srcweight ASC, dst_slug ASC`.

### Exported helpers

For cross-resolver use (mirrors `BomPeoplePlace.ts:548-712`):

- **`loadObjectsFromTextGuid(guid, slugs, lang)`** — joins `BomLookup` to `BomIndex` filtered to `type='object'`, unions with any supplied slugs, returns `BomObjects.findAll`.
- **`loadObjectsFromVerseIds(verse_ids, lang)`** — range-overlap query against `BomIndex` rows where `type='object'` and `verse_id BETWEEN min..max`, then `BomObjects.findAll` for those slugs.

### Translation

`name`, `subtitle`, `description` go through `translatedValue()`. No translation rows exist for objects today, but the hook is wired so future BomLabel data lights up automatically.

### Caching

No Redis. The existing in-memory `labelsCache` in `BomPeoplePlace.ts:7` is not extended in this PR (rel verbs are stable English tokens; localization of the 29-verb vocabulary is deferred).

## Passagenotes integration

The existing `passagenotes` resolver in `src/resolvers/BomNotes.ts:170-379` returns `{commentary, sources, chiasmus, people, places, images, notes, fax, mapstory, refs}`. This PR:

1. Adds `objects: [Object]` to `type PassageNotes` in `src/typeDefs/BomNotes.ts:26-37`.
2. In `BomNotes.ts`, imports `loadObjectsFromVerseIds` (and `loadObjectsFromTextGuid` for the text-guid path) from `./BomObjects`.
3. Adds an `objects` entry to the parallel-load block at `BomNotes.ts:331-343`, mirroring the existing `people`/`places` pattern.
4. Adds `objects` to the return object at `BomNotes.ts:367-378`.

Frontend `GraphQLQueries.js` `passagenotes` template gains an `objects { slug name subtitle category }` selector alongside the existing people/places fields.

## Frontend view

### `Objects.js` — list view

Mirrors `Places.js:1-208`. Masonry grid (`react-masonry-css`, same breakpoints), responsive 8→2 cols. Each card:

- Header: `name`.
- Body: `<img src="${assetUrl}/objects/{slug}" onError={swapToCategoryIcon}>` background. Subtitle as primary body text.
- Footer: category badge + era badge + specificity-indicator (only when `specific`).

Image error handler: on first 404, swap `src` to `svg/<category>.svg` and set `data-fallback="1"` to prevent loop. If the category SVG also 404s, browser shows alt text.

Card click → `appController.functions.setPopUp({ type: "object", ids: [slug], underSlug: "objects" })`, and `history.push("/objects/" + slug)` via `react-router-dom` `<Link>`.

### `ObjectsFilter.js` — 5-axis chip filter

Mirrors `Places.js:210-394` `PlaceFilters`. Five chip rows:

| Axis | Cardinality | Match values |
|---|---|---|
| Category | 15 | animal, building, weapon, food, sacred-object, money, plant, record, metal, tool, apparel, structure, vehicle, landscape, armor (+ treasure subsumed under category for filter purposes if present) |
| Era | 7 | timeless, nephite, old-world, lehite-departure, jaredite, christ-era, post-christ |
| Provenance | 8 | generic, nephite, israelite, divine, lehite, jaredite, lamanite, mulekite |
| Specificity | 2 | specific, general |
| Usage | 3 | literal, mixed, metaphorical |

Client-side filtering: `objectFilters` state shape `{category:Set, era:Set, provenance:Set, specificity:Set, usage:Set, search:String}`. AND across axes; OR within an axis. Different from Places (which uses regex over single-char tag strings) because Objects' tag values are multi-character full words — we use `Set.has()` instead.

Mobile: drawer behind a button. Desktop: inline above the grid. Same `SearchPopUp` integration as Places. Same keyboard shortcuts (type-to-search, Esc to close).

### `objectsFilterData.js`

Exports five chip arrays, each chip `{key, label, icon, matchKey}`. `categoryChips` has 15 entries with 1:1 SVG mapping to `svg/<category>.svg`. `eraChips`, `provenanceChips` use small label-with-dot patterns; `specificityChips`, `usageChips` are minimal two/three-button toggles.

### Category icons (`svg/`)

15 SVGs, one per category: `animal.svg`, `building.svg`, `weapon.svg`, `food.svg`, `sacred-object.svg`, `money.svg`, `plant.svg`, `record.svg`, `metal.svg`, `tool.svg`, `apparel.svg`, `structure.svg`, `vehicle.svg`, `landscape.svg`, `armor.svg`. Style consistent with existing `views/People/svg/` icons (single-color, ~24×24 viewBox).

## Popup component (`PopUp.js` Object branch)

New function `Object({ appController })` added to `PopUp.js`, registered in the `if (type === "object")` branch alongside the existing Person/Place branches at `PopUp.js:101-115`.

Layout (mirrors Person at `PopUp.js:162-270`):

- Left pane: name + subtitle + description (HTML, run through `detectScriptures` + `renderPersonPlaceHTML` for inline scripture links).
- Right pane:
  - Image (with category-icon fallback, same as cards).
  - **Relationships** section: flat `<ul>` of xrels, each row `{rel-verb-badge} {dst_name} — {dst_title or note}`. Clicking a row with `dst_type ∈ {people, place, object}` swaps the popup to that entity via `setPopUp`. `group` rows are non-clickable.
  - **References** section: existing `<ReferenceList>` component unchanged.
- Bottom: `ScripturePanelSingle` slide-out (existing) + `Comments` (existing).

Pre-fetch on popup open: after loading the focal object, kick off `BoMOnlineAPI({ object: dstObjectSlugs })` for any `dst_type='object'` xrels so swap-clicks are instant. Matches the pattern at `PopUp.js:181-185`.

## Routing

Two new routes in `frontend/webapp/src/models/Routes.js` (alongside existing `/people` and `/places` entries):

```js
{ path: "/objects/:objectSlug", component: Objects },
{ path: "/objects", component: Objects },
```

`const Objects = lazy(() => import("../views/Objects/Objects.js"));` added near the other lazy imports.

## Preload

`GraphQLQueries.js` gains:

```js
object: (ids) => ({...})       // detail query, full Object + index + xrels
objectList: (ids) => ({...})   // light preload, slug/name/subtitle/category/era/provenance/specificity/usage/weight
```

`appController.js:363` gate (`appController.states.preloaded = true`) extended to require `objectList` alongside `personList` — so map preload doesn't regress on slow networks before objects arrive.

## Error handling & edge cases

- **Missing object slug** — `object(slug:["nonexistent"])` returns `[]`. No throw.
- **Xrel dst lookup miss** — graceful fallback to `dst_name = dst_slug`, `dst_title = null`, single-warn-per-slug.
- **Scripture parse failure in `xrel.note`** — `verse_id = null`, sorted to end. Try/catch around `lookupReference`.
- **Object with zero xrels** — render empty Relationships section with a label, not a missing div.
- **Object with 50+ xrels** (e.g., `house` w=235) — flat scroll inside right pane. No virtualization.
- **Filter produces zero results** — render "No objects match these filters — [clear]" empty state.
- **Group dst rows** — render plain-text, non-clickable, visually de-emphasized.
- **Image 404** — fallback to category SVG via `data-fallback` flag (no loop).

## Sandbox-mode interaction

Per `sandbox_mode_writes.md` memory: dev runs read-only via `sandboxMode.ts`. This feature is **read-only end-to-end** — no writes, no mutations. No sandbox guards needed.

## Public-repo redaction

Per `open_source_redaction.md` memory: this PR adds scholarly text only. No secrets, no internal hostnames, no private-workspace data. Safe for the public repo.

## Out of scope (deferred to future PRs)

- Image generation pipeline for `bom_objects` (Midjourney → `assetUrl/objects/<slug>` sprites).
- `bom_groups` canonicalization table for `dst_type='group'` xrel targets.
- Localization of the 29 rel-verb canonical vocabulary.
- Curation pass on broad generic-object refs (e.g., `sword`'s 127 refs).
- Admin/editing UI for objects (YAML→SQL pipeline remains the source of truth).
- Map/timeline integration for objects with location or temporal anchors.

## Testing

Per CLAUDE.md (`Currently minimal test coverage`), this PR follows the project's existing bar — no new test infrastructure. Verification:

- **Manual smoke** (documented in implementation plan):
  1. `/objects` loads, 198 cards visible, masonry grid renders.
  2. Filter by `weapon` (category) reduces grid to ~16 cards.
  3. Click `sword` → popup opens, description renders, xrels list shows wielded-by/used-against entries in verse_id order.
  4. Deep-link `/objects/liahona` → popup auto-opens with Lehi/Nephi/Mosiah ownership chain visible.
  5. Reader passagenotes side panel: navigate to `Alma 50:14` → objects panel shows expected entries alongside people/places.
- **No automated tests added** unless `/test/` already has a resolver-test pattern to mirror (verified at implementation time).
