# Multi-Entity Search (Phase 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Index six new types (`person, place, commentary, narration, page, event`) into the existing Qdrant `bom_content` collection and expose a grouped `searchAll(query)` GraphQL query, rendered in `Search.js` as a verses-primary list plus a labeled section per type.

**Architecture:** A generic type-indexing framework (one `TypeConfig` per type → `reindexType` driver) replaces the verse-only indexer. The retrieval module gains an embed-once seam (`searchVectors` + `queryWithVectors`) so `searchAll` embeds the query once and fans out one type-filtered Qdrant query per group in parallel. Index-time payload carries display-ready fields (`title`, snippet `text`, `slug`, `ref`) so the grouped resolver is a thin hit→DTO mapper — except verses, which keep the existing rich MySQL hydration + `dedupeByVerseKeepFirstLink`.

**Tech Stack:** TypeScript ESM (Kysely/MySQL, Vitest, `@qdrant/js-client-rest`, AI SDK), React 17 (`frontend/webapp`, jest/RTL).

**Reference spec:** `docs/superpowers/specs/2026-06-16-multi-entity-search-design.md`. Phase-1 modules in `backend/src/search/`.

**Conventions:** Run backend commands from `backend/`; tests `npx vitest run <path>`; ESM local imports use `.js`. Skip-if-unreachable for Qdrant/DB integration tests (mirror `backend/test/messaging/*`). Known source tables: people=`bom_people`, places=`bom_places`, commentary=`bom_xtras_commentary` (`scriptureextras.ts:229`), narration=`bom_narration`, page=`bom_page`/`bom_section` (`searchhist.ts`), events=`historyQuery` in `searchhist.ts`. Confirm exact columns against `backend/codegen/db.ts` before querying.

---

## Task 1: Payload gains `title`; generic indexing framework

**Files:**
- Modify: `backend/src/search/types.ts` (add `title` to `IndexPoint`)
- Modify: `backend/src/search/indexer.ts` (add `TypeConfig`, `toUnits`, `unitToPoint`, `reindexType`; refactor verse path to a config; add `title` to upsert payload)
- Test: `backend/test/search/indexer.test.ts` (extend)

- [ ] **Step 1: Add `title` to IndexPoint**

In `backend/src/search/types.ts`, add to `IndexPoint` (after `text: string;`):
```ts
  title: string | null;   // display title (entity name, page/section title); null for verses
```

- [ ] **Step 2: Write failing tests for the framework**

Add to `backend/test/search/indexer.test.ts`:
```ts
import { toUnits, unitToPoint } from '../../src/search/indexer.js';
import { pointId } from '../../src/search/points.js';

describe('toUnits', () => {
  test('single-chunk type yields one unit per row (chunkIndex 0)', () => {
    const cfg = { type: 'person' as const, chunk: false };
    const units = toUnits(cfg, [{ entity_id: 'abinadi', title: 'Abinadi', text: 'Abinadi prophet', slug: 'people/abinadi', ref: null }]);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ type: 'person', entity_id: 'abinadi', chunkIndex: 0, text: 'Abinadi prophet', title: 'Abinadi', slug: 'people/abinadi' });
  });
  test('chunked type splits long text into multiple units with incrementing chunkIndex', () => {
    const cfg = { type: 'commentary' as const, chunk: true, maxChars: 20 };
    const long = 'Sentence one here. Sentence two here. Sentence three here.';
    const units = toUnits(cfg, [{ entity_id: 'c1', title: null, text: long, slug: 'x', ref: null }]);
    expect(units.length).toBeGreaterThan(1);
    expect(units.map((u) => u.chunkIndex)).toEqual(units.map((_, i) => i));
  });
  test('empty text rows are dropped', () => {
    const cfg = { type: 'page' as const, chunk: false };
    expect(toUnits(cfg, [{ entity_id: 'p', title: 'T', text: '   ', slug: 's', ref: null }])).toEqual([]);
  });
});

describe('unitToPoint', () => {
  test('builds an IndexPoint with deterministic id, dense, title', () => {
    const unit = { type: 'person' as const, entity_id: 'abinadi', chunkIndex: 0, text: 'Abinadi prophet', title: 'Abinadi', slug: 'people/abinadi', ref: null };
    const p = unitToPoint(unit, [0.1, 0.2], 'en');
    expect(p.id).toBe(pointId('person', 'abinadi', 0));
    expect(p).toMatchObject({ type: 'person', entity_id: 'abinadi', chunkIndex: 0, text: 'Abinadi prophet', title: 'Abinadi', slug: 'people/abinadi', lang: 'en', version: null });
    expect(p.dense).toEqual([0.1, 0.2]);
    expect(p.sparse.indices.length).toBe(p.sparse.values.length);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run test/search/indexer.test.ts`
Expected: FAIL (`toUnits`/`unitToPoint` not exported; `title` missing).

- [ ] **Step 4: Implement the framework in `indexer.ts`**

Add to `backend/src/search/indexer.ts` (keep existing `VerseRow`, `verseToPoint`, `upsertPoints`, `reindexVerses` for now — Task 4 replaces the CLI):
```ts
import { chunkText } from './chunk.js';
import { textToSparse } from './sparse.js';
import type { ContentType } from './types.js';

/** A row any type adapter produces from MySQL. */
export interface SourceRow {
  entity_id: string;
  title: string | null;
  text: string;
  slug: string | null;
  ref: string | null;   // secondary display datum (e.g. event date); null otherwise
}

/** One embeddable unit (a row, or a chunk of a long row). */
export interface IndexUnit extends SourceRow {
  type: ContentType;
  chunkIndex: number;
}

export interface TypeConfig {
  type: ContentType;
  chunk: boolean;       // chunk long text (commentary) vs single unit (entities/titles)
  maxChars?: number;    // chunk size when chunk=true (default 600)
}

/** Pure: rows → embeddable units (chunked when configured; empty-text rows dropped). */
export function toUnits(cfg: TypeConfig, rows: SourceRow[]): IndexUnit[] {
  const units: IndexUnit[] = [];
  for (const row of rows) {
    const pieces = cfg.chunk ? chunkText(row.text, cfg.maxChars ?? 600) : (row.text.trim() ? [row.text.trim()] : []);
    pieces.forEach((text, chunkIndex) => units.push({ ...row, type: cfg.type, chunkIndex, text }));
  }
  return units;
}

/** Pure: one unit + its embedding → an IndexPoint. */
export function unitToPoint(unit: IndexUnit, dense: number[], lang: string): import('./types.js').IndexPoint {
  return {
    id: pointId(unit.type, unit.entity_id, unit.chunkIndex),
    type: unit.type,
    entity_id: unit.entity_id,
    chunkIndex: unit.chunkIndex,
    text: unit.text,
    title: unit.title,
    ref: unit.ref,
    slug: unit.slug,
    lang,
    version: null,
    dense,
    sparse: textToSparse(unit.text),
  };
}

/** Index one type: load → unitize → embed (batched) → upsert. Returns point count. */
export async function reindexType(
  db: import('kysely').Kysely<import('../../codegen/db.js').DB>,
  cfg: TypeConfig,
  load: (db: import('kysely').Kysely<import('../../codegen/db.js').DB>) => Promise<SourceRow[]>,
  lang = 'en',
  batchSize = 128,
): Promise<number> {
  await ensureCollection();
  const units = toUnits(cfg, await load(db));
  let count = 0;
  for (let i = 0; i < units.length; i += batchSize) {
    const batch = units.slice(i, i + batchSize);
    const vectors = await embedBatch(batch.map((u) => u.text));
    if (vectors.length !== batch.length) throw new Error(`embedBatch returned ${vectors.length} for ${batch.length}`);
    await upsertPoints(batch.map((u, j) => unitToPoint(u, vectors[j]!, lang)));
    count += batch.length;
  }
  return count;
}
```
Update `upsertPoints` to write `title` in the payload — change its `payload:` object to include `title: p.title`:
```ts
      payload: { type: p.type, entity_id: p.entity_id, ref: p.ref, slug: p.slug, lang: p.lang, version: p.version, title: p.title, text: p.text },
```
Update `verseToPoint` to set `title: null` (verses have no title) so it still satisfies `IndexPoint`.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/search/indexer.test.ts && npx tsc --noEmit`
Expected: all indexer tests pass; tsc clean.

- [ ] **Step 6: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/search/types.ts backend/src/search/indexer.ts backend/test/search/indexer.test.ts
git commit -m "feat(search): payload title + generic type-indexing framework"
```

---

## Task 2: Embed-once retrieval seam (`searchVectors` + `queryWithVectors`)

**Files:**
- Modify: `backend/src/search/retrieve.ts`
- Test: `backend/test/search/retrieve.test.ts` (extend)

- [ ] **Step 1: Write failing tests for the split seam**

Add to `backend/test/search/retrieve.test.ts`:
```ts
import { searchVectors } from '../../src/search/retrieve.js';

describe('searchVectors', () => {
  test('returns dense + sparse for a query (sparse from queryToSparse)', async () => {
    const v = await searchVectors('faith hope', async () => [1, 2, 3]); // injected dense embedder
    expect(v.dense).toEqual([1, 2, 3]);
    expect(v.sparse.indices.length).toBe(v.sparse.values.length);
    expect(v.sparse.indices.length).toBe(2); // faith, hope
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/search/retrieve.test.ts`
Expected: FAIL (`searchVectors` not exported).

- [ ] **Step 3: Refactor `retrieve.ts` to split embed from query**

In `backend/src/search/retrieve.ts`, add (and have `searchContent` use them):
```ts
import type { SearchHit } from './types.js';

export interface QueryVectors { dense: number[]; sparse: { indices: number[]; values: number[] } }

/** Build the dense+sparse vectors for a query (embeds dense once). Injectable embedder for tests. */
export async function searchVectors(
  query: string,
  embedder: (q: string) => Promise<number[]> = embedOne,
): Promise<QueryVectors> {
  const dense = await embedder(query);
  return { dense, sparse: queryToSparse(query) };
}

/** Run a hybrid Qdrant query with prebuilt vectors + the args' filters. */
export async function queryWithVectors(vectors: QueryVectors, args: SearchContentArgs): Promise<SearchHit[]> {
  const limit = args.limit ?? 50;
  const filter = buildFilter(args);
  const res = await getQdrant().query(COLLECTION, {
    prefetch: [
      { query: vectors.dense, using: 'dense', limit, filter },
      { query: { indices: vectors.sparse.indices, values: vectors.sparse.values }, using: 'keywords', limit, filter },
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
Then replace the body of the existing `searchContent` so it composes the two (preserves its current behavior/signature):
```ts
export async function searchContent(args: SearchContentArgs): Promise<SearchHit[]> {
  const vectors = await searchVectors(args.query);
  return queryWithVectors(vectors, args);
}
```
Keep `SearchHit`'s mapper shape identical to before. Note: `SearchHit` has no `title` field today — add `title: string | null` to `SearchHit` in `types.ts` and map `title: (p.payload?.title ?? null)` in `queryWithVectors`, since the grouped resolver needs it. Update the existing `searchContent` callers only if tsc requires (they ignore `title`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/search/retrieve.test.ts && npx tsc --noEmit`
Expected: existing retrieve tests + the new `searchVectors` test pass; tsc clean.

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/search/retrieve.ts backend/src/search/types.ts backend/test/search/retrieve.test.ts
git commit -m "feat(search): embed-once seam (searchVectors + queryWithVectors) + hit title"
```

---

## Task 3: Type adapters (loaders) for the six new types

**Files:**
- Create: `backend/src/search/adapters.ts` (one `load<Type>` per type + the `TYPE_CONFIGS` registry)
- Test: `backend/test/search/adapters.test.ts`

Each adapter is a `load(db): Promise<SourceRow[]>` returning `{ entity_id, title, text, slug, ref }`. Confirm exact columns against `backend/codegen/db.ts` and the cited loaders.

- [ ] **Step 1: Write the failing test (shape + a couple of mappers)**

Create `backend/test/search/adapters.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { TYPE_CONFIGS, personRowToSource, placeRowToSource } from '../../src/search/adapters.js';

describe('TYPE_CONFIGS', () => {
  test('registers the six new types with chunk flags', () => {
    const byType = Object.fromEntries(TYPE_CONFIGS.map((c) => [c.cfg.type, c.cfg.chunk]));
    expect(byType).toMatchObject({ person: false, place: false, commentary: true, narration: false, page: false, event: false });
  });
});

describe('row mappers', () => {
  test('personRowToSource builds name+title text and people/ slug', () => {
    const r = personRowToSource({ slug: 'abinadi', name: 'Abinadi', title: 'Prophet', classification: null, identification: null });
    expect(r).toEqual({ entity_id: 'abinadi', title: 'Abinadi', text: 'Abinadi Prophet', slug: 'people/abinadi', ref: null });
  });
  test('placeRowToSource builds name+aka text and places/ slug', () => {
    const r = placeRowToSource({ slug: 'nephi', name: 'Land of Nephi', aka: 'Lehi-Nephi' });
    expect(r).toEqual({ entity_id: 'nephi', title: 'Land of Nephi', text: 'Land of Nephi Lehi-Nephi', slug: 'places/nephi', ref: null });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/search/adapters.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `adapters.ts`**

Create `backend/src/search/adapters.ts`. Implement pure row-mappers (unit-tested) + a `load` per type that queries the source table and maps rows. Use these exact sources (verify columns against `codegen/db.ts`):

```ts
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { SourceRow, TypeConfig } from './indexer.js';

const clean = (s: string | null | undefined) => (s ?? '').trim();
const join = (...parts: Array<string | null | undefined>) => parts.map(clean).filter(Boolean).join(' ');

// person: bom_people (slug, name, title)
export function personRowToSource(r: { slug: string; name: string | null; title: string | null; classification: string | null; identification: string | null }): SourceRow {
  return { entity_id: r.slug, title: clean(r.name) || r.slug, text: join(r.name, r.title), slug: `people/${r.slug}`, ref: null };
}
export const loadPeople = async (db: Kysely<DB>): Promise<SourceRow[]> =>
  (await db.selectFrom('bom_people').select(['slug', 'name', 'title', 'classification', 'identification']).execute())
    .map((r) => personRowToSource(r as never));

// place: bom_places (slug, name, aka)
export function placeRowToSource(r: { slug: string; name: string | null; aka: string | null }): SourceRow {
  return { entity_id: r.slug, title: clean(r.name) || r.slug, text: join(r.name, r.aka), slug: `places/${r.slug}`, ref: null };
}
export const loadPlaces = async (db: Kysely<DB>): Promise<SourceRow[]> =>
  (await db.selectFrom('bom_places').select(['slug', 'name', 'aka']).execute()).map((r) => placeRowToSource(r as never));
```

For **commentary** (`bom_xtras_commentary` — mirror `scriptureextras.ts:229` for the column names: body/title/slug-or-verse linkage), **narration** (`bom_narration` — `guid`, `description`; slug = its page, mirror `searchhist.ts` narration handling), **page** (`bom_page` title + `bom_section` title; slug from `bom_slug` like `searchhist.ts` builds), and **event** (mirror `historyQuery` in `searchhist.ts` — `historyQuery` returns `{ slug, document/teaser, year/date }`; map `title`=source/citation, `text`=teaser, `ref`=date, slug→timeline): implement a `load<Type>` each, returning `SourceRow[]`. Each `load` MUST be verified against the cited loader so columns are real. Then the registry:

```ts
export const TYPE_CONFIGS: Array<{ cfg: TypeConfig; load: (db: Kysely<DB>) => Promise<SourceRow[]> }> = [
  { cfg: { type: 'person', chunk: false }, load: loadPeople },
  { cfg: { type: 'place', chunk: false }, load: loadPlaces },
  { cfg: { type: 'commentary', chunk: true, maxChars: 600 }, load: loadCommentary },
  { cfg: { type: 'narration', chunk: false }, load: loadNarration },
  { cfg: { type: 'page', chunk: false }, load: loadPages },
  { cfg: { type: 'event', chunk: false }, load: loadEvents },
];
```

- [ ] **Step 4: Run to verify it passes + tsc**

Run: `npx vitest run test/search/adapters.test.ts && npx tsc --noEmit`
Expected: adapters tests pass; tsc clean (proves the Kysely column names are real).

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/search/adapters.ts backend/test/search/adapters.test.ts
git commit -m "feat(search): MySQL adapters for person/place/commentary/narration/page/event"
```

---

## Task 4: Reindex CLI indexes all types

**Files:**
- Modify: `backend/scripts/reindex-search.ts`

- [ ] **Step 1: Update the CLI to index verses + every TypeConfig**

Replace the body of `backend/scripts/reindex-search.ts` with:
```ts
import 'dotenv/config';
import { getDb, closeDb } from '../src/data/db.js';
import { reindexVerses, reindexType } from '../src/search/indexer.js';
import { TYPE_CONFIGS } from '../src/search/adapters.js';

async function main() {
  const db = getDb();
  try {
    const verses = await reindexVerses(db);
    // eslint-disable-next-line no-console
    console.log(`Reindexed ${verses} verses.`);
    for (const { cfg, load } of TYPE_CONFIGS) {
      const n = await reindexType(db, cfg, load);
      // eslint-disable-next-line no-console
      console.log(`Reindexed ${n} ${cfg.type} points.`);
    }
  } finally {
    await closeDb();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Type-check**

Run: `cd /home/bom/BookofMormonOnline/backend && npx tsc --noEmit`
Expected: no errors. (Live run is an ops step requiring Qdrant + OpenAI key — out of scope here; covered by the activation runbook.)

- [ ] **Step 3: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/scripts/reindex-search.ts
git commit -m "feat(search): reindex CLI populates all entity types"
```

---

## Task 5: `searchAll` GraphQL query (schema + grouped resolver)

**Files:**
- Modify: the typeDef file that declares `SearchResult`/`Query.search` (locate it: it backs `searchhistResolvers`; `grep -rl "SearchResult" backend/src` and check the schema-building file `backend/src/graphql/schema.ts`)
- Modify: `backend/src/graphql/resolvers/searchhist.ts` (add `searchAll` resolver)
- Create: `backend/src/search/grouped.ts` (the embed-once fan-out + hit→DTO mappers)
- Test: `backend/test/search/grouped.test.ts`

- [ ] **Step 1: Write failing tests for the pure mapping/grouping**

Create `backend/test/search/grouped.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { hitToCard, GROUP_TYPES } from '../../src/search/grouped.js';
import type { SearchHit } from '../../src/search/types.js';

const hit = (o: Partial<SearchHit>): SearchHit => ({ type: 'person', entity_id: 'x', score: 0.5, text: '', title: null, ref: null, slug: null, version: null, ...o });

describe('GROUP_TYPES', () => {
  test('covers the six non-verse groups in display order', () => {
    expect(GROUP_TYPES).toEqual(['person', 'place', 'commentary', 'narration', 'page', 'event']);
  });
});

describe('hitToCard', () => {
  test('maps a person hit to a card DTO', () => {
    const c = hitToCard(hit({ type: 'person', entity_id: 'abinadi', title: 'Abinadi', slug: 'people/abinadi', score: 0.9 }));
    expect(c).toEqual({ slug: 'people/abinadi', title: 'Abinadi', snippet: '', ref: null, score: 0.9 });
  });
  test('maps a commentary hit (snippet from text)', () => {
    const c = hitToCard(hit({ type: 'commentary', entity_id: 'c1', title: null, text: 'a note', slug: 'x', score: 0.7 }));
    expect(c).toMatchObject({ slug: 'x', snippet: 'a note', score: 0.7 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/search/grouped.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `grouped.ts`**

Create `backend/src/search/grouped.ts`:
```ts
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { ContentType, SearchHit } from './types.js';
import { searchVectors, queryWithVectors } from './retrieve.js';

export const GROUP_TYPES: ContentType[] = ['person', 'place', 'commentary', 'narration', 'page', 'event'];

export interface ResultCard { slug: string | null; title: string | null; snippet: string; ref: string | null; score: number }

/** Pure: a Qdrant hit → a card DTO (entities use title; content uses text snippet). */
export function hitToCard(h: SearchHit): ResultCard {
  return { slug: h.slug, title: h.title, snippet: h.text, ref: h.ref, score: h.score };
}

/**
 * Embed once, fan out one type-filtered query per non-verse group in parallel,
 * map hits → cards. Each group degrades to [] on its own failure.
 */
export async function searchGroups(
  query: string,
  lang: string,
  perGroup = 8,
): Promise<Record<string, ResultCard[]>> {
  const vectors = await searchVectors(query);
  const entries = await Promise.all(
    GROUP_TYPES.map(async (type) => {
      try {
        const hits = await queryWithVectors(vectors, { query, types: [type], lang, limit: perGroup });
        return [type, hits.map(hitToCard)] as const;
      } catch {
        return [type, [] as ResultCard[]] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/search/grouped.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the schema**

Locate the SearchResult typedef (run `grep -rln "type SearchResult" backend/src` and inspect `backend/src/graphql/schema.ts` to see how typeDefs are assembled). In that typeDef source, add:
```graphql
type ResultCard { slug: String, title: String, snippet: String, ref: String, score: Float }

type SearchAllResult {
  verses: [SearchResult!]!
  people: [ResultCard!]!
  places: [ResultCard!]!
  commentary: [ResultCard!]!
  narration: [ResultCard!]!
  pages: [ResultCard!]!
  events: [ResultCard!]!
}

extend type Query { searchAll(query: String!): SearchAllResult! }
```
(Using a single `ResultCard` shape for all non-verse groups keeps the schema small; verses keep the rich `SearchResult`.)

- [ ] **Step 6: Add the `searchAll` resolver**

In `backend/src/graphql/resolvers/searchhist.ts`, add to `Query`:
```ts
    searchAll: async (_root, args, ctx: AppContext) => {
      const lang = ctx.lang ?? 'en';
      const query = args.query ?? '';
      const db = (ctx.loaders as unknown as DbAccessor)._db;
      const [verses, groups] = await Promise.all([
        searchQuery(db, query, lang),                         // existing verse path (hydration + dedupe + LIKE fallback)
        (await import('../../search/grouped.js')).searchGroups(query, lang),
      ]);
      return {
        verses,
        people: groups.person ?? [],
        places: groups.place ?? [],
        commentary: groups.commentary ?? [],
        narration: groups.narration ?? [],
        pages: groups.page ?? [],
        events: groups.event ?? [],
      } as unknown as never;
    },
```
Add a `SearchAllResult`/`ResultCard` field-resolver block only if the schema needs explicit field resolvers (the plain object above matches the field names, so default resolvers suffice). Run `npx tsc --noEmit` and fix any typing of the returned shape with a narrow cast as the existing resolvers do.

- [ ] **Step 7: Verify**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/search && npx tsc --noEmit`
Expected: all search tests pass; tsc clean.

- [ ] **Step 8: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/search/grouped.ts backend/src/graphql/resolvers/searchhist.ts backend/src/graphql/typeDefs/ backend/test/search/grouped.test.ts
git commit -m "feat(search): searchAll grouped query (verses + 6 entity groups)"
```

---

## Task 6: Frontend grouped rendering in `Search.js`

**Files:**
- Create: `frontend/webapp/src/views/Search/ResultGroup.js`
- Create: `frontend/webapp/src/views/Search/cards.js` (PersonChip, PlaceChip, ContentCard, EventCard)
- Modify: `frontend/webapp/src/views/Search/Search.js`
- Test: `frontend/webapp/src/views/Search/__tests__/ResultGroup.test.js`

- [ ] **Step 1: Write the failing render test**

Create `frontend/webapp/src/views/Search/__tests__/ResultGroup.test.js`:
```js
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResultGroup from '../ResultGroup';

const cards = [{ slug: 'people/abinadi', title: 'Abinadi', snippet: '', ref: null, score: 0.9 }];

test('renders a labeled group with count and items', () => {
  render(<MemoryRouter><ResultGroup label="People" cards={cards} kind="person" /></MemoryRouter>);
  expect(screen.getByText(/People/)).toBeInTheDocument();
  expect(screen.getByText('Abinadi')).toBeInTheDocument();
});

test('renders nothing when cards is empty', () => {
  const { container } = render(<MemoryRouter><ResultGroup label="Places" cards={[]} kind="place" /></MemoryRouter>);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Search/__tests__/ResultGroup.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement cards + ResultGroup**

Create `frontend/webapp/src/views/Search/cards.js`:
```js
import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";

export function PersonChip({ card }) {
  const slug = (card.slug || "").replace(/^people\//, "");
  return <Link className="result-chip person" to={`/${card.slug}`}>
    <img alt={card.title} src={assetUrl + `/people/${slug}`} />
    <span>{card.title}</span>
  </Link>;
}
export function PlaceChip({ card }) {
  return <Link className="result-chip place" to={`/${card.slug}`}><span>{card.title}</span></Link>;
}
export function ContentCard({ card }) {
  return <Link className="result-card content" to={`/${card.slug}`}>
    {card.title && <h6>{card.title}</h6>}
    {card.snippet && <p>{card.snippet}</p>}
  </Link>;
}
export function EventCard({ card }) {
  return <Link className="result-card event" to={`/${card.slug}`}>
    <span className="event-date">{card.ref}</span><span>{card.title}</span>
  </Link>;
}
```

Create `frontend/webapp/src/views/Search/ResultGroup.js`:
```js
import React from "react";
import { PersonChip, PlaceChip, ContentCard, EventCard } from "./cards";

const CARD = { person: PersonChip, place: PlaceChip, commentary: ContentCard, narration: ContentCard, page: ContentCard, event: EventCard };

export default function ResultGroup({ label, cards, kind }) {
  if (!cards || !cards.length) return null;
  const Card = CARD[kind] || ContentCard;
  const chips = kind === "person" || kind === "place";
  return (
    <section className={`result-group ${kind}`}>
      <h4 className="result-group-header">{label} <span className="count">({cards.length})</span></h4>
      <div className={chips ? "chip-row" : "card-list"}>
        {cards.map((c, i) => <Card key={c.slug || i} card={c} />)}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Search/__tests__/ResultGroup.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire `searchAll` into `Search.js`**

In `frontend/webapp/src/views/Search/Search.js`:
- Add `import ResultGroup from "./ResultGroup";`.
- Change the search API input from `{ search: keyword }` to `{ searchAll: keyword }` and read the grouped payload. The numeric-lookup branch (`{ lookup: keyword }`) is unchanged.
- Render the existing verse list from `r.searchAll.verses` (the verse card code is unchanged — point `r?.search?.map` at `r?.searchAll?.verses?.map`).
- After the verse list, render the groups:
```jsx
<ResultGroup label={label("menu_people") || "People"} cards={r.searchAll.people} kind="person" />
<ResultGroup label={label("menu_places") || "Places"} cards={r.searchAll.places} kind="place" />
<ResultGroup label="Commentary" cards={r.searchAll.commentary} kind="commentary" />
<ResultGroup label="Narration" cards={r.searchAll.narration} kind="narration" />
<ResultGroup label="Pages" cards={r.searchAll.pages} kind="page" />
<ResultGroup label="Events" cards={r.searchAll.events} kind="event" />
```
Confirm `BoMOnlineAPI` issues the `searchAll` GraphQL query (it maps the input key to a GraphQL field — verify `frontend/webapp/src/models/BoMOnlineAPI.js` supports a `searchAll` key with the `SearchAllResult` selection; add the query/selection there mirroring how `search` is defined). Keep the verse `count` heading driven by `verses.length`.

- [ ] **Step 6: Verify build + tests**

Run:
```bash
cd /home/bom/BookofMormonOnline/frontend/webapp
CI=true npx react-scripts test --watchAll=false src/views/Search/__tests__/ResultGroup.test.js
```
Expected: PASS. Then confirm the CRA dev server recompiles `Search.js` without errors (check `journalctl --user -u bom-dev` for a clean compile, per CLAUDE.md verify on `localhost:8200`).

- [ ] **Step 7: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Search/ResultGroup.js frontend/webapp/src/views/Search/cards.js frontend/webapp/src/views/Search/Search.js frontend/webapp/src/models/BoMOnlineAPI.js frontend/webapp/src/views/Search/__tests__/ResultGroup.test.js
git commit -m "feat(search): grouped multi-entity results in Search view"
```

---

## Task 7: Reindex + end-to-end verification (ops)

**Files:** none (ops; requires Qdrant + OpenAI key live).

- [ ] **Step 1: Reindex all types**

Run (as the user/root agent with env): `cd /home/bom/BookofMormonOnline/backend && npx tsx scripts/reindex-search.ts`
Expected: prints verse count plus a line per type (`Reindexed N person points.` etc.). Verify counts: `curl -s http://127.0.0.1:6333/collections/bom_content | jq '.result.points_count'` is now well above 6604.

- [ ] **Step 2: Query `searchAll` end-to-end**

```bash
curl -s 'http://127.0.0.1:5006/en' -H 'Content-Type: application/json' \
  --data-raw '{"query":"{searchAll(query:\"abinadi\"){ verses{reference} people{title slug} places{title slug} commentary{snippet slug} }}"}' | jq '.data.searchAll | {verses: (.verses|length), people: .people, places: (.places|length), commentary: (.commentary|length)}'
```
Expected: `people` includes Abinadi; `verses` populated; other groups as available.

- [ ] **Step 3: Confirm the UI on `localhost:8200`**

Load `http://localhost:8200/search/abinadi` and confirm verses render first, followed by non-empty People/Places/Commentary/etc. sections. Report findings.

---

## Self-Review

**Spec coverage:** index six types (Tasks 1,3,4) ✓; embed-once per-group fan-out (Tasks 2,5) ✓; `searchAll` grouped query, `search` untouched (Task 5) ✓; verses primary + per-type sections incl. separate Narration & Pages (Task 6) ✓; reuse verse hydration + dedupe (Task 5 resolver calls `searchQuery`) ✓; sparse-vector name precision (inherited from Phase 1 — no separate lookup path) ✓; testing across pure builders/mappers + skip-if-unreachable + frontend render (Tasks 1–6) ✓; reindex + verify (Task 7) ✓.

**Placeholder scan:** the per-type `load` bodies for commentary/narration/page/event are specified by source table + the exact existing loader to mirror (`scriptureextras.ts:229`, `searchhist.ts` narration/page/`historyQuery`) with a fixed `SourceRow` contract and a tsc gate that fails on wrong column names — a directed lookup of real columns, not a vague TODO. Everything else is complete code.

**Type consistency:** `SourceRow`/`IndexUnit`/`TypeConfig` (Task 1) used by adapters (Task 3) and CLI (Task 4); `searchVectors`/`queryWithVectors`/`QueryVectors` (Task 2) used by `grouped.ts` (Task 5); `ResultCard`/`hitToCard`/`GROUP_TYPES` (Task 5) used by schema + frontend (Tasks 5,6); `IndexPoint.title` + `SearchHit.title` added in Tasks 1/2 and consumed in 5. Names align.
