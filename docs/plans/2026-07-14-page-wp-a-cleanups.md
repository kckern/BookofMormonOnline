# Page WP-A Cleanups Implementation Plan (document.title owner, marginTop, autoAdvance)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `document.title` a single owner with restore discipline, kill the ImagePanel marginTop measure→setState feedback loop, and make autoAdvance find the next row by `textid` instead of querying anchors by href.

**Architecture:** A tiny stack-based `docTitle.js` module (pure, tested) owns the title: the page sets a base title; open rows and panels push/pop entries, so closing anything restores the prior title (today closing a panel leaves a stale title). ImagePanel measures once per image via a ref + `useLayoutEffect` instead of re-running on its own output. autoAdvance reuses the `[textid=…]` selector family the deep-link campaigns already use.

**Tech Stack:** React 17, CRA/react-scripts 5, Jest + @testing-library/react 11.

**Execution order note:** This plan is independent of the other WP plans but MUST land before `2026-07-15-controller-state-migration.md` (WP-D uses `docTitle.js`). Origin: WP-A in `docs/specs/2026-07-14-page-view-structural-followups.md`.

**Working conventions for every task:**
- Frontend root: `frontend/webapp`; paths below relative to it unless starting with `docs/`.
- Run tests: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false` (scope with a path argument).
- **Test baseline: the suite is fully green — `Tests: 159 passed, 159 total` (as of commit `d5c6f8c2`). Gate for every task: zero failures.**
- Smoke against `http://localhost:8200` (HMR bundle), never `bom.kckern.net` (edge-cached).
- Line numbers drift — grep for the quoted snippet before editing.
- One commit per task, conventional-commit messages.

---

## Task 1: `docTitle.js` module (TDD)

**Files:**
- Create: `frontend/webapp/src/views/Page/docTitle.js`
- Create: `frontend/webapp/src/views/Page/__tests__/docTitle.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// frontend/webapp/src/views/Page/__tests__/docTitle.test.js
import { setBaseDocTitle, pushDocTitle, popDocTitle, __resetDocTitleForTests } from "../docTitle";

beforeEach(() => {
  __resetDocTitleForTests();
  document.title = "";
});

test("base title applies when nothing is pushed", () => {
  setBaseDocTitle("Lehites | Book of Mormon Online");
  expect(document.title).toBe("Lehites | Book of Mormon Online");
});

test("push overrides base; pop restores it", () => {
  setBaseDocTitle("Lehites");
  pushDocTitle("row", "1 Nephi 1 | Home");
  expect(document.title).toBe("1 Nephi 1 | Home");
  popDocTitle("row");
  expect(document.title).toBe("Lehites");
});

test("nested pushes restore in LIFO order; popping a middle key keeps the top", () => {
  setBaseDocTitle("Lehites");
  pushDocTitle("row", "1 Nephi 1");
  pushDocTitle("image", "Art: Liahona");
  expect(document.title).toBe("Art: Liahona");
  popDocTitle("row"); // middle entry removed, top stays
  expect(document.title).toBe("Art: Liahona");
  popDocTitle("image");
  expect(document.title).toBe("Lehites");
});

test("re-pushing the same key replaces its entry (no duplicates)", () => {
  setBaseDocTitle("Lehites");
  pushDocTitle("image", "Art: A");
  pushDocTitle("image", "Art: B");
  expect(document.title).toBe("Art: B");
  popDocTitle("image");
  expect(document.title).toBe("Lehites");
});

test("changing the base while an entry is pushed applies after pop", () => {
  setBaseDocTitle("Lehites");
  pushDocTitle("row", "1 Nephi 1");
  setBaseDocTitle("Mulekites");
  expect(document.title).toBe("1 Nephi 1");
  popDocTitle("row");
  expect(document.title).toBe("Mulekites");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Page/__tests__/docTitle.test.js 2>&1 | tail -12`
Expected: FAIL — `Cannot find module '../docTitle'`.

- [ ] **Step 3: Implement**

```js
// frontend/webapp/src/views/Page/docTitle.js
// Single owner of document.title for the Page view (audit 2026-07-14 §4.4).
// The page sets a BASE title; open rows/panels PUSH keyed entries and POP them
// on close, so closing anything restores what was underneath — the old code
// had 7 independent writers and no restore, leaving stale titles behind.
let base = "";
let stack = []; // [{ key, title }] — top of stack wins

function apply() {
  document.title = stack.length ? stack[stack.length - 1].title : base;
}

function removeKey(key) {
  const i = stack.findIndex((e) => e.key === key);
  if (i >= 0) stack.splice(i, 1);
}

export function setBaseDocTitle(title) {
  base = title || "";
  apply();
}

export function pushDocTitle(key, title) {
  removeKey(key);
  stack.push({ key, title });
  apply();
}

export function popDocTitle(key) {
  removeKey(key);
  apply();
}

// Test hook only — module state must not leak between tests.
export function __resetDocTitleForTests() {
  base = "";
  stack = [];
}
```

- [ ] **Step 4: Run to verify pass** — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Page/docTitle.js frontend/webapp/src/views/Page/__tests__/docTitle.test.js
git commit -m "feat(page): stack-based docTitle module — single owner with restore discipline"
```

## Task 2: Wire Page.js's four title writers through docTitle

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js`

Current writers (grep `document.title` in Page.js — 4 sites, all inside reducer cases): `setActiveRow` (~:496), `removeOpenRow` (~:561), `setActiveSection` (~:579), `setPageData` (~:650). NOTE: these calls remain inside reducer cases for now — that side-effect placement is pre-existing and is removed by the WP-D migration plan; this task only centralizes the writes.

- [ ] **Step 1: Add the import**

```js
import { setBaseDocTitle, pushDocTitle, popDocTitle } from "./docTitle";
```

- [ ] **Step 2: Replace the four writes.** Semantics: page/section titles are the BASE (they describe where you are); an open row PUSHES (it's a focus that closes).

In `case "setPageData":`
```js
// Before
      document.title = pageController.pageData?.title || label("home_title");
// After
      setBaseDocTitle(pageController.pageData?.title || label("home_title"));
```
In `case "setActiveSection":`
```js
// Before
      document.title =
        sectionTitle || pageController.pageData.title || label("home_title");
// After
      setBaseDocTitle(
        sectionTitle || pageController.pageData.title || label("home_title"),
      );
```
In `case "setActiveRow":`
```js
// Before
      document.title = heading + " | " + label("home_title");
// After
      pushDocTitle("row", heading + " | " + label("home_title"));
```
In `case "removeOpenRow":`
```js
// Before
      document.title = pageController.pageData.title || label("home_title");
// After
      popDocTitle("row");
```
(The pop restores whatever base is current — page or section title — which is exactly what the old explicit re-write approximated, minus the section-title case it got wrong: previously closing a row while scrolled into a section reverted to the PAGE title even though the section title was active. The stack fixes that; document as an intentional improvement.)

- [ ] **Step 3: Verify no direct writes remain in Page.js**

Run: `grep -n "document.title" frontend/webapp/src/views/Page/Page.js`
Expected: nothing.

- [ ] **Step 4: Run the full suite** — 159 passed. **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Page/Page.js
git commit -m "refactor(page): Page title writes go through docTitle (base = page/section, push/pop = open row)"
```

## Task 3: Panels push/pop titles with cleanup (Narration.js)

**Files:**
- Modify: `frontend/webapp/src/views/Page/Narration.js`

Three panel writers: ImagePanel (~:478), ScripturePanel (~:726), FacsimilePanel (~:890). Each becomes a push-on-open effect WITH a cleanup pop — closing a panel now restores the row/page title (previously stale).

- [ ] **Step 1: Add the import**

```js
import { pushDocTitle, popDocTitle } from "./docTitle";
```

- [ ] **Step 2: ImagePanel** — the title lines currently live inside the marginTop effect (removed from there by Task 4; do this task first). Add a NEW dedicated effect next to the existing ones in ImagePanel:

```js
  useEffect(() => {
    const activeId = narrationController.states.activeImageId;
    if (!activeId) return undefined;
    const caption =
      narrationController.supplement.image?.[activeId]?.title || "Artwork";
    pushDocTitle("image", "Art: " + caption + " | " + label("home_title"));
    return () => popDocTitle("image");
  }, [narrationController.states.activeImageId]);
```
And DELETE from the existing marginTop effect these lines:
```js
    const activeId = narrationController.states.activeImageId;
    const caption =
      narrationController.supplement.image?.[activeId]?.title || "Artwork";
    if (caption)
      document.title = "Art: " + caption + " | " + label("home_title");
```

- [ ] **Step 3: ScripturePanel** — inside the existing `useEffect(..., [activeRef])`, replace:
```js
// Before
    document.title = `${ref} | ${label("cross_reference")}`;
// After
    pushDocTitle("scripture", `${ref} | ${label("cross_reference")}`);
```
and add to that effect's EXISTING cleanup function (it already removes the keydown listener) a pop:
```js
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      popDocTitle("scripture");
    };
```

- [ ] **Step 4: FacsimilePanel** — replace its title effect body:
```js
// Before
  useEffect(() => {
    const version = narrationController.states.activeFax;
    document.title =
      "Facsimile: " +
      version +
      "—" +
      narrationController.data.text.heading +
      " | " +
      label("home_title");
  }, [narrationController.states.activeFax]);
// After
  useEffect(() => {
    if (!narrationController.states.showFax) return undefined;
    const version = narrationController.states.activeFax;
    pushDocTitle(
      "fax",
      "Facsimile: " + version + "—" +
        narrationController.data.text.heading + " | " + label("home_title"),
    );
    return () => popDocTitle("fax");
  }, [narrationController.states.activeFax, narrationController.states.showFax]);
```
(The `showFax` guard is new-and-correct: the old effect set a facsimile title on mount even when the panel was closed — a latent stale-title bug; document as intentional.)

- [ ] **Step 5: Verify + suite + smoke.** `grep -n "document.title" frontend/webapp/src/views/Page/Narration.js` → nothing. Full suite: 159 passed. Smoke at `http://localhost:8200/lehites`: open a verse (title = heading), open its art panel (title = Art:…), close the panel (title restores to the heading — the new behavior), close the verse (title restores to page/section).

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Page/Narration.js
git commit -m "refactor(page): panels push/pop docTitle with cleanup — closing restores the prior title"
```

## Task 4: ImagePanel marginTop — measure once per image, no feedback loop

**Files:**
- Modify: `frontend/webapp/src/views/Page/Narration.js`

Current (after Task 3 removed the title lines) the effect is:
```js
  const [marginTop, setMarginTop] = useState(0);
  useEffect(() => {
    if (
      !document.getElementsByClassName(
        "ii" + narrationController.states.activeImageId,
      )[0]
    )
      return false;
    let distanceOffScreen =
      marginTop -
      document
        .getElementsByClassName(
          "ii" + narrationController.states.activeImageId,
        )[0]
        .getBoundingClientRect().y;
    if (distanceOffScreen > 0) {
      setMarginTop(distanceOffScreen + 100);
    } else {
      setMarginTop(0);
    }
  }, [marginTop, narrationController.states.activeImageId]);
```
Intent: if the panel's natural top (`rect.y - marginTop`) is above the viewport, push it down so it's visible. It depends on its own output (`marginTop`), re-running until fixpoint — the feedback loop.

- [ ] **Step 1: Replace with a ref + single-pass `useLayoutEffect`**

```js
  const panelRef = useRef(null);
  const [marginTop, setMarginTop] = useState(0);
  // Measure once per image: the panel's natural top is (current rect.y minus
  // whatever margin is already applied). If that natural top is above the
  // viewport, push the panel down into view; otherwise no offset. Reading and
  // writing in one layout pass — the old version depended on its own output
  // and re-ran to a fixpoint (audit follow-ups WP-A2).
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const naturalTop = el.getBoundingClientRect().y - marginTop;
    setMarginTop(naturalTop < 0 ? -naturalTop + 100 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrationController.states.activeImageId]);
```
Add `useLayoutEffect`, `useRef` to the React import at the top of Narration.js (extend the existing `import React, { useState, useEffect, useReducer } from "react";` line).

- [ ] **Step 2: Attach the ref.** The panel's root div currently is:
```js
    <div
      className={"images ii" + narrationController.states.activeImageId}
      style={{ marginTop: marginTop + "px" }}
    >
```
Change to:
```js
    <div
      ref={panelRef}
      className={"images ii" + narrationController.states.activeImageId}
      style={{ marginTop: marginTop + "px" }}
    >
```
(The `ii<id>` class stays — CSS/other lookups may use it — but the effect no longer queries by class.)

- [ ] **Step 3: Suite (159 passed) + smoke:** open a verse near the bottom of the viewport and click an art bubble — the image panel must nudge itself fully into view (marginTop > 0) exactly as before; open one mid-screen — no offset. No render-loop warnings in the console.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Page/Narration.js
git commit -m "fix(page): ImagePanel measures once per image via ref+layout-effect; no marginTop feedback loop"
```

## Task 5: autoAdvance finds the next row by textid

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js`

Current (`functions.autoAdvance`, ~:121-150): finds the trigger via `document.querySelectorAll(`a[href='/${newSlug}']`)[0]` — an href query that breaks if link markup changes and can match unrelated anchors. The deep-link campaigns already use the `[textid="<slug>"] .reference a` selector (see `buildInitSteps` in `usePageInit.js`).

- [ ] **Step 1: Replace the trigger lookup**

```js
// Before
          const getTrigger = () =>
            document.querySelectorAll(`a[href='/${newSlug}']`)[0];
// After
          const getTrigger = () =>
            document.querySelector(`[textid="${newSlug}"] .reference a`);
```
Everything else in autoAdvance stays (the `isOpen: () => isRefOpen(newSlug)` line is re-pointed by the WP-C1 plan, not here; the `getContainer`/`scrollToElement` lookups already use `[textid=…]`).

- [ ] **Step 2: Verify selector parity.** The two selectors target the same anchor: each row's `<Col textid={slug}>` (TextContent.js) contains `<CardHeader className="reference…"><a href={"/"+slug}…>`. Run: `grep -n 'textid=' frontend/webapp/src/views/Page/TextContent.js | head -3` and `grep -n '"reference"' frontend/webapp/src/views/Page/TextContent.js | head -3` to confirm the structure holds.

- [ ] **Step 3: Suite (159 passed) + smoke:** enable autoplay in preferences, open a verse with audio, let the audio end — the next verse must open and scroll into view exactly as before.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Page/Page.js
git commit -m "refactor(page): autoAdvance locates the next row by textid, not anchor href"
```

---

## Deferred within WP-A
- **A3 lightbox replacement:** the `LightBox` `.click()`-driving of `simple-react-lightbox` stays — hostage to that library's imperative API. Replacing the library is a separate spike, not this plan.

## Self-review notes
- Task ordering: Task 3 must precede Task 4 (both edit the same ImagePanel effect; 3 removes the title lines, 4 rewrites the rest).
- The two intentional behavior improvements (section-title restore on row close; no facsimile title while closed) are called out inline for the reviewer.
- `__resetDocTitleForTests` exists because module-level state persists across tests in one Jest file.
