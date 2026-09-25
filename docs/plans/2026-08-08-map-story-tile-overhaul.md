# MapStory Tile Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the six audited defects in the Home `tile-mapstory` journey player: transitions too fast, static camera that never right-sizes a move, every past/future leg always drawn, jumpy labels, cluttered map, and a text-only narrative card with no place images.

**Architecture:** The tile is split into an orchestrator (`MapStoryTile.js`, owns playback state + timing), an OpenLayers renderer (`MapStoryTileInner.js`, owns the map/camera/animation), pure geometry (`mapStoryPath.js`), a pure screen-space collision solver (`mapStoryLayout.js`), and a narrative card (`MapStoryCard.js`). We keep that split: all new decision logic goes into the **pure, unit-testable** modules (`mapStoryPath.js`, `mapStoryLayout.js`), and the OL renderer just consumes those decisions. The renderer itself has no jsdom unit coverage (OpenLayers needs a real canvas and is mocked in the tile test), so renderer changes are verified via the pure-function tests plus a manual browser check on `localhost:8200`.

**Tech Stack:** React 17 (hooks), OpenLayers 9 (`ol`), Jest via `react-scripts test`, `@testing-library/react`, plain CSS in `frontend/webapp/src/views/Home/Sampler.css`.

**Reference:** Audit at `docs/audits/2026-08-08-map-story-tile.md` (finding numbers referenced below).

**Sequencing rationale:** Tasks 1–6 (pacing, trailing render, camera) deliver the core experience change; the map-clutter finding (#5) is largely resolved by them. Tasks 7–8 remove residual label jitter. Task 9 (place images) is independent and can be done anytime.

---

## Pre-flight (once, before Task 1)

- [ ] **Confirm the test runner works and the baseline is green**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="mapStory"
```
Expected: all existing `MapStoryTile`, `mapStoryPath`, `mapStoryLayout` tests PASS. This is the baseline; every task below must leave this command green (with the deliberate test edits the tasks specify).

Notes for the engineer:
- `e2e/map-story-animation.spec.js` is a Playwright test for the **full map page** (`/map/internal/story/...`, `.mapPanel .map_story_fence`), **not** this Home tile. Nothing in this plan touches it.
- The place-image asset route is `${assetUrl}/places/${slug}` where `assetUrl` = `https://media.bookofmormon.online` (from `src/models/BoMOnlineAPI.js`). It is already used by sibling Home tiles `PlacesTile.js` and `PlaceProfileTile.js`.
- Cloudflare caches the dev bundle for 4h; when manually verifying, use `http://localhost:8200`, not `bom.kckern.net` (see CLAUDE.md).

---

## Task 1: Per-move, content-aware pacing (Finding 1)

Replace the fixed 22-second budget (which makes each move *faster* the more moves a story has) with a fixed, readable per-move dwell that is longer for content-rich beats.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/MapStoryTile.js:10-18` (timing model), `:94-97` (call site ordering), `:158-160` (advance timer)
- Test: `frontend/webapp/src/views/Home/tiles/__tests__/MapStoryTile.test.js`

- [ ] **Step 1: Update the timing unit test and rewrite the budget test**

In `__tests__/MapStoryTile.test.js`, change the import block (lines 4-8) to drop the removed budget constant:

```js
import MapStoryTile, {
  homeStoryTitle,
  playbackTiming,
} from "../MapStoryTile";
```

Add this new focused test inside `describe("MapStoryTile", ...)` (e.g. right after the `communicates the whole journey...` test):

```js
test("paces each move for readability and gives content-rich beats more dwell", () => {
  const rich = playbackTiming({ description: "Eight years in the wilderness", ref: "1 Nephi 17:4" });
  const plain = playbackTiming({});
  expect(rich.travelMs).toBe(plain.travelMs);
  expect(rich.stepMs).toBeGreaterThan(plain.stepMs);
  expect(plain.stepMs).toBeGreaterThanOrEqual(3000);
  expect(plain.stepMs).toBe(plain.travelMs + 2000);
});
```

Replace the existing `autoplay advances, completes within budget...` test (lines 178-194) with:

```js
test("autoplay advances through each move and holds on completion instead of looping", () => {
  renderTile();
  const stepOne = playbackTiming(data.moves[0]).stepMs;
  const stepTwo = playbackTiming(data.moves[1]).stepMs;

  act(() => { jest.advanceTimersByTime(stepOne); });
  expect(mapState("step")).toBe("1");
  act(() => { jest.advanceTimersByTime(stepTwo); });
  expect(mapState("complete")).toBe("true");
  expect(screen.getAllByText("Journey complete").length).toBeGreaterThan(0);
  expect(screen.getByLabelText("Replay journey")).toBeTruthy();
  expect(screen.getByLabelText("Journey move").value).toBe(String(data.moves.length));

  act(() => { jest.advanceTimersByTime(stepOne + stepTwo + 10000); });
  expect(mapState("complete")).toBe("true");
  expect(mapState("step")).toBe("1");
});
```

Replace the two remaining `PLAYBACK_BUDGET_MS` uses with a plain large advance:
- Line 199 (in `pause freezes...`): `act(() => { jest.advanceTimersByTime(60000); });`
- Line 294 (in `reduced motion opens...`): `act(() => { jest.advanceTimersByTime(60000); });`

- [ ] **Step 2: Run the tests to verify they FAIL**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="MapStoryTile"
```
Expected: FAIL — `playbackTiming` still takes a move count and returns `stepMs` derived from the budget; the new assertions (`rich.stepMs > plain.stepMs`, `plain.stepMs === travelMs + 2000`) do not hold, and the import of the now-removed constant is gone but the source still exports the old shape.

- [ ] **Step 3: Rewrite the timing model in `MapStoryTile.js`**

Replace lines 10-18:

```js
export const PLAYBACK_BUDGET_MS = 22000;

export const playbackTiming = (moveCount) => {
  const stepMs = Math.min(2800, Math.max(750, Math.floor(PLAYBACK_BUDGET_MS / Math.max(1, moveCount))));
  return {
    stepMs,
    travelMs: Math.min(1650, Math.max(520, Math.round(stepMs * 0.68))),
  };
};
```

with:

```js
// Each move gets a fixed, readable window regardless of story length. Beats with
// something to read (a description or a scripture ref) hold longer. The old
// fixed-total budget made longer stories play *faster* per move — the opposite of
// what a reader needs.
export const TRAVEL_MS = 1400;
export const DWELL_MS = 2000;
export const DWELL_MS_RICH = 3200;

export const playbackTiming = (move) => {
  const hasReading = Boolean(move?.description || move?.ref);
  const dwellMs = hasReading ? DWELL_MS_RICH : DWELL_MS;
  return { travelMs: TRAVEL_MS, dwellMs, stepMs: TRAVEL_MS + dwellMs };
};
```

- [ ] **Step 4: Move the `timing` call site below `currentMove` and pass the current move**

Delete line 94 (`const timing = playbackTiming(moves.length);`). Then, immediately after the `currentMove` declaration (currently lines 95-97, which end with `: moves[Math.min(step, Math.max(0, moves.length - 1))];`), insert:

```js
  const timing = playbackTiming(currentMove);
```

`travelMs={timing.travelMs}` at line 236 continues to work unchanged.

- [ ] **Step 5: Point the advance timer at the per-move step duration**

The autoplay `useEffect` (lines 149-160) already uses `timing.stepMs` inside `setTimeout` and lists `timing.stepMs` in its dependency array (line 160). No code change is needed there — but verify the dependency array still reads `[playing, step, moves.length, timing.stepMs]` so the timer re-arms with the *current* move's duration each step.

- [ ] **Step 6: Run tests to verify they PASS**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="MapStoryTile"
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/MapStoryTile.js frontend/webapp/src/views/Home/tiles/__tests__/MapStoryTile.test.js
git commit -m "fix(mapstory): pace journey per-move instead of a shrinking global budget"
```

---

## Task 2: Trailing leg-visibility helper (Finding 3, pure logic)

A pure function deciding how prominent each leg is relative to the playhead: active leg bold, recently-visited legs fade with age across a trailing window, older legs recede to faint context, future legs hidden until reached.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/mapStoryPath.js` (append new export)
- Test: `frontend/webapp/src/views/Home/tiles/__tests__/mapStoryPath.test.js`

- [ ] **Step 1: Write the failing test**

In `__tests__/mapStoryPath.test.js`, update the import on line 1 to include the new function:

```js
import { legVisibility, legsOf, stopsOf, stopStateAt } from "../mapStoryPath";
```

Append this `describe` block to the file:

```js
describe("legVisibility", () => {
  test("marks the leg at the playhead as the bold active leg", () => {
    expect(legVisibility(2, 2)).toEqual({ role: "active", opacity: 1 });
  });

  test("fades recently visited legs with age across the trailing window", () => {
    expect(legVisibility(1, 2, false, 3)).toMatchObject({ role: "recent" });
    expect(legVisibility(1, 2, false, 3).opacity).toBeCloseTo(0.72, 5);
    expect(legVisibility(0, 2, false, 3).opacity).toBeLessThan(legVisibility(1, 2, false, 3).opacity);
  });

  test("recedes legs older than the trailing window to faint context", () => {
    expect(legVisibility(0, 5, false, 3)).toEqual({ role: "old", opacity: 0.16 });
  });

  test("hides future legs until the playhead reaches them", () => {
    expect(legVisibility(4, 2)).toEqual({ role: "future", opacity: 0 });
  });

  test("shows the whole journey as visited context on the completed frame", () => {
    expect(legVisibility(0, 3, true)).toEqual({ role: "visited", opacity: 0.6 });
  });
});
```

- [ ] **Step 2: Run test to verify it FAILS**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="mapStoryPath"
```
Expected: FAIL with `legVisibility is not a function` / `is not defined`.

- [ ] **Step 3: Implement `legVisibility` in `mapStoryPath.js`**

Append to the end of `mapStoryPath.js`:

```js
/** Default number of past legs that stay in the "recent" (fading) trailing tail. */
export const TRAILING_WINDOW = 3;

/**
 * How prominently a leg should render for a given playhead position.
 *   - active:  the leg being traveled now (full color)
 *   - recent:  a visited leg still inside the trailing window (fades with age)
 *   - old:     a visited leg past the trailing window (faint route context)
 *   - future:  not yet reached (hidden until the playhead arrives)
 *   - visited: the completed-frame state where the whole journey is shown
 */
export const legVisibility = (index, step, complete = false, trailingWindow = TRAILING_WINDOW) => {
  if (complete) return { role: "visited", opacity: 0.6 };
  if (index === step) return { role: "active", opacity: 1 };
  if (index < step) {
    const age = step - index; // 1 = most recently completed
    if (age > trailingWindow) return { role: "old", opacity: 0.16 };
    const span = Math.max(1, trailingWindow - 1);
    const opacity = 0.72 - (age - 1) * (0.72 - 0.28) / span;
    return { role: "recent", opacity };
  }
  return { role: "future", opacity: 0 };
};
```

- [ ] **Step 4: Run test to verify it PASSES**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="mapStoryPath"
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/mapStoryPath.js frontend/webapp/src/views/Home/tiles/__tests__/mapStoryPath.test.js
git commit -m "feat(mapstory): add trailing-window leg visibility helper"
```

---

## Task 3: Render the trailing window on the map (Finding 3, wiring)

Drive both OL layers from `legVisibility`: active + recent + completed legs draw in the progress layer with graded opacity; only long-past legs remain as faint context in the base layer; future legs are hidden. This is a renderer change with no jsdom unit test — verified by Task 2's passing tests, the full suite staying green, and a manual browser check.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/MapStoryTileInner.js:15-16` (import), `:25-66` (style helpers), `:336-365` (step-paint effect)

- [ ] **Step 1: Import the helper**

Change line 15-16 from:

```js
import { legsOf, stopsOf } from "./mapStoryPath";
import { buildStoryOverlay, storyStepForStop, travelerPosition } from "./mapStoryLayout";
```

to:

```js
import { legVisibility, legsOf, stopsOf } from "./mapStoryPath";
import { buildStoryOverlay, storyStepForStop, travelerPosition } from "./mapStoryLayout";
```

- [ ] **Step 2: Make the route and visited styles opacity-aware**

Replace lines 25-53 (the `ROUTE`/`VISITED`/`ACTIVE` constants and the `routeStyle`/`visitedStyle` helpers) with:

```js
const ACTIVE = "#9f3029";

/**
 * bom_places_coords stores the internal projection's X in `lat` and Y in
 * `lng`. Match the full map's established [lat, lng] conversion order.
 */
const project = (lat, lng) => OlProj.fromLonLat([Number(lat), Number(lng)]);

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

const routeStyle = (detached, opacity = 0.35) =>
  new Style({
    stroke: new Stroke({
      color: `rgba(42, 56, 49, ${opacity})`,
      width: 2,
      lineDash: detached ? [2, 6] : [5, 7],
    }),
  });

const visitedStyle = (detached, opacity = 0.72) =>
  new Style({
    stroke: new Stroke({
      color: `rgba(130, 47, 40, ${opacity})`,
      width: 2.5,
      lineDash: detached ? [2, 5] : undefined,
    }),
  });
```

Note: this deletes the standalone `const project`/`const lerp` that currently live at lines 33-35 and re-declares them here, so **also delete the original lines 33-35** to avoid duplicate declarations. The `activeStyle` helper (lines 55-66) is unchanged and still references `ACTIVE`.

- [ ] **Step 3: Rewrite the step-paint effect to consult `legVisibility` for both layers**

Replace the effect body at lines 336-365 (the `useEffect` beginning `const features = progressFeaturesRef.current;`) with:

```js
  useEffect(() => {
    const features = progressFeaturesRef.current;
    const baseFeatures = baseFeaturesRef.current;
    if (!features.length) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    animationRef.current = { step, elapsed: 0, lastTime: null };

    features.forEach((feature, index) => {
      const leg = legs[index];
      const from = project(leg.from.lat, leg.from.lng);
      const to = project(leg.to.lat, leg.to.lng);
      const vis = legVisibility(index, step, complete);
      if (vis.role === "active") {
        const drawFull = !animate || !playing;
        feature.setGeometry(new LineString(drawFull ? [from, to] : [from, from]));
        feature.setStyle(activeStyle(leg.detached));
      } else if (vis.role === "recent" || vis.role === "visited") {
        feature.setGeometry(new LineString([from, to]));
        feature.setStyle(visitedStyle(leg.detached, vis.opacity));
      } else {
        // old + future: progress layer stays empty; base carries faint context.
        feature.setGeometry(new LineString([from, from]));
        feature.setStyle(EMPTY_STYLE);
      }
    });

    baseFeatures.forEach((feature, index) => {
      const vis = legVisibility(index, step, complete);
      // Only long-past legs remain as faint route context. Future legs are hidden
      // until reached; active/recent/visited legs are drawn in color above.
      feature.setStyle(vis.role === "old" ? routeStyle(legs[index].detached, vis.opacity) : EMPTY_STYLE);
    });

    updateLayoutRef.current();

    const activeLeg = legs[complete ? legs.length - 1 : Math.min(step, legs.length - 1)];
    if (!activeLeg) return;
    const from = project(activeLeg.from.lat, activeLeg.from.lng);
    const to = project(activeLeg.to.lat, activeLeg.to.lng);
    positionTraveler(complete || !animate || !playing ? to : from, from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, complete, animate, legs]);
```

- [ ] **Step 4: Run the full tile suite to confirm nothing regressed**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="mapStory"
```
Expected: PASS (renderer has no unit tests; this confirms the shared imports/pure helpers still resolve and the tile still mounts under the mock).

- [ ] **Step 5: Manual browser verification**

Ensure the dev server is up (`systemctl --user status bom-dev`), then open `http://localhost:8200`, scroll to the MapStory tile, and press Play. Confirm: future legs are NOT drawn ahead of the playhead, the active leg is bold, the last couple of visited legs fade, and older legs are faint/gone. (Optional evidence: screenshot mid-playback.)

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/MapStoryTileInner.js
git commit -m "fix(mapstory): draw only a trailing window of legs, hide future route"
```

---

## Task 4: Per-move camera-framing helper (Finding 2, pure logic)

A pure function returning which leg indices the camera should frame: the active leg plus a short trailing tail; the whole journey on completion.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/mapStoryPath.js` (append new export)
- Test: `frontend/webapp/src/views/Home/tiles/__tests__/mapStoryPath.test.js`

- [ ] **Step 1: Write the failing test**

Update the import on line 1 of `__tests__/mapStoryPath.test.js` to add `framedLegIndices`:

```js
import { framedLegIndices, legVisibility, legsOf, stopsOf, stopStateAt } from "../mapStoryPath";
```

Append this `describe` block:

```js
describe("framedLegIndices", () => {
  test("frames just the active leg at the start", () => {
    expect(framedLegIndices(0, false, 4, 1)).toEqual([0]);
  });

  test("frames the active leg plus a trailing tail", () => {
    expect(framedLegIndices(2, false, 4, 1)).toEqual([1, 2]);
    expect(framedLegIndices(3, false, 4, 2)).toEqual([1, 2, 3]);
  });

  test("tail of zero frames only the active leg", () => {
    expect(framedLegIndices(2, false, 4, 0)).toEqual([2]);
  });

  test("frames the entire journey on the completed frame", () => {
    expect(framedLegIndices(3, true, 4, 1)).toEqual([0, 1, 2, 3]);
  });

  test("clamps the active index to the available legs", () => {
    expect(framedLegIndices(99, false, 3, 1)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it FAILS**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="mapStoryPath"
```
Expected: FAIL with `framedLegIndices is not defined`.

- [ ] **Step 3: Implement `framedLegIndices` in `mapStoryPath.js`**

Append:

```js
/**
 * Which leg indices the camera should frame for a given playhead: the active leg
 * plus a short trailing tail for context. The completed frame shows every leg.
 */
export const framedLegIndices = (step, complete, total, tail = 1) => {
  if (total <= 0) return [];
  if (complete) return Array.from({ length: total }, (_, i) => i);
  const end = Math.min(Math.max(0, step), total - 1);
  const start = Math.max(0, end - tail);
  const indices = [];
  for (let i = start; i <= end; i += 1) indices.push(i);
  return indices;
};
```

- [ ] **Step 4: Run test to verify it PASSES**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="mapStoryPath"
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/mapStoryPath.js frontend/webapp/src/views/Home/tiles/__tests__/mapStoryPath.test.js
git commit -m "feat(mapstory): add per-move camera framing helper"
```

---

## Task 5: Animate the camera to the active move (Finding 2, wiring)

Make the map re-frame the active leg (+ trailing tail) on every step, instead of freezing on the whole-journey overview. Recenter restores the whole-story view. Renderer change; verified by Task 4's tests, the suite staying green, and manual check.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/MapStoryTileInner.js:15` (import), `:1-16` (add `boundingExtent` import), `:98-113` (add a ref), `:276-332` (replace `fitStory` with `frameLegs`/`frameStep`/`frameStory`, update resize + initial frame), and add a new camera effect after the animation effect (~line 397)

- [ ] **Step 1: Add the OL extent import and the trailing helper import**

At the top of `MapStoryTileInner.js`, add after line 12 (`import * as OlProj from "ol/proj";`):

```js
import { boundingExtent } from "ol/extent";
```

Update the path import (line 15) to include `framedLegIndices`:

```js
import { framedLegIndices, legVisibility, legsOf, stopsOf } from "./mapStoryPath";
```

- [ ] **Step 2: Add refs for the per-step framer and mount guard**

After the existing `fitStoryRef` declaration (line 111, `const fitStoryRef = useRef(() => {});`), add:

```js
  const frameStepRef = useRef(() => {});
  const didMountRef = useRef(false);
```

- [ ] **Step 3: Replace `fitStory` with a `frameLegs`-based camera**

Inside the map-build `useEffect`, replace the `fitStory` definition (lines 276-291, from `const fitStory = () => {` through `fitStoryRef.current = fitStory;`) with:

```js
    const allIndices = legs.map((_, index) => index);
    const frameLegs = (indices, withAnimation) => {
      if (!indices.length) return;
      const coords = [];
      indices.forEach((index) => {
        const leg = legs[index];
        if (!leg) return;
        coords.push(project(leg.from.lat, leg.from.lng));
        coords.push(project(leg.to.lat, leg.to.lng));
      });
      if (!coords.length) return;
      const extent = boundingExtent(coords);
      if (!extent.every(Number.isFinite)) return;
      programmaticMoveRef.current = true;
      map.updateSize();
      map.getView().fit(extent, {
        padding: [46, 46, 46, 46],
        maxZoom: MAX_ZOOM,
        duration: withAnimation ? 620 : 0,
      });
      setMapMoved(false);
      mapMovedRef.current = false;
      if (!withAnimation) {
        map.renderSync();
        updateLayoutRef.current();
        programmaticMoveRef.current = false;
      }
      // When animating, the `moveend` handler clears programmaticMoveRef and
      // refreshes the overlay once the glide settles.
    };
    const frameStory = (withAnimation) => frameLegs(allIndices, withAnimation);
    const frameStep = (withAnimation) => {
      const state = layoutStateRef.current;
      frameLegs(framedLegIndices(state.step, state.complete, legs.length, 1), withAnimation);
    };
    fitStoryRef.current = () => frameStory(true);
    frameStepRef.current = frameStep;
```

- [ ] **Step 4: Point the resize observer and initial frame at the new functions**

In the same effect, the `ResizeObserver` callback (lines 308-315) currently calls `fitStory()`. Change it to keep the current framing on resize:

```js
    resizeObserverRef.current = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          map.updateSize();
          if (!mapMovedRef.current) frameStep(false);
          else updateLayoutRef.current();
        })
      : null;
    if (resizeObserverRef.current) resizeObserverRef.current.observe(target);
```

Change the initial frame (line 317) from `const initialFrame = requestAnimationFrame(fitStory);` to:

```js
    const initialFrame = requestAnimationFrame(() => frameStep(false));
```

- [ ] **Step 5: Add the per-step camera effect**

Immediately after the animation `useEffect` that ends at line 397 (the one with deps `[playing, animate, complete, step, travelMs, legs]`), add:

```js
  // Re-frame the camera on the active move so each hop is right-sized, unless the
  // user has taken manual control of the map. The build effect frames the first
  // move synchronously, so the first run here is skipped.
  useEffect(() => {
    if (!mapRef.current) return;
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (mapMovedRef.current) return;
    frameStepRef.current(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, complete]);
```

- [ ] **Step 6: Run the full tile suite**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="mapStory"
```
Expected: PASS.

- [ ] **Step 7: Manual browser verification**

On `http://localhost:8200`, play the tile. Confirm the camera glides to frame each active move (nearby hops are now legibly zoomed), the "Recenter story" button (appears after you drag the map) restores the whole-journey view, and manual drag still pauses playback. Confirm the completed frame shows the whole journey.

- [ ] **Step 8: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/MapStoryTileInner.js
git commit -m "fix(mapstory): animate the camera to right-size each active move"
```

---

## Task 6: Stop force-placing visited markers during playback (Finding 5)

Visited (non-active, non-anchor) markers are currently `required: true`, so the collision solver's grid fallback forces every one onto the map, piling markers into card space. Make them required only on the completed frame. Combined with Tasks 3/5, this clears most residual clutter.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/mapStoryLayout.js` (add `symbolRequired`, use it in `buildStoryOverlay`)
- Test: `frontend/webapp/src/views/Home/tiles/__tests__/mapStoryLayout.test.js`

- [ ] **Step 1: Write the failing test**

Add `symbolRequired` to the import block (lines 1-10) of `__tests__/mapStoryLayout.test.js`:

```js
import {
  buildStoryOverlay,
  clusterFutureStops,
  layoutLabels,
  layoutSymbols,
  rectanglesOverlap,
  roleForStop,
  storyStepForStop,
  symbolRequired,
  travelerPosition,
} from "../mapStoryLayout";
```

Append this `describe` block:

```js
describe("marker requiredness", () => {
  test("always keeps active and anchor markers", () => {
    expect(symbolRequired("active", false)).toBe(true);
    expect(symbolRequired("anchor", false)).toBe(true);
  });

  test("does not force visited markers during playback but keeps them on completion", () => {
    expect(symbolRequired("visited", false)).toBe(false);
    expect(symbolRequired("visited", true)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it FAILS**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="mapStoryLayout"
```
Expected: FAIL with `symbolRequired is not defined`.

- [ ] **Step 3: Implement `symbolRequired` and use it in `buildStoryOverlay`**

In `mapStoryLayout.js`, add this export just above `buildStoryOverlay` (before line 246's `export const buildStoryOverlay`):

```js
/**
 * Whether a named marker must be placed. Active endpoints and the story's
 * origin/final anchors are always kept; visited markers are only forced on the
 * completed frame, so mid-playback they yield instead of cluttering the map.
 */
export const symbolRequired = (role, complete) =>
  Boolean(complete) || role === "active" || role === "anchor";
```

Then, inside `buildStoryOverlay`, change the `namedStops` symbol mapping (lines 282-289) so `required` uses the helper:

```js
      ...namedStops.map((marker) => ({
        ...marker,
        id: `marker:${marker.slug}`,
        kind: "marker",
        width: marker.role === "active" ? 26 : marker.role === "anchor" ? 20 : 18,
        height: marker.role === "active" ? 26 : marker.role === "anchor" ? 20 : 18,
        required: symbolRequired(marker.role, complete),
      })),
```

- [ ] **Step 4: Run the full layout suite to verify the new test passes and existing ones still hold**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="mapStoryLayout"
```
Expected: PASS. (The existing `complete state exposes the full route...` test uses `complete: true`, so visited markers stay required there; the step-0/step-1 tests have no visited markers yet, so they are unaffected.)

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/mapStoryLayout.js frontend/webapp/src/views/Home/tiles/__tests__/mapStoryLayout.test.js
git commit -m "fix(mapstory): stop force-placing visited markers during playback"
```

---

## Task 7: Label-placement hysteresis to kill per-frame jitter (Finding 4b)

When a label's map anchor barely moved since the last frame and its previous slot still fits, reuse that slot instead of re-solving to a different ring. This stops labels from flipping sides on resize/pan/small camera moves.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/mapStoryLayout.js` (`layoutLabels`, `buildStoryOverlay`)
- Modify: `frontend/webapp/src/views/Home/tiles/MapStoryTileInner.js` (thread previous label slots through `updateLayout`)
- Test: `frontend/webapp/src/views/Home/tiles/__tests__/mapStoryLayout.test.js`

- [ ] **Step 1: Write the failing test**

Append to `__tests__/mapStoryLayout.test.js`:

```js
describe("label placement hysteresis", () => {
  test("reuses a still-valid previous slot when the anchor barely moved", () => {
    const items = [{ slug: "x", name: "Place X", x: 150, y: 120, priority: 0, firstStep: 0, required: true }];
    const first = layoutLabels({ items, obstacles: [], width: 320, height: 240 });
    const prior = first[0];

    const second = layoutLabels({
      items,
      obstacles: [{ id: "far-away", x: 8, y: 214, width: 20, height: 20 }],
      width: 320,
      height: 240,
      previous: {
        x: { x: prior.x, y: prior.y, width: prior.width, height: prior.height, anchorX: 150, anchorY: 120 },
      },
    });
    expect(second[0].x).toBe(prior.x);
    expect(second[0].y).toBe(prior.y);
  });

  test("re-solves when the anchor jumped far from the previous slot", () => {
    const items = [{ slug: "x", name: "Place X", x: 40, y: 60, priority: 0, firstStep: 0, required: true }];
    const stalePrevious = {
      x: { x: 240, y: 200, width: 90, height: 28, anchorX: 250, anchorY: 210 },
    };
    const placed = layoutLabels({ items, obstacles: [], width: 320, height: 240, previous: stalePrevious });
    // The new slot must sit near the moved anchor, not at the stale far corner.
    expect(Math.hypot(placed[0].x - 40, placed[0].y - 60)).toBeLessThan(120);
  });
});
```

- [ ] **Step 2: Run test to verify it FAILS**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="mapStoryLayout"
```
Expected: FAIL — `layoutLabels` ignores an unknown `previous` option, so the first test's reused-slot assertion fails (it re-solves to the default first ring) or the returned objects lack the reused coordinates.

- [ ] **Step 3: Add hysteresis to `layoutLabels`**

In `mapStoryLayout.js`, replace the `layoutLabels` function (lines 140-184) with:

```js
export const layoutLabels = ({ items, obstacles, width, height, padding = 8, previous = {} }) => {
  const placed = [];
  const occupied = [...obstacles];
  const ordered = [...items].sort(
    (a, b) => a.priority - b.priority || a.firstStep - b.firstStep || a.slug.localeCompare(b.slug),
  );

  ordered.forEach((item) => {
    const ownId = `marker:${item.slug}`;

    // Hysteresis: if this label's anchor barely moved and its previous slot still
    // fits, keep it. This prevents labels from flipping sides frame to frame.
    const prior = previous[item.slug];
    const priorFresh =
      prior && Math.hypot(item.x - prior.anchorX, item.y - prior.anchorY) <= 24;
    const priorRect = priorFresh
      ? { x: prior.x, y: prior.y, width: prior.width, height: prior.height }
      : null;

    let rect =
      priorRect && inside(priorRect, width, height, padding) && !overlapsAny(priorRect, occupied, ownId)
        ? priorRect
        : candidateRects(item, width).find(
            (candidate) =>
              inside(candidate, width, height, padding) &&
              !overlapsAny(candidate, occupied, ownId),
          );

    // Active endpoints plus story origin/final destination are never dropped.
    // If radial placement cannot find room, scan stable card-space slots and
    // connect the displaced label back to its true map position.
    if (!rect && item.required) {
      const dimensions = labelDimensions(item.name, width);
      for (let y = padding; y <= height - dimensions.height - padding && !rect; y += 8) {
        for (let x = padding; x <= width - dimensions.width - padding; x += 8) {
          const candidate = { x, y, ...dimensions };
          if (!overlapsAny(candidate, occupied, ownId)) {
            rect = candidate;
            break;
          }
        }
      }
    }

    if (!rect) return;
    const end = leaderEnd(item, rect);
    const leaderLength = Math.hypot(end.x - item.x, end.y - item.y);
    const label = {
      ...item,
      ...rect,
      anchorX: item.x,
      anchorY: item.y,
      leader: leaderLength > 12 ? { x1: item.x, y1: item.y, x2: end.x, y2: end.y } : null,
    };
    placed.push(label);
    occupied.push({ id: `label:${item.slug}`, ...rect });
  });

  return placed;
};
```

- [ ] **Step 4: Thread `previous` through `buildStoryOverlay`**

In `mapStoryLayout.js`, add `previousLabels = {}` to the `buildStoryOverlay` destructured params (lines 246-256), i.e. add it alongside `reservedRects = []`:

```js
export const buildStoryOverlay = ({
  stops,
  moves,
  step,
  complete = false,
  pixels,
  width,
  height,
  clusterRadius = 46,
  reservedRects = [],
  previousLabels = {},
}) => {
```

Then pass it to `layoutLabels` (the call at lines 327-332):

```js
  const labels = layoutLabels({
    items: namedMarkers,
    obstacles,
    width,
    height,
    previous: previousLabels,
  });
```

- [ ] **Step 5: Supply previous label slots from the renderer**

In `MapStoryTileInner.js`, inside `updateLayoutRef.current` (lines 125-151), build `previousLabels` from the last overlay and pass it into `buildStoryOverlay`. Replace the `buildStoryOverlay({ ... })` call (lines 135-144) with:

```js
    const previousLabels = {};
    overlayRef.current.labels.forEach((label) => {
      previousLabels[label.slug] = {
        x: label.x,
        y: label.y,
        width: label.width,
        height: label.height,
        anchorX: label.anchorX,
        anchorY: label.anchorY,
      };
    });
    const nextOverlay = buildStoryOverlay({
      ...state,
      pixels,
      width: target.clientWidth,
      height: target.clientHeight,
      clusterRadius: target.clientWidth < 360 ? 52 : 46,
      previousLabels,
      reservedRects: mapMovedRef.current
        ? [{ id: "control:recenter", x: target.clientWidth - 138, y: target.clientHeight - 58, width: 128, height: 48 }]
        : [],
    });
```

- [ ] **Step 6: Run the full tile suite**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="mapStory"
```
Expected: PASS (including the pre-existing `overlay label boxes do not overlap...` and `keeps required labels...` tests, since new labels still carry `x/y/width/height` and hysteresis only reuses slots that pass the same overlap checks).

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/mapStoryLayout.js frontend/webapp/src/views/Home/tiles/MapStoryTileInner.js frontend/webapp/src/views/Home/tiles/__tests__/mapStoryLayout.test.js
git commit -m "fix(mapstory): keep stable label slots across frames to stop jitter"
```

---

## Task 8: Smooth overlay motion with CSS transitions (Finding 4a)

The overlay markers/labels/traveler are absolutely positioned with `left`/`top` and no transition, so every recompute is an instant snap. Add short transitions, gated off under reduced motion.

**Files:**
- Modify: `frontend/webapp/src/views/Home/Sampler.css` (`.mapStoryStopMarker` ~1822, `.mapStoryPlaceLabel` ~1842, `.mapStoryCluster` ~1874, `.mapStoryTravelerParty` ~1896, reduced-motion block ~2173)

- [ ] **Step 1: Add position transitions to the marker**

In `Sampler.css`, in the `.mapStoryStopMarker` rule (starts line 1822), add a transition declaration (e.g. after the `background:` line):

```css
  transition: left 200ms ease, top 200ms ease, width 160ms ease, height 160ms ease;
```

- [ ] **Step 2: Add position transitions to the label**

In `.mapStoryPlaceLabel` (starts line 1842), add:

```css
  transition: left 200ms ease, top 200ms ease, width 200ms ease;
```

- [ ] **Step 3: Add position transitions to the cluster**

In `.mapStoryCluster` (starts line 1874), add:

```css
  transition: left 200ms ease, top 200ms ease, background 140ms ease, transform 140ms ease;
```

(The existing `:hover` `transform: translate(-50%, -50%) scale(1.04)` will now animate too, which is desirable.)

- [ ] **Step 4: Add position transitions to the traveler party**

In `.mapStoryTravelerParty` (starts line 1896), replace the `will-change: left, top;` line with:

```css
  transition: left 200ms ease, top 200ms ease, opacity 160ms ease;
  will-change: left, top;
```

- [ ] **Step 5: Extend the reduced-motion guard**

Replace the `@media (prefers-reduced-motion: reduce)` block (lines 2173-2177) with:

```css
@media (prefers-reduced-motion: reduce) {
  .mapStoryCluster,
  .mapStoryControlButton,
  .mapStoryPlaceLabel,
  .mapStoryStopMarker,
  .mapStoryTravelerParty { transition: none !important; }
}
```

- [ ] **Step 6: Manual browser verification**

On `http://localhost:8200`, play the tile and watch labels/markers/traveler glide (not snap) between beats. Then enable OS "reduce motion" (or emulate it in DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce"), reload, and confirm the tile opens on the completed static frame with no transitions. (There are no unit tests for CSS; this manual check is the verification.)

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Home/Sampler.css
git commit -m "fix(mapstory): transition overlay positions to remove label snap/jitter"
```

---

## Task 9: Place images in the narrative card (Finding 6)

The move card is text-only. Add start/end place thumbnails using the existing `${assetUrl}/places/${slug}` route, degrading gracefully (hide on 404) exactly like the people avatars do.

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/MapStoryCard.js` (import `assetUrl`, render thumbnails in `MapStoryMoveCard`)
- Modify: `frontend/webapp/src/views/Home/Sampler.css` (thumbnail styling near `.mapStoryLeg` ~2078)
- Test: `frontend/webapp/src/views/Home/tiles/__tests__/MapStoryTile.test.js`

- [ ] **Step 1: Write the failing test**

Add this test inside `describe("MapStoryTile", ...)` in `__tests__/MapStoryTile.test.js` (the tile renders the real `MapStoryMoveCard`; only the OL inner map is mocked):

```js
test("shows start and end place thumbnails in the active move card", () => {
  const { container } = renderTile();
  expect(container.querySelector('img[src$="/places/jerusalem"]')).toBeTruthy();
  expect(container.querySelector('img[src$="/places/valley-of-lemuel"]')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it FAILS**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="MapStoryTile"
```
Expected: FAIL — no `img` with a `/places/...` src exists in the card yet.

- [ ] **Step 3: Render place thumbnails in `MapStoryMoveCard`**

In `MapStoryCard.js`, add the asset-URL import after line 3:

```js
import { assetUrl } from "src/models/BoMOnlineAPI";
```

Add this helper above `MapStoryMoveCard` (after `travelerText`, line 13):

```js
const PlaceThumb = ({ slug, name }) =>
  slug ? (
    <img
      className="mapStoryPlaceThumb"
      src={`${assetUrl}/places/${slug}`}
      alt=""
      loading="lazy"
      onError={(event) => { event.currentTarget.style.display = "none"; }}
      title={name}
    />
  ) : null;
```

Replace the `.mapStoryLeg` block in `MapStoryMoveCard` (lines 25-29) with:

```jsx
        <div className="mapStoryLeg">
          <span className="mapStoryLegPlace">
            <PlaceThumb slug={move.start} name={placeLabel(move.startName, move.start)} />
            <span className="mapStoryLegPlaceName">{placeLabel(move.startName, move.start)}</span>
          </span>
          <span className="mapStoryArrow" aria-hidden="true">→</span>
          <span className="mapStoryLegPlace">
            <PlaceThumb slug={move.end} name={placeLabel(move.endName, move.end)} />
            <span className="mapStoryLegPlaceName">{placeLabel(move.endName, move.end)}</span>
          </span>
        </div>
```

- [ ] **Step 4: Run test to verify it PASSES**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="MapStoryTile"
```
Expected: PASS.

- [ ] **Step 5: Style the thumbnails**

In `Sampler.css`, add after the `.mapStoryLeg span:first-child, .mapStoryLeg span:last-child` rule (line 2080):

```css
.mapStoryLegPlace { display: flex; min-width: 0; align-items: center; gap: 0.34rem; overflow: hidden; }
.mapStoryLegPlaceName { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mapStoryPlaceThumb {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  object-fit: cover;
  border: 2px solid #fff;
  border-radius: 0.4rem;
  box-shadow: 0 1px 4px rgba(24, 34, 28, 0.28);
  background: #d7ddd3;
}
```

Add a dark-mode border tweak near the other dark rules (after line 2159, `html[data-theme="dark"] .mapStoryLeg { ... }`):

```css
html[data-theme="dark"] .mapStoryPlaceThumb { border-color: #3a453e; background: #333c36; }
```

- [ ] **Step 6: Manual browser verification**

On `http://localhost:8200`, confirm the move card shows start/end place thumbnails beside the names, and that a place with no artwork simply shows no image (name still visible, no broken-image icon). The existing `mapStoryLeg` names still ellipsize when long.

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/MapStoryCard.js frontend/webapp/src/views/Home/Sampler.css frontend/webapp/src/views/Home/tiles/__tests__/MapStoryTile.test.js
git commit -m "feat(mapstory): show start/end place thumbnails in the move card"
```

---

## Final verification (after all tasks)

- [ ] **Run the complete tile suite**

Run:
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern="mapStory"
```
Expected: all `mapStoryPath`, `mapStoryLayout`, and `MapStoryTile` suites PASS.

- [ ] **Full manual pass on `http://localhost:8200`**

Walk the six findings end-to-end in the browser:
1. Playback dwells long enough to read each beat (and longer on beats with a description/ref).
2. The camera glides to right-size each active move; Recenter restores the whole story.
3. Only the trailing window of legs is drawn; future route is hidden; older legs fade.
4. Labels/markers glide rather than snap; no per-beat side-flipping.
5. The map is materially less cluttered (fewer forced visited markers).
6. The move card shows place thumbnails, gracefully hiding missing art.

Confirm dark mode and `prefers-reduced-motion` both behave (reduced motion opens on the static complete frame with no transitions).

---

## Self-Review notes (author checklist, already applied)

- **Spec coverage:** Finding 1 → Task 1; Finding 2 → Tasks 4+5; Finding 3 → Tasks 2+3; Finding 4 → Tasks 7 (jitter/hysteresis) + 8 (CSS snap); Finding 5 → Task 6 (+ emergent relief from 3/5); Finding 6 → Task 9. All six covered.
- **Type/name consistency:** `legVisibility`, `framedLegIndices`, `symbolRequired`, `frameLegs`/`frameStep`/`frameStory`, `frameStepRef`, `didMountRef`, `previousLabels`/`previous`, `PlaceThumb`, `.mapStoryLegPlace`/`.mapStoryPlaceThumb` are each defined once and referenced consistently across tasks.
- **Caller sweep:** `PLAYBACK_BUDGET_MS` and `playbackTiming` are referenced only in `MapStoryTile.js` and its test (verified via grep); Task 1 updates both. The `e2e/map-story-animation.spec.js` spec targets the full map page, not this tile, and is untouched.
- **Deliberate test changes are called out** (Task 1 rewrites the budget test; Tasks 2/4/6/7/9 add tests; Task 6 preserves the complete-frame contract). No `TODO`/placeholder steps; every code step includes the code.
