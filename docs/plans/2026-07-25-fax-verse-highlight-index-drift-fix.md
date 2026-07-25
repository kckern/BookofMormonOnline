# Fax Verse-Highlight Index-Drift Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the fax verse-highlight overlay render on all editions by keying the faxIndex page array to the image-file page number instead of array position.

**Architecture:** The faxIndex loader emits one row per page *that has indexed verses* (sparse). The desktop viewer consumes that array **positionally** (`pageIndex[pageNum-1]`), so any pageless interior scan (plate/blank/illustration) shifts every later page's verse range — the boxes come back keyed to the drifted page while the render join looks them up by the true page, yielding zero hotspots on 11 editions. The fix moves the "dense-by-image-page" responsibility to a single pure backend transform (`buildDensePages`) that pads gaps with `[0,0]`, and deletes the frontend's leading-placeholder hack that only ever compensated for *leading* gaps. For the 11 impacted editions this corrects the drift; for the already-working front-matter editions it produces identical output (leading gaps become explicit `[0,0]` prefix instead of prepended placeholders).

**Tech Stack:** Backend TypeScript (Apollo GraphQL resolver, Kysely loader), vitest. Frontend React 17 (CRA), Jest via react-scripts. `scripture-guide` for reference generation.

**Root-cause reference:** `docs/bugs/2026-07-25-fax-verse-highlights-index-drift.md`

**Impacted editions (11):** 1842, 1852, 1854, 1854l, 1866, 1871, 1874, 1877, 1849, rebom, poetic. Not impacted (verify no regression): 1837, 1829, 1830, 1840, 1841, 1879, 1879l, 1881, 1882, 1883d, 1885.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `backend/src/graphql/resolvers/mediamisc.ts` | faxIndex resolver | Add exported pure `buildDensePages(items)`; wire resolver to it |
| `backend/test/graphql/faxIndex.test.ts` | Unit test for the transform | Create |
| `frontend/webapp/src/views/Facsimiles/faxGeometry.js` | Pure geometry/index helpers | Receive `getRefFromIndex` (moved from Facsimiles.js) |
| `frontend/webapp/src/views/Facsimiles/Facsimiles.js` | Viewer container + faxIndex fetch | Import `getRefFromIndex` from faxGeometry; drop placeholder prepend + dead imports |
| `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js` | Desktop spread | Remove dead `getRefFromIndex` import |
| `frontend/webapp/src/views/Facsimiles/__tests__/faxGeometry.test.js` | Geometry unit tests | Add `getRefFromIndex` regression tests |

**Coupling note:** Task 3 flips the backend (sparse→dense) and the frontend (drop placeholder prepend) **in a single commit**. Shipping one without the other double-shifts (backend dense + frontend still prepends) or leaves the bug (frontend dropped prepend + backend still sparse). Tasks 1 and 2 are behavior-neutral and safe to commit independently.

---

## Task 1: Backend pure transform `buildDensePages`

**Files:**
- Modify: `backend/src/graphql/resolvers/mediamisc.ts` (add exported helper near the resolver; the `FaxIndexPageRow` type is already imported there and used at line ~55)
- Test: `backend/test/graphql/faxIndex.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `backend/test/graphql/faxIndex.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildDensePages } from '../../src/graphql/resolvers/mediamisc.js';

// first_verse_id / last_verse_id are strings in FaxIndexPageRow (SQL MIN/MAX).
const row = (page: number, first: number, last: number, count: number) => ({
  version: 'x',
  page,
  first_verse_id: String(first),
  last_verse_id: String(last),
  verse_count: count,
});

describe('buildDensePages', () => {
  it('places each page at index page-1 and fills interior gaps with [0,0]', () => {
    // pages 1, 2, 4 have verses; page 3 is a pageless scan (no row emitted)
    const items = [row(1, 10, 12, 3), row(2, 13, 15, 3), row(4, 20, 24, 5)];
    const dense = buildDensePages(items as any);
    expect(dense).toHaveLength(4);        // padded to the max page number (4)
    expect(dense[0]).toEqual([10, 3, 1]); // page 1: fresh-content flag
    expect(dense[1]).toEqual([13, 3, 1]); // page 2: 13 !== prev.last(12) -> flag
    expect(dense[2]).toEqual([0, 0]);     // page 3: interior gap
    expect(dense[3]).toEqual([20, 5, 1]); // page 4 lands at index 3, NOT index 2
  });

  it('omits the fresh-content flag when the first verse continues from the previous page', () => {
    // page 2's first verse equals page 1's last verse (verse straddles the break)
    const items = [row(1, 10, 12, 3), row(2, 12, 14, 3)];
    const dense = buildDensePages(items as any);
    expect(dense[1]).toEqual([12, 3]);    // no trailing 1
  });

  it('returns an empty array when there are no indexed rows', () => {
    expect(buildDensePages([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run test/graphql/faxIndex.test.ts`
Expected: FAIL — `buildDensePages` is not exported (`does not provide an export named 'buildDensePages'`).

- [ ] **Step 3: Write minimal implementation**

In `backend/src/graphql/resolvers/mediamisc.ts`, add this exported function **above** `export const mediamiscResolvers` (around line 26). It relies on the loader's `orderBy('page','asc')` — `items` is sorted ascending, so `items[i-1]` is the previous indexed page and the last item carries the max page:

```ts
/**
 * Turn the SPARSE faxIndex rows (one per page that has indexed verses, ordered
 * by page asc) into a DENSE array keyed by image-file page number: element i is
 * image page i+1. Pages with no indexed verses (plates/blanks/illustrations)
 * become [0, 0] gap tuples so positional consumers never drift.
 *
 * Before this, groupBy(page) collapsed gaps and the viewer indexed the array
 * positionally, so any interior pageless scan shifted every later page's verse
 * range — zeroing the highlight overlay on 11 editions. See
 * docs/bugs/2026-07-25-fax-verse-highlights-index-drift.md.
 *
 * Each indexed tuple is [first_verse_id, verse_count, ?1]; the optional 1 marks
 * that the page's first whole verse is fresh content (not continued from the
 * previous indexed page).
 */
export function buildDensePages(items: FaxIndexPageRow[]): number[][] {
  const maxPage = items.length ? Number(items[items.length - 1]!.page) : 0;
  const pages: number[][] = Array.from({ length: maxPage }, () => [0, 0]);
  items.forEach((x, i) => {
    const prev = items[i - 1];
    const firstWholeVerseIsFirstContent = !prev || prev.last_verse_id !== x.first_verse_id;
    const vals: number[] = [Number(x.first_verse_id), Number(x.verse_count)];
    if (firstWholeVerseIsFirstContent) vals.push(1);
    pages[Number(x.page) - 1] = vals;
  });
  return pages;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run test/graphql/faxIndex.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/src/graphql/resolvers/mediamisc.ts backend/test/graphql/faxIndex.test.ts
git commit -m "feat(fax): add buildDensePages — page-keyed faxIndex transform

Pure helper that pads the sparse faxIndex row list into a dense array
keyed by image-file page number. Not yet wired into the resolver.
Refs docs/bugs/2026-07-25-fax-verse-highlights-index-drift.md

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Move `getRefFromIndex` into faxGeometry.js (behavior-neutral)

**Why:** `getRefFromIndex` lives in `Facsimiles.js`, whose import graph (scss, svg, `BoMOnlineAPI`) is hostile to a focused unit test. `faxGeometry.js` is the existing home for pure index/geometry helpers and imports cleanly. Moving it enables the regression test and removes two dead imports. Logic is unchanged.

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/faxGeometry.js` (add `getRefFromIndex` + imports)
- Modify: `frontend/webapp/src/views/Facsimiles/Facsimiles.js:12-31` (remove definition, fix imports)
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js:7` (remove dead import)
- Test: `frontend/webapp/src/views/Facsimiles/__tests__/faxGeometry.test.js` (add cases)

- [ ] **Step 1: Write the failing test**

Append to `frontend/webapp/src/views/Facsimiles/__tests__/faxGeometry.test.js`. Update the top-of-file import to include `getRefFromIndex`:

```js
import { resolvePgOffset, buildLeafIndex, normalizeStackWidths, getRefFromIndex } from "../faxGeometry";
import { generateReference } from "scripture-guide";
```

Add this describe block at the end of the file:

```js
describe("getRefFromIndex (dense, image-page-keyed array)", () => {
  // Dense array: index i == image page i+1. Page 3 is an interior gap.
  //   page 1 -> verse 1, page 2 -> verse 2, page 3 -> gap, page 4 -> verse 5
  const dense = [[1, 1, 1], [2, 1], [0, 0], [5, 1, 1]];

  test("page 1 resolves index 0 (no leading-placeholder drift)", () => {
    expect(getRefFromIndex(dense, 1)).toBe(generateReference([1])); // "Genesis 1:1"
  });

  test("an interior gap page resolves to null", () => {
    expect(getRefFromIndex(dense, 3)).toBeNull();
  });

  test("a page AFTER an interior gap is not drifted", () => {
    // The bug: page 4 used to read the tuple at index 2 (the gap's neighbor).
    // It must read index 3 -> verse 5.
    expect(getRefFromIndex(dense, 4)).toBe(generateReference([5])); // "Genesis 1:5"
    expect(getRefFromIndex(dense, 4)).not.toBe(getRefFromIndex(dense, 1));
  });

  test("out-of-range page returns null", () => {
    expect(getRefFromIndex(dense, 99)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxGeometry.test.js`
Expected: FAIL — `getRefFromIndex is not a function` / not exported from `../faxGeometry`.

- [ ] **Step 3a: Add `getRefFromIndex` to faxGeometry.js**

In `frontend/webapp/src/views/Facsimiles/faxGeometry.js`, change the top import line:

```js
import { convertIntToRomanNumeral } from "../../models/Utils";
```
to:
```js
import { convertIntToRomanNumeral, determineLanguage } from "../../models/Utils";
import { generateReference } from "scripture-guide";
```

Then add the moved function (verbatim logic from Facsimiles.js), e.g. directly under the imports:

```js
/**
 * Resolve the scripture reference for an image-file page from the DENSE,
 * page-keyed pageIndex (element i == image page i+1; [0,0] for pageless scans).
 * Returns null for gap pages / out-of-range / editions whose index hasn't loaded.
 */
export const getRefFromIndex = (pageIndex, pageNum) => {
  const itemIndex = parseInt(pageNum) - 1;
  const [startingVerseId, verseCount] = pageIndex?.[itemIndex] || [0, 0];
  const verseRangeArray = Array.from({ length: verseCount }, (_, i) => startingVerseId + i);
  const lang = determineLanguage();
  const ref = generateReference(verseRangeArray, lang);
  const showRef = pageIndex.length > 0 && startingVerseId > 0;
  return showRef ? ref : null;
};
```

- [ ] **Step 3b: Remove the definition + dead imports from Facsimiles.js**

In `frontend/webapp/src/views/Facsimiles/Facsimiles.js`, replace imports lines 12-21:

```js
import { useParams, useHistory } from "react-router-dom";
import { label, determineLanguage } from "src/models/Utils";
import { generateReference, lookupReference } from "scripture-guide";
import { isMobile, useSwipe } from "../../models/Utils";
import FacsimilePageViewer from './FacsimilePageViewer';
import FacsimilePageViewerMobile from './FacsimilePageViewerMobile';
import FaxBreadcrumbs from './FaxBreadcrumbs';
import PageImage from './PageImage';
import backIcon from '../_Common/svg/back.svg';
import { resolvePgOffset, buildLeafIndex } from "./faxGeometry";
```

with (drops now-unused `determineLanguage`, `generateReference`, and already-dead `lookupReference`; adds `getRefFromIndex`):

```js
import { useParams, useHistory } from "react-router-dom";
import { label } from "src/models/Utils";
import { isMobile, useSwipe } from "../../models/Utils";
import FacsimilePageViewer from './FacsimilePageViewer';
import FacsimilePageViewerMobile from './FacsimilePageViewerMobile';
import FaxBreadcrumbs from './FaxBreadcrumbs';
import PageImage from './PageImage';
import backIcon from '../_Common/svg/back.svg';
import { resolvePgOffset, buildLeafIndex, getRefFromIndex } from "./faxGeometry";
```

Then delete the `getRefFromIndex` definition (the `export const getRefFromIndex = ...` block, lines 23-31):

```js
export const getRefFromIndex = (pageIndex, pageNum) => {
  const itemIndex = parseInt(pageNum) - 1;
  const [startingVerseId, verseCount] = pageIndex?.[itemIndex] || [0, 0];
  const verseRangeArray = Array.from({ length: verseCount }, (_, i) => startingVerseId + i);
  const lang = determineLanguage();
  const ref = generateReference(verseRangeArray, lang);
  const showRef = pageIndex.length > 0 && startingVerseId > 0;
  return showRef ? ref : null;
};
```

(`getRefFromIndex` is still referenced at the `buildLeafIndex(...)` call — now supplied by the faxGeometry import.)

- [ ] **Step 3c: Remove the dead `getRefFromIndex` import in FacsimilePageViewer.js**

In `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js`, change line 7:

```js
import { getRefFromIndex, PageOverlay } from "./Facsimiles";
```
to:
```js
import { PageOverlay } from "./Facsimiles";
```

(`getRefFromIndex` was imported but never used in this file.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxGeometry.test.js`
Expected: PASS (existing `resolvePgOffset`/`buildLeafIndex`/`normalizeStackWidths` suites + new `getRefFromIndex` suite all green).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/faxGeometry.js \
        frontend/webapp/src/views/Facsimiles/Facsimiles.js \
        frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js \
        frontend/webapp/src/views/Facsimiles/__tests__/faxGeometry.test.js
git commit -m "refactor(fax): move getRefFromIndex into faxGeometry, drop dead imports

Behavior-neutral relocation to enable a focused unit test and remove
two unused imports (lookupReference in Facsimiles, getRefFromIndex in
FacsimilePageViewer).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Switch backend to dense + drop frontend placeholder prepend (atomic)

**This is the behavior flip. Both edits ship in one commit** (see Coupling note).

**Files:**
- Modify: `backend/src/graphql/resolvers/mediamisc.ts:60-74` (use `buildDensePages`)
- Modify: `frontend/webapp/src/views/Facsimiles/Facsimiles.js:46-69` (drop placeholder prepend)

- [ ] **Step 1: Wire the resolver to `buildDensePages`**

In `backend/src/graphql/resolvers/mediamisc.ts`, replace the return block (currently lines ~60-74):

```ts
      return {
        slug,
        offset,
        pages: items.map((x, i) => {
          const prev = items[i - 1];
          const firstWholeVerseIsFirstContent =
            !prev || prev.last_verse_id !== x.first_verse_id;
          const vals: number[] = [
            Number(x.first_verse_id),
            Number(x.verse_count),
          ];
          if (firstWholeVerseIsFirstContent) vals.push(1);
          return vals;
        }),
      };
```

with:

```ts
      return {
        slug,
        offset,
        // Dense, image-page-keyed array (index i == image page i+1); interior
        // pageless scans are [0,0] gaps so the viewer never drifts. See
        // docs/bugs/2026-07-25-fax-verse-highlights-index-drift.md.
        pages: buildDensePages(items),
      };
```

- [ ] **Step 2: Drop the placeholder prepend in Facsimiles.js**

In `frontend/webapp/src/views/Facsimiles/Facsimiles.js`, replace the whole `useEffect` that fetches faxIndex (currently lines ~46-69):

```js
  useEffect(() => {
    if (!item.indexRef) return;
    const { indexRef, pgfirstVerse } = item || {};
    // Placeholders skip the leading CONTENT pages (image files 1..pgfirstVerse-1)
    // that precede the first indexed page, so getRefFromIndex — which is keyed by
    // image-file number — lands pages[0] on image file `pgfirstVerse`. pgoffset
    // (front-matter leaves) must NOT be added here: front-matter leaves have i<=0
    // and never index into real tuples. Adding pgoffset shifted every reference
    // by pgoffset on front-matter editions. See docs/audits/2026-07-24-fax-page-numbering-ssot.md.
    const blankPageCount = pgfirstVerse - 1;
    let cancelled = false;
    BoMOnlineAPI({ faxIndex: indexRef })
      .then((r) => {
        if (cancelled) return;
        const entry = r?.fax?.[indexRef];
        const pages = entry?.pages;
        if (!Array.isArray(pages)) return;
        setFaxOffset(Number.isFinite(entry?.offset) ? entry.offset : 0);
        const placeholderArray = Array.from({ length: blankPageCount }, () => [0, 0]);
        setPageIndex([...placeholderArray, ...pages]);
      })
      .catch(() => { /* leave pageIndex empty; refs simply won't show */ });
    return () => { cancelled = true; };
  }, [item.slug, item.indexRef, pgoffset]);
```

with:

```js
  useEffect(() => {
    if (!item.indexRef) return;
    const { indexRef } = item || {};
    // `pages` arrives DENSE and keyed by image-file page number: element i is
    // image page i+1, and pageless scans are [0,0] gaps (the backend builds it
    // via buildDensePages). So getRefFromIndex(pageIndex, pageNum) lands on the
    // right page with no placeholder math — the old positional padding only
    // compensated for LEADING gaps, so any interior pageless scan drifted every
    // later page. See docs/bugs/2026-07-25-fax-verse-highlights-index-drift.md.
    let cancelled = false;
    BoMOnlineAPI({ faxIndex: indexRef })
      .then((r) => {
        if (cancelled) return;
        const entry = r?.fax?.[indexRef];
        const pages = entry?.pages;
        if (!Array.isArray(pages)) return;
        setFaxOffset(Number.isFinite(entry?.offset) ? entry.offset : 0);
        setPageIndex(pages);
      })
      .catch(() => { /* leave pageIndex empty; refs simply won't show */ });
    return () => { cancelled = true; };
  }, [item.slug, item.indexRef, pgoffset]);
```

(`pgfirstVerse` is no longer read here; leaving the field in the GraphQL query is harmless. `pgoffset` stays in the dep array — it is still used by the `buildLeafIndex` memo below.)

- [ ] **Step 3: Run both unit suites to verify nothing regressed**

Run: `cd backend && npx vitest run test/graphql/faxIndex.test.ts`
Expected: PASS (3 passed).

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxGeometry.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/graphql/resolvers/mediamisc.ts frontend/webapp/src/views/Facsimiles/Facsimiles.js
git commit -m "fix(fax): render verse highlights by keying faxIndex to image page

Emit the faxIndex pages array dense (keyed by image-file page number,
[0,0] for pageless scans) and drop the frontend leading-placeholder
hack that only compensated for leading gaps. Interior pageless scans no
longer drift every later page's verse range, so the highlight overlay
renders on 1842/1849/1852/1854/1854l/1866/1871/1874/1877/rebom/poetic.

Fixes docs/bugs/2026-07-25-fax-verse-highlights-index-drift.md

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Integration verification (dev host, localhost — no CDN)

Per CLAUDE.md, verify against `http://localhost:8200` directly (Cloudflare caches `bom.kckern.net`). Boxes + GraphQL are served by the green-field backend (`:5006`); restarting it is pre-authorized (see memory "bom-dev restart authorized").

- [ ] **Step 1: Restart the backend so the resolver change loads**

Run: `systemctl --user list-units --type=service | grep -iE 'bom|greenfield'`
Then restart the unit that serves GraphQL/boxes on :5006 (e.g. `systemctl --user restart bom-greenfield` — use the exact name from the list; if it runs `tsx watch`, a save already reloaded it and this is a no-op safety step).
Confirm health: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5006/graphql` → expect `200` or `400` (server up), not a connection refusal.

- [ ] **Step 2: Prove the wire format is now dense (deterministic, no browser)**

Run (adjust port/endpoint if Step 1 showed a different one):

```bash
curl -s http://localhost:5006/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ faxIndex(slug:\"1871\"){ pages } }"}' \
  | node -e 'const d=JSON.parse(require("fs").readFileSync(0));const p=d.data.faxIndex.pages;console.log("len",p.length,"page24=idx23:",p[23]);'
```

Expected: `len 453 page24=idx23: [ 31349, 35, 1 ]` — image page 24 (index 23) now carries its **own** first verse `31349` (1 Nephi 11:18), not page 46's `31625` (1 Nephi 19:8). A `len` near 289 or an index-23 value of `31625` means the resolver is still serving the old sparse array (restart didn't take).

- [ ] **Step 3: Confirm hotspots render in the browser (impacted edition)**

Load `http://localhost:8200/fax/1871/24`. Verify:
- `.faxHotspot` elements are present (were 0 before). Quick check via devtools console: `document.querySelectorAll('.faxHotspot').length` → expect > 0.
- Hovering/clicking a verse opens the verse modal and the cutout ring draws.
- The spread's verse content corresponds to **1 Nephi 11** (page 24's true content), not 1 Nephi 19.

(If Playwright is available, mirror the audit harness in `/tmp/pw-fax*.mjs`: navigate, `page.locator('.faxHotspot').count()` > 0.)

- [ ] **Step 4: Regression-check a front-matter edition (not impacted)**

Load `http://localhost:8200/fax/1837/50` (1837 has leading front matter, `internal_gaps = 0`). Verify the page still renders the correct reference and hotspots — this guards against the dropped-placeholder change shifting the already-correct editions. Expect parity with pre-change behavior (same page reference in the header, hotspots present).

- [ ] **Step 5: Record the result**

If all four checks pass, update `docs/bugs/2026-07-25-fax-verse-highlights-index-drift.md` Status line to `Fixed 2026-07-25 (commit <hash>)` and note the verification. If any check fails, STOP and return to systematic-debugging Phase 1 — do not layer another fix.

---

## Self-Review

**Spec coverage:**
- Root cause (sparse array consumed positionally) → Task 1 + Task 3 (dense transform + drop prepend). ✅
- "Key by image-file page number" (bug-doc fix option 1) → `buildDensePages` indexes by `page-1`. ✅
- `versesByPage.get(pageNumInt)` lines up automatically → follows from correct `getRefFromIndex` → correct fetched ids → boxes keyed to true page. Verified in Task 4 Step 3. ✅
- All 11 impacted editions → generic transform, not per-edition; 1871 verified, 1837 regression-guarded. ✅
- Front-matter editions unaffected (bug doc: "validate against 1837/2013") → Task 4 Step 4. ✅

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". Every code step shows full code. ✅

**Type/name consistency:** `buildDensePages` (defined Task 1, used Task 3), `getRefFromIndex` (moved Task 2, unchanged signature), `pages`/`pageIndex` naming consistent across resolver ↔ Facsimiles.js. Tuple shape `[first_verse_id, verse_count, ?1]` preserved. ✅

**Known non-goals (out of scope, tracked in bug doc "Secondary findings"):** mobile deep-link-only overlay, mobile verse deep-link dropping the ref, desktop verse deep-link hang. This plan fixes the page-URL highlight rendering only.
