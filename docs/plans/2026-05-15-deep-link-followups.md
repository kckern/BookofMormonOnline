# Deep-link follow-ups — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the four follow-ups flagged by the final code review of the deep-link init fixes (merged as `2ce6078`): refresh the reference docs that describe the old timer pipeline, add user-visible signals for the partial R6/R7 cases the original fixes deferred, scaffold an E2E fixture harness so the env-gated Playwright tests are actually runnable, and extract the init pipeline out of `Page.js` to reduce that file's bulk.

**Architecture:**
- **Phase 1 (Docs):** Update `docs/reference/{commentary,image,page-text}-route.md` to reflect the new async-sequential pipeline, the scrollend signal, `autoClicked` Set, `routeKey`/`pageIdentityKey`, and `PageNotFound` UI.
- **Phase 2 (UX):** Add an `initWarning` controller-state alert when `findTextToOpen` reports an unresolvable textId. Split `scrollTo`'s skip event into "no-op" vs "failed" with a console warning for the failure case.
- **Phase 3 (E2E harness):** Move the spec files' env-var fixture IDs into a committed `e2e/fixtures.json` with `REPLACE_ME` sentinels and a gitignored `e2e/local-fixtures.json` override; document the fixture seed and run commands in `e2e/README.md`. Add `npm run e2e:all` and `npm run e2e:unconditional` scripts. No GitHub Actions workflow — that depends on infrastructure choices and is left as an ops follow-up.
- **Phase 4 (Refactor):** Extract `initPage`, `initPageItem`, `initPageImage`, `initPageCommentary`, `initPageFax`, `findTextToOpen`, and `scrollToAsync` from `Page.js:572-690` into a new `frontend/webapp/src/views/Page/initPipeline.js` module. Page.js shrinks ~150 lines. Scope is intentionally narrow — bigger restructuring is left for later.

**Tech stack:** React 17 / reactstrap / Jest / Playwright — same as the prior plan.

**Source of truth:**
- Previous plan: `docs/plans/2026-05-15-deep-link-init-fixes.md`
- Audit: `docs/audits/2026-05-15-deep-link-init-race-conditions.md`
- Reference docs (currently stale, see Phase 1): `docs/reference/commentary-route.md`, `image-route.md`, `page-text-route.md`

**File structure:**

| File | Touch | Responsibility |
| --- | --- | --- |
| `docs/reference/commentary-route.md` | Modify | Refresh timing math + flow + file map |
| `docs/reference/image-route.md` | Modify | Refresh activation flow + file map |
| `docs/reference/page-text-route.md` | Modify | Refresh init flow + file map |
| `frontend/webapp/src/views/Page/Page.js` | Modify | Add `initWarning` state + reducer + render branch |
| `frontend/webapp/src/views/Page/InitWarning.js` | Create | Dismissible Alert component |
| `frontend/webapp/src/models/Utils.js` | Modify | `scrollTo` emits `:noop` vs `:failed` with console.warn |
| `frontend/webapp/src/utils/__tests__/scrollTo.test.js` | Modify | Update event-name assertions |
| `e2e/fixtures.json` | Create | Sentinel fixture IDs |
| `e2e/local-fixtures.json` | Create | (gitignored — example file checked in as `local-fixtures.example.json`) |
| `e2e/fixtures.js` | Modify | Load IDs from `local-fixtures.json` if present, else `fixtures.json` |
| `e2e/*.spec.js` | Modify | Read IDs via the new fixture loader instead of `process.env` |
| `e2e/README.md` | Create | Fixture seeding + run commands |
| `.gitignore` (root) | Modify | Add `e2e/local-fixtures.json` and `test-results/` |
| `package.json` (root) | Modify | Add `e2e:all` and `e2e:unconditional` scripts |
| `frontend/webapp/src/views/Page/initPipeline.js` | Create | Extracted init functions |
| `frontend/webapp/src/views/Page/Page.js` | Modify | Delete moved functions; import from initPipeline.js |

---

## Pre-flight

- [ ] **Step P1: Confirm starting commit**

Run: `git rev-parse HEAD`
Expected output: `2ce6078...` (the merge of the prior plan).

If the branch has moved past `2ce6078`, the line numbers in this plan may need adjusting; read the relevant function signatures to relocate.

- [ ] **Step P2: Confirm dev server running for manual smoke checks**

Run: `systemctl --user status bom-dev --no-pager | head -3`
Expected: `Active: active (running)`. If not, `systemctl --user restart bom-dev` and wait for `Compiled successfully` in the logs.

- [ ] **Step P3: Create a feature branch**

Run: `git checkout -b feature/deep-link-followups`
Expected: `Switched to a new branch 'feature/deep-link-followups'`.

---

## Phase 1 — Reference doc refresh

The three `docs/reference/*-route.md` files were written before the deep-link init fixes landed. They still cite line numbers from the old timer-based pipeline (e.g. `Page.js:567-597` for the old `initPageItem` body) and describe behavior (fixed 1000 ms timers, DOM `autoclicked` attribute, `setTimeout`-staggered clicks) that no longer exists. Update each to reflect the merged state.

This phase has no automated tests — each task is a documentation rewrite verified by spot-reading.

### Task 1: Refresh `commentary-route.md`

**Files:**
- Modify: `docs/reference/commentary-route.md`

- [ ] **Step 1.1: Read the current code path you're documenting**

Read these locations to ground your update in the actual post-merge code:
- `frontend/webapp/src/views/Page/Page.js:31-44` (`prepareInitOpen`)
- `frontend/webapp/src/views/Page/Page.js:60-69` (data-fetch `useEffect`)
- `frontend/webapp/src/views/Page/Page.js:195-211` (route-reset `useEffect`)
- `frontend/webapp/src/views/Page/Page.js:325-360` (`getPageDataFromAPIViaNote` with not-found + try/catch)
- `frontend/webapp/src/views/Page/Page.js:594-639` (`initPageItem` async sequential)
- `frontend/webapp/src/views/Page/Page.js:652-658` (`initPageCommentary` with callback)
- `frontend/webapp/src/views/Page/Page.js:664-690` (`findTextToOpen`)
- `frontend/webapp/src/models/Utils.js:387-425` (new `scrollTo`)
- `frontend/webapp/src/utils/{orderByDomAncestry,awaitDomOpen,deepLinkInstrument}.js`

- [ ] **Step 1.2: Rewrite the "Full flow" section**

In `docs/reference/commentary-route.md`, find the "Full flow" section that describes steps 1-10. Update the prose to:

- Step 4 ("Wait for ready to scroll"): mention the 2.5s `COMMENTS_FALLBACK_MS` fallback timer that breaks the chat-service wait.
- Step 5 (dispatch to `initPageCommentary`): unchanged — still passes a popup callback.
- Step 6 (the choreography): replace the entire "1 s wait + 1 s scroll + 1 s per-item stagger" description with:
  - `await scrollToAsync(itemToScrollTo.offsetTop - 20vh)` where `scrollToAsync` wraps `scrollTo` (which fires on the `scrollend` event with a 2 s fallback for browsers without it).
  - DOM-ancestry-ordered loop via `orderByDomAncestry(rawTextToOpen)`.
  - For each slug: skip if missing or already in `pageController.states.autoClicked`; otherwise add to the Set, scroll to the row's `.reference a` coords, `el.click()`, then `await awaitDomOpen(slug, 2000)` which resolves when the `[textid='<slug>'] .reference` element gains class `open` (via `MutationObserver`).
  - After the loop, `markAsInitiated()` and then the route-supplied callback fire.

- Step 7 (popup opens): unchanged — `setPopUp({type:"commentary", ids:[id]})`. Note `setSlug` is now called with no `replace` flag from `setPopUp`, so the popup's URL push remains.

- Step 8/9/10 (PopUp render and lazy fetch): unchanged.

- [ ] **Step 1.3: Rewrite the "Timing model" / latency section if present**

Find any paragraph that computes total latency (the old `4 + N seconds` math). Replace with:

> Total deterministic latency from page-ready to popup is now dominated by actual scroll completion plus a single MutationObserver wait per row. On a fast desktop with a 1000 px scroll distance, a non-nested commentary deep-link completes in roughly 400-800 ms (one outer scroll, one row open). A nested commentary deep-link (parent + leaf) takes roughly 800-1400 ms (two scrolls, two row opens). Per-step `setTimeout(..., 1000)` stagger is gone.

If the doc didn't already have a timing section, do not add one — keep the doc focused on the flow.

- [ ] **Step 1.4: Refresh the "What changes in the URL bar" section**

Update for the new auto-click `history.replace` behavior:

| Moment | URL |
| --- | --- |
| User hits `/commentary/<id>` | `/commentary/<id>` |
| Page data loads, init begins | unchanged |
| Auto-click of `.reference a` fires `setActiveRow({...auto: true})` → `setSlug(slug, {replace: true})` | URL replaces in place (no history push) |
| Each subsequent auto-click of a nested row | URL keeps replacing — only the last replaced entry remains |
| `setPopUp` fires `setSlug("commentary/<id>")` (no replace) | URL pushes back to `/commentary/<id>` — net 2 history entries after init: `[<row>, /commentary/<id>]` |
| Back button once | Lands on `<row>` (single back-stop) |
| Back button twice | Escapes to the page that preceded the `/commentary/<id>` navigation |

- [ ] **Step 1.5: Update the file map at the bottom**

The "File map" table at the bottom of the doc has stale line ranges. Replace with the current ones (use the line ranges from Step 1.1 above). Add the new files: `frontend/webapp/src/utils/deepLinkInstrument.js`, `frontend/webapp/src/utils/orderByDomAncestry.js`, `frontend/webapp/src/utils/awaitDomOpen.js`, `frontend/webapp/src/views/Page/PageNotFound.js`.

- [ ] **Step 1.6: Add a brief "Edge case: not found" subsection**

If not already present, add a short subsection near the bottom (before File map):

> **Edge case: commentary ID not in the DB.** If `BoMOnlineAPI({commentary: id})` returns empty data (sandbox mode, invalid id, permissions) or rejects with a network error, `getPageDataFromAPIViaNote` catches the error and dispatches `setNotFound({type: "commentary", id})`. The render branch at `Page.js:514-516` short-circuits to `<PageNotFound />` (in `frontend/webapp/src/views/Page/PageNotFound.js`) instead of looping in a Loader. The route-change effect at `Page.js:200-209` clears `notFound` on navigation, so the user can recover by clicking another link.

- [ ] **Step 1.7: Spot-check line numbers**

For each `file:line` reference in the doc, run `sed -n '<line>p' <file>` and confirm the content matches what the doc claims. Fix any drift.

- [ ] **Step 1.8: Commit**

```bash
git add docs/reference/commentary-route.md
git commit -m "docs(commentary-route): refresh for async-sequential pipeline + scrollend + not-found UI"
```

### Task 2: Refresh `image-route.md`

**Files:**
- Modify: `docs/reference/image-route.md`

- [ ] **Step 2.1: Read the current code path**

Read:
- `frontend/webapp/src/views/Page/Page.js:325-340` (image branch in `getPageDataFromAPIViaNote`)
- `frontend/webapp/src/views/Page/Page.js:645-650` (`initPageImage` with `imageId` snapshot)
- `frontend/webapp/src/views/Page/Annotations.js:279-301` (`ImageBubble` effect reading `imageActivationRequest`)
- `frontend/webapp/src/models/appController.js:164` (state init) and `appController.js:323-326` (reducer case)

- [ ] **Step 2.2: Rewrite the "Step 7: Image activation" section**

Replace the description of the old side-effect race with:

> 1. `initPageImage` (`Page.js:645-650`) captures `imageId = pageController.states.initOpen.imageId` AT SCHEDULING TIME (before any await), then calls `initPageItem(pageController, callback)`. The closure-local `imageId` shields the callback from any `setInitOpen` that fires mid-flight if the user re-navigates.
> 2. When `initPageItem` resolves (rows fully open, MutationObserver awaits done), the callback fires `appController.functions.requestImageActivation({imageId})`. This sets `appController.states.imageActivationRequest = {imageId}`.
> 3. The `ImageBubble` effect (`Annotations.js:279-301`) — which mounts only after its containing row is open — reads `appController.states.imageActivationRequest`. If `req?.imageId` matches one of the bubble's `item.ids` AND no image is yet active, the bubble claims it: `setActiveImageId(imageId)`, `setPanelImageIds(item.ids)`, `history.push("/art/<imageId>")`, `setAutoCyle(false)`, and finally `requestImageActivation(null)` to clear the request and prevent re-claims.
> 4. The `loading` guard from the old implementation is gone — the request is only set AFTER `initPageItem` callback, by which time the row is guaranteed open.

- [ ] **Step 2.3: Update the "Edge case: imageId not in DB" section**

Add or update the parallel not-found behavior:

> **Edge case: image ID not in the DB.** Same as commentary — `getPageDataFromAPIViaNote` catches missing/null `image.location.slug` and rejection from `BoMOnlineAPI`, dispatches `setNotFound({type: "image", id})`. Render bails to `<PageNotFound />`.

- [ ] **Step 2.4: Update the "Edge case: imageActivationRequest leaks" section**

Add a new subsection:

> **Edge case: image deep-link to a page that doesn't contain a matching `ImageBubble`.** Rare — would happen if the image's `location.slug` resolved to a page where the `[i]` anchor was stripped or the bubble didn't render. In that case, no bubble claims the request. The route-change reset effect at `Page.js:205` calls `requestImageActivation(null)` on the next navigation, so the stale request doesn't leak across pages.

- [ ] **Step 2.5: Refresh the file map**

Same approach as Task 1.5. Add `appController.js` to the file map for the new `imageActivationRequest` state.

- [ ] **Step 2.6: Spot-check line numbers**

Same as Task 1.7.

- [ ] **Step 2.7: Commit**

```bash
git add docs/reference/image-route.md
git commit -m "docs(image-route): refresh for explicit-callback activation + imageActivationRequest"
```

### Task 3: Refresh `page-text-route.md`

**Files:**
- Modify: `docs/reference/page-text-route.md`

- [ ] **Step 3.1: Read the current code path**

Read:
- `frontend/webapp/src/views/Page/Page.js:62-69` (data fetch keyed on `pageIdentityKey`)
- `frontend/webapp/src/views/Page/Page.js:195-211` (route reset keyed on `routeKey`)
- `frontend/webapp/src/views/Page/Page.js:594-639` (`initPageItem`)
- `frontend/webapp/src/views/Page/Page.js:741-841` (`setActiveRow` reducer with `auto` flag + `autoClicked.delete`)

- [ ] **Step 3.2: Rewrite the "Step 4: Dispatch to `initPageItem`" section**

Replace the description of the old loop with the same async-sequential flow described in Task 1.2 step 6.

- [ ] **Step 3.3: Add a "Two route keys" subsection**

Insert a new short subsection explaining the dep-array split:

> **Why two route keys?**
>
> `Page.js` now computes two composite strings:
>
> - `pageIdentityKey = pageSlug|commentaryId|imageId` — drives the data-fetch effect (`Page.js:62-69`). Re-fires only when the underlying page changes; an in-page row click that updates only `textId` does NOT trigger a refetch or Loader flicker.
> - `routeKey = pageSlug|textId|commentaryId|imageId|faxVersion` — drives the reset/init effect (`Page.js:195-211`). Re-fires on any route-param change, so navigating from `/<page>/<textA>` to `/<page>/<textB>` correctly re-runs `initPageItem` and clears `autoClicked` / `notFound` / `imageActivationRequest` between transitions.
>
> The split is what allows R4 (re-init on commentary→commentary navigation) without regressing in-page row clicks into a Loader flicker.

- [ ] **Step 3.4: Update the "What does NOT happen" section**

The old doc said `initPageItem` is called with no callback for this route. Still true. Update the description of the auto-click path to mention:

- The `autoClicked` Set tracks slugs added by `initPageItem`. When `setActiveRow` reducer fires for those slugs, it reads `auto: pageController.states.autoClicked.has(slug)` (set by `TextContent.js` toggle), passes `{replace: auto}` to `setSlug`, and then `pageController.states.autoClicked.delete(slug)` so any subsequent manual re-click of the same row pushes normally instead of replacing.

- [ ] **Step 3.5: Refresh the file map**

Include new files: `frontend/webapp/src/utils/{orderByDomAncestry,awaitDomOpen,deepLinkInstrument}.js`.

- [ ] **Step 3.6: Spot-check line numbers**

Same as Task 1.7.

- [ ] **Step 3.7: Commit**

```bash
git add docs/reference/page-text-route.md
git commit -m "docs(page-text-route): refresh for routeKey/pageIdentityKey split + autoClicked + async pipeline"
```

---

## Phase 2 — R6 + R7 user-visible signals

The audit identified two silent-failure cases:

- **R6:** `findTextToOpen` returns `itemToScrollTo: null` when `initOpen.textId` is set but the corresponding `[textid='<slug>']` element isn't in the rendered DOM (stale link, schema drift, etc.). Today `initPageItem` early-returns at `Page.js:599-604` with no user signal.
- **R7:** `scrollTo` early-returns at `Utils.js:397-401` for any of three different reasons (non-number, NaN/Infinity, negative) without distinguishing "no scroll needed" (zero distance, top of page) from "scroll target couldn't be computed" (null/NaN). Both fire the callback identically.

Phase 2 makes both observable to the user (R6) and to developers (R7) without changing the happy-path behavior.

### Task 4: R6 — inline alert for unresolvable textId

**Files:**
- Create: `frontend/webapp/src/views/Page/InitWarning.js`
- Modify: `frontend/webapp/src/views/Page/Page.js`

- [ ] **Step 4.1: Create `InitWarning.js`**

Create `frontend/webapp/src/views/Page/InitWarning.js`:

```js
import React from "react";
import { Alert } from "reactstrap";
import { label } from "src/models/Utils";

export default function InitWarning({ warning, onDismiss }) {
  if (!warning) return null;
  const labelKey =
    warning.type === "verseNotFound" ? "init_warning_verse_not_found" : "init_warning_generic";
  const fallback =
    warning.type === "verseNotFound"
      ? "Couldn't find the specific verse for this link. Showing the page instead."
      : "Couldn't complete this navigation.";
  return (
    <Alert color="warning" className="pageInfo" toggle={onDismiss}>
      {label(labelKey) || fallback}
      {warning.slug ? <> <code>{warning.slug}</code></> : null}
    </Alert>
  );
}
```

- [ ] **Step 4.2: Add `initWarning` state and reducer**

Modify `frontend/webapp/src/views/Page/Page.js`.

In the useReducer initial `states` object (near `notFound: null` at ~line 95), add:

```js
initWarning: null,  // { type: "verseNotFound", slug?: string } when set
```

In the `functions` object (near `setNotFound` at ~line 157), add:

```js
setInitWarning: (val) => {
  dispatch({ fn: "setInitWarning", val: val });
},
```

In the reducer's big switch (near `case "setNotFound":` at ~line 931), add:

```js
case "setInitWarning":
  pageController.states.initWarning = input.val;
  break;
```

- [ ] **Step 4.3: Reset `initWarning` on route change**

Find the route-reset effect (around `Page.js:195-211`). Add a reset call alongside the existing `setNotFound(null)`:

Before (existing):
```js
pageController.functions.setNotFound(null);
pageController.appController.functions.requestImageActivation(null);
```

After:
```js
pageController.functions.setNotFound(null);
pageController.functions.setInitWarning(null);
pageController.appController.functions.requestImageActivation(null);
```

- [ ] **Step 4.4: Dispatch from `initPageItem` when the target row isn't found**

Modify `initPageItem` in `Page.js` (around line 594-604). The early-return block currently looks like:

```js
if (!itemToScrollTo || rawTextToOpen.length === 0) {
  recordDeepLinkEvent("initPageItem:noTarget", { rawTextToOpen });
  pageController.functions.markAsInitiated();
  if (callback) callback();
  return;
}
```

Replace with:

```js
if (!itemToScrollTo || rawTextToOpen.length === 0) {
  recordDeepLinkEvent("initPageItem:noTarget", { rawTextToOpen });
  // Only warn when the user asked for a specific verse but we couldn't find its row.
  // Bare /<pageSlug> routes have no textId set — those are not failures.
  if (pageController.states.initOpen.textId) {
    const slug = `${pageController.states.pageSlug}/${pageController.states.initOpen.textId}`;
    pageController.functions.setInitWarning({ type: "verseNotFound", slug });
  }
  pageController.functions.markAsInitiated();
  if (callback) callback();
  return;
}
```

- [ ] **Step 4.5: Render `<InitWarning />` in the page**

Find the render section of the `Page` component (around lines 510-540). The current structure has the notFound branch, then the loading branch, then the actual content. Add `<InitWarning />` as a non-blocking alert ABOVE the page content (i.e. inside the main content branch, not as a render bail-out).

Find this block (the main content render — should be around `Page.js:518-545`):

```jsx
return (
  <>
    {!readyToScroll && needToLoadComments ? (
      <LoadingPageCommentsNotice
        commentState={commentState}
        setReadyToScroll={setReadyToScroll}
      />
    ) : null}
    <div
      className={
        "content page " +
        (readyToScroll || !needToLoadComments ? "ready " : "notready ") +
        (stageClass ? stageClass : "")
      }
      onMouseDown={() => pageController.functions.setTouched(true)}
    >
```

Insert the `<InitWarning />` between `LoadingPageCommentsNotice` and the `<div>`:

```jsx
return (
  <>
    {!readyToScroll && needToLoadComments ? (
      <LoadingPageCommentsNotice
        commentState={commentState}
        setReadyToScroll={setReadyToScroll}
      />
    ) : null}
    <InitWarning
      warning={pageController.states.initWarning}
      onDismiss={() => pageController.functions.setInitWarning(null)}
    />
    <div
      className={
        "content page " +
        (readyToScroll || !needToLoadComments ? "ready " : "notready ") +
        (stageClass ? stageClass : "")
      }
      onMouseDown={() => pageController.functions.setTouched(true)}
    >
```

Add the import at the top of `Page.js` (near the existing `import PageNotFound from "./PageNotFound";`):

```js
import InitWarning from "./InitWarning";
```

- [ ] **Step 4.6: Manual smoke check**

Open `http://localhost:8200/lehites/9999999` in a browser (a textId on a real page slug that doesn't exist). Expected:

- Page renders normally.
- A yellow dismissible Alert appears at the top: "Couldn't find the specific verse for this link. Showing the page instead. `lehites/9999999`".
- Click the Alert's `×` — it disappears.
- Click any real row — the Alert stays gone (it doesn't reappear).
- Navigate to `/lehites` (no textId) — Alert does not appear (this is intentional; bare page slugs are not failures).

If the Alert appears for bare `/lehites`, recheck Step 4.4's `if (pageController.states.initOpen.textId)` guard.

- [ ] **Step 4.7: Run regression suite**

Run: `cd frontend/webapp && CI=true npm test -- --testPathPattern="(scrollTo|orderByDomAncestry|awaitDomOpen|deepLinkInstrument)"`
Expected: 21/21 pass (no regression — this change doesn't touch tested code paths).

Run: `npm run e2e -- e2e/deeplink-notfound.spec.js`
Expected: 2/2 pass.

- [ ] **Step 4.8: Commit**

```bash
git add frontend/webapp/src/views/Page/InitWarning.js \
        frontend/webapp/src/views/Page/Page.js
git commit -m "feat(deeplink): show inline warning for unresolvable textId (R6)"
```

### Task 5: R7 — split scrollTo skip into "noop" vs "failed"

**Files:**
- Modify: `frontend/webapp/src/models/Utils.js`
- Modify: `frontend/webapp/src/utils/__tests__/scrollTo.test.js`

- [ ] **Step 5.1: Write the failing tests**

Modify `frontend/webapp/src/utils/__tests__/scrollTo.test.js`. Find the two existing tests that exercise the skip path (the "null" and "negative" tests). Update them to assert on the new event names and console behavior.

Add these tests inside the existing `describe("scrollTo (refactored)", ...)` block:

```js
test("emits scrollTo:failed and console.warn when distance is non-number", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const cb = jest.fn();
  // Force the instrument flag on so we can read window.__deepLinkEvents
  window.__deepLinkInstrument = true;
  window.__deepLinkEvents = [];
  scrollTo("not a number", cb);
  expect(cb).toHaveBeenCalledTimes(1);
  const names = window.__deepLinkEvents.map(e => e.name);
  expect(names).toContain("scrollTo:failed");
  expect(names).not.toContain("scrollTo:noop");
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

test("emits scrollTo:failed for NaN distance", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const cb = jest.fn();
  window.__deepLinkInstrument = true;
  window.__deepLinkEvents = [];
  scrollTo(NaN, cb);
  expect(cb).toHaveBeenCalledTimes(1);
  const names = window.__deepLinkEvents.map(e => e.name);
  expect(names).toContain("scrollTo:failed");
  warn.mockRestore();
});

test("emits scrollTo:noop (no warn) when distance is zero", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const cb = jest.fn();
  window.__deepLinkInstrument = true;
  window.__deepLinkEvents = [];
  scrollTo(0, cb);
  expect(cb).toHaveBeenCalledTimes(1);
  expect(window.scrollTo).not.toHaveBeenCalled();
  const names = window.__deepLinkEvents.map(e => e.name);
  expect(names).toContain("scrollTo:noop");
  expect(names).not.toContain("scrollTo:failed");
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("emits scrollTo:failed (with warn) when distance is negative", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const cb = jest.fn();
  window.__deepLinkInstrument = true;
  window.__deepLinkEvents = [];
  scrollTo(-10, cb);
  expect(cb).toHaveBeenCalledTimes(1);
  const names = window.__deepLinkEvents.map(e => e.name);
  expect(names).toContain("scrollTo:failed");
  warn.mockRestore();
});
```

ALSO update the two existing skip-related tests. Find:

```js
test("skips and fires callback immediately when distance is null", () => {
  const cb = jest.fn();
  scrollTo(null, cb);
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(cb).toHaveBeenCalledTimes(1);
});

test("skips and fires callback immediately when distance is negative", () => {
  const cb = jest.fn();
  scrollTo(-10, cb);
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(cb).toHaveBeenCalledTimes(1);
});
```

These are kept (they're testing the callback-fires behavior, not the event names) but suppress console.warn for the negative case so the test output is clean. Replace the second one with:

```js
test("skips and fires callback immediately when distance is negative", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const cb = jest.fn();
  scrollTo(-10, cb);
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(cb).toHaveBeenCalledTimes(1);
  warn.mockRestore();
});
```

Leave the null one as is (null → non-number → failed → warns; but the test only checks callback fires and window.scrollTo not called, which are still true — though it'll emit a warn). Add `console.warn` suppression to the null one too:

```js
test("skips and fires callback immediately when distance is null", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const cb = jest.fn();
  scrollTo(null, cb);
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(cb).toHaveBeenCalledTimes(1);
  warn.mockRestore();
});
```

- [ ] **Step 5.2: Run tests to confirm failure**

Run: `cd frontend/webapp && CI=true npm test -- --testPathPattern=scrollTo`
Expected: existing 9 tests still pass, new 4 tests FAIL with assertions about missing event names (`scrollTo:failed`, `scrollTo:noop`).

- [ ] **Step 5.3: Update `scrollTo` implementation**

Modify `frontend/webapp/src/models/Utils.js`. Replace lines 397-401 (the current skip branch):

```js
if (typeof scrollHeight !== "number" || !Number.isFinite(scrollHeight) || scrollHeight < 0) {
  recordDeepLinkEvent("scrollTo:skip", { scrollHeight });
  fire();
  return;
}
```

With:

```js
if (scrollHeight === 0) {
  recordDeepLinkEvent("scrollTo:noop", { scrollHeight });
  fire();
  return;
}
if (typeof scrollHeight !== "number" || !Number.isFinite(scrollHeight) || scrollHeight < 0) {
  console.warn("scrollTo: invalid distance, skipping scroll", { scrollHeight });
  recordDeepLinkEvent("scrollTo:failed", { scrollHeight });
  fire();
  return;
}
```

The behavior change:
- `scrollHeight === 0` → quiet no-op (was previously caught by `!scrollHeight` and treated as skip).
- Non-number / NaN / Infinity / negative → `scrollTo:failed` event + `console.warn`.
- The `scrollTo:skip` event name is fully retired; no test or caller depended on it (search confirms only the test file referenced it).

- [ ] **Step 5.4: Run tests to confirm pass**

Run: `cd frontend/webapp && CI=true npm test -- --testPathPattern=scrollTo`
Expected: 13/13 pass (9 original + 4 new).

- [ ] **Step 5.5: Audit instrument-event callers**

Run: `grep -rn "scrollTo:skip" /home/bom/BookofMormonOnline/e2e /home/bom/BookofMormonOnline/frontend/webapp/src`

Expected: 0 results (the event was only ever read by Playwright specs through the generic `getEvents()` helper, not by name).

If any callers exist, update them to read `scrollTo:noop` or `scrollTo:failed` as appropriate.

- [ ] **Step 5.6: Run all e2e specs to confirm no regression**

Run: `npm run e2e`
Expected: 2 passed + 10 skipped, clean.

- [ ] **Step 5.7: Commit**

```bash
git add frontend/webapp/src/models/Utils.js \
        frontend/webapp/src/utils/__tests__/scrollTo.test.js
git commit -m "fix(scrollTo): split skip into noop vs failed + console.warn on failure (R7)"
```

---

## Phase 3 — E2E fixture harness

The env-gated Playwright specs (`E2E_COMMENTARY_ID`, `E2E_NESTED_COMMENTARY_ID`, `E2E_IMAGE_ID`, `E2E_COMMENTARY_ID_B`) are functional but the IDs live in the developer's head. Move them into a committed file with `REPLACE_ME` sentinels + a gitignored local override so any developer can populate once and run the full suite repeatedly.

This phase does NOT add GitHub Actions. The choice of CI system is left to ops; this just makes the suite runnable in any CI.

### Task 6: Add fixture file and update specs

**Files:**
- Create: `e2e/fixtures.json`
- Create: `e2e/local-fixtures.example.json`
- Modify: `.gitignore` (root)
- Modify: `e2e/fixtures.js`
- Modify: `e2e/deeplink-commentary.spec.js`, `e2e/deeplink-image.spec.js`, `e2e/deeplink-renavigation.spec.js`, `e2e/scrollto-callback.spec.js`, `e2e/smoke.spec.js`

- [ ] **Step 6.1: Create `e2e/fixtures.json`**

Create `e2e/fixtures.json`:

```json
{
  "commentaryId": "REPLACE_ME",
  "nestedCommentaryId": "REPLACE_ME",
  "secondCommentaryId": "REPLACE_ME",
  "imageId": "REPLACE_ME"
}
```

The keys map to the env vars used in the current specs (`E2E_COMMENTARY_ID`, `E2E_NESTED_COMMENTARY_ID`, `E2E_COMMENTARY_ID_B`, `E2E_IMAGE_ID`).

- [ ] **Step 6.2: Create `e2e/local-fixtures.example.json`**

Create `e2e/local-fixtures.example.json`:

```json
{
  "commentaryId": "12345",
  "nestedCommentaryId": "12346",
  "secondCommentaryId": "12347",
  "imageId": "678"
}
```

The example exists so developers know the format; the actual `local-fixtures.json` (with real IDs) is gitignored.

- [ ] **Step 6.3: Add `.gitignore` entries**

Modify the root `.gitignore`. Add these lines (at the bottom if they aren't already present):

```
e2e/local-fixtures.json
test-results/
playwright-report/
```

- [ ] **Step 6.4: Add a fixture loader to `e2e/fixtures.js`**

Modify `e2e/fixtures.js`. Read the current file first to confirm structure. Add a fixture-loading helper:

```js
const fs = require("fs");
const path = require("path");
const { test: base, expect } = require("@playwright/test");

const localPath = path.resolve(__dirname, "local-fixtures.json");
const defaultPath = path.resolve(__dirname, "fixtures.json");
const fixtureSource = fs.existsSync(localPath) ? localPath : defaultPath;
const fixtures = JSON.parse(fs.readFileSync(fixtureSource, "utf8"));

function getFixture(key) {
  const envName = "E2E_" + key.replace(/([A-Z])/g, "_$1").toUpperCase();
  return process.env[envName] || fixtures[key] || "REPLACE_ME";
}

const test = base.extend({
  instrumentedPage: async ({ page }, use) => {
    await page.addInitScript(() => { window.__deepLinkInstrument = true; });
    await use(page);
  },
});

async function getEvents(page) {
  return page.evaluate(() => window.__deepLinkEvents || []);
}

async function waitForEvent(page, name, timeout = 15_000) {
  return page.waitForFunction(
    (n) => (window.__deepLinkEvents || []).some(e => e.name === n),
    name,
    { timeout },
  );
}

module.exports = { test, expect, getEvents, waitForEvent, getFixture };
```

`getFixture("commentaryId")` checks `E2E_COMMENTARY_ID` env first (back-compat with existing CI/dev habits), then `local-fixtures.json` if present, then `fixtures.json` (which has `REPLACE_ME` sentinels).

- [ ] **Step 6.5: Update each spec to use `getFixture`**

For each of the 5 spec files (`e2e/deeplink-commentary.spec.js`, `e2e/deeplink-image.spec.js`, `e2e/deeplink-renavigation.spec.js`, `e2e/scrollto-callback.spec.js`, `e2e/smoke.spec.js`), replace the `process.env.X || "REPLACE_ME"` lines with calls to `getFixture(...)`.

Example for `e2e/deeplink-commentary.spec.js`. The current top of the file has:

```js
const COMMENTARY_ID = process.env.E2E_COMMENTARY_ID || "REPLACE_ME";
const NESTED_COMMENTARY_ID = process.env.E2E_NESTED_COMMENTARY_ID || COMMENTARY_ID;
```

Replace with:

```js
const { test, expect, getEvents, waitForEvent, getFixture } = require("./fixtures");

const COMMENTARY_ID = getFixture("commentaryId");
const NESTED_COMMENTARY_ID = getFixture("nestedCommentaryId") !== "REPLACE_ME"
  ? getFixture("nestedCommentaryId")
  : COMMENTARY_ID;
```

(Note: the require line may already include `test`, `expect`, etc. — just add `getFixture` to the destructuring; don't duplicate the require.)

For `e2e/deeplink-renavigation.spec.js`:

```js
const A = getFixture("commentaryId");
const B = getFixture("secondCommentaryId");
```

For `e2e/deeplink-image.spec.js`:

```js
const IMAGE_ID = getFixture("imageId");
```

For `e2e/scrollto-callback.spec.js`:

```js
const COMMENTARY_ID = getFixture("commentaryId");
```

For `e2e/smoke.spec.js`:

```js
const COMMENTARY_ID = getFixture("commentaryId");
```

The `test.skip(VALUE === "REPLACE_ME", ...)` calls in each spec continue to work — `getFixture` returns `"REPLACE_ME"` when nothing's configured.

- [ ] **Step 6.6: Add npm scripts**

Modify the root `package.json`. Find the `"scripts"` section. The existing `e2e` script is:

```json
"e2e": "playwright test --config=e2e/playwright.config.js"
```

Add two more:

```json
"e2e:all": "playwright test --config=e2e/playwright.config.js",
"e2e:unconditional": "playwright test --config=e2e/playwright.config.js e2e/deeplink-notfound.spec.js"
```

Keep the original `e2e` as an alias for `e2e:all`.

- [ ] **Step 6.7: Run tests to confirm the fixture loader works**

Run: `npm run e2e:unconditional`
Expected: 2 passed, 0 skipped.

Run: `npm run e2e:all`
Expected: 2 passed, 10 skipped (without populating `local-fixtures.json`).

Optionally: create a local `e2e/local-fixtures.json` with real IDs and confirm `npm run e2e:all` now runs more tests.

- [ ] **Step 6.8: Commit**

```bash
git add e2e/fixtures.json \
        e2e/local-fixtures.example.json \
        e2e/fixtures.js \
        e2e/deeplink-commentary.spec.js \
        e2e/deeplink-image.spec.js \
        e2e/deeplink-renavigation.spec.js \
        e2e/scrollto-callback.spec.js \
        e2e/smoke.spec.js \
        .gitignore \
        package.json
git commit -m "test(e2e): load fixture IDs from fixtures.json + add e2e:all / e2e:unconditional scripts"
```

### Task 7: Add `e2e/README.md` runbook

**Files:**
- Create: `e2e/README.md`

- [ ] **Step 7.1: Create `e2e/README.md`**

Create `e2e/README.md`:

```markdown
# E2E tests

End-to-end tests for the deep-link init pipeline. Powered by Playwright (Chromium).

## Quick start

```bash
# Unconditional tests only (no fixture IDs required)
npm run e2e:unconditional

# All tests (requires fixture IDs — see "Populating fixtures" below)
npm run e2e:all
```

## File layout

```
e2e/
├── README.md                          this file
├── playwright.config.js               Playwright config (baseURL, timeouts, etc.)
├── fixtures.js                        Shared test fixtures + getFixture() loader
├── fixtures.json                      Committed seed file with REPLACE_ME sentinels
├── local-fixtures.example.json        Template for the local override
├── local-fixtures.json                YOUR LOCAL OVERRIDE — gitignored
├── deeplink-notfound.spec.js          Unconditional — runs without fixture IDs
├── deeplink-commentary.spec.js        Requires commentaryId, nestedCommentaryId
├── deeplink-image.spec.js             Requires imageId
├── deeplink-renavigation.spec.js      Requires commentaryId, secondCommentaryId
├── scrollto-callback.spec.js          Requires commentaryId
└── smoke.spec.js                      Requires commentaryId
```

## Populating fixtures

The env-gated specs need real backend IDs to run against. The easiest way to populate them:

1. Start the dev frontend (`systemctl --user status bom-dev` to confirm running).
2. Open `http://localhost:8200` in a browser.
3. Browse to any scripture page and click a commentary bubble in the margin. Note the URL the popup pushes (e.g., `/commentary/12345`) — that's your `commentaryId`.
4. Repeat to find a commentary inside a nested quotation block — that's your `nestedCommentaryId`. (If you can't find one, leave `nestedCommentaryId` equal to `commentaryId`; the "nested ordering" test will then skip.)
5. Find a second, distinct commentary ID — that's `secondCommentaryId`.
6. Click an art panel — the URL becomes `/art/<imageId>`. That's `imageId`.
7. Copy `local-fixtures.example.json` to `local-fixtures.json` and fill in the four IDs.

```bash
cp e2e/local-fixtures.example.json e2e/local-fixtures.json
# Edit e2e/local-fixtures.json with the IDs from steps 3-6.
```

`local-fixtures.json` is gitignored — your IDs stay local.

## Env-var override

Each fixture key also has an environment-variable equivalent (back-compat with existing dev habits):

| Fixture key | Env var |
| --- | --- |
| `commentaryId` | `E2E_COMMENTARY_ID` |
| `nestedCommentaryId` | `E2E_NESTED_COMMENTARY_ID` |
| `secondCommentaryId` | `E2E_COMMENTARY_ID_B` (back-compat — note suffix difference) |
| `imageId` | `E2E_IMAGE_ID` |

Resolution order is env > local-fixtures.json > fixtures.json. Env vars override file values, useful for one-off CI runs without committing to a fixture choice.

> Note on `secondCommentaryId` / `E2E_COMMENTARY_ID_B`: the env-var name predates the JSON fixture file. They mean the same thing — a distinct commentary ID for re-navigation tests.

## Running in CI

This repo does NOT currently have a GitHub Actions workflow. When you add one:

- For PRs against any branch, run `npm run e2e:unconditional`. This works without secrets — it hits hardcoded invalid IDs (`/commentary/999999999`, `/image/999999999`) and asserts the not-found UI renders.
- For the dev branch, add the four fixture keys as repo secrets and run `npm run e2e:all`. The workflow needs to also start a dev frontend (or hit a staging URL via `E2E_BASE_URL`).

## Observability

The specs assert on the `window.__deepLinkEvents` instrumentation channel rather than timing. Tests use `waitForEvent(page, "initPageItem:callback")` etc. to await pipeline checkpoints. See `frontend/webapp/src/utils/deepLinkInstrument.js` for the recorder.

## Updating fixtures when they go stale

Commentary and image IDs are stable identifiers in the BoM DB — they don't change. If a test starts failing because an ID was removed (e.g., a publication was withdrawn), pick a new one and update `local-fixtures.json` (and update `local-fixtures.example.json` if you want the team's default to change).
```

- [ ] **Step 7.2: Commit**

```bash
git add e2e/README.md
git commit -m "docs(e2e): runbook for fixture seeding + npm scripts"
```

---

## Phase 4 — Extract init pipeline from `Page.js`

`Page.js` is 1069 lines. The init pipeline (`initPage`, `initPageItem`, `initPageImage`, `initPageCommentary`, `initPageFax`, `findTextToOpen`, `scrollToAsync`) accounts for ~120 of those and is the most self-contained module-level chunk. Extract it. This is a pure refactor — no behavior changes.

Larger restructuring (`loadPageComments`, `setActiveRow`, the reducer) is **out of scope** for this plan. Those have tighter coupling to component state and warrant their own focused passes.

### Task 8: Create `initPipeline.js`

**Files:**
- Create: `frontend/webapp/src/views/Page/initPipeline.js`

- [ ] **Step 8.1: Create the new module**

Create `frontend/webapp/src/views/Page/initPipeline.js`. Paste the exact bodies of the 7 functions currently in `Page.js:572-690`:

```js
import {
  scrollTo,
  getCoords,
  findAncestor,
  label,
} from "src/models/Utils";
import { recordDeepLinkEvent } from "src/utils/deepLinkInstrument";
import { orderByDomAncestry } from "src/utils/orderByDomAncestry";
import { awaitDomOpen } from "src/utils/awaitDomOpen";

export function initPage(pageController, lastLeaf) {
  if (lastLeaf !== pageController.states.initOpen.pageSlug) {
    let itemToScrollTo = document.getElementById(
      pageController.states.initOpen.pageSlug + "/" + lastLeaf,
    );
    setTimeout(() => {
      itemToScrollTo.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
      setTimeout(pageController.functions.markAsInitiated, 1000);
    }, 1000);
  } else {
    pageController.functions.markAsInitiated();
    pageController.appController.functions.setSlug(
      pageController.states.initOpen.pageSlug,
    );
  }
}

export async function initPageItem(pageController, callback) {
  recordDeepLinkEvent("initPageItem:enter");
  const offsetTop = document.documentElement.clientHeight * 0.2;
  const { textToOpen: rawTextToOpen, itemToScrollTo } = findTextToOpen(pageController);

  if (!itemToScrollTo || rawTextToOpen.length === 0) {
    recordDeepLinkEvent("initPageItem:noTarget", { rawTextToOpen });
    if (pageController.states.initOpen.textId) {
      const slug = `${pageController.states.pageSlug}/${pageController.states.initOpen.textId}`;
      pageController.functions.setInitWarning({ type: "verseNotFound", slug });
    }
    pageController.functions.markAsInitiated();
    if (callback) callback();
    return;
  }

  const ordered = orderByDomAncestry(rawTextToOpen);
  recordDeepLinkEvent("initPageItem:plan", { textToOpen: ordered });

  await scrollToAsync(itemToScrollTo.offsetTop - offsetTop);
  recordDeepLinkEvent("initPageItem:outerScrollDone");

  for (const slug of ordered) {
    const el = document.querySelector(`[textid='${slug}'] .reference a`);
    if (!el) {
      recordDeepLinkEvent("initPageItem:itemSkip", { slug, reason: "missing" });
      continue;
    }
    if (pageController.states.autoClicked.has(slug)) {
      recordDeepLinkEvent("initPageItem:itemSkip", { slug, reason: "already-clicked" });
      continue;
    }
    pageController.states.autoClicked.add(slug);

    const coords = getCoords(el);
    recordDeepLinkEvent("initPageItem:itemScrollStart", { slug });
    await scrollToAsync(coords?.top - offsetTop);
    recordDeepLinkEvent("initPageItem:itemClick", { slug });
    el.click();
    const result = await awaitDomOpen(slug, 2000);
    recordDeepLinkEvent("initPageItem:itemOpened", { slug, result });
  }

  recordDeepLinkEvent("initPageItem:markAsInitiated");
  pageController.functions.markAsInitiated();
  if (callback) {
    recordDeepLinkEvent("initPageItem:callback");
    callback();
  }
}

export function scrollToAsync(distance) {
  return new Promise(resolve => scrollTo(distance, resolve));
}

export function initPageImage(pageController) {
  const imageId = pageController.states.initOpen.imageId;
  initPageItem(pageController, () => {
    pageController.appController.functions.requestImageActivation({ imageId });
  });
}

export function initPageCommentary(pageController) {
  initPageItem(pageController, () =>
    pageController.appController.functions.setPopUp({
      type: "commentary",
      ids: [pageController.states.initOpen.commentaryId],
    }),
  );
}

export function initPageFax(pageController) {
  initPageItem(pageController);
}

export function findTextToOpen(pageController) {
  if (pageController.states.initOpen.goToSection) {
    return {
      textToOpen: [],
      itemToScrollTo: document.getElementById(
        pageController.states.pageSlug +
          "/" +
          pageController.states.initOpen.goToSection,
      ),
    };
  }

  if (!pageController.states.initOpen.textId) {
    return { textToOpen: [], itemToScrollTo: null };
  }

  let textToOpen = [];
  let textSlug = `${pageController.states.pageSlug}/${pageController.states.initOpen.textId}`;
  let el = document.querySelector(`[textid="${textSlug}"]`);
  let itemToScrollTo = findAncestor(el, ".row");
  let parentSlug = el?.closest(".row > [textid]")?.getAttribute("textid");
  if (parentSlug !== textSlug) textToOpen.push(parentSlug);
  textToOpen.push(textSlug);

  return { textToOpen, itemToScrollTo };
}
```

Note: this file includes the Task-4 R6 dispatch (`setInitWarning`) inside `initPageItem` — if you're doing Phase 4 before Phase 2, drop that block; it will be added back when Phase 2 lands.

Also note: `findAncestor` and `getCoords` are imported from `src/models/Utils`. Confirm they're exported from there. If they're not exported, export them in a follow-up:

Run: `grep -n "export.*getCoords\|export.*findAncestor" frontend/webapp/src/models/Utils.js`

If 0 results, add `export` keywords to those functions in `Utils.js`. They're already needed by other modules and the current `Page.js` imports them; the import should already work.

Specifically check the current `Page.js` import line — around line 13-22 — for which Utils helpers it pulls in.

### Task 9: Update `Page.js` to import from `initPipeline.js`

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js`

- [ ] **Step 9.1: Add imports**

In `Page.js`, find the import block at the top. Add (alongside the existing imports):

```js
import {
  initPage,
  initPageItem,
  initPageImage,
  initPageCommentary,
  initPageFax,
} from "./initPipeline";
```

`findTextToOpen` and `scrollToAsync` are NOT imported because they're used only inside `initPageItem` (which we just imported). If anything else in `Page.js` references them, also import; check by grep.

Run: `grep -n "findTextToOpen\|scrollToAsync" frontend/webapp/src/views/Page/Page.js`

If those appear outside the function definitions you're about to delete, add them to the import.

- [ ] **Step 9.2: Delete the moved function bodies**

In `Page.js`, delete lines that defined `initPage`, `initPageItem`, `scrollToAsync`, `initPageImage`, `initPageCommentary`, `initPageFax`, and `findTextToOpen` (currently around lines 572-690, but verify the line numbers in your branch — they shift after Phase 2 lands).

After deletion, `Page.js` should be ~150 lines shorter. Confirm with `wc -l frontend/webapp/src/views/Page/Page.js`.

- [ ] **Step 9.3: Run regression suite**

Unit tests:

Run: `cd frontend/webapp && CI=true npm test -- --testPathPattern="(scrollTo|orderByDomAncestry|awaitDomOpen|deepLinkInstrument)"`
Expected: 21/21 pass (or 25 if Phase 2 already landed and added 4 new scrollTo tests).

E2E:

Run: `npm run e2e:unconditional`
Expected: 2/2 pass.

Run: `npm run e2e:all`
Expected: 2 pass + 10 skipped (or more pass if you've populated `local-fixtures.json`).

- [ ] **Step 9.4: Manual smoke check**

Open `http://localhost:8200`:

1. Navigate to `/commentary/<some-real-id>`. Confirm the page scrolls to the verse, the row opens, the popup appears. (Same behavior as before — refactor changed no logic.)
2. Navigate to `/commentary/999999999`. Confirm the not-found UI shows.
3. Click any row on `/lehites`. Confirm no Loader spinner flickers.
4. Navigate to `/image/<some-real-id>`. Confirm URL canonicalizes to `/art/<id>` and the art panel shows.

If anything looks different from before this task, revert and investigate.

- [ ] **Step 9.5: Commit**

```bash
git add frontend/webapp/src/views/Page/initPipeline.js \
        frontend/webapp/src/views/Page/Page.js
git commit -m "refactor(Page): extract init pipeline into initPipeline.js"
```

### Task 10: Verify no orphan references

**Files:**
- None (verification only)

- [ ] **Step 10.1: Confirm no dead imports anywhere**

Run: `grep -rn "from.*Page.js.*initPage\|from.*Page.js.*findTextToOpen" frontend/webapp/src`
Expected: 0 results.

Run: `grep -rn "scrollToAsync" frontend/webapp/src`
Expected: only in `initPipeline.js`.

- [ ] **Step 10.2: Confirm initPipeline.js's exports are all used**

Run: `grep -rn "initPage\b\|initPageItem\|initPageImage\|initPageCommentary\|initPageFax" frontend/webapp/src/views/Page/Page.js`
Expected: 5+ hits (the 5 imported names referenced in `handlePageInit`).

- [ ] **Step 10.3: Confirm line-count win**

Run: `wc -l frontend/webapp/src/views/Page/Page.js frontend/webapp/src/views/Page/initPipeline.js`
Expected:
- `Page.js` ~920 lines (was 1069 pre-refactor)
- `initPipeline.js` ~130 lines

If `Page.js` didn't shrink by ~150 lines, recheck Step 9.2's deletions.

- [ ] **Step 10.4: No commit (verification task)**

This task adds no code. If issues are found, return to Task 9 and fix.

---

## Self-review checklist (for the implementer before merging)

- [ ] All three reference docs (`docs/reference/{commentary,image,page-text}-route.md`) describe the post-merge pipeline accurately. Pick one random `file:line` reference from each and confirm it points to the claimed content.
- [ ] `http://localhost:8200/lehites/9999999` shows the yellow `InitWarning` Alert (R6 demo).
- [ ] `console.warn` fires when `scrollTo(NaN, cb)` runs (open DevTools console, paste `scrollTo(NaN, () => {})`).
- [ ] `npm run e2e:unconditional` → 2/2 pass.
- [ ] `npm run e2e:all` with a populated `local-fixtures.json` → all 12 tests pass (or skip cleanly if some IDs are still REPLACE_ME).
- [ ] `wc -l frontend/webapp/src/views/Page/Page.js` reports ~920 lines.
- [ ] `git log --oneline feature/deep-link-followups ^main` shows 9 commits with clean conventional-commit messages.

## What's intentionally not in this plan

- **GitHub Actions workflow.** Phase 3 makes the suite runnable in any CI; the choice of CI system is left to ops. When the user picks one, adding a workflow file is a 30-minute follow-up.
- **Larger Page.js splits** (`loadPageComments`, `setActiveRow`, the reducer cases). Each has tighter coupling to component state and warrants its own focused refactor pass with regression tests.
- **R6 retry mechanism.** The audit's original sketch included "keep `initStarted` false so the effect retries when the DOM updates." Retry has subtler concerns (when to give up, debounce, etc.). This plan only addresses the user-visible signal half; retry is a separate product decision.
- **Label-key registration** for `init_warning_verse_not_found`. Task 4 uses `label("X") || fallback` — fallback covers no-op. Adding the localized label string is a separate i18n task.
- **Backend fixture seeding.** Phase 3's fixtures point at real IDs in the prod DB. There's no automated seed; populate manually per the `e2e/README.md` runbook.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-05-15-deep-link-followups.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration with clean context windows.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for your review.

**Which approach?**
