# Page View Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate every actionable finding in `docs/audits/2026-07-14-page-view-audit.md` — dead code, correctness bugs, DRY violations, and SSoT drift in `frontend/webapp/src/views/Page/` — without changing user-visible behavior except where the audit identified a bug.

**Architecture:** Three phases matching the audit's remediation order. Phase 1 deletes dead code (behavior-identical by construction). Phase 2 fixes correctness bugs, extracting pure logic into small tested modules (`commentIndex.js`, `highlightPattern.js`, `usePageComments.js`) following the house pattern set by `usePageInit.js`/`pageCommentCounts.js`. Phase 3 collapses duplications into shared helpers. The controller objects and their reducers are **kept as-is** — the just-merged controller→context migration (`docs/plans/2026-07-13-controller-context-migration.md`) deliberately preserved them; this plan works within that decision.

**Tech Stack:** React 17 (function components + contexts), CRA/react-scripts 5, Jest + @testing-library/react 11, react-router-dom 5.

**Baseline:** This plan was written against dev HEAD `4a08faed` (post controller-context migration + sendbird deprecation). Line numbers drift — **always grep for the quoted snippet before editing**, never trust offsets.

**Working conventions for every task:**
- Frontend root: `frontend/webapp`. All paths below are relative to `frontend/webapp/` unless they start with `docs/`.
- Run tests: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false` (add a path argument to scope to one file).
- There are known pre-existing test failures on dev (≈8 as of 2026-07-06, possibly changed since). Task 0 records the baseline; the gate for every task is **no NEW failures**, not zero failures.
- Smoke-test against `http://localhost:8200` (local HMR bundle), never `bom.kckern.net` (Cloudflare edge-caches the bundle for 4h).
- Import style: absolute from `src/` for cross-directory imports, relative `./` within `views/Page/`.
- One commit per task. Conventional-commit messages (`refactor:`, `fix:`, `test:`).
- After removing a prop/import, check the file for other uses before deleting; eslint (`react-app` config) flags unused vars — fix them, don't suppress.

---

## Task 0: Record the test baseline

**Files:** none (read-only)

- [ ] **Step 1: Run the full suite and save the result**

```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false 2>&1 | tail -20
```

Record the summary line (e.g. `Tests: 8 failed, 74 passed`). Every later task's "suite passes" step means: same-or-fewer failures than this baseline, and every failure is one of the baseline failures.

- [ ] **Step 2: Confirm clean working tree**

```bash
git status --porcelain
```
Expected: empty (or only the `docs/` files from this plan/audit).

---

# PHASE 1 — Dead code deletion (Tasks 1–6)

Every deletion in this phase was verified dead by grep at HEAD `4a08faed`. Re-verify each with the given grep before deleting — if a grep unexpectedly returns hits, STOP and re-assess rather than deleting.

## Task 1: Delete dead files and the Connection dead block

**Files:**
- Delete: `src/views/Page/GroupComment.js`
- Delete: `src/views/Page/animation.css`
- Delete: `src/views/Page/svg/fullscreen.svg`
- Modify: `src/views/Page/Connection.js`

- [ ] **Step 1: Verify all three files are unreferenced**

```bash
cd frontend/webapp/src
grep -rn "GroupComment" . --include=*.js | grep -v "views/Page/GroupComment.js"
grep -rn "animation.css" . --include=*.js --include=*.css
grep -rn "fullscreen.svg" . --include=*.js --include=*.css
```
Expected: all three commands print nothing.

- [ ] **Step 2: Delete the files**

```bash
git rm frontend/webapp/src/views/Page/GroupComment.js frontend/webapp/src/views/Page/animation.css frontend/webapp/src/views/Page/svg/fullscreen.svg
```

- [ ] **Step 3: Remove the dead comment block and unused prop from Connection.js**

In `src/views/Page/Connection.js`:

(a) Delete the entire commented block starting `// ** NOT IS USE` through the end of the commented `checkConnectionType` function (the block referencing `center-to-left` / `center-to-right` — these were the only references to the classes in the deleted `animation.css`).

(b) Change the signature — `index` is never used in the body:

```js
// Before
export default function Connection({ index, rowData }) {
// After
export default function Connection({ rowData }) {
```

- [ ] **Step 4: Run the suite**

```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false 2>&1 | tail -5
```
Expected: baseline failures only.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor(page): delete dead GroupComment, animation.css, fullscreen.svg, Connection dead block"
```

## Task 2: Remove dead reducer limbs and dead comments from Page.js

**Files:**
- Modify: `src/views/Page/Page.js`

- [ ] **Step 1: Verify each limb is dead**

```bash
cd frontend/webapp/src
grep -rn "functions.resetPage\|functions.setOpenRows" . --include=*.js
grep -rn 'fn: "startAudio"\|fn: "pauseAudio"\|fn: "setTooltip"\|fn: "setPageSlug"' . --include=*.js
grep -rn "audioPlaying" . --include=*.js | grep -v "views/Page/Page.js"
grep -rn "states.toolTip" . --include=*.js
```
Expected: first command → nothing (only the definitions exist, no callers). Second → nothing (no dispatches). Third → nothing outside Page.js. Fourth → nothing (only the dead case writes it).

- [ ] **Step 2: Delete the dead function entries** from the `functions` object in the reducer-init closure:

```js
        resetPage: (val) => {
          dispatch({ fn: "resetPage", val: val });
        },
```
and
```js
        setOpenRows: (val) => {
          dispatch({ fn: "setOpenRows", val: val });
        },
```

- [ ] **Step 3: Delete the dead reducer cases** from `function reducer(pageController, input)`:

```js
    case "resetPage":
      pageController.states.initOpen.pageSlug = input.val;
      pageController.states.loading = null;
      break;
```
```js
    case "setPageSlug":
      pageController.states.pageSlug = input.val.index;
      break;
```
```js
    case "startAudio":
      pageController.states.audioPlaying = true;
      break;
    case "pauseAudio":
      pageController.states.audioPlaying = false;
      break;
    case "setTooltip":
      pageController.states.toolTip = true;
      break;
```

- [ ] **Step 4: Delete the dead state field** from the `states` init object:

```js
        audioPlaying: false,
```

- [ ] **Step 5: Delete the unused import and dead comments**

(a) Delete `import ReactTooltip from "react-tooltip";` (verify first: `grep -n "ReactTooltip" src/views/Page/Page.js` → only the import line).

(b) Delete `// import Comments from '../_Common/Study/Study';`

(c) In the `removeOpenRow` case, delete the stale comment lines:
```js
      // MODIFY BY ME
```
and
```js
      // for (let i in pageController.states.openRows) {
      //     if (pageController.states.openRows[i] === input.val) {
      //         pageController.states.openRows.splice(i, 1);
      //     }
      // }
```

(d) Delete the orphaned line `//<pre>{commentState}</pre>` (below `LoadingPageCommentsNotice`).

(e) In the `addToPageComments`, `updateToPageComment`, and `deleteToPageComments` cases, delete the three commented lines `// pageController.appController.functions.setActiveLeafCursorController(pageController);` (the live replacement effect is documented in the `setPageComments` case comment — keep that one).

(f) In the `setActiveRow` case, delete the commented line `// pageController.appController.functions.updateUserSummary({ ...r.log.progress, ...{ slug, pagetitle, heading } })`.

- [ ] **Step 6: Run the suite; expected baseline-only failures**

```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Page/Page.js && git commit -m "refactor(page): remove never-dispatched reducer cases, dead state, dead comments"
```

## Task 3: Remove the always-undefined popUpData args and the Page preLoad stub

Background (verified at HEAD): `appController.preLoad` has keys `personList`/`placeList`/`objectList` — **no `peoplePlaces` key exists anywhere**. `pageController.preLoad` is initialized to empty stubs and never populated. So all three `popUpData: …peoplePlaces…` expressions below evaluate to `undefined` today, and `setPopUp` already handles that (PopUp self-fetches when `popUpData[activeId]` is missing — `_Common/PopUp.js` `loading` branch). Removing them is a no-op by definition.

**Files:**
- Modify: `src/views/Page/PersonPlace.js`
- Modify: `src/views/Page/Narration.js`
- Modify: `src/views/Page/Page.js`

- [ ] **Step 1: Verify the shape claim still holds**

```bash
cd frontend/webapp/src
grep -rn "peoplePlaces" models/appController.js
grep -rn "preLoad\?.peoplePlaces\|preLoad.peoplePlaces" . --include=*.js
```
Expected: first → nothing. Second → only the three call sites edited below plus the Page.js stub.

- [ ] **Step 2: PersonPlace.js — drop the dead keys**

In `PersonLink`'s `handleClick`:
```js
// Before
    appController.functions.setPopUp({
      type: "people",
      ids: [id],
      popUpData: pageController.preLoad?.peoplePlaces?.person,
    });
// After
    appController.functions.setPopUp({
      type: "people",
      ids: [id],
    });
```
Same in `PlaceLink` (`type: "places"`, drop `popUpData: pageController.preLoad?.peoplePlaces?.place,`).

- [ ] **Step 3: Narration.js — drop the dead key in `popUpPerson`** (inside `PeoplePlacePanel`):

```js
// Before
  const popUpPerson = (slug,type) => {
    ///    appController.functions.setPopUp({ type: "places", ids: [id], popUpData: pageController.preLoad?.peoplePlaces?.place });

    narrationController.appController.functions.setPopUp({
      type: type,
      ids: [slug],
      popUpData: narrationController.appController.preLoad?.peoplePlaces?.[type==="people"?"people":"place"],
    });
  }
// After
  const popUpPerson = (slug, type) => {
    narrationController.appController.functions.setPopUp({
      type: type,
      ids: [slug],
    });
  }
```

- [ ] **Step 4: Page.js — delete the stub** (both the object and its slot on the controller):

Delete:
```js
      let preLoad = {
        peoplePlaceToolTipData: {},
        peoplePlaces: {},
      };
```
and in `initPageController`, delete the line:
```js
        preLoad: preLoad,
```

- [ ] **Step 5: Verify no remaining readers**

```bash
grep -rn "pageController.preLoad" frontend/webapp/src --include=*.js
```
Expected: nothing.

- [ ] **Step 6: Suite + smoke.** Run the suite (baseline-only failures). Smoke: open `http://localhost:8200/lehites`, click a bolded person name in the narration — the person popup must open and load its content (it self-fetches, as before).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "refactor(page): drop always-undefined popUpData args and the never-populated pageController.preLoad stub"
```

## Task 4: Remove dead controller limbs from Narration.js

**Files:**
- Modify: `src/views/Page/Narration.js`

- [ ] **Step 1: Verify `toggleOpenClose` on the narration controller is dead**

```bash
grep -rn "functions.toggleOpenClose" frontend/webapp/src --include=*.js
```
Expected: hits only in `TextContent.js` (that's the *textContentController*'s function, which stays). No hit reads `narrationController.functions.toggleOpenClose`.

- [ ] **Step 2: Delete the dead reducer case** in `function reducer(narrationController, input)`:

```js
    case "toggleOpenClose":
      if (narrationController.states.isOpen)
        narrationController.pageController.functions.removeOpenRow(
          narrationController.data.text.slug,
        );
      else
        narrationController.pageController.functions.setActiveRow({
          slug: narrationController.data.text.slug,
          duration: narrationController.data.text.duration,
        });
      narrationController.states.isOpen = !narrationController.states.isOpen;
      break;
```

- [ ] **Step 3: Delete the dead function entry** from the narration `functions` object:

```js
        toggleOpenClose: (e) => {
          e.preventDefault();
          dispatch({ fn: "toggleOpenClose" });
        },
```

- [ ] **Step 4: Delete the dead state field and its last mention**

In the narration `states` init object delete `isOpen: false,`. In `FacsimilePanel`'s first effect delete the line `// if (narrationController.states.isOpen) debugger;`.

- [ ] **Step 5: Delete the unused import and the empty effect**

(a) Delete `import classNames from "classnames";` (verify: `grep -n "classNames" src/views/Page/Narration.js` → only the import).

(b) In `PeoplePlacePanel` delete:
```js
  useEffect(() => {
    //Preload People and Places

  }, [narrationController.states.peoplePlaces]);
```
Then check whether `useEffect` is still used elsewhere in the file (it is — keep the React import as-is).

- [ ] **Step 6: Suite (baseline-only), then commit**

```bash
git add frontend/webapp/src/views/Page/Narration.js && git commit -m "refactor(page): remove dead narration toggleOpenClose/isOpen, unused import, empty effect"
```

## Task 5: Remove dead props; stop mutating sectionData in render

**Files:**
- Modify: `src/views/Page/Page.js`
- Modify: `src/views/Page/Section.js`

- [ ] **Step 1: Page.js — pass the index as a prop instead of mutating the data object**

```js
// Before
        {pageController.pageData?.sections.map((sectionData, sectionIndex) => {
          sectionData.sectionIndex = sectionIndex;
          return (
            <Section
              key={sectionIndex}
              sectionData={sectionData}
              rowIndex={sectionData}
            />
          );
        })}
// After
        {pageController.pageData?.sections.map((sectionData, sectionIndex) => (
          <Section
            key={sectionIndex}
            sectionData={sectionData}
            sectionIndex={sectionIndex}
          />
        ))}
```
(`rowIndex` was never declared by Section — dead; the mutation was a render-phase write to API data.)

- [ ] **Step 2: Section.js — accept `sectionIndex`, drop `setPageSlug`**

```js
// Before
function Section({ sectionData, setPageSlug }) {
// After
function Section({ sectionData, sectionIndex }) {
```
Replace every `sectionData.sectionIndex` in the row keys with `sectionIndex`:
```js
key={`row-n-${sectionIndex}-${rowIndex}`}
key={`row-o-${sectionIndex}-${rowIndex}`}
key={`row-c-${sectionIndex}-${rowIndex}`}
```
Delete the `setPageSlug={setPageSlug}` attribute from the `<PageLink>` element (PageLink never declared it). Delete the stray `key={sectionData.sectionIndex}` attribute on the `<div className="pagesection card" …>` element (it is not a list sibling; the key lives on `<Section>` in Page.js).

- [ ] **Step 3: Verify nothing else read the mutation**

```bash
grep -rn "sectionData.sectionIndex\|\.sectionIndex" frontend/webapp/src --include=*.js
```
Expected: only the new `sectionIndex` prop usages in Section.js.

- [ ] **Step 4: Suite (baseline-only), smoke `http://localhost:8200/lehites` renders sections, then commit**

```bash
git add -A && git commit -m "refactor(page): sectionIndex as prop (no render-phase data mutation); drop dead setPageSlug/rowIndex props"
```

## Task 6: CSS cleanup — duplicates, orphans, dead rules

Behavior-preserving rule: when merging duplicate selectors, the merged block must equal the **cascade result** (later block wins conflicting properties; union of the rest).

**Files:**
- Modify: `src/views/Page/Narration.css`
- Modify: `src/views/Page/Page.css`
- Modify: `src/views/Page/TextContent.css`

- [ ] **Step 1: Narration.css — delete both commented-out blocks and the orphan `.fax` rules**

(a) Delete the first commented block: starts `/* .image-overlay {` and ends with the line `*/` immediately before `.fax .comment {`.

(b) Delete the orphan live rules (their component, `FaxBubbleContainer`, was deleted in `f2f827b4`; verify: `grep -rn 'className={"fax ' frontend/webapp/src --include=*.js` → nothing):
```css
.fax .comment {
  position: absolute;
  top: 0.9em;
  left: 0.5em;
}

.fax.visible {
  opacity: 1;
  transition: opacity 500ms;
}
.fax:hover {
  opacity: 1;
}

.fax.visible img {
  filter: invert();
  position: absolute;
  top: 0.5ex;
  left: 1ex;
  height: 1.2em;
  width: 1.3em;
}
```
(The `TextItemCounters` badge uses `item_counter fax` — a different selector, unaffected.)

(c) Delete the second commented block (`/* .image-overlay { … } */` at end of file — near-identical copy of the first).

- [ ] **Step 2: Narration.css — merge the duplicated panel-wrapper `h5 span` groups**

Two consecutive rule groups target `.peoplePlacePanelWrapper h5 span, .notesPanelWrapper h5 span, .scripturePanelWrapper h5 span` (and their `:hover`s). Replace BOTH groups (and both hover groups) with this single merged pair — union of properties, later block's values for conflicts:

```css
.peoplePlacePanelWrapper h5 span,
.notesPanelWrapper h5 span,
.scripturePanelWrapper h5 span {
  float: right;
  position: relative;
  top: -5px;
  cursor: pointer;
  font-weight: bold;
  font-size: 2em;
  font-family: "Courier New", monospace;
  margin-top: 0.25em;
}

.peoplePlacePanelWrapper h5 span:hover,
.notesPanelWrapper h5 span:hover,
.scripturePanelWrapper h5 span:hover {
  color: black;
}
```

- [ ] **Step 3: Narration.css — merge `.narration .images` and `.narration .images img.panel` duplicates**

(a) The block `.narration .images { display: flex; flex-direction: column; }` (lower in the file) — delete it, and add its two properties to the earlier `.narration .images { margin-left: 2.5em; … }` block:

```css
.narration .images {
  margin-left: 2.5em;
  background-color: #ddd;
  padding: 0.5em;
  border-radius: 1em;
  margin-bottom: 1em;
  margin-right: 1em;
  position: relative;
  display: flex;
  flex-direction: column;
}
```

(b) Two `.narration .images img.panel` blocks exist (`border: 1px solid #aaa; outline: none;` and later `border: 2px solid black; width: 100%; background-color: #999; min-height: 10vh;`). The later border wins in the cascade. Delete the first block and fold `outline: none;` into the second:

```css
.narration .images img.panel {
  border: 2px solid black;
  outline: none;
  width: 100%;
  background-color: #999;
  min-height: 10vh;
}
```

- [ ] **Step 4: Page.css — dedupe and delete dead rules**

(a) Delete the second, weaker `.theater-link` block near the end of the file (the `a.theater-link` blocks earlier already carry `display: flex; align-items: center`):
```css
.theater-link{
	display:inline-block;
  display: flex;
  align-items: center;
}
```

(b) Two identical `.right-image.leftconnection:hover::before { transform: rotate(-180deg); transition: 0.6s transform; }` blocks — delete one.

(c) Delete the empty rule:
```css
  .card .scripture .reference {
  }
```

(d) Delete the dead compound selector inside the mobile media query (as written it requires `.faxbox` nested inside `.faxbox` and matches nothing — the neighboring `.faxbox.images` rule below it is live and stays):
```css
  .faxbox 
  .faxbox .thumb_tabs li {
    width: 3em;
  }
```

- [ ] **Step 5: TextContent.css — remove the duplicated selector line**

In the group starting `.annotation:not(.fadedIn),` delete ONE of the two identical `.imgcom:not(.fadedIn),` lines. (Leave the `.comcom` line in the `fadedIn` group alone — removing it would change fade behavior; out of scope.)

- [ ] **Step 6: Visual smoke** at `http://localhost:8200/lehites`: open a verse → check the reference header, panels (people, scriptures, notes), open the facsimile panel (tabs render, close × styled), open an image panel. Compare against production styling from memory/screenshots — no visible change expected.

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Page/*.css && git commit -m "refactor(page): css dedupe — merge duplicate rules, delete orphan .fax and commented blocks"
```

---

# PHASE 2 — Correctness fixes (Tasks 7–12)

## Task 7: Extract `commentIndex.js` and fix the three index bugs (TDD)

The four inline functions in Page.js (`indexPageComments`, `addToPageCommentIndex`, `updateToPageComment`, `deleteToPageComments`) share one skeleton and have diverged into bugs (audit §2.1–2.3). Replace with one tested module. **Intentional behavior changes** (the bug fixes): update no longer throws on unindexed keys; delete actually removes the entry (previously left a truthy `[]`, so `_Common/Study/Study.js`'s `getComment` — which checks `=== undefined` — kept returning a ghost comment).

**Files:**
- Create: `src/views/Page/commentIndex.js`
- Create: `src/views/Page/__tests__/commentIndex.test.js`
- Modify: `src/views/Page/Page.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/views/Page/__tests__/commentIndex.test.js
import {
  indexPageComments,
  addToPageCommentIndex,
  updateToPageComment,
  deleteToPageComments,
} from "../commentIndex";

const msg = (links, id = "m1") => ({
  messageId: id,
  data: JSON.stringify({ links }),
});

test("indexPageComments buckets messages by link type and id", () => {
  const index = indexPageComments([msg({ text: 3 }), msg({ img: 101, text: 4 }, "m2")]);
  expect(index.text[3].messageId).toBe("m1");
  expect(index.text[4].messageId).toBe("m2");
  expect(index.img[101].messageId).toBe("m2");
});

test("indexPageComments skips non-JSON and link-less messages", () => {
  const index = indexPageComments([
    { data: "not json" },
    { data: JSON.stringify({ noLinks: true }) },
    msg({ text: 1 }),
  ]);
  expect(Object.keys(index)).toEqual(["text"]);
});

test("addToPageCommentIndex creates buckets and sets the item", () => {
  const out = addToPageCommentIndex(null, msg({ fax: "3.1830" }));
  expect(out.fax["3.1830"].messageId).toBe("m1");
});

test("updateToPageComment does not throw when the bucket is missing", () => {
  const out = updateToPageComment({}, msg({ text: 9 }));
  expect(out.text[9].messageId).toBe("m1");
});

test("deleteToPageComments removes the entry entirely", () => {
  const index = indexPageComments([msg({ text: 3 })]);
  const out = deleteToPageComments(index, msg({ text: 3 }));
  expect(out.text[3]).toBeUndefined(); // was a truthy [] before the fix
});

test("delete/update tolerate garbage data", () => {
  expect(deleteToPageComments({ a: {} }, { data: "x" })).toEqual({ a: {} });
  expect(updateToPageComment({ a: {} }, { data: "x" })).toEqual({ a: {} });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Page/__tests__/commentIndex.test.js
```
Expected: FAIL — `Cannot find module '../commentIndex'`.

- [ ] **Step 3: Implement the module**

```js
// src/views/Page/commentIndex.js
// Client-side index of study-group messages keyed by link type → link id.
// One skeleton for index/add/update/delete — the previous four hand-copied
// versions in Page.js had diverged into three bugs (audit 2026-07-14 §2.1-2.3).
import { testJSON } from "src/models/Utils";

// Returns [ [type, id], ... ] or null when the message carries no links.
function linkEntries(item) {
  const meta = testJSON(item?.data);
  if (!meta || meta.links === undefined) return null;
  return Object.entries(meta.links);
}

function setItem(comments, item) {
  const entries = linkEntries(item);
  if (!entries) return comments;
  for (const [type, id] of entries) {
    if (!type) continue;
    if (!comments[type]) comments[type] = {};
    comments[type][id] = item;
  }
  return comments;
}

export function indexPageComments(messages) {
  const comments = {};
  for (const item of messages || []) setItem(comments, item);
  return comments;
}

export function addToPageCommentIndex(comments, item) {
  return setItem(comments || {}, item);
}

export function updateToPageComment(comments, item) {
  return setItem(comments || {}, item);
}

export function deleteToPageComments(comments, item) {
  const entries = linkEntries(item);
  if (!entries || !comments) return comments;
  for (const [type, id] of entries) {
    if (comments[type]) delete comments[type][id];
  }
  return comments;
}
```

- [ ] **Step 4: Run the tests — expected PASS**

```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/Page/__tests__/commentIndex.test.js
```

- [ ] **Step 5: Wire Page.js**

(a) Add to imports: `import { indexPageComments, addToPageCommentIndex, updateToPageComment, deleteToPageComments } from "./commentIndex";`

(b) Delete the four inline function definitions at the bottom of Page.js (everything from `function indexPageComments(array) {` to the end of `function deleteToPageComments(comments, item) { … }`). The reducer cases (`addToPageComments`, `updateToPageComment`, `deleteToPageComments`) and `loadPageComments` now resolve to the imports; no call-site changes needed.

(c) Check `testJSON` is still used in Page.js (`grep -n "testJSON" src/views/Page/Page.js`) — if the deleted functions were the only users, remove it from the `src/models/Utils` import list.

- [ ] **Step 6: Full suite (baseline-only failures), then commit**

```bash
git add -A && git commit -m "fix(page): extract tested commentIndex module; delete now removes entries, update no longer throws"
```

## Task 8: Safe highlight regex compilation (TDD)

`renderTextContent` (TextContent.js) builds `new RegExp("(" + highlight.string + ")", "gi")`. Image/commentary highlight strings are **intentional patterns** (built by `setHighlights`), but comment highlights and user text selections are raw — a selection containing `(` throws and takes the row down.

**Files:**
- Create: `src/views/Page/highlightPattern.js`
- Create: `src/views/Page/__tests__/highlightPattern.test.js`
- Modify: `src/views/Page/TextContent.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/views/Page/__tests__/highlightPattern.test.js
import { compileHighlightRegex } from "../highlightPattern";

test("compiles an intentional pattern as-is", () => {
  const re = compileHighlightRegex("waters([^a-z]|<[^>]*>)+?of([^a-z]|<[^>]*>)+?Mormon");
  expect(re.test("waters <b>of</b> Mormon")).toBe(true);
});

test("falls back to literal matching for raw text with regex metacharacters", () => {
  const re = compileHighlightRegex("wicked (as to the) King");
  // "(as to the" alone is an invalid group only when unbalanced:
  const re2 = compileHighlightRegex("wicked (as to the King");
  expect(re2).not.toBeNull();
  expect(re2.test("and he was wicked (as to the King")).toBe(true);
  expect(re.test("wicked (as to the) King")).toBe(true);
});

test("returns null only if even the escaped form cannot compile", () => {
  expect(compileHighlightRegex("plain words")).not.toBeNull();
});
```

- [ ] **Step 2: Run to verify failure** (`Cannot find module '../highlightPattern'`).

- [ ] **Step 3: Implement**

```js
// src/views/Page/highlightPattern.js
// Highlight strings come from two sources: setHighlights builds intentional
// regex patterns from titles, but comment highlights and user selections are
// raw text. Compile raw first; if that throws (unbalanced parens etc.),
// escape and retry so raw text still matches literally.
export function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function compileHighlightRegex(string) {
  try {
    return new RegExp("(" + string + ")", "gi");
  } catch (e) {
    try {
      return new RegExp("(" + escapeRegex(string) + ")", "gi");
    } catch (e2) {
      return null;
    }
  }
}
```

- [ ] **Step 4: Run tests — PASS.**

- [ ] **Step 5: Wire TextContent.js** — in `renderTextContent`:

```js
// Before
      var re = new RegExp("(" + highlight.string + ")", "gi");
      if (highlighted.match(re)) continue;
// After
      var re = compileHighlightRegex(highlight.string);
      if (!re || highlighted.match(re)) continue;
```
Add the import: `import { compileHighlightRegex } from "./highlightPattern";`

- [ ] **Step 6: Suite + smoke** (select a phrase containing `(` inside an open verse — no console error, highlight applies), then commit:

```bash
git add -A && git commit -m "fix(page): highlight regex compiles safely; raw selections with metacharacters no longer throw"
```

## Task 9: Render-safety micro-fixes (Section, Floaters, MuteButton, LightBox, TextContent heading)

**Files:**
- Modify: `src/views/Page/Section.js`
- Modify: `src/views/Page/Floaters.js`
- Modify: `src/views/Page/MuteButton.js`
- Modify: `src/views/Page/Narration.js` (LightBox)
- Modify: `src/views/Page/TextContent.js`

- [ ] **Step 1: Section.js — unknown row types must not render raw objects**

```js
// Before
            } else return rowData;
// After
            } else return null;
```

- [ ] **Step 2: Floaters.js — dead fallback and missing key**

```js
// Before
        let topVal = document.querySelector(`div[textid=${pageSlug}\\/${list[u]}]`)?.offsetTop + "px";

        if (!topVal) topVal = "-50px";
// After
        const rowEl = document.querySelector(`div[textid=${pageSlug}\\/${list[u]}]`);
        const topVal = rowEl ? rowEl.offsetTop + "px" : "-50px";
```
And add the key to the returned element:
```js
        return <div
          key={u}
          className={"userCircle online " + u}
```

- [ ] **Step 3: MuteButton.js — stop mutating shared preferences**

```js
// Before
    const toggleSound = (e) => {
        e.stopPropagation();
        e.preventDefault();
        let prefs = pageController.appController.states?.preferences;
        prefs.audio = !prefs.audio;
        pageController.appController.functions.updatePrefs(prefs);
      }
// After
    const toggleSound = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const prefs = pageController.appController.states?.preferences || {};
        pageController.appController.functions.updatePrefs({ ...prefs, audio: !prefs.audio });
      }
```

- [ ] **Step 4: Narration.js LightBox — array-as-delay typo**

```js
// Before
      setTimeout(() => {
        activeImg.click();
      }, [100]);
// After
      setTimeout(() => {
        activeImg.click();
      }, 100);
```

- [ ] **Step 5: TextContent.js — compute the display heading instead of mutating data in render**

```js
// Before
  if(textContentController.data?.heading)
  textContentController.data.heading = textContentController.data.heading?.replace(/^\[.*?\]/, "").trim();
// After
  const displayHeading = textContentController.data?.heading?.replace(/^\[.*?\]/, "").trim();
```
Then in the JSX, replace both heading usages:
```js
// Before (branch 1)
                  {textContentController.data &&
                    textContentController.data.heading}
// After
                  {displayHeading}
```
The second branch reads `narrationController?.data?.text?.heading` — that is the same underlying string for the top-level card. Leave it (it's the nested-blocks branch and the raw heading there was already displayed un-stripped whenever `data.heading` hadn't been mutated yet on first paint; strip it too for consistency):
```js
// Before (branch 2)
                  {narrationController?.data &&
                    narrationController?.data?.text?.heading}
// After
                  {narrationController?.data?.text?.heading?.replace(/^\[.*?\]/, "").trim()}
```

- [ ] **Step 6: Suite (baseline-only) + smoke** (open a page in study mode if available; check verse headers render, mute button toggles on mobile-width viewport), then commit:

```bash
git add -A && git commit -m "fix(page): render-safety micro-fixes (unknown row type, Floaters key/topVal, prefs mutation, setTimeout delay, heading mutation)"
```

## Task 10: Stop mutating router state; un-hijack Tab; kill the DOM-click navigation

**Files:**
- Modify: `src/views/Page/Page.js`
- Modify: `src/views/Page/Narration.js`

- [ ] **Step 1: Page.js — copy, don't mutate, `match.params`**

```js
// Before
  const match = useRouteMatch();
  if (match.params.pageSlug === "study") {
    let parts = localStorage
      .getItem("studybookmark")
      ?.split("/")
      .slice(-2) || [null, null];
    match.params.pageSlug = parts[0] || "lehites";
    match.params.textId = parts[1] || 1;
  }

  let initOpen = prepareInitOpen(match.params);
// After
  const match = useRouteMatch();
  let routeParams = match.params;
  if (routeParams.pageSlug === "study") {
    let parts = localStorage
      .getItem("studybookmark")
      ?.split("/")
      .slice(-2) || [null, null];
    routeParams = {
      ...routeParams,
      pageSlug: parts[0] || "lehites",
      textId: parts[1] || 1,
    };
  }

  let initOpen = prepareInitOpen(routeParams);
```
Then replace every remaining `match.params` in the component body with `routeParams` (the `routeKey`/`pageIdentityKey` template strings, the `prepareInitOpen(match.params)` calls in the two effects, and the `match.params.imageId || match.params.commentaryId` branch). `match.url` (used for `lastLeaf`) stays as-is. Verify: `grep -n "match.params" src/views/Page/Page.js` → no hits after the edit.

- [ ] **Step 2: Page.js — replace the `.contents_link a` DOM-click navigation**

```js
// Before
    if (!response.page[index].sections) {
      return document.querySelector(".contents_link a").click();
    } //TODO history.push("/contents");
// After
    if (!response.page[index].sections) {
      return history.push("/contents");
    }
```
Add the import at the top: `import { history } from "src/models/routeHistory";` (same source Annotations.js already uses).

- [ ] **Step 3: Narration.js ScripturePanel — remove the global Tab hijack**

In the `handleKeyDown` switch, delete the single line `case 'Tab':` (leaving `case 'ArrowRight':` to fall through to the same body as before).

- [ ] **Step 4: Suite (baseline-only) + smoke:** `http://localhost:8200/study` redirects to the bookmarked page; deep link `http://localhost:8200/lehites/3` still opens verse 3; with a scripture panel open, Tab moves browser focus instead of cycling refs (arrows still cycle). Commit:

```bash
git add -A && git commit -m "fix(page): stop mutating match.params, navigate /contents via history, stop hijacking Tab in scripture panel"
```

## Task 11: Retire `states.route`; fix the FacsimilePanel effect that can never re-fire

`states.route` freezes the react-router match object at first mount (SSoT violation §4.1); `FacsimilePanel` is its only reader. Its effect also depends on `[narrationController.states]`, whose identity never changes (the reducer spreads the controller, not `states`) — so the effect runs once on mount only, by accident.

**Files:**
- Modify: `src/views/Page/Page.js`
- Modify: `src/views/Page/Narration.js`

- [ ] **Step 1: Verify the only reader**

```bash
grep -rn "states.route" frontend/webapp/src --include=*.js
```
Expected: only the two `FacsimilePanel` lines in Narration.js (plus the Page.js init).

- [ ] **Step 2: Narration.js FacsimilePanel — read live state instead of the frozen route**

```js
// Before
    let initOpenVersion =
      narrationController.pageController.states.initOpen.faxVersion;
    let fromURL =
      narrationController.pageController.states.route.params.pageSlug +
      "/" +
      narrationController.pageController.states.route.params.textId;
    if (narrationController.data.text.slug !== fromURL) return false;
// After
    const { initOpen, pageSlug } = narrationController.pageController.states;
    let initOpenVersion = initOpen.faxVersion;
    let fromURL = pageSlug + "/" + initOpen.textId;
    if (narrationController.data.text.slug !== fromURL) return false;
```
And fix the dependency array so the deep-link activation re-fires when the target actually changes:
```js
// Before
  }, [narrationController.states]);
// After
  }, [
    narrationController.states.faxList,
    narrationController.pageController.states.initOpen.faxVersion,
    narrationController.pageController.states.initOpen.textId,
  ]);
```
Also delete the stale commented lines inside that effect if still present (`//&& !narrationController.pageController.states.init` and `//narrationController.pageController.functions.markAsInitiated()`).

- [ ] **Step 3: Page.js — remove the frozen copy**

Delete the line `route: match,` from the `states` init object.

- [ ] **Step 4: Suite + smoke:** deep-link a facsimile URL (e.g. `http://localhost:8200/lehites/3/fax/1830`) — the fax panel must auto-open on load, exactly as before. Commit:

```bash
git add -A && git commit -m "fix(page): retire frozen states.route; FacsimilePanel reads live initOpen and re-fires on target change"
```

## Task 12: Extract `usePageComments` (fixes the window-listener leak)

Moves comment loading/indexing/event-listening out of the 950-line Page.js into a hook, following the `usePageInit` precedent. **Fixes audit §2.13:** the old code added `window` listeners inside `loadPageComments` using per-render function identities, so its own `removeEventListener` calls never matched and handlers accumulated per visited page, never removed on unmount.

**Files:**
- Create: `src/views/Page/usePageComments.js`
- Create: `src/views/Page/__tests__/usePageComments.test.js`
- Modify: `src/views/Page/Page.js`

- [ ] **Step 1: Write the failing test**

```js
// src/views/Page/__tests__/usePageComments.test.js
import React from "react";
import { render } from "@testing-library/react";
import { usePageComments } from "../usePageComments";

jest.mock("src/contexts/MessengerContext", () => ({
  useMessenger: () => null, // disconnected: hook must still register listeners & settle
}));

const makePageController = () => ({
  pageData: { slug: "lehites" },
  pageComments: null,
  states: { pageSlug: "lehites", commentGroupId: null },
  functions: {
    setPageComments: jest.fn(),
    addToPageComments: jest.fn(),
    updateToPageComment: jest.fn(),
  },
  appController: {
    states: {
      user: { user: "kc", social: { user_id: "kc" } },
      studyGroup: { studyModeOn: true, activeGroup: { url: "group-1" } },
    },
    functions: { setTypingLocations: jest.fn() },
  },
});

function Probe({ pageController }) {
  usePageComments(pageController);
  return null;
}

test("registers page-scoped window listeners and removes the SAME handlers on unmount", () => {
  const added = [];
  const removed = [];
  const origAdd = window.addEventListener;
  const origRemove = window.removeEventListener;
  window.addEventListener = (name, fn) => { added.push([name, fn]); origAdd.call(window, name, fn); };
  window.removeEventListener = (name, fn) => { removed.push([name, fn]); origRemove.call(window, name, fn); };

  const { unmount } = render(<Probe pageController={makePageController()} />);
  const names = added.map(([n]) => n);
  expect(names).toContain("addMessageToPage-lehites");
  expect(names).toContain("updateMessageToPage-lehites");
  expect(names).toContain("fireStudyGroupAction");

  unmount();
  for (const [name, fn] of added.filter(([n]) => n.includes("MessageToPage") || n === "fireStudyGroupAction")) {
    expect(removed).toContainEqual([name, fn]); // identical function reference
  }

  window.addEventListener = origAdd;
  window.removeEventListener = origRemove;
});

test("incoming addMessageToPage events dispatch into the controller", () => {
  const pc = makePageController();
  render(<Probe pageController={pc} />);
  window.dispatchEvent(Object.assign(new Event("addMessageToPage-lehites"), { message: { data: "{}" } }));
  expect(pc.functions.addToPageComments).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify failure** (`Cannot find module '../usePageComments'`).

- [ ] **Step 3: Implement the hook** — this is a *move* of Page.js logic; behavior identical except the listener lifecycle. Carry the original inline comments over where marked.

```js
// src/views/Page/usePageComments.js
// Study-group comment loading for a page: fetch + index + live window-event
// wiring, gated exactly as the old Page.js loadPageComments was. Extracted per
// audit 2026-07-14 §5.3; fixes §2.13 (listeners were added with per-render
// function identities and never removed on unmount).
import { useEffect, useRef, useState } from "react";
import { recordDeepLinkEvent } from "src/utils/deepLinkInstrument";
import { useMessenger } from "src/contexts/MessengerContext";
import { pageScrollManager } from "./usePageInit";
import { countFaxFromIndex, mergeCounts } from "./pageCommentCounts";
import { indexPageComments } from "./commentIndex";

const COMMENTS_FALLBACK_MS = 2500;

// Socket-fanout study-group actions relevant to this page.
function processStudyGroupEvent(pageController, e) {
  let action = {};
  try {
    action = JSON.parse(e.action);
  } catch (err) {
    return false;
  }
  let { username, key, val } = action;
  if (username === pageController.appController.states.user.user) return false;

  let processors = {
    updatePagePosition: (username, val) => {
      let { pageSlug, location } = val;
      if (pageSlug === pageController.states.pageSlug)
        pageController.functions.moveStudyBuddies({ username, location });
    },
    exitStudyGroup: (username, val) => {
      if (pageController.appController.states.studyGroup.activeGroup.url === val) {
        pageController.functions.moveStudyBuddies({ username, location: null });
      }
    },
    updateTypingLocation: (username, val) => {
      pageController.appController.functions.setTypingLocations({
        username,
        action: val,
      });
    },
  };
  if (processors[key]) processors[key](username, val);
}

export function usePageComments(pageController) {
  const messenger = useMessenger();
  const [commentState, setCommentState] = useState("init");
  const [readyToScroll, setReadyToScroll] = useState(false);

  // Guards async setState after navigation (see the original Page.js comment).
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const appStates = pageController.appController.states;
  const group = appStates.studyGroup.activeGroup;
  const studyModeisOn = appStates.studyGroup.studyModeOn;
  const needToLoadComments =
    !!appStates.user.user && studyModeisOn && !!group?.url;

  useEffect(() => {
    if (pageController.pageComments) setReadyToScroll(true);
  }, [pageController.pageComments]);

  useEffect(() => {
    if (studyModeisOn) setReadyToScroll(false);
  }, [group?.url]);

  // Live-update listeners, one registration per (page, group), cleaned up on
  // unmount/change. pageController's inner objects are mutated in place by the
  // reducer, so these closures observe current state even across re-renders.
  useEffect(() => {
    if (!group || !pageController.pageData) return undefined;
    const pageSlug = pageController.states.pageSlug;
    const addMessageToPage = (e) =>
      pageController.functions.addToPageComments(e.message);
    const updateMessageToPage = (e) =>
      pageController.functions.updateToPageComment(e.message);
    const onStudyGroupAction = (e) => processStudyGroupEvent(pageController, e);
    window.addEventListener("addMessageToPage-" + pageSlug, addMessageToPage);
    window.addEventListener("updateMessageToPage-" + pageSlug, updateMessageToPage);
    window.addEventListener("fireStudyGroupAction", onStudyGroupAction);
    return () => {
      window.removeEventListener("addMessageToPage-" + pageSlug, addMessageToPage);
      window.removeEventListener("updateMessageToPage-" + pageSlug, updateMessageToPage);
      window.removeEventListener("fireStudyGroupAction", onStudyGroupAction);
    };
  }, [pageController.states.pageSlug, group?.url, !!pageController.pageData]);

  // Fetch + index. Same gates as the old loadPageComments.
  useEffect(() => {
    if (!pageController.pageData) return undefined;
    setCommentState("started loading");
    const newPageLoad = group && !pageController.pageComments;
    const switchToOtherGroup =
      group && pageController.states.commentGroupId !== group.url;
    if (!newPageLoad && !switchToOtherGroup) {
      setReadyToScroll(true);
      return undefined;
    }
    pageController.functions.setPageComments({
      groupId: null,
      index: null,
      counts: null,
    });
    setCommentState("set Listeners");
    const groupId = group.url;
    const fallbackTimer = setTimeout(() => {
      recordDeepLinkEvent("loadPageComments:fallback");
      if (isMounted.current) setReadyToScroll(true);
    }, COMMENTS_FALLBACK_MS);

    if (!messenger?.loadPageComments) {
      clearTimeout(fallbackTimer);
      setReadyToScroll(true);
      return undefined;
    }
    setCommentState("made query");
    messenger
      .loadPageComments(group, pageController.pageData?.slug)
      .then(({ messages, counts }) => {
        clearTimeout(fallbackTimer);
        // Bail if the page unmounted while the fetch was in flight.
        if (!isMounted.current) return;
        setCommentState("indexing");
        const index = indexPageComments(messages);
        // Single paint: index AND counts land in one dispatch (spec P1) — fax
        // counts derive from the index client-side, com/img came from the
        // server. Defer the React paint out of any active scroll campaign so
        // render work never competes with the animation.
        setCommentState("placing");
        pageScrollManager.waitForIdle().then(() => {
          if (!isMounted.current) return;
          recordDeepLinkEvent("pageComments:placed");
          pageController.functions.setPageComments({
            groupId,
            index,
            counts: mergeCounts(counts, countFaxFromIndex(index)),
          });
        });
      })
      .catch((error) => {
        clearTimeout(fallbackTimer);
        console.log({ error });
        if (isMounted.current) setReadyToScroll(true);
      });
    return () => clearTimeout(fallbackTimer);
  }, [group?.url, pageController.states.pageSlug, pageController.pageData]);

  return { commentState, readyToScroll, setReadyToScroll, needToLoadComments };
}
```

- [ ] **Step 4: Run the new test — PASS.**

- [ ] **Step 5: Rewire Page.js** — delete the moved logic, call the hook:

(a) Delete from the component body: the `let [commentState, setCommentState] = useState("init");` line; the `studyModeisOn` / `userIsLoggedIn` / `hasActiveGroup` / `needToLoadComments` block; the `const [readyToScroll, setReadyToScroll] = useState(false);` line; the two effects `useEffect(() => { if (pageController.pageComments) setReadyToScroll(true); }, …)` and `useEffect(() => { if (…studyModeOn) setReadyToScroll(false); }, …)`; the `//Load Page Comments` effect; the whole `processStudyGroupEventOnPage` function; the whole `loadPageComments` function; the `const messenger = useMessenger();` line and its import **if** nothing else in Page.js uses messenger (verify with grep).

Keep in Page.js: the `isMounted` ref (still guards `getPageDataFromAPI`), the `setActiveLeafCursorController` effect, `gateOpen`/`initIdentityKey`/`onTail`/`usePageInit`, the scroll-spy effect, and `[stageClass, setStageClass]`.

(b) After the `useReducer` block and the route-reset effect, add:
```js
  const { commentState, readyToScroll, setReadyToScroll, needToLoadComments } =
    usePageComments(pageController);
```
with the import `import { usePageComments } from "./usePageComments";`

(c) The routeKey effect's `setReadyToScroll(false);` call stays — it now calls the hook's setter, same semantics.

(d) Remove the now-unused imports from Page.js: `countFaxFromIndex, mergeCounts` (moved into the hook), `recordDeepLinkEvent` **only if** unused elsewhere in the file (it is still used — verify with `grep -n "recordDeepLinkEvent" src/views/Page/Page.js`; if only the moved code used it, remove), and the Task-7 `commentIndex` import shrinks to just the three reducer-case functions:
```js
import { addToPageCommentIndex, updateToPageComment, deleteToPageComments } from "./commentIndex";
```

- [ ] **Step 6: Full suite (baseline-only) + smoke.** This is the highest-risk task in the plan — smoke thoroughly at `http://localhost:8200`: (1) plain page load renders; (2) deep-link `…/lehites/3` scrolls and opens; (3) if a study-group login is available: enable study mode, load a page, confirm comment badges appear and the "loading group comments" notice shows/clears; (4) navigate between two pages twice and confirm via DevTools `getEventListeners(window)` (Chrome) that `addMessageToPage-*` listeners do not accumulate.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "refactor(page): extract usePageComments hook; window listeners now clean up (leak fix)"
```

---

# PHASE 3 — DRY extractions (Tasks 13–21)

## Task 13: `extractTagIds` helper; delete TextContent's dead extraction (TDD)

**Files:**
- Create: `src/views/Page/tagIds.js`
- Create: `src/views/Page/__tests__/tagIds.test.js`
- Modify: `src/views/Page/Narration.js`
- Modify: `src/views/Page/TextContent.js`

- [ ] **Step 1: Verify TextContent's extraction is dead**

TextContent writes `data.imageIds`/`data.commentaryIds` onto the *text* object; Narration reads them from the *narration* object — different objects.
```bash
grep -rn "\.data\.imageIds\|\.data\.commentaryIds\|text\.imageIds\|text\.commentaryIds" frontend/webapp/src --include=*.js
```
Expected: assignments in TextContent.js + assignments-and-reads in Narration.js only. Narration's reads (`narrationController.data.imageIds` in `preLoadSupplement`) target the narration-level fields, never text-level.

- [ ] **Step 2: Write the failing tests**

```js
// src/views/Page/__tests__/tagIds.test.js
import { extractTagIds } from "../tagIds";

test("extracts and dedupes ids for a tag across multiple texts", () => {
  expect(
    extractTagIds("i", "a [i]12[/i] b [i]12[/i]", "c [i]7[/i]")
  ).toEqual(["12", "7"]);
});

test("is case-insensitive and tag-scoped", () => {
  expect(extractTagIds("c", "x [C]005[/C] y [i]9[/i]")).toEqual(["005"]);
});

test("tolerates non-string and empty inputs", () => {
  expect(extractTagIds("i", undefined, null, "")).toEqual([]);
});
```

- [ ] **Step 3: Run — FAIL (module missing). Then implement:**

```js
// src/views/Page/tagIds.js
// Inline supplement tags look like [i]123[/i] (art) and [c]123[/c]
// (commentary). Returns deduped id strings in first-seen order.
export function extractTagIds(tag, ...texts) {
  const re = new RegExp(`\\[${tag}\\](\\d+)\\[\\/${tag}\\]`, "gi");
  const ids = [];
  for (const text of texts) {
    if (typeof text !== "string") continue;
    for (const m of text.matchAll(re)) ids.push(m[1]);
  }
  return [...new Set(ids)];
}
```

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Wire Narration.js** — replace the entire "Extract Image and Commentary Values" block (from `let imageIds = [];` through the `initNarrationController.data.commentaryIds = …` assignment) with:

```js
      const quoteContents = (initNarrationController.data.text.quotes || []).map(
        (q) => q.content
      );
      initNarrationController.data.imageIds = extractTagIds(
        "i",
        initNarrationController.data.text.content,
        ...quoteContents
      );
      initNarrationController.data.commentaryIds = extractTagIds(
        "c",
        initNarrationController.data.text.content,
        ...quoteContents
      );
```
Import: `import { extractTagIds } from "./tagIds";`. Keep the `personIds`/`placeIds` extraction below it unchanged.

- [ ] **Step 6: TextContent.js — delete the dead block** (from `//Extract Image and Commentary Values` through the `initTextContentController.data.commentaryIds = …` assignment).

- [ ] **Step 7: Suite + smoke** (open a verse with art/commentary bubbles — bubbles and panels still work; hover a reference header to trigger `preLoadSupplement`), then commit:

```bash
git add -A && git commit -m "refactor(page): shared extractTagIds; delete TextContent's dead duplicate extraction"
```

## Task 14: `titleToHighlightPattern` — collapse the 4× sanitization in setHighlights (TDD)

**Files:**
- Modify: `src/views/Page/highlightPattern.js`
- Modify: `src/views/Page/__tests__/highlightPattern.test.js`
- Modify: `src/views/Page/Narration.js`

- [ ] **Step 1: Add the failing test** to `highlightPattern.test.js`:

```js
import { titleToHighlightPattern } from "../highlightPattern";

test("titleToHighlightPattern strips edge punctuation and bridges non-letters", () => {
  const pattern = titleToHighlightPattern('"Waters of Mormon!"');
  expect(pattern).toBe("Waters([^a-z]|<[^>]*>)+?of([^a-z]|<[^>]*>)+?Mormon");
  const re = new RegExp(pattern, "gi");
  expect(re.test("waters <b>of</b> Mormon")).toBe(true);
});
```

- [ ] **Step 2: Run — FAIL. Implement in `highlightPattern.js`:**

```js
// Titles become tolerant regexes: edge punctuation stripped, every non-letter
// run matches punctuation OR markup so highlights survive inline tags.
export function titleToHighlightPattern(title) {
  return String(title)
    .replace(/^[^a-z\d]*|[^a-z\d]*$/gi, "")
    .replace(/[^a-z]+/gi, "([^a-z]|<[^>]*>)+?");
}
```

- [ ] **Step 3: Run — PASS.**

- [ ] **Step 4: Rewrite `setHighlights` in Narration.js** using the helper (replaces the two copy-pasted for-in blocks; note the old code had `if (rowCommentaryData[i] === undefined) return;` which aborted the whole function mid-loop — the rewrite skips instead, an intentional micro-fix):

```js
  const setHighlights = (activeId, previewIds, commentHighlights) => {
    const highlights = [];
    const pushMatches = (collection) => {
      for (const entry of Object.values(collection || {})) {
        if (!entry?.title) continue;
        const cls =
          entry.id === activeId
            ? "primary"
            : previewIds.includes(entry.id)
            ? "secondary"
            : null;
        if (cls)
          highlights.push({ class: cls, string: titleToHighlightPattern(entry.title) });
      }
    };
    pushMatches(narrationController.supplement.image);
    pushMatches(narrationController.supplement.commentary);

    if (commentHighlights) {
      for (const h of commentHighlights) {
        highlights.push({ class: "commented", string: h });
      }
    }

    dispatch({ fn: "setHighlights", val: highlights });
  };
```
Import: `import { titleToHighlightPattern } from "./highlightPattern";`

- [ ] **Step 5: Suite + smoke** (hover a commentary bubble → the matching narration phrase highlights; click an art bubble → primary highlight on the title text), then commit:

```bash
git add -A && git commit -m "refactor(page): titleToHighlightPattern helper replaces 4x copy-pasted sanitization in setHighlights"
```

## Task 15: `useStageTransition` — one implementation of the page-swap choreography (TDD)

Also fixes the unbounded `while (!document.querySelector(".content.ready"))` poll (audit §2.11) with an 8s deadline, and converts Connection's derived `useState`+`useEffect` animation state into a pure lookup (audit §5.7).

**Files:**
- Create: `src/views/Page/useStageTransition.js`
- Create: `src/views/Page/__tests__/useStageTransition.test.js`
- Modify: `src/views/Page/Connection.js`
- Modify: `src/views/Page/PageLink.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/views/Page/__tests__/useStageTransition.test.js
import { runStageTransition } from "../useStageTransition";

const instant = () => Promise.resolve();

test("runs the class choreography and clears after ready", async () => {
  const calls = [];
  let ready = false;
  const navigate = () => { ready = true; };
  await runStageTransition({
    setStageClass: (c) => calls.push(c),
    navigate,
    isReady: () => ready,
    waitFn: instant,
  });
  expect(calls).toEqual(["stageLeft", "stageRight stageLeft", "stageRight", null]);
});

test("back direction swaps the class order", async () => {
  const calls = [];
  await runStageTransition({
    setStageClass: (c) => calls.push(c),
    navigate: () => {},
    isReady: () => true,
    direction: "back",
    waitFn: instant,
  });
  expect(calls[0]).toBe("stageRight");
});

test("gives up and clears the stage class when ready never comes", async () => {
  const calls = [];
  let fakeNow = 0;
  await runStageTransition({
    setStageClass: (c) => calls.push(c),
    navigate: () => {},
    isReady: () => false,
    waitFn: (ms) => { fakeNow += ms; return Promise.resolve(); },
    now: () => fakeNow,
    timeoutMs: 1000,
  });
  expect(calls[calls.length - 1]).toBeNull(); // no longer an infinite loop
});
```

- [ ] **Step 2: Run — FAIL. Implement:**

```js
// src/views/Page/useStageTransition.js
// Stage-swap page transition previously copy-pasted between Connection and
// PageLink. The ready-poll is now bounded (the old `while` could spin forever
// if the next page never reached .content.ready).
import { useHistory } from "react-router-dom";
import { usePageController } from "src/contexts/PageControllerContext";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const READY_TIMEOUT_MS = 8000;

export async function runStageTransition({
  setStageClass,
  navigate,
  isReady,
  direction = "forward",
  waitFn = wait,
  now = Date.now,
  timeoutMs = READY_TIMEOUT_MS,
}) {
  const [first, second] =
    direction === "back" ? ["stageRight", "stageLeft"] : ["stageLeft", "stageRight"];
  setStageClass(first);
  await waitFn(400);
  setStageClass(second + " " + first);
  await waitFn(10);
  setStageClass(second);
  navigate();
  await waitFn(500);
  const deadline = now() + timeoutMs;
  while (!isReady() && now() < deadline) await waitFn(50);
  setStageClass(null);
}

// Returns handleClick(slug, direction) → click handler.
export function useStageTransition() {
  const pageController = usePageController();
  const history = useHistory();
  return (slug, direction) => async (event) => {
    const { setStageClass } = pageController.appController?.functions || {};
    if (!setStageClass) return;
    event.preventDefault();
    await runStageTransition({
      setStageClass,
      direction,
      navigate: () => history.push(`/${slug}`),
      isReady: () => !!document.querySelector(".content.ready"),
    });
  };
}
```

- [ ] **Step 3: Run — PASS.**

- [ ] **Step 4: Rewire Connection.js** — full replacement of the component pair (drops the derived-state `useState`/`useEffect`, the local `wait`, and the duplicated handler):

```js
import React from "react";
import { Link } from "react-router-dom";
import { useStageTransition } from "./useStageTransition";

const CONNECTION_ANIMATION = {
  left: { connectionType: "leftconnection", image: "right-image" },
  from: { connectionType: "fromconnection", image: "left-image" },
  back: { connectionType: "backconnection", image: "left-image" },
  right: { connectionType: "rightconnection", image: "right-image" },
};

export default function Connection({ rowData }) {
  const pageAnimation =
    CONNECTION_ANIMATION[rowData.connection.type] || CONNECTION_ANIMATION.right;
  return (
    <div className="row" type={rowData.connection.type}>
      <div style={{ width: "100%" }}>
        <ConnectionLink rowData={rowData} pageAnimation={pageAnimation} />
      </div>
    </div>
  );
}

const ConnectionLink = ({ rowData, pageAnimation }) => {
  const stageTransition = useStageTransition();
  const { slug, type: linkType } = rowData.connection;
  // Historical mapping: every non-"right" connection played the reverse sweep.
  const direction = linkType !== "right" ? "back" : "forward";
  return (
    <Link to={`/${slug}`} onClick={stageTransition(slug, direction)}>
      <div>
        <div
          className={`${pageAnimation.image} ${pageAnimation.connectionType} connection`}
        >
          {rowData.connection.text}
        </div>
      </div>
    </Link>
  );
};
```
(Check `useHistory`/`useEffect`/`useState` imports in the file — all now unused here; remove.)

- [ ] **Step 5: Rewire PageLink.js** — delete its local `wait`/`handleClick`/`useHistory`/`setStageClass` lines and use:

```js
import { useStageTransition } from "./useStageTransition";
// …inside the component:
  const stageTransition = useStageTransition();
  const { slug } = rowData.capsulation || {};
```
and on the Link: `onClick={stageTransition(slug, "forward")}`. Remove the now-unused `usePageController` import **only if** nothing else in the file uses it (`renderPersonPlaceHTML(rowData.capsulation?.description || "", pageController)` still needs it — keep the hook and that call as-is).

- [ ] **Step 6: Suite + smoke** (click a connection arrow at the bottom of a page and a PageLink row: the slide animation plays and lands on the new page; the stage class clears), then commit:

```bash
git add -A && git commit -m "refactor(page): shared useStageTransition with bounded ready-poll; Connection animation as pure lookup"
```

## Task 16: Unify the bubble-anchor gatherers in Annotations.js

`gatherCommentary` (inline) and `gatherImages` duplicate the same DOM-grouping algorithm; both use `for…in` over NodeLists. One parameterized function. Note: commentary filters blacklisted sources **before** grouping (affects cursor math) — the unified function takes a filter callback so grouping stays identical.

**Files:**
- Modify: `src/views/Page/Annotations.js`

- [ ] **Step 1: Verify `gatherImages` has no external importers**

```bash
grep -rn "gatherImages" frontend/webapp/src --include=*.js | grep -v "views/Page/Annotations"
```
Expected: nothing.

- [ ] **Step 2: Replace both gatherers with one function**

Delete `export function gatherImages(slug) { … }` and the inline `gatherCommentary` closure inside `CommentaryBubbles`. Add:

```js
// Groups inline anchors (a.c commentary refs / a.i art refs) into vertically
// clustered bubbles. `spacing` is the min px gap before a new cluster starts;
// `keepId` filters ids out BEFORE grouping (blacklisted commentary sources
// must not affect cluster positions).
function gatherAnchorGroups(slug, anchorClass, spacing, keepId = () => true) {
  const paddingTop = 30;
  const container_y = document
    .querySelector(`[textid="${slug}"] .content`)
    ?.getBoundingClientRect().top;
  const anchors = document.querySelectorAll(`[textid="${slug}"] a.${anchorClass}`);
  let cursor = 0;
  const groups = {};
  for (const anchor of anchors) {
    if (anchor.className !== anchorClass) continue;
    const id = anchor.attributes.contentid.value;
    if (!keepId(id)) continue;
    let y = anchor.getBoundingClientRect().top;
    if (!y) continue;
    y = paddingTop + y - container_y;
    if (y - cursor > spacing) cursor = y;
    if (!groups[cursor]) groups[cursor] = { y: cursor + "px", count: 0, ids: [] };
    groups[cursor].count++;
    groups[cursor].ids.push(id);
  }
  return Object.values(groups);
}
```

- [ ] **Step 3: Update the two call sites**

In `CommentaryBubbles` (replace `var items = gatherCommentary();`):
```js
  const items = gatherAnchorGroups(
    narrationController.data.text.slug,
    "c",
    30,
    (id) => !blacklist.includes(id.substring(5, 8))
  );
```
(The old `paddingTop`/`let paddingTop = 30` local can go.)

In `ImageBubbles` (replace `var items = gatherImages(narrationController.data.text.slug) || [];`):
```js
  const items = gatherAnchorGroups(narrationController.data.text.slug, "i", 25);
```
(The old image gatherer used `height = 25` as its spacing — preserved.)

- [ ] **Step 4: Suite + smoke** (open a verse with several commentary anchors and images: bubble counts, positions, hover previews, and click-to-popup all behave as before; a source excluded in preferences does not appear and does not shift other bubbles), then commit:

```bash
git add frontend/webapp/src/views/Page/Annotations.js && git commit -m "refactor(page): single gatherAnchorGroups replaces duplicated commentary/image gatherers"
```

## Task 17: Shared bubble helpers — `countStudyComments` + `useFadeIn`

Deduplicates the ~30 identical lines at the top of `CommentaryBubble` and `ImageBubble`. Bonus fix: `CommentaryBubble`'s fade effect ran `setTimeout` on **every render** (no dependency array); `useFadeIn` arms it once and clears on unmount. (Full merge of the two bubble components is deliberately out of scope — see Deferred.)

**Files:**
- Modify: `src/views/Page/Annotations.js`

- [ ] **Step 1: Add the helpers** (top-level in Annotations.js):

```js
// Study-mode 💬 badge inputs shared by both bubble kinds.
function countStudyComments({ counts, num, ids, type, studyModeOn }) {
  if (!studyModeOn || !counts || !num || !counts[num]?.[type] || !ids)
    return { count: 0, idsWith: [] };
  const idsWith = counts[num][type];
  return {
    count: ids.map((i) => parseInt(i)).filter((i) => idsWith.includes(i)).length,
    idsWith,
  };
}

function useFadeIn(delayMs = 500) {
  const [fadeClass, setFadeClass] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setFadeClass(" fadedIn"), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return fadeClass;
}
```

- [ ] **Step 2: Use in `CommentaryBubble`** — replace the `let counts = …; let num = …; let studycommentcount = 0; let coms_with_comments = []; if (…) { … }` block with:

```js
  const { count: studycommentcount, idsWith: coms_with_comments } =
    countStudyComments({
      counts: narrationController.pageController.pageCommentCounts,
      num: textContentController.data.slug.replace(/\D+/, ""),
      ids: item.ids,
      type: "com",
      studyModeOn:
        narrationController.appController.states.studyGroup.studyModeOn,
    });
  const fadeClass = useFadeIn();
```
Delete its `const [fadeClass, makeFadeIn] = useState("");` and the dep-less `useEffect(() => { setTimeout(() => makeFadeIn(" fadedIn"), 500); });`.

- [ ] **Step 3: Use in `ImageBubble`** — same replacement with `type: "img"`; its existing effect does double duty (fade + deep-link activation), so ONLY remove the fade parts: delete `const [fadeClass, makeFadeIn] = useState("");`, add `const fadeClass = useFadeIn();`, and inside the existing effect delete the line `if (fadeClass !== " fadedIn") setTimeout(() => makeFadeIn(" fadedIn"), 500);` and remove `fadeClass` from its dependency array.

- [ ] **Step 4: Suite + smoke** (bubbles fade in once; study-mode 💬 badges show on annotated items), then commit:

```bash
git add frontend/webapp/src/views/Page/Annotations.js && git commit -m "refactor(page): shared countStudyComments/useFadeIn for bubbles; fade timer armed once"
```

## Task 18: One digit formatter — canonical superscripts (TDD)

Two duplicated converters disagree: `numberFormat` (PersonPlace tooltips) emits *subscripts* and misses repeat digits (no `/g`); `replaceNumbers` (PeoplePlacePanel) emits *superscripts*. Canonical output: **superscripts, all occurrences** (matches the panel, the more recent code).

**Files:**
- Create: `src/views/Page/__tests__/formatNameNumbers.test.js`
- Modify: `src/views/Page/PersonPlace.js`
- Modify: `src/views/Page/Narration.js`

- [ ] **Step 1: Write the failing test**

```js
// src/views/Page/__tests__/formatNameNumbers.test.js
import { formatNameNumbers } from "../PersonPlace";

test("converts homonym digits 1-4 to superscripts, all occurrences", () => {
  expect(formatNameNumbers("Lehi1")).toBe("Lehi¹");
  expect(formatNameNumbers("Alma2 son of Alma1")).toBe("Alma² son of Alma¹");
});

test("tolerates null/undefined", () => {
  expect(formatNameNumbers(null)).toBeNull();
  expect(formatNameNumbers(undefined)).toBeNull();
});
```

- [ ] **Step 2: Run — FAIL (no export). Implement in PersonPlace.js:**

```js
const SUPERSCRIPT_DIGITS = { 1: "¹", 2: "²", 3: "³", 4: "⁴" };
// Scripture homonyms are disambiguated with trailing digits (lehi1, alma2);
// render them as superscripts everywhere. Canonicalized 2026-07-14 — the old
// tooltip formatter used subscripts and only converted the first occurrence.
export function formatNameNumbers(string) {
  if (!string) return null;
  return String(string).replace(/[1-4]/g, (d) => SUPERSCRIPT_DIGITS[d]);
}
```
Delete `function numberFormat(string) { … }` and change `NarrationToolTip`'s two call sites from `numberFormat(name)` / `numberFormat(info)` to `formatNameNumbers(name)` / `formatNameNumbers(info)`.

- [ ] **Step 3: Replace the panel's local copy** — in Narration.js `PeoplePlacePanel`, delete the `replaceNumbers` function and change its two usages:

```js
// Before
            {item.name.replace(/[1-4]/g, replaceNumbers)}
// After
            {formatNameNumbers(item.name)}
```
```js
// Before
          <div className="info">{(item.title || item.info).replace(/[1-4]/g, replaceNumbers)}</div>
// After
          <div className="info">{formatNameNumbers(item.title || item.info)}</div>
```
Import in Narration.js: extend the existing `./PersonPlace` import: `import { renderPersonPlaceHTML, formatNameNumbers } from "./PersonPlace";`

- [ ] **Step 4: Run tests — PASS. Suite + smoke** (hover a person link: tooltip name shows superscript; open the people panel: same), then commit:

```bash
git add -A && git commit -m "refactor(page): one formatNameNumbers (superscript, global) replaces two disagreeing digit converters"
```

## Task 19: Merge PersonLink/PlaceLink; hoist Section's duplicate tooltip

**Files:**
- Modify: `src/views/Page/PersonPlace.js`
- Modify: `src/views/Page/Section.js`
- Modify: `src/views/Page/Page.js`

- [ ] **Step 1: PersonPlace.js — one component, preserving the out-of-tree override**

Replace both `PersonLink` and `PlaceLink` with:

```js
const PERSON_PLACE_LINK = {
  person: { popType: "people", path: "/people/" },
  place: { popType: "places", path: "/place/" },
};

function PersonPlaceLink({ type, label, id, controller }) {
  // Out-of-tree callers (Drawer, Map InfowindowContent, PopUp person/place
  // descriptions) render this via renderPersonPlaceHTML with an appController
  // passed as the controller arg and NO PageControllerProvider above them —
  // so we resolve via the Task-17 override mechanism, not a bare context read.
  const pageController = usePageController(controller);
  const { popType, path } = PERSON_PLACE_LINK[type];
  const handleClick = (e) => {
    e.preventDefault();
    const appController = pageController?.appController || pageController;
    appController.functions.setPopUp({ type: popType, ids: [id] });
  };
  return (
    <Link
      to={path + id}
      data-tip
      data-for={id}
      onClick={handleClick}
      className={type}
    >
      <strong>{label}</strong>
    </Link>
  );
}
```
Update the two `replace` branches in `renderPersonPlaceHTML`:
```js
      if (domNode.attribs && domNode.attribs.class === "person") {
        return (
          <PersonPlaceLink
            type="person"
            controller={pageController}
            label={domNode.attribs.label}
            id={domNode.attribs.slug}
          />
        );
      }
      if (domNode.attribs && domNode.attribs.class === "place") {
        return (
          <PersonPlaceLink
            type="place"
            controller={pageController}
            label={domNode.attribs.label}
            id={domNode.attribs.slug}
          />
        );
      }
```
(The old components wrapped the Link in a pointless fragment — dropped. `className={type}` preserves the `person`/`place` classes.)

- [ ] **Step 2: Section.js — stop rendering one tooltip per section**

Delete the `<ReactTooltip … id="page-info-tooltip" />` element from the `theaterLink` fragment (keep the `<Link>` with its `data-tip`/`data-for`). Remove the now-unused `ReactTooltip` and `tooltipTheme` imports **if** nothing else in Section.js uses them (verify with grep).

- [ ] **Step 3: Page.js — render it once**

Inside the `<div className={"content page …"}>`, after the sections map, add:
```js
        <ReactTooltip
          effect="solid"
          place="left"
          backgroundColor={tooltipTheme().backgroundColor}
          textColor={tooltipTheme().textColor}
          id="page-info-tooltip"
        />
```
Imports in Page.js: `import ReactTooltip from "react-tooltip";` and `import { tooltipTheme } from "src/utils/themeColors";` (note: Task 2 removed an *unused* ReactTooltip import; this re-adds it now that it IS used).

- [ ] **Step 4: Suite + smoke** — person/place links still open popups from: a Page narration, the Drawer, a Map info window, and a person-popup description (the out-of-tree override paths). Hover the theater icon on each section: exactly one tooltip appears. Then commit:

```bash
git add -A && git commit -m "refactor(page): merge PersonLink/PlaceLink; single page-info tooltip instead of one per section"
```

## Task 20: SingleNoteItem reuses the shared scripture-link parser; drop its prop mutation

SingleNoteItem (Narration.js) hand-rolls the same `scripture_link` parser that `renderPersonPlaceHTML` already provides via its `scriptureLinkClickHandler` argument (the pattern PopUp/Drawer already use). (The third copy, `ParseMessage` in `models/Utils.js`, has genuinely different behavior — active-ref index tracking — and stays; see Deferred.)

**Files:**
- Modify: `src/views/Page/Narration.js`

- [ ] **Step 1: Rewrite `SingleNoteItem`**

```js
function SingleNoteItem({ item }) {
  const [activeScripture, setActiveScripture] = useState(null);

  const scriptureLinks = (scripture) => {
    return `<a className="scripture_link">${scripture}</a>`;
  };

  const text = item.text.replace(/<\/*p.*?>/g, "");
  return (
    <>
      <div key={item.id} className="noteItem">
        <div className="noteSource">
          <img src={`${assetUrl}/source/cover/${item.id.substr(5, 3)}`} alt="Note Source" />
        </div>
        <div className="noteText">
          <span>
            {item.title && (
              <>
                <em className="focusQuote">{item.title}</em> •{" "}
              </>
            )}
            {renderPersonPlaceHTML(
              detectReferences(text, scriptureLinks),
              null,
              (ref) => setActiveScripture(ref)
            )}
          </span>
        </div>
      </div>
      <ScripturePanelSingle scriptureData={{ ref: activeScripture }} />
    </>
  );
}
```
This removes the local `parserOptions` block and the `item.text = …` prop mutation. `renderPersonPlaceHTML`'s `scripture_link` branch produces the identical `<a className="scripture_link" onClick=…>` output; with no person/place tokens present its trailing tooltip span renders empty. `Parser`/`domToReact` may now be unused in Narration.js — verify with `grep -n "Parser\|domToReact" src/views/Page/Narration.js` and prune the import if so.

- [ ] **Step 2: Suite + smoke** (open a verse's Notes panel: note text renders, embedded scripture references are clickable and open the inline passage), then commit:

```bash
git add frontend/webapp/src/views/Page/Narration.js && git commit -m "refactor(page): SingleNoteItem reuses renderPersonPlaceHTML scripture-link parsing; no prop mutation"
```

## Task 21: Page.js/TextContent.js reducer polish + import consolidation

**Files:**
- Modify: `src/views/Page/Page.js`
- Modify: `src/views/Page/TextContent.js`
- Modify: `src/views/Page/Narration.js`

- [ ] **Step 1: Page.js — remove the duplicate applySlug block in `setActiveRow`**

The case body calls `applySlug(…)` + `autoClicked.delete(slug)` unconditionally near its top. Delete the redundant second copy at the end of the case:
```js
      if (pageController.states.init) {
        applySlug(pageController.appController, slug, { replace: auto === true });
        if (auto === true) pageController.states.autoClicked.delete(slug);
      }
```

- [ ] **Step 2: TextContent.js — one toggle case**

Replace the two identical reducer cases with one parameterized case:
```js
function reducer(textContentController, input) {
  switch (input.fn) {
    case "toggleOpenClose": {
      const field = input.header ? "isHeaderOpen" : "isOpen";
      if (textContentController.states[field])
        textContentController.pageController.functions.removeOpenRow(
          textContentController.data.slug
        );
      else
        textContentController.pageController.functions.setActiveRow({
          slug: textContentController.data.slug,
          duration: textContentController.data.duration,
          pagetitle:
            textContentController.narrationController.pageController.pageData.title,
          heading: textContentController.data.heading,
          auto:
            textContentController.pageController.states.autoClicked?.has(
              textContentController.data.slug
            ) === true,
        });
      textContentController.states[field] = !textContentController.states[field];
      break;
    }
    default:
      break;
  }
  return { ...textContentController };
}
```
And the functions:
```js
      let functions = {
        toggleOpenClose: (e) => {
          e.preventDefault();
          dispatch({ fn: "toggleOpenClose", header: false });
        },
        toggleOpenCloseHeader: (e) => {
          e.preventDefault();
          dispatch({ fn: "toggleOpenClose", header: true });
        },
      };
```
(External callers keep using `functions.toggleOpenClose` / `functions.toggleOpenCloseHeader` — no call-site changes.)

- [ ] **Step 3: Consolidate the repeated Utils imports**

Narration.js currently imports from `src/models/Utils` on three lines under two path spellings. Merge into one:
```js
import { snapSelectionToWord, chronoLabel, label, determineLanguage } from "src/models/Utils";
```
TextContent.js: merge its `src/models/Utils` and `../../models/Utils` lines into:
```js
import { snapSelectionToWord, determineLanguage, label } from "src/models/Utils";
```

- [ ] **Step 4: Full suite (baseline-only) + smoke** (open/close a verse by header and by 💬 badge; audio starts; URL updates), then commit:

```bash
git add -A && git commit -m "refactor(page): dedupe setActiveRow slug-apply, parameterize TextContent toggle, consolidate Utils imports"
```

---

## Deferred — explicitly out of scope (needs its own spec/plan)

| Item | Audit ref | Why deferred |
|---|---|---|
| Row open-state unification (openRows vs textContent isOpen/isHeaderOpen vs DOM `.reference.open`) | §4.2 | The deep-link scroll campaigns (`usePageInit`, `isRefOpen`) use the DOM class as arbiter by design; changing ownership needs a spec + the deeplink test harness run. |
| Full CommentaryBubble/ImageBubble merge | §3.5 | Remaining divergence (image cycling, deep-link activation) is real behavior, not duplication; Task 17 extracted what was actually shared. |
| ScripturePanel (Narration) vs ScripturesContainer (Utils) merge | §3.9 | Cross-layer; keyboard-nav vs plain variants; low churn. |
| `ParseMessage` scripture-link parser (third copy) | §3.7 | Different behavior (active-ref index tracking across mixed content); unification would need a redesigned shared API. |
| `document.title` ownership (6 writers) | §4.4 | Needs a small design (title stack/effect) spanning Page + panels; cosmetic risk only. |
| `setStageClass` published via render-phase mutation of the appController function table | §4.5, §5.5 | Correct fix is a context or state lift in Main; touches the app shell, belongs with the next context-migration increment. |
| Controller-pattern evolution (impure reducers, in-place mutation) | §5.1, §5.2 | Team direction settled 2026-07-13: contexts distribute the controllers, reducers stay. `setActiveRow`'s side-effect chain should be revisited if/when it causes the next replay bug. |
| LightBox DOM-click driving of simple-react-lightbox, autoAdvance anchor query | §5.4 | Hostage to the third-party lightbox API and the anchor-driven open mechanism; replacing either is feature work. |
| ImagePanel marginTop feedback loop | §5.5-adjacent | Reworking to layout-effect measurement is a visual-behavior change needing design eyes. |

## Self-review notes

- Spec coverage: every audit item in §1–§4 maps to Tasks 1–21 or a Deferred row; §5 items map to Tasks 5, 9, 10, 12, 15, 16, 20 or Deferred rows.
- Type/name consistency: `commentIndex.js` export names match Page.js's existing call sites verbatim (drop-in). `usePageComments` returns `{ commentState, readyToScroll, setReadyToScroll, needToLoadComments }` — the exact four identifiers Page.js's render tail consumes. `formatNameNumbers` is exported from PersonPlace.js and imported by Narration.js in Task 18 before use.
- Ordering constraints: Task 3 must precede Task 19 (popUpData removal is assumed by the merged component). Task 7 must precede Task 12 (`usePageComments` imports `indexPageComments` from `commentIndex`). Task 8 must precede Task 14 (same module file). Task 2 removes Page.js's unused ReactTooltip import; Task 19 re-adds it as a used import — both correct at their point in time.
