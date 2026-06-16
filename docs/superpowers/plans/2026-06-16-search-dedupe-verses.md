# Search Result De-duplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each verse appear at most once in GraphQL `search` results; when a verse maps to multiple study pages/links, keep the one with the lowest `link` (the "first" study link).

**Architecture:** The `searchQuery` loader currently emits **one result row per `bom_lookup` row**, so a verse mapped into two narrative text segments (e.g. 3 Nephi 13:25 → `jesus/88` and `jesus/89`) appears twice. We extract a small pure function that collapses lookup rows to one-per-verse (keeping the lowest `link`), unit-test it without a DB, then wire it into `searchQuery` immediately after the lookup fetch so downstream batch-fetches and the final assembly both operate on the de-duplicated set.

**Tech Stack:** TypeScript, Kysely (MySQL), Vitest. Backend lives in `backend/` (the greenfield `:5006` unit), **not** `src/`.

**Design decision — what "first" means:** `bom_lookup`/`bom_text` rows carry a `link` integer (`t.link`, surfaced as `text_link`) that is the verse's position within its study page. For 3 Nephi 13:25, `link` 88 vs 89 — 88 is the segment that also carries narration. So "first study link" = **lowest `text_link`**. This is deterministic regardless of SQL row order (the current lookup query has no `ORDER BY`). Verse-to-verse output ordering is preserved as first-appearance order, which today lands in scriptural order.

---

## Files

- **Modify:** `backend/src/data/loaders/searchhist.ts`
  - Add exported pure helper `dedupeByVerseKeepFirstLink`.
  - Call it inside `searchQuery` after the `bom_lookup` fetch; route guid-collection and final assembly through the de-duplicated rows.
- **Create:** `backend/test/searchhist-dedupe.test.ts`
  - Unit tests for `dedupeByVerseKeepFirstLink` (no DB — pure function).

---

## Task 1: Add and test the `dedupeByVerseKeepFirstLink` helper

**Files:**
- Modify: `backend/src/data/loaders/searchhist.ts` (add helper near top, after the interfaces, before `searchQuery` at line 53)
- Test: `backend/test/searchhist-dedupe.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/test/searchhist-dedupe.test.ts`:

```ts
import { describe, expect, test } from 'vitest';

// Loader imports only TYPES from codegen/db + a pure fn from scripture-guide,
// so importing it does NOT open a DB connection. Env guards mirror lang.test.ts.
process.env.MYSQL_HOST ||= 'test';
process.env.MYSQL_USER ||= 'test';
process.env.MYSQL_PASSWORD ||= 'test';

import { dedupeByVerseKeepFirstLink } from '../src/data/loaders/searchhist.js';

type Row = { verse_id: string; text_link: number | null; tag?: string };

describe('dedupeByVerseKeepFirstLink', () => {
  test('collapses repeated verse to the row with the lowest text_link', () => {
    const rows: Row[] = [
      { verse_id: '34567', text_link: 89, tag: 'jesus/89' },
      { verse_id: '34567', text_link: 88, tag: 'jesus/88' },
    ];
    const out = dedupeByVerseKeepFirstLink(rows);
    expect(out).toHaveLength(1);
    expect(out[0]!.tag).toBe('jesus/88');
  });

  test('keeps distinct verses and preserves first-appearance order', () => {
    const rows: Row[] = [
      { verse_id: '25010', text_link: 63 },
      { verse_id: '32024', text_link: 12 },
      { verse_id: '34567', text_link: 89 },
      { verse_id: '34567', text_link: 88 },
    ];
    const out = dedupeByVerseKeepFirstLink(rows);
    expect(out.map((r) => r.verse_id)).toEqual(['25010', '32024', '34567']);
    expect(out[2]!.text_link).toBe(88);
  });

  test('treats null text_link as lowest priority (loses to any real link)', () => {
    const rows: Row[] = [
      { verse_id: '1', text_link: null, tag: 'null-first' },
      { verse_id: '1', text_link: 5, tag: 'real' },
    ];
    expect(dedupeByVerseKeepFirstLink(rows)[0]!.tag).toBe('real');
  });

  test('keeps a single null-link row when it is the only one for the verse', () => {
    const rows: Row[] = [{ verse_id: '1', text_link: null, tag: 'only' }];
    const out = dedupeByVerseKeepFirstLink(rows);
    expect(out).toHaveLength(1);
    expect(out[0]!.tag).toBe('only');
  });

  test('returns empty array unchanged', () => {
    expect(dedupeByVerseKeepFirstLink([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run test/searchhist-dedupe.test.ts`
Expected: FAIL — `dedupeByVerseKeepFirstLink` is not exported (import resolves to `undefined`, so calling it throws `TypeError: ... is not a function`).

- [ ] **Step 3: Implement the helper**

In `backend/src/data/loaders/searchhist.ts`, insert this **after the `HistoryRow` interface (line 42) and before the `searchQuery` doc comment (line 44)**:

```ts
/**
 * Collapse lookup rows so each verse appears once.
 *
 * A single verse can be mapped into multiple study segments (multiple bom_lookup
 * rows → multiple text_link values). We keep the row with the LOWEST text_link
 * (the "first" study link). A null text_link sorts last, so a real link always
 * wins over a null one; a lone null-link row is still kept.
 *
 * First-appearance order of verses is preserved (today this is scriptural order).
 */
export function dedupeByVerseKeepFirstLink<
  T extends { verse_id: string; text_link: number | null },
>(rows: T[]): T[] {
  const byVerse = new Map<string, T>();
  const order: string[] = [];
  for (const row of rows) {
    const existing = byVerse.get(row.verse_id);
    if (!existing) {
      byVerse.set(row.verse_id, row);
      order.push(row.verse_id);
      continue;
    }
    const existingLink = existing.text_link ?? Number.POSITIVE_INFINITY;
    const candidateLink = row.text_link ?? Number.POSITIVE_INFINITY;
    if (candidateLink < existingLink) byVerse.set(row.verse_id, row);
  }
  return order.map((verseId) => byVerse.get(verseId)!);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run test/searchhist-dedupe.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/data/loaders/searchhist.ts backend/test/searchhist-dedupe.test.ts
git commit -m "feat(search): add dedupeByVerseKeepFirstLink helper + tests"
```

---

## Task 2: Wire the helper into `searchQuery`

**Files:**
- Modify: `backend/src/data/loaders/searchhist.ts:102-107` and `:237`

- [ ] **Step 1: Insert the de-dup call after the lookup fetch**

In `searchQuery`, the lookup fetch ends at line 102 with `if (!lookupRows.length) return [];`. Immediately **after** that line, add:

```ts
  // One result per verse: keep the lowest-link study segment (see helper doc).
  const dedupedRows = dedupeByVerseKeepFirstLink(lookupRows);
```

- [ ] **Step 2: Route guid collection through `dedupedRows`**

Replace the three guid-collection lines (currently 105-107, now shifted down by 2):

```ts
  const pageGuids = [...new Set(lookupRows.map((r) => r.text_page).filter((g): g is string => !!g))];
  const sectionGuids = [...new Set(lookupRows.map((r) => r.text_section).filter((g): g is string => !!g))];
  const narrationGuids = [...new Set(lookupRows.map((r) => r.text_parent).filter((g): g is string => !!g))];
```

with:

```ts
  const pageGuids = [...new Set(dedupedRows.map((r) => r.text_page).filter((g): g is string => !!g))];
  const sectionGuids = [...new Set(dedupedRows.map((r) => r.text_section).filter((g): g is string => !!g))];
  const narrationGuids = [...new Set(dedupedRows.map((r) => r.text_parent).filter((g): g is string => !!g))];
```

(Note: `verseIds` — the batch-fetch keys for verse text, speakers, etc. — is built earlier from the LIKE query and is already unique per verse, so it does not change.)

- [ ] **Step 3: Route final assembly through `dedupedRows`**

Replace line 237:

```ts
  return lookupRows.map((row) => {
```

with:

```ts
  return dedupedRows.map((row) => {
```

- [ ] **Step 4: Confirm no remaining post-fetch use of `lookupRows`**

Run: `cd backend && grep -n "lookupRows" src/data/loaders/searchhist.ts`
Expected: only the original fetch (`const lookupRows = await db`), the empty-check (`if (!lookupRows.length)`), and the de-dup call (`dedupeByVerseKeepFirstLink(lookupRows)`) reference `lookupRows`. The guid lines and the final `.map` now reference `dedupedRows`.

- [ ] **Step 5: Type-check and run the unit tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run test/searchhist-dedupe.test.ts`
Expected: tsc reports no errors; the 5 dedup tests still PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add backend/src/data/loaders/searchhist.ts
git commit -m "fix(search): collapse multi-link verses to one result (lowest link)"
```

---

## Task 3: Verify against the running dev backend

**Files:** none (manual verification against `:8200` → `:5006`).

- [ ] **Step 1: Restart the dev backend so the change is live**

Restarting `bom-dev` bounces the public dev URL — this is pre-authorized (see memory `bom-dev restart authorized`), but note it in your report.

Run: `systemctl --user restart bom-dev && sleep 5 && systemctl --user is-active bom-dev`
Expected: `active`

- [ ] **Step 2: Re-run the original audit query**

Run:

```bash
curl -s 'http://10.0.0.10:8200/en' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://10.0.0.10:8200' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36' \
  --data-raw '{"query":"{search (query: \"what ye shall\"){ reference text slug page section narration speaker voice }}"}' \
  --insecure | python3 -m json.tool
```

Expected: **3 results, not 4.** 3 Nephi 13:25 appears exactly once, with `slug` ending in `jesus/88` (the lower link) and its `narration` populated. Alma 25:10 and Alma 32:24 are unchanged.

- [ ] **Step 3: Spot-check a second query for regressions**

Run the same curl with `"query":"\"and it came to pass\""` replaced appropriately, or any common phrase, and confirm:
- No verse `reference` appears twice in the result array.
- Results still carry `text`, `page`, `section`, `speaker`, `voice` as before.

Run:

```bash
curl -s 'http://10.0.0.10:8200/en' \
  -H 'Content-Type: application/json' -H 'Origin: http://10.0.0.10:8200' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36' \
  --data-raw '{"query":"{search (query: \"prepare ye the way\"){ reference slug }}"}' \
  --insecure | python3 -c "import sys,json; d=json.load(sys.stdin)['data']['search']; refs=[r['reference'] for r in d]; print('total', len(refs), 'distinct', len(set(refs))); assert len(refs)==len(set(refs)), 'DUPLICATE REFERENCE STILL PRESENT'"
```

Expected: prints `total N distinct N` (equal counts) and exits 0 — no assertion error.

- [ ] **Step 4: Final report**

Report: result count before/after for the original query (4 → 3), confirmation that the surviving 3 Nephi 13:25 row keeps narration + `jesus/88`, and that you restarted `bom-dev`. No commit in this task (verification only).

---

## Self-Review Notes

- **Spec coverage:** "1 verse should only appear once" → Task 1 helper + Task 2 wiring; "if multiple study links, use the first one" → lowest-`text_link` rule in the helper, verified in Task 3 Step 2 (expects `jesus/88`). Covered.
- **Type consistency:** Helper is generic over `{ verse_id: string; text_link: number | null }`; the real `lookupRows` rows expose exactly `verse_id` (string) and `text_link` (`t.link`), so they satisfy the constraint. Name `dedupeByVerseKeepFirstLink` is used identically in the helper, the test import, and the two `searchQuery` call sites.
- **No placeholders:** every code/command step shows concrete content.
