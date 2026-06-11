# Page Scroll Manager — Design Spec

**Date:** 2026-06-11
**Status:** Approved design (rip-and-replace of the Page view's scroll code)
**Sources:** `docs/audits/2026-06-11-page-autoscroll-audit.md` (10 findings), seven code-review finder angles (~35 candidates) over `views/Page/initPipeline.js`, `views/Page/Page.js`, `models/Utils.js`, `utils/awaitDomOpen.js`, and user-approved design decisions.

## 1. Decisions (locked)

| Decision | Choice |
|---|---|
| Scope | **Shared, view-agnostic module (`src/scroll/`), wired into Page only in this effort.** Read/Theater migrate later. |
| User interrupt | **Adopted.** Any manual scroll input cancels in-flight auto-scrolls and the remaining pipeline. |
| Scroll-spy URL sync | **Adopted.** `history.replace`, never push. |
| Auto-play advance | **Adopted.** Open the next box first, await expansion, then scroll to the opened content. |
| Analytics on auto-opens | **Parity.** Auto-opens keep firing today's side effects (`el.click()` path retained). Suppression deferred to a future product decision. |
| Special care | Commentary, image, fax, and nested-text deep links each get explicit use-case + edge-case treatment (§5, §6). |
| Approach | Intent-queue scroll controller: pure-JS core + thin React adapter (approved "Approach A"). |

## 2. Goals / Non-goals

**Goals:** one arbiter for all programmatic scrolling in the Page view; deep links land on-target on the first try; no whiplash (no competing animated scrolls, ever); user input always wins; Safari parity; the init pipeline can never wedge (`markAsInitiated` always reached); jest-testable core.

**Non-goals (this effort):** migrating Read/Theater (the module's API must merely not preclude it); the per-row `new Audio` + ghost `ended`-listener debt in `Page.js`'s reducer (adjacent, tracked separately); analytics suppression for auto-opens; keyboard-accessibility overhaul; any change to what *content* opens for a given URL.

## 3. Architecture

```
src/scroll/
├── scrollCampaign.js   # core: createScrollManager() — the arbiter + step runner
├── settle.js           # scroll-settled + element-height-settled detection
├── scrollSpy.js        # IntersectionObserver active-section watcher
└── index.js            # public exports
src/views/Page/
├── usePageInit.js      # React adapter: initOpen → campaign; owns init phase state
└── (deleted: initPipeline.js, onScrollPage, the mount smooth-scroll)
```

### 3.1 The arbiter invariant

At most **one campaign** (an ordered list of steps) runs per window. Starting a new campaign supersedes the running one. During a run, listeners for `wheel`, `touchstart`, `keydown` (arrow/page/space/home/end), and `mousedown` (scrollbar drags) are attached (`passive: true`) — any of them aborts the campaign. Campaigns **resolve, never reject**, with:

```js
{ status: "completed" | "interrupted" | "superseded" | "failed", failedStep?, detail? }
```

### 3.2 Core API

```js
const manager = createScrollManager({ onEvent });   // onEvent ← deepLinkInstrument
await manager.run([ ...steps ], { signal });        // signal: external abort (unmount/route change)
manager.cancel(reason); manager.isRunning();

// Step builders (element args are LAZY: () => Element, resolved when the step starts)
step.scrollToElement(getEl, { offsetRatio = 0.2 })
step.openAndAwait(getEl, { isOpen, timeoutMs = 2500 })   // click + await open + height-stable
step.call(fn)                                            // tail actions; skipped unless status so far is clean
```

**Scroll step semantics:** target Y = document-absolute element top (`getBoundingClientRect().top + window.scrollY` — never `offsetTop`) minus `offsetRatio × viewportHeight`; **clamped to `[0, maxScroll]`** (a negative result means "scroll to 0", not "skip"); no-op if already within 2px; `prefers-reduced-motion` ⇒ `behavior: "instant"`; completion = position stable for 3 consecutive rAF frames within 2px of target (primary), `scrollend` (fast path), hard per-step timeout (last resort, configurable, default 3000ms).

**Open step semantics:** click the row's trigger only if `isOpen(el)` is false (preserves `autoClicked` idempotence); completion = open-state true **and element height stable for 3 rAF frames** — not merely class presence. This absorbs `utils/awaitDomOpen.js` and fixes the measure-mid-Collapse off-target bug (the Reactstrap `Collapse` runs ~350ms after the `open` class lands).

### 3.3 Scroll spy

`createScrollSpy({ getSections, topBandRatio: 0.2, onActive })` — IntersectionObserver with `rootMargin` shaping a top-20% band (zero scroll-event layout reads; the `StudyChat.js` IO precedent). Lifecycle owned by a `useEffect` (attach on enable, detach on unmount — replacing the leaking raw `window.onscroll` assignment). Reads fresh state via refs, not a captured `pageController` snapshot.

### 3.4 Init phase state (replaces three flags)

`usePageInit` owns a single phase: `idle → waiting (study-mode comments) → positioning (campaign running) → ready`. It replaces `readyToScroll`+`initStarted`+`states.init` coordination: the route key is the campaign identity — a new route key supersedes the running campaign and starts a fresh one (fixing the stale-`initStarted` closure bug that silently skips init on same-page textId navigation). `markAsInitiated` semantics ("page is interactive, spy may run") fire in a `finally` regardless of campaign status. Scroll-spy is enabled only in `ready`.

## 4. Functional requirements

- **FR-1 (textId deep link):** `/:pageSlug/:textId` positions the target's row at 20% viewport height, opens its parent (when nested) then the target in DOM-ancestry order, and finishes with the opened target at the 20% offset.
- **FR-2 (section link):** a section deep link (`goToSection`/`lastLeaf`) positions the section element at the 20% offset. No timers-as-guesses; settled-scroll completion.
- **FR-3 (commentary link):** FR-1 positioning for the host verse, then the commentary popup opens **only after the final scroll settles**; if the campaign was interrupted/superseded, the popup does not open.
- **FR-4 (image link):** as FR-3 with `requestImageActivation`. The activation side effects (including `Annotations.js`'s `history.push('/art/…')`) must not re-trigger init (§6 E-13).
- **FR-5 (fax link):** FR-1 positioning only; no tail action.
- **FR-6 (nested text):** when the target's parent row is closed, the parent opens first (its open creates the child's DOM); child coordinates are measured only after the parent's height settles.
- **FR-7 (auto-play advance):** on audio `ended` with autoplay on, the next row opens first (click), then the opened row scrolls to the 20% offset after expansion settles.
- **FR-8 (scroll-spy):** after init completes, the active section (top-20% band) drives `document.title` and the URL via `setSlug({replace: true})`. Never `push`. Never active during a campaign.
- **FR-9 (mount reset):** entering a page with no deep-link target scrolls to top **instantly**; with a target, the reset scroll is skipped entirely (the campaign positions the viewport).
- **FR-10 (user interrupt):** any manual scroll input during a campaign aborts the remaining steps (including tail actions) within one frame; the page stays where the user put it; init still completes (phase → ready).
- **FR-11 (resilience):** a missing/invalid target produces the existing `verseNotFound` warning (when a textId was requested), records instrument events, and reaches `ready`. No code path can leave init wedged.
- **FR-12 (motion accessibility):** `prefers-reduced-motion: reduce` makes every campaign scroll instant.
- **FR-13 (open side-effect parity):** rows are opened via the same `.reference a` click path as today; `autoClicked`-equivalent idempotence prevents double-opens; analytics/log behavior for auto-opens is unchanged.
- **FR-14 (telemetry):** the core emits the existing `deepLinkInstrument` event vocabulary via `onEvent`; event sequences are asserted in core unit tests.

## 5. Use cases

1. Cold load `/lehites/5` (verse, parent closed) → instant top, fetch, campaign: row scroll → open parent → settle → open 5 → settle → final offset scroll → ready; spy on.
2. Cold load `/lehites` (no target) → instant top, ready after data; spy on.
3. Cold load section URL `/lehites/<section-slug>` → scroll to section; ready.
4. Cold load `/commentary/<id>` (Routes 250-259 variants) → resolve host page+verse, FR-1, popup after settle.
5. Cold load `/image/<id>` → as 4 with image activation; tolerate the `/art/` URL rewrite without re-init.
6. Cold load `/…/fax/<version>` → FR-1 positioning, fax viewer renders.
7. SPA navigation Page→Page (new pageSlug) → supersede any campaign, FR-9, new campaign.
8. SPA navigation same page, new textId (`pageIdentityKey` unchanged) → no refetch, supersede + new campaign for the new target (currently broken by stale `initStarted`).
9. Auto-play chain: verse audio ends → next opens → scroll catches up to opened content → repeat; user grabbing the scrollbar mid-chain stops the scroll (audio continues).
10. User scrolls during any deep-link campaign → campaign aborts; no popup/tail fires; spy enables.
11. Study-mode user with group comments loading → campaign waits in `waiting`; the dismiss (×) or comments-ready starts it; if the user already scrolled while waiting, the campaign is born interrupted (do not yank them).
12. Reader scrolls through sections → title/URL update via replace; Back leaves the page in one press.

## 6. Edge cases (each maps to a current defect or a finder candidate)

- **E-1** Target in the top ~20% of the document → negative computed Y → **clamp to 0** (today: silently skipped, off-target).
- **E-2** Target already within 2px → no-op step, immediate completion (today: `scrollHeight === 0` conflated "at top" with "don't scroll").
- **E-3** Safari/iOS: no `scrollend` → settle poll completes at actual scroll end (today: +2s per step).
- **E-4** Open-animation overlap: coordinates measured only after height-stable (today: measured ~33ms after class flip, mid-Collapse → undershoot).
- **E-5** Late media inside opened boxes shifts layout → the final scroll step re-measures at step start (lazy `getEl` + fresh coords); residual drift after completion is accepted (no scroll-jacking corrections post-campaign).
- **E-6** Route change / unmount mid-campaign → external `signal` aborts; no dispatch to stale reducers; no DOM access after wipe (today: clicks/dispatches on stale controller possible).
- **E-7** Rapid repeated deep links (double-click, back/forward) → supersession; only the last campaign acts; the loser's tail actions are skipped.
- **E-8** Missing element for textId (bad id, content variant) → `failed` + `verseNotFound` + ready (today: also pushes `undefined`/`null` slugs into the open list → `[textid='undefined']` queries; the builder must filter non-string slugs).
- **E-9** Parent slug == target slug, or parent already open → open list deduplicates; `isOpen` check prevents re-click (toggle-close) — preserving today's `autoClicked` protection including across the `/art/` rewrite re-entry.
- **E-10** `prefers-reduced-motion` → instant scrolls, still settle-confirmed (a single rAF).
- **E-11** Last item auto-advance (no next row) → advance is a no-op (parity).
- **E-12** Scroll-spy slug format: emitted section ids are full hierarchical slugs (`lehites/<section>`); Page's custom `match.params` re-parser (`split("/").slice(-2)`) makes such URLs resolve back to the same page. **The replacement keeps the emitted format byte-identical** so reloads of spy-written URLs keep working; the re-parser is documented as load-bearing.
- **E-13** `Annotations.js` `history.push('/art/<id>')` after image activation changes the route mid-`ready` → the adapter treats a route change to the *same resolved page+target identity* as a no-op (no supersede-and-rerun), preventing the re-init/toggle-close loop.
- **E-14** Spy enabled while a user is mid-flick (momentum scrolling at campaign end) → IO events are inherently coalesced; first active section wins; no history spam (replace).
- **E-15** Two campaigns requested in the same tick (e.g. mount effect + init effect) → arbiter serializes: last submission wins, earlier resolves `superseded`.
- **E-16** `getSections` returns zero sections (non-paginated content) → spy idles without error.
- **E-17** Study-mode `waiting` + route change → pending campaign request is discarded with the route, not leaked.

## 7. Defect ledger being retired (traceability)

| Current defect | Where | Retired by |
|---|---|---|
| Smooth scroll-to-top races the deep-link scroll | `Page.js:68` | FR-9 |
| Negative-distance scrolls silently skipped | `Utils.js:402` | E-1 |
| 2s `scrollend` fallback per step on Safari | `Utils.js:430` | E-3 |
| Mid-Collapse coordinate measurement | `awaitDomOpen.js` + `initPipeline.js:70` | E-4 |
| `offsetTop` vs document-absolute mismatch | `initPipeline.js:53` | §3.2 |
| Scroll-spy `history.push` per section | `Page.js:738` + `appController.js:232` | FR-8 |
| `window.onscroll` clobber/leak/stale snapshot | `Page.js:585` | §3.3 |
| `\|\| true` dead init guard | `Page.js:736` | §3.4 |
| Three init flags + stale `initStarted` closure | `Page.js:208-266` | §3.4, UC-8 |
| `touched` written, never read (dead interrupt) | `Page.js:91,545,614` | FR-10 |
| `initPage` null deref + blind 1s timers | `initPipeline.js:12-23` | FR-2, FR-11 |
| `undefined`/`null` slugs in open list | `initPipeline.js:128-130` | E-8 |
| Auto-play scrolls before expansion | `Page.js:115-126` | FR-7 |
| `callback === 0` sentinel + dead instant path | `Utils.js:410` | §3.2 API |
| Write-only `deepLinkInstrument` | 15+ call sites | FR-14 |
| `/art/` push re-init loop risk | `Annotations.js:291` | E-13 |
| `querySelector(".content")` in effect deps | `Page.js:262` | §3.4 adapter |

**Explicitly out of scope (adjacent debt, unchanged):** per-row `new Audio` + accumulated `ended` listeners (`Page.js:635`); `clicky.goal("read")` firing after navigation and for auto-opens (parity decision); viewport meta a11y.

## 8. Testing

**Core unit tests (jest/jsdom, the bulk of coverage):** arbiter supersession & serialization; user-interrupt abort per input type; settle detection (fake rAF/timers; with and without `scrollend`); negative clamp + already-at-target no-op; step timeout → `failed`; lazy element resolution; open-step idempotence (`isOpen` short-circuit); tail-step skipping on interrupted/superseded; instrument event sequences per status (the `deepLinkInstrument` finally earns its keep). Spy tests with a mocked IntersectionObserver: band activation, replace-only emission, detach on stop.

**Existing suites:** `awaitDomOpen`/`orderByDomAncestry` logic folds into the core (their tests migrate or retire with attribution); `scrollTo.test.js` retires with `Utils.scrollTo` once no callers remain (Read's two callers get a thin shim or migrate in the later Read adoption).

**Manual checklist (localhost:8200, not the CDN-cached domain):** one pass per use case in §5, on Chrome + Safari (the `scrollend` divergence), plus reduced-motion enabled.

## 9. Acceptance criteria

1. All §5 use cases pass manually on Chrome and Safari; deep links land within ±16px of the 20% offset on first try.
2. No route in §5 produces more than one animated scroll direction change (no whiplash), and zero animated scrolls when reduced-motion is set.
3. Manual scroll input during any campaign stops automatic scrolling within one frame, and the session still reaches `ready`.
4. Back button after reading through N sections exits the page in one press.
5. `grep -rn "window.onscroll\|initPipeline\|states.touched" frontend/webapp/src/views/Page` returns nothing; `Utils.scrollTo` has no Page-view callers.
6. Core test suite green in CI alongside all existing suites; no `act()`/unmounted-setState warnings during Page navigation in dev console.
