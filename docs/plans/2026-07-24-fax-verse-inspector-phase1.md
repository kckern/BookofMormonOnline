# Fax Verse Inspector — Phase 1 (Desktop Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the desktop facsimile viewer, make every indexed verse on the visible spread a hotspot that dims the page and "cuts out" the verse with a text tooltip on hover, and opens an inspector modal (cropped cutout + speaker avatar + verse text) on click — while off-verse clicks still turn the page.

**Architecture:** A new data hook (`useFaxVerses`) fetches verse boxes (chunked ≤40 ids, merged) and chapter text, producing `versesByPage`. A pure reducer (`faxVerseState`) owns hover/open UI state. `FaxVerseCutout` renders per-page transparent hotspots + an SVG-mask scrim + a tooltip; `FaxVerseModal` is the click-through inspector. The desktop viewer swaps its passive `FaxHighlightOverlay` for these. Mobile and `FaxHighlightOverlay` are untouched in Phase 1 (they migrate in Phase 2).

**Tech Stack:** React 17 (function components + hooks/`useReducer`), `scripture-guide` (`lookupReference`/`generateReference`), `@testing-library/react` + `react-scripts test` (jsdom), Sass. Backend `/fax/boxes` + GraphQL `read` via `BoMOnlineAPI`.

**Spec:** `docs/specs/2026-07-24-fax-verse-inspector.md`

**Conventions for every task:**
- Run tests from `frontend/webapp/`: `CI=true npx react-scripts test --watchAll=false <path>`.
- `jest` directly does NOT work here — it fails to parse. Use `react-scripts test`.
- Import app modules with the `src/...` absolute style already used in this codebase (e.g. `import BoMOnlineAPI, { renderBaseUrl } from "src/models/BoMOnlineAPI";`). Relative `./` imports are fine within `views/Facsimiles/`.

---

## File Structure

**Create:**
- `frontend/webapp/src/views/Facsimiles/faxVerseData.js` — pure data helpers (chunk/merge boxes, chapter refs, index read text, hydrate, union box, spread verse ids).
- `frontend/webapp/src/views/Facsimiles/faxVerseState.js` — pure UI-state reducer (hover/open; pin actions come in Phase 2).
- `frontend/webapp/src/views/Facsimiles/useFaxVerses.js` — the data hook (fetch + debounce + abort, wires the helpers).
- `frontend/webapp/src/views/Facsimiles/FaxVerseCutout.jsx` — per-page hotspots + SVG scrim/cutout + tooltip.
- `frontend/webapp/src/views/Facsimiles/FaxVerseModal.jsx` — inspector modal shell (cutout + avatar + text).
- Tests: `frontend/webapp/src/views/Facsimiles/__tests__/faxVerseData.test.js`, `faxVerseState.test.js`, `useFaxVerses.test.js`, `FaxVerseCutout.test.js`, `FaxVerseModal.test.js`.

**Modify:**
- `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js` — swap `useFaxHighlight`/`FaxHighlightOverlay` (lines 17-18, 77, 616, 634-640) for the new hook/components; add reducer + modal.
- `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss` — cutout/tooltip/modal styles.

**Do NOT touch in Phase 1:** `useFaxHighlight.js`, `FaxHighlightOverlay.js`, `__tests__/FaxHighlightOverlay.test.js`, `FacsimilePageViewerMobile.js` (mobile still uses the old overlay; migrated in Phase 2).

---

## Task 1: Data helpers (`faxVerseData.js`)

**Files:**
- Create: `frontend/webapp/src/views/Facsimiles/faxVerseData.js`
- Test: `frontend/webapp/src/views/Facsimiles/__tests__/faxVerseData.test.js`

- [ ] **Step 1: Write the failing test**

Create `__tests__/faxVerseData.test.js`:

```javascript
import {
  chunkIds, mergeBoxes, chapterRefOf, chapterRefsForVerseIds,
  indexReadByVerse, hydrateVerses, unionBox, spreadVerseIds, CHUNK_SIZE,
} from "../faxVerseData";
import { lookupReference } from "scripture-guide";

describe("faxVerseData", () => {
  test("chunkIds splits into <=40-id groups", () => {
    const ids = Array.from({ length: 41 }, (_, i) => i + 1);
    const chunks = chunkIds(ids);
    expect(CHUNK_SIZE).toBe(40);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(40);
    expect(chunks[1]).toEqual([41]);
  });

  test("mergeBoxes groups boxes by imagePage then verseId, preserving multiples", () => {
    const responses = [
      { pageScale: 700, boxes: [
        { verseId: 100, imagePage: 5, x: 1, y: 2, w: 3, h: 4 },
        { verseId: 100, imagePage: 5, x: 5, y: 6, w: 7, h: 8 }, // same verse, 2nd box
        { verseId: 101, imagePage: 5, x: 9, y: 9, w: 9, h: 9 },
      ] },
      { pageScale: 700, boxes: [
        { verseId: 100, imagePage: 6, x: 0, y: 0, w: 1, h: 1 }, // verse straddles pages
      ] },
    ];
    const { pageScale, byPageVerse } = mergeBoxes(responses);
    expect(pageScale).toBe(700);
    expect(byPageVerse.get(5).get(100)).toEqual([
      { x: 1, y: 2, w: 3, h: 4 }, { x: 5, y: 6, w: 7, h: 8 },
    ]);
    expect(byPageVerse.get(5).get(101)).toHaveLength(1);
    expect(byPageVerse.get(6).get(100)).toHaveLength(1);
  });

  test("chapterRefOf strips the verse number", () => {
    expect(chapterRefOf("Alma 5:12")).toBe("Alma 5");
    expect(chapterRefOf("1 Nephi 2:11-12")).toBe("1 Nephi 2");
    expect(chapterRefOf("")).toBeNull();
  });

  test("chapterRefsForVerseIds returns distinct chapters spanning the ids", () => {
    // pick two verse ids in different chapters via scripture-guide
    const a = lookupReference("Alma 5:1").verse_ids[0];
    const b = lookupReference("Alma 7:1").verse_ids[0];
    const refs = chapterRefsForVerseIds([a, b, a]);
    expect(refs).toEqual(["Alma 5", "Alma 7"]);
  });

  test("indexReadByVerse flattens sections/blocks/lines into a verse map", () => {
    const chapters = [
      { sections: [
        { blocks: [
          { person_slug: "nephi-son-of-lehi", voice: "nephi", lines: [
            { verse_id: 100, text: "And it came to pass" },
          ] },
          { person_slug: null, voice: "narrator", lines: [
            { verse_id: 101, text: "that I, Nephi" },
          ] },
        ] },
      ] },
    ];
    const map = indexReadByVerse(chapters);
    expect(map.get(100)).toMatchObject({ text: "And it came to pass", person_slug: "nephi-son-of-lehi", voice: "nephi" });
    expect(typeof map.get(100).ref).toBe("string");
    expect(map.get(101).voice).toBe("narrator");
  });

  test("hydrateVerses merges boxes + text, sorted by verse_id", () => {
    const byPageVerse = new Map([[5, new Map([
      [101, [{ x: 9, y: 9, w: 9, h: 9 }]],
      [100, [{ x: 1, y: 2, w: 3, h: 4 }]],
    ])]]);
    const textByVerse = new Map([[100, { text: "t100", person_slug: "p", voice: "v", ref: "Alma 5:1" }]]);
    const out = hydrateVerses(byPageVerse, textByVerse);
    const verses = out.get(5);
    expect(verses.map((v) => v.verse_id)).toEqual([100, 101]); // sorted
    expect(verses[0]).toMatchObject({ verse_id: 100, text: "t100", ref: "Alma 5:1" });
    expect(verses[1].text).toBeUndefined();      // no text row
    expect(typeof verses[1].ref).toBe("string"); // ref still derived
  });

  test("unionBox returns the bounding rect of all boxes", () => {
    expect(unionBox([{ x: 10, y: 20, w: 5, h: 5 }, { x: 0, y: 0, w: 4, h: 4 }]))
      .toEqual({ x: 0, y: 0, w: 15, h: 25 });
    expect(unionBox([])).toBeNull();
  });

  test("spreadVerseIds unions both leaves' verse ids, sorted+unique", () => {
    const left = { pageReference: "Alma 5:1-3" };
    const right = { pageReference: "Alma 5:3-5" }; // overlaps verse 3
    const ids = spreadVerseIds(left, right);
    const expected = [...new Set([
      ...lookupReference("Alma 5:1-3").verse_ids,
      ...lookupReference("Alma 5:3-5").verse_ids,
    ])].sort((a, z) => a - z);
    expect(ids).toEqual(expected);
    expect(spreadVerseIds(null, null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxVerseData.test.js`
Expected: FAIL — `Cannot find module '../faxVerseData'`.

- [ ] **Step 3: Write the implementation**

Create `faxVerseData.js`:

```javascript
import { generateReference, lookupReference } from "scripture-guide";

// Backend caps /fax/boxes at 40 ids per request (MAX_VERSE_IDS in
// backend/src/media/fax/route.ts) and SILENTLY slices the overflow. Chunk to
// this size and merge client-side.
export const CHUNK_SIZE = 40;

export function chunkIds(ids, size = CHUNK_SIZE) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/**
 * Merge one-or-more /fax/boxes responses into boxes grouped by scan page then
 * verse. A verse has 1+ boxes (multi-line/column); a verse straddling a page
 * break appears under two imagePage keys.
 * @returns { pageScale, byPageVerse: Map<imagePage, Map<verseId, Array<{x,y,w,h}>>> }
 */
export function mergeBoxes(responses) {
  const byPageVerse = new Map();
  let pageScale = 700;
  for (const res of responses || []) {
    if (res && res.pageScale) pageScale = res.pageScale;
    for (const b of (res && res.boxes) || []) {
      const page = byPageVerse.get(b.imagePage) || new Map();
      const arr = page.get(b.verseId) || [];
      arr.push({ x: b.x, y: b.y, w: b.w, h: b.h });
      page.set(b.verseId, arr);
      byPageVerse.set(b.imagePage, page);
    }
  }
  return { pageScale, byPageVerse };
}

/** "Alma 5:12" / "1 Nephi 2:11-12" -> "Alma 5" / "1 Nephi 2". */
export function chapterRefOf(ref) {
  return (/^(.+?\s+\d+)(?::|\s*$)/.exec(ref || "")?.[1]) || null;
}

/** verse ids -> distinct chapter refs covering them, in first-seen order. */
export function chapterRefsForVerseIds(verseIds) {
  const seen = new Set();
  const out = [];
  for (const id of verseIds || []) {
    const ch = chapterRefOf(generateReference([id]));
    if (ch && !seen.has(ch)) { seen.add(ch); out.push(ch); }
  }
  return out;
}

/** read() chapter payloads -> Map<verse_id, { text, person_slug, voice, ref }>. */
export function indexReadByVerse(chapters) {
  const map = new Map();
  for (const chapter of chapters || []) {
    for (const section of (chapter && chapter.sections) || []) {
      for (const block of (section && section.blocks) || []) {
        for (const line of (block && block.lines) || []) {
          if (!line || line.verse_id == null) continue;
          map.set(line.verse_id, {
            text: line.text,
            person_slug: block.person_slug,
            voice: block.voice,
            ref: generateReference([line.verse_id]),
          });
        }
      }
    }
  }
  return map;
}

/** boxes + text -> Map<imagePage, Array<verse object>>, verses sorted by verse_id. */
export function hydrateVerses(byPageVerse, textByVerse) {
  const out = new Map();
  for (const [page, verseMap] of byPageVerse) {
    const verses = [];
    for (const [verse_id, boxes] of verseMap) {
      const t = (textByVerse && textByVerse.get(verse_id)) || {};
      verses.push({
        verse_id,
        ref: t.ref || generateReference([verse_id]),
        boxes,
        text: t.text,
        person_slug: t.person_slug,
        voice: t.voice,
      });
    }
    verses.sort((a, z) => a.verse_id - z.verse_id);
    out.set(page, verses);
  }
  return out;
}

/** Bounding rect of a list of boxes (or null). */
export function unionBox(boxes) {
  if (!boxes || !boxes.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** left/right leaf objects -> sorted, unique verse-id union for the spread. */
export function spreadVerseIds(leftLeaf, rightLeaf) {
  const ids = new Set();
  for (const leaf of [leftLeaf, rightLeaf]) {
    const ref = leaf && leaf.pageReference;
    if (!ref) continue;
    for (const id of (lookupReference(ref) || {}).verse_ids || []) ids.add(id);
  }
  return [...ids].sort((a, z) => a - z);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxVerseData.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/faxVerseData.js frontend/webapp/src/views/Facsimiles/__tests__/faxVerseData.test.js
git commit -m "feat(fax): verse-inspector data helpers (chunk/merge boxes, chapter text index)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: UI-state reducer (`faxVerseState.js`)

**Files:**
- Create: `frontend/webapp/src/views/Facsimiles/faxVerseState.js`
- Test: `frontend/webapp/src/views/Facsimiles/__tests__/faxVerseState.test.js`

- [ ] **Step 1: Write the failing test**

Create `__tests__/faxVerseState.test.js`:

```javascript
import { faxVerseReducer, initialFaxVerseState } from "../faxVerseState";

const verse = { verse_id: 100, ref: "Alma 5:1", boxes: [], text: "t" };

describe("faxVerseReducer", () => {
  test("HOVER sets the active verse from the hover source", () => {
    const s = faxVerseReducer(initialFaxVerseState, { type: "HOVER", verseId: 100 });
    expect(s).toMatchObject({ activeVerseId: 100, source: "hover" });
  });

  test("LEAVE clears a hover-sourced active verse", () => {
    const hovered = { ...initialFaxVerseState, activeVerseId: 100, source: "hover" };
    expect(faxVerseReducer(hovered, { type: "LEAVE" }))
      .toMatchObject({ activeVerseId: null, source: null });
  });

  test("LEAVE does not clear a non-hover source (forward-compat with pin)", () => {
    const pinned = { ...initialFaxVerseState, activeVerseId: 100, source: "pinned" };
    expect(faxVerseReducer(pinned, { type: "LEAVE" })).toBe(pinned);
  });

  test("OPEN stores the opened verse; CLOSE clears it", () => {
    const opened = faxVerseReducer(initialFaxVerseState, { type: "OPEN", verse });
    expect(opened.openVerse).toBe(verse);
    expect(faxVerseReducer(opened, { type: "CLOSE" }).openVerse).toBeNull();
  });

  test("RESET returns the initial state", () => {
    const dirty = { activeVerseId: 100, source: "hover", openVerse: verse };
    expect(faxVerseReducer(dirty, { type: "RESET" })).toEqual(initialFaxVerseState);
  });

  test("unknown action is a no-op", () => {
    expect(faxVerseReducer(initialFaxVerseState, { type: "NOPE" })).toBe(initialFaxVerseState);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxVerseState.test.js`
Expected: FAIL — `Cannot find module '../faxVerseState'`.

- [ ] **Step 3: Write the implementation**

Create `faxVerseState.js`:

```javascript
// Pure UI-state for the fax verse inspector. Phase 1 handles hover + open.
// Phase 2 will add PIN / ENGAGE / UNLOCK / SPREAD_CHANGE for deep-link pins;
// `source` is kept now so those transitions slot in without a reshape.
export const initialFaxVerseState = { activeVerseId: null, source: null, openVerse: null };

export function faxVerseReducer(state, action) {
  switch (action.type) {
    case "HOVER":
      return { ...state, activeVerseId: action.verseId, source: "hover" };
    case "LEAVE":
      if (state.source !== "hover") return state; // only hover clears on leave
      return { ...state, activeVerseId: null, source: null };
    case "OPEN":
      return { ...state, openVerse: action.verse };
    case "CLOSE":
      return { ...state, openVerse: null };
    case "RESET":
      return initialFaxVerseState;
    default:
      return state;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/faxVerseState.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/faxVerseState.js frontend/webapp/src/views/Facsimiles/__tests__/faxVerseState.test.js
git commit -m "feat(fax): verse-inspector UI-state reducer (hover/open)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Data hook (`useFaxVerses.js`)

**Files:**
- Create: `frontend/webapp/src/views/Facsimiles/useFaxVerses.js`
- Test: `frontend/webapp/src/views/Facsimiles/__tests__/useFaxVerses.test.js`

- [ ] **Step 1: Write the failing test**

Create `__tests__/useFaxVerses.test.js`. It mocks `BoMOnlineAPI` + `global.fetch`, renders a probe component, and asserts the boxes fetch is chunked and the state hydrates:

```javascript
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { lookupReference } from "scripture-guide";
import { useFaxVerses } from "../useFaxVerses";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({ read: { "Alma 5": { sections: [] } } })),
  renderBaseUrl: "",
}));

function Probe({ left, right }) {
  const { versesByPage, pageScale } = useFaxVerses("1830", left, right);
  const verses = versesByPage.get(10) || [];
  return <div data-testid="out">{`scale=${pageScale};page10=${verses.length}`}</div>;
}

describe("useFaxVerses", () => {
  afterEach(() => { jest.clearAllMocks(); delete global.fetch; });

  test("chunks >40 ids into multiple /fax/boxes calls and hydrates versesByPage", async () => {
    const firstId = lookupReference("Alma 5:1").verse_ids[0];
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        pageScale: 700,
        boxes: [{ verseId: firstId, imagePage: 10, x: 1, y: 2, w: 3, h: 4 }],
      }),
    }));

    // "Alma 5:1-41" is 41 verses -> 2 chunks of <=40.
    render(<Probe left={{ pageReference: "Alma 5:1-41" }} right={null} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    const urls = global.fetch.mock.calls.map((c) => c[0]);
    expect(urls[0]).toContain("/fax/boxes/1830/ids/");
    await waitFor(() => expect(screen.getByTestId("out").textContent).toBe("scale=700;page10=1"));
  });

  test("no version or no ids -> empty state, no fetch", async () => {
    global.fetch = jest.fn();
    render(<Probe left={null} right={null} />);
    await waitFor(() => expect(screen.getByTestId("out").textContent).toBe("scale=700;page10=0"));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/useFaxVerses.test.js`
Expected: FAIL — `Cannot find module '../useFaxVerses'`.

- [ ] **Step 3: Write the implementation**

Create `useFaxVerses.js`:

```javascript
import { useEffect, useState } from "react";
import BoMOnlineAPI, { renderBaseUrl } from "src/models/BoMOnlineAPI";
import {
  chunkIds, mergeBoxes, chapterRefsForVerseIds, indexReadByVerse,
  hydrateVerses, spreadVerseIds,
} from "./faxVerseData";

const EMPTY = { versesByPage: new Map(), pageScale: 700 };
// Wait for the spread to settle after a turn before hydrating, so riffling
// doesn't queue a fetch per intermediate spread.
const SETTLE_MS = 150;

/**
 * Verse boxes + text for the visible spread, grouped by scan page.
 * @returns { versesByPage: Map<imagePage, Array<verse>>, pageScale }
 */
export function useFaxVerses(version, leftLeaf, rightLeaf) {
  const [state, setState] = useState(EMPTY);
  const ids = spreadVerseIds(leftLeaf, rightLeaf);
  // Effect identity: refetch only when version or the id set changes.
  const key = version ? `${version}:${ids.join("-")}` : "";

  useEffect(() => {
    if (!version || ids.length === 0) { setState(EMPTY); return undefined; }
    let cancelled = false;
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const boxResponses = await Promise.all(
          chunkIds(ids).map((chunk) =>
            fetch(`${renderBaseUrl}/fax/boxes/${version}/ids/${chunk.join("-")}`, { signal: ac.signal })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null))
        );
        const { pageScale, byPageVerse } = mergeBoxes(boxResponses.filter(Boolean));
        const chapters = await Promise.all(
          chapterRefsForVerseIds(ids).map((ch) =>
            BoMOnlineAPI({ read: [ch] }, { useCache: false })
              .then((r) => (r && r.read && r.read[ch]) || null)
              .catch(() => null))
        );
        const textByVerse = indexReadByVerse(chapters.filter(Boolean));
        if (!cancelled) setState({ pageScale, versesByPage: hydrateVerses(byPageVerse, textByVerse) });
      } catch {
        if (!cancelled) setState(EMPTY);
      }
    }, SETTLE_MS);
    return () => { cancelled = true; ac.abort(); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/useFaxVerses.test.js`
Expected: PASS (2 tests). (The `AbortController` and `fetch` are provided by jsdom/node in the test env; the mock replaces `fetch`.)

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/useFaxVerses.js frontend/webapp/src/views/Facsimiles/__tests__/useFaxVerses.test.js
git commit -m "feat(fax): useFaxVerses hook (chunked boxes + chapter text, debounced+aborted)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Cutout + tooltip layer (`FaxVerseCutout.jsx`)

**Files:**
- Create: `frontend/webapp/src/views/Facsimiles/FaxVerseCutout.jsx`
- Test: `frontend/webapp/src/views/Facsimiles/__tests__/FaxVerseCutout.test.js`
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss` (add styles)

- [ ] **Step 1: Write the failing test**

Create `__tests__/FaxVerseCutout.test.js`:

```javascript
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import FaxVerseCutout from "../FaxVerseCutout";

const verses = [
  { verse_id: 100, ref: "Alma 5:1", text: "verse one hundred", boxes: [{ x: 350, y: 100, w: 100, h: 50 }] },
  { verse_id: 101, ref: "Alma 5:2", text: "verse one oh one", boxes: [{ x: 350, y: 200, w: 100, h: 50 }, { x: 460, y: 200, w: 40, h: 50 }] },
];

function setup(props) {
  return render(
    <FaxVerseCutout
      verses={verses}
      pageScale={700}
      displayedWidth={1400}   // scale 2
      idSuffix={5}
      activeVerseId={props.activeVerseId ?? null}
      onHover={props.onHover || (() => {})}
      onLeave={props.onLeave || (() => {})}
      onOpen={props.onOpen || (() => {})}
      hoverIntentMs={0}
    />
  );
}

describe("FaxVerseCutout", () => {
  test("renders one hotspot per box, scaled by displayedWidth/pageScale", () => {
    const { container } = setup({});
    const spots = container.querySelectorAll(".faxHotspot");
    expect(spots).toHaveLength(3);              // 1 + 2 boxes
    expect(spots[0].style.left).toBe("700px");  // 350 * 2
    expect(spots[0].style.width).toBe("200px"); // 100 * 2
  });

  test("hover fires onHover after intent; leave fires onLeave", () => {
    const onHover = jest.fn(), onLeave = jest.fn();
    const { container } = setup({ onHover, onLeave });
    const spot = container.querySelector(".faxHotspot");
    act(() => { fireEvent.mouseEnter(spot); });
    expect(onHover).toHaveBeenCalledWith(100);
    fireEvent.mouseLeave(spot);
    expect(onLeave).toHaveBeenCalled();
  });

  test("click fires onOpen and stops propagation (so the page does not turn)", () => {
    const onOpen = jest.fn();
    const pageTurn = jest.fn();
    const { container } = render(
      <div onClick={pageTurn}>
        <FaxVerseCutout verses={verses} pageScale={700} displayedWidth={1400} idSuffix={5}
          activeVerseId={null} onHover={() => {}} onLeave={() => {}} onOpen={onOpen} hoverIntentMs={0} />
      </div>
    );
    fireEvent.click(container.querySelector(".faxHotspot"));
    expect(onOpen).toHaveBeenCalledWith(verses[0]);
    expect(pageTurn).not.toHaveBeenCalled(); // stopPropagation worked
  });

  test("active verse renders the scrim mask (one punch per box) and tooltip text", () => {
    const { container } = setup({ activeVerseId: 101 });
    // verse 101 has 2 boxes -> 2 mask punch-outs
    expect(container.querySelectorAll(".faxCutoutSvg mask rect.punch")).toHaveLength(2);
    expect(screen.getByText("verse one oh one")).toBeTruthy();
    expect(screen.getByText("Alma 5:2")).toBeTruthy();
  });

  test("no active verse -> no scrim, no tooltip", () => {
    const { container } = setup({ activeVerseId: null });
    expect(container.querySelector(".faxCutoutSvg")).toBeNull();
    expect(container.querySelector(".faxVerseTooltip")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/FaxVerseCutout.test.js`
Expected: FAIL — `Cannot find module '../FaxVerseCutout'`.

- [ ] **Step 3: Write the implementation**

Create `FaxVerseCutout.jsx`:

```javascript
import React, { useRef } from "react";
import { unionBox } from "./faxVerseData";

/**
 * Per-page interactive verse layer: transparent hotspots (one per box), an SVG
 * scrim that dims the page and cuts out the active verse, and a text tooltip
 * above the cutout. The layer is pointer-events:none EXCEPT the hotspots, so an
 * off-verse click falls through to the page image's turn handler beneath.
 *
 * Coords are in `pageScale`-wide space; scaled by k = displayedWidth / pageScale
 * (same convention as the legacy FaxHighlightOverlay).
 */
export default function FaxVerseCutout({
  verses = [],
  pageScale = 700,
  displayedWidth = 0,
  activeVerseId = null,
  idSuffix = 0,
  onHover,
  onLeave,
  onOpen,
  hoverIntentMs = 100,
}) {
  const intentRef = useRef(null);
  const k = displayedWidth > 0 ? displayedWidth / pageScale : 0;
  if (k <= 0 || !verses.length) return null;

  const px = (v) => `${Math.round(v * k)}px`;
  const active = verses.find((v) => v.verse_id === activeVerseId) || null;
  const maskId = `faxCut-${idSuffix}`;

  const enter = (v) => {
    if (intentRef.current) clearTimeout(intentRef.current);
    intentRef.current = setTimeout(() => onHover && onHover(v.verse_id), hoverIntentMs);
  };
  const leave = () => {
    if (intentRef.current) { clearTimeout(intentRef.current); intentRef.current = null; }
    onLeave && onLeave();
  };
  const open = (e, v) => {
    e.stopPropagation();               // don't bubble to the page-turn onClick
    if (intentRef.current) { clearTimeout(intentRef.current); intentRef.current = null; }
    onOpen && onOpen(v);
  };

  // Whole-page dimensions in px (page is `pageScale` wide; height unknown here,
  // so the SVG stretches to the layer via 100%/viewBox-free absolute rects).
  const W = displayedWidth;
  const tip = active ? unionBox(active.boxes) : null;

  return (
    <div className="faxVerseLayer" aria-hidden="false">
      {active && (
        <svg className="faxCutoutSvg" width={W} height="100%" preserveAspectRatio="none">
          <defs>
            <mask id={maskId}>
              <rect x="0" y="0" width={W} height="100%" fill="white" />
              {active.boxes.map((b, i) => (
                <rect key={i} className="punch" x={b.x * k} y={b.y * k}
                  width={b.w * k} height={b.h * k} rx="4" fill="black" />
              ))}
            </mask>
          </defs>
          <rect x="0" y="0" width={W} height="100%" fill="rgba(0,0,0,0.55)" mask={`url(#${maskId})`} />
          {active.boxes.map((b, i) => (
            <rect key={i} className="faxCutoutRing" x={b.x * k} y={b.y * k}
              width={b.w * k} height={b.h * k} rx="4" />
          ))}
        </svg>
      )}

      <div className="faxVerseHotspots">
        {verses.flatMap((v) =>
          v.boxes.map((b, i) => (
            <button
              key={`${v.verse_id}-${i}`}
              type="button"
              className="faxHotspot"
              aria-label={v.ref}
              style={{ left: px(b.x), top: px(b.y), width: px(b.w), height: px(b.h) }}
              onMouseEnter={() => enter(v)}
              onMouseLeave={leave}
              onClick={(e) => open(e, v)}
            />
          ))
        )}
      </div>

      {active && active.text && tip && (
        <div
          className="faxVerseTooltip"
          style={{ left: px(tip.x + tip.w / 2), top: px(tip.y) }}
        >
          <div className="faxVerseTooltip-ref">{active.ref}</div>
          <div className="faxVerseTooltip-text">{active.text}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/FaxVerseCutout.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Add the styles**

In `FacsimilePageViewer.scss`, directly AFTER the existing `.faxHighlightBox`/`@keyframes faxHighlightIn` block (near line 723), add:

```scss
/* Interactive verse inspector layer (Phase 1) */
.faxVerseLayer {
  position: absolute;
  inset: 0;
  pointer-events: none; /* hotspots re-enable themselves; off-verse clicks fall through */
  z-index: 3;
}
.faxCutoutSvg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  animation: faxCutoutIn 0.18s ease both;
}
@keyframes faxCutoutIn { from { opacity: 0; } to { opacity: 1; } }
.faxCutoutRing {
  fill: none;
  stroke: rgba(255, 255, 255, 0.85);
  stroke-width: 2;
}
.faxVerseHotspots { position: absolute; inset: 0; pointer-events: none; }
.faxHotspot {
  position: absolute;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
  border-radius: 3px;
  &:hover { background: rgba(120, 90, 50, 0.12); }
  &:focus-visible { outline: 2px solid rgba(120, 90, 50, 0.7); }
}
.faxVerseTooltip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 10px));
  max-width: 320px;
  padding: 0.5rem 0.7rem;
  background: #1c1b18;
  color: #f4efe6;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  z-index: 5;
  animation: faxCutoutIn 0.18s ease both;
  &::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -6px;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: #1c1b18;
    border-bottom: 0;
  }
  .faxVerseTooltip-ref { font-size: 0.7rem; font-weight: 700; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.04em; }
  .faxVerseTooltip-text { font-size: 0.9rem; line-height: 1.35; margin-top: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .faxCutoutSvg, .faxVerseTooltip { animation: none; }
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/FaxVerseCutout.jsx frontend/webapp/src/views/Facsimiles/__tests__/FaxVerseCutout.test.js frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss
git commit -m "feat(fax): FaxVerseCutout — hotspots + SVG-mask scrim + tooltip

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Inspector modal (`FaxVerseModal.jsx`)

**Files:**
- Create: `frontend/webapp/src/views/Facsimiles/FaxVerseModal.jsx`
- Test: `frontend/webapp/src/views/Facsimiles/__tests__/FaxVerseModal.test.js`
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss` (add modal styles)

- [ ] **Step 1: Write the failing test**

Create `__tests__/FaxVerseModal.test.js`:

```javascript
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import FaxVerseModal from "../FaxVerseModal";

const verse = {
  verse_id: 100, ref: "Alma 5:1", text: "verse text here",
  person_slug: "alma-the-younger", voice: "alma",
  boxes: [{ x: 100, y: 200, w: 300, h: 80 }],
  pageAssetUrl: "https://media.example/fax/pages/1830/010.jpg",
};

describe("FaxVerseModal", () => {
  test("renders nothing when verse is null", () => {
    const { container } = render(<FaxVerseModal verse={null} pageScale={700} onClose={() => {}} />);
    expect(container.querySelector(".faxVerseModal")).toBeNull();
  });

  test("renders reference, verse text, and speaker avatar", () => {
    render(<FaxVerseModal verse={verse} pageScale={700} onClose={() => {}} />);
    expect(screen.getByText("Alma 5:1")).toBeTruthy();
    expect(screen.getByText("verse text here")).toBeTruthy();
    const avatar = document.querySelector(".faxVerseModal-avatar");
    expect(avatar.getAttribute("src")).toContain("/people/alma-the-younger");
  });

  test("cutout image points at the page asset", () => {
    render(<FaxVerseModal verse={verse} pageScale={700} onClose={() => {}} />);
    const img = document.querySelector(".faxVerseModal-cutout img");
    expect(img.getAttribute("src")).toBe(verse.pageAssetUrl);
  });

  test("backdrop click and Escape both call onClose", () => {
    const onClose = jest.fn();
    render(<FaxVerseModal verse={verse} pageScale={700} onClose={onClose} />);
    fireEvent.click(document.querySelector(".faxVerseModal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/FaxVerseModal.test.js`
Expected: FAIL — `Cannot find module '../FaxVerseModal'`.

- [ ] **Step 3: Write the implementation**

Create `FaxVerseModal.jsx`:

```javascript
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { unionBox } from "./faxVerseData";

// Desired on-screen width of the verse cutout in the modal (px).
const CUTOUT_TARGET_W = 560;

/**
 * Inspector modal for a single verse: a cropped cutout of the page around the
 * verse, the speaker/voice avatar, and the verse text.
 *
 * Phase 1 is a static crop. Phase 3 swaps the cutout for a pan-zoom viewport and
 * adds cross-edition compare.
 *
 * Esc is handled window-capture with stopImmediatePropagation so it neither
 * turns a page nor exits the viewer to the grid (mirrors ScripturePopup).
 */
export default function FaxVerseModal({ verse, pageScale = 700, onClose }) {
  useEffect(() => {
    if (!verse) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" || e.keyCode === 27) {
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        e.preventDefault();
        onClose && onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [verse, onClose]);

  if (!verse) return null;

  const box = unionBox(verse.boxes) || { x: 0, y: 0, w: pageScale, h: pageScale };
  const s = CUTOUT_TARGET_W / box.w;            // scale so the verse box is ~target px wide
  const cropW = box.w * s;
  const cropH = box.h * s;

  const node = (
    <div className="faxVerseModal" role="dialog" aria-modal="true" aria-label={verse.ref}>
      <div className="faxVerseModal-backdrop" onClick={() => onClose && onClose()} />
      <div className="faxVerseModal-card">
        <button type="button" className="faxVerseModal-close" aria-label="Close" onClick={() => onClose && onClose()}>×</button>

        <div className="faxVerseModal-header">
          {verse.person_slug && (
            <img
              className="faxVerseModal-avatar"
              src={`${assetUrl}/people/${verse.person_slug}`}
              alt=""
              onError={(e) => { e.target.style.visibility = "hidden"; }}
            />
          )}
          <div className="faxVerseModal-heading">
            <div className="faxVerseModal-ref">{verse.ref}</div>
            {verse.voice && <div className="faxVerseModal-voice">{label(verse.voice)}</div>}
          </div>
        </div>

        <div className="faxVerseModal-cutout" style={{ width: cropW, height: cropH }}>
          {verse.pageAssetUrl && (
            <img
              src={verse.pageAssetUrl}
              alt=""
              style={{
                position: "absolute",
                width: pageScale * s,
                maxWidth: "none",
                left: -box.x * s,
                top: -box.y * s,
              }}
            />
          )}
        </div>

        {verse.text && <p className="faxVerseModal-text">{verse.text}</p>}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/FaxVerseModal.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the styles**

In `FacsimilePageViewer.scss`, after the tooltip block from Task 4, add:

```scss
/* Verse inspector modal (Phase 1) */
.faxVerseModal {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.faxVerseModal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}
.faxVerseModal-card {
  position: relative;
  z-index: 1;
  max-width: min(680px, 92vw);
  max-height: 88vh;
  overflow: auto;
  background: #fbf8f1;
  color: #1c1b18;
  border-radius: 12px;
  padding: 1.1rem 1.2rem 1.3rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
.faxVerseModal-close {
  position: absolute;
  top: 0.4rem;
  right: 0.6rem;
  border: 0;
  background: transparent;
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
  color: #6b5330;
}
.faxVerseModal-header { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.8rem; }
.faxVerseModal-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
.faxVerseModal-ref { font-weight: 700; font-size: 1.05rem; }
.faxVerseModal-voice { font-size: 0.8rem; opacity: 0.75; }
.faxVerseModal-cutout {
  position: relative;
  overflow: hidden;
  border-radius: 6px;
  background: #efe9dc;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
  margin: 0 auto;
}
.faxVerseModal-text { margin: 0.9rem 0 0; font-size: 1rem; line-height: 1.5; }
```

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/FaxVerseModal.jsx frontend/webapp/src/views/Facsimiles/__tests__/FaxVerseModal.test.js frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.scss
git commit -m "feat(fax): FaxVerseModal — cropped cutout + speaker avatar + verse text

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Wire the inspector into the desktop viewer

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js`

This task has no new unit test (it's integration wiring); it is verified by the existing Facsimiles suite still passing and the Playwright check in Task 7.

- [ ] **Step 1: Swap imports**

Replace lines 17-18:

```javascript
import { useFaxHighlight } from "./useFaxHighlight";
import FaxHighlightOverlay from "./FaxHighlightOverlay";
```

with:

```javascript
import { useFaxVerses } from "./useFaxVerses";
import FaxVerseCutout from "./FaxVerseCutout";
import FaxVerseModal from "./FaxVerseModal";
import { faxVerseReducer, initialFaxVerseState } from "./faxVerseState";
```

Also ensure `useReducer` is imported from React. Find the top `import React, { ... } from "react";` line and add `useReducer` to the destructured hooks if not already present.

- [ ] **Step 2: Swap the hook + add reducer state**

Replace line 77:

```javascript
  const highlight = useFaxHighlight(item.slug, refParam);
```

with:

```javascript
  const faxVerses = useFaxVerses(item.slug, leftPage, rightPage);
  const [vstate, vdispatch] = useReducer(faxVerseReducer, initialFaxVerseState);
  // Clear hover/open on any spread or edition change (also covers page-flip).
  useEffect(() => { vdispatch({ type: "RESET" }); }, [adjustedPageIndex, item.slug]);
```

> Note: `leftPage`/`rightPage`/`adjustedPageIndex` are already defined above this line in the component. If `leftPage`/`rightPage` are defined *below* line 77, move this `useFaxVerses` call to just after they are defined (search for `const leftPage =` / `const rightPage =`).

- [ ] **Step 3: Replace the per-page overlay in `renderPage`**

Replace line 616:

```javascript
    const boxes = highlight.boxesByPage.get(page.pageNumInt);
```

with:

```javascript
    const pageVerses = faxVerses.versesByPage.get(page.pageNumInt) || [];
```

Replace the overlay block (lines 634-640):

```javascript
        {boxes && boxes.length > 0 && (
          <FaxHighlightOverlay
            boxes={boxes}
            pageScale={highlight.pageScale}
            displayedWidth={isLeft ? leftPageWidth : rightPageWidth}
          />
        )}
```

with:

```javascript
        {pageVerses.length > 0 && (
          <FaxVerseCutout
            verses={pageVerses}
            pageScale={faxVerses.pageScale}
            displayedWidth={isLeft ? leftPageWidth : rightPageWidth}
            idSuffix={page.pageNumInt}
            activeVerseId={vstate.activeVerseId}
            onHover={(id) => vdispatch({ type: "HOVER", verseId: id })}
            onLeave={() => vdispatch({ type: "LEAVE" })}
            onOpen={(verse) => vdispatch({ type: "OPEN", verse: { ...verse, pageAssetUrl: page.pageAssetUrl } })}
          />
        )}
```

- [ ] **Step 4: Render the modal**

Find the `{flip && (<FaxPageFlip ... />)}` block (around line 758). Immediately AFTER its closing `)}`, add:

```javascript
            <FaxVerseModal
              verse={vstate.openVerse}
              pageScale={faxVerses.pageScale}
              onClose={() => vdispatch({ type: "CLOSE" })}
            />
```

- [ ] **Step 5: Verify the whole Facsimiles suite still passes**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles`
Expected: PASS — all prior Facsimiles tests (21) plus the new suites from Tasks 1-5. No references to `useFaxHighlight`/`FaxHighlightOverlay` remain in `FacsimilePageViewer.js` (grep to confirm):

Run: `grep -n "useFaxHighlight\|FaxHighlightOverlay\|highlight\." src/views/Facsimiles/FacsimilePageViewer.js`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/FacsimilePageViewer.js
git commit -m "feat(fax): wire verse inspector into desktop viewer (hover cutout + click modal)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Manual + Playwright verification

**Files:** none (verification only).

- [ ] **Step 1: Confirm the dev bundle compiled**

Run: `journalctl --user -u bom-dev --since "60 seconds ago" --no-pager | grep -iE "Compiled|ERROR in"`
Expected: `Compiled with warnings.` (only the pre-existing node_modules source-map warnings), no `ERROR in`.

- [ ] **Step 2: Verify on an INDEXED edition (localhost:8200, never bom.kckern.net — CDN cached)**

Open an indexed edition spread, e.g. `http://localhost:8200/fax/1830/213` (or any 1830 content page). With Playwright or by hand, confirm:
- Hovering a line dims the rest of the page and cuts out the hovered verse with a tooltip showing the verse reference + text.
- Clicking a verse opens the modal with the speaker avatar, reference, cropped cutout, and verse text.
- Clicking OFF a verse (in the margin / between text blocks) still turns the page.
- Esc closes the modal and does NOT exit to the grid.

Playwright snippet (run against localhost:8200):

```javascript
await page.goto("http://localhost:8200/fax/1830/213");
await page.waitForSelector(".faxHotspot", { timeout: 8000 });
await page.hover(".faxHotspot");
await page.waitForSelector(".faxVerseTooltip");
await page.click(".faxHotspot");
await page.waitForSelector(".faxVerseModal-card");
await page.screenshot({ path: "/tmp/fax-verse-modal.png" });
```

- [ ] **Step 3: Verify a NON-indexed edition is unaffected**

Open a renderable edition with no boxes and confirm no hotspots/scrim render and page-turning is unchanged (`.faxHotspot` count is 0).

- [ ] **Step 4: Final regression run**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles`
Expected: all green.

- [ ] **Step 5: Commit any verification fixes** (only if Steps 2-3 surfaced issues; otherwise skip)

```bash
git add -A
git commit -m "fix(fax): verse inspector verification fixes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (completed by plan author)

**Spec coverage (Phase 1 rows only):**
- Hotspots for every verse on the spread → Task 1 (`spreadVerseIds`, chunked boxes) + Task 4 (hotspots). ✓
- Hover cutout + tooltip → Task 4 (SVG mask + tooltip). ✓
- Click → modal with avatar + text + cropped cutout → Task 5. ✓
- Off-verse click still turns → Task 4 (`stopPropagation` + pointer-events:none layer) + Task 6 (preserved `onClick`). ✓
- Chunked ≤40-id fetches merged; per-verse box arrays; keyed off response `verseId`/`imagePage`; chapter-based text; debounce+abort → Tasks 1 & 3. ✓
- Multi-box / straddling verse → Task 1 `mergeBoxes` test + Task 4 multi-punch mask. ✓
- Deferred to later phases (NOT in this plan): deep-link pin, mobile, pan-zoom, cross-edition compare, spotlight-travel tween. ✓ (spec §"Phased delivery")

**Placeholder scan:** No TBD/TODO; every code step shows full code; every test step shows assertions. ✓

**Type/name consistency:** `versesByPage`, `pageScale`, verse object `{verse_id, ref, boxes, text, person_slug, voice}`, reducer actions `HOVER/LEAVE/OPEN/CLOSE/RESET`, and props (`onHover/onLeave/onOpen`, `activeVerseId`, `idSuffix`, `displayedWidth`, `pageScale`) are identical across Tasks 1-6. Modal consumes `verse.pageAssetUrl` which Task 6 injects on `OPEN`. ✓
