# Read View Whiplash & Skeleton Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three user-facing Read-view defects from the 2026-06-11 audit (`docs/audits/2026-06-11-read-view-ui-audit.md`): invisible loading skeletons, horizontal whiplash when the vertical scrollbar appears/disappears, and full view teardown on every verse click.

**Architecture:** Three independent fixes. (1) Restore skeleton CSS that was lost in merge `6a63b83c` back into `Read.scss`. (2) Reserve the scrollbar gutter globally via `scrollbar-gutter: stable` on `html` in `Main.css`. (3) Add a `loadedChapterRefs` ref to `Read.js` so route changes that stay within an already-rendered chapter update only highlight state instead of resetting `initialLoad` (which currently nulls content and refetches).

**Tech Stack:** React 17 (CRA / react-scripts 5), react-router v5, Sass, Jest + @testing-library/react v11 (already in devDependencies).

**Working directory:** all `npm`/`npx` commands run from `frontend/webapp/`. All file paths below are relative to the repo root `/home/bom/BookofMormonOnline/`.

**Environment notes (from CLAUDE.md):**
- The dev server runs as systemd user unit `bom-dev`; frontend on `localhost:8200` with HMR. Do **not** verify against `bom.kckern.net` (Cloudflare edge-caches the bundle for 4h). No restart is needed for frontend edits — HMR picks them up within a few seconds.
- Verify the dev server is up before bundle-grep verification steps: `systemctl --user status bom-dev` (if it isn't running, skip the curl verification steps; they are confirmation, not gates).

---

## Background for an engineer with zero context

The Read view (`frontend/webapp/src/views/Read/Read.js`) shows scripture chapters at routes like `/read/alma.32` (chapter) and `/read/alma.32/21` (chapter + highlighted verse 21). Route pattern is `/read/:bookCh?/:verseNum?` (`src/models/Routes.js:117`). Every verse in the rendered text is a react-router `<Link>` to its own verse URL, so "highlighting a verse" is a route change. Chapter content is fetched through `BoMOnlineAPI` (`src/models/BoMOnlineAPI.js`), which transparently serves repeat requests from a local cache, so refetches are fast but still async (at least one render frame with empty content).

The three bugs:

1. **Invisible skeletons.** `components/SkeletonLoader.js` renders classes like `.skeleton-section`, `.skeleton-text-line` — but no stylesheet defines them. They existed in `Read.scss` (added in commit `190ffd15`, last present in `d753acba`) and were silently dropped when merge commit `6a63b83c` resolved `Read.scss` in favor of the parent without them. Loading states render as empty unstyled divs (a blank page).
2. **Horizontal whiplash.** Nothing reserves the scrollbar gutter. During loads the page collapses (skeleton invisible → near-zero height) → the document scrollbar disappears → the viewport widens ~15px → Bootstrap's centered `.container` shifts; content arrives → scrollbar returns → it shifts back.
3. **Verse click = teardown.** The route-monitor effect in `Read.js` resets *everything* (including `setInitialLoad(true)`) on any route-param change. The load effect then runs `setContent(null)` + `setAllChapters([])` and refetches — so clicking a verse inside the already-rendered chapter unmounts the whole chapter, toggles the scrollbar (bug 2), and re-scrolls.

---

### Task 1: Restore skeleton loader CSS in Read.scss

**Files:**
- Modify: `frontend/webapp/src/views/Read/Read.scss` (currently 348 lines; desktop rules end at the `@media only screen and (max-width: 900px)` block that starts at line 296)

The recovered CSS comes from `git show d753acba:frontend/webapp/src/views/Read/Read.scss`. It is pruned here to only the classes the current `SkeletonLoader.js` renders: `skeleton-section`, `skeleton-header`, `skeleton-heading`, `skeleton-study-btn`, `skeleton-block`, `skeleton-gutter`, `skeleton-avatar`, `skeleton-voice`, `skeleton-content`, `skeleton-paragraph`, `skeleton-text-line` (+ the `skeleton-loading` keyframes). The historical `.skeleton-nav`, `.skeleton-nav-btn`, `.skeleton-title`, `.skeleton-chapter-nav` classes were removed from the JS in commit `19146b20` — do not restore them. The historical `.skeleton-text-line.short` / `:nth-child` width variants are also dropped: `SkeletonLoader.js` now sets per-line widths via inline `style`, which overrides them.

- [ ] **Step 1: Insert the desktop skeleton block**

In `frontend/webapp/src/views/Read/Read.scss`, insert the following block immediately **before** the line `@media only screen and (max-width: 900px) {`:

```scss
/* Skeleton Loader Styles
   Recovered from d753acba (lost in merge 6a63b83c), pruned to the classes
   SkeletonLoader.js renders. Per-line widths come from inline styles. */
@keyframes skeleton-loading {
    0% {
        background-position: -200px 0;
    }
    100% {
        background-position: calc(200px + 100%) 0;
    }
}

.skeleton-section {
    background-color: #FFF;
    padding: 1rem;
    margin-bottom: 2rem;
    border-radius: 1rem;
    margin-left: 1rem; /* Match real read-section margin */
}

.skeleton-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
}

.skeleton-heading {
    width: 250px;
    height: 24px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200px 100%;
    animation: skeleton-loading 1.5s infinite;
    border-radius: 4px;
}

.skeleton-study-btn {
    width: 100px;
    height: 32px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200px 100%;
    animation: skeleton-loading 1.5s infinite;
    border-radius: 4px;
}

.skeleton-block {
    display: flex;
}

.skeleton-gutter {
    flex-grow: 0;
    flex-shrink: 0;
    width: 5rem;
    padding: 0 1rem 1ex 0;
    margin-left: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.skeleton-avatar {
    width: 4rem;
    height: 4rem;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200px 100%;
    animation: skeleton-loading 1.5s infinite;
    border-radius: 50%;
    margin-bottom: 0.5rem;
}

.skeleton-voice {
    width: 3rem;
    height: 1rem;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200px 100%;
    animation: skeleton-loading 1.5s infinite;
    border-radius: 1ex;
}

.skeleton-content {
    flex-grow: 1;
    padding: 0 1rem 0 0;
}

.skeleton-paragraph {
    margin-bottom: 2rem;
}

.skeleton-text-line {
    height: 1.2rem;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200px 100%;
    animation: skeleton-loading 1.5s infinite;
    border-radius: 4px;
    margin-bottom: 0.8rem;
    width: 100%;
}

```

- [ ] **Step 2: Insert the mobile skeleton rules**

Inside the existing `@media only screen and (max-width: 900px)` block, the last rule is:

```scss
    .chapter-nav {
        margin-left: 0
    }
```

Insert the following **after** that rule, before the media query's closing `}`:

```scss
    /* Skeleton Loader Mobile Styles */
    .skeleton-section {
        margin: -0.6rem;
        margin-top: 1.3rem;
    }

    .skeleton-gutter {
        margin: 0;
        width: 100%;
        text-align: center;
        display: flex;
        justify-content: center;
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .skeleton-block {
        flex-direction: column;
    }
```

- [ ] **Step 3: Verify the styles compile into the dev bundle**

Run (HMR needs a few seconds after saving):

```bash
sleep 8 && curl -s http://localhost:8200/static/js/bundle.js | grep -c "skeleton-loading"
```

Expected: a number ≥ 1 (the keyframe name appears in the bundled CSS). If the dev server is not running, instead verify Sass compiles: `cd frontend/webapp && npx sass --no-source-map src/views/Read/Read.scss /tmp/read-check.css && grep -c skeleton-loading /tmp/read-check.css` → ≥ 1.

- [ ] **Step 4: Visual spot-check (if dev server available)**

Open `http://localhost:8200/read/alma.32` with browser devtools network throttled to "Slow 3G" (or just watch the first paint). Expected: animated gray shimmer placeholder sections appear during load instead of a blank page.

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Read/Read.scss
git commit -m "fix(read): restore skeleton loader styles lost in chat-branch merge

SkeletonLoader.js renders .skeleton-* classes whose CSS was added in
190ffd15 but dropped when merge 6a63b83c resolved Read.scss against the
parent without them. Recovered from d753acba, pruned to the classes the
component still renders.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Reserve the scrollbar gutter globally

**Files:**
- Modify: `frontend/webapp/src/views/_Common/Main.css:3` (the existing empty `html {}` rule)

`Main.css` is imported globally from `src/index.js`. It already contains an empty `html {}` rule at the top — fill it in.

**Important constraint:** do NOT use the classic `html { overflow-y: scroll; }` fallback here. `body.noscroll { overflow-y: hidden; }` (Main.css) is used as a scroll lock by `src/views/_Common/Study/StudyGroupBar.js:79`; forcing `overflow-y` on `<html>` would make `<html>` the scroll container and break that lock. `scrollbar-gutter: stable` reserves the gutter without changing scroll-container semantics; unsupported browsers (pre-2023) simply keep today's behavior.

- [ ] **Step 1: Edit the html rule**

In `frontend/webapp/src/views/_Common/Main.css`, replace:

```css
html {}
```

with:

```css
html {
    /* Reserve the vertical scrollbar gutter so the centered .container does
       not shift horizontally when page height crosses the viewport threshold
       (e.g. while Read-view content loads).
       Do NOT switch this to `overflow-y: scroll`: that makes <html> the
       scroll container and breaks the body.noscroll scroll lock used by
       StudyGroupBar.js. */
    scrollbar-gutter: stable;
}
```

- [ ] **Step 2: Verify it reaches the dev bundle**

```bash
sleep 8 && curl -s http://localhost:8200/static/js/bundle.js | grep -c "scrollbar-gutter"
```

Expected: ≥ 1. (If dev server unavailable: `grep -c "scrollbar-gutter" frontend/webapp/src/views/_Common/Main.css` → 1.)

- [ ] **Step 3: Visual spot-check (if dev server available)**

On `http://localhost:8200/read/alma.32` in a desktop-width window: navigate between chapters with the header ▶ button. Expected: the content column no longer jumps left/right as the scrollbar disappears/reappears (a thin reserved gutter strip is always present on the right). Also confirm a Study-group overlay (any modal that adds `body.noscroll`) still locks page scrolling.

- [ ] **Step 4: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/_Common/Main.css
git commit -m "fix(layout): reserve scrollbar gutter to stop horizontal whiplash

Page-height changes during Read-view loads toggled the document
scrollbar, shifting the centered container ~15px each way.
scrollbar-gutter:stable reserves the gutter without changing scroll
container semantics (html{overflow-y:scroll} would break body.noscroll).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Keep the chapter mounted on verse-click navigation

**Files:**
- Modify: `frontend/webapp/src/views/Read/Read.js` (refs block ~line 122; route-monitor effect lines 243–266; `handleExplicitChapterNavigation` lines 224–238; load-content effect ~line 404; `loadNextChapter` ~line 197)
- Test: `frontend/webapp/src/views/Read/__tests__/Read.test.js` (new)

**Design:** a `loadedChapterRefs` ref holds the set of chapter refs whose content is currently mounted (the primary chapter + any infinite-scroll-appended ones). The route-monitor effect checks it: if the target chapter is already mounted, only `activeChapterRef`, `highlightedVerses`, and `chapterVerseIds` update (no `initialLoad` reset → no `setContent(null)` → no refetch). Otherwise it performs the existing full reset. The set is (re)populated where content actually mounts: the initial-load success path and `loadNextChapter`'s append, and cleared on full reset. The rewrite also drops the `setTimeout(0)` wrapper — its comment claims it batches, but React 17 does **not** batch inside timeouts (it does batch synchronously inside effect bodies), so the timeout was causing up to 8 sequential re-renders plus a stale frame.

**Edge case fixed along the way:** `handleExplicitChapterNavigation` (wired to ChapterNav grid clicks) nulls content *before* `history.push`. When the clicked cell is the **currently displayed** chapter, the route params don't change, the route effect never fires, and nothing reloads the nulled content → permanent blank page (pre-existing bug). Setting `setInitialLoad(true)` there makes the load effect re-run. (For different-chapter clicks this causes one extra request for the old chapter that is immediately aborted by `abortPrevious: true` — harmless and cache-served.)

**Jest notes for this codebase:** tests run via `react-scripts test` (CRA 5). Existing tests live in `src/utils/__tests__/` and already import `models/Utils` successfully, so the module graph works under jsdom. There is no `setupTests.js` and existing tests do not use jest-dom matchers — use plain `className`/truthiness assertions, not `toHaveClass`. `jest.mock` of `models/BoMOnlineAPI` covers all importers (including `models/Utils`, which imports it as `src/models/BoMOnlineAPI` — same resolved module). `scripture-guide` is a pure JS dependency and runs fine under jest.

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Read/__tests__/Read.test.js`:

```js
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route } from "react-router-dom";
import { lookupReference } from "scripture-guide";
import ReadScripture from "../Read";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";

jest.mock("../../../models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
  assetUrl: "http://test-assets",
}));

// Build chapter data in the shape the GraphQL layer returns, using real
// verse ids from scripture-guide so verse links resolve to real slugs.
const verseIds = lookupReference("Alma 32").verse_ids;

const buildChapterData = () => ({
  sections: [
    {
      heading: "Alma teaches faith",
      ref: "Alma 32",
      blocks: [
        {
          voice: "narrator",
          person_slug: "alma2",
          lines: verseIds.map((verseId, i) => ({
            verse_id: verseId,
            verse_num: i + 1,
            text: `Verse ${i + 1} text.`,
            format: "",
          })),
        },
      ],
    },
  ],
});

const appController = { functions: { setPopUp: jest.fn() } };

const renderRead = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Route path="/read/:bookCh?/:verseNum?">
        <ReadScripture appController={appController} />
      </Route>
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  window.scrollTo = jest.fn();
  Element.prototype.scrollIntoView = jest.fn();
  BoMOnlineAPI.mockResolvedValue({ read: { alma32: buildChapterData() } });
});

test("clicking a verse highlights it without refetching the chapter", async () => {
  renderRead("/read/alma.32");

  const verse21 = await screen.findByText("Verse 21 text.");
  const callsAfterInitialLoad = BoMOnlineAPI.mock.calls.length;

  // Each verse is a <Link> to /read/alma.32/21 — clicking it is a route change
  userEvent.click(verse21);

  await waitFor(() => {
    expect(
      screen.getByText("Verse 21 text.").closest("a").className
    ).toContain("highlighted");
  });

  // The chapter was already mounted: highlighting must not trigger a refetch
  expect(BoMOnlineAPI.mock.calls.length).toBe(callsAfterInitialLoad);
  // ...and the rest of the chapter must still be mounted
  expect(screen.getByText("Verse 1 text.")).toBeTruthy();
});

test("navigating to a different chapter still refetches", async () => {
  renderRead("/read/alma.32");
  await screen.findByText("Verse 1 text.");
  const callsAfterInitialLoad = BoMOnlineAPI.mock.calls.length;

  // Header next-chapter button reads "Alma 33 ▶"
  userEvent.click(screen.getByText(/Alma 33/));

  await waitFor(() => {
    expect(BoMOnlineAPI.mock.calls.length).toBeGreaterThan(
      callsAfterInitialLoad
    );
  });
});
```

- [ ] **Step 2: Run the test — first test must FAIL, second must PASS**

```bash
cd /home/bom/BookofMormonOnline/frontend/webapp
CI=true npx react-scripts test --watchAll=false src/views/Read/__tests__/Read.test.js
```

Expected: `clicking a verse highlights it without refetching the chapter` FAILS on the call-count assertion (`Expected: N, Received: N+1`) because the current route effect resets `initialLoad` and refetches. `navigating to a different chapter still refetches` PASSES.

If instead the suite fails on module resolution or rendering before reaching the assertion, fix the test harness first (e.g. a missing mock) — but do not weaken the assertions. Known-good reference: `src/utils/__tests__/scrollTo.test.js` runs in this same harness.

- [ ] **Step 3: Implement — add the `loadedChapterRefs` ref**

In `frontend/webapp/src/views/Read/Read.js`, in the refs block, after the line `const lastContentLoadTime = useRef(0);` add:

```js
    const loadedChapterRefs = useRef(new Set()); // chapter refs currently mounted
```

- [ ] **Step 4: Implement — rewrite the route-monitor effect**

Replace the entire effect at lines 243–266 (the one beginning `// Batch state updates using setTimeout to prevent cascade re-renders` with `const batchedUpdate = () => {...}; const timeoutId = setTimeout(batchedUpdate, 0); ...`) with:

```js
    useEffect(() => {
        // Verse-level navigation within an already-mounted chapter (e.g. the
        // user clicked a verse to highlight it): update highlight state only.
        // A full reset would unmount the chapter, refetch it, and flash the
        // skeleton and scrollbar.
        if (loadedChapterRefs.current.has(initChapterRef)) {
            setActiveChapterRef(initChapterRef);
            setHighlightedVerses(initHighlightedVerses);
            setChapterVerseIds(initChapterVerseIds);
            return;
        }

        // New chapter: full reset. setState inside an effect body is batched
        // by React 17 — no deferral needed.
        loadedChapterRefs.current = new Set();
        setChapterRef(initChapterRef);
        setActiveChapterRef(initChapterRef);
        setHighlightedVerses(initHighlightedVerses);
        setNextChapterRef(initNextChapter);
        setPrevChapterRef(initPrevChapter);
        setChapterVerseIds(initChapterVerseIds);
        setInitialLoad(true);
        setIsContentLoading(false);

        // Reset tracking values
        hasUserScrolled.current = false;
        lastLoadedChapterCount.current = 0;
        lastScrollY.current = 0;
        nextChapterPreloaded.current = false;
        lastContentLoadTime.current = 0;
    }, [initChapterRef, initHighlightedVerses, initNextChapter, initPrevChapter, initChapterVerseIds]);
```

- [ ] **Step 5: Implement — register the primary chapter when its content mounts**

In the load-content effect's success path, directly after these existing lines:

```js
                        setContent(chapterData);
                        setInitialLoad(false);
                        lastContentLoadTime.current = Date.now();
                        localStorage.setItem("chapterRef", chapterRef);
```

add:

```js
                        loadedChapterRefs.current = new Set([chapterRef]);
```

- [ ] **Step 6: Implement — register appended chapters in `loadNextChapter`**

In `loadNextChapter`, directly after the `setAllChapters((prev) => { ... });` call (after its closing `});`, before the `const { nextChapter } = getPrevNextChapter(...)` line) add:

```js
                    loadedChapterRefs.current.add(nextChapterRef);
```

- [ ] **Step 7: Implement — fix `handleExplicitChapterNavigation`**

In `handleExplicitChapterNavigation`, after the line `setPassageNotesLoading(false);` add:

```js
        // Force a reload even when the clicked chapter is the one already
        // displayed (route params won't change, so the route effect won't
        // fire) — otherwise the content nulled above is never refetched.
        loadedChapterRefs.current = new Set();
        setInitialLoad(true);
```

- [ ] **Step 8: Run the Read test — both must PASS**

```bash
cd /home/bom/BookofMormonOnline/frontend/webapp
CI=true npx react-scripts test --watchAll=false src/views/Read/__tests__/Read.test.js
```

Expected: 2 passed.

- [ ] **Step 9: Run the full frontend suite**

```bash
cd /home/bom/BookofMormonOnline/frontend/webapp
CI=true npx react-scripts test --watchAll=false
```

Expected: all suites pass (pre-existing suites: `awaitDomOpen`, `orderByDomAncestry`, `deepLinkInstrument`, `scrollTo`, plus the new `Read`).

- [ ] **Step 10: Manual verification (if dev server available)**

On `http://localhost:8200/read/alma.32`:
1. Click several verses — text highlights instantly, no blank flash, no scroll jump, no scrollbar toggle, URL updates to `/read/alma.32/<n>`.
2. Click a *different* chapter in the chapter-nav grid — full reload with skeleton, lands at top.
3. Click the *current* chapter's cell in the grid — content reloads (previously: permanent blank page).
4. Scroll to the bottom so the next chapter auto-appends, then click a verse in the appended chapter — highlight only, no teardown.

- [ ] **Step 11: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Read/Read.js frontend/webapp/src/views/Read/__tests__/Read.test.js
git commit -m "fix(read): keep chapter mounted on verse-click navigation

Verse links are route changes; the route effect reset initialLoad on any
param change, nulling content and refetching the whole chapter just to
highlight a verse. Track mounted chapters in a ref and update only
highlight state when the target chapter is already rendered. Also drops
the setTimeout(0) pseudo-batching (React 17 batches in effect bodies,
not in timeouts) and fixes the blank page when re-selecting the current
chapter in the chapter grid.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Out of scope (tracked in the audit, not this plan)

Scroll-to-top unification across nav paths (audit Finding 5), `history.push`→`replace` and `replaceState` hygiene (Finding 6), Tab-key a11y, infinite-scroll scroll-spy drift (Finding 7), dead code/swipe-nav restoration (Finding 8). Note: once Task 1 ships, the tall skeleton means Finding 5 (scroll not reset on header-button/keyboard nav) becomes more visible — it is the natural next fix.
