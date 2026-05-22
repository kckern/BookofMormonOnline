# Map Story — Participants + Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add participant avatars and a perpetually-moving walker animation to the map story panel + map view, with the selected move driving both panel-row highlight and on-map segment animation.

**Architecture:** A single `selectedMoveSeq` value (URL-derived, defaults to 1) drives the panel's `.selected` row, a floating avatars `<div>` that slides between rows on selection change, and an OpenLayers segment layer + HTML `Overlay` walker on the map. The walker is positioned by a `requestAnimationFrame` loop interpolating between the segment's two endpoints; the segment line marches via OL's `postrender` callback advancing `lineDashOffset`.

**Tech Stack:** React 17 + Redux, OpenLayers (`ol/*`), Playwright for e2e, CRA dev server on `localhost:8200` (HMR; restart required only for webpack config changes).

**Related docs:**
- Spec: `docs/specs/2026-05-22-map-story-animation-and-participants.md`
- Reference: `docs/reference/map-events-ux.md`
- Prior spec: `docs/specs/2026-05-22-map-event-url-routes.md`

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `frontend/webapp/src/views/Map/Map.js` | modify | Derive `selectedMoveSeq` (default 1), expose on `mapController` |
| `frontend/webapp/src/views/Map/MapPanel.js` | modify | Drop per-row inline avatar plan, render single floating `MapStoryAvatars`, measure + animate top |
| `frontend/webapp/src/views/Map/MapContents.js` | modify | Segment layer, marching ants, view fit, walker overlay + rAF, tear-down, `window.__mapDebug` exposure |
| `frontend/webapp/src/views/Map/Map.css` | modify | `align-items: flex-end`, desc negative margin, `.map_story_avatars`, `.map_story_walker`, transitions |
| `e2e/map-story-animation.spec.js` | create | Playwright e2e: avatars present + slide, walker present + animates, tear-down on back-nav |

Single Route, single Map instance (preserved from prior work) — selection changes must not unmount/remount.

---

### Task 1: Plumb `selectedMoveSeq` through `mapController` with default = 1

**Files:**
- Modify: `frontend/webapp/src/views/Map/Map.js:113-139`
- Modify: `frontend/webapp/src/views/Map/MapPanel.js:510` (the `isSelected` line in the moves map)
- Test: `e2e/map-story-animation.spec.js`

- [ ] **Step 1: Create e2e file with default-selection test**

```js
const { test, expect } = require("@playwright/test");

const IGNORED = [/Invalid DOM property/, /validateDOMNesting/];

function attachConsole(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (IGNORED.some((p) => p.test(t))) return;
    errors.push(`console.error: ${t}`);
  });
  return errors;
}

test("default selection: /story/X selects move 1", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/ammonites");
  const firstRow = page.locator(".mapPanel .map_story_move").first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  await expect(firstRow).toHaveClass(/selected/);
  if (errors.length) throw new Error(errors.join("\n"));
});

test("explicit selection: /story/X/move/3 selects row 3", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/ammonites/move/3");
  const rows = page.locator(".mapPanel .map_story_move");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  // Row at array index 2 = seq 3 (1-indexed).
  await expect(rows.nth(2)).toHaveClass(/selected/);
  if (errors.length) throw new Error(errors.join("\n"));
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/bom/BookofMormonOnline/e2e
npx playwright test map-story-animation.spec.js --reporter=list
```

Expected: first test FAILS (row not `.selected` because nothing defaults seq to 1 yet); second test PASSES (existing `moveSeq === seq` logic already works for explicit URL).

- [ ] **Step 3: Add `selectedMoveSeq` to `mapController` in `Map.js`**

In `frontend/webapp/src/views/Map/Map.js`, replace the existing `mapController` object's `moveSeq` line with a derived selected seq alongside:

```js
const moveSeqParam = params.moveSeq ? parseInt(params.moveSeq, 10) : null;
```

Add to the `mapController` object literal (right after `setMapCenter` and the existing `storySlug` / `moveSeq` lines):

```js
    storySlug: params.storySlug || null,
    moveSeq: moveSeqParam,
    selectedMoveSeq: moveSeqParam ?? 1,
```

Replace the standalone `parseInt` call on the `moveSeq` field with the new variable so both fields reference the same source.

- [ ] **Step 4: Use `selectedMoveSeq` in MapPanel.js**

In `frontend/webapp/src/views/Map/MapPanel.js`, locate the line inside the moves `.map` callback:

```js
const isSelected = moveSeq === seq;
```

Replace with:

```js
const isSelected = mapController.selectedMoveSeq === seq;
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx playwright test map-story-animation.spec.js --reporter=list
```

Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Map/Map.js frontend/webapp/src/views/Map/MapPanel.js e2e/map-story-animation.spec.js
git commit -m "feat(map): default selectedMoveSeq to 1 when story has no move param"
```

---

### Task 2: Row-layout CSS (flex-end + desc negative margin)

**Files:**
- Modify: `frontend/webapp/src/views/Map/Map.css` (the `.map_story_move` and `.map_story_move_desc` blocks)
- Test: `e2e/map-story-animation.spec.js`

- [ ] **Step 1: Write failing test asserting computed styles**

Append to `e2e/map-story-animation.spec.js`:

```js
test("row layout: flex-end + desc negative margin", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/ammonites");
  const firstRow = page.locator(".mapPanel .map_story_move").first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  const rowAlignItems = await firstRow.evaluate((el) => getComputedStyle(el).alignItems);
  expect(rowAlignItems).toBe("flex-end");
  const descMarginBottom = await firstRow
    .locator(".map_story_move_desc")
    .evaluate((el) => getComputedStyle(el).marginBottom);
  // -1rem at default 16px root font → "-16px"
  expect(descMarginBottom).toBe("-16px");
  if (errors.length) throw new Error(errors.join("\n"));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx playwright test map-story-animation.spec.js -g "row layout" --reporter=list
```

Expected: FAIL on `alignItems` (current value is `flex-start`).

- [ ] **Step 3: Update CSS in `Map.css`**

In `frontend/webapp/src/views/Map/Map.css`, replace the existing `.map_story_move` rule:

```css
.map_story_move{
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}
```

with:

```css
.map_story_move{
  display: flex;
  justify-content: flex-start;
  align-items: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}
```

And in the same file, replace:

```css
.map_story_move_desc{
  display: flex;
  flex-direction: column;
}
```

with:

```css
.map_story_move_desc{
  display: flex;
  flex-direction: column;
  margin-bottom: -1rem;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx playwright test map-story-animation.spec.js -g "row layout" --reporter=list
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Map/Map.css e2e/map-story-animation.spec.js
git commit -m "feat(map): bottom-anchor story rows + drop desc into connector gap"
```

---

### Task 3: Render `MapStoryAvatars` (floating div) inside `CardBody`

**Files:**
- Modify: `frontend/webapp/src/views/Map/MapPanel.js` (inside `MapStoryPanel`'s `<CardBody>`)
- Modify: `frontend/webapp/src/views/Map/Map.css` (add `.map_story_avatars` block)
- Test: `e2e/map-story-animation.spec.js`

- [ ] **Step 1: Write failing test asserting avatar presence**

Append to `e2e/map-story-animation.spec.js`:

```js
test("floating avatars render for the selected move", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/ammonites");
  const avatars = page.locator(".mapPanel .map_story_avatars");
  await expect(avatars).toHaveCount(1, { timeout: 15_000 });
  const imgs = avatars.locator("img");
  const imgCount = await imgs.count();
  expect(imgCount).toBeGreaterThanOrEqual(1);
  // Each img must point at /people/<slug>
  const srcs = await imgs.evaluateAll((els) => els.map((e) => e.getAttribute("src") || ""));
  for (const s of srcs) expect(s).toMatch(/\/people\//);
  if (errors.length) throw new Error(errors.join("\n"));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx playwright test map-story-animation.spec.js -g "floating avatars" --reporter=list
```

Expected: FAIL with "expected 1, got 0" (no such element yet).

- [ ] **Step 3: Locate `MapStoryPanel`'s CardBody and the moves block in `MapPanel.js`**

Search for the `<CardBody>` inside `MapStoryPanel` (the function definition near the bottom of the file). It contains:

```jsx
<CardBody>
    <p>{selectedStory.description}</p>
    <h6>{moveCount} Movements</h6>
    {selectedStory.moves.map(...)}
    {(() => { ... terminus ... })()}
</CardBody>
```

- [ ] **Step 4: Add `<MapStoryAvatars>` render inside `MapStoryPanel`**

Inside the same `MapStoryPanel` function, ABOVE the `return` statement, compute the selected move and its people:

```jsx
const selectedMoveSeq = mapController.selectedMoveSeq;
const selectedMove = selectedStory.moves.find((m) => m.seq === selectedMoveSeq) || selectedStory.moves[0];
const selectedPeople = selectedMove?.people || [];
```

Inside the `<CardBody>` JSX, AFTER the terminus block and BEFORE the closing `</CardBody>`, add:

```jsx
<MapStoryAvatars people={selectedPeople} />
```

- [ ] **Step 5: Define `MapStoryAvatars` component**

At the bottom of `MapPanel.js` (next to the existing `MapEventImageCaption` definition), add:

```jsx
function MapStoryAvatars({people}) {
  if (!people?.length) return null;
  return (
    <div className="map_story_avatars" aria-hidden="true">
      {people.map((p) => (
        <img
          key={p.slug}
          src={`${assetUrl}/people/${p.slug}`}
          alt={p.name || p.slug}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Add CSS for `.map_story_avatars`**

Add to `frontend/webapp/src/views/Map/Map.css`, AFTER the existing `.map_story_terminus` block:

```css
.map_story_avatars{
  position: absolute;
  right: 0.75rem;
  display: flex;
  gap: -0.4rem;
  pointer-events: none;
}
.map_story_avatars img{
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.25);
  object-fit: cover;
  background: #ddd;
  margin-left: -0.5rem;
}
.map_story_avatars img:first-child{
  margin-left: 0;
}
```

The card body itself needs `position: relative` so the absolute positioning is scoped. Add (or extend) the existing block — check whether `.mapPanel .card-body` or `.mapPanelCardContainer .card-body` already exists; if not, append:

```css
.mapPanelCardContainer .card-body{
  position: relative;
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npx playwright test map-story-animation.spec.js -g "floating avatars" --reporter=list
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/webapp/src/views/Map/MapPanel.js frontend/webapp/src/views/Map/Map.css e2e/map-story-animation.spec.js
git commit -m "feat(map): render floating participant avatars for selected move"
```

---

### Task 4: Slide avatars on selection change

**Files:**
- Modify: `frontend/webapp/src/views/Map/MapPanel.js` (add measurement effect + ref)
- Modify: `frontend/webapp/src/views/Map/Map.css` (add `top` transition)
- Test: `e2e/map-story-animation.spec.js`

- [ ] **Step 1: Write failing test asserting top changes between selections**

Append to `e2e/map-story-animation.spec.js`:

```js
test("avatars slide: top changes when selection moves", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/ammonites");
  const avatars = page.locator(".mapPanel .map_story_avatars");
  await expect(avatars).toBeVisible({ timeout: 15_000 });
  // Default selection: move 1.
  const topAt1 = await avatars.evaluate((el) => el.getBoundingClientRect().top);
  // Click move 3.
  await page.locator(".mapPanel .map_story_move").nth(2).click();
  await expect(page).toHaveURL(/\/move\/3$/);
  // Allow slide transition (0.4s) to finish.
  await page.waitForTimeout(700);
  const topAt3 = await avatars.evaluate((el) => el.getBoundingClientRect().top);
  expect(topAt3).toBeGreaterThan(topAt1);
  if (errors.length) throw new Error(errors.join("\n"));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx playwright test map-story-animation.spec.js -g "avatars slide" --reporter=list
```

Expected: FAIL — `topAt3` is the same as `topAt1` because the avatars div has no dynamic positioning yet (it just sits at the bottom of CardBody).

- [ ] **Step 3: Add `useRef`/`useState` plumbing in `MapStoryPanel`**

In `frontend/webapp/src/views/Map/MapPanel.js` `MapStoryPanel`, near the existing `moveRefs` declaration, add a ref for the card body and state for avatar top:

```js
const cardBodyRef = useRef(null);
const [avatarTop, setAvatarTop] = useState(0);
```

- [ ] **Step 4: Attach `cardBodyRef` to `CardBody`**

Find the existing `<CardBody>` element in `MapStoryPanel` and add the ref:

```jsx
<CardBody innerRef={cardBodyRef}>
```

Reactstrap's `CardBody` (used elsewhere in this file) accepts `innerRef`. If `innerRef` doesn't expose the DOM node (older reactstrap versions), fall back to wrapping the body content in a `<div ref={cardBodyRef}>` inside `<CardBody>` and computing offsets relative to that.

- [ ] **Step 5: Add measurement effect after `useEffect` for moveSeq scroll**

Place this effect right after the existing `useEffect` that does `scrollIntoView` for `moveSeq`:

```js
useEffect(() => {
  const seq = mapController.selectedMoveSeq;
  if (!seq) return;
  const row = moveRefs.current[seq];
  const container = cardBodyRef.current;
  if (!row || !container) return;
  // offsetTop of row relative to the card body (its offsetParent should be it,
  // assuming we set position: relative on .card-body in Task 3).
  const top = row.offsetTop + row.offsetHeight - 28; // bottom-align: row bottom minus avatar height
  setAvatarTop(top);
}, [mapController.selectedMoveSeq, selectedStory?.slug]);
```

- [ ] **Step 6: Pass `avatarTop` to the avatars component**

Update the render call from Task 3 to forward the top:

```jsx
<MapStoryAvatars people={selectedPeople} top={avatarTop} />
```

And update the component definition:

```jsx
function MapStoryAvatars({people, top}) {
  if (!people?.length) return null;
  return (
    <div className="map_story_avatars" aria-hidden="true" style={{ top }}>
      {people.map((p) => (
        <img
          key={p.slug}
          src={`${assetUrl}/people/${p.slug}`}
          alt={p.name || p.slug}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Add `top` transition in CSS**

In `frontend/webapp/src/views/Map/Map.css`, locate the `.map_story_avatars` block from Task 3 and add `transition`:

```css
.map_story_avatars{
  position: absolute;
  right: 0.75rem;
  display: flex;
  gap: -0.4rem;
  pointer-events: none;
  transition: top 0.4s ease;
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx playwright test map-story-animation.spec.js -g "avatars slide" --reporter=list
```

Expected: PASS. If reactstrap's `innerRef` didn't expose the DOM ref, switch to the wrap-div fallback noted in Step 4.

- [ ] **Step 9: Commit**

```bash
git add frontend/webapp/src/views/Map/MapPanel.js frontend/webapp/src/views/Map/Map.css e2e/map-story-animation.spec.js
git commit -m "feat(map): slide floating avatars to selected row's offsetTop"
```

---

### Task 5: Segment LineString layer with marching ants

**Files:**
- Modify: `frontend/webapp/src/views/Map/MapContents.js`
- Test: `e2e/map-story-animation.spec.js`

- [ ] **Step 1: Write failing test asserting segment is active via debug exposure**

Append to `e2e/map-story-animation.spec.js`:

```js
test("segment layer active when a move is selected", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/ammonites");
  // Wait for the map to mount and for the URL effect to set selectedMoveSeq=1.
  await expect(page.locator(".mapPanel .map_story_move").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(800);
  const debug = await page.evaluate(() => window.__mapDebug);
  expect(debug, "window.__mapDebug should be exposed").toBeTruthy();
  expect(debug.segmentFeatureCount).toBe(1);
  // Marching ants should be advancing the offset.
  const o1 = await page.evaluate(() => window.__mapDebug.lineDashOffset);
  await page.waitForTimeout(400);
  const o2 = await page.evaluate(() => window.__mapDebug.lineDashOffset);
  expect(o2).not.toBe(o1);
  if (errors.length) throw new Error(errors.join("\n"));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx playwright test map-story-animation.spec.js -g "segment layer" --reporter=list
```

Expected: FAIL — `window.__mapDebug` undefined.

- [ ] **Step 3: Add segment refs and debug object at the top of `MapContents`**

In `frontend/webapp/src/views/Map/MapContents.js`, at the top of the `MapContents` component function (after the existing `useRef` declarations for `mapElement` and `map`), add:

```js
const segmentLayerRef = useRef(null);
const segmentLineRef = useRef(null);
const lineDashOffsetRef = useRef(0);
```

- [ ] **Step 4: Build the segment layer once during `drawMap`**

In `frontend/webapp/src/views/Map/MapContents.js`, inside the existing `drawMap` function (where `map.current.addLayer(...)` is called for the markers and the empty-features line layer), append a new layer specifically for the selected segment:

```js
const segmentSource = new VectorSource({ features: [] });
const segmentLayer = new VectorLayer({
  source: segmentSource,
  style: () => new Style({
    stroke: new Stroke({
      color: '#b31312',
      width: 3,
      lineDash: [8, 8],
      lineDashOffset: lineDashOffsetRef.current,
    }),
  }),
});
segmentLayer.setZIndex(100);
map.current.addLayer(segmentLayer);
segmentLayerRef.current = segmentLayer;

// Marching ants: advance the dash offset every postrender.
map.current.on('postrender', () => {
  if (!segmentSource.getFeatures().length) return;
  lineDashOffsetRef.current = (lineDashOffsetRef.current - 0.5) % 16;
  segmentLayer.changed();
});
```

- [ ] **Step 5: Add an effect that updates the segment when `selectedMoveSeq` changes**

In the same `MapContents` component (outside `drawMap`, as a separate `useEffect`), add:

```js
useEffect(() => {
  const seq = mapController.selectedMoveSeq;
  const story = mapController.selectedStory;
  const segmentLayer = segmentLayerRef.current;
  if (!map.current || !segmentLayer) return;
  const source = segmentLayer.getSource();
  source.clear();
  segmentLineRef.current = null;
  if (!story || !seq) {
    window.__mapDebug = { segmentFeatureCount: 0, lineDashOffset: lineDashOffsetRef.current };
    return;
  }
  const move = story.moves.find((m) => m.seq === seq);
  if (!move) {
    window.__mapDebug = { segmentFeatureCount: 0, lineDashOffset: lineDashOffsetRef.current };
    return;
  }
  const start = OlProj.fromLonLat([move.startPlace.lat, move.startPlace.lng]);
  const end = OlProj.fromLonLat([move.endPlace.lat, move.endPlace.lng]);
  const line = new Feature({ geometry: new LineString([start, end]) });
  source.addFeature(line);
  segmentLineRef.current = line;
  window.__mapDebug = {
    segmentFeatureCount: source.getFeatures().length,
    get lineDashOffset() { return lineDashOffsetRef.current; },
  };
}, [mapController.selectedMoveSeq, mapController.selectedStory?.slug]);
```

Note: `mapController.selectedStory` is exposed by `MapPanel` (existing line `mapController.selectedStory = selectedStory`). This effect lives in `MapContents` which receives the same `mapController` prop, so it sees the same value.

- [ ] **Step 6: Run test to verify it passes**

```bash
npx playwright test map-story-animation.spec.js -g "segment layer" --reporter=list
```

Expected: PASS. Both `segmentFeatureCount === 1` and `lineDashOffset` changes between samples.

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Map/MapContents.js e2e/map-story-animation.spec.js
git commit -m "feat(map): draw selected move's segment with marching-ants stroke"
```

---

### Task 6: Auto-fit map view to selected segment

**Files:**
- Modify: `frontend/webapp/src/views/Map/MapContents.js`
- Test: `e2e/map-story-animation.spec.js`

- [ ] **Step 1: Write failing test asserting view re-centers across moves**

Append to `e2e/map-story-animation.spec.js`:

```js
test("view auto-fits to the selected segment", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/ammonites");
  await expect(page.locator(".mapPanel .map_story_move").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(900); // allow fit animation
  const center1 = await page.evaluate(() => window.__mapDebug?.viewCenter);
  // Click move 5.
  await page.locator(".mapPanel .map_story_move").nth(4).click();
  await expect(page).toHaveURL(/\/move\/5$/);
  await page.waitForTimeout(900);
  const center2 = await page.evaluate(() => window.__mapDebug?.viewCenter);
  expect(center1).toBeTruthy();
  expect(center2).toBeTruthy();
  // Centers should differ (different move = different segment midpoint).
  expect(center1[0] !== center2[0] || center1[1] !== center2[1]).toBe(true);
  if (errors.length) throw new Error(errors.join("\n"));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx playwright test map-story-animation.spec.js -g "view auto-fits" --reporter=list
```

Expected: FAIL — `viewCenter` undefined; view is not re-centering on selection.

- [ ] **Step 3: Add `view.fit` to the segment effect in `MapContents.js`**

Inside the `useEffect` added in Task 5, AFTER `source.addFeature(line)` and BEFORE the `window.__mapDebug = ...` assignment, add:

```js
const extent = line.getGeometry().getExtent();
map.current.getView().fit(extent, {
  duration: 500,
  padding: [80, 80, 80, 80],
  maxZoom: currentMap?.maxzoom,
});
```

- [ ] **Step 4: Expose `viewCenter` in the debug object**

Update the `window.__mapDebug` assignment in the same effect to include the post-fit center (read lazily so the fit animation can complete):

```js
window.__mapDebug = {
  segmentFeatureCount: source.getFeatures().length,
  get lineDashOffset() { return lineDashOffsetRef.current; },
  get viewCenter() { return map.current?.getView().getCenter() || null; },
};
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx playwright test map-story-animation.spec.js -g "view auto-fits" --reporter=list
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Map/MapContents.js e2e/map-story-animation.spec.js
git commit -m "feat(map): auto-fit view to selected segment with padding"
```

---

### Task 7: Walker overlay with rAF animation

**Files:**
- Modify: `frontend/webapp/src/views/Map/MapContents.js` (add `ol/Overlay` import + walker logic)
- Modify: `frontend/webapp/src/views/Map/Map.css` (`.map_story_walker` styles)
- Test: `e2e/map-story-animation.spec.js`

- [ ] **Step 1: Write failing test asserting walker appears and moves**

Append to `e2e/map-story-animation.spec.js`:

```js
test("walker overlay appears and moves along the segment", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/ammonites");
  const walker = page.locator(".map_story_walker");
  await expect(walker).toBeVisible({ timeout: 15_000 });
  // Walker uses an ol/Overlay which positions its container via `transform`
  // on the wrapping ol-overlay element. Read transform across frames.
  const wrapper = page.locator(".ol-overlay-container").filter({ has: walker });
  const t1 = await wrapper.evaluate((el) => el.style.transform);
  await page.waitForTimeout(500);
  const t2 = await wrapper.evaluate((el) => el.style.transform);
  expect(t1).not.toBe(t2);
  if (errors.length) throw new Error(errors.join("\n"));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx playwright test map-story-animation.spec.js -g "walker overlay" --reporter=list
```

Expected: FAIL — `.map_story_walker` doesn't exist yet.

- [ ] **Step 3: Add `Overlay` import to `MapContents.js`**

In `frontend/webapp/src/views/Map/MapContents.js`, add to the existing OL imports near the top of the file:

```js
import Overlay from 'ol/Overlay';
```

- [ ] **Step 4: Add walker refs**

Near the other `useRef` declarations in `MapContents`, add:

```js
const walkerOverlayRef = useRef(null);
const walkerRafRef = useRef(null);
const walkerStartRef = useRef(0);
```

- [ ] **Step 5: Create the walker overlay during `drawMap`**

Inside `drawMap`, AFTER the segment layer setup from Task 5, add:

```js
const walkerEl = document.createElement('div');
walkerEl.className = 'map_story_walker';
walkerEl.innerHTML = '<img alt="" />';
const walkerOverlay = new Overlay({
  element: walkerEl,
  positioning: 'center-center',
  stopEvent: false,
});
map.current.addOverlay(walkerOverlay);
walkerOverlayRef.current = walkerOverlay;
walkerOverlay.setPosition(undefined); // hidden until a segment is selected
```

- [ ] **Step 6: Drive the walker via rAF inside the segment effect**

Replace the body of the segment `useEffect` (from Task 5 + Task 6) with the version that also starts/stops the rAF loop. The full effect should be:

```js
useEffect(() => {
  const seq = mapController.selectedMoveSeq;
  const story = mapController.selectedStory;
  const segmentLayer = segmentLayerRef.current;
  const walkerOverlay = walkerOverlayRef.current;
  if (!map.current || !segmentLayer || !walkerOverlay) return;

  // Stop any in-flight walker.
  if (walkerRafRef.current) {
    cancelAnimationFrame(walkerRafRef.current);
    walkerRafRef.current = null;
  }
  walkerOverlay.setPosition(undefined);

  const source = segmentLayer.getSource();
  source.clear();
  segmentLineRef.current = null;

  const noActiveSegment = () => {
    window.__mapDebug = {
      segmentFeatureCount: 0,
      get lineDashOffset() { return lineDashOffsetRef.current; },
      get viewCenter() { return map.current?.getView().getCenter() || null; },
    };
  };

  if (!story || !seq) { noActiveSegment(); return; }
  const move = story.moves.find((m) => m.seq === seq);
  if (!move) { noActiveSegment(); return; }

  const start = OlProj.fromLonLat([move.startPlace.lat, move.startPlace.lng]);
  const end = OlProj.fromLonLat([move.endPlace.lat, move.endPlace.lng]);
  const line = new Feature({ geometry: new LineString([start, end]) });
  source.addFeature(line);
  segmentLineRef.current = line;

  const extent = line.getGeometry().getExtent();
  map.current.getView().fit(extent, {
    duration: 500,
    padding: [80, 80, 80, 80],
    maxZoom: currentMap?.maxzoom,
  });

  // Walker image: first person on the move, or fallback to a generic dot.
  const hero = move.people?.[0];
  const img = walkerOverlay.getElement().querySelector('img');
  if (hero?.slug) {
    img.src = `${assetUrl}/people/${hero.slug}`;
    img.style.display = '';
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
  }

  const DURATION_MS = 4000;
  walkerStartRef.current = performance.now();
  const tick = (now) => {
    const t = ((now - walkerStartRef.current) % DURATION_MS) / DURATION_MS;
    const pos = [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
    walkerOverlay.setPosition(pos);
    walkerRafRef.current = requestAnimationFrame(tick);
  };
  walkerRafRef.current = requestAnimationFrame(tick);

  window.__mapDebug = {
    segmentFeatureCount: source.getFeatures().length,
    get lineDashOffset() { return lineDashOffsetRef.current; },
    get viewCenter() { return map.current?.getView().getCenter() || null; },
  };

  return () => {
    if (walkerRafRef.current) {
      cancelAnimationFrame(walkerRafRef.current);
      walkerRafRef.current = null;
    }
    walkerOverlay.setPosition(undefined);
  };
}, [mapController.selectedMoveSeq, mapController.selectedStory?.slug]);
```

Make sure to import `assetUrl` at the top of `MapContents.js` if not already imported. It's already there (`import { assetUrl } from "../../models/BoMOnlineAPI"`).

- [ ] **Step 7: Add CSS for `.map_story_walker`**

Append to `frontend/webapp/src/views/Map/Map.css`:

```css
.map_story_walker{
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid #fff;
  box-shadow: 0 0 0 2px #b31312, 0 2px 6px rgba(0,0,0,0.35);
  overflow: hidden;
  background: #ddd;
  pointer-events: none;
}
.map_story_walker img{
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx playwright test map-story-animation.spec.js -g "walker overlay" --reporter=list
```

Expected: PASS. The `transform` style on `.ol-overlay-container` will change as `walkerOverlay.setPosition` runs each frame.

- [ ] **Step 9: Commit**

```bash
git add frontend/webapp/src/views/Map/MapContents.js frontend/webapp/src/views/Map/Map.css e2e/map-story-animation.spec.js
git commit -m "feat(map): perpetually animate walker avatar along selected segment"
```

---

### Task 8: Tear-down on story close

**Files:**
- Modify: `frontend/webapp/src/views/Map/MapContents.js`
- Test: `e2e/map-story-animation.spec.js`

- [ ] **Step 1: Write failing test asserting walker hidden after back-nav**

Append to `e2e/map-story-animation.spec.js`:

```js
test("walker hides + segment clears when story closes", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/ammonites/move/2");
  const walker = page.locator(".map_story_walker");
  await expect(walker).toBeVisible({ timeout: 15_000 });
  // Click the back arrow (⬅) to leave the story.
  await page.locator(".mapPanel span", { hasText: "⬅" }).first().click();
  // URL goes back to a /place/ URL.
  await expect(page).toHaveURL(/\/place\//, { timeout: 5_000 });
  await page.waitForTimeout(400);
  const debug = await page.evaluate(() => window.__mapDebug);
  expect(debug.segmentFeatureCount).toBe(0);
  // Walker's overlay wrapper exists but is positioned undefined → not visible.
  const walkerVisible = await walker.isVisible().catch(() => false);
  expect(walkerVisible).toBe(false);
  if (errors.length) throw new Error(errors.join("\n"));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx playwright test map-story-animation.spec.js -g "walker hides" --reporter=list
```

Expected: This may already PASS if Task 7's cleanup logic runs (`walkerOverlay.setPosition(undefined)` + clear features when `story` is falsy). But it may FAIL on the `walker.isVisible()` check because OL Overlays remain in the DOM and only `visibility/transform` changes when `setPosition(undefined)`. If it fails, proceed; if it passes, continue to Step 5 (commit) without changes.

- [ ] **Step 3: If failing, hide the walker DOM explicitly when no segment**

In `frontend/webapp/src/views/Map/MapContents.js` inside the segment effect, in the early-return paths (no story or no move), AFTER `walkerOverlay.setPosition(undefined)`, also toggle visibility:

```js
walkerOverlay.getElement().style.display = 'none';
```

And in the success path (segment exists), set:

```js
walkerOverlay.getElement().style.display = '';
```

Place the `display = ''` line right before the `walkerStartRef.current = performance.now();` line (so it's reset before each new animation start).

- [ ] **Step 4: Run test to verify it passes**

```bash
npx playwright test map-story-animation.spec.js -g "walker hides" --reporter=list
```

Expected: PASS.

- [ ] **Step 5: Run the full e2e suite to verify no regressions**

```bash
npx playwright test --reporter=list
```

Expected: all map-event-url and map-story-animation tests PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Map/MapContents.js e2e/map-story-animation.spec.js
git commit -m "feat(map): hide walker + clear segment when story closes"
```

---

## Self-Review

**Spec coverage:**
- Section 1 (panel layout): Task 2 (flex-end + negative margin), Task 3 (floating avatars render), Task 4 (slide).
- Section 2 (default selection + URL): Task 1.
- Section 3 (map animation): Task 5 (segment + ants), Task 6 (view fit), Task 7 (walker rAF), Task 8 (tear-down).
- Travelers header collapse rule preserved (unchanged from prior work — already in code).
- Tear-down covered in Task 8.

**Placeholder scan:** No "TBD" / "TODO" / vague language. Every step has either exact code, exact command, or both.

**Type consistency:**
- `mapController.selectedMoveSeq` introduced in Task 1, consumed in Tasks 4, 5, 6, 7.
- `mapController.selectedStory` is pre-existing (set in `MapPanel.js`), consumed in Tasks 5, 7.
- Refs `segmentLayerRef`, `segmentLineRef`, `lineDashOffsetRef`, `walkerOverlayRef`, `walkerRafRef`, `walkerStartRef` declared in Task 5/Task 7, consumed only inside `MapContents`.
- `window.__mapDebug` shape consistent: `segmentFeatureCount`, `lineDashOffset` (getter), `viewCenter` (getter from Task 6 onward).
- `.map_story_avatars` class introduced in Task 3, `top` style added in Task 4.
- `.map_story_walker` class introduced in Task 7.
