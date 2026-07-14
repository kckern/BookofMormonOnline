# Page View — Structural Follow-ups (Scoping)

**Date:** 2026-07-14
**Status:** DECIDED & PLANNED (2026-07-14). KC's decisions: **C1 → Option 1** (openRows is the single truth) and **D → Option 2** (migrate the three controllers to real state management; implemented as immutable per-instance reducers — Redux verified non-operational, see the WP-D plan's decision record). Implementation plans:
- WP-A → `docs/plans/2026-07-14-page-wp-a-cleanups.md`
- WP-B (B2+B3; B1 skipped per recommendation) → `docs/plans/2026-07-14-page-wp-b-scripture-convergence.md`
- WP-C1 → `docs/plans/2026-07-14-openrows-single-truth.md`
- WP-C2 + WP-D → `docs/plans/2026-07-15-controller-state-migration.md` (C2 absorbed into its Task 3.3)
Execution order: WP-A → WP-C1 → WP-D; WP-B independent (any time after WP-A).
**Origin:** Deferred items from `docs/audits/2026-07-14-page-view-audit.md`. The 21-task remediation (`docs/plans/2026-07-14-page-view-remediation.md`, merged to `dev` as `ea3087ee`) intentionally left these out because each is either an architectural decision, a cross-layer change, or hostage to a third-party API. This document scopes them so a future phase can be planned and approved deliberately.

All file:line references are against `dev` at/after the remediation merge; grep to confirm before editing (they drift).

---

## How to read this

Each item below is a **work package (WP)** with: what it is, why it matters, current state, approach (with options where a real fork exists), risk, effort (S ≈ ½ day, M ≈ 1–2 days, L ≈ multi-day/strategic), dependencies, and acceptance criteria. The packages are ordered by recommended sequencing, not by audit section.

Two of these carry genuine **product/architecture decisions that need your input before planning** — flagged as **DECISION** and collected at the end. The rest have a clear default approach.

---

## WP-A — Small self-contained cleanups (low risk, do first)

These are independent, low-blast-radius, and each shippable on its own. Good warm-up / good first-issues.

### A1. `document.title` single owner (audit §4.4)
- **Current:** 7 write sites across `Page.js` and `Narration.js` (`setActiveRow`, `removeOpenRow`, `setActiveSection`, `setPageData` reducer cases; `ImagePanel`, `FacsimilePanel`, `ScripturePanel` effects). Last-writer-wins, no restore discipline — opening then closing a panel can leave a stale title.
- **Approach:** introduce a tiny `useDocumentTitle(title)` hook or a `setDocTitle(parts)` helper with a defined precedence (page → section → open row → active panel), and route all 7 sites through it. A small title "stack" (push on open, pop on close) is the robust version.
- **Risk:** Low. Cosmetic surface; easy to verify by navigating and opening/closing panels.
- **Effort:** S–M.
- **Dependencies:** none.
- **Acceptance:** one module owns `document.title`; closing a panel restores the prior title; no reducer writes `document.title` directly (side effect moves to an effect/helper).

### A2. `ImagePanel` marginTop feedback loop (audit §5.5-adjacent)
- **Current:** `ImagePanel` (`Narration.js`) computes `marginTop` from a `getBoundingClientRect()` read inside an effect that also depends on `marginTop` — a measure→setState→re-measure loop that can thrash.
- **Approach:** convert to a single `useLayoutEffect` measurement that sets margin once per activeImageId change (drop `marginTop` from its own dep array), or replace the JS offset with a CSS-only sticky/scroll-margin approach if the layout allows.
- **Risk:** Medium — it's visual-positioning behavior; needs a browser check that the image panel still nudges into view when it would render off-screen.
- **Effort:** S–M.
- **Dependencies:** none.
- **Acceptance:** no dependency cycle on `marginTop`; the panel still scrolls into view when opened near the viewport edge; no visible jitter.

### A3. LightBox / autoAdvance DOM-driving (audit §5.4)
- **Current:** `LightBox` (`Narration.js`) drives the `simple-react-lightbox` by programmatically `.click()`-ing DOM nodes found via `document.querySelector`; `autoAdvance` (`Page.js`) finds the next row via `a[href='/…']`.
- **Approach:** this is hostage to the third-party lightbox's imperative API — full removal is feature work. The *achievable* cleanup: replace the `querySelector`-by-href in `autoAdvance` with the existing scroll-manager/`textid` lookup already used elsewhere (`usePageInit`/`pageScrollManager`), which is data-driven. Leave the lightbox `.click()` as a documented, isolated shim (or evaluate replacing `simple-react-lightbox`, which is a separate spike).
- **Risk:** Medium (autoAdvance touches the audio-driven auto-play flow). Low if scoped to just the anchor lookup.
- **Effort:** S (autoAdvance lookup) / L (lightbox replacement spike — separate).
- **Dependencies:** none for the autoAdvance part.
- **Acceptance:** autoAdvance no longer queries by `href`; auto-play still advances to and opens the next row. Lightbox behavior unchanged (or a separate spike documents the replacement cost).

---

## WP-B — Remaining DRY convergence (low–medium risk)

### B1. Full `CommentaryBubble` / `ImageBubble` merge (audit §3.5)
- **Current:** Task 17 already extracted the genuinely-shared parts (`countStudyComments`, `useFadeIn`, `gatherAnchorGroups`). What remains divergent is real behavior: `ImageBubble` has image cycling + deep-link activation; `CommentaryBubble` has the source-cover hover tooltip.
- **Approach:** a shared `<AnnotationBubble>` shell (positioning, fade, badge, hover-preview wiring) with per-type render slots, OR leave as-is. Given Task 17 already removed the duplication that mattered, a full merge risks over-abstracting two components whose *differences* are the point.
- **Recommendation:** **Low priority** — only pursue if a third bubble type appears. Documented here for completeness.
- **Risk:** Medium (easy to over-couple two behaviors).
- **Effort:** M.
- **Acceptance:** if done, no behavior change to cycling/activation/hover; net LOC reduction without a `type`-flag maze.

### B2. Scripture-link parser convergence (audit §3.7)
- **Current:** `scripture_link` parsing appears in `renderPersonPlaceHTML` (PersonPlace.js — the shared one; Task 20 moved `SingleNoteItem` onto it), and separately in `ParseMessage` (`models/Utils.js`) which tracks an active-ref index across mixed content. Other files (`Commentary.js`, `PopUp.js`, `MapPanel.js`, `ViewUtils.js`) consume these.
- **Approach:** `ParseMessage`'s active-ref-index behavior is genuinely different (it manages selection state across a message body), so a naïve merge would regress it. The convergence would be a *shared parser core* that both `renderPersonPlaceHTML` and `ParseMessage` build on, with `ParseMessage` adding the index layer. That's a designed shared API, not a delete-a-copy.
- **Risk:** Medium–High (touches message rendering used widely).
- **Effort:** M–L.
- **Acceptance:** one scripture-link tokenizer; `ParseMessage`'s active-ref selection still works; no change to note/commentary/popup rendering.

### B3. `ScripturePanel` (Narration) vs `ScripturesContainer` (Utils) (audit §3.9)
- **Current:** `Narration.js:696 ScripturePanel` (keyboard-nav grid) and `models/Utils.js:688 ScripturesContainer` (plain grid) both compose `ScripturePanelSingle`.
- **Approach:** extract one `<ScriptureRefGrid keyboard?>` used by both. Low churn, cross-layer (Page ↔ Utils).
- **Risk:** Low–Medium.
- **Effort:** M.
- **Acceptance:** one grid component; keyboard nav preserved where it existed; both call sites render identically.

---

## WP-C — State-model unification (medium risk, has decisions)

### C1. Row open-state single source of truth — **DECISION** (audit §4.2)
- **Current:** a row's open/closed state lives in **three** places: `pageController.states.openRows` (array), `textContentController.states.isOpen`/`isHeaderOpen` (local), and the DOM class `.reference.open` — which `isRefOpen()` (`usePageInit.js:12`) treats as the *actual arbiter* during deep-link scroll campaigns. `TextContent` seeds `isOpen` from `openRows` at mount but nothing keeps them in sync afterward.
- **Why deferred:** the deep-link scroll campaigns (`usePageInit`, `buildInitSteps`, `isRefOpen`) read the DOM class as the truth by design. Changing the ownership model must not break the deeplink test harness (`usePageInit.test.js`) or the campaign sequencing.
- **DECISION needed:** which representation becomes canonical?
  - **Option 1 (recommended): `openRows` on pageController is the single source.** `TextContent` derives `isOpen`/`isHeaderOpen` from it; `isRefOpen` reads it instead of the DOM class. Pro: one reducer-owned truth; testable without a DOM. Con: the scroll campaigns must be re-pointed from DOM-class polling to state polling, and verified against the deeplink specs.
  - **Option 2: keep the DOM class as the interop truth, delete `textContent` local state.** Less churn to campaigns, but keeps a DOM-as-state smell.
- **Risk:** Medium–High (deeplink campaigns are subtle; well-tested, which helps).
- **Effort:** L.
- **Dependencies:** run the full `usePageInit` deeplink suite as the gate.
- **Acceptance:** one owner of row-open state; `isRefOpen` reads it (not the DOM) if Option 1; all deeplink tests green; open/close, deep-link-to-verse, and autoAdvance behave unchanged.

### C2. `setStageClass` published via render-phase mutation (audit §4.5, §5.5)
- **Current:** `Page.js:415` does `pageController.appController.functions['setStageClass'] = setStageClass;` on **every render** — injecting a Page-local `useState` setter into the global function table that `Connection`/`PageLink` (via `useStageTransition`) consume. After Page unmounts, the table holds a setter for a dead component.
- **Approach:** lift `stageClass` into a small context (a `StageTransitionProvider` around the Page subtree) or into Main's state, so `useStageTransition` reads the setter from context instead of the mutated function table. This composes with the just-merged `useStageTransition` hook — the hook already centralizes the *consumer*; this fixes the *publisher*.
- **Risk:** Medium (touches the page-swap animation wiring, but that's now behind one hook).
- **Effort:** M.
- **Dependencies:** best done right after/with the context-migration line of work (`docs/plans/2026-07-13-controller-context-migration.md`) since it's the same pattern.
- **Acceptance:** no render-phase mutation of the function table; `setStageClass` sourced from context; connection/pagelink slide animation unchanged; no stale setter after unmount.

---

## WP-D — Controller-pattern evolution — **DECISION** (audit §5.1, §5.2)

This is the strategic one. **It should not be attempted piecemeal.**

- **Current:** `Page`, `Narration`, `TextContent` each build a mutable `{states, functions, data}` object inside `useReducer`, mutate it in place, and return a shallow clone. This reinvents a store without the guarantees, and has already caused ≥2 production bugs memorialized in comments (`Page.js` reducer-replay warnings). The worst instance is `setActiveRow` (`Page.js`): a reducer case that constructs `new Audio`, attaches listeners, plays sound, navigates, writes `localStorage`, and fires a three-deep API chain with a duration-sized `setTimeout` — all inside a reducer React may replay.
- **Why deferred:** team direction settled 2026-07-13 (the context-migration work) to *distribute* the controllers via context but *keep* the reducers. Fully replacing the pattern is rewrite-scale.
- **DECISION needed:** how far to go, and when?
  - **Option 1 (recommended near-term): surgical de-risk, no rewrite.** Move the side effects out of `setActiveRow` (and siblings) into effects/thunks; keep the controller shape. This kills the replay-hazard class without a migration. Effort M–L, risk Medium.
  - **Option 2 (strategic): migrate the three controllers to real state management** (Redux — already in the app — or `useReducer` with immutable updates + effects). Effort L+ (multi-week), risk High, but retires the pattern.
  - **Option 3: status quo** — leave it; revisit only when the next replay bug appears.
- **Risk:** High for Option 2; Medium for Option 1.
- **Effort:** M–L (Opt 1) / L+ (Opt 2).
- **Dependencies:** should follow, not precede, the context-migration completion.
- **Acceptance (Option 1):** no reducer case performs I/O, navigation, audio, or timers; those live in effects keyed on state changes; the reducer-replay warning comments can be deleted because the hazard is gone; all Page tests + manual audio/progress/deep-link smoke pass.

---

## Recommended sequencing

1. **WP-A (A1, A2, A3-autoAdvance)** — low-risk, independent, immediate value. Ship individually.
2. **WP-C2 (setStageClass)** — small, and naturally rides the context-migration pattern.
3. **WP-B3 / B2** — DRY convergence with designed shared APIs (B2 needs care).
4. **WP-C1 (row open-state)** — after a DECISION; gate on the deeplink suite.
5. **WP-D Option 1 (setActiveRow de-risk)** — after a DECISION; the highest-value correctness win of the set.
6. **WP-D Option 2 / B1** — only if strategically prioritized.

## Open decisions for you (blockers to planning)

1. **Row-open-state canonical representation** (C1): Option 1 (openRows is truth, re-point campaigns) or Option 2 (DOM class stays truth)?
2. **Controller-pattern trajectory** (D): Option 1 (surgical de-risk of `setActiveRow` et al., keep the shape) or Option 2 (migrate to Redux/immutable) — and is either in scope this quarter, or is it Option 3 (defer until the next replay bug)?

Once those two are decided, WP-A/B/C2 can be planned immediately (no decision needed) and WP-C1/D planned per the choices above. Each WP is independently plannable via the writing-plans skill.
