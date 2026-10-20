# Home Tiles Production Readiness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every Home/Discover tile up to the audit rubric and the tile standard, pass a blind review (no P0/P1, gestalt ≥ 3), and deploy to prod.

**Architecture:**
- Shared primitives come first, so every tile adopts one implementation:
  - per-tile error boundary
  - CTA vocabulary
  - reversible reveal
  - button RefPill
  - phone-sheet ScripturePopup
  - `TileImage` with `srcset`
  - sizing, focus and contrast tokens
- Then the P0s and destination/history fixes.
- Then per-family tile fixes, run in parallel worktrees.
- Then thumbnail variants, then a blind review loop, then deploy.

**Tech Stack:**
- React 19 + react-router 7 on Vite (`frontend/webapp`).
- Vitest + Testing Library.
- Playwright for live captures, using the harness in `scripts/home-audit/`.
- `sharp` for image variants.
- The GraphQL backend lives in `backend/`.

**Spec:** `docs/specs/2026-10-15-home-tiles-production-readiness.md`
**Findings:** `docs/audits/2026-10-15-home-discover-tile-audit.md`. Sections:
- R1: page level
- R2.2: cross-cutting
- R2.3: inconsistencies
- R2.5: per tile
- R3: destinations

## Global Constraints

- Pass bar for every tile: zero P0/P1, and Craft, Beauty and Belonging each ≥ 3 in the blind review.
- House style:
  - Links are black.
  - Secondary UI is neutral gray.
  - Gold `#c9a24b` is the sole accent.
  - No blue anywhere, including `#345496`, light-blue dark-mode tints and blue focus rings.
- Layer-2 CTA verbs, sentence case only:
  - "Read more" / "Show less" for Layer 1
  - "See in context" for links into Read
  - "Open \<name\>" for entity pages
  - "View all" for indexes
  - "Explore" for map or story
- Tap targets are ≥ 44px on touch (`(pointer: coarse)`).
- Meta and eyebrow text contrast is ≥ 4.5:1 in light and dark.
- No horizontal overflow at 390, 820 or 1440px. No silent `max-height` clipping.
- A tile deeplink adds exactly one history entry. Canonicalizing redirects use `replace`.
- The repo is public, so never commit:
  - secrets
  - internal IPs
  - real user content (community names/messages, user notes text)
  - screenshots (`docs/audits/home-discover-audit-2026-10-15/` is gitignored)
- Never print secret values. Fetch and consume them in one pipe.
- Outward-facing steps need KC's explicit confirmation at that moment:
  - the prod S3 media upload (Task 11)
  - prod DB label rows (Task 12)
  - the prod deploy (Task 15)
- Dev frontend is Vite on :8201, proxied by Next on :8200. Verify against `http://localhost:8201`.
- Bouncing `bom-dev` is authorized. Note any restart in reports.
- Tests run with `cd frontend/webapp && npx vitest run <path>`. The whole suite must stay green; baseline is 1368 passed, 6 skipped.

## Review Focus

1. **Infinite batches render the same tile components with a different payload.**
   - Every standardized tile must behave identically when it is an `infiniteTile`: no duplicate ids, keys or seeds across batches.
   - Pinned by a Sampler test that renders two batches (Task 3).
2. **Tile data with null or short fields.**
   - Cases: no image, a one-line description, zero refs, a missing `slug`.
   - Expected: the tile collapses or degrades with no shell, no `undefined`, no broken image.
   - Pinned per family by an "empty and minimal payload" test (Tasks 10a–10h).
3. **Keyboard-only use.**
   - Every CTA, RefPill and card is reachable with Tab and has a gold focus ring.
   - A popup opened by keyboard traps focus and returns it on close.
   - Pinned by the ScripturePopup test (Task 6) and the RefPill test (Task 5).
4. **Back after a destination that redirects or canonicalizes.**
   - Cases: Read slug, Study, map pin, matters group.
   - Expected: one Back returns to Home with the same tiles and scroll.
   - Pinned by the `routeHistory` unit tests (Task 8) and the live verify script (Task 13).
5. **`prefers-reduced-motion: reduce`.**
   - Expected: no hover lift, no MapStory autoplay, no animated reveals.
   - Pinned by the CSS test in Task 7 and the MapStory test in Task 10h.

---

## Phase 0 — Tooling

### Task 0: Move the capture harness into the repo, and add a rubric-only extract

**Files:**
- Create: `scripts/home-audit/tileharness.mjs`, copied from the session harness.
  - `BASE` is env-configurable (default `http://localhost:8201`).
  - `OUT` defaults to `docs/audits/home-discover-audit-2026-10-15/` (gitignored).
  - Playwright import: `../../frontend/next/node_modules/playwright/index.mjs`.
  - Context option `serviceWorkers: "block"`, because the SW hides requests from `page.route`.
- Create: `scripts/home-audit/pagepass.mjs`, the page-level pass from R1. `BASE` and `OUT` come from env.
- Create: `scripts/home-audit/verify-back.mjs`. It checks Back restore, tab round-trip and People position. `VP` and `SEL` come from env.
- Create: `scripts/home-audit/verify-feedend.mjs`, the forced batch failure → terminus → Retry check.
- Create: `scripts/home-audit/rubric-blind.md`.
  - Contents: §1, §2 and §4 of the audit doc, verbatim, plus the C4 rule with row 3 as settled in R3 (entity → page, per spec).
  - No results, findings, spec or plan.
- Create: `scripts/home-audit/README.md` with how to run each script, plus the privacy rules (mask `.tile-community`; never commit captures).

- [ ] Copy the four session scripts into `scripts/home-audit/`, replacing absolute scratchpad paths with `new URL(..., import.meta.url)`-relative paths and env overrides.
- [ ] Write `rubric-blind.md` by extracting the sections. Grep to confirm that no "Results", "R1", "R2" or "R3" text leaked in: `grep -nE "^## R[0-9]|Results" scripts/home-audit/rubric-blind.md` should print nothing.
- [ ] Smoke-run `node scripts/home-audit/verify-back.mjs`. Expected output: `people top:` and `same tiles: true`.
- [ ] Commit: `chore(home-audit): capture harness + blind rubric extract in repo`.

## Phase 1 — P0s

### Task 1: MapStory — stop `ol/Map` shadowing the global `Map` (P0, M2)

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/MapStoryTileInner.js`. Change the import `Map from "ol/Map"` to `OlMap`, and update every OpenLayers usage. `new Map()` used as a keyed collection then refers to the JS `Map`.
- Test: `frontend/webapp/src/views/Home/tiles/__tests__/MapStoryTile.test.js`.

**Interfaces:** none new.

- [ ] **Step 1: Write the failing test.** Append to `MapStoryTile.test.js`:

```js
import fs from "node:fs";
import path from "node:path";
test("MapStoryTileInner never shadows the global Map", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../MapStoryTileInner.js"), "utf8");
  expect(src).not.toMatch(/import\s+Map\s+from\s+["']ol\/Map["']/);
  expect(src).toMatch(/import\s+OlMap\s+from\s+["']ol\/Map["']/);
});
```

- [ ] **Step 2:** Run `npx vitest run src/views/Home/tiles/__tests__/MapStoryTile.test.js`. Expected: FAIL.
- [ ] **Step 3:** Rename the import to `OlMap`. Find every place that builds an OL map with `new Map({ ... target ... })` (they pass `layers`/`view`) and change those to `new OlMap(...)`. Leave `new Map()` with no OL options as-is: those are the keyed collections in `overlayNodesRef` and `regNode`.
- [ ] **Step 4:** Re-run the test file. Expected: PASS. Live check with `node scripts/home-audit/pagepass.mjs`: the errors list must not contain `map.delete is not a function`.
- [ ] **Step 5:** Commit: `fix(home): MapStory — ol/Map no longer shadows global Map (P0)`.

### Task 2: Matters group routes (P0, D5)

**Files:**
- Modify: `frontend/webapp/src/models/Routes.js:268-275`. Add a `/matters/:group(narrative|material|concepts)` route that renders the Matters index, filtered to the group, and place it before `/matters/:matterSlug`. react-router 7 has no regex params, so use explicit routes `/matters/narrative`, `/matters/material` and `/matters/concepts`, each listed before the slug route.
- Modify: `frontend/webapp/src/views/Matters/Matters.js`. Accept a `group` prop and pre-filter to that group using the canonical three-group taxonomy (branch × specificity). Show a section heading and count.
- Test: create `frontend/webapp/src/models/__tests__/Routes.matters.test.js`.

**Interfaces:**
- Produces: `<Matters group="narrative"|"material"|"concept" />`.
- The URL keyword `concepts` maps to the `concept` group key.

- [ ] **Step 1: Failing test.**

```js
import { routes } from "src/models/Routes";
const find = (p) => routes.find((r) => r.path === p);
test.each(["/matters/narrative", "/matters/material", "/matters/concepts"])("%s routes to the Matters index, before the slug route", (p) => {
  const i = routes.findIndex((r) => r.path === p);
  const slug = routes.findIndex((r) => r.path === "/matters/:matterSlug");
  expect(i).toBeGreaterThanOrEqual(0);
  expect(i).toBeLessThan(slug);
});
```

  First read `Routes.js` to see what it exports (the `routes` array name and the `path` key). Adapt the accessor in the test to match.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Add the three routes with `element`/`component` matching the existing Matters route entry, passing `group`. In `Matters.js`, filter the loaded list by group using the same branch × specificity rule `homesampler` uses for `mattersNarrative`/`mattersMaterial`/`mattersConcept`. Grep `backend/src` for `mattersNarrative` to copy the predicate exactly.
- [ ] **Step 4:** Tests pass. Live: `/matters/narrative`, `/matters/material` and `/matters/concepts` each render a filtered index with a heading, not "Not found".
- [ ] **Step 5:** Commit: `fix(matters): group view-all routes render the filtered index (P0)`.

## Phase 2 — Shared primitives (sequential; each family task depends on these)

### Task 3: Per-tile error boundary + skeleton sizing table

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/_ds/TileBoundary.js`.
- Create: `frontend/webapp/src/views/Home/tiles/_ds/skeletonHeights.js`.
- Modify: `frontend/webapp/src/views/Home/Sampler.js`:
  - wrap the `<Tile>` in `renderTile`, `renderReserve` and `renderBatchTile` with `<TileBoundary tileKey>`
  - give skeleton divs `style={{ minHeight }}` from the table
- Modify: `Sampler.css`, removing the per-span skeleton min-heights that the table replaces.
- Test: `frontend/webapp/src/views/Home/__tests__/Sampler.boundary.test.js`.

**Interfaces:**
- Produces: `TileBoundary({ tileKey, children })`. On error it renders `null` and reports through `console.warn("tile crashed:", tileKey, error)`.
- Produces: `skeletonHeight(spanClass: string, single: boolean): string`, a CSS length.

- [ ] **Step 1: Failing test.** Render `<Sampler/>` with a mocked payload where a registry tile component is replaced, via `vi.mock("../tiles/registry")`, by one that throws. Expect the other tiles to still render, and expect `container.querySelectorAll(".tile").length` to equal the ready count minus 1. Add a second test that renders two infinite batches by seeding `sessionStorage` through `writeSession` with two batches, and expects no duplicate React keys: spy on `console.error` for "same key".
- [ ] **Step 2:** Run it. Expected: FAIL. The throw unmounts the grid.
- [ ] **Step 3:** Implement `TileBoundary` as a class component (`getDerivedStateFromError` → `{ failed: true }`; `render` → `failed ? null : children`). For `skeletonHeights.js`, measure real heights from the R2.3 note and `pagepass.json`, then encode a map keyed by span class, for example `{ "tile-readingplan": "233px", "tile-people": "680px", "tile-mattersNarrative": "373px", "tile-matterProfile": "430px", … }`, with phone overrides. The fallback is `"14rem"`. Apply it to every skeleton div.
- [ ] **Step 4:** Tests pass, and the whole Home suite passes.
- [ ] **Step 5:** Commit: `feat(home): per-tile error boundary + measured skeleton heights`.

### Task 4: CTA vocabulary, reversible reveal, tap targets, focus ring

**Files:**
- Modify: `tiles/_ds/TileCTA.js`. Add the `verb` prop with values `"readMore" | "showLess" | "seeInContext" | "open" | "viewAll" | "explore"`, mapped to `label()` keys with sentence-case fallbacks via `labelOr`.
- Create: `tiles/_ds/labelOr.js`. Move `labelOr` here out of `Sampler.js` and import it in both places.
- Modify: `tiles/ExpandableText.js`. Make it reversible: after expanding, render a "Show less" TileCTA. Keep focus on the toggle button across states by using one button whose label changes, not unmount and remount. `aria-expanded` reflects the state.
- Modify: `tiles/_ds/TileDeepLink.js`. Accept `verb` (default `"seeInContext"`) and `name` (used by `open`).
- Modify: `Sampler.css`. Add these rules:
  - `.tileCTA { min-height: 44px }` under `@media (pointer: coarse)`.
  - A gold `:focus-visible` ring for `.sampler a, .sampler button, .sampler [tabindex]`: `outline: 2px solid #c9a24b; outline-offset: 2px`.
  - Remove the UA ring and the tap highlight.
- Test: update `__tests__/ExpandableText.test.js`; create `tiles/_ds/__tests__/TileCTA.test.js`.

**Interfaces:**
- Produces: `TileCTA({ variant, verb?, name?, to?, onClick?, children?, ... })`. When `children` is passed it wins over `verb`.
- Produces: `labelOr(key: string, fallback: string): string`.
- Verb → key/fallback map:
  - `readMore` → `read_more` / "Read more"
  - `showLess` → `show_less` / "Show less"
  - `seeInContext` → `view_in_context` / "See in context"
  - `open` → `open_x` / "Open $1"
  - `viewAll` → `view_all` / "View all"
  - `explore` → `explore` / "Explore"

- [ ] **Step 1: Failing tests.**
  - ExpandableText: after clicking "Read more", the same button shows "Show less" and has `aria-expanded="true"`. Clicking again collapses it. `document.activeElement` stays on the button throughout.
  - TileCTA: `verb="viewAll"` renders "View all", and `verb="open" name="Nephi"` renders "Open Nephi".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Labels with a known DB key (`read_more`, `view_in_context`, `view_all`) use it, and the fallback is used only when the key is missing. `show_less`, `open_x` and `explore` get rows in Task 12.
- [ ] **Step 4:** The tests pass. `twoLayerCompliance.test.js` still passes.
- [ ] **Step 5:** Commit: `feat(home): CTA verb vocabulary, reversible reveal, focus + tap-target tokens`.

### Task 5: RefPill becomes a real `<button>`, never inside an `<a>`

**Files:**
- Modify: `tiles/RefPill.js`. Render `<button type="button" className="scripture_link …">`, keeping `preventDefault` and `stopPropagation`.
- Modify: `Sampler.css`. Reset button chrome on `.sampler .scripture_link` (font, border and padding inherit the pill style).
- Create: `tiles/__tests__/refPillPlacement.test.js`. It is a static check: for every tile file, parse the JSX text and fail if `<RefPill` appears lexically inside a `<Link` or `<a` element.
  - Implementation: a small depth tracker over a regex token stream of `<Link|<a |</Link>|</a>|<RefPill`, ignoring self-closing tags.
  - Families fix any violations in Phase 4. Until then, list the current violators in an `ALLOW` set with a `// Task 10x` comment.
- Test: update `RefPill` render tests if any exist (grep `__tests__` for RefPill).

**Interfaces:**
- Produces: `RefPill({ refText, className })`, unchanged signature, now a button.

- [ ] Step 1: Write the placement test and run it. It is expected to FAIL and list the violators. Copy the violators into `ALLOW`.
- [ ] Step 2: Write a render test: `RefPill` renders a `button` with an accessible name equal to the ref, and clicking it calls `openScripture` (mock `./ScripturePopup`). Run it. Expected: FAIL.
- [ ] Step 3: Implement the button.
- [ ] Step 4: Both tests pass.
- [ ] Step 5: Commit: `feat(home): RefPill is a native button; placement guard`.

### Task 6: ScripturePopup — phone sheet, focus management, verse duplication bug

**Files:**
- Modify: `frontend/webapp/src/views/_Common/ScripturePopup.js` (153 lines) and its CSS (grep for the class names it uses).
- Test: create `frontend/webapp/src/views/_Common/__tests__/ScripturePopup.test.js`.

**Interfaces:**
- Consumes: `openScripture(ref, opts)`, unchanged.
- Produces: the dialog has `role="dialog"`, `aria-modal="true"` and `aria-labelledby` pointing at the title. Focus moves into the dialog on open, is trapped while open, and returns to the opener on close. Body scroll is locked while open. Esc and backdrop clicks close it.
- On phone (≤ 900px) the dialog is a bottom sheet: `left: 0; right: 0; bottom: 0; width: 100%; max-height: 85vh`, with the close button in its header, inside the viewport.

- [ ] Step 1: Failing tests.
  - (a) After `openScripture("Helaman 1:1-4")` with a mocked verse fetch, verse 1 appears exactly once. Mock the API to return the real shape. To get that shape, capture one live response with curl against `:8201/graphql/en` (no secrets involved), then check how the superscription and verses are concatenated (R2.2, D5 P1).
  - (b) A multi-range ref such as `"Alma 32:21, 27"` renders both ranges and repeats no verse.
  - (c) Focus moves into the dialog and comes back to the opener after Esc.
- [ ] Step 2: Run. Expected: FAIL.
- [ ] Step 3: Fix the merge logic that duplicates verse 1 and drops the second range. Add the focus trap (reuse `views/_Common/AppModal/useModalA11y.js` if its API fits: it already handles `lockScroll` and focus restore). Add the phone sheet CSS.
- [ ] Step 4: The tests pass. Live phone capture: the sheet is fully on-screen and the close button is visible (`F3`).
- [ ] Step 5: Commit: `fix(popup): scripture popup verse merge, focus trap, phone bottom sheet`.

### Task 7: TileImage, responsive and visual tokens

**Files:**
- Create: `tiles/_ds/TileImage.js`.
- Create: `tiles/_ds/mediaVariants.js`.
- Modify: `Sampler.css`:
  - hover lift only on `a.samplerCard`, `a.tile-link` and similar, and disabled under `prefers-reduced-motion`
  - meta/eyebrow colors moved to tokens `--tile-meta: #6b6b6b` and `--tile-eyebrow: #6b6b6b` (≥ 4.5:1 on white)
  - dark tokens with neutral gray and gold only, replacing the light-blue `rgba(147,198,239)` and `#a8c7fa`
  - `html[data-theme=dark] .tile img.tileImage { filter: brightness(.85) }`
- Modify: `Sampler.css` (`.samplerSingle .tile-narration, .samplerSingle .tile-contents`). Replace the hard `max-height: 24rem` clip with a `.boundedTile` fade (gradient mask) that is removed when the tile's Reveal fires. Implement this via a `revealed` class on the tile wrapper, set by `RevealProvider`, which gets an optional `onReveal` prop.
- Modify: `Sampler.m.css` and `Sampler.css` for the phone/tablet horizontal-overflow root cause (R2.2 F1: `.samplerColumns` `align-items: flex-start` in column direction lets `.samplerMain` size to max-content). Add `.samplerMain, .samplerLeftRail { min-width: 0; width: 100% }` inside the ≤ 900px media block. Desktop is unaffected. Single-column mode already avoids it, but the tablet two-column range between 800 and 900 is covered too.
- Test: create `tiles/_ds/__tests__/TileImage.test.js` and `__tests__/samplerCss.test.js`.
  - `samplerCss.test.js` is a static check on the CSS text:
    - `prefers-reduced-motion` disables `transform` on hover
    - no `#345496`, `rgba(147, 198, 239` or `#a8c7fa` in `Sampler.css` / `Sampler.m.css`
    - no bare `max-height: 24rem` without `.boundedTile`

**Interfaces:**
- Produces: `TileImage({ path, alt, widths = [256, 640], sizes, eager = false, className, aspect })`.
  - `path` is the media path relative to `assetUrl`, e.g. `"people/nephi1"`.
  - It renders `<img className="tileImage …" src={original} srcSet={variantsEnabled ? … : undefined} loading={eager ? "eager" : "lazy"} decoding="async" fetchpriority={eager ? "high" : undefined} style={{ aspectRatio: aspect }}>`.
  - `onError` drops `srcset` and falls back to the original.
- Produces: `variantUrl(path: string, width: number): string`, returning `${assetUrl}/variants/${width}/${path}.webp`.
- Produces: `variantsEnabled(): boolean`, which reads `import.meta.env.REACT_APP_MEDIA_VARIANTS === "1"`. Check how the Vite config exposes `REACT_APP_*` (`vite.config.mjs`) and match it. It stays off until Task 11 uploads the variants.

- [ ] Step 1: Failing tests. TileImage:
  - with variants disabled there is no `srcset` and `loading="lazy"`
  - with `eager` it has `loading="eager"` and `fetchpriority="high"`
  - with variants enabled, `srcset` contains `variants/256/people/nephi1.webp 256w`
  - firing `onError` removes `srcset`

  Also write the CSS static test.
- [ ] Step 2: Run. Expected: FAIL.
- [ ] Step 3: Implement the component and the CSS changes.
- [ ] Step 4: Pass. Live: `pagepass.mjs` at 390 reports `hOverflow:false`. The narration and contents tiles on phone show a fade plus "Read more", which opens the full tile.
- [ ] Step 5: Commit: `feat(home): TileImage + variants seam, contrast/dark tokens, no silent clipping`.

## Phase 3 — Destinations and history

### Task 8: One Back = one entry (canonicalize with replace; map pin; narration overflow lock)

**Files:**
- Modify the Read slug canonicalization site. To find it: `grep -rn "navigate(" frontend/webapp/src/views/Read | grep -v replace`. The R2.2 E1 evidence names the three sites.
- Modify the Study page canonicalization site and the map-pin route (`/map/internal/place/:slug`, which pushes a duplicate).
- Modify the narration page component that sets `html, body { overflow: auto hidden; height: 100% }`. To find it, open `/moroni/finishing-touches` and inspect which stylesheet or effect applies. Restore the previous values on unmount, or scope the rule to a page wrapper rather than `html, body`.
- Test: create `frontend/webapp/src/scroll/__tests__/routeHistory.test.js`. Use a `MemoryRouter` with the real route elements mocked as needed: navigate to a non-canonical Read URL and assert `history.length` grew by exactly 1 (use `createMemoryRouter` and inspect `router.state.historyAction === "REPLACE"` after canonicalization).

- [ ] Step 1: Failing tests, one per canonicalization site. Each asserts that the canonicalizing navigation uses `replace`.
- [ ] Step 2: Run. Expected: FAIL.
- [ ] Step 3: Change each site to `navigate(to, { replace: true })`. Fix the overflow lock.
- [ ] Step 4: Tests pass. Live: `SEL` targeting `/read`, `/places/` map pin and narration links in `verify-back.mjs`. One Back lands on `/home` at the same `y`, desktop and phone.
- [ ] Step 5: Commit: `fix(nav): canonicalizing redirects replace; narration no longer leaks an overflow lock`.

### Task 9: Entity pages — top back control, phone layout, real heading

**Files:**
- Modify: `frontend/webapp/src/views/Entity/EntityPage.js:127`. Render `backLink` above the body as a breadcrumb-style "‹ People", "‹ Places" or "‹ Matters", and keep the bottom one.
- Modify: `frontend/webapp/src/views/Entity/EntityPage.css`. In the ≤ 700px block, set `.entity-page .ppbody .refbox { flex: none; width: 100%; margin-left: 0; border-left: 0 }` and show the portrait right after the title. Make subtitle and meta text `#6b6b6b`. Tighten the title-block gaps to ≤ 8px.
- Modify: `PersonBody.js`, `PlaceBody.js` and `MatterBody.js` (find them with `grep -rln "ppbody" frontend/webapp/src/views/_Common/entity`):
  - The name is an `<h1>` on the page and keeps `<h3>` in the popup, via a `headingLevel` prop.
  - Hide "Relationships" and "References" when their lists are empty.
  - Cap long lists at 12 with "Show all N".
- Modify: `Relationships.js:131-133` and `ReferenceList.js:175-178`. Relationship rows become `<Link to>`. References become `<a href>` to the Read URL, or `<button>` if they open the popup.
- Test: create `frontend/webapp/src/views/Entity/__tests__/EntityPage.test.js`.

**Interfaces:**
- Produces: `PersonBody({ ..., headingLevel = 3 })` (same for Place and Matter). EntityPage passes `1`; PopUp keeps the default.

- [ ] Step 1: Failing tests, rendering EntityPage with a mocked person:
  - (a) a back link appears before the `h1`
  - (b) the `h1` text is the name
  - (c) with `relations: []` there is no "Relationships" heading
  - (d) with 30 refs, 12 are shown plus a "Show all 30" button
  - (e) relationship rows are links with `href`
- [ ] Step 2: Run. Expected: FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Tests pass. Live phone captures of `/people/alma2`, `/places/zarahemla` and `/matters/<any>`: the back control is above the fold, the refbox is full width, and there is no empty right half.
- [ ] Step 5: Commit: `fix(entity): top back control, phone layout, h1, empty-section and long-list handling`.

## Phase 4 — Per-family tile fixes (parallel, one worktree per family)

Each family task has the same shape. Requirements:
- Every **in-scope** finding for that family's tiles in audit R2.5 (P0–P2 must be fixed; P3 fixed where cheap, otherwise listed as accepted with a reason).
- The family's rows in R2.3 inconsistencies.
- Adopting the Phase 2 primitives.

Each task:
- [ ] Step 1: For each tile, write a test file (or extend the existing one) covering:
  - (a) an **empty and minimal payload**: the tile collapses (`container.firstChild === null`) or renders without `undefined`/`NaN` or a broken image
  - (b) the CTA verbs come from TileCTA `verb`
  - (c) the tile's specific P1/P2 regressions from R2.5, e.g. "Places tile renders ≤ 390px wide" via a jsdom style check, or "biblephrases falls back to the next pair when no shared phrase exists"
- [ ] Step 2: Run them. Expected: FAIL.
- [ ] Step 3: Implement the fixes:
  - use `TileImage` for every `<img>`
  - use `TileCTA verb`
  - use button `RefPill`, taken out of `<a>` (and remove the file from `refPillPlacement` `ALLOW`)
  - give each destination one link per card
- [ ] Step 4: Tests pass, and the whole Home suite passes. Live: capture desktop, phone and tablet with `scripts/home-audit/tileharness.mjs`, and Read the screenshots to confirm each fixed finding.
- [ ] Step 5: Commit per tile: `fix(home/<tile>): <summary>`.
- [ ] Step 6: Append a "Fix log" row per finding to the audit doc under `## R4. Fix log`, in the form `| tile | id | sev | fixed in <sha> / accepted: reason |`.

Family assignments, and the specific must-fix P0/P1s from R2.5 and R2.2:

- **Task 10a: Rail fixtures**
  - Tiles: `ReadingPlanTile.js`, `ReadingProgressTile.js`, `NarrationTile.js`, `ContentsTile.js`.
  - Must fix:
    - contents C2: Read more must actually reveal on phone (covered by the Task 7 fade; verify)
    - readingplan C1: bubbles look clickable but are inert. Make each a link to its segment, or `cursor: default`.
    - readingplan A4: bubble contrast
    - readingplan D4: "Start Reading" should start the plan's first segment
    - readingplan B4: a failed fetch shows the CTA without bubbles
    - readingplan B2: neutral placeholder while `bookmark === undefined`
    - signed-in chooser needs a Close (L1)
- **Task 10b: People**
  - Tiles: `PeopleTile.js`, `PersonProfileTile.js`.
  - Must fix:
    - the R2.5 P2s
    - the disambiguator display (superscripts everywhere)
    - CTA "Open \<name\>"
- **Task 10c: Places and map**
  - Tiles: `PlacesTile.js`, `PlaceProfileTile.js`, `MapTile.js`, `MapTileInner.js`.
  - Must fix:
    - places F1 overflow (verify after Task 7)
    - the map-pin duplicate history (verify after Task 8)
    - the map-pin destination being half-baked (D5: title wrap, raw link markup)
    - placeProfile F1 at tablet
    - the duplicated profile thumbnail (exclude the profiled slug from the mosaic)
    - **MapTile is unreachable** (reserve index 10 > `MAX_RESERVES` 5): move it into `batchTiles` so it appears in infinite scroll, or remove it. Record the decision.
- **Task 10d: Matters**
  - Tiles: `MattersGroupTile.js` + 3 wrappers, `MatterProfileTile.js`.
  - Must fix:
    - verify the view-all and headings after Task 2
    - matterProfile C2 clipped reveal (after Task 7)
    - exclude the profiled matter from the Concept mosaic (`matterIndex` outside `slice(5,17)`)
    - the overlay clamp leak (R2.2 A1)
    - "+N Matters" localized through `label()` with an insert
- **Task 10e: Scripture and commentary**
  - Tiles: `TextTile.js`, `CommentaryTile.js`, `NotesTile.js` (+ `ExpandableText`, `RefPill` adoption).
  - Must fix:
    - text E1 double entries (after Task 8)
    - the text tile's nested second card chrome (single chrome)
    - text's three links to one href → one
    - notes E1 non-canonical link: link to the canonical Read URL directly
    - **notes L5:** confirm whether `HIDE_PASSAGE_NOTES` hides the destination in prod (`frontend/webapp/src/config/features*` or wherever `features.yml` is consumed). If it does, hide the Notes tile in prod builds with the same constant.
    - the scripture typography inconsistency (use the Read serif)
- **Task 10f: Archive documents**
  - Tiles: `FaxTile.js`, `FaxVerseTile.js`, `HistoryTile.js`, `ArchiveDocTile.jsx`, `TranslationTile.js`, `JosephSmithTile.js`, `WitnessTile.js`.
  - Must fix:
    - fax tab image 404s (`media.bookofmormon.online/fax/tabs/<edition>`): find the correct path or hide the tab image on error
    - fax and faxVerse Back from the viewer needs 2 presses (the viewer pushes per page). Open the viewer with `replace` on its first page sync.
    - josephSmith and witness clamp mid-word with no reveal → `ExpandableText`
    - **TranslationTile never renders** (backend returns null for every seed). Check `backend/src/graphql/homesampler.ts` for the translation sampler. Fix it if it's a query bug; otherwise remove the tile from `reservePool`. Record the decision.
    - hardcoded English → `label()`
    - dark-mode image dimming
- **Task 10g: Analysis and art**
  - Tiles: `BiblePhrasesTile.js`, `ChiasmusTile.js`, `ImageArtTile.js`.
  - Must fix:
    - biblephrases B4/H1: renders a 2px shell and is a dud in 4 of 7 seeds. Widen the pair walk, or fall back to the best partial phrase; when nothing qualifies, collapse fully (no 2px shell).
    - biblephrases skeleton and typography
    - chiasmus key contrast (1.6:1) and the inert speaker avatar → link to the person
    - art A1 phone width (after Task 7)
    - art E1 Read trap (after Task 8)
    - art credit (H6)
- **Task 10h: Map story and community**
  - Tiles: `MapStoryTile.js`, `MapStoryTileInner.js`, `MapStoryCard.js`, `CommunityTile.js`.
  - Must fix:
    - the remaining mapstory P1/P2s after Task 1:
      - autoplay must stop when the boundary trips and when the tile is offscreen or the tab is hidden (J2)
      - raw i18n keys `mapstory_meta`, `mapstory_play` and `mapstory_pause` (A7) → `label()` with fallbacks; rows in Task 12
      - the "Explore full journey" destination: the portrait covers the map (D5)
      - the phone popup offset (after Task 6)
      - "Alma2" → "Alma²"
      - the off-palette blue focus ring and oxblood/green accents → house tokens
      - reduced motion disables autoplay
      - the duplicate React key from cluster ids (`MapStoryTileInner.js:693`): key on `${cluster.id}-${index}` or dedupe the clusters
    - community:
      - the container query hides message text at every real width (A1): change the threshold so text shows at ≥ 340px
      - the hidden more-card
      - a `:focus-visible` style

## Phase 5 — Thumbnails, labels, unreachable content

### Task 11: Image variant generation + upload (KC confirms the upload)

**Files:**
- Create: `backend/scripts/build-media-variants.mjs`.
  - Input: a list of media paths (people, places, matters, art) gathered from the GraphQL API (people/places/matters slugs) or an S3 listing.
  - For each path, fetch the original from `https://media.bookofmormon.online/<path>`, then use `sharp` to resize to 256 and 640px wide WebP (quality 72).
  - Write to `--out` (local dir) for a dry run, or upload to the media bucket key `variants/<w>/<path>.webp` with `--upload` (`Cache-Control: public, max-age=31536000, immutable`).
  - It is idempotent: it skips keys that already exist (HEAD check).
- Modify: the frontend env for dev/prod so that `REACT_APP_MEDIA_VARIANTS=1` once the upload is done.

- [ ] Step 1: Run the dry run for 20 paths into the scratchpad. Check the sizes: at 256w each file should be under 25KB.
- [ ] Step 2: Present the exact upload plan to KC: path count, total bytes, bucket prefix, and the credentials path (Infisical prod `AWS_*`, or the prod-docker-exec workflow pattern from `ingest-group-covers.yml`; the instance role only allows `profiles/*`). **Wait for an explicit yes.**
- [ ] Step 3: Upload. Verify that 5 random `variants/256/...webp` URLs return 200 `image/webp`.
- [ ] Step 4: Enable `REACT_APP_MEDIA_VARIANTS=1` (Infisical frontend profile for dev; the prod build env). Live: the People tile's bytes drop from about 8MB to under 600KB (measure with Playwright `response` sizes).
- [ ] Step 5: Commit the script and the env docs: `feat(media): resized WebP variants + tile srcset`.

### Task 12: Label rows for new keys (KC confirms the prod DB write)

- Keys:
  - `show_less`
  - `open_x` ("Open $1")
  - `explore`
  - `home_feed_error`
  - `home_feed_end`
  - `mapstory_meta`, `mapstory_play`, `mapstory_pause`
  - any hardcoded strings moved in Tasks 10f and 10h
- Each key needs `en` and `ko` values.
- [ ] Draft the rows (key, en, ko) into the scratchpad.
- [ ] Show KC the list and the exact INSERT statements, without credentials in output. **Wait for an explicit yes.**
- [ ] Apply them with the dev backend env credentials (piped, never printed). Verify with `curl … {labels{key val}}` that each key returns its value.

## Phase 6 — Verification and blind review

### Task 13: Full live verification

- [ ] Run `scripts/home-audit/pagepass.mjs`, `verify-back.mjs` (desktop and phone; `SEL` set to the entity, read, map-pin, fax and narration links) and `verify-feedend.mjs`.
- [ ] Gates:
  - warm CLS < 0.05 on desktop and phone
  - cold CLS < 0.1
  - no console errors on a Home load (the `Unexpected token '<'` is a Vite-dev-only Clicky path artifact per R2.4; confirm it is absent on a prod build via `vite build && vite preview`, and record that)
  - one Back from every destination class lands on `/home` at the same `y`
- [ ] Run the whole suite: `npx vitest run`.

### Task 14: Blind review loop (no Fable — dropped 2026-10-20 by KC)

- [ ] Run a Workflow with 8 agents (default model; never `model: "fable"`), one per family. Each gets **only**:
  - `scripts/home-audit/rubric-blind.md`
  - `scripts/home-audit/tileharness.mjs` + README
  - the tile source paths for its family
  - the instruction to audit on `http://localhost:8201`
  - the same structured output schema as the R2 tile pass

  Prompts must not mention the audit doc, the spec, this plan, prior findings or diffs.
- [ ] A tile passes if it has zero P0/P1 and Craft, Beauty and Belonging are all ≥ 3. Record the results in the audit doc as `## R5. Blind review round N`.
- [ ] Each failing tile gets a fix task (same shape as Phase 4), then a new review round with **fresh** agents, repeated until all tiles pass. Every round is recorded.

### Task 15: Prod deploy (KC confirms at the moment of deploy)

- [ ] Push `dev`. Confirm that CI is green on the hosted runner.
- [ ] Ask KC for the go-ahead with a summary: commits, R5 pass table, and the env change (`REACT_APP_MEDIA_VARIANTS`).
- [ ] Deploy via the existing blue-green path: merge `dev` → `prod`, CI deploys via the self-hosted runner. Watch the run to completion.
- [ ] Post-deploy smoke on the prod URL:
  - Home desktop and phone render
  - no console errors
  - one Back restores
  - variants are served
  - `/matters/narrative` renders the index
- [ ] Update the memory notes and the audit doc status.
