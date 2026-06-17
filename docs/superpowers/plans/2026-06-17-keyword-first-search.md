# Keyword-First Search (Semantic Fallback) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make literal keyword (`LIKE`) verse search the primary path that does zero embeddings; fall back to semantic (Qdrant) verse search + entity groups + lazy highlighting only when the keyword search returns zero verses. Removes the eager-highlight latency regression.

**Architecture:** Invert `resolveCandidates` to keyword-first (returns `{ids, semantic}`); `searchQuery` returns `{verses, semantic}`; `searchAllResolver` calls `searchGroups` only when `semantic`, drops the eager-highlight block, and returns a `semantic` flag. The frontend renders groups only when present (keyword mode = verses only), keyword-highlights in keyword mode, and lazy-fetches semantic highlights (verses + cards) only when `semantic` is true.

**Tech Stack:** TypeScript ESM (Kysely/Vitest), GraphQL (graphql-yoga, schema in `backend/schema/`), React 17 (`frontend/webapp`, jest/RTL).

**Reference spec:** `docs/superpowers/specs/2026-06-17-keyword-first-search-design.md`.

**Conventions:** Backend from `backend/` (ESM `.js` imports; `npx vitest run <path>`). Frontend `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false <path>`. MAIN checkout, commit on `dev`, verify HEAD after each.

---

## Task 1: Invert `resolveCandidates` (keyword-first) + `searchQuery` returns `{verses, semantic}`

**Files:**
- Modify: `backend/src/data/loaders/searchhist.ts`
- Test: `backend/test/search/candidates.test.ts`

- [ ] **Step 1: Write failing tests for the keyword-first tier decision**

Add to `backend/test/search/candidates.test.ts`:
```ts
import { resolveCandidates } from '../../src/data/loaders/searchhist.js';

describe('resolveCandidates (keyword-first)', () => {
  const db = {} as never; // unused: lookups are injected
  test('keyword hits → semantic:false and the semantic lookup is NOT called', async () => {
    let semCalled = false;
    const r = await resolveCandidates(db, 'charity', 'en', true, {
      keyword: async () => ['101', '102'],
      semantic: async () => { semCalled = true; return ['999']; },
    });
    expect(r).toEqual({ ids: ['101', '102'], semantic: false });
    expect(semCalled).toBe(false);
  });
  test('zero keyword → semantic fallback runs and returns semantic:true', async () => {
    const r = await resolveCandidates(db, 'afterlife', 'en', true, {
      keyword: async () => [],
      semantic: async () => ['200', '201'],
    });
    expect(r).toEqual({ ids: ['200', '201'], semantic: true });
  });
  test('zero keyword + zero semantic → empty, semantic:false', async () => {
    const r = await resolveCandidates(db, 'zzz', 'en', true, {
      keyword: async () => [],
      semantic: async () => [],
    });
    expect(r).toEqual({ ids: [], semantic: false });
  });
  test('zero keyword + semantic throws → empty, never throws', async () => {
    const r = await resolveCandidates(db, 'x', 'en', true, {
      keyword: async () => [],
      semantic: async () => { throw new Error('qdrant down'); },
    });
    expect(r).toEqual({ ids: [], semantic: false });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/search/candidates.test.ts`
Expected: FAIL (resolveCandidates signature/behavior differs — currently `{ids,ranked}`, Qdrant-first, no injectable deps).

- [ ] **Step 3: Rewrite `resolveCandidates` keyword-first with injectable deps**

In `backend/src/data/loaders/searchhist.ts`, replace the existing `resolveCandidates` (and its doc comment) with:
```ts
/**
 * Resolve candidate verse_ids, keyword-first. Tier 1: literal LIKE (getCandidateVerseIds).
 * Tier 2 (only when Tier 1 is empty): semantic Qdrant vector search. `semantic` is true
 * only when the result came from the vector tier (downstream applies relevance ordering then).
 * Never throws — a failed/empty semantic tier yields { ids: [], semantic: false }.
 * `deps` lets tests inject the keyword/semantic lookups.
 */
export async function resolveCandidates(
  db: Kysely<DB>,
  query: string,
  lang: string,
  isEnglish: boolean,
  deps: {
    keyword?: (q: string) => Promise<string[]>;
    semantic?: (q: string) => Promise<string[]>;
  } = {},
): Promise<{ ids: string[]; semantic: boolean }> {
  const keyword = deps.keyword ?? ((q: string) => getCandidateVerseIds(db, q, lang, isEnglish));
  const semantic =
    deps.semantic ??
    (async (q: string) => {
      const searchLang = isEnglish ? 'en' : lang; // English verses indexed under 'en'
      const hits = await searchContent({ query: q, types: ['verse'], lang: searchLang });
      return hitsToRankedVerseIds(hits);
    });

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
(`getSearchConfig` import may now be unused in this file — remove it if so; `searchContent`/`hitsToRankedVerseIds` are still used.)

- [ ] **Step 4: Make `searchQuery` return `{verses, semantic}` and gate the reorder on `semantic`**

In the same file, `searchQuery` currently does `const { ids: verseIds, ranked } = await resolveCandidates(...)` and at the end `return ranked ? rankRowsByCandidateOrder(results, verseIds) : results;`, with return type `Promise<SearchResultRow[]>`. Change:
- The destructure to `const { ids: verseIds, semantic } = await resolveCandidates(db, query, lang, isEnglish);`
- Every later use of `ranked` to `semantic`.
- The function's return type to `Promise<{ verses: SearchResultRow[]; semantic: boolean }>`.
- The early `return [];` guards (e.g. `if (!query || query.length < minLen) return [];` and `if (!verseIds.length) return [];`) to `return { verses: [], semantic: false };` (or `{ verses: [], semantic }` after resolveCandidates — use `semantic` where it's in scope, `false` before it).
- The final return from `return semantic ? rankRowsByCandidateOrder(results, verseIds) : results;` to `return { verses: semantic ? rankRowsByCandidateOrder(results, verseIds) : results, semantic };`.

- [ ] **Step 5: Run to verify it passes + tsc**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/search/candidates.test.ts && npx tsc --noEmit`
Expected: the 4 new tests pass; the existing `rankRowsByCandidateOrder` tests still pass. **tsc will FAIL** at the two call sites of `searchQuery` (the verses-only `search` resolver and `searchAllResolver`) because the return type changed — that's expected and fixed in Task 2. If any OTHER tsc error appears in `searchhist.ts` loader itself, fix it. (To isolate: the only expected tsc errors are in `src/graphql/resolvers/searchhist.ts`.)

- [ ] **Step 6: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/data/loaders/searchhist.ts backend/test/search/candidates.test.ts
git commit -m "feat(search): keyword-first resolveCandidates; searchQuery returns {verses,semantic}"
```

---

## Task 2: Resolver flow + schema (`searchGroups` only when semantic; drop eager; `semantic` flag)

**Files:**
- Modify: `backend/src/graphql/resolvers/searchhist.ts`
- Modify: `backend/schema/BomUtils.graphql`

- [ ] **Step 1: Update the verses-only `search` resolver**

In `backend/src/graphql/resolvers/searchhist.ts`, the `search` resolver currently does `return searchQuery(db, query, lang) as unknown as never[];`. Change to:
```ts
      return (await searchQuery(db, query, lang)).verses as unknown as never[];
```

- [ ] **Step 2: Rewrite `searchAllResolver` keyword-first; drop eager highlight**

Replace the body of `searchAllResolver` (from `const [verses, groups] = ...` through the final `return {...}`) with:
```ts
  const { verses, semantic } = await searchQuery(db, query, lang);

  // Entity groups + semantic highlighting are the FALLBACK experience: only when the
  // keyword tier found nothing and we went semantic. Keyword searches return verses only.
  const groups = semantic
    ? await searchGroups(query, lang)
    : { person: [], place: [], commentary: [], narration: [], page: [], event: [] };

  return {
    verses,
    semantic,
    people: groups.person ?? [],
    places: groups.place ?? [],
    commentary: groups.commentary ?? [],
    narration: groups.narration ?? [],
    pages: groups.page ?? [],
    events: groups.event ?? [],
  };
```
Remove the now-deleted eager-highlight block entirely. Remove the now-unused imports `computeHighlights` and `embedOne` from this file IF they're no longer referenced (the lazy `highlightResolver` uses `highlightText`, which stays). Run `grep -n "computeHighlights\|embedOne" src/graphql/resolvers/searchhist.ts` and drop the import only if there are no remaining uses.

- [ ] **Step 3: Add `semantic` to the schema**

In `backend/schema/BomUtils.graphql`, add to `type SearchAllResult { … }`:
```graphql
  semantic: Boolean
```
(`SearchAllResult` is resolved from the plain object the resolver returns — the `semantic` key surfaces via the default field resolver; no field-resolver block exists for it. Verify there is no explicit `SearchAllResult: {…}` block in the resolver that would need a `semantic` passthrough; if there is, add `semantic: (p) => p.semantic ?? false`.)

- [ ] **Step 4: tsc + tests**

Run: `cd /home/bom/BookofMormonOnline/backend && npx tsc --noEmit && npx vitest run test/search`
Expected: 0 tsc errors (the Task-1 call-site errors are now resolved); all search tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/graphql/resolvers/searchhist.ts backend/schema/BomUtils.graphql
git commit -m "feat(search): searchAll keyword-first (groups+semantic only on fallback); drop eager highlight"
```

- [ ] **Step 6: Live smoke test**

```bash
systemctl --user restart bom-greenfield && sleep 7
echo "--- charity (keyword): expect semantic:false, empty groups, FAST, no highlight range ---"
curl -s -w '\n[%{time_total}s]\n' 'http://127.0.0.1:5006/en' -H 'Content-Type: application/json' \
  --data-raw '{"query":"{searchAll(query:\"charity\"){ semantic verses{reference} people{title} commentary{title} }}"}' | python3 -c "import sys,json;d=sys.stdin.read();print(d)"
echo "--- afterlife (semantic): expect semantic:true, populated groups, FAST (no eager) ---"
curl -s -w '\n[%{time_total}s]\n' 'http://127.0.0.1:5006/en' -H 'Content-Type: application/json' \
  --data-raw '{"query":"{searchAll(query:\"afterlife\"){ semantic verses{reference} people{title} commentary{title} }}"}' | python3 -c "import sys,json;d=sys.stdin.read();print(d)"
```
Expected: `charity` → `semantic:false`, `people`/`commentary` absent (empty→stripped), time well under 0.5s. `afterlife` → `semantic:true`, `people`/`commentary` populated, time well under the old ~1.8s (no eager highlight). Report both bodies + times.

---

## Task 3: Frontend — `semantic` gating + lazy highlight hook for verses & cards

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js`
- Modify: `frontend/webapp/src/views/Search/highlightApi.js`
- Create: `frontend/webapp/src/views/Search/VerseResult.js`
- Modify: `frontend/webapp/src/views/Search/cards.js`
- Modify: `frontend/webapp/src/views/Search/Search.js`
- Test: `frontend/webapp/src/views/Search/__tests__/useHighlightRange.test.js`

- [ ] **Step 1: Add `semantic` to the searchAll selection**

In `frontend/webapp/src/models/GraphQLQueries.js`, the `searchAll` template selection: add the top-level field `semantic` (alongside `verses`/`people`/…). It becomes `searchAll(query:…){ semantic verses{…} people{…} … }`.

- [ ] **Step 2: Add a `useHighlightRange` hook (failing test first)**

Create `frontend/webapp/src/views/Search/__tests__/useHighlightRange.test.js`:
```js
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../highlightApi', () => ({ fetchHighlightRange: jest.fn() }));
import { fetchHighlightRange } from '../highlightApi';
import { useHighlightRange } from '../highlightApi.jsx';

// Force the no-IntersectionObserver path so the hook fetches immediately when enabled.
const realIO = global.IntersectionObserver;
beforeEach(() => { fetchHighlightRange.mockReset(); });
afterEach(() => { global.IntersectionObserver = realIO; });

function Probe({ enabled }) {
  const [range, ref] = useHighlightRange('afterlife', 'a, and the resurrection', enabled);
  return <div ref={ref} data-testid="r">{range ? `${range.start}-${range.end}` : 'none'}</div>;
}

test('does not fetch when disabled (keyword mode)', () => {
  delete global.IntersectionObserver;
  render(<Probe enabled={false} />);
  expect(fetchHighlightRange).not.toHaveBeenCalled();
});

test('fetches and exposes the range when enabled and IO unavailable', async () => {
  delete global.IntersectionObserver;
  fetchHighlightRange.mockResolvedValue({ start: 3, end: 9 });
  const { getByTestId } = render(<Probe enabled={true} />);
  await waitFor(() => expect(getByTestId('r').textContent).toBe('3-9'));
  expect(fetchHighlightRange).toHaveBeenCalledWith('afterlife', 'a, and the resurrection');
});
```
Run it → expect FAIL (hook missing). NOTE: the hook will live in a `.jsx`/`.js` module that exports both `fetchHighlightRange` (existing) and `useHighlightRange`; the test imports the hook from `../highlightApi.jsx` — adjust the import path in the test to wherever you place the hook (keep them co-located). If keeping everything in `highlightApi.js`, import the hook from `'../highlightApi'` and drop the separate mock target nuance (mock `fetchHighlightRange` via `jest.spyOn` on the module instead). Make the test runnable and the two assertions hold.

- [ ] **Step 3: Implement `useHighlightRange` (in `highlightApi.js`)**

Add to `frontend/webapp/src/views/Search/highlightApi.js`:
```js
import { useEffect, useRef, useState } from "react";

/**
 * Returns [range, ref]. When `enabled` (semantic mode), lazily fetches the semantic
 * highlight range for (query,text) once the element scrolls into view (or immediately
 * if IntersectionObserver is unavailable). Disabled (keyword mode) → never fetches.
 */
export function useHighlightRange(query, text, enabled) {
  const [range, setRange] = useState(null);
  const ref = useRef(null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !enabled || !text || !query) return undefined;
    const run = () => {
      if (done.current) return;
      done.current = true;
      fetchHighlightRange(query, text).then((r) => { if (r) setRange(r); });
    };
    if (typeof IntersectionObserver === "undefined") { run(); return undefined; }
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { run(); io.disconnect(); }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [query, text, enabled]);
  return [range, ref];
}
```
(`fetchHighlightRange` is already exported from this file; add the React import at the top. The hook lives in `.js`; JSX isn't used here so no `.jsx` rename is needed — update the test's import to `'../highlightApi'` and mock `fetchHighlightRange` accordingly.)
Run the test → expect PASS.

- [ ] **Step 4: Refactor `ContentCard` to use the hook (gated on `semantic`)**

In `frontend/webapp/src/views/Search/cards.js`, replace `ContentCard`'s inline IntersectionObserver/useState/useEffect with the hook. `ContentCard({ card, query, semantic })`:
```js
export function ContentCard({ card, query, semantic }) {
  const eager = card.highlight || null;
  const [range, ref] = useHighlightRange(query, card.snippet, semantic && !eager);
  return <Wrap slug={card.slug} className="result-card content" innerRef={ref}>
    {card.title && <h6>{card.title}</h6>}
    {card.snippet && <p>{renderHighlighted(card.snippet, eager || range, query)}</p>}
  </Wrap>;
}
```
Update imports: `import { fetchHighlightRange, useHighlightRange } from "./highlightApi";` (drop the now-unused direct `useState/useEffect/useRef`/`BoMOnlineAPI` if no longer referenced; keep `React`, `Wrap`, `renderHighlighted`, `assetUrl`). `ResultGroup` must pass `semantic` to each card.

- [ ] **Step 5: Thread `semantic` through `ResultGroup`**

In `frontend/webapp/src/views/Search/ResultGroup.js`, change `ResultGroup({ label, cards, kind, query })` → add `semantic`, and render `<Card card={c} query={query} semantic={semantic} key={c.slug || i} />`.

- [ ] **Step 6: Create `VerseResult` (verse row as a component, lazy highlight in semantic mode)**

Create `frontend/webapp/src/views/Search/VerseResult.js`:
```js
import React from "react";
import { Link, useHistory } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { renderHighlighted } from "./highlight";
import { useHighlightRange } from "./highlightApi";

export default function VerseResult({ item, keyword, semantic, appController, keywordRender }) {
  const history = useHistory();
  const { reference, text, slug, page, section, speaker, voice } = item;
  const [range, ref] = useHighlightRange(keyword, text, !!semantic);

  const handleReadClick = (e) => {
    e.preventDefault(); e.stopPropagation();
    const chapterSlug = reference.split(":")[0];
    const verse = reference.split(":")[1];
    history.push("/read/" + chapterSlug + "/" + verse);
  };
  const handleImgClick = (e) => {
    e.preventDefault(); e.stopPropagation();
    appController.functions.setPopUp({ type: "people", ids: [speaker], underSlug: `search/${keyword}` });
  };

  return <Link to={"/" + slug} ref={ref}>
    <div className="resultItem">
      <div className="reference-speaker noselect">
        <div className="reference noselect">{reference}</div>
        <div className="speaker noselect">
          <img alt={label(voice)} src={assetUrl + `/people/${speaker}`} onClick={handleImgClick} />
          <div className="read-voice" onClick={handleImgClick}>{label(voice)}</div>
        </div>
      </div>
      <div className="text">
        <h5 className="noselect">{section} <span>{page}</span>
          <button onClick={handleReadClick}>{label("menu_read")}</button>
          <button>{label("menu_study")}</button>
        </h5>
        <p className="scripture">{renderHighlighted(text, range, keyword, keywordRender)}</p>
      </div>
    </div></Link>;
}
```

- [ ] **Step 7: Use `VerseResult` + read `semantic` in `Search.js`**

In `frontend/webapp/src/views/Search/Search.js`:
- Add `import VerseResult from "./VerseResult";`.
- Read the flag: after `const sa = r.searchAll;` add `const semantic = !!sa.semantic;`.
- Replace the verse `.map(item => { …inline JSX… })` block with:
```jsx
{verses.map((item, i) => (
  <VerseResult key={item.slug || i} item={item} keyword={keyword} semantic={semantic}
    appController={appController} keywordRender={(t) => highlight(keyword, t)} />
))}
```
- Pass `semantic={semantic}` to each `<ResultGroup … />`.

- [ ] **Step 8: Tests + compile**

Run:
```bash
cd /home/bom/BookofMormonOnline/frontend/webapp
CI=true npx react-scripts test --watchAll=false src/views/Search/__tests__/useHighlightRange.test.js src/views/Search/__tests__/highlight.test.js src/views/Search/__tests__/highlightApi.test.js src/views/Search/__tests__/ResultGroup.test.js
```
Expected: all pass (the ResultGroup test may need a `semantic` prop added — it's optional/defaulting, so existing tests should still pass). Confirm clean CRA compile via `journalctl --user -u bom-dev --since '90 sec ago' --no-pager | grep -iE 'Compiled|Failed to compile|ERROR in' | tail`.

- [ ] **Step 9: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/models/GraphQLQueries.js frontend/webapp/src/views/Search/highlightApi.js frontend/webapp/src/views/Search/VerseResult.js frontend/webapp/src/views/Search/cards.js frontend/webapp/src/views/Search/ResultGroup.js frontend/webapp/src/views/Search/Search.js frontend/webapp/src/views/Search/__tests__/useHighlightRange.test.js
git commit -m "feat(search): keyword vs semantic frontend — gate lazy highlight + verses-only keyword mode"
```

---

## Task 4: End-to-end verification (ops)

**Files:** none.

- [ ] **Step 1: Timings + behavior**

```bash
cd /home/bom/BookofMormonOnline
t() { curl -s -o /dev/null -w "%{time_total}s" 'http://127.0.0.1:5006/en' -H 'Content-Type: application/json' --data-raw "$1"; }
echo -n "charity (keyword): "; t '{"query":"{searchAll(query:\"charity\"){semantic verses{reference}}}"}'; echo
echo -n "afterlife (semantic): "; t '{"query":"{searchAll(query:\"afterlife\"){semantic verses{reference} people{title}}}"}'; echo
```
Expected: `charity` well under ~0.4s (no embed), `afterlife` well under the old ~1.8s. Confirm `charity` → `semantic:false` + no groups, `afterlife` → `semantic:true` + groups.

- [ ] **Step 2: Browser**

Load `http://localhost:8200/search/charity` → verses only, keyword highlighted, fast. Load `http://localhost:8200/search/afterlife` → verses + entity groups; semantic highlights fade in on the verses + cards as they scroll into view. Report observations.

---

## Self-Review

**Spec coverage:** keyword-first verse `LIKE`, semantic only on zero → Task 1 (`resolveCandidates`). Groups + semantic only on fallback → Task 2 (`searchGroups` gated on `semantic`). Eager highlight removed → Task 2. `semantic` flag on `SearchAllResult` → Task 2 (schema) + Task 1 (plumbed through `searchQuery`). Frontend keyword-mode = verses only (empty groups render nothing) + lazy highlight gated on `semantic` (verses via `VerseResult`+hook, cards via `ContentCard`+hook) → Task 3. Keyword tier scripture-order + dedupe (no reorder unless `semantic`) → Task 1 (reorder gated on `semantic`). Perf verification → Task 4. Covered.

**Placeholder scan:** Task 2 Step 2/3 conditionally remove imports / add a field resolver based on a stated grep/inspection (directed, with both outcomes specified). Task 3 Step 2 notes adapting the test's mock/import to where the hook lands (concrete options given). No vague TODOs.

**Type consistency:** `resolveCandidates → {ids, semantic}` (T1) consumed by `searchQuery → {verses, semantic}` (T1) consumed by `search` resolver `.verses` + `searchAllResolver` destructure (T2); `semantic` flag flows resolver → schema `SearchAllResult.semantic` (T2) → GraphQL selection (T3) → `Search.js` `semantic` → `VerseResult`/`ResultGroup`/`ContentCard` props (T3). `useHighlightRange(query, text, enabled) → [range, ref]` defined T3 Step 3, used T3 Steps 4 & 6. `renderHighlighted(text, range, keyword, keywordRender)` unchanged, used in `VerseResult`. Names align.
