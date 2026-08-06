# Advanced (Topical) Search — Design

**Date:** 2026-08-06
**Status:** Approved (design) — ready for implementation plan
**Related:** [`2026-06-16-hybrid-search-rag-qdrant-design.md`](2026-06-16-hybrid-search-rag-qdrant-design.md), [`2026-06-16-multi-entity-search-design.md`](2026-06-16-multi-entity-search-design.md), [`2026-06-17-keyword-first-search-design.md`](2026-06-17-keyword-first-search-design.md)

## Problem

Plain string search over Book of Mormon verses is sufficient for the common case. But sometimes a user wants a broader, *topical* search that also reaches supplemental content — commentary, people, places, events, and topical "matters."

That capability already exists in code (hybrid dense+sparse Qdrant retrieval across seven content types via `searchContent()`), **but it is gated behind an accident**: the supplement/semantic path only fires when keyword search returns **zero** verse hits. Users never see it deliberately.

This work turns that accidental fallback into a **deliberate, user-controllable mode**, and adds one new corpus (Matters) to what it can reach.

## Decisions (locked during brainstorming)

1. **Richer retrieval, not generation.** Results are ranked verses + supplement *cards*. No LLM-composed answers. (True generative RAG remains a StudyBuddy-bot concern only.)
2. **Trigger model:**
   - Default = plain verse keyword search (cheap, predictable).
   - Explicit user **toggle** turns on rich/topical search.
   - **Auto-fallback** to rich when keyword search returns **0** verses (existing behavior — preserved).
   - **Offer** (banner, not auto) rich search when keyword search returns **100+** verses (an unranked flood semantic ranking can tame).
3. **Layout:** grouped by type (verses on top, labeled supplement sections below). Matches the existing `ResultGroup` UI.
4. **Corpora — this round:** the existing seven (verses, people, places, commentary, narration, pages, events) **plus Matters** (`bom_matters`). **Dictionary is a fast follow** (deferred — see below). **Theology is out of scope** (no resolver/slug; its own future project).

## Non-goals (YAGNI)

- ❌ Generative / LLM answer synthesis on the search page.
- ❌ Theology corpus (`bom_theology`) — has no GraphQL resolver and no URL slug; results would be dead-ends. Deferred to a dedicated "theology domain" project.
- ❌ Dictionary corpus (`bom_xtras_dictionary`) **in this round** — it needs a net-new resolver + `/dictionary/<word>` route to be clickable. Split into a fast-follow so this round adds **zero new user-facing routes**.
- ❌ Unified/interleaved or faceted/tabbed result layouts.
- ❌ Cross-references, reading plans, media (image/audio/video/fax), timeline, chiasmus, markdown.

## Architecture

### Backend — decouple "rich" from "fallback"

`searchAll` gains a **`mode` argument**: `keyword` (default) | `rich`.

| Mode | Verses | Supplement groups | When |
|---|---|---|---|
| `keyword` | MySQL `LIKE`, unranked | none | default — every search |
| `keyword` → auto-fallback | (on 0 hits) semantic | yes | keyword finds 0 verses (existing) |
| `rich` | semantic, ranked (`searchContent`) | yes (all types incl. matters) | user toggles it, or clicks the "100+" banner |

**Resolver behavior** (`backend/src/graphql/resolvers/searchhist.ts`):
- `mode: 'keyword'` (default): run keyword candidate search as today. If 0 verse candidates, fall back to `searchContent` + `searchGroups` and set `semantic: true` (unchanged). Otherwise return keyword verses, `semantic: false`, no groups.
- `mode: 'rich'`: always run `searchContent` across all content types, rank verses semantically, and return all supplement groups via `searchGroups`. `semantic: true`.

**Response additions** (GraphQL type + `GraphQLQueries.js`):
- `semantic: Boolean` — did vector retrieval run (already present).
- `verseTotal: Int` — raw keyword candidate count, so the frontend can decide whether to show the "100+" banner **without** paying any vector cost. Computed from the keyword candidate id list (count before hydration/limit).
- `matters` group added to the result type, parallel to `people`/`places`/etc.

### New corpus — Matters adapter

Add to `backend/src/search/adapters.ts` and register in `TYPE_CONFIGS`:

```
loadMatters(bom_matters):
  entity_id = slug
  title     = name
  text      = join(name, subtitle, description, aliases, tags, terms)
  slug      = `matters/<slug>`     // confirm exact route at plan time
  ref       = null
  chunk     = true (description can be long; maxChars 600 like commentary)
```

- Add `'matter'` handling to `searchGroups()` so rich mode returns a `matters` group.
- Reindex via the existing idempotent `backend/scripts/reindex-search.ts` (deterministic UUIDv5 point IDs → safe partial reindex, no duplicates). Add Matters to the reindex run.

**Plan-time verification:** confirm the canonical Matter detail route/slug format (the frontend route that renders a `bom_matters` row) before finalizing the adapter `slug`. `bom_matters` has a GraphQL resolver and cross-refs already, so a route exists — the exact prefix must be confirmed, not assumed.

### Frontend (`frontend/webapp/src/views/Search/`)

- **Mode toggle** in the search header: `Verses` ⟷ `Everything` (topical). Mode carried in the URL as a query param (`?mode=rich`) so results are shareable and back-button-safe. `Search.js` reads mode from the route and passes it to the `searchAll` call.
- **0 results:** unchanged — server auto-fallback returns groups with `semantic: true`; existing rendering already handles this.
- **100+ results:** when `mode === 'keyword'` and `verseTotal > 100`, render a banner under the results heading: *"100+ matches — try topical search to rank by relevance."* One click re-runs the query with `mode=rich`.
- **New card kind:** add `matter` to the `CARD` map in `ResultGroup.js` (reuse the `ContentCard` shape; add a `MatterCard`/chip only if a distinct visual is wanted). `ResultGroup` is already generic over `kind`, so this is additive. Add a `matters` `<ResultGroup>` in `Search.js` alongside the existing groups.

### Error handling / graceful degradation

Rich mode must never white-screen if Qdrant or OpenAI embeddings are unavailable. Wrap the rich path so a vector-backend failure **degrades to keyword verses + empty supplement groups**, sets `semantic: false`, and surfaces a soft toast. This mirrors the existing contract that `retrieveChunks` never throws (returns `[]` on failure).

## Data flow

```
User types query ──► Search.js reads ?mode (default keyword)
       │
       ├─ mode=keyword ─► searchAll(query, mode:keyword)
       │      backend: getCandidateVerseIds (LIKE)
       │        ├─ 0 hits  ─► searchContent + searchGroups  (semantic:true, groups)
       │        └─ N hits  ─► hydrate verses (semantic:false, verseTotal:N)
       │             frontend: if verseTotal>100 ─► show "topical search" banner
       │
       └─ mode=rich ────► searchAll(query, mode:rich)
              backend: searchContent (dense+sparse, RRF) across ALL types
                       + searchGroups (people, places, commentary, narration,
                                       pages, events, matters)
              frontend: grouped rendering (verses on top, sections below)
```

## Testing strategy

- **Unit (backend):** `mattersRowToSource` mapper — mirrors existing adapter mapper tests (field joins, slug prefix, null handling).
- **Resolver (backend):** `mode` routing (keyword vs rich); `verseTotal` reporting; the 100+ threshold boundary; the degradation path when the vector backend is unreachable (returns keyword verses, `semantic:false`, empty groups, no throw).
- **Indexing (backend):** Matters rows upsert into `bom_content` with `type='matter'`; rich query returns a non-empty `matters` group for a known topical query.
- **Frontend:** toggle flips mode and updates the URL; the "100+" banner appears when `verseTotal>100` and re-runs in rich mode on click; the `matter` card kind renders inside `ResultGroup`.

## Fast follow (next round, separate spec)

- **Dictionary** (`bom_xtras_dictionary`): add a minimal `dictionaryEntry(slug)` GraphQL resolver + `/dictionary/<word>` frontend route, then a `loadDictionary` adapter and a `dictionary` group. Deferred here to keep this round route-free.

## Open items to confirm at plan time

1. Exact Matter detail route/slug prefix (for adapter `slug` and card links).
2. The 100+ threshold constant and where it lives (backend resolver vs frontend). Default proposal: **100**, evaluated on `verseTotal`, decision made on the frontend.
3. Whether Matters needs a distinct card visual or can reuse `ContentCard`.
