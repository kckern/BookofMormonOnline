# Hybrid Search + RAG on Qdrant — Design Spec

**Date:** 2026-06-16
**Status:** Approved (design); Phase 1 ready for planning
**Author:** Claude (brainstorming session with KC)

## Summary

Replace the current bare `LIKE %query%` scripture search with a **hybrid (semantic + keyword) retrieval layer** backed by a self-hosted **Qdrant** vector store, shared by two surfaces:

1. The GraphQL `search` endpoint (user-facing scripture search).
2. The Mastra RAG tool used by all bot agents — the messaging study bots and, later, StudyBuddy.

MySQL remains the system-of-record. Qdrant is a derived index. The work is phased; **this spec is implementable as Phase 1 (verses)** and is architected so later entity types are additive.

## Background & motivation

- The live GraphQL `search` resolver (`backend/src/data/loaders/searchhist.ts`) runs `verse_scripture LIKE '%query%'` scoped to the Book of Mormon verse range (31103–37706). It has **no relevance ranking, no stemming, no typo tolerance, no phrase/proximity handling**, and does a table scan per query.
- "Sphinx" is effectively already gone: the old GraphQL search resolver (`_deprecated/src/resolvers/BomUtils.ts`) had its `sphinxQuery()` call **commented out** and ran a `LIKE` instead; the only real Sphinx integration was the standalone `/sphinx` REST endpoint (`_deprecated/src/search/sphinx.ts`), now deprecated and unreachable. There is nothing live to migrate off.
- Bot RAG is a **stub**: `backend/src/bots/mastra/rag.ts` defines the `bom_bot_rag` resource loader and the Mastra retrieval tool, but `execute()` returns `{ chunks: [] }` with a `TODO(rag): embed query → vector search → top-k`.
- Stack today: `@mastra/core` ^1.41, `@ai-sdk/openai` ^3, `ai` ^6, `openai` ^6 are installed; **no vector-store package yet**; **MySQL-only** (no Postgres).

Two crude/stubbed things (user search and bot RAG) want the same machinery: index content + retrieve by relevance. This spec unifies them on one store.

## Goals (Phase 1)

- Stand up Qdrant as a self-hosted service alongside the greenfield backend.
- Index **verses** (BoM range) into a single Qdrant collection with dense + sparse vectors.
- Provide one shared retrieval function `searchContent(...)` doing hybrid ranking with payload filters.
- Wire the GraphQL `search` resolver to `searchContent`, **reusing the existing MySQL hydration and verse-dedupe** unchanged, with a `LIKE` fallback.
- Implement the stubbed Mastra RAG tool against `searchContent`.

## Non-goals (Phase 1)

- Indexing non-verse entity types (Phase 2).
- Real-time/incremental reindex on content edits (Phase 3).
- Multi-version/translation expansion beyond what verses already carry (Phase 3).
- Migrating StudyBuddy off `_deprecated/src/api/studybuddy.ts` onto Mastra (Phase 3; separable workstream that consumes this layer).
- Changing the GraphQL schema (`SearchResult` shape stays as-is).

## Architecture

### The one seam: `searchContent`

A single shared function is the entire public interface of the retrieval layer:

```
searchContent({
  query: string,
  types?: string[],     // payload filter, e.g. ['verse']; omit = all types
  lang?: string,        // payload filter
  version?: string[],   // payload filter
  limit?: number,
}): Promise<Array<{
  type: string,
  entity_id: string,    // e.g. verse_id as string
  score: number,        // fused hybrid score
  text: string,         // stored chunk text (for RAG)
  ref?: string | null,
  slug?: string | null,
  version?: string | null,
}>>
```

Both consumers call only this. It encapsulates: embedding the query, building the sparse/keyword vector, issuing the Qdrant hybrid query, applying filters, and the fallback.

### Components

- **Qdrant service (`bom-search`)** — one self-hosted Qdrant instance (container/systemd unit beside greenfield). Infra setup; not application code.
- **Single collection `bom_content`** — each point is one indexable unit. Phase 1 = one point per verse.
- **Embedder (`backend/src/search/embed.ts`)** — thin wrapper over `@ai-sdk/openai` `text-embedding-3-small` (1536-dim). Swappable to a local model later. Reads `OPENAI_API_KEY` and `SEARCH_EMBED_MODEL`.
- **Indexer (`backend/src/search/indexer.ts`)** — pure-ish builders (chunk, point-ID, payload) plus an upsert runner. Driven by a CLI script.
- **Reindex CLI (`backend/scripts/reindex-search.ts`)** — full reindex of verses from MySQL. Idempotent.
- **Retrieval (`backend/src/search/retrieve.ts`)** — implements `searchContent`, including hybrid query, filters, and fallback.
- **Consumer A: GraphQL `search`** — `backend/src/data/loaders/searchhist.ts` / resolver calls `searchContent`.
- **Consumer B: Mastra RAG tool** — `backend/src/bots/mastra/rag.ts` `execute()` calls `searchContent`.

### Qdrant data model

Single collection `bom_content`:

- **Dense vector:** named `dense`, size 1536, cosine distance (OpenAI `text-embedding-3-small`).
- **Sparse vector:** named `sparse`, keyword/BM25-like (tokenized terms → weights).
- **Payload:** `{ type, entity_id, ref, slug, lang, version, text }`, with payload indexes on `type`, `lang`, `version` for fast filtering.
- **Point ID:** deterministic, derived from `type:entity_id:chunk_index` (verses have a single chunk, index 0). Deterministic IDs make reindex idempotent (upsert overwrites, no dupes).

**Decision:** single collection with a `type` payload field (not one collection per entity type) — chosen so cross-type federated ranking in Phase 2 is one query with the `type` filter relaxed, rather than multi-search + manual fusion.

### Hybrid retrieval

Qdrant Query API: prefetch top candidates from the `dense` vector AND from the `sparse` vector, then fuse with **Reciprocal Rank Fusion (RRF)** into one ranked list. Payload filters (`type`, `lang`, `version`) apply to both prefetches. This single mechanism covers all five complaints:

- Relevance/ranking → fused score ordering.
- Linguistic/semantic matching (stemming, synonymy, "preached"≈"preach") → dense vector.
- Phrase & exact-term matching → sparse vector.
- Speed → ANN index (no table scan).
- Multi-version → `version` payload filter.

### Clean seam in the existing resolver

Qdrant **replaces only candidate generation** — the step the `LIKE` query does today (which `verse_id`s match, and in what order). Everything downstream in `searchhist.ts` is unchanged:

1. Resolver calls `searchContent({ query, types: ['verse'], lang })` → ranked list of `verse_id`s (+ scores).
2. Existing MySQL hydration builds page/section/narration/speaker/voice/reference/text/slug (unchanged).
3. The existing `dedupeByVerseKeepFirstLink` step still applies (unchanged).
4. Result order follows the Qdrant ranking instead of incidental scriptural order.

**Decision:** reuse existing hydration + dedupe (rather than store all display fields in Qdrant and bypass MySQL) — minimizes change, keeps one display path, avoids stale denormalized payloads. Qdrant payload stores only what retrieval/RAG needs (incl. `text` for RAG chunks).

### Fallback (keeps dev green)

`searchContent` falls back to the current `LIKE` path when Qdrant is unreachable or embeddings fail:

- Qdrant down / not deployed (e.g., dev without the container) → `LIKE` candidate generation, same downstream hydration.
- Embedding API failure → degrade to sparse-only query if Qdrant is up, else `LIKE`.
- A `SEARCH_BACKEND=qdrant|like` env flag sets the default per environment (dev may default to `like` until Qdrant is provisioned; prod defaults to `qdrant`).

This preserves the existing "LIKE fallback covers dev" behavior and the greenfield search e2e test (`e2e/greenfield-readonly.spec.js`).

## Data flow

- **Index:** MySQL (verses) → indexer (chunk=1/verse, embed dense, build sparse) → Qdrant upsert (deterministic IDs).
- **Query (search):** user query → resolver → `searchContent({types:['verse']})` (embed query, hybrid Qdrant query, filter) → ranked verse_ids → existing hydrate + dedupe → `SearchResult[]`. Qdrant unavailable → `LIKE`.
- **Query (RAG):** bot query → Mastra tool → `searchContent` filtered to the bot's `bom_bot_rag` resource types → top-k `text` chunks → agent grounding context.

## Error handling

- Qdrant unreachable → search uses `LIKE`; RAG tool returns `{ chunks: [] }` (current behavior) — no crash.
- Embedding failure → sparse-only (if Qdrant up) or `LIKE`.
- Reindex is idempotent via deterministic point IDs; partial reindex failure is safe to re-run.

## Testing

- **Unit (no infra):** chunker (long-form vs single-doc verse), point-ID generation, query→Qdrant-filter builder, hit→verse_id mapper, RRF fusion helper if hand-rolled.
- **Integration (local Qdrant, skip-if-unreachable):** follow the messaging suite's skip-if-DB-unreachable pattern (`backend/test/messaging/*`). Index a small verse fixture, assert hybrid retrieval ranks expected verses above non-matches; assert filters (`type`, `lang`) work.
- **Fallback test:** with `SEARCH_BACKEND=like` (or Qdrant disabled), assert `search` still returns hydrated, deduped results.
- **Regression:** keep `e2e/greenfield-readonly.spec.js` green; the dedupe unit tests (`backend/test/searchhist-dedupe.test.ts`) remain valid.

## Config / ops

- **New env:** `QDRANT_URL`, `QDRANT_API_KEY` (optional), `SEARCH_BACKEND` (`qdrant|like`), `SEARCH_EMBED_MODEL` (default `text-embedding-3-small`). Reuse `OPENAI_API_KEY`.
- **New dependency:** `@mastra/qdrant` (Mastra-native Qdrant vector store) + Qdrant JS client as needed.
- **New service:** `bom-search` Qdrant container/systemd unit. Deployment step, tracked separately from the application code tasks.
- **Open-source redaction:** no live secrets/keys committed (repo is public).

## Phasing

- **Phase 1 (this spec):** Qdrant up; verses indexed; `searchContent` with hybrid + fallback; GraphQL `search` wired; Mastra RAG tool implemented.
- **Phase 2:** Add entity types (people, places, pages, narration, commentary, events) — load → chunk → embed → upsert with `type`; `searchContent` already filters by type; federated multi-type results in the search UI.
- **Phase 3:** Incremental reindex on content edits; multi-version/translation expansion; StudyBuddy migrated onto Mastra (consumes this layer).

## Explicit decisions

1. **Single `bom_content` collection** with a `type` payload field (not per-type collections) — for cross-type ranking in Phase 2.
2. **Qdrant replaces only candidate-generation**, reusing the existing MySQL hydration + `dedupeByVerseKeepFirstLink` (not storing all display fields in Qdrant).
3. **Vector store = Qdrant**, chosen for a Mastra-native adapter, single self-hosted service, dense+sparse hybrid, and payload filtering — without adding a second relational engine (stays beside MySQL).
4. **Embeddings = OpenAI `text-embedding-3-small`** via existing `@ai-sdk/openai`, behind a swappable wrapper.
