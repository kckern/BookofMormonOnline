# Controller State Migration Implementation Plan (WP-D: Page / Narration / TextContent → real state management)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mutable-controller-in-useReducer pattern in the three Page-view controllers with real state management — immutable state, pure reducers, side effects in handlers/effects, stable function tables — while keeping the controller *interface* (`{states, functions, pageData…}`) so the ~50 consumer files don't change.

**Architecture:** Immutable per-instance state on React primitives: `useReducer` with **pure reducers** (no mutation, no I/O), a `useMemo`-stable `functions` table whose closures read a **live ref** (`refs.current`) so async callers (scroll campaigns, window listeners, socket handlers) never see stale snapshots, and a **stable getter-facade** for out-of-tree consumers (`activeLeafCursorController`). Consumers keep reading `pageController.states.X` / calling `pageController.functions.y()` — the migration is an internal re-implementation behind the same interface.

**Why NOT Redux (decision record, verified 2026-07-14):** `redux`/`react-redux` are in package.json but **no store is configured anywhere** (`createStore`/`configureStore`: zero hits in src; the only `react-redux` importers are `About.js`/`Tos.js`, which cannot work without a `<Provider>` — pre-existing dead/broken code, flagged in Phase 4, out of scope). More fundamentally, **Narration and TextContent are per-row instances** (dozens per page, plus quote recursion) — a global singleton store is the wrong shape; it would need dynamic keyed slices for transient per-row UI state. The same reasoning rejects zustand-global; per-instance vanilla stores would work but add a dependency and a second idiom for no capability we don't get from `useReducer` + refs. This choice fulfills the "real state management" decision by delivering its actual guarantees: immutability, purity, replay-safety, correct effect dependencies.

**Tech Stack:** React 17 (useReducer/useMemo/useRef), CRA/react-scripts 5, Jest + @testing-library/react 11.

**Hard prerequisites (do NOT start without them):**
1. `docs/plans/2026-07-14-page-wp-a-cleanups.md` merged — Page handlers use `docTitle.js`.
2. `docs/plans/2026-07-14-openrows-single-truth.md` merged — `isRowOpen` seam exists; TextContent is stateless.

**The three diseases this cures** (audit §5.1/5.2 + follow-ups WP-D): (1) in-place mutation invisible to React — the FacsimilePanel-couldn't-re-fire bug class; (2) side effects inside reducers React may replay — two production bugs already memorialized in Page.js comments, with `setActiveRow` (audio + navigation + localStorage + 3-deep API chain) still live; (3) render-phase mutation of shared tables.

**Working conventions:** frontend root `frontend/webapp`; tests `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false`; **baseline: fully green (159+ after prior plans — record the exact count in Phase 0; gate = zero failures at every task)**; smoke `http://localhost:8200`; grep for snippets, not line numbers; one commit per task; conventional commits.

---

# PHASE 0 — Blast-radius audit (gate for everything else)

## Task 0.1: Produce the blast-radius audit document

**Files:**
- Create: `docs/audits/<today's date>-controller-state-migration-blast-radius.md`

This migration changes two invariants consumers may silently rely on: (a) controller/state object identity was stable while fields mutated — now identity changes per update; (b) writes to `states.X` from outside the reducer used to work — now they're lost writes. Enumerate every dependent site BEFORE coding.

- [ ] **Step 1: Run and record each of these, with findings per hit** (in the audit doc, one section per grep):

```bash
cd frontend/webapp/src
# (1) Direct state writes outside the three controller files — each becomes a dispatch or a local variable:
grep -rn "pageController.states\.[a-zA-Z]* =\|narrationController.states\.[a-zA-Z]* =\|textContentController\." . --include=*.js | grep -v "==\|===\|!=" | grep -v "views/Page/Page.js\|views/Page/Narration.js\|views/Page/TextContent.js"
# (2) Known in-file render mutations to kill:
grep -n "narrationController.pageController = pageController\|functions\['setStageClass'\]" views/Page/*.js
# (3) The campaign's direct Set mutation (becomes markAutoClicked):
grep -n "autoClicked.add\|autoClicked.delete\|autoClicked?.has" views/Page/*.js
# (4) Async closures over controllers (staleness candidates — verify each reads via functions/refs or has value deps):
grep -rn "pageController" views/Page/usePageComments.js views/Page/usePageInit.js
# (5) Out-of-tree consumers of the exposed cursor controller (get the facade):
grep -rln "activeLeafCursorController" . --include=*.js
# (6) Everything that reads narrationController.supplement (moves into state, alias kept):
grep -rn "\.supplement" views/Page/*.js | head -30
# (7) Dispatch-name inventory per controller (the pure reducers must cover every one):
grep -n "dispatch({" views/Page/Page.js views/Page/Narration.js
# (8) Possibly-dead narration actions (delete if callerless):
grep -rn "setTextContent\|setPreviewImageIds\|setPreviewCommentaryIds" . --include=*.js
```

- [ ] **Step 2: Write the doc** with: current baseline test count; the hit-list from each grep with a one-line disposition each (`dispatch`, `local var`, `ref-read`, `facade`, `alias`, `dead — delete`); and a STOP-list of any hit that doesn't fit those dispositions (escalate before proceeding).

- [ ] **Step 3: Commit**
```bash
git add docs/audits/ && git commit -m "docs(page): blast-radius audit for controller state migration"
```

# PHASE 1 — TextContent (verification only)

## Task 1.1: Verify TextContent is already migration-complete

WP-C1 removed TextContent's reducer and local state; its controller is a plain per-render object and its only "state" reads go through `pageController.functions`.

- [ ] **Step 1: Verify** — all must be empty:
```bash
grep -n "useReducer\|dispatch(\|states\." frontend/webapp/src/views/Page/TextContent.js | grep -v "pageController.states\|appController.states"
```
(Remaining `pageController.states`/`appController.states` READS are fine — they re-derive per render.)
- [ ] **Step 2:** Note the result in the blast-radius doc ("Phase 1: no work — verified"). No commit needed if clean; if the grep shows drift, STOP and reconcile with the C1 plan before continuing.

# PHASE 2 — Narration

## Task 2.1: Pure `narrationReducer` + immutable state (supplement included), side effects to handlers

**Files:**
- Modify: `frontend/webapp/src/views/Page/Narration.js`

- [ ] **Step 1: Check for dead actions first.** From Task 0.1 grep (8): if `setTextContent` (and the `components.textContent` field) has no dispatcher/reader outside its own definition, delete the case and field as part of this task; same test for any other case with no `dispatch` caller.

- [ ] **Step 2: Replace the reducer** (the whole current `function reducer(narrationController, input)` block) with a pure one over a plain state object:

```js
// Pure state transitions only. Side effects (setSlug URL writes, supplement
// fetch, highlight recompute) live in the handlers below — a reducer may be
// replayed by React and must be idempotent.
function narrationReducer(state, action) {
  switch (action.type) {
    case "setPanelImageIds":
      return { ...state, panelImageIds: action.ids };
    case "setActiveImageId":
      return { ...state, activeImageId: action.id };
    case "setActiveFax":
      return { ...state, showFax: true, activeFax: action.id };
    case "setShowFax":
      return { ...state, showFax: action.on };
    case "setSupplement":
      return { ...state, supplement: action.supplement };
    case "setHighlights":
      return { ...state, highlights: action.highlights };
    case "setPeoplePlaces":
      return { ...state, peoplePlaces: action.val };
    case "setScriptures":
      return { ...state, scriptures: action.val };
    case "setNotes":
      return { ...state, notes: action.val };
    case "clearAllPanels":
      return {
        ...state,
        showFax: false,
        peoplePlaces: {},
        scriptures: [],
        panelImageIds: [],
        notes: [],
      };
    default:
      return state;
  }
}

function initNarrationStates(faxData) {
  return {
    showFax: false,
    faxList: faxData?.map((i) => i.slug),
    faxData,
    activeFax: "1830",
    panelImageIds: [],
    activeImageId: 0,
    highlights: [],
    notes: [],
    peoplePlaces: {},
    scriptures: [],
    supplement: {},
  };
}
```

- [ ] **Step 3: Extract the once-per-row derived data into a memo** (this replaces the init-IIFE's extraction section — the `data.text` guard, `extractTagIds` calls, `personIds`/`placeIds`, `loadNumsFromText`, and `renderPersonPlaceHTML(description)`):

```js
function buildNarrationData(rowData, pageController) {
  const narration = rowData.narration || {};
  const text = narration.text || {};
  const quoteContents = (text.quotes || []).map((q) => q.content);
  const personIds = (narration.description?.match(/\|([^\]}]+?)}/g) || []).map(
    (i) => i.replace(/[|}]/g, "")
  );
  const placeIds = (narration.description?.match(/\|([^\]}]+?)\]/g) || []).map(
    (i) => i.replace(/[|\]]/g, "")
  );
  const data = {
    ...narration,
    text,
    imageIds: extractTagIds("i", text.content, ...quoteContents),
    commentaryIds: extractTagIds("c", text.content, ...quoteContents),
    personIds,
    placeIds,
  };
  return {
    data,
    nums: loadNumsFromText(text),
    description: renderPersonPlaceHTML(narration.description, pageController),
  };
}
```
`loadNumsFromText` becomes a module-level function (move it out of the component unchanged — it's already pure). NOTE this stops mutating `rowData.narration` (the old code wrote `imageIds`/`text` back onto the API object); grep-verify nothing reads `rowData.narration.imageIds` from OUTSIDE the controller (Task 0.1 grep 6 covers `.supplement`; add `grep -rn "narration.imageIds\|narration.commentaryIds" src --include=*.js` — expected: only via `narrationController.data`).

- [ ] **Step 4: Assemble the controller with a live ref and stable functions.** Replace the whole `useReducer(reducer, (() => {…})())` block with:

```js
  const faxDataRaw = pageController.appController.preLoad.fax;
  const faxData = typeof faxDataRaw === "object" ? Object.values(faxDataRaw) : faxDataRaw;
  const [states, dispatch] = useReducer(narrationReducer, faxData, initNarrationStates);

  // Live window for async/stable closures: campaigns, timers, and the
  // memoized functions below must see CURRENT values, not render snapshots.
  const refs = useRef({});
  refs.current = { states, pageController, appController: pageController.appController };

  const derived = useMemo(
    () => buildNarrationData(rowData, pageController),
    // description embeds pageController for popups; identity churn is fine —
    // rowData is the real key, and recomputing renderPersonPlaceHTML per
    // pageController change is what the old per-render mutation did anyway.
    [rowData, pageController]
  );

  const functions = useMemo(() => {
    const setSlug = (slug) => refs.current.appController.functions.setSlug(slug);
    const setHighlightsFor = (activeId, previewIds, commentHighlights) => {
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
      const supplement = refs.current.states.supplement;
      pushMatches(supplement.image);
      pushMatches(supplement.commentary);
      if (commentHighlights)
        for (const h of commentHighlights)
          highlights.push({ class: "commented", string: h });
      dispatch({ type: "setHighlights", highlights });
    };
    return {
      setPanelImageIds: (ids) => dispatch({ type: "setPanelImageIds", ids }),
      setActiveImageId: (id) => {
        dispatch({ type: "setActiveImageId", id });
        setSlug(id ? "art/" + id : refs.current.pageController.states.activeRow);
        setHighlightsFor(id, []);
      },
      setPreviewImageIds: (ids) =>
        setHighlightsFor(refs.current.states.activeImageId, ids),
      setPreviewCommentaryIds: (ids) => setHighlightsFor(null, ids),
      setCommentHighlights: (items) => setHighlightsFor(null, [], items),
      setActiveFax: (id) => {
        dispatch({ type: "setActiveFax", id });
        setSlug(derivedDataSlug() + "/fax/" + id);
      },
      toggleFax: () => {
        const next = !refs.current.states.showFax;
        dispatch({ type: "setShowFax", on: next });
        if (next) {
          setSlug(derivedDataSlug() + "/fax/" + refs.current.states.activeFax);
        } else {
          setSlug(derivedDataSlug());
          dispatch({ type: "setActiveImageId", id: 0 });
        }
      },
      setPeoplePlaces: (slugs) => dispatch({ type: "setPeoplePlaces", val: slugs }),
      setScriptures: (verse_ids) => dispatch({ type: "setScriptures", val: verse_ids }),
      setNotes: (notes) => dispatch({ type: "setNotes", val: notes }),
      clearAllPanels: () => dispatch({ type: "clearAllPanels" }),
      preloadFax: () => {
        const { faxList } = refs.current.states;
        if (faxList === undefined) return false;
        const m = derivedDataSlug().match(/([a-z-]+)\/(\d+)$/);
        if (!m) return false;
        faxList.forEach((version) => {
          new Image().src = `${assetUrl}/fax/text/${version}/${m[1]}-${m[2]}`;
          new Image().src = `${assetUrl}/fax/tabs/${version}`;
        });
      },
      preLoadSupplement: () => {
        const { states } = refs.current;
        if (Object.keys(states.supplement).length > 0) return false;
        if (
          derivedRef.current.data.commentaryIds.length === 0 &&
          derivedRef.current.data.imageIds.length === 0
        )
          return false;
        BoMOnlineAPI({
          commentary: derivedRef.current.data.commentaryIds,
          image: derivedRef.current.data.imageIds,
        }).then((supplement) => dispatch({ type: "setSupplement", supplement }));
      },
      getSupplement: () => ({ ...refs.current.states.supplement }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // derived is re-memoized per rowData; expose it to the stable closures.
  const derivedRef = useRef(derived);
  derivedRef.current = derived;
  function derivedDataSlug() {
    return derivedRef.current.data.text.slug;
  }

  const narrationController = {
    data: derived.data,
    nums: derived.nums,
    states,
    supplement: states.supplement, // compat alias — consumers read controller.supplement.image
    components: { description: derived.description },
    functions,
    pageController,
    appController: pageController.appController,
  };
```
NOTE: `derivedDataSlug` is a hoisted function declaration used by the memo's closures — declare it (and `derivedRef`) ABOVE the `useMemo` in the final code (order shown here for readability; the executor arranges declarations so nothing is used before definition: `refs` → `derived` → `derivedRef` → `derivedDataSlug` → `functions`). Delete the old `preLoadFax`/`preLoadSupplement`/`setHighlights`/`getSupplement` closures from the component body (they're inside the memo now), the old init IIFE, and the render-mutation line `narrationController.pageController = pageController;`.

Signature compat: `preLoadSupplement` was called as `functions.preLoadSupplement(narrationController)` at some sites (TextContent hover, ImagePanel/LightBox fallbacks) — the argument is now ignored; keep accepting-and-ignoring it (no call-site edits needed).

- [ ] **Step 5: Sweep in-file consumers** — mechanical renames only where the old code touched removed things:
- Any `narrationController.states.faxData?.map` etc. still works (states shape identical).
- `LightBox`/`ImagePanel` reads of `narrationController.supplement` — alias preserved.
- The `handleSelection`/`handleLocationChange`/progress-class logic in `Narration` — unchanged (reads props/pageController per render).
Run `grep -n "dispatch({ fn:" frontend/webapp/src/views/Page/Narration.js` → nothing (old action shape gone); `grep -n "narrationController.supplement =" ` → nothing.

- [ ] **Step 6: Full suite green + smoke:** open a verse; click art bubble (panel opens, URL → /art/id, highlight applies); cycle images; open fax (URL → /fax/1830, tabs switch); people/scriptures/notes panels open+close; clearAllPanels behavior when switching panel types; deep-link `/lehites/3/fax/1830` still auto-opens (FacsimilePanel effect now re-fires on genuinely-changing state identities).

- [ ] **Step 7: Commit**
```bash
git add frontend/webapp/src/views/Page/Narration.js
git commit -m "refactor(page): Narration controller on pure reducer + immutable state; side effects in stable handlers"
```

# PHASE 3 — Page

## Task 3.1: `commentIndex` becomes non-mutating (TDD extension)

**Files:**
- Modify: `frontend/webapp/src/views/Page/commentIndex.js`
- Modify: `frontend/webapp/src/views/Page/__tests__/commentIndex.test.js`

The pure Page reducer must not mutate the previous state's index. Make the module copy-on-write.

- [ ] **Step 1: Add failing tests** (append):
```js
test("add/update/delete do not mutate the input index (copy-on-write)", () => {
  const before = indexPageComments([msg({ text: 3 })]);
  const beforeTextBucket = before.text;
  const added = addToPageCommentIndex(before, msg({ text: 4 }, "m2"));
  expect(before.text[4]).toBeUndefined();       // input untouched
  expect(added).not.toBe(before);               // new top-level object
  expect(added.text).not.toBe(beforeTextBucket); // touched bucket copied
  const deleted = deleteToPageComments(added, msg({ text: 3 }));
  expect(added.text[3]).toBeDefined();          // input untouched
  expect(deleted.text[3]).toBeUndefined();
});
```
- [ ] **Step 2: Run — the new test FAILS** (current setItem mutates in place).
- [ ] **Step 3: Implement** — replace `setItem` and `deleteToPageComments` internals:
```js
function setItem(comments, item) {
  const entries = linkEntries(item);
  if (!entries) return comments;
  const next = { ...(comments || {}) };
  for (const [type, id] of entries) {
    if (!type) continue;
    next[type] = { ...(next[type] || {}), [id]: item };
  }
  return next;
}
```
```js
export function deleteToPageComments(comments, item) {
  const entries = linkEntries(item);
  if (!entries || !comments) return comments;
  let next = comments;
  for (const [type, id] of entries) {
    if (next[type] && id in next[type]) {
      if (next === comments) next = { ...comments };
      const bucket = { ...next[type] };
      delete bucket[id];
      next[type] = bucket;
    }
  }
  return next;
}
```
(`indexPageComments` builds a fresh object already — with the new setItem it now copies per message; that's fine at page-comment scale. `addToPageCommentIndex`/`updateToPageComment` keep their `setItem(comments || {}, item)` bodies.)
- [ ] **Step 4: All commentIndex tests pass (old + new). Full suite green. Commit:**
```bash
git add frontend/webapp/src/views/Page/commentIndex.js frontend/webapp/src/views/Page/__tests__/commentIndex.test.js
git commit -m "refactor(page): commentIndex copy-on-write — pure-reducer safe"
```

## Task 3.2: Side effects out of the Page reducer (shippable de-risk step — keeps the mutable reducer)

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js`
- Modify: `frontend/webapp/src/views/Page/usePageInit.js`
- Modify: `frontend/webapp/src/views/Page/__tests__/usePageInit.test.js`
- Modify: `frontend/webapp/src/views/Page/TextContent.js`

This step alone removes the replay hazard (the old "WP-D Option 1"); Task 3.3 then swaps the container safely.

- [ ] **Step 1: Audio to a ref.** In the `Page` component add `const activeAudioRef = useRef(null);`. Delete `activeAudio: null,` from states-init; the unmount effect becomes `activeAudioRef.current?.pause()`; the audio-preferences effect pauses/plays `activeAudioRef.current`. Remove every `pageController.states.activeAudio` read/write (grep to enumerate; they live in `setActiveRow`, `removeOpenRow`, `getPageDataFromAPI`, and the two effects).

- [ ] **Step 2: `setActiveRow` becomes a handler + a pure dispatch.** In the `functions` object, replace the thin dispatcher with the full handler (this is the old reducer-case body minus state writes — moved verbatim, with `activeAudioRef` and docTitle):
```js
        setActiveRow: (val) => {
          const { slug, duration, pagetitle, heading, auto } = val;
          activeAudioRef.current?.pause();
          const audio = new Audio(loadAudioUrl(slug));
          audio.addEventListener("ended", () => pageController.functions.autoAdvance());
          activeAudioRef.current = audio;
          if (pageController.appController.states.preferences.audio) playSound(audio);
          pushDocTitle("row", heading + " | " + label("home_title"));
          applySlug(pageController.appController, slug, { replace: auto === true });
          localStorage.setItem("studybookmark", slug);
          dispatch({ fn: "setActiveRow", val: { slug, auto } });
          BoMOnlineAPI(
            { log: { token: pageController.appController.states.user.token, key: "block", val: slug } },
            { useCache: false },
          ).then(() => {
            const link_index = parseInt(slug.match(/\d+$/).shift());
            const progress = { ...(pageController.states.progress || {}) };
            progress.started_items = [...(progress.started_items || [])];
            if (!progress.completed_items?.includes(link_index))
              progress.started_items.push(link_index);
            pageController.functions.setPageProgress(progress);
            setTimeout(() => {
              BoMOnlineAPI(
                { pageprogress: { token: pageController.appController.states.user.token, slug: [pageController.pageData.slug] } },
                { useCache: false },
              ).then((response) => {
                pageController.functions.setPageProgress(response.pageprogress);
                const token = pageController.appController.states.user.token;
                BoMOnlineAPI({ userprogress: token }, { useCache: false }).then((r) => {
                  const saveMe = r.userprogress?.[token];
                  const summary = saveMe?.summary;
                  if (saveMe)
                    pageController.appController.functions.updateUserSummary({
                      ...saveMe, ...{ slug, pagetitle, heading },
                    });
                  window.clicky?.goal("read");
                  if (summary?.completed >= 100)
                    pageController.appController.functions.setPopUp({
                      type: "victory", popupData: summary, vhtop: 10,
                    });
                });
              });
            }, parseInt(duration) * 900);
          });
        },
```
and the reducer case shrinks to pure state:
```js
    case "setActiveRow":
      pageController.states.activeRow = input.val.slug;
      if (!pageController.states.openRows.includes(input.val.slug))
        pageController.states.openRows.push(input.val.slug);
      if (input.val.auto === true)
        pageController.states.autoClicked.delete(input.val.slug);
      break;
```
Delete the now-orphaned pieces of the old case (the audio lines, title, applySlug, localStorage, the whole API chain). `loadAudioUrl` stays module-level.

- [ ] **Step 3: Same treatment for the other three side-effecting cases.**
`removeOpenRow` handler:
```js
        removeOpenRow: (val) => {
          popDocTitle("row");
          applySlug(
            pageController.appController,
            pageController.states.activeSection || pageController.states.pageSlug,
          );
          if (val === pageController.states.activeRow) activeAudioRef.current?.pause();
          dispatch({ fn: "removeOpenRow", val });
        },
```
case: only the `openRows = openRows.filter(...)` line survives.
`setActiveSection` handler:
```js
        setActiveSection: (val) => {
          setBaseDocTitle(val.title || pageController.pageData.title || label("home_title"));
          applySlug(pageController.appController, val.slug, { replace: true });
          dispatch({ fn: "setActiveSection", val });
        },
```
case: only `pageController.states.activeSection = input.val.slug;`.
`setPageData` handler:
```js
        setPageData: (val) => {
          setBaseDocTitle(val?.title || label("home_title"));
          dispatch({ fn: "setPageData", val });
        },
```
case: only `pageController.pageData = input.val;`.
Keep the load-bearing `applySlug` header comment with the handlers. After this step: `grep -n "applySlug\|docTitle\|new Audio\|localStorage\|BoMOnlineAPI" frontend/webapp/src/views/Page/Page.js` shows NONE of these inside `function reducer(` (verify by reading the reducer body top-to-bottom — it must be state-writes-only).

- [ ] **Step 4: The campaign's direct Set mutation becomes a dispatch.** Add to `functions`:
```js
        markAutoClicked: (slug) => dispatch({ fn: "markAutoClicked", val: slug }),
        isAutoClicked: (slug) => pageController.states.autoClicked.has(slug),
```
reducer case: `case "markAutoClicked": pageController.states.autoClicked.add(input.val); break;`
In `usePageInit.js` `buildInitSteps`, the step.call currently does `autoClicked.add(slug)` (destructured from states) — change to `pageController.functions.markAutoClicked(slug);` and remove `autoClicked` from the destructure. Update the test fixture: give the fixture controller `functions.markAutoClicked = (slug) => states.autoClicked.add(slug)` alongside the existing `isRowOpen`, and keep the existing assertion `expect(autoClicked.has("lehites/3")).toBe(true)` working through it.
In `TextContent.js`, the toggle's `auto:` line becomes `auto: pageController.functions.isAutoClicked(content.slug) === true,`.

- [ ] **Step 5: Full suite green + smoke** (verse open/close with audio + progress badge updates + deep link + autoAdvance). **Commit:**
```bash
git add -A
git commit -m "refactor(page): Page reducer is state-only — audio/nav/title/API side effects moved to handlers (replay-safe)"
```

## Task 3.3: Pure immutable `pageReducer`; pageData/pageComments/counts into state; stable functions over a live ref

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js`

- [ ] **Step 1: Write the pure reducer** (module-level, replacing `function reducer(pageController, input)` — after 3.2 every case is state-only, so this is a mechanical immutability rewrite; action shape `{fn, val}` is kept so the dispatch call sites don't change):
```js
function pageReducer(state, input) {
  switch (input.fn) {
    case "setActiveRow": {
      const { slug, auto } = input.val;
      const openRows = state.openRows.includes(slug)
        ? state.openRows
        : [...state.openRows, slug];
      let autoClicked = state.autoClicked;
      if (auto === true && autoClicked.has(slug)) {
        autoClicked = new Set(autoClicked);
        autoClicked.delete(slug);
      }
      return { ...state, activeRow: slug, openRows, autoClicked };
    }
    case "removeOpenRow":
      return { ...state, openRows: state.openRows.filter((x) => x !== input.val) };
    case "setActiveSection":
      return { ...state, activeSection: input.val.slug };
    case "markAutoClicked": {
      if (state.autoClicked.has(input.val)) return state;
      const autoClicked = new Set(state.autoClicked);
      autoClicked.add(input.val);
      return { ...state, autoClicked };
    }
    case "resetAutoClicked":
      return { ...state, autoClicked: new Set() };
    case "setPageComments":
      return {
        ...state,
        pageComments: input.val.index,
        pageCommentCounts: input.val.counts,
        commentGroupId: input.val.groupId,
      };
    case "addToPageComments":
      return { ...state, pageComments: addToPageCommentIndex(state.pageComments, input.val) };
    case "updateToPageComment":
      return { ...state, pageComments: updateToPageComment(state.pageComments, input.val) };
    case "deleteToPageComments":
      return { ...state, pageComments: deleteToPageComments(state.pageComments, input.val) };
    case "moveStudyBuddies": {
      const { username, location } = input?.val || {};
      if (!username) return state;
      if (state.studyBuddies[username] === location) return state;
      const studyBuddies = { ...state.studyBuddies };
      if (location) studyBuddies[username] = location;
      else delete studyBuddies[username];
      return { ...state, studyBuddies };
    }
    case "setPageSlugId": {
      const next = { ...state, initOpen: { ...state.initOpen } };
      if (input.val.pageSlug) {
        next.pageSlug = input.val.pageSlug;
        next.initOpen.pageSlug = input.val.pageSlug;
      }
      if (input.val.textId) {
        next.textId = input.val.textId;
        next.initOpen.textId = input.val.textId;
      }
      if (input.val.lastLeaf) next.initOpen.lastLeaf = input.val.lastLeaf;
      return next;
    }
    case "setInitOpen":
      return { ...state, initOpen: input.val };
    case "setPageData":
      return { ...state, pageData: input.val };
    case "setPageProgress":
      return { ...state, progress: input.val };
    case "setNotFound":
      return { ...state, notFound: input.val, loading: false };
    case "setInitWarning":
      return { ...state, initWarning: input.val };
    case "setLoading":
      return { ...state, loading: input.val };
    case "markAsInitiated":
      return { ...state, init: input.val || true };
    default:
      return state;
  }
}
```
Preserved-quirk note: the old `moveStudyBuddies` had an `isMobile()` guard — that's environment-dependent I/O; move it into the handler (`moveStudyBuddies: (val) => { if (isMobile()) return; dispatch(...); }`). Also note `markAsInitiated`'s `input.val || true` reproduces today's quirk (passing `false` yields `true`) — the routeKey-reset effect relies on the SEPARATE `dispatch({fn:"markAsInitiated", val:false})`… which today also yields `true`?! Verify current behavior with `git log -S "markAsInitiated"` and preserve it exactly: the reducer line is copied byte-for-byte from today's case, so behavior is identical either way.

- [ ] **Step 2: Rebuild the controller assembly.** Replace the `useReducer(reducer, (() => {…})())` block with:
```js
  const initialPageState = {
    loading: null,
    init: false,
    activeSection: null,
    activeRow: null,
    commentGroupId: null,
    pageSlug: initOpen.pageSlug,
    textId: null,
    initOpen,
    openRows: [],
    studyBuddies: {},
    progress: {},
    autoClicked: new Set(),
    notFound: null,
    initWarning: null,
    pageData: null,
    pageComments: null,
    pageCommentCounts: null,
  };
  const [states, dispatch] = useReducer(pageReducer, initialPageState);
  const activeAudioRef = useRef(null);

  // Live window: stable function closures and async campaign callbacks read
  // CURRENT state through this ref, never a render snapshot.
  const refs = useRef({});
  refs.current = { states, appController };
```
Then the `functions` object moves into a `useMemo(() => ({ … }), [])` where every closure that previously read `pageController.states.X` / `pageController.pageData` / `pageController.appController` reads `refs.current.states.X` / `refs.current.states.pageData` / `refs.current.appController` instead. Enumerate: `autoAdvance` (`refs.current.appController.states.preferences.autoplay`, `refs.current.states.activeRow`), `setActiveRow` handler (all its reads — preferences.audio, user.token, `refs.current.states.progress`, `refs.current.states.pageData.slug`), `removeOpenRow`, `setActiveSection` (+ `refs.current.states.pageData?.title`), `setPageData`, `isRowOpen: (slug) => refs.current.states.openRows.includes(slug)`, `isAutoClicked: (slug) => refs.current.states.autoClicked.has(slug)`, `moveStudyBuddies`, and every thin dispatcher (unchanged bodies — dispatch is stable). Self-reference note: the audio `ended` listener inside `setActiveRow` calls `autoAdvance` — inside the memo, build the table as a named local and reference the sibling through it:
```js
  const functions = useMemo(() => {
    const fns = {
      autoAdvance: () => { /* body */ },
      setActiveRow: (val) => {
        // …
        audio.addEventListener("ended", () => fns.autoAdvance());
        // …
      },
      // …the rest
    };
    return fns;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
``` ALSO add `setStageClass` INTO this memoized table (from the `useState` setter, which is stable):
```js
      setStageClass,
```
and DELETE the render-phase line `pageController.appController.functions['setStageClass'] = setStageClass;`. Update `useStageTransition.js`:
```js
// Before
    const { setStageClass } = pageController.appController?.functions || {};
// After
    const { setStageClass } = pageController?.functions || {};
```
(This is follow-ups item WP-C2, absorbed here — the consumer hook already exists and reads pageController from context.)

Controller per render (plain object — identity changes each render, contexts distribute it):
```js
  const pageController = {
    states,
    pageData: states.pageData,
    pageComments: states.pageComments,
    pageCommentCounts: states.pageCommentCounts,
    functions,
    appController,
  };
```
`getPageDataFromAPI`/`getPageDataFromAPIViaNote` keep working via `pageController.functions.*` (they call setters, never write state directly — verify with `grep -n "pageController.states\.[a-z]* =" frontend/webapp/src/views/Page/Page.js` → only the deleted reducer remnants, which must be gone).

- [ ] **Step 3: Scroll-spy stops writing state.** The spy's first-callback pre-seed currently mutates `pageController.states.activeSection = slug;` — a lost-write under immutability. It exists only to make "future callbacks fire on change"; use a local:
```js
    let lastSeenSection = pageController.states.activeSection;
    const spy = createScrollSpy({
      getSections: () => document.getElementsByClassName("pagesection"),
      onActive: (el) => {
        const slug = el.id;
        const title = el.attributes?.titletext?.nodeValue || null;
        if (!seenFirst) {
          seenFirst = true;
          lastSeenSection = slug;
          return;
        }
        if (slug && slug !== lastSeenSection) {
          lastSeenSection = slug;
          pageController.functions.setActiveSection({ slug, title });
        }
      },
    });
```

- [ ] **Step 4: Full suite green.** Then run the FULL deep-link smoke matrix from the C1 plan (Task 3 Step 6 there) plus: study-mode comment load, live comment badge on incoming message (window event → dispatch → repaint), study-buddy circle movement.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "refactor(page): Page controller on pure immutable reducer; stable ref-backed functions; setStageClass published via functions (no render mutation)"
```

## Task 3.4: Stable cursor facade for out-of-tree consumers

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js`

`setActiveLeafCursorController` exposes the page's comment cursor to Sidebar/PopUp/Commentary/Study (Task 0.1 grep 5). Pre-migration those read a stable-identity controller whose fields mutated (always fresh). Post-migration the per-render controller is a snapshot — a stale-reads regression for anything holding the reference between exposures. Fix: expose a STABLE object with getters over the live ref.

- [ ] **Step 1: Build the facade once** (below the `refs` setup):
```js
  // Out-of-tree consumers (Sidebar/PopUp/Commentary/Study via
  // activeLeafCursorController and the usePageController override) hold this
  // reference across renders; getters keep their reads live now that state
  // snapshots are immutable.
  const cursorFacadeRef = useRef(null);
  if (!cursorFacadeRef.current) {
    cursorFacadeRef.current = {
      get states() { return refs.current.states; },
      get pageData() { return refs.current.states.pageData; },
      get pageComments() { return refs.current.states.pageComments; },
      get pageCommentCounts() { return refs.current.states.pageCommentCounts; },
      get appController() { return refs.current.appController; },
    };
  }
  cursorFacadeRef.current.functions = functions;
```
- [ ] **Step 2: Expose the facade** in the existing effect:
```js
// Before
    pageController.appController.functions.setActiveLeafCursorController(
      pageController,
    );
// After
    appController.functions.setActiveLeafCursorController(cursorFacadeRef.current);
```
(Keep the effect's deps — re-running is now a cheap no-op re-assignment, but the deps also keep the exposure timed after comments land, matching today.)
- [ ] **Step 3: Verify consumer compatibility by reading each hit from Task 0.1 grep (5)**: every access must be `.pageComments` / `.pageCommentCounts` / `.states.X` / `.functions.y(...)` / `.appController` — all covered by the facade. Any consumer doing something else → STOP, extend the facade deliberately.
- [ ] **Step 4: Suite green + smoke:** open a person/commentary popup while in study mode → its Comments thread reads the page cursor (badge counts match); post a comment from the popup → appears on the page row. **Commit:**
```bash
git add frontend/webapp/src/views/Page/Page.js
git commit -m "refactor(page): stable getter-facade for activeLeafCursorController — live reads over immutable state"
```

## Task 3.5: Async-closure sweep (usePageComments / usePageInit) + stale-comment cleanup

**Files:**
- Modify: `frontend/webapp/src/views/Page/usePageComments.js`
- Modify: `frontend/webapp/src/views/Page/Page.js`

- [ ] **Step 1: usePageComments comment + closure audit.** The listener effect's comment says "pageController's inner objects are mutated in place … closures observe current state" — NO LONGER TRUE. Verify each closure is safe under snapshots and fix the comment:
- `addMessageToPage`/`updateMessageToPage`: call `pageController.functions.*` — functions are the STABLE memoized table (same object every render) → safe.
- `processStudyGroupEvent`: reads `pageController.states.pageSlug` (effect re-registers on that dep → snapshot matches) and `pageController.appController.states.…` (appController not migrated, still live) → safe.
- The fetch effect reads `pageController.pageComments` at run time — snapshot from the triggering render; the gates (`newPageLoad`/`switchToOtherGroup`) key on values in its dep array → safe.
Replace the stale comment with:
```js
  // Live-update listeners, one registration per (page, group), cleaned up on
  // unmount/change. Closures here call the STABLE functions table and read
  // only values present in this effect's dependency array — safe under
  // immutable state snapshots (the old in-place-mutation guarantee is gone).
```
- [ ] **Step 2: Delete the retired hazard comments in Page.js** — the reducer-replay warnings that documented the old disease: the `applySlug` header block ("The reducer is replayed by React …" — rewrite it to describe the handler placement), and the `setPageComments` NOTE about side effects in reducers (the reducer is pure now; the note is history). Keep `docs/audits/` as the historical record.
- [ ] **Step 3: Suite green. Commit:**
```bash
git add frontend/webapp/src/views/Page/usePageComments.js frontend/webapp/src/views/Page/Page.js
git commit -m "docs(page): retire replay-hazard comments; document snapshot-safety of async closures"
```

# PHASE 4 — Verification + records

## Task 4.1: Full verification pass

- [ ] **Step 1:** Full suite green (record final count). **Step 2:** Full smoke: the C1 deep-link matrix; audio autoplay chain incl. progress + victory popup path (mock by completing a short page if feasible, else verify the handler chain fires via network tab); study-mode (comment load, live add/update, badges, buddies, typing); fax deep link; art deep link; popup comment cursor. **Step 3:** Confirm zero direct state writes remain: re-run Task 0.1 greps (1)-(3) — all clean.

## Task 4.2: Update CLAUDE.md + flag the dead Redux imports

**Files:**
- Modify: `CLAUDE.md` (repo root)
- Create: `docs/bugs/<today>-about-tos-dead-react-redux.md`

- [ ] **Step 1:** CLAUDE.md frontend line says "React 17 with Redux state management" — stale. Change to: `React 17; state via per-view controllers (immutable useReducer + context — see docs/plans/2026-07-15-controller-state-migration.md); redux packages present but unused`.
- [ ] **Step 2:** Write the bug note: `About.js`/`Tos.js` import `useSelector/useDispatch` with NO store/Provider configured anywhere — they throw if rendered; recommend removing the imports or the views (needs owner decision; out of this plan's scope).
- [ ] **Step 3: Commit:**
```bash
git add CLAUDE.md docs/bugs/
git commit -m "docs: CLAUDE.md state-management line corrected; flag dead react-redux imports in About/Tos"
```

---

## Self-review notes
- Phase order is mandatory: 0 → 1 → 2 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 4. Task 3.2 is a safe stopping point (ships the replay fix alone).
- Name consistency: the action shape stays `{fn, val}` for Page (dispatch call sites untouched) but Narration adopts `{type, …}` — Narration's dispatchers are all rewritten in Task 2.1 so no mixed callers exist. `isRowOpen`/`isAutoClicked`/`markAutoClicked` signatures match their C1/3.2 introductions.
- The two follow-up items absorbed here by design: WP-C2 (`setStageClass`, Task 3.3) and the WP-D-Option-1 de-risk (Task 3.2).
- Known accepted change: controller object identity now changes per render. All in-tree consumers read via context per render (safe); the two cross-render holders (campaign closures, cursor consumers) are covered by ref-backed functions and the facade respectively — that's exactly what Tasks 3.3/3.4 exist for.
