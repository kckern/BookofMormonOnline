# Keyword-First Search (Semantic Fallback) — Design Spec

**Date:** 2026-06-17
**Status:** Approved (design); ready for planning
**Supersedes the search ordering of:** the hybrid/multi-entity/highlighting work (Qdrant-primary). Those stay built; this re-tiers them.

## Summary

Make **literal keyword search the primary path** and **semantic (embedding) search a fallback that runs only when the keyword search returns zero verse matches.** Today `searchAll` embeds the query on every search (Qdrant-primary verses + always-on `searchGroups` + eager highlight), which makes semantic-style queries take ~1.8s. After this change, a normal keyword search runs a fast MySQL `LIKE` with no embeddings (~0.3s); only a query with **zero literal verse matches** (e.g. `afterlife`) falls through to the semantic path (Qdrant verses + entity groups + lazy highlighting). This both matches the product priority (most users search specific keywords) and removes the eager-highlight latency regression.

## Background

- `searchAll` → `searchAllResolver` currently calls `searchQuery` (verses) + `searchGroups` (6 entity groups) in parallel; both embed the query (Qdrant). `searchQuery` → `resolveCandidates` is **Qdrant-first** (uses the vector index when `SEARCH_BACKEND=qdrant`, LIKE only as a failure fallback). An eager highlight block then embeds clause-spans for the top-N. Measured: `afterlife` ~1.8s vs `charity` (keyword-overlap → highlight skipped) ~0.55s.
- The product priority: keyword matches are what most users want; the conceptual/LLM/token search should be a fallback, not the default.

## Goals

- Verse search: **`LIKE` first; semantic (Qdrant) only when `LIKE` returns zero.**
- Entity groups (people/places/commentary/narration/pages/events) and semantic highlighting appear **only in the semantic-fallback path**.
- Remove the eager highlight block from `searchAll` (highlighting is lazy, and only in semantic mode).
- Expose a `semantic: Boolean` flag on the result so the client knows which mode it got.
- Keyword searches do **zero** OpenAI/Qdrant calls.

## Non-goals

- Ranking the keyword tier by relevance (`LIKE` has no score → scripture order + existing dedupe).
- Showing entity groups for keyword searches (verse-centric: keyword mode = verses only).
- Changing the verses-only `search(query)` query or `SearchResult`/`ResultCard` shapes (beyond the additive `semantic` flag on `SearchAllResult`).
- Removing the Qdrant index or the `highlight.ts`/`searchGroups` modules — they're reused as the fallback.

## Architecture

### `searchAll` two-tier flow

```
searchAllResolver(query, lang):
  1. keywordIds = getCandidateVerseIds(db, query, lang, isEnglish)   // LIKE, no embed
  2. if keywordIds.length > 0:
        verses = hydrate+dedupe(keywordIds)        // existing searchhist hydration
        return { verses, semantic: false, people:[], places:[], commentary:[], narration:[], pages:[], events:[] }
  3. else (zero literal verse matches → semantic fallback):
        verses = semantic verse search (Qdrant, hydrate+dedupe)
        groups = searchGroups(query, lang)         // entity groups
        return { verses, semantic: true, people:…, …, events:… }
```

- **`resolveCandidates` is inverted** to LIKE-first: keyword (`getCandidateVerseIds`) is tried first; the Qdrant vector path runs only when keyword yields zero (and Qdrant is reachable). Returns the candidate ids plus a `semantic` boolean (false for keyword, true for vector). The existing hydration + `dedupeByVerseKeepFirstLink` + ranked-reorder (semantic only) downstream is unchanged.
- `searchGroups` is called **only in the semantic branch**. The `SEARCH_BACKEND` flag retires (keyword is always primary; semantic fallback is used whenever the keyword tier is empty and Qdrant/embeddings are available).

### Highlighting (per tier; eager removed)

- **Remove the eager highlight block** from `searchAllResolver` entirely (the latency regression).
- **Keyword mode (`semantic:false`):** verses render with the existing keyword `highlight()`; no highlight fetches.
- **Semantic mode (`semantic:true`):** verses + content cards lazy-fetch the semantic highlight (`fetchHighlightRange`, viewport-gated, cached) — only here. `highlight.ts`/`computeHighlights`/`highlightText` and the lazy `highlight(query,text)` query are retained for this path.

### API

Add `semantic: Boolean` to `SearchAllResult`. Keyword mode → `semantic:false` + empty group arrays; semantic mode → `semantic:true` + populated groups. (Empty groups are already stripped by the legacy formatter and rendered as nothing by the frontend.)

### Frontend (`views/Search/`)

- Already renders only non-empty groups, so keyword mode shows verses only with no change.
- Gate the lazy highlight-fetch on `r.searchAll.semantic === true` — keyword-mode results never fire `fetchHighlightRange` (they'd return null anyway; this avoids the wasted calls). Verse rows + content cards check the flag before observing.
- Keyword-mode verses use keyword `highlight()` via `renderHighlighted`'s fallback (no range). `renderHighlighted` is unchanged.

## Data flow

- **Keyword search (common):** query → `LIKE` verse ids → hydrate+dedupe → return verses + `semantic:false`. No OpenAI, no Qdrant, no groups, no highlight compute.
- **Semantic fallback (zero keyword):** query → embed → Qdrant verses + `searchGroups` → hydrate → return verses+groups + `semantic:true`. Frontend lazy-fetches highlights for visible results.

## Error handling

- Keyword tier is pure SQL; on DB error it surfaces as today.
- Semantic fallback: `searchGroups` already degrades to empty groups on embed/Qdrant failure; the semantic verse search, if it errors, returns empty verses (the keyword tier was already zero, so the net result is "no results" — correct, not a crash). The resolver wraps the semantic branch so a fallback failure yields empty results rather than throwing.
- A query with zero keyword matches AND Qdrant unavailable → empty results (acceptable; no literal matches exist and semantic is down).

## Testing

- **Unit:** the tier decision — given non-empty keyword ids → `semantic:false`, groups not invoked; given zero keyword ids → semantic branch taken, `semantic:true`. (Inject the keyword-id lookup + a `searchGroups` spy to assert it's only called in the fallback.)
- **Resolver shape:** `semantic` flag present and correct in both modes.
- **Live:** `charity` → fast, `semantic:false`, verses only, keyword-highlighted, no embed; `afterlife` → `semantic:true`, verses + groups, fast (no eager), highlights lazy.
- **Regression:** `dedupeByVerseKeepFirstLink`, existing verse search, and `highlight.ts` unit tests stay green; `search(query)` unchanged.

## Performance

- Keyword search: ~0.3s (single `LIKE` + hydration; no OpenAI/Qdrant).
- Semantic fallback: ~0.8s (one query embed + Qdrant verse query + `searchGroups`; no eager highlight). Highlights fade in lazily.
- Eliminates the ~1.3s eager-highlight cost from every semantic query, and avoids all embedding on keyword queries.

## Explicit decisions

1. **Verse-centric two-tier:** keyword (`LIKE`) verses primary; semantic (Qdrant verses + entity groups) only when keyword returns zero verses.
2. **Groups + semantic highlighting are fallback-only** (no entity groups in keyword mode).
3. **Eager highlighting removed**; highlighting is lazy and only in semantic mode.
4. **`resolveCandidates` inverted** to keyword-first; `SEARCH_BACKEND` retires.
5. **`semantic: Boolean`** added to `SearchAllResult`; frontend gates lazy-highlight fetching on it.
6. Keyword tier: scripture order + existing dedupe (no relevance ranking).
