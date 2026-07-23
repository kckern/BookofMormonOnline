# Facsimiles Viewer — Bug & Polish Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the verified correctness bugs, perceptual jank, accessibility gaps, and duplicated styling in the Facsimiles document viewer — without starting the profile-gated feature work (zoom, gestures, virtualization, filmstrip).

**Architecture:** Extract the viewer's pure geometry/logic into a testable module (`faxGeometry.js`), replace the hand-rolled stale-closure resize effect with a small reusable hook (`useElementSize.js`), centralize thumbnail prefetching (`faxThumbCache.js`), then apply the CSS/wiring fixes against those seams. Test the pure logic with Jest; verify CSS/wiring by lint + build + manual capture on `http://localhost:8200`.

**Tech Stack:** React 17 (function components + hooks), react-router-dom v5, CRA (`react-scripts test` = Jest + jsdom), `@testing-library/react` v11, Sass, `scripture-guide`.

**Source of truth:** `docs/audits/2026-07-23-facsimiles-viewer-ux-audit.md` (esp. §0 reconciliation and the 20/80 ship list). Section tags below (e.g. §2.14) reference that audit.

> **Corrections applied during execution (2026-07-23):**
> - **Task A2:** the test assertions in this doc were buggy (asserted `leaves[2].pageNumInt === 1` and a truthy `leaves[0].pageNumRoman`). The *authoritative* behavior is the original inline builder's `i = idx - pgoffset` (last page == `pages`, and `convertIntToRomanNumeral(0)` is `""`). The shipped `buildLeafIndex` + tests use the faithful semantics (first numbered page at `leaves[3]`, `leaves[5].pageNumInt === 3`). Do not "fix" the code back to match this doc's original A2 test.
> - **Task E1:** narrowed to removing only the confirmed-dead global `.page`/`.page img` (`object-fit:fill`) rule. Bulk-deleting the other duplicated selectors is regression-prone (some globals carry unique props the scoped rules lack) and needs screenshot diffing — deferred to a follow-up task.
> - **Build verification:** this app uses `react-app-rewired` (there is a `config-overrides.js`). Plain `react-scripts build` cannot resolve `src/...` absolute imports and fails on unrelated files — per-task gates used **eslint + jest**; the final compile check used the live `bom-dev` (`react-app-rewired`) server.

---

## Scope

**In scope (this plan):**
- §2.14 unmemoized `leafIndex` rebuild — Phase A
- §2.16 `pgOffset`/`pgoffset` ambiguity — Phase A
- §2.15 fetch-in-render + missing error/empty states — Phase A
- §2.13 stale-closure resize effect — Phase A
- §2.2 `history.push`→`replace`, shimmer flash, width transition — Phase B
- §2.5 grid eager-load / `willChange` (lazy-load only, not virtualization) — Phase B
- §2.3 doubled slider state + missing mobile tooltip — Phase C
- §2.11 hover-thumbnail lag (prefetch + keyed + throttle) — Phase C
- §2.10 stack imbalance (fixed footprint + gradient + single source) — Phase D
- §2.9 duplicated/conflicting SCSS — Phase E
- §2.6 / §2.8 slim toolbar, heading size, magic margin, Escape, page indicator — Phase F
- §2.17 accessibility — Phase F
- §2.4 / §2.19 highlight feature: integrate-with-ref-preserved **or** delete — Phase G

**Deferred to sibling plans (audit §0: "do not fund without a profile"):**
- §2.1 zoom / pan / fullscreen → `docs/plans/YYYY-MM-DD-facsimiles-zoom.md`
- §2.7 gesture layer (pinch/momentum/intent-aware swipe) → same zoom plan or its own
- §2.5 grid **virtualization** (beyond lazy-load) → only if a profile shows lazy-load insufficient
- §4 filmstrip / contact-sheet rail → `docs/plans/YYYY-MM-DD-facsimiles-filmstrip.md`

---

## File Structure

**New files:**
- `frontend/webapp/src/views/Facsimiles/faxGeometry.js` — pure functions: `resolvePgOffset`, `buildLeafIndex`, `getAdjustedPageIndex`, `normalizeStackWidths`. No React, no DOM. Fully unit-tested.
- `frontend/webapp/src/views/Facsimiles/useElementSize.js` — `useElementSize(ref)` hook: ResizeObserver → `{width,height,top}` state, rAF-batched, correct deps. Replaces the 130-line stale-closure effect.
- `frontend/webapp/src/views/Facsimiles/faxThumbCache.js` — `prefetchThumbs(urls)` + `isThumbWarm(url)`: module-level `Set`, idempotent `new Image()` prefetch. Unit-tested via an injected image factory.
- Test files under `frontend/webapp/src/views/Facsimiles/__tests__/`: `faxGeometry.test.js`, `faxThumbCache.test.js`.

**Modified files:**
- `Facsimiles.js` — use `resolvePgOffset` + memoized `buildLeafIndex`; move list fetch to `useEffect` + error state; grid tile `loading`/`willChange` cleanup.
- `FacsimilePageViewer.js` — swap resize effect for `useElementSize`; `history.replace`; single slider state; wire prefetch; a11y; toolbar/page-indicator; use `normalizeStackWidths`.
- `FacsimilePageViewerMobile.js` — `history.replace`; slider tooltip; a11y.
- `PageStack.jsx` — single source of truth for width+hit-test; rAF throttle; keyed/no-flash thumb; prefetch; keyboard reachable.
- `PageImage.jsx` — don't flash shimmer for warm `src`; `loading` prop.
- `FacsimilePageViewer.scss` / `Facsimiles.scss` — consolidate duplicates; fix stripe gradient; remove width transitions; toolbar/heading styles.

---

## Conventions for every task

- **Run one test file:** `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/<file>` (path arg is a regex filter; `CI=true` disables watch).
- **Lint a file:** `cd frontend/webapp && npx eslint src/views/Facsimiles/<file>`
- **Manual check:** capture `http://localhost:8200/fax/1830` and `/fax/1830/12` (NOT `bom.kckern.net` — it's CDN-cached; see CLAUDE.md). If `bom-dev` isn't running: `systemctl --user restart bom-dev` (authorized per project memory), then `journalctl --user -u bom-dev -f`.
- **Commit** after each task's tests/verification pass.

---

## Phase A — Correctness bugs (highest ROI, lowest risk)

### Task A1: Extract & test `resolvePgOffset` (fixes §2.16)

**Files:**
- Create: `frontend/webapp/src/views/Facsimiles/faxGeometry.js`
- Test: `frontend/webapp/src/views/Facsimiles/__tests__/faxGeometry.test.js`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/faxGeometry.test.js
import { resolvePgOffset } from "../faxGeometry";

describe("resolvePgOffset", () => {
  test("prefers numeric pgOffset (camelCase)", () => {
    expect(resolvePgOffset({ pgOffset: 4, pgoffset: 9 })).toBe(4);
  });
  test("falls back to lowercase pgoffset", () => {
    expect(resolvePgOffset({ pgoffset: 7 })).toBe(7);
  });
  test("coerces numeric strings", () => {
    expect(resolvePgOffset({ pgoffset: "5" })).toBe(5);
  });
  test("defaults to 0 when neither present or non-numeric", () => {
    expect(resolvePgOffset({})).toBe(0);
    expect(resolvePgOffset(null)).toBe(0);
    expect(resolvePgOffset({ pgOffset: "x" })).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxGeometry.test.js`
Expected: FAIL — "Cannot find module '../faxGeometry'".

- [ ] **Step 3: Write minimal implementation**

```js
// faxGeometry.js

/**
 * The fax `item` object carries the front-matter page offset under an
 * ambiguous key — some records use `pgOffset`, some `pgoffset`. Resolve to a
 * single non-negative integer. (Audit §2.16.)
 */
export function resolvePgOffset(item) {
  const raw = item && (item.pgOffset != null ? item.pgOffset : item.pgoffset);
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxGeometry.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/faxGeometry.js frontend/webapp/src/views/Facsimiles/__tests__/faxGeometry.test.js
git commit -m "feat(fax): add resolvePgOffset to end pgOffset/pgoffset ambiguity (audit §2.16)"
```

---

### Task A2: Extract & test `buildLeafIndex` (prep for §2.14)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/faxGeometry.js`
- Test: `frontend/webapp/src/views/Facsimiles/__tests__/faxGeometry.test.js`

This lifts the leaf-index construction from `Facsimiles.js:43-68` verbatim (same fields, same URL math) into a pure function so it can be memoized in Task A3. `getRefFromIndex` stays in `Facsimiles.js` and is passed in to avoid a circular import.

- [ ] **Step 1: Write the failing test**

```js
// append to __tests__/faxGeometry.test.js
import { buildLeafIndex } from "../faxGeometry";

const ITEM = { slug: "1830", pages: 3, format: "jpg" };
const REF = () => null; // stub getRefFromIndex

describe("buildLeafIndex", () => {
  test("produces pgoffset front-matter leaves plus pages+1 numbered leaves", () => {
    const leaves = buildLeafIndex(ITEM, 2, [], REF, "https://cdn");
    // totalLeaves = (pages+1) + pgoffset = 4 + 2 = 6
    expect(leaves).toHaveLength(6);
    expect(leaves[0].pageNumInt).toBeNull();      // front matter
    expect(leaves[0].pageNumRoman).toBeTruthy();
    expect(leaves[2].pageNumInt).toBe(1);          // first numbered page
    expect(leaves[2].pageSlugLeaf).toBe(1);
  });
  test("numbered page asset url is zero-padded to 3 digits", () => {
    const leaves = buildLeafIndex(ITEM, 2, [], REF, "https://cdn");
    expect(leaves[2].pageAssetUrl).toBe("https://cdn/fax/pages/1830/001.jpg");
    expect(leaves[2].thumbAssetUrl).toBe("https://cdn/fax/thumb/1830/001.jpg");
  });
  test("isLeftSide is true for even page index i", () => {
    const leaves = buildLeafIndex(ITEM, 2, [], REF, "https://cdn");
    expect(leaves[2].isLeftSide).toBe(false); // i=1 (odd) -> right
    expect(leaves[3].isLeftSide).toBe(true);  // i=2 (even) -> left
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxGeometry.test.js`
Expected: FAIL — "buildLeafIndex is not a function".

- [ ] **Step 3: Write minimal implementation**

```js
// append to faxGeometry.js
import { convertIntToRomanNumeral } from "../../models/Utils";

/**
 * Build the array of "leaf" descriptors for a fax edition. Pure port of the
 * former inline builder in Facsimiles.js (audit §2.14 — was rebuilt every
 * render). `getRef(pageIndex, i)` is injected to avoid a circular import;
 * `assetBaseUrl` is BoMOnlineAPI's `assetUrl`.
 */
export function buildLeafIndex(item, pgoffset, pageIndex, getRef, assetBaseUrl) {
  const pages = parseInt(item.pages, 10);
  const totalLeaves = pages + 1 + pgoffset;
  const baseUrl = `${assetBaseUrl}/fax/pages/${item.slug}/`;
  const fmt = item.format || "jpg";
  return Array.from({ length: totalLeaves }, (_, idx) => {
    const i = idx - pgoffset;
    const pageNumInt = i > 0 ? i : null;
    const pageNumRoman = i <= 0 ? convertIntToRomanNumeral(pgoffset + i, true) : null;
    const pageAssetUrl =
      i > 0
        ? `${baseUrl}${i.toString().padStart(3, "0")}.${fmt}`
        : `${baseUrl}000.${(pgoffset + i).toString().padStart(2, "0")}.${fmt}`;
    const thumbAssetUrl = pageAssetUrl.replace("pages", "thumb");
    return {
      leafCursor: idx,
      leafSequence: pageNumInt || idx,
      pageNumInt,
      pageNumRoman,
      pageSlugLeaf: pageNumRoman || pageNumInt,
      pageReference: getRef(pageIndex, i),
      isLeftSide: i % 2 === 0,
      pageAssetUrl,
      thumbAssetUrl,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxGeometry.test.js`
Expected: PASS (all `faxGeometry` tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/faxGeometry.js frontend/webapp/src/views/Facsimiles/__tests__/faxGeometry.test.js
git commit -m "feat(fax): extract pure buildLeafIndex (prep for memoization, audit §2.14)"
```

---

### Task A3: Memoize `leafIndex` + adopt `resolvePgOffset` in `Facsimiles.js` (fixes §2.14, §2.16)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/Facsimiles.js:21-68`

- [ ] **Step 1: Update imports and the `FacsimileViewer` body**

Replace the current `useEffect`+inline `leafIndex` block (`Facsimiles.js:29-68`) so the leaf index is memoized and the offset is resolved once. Add `useMemo` to the React import (`Facsimiles.js:1`) and import the helpers.

At top of file, add:

```js
import { resolvePgOffset, buildLeafIndex } from "./faxGeometry";
```

Ensure line 1 imports `useMemo`:

```js
import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
```

Inside `FacsimileViewer`, replace lines 29-68 with:

```js
  const pgoffset = resolvePgOffset(item);

  useEffect(() => {
    if (!item.indexRef) return;
    const { indexRef, pgfirstVerse } = item || {};
    const blankPageCount = pgoffset + pgfirstVerse - 1;
    let cancelled = false;
    BoMOnlineAPI({ faxIndex: indexRef })
      .then((r) => {
        if (cancelled) return;
        const entry = r?.fax?.[indexRef];
        const pages = entry?.pages;
        if (!Array.isArray(pages)) return;
        const placeholderArray = Array.from({ length: blankPageCount }, () => [0, 0]);
        setPageIndex([...placeholderArray, ...pages]);
      })
      .catch(() => { /* leave pageIndex empty; refs simply won't show */ });
    return () => { cancelled = true; };
  }, [item.slug, item.indexRef, pgoffset]);

  const leafIndex = useMemo(
    () => buildLeafIndex(item, pgoffset, pageIndex, getRefFromIndex, assetUrl),
    [item, pgoffset, pageIndex]
  );
```

Note: the old `const { pages, pgoffset } = item;` line (was `:40`) and the old `totalLeaves`/`leafIndex` block (`:41-68`) are now entirely removed. `getRefFromIndex` is defined later in the same file (hoisted `export const`? No — it's a `const` arrow, so it is NOT hoisted). Move the `getRefFromIndex` definition (`Facsimiles.js:278-286`) to ABOVE `FacsimileViewer` (just under the imports) so the `useMemo` can reference it.

- [ ] **Step 2: Verify the referenced ref helper is in scope**

Run: `cd frontend/webapp && npx eslint src/views/Facsimiles/Facsimiles.js`
Expected: no `no-use-before-define` / `no-undef` errors for `getRefFromIndex`, `assetUrl`, `buildLeafIndex`, `resolvePgOffset`, `useMemo`.

- [ ] **Step 3: Build to confirm no runtime import cycle**

Run: `cd frontend/webapp && CI=true npx react-scripts build 2>&1 | tail -20`
Expected: "Compiled" (warnings OK), no "Cannot access 'getRefFromIndex' before initialization".

- [ ] **Step 4: Manual smoke check**

Restart dev if needed, then load `http://localhost:8200/fax/1830/12`. Expected: spread renders, references appear under pages, page turns work. In React DevTools Profiler (or a `console.count` temporarily in `buildLeafIndex`), confirm the builder runs once per `pageIndex`/`item` change, not per turn.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/Facsimiles.js
git commit -m "perf(fax): memoize leafIndex + resolve pgOffset once (audit §2.14, §2.16)"
```

---

### Task A4: Move list fetch to `useEffect` + add error/empty state (fixes §2.15)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/Facsimiles.js:302-471` (the `Facsimiles` component)

- [ ] **Step 1: Replace the fetch-in-render with an effect + error state**

Find the render-body fetch (`Facsimiles.js:462-464`):

```js
  if (!FaxList) BoMOnlineAPI({ fax: "pdf" }).then((r) => {
    setFaxList(r.fax);
  });
```

Delete it. Add near the other hooks at the top of `Facsimiles` (after `const [FaxList, setFaxList] = useState(null);`):

```js
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    BoMOnlineAPI({ fax: "pdf" })
      .then((r) => { if (!cancelled) setFaxList(r?.fax || {}); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, []);
```

Replace the final return (`Facsimiles.js:465-470`):

```js
  if (loadError) {
    return (
      <div className="faxMainContainer">
        <Alert color="danger" className="text-center m-4">
          {label("fax_load_error") || "Could not load facsimiles. Please try again."}
        </Alert>
      </div>
    );
  }
  return FaxList ? (
    <div className="faxMainContainer">{contentsUI()}</div>
  ) : (
    <Loader />
  );
```

- [ ] **Step 2: Lint**

Run: `cd frontend/webapp && npx eslint src/views/Facsimiles/Facsimiles.js`
Expected: no `react-hooks/exhaustive-deps` error on the new effect (empty deps is correct — runs once), no unused `loadError`.

- [ ] **Step 3: Manual check — happy path + failure path**

Happy: `http://localhost:8200/fax` lists editions. Failure: temporarily throttle/block the network (DevTools → offline) and reload `/fax`; expect the red Alert, not an infinite spinner or a render loop (watch console for repeated network calls — there must be exactly one).

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/Facsimiles.js
git commit -m "fix(fax): move list fetch to useEffect + add error state (audit §2.15)"
```

---

### Task A5: Create & test `useElementSize`, replace the stale-closure resize effect (fixes §2.13)

**Files:**
- Create: `frontend/webapp/src/views/Facsimiles/useElementSize.js`
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js:28` and `:150-284`

- [ ] **Step 1: Write the hook**

```js
// useElementSize.js
import { useEffect, useState } from "react";

/**
 * Observe an element's border-box size + viewport-top, rAF-batched, with a
 * small px threshold to avoid churn. Replaces the 130-line hand-rolled effect
 * whose [] deps closed over stale `containerSize` (audit §2.13).
 */
export function useElementSize(ref, { threshold = 4 } = {}) {
  const [size, setSize] = useState({
    width: 0,
    height: 0,
    top: 0,
    viewportH: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let raf = null;
    const read = () => {
      raf = null;
      const rect = el.getBoundingClientRect();
      setSize((prev) => {
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        const top = Math.floor(rect.top);
        const viewportH = window.innerHeight;
        if (
          Math.abs(width - prev.width) < threshold &&
          Math.abs(height - prev.height) < threshold &&
          Math.abs(top - prev.top) < threshold &&
          viewportH === prev.viewportH
        ) {
          return prev; // no meaningful change -> no re-render
        }
        return { width, height, top, viewportH };
      });
    };
    const schedule = () => { if (raf == null) raf = requestAnimationFrame(read); };
    read();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    window.addEventListener("resize", schedule);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [ref, threshold]);

  return size;
}
```

- [ ] **Step 2: Swap it into the viewer**

In `FacsimilePageViewer.js`, add the import:

```js
import { useElementSize } from "./useElementSize";
```

Delete the `containerSize` state (`:28`) and the entire resize `useEffect` (`:150-284`). Replace with:

```js
  const containerSize = useElementSize(pagesContainerRef);
```

(`containerSize` keeps the same shape — `{width,height,top,viewportH}` — so the downstream `useMemo` at `:329-386` is untouched.)

- [ ] **Step 3: Lint + build**

Run: `cd frontend/webapp && npx eslint src/views/Facsimiles/FacsimilePageViewer.js src/views/Facsimiles/useElementSize.js`
Then: `cd frontend/webapp && CI=true npx react-scripts build 2>&1 | tail -5`
Expected: clean lint (no unused `Date.now` machinery left), compiled build.

- [ ] **Step 4: Manual check — resize behaves, no loop**

Load `/fax/1830/12`, drag the window narrower/wider. Expected: pages re-fit smoothly; no console "ResizeObserver loop" warnings; the spread reaches a correct size on first paint (previously the stale closure made every tick "changed"). Confirm CPU settles when idle (no perpetual re-renders).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/useElementSize.js frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js
git commit -m "fix(fax): replace stale-closure resize effect with useElementSize hook (audit §2.13)"
```

---

## Phase B — Perceptual jank

### Task B1: `history.push` → `history.replace` on page turns (fixes §2.2 history pollution)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js:401`
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewerMobile.js:122`

- [ ] **Step 1: Change both `handlePageChange` calls**

Desktop `FacsimilePageViewer.js:401`, change:

```js
      history.push(`/fax/${item.slug}/${targetPage.pageSlugLeaf}`);
```
to:
```js
      history.replace(`/fax/${item.slug}/${targetPage.pageSlugLeaf}`);
```

Mobile `FacsimilePageViewerMobile.js:122`, same edit.

Leave the *volume*-switch and stack-click navigations as `push` (those are deliberate jumps, not intra-book turns). Only the per-page `handlePageChange` becomes `replace`.

- [ ] **Step 2: Manual check — Back exits the viewer**

Enter `/fax` → open an edition → turn 5 pages forward. Press browser Back once. Expected: returns to `/fax` (grid), NOT stepping back one leaf at a time. Deep link `/fax/1830/40` still loads page 40 directly.

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js frontend/webapp/src/views/Facsimiles/FacsimilePageViewerMobile.js
git commit -m "fix(fax): use history.replace for page turns so Back exits the viewer (audit §2.2)"
```

---

### Task B2: Stop `PageImage` flashing the shimmer for cached images (fixes §2.2 flicker)

**Files:**
- Create/modify test: `frontend/webapp/src/views/Facsimiles/__tests__/faxThumbCache.test.js` (cache is reused by PageImage warm-check)
- Create: `frontend/webapp/src/views/Facsimiles/faxThumbCache.js`
- Modify: `frontend/webapp/src/views/Facsimiles/PageImage.jsx`

The flicker: `PageImage` sets `loaded=false` on every `src` change, showing the shimmer even when the browser already has the image. Fix: track warmed URLs in a shared cache; if `src` is warm, start `loaded=true` (no shimmer). The same cache backs Phase C prefetching.

- [ ] **Step 1: Write the failing cache test**

```js
// __tests__/faxThumbCache.test.js
import { prefetchThumbs, isThumbWarm, __resetThumbCache } from "../faxThumbCache";

describe("faxThumbCache", () => {
  beforeEach(() => __resetThumbCache());

  test("isThumbWarm is false before prefetch, true after image load", () => {
    const loaders = [];
    const factory = () => {
      const img = {};
      loaders.push(img);
      return img;
    };
    expect(isThumbWarm("a.jpg")).toBe(false);
    prefetchThumbs(["a.jpg"], factory);
    // simulate browser finishing the load
    loaders[0].onload();
    expect(isThumbWarm("a.jpg")).toBe(true);
  });

  test("prefetch is idempotent — a warm/in-flight url is not re-fetched", () => {
    let created = 0;
    const factory = () => { created++; return {}; };
    prefetchThumbs(["a.jpg", "a.jpg"], factory);
    prefetchThumbs(["a.jpg"], factory);
    expect(created).toBe(1);
  });

  test("ignores falsy urls", () => {
    let created = 0;
    const factory = () => { created++; return {}; };
    prefetchThumbs([null, undefined, ""], factory);
    expect(created).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxThumbCache.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the cache**

```js
// faxThumbCache.js
const warm = new Set();      // urls whose image has fired onload
const inflight = new Set();  // urls currently being fetched

export function isThumbWarm(url) {
  return !!url && warm.has(url);
}

/**
 * Prefetch thumbnail urls via Image(). Idempotent: skips warm/in-flight urls.
 * `factory` is injectable for tests (defaults to `new Image()`).
 */
export function prefetchThumbs(urls, factory = () => new Image()) {
  for (const url of urls || []) {
    if (!url || warm.has(url) || inflight.has(url)) continue;
    inflight.add(url);
    const img = factory();
    img.onload = () => { inflight.delete(url); warm.add(url); };
    img.onerror = () => { inflight.delete(url); };
    img.src = url;
  }
}

// test-only
export function __resetThumbCache() { warm.clear(); inflight.clear(); }
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxThumbCache.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Use the cache in `PageImage` to skip the shimmer when warm**

In `PageImage.jsx`, import and seed initial state from the cache; mark warm on load:

```js
import React, { useEffect, useState } from 'react';
import { isThumbWarm, markThumbWarm } from './faxThumbCache';
```

Change the state init + effect:

```js
  const [loaded, setLoaded] = useState(() => isThumbWarm(src));

  useEffect(() => {
    setLoaded(isThumbWarm(src)); // warm -> no shimmer; cold -> show it
  }, [src]);
```

And in the `<img onLoad>`:

```js
        onLoad={() => { markThumbWarm(src); setLoaded(true); }}
        onError={() => setLoaded(true)}
```

Add `markThumbWarm` to `faxThumbCache.js`:

```js
export function markThumbWarm(url) { if (url) { inflight.delete(url); warm.add(url); } }
```

Remove the now-redundant `showPlaceholder` state (it was always `true` in practice); gate the placeholder blocks on `!loaded` only.

- [ ] **Step 6: Lint + manual check**

Run: `cd frontend/webapp && npx eslint src/views/Facsimiles/PageImage.jsx src/views/Facsimiles/faxThumbCache.js`
Manual: load `/fax/1830/12`, turn forward 3 spreads, then Back to a spread you already viewed. Expected: previously-seen pages appear instantly with NO shimmer flash; first-time pages still shimmer.

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/faxThumbCache.js frontend/webapp/src/views/Facsimiles/__tests__/faxThumbCache.test.js frontend/webapp/src/views/Facsimiles/PageImage.jsx
git commit -m "fix(fax): skip shimmer for already-loaded images via warm cache (audit §2.2)"
```

---

### Task B3: Remove the page-box width/height transitions (fixes §2.2 resize jiggle)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js:613,633`

- [ ] **Step 1: Delete the transitions**

In both the `leftPage` and `rightPage` inline styles, remove:

```js
                // Smooth transitions
                transition: 'width 0.15s ease, height 0.15s ease',
```

Leave the width/height values themselves. (Rationale, audit §2.2: animating the container width makes each turn visibly resize when adjacent scans differ in ratio; the fix for smooth turns is a content transition later, not a geometry animation.)

- [ ] **Step 2: Manual check — no per-turn width wobble**

Load `/fax/1830/12`, turn several spreads. Expected: page frame no longer animates its width between spreads; sizing is instant and stable.

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js
git commit -m "fix(fax): drop page-box width/height transitions that caused per-turn wobble (audit §2.2)"
```

---

### Task B4: Grid — lazy-load images + drop blanket `willChange` (fixes §2.5, no virtualization)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/Facsimiles.js:248-269`
- Modify: `frontend/webapp/src/views/Facsimiles/PageImage.jsx`

- [ ] **Step 1: Add a `loading` prop to `PageImage`**

In `PageImage.jsx`, accept `loading` and pass it to the `<img>`:

```js
export default function PageImage({ src, alt, onClick, className = '', previewSrc, label, reference, style, loading }) {
```
```js
      <img
        className="main-image"
        src={src}
        alt={alt}
        loading={loading}
        onLoad={() => { markThumbWarm(src); setLoaded(true); }}
        onError={() => setLoaded(true)}
        style={style}
      />
```

- [ ] **Step 2: Grid tile — remove `willChange`/`translate3d`, pass `loading="lazy"`**

In `FacsimileGridViewer`'s tile (`Facsimiles.js:248-269`), change the `<div className="faxPage">` style from:

```js
              style={{ 
                width: `${tileWidth}px`, 
                height: `${tileHeight}px`,
                willChange: 'transform',
                transform: 'translate3d(0, 0, 0)'
              }}
```
to:
```js
              style={{ width: `${tileWidth}px`, height: `${tileHeight}px` }}
```

and add `loading="lazy"` to the tile's `PageImage`:

```js
              <PageImage
                src={i.thumbAssetUrl}
                previewSrc={i.thumbAssetUrl}
                alt={alt}
                label={`Page ${i.pageSlugLeaf}`}
                reference={i.pageReference}
                onClick={undefined}
                className="grid-thumb"
                loading="lazy"
              />
```

- [ ] **Step 3: Manual check — network + scroll**

Load `/fax/1830` (grid). Open DevTools Network, filter Img. Expected: thumbnails load as you scroll (not all ~380 at once); scrolling is smoother; no hundreds of composited `will-change` layers in the Layers panel.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/Facsimiles.js frontend/webapp/src/views/Facsimiles/PageImage.jsx
git commit -m "perf(fax): lazy-load grid thumbnails + drop blanket will-change (audit §2.5)"
```

---

## Phase C — Slider & hover thumbnails

### Task C1: Collapse the doubled slider state to a single source of truth (fixes §2.3)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js:21-22,472-479,706-719`
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewerMobile.js:18-19,164-171,216-227`

Keep `sliderValue` as the drag-preview state but derive its committed position from `currentPageIndex`, and drive the displayed `value` from `currentPageIndex` when not actively dragging.

- [ ] **Step 1: Desktop — sync slider value to page index**

Add an effect after the init effect in `FacsimilePageViewer.js` to keep the slider thumb aligned when the page changes by any means (arrows, buttons, stack, deep link):

```js
  useEffect(() => { setSliderValue(currentPageIndex); }, [currentPageIndex]);
```

Leave `handleSliderChange` (drag updates `sliderValue`) and `handleSliderRelease` (commits via `handlePageChange(sliderValue)`) as-is. This removes the desync where the thumb and page disagreed.

- [ ] **Step 2: Mobile — same sync effect**

Add to `FacsimilePageViewerMobile.js`:

```js
  useEffect(() => { setSliderValue(currentPageIndex); }, [currentPageIndex]);
```

- [ ] **Step 3: Lint**

Run: `cd frontend/webapp && npx eslint src/views/Facsimiles/FacsimilePageViewer.js src/views/Facsimiles/FacsimilePageViewerMobile.js`
Expected: no exhaustive-deps warnings on the new effects.

- [ ] **Step 4: Manual check — thumb tracks page**

Load `/fax/1830/12`. Turn with arrow keys and nav buttons. Expected: slider thumb moves to match every turn (previously it only moved when you dragged it). Drag the slider and release: page jumps to the released position.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js frontend/webapp/src/views/Facsimiles/FacsimilePageViewerMobile.js
git commit -m "fix(fax): keep slider thumb synced to current page (audit §2.3)"
```

---

### Task C2: Add the missing mobile slider preview tooltip (fixes §2.3)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewerMobile.js`

Mobile has no slider preview at all. Add a lightweight thumbnail+page preview above the thumb, shown while dragging (on `input`/`change`), positioned by the slider value.

- [ ] **Step 1: Add preview state + handlers**

In `FacsimilePageViewerMobile.js`, add:

```js
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewPage = leafIndex[sliderValue] || null;
```

Update the range input to open/close the preview:

```js
          <input
            type="range"
            min={0}
            max={totalPages - 1}
            step={1}
            value={sliderValue}
            onChange={handleSliderChange}
            onMouseDown={() => setPreviewOpen(true)}
            onTouchStart={() => setPreviewOpen(true)}
            onMouseUp={() => { setPreviewOpen(false); handleSliderRelease(); }}
            onTouchEnd={() => { setPreviewOpen(false); handleSliderRelease(); }}
            className="custom-slider"
            aria-label="Page position"
            aria-valuetext={`Page ${previewPage?.pageSlugLeaf ?? sliderValue + 1} of ${totalPages}`}
          />
          {previewOpen && previewPage && (
            <div className="mobile-slider-preview">
              <img src={previewPage.thumbAssetUrl} alt="" aria-hidden="true" />
              <div className="preview-label">
                {previewPage.pageReference || `Page ${previewPage.pageSlugLeaf}`}
              </div>
            </div>
          )}
```

- [ ] **Step 2: Add styles**

In `FacsimilePageViewer.scss`, under `.facsimile-navigation.mobile .slider-container` (add a nested rule):

```scss
    .mobile-slider-preview {
      position: absolute;
      bottom: 44px;
      left: 50%;
      transform: translateX(-50%);
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 6px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      padding: 6px;
      text-align: center;
      pointer-events: none;
      z-index: 20;
      img { width: 64px; height: auto; display: block; margin: 0 auto 4px; }
      .preview-label { font-size: 0.8rem; color: #444; white-space: nowrap; }
    }
```

- [ ] **Step 3: Manual check on a narrow viewport**

Load `http://localhost:8200/fax/1830/12` in a ≤900px-wide window (triggers `isMobile()`), drag the slider. Expected: a thumbnail + reference preview appears above the thumb and updates as you drag; disappears on release; page jumps to the released spot.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/FacsimilePageViewerMobile.js frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss
git commit -m "feat(fax): add mobile slider thumbnail preview while dragging (audit §2.3)"
```

---

### Task C3: PageStack — single source of truth, rAF throttle, prefetch + no-flash thumb, keyboard access (fixes §2.11, §2.17-partial)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/PageStack.jsx`

- [ ] **Step 1: rAF-throttle `onMove` and prefetch neighbors**

Import the cache and add a throttle ref:

```js
import { prefetchThumbs, isThumbWarm } from './faxThumbCache';
```

Replace `onMove` (`PageStack.jsx:79-87`) with an rAF-batched version that also warms a window of thumbnails around the hovered index:

```js
  const rafRef = useRef(null);
  const pendingRef = useRef(null);

  const applyMove = useCallback(() => {
    rafRef.current = null;
    const p = pendingRef.current;
    if (!p || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = p.clientX - rect.left;
    const y = p.clientY - rect.top;
    const idx = positionToPageIdx(x);
    const clampedX = Math.max(0, Math.min(rect.width, x));
    setHover({ visible: true, x: clampedX, y: Math.max(0, Math.min(rect.height, y)), pageIdx: idx });
    // warm the hovered thumb + a few neighbors within this stack
    if (idx != null) {
      const here = stackIndices.indexOf(idx);
      const urls = [];
      for (let d = -2; d <= 2; d++) {
        const leaf = leafIndex[stackIndices[here + d]];
        if (leaf?.thumbAssetUrl) urls.push(leaf.thumbAssetUrl);
      }
      prefetchThumbs(urls);
    }
  }, [positionToPageIdx, stackIndices, leafIndex]);

  const onMove = useCallback((e) => {
    pendingRef.current = { clientX: e.clientX, clientY: e.clientY };
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(applyMove);
  }, [applyMove]);
```

Add cleanup for the rAF in an effect:

```js
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);
```

- [ ] **Step 2: Key the tooltip thumb by URL + skip shimmer when warm**

Replace the `thumbLoaded` reset effect (`PageStack.jsx:99-103`) so it doesn't flash for warm urls:

```js
  const [thumbLoaded, setThumbLoaded] = useState(false);
  useEffect(() => {
    setThumbLoaded(isThumbWarm(page?.thumbAssetUrl));
  }, [page?.thumbAssetUrl]);
```

Add `key={page.thumbAssetUrl}` to the tooltip `<img>` and call the warm-marker on load:

```js
              <img
                key={page.thumbAssetUrl}
                src={page.thumbAssetUrl}
                alt={`Thumbnail of page ${page.pageSlugLeaf}`}
                onLoad={() => setThumbLoaded(true)}
                ...
```

(Leave the existing `onError` fallback chain intact.)

- [ ] **Step 3: Single source of truth for width + hit-test**

The parent already passes `width` (px). Make the click hit-test use the same page list the width is derived from by relying solely on `stackIndices` (already the case) and removing the parent/child formula divergence noted in §2.10: pass the parent's page-count down is unnecessary — instead, in Task D1 the parent will compute width FROM `stackIndices.length`. For now, ensure `positionToPageIdx` uses `containerWidth || width || targetWidth`:

```js
    const width = containerWidth || 0;
```
becomes
```js
    const width = containerWidth || stackWidthPx || targetWidth;
```
where `stackWidthPx` is the `width` prop (rename the destructured prop to `stackWidthPx` for clarity, updating `stackStyle`).

- [ ] **Step 4: Keyboard accessibility**

Make the stack focusable and operable (audit §2.17). Add to the root `div`:

```js
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
```

(It already has `role="button"` and `aria-label`.)

- [ ] **Step 5: Lint + manual check**

Run: `cd frontend/webapp && npx eslint src/views/Facsimiles/PageStack.jsx`
Manual: load `/fax/1830/120`, sweep the mouse slowly then quickly across a side stack. Expected: tooltip thumbnails appear promptly (neighbors pre-warmed); re-hovering a column you already saw shows NO shimmer flash; Tab can focus a stack and Enter jumps to a page.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/PageStack.jsx
git commit -m "fix(fax): prefetch + no-flash + rAF-throttle + keyboard for PageStack hover (audit §2.11, §2.17)"
```

---

## Phase D — Stack balance

### Task D1: `normalizeStackWidths` — fixed total footprint, faithful ratio (fixes §2.10)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/faxGeometry.js`
- Test: `frontend/webapp/src/views/Facsimiles/__tests__/faxGeometry.test.js`
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js:317-325`

- [ ] **Step 1: Write the failing test**

```js
// append to __tests__/faxGeometry.test.js
import { normalizeStackWidths } from "../faxGeometry";

describe("normalizeStackWidths", () => {
  test("splits a fixed total footprint by before/after ratio", () => {
    // 100 leaves, spread starts at index 50 -> ~half/half
    const { left, right } = normalizeStackWidths(50, 100, 160);
    expect(left + right).toBeLessThanOrEqual(160);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(4); // roughly balanced mid-book
  });
  test("near the start: left thin, right fat, still sums to <= total", () => {
    const { left, right } = normalizeStackWidths(2, 100, 160);
    expect(left).toBeLessThan(right);
    expect(left + right).toBeLessThanOrEqual(160);
  });
  test("never exceeds total regardless of book length (no cap-stick)", () => {
    const { left, right } = normalizeStackWidths(400, 2000, 160);
    expect(left + right).toBeLessThanOrEqual(160);
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
  });
  test("zero pages before -> zero left width", () => {
    const { left } = normalizeStackWidths(0, 100, 160);
    expect(left).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxGeometry.test.js`
Expected: FAIL — "normalizeStackWidths is not a function".

- [ ] **Step 3: Implement**

```js
// append to faxGeometry.js

/**
 * Distribute a FIXED total footprint (px) between the two edge-stacks in
 * proportion to how many leaves sit before vs after the current spread.
 * This keeps the stacks' combined width constant across turns (no page-width
 * jitter) and never "sticks" at a per-side cap on long books (audit §2.10).
 * `adjustedPageIndex` is the even index of the left page.
 */
export function normalizeStackWidths(adjustedPageIndex, totalPages, totalFootprint = 160) {
  const before = Math.max(0, Math.floor(adjustedPageIndex / 2));
  const after = Math.max(0, Math.floor((totalPages - (adjustedPageIndex + 2)) / 2));
  const sum = before + after;
  if (sum <= 0) return { left: 0, right: 0 };
  const left = Math.round((before / sum) * totalFootprint);
  const right = Math.round((after / sum) * totalFootprint);
  return { left, right };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxGeometry.test.js`
Expected: PASS.

- [ ] **Step 5: Use it in the viewer**

In `FacsimilePageViewer.js`, replace the `leftStackWidth`/`rightStackWidth` memo (`:317-325`) with:

```js
  import { normalizeStackWidths } from "./faxGeometry"; // add to imports at top

  const { leftStackWidth, rightStackWidth } = useMemo(
    () => {
      const { left, right } = normalizeStackWidths(adjustedPageIndex, totalPages, 160);
      return { leftStackWidth: left, rightStackWidth: right };
    },
    [adjustedPageIndex, totalPages]
  );
```

(Downstream `innerWidth`/`pageSpaceWidth` already consume these; no other change needed. The `PageStack` `width` prop now receives the normalized value.)

- [ ] **Step 6: Manual check — balance + no mid-book squeeze**

Load `/fax/1830/2` (near start), `/fax/1830/190` (mid), `/fax/1830/378` (near end). Expected: stacks always sum to ~160px; left thin/right fat at the start, balanced mid-book, left fat/right thin at the end; the PAGE width no longer shrinks in the middle of the book (stacks are constant footprint now).

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/faxGeometry.js frontend/webapp/src/views/Facsimiles/__tests__/faxGeometry.test.js frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js
git commit -m "fix(fax): normalize side-stacks to fixed footprint + faithful ratio (audit §2.10)"
```

---

### Task D2: Fix the degenerate stripe gradient (fixes §2.10)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss:46-53`

- [ ] **Step 1: Replace the malformed gradient**

Change (`:47-53`):

```scss
    background: repeating-linear-gradient(
      to right,
      #AAA 0,
      #888 2px,
      #AAA 1px,
      #888 2px
    );
```
to a valid, uniform 2px page-edge stripe (monotonic stops):

```scss
    background: repeating-linear-gradient(
      to right,
      #AAA 0,
      #AAA 1px,
      #888 1px,
      #888 2px
    );
```

- [ ] **Step 2: Manual check**

Load `/fax/1830/120`. Expected: crisp alternating 1px light/dark vertical stripes on both stacks (clean "page edges" texture), not a muddy ramp.

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss
git commit -m "fix(fax): correct degenerate PageStack stripe gradient stops (audit §2.10)"
```

---

## Phase E — SCSS consolidation

### Task E1: De-duplicate the conflicting selectors (fixes §2.9)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/Facsimiles.scss`
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss`

The viewer-specific rules should live only in `FacsimilePageViewer.scss` scoped under `.faxPageViewer`; `Facsimiles.scss` keeps the list/grid rules. Remove the viewer duplicates from `Facsimiles.scss`.

- [ ] **Step 1: Remove the loser/duplicate blocks from `Facsimiles.scss`**

Delete these blocks from `Facsimiles.scss` (they are re-declared, correctly scoped, in `FacsimilePageViewer.scss`):
- `.faxPageViewer { ... }` (`:225-233`)
- `.pagesContainer { ... }` (`:235-244`)
- `.pageContainer { ... }` and `.pageContainer.mobile` (`:246-263`)
- `.page { ... }` and `.page img { ... }` (`:265-278`) — **this is the `object-fit: fill` block; deleting it removes the stretch rule entirely.**
- `.pageReferences` + `.pageReferences h6` (`:351-365`)
- `.facsimile-navigation` + `.nav-button` + `.slider-container` + `.custom-slider` (+ thumbs) + `.custom-tooltip` + `.tooltip-content` (`:367-460`)

Keep in `Facsimiles.scss`: `.faxInfo*`, `.faxMainContainer`, `.faxlist*`, `.faxGridViewer*`, `.faxPage*`, `.pageImageWrapper*` + `.skeleton-shimmer` + `.preview-blur` + `.loading-label` (these back the grid tiles and `PageImage`), `.facsimileViewer*`, the title rules, and the `@media` grid rules.

- [ ] **Step 2: Confirm `PageImage` styling still resolves**

`.pageImageWrapper` rules are used by BOTH grid and viewer. They stay in `Facsimiles.scss`. Verify `FacsimilePageViewer.scss` does not also define `.pageImageWrapper` (it doesn't) — no dupe there.

- [ ] **Step 3: Build + visual regression on both surfaces**

Run: `cd frontend/webapp && CI=true npx react-scripts build 2>&1 | tail -5`
Manual: compare BEFORE/AFTER screenshots of `/fax` (list), `/fax/1830` (grid), `/fax/1830/12` (spread), and `/fax/1830/12` at ≤900px (mobile). Expected: pixel-equivalent or better; specifically confirm scans are NOT stretched (object-fit now unambiguously `contain`), nav bar and slider look unchanged.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/Facsimiles.scss frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss
git commit -m "refactor(fax): de-duplicate conflicting viewer SCSS; remove stray object-fit:fill (audit §2.9)"
```

---

## Phase F — Toolbar, page indicator, accessibility

### Task F1: Slim viewer toolbar — compact heading, kill the magic margin, router-based Escape (fixes §2.6, §2.8)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/Facsimiles.js:70-114`
- Modify: `frontend/webapp/src/views/Facsimiles/Facsimiles.scss:494-506`

- [ ] **Step 1: Route the Escape key instead of synth-clicking**

In `FacsimileViewer`, replace the `handleKeyPress` Escape handler (`Facsimiles.js:71-76`) to use the router. Add `useHistory` (already imported in the file) inside `FacsimileViewer`:

```js
  const history = useHistory();
  const handleKeyPress = useCallback((e) => {
    if (e.key === "Escape") {
      history.push(displayLeaf ? `/fax/${item.slug}` : "/fax");
    }
  }, [history, item.slug, displayLeafRef]);
```

Because `displayLeaf` is computed later in the component, hoist a ref: add `const displayLeafRef = useRef(null);` near the top and set `displayLeafRef.current = displayLeaf;` right after `displayLeaf` is computed (`:95`). Use `displayLeafRef.current` in the handler and drop `displayLeaf` from deps (keep `displayLeafRef`). Remove the `id="fax_back"` dependency for Escape (the back link keeps its id for the visible button).

- [ ] **Step 2: Make the title a compact toolbar**

Change the heading markup (`Facsimiles.js:100-105`) to a toolbar with a class instead of a page `<h1>`:

```jsx
      <div className="facsimileToolbar">
        <Link id="fax_back" className="fax-back" to={displayLeaf ? `/fax/${item.slug}` : "/fax"} aria-label="Back to facsimiles">
          <img src={backIcon} alt="" aria-hidden="true" style={{ width: 20, height: 20 }} />
        </Link>
        <span className="fax-title">{title}</span>
        {/* page-indicator slot filled in Task F2 (desktop) */}
      </div>
```

- [ ] **Step 3: Style the toolbar (replace the oversized `<h1>` rules)**

In `Facsimiles.scss`, remove `.facsimileViewer h1 { ... }` and `h1.facsimileViewerTitle { ... }` (`:494-506`) and add:

```scss
.facsimileToolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
  padding: 0.4rem 1rem;
  .fax-back { display: inline-flex; align-items: center; }
  .fax-title {
    flex-grow: 1;
    text-align: center;
    font-size: 1.15rem;   /* was inherited ~2.5rem */
    font-weight: 600;
    color: #000;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
```

- [ ] **Step 4: Manual check**

Load `/fax/1830/12`. Expected: a slim toolbar (back · centered title) with a much smaller title; more vertical space for the page image; title is centered (no 6rem shove); Escape returns to the grid.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/Facsimiles.js frontend/webapp/src/views/Facsimiles/Facsimiles.scss
git commit -m "feat(fax): slim viewer toolbar, compact title, router-based Escape (audit §2.6, §2.8)"
```

---

### Task F2: Persistent page indicator + jump-to-page (fixes §2.6)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js` (desktop nav)
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewerMobile.js` (already has counter; add jump)

- [ ] **Step 1: Desktop — add an indicator + input in the nav bar**

In `FacsimilePageViewer.js`, inside `.facsimile-navigation` (after the right nav-button, `:721-727`), add:

```jsx
        <form
          className="fax-page-jump"
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseInt(e.target.elements.pageInput.value, 10);
            if (!Number.isFinite(n)) return;
            const idx = leafIndex.findIndex((l) => l.pageNumInt === n || `${l.pageSlugLeaf}` === `${n}`);
            if (idx !== -1) handlePageChange(idx);
          }}
        >
          <input
            name="pageInput"
            type="number"
            min={1}
            max={item.pages}
            defaultValue={leftPage?.pageSlugLeaf || ''}
            key={leftPage?.pageSlugLeaf}
            aria-label="Jump to page"
          />
          <span className="of-total">/ {item.pages}</span>
        </form>
```

- [ ] **Step 2: Style it**

In `FacsimilePageViewer.scss`, under `.facsimile-navigation`:

```scss
    .fax-page-jump {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      color: #444;
      input { width: 3.5em; text-align: center; }
    }
```

- [ ] **Step 3: Mobile — make the existing counter a jump input**

In `FacsimilePageViewerMobile.js`, replace the static `.page-counter` (`:237-239`) with the same `<form className="fax-page-jump">` block from Step 1 (it already has `handlePageChange` and `leafIndex` in scope; use `currentPage?.pageSlugLeaf` for `defaultValue`/`key`).

- [ ] **Step 4: Manual check**

Desktop `/fax/1830/12`: nav bar shows `12 / 380`; typing `250`+Enter jumps to page 250. Mobile: same, replacing the old read-only counter.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js frontend/webapp/src/views/Facsimiles/FacsimilePageViewerMobile.js frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss
git commit -m "feat(fax): persistent page indicator + jump-to-page (audit §2.6)"
```

---

### Task F3: Accessibility pass — labels + scoped arrow handling (fixes §2.17)

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js:427-470,679-727`
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewerMobile.js:143-162,208-236`

- [ ] **Step 1: Label the nav controls**

Add accessible names to the desktop nav buttons (`:679-685`, `:721-727`) and slider (`:706-719`):

```jsx
        <button className="nav-button" onClick={handleSwipeRight} disabled={currentPageIndex <= 0} aria-label="Previous pages">
          &#8249;
        </button>
```
```jsx
        <button className="nav-button" onClick={handleSwipeLeft} disabled={...} aria-label="Next pages">
          &#8250;
        </button>
```
```jsx
          <input
            type="range"
            ...
            aria-label="Page position"
            aria-valuetext={`Page ${leftPage?.pageSlugLeaf ?? sliderValue} of ${item.pages}`}
          />
```
Apply the same `aria-label`s to the mobile buttons (`:209-215`, `:229-235`).

- [ ] **Step 2: Don't `preventDefault` arrows when a form control is focused**

In BOTH viewers' arrow `useEffect` (`FacsimilePageViewer.js:427-431`, `Mobile:144-147`), guard against hijacking the focused slider/input:

```js
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return; // let native arrow behavior run
      if (e.key === 'ArrowLeft') { e.preventDefault(); handleSwipeRight(); }
      ...
```

- [ ] **Step 3: Manual + keyboard check**

Load `/fax/1830/12`. Tab through: back link → nav buttons (announced names) → slider → jump input → page stacks (focusable, Enter jumps). Focus the slider and press Left/Right: it moves the thumb natively (page-turn hijack suppressed). Focus elsewhere and press Left/Right: pages turn.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js frontend/webapp/src/views/Facsimiles/FacsimilePageViewerMobile.js
git commit -m "fix(fax): accessible control labels + don't hijack arrows in focused inputs (audit §2.17)"
```

---

## Phase G — Highlight feature decision (fixes §2.4 / §2.19)

> **Decision gate — ask the team before starting G:** integrate the highlight
> overlay, or delete the dead code + tests? The audit (§2.19) shows integration
> requires preserving the scripture reference that the redirect currently
> overwrites. Pick ONE of G1a / G1b.

### Task G1a: INTEGRATE — preserve the ref and render the overlay

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/Facsimiles.js:338-384` (stop discarding the ref)
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js`, `FacsimilePageViewerMobile.js`

- [ ] **Step 1: Preserve the reference through the redirect**

In the reference→page redirect (`Facsimiles.js:370-373`), append the original ref as a query param so the viewer can still resolve boxes:

```js
              if (targetPage) {
                const target = maxPage ? Math.min(targetPage, maxPage) : targetPage;
                if (history?.replace) history.replace(`/fax/${edition}/${target}?ref=${encodeURIComponent(rawPage)}`);
              }
```

- [ ] **Step 2: Read the ref + render the overlay (desktop)**

In `FacsimilePageViewer.js`, import and use the hook:

```js
import { useFaxHighlight } from "./useFaxHighlight";
import FaxHighlightOverlay from "./FaxHighlightOverlay";
import { useLocation } from "react-router-dom";
```
```js
  const location = useLocation();
  const refParam = new URLSearchParams(location.search).get('ref') || (hasLetters ? pageNumber : null);
  const highlight = useFaxHighlight(item.slug, refParam);
```

Inside the `.page` box render (in `renderPage`, when the page matches a highlighted `imagePage`), overlay the boxes. Compute the physical page number for the leaf and pass the matching boxes:

```jsx
        {highlight.boxesByPage.get(page.pageNumInt)?.length > 0 && (
          <FaxHighlightOverlay
            boxes={highlight.boxesByPage.get(page.pageNumInt)}
            pageScale={highlight.pageScale}
            displayedWidth={isLeft ? leftPageWidth : rightPageWidth}
          />
        )}
```

(Render it as a sibling of the `<PageImage>` inside the same relatively-positioned `.page` div, so the absolute `.faxHighlightLayer` aligns.)

- [ ] **Step 3: Mobile overlay (self-measured width)**

In `FacsimilePageViewerMobile.js`, same hook + overlay but omit `displayedWidth` (the overlay self-measures its container per `FaxHighlightOverlay.js:13-21`).

- [ ] **Step 4: Manual check**

Load `/fax/1830/alma.32.21`. Expected: redirects to the numeric page WITH `?ref=alma.32.21`, and a translucent highlight box appears over the passage on the correct page. Plain `/fax/1830/212` (no ref) shows no highlight.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/Facsimiles.js frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js frontend/webapp/src/views/Facsimiles/FacsimilePageViewerMobile.js
git commit -m "feat(fax): wire passage-highlight overlay, preserving ref through redirect (audit §2.4, §2.19)"
```

### Task G1b: DELETE — remove the dead feature instead

**Files:**
- Delete: `useFaxHighlight.js`, `FaxHighlightOverlay.js`, `__tests__/useFaxHighlight.test.js`, `__tests__/FaxHighlightOverlay.test.js`
- Modify: `FacsimilePageViewer.scss` — remove the `.faxHighlightLayer`/`.faxHighlightBox`/`.faxContinuesHint` blocks (`:381-418`)

- [ ] **Step 1: Remove files + styles**

```bash
cd frontend/webapp/src/views/Facsimiles
git rm useFaxHighlight.js FaxHighlightOverlay.js __tests__/useFaxHighlight.test.js __tests__/FaxHighlightOverlay.test.js
```
Then delete the highlight SCSS blocks (`FacsimilePageViewer.scss:381-418`).

- [ ] **Step 2: Build to confirm nothing referenced them**

Run: `cd frontend/webapp && CI=true npx react-scripts build 2>&1 | tail -5`
Expected: compiles (grep already confirmed no imports).

- [ ] **Step 3: Commit**

```bash
git add -A frontend/webapp/src/views/Facsimiles
git commit -m "chore(fax): remove dead passage-highlight code + styles (audit §2.4)"
```

---

## Phase H — Final verification

### Task H1: Full test + lint + build gate

- [ ] **Step 1: Run all Facsimiles unit tests**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles`
Expected: PASS — `faxGeometry.test.js`, `faxThumbCache.test.js` (+ highlight tests if G1a was chosen; they should be deleted if G1b).

- [ ] **Step 2: Lint the whole module**

Run: `cd frontend/webapp && npx eslint src/views/Facsimiles`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `cd frontend/webapp && CI=true npx react-scripts build 2>&1 | tail -8`
Expected: "Compiled successfully" (warnings acceptable).

- [ ] **Step 4: Manual regression sweep on `localhost:8200`**

Verify each still works: `/fax` (list) · `/fax/1830` (grid, lazy thumbs) · `/fax/1830/12` (spread, no shimmer on revisit, stable width, synced slider, balanced stacks, toolbar, page-jump, keyboard) · `/fax/1830/12` at ≤900px (mobile: single page, slider preview, jump) · `/fax/1830/alma.32.21` (highlight if G1a) · offline `/fax` (error Alert). Capture screenshots into `docs/audits/facsimiles-after-2026-07-23/`.

- [ ] **Step 5: Update the audit doc status**

Add a short "Resolved in `docs/plans/2026-07-23-facsimiles-viewer-fixes.md`" note atop each addressed finding (or a summary table at the end), so the audit reflects what shipped.

- [ ] **Step 6: Final commit**

```bash
git add docs/audits
git commit -m "docs(fax): record viewer fixes shipped against 2026-07-23 audit"
```

---

## Self-Review (completed by author)

**Spec coverage vs audit §2:** §2.2→B1-B3; §2.3→C1-C2; §2.4/§2.19→G1a/G1b; §2.5→B4 (lazy-load; virtualization deferred, noted); §2.6→F1-F2; §2.8→F1; §2.9→E1; §2.10→D1-D2; §2.11→C3; §2.13→A5; §2.14→A2-A3; §2.15→A4; §2.16→A1/A3; §2.17→C3+F3. Deferred (zoom §2.1, gestures §2.7, virtualization, filmstrip §4) are explicitly listed under Scope with sibling-plan pointers — intentional gaps, per audit §0's profile gate.

**Placeholder scan:** no TBD/"handle edge cases"/"similar to Task N" — every code step shows real code; every test step shows real assertions.

**Type/name consistency:** `resolvePgOffset`, `buildLeafIndex(item, pgoffset, pageIndex, getRef, assetBaseUrl)`, `normalizeStackWidths(adjustedPageIndex, totalPages, totalFootprint)`, `useElementSize(ref)`→`{width,height,top,viewportH}`, `prefetchThumbs(urls, factory)`/`isThumbWarm(url)`/`markThumbWarm(url)`/`__resetThumbCache()` are referenced identically across tasks. `containerSize` shape preserved so the downstream memo is untouched (A5). Slider `sliderValue`/`currentPageIndex` relationship consistent across C1/C2/F2.

**Known risk to watch during execution:** A3 moving `getRefFromIndex` above `FacsimileViewer` — it's a non-hoisted `const`; the build step (A3 Step 3) is the guard. If other modules import `getRefFromIndex`/`PageOverlay` from `Facsimiles.js` (they do — `FacsimilePageViewer.js:7`, `Mobile:6`), keep the `export` on the moved declaration.
