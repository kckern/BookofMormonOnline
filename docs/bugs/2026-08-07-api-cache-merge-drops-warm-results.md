# API cache layer: warm results dropped, versehighlights mis-keyed

**Date:** 2026-08-07
**Files:** `frontend/webapp/src/models/BoMOnlineAPI.js`, `frontend/webapp/src/models/Cache.js`, `frontend/webapp/src/models/GraphQLQueries.js`
**Surfaced by:** the Bible cross-reference reader (`/analysis/bible/bom/<bom>~<bible>`), but both are **app-wide latent bugs** in the shared GraphQL cache layer.

## Symptom
On the side-by-side reader (e.g. `…/bom/mosiah~exodus?from=kjv&bch=20`), the pair **Mosiah 13:13 ↔ Exodus 20:5** showed a QUOTE badge but **empty verse text**. Separately, phrase highlights frequently failed to appear or landed on the wrong verse.

## Root cause 1 — cache-merge drops warm-cached array results (the empty cells)
`BoMOnlineAPI` fetches only cache-*missing* items, then merges them with the warm-cached ones. `verses` is served as a raw **array** (`structureResults` special-cases it), while `getCache` returns already-cached verses as an **id-keyed object**. On a **partial-warm** batch (some ids in IndexedDB, some not) the merge did:

```js
if (Array.isArray(fresh)) { results[key] = fresh; }   // ← drops every cached item
```

So any verse served from cache never reached `verseData` in the reader, and `highlightTextJSX(undefined, …)` rendered an empty cell. Trigger: revisiting the page (or having browsed the Bible before) after IndexedDB warmed a subset of the requested verses. Confirmed against the live backend — it *does* serve KJV text for Exodus 20:5; the text was lost client-side in the merge.

**Fix:** extracted the merge into a pure, exported `mergeResults(structuredResults, found)` and **unioned** warm + fresh for array-typed collections (`fresh.concat(Object.values(cached))`). The two sets are disjoint (cached items are never re-requested), and consumers read via `Object.values`, which works on the concatenated array.

## Root cause 2 — versehighlights keyed by input POSITION (the missing/wrong highlights)
The `versehighlights` query sends N verse pairs; the server returns **one row per pair that HAS a highlight**, dropping (and possibly reordering) the rest. Both `structureResults` and `prepareCacheObject` keyed each returned row by its **positional input index** (`query.val[j]`). The moment the server omits any non-tail pair, every later highlight is mis-keyed onto the wrong pair (or lost) — so `highlights["<bom>,<bible>"]` in the reader misses. Verified: requesting 3 pairs where the first has no highlight returned 2 rows, mis-aligning both.

**Fix:** added a row-derived `keyFn: (row) => ` `${row.bom_verse_id},${row.bible_verse_id}` ` ` to the `versehighlights` query descriptor; `structureResults` and `prepareCacheObject` use it so rows key by their **own** ids, surviving dropped/reordered rows. (This compounds with the token-matcher hardening in `highlighter.jsx` from the 2026-08-07 analysis work — that fixed *matching* drift; this fixes *association*.)

## Tests
`frontend/webapp/src/models/__tests__/apiCacheMerge.test.js` — unit tests for the union merge and the row-keyed versehighlights (both fail pre-fix). End-to-end: a Playwright repro pre-seeds a cached Exodus 20:5 into IndexedDB, loads the reader, and confirms the cached verse renders (no empty cells).

## Related
- `docs/bugs/2026-08-07-bible-analysis-quote-flag-integrity.md` (separate: quote-flag *data* issue).
- `docs/audits/2026-08-07-bible-analysis-ux-rebuke.md`.
