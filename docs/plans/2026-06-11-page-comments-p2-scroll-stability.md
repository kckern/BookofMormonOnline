# Page Comments P2 — Scroll Stability: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comment placement never competes with an active scroll campaign — data loads concurrently, the paint defers until the scroll settles.

**Architecture:** Audit finding (2026-06-11): every comments-driven element is ALREADY out of document flow (`.scripture .comments` absolute, `.annotation`/`.art_bubble` absolute in gutters, `.alert.pageInfo` fixed; all opacity-fade) — comment arrival causes zero layout shift by construction. The remaining gap: the success dispatch can land mid-campaign (autoAdvance, fallback-timer paths), spending React render work during a smooth scroll. Fix: `pageScrollManager` gains `waitForIdle()`; Page.js routes the success dispatch through it and instruments placement.

**Tech Stack:** React 17 CRA, jest (src/scroll/__tests__ patterns), the existing `pageScrollManager` singleton (frontend/webapp/src/views/Page/usePageInit.js:8) and `createScrollManager` (frontend/webapp/src/scroll/scrollCampaign.js:68).

**Spec:** docs/specs/2026-06-11-page-comments-best-in-class.md §P2

**Shared context:** dev branch, direct commits with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer, no push. Frontend tests: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern '<p>'`. The dev server serves this tree (HMR), `journalctl --user -u bom-dev` for compile status.

---

### Task 1: `waitForIdle()` on the scroll manager

**Files:**
- Modify: `frontend/webapp/src/scroll/scrollCampaign.js` (inside `createScrollManager`)
- Test: `frontend/webapp/src/scroll/__tests__/scrollCampaign.test.js` (append; read the file first to reuse its helpers/mocks)

- [ ] **Step 1: Failing test** (append; adapt helper usage to the file's existing patterns — it already constructs managers and runs campaigns with fake steps):

```js
describe("waitForIdle", () => {
  test("resolves immediately when no campaign is running", async () => {
    const mgr = createScrollManager();
    await expect(mgr.waitForIdle()).resolves.toBeUndefined();
  });

  test("resolves only after the running campaign ends", async () => {
    const mgr = createScrollManager();
    let release;
    const gate = new Promise((r) => (release = r));
    const run = mgr.run([{ type: "call", fn: () => gate }]);
    let idle = false;
    const wait = mgr.waitForIdle().then(() => (idle = true));
    await Promise.resolve();
    expect(idle).toBe(false); // campaign still running
    release();
    await run;
    await wait;
    expect(idle).toBe(true);
  });
});
```

(If `step.call`'s executor doesn't await returned promises, check the `call` runner in scrollCampaign.js — if `call` steps are fire-and-forget, swap the gate step for whatever the existing tests use to hold a campaign open; the file's tests already simulate long-running steps.)

- [ ] **Step 2: Run** `CI=true npx react-scripts test --testPathPattern 'scrollCampaign'` — new tests FAIL (`waitForIdle is not a function`).

- [ ] **Step 3: Implement** — inside `createScrollManager`'s returned object add:

```js
    /**
     * Resolves when no campaign is running (immediately if idle). Used to
     * defer non-urgent DOM placement (e.g. page-comment paint) out of an
     * active campaign — data may arrive at any time; layout work may not.
     */
    waitForIdle() {
      if (!current) return Promise.resolve();
      return new Promise((resolve) => idleWaiters.push(resolve));
    },
```

with module-scope-per-manager `const idleWaiters = [];` and, at the point where `current` is cleared at campaign end (find the single place `current = null` happens in `run()`'s finally/completion), flush:

```js
      idleWaiters.splice(0).forEach((fn) => fn());
```

- [ ] **Step 4: Run** — scrollCampaign suite all green (existing + 2 new).

- [ ] **Step 5: Commit** `feat(scroll): waitForIdle — defer non-urgent placement out of active campaigns`

---

### Task 2: Page.js defers comment placement until idle

**Files:**
- Modify: `frontend/webapp/src/views/Page/Page.js` (the `loadPageComments` success `.then`, ~line 525-540)

- [ ] **Step 1: Import** `pageScrollManager` (already exported from `./usePageInit` — verify the import path used elsewhere in Page.js; usePageInit is in the same directory) and `recordDeepLinkEvent` (already imported in Page.js — verify).

- [ ] **Step 2: Wrap the success dispatch**: replace the success `.then` body's dispatch portion

```js
        setCommentState("placing");
        pageController.functions.setPageComments({
          groupId,
          index,
          counts: mergeCounts(counts, countFaxFromIndex(index)),
        });
```

with:

```js
        setCommentState("placing");
        // Zero-layout-shift by construction (badges/bubbles are absolute,
        // notice is fixed) — but defer the React paint out of any active
        // scroll campaign so render work never competes with the animation.
        // Deep-link inits gate the campaign on readyToScroll, so this is
        // instant there; it only waits on autoAdvance/fallback overlaps.
        pageScrollManager.waitForIdle().then(() => {
          recordDeepLinkEvent("pageComments:placed");
          pageController.functions.setPageComments({
            groupId,
            index,
            counts: mergeCounts(counts, countFaxFromIndex(index)),
          });
        });
```

IMPORTANT semantic check before committing: `readyToScroll` flips via the `pageController.pageComments` effect (Page.js ~238) — with the dispatch deferred, confirm the deep-link gate (`gateOpen = !needToLoadComments || readyToScroll`) cannot deadlock: the deep-link campaign only STARTS after readyToScroll, and readyToScroll now waits for the dispatch which waits for idle. On a deep-link load no campaign is running before the gate opens, so `waitForIdle()` resolves immediately — no deadlock. The autoAdvance path runs campaigns while comments load; there the deferral is exactly the desired behavior. Run the e2e ordering reasoning past the reviewer in your report.

- [ ] **Step 3: Verify** — full frontend suite (`--watchAll=false`, all pass), webpack compiled clean, `curl -s -o /dev/null -w "%{http_code}" http://localhost:8200/` → 200.

- [ ] **Step 4: Commit** `feat(page): defer comment paint until scroll campaigns settle (P2)`

---

### Task 3: Spec + audit record

- [ ] Update `docs/specs/2026-06-11-page-comments-best-in-class.md` §P2: mark SHIPPED; record the audit conclusion (all comments UI already out-of-flow — list the four CSS surfaces with file:line) and that the deliverable narrowed to dispatch deferral + the `pageComments:placed` instrumentation event. Note the deferred follow-up: an authenticated-study-group e2e fixture is required before a scroll-stability Playwright spec can assert the invariant automatically; filed as part of P3/P4 verification work.
- [ ] Commit `docs(specs): page comments P2 shipped — audit + dispatch deferral`
