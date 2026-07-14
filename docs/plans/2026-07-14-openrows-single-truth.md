# openRows Single Source of Truth Implementation Plan (WP-C1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A row's open/closed state has exactly one owner — `pageController.states.openRows` — consumed through a new `pageController.functions.isRowOpen(slug)` seam; TextContent's duplicate local flags and the DOM-class arbiter (`isRefOpen`) are retired.

**Architecture:** Today three representations coexist: `openRows` (already updated by every toggle via `setActiveRow`/`removeOpenRow`), TextContent's local `isOpen`/`isHeaderOpen` (seeded once, drifts), and the `.reference.open` DOM class that `isRefOpen()` polls for the deep-link scroll campaigns. Decision (2026-07-14): `openRows` wins. `isRowOpen(slug)` becomes the read API — defined on the controller's function table so the WP-D migration can later re-implement it against a state ref without touching consumers. **Safety basis for re-pointing the campaigns:** `awaitHeightSettled` (src/scroll/settle.js) is the real animation guard — its own comment notes the `open` class lands ~300ms before the Collapse finishes, so `isOpen` is only a gate, and state (which flips synchronously on dispatch thanks to the current in-place mutation) satisfies it strictly earlier and safely. With the local flags gone, TextContent's reducer has no state left to manage — the toggle becomes a plain handler and the vestigial `useReducer` is removed (this also eliminates a pre-existing dispatch-inside-reducer smell and pre-completes WP-D Phase 1).

**Tech Stack:** React 17, CRA/react-scripts 5, Jest + @testing-library/react 11.

**Execution order note:** Must land BEFORE `2026-07-15-controller-state-migration.md` (WP-D builds on `isRowOpen` and on TextContent being stateless). Independent of WP-A/WP-B. Origin: WP-C1 in `docs/specs/2026-07-14-page-view-structural-followups.md`.

**Intentional behavior normalizations** (today's three copies disagree at the edges; unifying picks one answer — call these out in review):
1. A nested-blocks card whose slug is in `openRows` at mount now renders OPEN. (Previously: seeded `isOpen=true` but its Collapse read `isHeaderOpen=false` → rendered closed while carrying the `open` header class — an inconsistency, not a feature.)
2. Clicking the 💬 badge on a nested-blocks card now visibly opens the card. (Previously it flipped the hidden `isOpen` flag — Comments appeared but the Collapse stayed shut.)
3. `<Comments isOpen>` now reflects the row's real open state for header-opened cards too (previously always `false` for them).

**Working conventions:** frontend root `frontend/webapp`; tests `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false`; **baseline: fully green, `159 passed` as of `d5c6f8c2` (record the exact count at start — WP-A/WP-B may have raised it); gate = zero failures.** Smoke on `http://localhost:8200`. Grep for snippets, not line numbers. One commit per task.

---

## Task 1: `isRowOpen` seam + idempotent membership + delete dead `addOpenRow` (Page.js)

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js`

- [ ] **Step 1: Verify `addOpenRow` is dead**

Run: `grep -rn "addOpenRow" frontend/webapp/src --include=*.js`
Expected: only its definition in the `functions` object and its reducer case in Page.js — no callers. If a caller exists, STOP and report.

- [ ] **Step 2: Make `setActiveRow`'s membership push idempotent.** In `case "setActiveRow":`:
```js
// Before
      pageController.states.openRows.push(slug);
// After
      if (!pageController.states.openRows.includes(slug))
        pageController.states.openRows.push(slug);
```
(Today repeated opens push duplicates that `removeOpenRow`'s filter later sweeps; with `openRows` becoming the truth, membership should be a set-like invariant.)

- [ ] **Step 3: Add `isRowOpen` to the `functions` object** (next to `removeOpenRow`):
```js
        // THE row-open read API (single source of truth, decision 2026-07-14).
        // A plain closure over the controller: the current reducer mutates
        // states in place, so this is live mid-campaign. The WP-D migration
        // re-implements it against a state ref — consumers won't change.
        isRowOpen: (slug) => pageController.states.openRows.includes(slug),
```

- [ ] **Step 4: Delete the dead `addOpenRow`** — both the `functions` entry:
```js
        addOpenRow: (val) => {
          dispatch({ fn: "addOpenRow", val: val });
        },
```
and the reducer case:
```js
    case "addOpenRow":
      pageController.states.openRows.push(input.val);
      break;
```

- [ ] **Step 5: Suite green (baseline count). Step 6: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/Page/Page.js
git commit -m "feat(page): isRowOpen read seam on pageController; idempotent openRows; drop dead addOpenRow"
```

## Task 2: Campaigns read state, not the DOM class (usePageInit.js + Page.js autoAdvance)

**Files:**
- Modify: `frontend/webapp/src/views/Page/usePageInit.js`
- Modify: `frontend/webapp/src/views/Page/__tests__/usePageInit.test.js`
- Modify: `frontend/webapp/src/views/Page/Page.js`

- [ ] **Step 1: Update the test fixture and add the state-truth test FIRST** (TDD — these fail until Step 2/3). In `usePageInit.test.js`, the controller fixture is:
```js
const controller = (initOpen, pageSlug = "lehites") => ({
  states: { initOpen, pageSlug, autoClicked: new Set() },
});
```
Replace with:
```js
const controller = (initOpen, pageSlug = "lehites") => {
  const states = { initOpen, pageSlug, autoClicked: new Set(), openRows: [] };
  return {
    states,
    functions: { isRowOpen: (slug) => states.openRows.includes(slug) },
  };
};
```
And ADD this test after the existing `buildOpenList` test:
```js
test("openAndAwait isOpen reads openRows membership — state is the truth, not the DOM class", () => {
  dom(`<div class="row"><div textid="lehites/7"><span class="reference"><a>7</a></span></div></div>`);
  const c = controller({ textId: "7" });
  const { steps } = buildInitSteps(c);
  const open = steps.find((s) => s.type === "openAndAwait");
  expect(open.isOpen()).toBe(false);
  c.states.openRows.push("lehites/7");
  expect(open.isOpen()).toBe(true);
});
```

- [ ] **Step 2: Run — the NEW test FAILS** (isOpen still reads the DOM class; with no `.open` class present it returns false both times → second assertion fails).

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Page/__tests__/usePageInit.test.js 2>&1 | tail -12`

- [ ] **Step 3: Re-point `buildInitSteps` in usePageInit.js.** Its openAndAwait step currently reads:
```js
      step.openAndAwait(
        () => document.querySelector(`[textid="${slug}"] .reference a`),
        {
          isOpen: () => isRefOpen(slug),
          getContainer: () =>
            document.querySelector(`[textid="${slug}"]`)?.closest(".row"),
        }
      )
```
Change ONLY the isOpen line:
```js
          isOpen: () => pageController.functions.isRowOpen(slug),
```
Then DELETE the now-unused `isRefOpen` export:
```js
export const isRefOpen = (slug) =>
  !!document
    .querySelector(`[textid="${slug}"] .reference`)
    ?.classList.contains("open");
```
(First verify its only consumers are `buildInitSteps` here and `autoAdvance` in Page.js: `grep -rn "isRefOpen" frontend/webapp/src --include=*.js`.)

- [ ] **Step 4: Re-point `autoAdvance` in Page.js.** In `functions.autoAdvance`:
```js
// Before
              isOpen: () => isRefOpen(newSlug),
// After
              isOpen: () => pageController.functions.isRowOpen(newSlug),
```
And trim the Page.js import:
```js
// Before
import { usePageInit, pageScrollManager, isRefOpen } from "./usePageInit";
// After
import { usePageInit, pageScrollManager } from "./usePageInit";
```

- [ ] **Step 5: Run the usePageInit tests — ALL pass (including the new one). Full suite green.**

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Page/usePageInit.js frontend/webapp/src/views/Page/__tests__/usePageInit.test.js frontend/webapp/src/views/Page/Page.js
git commit -m "refactor(page): scroll campaigns gate on openRows state via isRowOpen; retire DOM-class isRefOpen"
```

## Task 3: TextContent derives `open`; local flags and the vestigial reducer removed

**Files:**
- Modify: `frontend/webapp/src/views/Page/TextContent.js`

- [ ] **Step 1: Verify nothing outside TextContent reads its states**

Run: `grep -rn "textContentController.states" frontend/webapp/src --include=*.js | grep -v "views/Page/TextContent.js"`
Expected: nothing. (The old Annotations reader died with `FaxBubbleContainer`.) If a hit appears, STOP and report.

- [ ] **Step 2: Replace the controller construction.** The current block (the `useReducer` + init IIFE, starting `const [textContentController, dispatch] = useReducer(` and ending `})()  );`) AND the whole `function reducer(textContentController, input) {…}` at the top of the file are REPLACED. Delete the reducer function entirely. Replace the useReducer block with:

```js
  // Row-open state lives on pageController.states.openRows (single source of
  // truth, 2026-07-14). With no local state left, this controller is a plain
  // per-render object: toggling dispatches to the PAGE reducer, whose commit
  // re-renders this subtree with the fresh `open` value.
  const pageController = narrationController.pageController;
  const toggleOpenClose = (e) => {
    e.preventDefault();
    const slug = content.slug;
    if (pageController.functions.isRowOpen(slug)) {
      pageController.functions.removeOpenRow(slug);
    } else {
      pageController.functions.setActiveRow({
        slug,
        duration: content.duration,
        pagetitle: pageController.pageData.title,
        heading: content.heading,
        auto: pageController.states.autoClicked?.has(slug) === true,
      });
    }
  };
  const textContentController = {
    data: content,
    functions: { toggleOpenClose },
    pageController,
    narrationController,
  };
```
Notes on parity: the payload fields (`slug`, `duration`, `pagetitle`, `heading`, `auto`) are byte-identical to the old reducer case's `setActiveRow` call. The old `toggleOpenCloseHeader` existed only to flip a different local flag — with one truth there is one toggle; delete it. Remove `useReducer` from the React import line if now unused (`useState` stays — highlights use it).

- [ ] **Step 3: Rewire the render.** Apply these exact replacements in the render section:

(a) The removed `textContentController.pageController = narrationController.pageController;` render-mutation line — already gone with Step 2's construction (pageController is baked in). Verify no such assignment remains.

(b) Derive `open` once, where `let isOpen = …` currently sits:
```js
// Before
  let isOpen = textContentController.states.isOpen || textContentController.states.isHeaderOpen;
// After
  const open = pageController.functions.isRowOpen(textContentController.data.slug);
```
Update the two bubble lines below it to use `open`:
```js
  let CommentaryBubblesContainer = open && !isQuote && <CommentaryBubbles /> || null;
  let ImageBubblesContainer = open && !isQuote && <ImageBubbles /> || null;
```

(c) openClass:
```js
// Before
  let openClass =  (textContentController.states.isOpen || textContentController.states.isHeaderOpen) ? " open" : "";
// After
  const openClass = open ? " open" : "";
```
(The `.reference.open` class is now purely presentational — CSS keeps working; nothing reads it back.)

(d) `renderedTextContent`: the current code assigns onto the controller (`textContentController.renderedTextContent = renderTextContent(…)`) and reads it in two places (the nested-blocks scan and the CardBody). Make it a local:
```js
  const renderedTextContent = renderTextContent(
    textContentController.data.content,
    textContentController
  );
```
and replace both `textContentController.renderedTextContent` reads with `renderedTextContent`.

(e) The header anchor — aria/handler ternaries collapse (keep the heading-branch ternary on `cardWithoutNestedBlocks`, which is still computed from `renderedTextContent`):
```js
// Before
              aria-expanded={
                cardWithoutNestedBlocks
                  ? textContentController.states.isOpen
                  : textContentController.states.isHeaderOpen
              }
// After
              aria-expanded={open}
```
```js
// Before
              onClick={
                cardWithoutNestedBlocks
                  ? textContentController.functions.toggleOpenClose
                  : textContentController.functions.toggleOpenCloseHeader
              }
// After
              onClick={textContentController.functions.toggleOpenClose}
```

(f) Collapse:
```js
// Before
            isOpen={
              cardWithoutNestedBlocks
                ? textContentController.states.isOpen
                : textContentController.states.isHeaderOpen
            }
// After
            isOpen={open}
```

(g) Comments:
```js
// Before
          <Comments
            isOpen={textContentController.states.isOpen}
// After
          <Comments
            isOpen={open}
```
(The 💬 badge's `onClick={textContentController.functions.toggleOpenClose}` needs no change — same function name.)

- [ ] **Step 4: Verify no state remnants**

Run: `grep -n "states.isOpen\|states.isHeaderOpen\|toggleOpenCloseHeader\|useReducer\|dispatch(" frontend/webapp/src/views/Page/TextContent.js`
Expected: nothing.

- [ ] **Step 5: Full suite green.**

- [ ] **Step 6: Deep-link + interaction smoke matrix** at `http://localhost:8200` (this task's real gate — the campaigns and toggles integrate here):
1. `/lehites` — click a verse header: opens, audio starts, URL updates; click again: closes, URL reverts. Triangle rotates (openClass).
2. `/lehites/3` deep link — page scrolls, verse 3 opens (campaign gates on state now).
3. A NESTED verse deep link (one with quotes, e.g. any `lehites/N` whose row contains nested blocks) — parent and target both open in order.
4. `/lehites/3/fax/1830` — verse opens AND fax panel auto-opens.
5. `/art/<known-id>` and `/commentary/<known-id>` — resolve to the host page, open, and pop the panel/popup.
6. Autoplay on → let audio end — next verse opens + scrolls (autoAdvance path).
7. Browser Back after scrolling through sections — one press leaves the page (setActiveSection replace semantics unchanged).

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Page/TextContent.js
git commit -m "refactor(page): TextContent derives open from openRows — single source of truth; vestigial reducer removed"
```

---

## Self-review notes
- Task order 1 → 2 → 3 is required (2 and 3 both consume `isRowOpen` from 1).
- Timing safety: the toggle click handler runs `setActiveRow`, whose reducer mutates `openRows` **synchronously in place** during dispatch — so a campaign's very next `isRowOpen` poll (rAF-based, in `awaitHeightSettled`'s `extraCheck`) already sees the membership, while height-settling still waits out the Collapse animation. Strictly earlier-and-safe versus the old class check (which itself landed ~300ms before the animation ended, per settle.js's comment).
- WP-D interlock: after this plan, `isRowOpen` is the ONLY read path and TextContent is stateless — WP-D Phase 1 becomes a verification pass, and Phase 3 swaps `isRowOpen`'s internals to a state ref without touching any consumer.
- The three behavior normalizations are listed in the header for the reviewer; none is a regression, each replaces an internal inconsistency with the single-truth answer.
