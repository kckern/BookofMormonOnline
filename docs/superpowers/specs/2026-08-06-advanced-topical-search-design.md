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

**Where the work actually lives — this is a loader refactor, not a resolver branch.**
The resolver (`searchAllResolver`) is thin; verse candidate resolution, hydration, and ranking all live in `searchQuery()` → `resolveCandidates()` in `backend/src/data/loaders/searchhist.ts`. Today `resolveCandidates` hard-codes keyword-first and does not expose a way to force the semantic tier through `searchQuery`. **Rich mode means threading `mode` down into `searchQuery`/`resolveCandidates`** so it can run the semantic tier directly. The ranking machinery already exists and is reused as-is (`hitsToRankedVerseIds`, `rankRowsByCandidateOrder`) — the new work is the plumbing to *reach* it, plus the hydration cap below.

**Resolver/loader behavior:**
- `mode: 'keyword'` (default): run keyword candidate search as today, but **cap hydration** (see below). If 0 verse candidates, fall back to `searchContent` + `searchGroups`, `semantic: true` (unchanged). Otherwise return the capped keyword verses, `semantic: false`, no groups, plus `verseTotal`.
- `mode: 'rich'`: run `searchContent` across all content types (verses semantically ranked via the existing rank helpers) and return all supplement groups via `searchGroups`. `semantic: true`.

**Cap the flood (perf + justifies `verseTotal`).** `getCandidateVerseIds` (`loaders/searchhist.ts:96`) has **no LIMIT**, and `Search.js:92` renders `verses.map(...)` unvirtualized — searching a common word (`"the"`) hydrates thousands of rows through ~10 batch queries and paints them all. This round **caps keyword hydration at `VERSE_CAP` (proposed 100)**. That both fixes the pathology and gives `verseTotal` a real job.

**Response additions** (GraphQL SDL `backend/schema/BomUtils.graphql` + `GraphQLQueries.js`):
- `semantic: Boolean` — did vector retrieval run (already present).
- `verseTotal: Int` — the **raw candidate count before the cap**. Needed precisely *because* hydration is now capped: `verses.length` maxes out at `VERSE_CAP` and no longer reflects the true match count, so the frontend can't derive "there are 347 matches" from the array. `verseTotal` carries that number for the banner. (Without the cap this field would be redundant with `verses.length` — the cap is what earns it.)
- `matters` group added to the result type, parallel to `people`/`places`/etc.

**Lockstep edits for the new `matter` type / `verseTotal` / `mode`** (miss one and it silently breaks): `ContentType` union (`backend/src/search/types.ts`), the hard-coded empty-groups object in the resolver (`searchhist.ts:~118`), `SearchAllResult` SDL (`backend/schema/BomUtils.graphql`), `TYPE_CONFIGS` + the new adapter, and the frontend query string (`GraphQLQueries.js:578`). Note the codegen snapshot already lags the SDL (`searchAll` is injected untyped, `searchhist.ts:101–133`); the plan must either regenerate codegen or accept more `Record<string, unknown>` surgery.

### New corpus — Matters adapter

Add to `backend/src/search/adapters.ts` and register in `TYPE_CONFIGS`:

```
loadMatters(bom_matters):
  entity_id = slug                 // route key; see uniqueness note below
  title     = name
  text      = join(name, subtitle, description, aliases, tags)   // NO `terms` col — bom_matters has none
  slug      = `matters/<slug>`     // route CONFIRMED: /matters/:matterSlug (Routes.js:246)
  ref       = null
  chunk     = true (description can be long; maxChars 600 like commentary)
  filter    = status (see below)
```

Verified against `codegen/db.d.ts` `BomMatters`: columns are `name, subtitle, description, aliases, tags, status, slug, guid, weight, verse_id, …`. There is **no `terms` column** — the earlier draft invented it.

- **`status` filter:** `bom_matters.status` exists (draft/published states). Indexing everything would surface unpublished matters in search. **Decision: index only published matters**; confirm the exact published-status value(s) at plan time.
- **`slug` uniqueness:** point IDs are deterministic UUIDv5 keyed on `entity_id`. The Matters resolver (`mattersBySlugs`) orders by `weight DESC`, which implies slug may not be unique per row. If duplicates exist, dedupe at index time keeping the highest-`weight` row (matches resolver precedence) so collisions don't silently overwrite. Confirm uniqueness at plan time.
- Add `'matter'` to `searchGroups()` (see below) so it returns a `matters` group.
- Reindex via the existing idempotent `backend/scripts/reindex-search.ts` (deterministic UUIDv5 point IDs → safe partial reindex). Add Matters to the reindex run.

**`searchGroups` has no type-filter — it iterates a module constant.** Adding `'matter'` to that list means it also appears in the **zero-hit keyword fallback** groups, not only rich mode. That is intentional and consistent with the mode table above, but call it out: the same edit lights up matters in both paths.

### Frontend (`frontend/webapp/src/views/Search/`)

- **Mode toggle** in the search header: `Verses` ⟷ `Everything` (topical). Mode carried in the URL as a query param (`?mode=rich`) so results are shareable and back-button-safe. `Search.js` reads mode from the route and passes it to the `searchAll` call.
- **0 results:** unchanged — server auto-fallback returns groups with `semantic: true`; existing rendering already handles this.
- **100+ results:** when `mode === 'keyword'` and `verseTotal > VERSE_CAP`, render a banner under the results heading. One click re-runs the query with `mode=rich`. **Copy must be honest about the cap:** rich mode returns the top ~50 per type (`searchContent` default `limit: 50`), so the banner says something like *"Showing the first {VERSE_CAP} of {verseTotal} matches — switch to topical search to rank the most relevant."* Not "see all results." The rich-mode per-type limit is **pinned at 50** for this round; surface it in copy if the group is truncated.
- **New card kind:** add `matter` to the `CARD` map in `ResultGroup.js` (reuse the `ContentCard` shape; add a `MatterCard`/chip only if a distinct visual is wanted). `ResultGroup` is already generic over `kind`, so this is additive. Add a `matters` `<ResultGroup>` in `Search.js` alongside the existing groups.

**Frontend plumbing is not free — three crusty seams must be touched:**
1. **Arg passing.** `queries.searchAll(query)` is single-arg and `prepareQueries` dispatches on *function arity* with `q()` taking one key/val pair (`GraphQLQueries.js:2178`). Adding `mode` means reworking that seam; `BoMOnlineAPI.structureResults` keys results positionally and is documented as able to break the whole app if response keys shift — change it deliberately.
2. **Search box drops the query string.** `searchFor()` pushes `/search/<slug>` with no `?mode`, so a fresh search from the box silently reverts to keyword. It must preserve (or intentionally reset) the mode.
3. **Refetch dependency.** The fetch `useEffect` is keyed on `[keyword]` only (`Search.js:105`); flipping mode with the same keyword won't refetch. Add `mode` to the dependency array.

### Error handling / graceful degradation

`searchContent` **throws by design** when Qdrant/OpenAI embeddings are unavailable (`retrieve.ts:64` — *"Throws … caller falls back"*). Every caller already wraps it: `resolveCandidates` and `searchGroups` (backend) and `retrieveChunks` (`bots/mastra/rag.ts:41`, never-throws → `[]`) all try/catch and degrade. The rich path follows the same contract: on vector-backend failure it **degrades to keyword verses + empty supplement groups** and sets `semantic: false`.

**Degraded-rich signaling contract:** the frontend detects a degraded rich search as **`mode === 'rich' && semantic === false`** and shows a soft toast (*"Topical search is unavailable — showing keyword matches"*) rather than silently pretending the rich query succeeded.

## Data flow

```
User types query ──► Search.js reads ?mode (default keyword)
       │
       ├─ mode=keyword ─► searchAll(query, mode:keyword)
       │      backend: getCandidateVerseIds (LIKE, verseTotal = raw count)
       │        ├─ 0 hits  ─► searchContent + searchGroups  (semantic:true, groups)
       │        └─ N hits  ─► hydrate FIRST min(N, VERSE_CAP) (semantic:false, verseTotal:N)
       │             frontend: if verseTotal>VERSE_CAP ─► show "topical search" banner
       │
       └─ mode=rich ────► searchAll(query, mode:rich)
              backend: searchContent (dense+sparse, RRF) across ALL types
                       + searchGroups (people, places, commentary, narration,
                                       pages, events, matters)
              frontend: grouped rendering (verses on top, sections below)
```

## i18n & language coverage

- **Banner + toggle copy** must go through `label()` like every other string in `Search.js` — no hard-coded English. New label keys needed for the toggle labels and banner text.
- **Non-English rich mode depends on index coverage.** Keyword search handles non-English via `lds_scriptures_translations`, but rich/`searchContent` only returns what's in the Qdrant `bom_content` index. Verses carry a `lang`/`version` payload filter; **supplement types (including Matters) are indexed from source tables that may be English-only.** State the coverage explicitly in the plan: for non-`en` sessions, rich mode may return verses in-language but supplement groups sparse/empty. Acceptable for this round; do not silently imply full multilingual topical search.

## Testing strategy

- **Unit (backend):** `mattersRowToSource` mapper — field joins (no `terms`), `matters/<slug>` prefix, null handling, `status` filter, slug-dedup-by-weight.
- **Backend loader/resolver:** `mode` routing (keyword vs rich); `verseTotal` = raw candidate count while hydrated `verses.length` is capped at `VERSE_CAP`; the degradation path when the vector backend throws (returns keyword verses, `semantic:false`, empty groups, no throw).
- **Indexing (backend):** Matters rows upsert into `bom_content` with `type='matter'`; rich query returns a non-empty `matters` group for a known topical query.
- **Frontend:** the banner-threshold decision lives **on the frontend** (`verseTotal > VERSE_CAP`) — test it there, not in a backend resolver test. Toggle flips mode + updates the URL; `searchFor()` preserves mode; refetch fires on mode change with same keyword; degraded-rich (`mode==='rich' && !semantic`) shows the toast; the `matter` card kind renders inside `ResultGroup`.

## Fast follow (next round, separate spec)

- **Dictionary** (`bom_xtras_dictionary`): add a minimal `dictionaryEntry(slug)` GraphQL resolver + `/dictionary/<word>` frontend route, then a `loadDictionary` adapter and a `dictionary` group. Deferred here to keep this round route-free.

## Open items to confirm at plan time

1. `VERSE_CAP` value (proposed **100**) — the keyword hydration cap, the banner threshold, and the "first N of M" copy all key off it.
2. The published-`status` value(s) to filter Matters on, and whether `bom_matters.slug` is unique (drives the dedupe-by-weight decision).
3. Whether Matters needs a distinct card visual or can reuse `ContentCard`.
4. Codegen: regenerate the SDL snapshot for `mode`/`verseTotal`/`matters`, or extend the existing untyped-injection hack.

_(Resolved during review: Matter route is `/matters/:matterSlug` → adapter slug `matters/<slug>`. `bom_matters` has no `terms` column. `searchContent` throws by design; the never-throw precedent is `retrieveChunks`/`searchGroups`/`resolveCandidates`.)_
