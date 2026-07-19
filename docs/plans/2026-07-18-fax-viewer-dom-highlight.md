# Fax-Viewer DOM Passage Highlight — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the fax viewer opens to a passage reference (`/fax/{version}/{ref}`), draw a DOM highlight over the passage's bounding box(es) on the page image, in both desktop and mobile viewers, following the reader across spreads.

**Architecture:** A backend JSON boxes endpoint (`/fax/boxes/...`, reusing the render module's resolve logic) feeds a shared frontend hook (`useFaxHighlight`) that groups boxes by scan-page; a `FaxHighlightOverlay` component positions absolute `div`s scaled by `displayedWidth / pageScale`. Both viewers mount the overlay on their visible page(s).

**Tech Stack:** Backend: Fastify, Kysely, Vitest. Frontend: React 17, `scripture-guide`, CRA + Jest (`react-scripts test`).

**Design spec:** `docs/specs/2026-07-18-fax-viewer-dom-highlight-design.md` — read it first.

**Conventions:**
- Backend ESM (`.js` imports), tests `npx vitest run <path>`. Frontend tests: `CI=true npx react-scripts test --watchAll=false <path>` (raw jest fails on JSX).
- `renderBaseUrl` (`src/models/BoMOnlineAPI.js`) is same-origin (""); `/fax/*` paths are reverse-proxied to backend :5006 by `setupProxy.js`.
- Box coords are in a 700px `pageScale` space; scale to a displayed image by `displayedWidth / pageScale`.
- The viewer's `leaf.pageNumInt` is the scan/image file number. The backend endpoint returns `imagePage = fax_page + imageScanMeta(version).offset` to match it directly.

---

## File Structure

```
backend/src/media/fax/route.ts                                    # + /fax/boxes/* handler
backend/test/fax/route.test.ts                                    # + boxes endpoint tests
frontend/webapp/src/setupProxy.js                                 # + '/fax/boxes'
frontend/webapp/src/views/Facsimiles/useFaxHighlight.js           # buildHighlightState + hook
frontend/webapp/src/views/Facsimiles/FaxHighlightOverlay.js       # overlay component
frontend/webapp/src/views/Facsimiles/__tests__/useFaxHighlight.test.js
frontend/webapp/src/views/Facsimiles/__tests__/FaxHighlightOverlay.test.js
frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js       # desktop integration
frontend/webapp/src/views/Facsimiles/FacsimilePageViewerMobile.js # mobile integration
frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss     # overlay + hint styles
```

---

## Task 1: Backend — `/fax/boxes` endpoint

**Files:**
- Modify: `backend/src/media/fax/route.ts`
- Test: `backend/test/fax/route.test.ts`

- [ ] **Step 1: Add the failing test** — append inside `backend/test/fax/route.test.ts` (reuse its existing `app()` helper):

```ts
describe('GET /fax/boxes', () => {
  it('returns imagePage (fax page + offset) + coords for a known verse', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/boxes/2013/mosiah-4.21' });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body) as {
      pageScale: number; clamped: boolean;
      boxes: { verseId: number; imagePage: number; x: number; y: number; w: number; h: number }[];
    };
    expect(body.pageScale).toBe(700);
    expect(body.boxes.length).toBeGreaterThan(0);
    const b = body.boxes[0]!;
    expect(b.imagePage).toBe(156);   // 2013 fax page 165 + offset (-9)
    expect(b.x).toBe(357);
    expect(b.y).toBe(291);
  });
  it('unknown verse -> empty boxes (200)', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/boxes/2013/ids/999999' });
    expect(r.statusCode).toBe(200);
    expect((JSON.parse(r.body) as { boxes: unknown[] }).boxes).toEqual([]);
  });
  it('unknown version -> 400', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/boxes/9999/mosiah-4.21' });
    expect(r.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/fax/route.test.ts -t "fax/boxes"`
Expected: FAIL (404 — no such route).

- [ ] **Step 3: Add the imports** — in `backend/src/media/fax/route.ts`, extend the existing imports so `imageScanMeta`, `MAX_VERSE_IDS`, and `selectorToVerseIds`/`verseIdsToBoxes` are available. The resolve import already has `selectorToVerseIds, verseIdsToBoxes, legacyUnitToVerseIds, imageScanMeta` — confirm `imageScanMeta` is present (it is). The constants import already has `VERSION_SLUGS, WIDTH_WHITELIST, MAX_PAGES, MAX_VERSE_IDS` — confirm `MAX_VERSE_IDS` is present; if not, add it.

- [ ] **Step 4: Add the route handler** — inside `faxRoutes`, after the `/fax/text/*` handler, add:

```ts
  // Box coordinates for a passage — JSON for the viewer's DOM highlight overlay.
  // GET /fax/boxes/{version}/{selector}  ->  { pageScale, clamped, boxes: [{ verseId, imagePage, x, y, w, h }] }
  app.get('/fax/boxes/*', async (req, reply) => {
    const rest = (req.params as { '*': string })['*']; // version/selector...
    const parts = rest.split('/');
    if (parts.length < 2) return reply.code(400).send({ error: 'bad path' });
    const version = parts[0]!;
    if (!(VERSION_SLUGS as readonly string[]).includes(version)) return reply.code(400).send({ error: 'unknown version' });
    const selector = parts.slice(1).join('/');

    const verseIds = selectorToVerseIds(selector);
    if (verseIds.length === 0) {
      return reply.header('cache-control', 'public, max-age=86400').send({ pageScale: 700, clamped: false, boxes: [] });
    }
    const clamped = verseIds.length > MAX_VERSE_IDS;
    const ids = clamped ? verseIds.slice(0, MAX_VERSE_IDS) : verseIds;

    const [boxes, meta] = await Promise.all([verseIdsToBoxes(version, ids), imageScanMeta(version)]);
    const out = boxes.map((b) => ({
      verseId: b.verseId,
      imagePage: b.page + meta.offset,
      x: b.x, y: b.y, w: b.w, h: b.h,
    }));
    const pageScale = boxes[0]?.pageScale ?? 700;
    return reply
      .header('cache-control', 'public, max-age=86400')
      .send({ pageScale, clamped, boxes: out });
  });
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/fax/route.test.ts -t "fax/boxes"`
Expected: PASS (3 tests). The `imagePage === 156` assertion is the §9 offset-parity check — if it fails, log the actual `imagePage` and reconcile `imageScanMeta.offset` before proceeding.

- [ ] **Step 6: Typecheck + full route suite**

Run: `cd /home/bom/BookofMormonOnline/backend && npm run typecheck && npx vitest run test/fax/route.test.ts`
Expected: clean; all route tests pass.

- [ ] **Step 7: Commit**

```bash
cd /home/bom/BookofMormonOnline && git add backend/src/media/fax/route.ts backend/test/fax/route.test.ts && git commit -m "feat(fax): /fax/boxes endpoint — passage box coords (imagePage + pageScale) as JSON"
```

---

## Task 2: Frontend — proxy `/fax/boxes`

**Files:**
- Modify: `frontend/webapp/src/setupProxy.js`

- [ ] **Step 1: Add `/fax/boxes` to the proxied paths** — in `frontend/webapp/src/setupProxy.js`, change the `API_PATHS` fax entry from:

```js
  '/fax/render', '/fax/text',       // dynamic facsimile render API (backend :5006).
```
to:
```js
  '/fax/render', '/fax/text', '/fax/boxes', // dynamic facsimile render API (backend :5006).
```

- [ ] **Step 2: Syntax check**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && node --check src/setupProxy.js && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
cd /home/bom/BookofMormonOnline && git add frontend/webapp/src/setupProxy.js && git commit -m "feat(fax): proxy /fax/boxes to the render backend"
```

---

## Task 3: Frontend — `useFaxHighlight` hook

**Files:**
- Create: `frontend/webapp/src/views/Facsimiles/useFaxHighlight.js`
- Test: `frontend/webapp/src/views/Facsimiles/__tests__/useFaxHighlight.test.js`

- [ ] **Step 1: Write the failing test**

```js
// frontend/webapp/src/views/Facsimiles/__tests__/useFaxHighlight.test.js
import { buildHighlightState } from "../useFaxHighlight";

describe("buildHighlightState", () => {
  test("groups boxes by imagePage and sorts allPages", () => {
    const data = {
      pageScale: 700,
      clamped: false,
      boxes: [
        { verseId: 1, imagePage: 156, x: 357, y: 291, w: 288, h: 152 },
        { verseId: 2, imagePage: 156, x: 357, y: 450, w: 288, h: 60 },
        { verseId: 3, imagePage: 155, x: 54, y: 100, w: 287, h: 90 },
      ],
    };
    const s = buildHighlightState(data);
    expect(s.pageScale).toBe(700);
    expect(s.allPages).toEqual([155, 156]);
    expect(s.boxesByPage.get(156)).toHaveLength(2);
    expect(s.boxesByPage.get(155)).toHaveLength(1);
  });

  test("empty / missing data yields an empty state", () => {
    const s = buildHighlightState(null);
    expect(s.allPages).toEqual([]);
    expect(s.boxesByPage.size).toBe(0);
    expect(s.pageScale).toBe(700);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/useFaxHighlight.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the hook**

```js
// frontend/webapp/src/views/Facsimiles/useFaxHighlight.js
import { useEffect, useState } from "react";
import { lookupReference } from "scripture-guide";
import { renderBaseUrl } from "src/models/BoMOnlineAPI";

const EMPTY = { boxesByPage: new Map(), pageScale: 700, allPages: [], clamped: false };

/** Pure: fetch-JSON -> grouped highlight state. */
export function buildHighlightState(data) {
  const boxesByPage = new Map();
  for (const b of (data && data.boxes) || []) {
    const arr = boxesByPage.get(b.imagePage) || [];
    arr.push(b);
    boxesByPage.set(b.imagePage, arr);
  }
  return {
    boxesByPage,
    pageScale: (data && data.pageScale) || 700,
    allPages: [...boxesByPage.keys()].sort((a, z) => a - z),
    clamped: !!(data && data.clamped),
  };
}

/**
 * Fetch passage box coordinates for a fax edition + reference and group them by
 * scan page. `ref` is the viewer's URL reference (e.g. "mosiah.4.21"); resolved
 * to verse ids via scripture-guide, then fetched as an ids/ selector.
 */
export function useFaxHighlight(version, ref) {
  const [state, setState] = useState(EMPTY);
  useEffect(() => {
    if (!version || !ref) {
      setState(EMPTY);
      return;
    }
    const verseIds = (lookupReference(ref) || {}).verse_ids || [];
    if (!verseIds.length) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    fetch(`${renderBaseUrl}/fax/boxes/${version}/ids/${verseIds.join("-")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setState(buildHighlightState(data));
      })
      .catch(() => {
        if (!cancelled) setState(EMPTY);
      });
    return () => {
      cancelled = true;
    };
  }, [version, ref]);
  return state;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/useFaxHighlight.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline && git add frontend/webapp/src/views/Facsimiles/useFaxHighlight.js frontend/webapp/src/views/Facsimiles/__tests__/useFaxHighlight.test.js && git commit -m "feat(fax): useFaxHighlight hook — fetch + group passage boxes by page"
```

---

## Task 4: Frontend — `FaxHighlightOverlay` component + styles

**Files:**
- Create: `frontend/webapp/src/views/Facsimiles/FaxHighlightOverlay.js`
- Test: `frontend/webapp/src/views/Facsimiles/__tests__/FaxHighlightOverlay.test.js`
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss`

- [ ] **Step 1: Write the failing test**

```js
// frontend/webapp/src/views/Facsimiles/__tests__/FaxHighlightOverlay.test.js
import React from "react";
import { render } from "@testing-library/react";
import FaxHighlightOverlay from "../FaxHighlightOverlay";

describe("FaxHighlightOverlay", () => {
  test("positions each box scaled by displayedWidth / pageScale", () => {
    const boxes = [{ x: 357, y: 291, w: 288, h: 152 }];
    // displayedWidth 1400, pageScale 700 -> scale 2
    const { container } = render(
      <FaxHighlightOverlay boxes={boxes} pageScale={700} displayedWidth={1400} />
    );
    const box = container.querySelector(".faxHighlightBox");
    expect(box).toBeTruthy();
    expect(box.style.left).toBe("714px");   // 357 * 2
    expect(box.style.top).toBe("582px");    // 291 * 2
    expect(box.style.width).toBe("576px");  // 288 * 2
    expect(box.style.height).toBe("304px"); // 152 * 2
  });

  test("renders nothing without boxes", () => {
    const { container } = render(
      <FaxHighlightOverlay boxes={[]} pageScale={700} displayedWidth={700} />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/FaxHighlightOverlay.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

```jsx
// frontend/webapp/src/views/Facsimiles/FaxHighlightOverlay.js
import React, { useEffect, useRef, useState } from "react";

/**
 * Absolute-positioned highlight boxes over a facsimile page image. Boxes are in
 * `pageScale`-wide coordinate space; each is scaled by displayedWidth/pageScale.
 * `displayedWidth` may be passed (desktop knows its page width) or measured from
 * the overlay's own container (mobile). Non-interactive (pointer-events: none).
 */
export default function FaxHighlightOverlay({ boxes, pageScale = 700, displayedWidth }) {
  const ref = useRef(null);
  const [measured, setMeasured] = useState(0);

  useEffect(() => {
    if (displayedWidth || !ref.current) return undefined;
    const el = ref.current;
    const update = () => setMeasured(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [displayedWidth]);

  if (!boxes || !boxes.length) return null;

  const width = displayedWidth || measured;
  const k = width > 0 ? width / pageScale : 0;

  return (
    <div ref={ref} className="faxHighlightLayer" aria-hidden="true">
      {k > 0 &&
        boxes.map((b, i) => (
          <div
            key={i}
            className="faxHighlightBox"
            style={{
              left: `${Math.round(b.x * k)}px`,
              top: `${Math.round(b.y * k)}px`,
              width: `${Math.round(b.w * k)}px`,
              height: `${Math.round(b.h * k)}px`,
            }}
          />
        ))}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/FaxHighlightOverlay.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Add styles** — append to `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss`:

```scss
/* Passage highlight overlay (DOM, not a crop image) */
.faxHighlightLayer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}
.faxHighlightBox {
  position: absolute;
  background: rgba(120, 90, 50, 0.22);
  border: 1px solid rgba(120, 90, 50, 0.5);
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15);
  animation: faxHighlightIn 0.35s ease both;
}
@keyframes faxHighlightIn {
  from { opacity: 0; transform: scale(1.06); }
  to   { opacity: 1; transform: scale(1); }
}
/* "continues" affordance */
.faxContinuesHint {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 4;
  padding: 2px 8px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6b5330;
  background: rgba(120, 90, 50, 0.12);
  border: 1px solid rgba(120, 90, 50, 0.25);
  border-radius: 999px;
  pointer-events: none;
}
.faxContinuesHint.next { right: 4px; }
.faxContinuesHint.prev { left: 4px; }
```

- [ ] **Step 6: Re-run the overlay test (scss import safe)**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/FaxHighlightOverlay.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /home/bom/BookofMormonOnline && git add frontend/webapp/src/views/Facsimiles/FaxHighlightOverlay.js frontend/webapp/src/views/Facsimiles/__tests__/FaxHighlightOverlay.test.js frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss && git commit -m "feat(fax): FaxHighlightOverlay component + styles"
```

---

## Task 5: Desktop viewer integration

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js`

- [ ] **Step 1: Import the hook + overlay** — near the top imports of `FacsimilePageViewer.js` add:

```js
import { useFaxHighlight } from "./useFaxHighlight";
import FaxHighlightOverlay from "./FaxHighlightOverlay";
```

- [ ] **Step 2: Call the hook** — inside the component, after the existing `const hasLetters = /[A-Za-z]/.test(pageNumber || '');` line, add:

```js
  const highlightRef = hasLetters ? pageNumber : null;
  const { boxesByPage, pageScale, allPages } = useFaxHighlight(item.slug, highlightRef);
```

- [ ] **Step 3: Render the overlay inside each page** — the two page containers are the `<div className="page leftPage" ...>` and `<div className="page rightPage" ...>`. For EACH, (a) add `position: 'relative'` to its inline `style` object, and (b) render the overlay just after the `renderPage(...)` call inside that div.

For the left page div, change the inner render from:
```js
            {adjustedPageIndex === 0 ? (
              <div className="blankPage"></div>
            ) : (
              renderPage(leftPage, handleSwipeRight)
            )}
```
to:
```js
            {adjustedPageIndex === 0 ? (
              <div className="blankPage"></div>
            ) : (
              <>
                {renderPage(leftPage, handleSwipeRight)}
                {leftPage && boxesByPage.get(leftPage.pageNumInt)?.length ? (
                  <FaxHighlightOverlay
                    boxes={boxesByPage.get(leftPage.pageNumInt)}
                    pageScale={pageScale}
                    displayedWidth={leftPageWidth}
                  />
                ) : null}
              </>
            )}
```
And add `position: 'relative',` to that div's `style={{ ... }}`.

For the right page div, change:
```js
            {(totalPages % 2 === 0 && adjustedPageIndex === totalPages - 2) ?
              renderPage(rightPage || null, () => {}) :
              renderPage(rightPage || null, handleSwipeLeft)
            }
```
to:
```js
            <>
              {(totalPages % 2 === 0 && adjustedPageIndex === totalPages - 2)
                ? renderPage(rightPage || null, () => {})
                : renderPage(rightPage || null, handleSwipeLeft)}
              {rightPage && boxesByPage.get(rightPage.pageNumInt)?.length ? (
                <FaxHighlightOverlay
                  boxes={boxesByPage.get(rightPage.pageNumInt)}
                  pageScale={pageScale}
                  displayedWidth={rightPageWidth}
                />
              ) : null}
            </>
```
And add `position: 'relative',` to the right page div's `style`.

- [ ] **Step 4: Add the "continues" hint** — inside the `<div className="spreadInner" ...>`, immediately after the closing of the right page `<div className="page rightPage">`, add:

```js
            {allPages.length > 0 && (() => {
              const visible = [leftPage?.pageNumInt, rightPage?.pageNumInt].filter((n) => n != null);
              const maxVisible = Math.max(...visible, -Infinity);
              const minVisible = Math.min(...visible, Infinity);
              const more = allPages.some((p) => p > maxVisible);
              const before = allPages.some((p) => p < minVisible);
              return (
                <>
                  {before && <span className="faxContinuesHint prev">◀ continues</span>}
                  {more && <span className="faxContinuesHint next">continues ▶</span>}
                </>
              );
            })()}
```

- [ ] **Step 5: Verify the app compiles (lint/build sanity)**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && node --check src/views/Facsimiles/FacsimilePageViewer.js && echo OK`
Expected: `OK`. (Note: `node --check` won't parse JSX; instead confirm via the dev-server compile in Task 7. For a static check, run the existing Facsimiles tests if any, else rely on Task 7.)

- [ ] **Step 6: Commit**

```bash
cd /home/bom/BookofMormonOnline && git add frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js && git commit -m "feat(fax): desktop viewer passage-highlight overlay + continues hint"
```

---

## Task 6: Mobile viewer integration

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewerMobile.js`

- [ ] **Step 1: Import + call the hook** — add near the top imports:

```js
import { useFaxHighlight } from "./useFaxHighlight";
import FaxHighlightOverlay from "./FaxHighlightOverlay";
```
and inside the component, after `const hasLetters = /[A-Za-z]/.test(pageNumber || '');`:
```js
  const highlightRef = hasLetters ? pageNumber : null;
  const { boxesByPage, pageScale, allPages } = useFaxHighlight(item.slug, highlightRef);
```

- [ ] **Step 2: Render the overlay on the single page** — the render structure is `<div className="pageContainer mobile"><div className="page">{renderPage(currentPage)}</div></div>`. Change the `<div className="page">` to be relative and mount the overlay (mobile has no explicit page width, so let the overlay measure itself — omit `displayedWidth`):

```js
          <div className="page" style={{ position: "relative" }}>
            {renderPage(currentPage)}
            {currentPage && boxesByPage.get(currentPage.pageNumInt)?.length ? (
              <FaxHighlightOverlay
                boxes={boxesByPage.get(currentPage.pageNumInt)}
                pageScale={pageScale}
              />
            ) : null}
            {allPages.length > 0 && currentPage && (
              <>
                {allPages.some((p) => p < currentPage.pageNumInt) && (
                  <span className="faxContinuesHint prev">◀ continues</span>
                )}
                {allPages.some((p) => p > currentPage.pageNumInt) && (
                  <span className="faxContinuesHint next">continues ▶</span>
                )}
              </>
            )}
          </div>
```
Note: the mobile overlay measures its own container width. Ensure the `.page` container is sized to the image; if the image is narrower than `.page` (letterboxing), the overlay may be offset — verify in Task 7 and, if needed, wrap `renderPage` output so the relative container hugs the image.

- [ ] **Step 3: Commit**

```bash
cd /home/bom/BookofMormonOnline && git add frontend/webapp/src/views/Facsimiles/FacsimilePageViewerMobile.js && git commit -m "feat(fax): mobile viewer passage-highlight overlay + continues hint"
```

---

## Task 7: Live verification

**Files:** none (verification only)

- [ ] **Step 1: Restart both services**

Run:
```bash
systemctl --user restart bom-greenfield bom-dev
for i in $(seq 1 40); do curl -sf -o /dev/null http://localhost:5006/health && break; sleep 1; done; echo backend-up
```

- [ ] **Step 2: Verify the boxes endpoint through the proxy chain**

Run (browser UA, via the Next front door → CRA → backend):
```bash
curl -s -A "Mozilla/5.0 Chrome/120" "http://localhost:8200/fax/boxes/2013/ids/32899" ; echo
```
Expected: JSON with `pageScale:700` and a box `{ imagePage:156, x:357, y:291, ... }`.

- [ ] **Step 3: Verify the overlay in a browser**

Open `http://10.0.0.10:8200/fax/2013/mosiah.4.21` (hard-refresh). Confirm: the viewer opens to the page showing Mosiah 4:21, and a translucent highlight box sits over verse 21 in the right column. Do the same for `http://10.0.0.10:8200/fax/1840/mosiah.4.21` (different edition/offset). Page forward/back and confirm the highlight only shows on the page(s) containing the verse, and a "continues" hint appears only when part of a multi-verse passage is off-spread (try a range ref, e.g. `mosiah.4.20-24`).

- [ ] **Step 4: Frontend regression**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/`
Expected: the new `useFaxHighlight` + `FaxHighlightOverlay` suites pass.

- [ ] **Step 5: Backend regression**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/fax/ && npm run typecheck`
Expected: all pass; typecheck clean.

---

## Out of scope (tracked)

- Notched-polygon highlights (rectangles only).
- Auto-scroll/zoom to the box within a page.
- Any change to the crop/page render image API.
