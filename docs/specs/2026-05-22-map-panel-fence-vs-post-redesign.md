# Map Story Panel — Fence-vs-Post Redesign

**Status:** approved 2026-05-22
**Supersedes:** the row layout described in `docs/specs/2026-05-22-map-story-animation-and-participants.md` § 1
**Related:** `docs/reference/map-events-ux.md`, `colors.js`

## Problem

The story panel today renders one row per move:

```
[place A tile]  [description of A → B move]
        │
[place B tile]  [description of B → C move]
        │
…
```

Each row is anchored on a *place* (a **post**) but the row's content describes a *transition* (a **fence**). The atomic data unit is the move (the fence), but the visual unit is the place tile (the post). This mismatch is the user-perceived "fencepost problem" — clicking a row to select a move conceptually skews because the row visually represents a place, not a transition.

## Goal

Restructure the panel so the **visual unit matches the data unit**: alternate posts and fences vertically, with each fence representing exactly one move and each post representing exactly one place. Shared posts (where move N's endPlace equals move N+1's startPlace) render once and are owned by both adjacent fences. Discontinuities surface naturally as two adjacent posts with no fence between them.

## Section 1 — Layout & DOM structure

The panel emits a flat list of two-component types, alternating from posts:

```
[post]      moves[0].startPlace
 [fence]    moves[0]
[post]      moves[0].endPlace (== moves[1].startPlace if continuous)
 [fence]    moves[1]
[post]      moves[1].endPlace (== moves[2].startPlace if continuous)
…
[post]      moves[N-1].endPlace (terminus)
```

A helper `buildPanelItems(moves)` returns an array of items:

```ts
type PanelItem =
  | { kind: 'post'; key: string; place: Place; runColor: string }
  | { kind: 'fence'; key: string; move: MapMove; runColor: string };
```

For each adjacent pair `(moves[i], moves[i+1])`:
- If `moves[i].endPlace.slug === moves[i+1].startPlace.slug` → emit ONE shared post between them.
- Otherwise → emit two adjacent posts (moves[i].endPlace, then moves[i+1].startPlace).

The first post is always `moves[0].startPlace`. The last post is always `moves[N-1].endPlace`. Posts are keyed by `${runIdx}-${place.slug}-${edge}` where `edge ∈ {'start', 'end'}` to disambiguate when the same place appears twice in non-shared positions across the story.

### New components (local to `MapPanel.js`)

- **`MapStoryPost({ place, runColor, refCallback })`** — renders a 4rem × 4rem place tile with caption, identical visual to today's `.map_story_move_place`. Includes a vertical line stub below (sized to bridge to the next item). The CSS variable `--run-color: <runColor>` is set on the outer element so the tile outline and stub color match.
- **`MapStoryFence({ move, runColor, isSelected, hideTravelers, distanceMiles, parserOptions, scriptureLinkSetter, onClick, refCallback })`** — renders the move's content: travelers header (unless `hideTravelers`), description, distance pill, scripture ref. Highlighted when `isSelected`. Calls `onClick` (a `history.push` to that move's URL). `--run-color: <runColor>` set on the outer element.

### Components removed

- `.map_story_move` row (the current tile + desc combined row) — replaced by the alternating post/fence emission above.
- `.map_story_terminus` — the last post IS the terminus; no separate type needed.
- `.map_story_move_place` as a row child — replaced by the post-component's tile element.

### Connectors

Within a contiguous run, a single visual vertical line links all consecutive items (post → fence → post → fence → …) with the run's color. Implementation: each post emits a 2rem-tall `<span class="map_story_post_connector" />` after the tile (positioned via flex with `align-self: center`), styled with `background-color: var(--run-color)`. Each fence has a small top and bottom connector stub matching the same color and width, giving a continuous line illusion.

Discontinuity (two adjacent posts, no fence between): the upper post's connector stub is **omitted** when its `place.slug !== nextItem.place.slug`. The downstream post then opens with no incoming line. This is the discontinuity cue.

## Section 2 — Discontinuity & runs

`computeRuns(story.moves)` (already in `colors.js`) gives `[{move, runIdx}, …]`. The build pass for `buildPanelItems`:

- The first post inherits `runIdx` of `moves[0]`.
- Each fence inherits `runIdx` of its move.
- A **shared post** between `moves[i]` and `moves[i+1]` (continuous) inherits the run's color — both fences are in the same run by definition, so there's no ambiguity.
- A **non-shared post pair** at a discontinuity: the *upper* post belongs to `moves[i]`'s run (it's that run's terminus); the *lower* post belongs to `moves[i+1]`'s run (its origin). Each post carries its own `runColor`.

Layout:
- Continuous gap between items: ~0.25rem (the connector spans through).
- Discontinuity gap between two adjacent non-shared posts: ~0.75rem (visual breath room, no connector).

The color jump combined with the missing connector is the discontinuity signal. No extra "jump" arrow, dashed bridge, or annotation.

## Section 3 — Selection & interaction

- **Click target = fence only.** Posts have no `cursor: pointer`, no click handler, no role. They are passive labels.
- **Selected fence**: gets `.selected` class. Existing CSS (yellow tint, gold inset border) ports over to `.map_story_fence.selected`.
- **URL**: unchanged. `/map/:mapType/story/:storySlug/move/:seq`. Default-to-1 and auto-`history.replace` to `/move/1` on cold story-load remain.
- **Avatars docking**: `MapStoryAvatars` (the floating div on the right of CardBody) keeps its existing slide behavior but the `top` measurement keys off the **selected fence's** ref instead of the selected row's ref. Formula: `fence.offsetTop + fence.offsetHeight / 2 - 14` (vertical-center the 28px avatar row on the fence).
- **Map side (MapContents.js)**: no changes. Walker, segment, static lines, view-fit, force-show all already key off `selectedMoveSeq` and `selectedStory.moves`.

## Section 4 — Migration

### Stays (no changes)

- `colors.js` — `STORY_RUN_COLORS`, `computeRuns`, `colorForRun`.
- `MapPanel.js` URL effect — sets `selectedStory`, defaults `panelContents.slug` to first move's startPlace, `history.replace` to `/move/1`.
- `MapContents.js` — segment layer, walker feature/animation, view-fit, force-show, all `__mapDebug` exposure.
- `MapStoryAvatars` component itself — only the `top` measurement input element changes.
- Travelers-header collapse rule — hidden when `move.travelers === prevMove.travelers`. Same rule, evaluated per fence pair instead of per move-row pair.

### Goes / changes

- `MapStoryPanel`'s body — the JSX `{moves.map(...)}` block plus the terminus IIFE are replaced by `buildPanelItems(moves).map(...)` producing `<MapStoryPost />` or `<MapStoryFence />` per item.
- `moveRefs` (currently keyed by `seq` → `.map_story_move` element) — split into `fenceRefs` (keyed by `seq` → `.map_story_fence` element). Used by both scroll-into-view and avatars-`top` measurement.
- `Map.css`:
  - Remove `.map_story_move`, `.map_story_move:hover`, `.map_story_move.selected`, `.map_story_move_desc` (margin-bottom override).
  - Remove `.map_story_move_place` (its tile styling moves into `.map_story_post`).
  - Remove `.map_story_terminus`.
  - Remove `.map_story_connector` (the in-tile span) and `.map_story_distance_badge`'s connector-anchored positioning.
  - Add `.map_story_post` (4rem tile + caption + bottom-connector stub).
  - Add `.map_story_fence` (card; default + `.selected` styles; top + bottom connector stubs).
  - Add `.map_story_post_connector` and `.map_story_fence_connector_top` / `.map_story_fence_connector_bottom` (the vertical-line continuity).
  - Add `.map_story_distance_badge` re-anchored to the fence card (not the connector span).

### E2E test updates (`e2e/map-story-animation.spec.js`)

- `default selection: /story/X selects move 1` — change `.mapPanel .map_story_move.first()` → `.mapPanel .map_story_fence.first()`.
- `explicit selection: /story/X/move/3 selects row 3` — change to assert `.map_story_fence` with attribute `data-seq="3"` is `.selected`. Add a `data-seq={seq}` attribute on each fence to support this without index math.
- `row layout: flex-end + desc negative margin` — DELETE. This test enforced the OLD layout-coupling between tile and desc that we're abandoning. Replace with `panel layout: posts and fences alternate` asserting the DOM order.
- `floating avatars render for the selected move` — selector `.mapPanel .map_story_avatars` still works (component unchanged). Verify `<img>` count still ≥ 1.
- `avatars slide: top changes when selection moves` — same logic; now measurement is relative to fence elements; assertion still passes if slide happens.
- `panel tile outlines + connector use run colors` — selector adjusts: outline on `.map_story_post` (not `.map_story_move_place`); badge selector adjusts.
- All map-side tests (segment count, walker coords, view fit, story-lines count, URL replace) — UNCHANGED.

New tests to add:

```js
test("panel alternates post → fence → post → fence", async ({ page }) => {
  await page.goto("/map/internal/story/sons-of-mosiah/move/1");
  await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 15_000 });
  const sequence = await page.$$eval(
    ".mapPanel .map_story_post, .mapPanel .map_story_fence",
    (els) => els.map((e) => (e.classList.contains("map_story_post") ? "P" : "F"))
  );
  // First and last are posts; alternation in between (with possible PP for discontinuities).
  expect(sequence[0]).toBe("P");
  expect(sequence[sequence.length - 1]).toBe("P");
  // Posts > fences by exactly 1 within a single contiguous run; for multi-run
  // stories, posts >= fences + 1.
  const postCount = sequence.filter((s) => s === "P").length;
  const fenceCount = sequence.filter((s) => s === "F").length;
  expect(postCount).toBeGreaterThanOrEqual(fenceCount + 1);
});

test("posts are not clickable; fences are", async ({ page }) => {
  await page.goto("/map/internal/story/sons-of-mosiah/move/1");
  await expect(page.locator(".mapPanel .map_story_fence").first()).toBeVisible({ timeout: 15_000 });
  const postCursor = await page.locator(".mapPanel .map_story_post").first().evaluate((el) => getComputedStyle(el).cursor);
  expect(postCursor).not.toBe("pointer");
  const fenceCursor = await page.locator(".mapPanel .map_story_fence").first().evaluate((el) => getComputedStyle(el).cursor);
  expect(fenceCursor).toBe("pointer");
});
```

## Out of scope

- Changing the map-side rendering or animations.
- Adding "jump" indicators or annotations at discontinuities (color change + missing connector is the cue).
- Making posts clickable / navigable to place detail (passive labels).
- Mobile layout — story panel remains desktop-only.
- Adjusting the URL scheme (still `/move/:seq`).

## Verification

- Type-check + existing tests still pass: `cd /home/bom/BookofMormonOnline/e2e && npx playwright test --reporter=list`.
- Visual check on `bom.kckern.net/map/internal/story/sons-of-mosiah/move/1`:
  - Alternating posts ↔ fences, vertical lines colored by run.
  - Selecting move 3 highlights the third fence; avatars slide to its right side.
  - Run-color jumps appear at discontinuities (visible by side-by-side stacked posts of different colors).
- Map-side visuals (walker, segment, static lines, view-fit) unchanged.
