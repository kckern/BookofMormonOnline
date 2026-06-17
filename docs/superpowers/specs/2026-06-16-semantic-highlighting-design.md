# Semantic Highlighting — Design Spec

**Date:** 2026-06-16
**Status:** Approved (design); ready for planning
**Builds on:** the hybrid search + multi-entity search work (`searchContent`/`searchVectors`/`queryWithVectors` seam, `searchAll` grouped query). Phase-1/2 specs in `docs/superpowers/specs/2026-06-16-hybrid-search-rag-qdrant-design.md` and `2026-06-16-multi-entity-search-design.md`.

## Summary

When a search matches a result **semantically with no literal keyword overlap** (e.g. query `afterlife` → Alma 40 "a space betwixt the time of death and the resurrection"), the existing keyword highlighter (`Search.js` `highlight()`) lights up nothing. This feature adds **semantic highlighting**: it finds and emphasizes the tightest **phrase/clause** within a result most similar to the query.

The mechanism is query-time clause-span embedding: split a result's text into clauses, form candidate spans of 1–3 contiguous clauses, embed them in one batch, cosine-score each against the query's already-computed dense vector, and return the best span's character offsets. The top results are highlighted eagerly in the `searchAll` response; the rest are highlighted lazily on demand via a new `highlight(query, text)` query.

## Goals

- Emphasize the most query-relevant phrase in prose results that have no literal keyword match.
- Reuse the existing embedding seam (`searchVectors` query vector + `embedBatch`); no new model or service.
- Keep it cheap/fast: eager highlighting for the top results (one extra embed batch per search); lazy for the rest.

## Non-goals

- Highlighting results that already contain the query terms — those keep the existing keyword `highlight()`.
- Highlighting name/title-only result types (person, place, page) or events.
- Cross-encoder / token-attribution / ColBERT approaches (heavier; possible future precision upgrade).
- Changing ranking or the `searchContent`/`searchAll` retrieval behavior.

## Decisions (locked in brainstorming)

1. **Granularity:** best **phrase/clause** — tightest span, via contiguous-clause windows (not raw word windows; clauses are the natural phrase unit and ~10× fewer candidates).
2. **Scope:** **verses + commentary + narration** (the prose-bearing types). Person/place (name matches), page (title-only), event (weak/title) are skipped.
3. **Eager + lazy hybrid:** top ~10 verses + top ~3 per eligible group are highlighted in the `searchAll` response; all other eligible results are highlighted on demand.
4. **Trigger:** only when the result has **no literal keyword overlap** with the query. Keyword-overlapping results keep the existing `highlight()`.
5. **API shape:** character offsets `{ start, end }` (robust to repeated phrases), not the span string.

## Architecture

### Shared core — `backend/src/search/highlight.ts`

Pure, independently testable units:

- `splitClauses(text: string): Clause[]` — split on clause boundaries (`,;:.?!—` and coordinating conjunctions " and / or / but "), each `Clause` carrying its `{ text, start, end }` char offsets into the original string.
- `candidateSpans(clauses: Clause[], maxClauses = 3): Span[]` — all contiguous runs of 1..maxClauses clauses, each a `{ text, start, end }` over the original string.
- `bestSpanByCosine(queryVec: number[], spans: Span[], spanVecs: number[][]): HighlightRange | null` — pick the span whose vector has the highest cosine similarity to `queryVec`; return its `{ start, end }` (or null if no spans).
- `hasKeywordOverlap(query: string, text: string): boolean` — true if any normalized query token appears literally in the text (used to gate: semantic highlight only when this is false).

Types: `HighlightRange { start: number; end: number }`.

### Orchestrator (batched, eager) — same module

- `attachHighlights(queryVectors: QueryVectors, items: HighlightableItem[]): Promise<void>` where `HighlightableItem` exposes the result's `text` and a setter for its `highlight` field.
  - For each item lacking keyword overlap, compute its candidate spans; collect **all spans across all items into one `embedBatch` call**; cosine-rank per item; set each item's `highlight` to its best span's offsets (or null).
  - Reuses `queryVectors.dense` (already computed by `searchVectors`) — only the spans are embedded.

### Wiring

- **Eager (`searchAll`):** after ranking + hydration, run `attachHighlights` on the **top ~10 verses and top ~3 of commentary/narration**. Add `highlight: HighlightRange` (nullable) to the verse `SearchResult` and to `ResultCard` in the GraphQL schema. Verses already flow through `searchQuery`; the resolver applies highlights to the sliced top-N before returning.
- **Lazy (new query):** `highlight(query: String!, text: String!): HighlightRange` — embeds the query (one `embedOne`) and the single text's candidate spans (one `embedBatch`), returns the best span. Stateless; reuses the same core. Gated by `hasKeywordOverlap` (returns null if the query literally appears, so the client falls back to keyword highlighting).

### Frontend

- `frontend/webapp/src/views/Search/highlight.js` — `renderHighlighted(text, range)`: if `range` is present, return the text with `text.slice(range.start, range.end)` wrapped in `<em class="semantic-hl">`; else return the existing keyword-highlighted output (call the current `highlight(keyword, text)`).
- **Eager results** (top-N) use the `highlight` field from `searchAll`.
- **Lazy results** fetch `highlight(query, text)` when the card **scrolls into view (IntersectionObserver) or on hover**, debounced, and cached per result (each computed at most once). While pending, show the keyword/plain text; swap in the emphasis when it resolves.
- Applies to the verse card and the commentary/narration `ResultGroup` cards.

## Data flow

- **Eager:** query → `searchVectors` (dense vector) → rank → for top-N prose results without keyword overlap: clause-split → candidate spans → one `embedBatch` → cosine → `highlight` offsets in the response.
- **Lazy:** card enters view → `highlight(query, text)` → embed query + spans → best span offsets → frontend emphasizes.

## Error handling

- Any embedding/compute failure in `attachHighlights` leaves `highlight` null for the affected items — the result still renders (plain or keyword-highlighted). Never throws into the `searchAll` path.
- The lazy `highlight` query returns null on failure; the card keeps its plain/keyword rendering.
- A result with no clauses (empty/short text) → null highlight.

## Testing

- **Unit (no infra):** `splitClauses` (offsets correct, boundary handling), `candidateSpans` (1..3 contiguous, offsets), `bestSpanByCosine` (picks max-cosine span with hand-made vectors), `hasKeywordOverlap` (literal token presence, case-insensitive).
- **Integration (skip-if-unreachable):** `attachHighlights` / the lazy path against a local embedder or Qdrant-adjacent stub — assert a known query+text yields the expected clause (e.g. `afterlife` over an Alma-40-style sentence picks the death/resurrection clause).
- **Frontend:** `renderHighlighted` render test — offset emphasis wraps the right substring; null range falls back to keyword highlight.
- **Regression:** existing search/dedupe/searchAll tests stay green; keyword `highlight()` behavior unchanged for keyword-overlapping results.

## Cost / latency

- **Eager:** one extra `embedBatch` per search over the top-N results' clause-spans (~hundreds of spans → ~$0.0003, a few hundred ms). Clause-windowing keeps candidate counts ~10× below word-windowing.
- **Lazy:** one `embedOne` (query) + one `embedBatch` (one result's spans) per opened result; cached so each result computes at most once.
- Sparse vectors are not involved (highlighting is a dense-similarity operation).

## Explicit decisions

1. Clause-span (1–3 clauses) windowing, char offsets `{start,end}`.
2. Eager top-N (verses ~10, commentary/narration ~3 each) + lazy `highlight(query,text)` for the rest, on viewport/hover, cached.
3. Only when no literal keyword overlap; otherwise existing keyword `highlight()`.
4. Scope: verses, commentary, narration. Skip person/place/page/event.
5. Reuse `searchVectors`/`embedBatch`; shared `highlight.ts` core for eager + lazy; no new model.
