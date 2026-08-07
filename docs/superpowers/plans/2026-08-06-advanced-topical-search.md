# Advanced (Topical) Search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the accidental zero-results semantic fallback into a deliberate, user-controllable "rich"/topical search mode, add the `bom_matters` corpus to supplement retrieval, and cap the unbounded keyword flood.

**Architecture:** `searchAll` gains an optional `mode` arg (`keyword` default | `rich`). Keyword mode keeps today's behavior but caps hydration and reports the true match count (`verseTotal`); rich mode always runs the hybrid Qdrant retrieval (`searchContent`/`searchGroups`) across all types including Matters. The frontend adds a mode toggle (carried in `?mode=rich`), a "100+ matches" banner that switches to rich, and a Matters result group. All new branching lives in small pure helpers so it's unit-testable; the DB/GraphQL wiring is verified by running the app + reindex.

**Tech Stack:** Backend — TypeScript, Kysely (MySQL), Qdrant, vitest. Frontend — React 17, react-router, `@testing-library/react` (react-scripts/jest).

**Spec:** `docs/superpowers/specs/2026-08-06-advanced-topical-search-design.md`

---

## Facts resolved during spec review (do not re-litigate)

- **Matter route:** `/matters/:matterSlug` (`frontend/webapp/src/models/Routes.js:246`) → adapter slug is `matters/<slug>`.
- **`bom_matters` columns** (verified `backend/codegen/db.d.ts`): `slug, name, subtitle, description, aliases, tags, weight, status, guid, verse_id, …`. **No `terms` column.**
- **No status filter:** neither `mattersBySlugs` nor `allMatters` (`backend/src/data/loaders/matters.ts:130,149`) filter on `status` — the app treats all matters as live. Index all of them for parity. (Do NOT invent a status filter.)
- **Slugs can repeat:** `mattersBySlugs` uses `where slug in … order by weight desc` (multiple rows per slug possible). Point IDs are deterministic UUIDv5 keyed on `entity_id=slug`, so duplicates would silently overwrite. **Dedupe by slug keeping the highest `weight`** (matches resolver precedence). No-op if slugs turn out unique.
- **`searchContent` throws by design** (`backend/src/search/retrieve.ts:64`); `resolveCandidates` and `searchGroups` already wrap it and degrade. Rich mode follows the same contract.
- **`VERSE_CAP = 100`** — the keyword hydration cap AND the banner threshold. Kept as a backend constant; the frontend hardcodes the same `100` (comment cross-references it).

## File structure

**Backend (create/modify):**
- `backend/src/search/types.ts` — add `'matter'` to `ContentType`.
- `backend/src/search/adapters.ts` — add `matterRowToSource`, `dedupeMattersByWeight`, `loadMatters`, register in `TYPE_CONFIGS`.
- `backend/src/search/grouped.ts` — add `'matter'` to `GROUP_TYPES`; add pure `wantsGroups(mode, semantic)`.
- `backend/src/data/loaders/searchhist.ts` — add `VERSE_CAP`, `applyVerseCap`, `mode` param to `resolveCandidates`, `mode`/`verseTotal`/cap in `searchQuery`.
- `backend/src/graphql/resolvers/searchhist.ts` — `searchAllResolver` reads `mode`, gates groups via `wantsGroups`, returns `verseTotal` + `matters`.
- `backend/schema/BomUtils.graphql` — `mode` arg + `verseTotal` + `matters` fields.
- Tests: `backend/test/search/adapters.test.ts`, `grouped.test.ts`, `candidates.test.ts`, and new `backend/test/search/verse-cap.test.ts`.

**Frontend (create/modify):**
- `frontend/webapp/src/views/Search/searchMode.js` — **new** pure helpers (`parseMode`, `buildSearchPath`, `shouldOfferRich`, `isRichDegraded`).
- `frontend/webapp/src/models/GraphQLQueries.js` — extend `searchAll` builder (add `verseTotal`, `matters`); add `searchAllRich` builder.
- `frontend/webapp/src/views/Search/ResultGroup.js` — add `matter` to the `CARD` map.
- `frontend/webapp/src/views/Search/Search.js` — mode from URL, toggle, banner, Matters group, degraded toast, refetch dep, mode-preserving `searchFor`.
- Tests: new `frontend/webapp/src/views/Search/__tests__/searchMode.test.js`; extend `__tests__/ResultGroup.test.js`; add a `GraphQLQueries` builder assertion test.

---

## Task 1: Add `matter` content type + Matters adapter

**Files:**
- Modify: `backend/src/search/types.ts:2`
- Modify: `backend/src/search/adapters.ts` (add mapper + loader + registry entry)
- Test: `backend/test/search/adapters.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `backend/test/search/adapters.test.ts`

Add `matterRowToSource, dedupeMattersByWeight` to the existing import from `../../src/search/adapters.js`, then append:

```ts
describe('matter mapper', () => {
  test('matterRowToSource joins name+subtitle+description+aliases+tags, matters/ slug, ref null', () => {
    const r = matterRowToSource({
      slug: 'faith', name: 'Faith', subtitle: 'Belief unto action',
      description: 'The first principle', aliases: 'belief', tags: 'doctrine',
    });
    expect(r).toEqual({
      entity_id: 'faith',
      title: 'Faith',
      text: 'Faith Belief unto action The first principle belief doctrine',
      slug: 'matters/faith',
      ref: null,
    });
  });

  test('matterRowToSource falls back to slug when name is null', () => {
    const r = matterRowToSource({ slug: 'x', name: null, subtitle: null, description: null, aliases: null, tags: null });
    expect(r).toEqual({ entity_id: 'x', title: 'x', text: '', slug: 'matters/x', ref: null });
  });
});

describe('dedupeMattersByWeight', () => {
  test('keeps the highest-weight row per slug', () => {
    const rows = [
      { slug: 'a', weight: 1, name: 'lo' },
      { slug: 'a', weight: 5, name: 'hi' },
      { slug: 'b', weight: 2, name: 'b' },
    ];
    const out = dedupeMattersByWeight(rows).sort((x, y) => x.slug.localeCompare(y.slug));
    expect(out).toEqual([{ slug: 'a', weight: 5, name: 'hi' }, { slug: 'b', weight: 2, name: 'b' }]);
  });
});

describe('TYPE_CONFIGS matter', () => {
  test('registers matter as a chunked type', () => {
    const byType = Object.fromEntries(TYPE_CONFIGS.map((c) => [c.cfg.type, c.cfg.chunk]));
    expect(byType.matter).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run test/search/adapters.test.ts`
Expected: FAIL — `matterRowToSource is not a function` / `dedupeMattersByWeight is not a function`.

- [ ] **Step 3: Add `'matter'` to the ContentType union**

In `backend/src/search/types.ts:2`:

```ts
export type ContentType = 'verse' | 'person' | 'place' | 'page' | 'narration' | 'commentary' | 'event' | 'matter';
```

- [ ] **Step 4: Implement the mapper, dedupe, loader, and registry entry** — append to `backend/src/search/adapters.ts` (before the `// ─── Registry ───` block), reusing the existing `clean`/`join` helpers

```ts
// ─── Matter ──────────────────────────────────────────────────────────────────
// Table: bom_matters (topics/subjects/themes)
// entity_id: slug (route key /matters/:matterSlug). NO `terms` column exists.
// slug: matters/<slug>. ref: null (matters are slug-navigated, not verse-anchored).

export function matterRowToSource(r: {
  slug: string;
  name: string | null;
  subtitle: string | null;
  description: string | null;
  aliases: string | null;
  tags: string | null;
}): SourceRow {
  return {
    entity_id: r.slug,
    title: clean(r.name) || r.slug,
    text: join(r.name, r.subtitle, r.description, r.aliases, r.tags),
    slug: `matters/${r.slug}`,
    ref: null,
  };
}

/** Slugs can repeat in bom_matters; deterministic point IDs key on slug, so collapse to the
 *  highest-weight row per slug (matches the resolver's `order by weight desc` precedence). */
export function dedupeMattersByWeight<T extends { slug: string; weight: number }>(rows: T[]): T[] {
  const bySlug = new Map<string, T>();
  for (const r of rows) {
    const existing = bySlug.get(r.slug);
    if (!existing || r.weight > existing.weight) bySlug.set(r.slug, r);
  }
  return [...bySlug.values()];
}

export const loadMatters = async (db: Kysely<DB>): Promise<SourceRow[]> => {
  const rows = (await db
    .selectFrom('bom_matters')
    .select(['slug', 'name', 'subtitle', 'description', 'aliases', 'tags', 'weight'])
    .execute()) as Array<{ slug: string; name: string | null; subtitle: string | null; description: string | null; aliases: string | null; tags: string | null; weight: number }>;
  return dedupeMattersByWeight(rows).map((r) => matterRowToSource(r));
};
```

Then add to the `TYPE_CONFIGS` array (after the `event` entry):

```ts
  { cfg: { type: 'matter',      chunk: true, maxChars: 600 },   load: loadMatters },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && npx vitest run test/search/adapters.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/search/types.ts backend/src/search/adapters.ts backend/test/search/adapters.test.ts
git commit -m "feat(search): add Matters corpus adapter + matter content type"
```

---

## Task 2: Add `matter` to search groups + `wantsGroups` helper

**Files:**
- Modify: `backend/src/search/grouped.ts:4` and add `wantsGroups`
- Test: `backend/test/search/grouped.test.ts`

- [ ] **Step 1: Update the failing tests** — edit `backend/test/search/grouped.test.ts`

Change the `GROUP_TYPES` assertion and the resilience assertion to include `matter`, add `wantsGroups` to the import, and add a `wantsGroups` block:

```ts
import { hitToCard, GROUP_TYPES, searchGroups, wantsGroups } from '../../src/search/grouped.js';
```

```ts
describe('GROUP_TYPES', () => {
  test('covers the non-verse groups incl. matter in display order', () => {
    expect(GROUP_TYPES).toEqual(['person', 'place', 'matter', 'commentary', 'narration', 'page', 'event']);
  });
});
```

```ts
describe('searchGroups resilience', () => {
  test('degrades to all-empty groups when the embed fails (never throws)', async () => {
    const out = await searchGroups('x', 'en', 8, async () => { throw new Error('embed down'); });
    expect(out).toEqual({ person: [], place: [], matter: [], commentary: [], narration: [], page: [], event: [] });
  });
});

describe('wantsGroups', () => {
  test('rich mode always wants groups', () => {
    expect(wantsGroups('rich', false)).toBe(true);
    expect(wantsGroups('rich', true)).toBe(true);
  });
  test('keyword mode wants groups only on the semantic fallback', () => {
    expect(wantsGroups('keyword', true)).toBe(true);
    expect(wantsGroups('keyword', false)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run test/search/grouped.test.ts`
Expected: FAIL — `GROUP_TYPES` mismatch (missing `matter`) and `wantsGroups is not a function`.

- [ ] **Step 3: Implement** — edit `backend/src/search/grouped.ts`

Line 4 becomes:

```ts
export const GROUP_TYPES: ContentType[] = ['person', 'place', 'matter', 'commentary', 'narration', 'page', 'event'];
```

Append the pure helper at the end of the file:

```ts
/** Whether to fetch supplement groups: always in rich mode; in keyword mode only when the
 *  semantic fallback ran (keyword hits alone return verses only). */
export function wantsGroups(mode: 'keyword' | 'rich', semantic: boolean): boolean {
  return mode === 'rich' || semantic;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npx vitest run test/search/grouped.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/search/grouped.ts backend/test/search/grouped.test.ts
git commit -m "feat(search): include Matters in supplement groups + wantsGroups gate"
```

---

## Task 3: Add `mode` to `resolveCandidates`

**Files:**
- Modify: `backend/src/data/loaders/searchhist.ts:126-156`
- Test: `backend/test/search/candidates.test.ts`

- [ ] **Step 1: Write the failing tests** — append to the `resolveCandidates` describe block in `backend/test/search/candidates.test.ts`

```ts
  test('rich mode runs semantic directly, skips keyword, semantic:true', async () => {
    let kwCalled = false;
    const r = await resolveCandidates(db, 'charity', 'en', true, {
      keyword: async () => { kwCalled = true; return ['1']; },
      semantic: async () => ['200', '201'],
    }, 'rich');
    expect(r).toEqual({ ids: ['200', '201'], semantic: true });
    expect(kwCalled).toBe(false);
  });
  test('rich mode with zero semantic hits but backend reachable → semantic:true, empty ids', async () => {
    const r = await resolveCandidates(db, 'q', 'en', true, { keyword: async () => ['x'], semantic: async () => [] }, 'rich');
    expect(r).toEqual({ ids: [], semantic: true });
  });
  test('rich mode when semantic throws → empty, semantic:false (degraded)', async () => {
    const r = await resolveCandidates(db, 'q', 'en', true, { keyword: async () => ['x'], semantic: async () => { throw new Error('down'); } }, 'rich');
    expect(r).toEqual({ ids: [], semantic: false });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run test/search/candidates.test.ts`
Expected: FAIL — rich-mode tests get keyword-first behavior (semantic:false / keyword called).

- [ ] **Step 3: Implement** — edit `resolveCandidates` in `backend/src/data/loaders/searchhist.ts`

Add the `mode` param (6th, defaulted) and the rich branch. Replace the signature and body:

```ts
export async function resolveCandidates(
  db: Kysely<DB>,
  query: string,
  lang: string,
  isEnglish: boolean,
  deps: {
    keyword?: (q: string) => Promise<string[]>;
    semantic?: (q: string) => Promise<string[]>;
  } = {},
  mode: 'keyword' | 'rich' = 'keyword',
): Promise<{ ids: string[]; semantic: boolean }> {
  const keyword = deps.keyword ?? ((q: string) => getCandidateVerseIds(db, q, lang, isEnglish));
  const semantic =
    deps.semantic ??
    (async (q: string) => {
      const searchLang = isEnglish ? 'en' : lang;
      const hits = await searchContent({ query: q, types: ['verse'], lang: searchLang });
      return hitsToRankedVerseIds(hits);
    });

  // Rich: go straight to the semantic tier. Reachable → semantic:true even with zero hits
  // (so the resolver still shows supplement groups); only a throw counts as degraded.
  if (mode === 'rich') {
    try {
      const ids = await semantic(query);
      return { ids, semantic: true };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[search] rich retrieval failed:', err instanceof Error ? err.message : err);
      return { ids: [], semantic: false };
    }
  }

  const keywordIds = await keyword(query);
  if (keywordIds.length) return { ids: keywordIds, semantic: false };

  try {
    const ids = await semantic(query);
    if (ids.length) return { ids, semantic: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[search] semantic fallback failed:', err instanceof Error ? err.message : err);
  }
  return { ids: [], semantic: false };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npx vitest run test/search/candidates.test.ts`
Expected: PASS (existing keyword-mode tests still pass — `mode` defaults to `'keyword'`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/data/loaders/searchhist.ts backend/test/search/candidates.test.ts
git commit -m "feat(search): resolveCandidates rich mode (semantic-direct)"
```

---

## Task 4: `VERSE_CAP` + `applyVerseCap`, wire mode/cap/verseTotal into `searchQuery`

**Files:**
- Modify: `backend/src/data/loaders/searchhist.ts` (add const + helper; edit `searchQuery`)
- Test: `backend/test/search/verse-cap.test.ts` (new)

- [ ] **Step 1: Write the failing test** — create `backend/test/search/verse-cap.test.ts`

```ts
import { describe, expect, test } from 'vitest';
import { applyVerseCap, VERSE_CAP } from '../../src/data/loaders/searchhist.js';

describe('applyVerseCap', () => {
  test('VERSE_CAP is 100', () => {
    expect(VERSE_CAP).toBe(100);
  });
  test('caps hydrateIds to the cap while verseTotal reports the raw count', () => {
    const ids = Array.from({ length: 250 }, (_, i) => String(i));
    const { hydrateIds, verseTotal } = applyVerseCap(ids, 100);
    expect(hydrateIds).toHaveLength(100);
    expect(hydrateIds[0]).toBe('0');
    expect(hydrateIds[99]).toBe('99');
    expect(verseTotal).toBe(250);
  });
  test('leaves a short list untouched', () => {
    const { hydrateIds, verseTotal } = applyVerseCap(['a', 'b'], 100);
    expect(hydrateIds).toEqual(['a', 'b']);
    expect(verseTotal).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run test/search/verse-cap.test.ts`
Expected: FAIL — `applyVerseCap`/`VERSE_CAP` not exported.

- [ ] **Step 3: Add the constant + helper** — in `backend/src/data/loaders/searchhist.ts`, just above `getCandidateVerseIds` (~line 95)

```ts
/** Max verses hydrated+returned for a keyword search. A LIKE on a common word matches
 *  thousands of rows; hydrating them all is a perf pathology and floods the UI. The raw
 *  match count travels separately as `verseTotal` so the client can offer topical search. */
export const VERSE_CAP = 100;

/** Split a candidate id list into the slice we hydrate and the true total. */
export function applyVerseCap(ids: string[], cap: number): { hydrateIds: string[]; verseTotal: number } {
  return { hydrateIds: ids.slice(0, cap), verseTotal: ids.length };
}
```

- [ ] **Step 4: Thread mode + cap + verseTotal through `searchQuery`** — edit `backend/src/data/loaders/searchhist.ts`

Change the signature and return type (line ~167):

```ts
export async function searchQuery(
  db: Kysely<DB>,
  query: string,
  lang: string,
  opts: { mode?: 'keyword' | 'rich' } = {},
): Promise<{ verses: SearchResultRow[]; semantic: boolean; verseTotal: number }> {
  const mode = opts.mode === 'rich' ? 'rich' : 'keyword';
  const isEnglish = !lang || lang === 'en' || lang === 'eng' || lang === 'dev';
  const isKorean = lang === 'ko';
  const minLen = isKorean ? 1 : 3;

  if (!query || query.length < minLen) return { verses: [], semantic: false, verseTotal: 0 };

  const { ids: candidateIds, semantic } = await resolveCandidates(db, query, lang, isEnglish, {}, mode);
  // Destructure the cap slice back into `verseIds` so the rest of the function is unchanged.
  const { hydrateIds: verseIds, verseTotal } = applyVerseCap(candidateIds, VERSE_CAP);

  if (!verseIds.length) return { verses: [], semantic, verseTotal };
```

Everything from the `bom_lookup` fetch down is unchanged (it already uses `verseIds`). Update the two remaining early returns and the final return to carry `verseTotal`:

- The `if (!lookupRows.length) return { verses: [], semantic };` line (~197) becomes:
```ts
  if (!lookupRows.length) return { verses: [], semantic, verseTotal };
```
- The final return (~372) becomes:
```ts
  return { verses: semantic ? rankRowsByCandidateOrder(results, verseIds) : results, semantic, verseTotal };
```

- [ ] **Step 5: Run the full search suite to verify pass + no regressions**

Run: `cd backend && npx vitest run test/search/ test/searchhist-dedupe.test.ts`
Expected: PASS. (The existing `Query.search` resolver ignores the extra `verseTotal`; TypeScript is happy because callers destructure a subset.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/data/loaders/searchhist.ts backend/test/search/verse-cap.test.ts
git commit -m "feat(search): cap keyword hydration (VERSE_CAP) + report verseTotal + rich mode in searchQuery"
```

---

## Task 5: SDL + `searchAllResolver` (mode routing, verseTotal, matters)

**Files:**
- Modify: `backend/schema/BomUtils.graphql:6,103-112`
- Modify: `backend/src/graphql/resolvers/searchhist.ts:104-130`

> No new unit test: the resolver needs a live GraphQL context + DB. Its branching logic is already covered by `wantsGroups` (Task 2) and the loader tests (Tasks 3–4). Wiring is verified in Task 10.

- [ ] **Step 1: Update the SDL** — edit `backend/schema/BomUtils.graphql`

Line 6:

```graphql
  searchAll(query: String!, mode: String): SearchAllResult!
```

`type SearchAllResult` (line 103) — add `verseTotal` and `matters`:

```graphql
type SearchAllResult {
  verses: [SearchResult!]!
  semantic: Boolean
  verseTotal: Int
  people: [ResultCard!]!
  places: [ResultCard!]!
  matters: [ResultCard!]!
  commentary: [ResultCard!]!
  narration: [ResultCard!]!
  pages: [ResultCard!]!
  events: [ResultCard!]!
}
```

- [ ] **Step 2: Update `searchAllResolver`** — edit `backend/src/graphql/resolvers/searchhist.ts`

Add `wantsGroups` to the grouped import:

```ts
import { searchGroups, wantsGroups } from '../../search/grouped.js';
```

Replace the whole `searchAllResolver` body (lines 104-130) with:

```ts
async function searchAllResolver(
  _root: unknown,
  args: { query: string; mode?: string | null },
  ctx: AppContext,
): Promise<unknown> {
  const lang = ctx.lang ?? 'en';
  const query = args.query ?? '';
  const mode = args.mode === 'rich' ? 'rich' : 'keyword';
  const db = (ctx.loaders as unknown as DbAccessor)._db;

  const { verses, semantic, verseTotal } = await searchQuery(db, query, lang, { mode });

  // Rich mode always fetches supplement groups; keyword mode only on the semantic fallback.
  const groups = wantsGroups(mode, semantic)
    ? await searchGroups(query, lang)
    : { person: [], place: [], matter: [], commentary: [], narration: [], page: [], event: [] };

  return {
    verses,
    semantic,
    verseTotal,
    people: groups.person ?? [],
    places: groups.place ?? [],
    matters: groups.matter ?? [],
    commentary: groups.commentary ?? [],
    narration: groups.narration ?? [],
    pages: groups.page ?? [],
    events: groups.event ?? [],
  };
}
```

- [ ] **Step 3: Typecheck the backend**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors. (`searchAll` is injected untyped via `Record<string, unknown>` assignment at line 133, so the new arg/fields need no codegen regen. If `npm run` has a codegen step you prefer, run it, but it is not required for this hack.)

- [ ] **Step 4: Run the backend search suite**

Run: `cd backend && npx vitest run test/search/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/schema/BomUtils.graphql backend/src/graphql/resolvers/searchhist.ts
git commit -m "feat(search): searchAll mode arg + verseTotal + matters group in resolver/SDL"
```

---

## Task 6: Frontend pure mode-helpers

**Files:**
- Create: `frontend/webapp/src/views/Search/searchMode.js`
- Test: `frontend/webapp/src/views/Search/__tests__/searchMode.test.js` (new)

- [ ] **Step 1: Write the failing test** — create `__tests__/searchMode.test.js`

```js
import { parseMode, buildSearchPath, shouldOfferRich, isRichDegraded } from '../searchMode';

describe('parseMode', () => {
  test('rich only when ?mode=rich', () => {
    expect(parseMode('?mode=rich')).toBe('rich');
    expect(parseMode('?mode=keyword')).toBe('keyword');
    expect(parseMode('')).toBe('keyword');
    expect(parseMode(undefined)).toBe('keyword');
  });
});

describe('buildSearchPath', () => {
  test('appends ?mode=rich only in rich mode', () => {
    expect(buildSearchPath('faith', 'rich')).toBe('/search/faith?mode=rich');
    expect(buildSearchPath('faith', 'keyword')).toBe('/search/faith');
  });
});

describe('shouldOfferRich', () => {
  test('offers only in keyword mode, non-semantic, over 100 matches', () => {
    expect(shouldOfferRich('keyword', false, 101)).toBe(true);
    expect(shouldOfferRich('keyword', false, 100)).toBe(false);
    expect(shouldOfferRich('keyword', true, 500)).toBe(false); // fallback already went semantic
    expect(shouldOfferRich('rich', false, 500)).toBe(false);
    expect(shouldOfferRich('keyword', false, undefined)).toBe(false);
  });
});

describe('isRichDegraded', () => {
  test('true only when rich mode came back non-semantic (vector backend down)', () => {
    expect(isRichDegraded('rich', false)).toBe(true);
    expect(isRichDegraded('rich', true)).toBe(false);
    expect(isRichDegraded('keyword', false)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Search/__tests__/searchMode.test.js`
Expected: FAIL — module `../searchMode` not found.

- [ ] **Step 3: Implement** — create `frontend/webapp/src/views/Search/searchMode.js`

```js
// Pure helpers for the search mode (keyword | rich). Kept out of Search.js so the
// branching is unit-testable. VERSE_CAP mirrors the backend constant (searchhist.ts).
export const VERSE_CAP = 100;

export function parseMode(search) {
  return new URLSearchParams(search || "").get("mode") === "rich" ? "rich" : "keyword";
}

export function buildSearchPath(slug, mode) {
  return `/search/${slug}${mode === "rich" ? "?mode=rich" : ""}`;
}

// Keyword search that returned a non-semantic flood: offer topical ranking.
export function shouldOfferRich(mode, semantic, verseTotal) {
  return mode === "keyword" && !semantic && (verseTotal ?? 0) > VERSE_CAP;
}

// Rich search that came back non-semantic means the vector backend was unreachable.
export function isRichDegraded(mode, semantic) {
  return mode === "rich" && semantic === false;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Search/__tests__/searchMode.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Search/searchMode.js frontend/webapp/src/views/Search/__tests__/searchMode.test.js
git commit -m "feat(search): pure mode helpers (parse/build/offer/degraded)"
```

---

## Task 7: GraphQL query builders (`searchAll` + `searchAllRich`)

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js:578-596`
- Test: `frontend/webapp/src/models/__tests__/searchAllQueries.test.js` (new)

> `searchAllRich` emits the **same GraphQL field** `searchAll` with `mode: "rich"` and keeps `type: "searchAll"`, so `structureResults` (`BoMOnlineAPI.js:121-123`, which reads `apiResults["searchAll"]` for the `searchAll` type) maps the response identically in both modes — no positional-keying risk, no response-shape change. Only one of the two builders is ever sent per request.

- [ ] **Step 1: Write the failing test** — create `frontend/webapp/src/models/__tests__/searchAllQueries.test.js`

```js
import { prepareQueries } from '../GraphQLQueries';

test('keyword searchAll requests verseTotal and matters, no mode arg', () => {
  const [q] = prepareQueries({ searchAll: 'faith' });
  expect(q.type).toBe('searchAll');
  expect(q.query).toContain('searchAll (query: "faith")');
  expect(q.query).toContain('verseTotal');
  expect(q.query).toContain('matters { slug title snippet ref score }');
});

test('searchAllRich targets the searchAll field with mode:"rich" and type stays searchAll', () => {
  const [q] = prepareQueries({ searchAllRich: 'faith' });
  expect(q.type).toBe('searchAll');
  expect(q.query).toContain('searchAll (query: "faith", mode: "rich")');
  expect(q.query).toContain('matters { slug title snippet ref score }');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/__tests__/searchAllQueries.test.js`
Expected: FAIL — no `verseTotal`/`matters` in output; `searchAllRich` not a query.

- [ ] **Step 3: Implement** — edit `frontend/webapp/src/models/GraphQLQueries.js`

Replace the `searchAll` builder (lines 578-596) with the extended builder plus the new `searchAllRich` builder. Both share one selection set:

```js
  searchAll: (query) => {
    return {
      type: "searchAll",
      key: "query",
      val: query,
      query:
        q("searchAll", "query", query) +
        `{
            semantic
            verseTotal
            verses { reference text slug page section narration speaker voice highlight { start end } }
            people { slug title snippet ref score }
            places { slug title snippet ref score }
            matters { slug title snippet ref score }
            commentary { slug title snippet ref score highlight { start end } }
            narration { slug title snippet ref score highlight { start end } }
            pages { slug title snippet ref score }
            events { slug title snippet ref score }
          }`,
    }
  },
  // Rich/topical search: same `searchAll` field + response shape, mode:"rich".
  // type stays "searchAll" so BoMOnlineAPI.structureResults keys the response identically.
  searchAllRich: (query) => {
    return {
      type: "searchAll",
      key: "query",
      val: query,
      query:
        `searchAll (query: ${JSON.stringify(query)}, mode: "rich")` +
        `{
            semantic
            verseTotal
            verses { reference text slug page section narration speaker voice highlight { start end } }
            people { slug title snippet ref score }
            places { slug title snippet ref score }
            matters { slug title snippet ref score }
            commentary { slug title snippet ref score highlight { start end } }
            narration { slug title snippet ref score highlight { start end } }
            pages { slug title snippet ref score }
            events { slug title snippet ref score }
          }`,
    }
  },
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/models/__tests__/searchAllQueries.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/models/GraphQLQueries.js frontend/webapp/src/models/__tests__/searchAllQueries.test.js
git commit -m "feat(search): frontend searchAll requests verseTotal+matters; add searchAllRich builder"
```

---

## Task 8: `matter` card kind in `ResultGroup`

**Files:**
- Modify: `frontend/webapp/src/views/Search/ResultGroup.js:4`
- Test: `frontend/webapp/src/views/Search/__tests__/ResultGroup.test.js`

- [ ] **Step 1: Write the failing test** — append to `__tests__/ResultGroup.test.js`

```js
test('renders a matter group using the content card', () => {
  const cards = [{ slug: 'matters/faith', title: 'Faith', snippet: 'first principle', ref: null, score: 0.9 }];
  const { getByText, container } = render(
    <MemoryRouter>
      <ResultGroup label="Matters" cards={cards} kind="matter" query="faith" semantic />
    </MemoryRouter>
  );
  expect(getByText('Faith')).toBeInTheDocument();
  expect(container.querySelector('.result-group.matter')).toBeInTheDocument();
});
```

> Match the existing imports at the top of `ResultGroup.test.js` (React, `render`, `MemoryRouter`, `ResultGroup`). If `MemoryRouter` isn't already imported there, add `import { MemoryRouter } from 'react-router-dom';`.

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Search/__tests__/ResultGroup.test.js`
Expected: FAIL — matter falls through to default `ContentCard` OK for render, but assert first that the `CARD` map explicitly lists `matter`; if the test passes accidentally, keep it as a regression guard. (If it already passes because of the `|| ContentCard` fallback, proceed — Step 3 makes the mapping explicit.)

- [ ] **Step 3: Implement** — edit `frontend/webapp/src/views/Search/ResultGroup.js:4`

```js
const CARD = { person: PersonChip, place: PlaceChip, matter: ContentCard, commentary: ContentCard, narration: ContentCard, page: ContentCard, event: EventCard };
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Search/__tests__/ResultGroup.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Search/ResultGroup.js frontend/webapp/src/views/Search/__tests__/ResultGroup.test.js
git commit -m "feat(search): matter card kind in ResultGroup"
```

---

## Task 9: Wire the mode toggle, banner, Matters group, and degraded toast into `Search.js`

**Files:**
- Modify: `frontend/webapp/src/views/Search/Search.js`

> Pure logic (mode parse, banner decision, degraded detection) is already tested in Task 6. This task is DOM wiring, verified by running the app (Task 10).

- [ ] **Step 1: Import the helpers and router location** — edit the imports at the top of `Search.js`

Add `useLocation` to the `react-router-dom` import and import the mode helpers:

```js
import { useRouteMatch, useHistory, useLocation, Link } from "react-router-dom";
import { parseMode, buildSearchPath, shouldOfferRich, isRichDegraded } from "./searchMode";
```

- [ ] **Step 2: Derive mode + offer/degraded state** — inside `SearchComponent`, after the existing `history`/`match` hooks

```js
  const location = useLocation();
  const mode = parseMode(location.search);
  const [offerRich, setOfferRich] = useState(false);
```

- [ ] **Step 3: Make `searchFor` preserve the current mode** — replace the `history.push` line inside `searchFor`

```js
  const searchFor = (keyword) => {
    if (keyword.trim() === "") return;
    history.push(buildSearchPath(getSearchSlug(keyword), mode));
    document.querySelector(".nav .searchbox input").value = keyword;
  }
```

- [ ] **Step 4: Add the mode toggle + banner elements** — after the `searchBox` definition

```js
  const toggle = (
    <div className="search-mode-toggle">
      <button
        className={mode === "keyword" ? "active" : ""}
        onClick={() => history.push(buildSearchPath(getSearchSlug(keyword), "keyword"))}
      >{label("search_verses_only") || "Verses"}</button>
      <button
        className={mode === "rich" ? "active" : ""}
        onClick={() => history.push(buildSearchPath(getSearchSlug(keyword), "rich"))}
      >{label("search_everything") || "Everything"}</button>
    </div>
  );

  const richBanner = (verseTotal) => (
    <div className="search-rich-banner">
      {label("search_many_results", [verseTotal]) || `${verseTotal} matches — showing the first ${100}.`}{" "}
      <button onClick={() => history.push(buildSearchPath(getSearchSlug(keyword), "rich"))}>
        {label("search_try_topical") || "Try topical search"}
      </button>
    </div>
  );
```

- [ ] **Step 5: Select the builder by mode, handle verseTotal/degraded in the results effect** — edit the results `useEffect` (currently `},[keyword])`)

Replace the `apiInput` line and add mode to the request + refetch on mode change. Where the effect currently builds `apiInput`:

```js
    const apiInput = (keyword.match(/\d/))
      ? { lookup: keyword }
      : (mode === "rich" ? { searchAllRich: keyword } : { searchAll: keyword });
```

Inside the `else` branch (the `searchAll` handling), after `const sa = r.searchAll;` and the existing `const semantic = !!sa.semantic;`, add:

```js
        const verseTotal = sa.verseTotal ?? verses.length;
        setOfferRich(shouldOfferRich(mode, semantic, verseTotal));
        if (isRichDegraded(mode, semantic))
          toast.warning(label("search_topical_unavailable") || "Topical search is unavailable — showing keyword matches", { position: "top-center" });
```

Add the Matters group to the rendered result block (right after the `places` `ResultGroup`):

```js
          <ResultGroup label={label("menu_matters") || "Matters"} cards={r.searchAll.matters} kind="matter" query={keyword} semantic={semantic} />
```

Prepend the banner above the verses list (inside the `setContent(<div>…</div>)` that renders results), guarded by `offerRich`:

```js
          {shouldOfferRich(mode, semantic, verseTotal) && richBanner(verseTotal)}
```

Finally, change the effect dependency array from `[keyword]` to refetch on mode change:

```js
  },[keyword, mode])
```

- [ ] **Step 6: Show the toggle on the results heading** — add `{toggle}` next to the results `<h3>` heading (the `x_search_results_for_y` block) so users can switch modes after a search.

- [ ] **Step 7: Run the Search view tests to confirm nothing regressed**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Search`
Expected: PASS (existing highlight/ResultGroup/searchMode suites green).

- [ ] **Step 8: Commit**

```bash
git add frontend/webapp/src/views/Search/Search.js
git commit -m "feat(search): mode toggle, 100+ banner, Matters group, degraded-rich toast in Search view"
```

---

## Task 10: Reindex Matters + full verification

**Files:** none (operational)

> The reindex script (`backend/scripts/reindex-search.ts`) already loops `TYPE_CONFIGS`, so Matters is picked up automatically once Task 1 registered it. Deterministic point IDs make this safe to re-run.

- [ ] **Step 1: Run the full backend test suite**

Run: `cd backend && npx vitest run`
Expected: PASS across the search suite and no new failures elsewhere.

- [ ] **Step 2: Reindex (requires Qdrant + OPENAI_API_KEY + DB env)**

Run: `cd backend && npx tsx scripts/reindex-search.ts` (or the project's configured runner for this script)
Expected output includes a line like `Reindexed N matter points.` with N > 0.

> If the script cannot run in this environment (no Qdrant/OpenAI creds), record that and hand the reindex to whoever has the dev env. Rich-mode Matters results won't appear until the reindex runs, but keyword mode and the toggle/banner UI work without it.

- [ ] **Step 3: Manual verification against localhost (NOT bom.kckern.net — Cloudflare caches the bundle)**

Bounce dev if needed (`systemctl --user restart bom-dev`, authorized per project notes), then verify at `http://localhost:8200`:
- A common word (e.g. `the`) in keyword mode → results paint fast, capped at 100, and the "100+ matches — try topical search" banner shows.
- Click the banner / the **Everything** toggle → URL gains `?mode=rich`, results re-fetch, grouped supplement sections appear including a **Matters** group for a topical query (e.g. `faith`, `pride`, `atonement`).
- A zero-keyword query (e.g. an odd phrase) still auto-falls back to grouped semantic results (unchanged).
- Matter cards link to `/matters/<slug>` and load the matter page.

- [ ] **Step 4: Final commit (if any doc/status notes)**

```bash
git add -A
git commit -m "chore(search): reindex Matters + verify advanced topical search end-to-end"
```

---

## Notes / deferred (from the spec)

- **Dictionary** (`bom_xtras_dictionary`) is the fast follow — needs a `dictionaryEntry` resolver + `/dictionary/<word>` route before it can be a clickable group. Separate spec/plan.
- **Theology** (`bom_theology`) is out of scope — no resolver/slug yet.
- **i18n:** toggle/banner strings use `label(...) || "fallback"`, so they work without new label-table rows but can be localized later by adding those keys.
- **Non-English rich mode:** supplement corpora (incl. Matters) are indexed English-only for now; non-`en` sessions get in-language verses but sparse/empty supplement groups. Acceptable this round.
