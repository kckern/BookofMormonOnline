# Home Sampler — Wave 1 New Tiles Design

**Date:** 2026-07-16
**Status:** Implemented 2026-07-16 (plan: docs/plans/2026-07-16-home-sampler-wave1-tiles.md). All 5 tiles shipped to dev (local, unpushed).
**Author:** Claude (brainstormed with KC)

## Goal

Add five new content tiles to the `/home` sampler, surfacing data we already
hold but don't show, plus reviving a built-but-unregistered map tile. The five:

1. **Notes** — short scholarly annotations (the commentary rows the commentary tile discards)
2. **Verse-level Fax** — the facsimile page that depicts a specific verse
3. **Relationships** — typed connections between people/places/objects
4. **Map-story (MVP)** — a scripture journey drawn as a static path on a map
5. **Cross-references** — a verse and its scripture cross-references

## Non-Goals / Deferred

- **Trending Searches** — no search-query log table exists; searches aren't
  recorded anywhere. Requires standing up a logging pipeline first. Deferred to
  its own future spec (log now, harvest, then build the tile).
- **Map-story animation** — the MVP draws a *static* path (numbered stops + a
  connecting line + a move list). Sequenced/animated playback is a follow-on.
- **Cross-reference edition variants** — the `JST`/`1835`/`BOC`/`PGP`/`BoM`
  types in the crossref table are translation/edition variants, not
  cross-references; a "how this verse reads in the JST" tile is a separate idea.
- No changes to `Sampler.js` infinite-scroll plumbing beyond registry
  membership and one once-per-page feature-tile slot for map-story.

## Architecture (shared pattern)

Every tile follows the documented extension path in
`backend/src/graphql/resolvers/homesampler.ts` and `registry.js`:

1. **Sampler fn** in `homesampler.ts`, registered in the `samplers` map (seeded
   via `seededOrder(column, seed)` = `ORDER BY MD5(CONCAT(<pk>,':',<seed>))` for
   determinism), OR a bespoke query where noted.
2. **Field + type** on `backend/schema/HomeSampler.graphql`.
3. **Query field** added to the `homesampler` query in
   `frontend/webapp/src/models/GraphQLQueries.js`.
4. **Tile component** in `frontend/webapp/src/views/Home/tiles/`.
5. **Registry entry** in `frontend/webapp/src/views/Home/tiles/registry.js`
   (and, for map-story, a once-per-page placement rather than pool membership).

Run backend codegen after schema edits. Restart `bom-greenfield`
(`systemctl --user restart bom-greenfield && sleep 5`) to pick up backend
changes. All work stays local on dev until KC says to push.

### Placement in the sampler

- **Notes, Verse-fax, Relationships** → join the **infinite-scroll pool**
  (`INFINITE_REGISTRY_KEYS` in `Sampler.js`) alongside commentary/fax/etc. They
  are cheap, repeatable, and sampled fresh per batch-seed.
- **Map-story** → a **once-per-page feature tile** (not pool-repeated): it is
  expensive to render (OpenLayers) and singular in feel. Rendered below the fold
  like the existing (dead) MapTile intended.

---

## Tile 1 — Notes

**Bucket:** Coverage/Depth · **Effort:** Low

### Data
`bom_xtras_commentary` rows where `is_note = 1` — short annotations (7,712 rows,
avg 133 chars; 6,057 are G-rated English and >40 chars). These are the exact
rows the commentary loader and search **filter out** (`.where('is_note','!=',1)`).
They carry `verse_id` + `verse_range`, so a scripture reference is derivable.

### Backend
- `sampleNotes(ctx, seed)` — the `sampleCommentaries` query with the filter
  inverted: `is_note = 1` instead of `> 500 chars`, still joined to
  `bom_xtras_source` for `source_rating = 'G'` and `source_lang = lang`,
  `CHAR_LENGTH(text) > 40`, seeded order on `bom_xtras_commentary.id`, limit ~10,
  return the first 2 with **distinct source AND non-overlapping verse spans**
  (reuse the variety logic from `sampleCommentaries`).
- **Reuse the existing `Commentary` GraphQL type** — notes *are* commentary
  rows. `Commentary.reference` already resolves `verse_id`+`verse_range` →
  scripture ref via `generateReference`. Add field `notes: [Commentary]` to
  `HomeSampler`.

### Frontend
- New `NotesTile.js`, structured like `ImageArtTile.js`: for each of the 1–2
  notes render
  `<ScriptureExcerpt refText={note.reference} hideStudy />` (the passage, in the
  Read experience) followed by the annotation text (`note.text`, rendered
  verbatim — notes are short and pre-formatted). Deep-link the reference into
  context via `readPath(note.reference)`.
- Registry key `notes`, span `tile-notes` (new CSS class, sized like
  `tile-commentary`). Add `notes` to `INFINITE_REGISTRY_KEYS`.

### Acceptance
- Tile renders 1–2 notes, each showing the real verse text above the annotation.
- Notes shown are never full-length commentaries (all `is_note = 1`).
- Clicking the reference opens/deep-links the passage.

---

## Tile 2 — Verse-level Fax

**Bucket:** Coverage · **Effort:** Low–Moderate

### Data
`bom_xtras_fax_index` maps `(version, page) → verse_id`. Pick a verse that has an
indexed facsimile page; show that page image plus the verse it depicts. The
existing `sampleFaxPages` already demonstrates the page↔verse join.

### Backend
- `sampleFaxVerse(ctx, seed)` — query `bom_xtras_fax_index` joined to
  `bom_xtras_fax` (for `slug`, `title`, `format`, and `hide = 0`), seeded order,
  pick one row; compute `ref = generateReference([verse_id])`. Return
  `{ version, title, format, page, verseId, ref }`.
- New type `FaxVersePage { version: String, title: String, format: String,
  page: Int, verseId: Int, ref: String }` and field `faxVerse: FaxVersePage` on
  `HomeSampler`.

### Frontend
- New `FaxVerseTile.js`: shows the single page image
  (`${assetUrl}/fax/thumb/${version}/${nnn}.${format}`, `nnn` = zero-padded
  page) at natural aspect, the verse `ref` as an `openScripture(ref)` button
  (borrow the pattern from `FaxTile.js`), and a deep-link to
  `/fax/${version}/${page}`. Header links to `/fax/${version}`.
- Registry key `faxVerse`, span `tile-faxVerse`. Add to `INFINITE_REGISTRY_KEYS`.

### Acceptance
- Tile shows one facsimile page and the scripture reference it illustrates.
- Reference opens the scripture popup; page deep-links into `/fax/:version/:page`.
- Degrades to `null` (tile skipped) if no indexed page is sampled.

---

## Tile 3 — Relationships

**Bucket:** Depth · **Effort:** Moderate

### Data
`bom_xrels`: typed edges `(src_type, src_slug) --rel--> (dst_type, dst_slug)`
with optional `note` and a `verse_id` parseable from the note. Spans
people/places/objects (the current object loader only reads `src_type='object'`,
but the table is broader). `dst_name`/`dst_title` resolve from
`bom_people`/`bom_places`/`bom_objects`.

### Backend
- `sampleRelationship(ctx, seed)` — bespoke query (not the object-scoped
  loader): choose a well-connected hub. Approach: seeded-order `bom_xrels` by a
  hub key, take a hub `(src_type, src_slug)` that has ≥2 edges, fetch its edges
  (cap ~4), resolve `dst_name`/`dst_title` per `dst_type` (mirror
  `resolveXrel` in `objects.ts`), resolve the hub's own display name from its
  source table. Parse `verse_id` from the note where present
  (`parseVerseIdFromNote`) to build a `ref`.
- New types:
  `Relationship { hubType, hubSlug, hubName, hubTitle, edges: [RelEdge] }`,
  `RelEdge { rel, dstType, dstSlug, dstName, dstTitle, note, ref }`.
  Field `relationship: Relationship` on `HomeSampler`.

### Frontend
- New `RelationshipsTile.js`: a compact "connections" card — the hub entity as a
  heading (deep-linking to its profile: `/people/:slug`, `/places/:slug`,
  `/object/:slug` per `hubType`), then a list of edges: `rel` label + dst name
  (deep-linked to the dst profile by `dstType`), with the note as a subtitle and
  the `ref` (if any) as an `openScripture` link.
- Registry key `relationship`, span `tile-relationship`. Add to
  `INFINITE_REGISTRY_KEYS`.

### Acceptance
- Tile shows one hub entity and 2–4 typed connections, each deep-linking to the
  connected entity's profile.
- Edge notes render; references (where derivable) open the scripture popup.
- Hub `<->` dst profile routes resolve for all three entity types.

---

## Tile 4 — Map-story (static MVP)

**Bucket:** Depth · **Effort:** High (largest of the four)

### Data
`bom_map_move` rows (per-story ordered `seq`, `start`/`end` place names,
`travelers`, `description`, `duration`, `ref`, and start/end lat-lng in the
FARMS "internal" projection), grouped under a `bom_map_move`-derived story
(`slug`, `title`, `description`), plus people-per-move. Coordinates are in the
same non-geographic projection MapTileInner already renders.

### Backend
- `sampleMapStory(ctx, seed)` — pick a story with ≥2 moves (seeded), return the
  story metadata + its ordered moves (each with start/end coords, description,
  ref, travelers).
- New types:
  `MapStorySample { slug, title, description, moves: [MapMoveSample] }`,
  `MapMoveSample { seq, start, end, travelers, description, duration, ref,
  startLat, startLng, endLat, endLng }`.
  Field `mapstory: MapStorySample` on `HomeSampler`.

### Frontend
- New `MapStoryTile.js` + `MapStoryTileInner.js` (code-split via `React.lazy`,
  exactly like `MapTile`/`MapTileInner` so OpenLayers only loads when the tile
  renders). Reuse MapTileInner's map/tile-layer/view setup (`SLUG='internal'`,
  `XYZ` tiles from `${assetUrl}/map/internal/...`), and ADD:
  - a vector layer with a `LineString` connecting the ordered move coordinates,
  - numbered point features at each stop,
  - fit the view to the path extent.
  Below the map, a **move list** (seq → `start → end`, description, ref as an
  `openScripture` link). Header + CTA deep-link to `/map`.
- **NO animation** in the MVP — static path only.
- Registry: a **once-per-page** placement (feature tile below the fold), NOT a
  member of `INFINITE_REGISTRY_KEYS`. Registry key `mapstory`, span
  `tile-mapstory`. `isReady: (p) => (p?.mapstory?.moves?.length || 0) >= 2`.

### Acceptance
- Tile renders one journey: a path line through ≥2 ordered stops on the internal
  map, numbered markers, and a readable move list.
- OpenLayers loads only when the tile is shown (code-split verified).
- Appears at most once per page; map CTA links to `/map`.

---

## Tile 5 — Cross-references

**Bucket:** Depth · **Effort:** Low (reuses the Notes / ScriptureExcerpt pattern)

### Data
`lds_scriptures_crossref` (153k rows; the main-DB twin of
`` `scripture.guide`.scripture_references ``) holds footnote-style verse→verse
links: `src_verse_id`, `dst_verse_id`, `src_ref`, `dst_ref`, `type`,
`significant` (−1/0/1), `source`. There is **no topical title** in the data —
the "title" of a cross-reference is its scripture reference string (`dst_ref`).
Scope to `type = 'xref'`. NOTE (corrected during implementation): `significant`
is NOT an importance ranking — for `xref` rows it splits ~58k/51k across `-1`/`0`
(both `source='footnote'`), and `significant = 1` matches **zero** xref rows
(that value belongs to the edition-variant types). The tile therefore samples
**all** `type='xref'` rows and does not filter on `significant`, matching the
app's own passage-notes cross-reference display (`significant IN (0,1,-1)`).
Edition variants (`JST`, `1835`, `BOC`, `PGP`, `BoM`) are a different concept
(translation/edition variants) and are **out of scope** for this tile.

### Backend
- `sampleCrossRefs(ctx, seed)` — seeded-pick a `src_verse_id` that has ≥2
  `type='xref'` cross-references, fetch its dst rows (cap ~4, self-ref and
  duplicates removed), build refs via `generateReference`. Return the source ref
  + the destination cross-references.
- New types:
  `CrossRefSet { srcRef, srcVerseId, refs: [CrossRef] }`,
  `CrossRef { ref, verseId }`.
  Field `crossrefs: CrossRefSet` on `HomeSampler`.

### Frontend
- New `CrossReferencesTile.js`, structured like `NotesTile`: the **source
  passage** on top via `<ScriptureExcerpt refText={srcRef} hideStudy />`, then
  each cross-reference beneath — **titled by its reference** (`ref`, e.g.
  *"3 Ne 27:31"*) with the destination verse rendered via `ScriptureExcerpt`
  (or an `openScripture(ref)` link if rendering every dst passage is too tall).
- Registry key `crossrefs`, span `tile-crossrefs`. Add to
  `INFINITE_REGISTRY_KEYS`.

### Acceptance
- Tile shows one source passage and 2–4 cross-references, each labeled by its
  scripture reference.
- Only `type='xref'` links appear; no self-reference, no duplicate destinations.
- References deep-link / open the referenced passage.

---

## Testing

- **Backend:** unit-test each sampler for shape + invariants (Notes are all
  `is_note=1`; Relationship hubs have ≥2 edges; MapStory has ≥2 moves; Verse-fax
  ref matches its verse_id). Follow the existing `homesampler` test patterns.
  Run: `CI=true` backend jest suite for the sampler.
- **Frontend:** render tests per tile (jsdom) asserting the key elements appear
  given a mock payload, mirroring existing Home tile tests. Guard OpenLayers in
  jsdom (MapStoryTileInner should no-op or be excluded like other OL code).
  Run: `CI=true npx react-scripts test --testPathPattern="Home" --watchAll=false`.
- **Manual:** load `http://localhost:8200` (not `bom.kckern.net` — CDN-cached),
  confirm each tile appears in the pool / feature slot and deep-links work.

## File Manifest

**Backend**
- Modify: `backend/src/graphql/resolvers/homesampler.ts` (5 samplers + map entries)
- Modify: `backend/schema/HomeSampler.graphql` (fields + `FaxVersePage`,
  `Relationship`, `RelEdge`, `MapStorySample`, `MapMoveSample`, `CrossRefSet`,
  `CrossRef`)
- Codegen output regenerated

**Frontend**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js` (homesampler query fields)
- Modify: `frontend/webapp/src/views/Home/tiles/registry.js`
- Modify: `frontend/webapp/src/views/Home/Sampler.js` (`INFINITE_REGISTRY_KEYS`
  + map-story once-per-page slot)
- Modify: `frontend/webapp/src/views/Home/Sampler.css` (tile span classes)
- Create: `tiles/NotesTile.js`, `tiles/FaxVerseTile.js`,
  `tiles/RelationshipsTile.js`, `tiles/MapStoryTile.js`,
  `tiles/MapStoryTileInner.js`, `tiles/CrossReferencesTile.js`
