# FaxVerseModal cross-page crop height Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the verse-inspector crop box reserve the full stacked crop height for cross-page/column verses by adopting the loaded image's true aspect ratio, correcting via a single smooth eased transition (no rug-pull, no jitter).

**Architecture:** `FaxVerseZoom` already reads the crop image's `naturalWidth/Height` for its magnifier. Lift that up to `FaxVerseModal` via a callback; the modal picks a single `cropAspect` (loaded natural size once known, else the per-page box estimate) and drives both the pre-load `aspect-ratio` reserve and the measured px height from it. The existing CSS `transition: height 0.28s` eases the one-time correction. No CSS or backend change.

**Tech Stack:** React 17 (function components + hooks), Jest via react-scripts, @testing-library/react.

**Design spec:** `docs/specs/2026-07-29-fax-verse-modal-crosspage-height.md`

---

## File Structure

- `frontend/webapp/src/views/Facsimiles/FaxVerseZoom.jsx` — add `onNaturalSize` prop; call it from the existing hidden-`<img>` `onLoad` alongside the internal `nat` state it already sets.
- `frontend/webapp/src/views/Facsimiles/FaxVerseModal.jsx` — add `natSize` state (reset per verse), derive `cropAspect`, route the height `useLayoutEffect` and the fallback inline style through `cropAspect`, and wire the `onNaturalSize` callback into `FaxVerseZoom`.
- `frontend/webapp/src/views/Facsimiles/__tests__/FaxVerseZoom.test.js` — new test file for the callback.
- `frontend/webapp/src/views/Facsimiles/__tests__/FaxVerseModal.test.js` — extend with the height-reserve tests.

All commands run from `frontend/webapp/`. Run a single test file with:
`CI=true npx react-scripts test --watchAll=false <path>`

---

### Task 1: `FaxVerseZoom` surfaces the loaded natural size

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/FaxVerseZoom.jsx`
- Test: `frontend/webapp/src/views/Facsimiles/__tests__/FaxVerseZoom.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Facsimiles/__tests__/FaxVerseZoom.test.js`:

```javascript
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import FaxVerseZoom from "../FaxVerseZoom";

describe("FaxVerseZoom", () => {
  test("reports the crop image's natural size on load", () => {
    const onNaturalSize = jest.fn();
    render(<FaxVerseZoom src="https://media.example/crop.jpg" onNaturalSize={onNaturalSize} />);

    const img = document.querySelector(".faxVerseZoom img");
    // jsdom never actually loads images, so naturalWidth/Height stay 0 —
    // define them, then fire the load event the component listens for.
    Object.defineProperty(img, "naturalWidth", { value: 900, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 1600, configurable: true });
    fireEvent.load(img);

    expect(onNaturalSize).toHaveBeenCalledWith({ w: 900, h: 1600 });
  });

  test("does not throw when onNaturalSize is omitted", () => {
    render(<FaxVerseZoom src="https://media.example/crop.jpg" />);
    const img = document.querySelector(".faxVerseZoom img");
    Object.defineProperty(img, "naturalWidth", { value: 10, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 20, configurable: true });
    expect(() => fireEvent.load(img)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/FaxVerseZoom.test.js`
Expected: FAIL — first test's `onNaturalSize` is never called (prop not wired yet).

- [ ] **Step 3: Wire the callback**

In `FaxVerseZoom.jsx`, add the prop to the signature:

```javascript
export default function FaxVerseZoom({ src, onNaturalSize }) {
```

Then update the hidden loader `<img>`'s `onLoad` (currently only sets `nat`) to also report upward:

```javascript
      <img
        src={src}
        alt=""
        style={{ display: "none" }}
        onLoad={(e) => {
          const w = e.target.naturalWidth, h = e.target.naturalHeight;
          setNat({ w, h });
          if (onNaturalSize && w && h) onNaturalSize({ w, h });
        }}
      />
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/FaxVerseZoom.test.js`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/FaxVerseZoom.jsx frontend/webapp/src/views/Facsimiles/__tests__/FaxVerseZoom.test.js
git commit -m "fax: FaxVerseZoom reports loaded crop natural size via onNaturalSize"
```

---

### Task 2: `FaxVerseModal` reserves height from the loaded crop aspect

**Files:**
- Modify: `frontend/webapp/src/views/Facsimiles/FaxVerseModal.jsx`
- Test: `frontend/webapp/src/views/Facsimiles/__tests__/FaxVerseModal.test.js`

Context: in jsdom there is no layout, so `getBoundingClientRect().width` is 0 and
the height `useLayoutEffect` never sets a px height (its `w > 0` guard fails),
leaving the fallback `aspect-ratio` style. The tests below **mock**
`getBoundingClientRect` to return a real width so the measured px-height path runs
and we can assert the reserved height in px (jsdom-safe, unlike `aspect-ratio`).

- [ ] **Step 1: Write the failing tests**

Append to `frontend/webapp/src/views/Facsimiles/__tests__/FaxVerseModal.test.js` (inside the existing `describe("FaxVerseModal", ...)` block):

```javascript
  describe("crop box height", () => {
    let rectSpy;
    beforeEach(() => {
      // Give every element a fixed 560px width so the height useLayoutEffect
      // (width -> px height via the aspect) actually runs under jsdom.
      rectSpy = jest
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockReturnValue({ width: 560, height: 0, top: 0, left: 0, right: 560, bottom: 0, x: 0, y: 0, toJSON: () => {} });
    });
    afterEach(() => rectSpy.mockRestore());

    const crossPageVerse = {
      verse_id: 108, ref: "Jacob 1:8", text: "verse text",
      boxes: [{ x: 100, y: 600, w: 300, h: 80 }], // only ONE page's fragment (1 line)
    };

    test("pre-load reserve uses the per-page box estimate", () => {
      render(<FaxVerseModal verse={crossPageVerse} version="1842" pageScale={700} onClose={() => {}} />);
      const cutout = document.querySelector(".faxVerseModal-cutout.landscape");
      // 560 * (80 / 300) = 149.33 -> 149
      expect(cutout.style.height).toBe("149px");
    });

    test("corrects to the loaded crop's true aspect (taller)", () => {
      render(<FaxVerseModal verse={crossPageVerse} version="1842" pageScale={700} onClose={() => {}} />);
      const img = document.querySelector(".faxVerseZoom img");
      Object.defineProperty(img, "naturalWidth", { value: 900, configurable: true });
      Object.defineProperty(img, "naturalHeight", { value: 1600, configurable: true });
      fireEvent.load(img);

      const cutout = document.querySelector(".faxVerseModal-cutout.landscape");
      // 560 * (1600 / 900) = 995.55 -> 996
      expect(cutout.style.height).toBe("996px");
    });

    test("resets the loaded aspect when the verse changes", () => {
      const { rerender } = render(<FaxVerseModal verse={crossPageVerse} version="1842" pageScale={700} onClose={() => {}} />);
      const img = document.querySelector(".faxVerseZoom img");
      Object.defineProperty(img, "naturalWidth", { value: 900, configurable: true });
      Object.defineProperty(img, "naturalHeight", { value: 1600, configurable: true });
      fireEvent.load(img);

      const nextVerse = { verse_id: 109, ref: "Jacob 1:9", text: "next", boxes: [{ x: 0, y: 0, w: 400, h: 300 }] };
      rerender(<FaxVerseModal verse={nextVerse} version="1842" pageScale={700} onClose={() => {}} />);

      const cutout = document.querySelector(".faxVerseModal-cutout.landscape");
      // stale 900/1600 must NOT carry over; new estimate 560 * (300 / 400) = 420
      expect(cutout.style.height).toBe("420px");
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/FaxVerseModal.test.js`
Expected: FAIL — the "corrects to the loaded crop's true aspect" test still reports `149px` (natural size not consumed yet); the reset test likewise still reports the estimate/old value. (The pre-load test may already pass — that's fine.)

- [ ] **Step 3: Add `natSize` state, reset per verse, and derive `cropAspect`**

In `FaxVerseModal.jsx`, immediately after the `aspectBox` line (currently `const aspectBox = version ? renderBox : box;`, ~line 62) add:

```javascript
  // The render service stacks a cross-page/column verse's fragments into ONE
  // tall crop, but `boxes` here only holds the clicked page's fragments — so the
  // box estimate under-reserves height. Adopt the loaded crop's real aspect as
  // the source of truth once known; until then, the estimate reserves height so
  // there's no zero-height flash. Reset per verse (a new verse's image hasn't
  // loaded yet) so a previous verse's aspect can't leak onto the first paint.
  const [natSize, setNatSize] = useState(null);
  useEffect(() => { setNatSize(null); }, [verse?.verse_id]);
  const cropAspect = natSize && natSize.w ? natSize : aspectBox;
```

- [ ] **Step 4: Route the height measurement through `cropAspect`**

Replace the height `useLayoutEffect` body's aspect reads and dependency array
(currently keyed on `aspectBox.w`/`aspectBox.h`) so it uses `cropAspect`:

```javascript
  const cutoutRef = useRef(null);
  const [cutoutH, setCutoutH] = useState(null);
  useLayoutEffect(() => {
    const el = cutoutRef.current;
    if (!el) return undefined;
    let raf = null;
    const read = () => {
      raf = null;
      const w = el.getBoundingClientRect().width;
      if (w > 0) setCutoutH((w * cropAspect.h) / cropAspect.w);
    };
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const schedule = () => { if (raf == null) raf = requestAnimationFrame(read); };
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => { if (raf != null) cancelAnimationFrame(raf); ro.disconnect(); };
  }, [cropAspect.w, cropAspect.h]);
```

- [ ] **Step 5: Route the fallback inline style through `cropAspect` and pass the callback**

In the `version ?` branch (the `.faxVerseModal-cutout landscape` div), change the
`aspect-ratio` fallback to read `cropAspect`, and pass `onNaturalSize` to
`FaxVerseZoom`:

```javascript
          <div
            ref={cutoutRef}
            className="faxVerseModal-cutout landscape"
            style={cutoutH != null
              ? { height: `${Math.round(cutoutH)}px` }
              : { aspectRatio: `${cropAspect.w} / ${cropAspect.h}` }}
          >
            <FaxVerseZoom
              key={verse.verse_id}  /* remount so the previous verse's crop can't linger */
              src={`${renderBaseUrl}/fax/render/${version}/crop/wfull/ids/${verse.verse_id}.jpg`}
              onNaturalSize={setNatSize}
            />
          </div>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false src/views/Facsimiles/__tests__/FaxVerseModal.test.js`
Expected: PASS — all existing tests plus the three new `crop box height` tests (`149px`, `996px`, `420px`).

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Facsimiles/FaxVerseModal.jsx frontend/webapp/src/views/Facsimiles/__tests__/FaxVerseModal.test.js
git commit -m "fax: FaxVerseModal reserves crop height from loaded image aspect

Cross-page/column verses split their boxes across pages, so the per-page
box estimate under-reserved the modal crop height and the full stacked
crop was squshed to ~1 line. Adopt the loaded crop's natural aspect as the
source of truth (falling back to the box estimate pre-load), so the box is
always tall enough; the existing height transition eases the one-time
correction. Reset per verse so a prior aspect can't leak on first paint."
```

---

### Task 3: Manual verification on dev

**Files:** none (verification only).

- [ ] **Step 1: Confirm the dev frontend is serving current source**

Run: `systemctl --user status bom-dev --no-pager | head -5`
Expected: `active (running)`. (HMR serves edits on `localhost:8200` instantly; do NOT verify on `bom.kckern.net` — Cloudflare caches the bundle 4h.)

- [ ] **Step 2: Open the reported cross-page verse and watch the crop box**

In a browser, load `http://localhost:8200/#/fax/1842/jacob.1.8` (or navigate the
1842 facsimile to Jacob 1:8) and click the verse from **each** page it spans.
Expected:
- The crop box opens at a reasonable height and, once the image loads, settles to
  the full stacked crop — legible, not squished into a one-line slice.
- The settle is a single smooth eased grow (the `0.28s` height transition) — no
  snap, no zero-height flash, no jump of the verse text below.

- [ ] **Step 3: Confirm single-page verses are visually unchanged**

Open a normal single-line verse (e.g. an `Alma` verse fully on one page).
Expected: no visible height animation on open — the estimate already matches the
crop aspect, so there is nothing to correct.

- [ ] **Step 4: Confirm prev/next stays smooth**

With the modal open, step through several verses (arrow keys or the prev/next
arrows), including into and out of the cross-page verse.
Expected: heights ease between verses smoothly; no flash of a wrong height.

---

## Notes for the implementer

- Do **not** touch `FacsimilePageViewer.scss` — the `.faxVerseModal-cutout` rules
  and the `transition: height 0.28s cubic-bezier(0.4, 0, 0.2, 1)` already provide
  the easing this plan relies on.
- Do **not** change `mergeBoxes`/`hydrateVerses` — the per-page box split is left
  intact by design (Approach B, reuniting boxes, is explicitly out of scope).
- The `verse.pageAssetUrl` (non-`landscape`, CSS-crop) fallback branch is
  unchanged; it isn't the render-crop path this fix targets.
