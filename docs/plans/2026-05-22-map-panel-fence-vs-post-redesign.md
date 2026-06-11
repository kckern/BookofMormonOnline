# Map Story Panel — Fence-vs-Post Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the story panel's tile-rooted row layout with an alternating posts ↔ fences structure where each move is a clickable fence card between two place-tile posts, and shared posts collapse to one element across continuous moves.

**Architecture:** A new `buildPanelItems(moves)` helper in `colors.js` emits a flat array of `{kind: 'post'|'fence', …, connectsBelow}` items. `MapStoryPanel` renders that array into alternating `<MapStoryPost>` and `<MapStoryFence>` components. Connector lines between items live as `::after` pseudo-elements on each item, suppressed at discontinuities via `connectsBelow=false`. Selection moves from row-clicks to fence-clicks; avatars-slide re-targets to fence refs.

**Tech Stack:** React 17 functional components + hooks, CSS variables for per-item run colors, Playwright e2e (no unit-test runner; verify via DOM/computed-style assertions).

**Related docs:**
- Spec: `docs/specs/2026-05-22-map-panel-fence-vs-post-redesign.md`
- Prior layout spec (now partially superseded): `docs/specs/2026-05-22-map-story-animation-and-participants.md` § 1
- Reference: `docs/reference/map-events-ux.md`

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `frontend/webapp/src/views/Map/colors.js` | modify | Add `buildPanelItems(moves)` next to existing `computeRuns`/`colorForRun`. |
| `frontend/webapp/src/views/Map/MapPanel.js` | modify | Replace `selectedStory.moves.map(...)` block in `MapStoryPanel` with `buildPanelItems(...).map(...)`. Add `MapStoryPost` and `MapStoryFence` local components. Re-target avatars slide measurement to `fenceRefs`. |
| `frontend/webapp/src/views/Map/Map.css` | modify | Add `.map_story_post`, `.map_story_fence`, `.map_story_fence.selected`, connector pseudo-elements, distance badge re-anchored to fence. Remove `.map_story_move`, `.map_story_move:hover`, `.map_story_move.selected`, `.map_story_move_desc` margin override, `.map_story_move_place`, `.map_story_terminus`, and the in-tile `.map_story_connector` span. |
| `frontend/webapp/src/views/Map/MapContents.js` | unchanged | Map-side rendering keys off `mapController.selectedMoveSeq` and `selectedStory.moves` — both unchanged. |
| `e2e/map-story-animation.spec.js` | modify | Update selectors (`.map_story_move` → `.map_story_fence`), delete `row layout` test, add alternation + posts-not-clickable tests. |

5 tasks total, each ending in a single commit. The full e2e suite should pass at the end of every task.

---

### Task 1: Add `buildPanelItems` helper + render alternating posts and fences

**Files:**
- Modify: `frontend/webapp/src/views/Map/colors.js` (append `buildPanelItems`)
- Modify: `frontend/webapp/src/views/Map/MapPanel.js` (replace moves.map block; add new components)
- Modify: `frontend/webapp/src/views/Map/Map.css` (add new selectors)
- Test: `e2e/map-story-animation.spec.js`

- [ ] **Step 1: Write the failing alternation test**

Open `e2e/map-story-animation.spec.js`. Replace the existing `"row layout: flex-end + desc negative margin"` test (which enforced the OLD coupling we're removing) with this new test:

```js
test("panel alternates post and fence, posts ≥ fences + 1", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/1");
  await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 15_000 });
  const sequence = await page.$$eval(
    ".mapPanel .map_story_post, .mapPanel .map_story_fence",
    (els) => els.map((e) => (e.classList.contains("map_story_post") ? "P" : "F")),
  );
  expect(sequence.length).toBeGreaterThan(0);
  expect(sequence[0]).toBe("P");
  expect(sequence[sequence.length - 1]).toBe("P");
  const postCount = sequence.filter((s) => s === "P").length;
  const fenceCount = sequence.filter((s) => s === "F").length;
  expect(postCount).toBeGreaterThanOrEqual(fenceCount + 1);
  // sons-of-mosiah has 14 moves; with at least one shared post, postCount is at most 15.
  expect(fenceCount).toBe(14);
  if (errors.length) throw new Error(errors.join("\n"));
});
```

- [ ] **Step 2: Update existing tests that reference `.map_story_move`**

In the same `e2e/map-story-animation.spec.js`, find and update:

- `"default selection: /story/X selects move 1"` — change `.mapPanel .map_story_move` (used to wait for the panel) to `.mapPanel .map_story_fence`. Change the `toHaveClass(/selected/)` assertion to assert on the first `.map_story_fence`.

- `"explicit selection: /story/X/move/3 selects row 3"` — change to assert by `data-seq` attribute:

```js
test("explicit selection: /story/X/move/3 selects fence with data-seq=3", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/3");
  const targetFence = page.locator(".mapPanel .map_story_fence[data-seq='3']");
  await expect(targetFence).toBeVisible({ timeout: 15_000 });
  await expect(targetFence).toHaveClass(/selected/);
  if (errors.length) throw new Error(errors.join("\n"));
});
```

- `"avatars slide: top changes when selection moves"` — replace the click target `.mapPanel .map_story_move.nth(2)` with `.mapPanel .map_story_fence[data-seq='3']`.

- `"panel tile outlines + connector use run colors"` — change first-row reference from `.map_story_move` to the first `.map_story_post`. Change tile selector inside from `.map_story_move_place` to `.map_story_post` itself. Change connector from `.map_story_connector` to `.map_story_post::after` measured via `evaluate((el) => getComputedStyle(el, '::after').backgroundColor)`. Change badge selector to `.mapPanel .map_story_fence .map_story_distance_badge` (badge moves onto the fence in Task 4; for this Step it's enough to leave the badge assertion failing temporarily — we'll re-anchor in Task 4).

For clarity, write the full new version of that test now:

```js
test("first post has run color #3b82f6 outline + connector", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/1");
  const firstPost = page.locator(".mapPanel .map_story_post").first();
  await expect(firstPost).toBeVisible({ timeout: 15_000 });
  const cssVar = await firstPost.evaluate((el) => getComputedStyle(el).getPropertyValue('--run-color').trim());
  expect(cssVar).toBe('#3b82f6');
  const outlineColor = await firstPost.evaluate((el) => getComputedStyle(el).outlineColor);
  expect(outlineColor).toBe('rgb(59, 130, 246)');
  if (errors.length) throw new Error(errors.join("\n"));
});
```

- Delete the older "panel tile outlines + connector use run colors" test (it's replaced by the above).

- `"only the active story's moves draw on the map"` — no change (asserts map-side state only).

- `"floating avatars render for the selected move"` — no change to selectors (`.map_story_avatars` still exists).

- [ ] **Step 3: Run tests to verify the new tests FAIL**

```bash
cd /home/bom/BookofMormonOnline/e2e
npx playwright test map-story-animation.spec.js --reporter=list
```

Expected: the new "panel alternates" test FAILS (no `.map_story_fence` element exists), the new "first post has run color" test FAILS, and one or two old tests fail because their selectors reference the renamed elements.

- [ ] **Step 4: Add `buildPanelItems` to `colors.js`**

Open `frontend/webapp/src/views/Map/colors.js`. Append:

```js
// Build the panel's alternating post/fence item list from a story's moves.
// Output shape:
//   [
//     { kind: 'post',  key, place, runColor, connectsBelow },
//     { kind: 'fence', key, move,  runColor, connectsBelow },
//     { kind: 'post',  key, place, runColor, connectsBelow },
//     ...
//   ]
// Rules:
//   - First post is moves[0].startPlace; last post is moves[N-1].endPlace.
//   - Between moves[i] and moves[i+1]: if endPlace.slug === next startPlace.slug,
//     emit ONE shared post; otherwise emit two posts back-to-back.
//   - connectsBelow=true ONLY when the next item is a fence (i.e., a continuous run
//     line should bridge across this item).
//   - Posts at the boundary of a discontinuity carry their OWN run's color.
export function buildPanelItems(moves) {
  if (!Array.isArray(moves) || moves.length === 0) return [];
  const runs = computeRuns(moves);
  const items = [];

  // First post (origin of move 0)
  items.push({
    kind: 'post',
    key: `p-start-${moves[0].startPlace.slug}-0`,
    place: moves[0].startPlace,
    runColor: colorForRun(runs[0].runIdx),
    connectsBelow: true, // followed by fence 0
  });

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const runIdx = runs[i].runIdx;
    const runColor = colorForRun(runIdx);

    items.push({
      kind: 'fence',
      key: `f-${m.seq}`,
      move: m,
      runColor,
      connectsBelow: true, // followed by the post for endPlace
    });

    const next = moves[i + 1];
    if (next && m.endPlace.slug === next.startPlace.slug) {
      // Shared post between moves[i] and moves[i+1]
      items.push({
        kind: 'post',
        key: `p-shared-${m.endPlace.slug}-${i}`,
        place: m.endPlace,
        runColor,
        connectsBelow: true, // followed by fence i+1
      });
    } else if (next) {
      // Discontinuity: emit two posts (end of this run, start of next run)
      items.push({
        kind: 'post',
        key: `p-end-${m.endPlace.slug}-${i}`,
        place: m.endPlace,
        runColor,
        connectsBelow: false, // followed by a post — no connector
      });
      items.push({
        kind: 'post',
        key: `p-start-${next.startPlace.slug}-${i + 1}`,
        place: next.startPlace,
        runColor: colorForRun(runs[i + 1].runIdx),
        connectsBelow: true, // followed by fence i+1
      });
    } else {
      // Last fence: emit terminus post (endPlace of the final move)
      items.push({
        kind: 'post',
        key: `p-terminus-${m.endPlace.slug}-${i}`,
        place: m.endPlace,
        runColor,
        connectsBelow: false, // last item
      });
    }
  }

  return items;
}
```

- [ ] **Step 5: Add `MapStoryPost` and `MapStoryFence` components in `MapPanel.js`**

Open `frontend/webapp/src/views/Map/MapPanel.js`. At the bottom of the file (alongside the existing `MapStoryAvatars` component), add:

```jsx
function MapStoryPost({ place, runColor, connectsBelow, refCallback }) {
  if (!place?.slug) return null;
  const label = (place?.label || place?.name)?.replace(/\//g, " ").replace(/ +/g, " ");
  return (
    <div
      className={`map_story_post${connectsBelow ? ' connects' : ''}`}
      style={{ '--run-color': runColor }}
      ref={refCallback || undefined}
    >
      <img src={`${assetUrl}/places/${place.slug}`} alt={place.slug} />
      <caption>{label}</caption>
    </div>
  );
}

function MapStoryFence({
  move,
  runColor,
  connectsBelow,
  isSelected,
  hideTravelers,
  miles,
  parserOptions,
  onClick,
  refCallback,
}) {
  const { seq, travelers, verse_ids, description, duration } = move;
  const lang = determineLanguage();
  const scriptureref = generateReference(verse_ids, lang);
  const ref = `<a className="scripture_link">${scriptureref}</a>`;
  const showHeader = !hideTravelers || !!duration;
  return (
    <div
      className={`map_story_fence${isSelected ? ' selected' : ''}${connectsBelow ? ' connects' : ''}`}
      style={{ '--run-color': runColor }}
      data-seq={seq}
      onClick={onClick}
      ref={refCallback || undefined}
    >
      <span className="map_story_distance_badge">{miles} mi</span>
      <div className="map_story_fence_body">
        {showHeader && (
          <p>
            {!hideTravelers && <b>{travelers}</b>}
            {!hideTravelers && !!duration && <span> • </span>}
            {!!duration && <span className="duration">{duration}</span>}
          </p>
        )}
        {Parser(`<p class='desc'>${description} (${ref})</p>`, parserOptions)}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Replace the moves.map block in `MapStoryPanel` with `buildPanelItems` iteration**

In `MapPanel.js`, locate the `MapStoryPanel` function. Find the moves render block — it currently looks like:

```jsx
{selectedStory.moves.map((move, i) => {
  // ... compute hideTravelers, runColor, isSelected, miles, etc.
  return <div className={`map_story_move${isSelected ? ' selected' : ''}`} ...>...</div>;
})}
{(() => {
  // terminus IIFE
})()}
```

Replace the entire block (the `.map(...)` PLUS the terminus IIFE) with:

```jsx
{(() => {
  const items = buildPanelItems(selectedStory.moves);
  let prevTravelers = null;
  return items.map((item, idx) => {
    if (item.kind === 'post') {
      return (
        <MapStoryPost
          key={item.key}
          place={item.place}
          runColor={item.runColor}
          connectsBelow={item.connectsBelow}
        />
      );
    }
    // fence
    const { move: m, runColor, connectsBelow } = item;
    const hideTravelers = m.travelers === prevTravelers;
    prevTravelers = m.travelers;
    const startPoint = [m.startPlace.lat, m.startPlace.lng];
    const endPoint = [m.endPlace.lat, m.endPlace.lng];
    const miles = metersToMiles(getDistance(startPoint, endPoint));
    const isSelected = mapController.selectedMoveSeq === m.seq;
    return (
      <MapStoryFence
        key={item.key}
        move={m}
        runColor={runColor}
        connectsBelow={connectsBelow}
        isSelected={isSelected}
        hideTravelers={hideTravelers}
        miles={miles}
        parserOptions={parserOptions}
        onClick={() => history.push(`/map/${currentMap?.slug}/story/${selectedStory.slug}/move/${m.seq}`)}
        refCallback={(el) => { if (el) fenceRefs.current[m.seq] = el; }}
      />
    );
  });
})()}
```

Also at the top of `MapStoryPanel`, add the new ref map alongside the existing `moveRefs`:

```js
const fenceRefs = useRef({});
```

(Keep `moveRefs` for now — the next task will swap consumers over and delete it.)

And update the imports near the top of `MapPanel.js`:

```js
import { computeRuns, colorForRun, buildPanelItems } from './colors';
```

- [ ] **Step 7: Add the new CSS for `.map_story_post`, `.map_story_fence`, and connectors**

Open `frontend/webapp/src/views/Map/Map.css`. Locate the existing `.map_story_move`, `.map_story_move_place`, `.map_story_connector`, `.map_story_terminus`, `.map_story_distance_badge` block (the run-color-aware rules we wrote earlier).

Replace that whole block with:

```css
/* Post = a place tile (4rem) */
.map_story_post {
  position: relative;
  width: 4rem;
  height: 4rem;
  margin: 0 auto;
  flex-shrink: 0;
  outline: 3px solid var(--run-color, transparent);
  outline-offset: 0;
  border-radius: 2px;
}
.map_story_post img {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.map_story_post caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #00000099;
  color: white;
  font-size: 0.7rem;
  line-height: 100%;
  padding: 2px;
  text-align: center;
  border-radius: 3px;
  letter-spacing: -0.5px;
}
/* Connector stub below post (when next item is a fence) */
.map_story_post.connects::after {
  content: '';
  display: block;
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 1rem;
  background-color: var(--run-color, #b8b8b8);
}

/* Fence = a move card */
.map_story_fence {
  position: relative;
  padding: 0.6rem 0.75rem 0.6rem 0.75rem;
  margin: 1rem 0;
  border-radius: 0.5rem;
  border: 1px solid #ddd;
  cursor: pointer;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
  background-color: #fff;
}
.map_story_fence:hover {
  background-color: #f4f3f3;
}
.map_story_fence.selected {
  background-color: #fff5d6;
  box-shadow: inset 0 0 0 2px #d4a92b;
}
/* Top and bottom connector stubs on the fence so the run line appears continuous */
.map_story_fence::before {
  content: '';
  display: block;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 1rem;
  background-color: var(--run-color, #b8b8b8);
}
.map_story_fence.connects::after {
  content: '';
  display: block;
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 1rem;
  background-color: var(--run-color, #b8b8b8);
}
.map_story_fence_body p {
  font-size: 1rem;
  margin: 0 1ex;
  line-height: 110%;
  font-size: small;
}
.map_story_fence_body p .duration {
  font-size: 0.7rem;
  color: #AAA;
  font-family: Arial;
  font-size: smaller;
}
.map_story_fence_body p.desc {
  font-size: 0.8rem;
  color: #444;
  text-align: left;
}

/* Distance badge — re-anchored to the top-right corner of the fence card */
.map_story_distance_badge {
  position: absolute;
  top: -0.6rem;
  right: 0.5rem;
  background-color: #fff;
  color: var(--run-color, #555);
  font-family: Arial, sans-serif;
  font-size: 0.65rem;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 1em;
  border: 1px solid var(--run-color, #b8b8b8);
  white-space: nowrap;
}

/* Discontinuity: two adjacent posts. Extra breathing room. */
.map_story_post + .map_story_post {
  margin-top: 0.5rem;
}
```

(The old `.map_story_terminus` block can be removed in Task 5 — leave for now so the diff stays scoped.)

- [ ] **Step 8: Run the e2e suite to verify all updated/new tests pass**

```bash
cd /home/bom/BookofMormonOnline/e2e
npx playwright test map-story-animation.spec.js --reporter=list
```

Expected: All tests pass (the alternation, first-post run-color, selection, avatars-render, avatars-slide, map-side tests). Old "row layout" test no longer exists. Note: the "panel tile outlines + connector use run colors" test was replaced with "first post has run color"; the badge-color portion is now slimmed down since the badge moved to the fence — Task 4 will re-add badge color assertion.

If any test still references `.map_story_move`, fix it now (the spec deletes that selector).

- [ ] **Step 9: Commit**

```bash
git add frontend/webapp/src/views/Map/colors.js frontend/webapp/src/views/Map/MapPanel.js frontend/webapp/src/views/Map/Map.css e2e/map-story-animation.spec.js
git commit -m "feat(map): alternate posts and fences in story panel (buildPanelItems)"
```

---

### Task 2: Posts are passive; fences are click targets

The fence's `onClick` is already wired in Task 1's render. This task adds the passive-post enforcement (CSS + a test to lock it in).

**Files:**
- Modify: `frontend/webapp/src/views/Map/Map.css` (cursor rules)
- Test: `e2e/map-story-animation.spec.js`

- [ ] **Step 1: Add the failing test**

Append to `e2e/map-story-animation.spec.js`:

```js
test("posts are not clickable; fences are", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/1");
  await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 15_000 });
  const postCursor = await page.locator(".mapPanel .map_story_post").first().evaluate(
    (el) => getComputedStyle(el).cursor,
  );
  expect(postCursor).not.toBe("pointer");
  const fenceCursor = await page.locator(".mapPanel .map_story_fence").first().evaluate(
    (el) => getComputedStyle(el).cursor,
  );
  expect(fenceCursor).toBe("pointer");
  if (errors.length) throw new Error(errors.join("\n"));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx playwright test map-story-animation.spec.js -g "posts are not clickable" --reporter=list
```

Expected: PASS if Task 1's CSS already gave posts default cursor (they don't have `cursor: pointer`) and gave fences `cursor: pointer`. If this passes, great — proceed to Step 4 commit.

If it fails (e.g., the inherited cursor unexpectedly resolves to "pointer" because of an ancestor rule like `.mapPanel { cursor: pointer }`), explicitly set `cursor: default` on the post in Step 3.

- [ ] **Step 3: If needed, explicitly set the post cursor**

In `frontend/webapp/src/views/Map/Map.css`, add to the `.map_story_post` block:

```css
.map_story_post {
  cursor: default;
}
```

Re-run the test.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Map/Map.css e2e/map-story-animation.spec.js
git commit -m "feat(map): assert post tiles are passive, fences are clickable"
```

---

### Task 3: Run-color connector continuity + discontinuity gap

This task verifies (and tightens) the connector line behavior introduced in Task 1: continuous within a run, absent at discontinuities, and tinted by the run color.

**Files:**
- Modify: `frontend/webapp/src/views/Map/Map.css` (only if Step 2 reveals an issue)
- Test: `e2e/map-story-animation.spec.js`

- [ ] **Step 1: Add the failing test**

Append to `e2e/map-story-animation.spec.js`:

```js
test("connector continuity: post.connects::after has run color, last post has no ::after", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/1");
  const firstPost = page.locator(".mapPanel .map_story_post").first();
  await expect(firstPost).toBeVisible({ timeout: 15_000 });
  // First post should have a colored connector (followed by fence 1).
  const firstAfterBg = await firstPost.evaluate(
    (el) => getComputedStyle(el, '::after').backgroundColor,
  );
  expect(firstAfterBg).toBe('rgb(59, 130, 246)');
  // Last post is the terminus — no ::after content.
  const lastPost = page.locator(".mapPanel .map_story_post").last();
  const lastAfterContent = await lastPost.evaluate(
    (el) => getComputedStyle(el, '::after').content,
  );
  // Browsers report no-content as 'none' when the rule doesn't apply.
  expect(lastAfterContent).toBe('none');
  if (errors.length) throw new Error(errors.join("\n"));
});
```

- [ ] **Step 2: Run test to verify it passes (Task 1's CSS should already satisfy it)**

```bash
npx playwright test map-story-animation.spec.js -g "connector continuity" --reporter=list
```

Expected: PASS. The `.map_story_post.connects::after` rule applies the colored stub; non-`.connects` posts have no `::after` content.

If it FAILS (e.g., the last post unexpectedly has `.connects` because `buildPanelItems` set `connectsBelow=true` incorrectly), debug `buildPanelItems` to ensure the last item gets `connectsBelow: false`.

- [ ] **Step 3: Add the badge re-anchor test**

```js
test("distance badge is anchored on the fence with run color", async ({ page }) => {
  const errors = attachConsole(page);
  await page.goto("/map/internal/story/sons-of-mosiah/move/1");
  const firstFence = page.locator(".mapPanel .map_story_fence").first();
  await expect(firstFence).toBeVisible({ timeout: 15_000 });
  const badge = firstFence.locator(".map_story_distance_badge");
  await expect(badge).toHaveCount(1);
  const borderColor = await badge.evaluate((el) => getComputedStyle(el).borderColor);
  expect(borderColor).toBe('rgb(59, 130, 246)');
  if (errors.length) throw new Error(errors.join("\n"));
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx playwright test map-story-animation.spec.js -g "distance badge" --reporter=list
```

Expected: PASS. Task 1 already placed the badge inside the fence and styled it with `var(--run-color)`.

- [ ] **Step 5: Run the full suite to confirm no regressions**

```bash
npx playwright test map-story-animation.spec.js --reporter=list
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add e2e/map-story-animation.spec.js
git commit -m "test(map): connector continuity + fence-anchored distance badge"
```

---

### Task 4: Avatars-slide re-targets to `fenceRefs`

The floating `MapStoryAvatars` div slides to follow the selected row's `offsetTop`. After Task 1, the selected element is a fence, not a row. Re-target the measurement.

**Files:**
- Modify: `frontend/webapp/src/views/Map/MapPanel.js` (effect measuring `top`; delete `moveRefs`)
- Test: `e2e/map-story-animation.spec.js` (existing "avatars slide" already updated in Task 1; verify it still passes)

- [ ] **Step 1: Update the measurement effect in `MapStoryPanel`**

Open `frontend/webapp/src/views/Map/MapPanel.js`. Find the existing `useEffect` that measures `top` for the avatars div. It looks like:

```js
useEffect(() => {
  const seq = mapController.selectedMoveSeq;
  if (!seq) return;
  const row = moveRefs.current[seq];
  const container = cardBodyRef.current;
  if (!row || !container) return;
  const top = row.offsetTop + row.offsetHeight - 28;
  setAvatarTop(top);
}, [mapController.selectedMoveSeq, selectedStory?.slug]);
```

Replace `moveRefs.current[seq]` with `fenceRefs.current[seq]`, and update the formula to vertically-center the avatars on the fence:

```js
useEffect(() => {
  const seq = mapController.selectedMoveSeq;
  if (!seq) return;
  const fence = fenceRefs.current[seq];
  const container = cardBodyRef.current;
  if (!fence || !container) return;
  // Vertically center the 28px avatar row on the fence card.
  const top = fence.offsetTop + fence.offsetHeight / 2 - 14;
  setAvatarTop(top);
}, [mapController.selectedMoveSeq, selectedStory?.slug]);
```

- [ ] **Step 2: Delete the now-unused `moveRefs` declaration**

In the same `MapStoryPanel`, find:

```js
const moveRefs = useRef({});
```

Delete it. The previous task's `refCallback={(el) => { if (el) fenceRefs.current[m.seq] = el; }}` already populates the right ref.

Also, the existing `scrollIntoView` effect (the one that scrolls a selected move into view on URL change) reads `moveRefs.current[seq]`. Update it the same way:

```js
useEffect(() => {
  const seq = mapController.selectedMoveSeq;
  if (!seq) return;
  const fence = fenceRefs.current[seq];
  if (!fence) return;
  fence.scrollIntoView({ behavior: 'smooth', block: 'center' });
}, [mapController.selectedMoveSeq, selectedStory?.slug]);
```

- [ ] **Step 3: Run the full suite**

```bash
cd /home/bom/BookofMormonOnline/e2e
npx playwright test map-story-animation.spec.js --reporter=list
```

Expected: ALL tests pass, including "avatars slide: top changes when selection moves" (re-targeted by Task 1's test edits).

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Map/MapPanel.js
git commit -m "feat(map): retarget avatar slide + scroll-into-view to fenceRefs"
```

---

### Task 5: Delete obsolete CSS classes

Clean up the now-dead styles from the old row-based layout.

**Files:**
- Modify: `frontend/webapp/src/views/Map/Map.css` (deletions only)
- Test: `e2e/map-story-animation.spec.js` (no test changes; full suite must remain green)

- [ ] **Step 1: Identify obsolete classes**

In `frontend/webapp/src/views/Map/Map.css`, find and DELETE the following blocks (they're orphaned after Tasks 1–4):

- `.map_story_move` (the row container)
- `.map_story_move:hover`
- `.map_story_move.selected`
- `.map_story_move_desc` (and its descendants `.map_story_move_desc p`, `.map_story_move_desc p .distance, .map_story_move_desc p .duration`, `.map_story_move_desc p.desc`)
- `.map_story_move img`
- `.map_story_move_place` (and `.map_story_move_place caption`)
- `.map_story_connector` (the old in-tile span)
- `.map_story_terminus`

Note: keep `.map_story` (the multi-story list card) — it's used elsewhere.

- [ ] **Step 2: Confirm no JS still references the deleted classes**

```bash
grep -rn "map_story_move\|map_story_terminus\|map_story_connector\b" /home/bom/BookofMormonOnline/frontend/webapp/src /home/bom/BookofMormonOnline/e2e
```

Expected: no matches in `frontend/webapp/src/` (Tasks 1–4 removed all usages). Some matches MAY appear in `e2e/` if a test still uses one of these — fix those references (replace with the new selectors) before continuing.

- [ ] **Step 3: Run the full suite**

```bash
cd /home/bom/BookofMormonOnline/e2e
npx playwright test map-story-animation.spec.js --reporter=list
```

Expected: ALL tests still pass — deletions are pure cleanup of dead CSS.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Map/Map.css
git commit -m "chore(map): remove dead row-based CSS after panel redesign"
```

---

## Self-Review

**Spec coverage:**
- § 1 Layout & DOM structure → Task 1 (Steps 4-6: `buildPanelItems`, components, render block).
- § 2 Discontinuity & runs → Task 1 (Step 4 `buildPanelItems` discontinuity branch) + Task 3 (connector continuity test).
- § 3 Selection & interaction → Task 1 (fence `onClick`, `data-seq`, `.selected` class) + Task 2 (post passive) + Task 4 (avatars slide).
- § 4 Migration → Tasks 1, 4, 5 cumulatively. E2E test updates in Task 1 Step 2.

**Placeholder scan:** No "TBD", "TODO", or vague phrasing. Each step includes either exact code, exact selector, or exact command.

**Type consistency:**
- `buildPanelItems` defined in Task 1 Step 4; consumed in Task 1 Step 6.
- `MapStoryPost` / `MapStoryFence` defined in Task 1 Step 5; consumed in Task 1 Step 6.
- `fenceRefs` introduced in Task 1 Step 6; consumed in Task 4 Steps 1-2.
- `--run-color` CSS variable: set in both `MapStoryPost` and `MapStoryFence` (Task 1 Step 5); read by Task 1 Step 7 CSS (outline, badge, connector).
- `data-seq` attribute: set on fences in Task 1 Step 5; selector used in Task 1 Step 2's updated test for explicit selection.
- Class names consistent: `.map_story_post`, `.map_story_fence`, `.map_story_fence.selected`, `.map_story_fence_body`, `.map_story_distance_badge` (in fence).
