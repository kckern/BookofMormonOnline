# Hybrid Search + RAG on Qdrant — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Index Book of Mormon verses into a self-hosted Qdrant store and serve hybrid (dense+sparse) retrieval through one shared `searchContent()` function, consumed by the GraphQL `search` resolver (with a `LIKE` fallback that preserves today's behavior) and the Mastra bot RAG tool.

**Architecture:** Qdrant is a derived index; MySQL stays system-of-record. A new `backend/src/search/` module owns embedding, chunking, the Qdrant client, indexing, and the `searchContent()` retrieval seam. The existing `searchQuery` loader keeps its MySQL hydration + `dedupeByVerseKeepFirstLink` untouched — Qdrant only replaces *candidate generation* (which `verse_id`s match, in what rank). If Qdrant/embeddings are unavailable, candidate generation falls back to the current `LIKE`.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Kysely/MySQL, Vitest, Vercel AI SDK (`ai` + `@ai-sdk/openai`, already installed), Qdrant (`@qdrant/js-client-rest`), `uuid` (deterministic point IDs).

**Reference spec:** `docs/superpowers/specs/2026-06-16-hybrid-search-rag-qdrant-design.md`

**Conventions:** Backend root is `backend/`. Run all commands from `backend/`. Tests are Vitest (`npx vitest run <path>`). The codebase is ESM — local imports MUST use `.js` extensions even for `.ts` files. Tests that need infra (Qdrant/DB) follow the existing **skip-if-unreachable** pattern from `backend/test/messaging/*`.

---

## File Structure

- `backend/src/search/config.ts` — reads search env (`SEARCH_BACKEND`, `QDRANT_URL`, `QDRANT_API_KEY`, `SEARCH_EMBED_MODEL`); single source of config truth.
- `backend/src/search/types.ts` — shared types: `SearchHit`, `IndexPoint`, `SearchContentArgs`.
- `backend/src/search/chunk.ts` — pure: split long text into passages; verses pass through as one chunk.
- `backend/src/search/points.ts` — pure: deterministic point IDs (uuidv5), payload builder, RRF fusion, hit→ranked-verse-id mapper.
- `backend/src/search/embed.ts` — embedding wrapper over `ai`/`@ai-sdk/openai`, model resolved in one place.
- `backend/src/search/qdrant.ts` — Qdrant client singleton + `ensureCollection()`.
- `backend/src/search/retrieve.ts` — `searchContent()`: the shared retrieval seam (hybrid + filters).
- `backend/src/search/indexer.ts` — build points from verse rows + upsert to Qdrant.
- `backend/scripts/reindex-search.ts` — CLI: full verse reindex from MySQL.
- `backend/src/data/loaders/searchhist.ts` — MODIFY: extract `getCandidateVerseIds` (the LIKE), call `searchContent` with fallback + apply ranking.
- `backend/src/bots/mastra/rag.ts` — MODIFY: implement the stubbed `execute()` against `searchContent`.
- `backend/.env.example` — MODIFY: document new env.

---

## Task 1: Dependencies + search config module

**Files:**
- Modify: `backend/package.json` (deps)
- Modify: `backend/.env.example`
- Create: `backend/src/search/config.ts`
- Test: `backend/test/search/config.test.ts`

- [ ] **Step 1: Add dependencies**

Run:
```bash
cd /home/bom/BookofMormonOnline/backend
npm install @qdrant/js-client-rest @mastra/qdrant uuid
npm install -D @types/uuid
```
Expected: installs succeed; `@qdrant/js-client-rest`, `@mastra/qdrant`, `uuid` appear in `package.json` dependencies.

- [ ] **Step 2: Document env in `.env.example`**

Append to `backend/.env.example`:
```
# --- Search / RAG (Qdrant) ---
# SEARCH_BACKEND: 'qdrant' to use the vector index, 'like' to force the legacy MySQL LIKE.
SEARCH_BACKEND=like
QDRANT_URL=http://127.0.0.1:6333
QDRANT_API_KEY=
SEARCH_EMBED_MODEL=text-embedding-3-small
```

- [ ] **Step 3: Write the failing test**

Create `backend/test/search/config.test.ts`:
```ts
import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { getSearchConfig } from '../../src/search/config.js';

const KEYS = ['SEARCH_BACKEND', 'QDRANT_URL', 'QDRANT_API_KEY', 'SEARCH_EMBED_MODEL'];
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = {}; for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe('getSearchConfig', () => {
  test('defaults: backend=like, default url + model, no key', () => {
    const c = getSearchConfig();
    expect(c.backend).toBe('like');
    expect(c.qdrantUrl).toBe('http://127.0.0.1:6333');
    expect(c.embedModel).toBe('text-embedding-3-small');
    expect(c.qdrantApiKey).toBeUndefined();
  });

  test('reads overrides from env', () => {
    process.env.SEARCH_BACKEND = 'qdrant';
    process.env.QDRANT_URL = 'http://qdrant:6333';
    process.env.QDRANT_API_KEY = 'secret';
    process.env.SEARCH_EMBED_MODEL = 'text-embedding-3-large';
    const c = getSearchConfig();
    expect(c).toEqual({ backend: 'qdrant', qdrantUrl: 'http://qdrant:6333', qdrantApiKey: 'secret', embedModel: 'text-embedding-3-large' });
  });

  test('unknown SEARCH_BACKEND falls back to like', () => {
    process.env.SEARCH_BACKEND = 'bogus';
    expect(getSearchConfig().backend).toBe('like');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run test/search/config.test.ts`
Expected: FAIL — `getSearchConfig` is not exported.

- [ ] **Step 5: Implement `config.ts`**

Create `backend/src/search/config.ts`:
```ts
/** Search/RAG configuration, read from env once per call. */
export interface SearchConfig {
  backend: 'qdrant' | 'like';
  qdrantUrl: string;
  qdrantApiKey: string | undefined;
  embedModel: string;
}

export function getSearchConfig(): SearchConfig {
  const raw = process.env['SEARCH_BACKEND'];
  const backend = raw === 'qdrant' ? 'qdrant' : 'like';
  return {
    backend,
    qdrantUrl: process.env['QDRANT_URL'] || 'http://127.0.0.1:6333',
    qdrantApiKey: process.env['QDRANT_API_KEY'] || undefined,
    embedModel: process.env['SEARCH_EMBED_MODEL'] || 'text-embedding-3-small',
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/search/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/package.json backend/package-lock.json backend/.env.example backend/src/search/config.ts backend/test/search/config.test.ts
git commit -m "feat(search): add Qdrant/AI deps + search config module"
```

---

## Task 2: Shared types

**Files:**
- Create: `backend/src/search/types.ts`

- [ ] **Step 1: Create the types (no test — type-only module, verified by `tsc` in later tasks)**

Create `backend/src/search/types.ts`:
```ts
/** Entity kinds indexed in the shared `bom_content` collection. Phase 1 uses 'verse'. */
export type ContentType = 'verse' | 'person' | 'place' | 'page' | 'narration' | 'commentary' | 'event';

/** One Qdrant point to upsert. */
export interface IndexPoint {
  id: string;            // deterministic uuidv5
  type: ContentType;
  entity_id: string;     // e.g. verse_id as string
  chunkIndex: number;
  text: string;
  ref: string | null;
  slug: string | null;
  lang: string;
  version: string | null;
  dense: number[];       // embedding vector
}

/** A ranked retrieval hit returned by searchContent. */
export interface SearchHit {
  type: ContentType;
  entity_id: string;
  score: number;
  text: string;
  ref: string | null;
  slug: string | null;
  version: string | null;
}

/** Arguments to the shared retrieval seam. */
export interface SearchContentArgs {
  query: string;
  types?: ContentType[];
  lang?: string;
  version?: string[];
  limit?: number;
}
```

- [ ] **Step 2: Type-check**

Run: `cd /home/bom/BookofMormonOnline/backend && npx tsc --noEmit`
Expected: no new errors from `src/search/types.ts`.

- [ ] **Step 3: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/search/types.ts
git commit -m "feat(search): shared search/RAG types"
```

---

## Task 3: Pure helpers — chunk, point IDs, payload, RRF fusion, rank mapper

**Files:**
- Create: `backend/src/search/chunk.ts`
- Create: `backend/src/search/points.ts`
- Test: `backend/test/search/chunk.test.ts`
- Test: `backend/test/search/points.test.ts`

- [ ] **Step 1: Write failing tests for chunk**

Create `backend/test/search/chunk.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { chunkText } from '../../src/search/chunk.js';

describe('chunkText', () => {
  test('short text returns a single chunk', () => {
    expect(chunkText('And it came to pass', 100)).toEqual(['And it came to pass']);
  });

  test('long text splits on sentence boundaries within the limit', () => {
    const text = 'Alpha sentence one. Beta sentence two. Gamma sentence three.';
    const chunks = chunkText(text, 25);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(40); // limit + one sentence slack
    expect(chunks.join(' ')).toContain('Gamma sentence three.');
  });

  test('empty/whitespace returns no chunks', () => {
    expect(chunkText('   ', 100)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/search/chunk.test.ts`
Expected: FAIL — `chunkText` not exported.

- [ ] **Step 3: Implement `chunk.ts`**

Create `backend/src/search/chunk.ts`:
```ts
/**
 * Split text into chunks no longer than ~maxChars, breaking on sentence
 * boundaries. Verses (short) return a single chunk. Long-form entities
 * (commentary/narration/pages, Phase 2) get multiple passages.
 */
export function chunkText(text: string, maxChars: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const sentences = trimmed.match(/[^.!?]+[.!?]*\s*/g) ?? [trimmed];
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (current && (current + s).length > maxChars) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/search/chunk.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write failing tests for points**

Create `backend/test/search/points.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { pointId, fuseRrf, hitsToRankedVerseIds } from '../../src/search/points.js';
import type { SearchHit } from '../../src/search/types.js';

describe('pointId', () => {
  test('is deterministic for the same key', () => {
    expect(pointId('verse', '31103', 0)).toBe(pointId('verse', '31103', 0));
  });
  test('differs by type, entity, and chunk', () => {
    const a = pointId('verse', '31103', 0);
    expect(a).not.toBe(pointId('person', '31103', 0));
    expect(a).not.toBe(pointId('verse', '31104', 0));
    expect(a).not.toBe(pointId('verse', '31103', 1));
  });
  test('looks like a uuid', () => {
    expect(pointId('verse', '31103', 0)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('fuseRrf', () => {
  test('reciprocal-rank-fuses two ranked id lists (k=60)', () => {
    // id 'b' appears high in both → should win.
    const dense = ['a', 'b', 'c'];
    const sparse = ['b', 'd', 'a'];
    const fused = fuseRrf([dense, sparse], 60);
    expect(fused[0]).toBe('b');
    expect(fused).toContain('d');
    // 'a' (ranks 0 and 2) beats 'c' (rank 2 in one list only)
    expect(fused.indexOf('a')).toBeLessThan(fused.indexOf('c'));
  });
  test('empty lists → empty result', () => {
    expect(fuseRrf([[], []], 60)).toEqual([]);
  });
});

describe('hitsToRankedVerseIds', () => {
  test('maps verse hits to entity_ids preserving order, de-dupes', () => {
    const hits: SearchHit[] = [
      { type: 'verse', entity_id: '31103', score: 0.9, text: '', ref: null, slug: null, version: null },
      { type: 'verse', entity_id: '31104', score: 0.8, text: '', ref: null, slug: null, version: null },
      { type: 'verse', entity_id: '31103', score: 0.7, text: '', ref: null, slug: null, version: null },
    ];
    expect(hitsToRankedVerseIds(hits)).toEqual(['31103', '31104']);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run test/search/points.test.ts`
Expected: FAIL — `points.js` exports missing.

- [ ] **Step 7: Implement `points.ts`**

Create `backend/src/search/points.ts`:
```ts
import { v5 as uuidv5 } from 'uuid';
import type { ContentType, SearchHit } from './types.js';

/** Fixed namespace so point IDs are stable across runs/machines. */
const NAMESPACE = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

/** Deterministic Qdrant point ID from (type, entity_id, chunkIndex). */
export function pointId(type: ContentType, entityId: string, chunkIndex: number): string {
  return uuidv5(`${type}:${entityId}:${chunkIndex}`, NAMESPACE);
}

/**
 * Reciprocal Rank Fusion of several ranked id lists.
 * score(id) = sum over lists of 1/(k + rank). Higher is better.
 */
export function fuseRrf(rankedLists: string[][], k: number): string[] {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    list.forEach((id, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    });
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** Ranked, de-duplicated verse_ids from verse hits (best first). */
export function hitsToRankedVerseIds(hits: SearchHit[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of hits) {
    if (h.type !== 'verse') continue;
    if (seen.has(h.entity_id)) continue;
    seen.add(h.entity_id);
    out.push(h.entity_id);
  }
  return out;
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run test/search/points.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 9: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/search/chunk.ts backend/src/search/points.ts backend/test/search/chunk.test.ts backend/test/search/points.test.ts
git commit -m "feat(search): pure helpers — chunk, point IDs, RRF fusion, rank mapper"
```

---

## Task 4: Embedding wrapper

**Files:**
- Create: `backend/src/search/embed.ts`
- Test: `backend/test/search/embed.test.ts`

**Context:** The Vercel AI SDK (`ai`) provides `embed`/`embedMany`; `@ai-sdk/openai` provides the model. The bot stack already imports `openai` from `@ai-sdk/openai` (`src/bots/mastra/model.ts`). The test uses a mock embedding model so it runs without an API key.

- [ ] **Step 1: Confirm the exact AI SDK embedding API in the installed versions**

Run:
```bash
cd /home/bom/BookofMormonOnline/backend
node -e "const ai=require('ai'); console.log('embed' in ai, 'embedMany' in ai)"
node -e "const o=require('@ai-sdk/openai'); console.log(typeof o.openai.textEmbeddingModel, typeof o.openai.embedding)"
node -e "const t=require('ai/test'); console.log(Object.keys(t).filter(k=>/Embedding/i.test(k)))"
```
Expected: `embed`/`embedMany` exist on `ai`; one of `openai.textEmbeddingModel` / `openai.embedding` is a function; `ai/test` exposes a `MockEmbeddingModel*`. Use whichever names the output confirms in the steps below (the code below assumes `openai.textEmbeddingModel` and `MockEmbeddingModelV2`; if Step 1 shows different names, substitute them verbatim).

- [ ] **Step 2: Write the failing test**

Create `backend/test/search/embed.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { MockEmbeddingModelV2 } from 'ai/test';
import { embedOne, embedBatch } from '../../src/search/embed.js';

const mock = new MockEmbeddingModelV2({
  doEmbed: async ({ values }: { values: string[] }) => ({
    embeddings: values.map((_, i) => [i + 1, 0, 0]),
    usage: { tokens: values.length },
  }),
});

describe('embedOne / embedBatch', () => {
  test('embedOne returns a single vector', async () => {
    expect(await embedOne('faith', mock)).toEqual([1, 0, 0]);
  });
  test('embedBatch returns one vector per input, order preserved', async () => {
    expect(await embedBatch(['a', 'b'], mock)).toEqual([[1, 0, 0], [2, 0, 0]]);
  });
  test('embedBatch on empty input returns empty', async () => {
    expect(await embedBatch([], mock)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run test/search/embed.test.ts`
Expected: FAIL — `embed.js` exports missing.

- [ ] **Step 4: Implement `embed.ts`**

Create `backend/src/search/embed.ts` (substitute the provider/mock names confirmed in Step 1 if they differ):
```ts
import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getSearchConfig } from './config.js';

/** Default embedding model from config. Passed explicitly in tests for mocking. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defaultEmbedModel(): any {
  return openai.textEmbeddingModel(getSearchConfig().embedModel);
}

/** Embed a single string → vector. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function embedOne(value: string, model: any = defaultEmbedModel()): Promise<number[]> {
  const { embedding } = await embed({ model, value });
  return embedding;
}

/** Embed many strings → vectors (order preserved). Empty in → empty out. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function embedBatch(values: string[], model: any = defaultEmbedModel()): Promise<number[][]> {
  if (!values.length) return [];
  const { embeddings } = await embedMany({ model, values });
  return embeddings;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/search/embed.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/search/embed.ts backend/test/search/embed.test.ts
git commit -m "feat(search): embedding wrapper over AI SDK (mock-tested)"
```

---

## Task 5: Qdrant client + collection bootstrap

**Files:**
- Create: `backend/src/search/qdrant.ts`
- Test: `backend/test/search/qdrant.integration.test.ts`

**Context:** Integration test requires a running Qdrant. Follow the skip-if-unreachable pattern: probe once in `beforeAll`; if unreachable, skip with a clear message (no faked assertions). Collection `bom_content` has a named `dense` vector (size 1536, cosine) and a `sparse` vector named `keywords`, plus payload indexes on `type`, `lang`, `version`.

- [ ] **Step 1: Implement `qdrant.ts`**

Create `backend/src/search/qdrant.ts`:
```ts
import { QdrantClient } from '@qdrant/js-client-rest';
import { getSearchConfig } from './config.js';

export const COLLECTION = 'bom_content';
export const DENSE_SIZE = 1536; // text-embedding-3-small

let client: QdrantClient | null = null;
export function getQdrant(): QdrantClient {
  if (client) return client;
  const cfg = getSearchConfig();
  client = new QdrantClient({ url: cfg.qdrantUrl, apiKey: cfg.qdrantApiKey });
  return client;
}

/** Create the collection (named dense + sparse vectors) and payload indexes if absent. Idempotent. */
export async function ensureCollection(): Promise<void> {
  const q = getQdrant();
  const existing = await q.getCollections();
  if (existing.collections.some((c) => c.name === COLLECTION)) return;

  await q.createCollection(COLLECTION, {
    vectors: { dense: { size: DENSE_SIZE, distance: 'Cosine' } },
    sparse_vectors: { keywords: {} },
  });
  for (const field of ['type', 'lang', 'version'] as const) {
    await q.createPayloadIndex(COLLECTION, { field_name: field, field_schema: 'keyword' });
  }
}

/** True if the configured Qdrant answers within the timeout. */
export async function qdrantReachable(timeoutMs = 1500): Promise<boolean> {
  try {
    await Promise.race([
      getQdrant().getCollections(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Write the integration test (skip-if-unreachable)**

Create `backend/test/search/qdrant.integration.test.ts`:
```ts
import 'dotenv/config';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureCollection, getQdrant, qdrantReachable, COLLECTION } from '../../src/search/qdrant.js';

let up = false;
beforeAll(async () => { up = await qdrantReachable(); });

describe('Qdrant collection bootstrap', () => {
  it('creates bom_content with dense + sparse vectors (or SKIPS if Qdrant down)', async () => {
    if (!up) { console.warn('BLOCKED: Qdrant unreachable at QDRANT_URL — skipping'); return; }
    await ensureCollection();
    const info = await getQdrant().getCollection(COLLECTION);
    expect(info.config.params.vectors).toHaveProperty('dense');
    expect(info.config.params.sparse_vectors).toHaveProperty('keywords');
  });

  it('ensureCollection is idempotent', async () => {
    if (!up) return;
    await ensureCollection();
    await ensureCollection(); // must not throw
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 3: Run the integration test**

Run: `npx vitest run test/search/qdrant.integration.test.ts`
Expected: PASS — either green assertions (Qdrant up) or the BLOCKED skip path (Qdrant down). Either way the suite must pass, never fail.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/search/qdrant.ts backend/test/search/qdrant.integration.test.ts
git commit -m "feat(search): Qdrant client + bom_content collection bootstrap"
```

---

## Task 6: Indexer + reindex CLI

**Files:**
- Create: `backend/src/search/indexer.ts`
- Create: `backend/scripts/reindex-search.ts`
- Test: `backend/test/search/indexer.test.ts`

**Context:** `verseToPoints` is pure (verse row + embedding → IndexPoint[]); it's unit-tested. The upsert + reindex run against Qdrant/MySQL and are exercised by the CLI (manual/integration). Verse text comes from `lds_scriptures_verses` (`verse_id`, `verse_scripture`), BoM range 31103–37706 — mirror the existing `searchQuery`.

- [ ] **Step 1: Write the failing test for `verseToPoint`**

Create `backend/test/search/indexer.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { verseToPoint } from '../../src/search/indexer.js';
import { pointId } from '../../src/search/points.js';

describe('verseToPoint', () => {
  test('builds a verse IndexPoint with deterministic id and dense vector', () => {
    const p = verseToPoint({ verse_id: 31103, verse_scripture: 'I Nephi having been born' }, [0.1, 0.2], 'en');
    expect(p.id).toBe(pointId('verse', '31103', 0));
    expect(p.type).toBe('verse');
    expect(p.entity_id).toBe('31103');
    expect(p.chunkIndex).toBe(0);
    expect(p.text).toBe('I Nephi having been born');
    expect(p.lang).toBe('en');
    expect(p.dense).toEqual([0.1, 0.2]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/search/indexer.test.ts`
Expected: FAIL — `verseToPoint` not exported.

- [ ] **Step 3: Implement `indexer.ts`**

Create `backend/src/search/indexer.ts`:
```ts
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { IndexPoint } from './types.js';
import { pointId } from './points.js';
import { embedBatch } from './embed.js';
import { getQdrant, ensureCollection, COLLECTION } from './qdrant.js';

export interface VerseRow { verse_id: number; verse_scripture: string }

/** Pure: one verse + its embedding → a single IndexPoint (verses are one chunk). */
export function verseToPoint(row: VerseRow, dense: number[], lang: string): IndexPoint {
  const entity_id = String(row.verse_id);
  return {
    id: pointId('verse', entity_id, 0),
    type: 'verse',
    entity_id,
    chunkIndex: 0,
    text: row.verse_scripture,
    ref: null,
    slug: null,
    lang,
    version: 'LDS',
    dense,
  };
}

/** Upsert points into Qdrant (dense vectors + payload). Sparse vectors are added at query time in Phase 1. */
export async function upsertPoints(points: IndexPoint[]): Promise<void> {
  if (!points.length) return;
  await getQdrant().upsert(COLLECTION, {
    wait: true,
    points: points.map((p) => ({
      id: p.id,
      vector: { dense: p.dense },
      payload: { type: p.type, entity_id: p.entity_id, ref: p.ref, slug: p.slug, lang: p.lang, version: p.version, text: p.text },
    })),
  });
}

/** Full reindex of BoM verses from MySQL → Qdrant, batched. */
export async function reindexVerses(db: Kysely<DB>, batchSize = 128): Promise<number> {
  await ensureCollection();
  const rows = (await db
    .selectFrom('lds_scriptures_verses')
    .select(['verse_id', 'verse_scripture'])
    .where('verse_id', '>=', 31103)
    .where('verse_id', '<=', 37706)
    .execute()) as VerseRow[];

  let count = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const vectors = await embedBatch(batch.map((r) => r.verse_scripture));
    const points = batch.map((r, j) => verseToPoint(r, vectors[j]!, 'en'));
    await upsertPoints(points);
    count += points.length;
  }
  return count;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/search/indexer.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the reindex CLI**

Create `backend/scripts/reindex-search.ts`:
```ts
import 'dotenv/config';
import { getDb, closeDb } from '../src/data/db.js';
import { reindexVerses } from '../src/search/indexer.js';

async function main() {
  const db = getDb();
  const n = await reindexVerses(db);
  // eslint-disable-next-line no-console
  console.log(`Reindexed ${n} verses into Qdrant.`);
  await closeDb();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: Verify CLI type-checks and (optionally) runs**

Run: `cd /home/bom/BookofMormonOnline/backend && npx tsc --noEmit`
Expected: no errors.
Optional live run (requires Qdrant + OPENAI_API_KEY + DB): `npx tsx scripts/reindex-search.ts` → prints `Reindexed <N> verses into Qdrant.` (N ≈ 6604). If infra is absent, skip — Task 8's resolver fallback keeps search working regardless.

- [ ] **Step 7: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/search/indexer.ts backend/scripts/reindex-search.ts backend/test/search/indexer.test.ts
git commit -m "feat(search): verse indexer + reindex CLI"
```

---

## Task 7: `searchContent` retrieval seam

**Files:**
- Create: `backend/src/search/retrieve.ts`
- Test: `backend/test/search/retrieve.test.ts`

**Context:** `searchContent` is the shared seam. It embeds the query (dense), builds a sparse keyword vector from the query terms, runs a Qdrant hybrid query (prefetch dense + sparse, fuse RRF server-side), applies `type`/`lang`/`version` filters, and maps points → `SearchHit[]`. We unit-test the pure pieces: `buildFilter` (args → Qdrant filter) and `queryToSparse` (text → sparse vector). The end-to-end Qdrant call is covered by the integration test.

- [ ] **Step 1: Write failing tests for the pure pieces**

Create `backend/test/search/retrieve.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { buildFilter, queryToSparse } from '../../src/search/retrieve.js';

describe('buildFilter', () => {
  test('no filters → undefined', () => {
    expect(buildFilter({ query: 'faith' })).toBeUndefined();
  });
  test('type + lang produce keyword match conditions', () => {
    expect(buildFilter({ query: 'faith', types: ['verse'], lang: 'en' })).toEqual({
      must: [
        { key: 'type', match: { any: ['verse'] } },
        { key: 'lang', match: { value: 'en' } },
      ],
    });
  });
  test('version uses match.any', () => {
    expect(buildFilter({ query: 'x', version: ['LDS', 'KJV'] })).toEqual({
      must: [{ key: 'version', match: { any: ['LDS', 'KJV'] } }],
    });
  });
});

describe('queryToSparse', () => {
  test('lowercases, dedupes terms, builds indices+values of equal length', () => {
    const s = queryToSparse('Faith faith HOPE');
    expect(s.indices.length).toBe(s.values.length);
    expect(s.indices.length).toBe(2); // faith, hope
    expect(s.values.every((v) => v > 0)).toBe(true);
  });
  test('empty query → empty sparse', () => {
    expect(queryToSparse('   ')).toEqual({ indices: [], values: [] });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/search/retrieve.test.ts`
Expected: FAIL — `retrieve.js` exports missing.

- [ ] **Step 3: Implement `retrieve.ts`**

Create `backend/src/search/retrieve.ts`:
```ts
import type { SearchContentArgs, SearchHit, ContentType } from './types.js';
import { embedOne } from './embed.js';
import { getQdrant, COLLECTION } from './qdrant.js';

/** Build a Qdrant payload filter from the args, or undefined when no filters apply. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildFilter(args: SearchContentArgs): any | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const must: any[] = [];
  if (args.types?.length) must.push({ key: 'type', match: { any: args.types } });
  if (args.lang) must.push({ key: 'lang', match: { value: args.lang } });
  if (args.version?.length) must.push({ key: 'version', match: { any: args.version } });
  return must.length ? { must } : undefined;
}

/** Hash a token to a stable 32-bit sparse-vector index. */
function tokenIndex(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) { h ^= token.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Deterministic keyword sparse vector: one entry per distinct lowercased term. */
export function queryToSparse(query: string): { indices: number[]; values: number[] } {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
  return { indices: terms.map(tokenIndex), values: terms.map(() => 1) };
}

/** The shared retrieval seam. Throws if Qdrant/embeddings are unavailable (caller falls back). */
export async function searchContent(args: SearchContentArgs): Promise<SearchHit[]> {
  const limit = args.limit ?? 50;
  const dense = await embedOne(args.query);
  const sparse = queryToSparse(args.query);
  const filter = buildFilter(args);

  const res = await getQdrant().query(COLLECTION, {
    prefetch: [
      { query: dense, using: 'dense', limit, filter },
      { query: { indices: sparse.indices, values: sparse.values }, using: 'keywords', limit, filter },
    ],
    query: { fusion: 'rrf' },
    limit,
    with_payload: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (res.points ?? []).map((p: any) => ({
    type: (p.payload?.type ?? 'verse') as ContentType,
    entity_id: String(p.payload?.entity_id ?? ''),
    score: p.score ?? 0,
    text: String(p.payload?.text ?? ''),
    ref: (p.payload?.ref ?? null) as string | null,
    slug: (p.payload?.slug ?? null) as string | null,
    version: (p.payload?.version ?? null) as string | null,
  }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/search/retrieve.test.ts`
Expected: PASS (buildFilter + queryToSparse blocks).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/search/retrieve.ts backend/test/search/retrieve.test.ts
git commit -m "feat(search): searchContent retrieval seam (hybrid dense+sparse)"
```

---

## Task 8: Wire the GraphQL search resolver (Qdrant candidates + ranking + LIKE fallback)

**Files:**
- Modify: `backend/src/data/loaders/searchhist.ts`
- Test: `backend/test/search/candidates.test.ts`
- Test (regression): `backend/test/searchhist-dedupe.test.ts` (must stay green)

**Context:** `searchQuery` currently builds `verseIds` inline via two `LIKE` branches (English on `lds_scriptures_verses`, non-English on `lds_scriptures_translations`), then `if (!verseIds.length) return []`. We extract that into `getCandidateVerseIds`, and add `resolveCandidates` that uses Qdrant when `SEARCH_BACKEND=qdrant` (ranked), else the LIKE. The ranked order is applied at the end by sorting the final deduped rows by candidate position.

- [ ] **Step 1: Write the failing test for ranking + fallback selection**

Create `backend/test/search/candidates.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { rankRowsByCandidateOrder } from '../../src/data/loaders/searchhist.js';

describe('rankRowsByCandidateOrder', () => {
  test('reorders rows to match the candidate verse_id order', () => {
    const rows = [{ verse_id: '31104' }, { verse_id: '31103' }, { verse_id: '31200' }];
    const ranked = rankRowsByCandidateOrder(rows, ['31200', '31103', '31104']);
    expect(ranked.map((r) => r.verse_id)).toEqual(['31200', '31103', '31104']);
  });
  test('rows whose verse_id is not in the candidate order go last, original order preserved', () => {
    const rows = [{ verse_id: 'a' }, { verse_id: 'b' }, { verse_id: 'c' }];
    const ranked = rankRowsByCandidateOrder(rows, ['c']);
    expect(ranked.map((r) => r.verse_id)).toEqual(['c', 'a', 'b']);
  });
  test('empty candidate order returns rows unchanged', () => {
    const rows = [{ verse_id: 'a' }, { verse_id: 'b' }];
    expect(rankRowsByCandidateOrder(rows, []).map((r) => r.verse_id)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/search/candidates.test.ts`
Expected: FAIL — `rankRowsByCandidateOrder` not exported.

- [ ] **Step 3: Add the ranking helper + candidate resolver to `searchhist.ts`**

In `backend/src/data/loaders/searchhist.ts`, add these imports at the top (after the existing imports):
```ts
import { getSearchConfig } from '../../search/config.js';
import { searchContent } from '../../search/retrieve.js';
import { hitsToRankedVerseIds } from '../../search/points.js';
```

Add these exported functions just above `export async function searchQuery(`:
```ts
/** Stable reorder of hydrated rows to follow a ranked verse_id list; unranked rows keep original order, last. */
export function rankRowsByCandidateOrder<T extends { verse_id: string }>(rows: T[], order: string[]): T[] {
  if (!order.length) return rows;
  const rank = new Map(order.map((id, i) => [id, i]));
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const ra = rank.get(a.row.verse_id) ?? Number.POSITIVE_INFINITY;
      const rb = rank.get(b.row.verse_id) ?? Number.POSITIVE_INFINITY;
      return ra === rb ? a.i - b.i : ra - rb;
    })
    .map(({ row }) => row);
}

/** The legacy LIKE candidate generation, extracted verbatim. */
export async function getCandidateVerseIds(
  db: Kysely<DB>,
  query: string,
  lang: string,
  isEnglish: boolean,
): Promise<string[]> {
  if (isEnglish) {
    const rows = await db
      .selectFrom('lds_scriptures_verses')
      .select('verse_id')
      .where('verse_scripture', 'like', `%${query}%`)
      .where('verse_id', '>=', 31103)
      .where('verse_id', '<=', 37706)
      .execute();
    return rows.map((r) => String(r.verse_id));
  }
  const rows = await db
    .selectFrom('lds_scriptures_translations')
    .select('verse_id')
    .where('text', 'like', `%${query}%`)
    .where('lang', '=', lang)
    .execute();
  return rows.map((r) => String(r.verse_id));
}

/**
 * Resolve ranked candidate verse_ids. Uses Qdrant when SEARCH_BACKEND=qdrant
 * (returns { ids, ranked:true }); on any failure, or when backend=like, falls
 * back to the legacy LIKE (ranked:false → downstream keeps legacy ordering).
 */
export async function resolveCandidates(
  db: Kysely<DB>,
  query: string,
  lang: string,
  isEnglish: boolean,
): Promise<{ ids: string[]; ranked: boolean }> {
  if (getSearchConfig().backend === 'qdrant') {
    try {
      const hits = await searchContent({ query, types: ['verse'], lang });
      const ids = hitsToRankedVerseIds(hits);
      if (ids.length) return { ids, ranked: true };
    } catch {
      // fall through to LIKE
    }
  }
  return { ids: await getCandidateVerseIds(db, query, lang, isEnglish), ranked: false };
}
```

- [ ] **Step 4: Replace the inline candidate block in `searchQuery`**

In `searchQuery`, the current code computes `isEnglish`/`isKorean`/`minLen`, the `if (!query || query.length < minLen) return [];` guard, then the two inline `LIKE` branches building `verseIds`, then `if (!verseIds.length) return [];`. Replace **the two inline branches** with a call to `resolveCandidates`, keeping the guard. The block from `let verseIds: string[] = [];` through the end of the `else { ... }` branch becomes:
```ts
  const { ids: verseIds, ranked } = await resolveCandidates(db, query, lang, isEnglish);
```
Leave the existing `if (!verseIds.length) return [];` line directly after it.

- [ ] **Step 5: Apply ranking to the final result**

`searchQuery` currently ends with `return dedupedRows.map((row) => { ... })`. Wrap that mapped array so ranked candidates reorder it. Change:
```ts
  return dedupedRows.map((row) => {
    ...
  });
```
to assign the mapped array to a const and return the reordered list:
```ts
  const results = dedupedRows.map((row) => {
    ...
  });
  return ranked ? rankRowsByCandidateOrder(results as Array<{ verse_id: string }> & typeof results, verseIds) as typeof results : results;
```
(The `SearchResultRow` objects already carry `verse_id`, so `rankRowsByCandidateOrder` can order them.)

- [ ] **Step 6: Run the new + regression tests**

Run:
```bash
cd /home/bom/BookofMormonOnline/backend
npx vitest run test/search/candidates.test.ts test/searchhist-dedupe.test.ts
npx tsc --noEmit
```
Expected: candidates tests PASS (3), dedupe tests still PASS (5), tsc clean.

- [ ] **Step 7: Verify LIKE fallback end-to-end against the running backend**

With `SEARCH_BACKEND` unset/`like` (default), restart and re-run the audit query (the dedup behavior must be unchanged — proves the refactor is behavior-preserving when Qdrant is off):
```bash
systemctl --user restart bom-greenfield && sleep 6
curl -s 'http://10.0.0.10:8200/en' -H 'Content-Type: application/json' -H 'Origin: http://10.0.0.10:8200' \
  -H 'User-Agent: Mozilla/5.0 AppleWebKit/537.36' \
  --data-raw '{"query":"{search (query: \"what ye shall\"){ reference slug }}"}' --insecure \
  | python3 -c "import sys,json; d=json.load(sys.stdin)['data']['search']; print('results',len(d),[r['reference'] for r in d]); assert len(d)==3"
```
Expected: 3 results (Alma 25:10, Alma 32:24, 3 Nephi 13:25) — unchanged from the current LIKE behavior.

- [ ] **Step 8: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/data/loaders/searchhist.ts backend/test/search/candidates.test.ts
git commit -m "feat(search): resolver uses Qdrant candidates + ranking, LIKE fallback"
```

---

## Task 9: Implement the Mastra bot RAG tool

**Files:**
- Modify: `backend/src/bots/mastra/rag.ts`
- Test: `backend/test/search/rag-tool.test.ts`

**Context:** `createBotRagTool(db, botId)` currently returns a Mastra tool whose `execute()` returns `{ chunks: [] }`. Implement it to call `searchContent`, returning the `text` of the top hits as grounding chunks. To keep it unit-testable without infra, inject the retrieval function (default = the real `searchContent`).

- [ ] **Step 1: Write the failing test**

Create `backend/test/search/rag-tool.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { retrieveChunks } from '../../src/bots/mastra/rag.js';
import type { SearchHit } from '../../src/search/types.js';

const fakeHits: SearchHit[] = [
  { type: 'verse', entity_id: '1', score: 0.9, text: 'first chunk', ref: null, slug: null, version: null },
  { type: 'verse', entity_id: '2', score: 0.8, text: 'second chunk', ref: null, slug: null, version: null },
];

describe('retrieveChunks', () => {
  test('returns the text of hits from the injected retriever', async () => {
    const chunks = await retrieveChunks('faith', async () => fakeHits);
    expect(chunks).toEqual(['first chunk', 'second chunk']);
  });
  test('returns [] when the retriever throws (RAG must never break the bot)', async () => {
    const chunks = await retrieveChunks('faith', async () => { throw new Error('qdrant down'); });
    expect(chunks).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/search/rag-tool.test.ts`
Expected: FAIL — `retrieveChunks` not exported.

- [ ] **Step 3: Implement in `rag.ts`**

In `backend/src/bots/mastra/rag.ts`, add the import:
```ts
import { searchContent } from '../../search/retrieve.js';
import type { SearchHit } from '../../search/types.js';
```

Add the testable helper (above `createBotRagTool`):
```ts
/** Retrieve grounding chunk texts for a query. Never throws — returns [] on failure. */
export async function retrieveChunks(
  query: string,
  retriever: (q: string) => Promise<SearchHit[]> = (q) => searchContent({ query: q, limit: 8 }),
): Promise<string[]> {
  try {
    const hits = await retriever(query);
    return hits.map((h) => h.text).filter((t) => t.length > 0);
  } catch {
    return [];
  }
}
```

Replace the stub `execute` body in `createBotRagTool` so it delegates to `retrieveChunks`:
```ts
    execute: async ({ context }: { context: { query: string } }) => {
      void db; void botId; // (Phase 2: filter by loadRagResources(db, { botId }) resource types)
      return { chunks: await retrieveChunks(context.query) };
    },
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/search/rag-tool.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (If the Mastra `execute` signature types differ, match the existing tool's `execute` parameter typing in the same file — keep the `retrieveChunks(context.query)` call.)

- [ ] **Step 6: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/bots/mastra/rag.ts backend/test/search/rag-tool.test.ts
git commit -m "feat(rag): implement Mastra bot RAG tool via searchContent"
```

---

## Task 10: Full suite + docs note

**Files:**
- Modify: `docs/reference/non-graphql-endpoints.md` (note the search backend change)

- [ ] **Step 1: Run the whole backend test suite**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run`
Expected: all suites pass; Qdrant integration test SKIPS gracefully if Qdrant is down (never fails).

- [ ] **Step 2: Note the change in docs**

Append a short note to `docs/reference/non-graphql-endpoints.md` under a new heading:
```markdown
## Search backend (2026-06)

GraphQL `search` now resolves candidate verse_ids through `backend/src/search/`
(`searchContent` → Qdrant hybrid dense+sparse) when `SEARCH_BACKEND=qdrant`,
falling back to the legacy MySQL `LIKE` when unset or when Qdrant/embeddings are
unavailable. The same `searchContent` seam backs the Mastra bot RAG tool
(`src/bots/mastra/rag.ts`). Index with `npx tsx scripts/reindex-search.ts`.
The old Sphinx `/sphinx` endpoint remains deprecated (in `_deprecated/`).
```

- [ ] **Step 3: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add docs/reference/non-graphql-endpoints.md
git commit -m "docs(search): note Qdrant search backend + RAG seam"
```

---

## Self-Review

**Spec coverage:**
- Qdrant service + single `bom_content` collection (dense+sparse, payload indexes) → Task 5. ✓
- Embeddings via `@ai-sdk/openai` `text-embedding-3-small`, swappable → Task 4. ✓
- Chunking (verses = 1 doc) → Tasks 3, 6. ✓
- Deterministic point IDs / idempotent reindex → Tasks 3, 6. ✓
- `searchContent` shared seam, hybrid + filters → Task 7. ✓
- Resolver reuses MySQL hydration + `dedupeByVerseKeepFirstLink`, Qdrant replaces only candidate-gen, ranking applied → Task 8. ✓
- LIKE fallback + `SEARCH_BACKEND` flag → Tasks 1, 8. ✓
- Mastra RAG tool against the same seam → Task 9. ✓
- Skip-if-unreachable integration tests; keep e2e + dedupe green → Tasks 5, 8, 10. ✓
- Config/env, new deps → Task 1. ✓
- Non-goals (other entity types, incremental reindex, multi-version expansion, StudyBuddy migration) correctly deferred — no tasks, by design.

**Placeholder scan:** Task 4 Step 1 is a deliberate discovery step (verify the exact AI SDK method names against installed versions) with concrete commands and a stated default + fallback — not a vague placeholder. Task 9 Step 5 notes matching the existing `execute` typing — concrete. No `TBD`/`handle edge cases`/unwritten-test placeholders remain.

**Type consistency:** `searchContent(args: SearchContentArgs): Promise<SearchHit[]>`, `SearchHit`, `IndexPoint`, `ContentType` defined in Task 2 and used identically in Tasks 6/7/9. `pointId(type, entityId, chunkIndex)` defined in Task 3, used in Task 6. `hitsToRankedVerseIds` (Task 3) used in Task 8. `getSearchConfig().backend` ('qdrant'|'like') consistent across Tasks 1/4/8. `COLLECTION`/`getQdrant`/`ensureCollection` (Task 5) used in Tasks 6/7. Names align.
