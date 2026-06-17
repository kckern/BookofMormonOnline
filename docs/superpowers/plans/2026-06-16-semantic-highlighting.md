# Semantic Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emphasize the tightest query-relevant phrase in prose search results that have no literal keyword match (e.g. `afterlife` → highlight "a space betwixt the time of death and the resurrection"), by embedding contiguous-clause spans and ranking them against the query vector.

**Architecture:** A shared pure core (`backend/src/search/highlight.ts`) splits text into clauses, forms 1–3-clause candidate spans, and picks the best by cosine vs the query's dense vector. `computeHighlights` batches the span embeddings; `searchAll` runs it eagerly on the top-N prose results and returns `{start,end}` offsets; a new `highlight(query,text)` query serves the rest lazily. The frontend `renderHighlighted` wraps the offset range in `<em>`, with the existing keyword `highlight()` as fallback; non-top-N cards lazy-fetch on viewport-enter.

**Tech Stack:** TypeScript ESM (Kysely/Vitest, AI SDK `embedOne`/`embedBatch`, `@qdrant/js-client-rest`), React 17 (`frontend/webapp`, jest/RTL).

**Reference spec:** `docs/superpowers/specs/2026-06-16-semantic-highlighting-design.md`. Reuses Phase-1/2 search modules in `backend/src/search/`.

**Conventions:** Backend cmds from `backend/`; ESM `.js` import specifiers; tests `npx vitest run <path>`. Frontend tests `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false <path>`. Work in the MAIN checkout (no worktrees); each commit on `dev`.

---

## Task 1: Highlight core (pure functions)

**Files:**
- Create: `backend/src/search/highlight.ts`
- Test: `backend/test/search/highlight.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/test/search/highlight.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { splitClauses, candidateSpans, bestSpanByCosine, hasKeywordOverlap } from '../../src/search/highlight.js';

describe('splitClauses', () => {
  test('splits on punctuation and keeps correct offsets', () => {
    const text = 'Faith, hope; and charity.';
    const clauses = splitClauses(text);
    expect(clauses.map((c) => c.text)).toEqual(['Faith', 'hope', 'charity']);
    for (const c of clauses) expect(text.slice(c.start, c.end)).toBe(c.text);
  });
  test('single clause returns whole trimmed text', () => {
    expect(splitClauses('  the resurrection  ').map((c) => c.text)).toEqual(['the resurrection']);
  });
  test('empty/whitespace → no clauses', () => {
    expect(splitClauses('   ')).toEqual([]);
  });
});

describe('candidateSpans', () => {
  test('produces 1..maxClauses contiguous runs with original-text offsets', () => {
    const text = 'a, b, c';
    const spans = candidateSpans(splitClauses(text), text, 2);
    // singles: a,b,c ; pairs: "a, b","b, c"
    expect(spans.map((s) => s.text).sort()).toEqual(['a', 'a, b', 'b', 'b, c', 'c'].sort());
    for (const s of spans) expect(text.slice(s.start, s.end)).toBe(s.text);
  });
});

describe('bestSpanByCosine', () => {
  test('returns the offsets of the highest-cosine span', () => {
    const spans = [{ text: 'x', start: 0, end: 1 }, { text: 'y', start: 2, end: 3 }];
    const q = [1, 0];
    const vecs = [[0, 1], [1, 0]]; // span[1] aligns with q
    expect(bestSpanByCosine(q, spans, vecs)).toEqual({ start: 2, end: 3 });
  });
  test('empty spans → null', () => {
    expect(bestSpanByCosine([1, 0], [], [])).toBeNull();
  });
});

describe('hasKeywordOverlap', () => {
  test('true when a query token (len>=3) appears literally', () => {
    expect(hasKeywordOverlap('what ye shall', 'what ye shall do')).toBe(true);
  });
  test('false for purely semantic match (no shared token)', () => {
    expect(hasKeywordOverlap('afterlife', 'a space betwixt the time of death and the resurrection')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/search/highlight.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `highlight.ts`**

Create `backend/src/search/highlight.ts`:
```ts
/** A span of text with its char offsets into the ORIGINAL string. */
export interface Span { text: string; start: number; end: number }
/** Char-offset range returned to clients. */
export interface HighlightRange { start: number; end: number }

/** Trim whitespace from [start,end); return the adjusted span or null if empty. */
function trimmedSpan(text: string, start: number, end: number): Span | null {
  while (start < end && /\s/.test(text[start]!)) start++;
  while (end > start && /\s/.test(text[end - 1]!)) end--;
  return start < end ? { text: text.slice(start, end), start, end } : null;
}

/** Split text into clauses on punctuation and coordinating conjunctions, preserving offsets. */
export function splitClauses(text: string): Span[] {
  const spans: Span[] = [];
  const re = /[,;:.!?—]+|\s(?:and|or|but)\s/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = trimmedSpan(text, last, m.index);
    if (s) spans.push(s);
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  const tail = trimmedSpan(text, last, text.length);
  if (tail) spans.push(tail);
  return spans;
}

/** Contiguous runs of 1..maxClauses clauses, sliced from the original text (offsets preserved). */
export function candidateSpans(clauses: Span[], text: string, maxClauses = 3): Span[] {
  const out: Span[] = [];
  for (let i = 0; i < clauses.length; i++) {
    for (let n = 1; n <= maxClauses && i + n <= clauses.length; n++) {
      const start = clauses[i]!.start;
      const end = clauses[i + n - 1]!.end;
      out.push({ text: text.slice(start, end), start, end });
    }
  }
  return out;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]!; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Pick the span whose vector is most cosine-similar to the query vector. */
export function bestSpanByCosine(queryVec: number[], spans: Span[], spanVecs: number[][]): HighlightRange | null {
  if (!spans.length) return null;
  let best = -Infinity, bi = 0;
  for (let i = 0; i < spans.length; i++) {
    const c = cosine(queryVec, spanVecs[i]!);
    if (c > best) { best = c; bi = i; }
  }
  return { start: spans[bi]!.start, end: spans[bi]!.end };
}

/** True if any query token (length >= 3) appears literally in the text (case-insensitive). */
export function hasKeywordOverlap(query: string, text: string): boolean {
  const toks = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const hay = text.toLowerCase();
  return toks.some((t) => t.length >= 3 && hay.includes(t));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/search/highlight.test.ts && npx tsc --noEmit` — Expected: all pass; tsc clean.

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/search/highlight.ts backend/test/search/highlight.test.ts
git commit -m "feat(search): semantic-highlight core (clause spans + cosine)"
```

---

## Task 2: Batched + lazy orchestrators (`computeHighlights`, `highlightText`)

**Files:**
- Modify: `backend/src/search/highlight.ts`
- Test: `backend/test/search/highlight.test.ts`

- [ ] **Step 1: Write the failing test (inject a fake span embedder — no infra)**

Append to `backend/test/search/highlight.test.ts`:
```ts
import { computeHighlights, highlightText } from '../../src/search/highlight.js';

describe('computeHighlights', () => {
  test('batches spans across texts and picks best per text; gates on keyword overlap & empties', async () => {
    const query = 'afterlife';
    const qVec = [1, 0];
    const texts = [
      'a space betwixt death, and the resurrection', // eligible (no overlap)
      'afterlife is mentioned here',                  // has 'afterlife' → skipped → null
      '',                                             // empty → null
    ];
    // fake embedder: vector aligned with qVec only for spans containing 'resurrection'
    const embedSpans = async (arr: string[]) => arr.map((s) => (/resurrection/.test(s) ? [1, 0] : [0, 1]));
    const out = await computeHighlights(query, qVec, texts, embedSpans);
    expect(out[1]).toBeNull();
    expect(out[2]).toBeNull();
    expect(out[0]).not.toBeNull();
    // the winning span should include 'resurrection'
    expect(texts[0]!.slice(out[0]!.start, out[0]!.end)).toMatch(/resurrection/);
  });
  test('all-ineligible → all null without calling the embedder', async () => {
    let called = false;
    const out = await computeHighlights('faith', [1, 0], ['faith is here', ''], async (a) => { called = true; return a.map(() => [0, 1]); });
    expect(out).toEqual([null, null]);
    expect(called).toBe(false);
  });
});

describe('highlightText', () => {
  test('embeds the query then delegates to computeHighlights for one text', async () => {
    const r = await highlightText(
      'afterlife',
      'the soul, and the resurrection',
      async () => [1, 0],                                  // query embedder
      async (arr) => arr.map((s) => (/resurrection/.test(s) ? [1, 0] : [0, 1])), // span embedder
    );
    expect(r).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/search/highlight.test.ts` — Expected: FAIL (`computeHighlights`/`highlightText` missing).

- [ ] **Step 3: Implement the orchestrators in `highlight.ts`**

Add to `backend/src/search/highlight.ts`:
```ts
import { embedOne, embedBatch } from './embed.js';

type SpanEmbedder = (texts: string[]) => Promise<number[][]>;

/**
 * For each input text, compute the best highlight span (or null when the text is empty
 * or shares a keyword with the query). All eligible spans across all texts are embedded
 * in ONE batch. Returns ranges parallel to `texts`.
 */
export async function computeHighlights(
  query: string,
  queryVec: number[],
  texts: (string | null)[],
  embedSpans: SpanEmbedder = embedBatch,
): Promise<(HighlightRange | null)[]> {
  const perText: (Span[] | null)[] = texts.map((text) => {
    if (!text || hasKeywordOverlap(query, text)) return null;
    const spans = candidateSpans(splitClauses(text), text);
    return spans.length ? spans : null;
  });

  const flat: string[] = [];
  for (const spans of perText) if (spans) for (const s of spans) flat.push(s.text);
  if (!flat.length) return texts.map(() => null);

  const vecs = await embedSpans(flat);
  let k = 0;
  return perText.map((spans) => {
    if (!spans) return null;
    const sliceVecs = vecs.slice(k, k + spans.length);
    k += spans.length;
    return bestSpanByCosine(queryVec, spans, sliceVecs);
  });
}

/** Lazy single-text highlight: embed the query, then compute for one text. */
export async function highlightText(
  query: string,
  text: string,
  embedQuery: (q: string) => Promise<number[]> = embedOne,
  embedSpans: SpanEmbedder = embedBatch,
): Promise<HighlightRange | null> {
  if (!text || hasKeywordOverlap(query, text)) return null;
  const qVec = await embedQuery(query);
  const [range] = await computeHighlights(query, qVec, [text], embedSpans);
  return range ?? null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/search/highlight.test.ts && npx tsc --noEmit` — Expected: all pass; tsc clean.

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/search/highlight.ts backend/test/search/highlight.test.ts
git commit -m "feat(search): batched computeHighlights + lazy highlightText"
```

---

## Task 3: Schema + resolver wiring (eager top-N + lazy query)

**Files:**
- Modify: `backend/schema/BomUtils.graphql`
- Modify: `backend/src/graphql/resolvers/searchhist.ts`

- [ ] **Step 1: Add schema**

In `backend/schema/BomUtils.graphql`: add the `highlight` field to `SearchResult` (after `lang: String`) and to `ResultCard` (after `score: Float`), and add the type + lazy query:
```graphql
type HighlightRange { start: Int, end: Int }
extend type Query { highlight(query: String!, text: String!): HighlightRange }
```
Add `highlight: HighlightRange` inside `type SearchResult { … }` and inside `type ResultCard { … }`.

- [ ] **Step 2: Wire eager highlights + lazy resolver**

In `backend/src/graphql/resolvers/searchhist.ts`:
- Add imports: `import { computeHighlights, highlightText } from '../../search/highlight.js';` and `import { embedOne } from '../../search/embed.js';`
- In `searchAllResolver`, after the `Promise.all([...])` that yields `verses` and `groups`, and before the `return`, attach eager highlights to the top-N prose results:
```ts
  // Eager semantic highlights for the top-N prose results (verses, commentary, narration).
  try {
    const commentary = (groups.commentary ?? []) as Array<{ snippet: string; highlight?: unknown }>;
    const narration = (groups.narration ?? []) as Array<{ snippet: string; highlight?: unknown }>;
    const verseRows = verses as unknown as Array<{ text: string; highlight?: unknown }>;
    const targets = [
      ...verseRows.slice(0, 10).map((v) => ({ obj: v, text: v.text })),
      ...commentary.slice(0, 3).map((c) => ({ obj: c, text: c.snippet })),
      ...narration.slice(0, 3).map((c) => ({ obj: c, text: c.snippet })),
    ];
    if (query && targets.length) {
      const qVec = await embedOne(query);
      const ranges = await computeHighlights(query, qVec, targets.map((t) => t.text));
      targets.forEach((t, i) => { (t.obj as { highlight?: unknown }).highlight = ranges[i] ?? null; });
    }
  } catch {
    // highlighting is best-effort; never break searchAll
  }
```
(Place this right before the `return { verses, people: …, … }`. The `commentary`/`narration` arrays returned by `searchAll` are the SAME objects mutated here.)

- Add the lazy resolver near the `searchAll` injection:
```ts
async function highlightResolver(_root: unknown, args: { query: string; text: string }): Promise<unknown> {
  try {
    return await highlightText(args.query ?? '', args.text ?? '');
  } catch {
    return null;
  }
}
(baseResolvers.Query as Record<string, unknown>).highlight = highlightResolver;
```

- Ensure the `highlight` field resolves on `SearchResult`. Check whether the file has an explicit `SearchResult` field-resolver block (it maps `reference`, `text`, `slug`, etc.). If it does, add `highlight: (parent: { highlight?: unknown }) => parent.highlight ?? null,` to that block. `ResultCard` uses default resolvers (the mutated `highlight` property surfaces automatically) — confirm there is no explicit `ResultCard` block that would shadow it; if there is, add the same passthrough.

- [ ] **Step 3: Type-check + run search tests**

Run: `cd /home/bom/BookofMormonOnline/backend && npx tsc --noEmit && npx vitest run test/search`
Expected: tsc clean; all search tests pass (highlight + existing). Resolve any typing on the mutated objects with the narrow casts shown above.

- [ ] **Step 4: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/schema/BomUtils.graphql backend/src/graphql/resolvers/searchhist.ts
git commit -m "feat(search): eager highlights in searchAll + lazy highlight query"
```

- [ ] **Step 5: Live smoke test (Qdrant + key are live)**

Restart greenfield and confirm the `afterlife` case returns a verse highlight range:
```bash
systemctl --user restart bom-greenfield && sleep 7
curl -s 'http://127.0.0.1:5006/en' -H 'Content-Type: application/json' \
  --data-raw '{"query":"{searchAll(query:\"afterlife\"){ verses{ reference text highlight{start end} } }}"}' \
  | python3 -c "import sys,json; v=json.load(sys.stdin)['data']['searchAll']['verses'][:3]; [print(x['reference'], x.get('highlight'), '->', (x['text'][x['highlight']['start']:x['highlight']['end']] if x.get('highlight') else None)) for x in v]"
```
Expected: at least one top verse has a non-null `highlight` whose sliced span is a death/resurrection/soul-type clause. Also test the lazy query:
```bash
curl -s 'http://127.0.0.1:5006/en' -H 'Content-Type: application/json' \
  --data-raw '{"query":"{highlight(query:\"afterlife\", text:\"Now there must needs be a space betwixt the time of death and the resurrection\"){ start end }}"}' | python3 -m json.tool
```
Expected: a non-null `{start,end}`. Report the spans observed.

---

## Task 4: Frontend GraphQL — selections + lazy query template

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js`
- Modify: `frontend/webapp/src/models/BoMOnlineAPI.js`

- [ ] **Step 1: Add `highlight { start end }` to the `searchAll` selections**

In `frontend/webapp/src/models/GraphQLQueries.js`, in the `searchAll` template's selection string, add `highlight { start end }` to the `verses { … }`, `commentary { … }`, and `narration { … }` sub-selections. Concretely the `verses` selection becomes `verses { reference text slug page section narration speaker voice highlight { start end } }`, and `commentary`/`narration` each become `{ slug title snippet ref score highlight { start end } }`.

- [ ] **Step 2: Add the lazy `highlight` query template**

Still in `GraphQLQueries.js`, add a `highlight` entry. The `highlight` query takes TWO string args — build the field with the SAME escaping the existing templates use for string args (inspect the `q` helper and the multi-arg `scripture` template; if `q` only supports one arg, build the field string directly with each arg escaped via `JSON.stringify`, which produces a GraphQL-valid string literal). The entry:
```js
  highlight: (vars) => {
    // vars: { query, text }
    return {
      type: "highlight",
      key: "query",
      val: vars,
      query: `highlight(query: ${JSON.stringify(vars.query)}, text: ${JSON.stringify(vars.text)}) { start end }`,
    }
  },
```
(Confirm `JSON.stringify` output matches how other templates escape — GraphQL string literals accept the same escapes as JSON for normal text.)

- [ ] **Step 3: Register `highlight` as a passthrough type**

In `frontend/webapp/src/models/BoMOnlineAPI.js`, add `"highlight"` to the `structureResults` passthrough array (the `["lookup","search","searchAll","mapstories","verses","verse_highlights"]` list) so `resultObj.highlight` is returned as-is.

- [ ] **Step 4: Verify compile**

Run: confirm the CRA dev server compiles — `journalctl --user -u bom-dev --since '90 sec ago' --no-pager | grep -iE 'compiled|ERROR in' | tail -3`. Expected: clean compile (these are data-layer JS edits; no test yet — covered by Task 5 usage).

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/models/GraphQLQueries.js frontend/webapp/src/models/BoMOnlineAPI.js
git commit -m "feat(search): frontend GraphQL for highlight field + lazy query"
```

---

## Task 5: Frontend rendering + lazy fetch

**Files:**
- Create: `frontend/webapp/src/views/Search/highlight.js`
- Modify: `frontend/webapp/src/views/Search/cards.js`
- Modify: `frontend/webapp/src/views/Search/Search.js`
- Modify: `frontend/webapp/src/views/Search/Search.css`
- Test: `frontend/webapp/src/views/Search/__tests__/highlight.test.js`

- [ ] **Step 1: Write the failing test for `renderHighlighted`**

Create `frontend/webapp/src/views/Search/__tests__/highlight.test.js`:
```js
import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderHighlighted } from '../highlight';

test('wraps the offset range in a semantic-hl em', () => {
  const text = 'a space betwixt death and the resurrection';
  const range = { start: 8, end: 20 }; // "betwixt deat"
  const { container } = render(<div>{renderHighlighted(text, range, 'afterlife')}</div>);
  const em = container.querySelector('em.semantic-hl');
  expect(em).not.toBeNull();
  expect(em.textContent).toBe(text.slice(8, 20));
});

test('falls back to keyword highlighting when range is null', () => {
  const { container } = render(<div>{renderHighlighted('what ye shall do', null, 'shall')}</div>);
  // keyword highlighter emphasizes the matched token (existing behavior wraps in <em>)
  expect(container.querySelector('em')).not.toBeNull();
});

test('plain text when range null and no keyword', () => {
  const { container } = render(<div>{renderHighlighted('nothing matches', null, '')}</div>);
  expect(container.textContent).toBe('nothing matches');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Search/__tests__/highlight.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `highlight.js`**

The existing keyword highlighter lives in `Search.js` as a local `highlight(needle, haystack)` using `html-react-parser`. Extract a reusable keyword highlighter is out of scope; instead `renderHighlighted` accepts an optional `keywordRender` fallback. Create `frontend/webapp/src/views/Search/highlight.js`:
```js
import React from "react";

/**
 * Render `text` with the [range.start,range.end) slice wrapped in <em class="semantic-hl">.
 * When `range` is null/absent, use `keywordRender(text)` if provided, else plain text.
 */
export function renderHighlighted(text, range, keyword, keywordRender) {
  if (range && Number.isInteger(range.start) && Number.isInteger(range.end) && range.end > range.start) {
    const before = text.slice(0, range.start);
    const span = text.slice(range.start, range.end);
    const after = text.slice(range.end);
    return <>{before}<em className="semantic-hl">{span}</em>{after}</>;
  }
  if (keywordRender && keyword) return keywordRender(text);
  return <>{text}</>;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Search/__tests__/highlight.test.js`
Expected: PASS. (The keyword-fallback test passes `keywordRender` implicitly — adjust the test to pass a simple `(t)=>(<em>{t}</em>)` keywordRender if needed so the fallback path is exercised. Make the test and impl agree: the test's 2nd case should pass a `keywordRender` that wraps in `<em>`.)

- [ ] **Step 5: Use it for verses in `Search.js`**

In `frontend/webapp/src/views/Search/Search.js`: import `renderHighlighted` (`import { renderHighlighted } from "./highlight";`). In the verse `.map(item => …)`, replace `{highlight(keyword, text)}` with:
```jsx
{renderHighlighted(text, item.highlight, keyword, (t) => highlight(keyword, t))}
```
(So an eager verse `highlight` range is emphasized; otherwise the existing keyword `highlight()` runs.) Non-top-N verses simply have `item.highlight == null` and fall back to keyword highlighting (verse lazy-fetch is OPTIONAL and omitted — verses are short and the top-10 are covered eagerly; note this in the commit).

- [ ] **Step 6: Lazy-fetch in `ContentCard` (commentary/narration)**

In `frontend/webapp/src/views/Search/cards.js`, make `ContentCard` use the highlight and lazy-fetch when absent. Replace the current `ContentCard` with a stateful version:
```js
import React, { useEffect, useRef, useState } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { renderHighlighted } from "./highlight";

export function ContentCard({ card, query }) {
  const [range, setRange] = useState(card.highlight || null);
  const ref = useRef(null);
  const fetched = useRef(!!card.highlight || !card.snippet || !query);

  useEffect(() => {
    if (fetched.current) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !fetched.current) {
        fetched.current = true;
        BoMOnlineAPI({ highlight: { query, text: card.snippet } }, { useCache: true })
          .then((r) => { if (r?.highlight) setRange(r.highlight); })
          .catch(() => {});
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [query, card.snippet]);

  return <Wrap slug={card.slug} className="result-card content" innerRef={ref}>
    {card.title && <h6>{card.title}</h6>}
    {card.snippet && <p>{renderHighlighted(card.snippet, range, query)}</p>}
  </Wrap>;
}
```
Update the `Wrap` helper in the same file to forward an optional `innerRef` to the rendered element (`<Link ref={innerRef}>` / `<div ref={innerRef}>`), and ensure `PersonChip`/`PlaceChip`/`EventCard` still work (they don't pass `innerRef`). `ResultGroup` must pass `query` down to the cards — update `ResultGroup` to accept a `query` prop and pass it to each `<Card card={c} query={query} />`, and `Search.js` to pass `query={keyword}` to each `<ResultGroup … query={keyword} />`.

- [ ] **Step 7: Add `.semantic-hl` styling**

In `frontend/webapp/src/views/Search/Search.css`, add:
```css
.semantic-hl { background: rgba(255, 214, 102, 0.5); font-style: normal; border-radius: 2px; }
```

- [ ] **Step 8: Run tests + confirm compile**

Run:
```bash
cd /home/bom/BookofMormonOnline/frontend/webapp
CI=true npx react-scripts test --watchAll=false src/views/Search/__tests__/highlight.test.js src/views/Search/__tests__/ResultGroup.test.js
```
Expected: highlight tests pass; ResultGroup tests still pass (update the ResultGroup test to pass a `query` prop if the new prop is required — it's optional, default undefined, so existing tests should still pass). Confirm clean CRA compile via journalctl.

- [ ] **Step 9: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Search/highlight.js frontend/webapp/src/views/Search/cards.js frontend/webapp/src/views/Search/ResultGroup.js frontend/webapp/src/views/Search/Search.js frontend/webapp/src/views/Search/Search.css frontend/webapp/src/views/Search/__tests__/highlight.test.js
git commit -m "feat(search): render semantic highlights + lazy fetch in content cards"
```

---

## Task 6: End-to-end verification (ops)

**Files:** none.

- [ ] **Step 1: Verify in the browser**

Greenfield was restarted in Task 3. Load `http://localhost:8200/search/afterlife` and confirm: top verses show a highlighted clause (death/resurrection/soul phrases) even though "afterlife" isn't in the text; commentary/narration cards highlight on scroll-into-view. Confirm keyword searches (e.g. `charity`) still keyword-highlight the literal term (no regression). Report what was observed.

---

## Self-Review

**Spec coverage:** clause-span algorithm + offsets → Task 1; batched eager + lazy single → Task 2; `highlight` field on SearchResult/ResultCard + `highlight(query,text)` query + eager top-N wiring → Task 3; frontend GraphQL selections + lazy template + passthrough → Task 4; `renderHighlighted` + verse usage + stateful lazy ContentCard + `.semantic-hl` → Task 5; no-keyword-overlap gate (`hasKeywordOverlap`) → Tasks 1/2/3; scope verses+commentary+narration, skip person/place/page/event → Task 3 (only those targets) + Task 5 (ContentCard only). E2E → Task 6. Covered.

**Placeholder scan:** the resolver `SearchResult.highlight` field-resolver step is conditional on inspecting the existing resolver block (a real branch with both outcomes specified), and Task 4 Step 2 directs verifying `q`/`JSON.stringify` escaping against existing templates with a concrete fallback — directed verification, not vague TODOs. No "handle edge cases"/"TBD" placeholders.

**Type consistency:** `Span`/`HighlightRange` (Task 1) used by `computeHighlights`/`highlightText` (Task 2) and the resolver/schema (Task 3); `computeHighlights(query, queryVec, texts, embedSpans?)` and `highlightText(query, text, embedQuery?, embedSpans?)` signatures consistent across Tasks 2/3; `renderHighlighted(text, range, keyword, keywordRender?)` consistent across Task 5 uses; the `highlight { start end }` GraphQL selection (Task 4) matches `HighlightRange { start end }` (Task 3); `ContentCard({card, query})` + `ResultGroup` passing `query` consistent (Tasks 5). Aligned.
