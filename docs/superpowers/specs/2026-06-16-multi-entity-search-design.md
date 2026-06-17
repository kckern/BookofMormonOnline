# Multi-Entity Search (Phase 2) — Design Spec

**Date:** 2026-06-16
**Status:** Approved (design); ready for planning
**Builds on:** `docs/superpowers/specs/2026-06-16-hybrid-search-rag-qdrant-design.md` (Phase 1, deployed/live)

## Summary

Extend search so a query returns more than verses. Index the remaining content/entity types into the existing Qdrant `bom_content` collection and add a new GraphQL `searchAll(query)` that returns results **grouped by type**. The frontend `Search.js` keeps the **verse list as the primary column** and renders a labeled section per non-empty group: **People, Places, Commentary, Narration, Pages, Events**. The existing `search` (verses-only) query is left untouched for backward compatibility.

## Background

Phase 1 stood up a hybrid (dense + sparse) Qdrant index (`bom_content`) and a shared `searchContent()` seam, currently populated with ~6,604 **verse** points only. The collection was designed multi-type from day one: every point carries a `type` payload field and `searchContent` already accepts a `types` filter. `Search.js` currently calls `{search: keyword}` and renders only verse cards. The GraphQL schema already defines entity types in `BomPeoplePlaces.graphql`, `BomPage.graphql`, `BomNotes.graphql`, `BomObjects.graphql`.

This phase indexes the other types and exposes them, grouped, in the search UI.

## Goals

- Index six additional types into `bom_content`: `person`, `place`, `commentary`, `narration`, `page`, `event`.
- Add `searchAll(query): SearchAllResult` returning results grouped by type, each group independently relevant.
- Render grouped sections in `Search.js` with type-appropriate cards and destinations, verses primary.
- Reuse the Phase-1 hybrid pipeline (one embed per query; sparse vector gives entity-name precision).

## Non-goals

- Changing the existing `search` (verses-only) query or `SearchResult` shape.
- A unified equal-weight interleaved result stream (explicitly rejected in favor of verses-primary + grouped).
- Incremental/real-time reindex on content edits (still a later phase; reindex stays a CLI run).
- Cross-language entity search beyond what each source table already supports.
- Multi-version expansion.

## Architecture

### `searchAll` resolver flow

1. **Embed the query once** (dense + sparse) — do not re-embed per group.
2. **Run one type-filtered Qdrant query per group in parallel**, reusing the single embedding: `verse`, `person`, `place`, `commentary`, `narration`, `page`, `event`. Each returns its own top-K (configurable; e.g. verses K=20, others K=8). This guarantees each section shows **its own** best matches and is never starved by verses dominating a single global ranking.
3. **Hydrate each group from MySQL** into display DTOs:
   - `verses` → existing `searchhist.ts` hydration + `dedupeByVerseKeepFirstLink` (unchanged).
   - other types → per-type loaders that turn Qdrant hits (`entity_id`, `slug`, `text`, `score`) into card DTOs.
4. **Return a `SearchAllResult`** grouped object. Empty groups return `[]`.

**Decision (approved):** per-group parallel queries (each section independently relevant) over one big ranked list grouped-and-capped. Cost is one embedding + ~7 fast vector searches per query.

To embed once and query many, the retrieval module gains an internal seam that separates query-vector construction from the Qdrant call (e.g. `searchVectors(query)` → `{dense, sparse}` and a `queryWithVectors(vectors, args)`), with `searchContent` composing the two. `searchAll` builds vectors once and fans out `queryWithVectors` per type.

### Indexing the new types

Extend the indexer with a **pure builder per type** (`<type>ToPoints(row) → IndexPoint[]`) that reuses `pointId(type, entity_id, chunkIndex)`, `chunkText`, and `textToSparse`, plus a generic `reindexType(db, typeConfig)` driver. The reindex CLI runs verses + all six new types (idempotent via deterministic point IDs).

| Type | Source (MySQL) | Embedded text | Payload `slug`/destination |
|---|---|---|---|
| person | people table (`BomPeoplePlaces`) | name + aliases + title/role | person slug → person popup |
| place | places table (`BomPeoplePlaces`) | name + aliases | place slug → place/map route |
| commentary | notes/commentary (`BomNotes`) | note body (chunked) | location slug → reading/commentary |
| narration | `bom_narration` | narration description | page slug → study page |
| page | `bom_page` + section titles | page title + section title | page slug → study page |
| event | timeline/history events | title + teaser | timeline link |

The exact source columns and destination routes per type are confirmed during planning by reading the schema/loaders (e.g. `BomPeoplePlaces.graphql`, the timeline/history loaders) — the contract each builder must satisfy is fixed here: produce `{ type, entity_id, text, slug, lang, version:null }` + dense + sparse vectors. Long-form types (commentary) are chunked; short ones (person/place/page/narration/event titles) are single-chunk.

### GraphQL schema

```graphql
type SearchAllResult {
  verses: [SearchResult!]!
  people: [PersonResult!]!
  places: [PlaceResult!]!
  commentary: [CommentaryResult!]!
  narration: [NarrationResult!]!
  pages: [PageResult!]!
  events: [EventResult!]!
}

type Query {
  searchAll(query: String!): SearchAllResult!
}
```

- `verses` reuses the existing `SearchResult`.
- `PersonResult`/`PlaceResult` reuse existing `Person`/`Place` types from `BomPeoplePlaces.graphql` where their fields suffice; otherwise a thin result type wraps `{ slug, name, score, … }`.
- `CommentaryResult`/`NarrationResult`/`PageResult`/`EventResult` carry the minimum a card needs: a title/snippet, a `slug`/destination, and `score`.
- The existing `search(query): [SearchResult]` is unchanged.

### Frontend (`frontend/webapp/src/views/Search/Search.js`)

- Switch the result fetch from `{search}` to `searchAll` (the numeric-lookup branch that redirects to a slug is unchanged).
- **Verses** remain the primary column with the current card (untouched).
- Below verses, render a **labeled section per non-empty group** in this order: People, Places, Commentary, Narration, Pages, Events. Each section:
  - has a header with the group label + count,
  - renders type-appropriate cards:
    - **People** → portrait chip → existing person popup (`appController.functions.setPopUp({ type: 'people', ids: [slug] })`).
    - **Places** → name chip → place/map route.
    - **Commentary** → text-snippet card with `highlight(keyword, …)` → location.
    - **Narration / Pages** → title cards → study page slug.
    - **Events** → title + date → timeline link.
  - caps at top-K with an optional "show more"; empty groups render nothing.
- Card components live in small focused files (e.g. `Search/cards/PersonCard.js`, `PlaceCard.js`, `ContentCard.js` for the text-snippet types, `EventCard.js`) rather than one growing `Search.js`. A `ResultGroup` wrapper renders header + list.

## Error handling

- `searchAll` wraps the Qdrant fan-out so a failure of any single group degrades that group to `[]` (never breaks the whole response); the verses group additionally falls back to the legacy `LIKE` path (Phase-1 behavior).
- If `SEARCH_BACKEND=like` (Qdrant off), `searchAll` returns verses via `LIKE` and empty non-verse groups (those types only exist in Qdrant) — documented, not an error.
- Frontend renders only non-empty groups, so partial failures simply show fewer sections.

## Testing

- **Unit (no infra):** each `<type>ToPoints` builder (row → IndexPoint, deterministic id, correct slug/text); the group-and-cap/ordering logic; hit→DTO mappers per type.
- **Integration (skip-if-unreachable):** reindex a small fixture per type into a local Qdrant; assert `searchAll` returns the expected groups for a known query (e.g. "abinadi" → person Abinadi in `people`, relevant verses in `verses`).
- **Frontend:** a render test for `Search.js`/`ResultGroup` given a mocked `searchAll` payload — verifies verses-primary + one section per non-empty group + empty groups omitted.
- **Regression:** existing verse search, dedupe, and Phase-1 search tests stay green; `search` query unchanged.

## Build order (within this spec)

1. Backend: indexer adapters for the six types + reindex CLI extension → `queryWithVectors` seam → `searchAll` resolver + schema + per-type hydration.
2. Reindex to populate the new types into Qdrant (ops step, like Phase-1 activation).
3. Frontend: `searchAll` fetch + `ResultGroup` + per-type cards in `Search.js`.

## Explicit decisions

1. **Verses primary + grouped extras** (not interleaved-equal, not entity-first panel).
2. **All six groups** in scope: People, Places, Commentary, Narration, Pages, Events — **Narration and Pages are separate sections**.
3. **Approach A**: one hybrid Qdrant index for all types; **per-group parallel filtered queries** (one embed, fan out), each section independently relevant.
4. **New `searchAll` query** returning a grouped object; existing `search` untouched.
5. Sparse (keyword) vectors provide entity-name precision; dense provides concept matching — so no separate structured name-lookup path is needed.
