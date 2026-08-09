# Matters Home Tiles — Design Spec

**Date:** 2026-08-08
**Status:** Approved for planning
**Author:** Claude (brainstormed with KC)

## Summary

Add Matters to the `/home` sampler as a third entity family alongside People and
Places. `bom_matters` is not one flat collection — it splits into three groups
with genuinely different natures, so it gets three distinct **grid** tiles plus
one shared **singleton** profile tile, mirroring the existing
`PeopleTile`/`PersonProfileTile` and `PlacesTile`/`PlaceProfileTile` precedent.

## The three groups

The split is `bom_matters.branch` × `bom_matters.specificity`. Counts are from the
live dev DB (476 matters total, 2026-08-08):

| # | Group | Rule | Count | Nature | Exemplars |
|---|-------|------|------:|--------|-----------|
| 1 | **Narrative / Concrete** | `branch='concrete'` AND `specificity='instance'` | 161 | Named artifacts anchored to specific verses/moments | Plates of Brass (33 refs), Liahona, Lehi's Tent, Prison of Middoni |
| 2 | **Material / Indefinite** | `branch='concrete'` AND `specificity IN ('class','theme')` | 198 | Typological classes; ubiquitous (high ref counts) | Swords (118), Houses (69), Flocks (61), Gold (56) |
| 3 | **Concept** | `branch='concepts'` | 123 | Abstractions; richness in relationships + prose, not one verse | Judgment Seat (45), Warfare, Government, Family, Oaths |

The `branch × specificity` cross-tab proves the rule is total and
non-overlapping — every matter lands in exactly one group:

| branch | specificity | count | → group |
|--------|-------------|------:|---------|
| concrete | instance | 161 | 1 (Narrative) |
| concrete | class | 192 | 2 (Material) |
| concepts | class | 117 | 3 (Concept) |
| concepts | theme | 6 | 3 (Concept) |

Group 1 = 161, Group 2 = 192, Group 3 = 117 + 6 = 123. Total 476. ✔
(There are no `concrete/theme` rows, so the Material predicate
`branch='concrete' AND specificity IN ('class','theme')` is equivalent to
`branch='concrete' AND specificity!='instance'`; either form is fine.)

Every matter has a real image asset at
`https://media.bookofmormon.online/matters/<slug>` (concepts included), with the
existing gradient+initials fallback (`slugGradient`/`entityInitials` in
`views/_Common/EntityThumb`). Imagery is available to all three tiles; the
differentiator is **content shape**, not asset availability.

## Components (Option A — 3 grids + 1 singleton)

All live in `frontend/webapp/src/views/Home/tiles/`.

### 1. `MattersNarrativeTile.js` — "Artifacts" (grid)
Places-style image mosaic. Each card: image with name overlay + the key
scripture ref from the matter's `index` (first indexed verse) + a short index
snippet in the chrome. ~5 cards + a 3×4 "much more" mosaic end cell → `/matters`.
Heading links to `/matters`. Card click → `/matters/<slug>` (opens the matters
popup, consistent with the Matters index page).

### 2. `MattersMaterialTile.js` — "The Material World" (grid)
Same skeleton as Narrative, but ubiquity-forward: lead with a **ref-count badge**
(`nrefs`, e.g. "118×") and the `subtitle` instead of a single arbitrary verse
(these classes appear everywhere, so one verse is not representative). Image +
name overlay + ref-count badge + subtitle. Mosaic end cell → `/matters`.

### 3. `MattersConceptTile.js` — "Ideas & Beliefs" (grid, text-forward)
Concepts read poorly as thumbnail mosaics, so cards are text-forward: name +
subtitle + a short `description` snippet (with live scripture links via
`getDetectedScripturesHtml`), image demoted to a muted background. Mosaic end
cell → `/matters`.

### 4. `MatterProfileTile.js` — singleton (reserve/batch pool)
One hero matter, mirroring `PlaceProfileTile`: hero image + name + subtitle +
`description` with detected scripture links (`ExpandableText`), the matter's
verse-span (from `index`), and its `xrels` relationships rendered as a small
"Linked ▸ …" row (people/places/matters, each linking to its own entity).
`TileDeepLink` → `/matters/<slug>`. Takes a `group` prop
(`narrative|material|concept`) and reads the matching payload array, picking an
index the grid tile didn't feature (same pattern as `personIndex`/`placeIndex`).
Default registration features a **concept** (the group that benefits most from
the singleton treatment); more group instances can be added later.

Reuse the shared card CSS classes already used by People/Places
(`samplerTileInner`, `tileHeading`, `samplerCard`, `viewAllCard`,
`viewAllMosaic`, `peopleFaceName`, name/info overlays) so the three tiles share
one visual language; add matters-specific class hooks only where behavior
differs (e.g. `.mattersRefBadge`, `.conceptCardBody`).

## Backend / GQL

Extend the "add a field + a sampler fn" path in
`backend/src/graphql/resolvers/homesampler.ts` and
`backend/schema/HomeSampler.graphql`. Reuse the existing `Matter` type — its
resolvers already provide translated `name/subtitle/description`, the
`index` (verse refs), and `xrels` (relation names resolved).

New `HomeSampler` fields:
```graphql
mattersNarrative: [Matter]     mattersMaterial: [Matter]     mattersConcept: [Matter]
mattersNarrativeCount: Int     mattersMaterialCount: Int     mattersConceptCount: Int
```

Samplers mirror `samplePeople`:
```
SELECT <matter columns>
FROM bom_matters
WHERE <group predicate>            -- see rules above
  AND name IS NOT NULL
ORDER BY MD5(CONCAT(slug, ':', seed))
LIMIT ~17
```
Return raw `bom_matters` rows; the `Matter` field resolvers (name/subtitle/
description/index/xrels) run over them exactly as the standalone `matter` query.
Count fns follow `countRows` (add `bom_matters` with the group predicate, or one
`matterCountByGroup` helper).

Register all six in the `samplers` map.

## Frontend wiring

- **`GraphQLQueries.js`** `homesampler` query: add
  `mattersNarrative { slug name subtitle nrefs era_culture index { ref slug text } }`,
  `mattersMaterial { slug name subtitle nrefs era_culture index { ref slug } }`,
  `mattersConcept { slug name subtitle description nrefs xrels { rel dstType dstSlug dstName ref } index { ref slug } }`,
  and the three `*Count` scalars.
- **`registry.js`**: append 3 entries to `tileRegistry` (keys
  `mattersNarrative`, `mattersMaterial`, `mattersConcept`, each with an
  `isReady` guarding a non-empty array) and add `MatterProfileTile` to
  `reservePool` and `batchTiles` (like `placeProfile`). Add the new keys to
  `INFINITE_REGISTRY_KEYS` so grids re-sample on infinite scroll.
- **`Sampler.css`**: add `tile-mattersNarrative`, `tile-mattersMaterial`,
  `tile-mattersConcept`, `tile-matterProfile` span classes (start from the
  `tile-places` / `tile-placeProfile` footprints).
- **Cache**: bump the sampler cache key `v1 → v2` in `homesampler.ts` so cached
  6h buckets don't serve payloads missing the new fields.

## Testing

- Backend: extend the homesampler resolver test to assert each group sampler
  returns only rows matching its `branch`/`specificity` predicate and respects
  the seed (determinism), following the existing people/places sampler tests.
- Frontend: extend `Sampler`/`assemblePayload` tests so the three new registry
  keys render when their arrays are present and are skipped (via `isReady`) when
  empty. Snapshot the three tiles with representative fixtures.

## Out of scope

- No changes to the `/matters` index view, filters, or the matters popup.
- No new `bom_matters` columns; the grouping is derived from existing
  `branch`/`specificity` values.
- Per-group singletons beyond the single shared `MatterProfileTile` (can be
  added later by registering more instances with different `group` props).
