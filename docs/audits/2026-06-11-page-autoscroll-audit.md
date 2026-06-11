# Page View Auto-Scroll Audit — deep-link, section, commentary & auto-play scrolling

**Date:** 2026-06-11
**Scope:** `frontend/webapp/src/views/Page/` scroll choreography: `initPipeline.js` (deep-link pipeline), `Page.js` (mount scroll, auto-advance, scroll-spy), `src/models/Utils.js` (`scrollTo`, `getCoords`), `src/utils/awaitDomOpen.js` / `orderByDomAncestry.js` / `deepLinkInstrument.js`.
**Trigger:** Users report jerky, whiplash, or off-target scrolling when hitting routes like `/:pageSlug/:textId`, section/commentary/image deep links (`Routes.js:250-271`), and during auto-play as text boxes open.
**Context:** This pipeline was recently refactored (`04059577` extracted `initPipeline.js`) and instrumented (`deepLinkInstrument`, plus jest tests for `scrollTo`/`awaitDomOpen`/`orderByDomAncestry`) — the building blocks are in decent shape; the problems are in the choreography between them.

## How a deep link scrolls today (the choreography)

1. Mount/page-identity change → `Page.js:66-74`: `setPageData(null)` + **`window.scrollTo({top: 0, behavior: "smooth"})`** + fetch.
2. Data renders → `handlePageInit` effect (`Page.js:240-267`, gated on `readyToScroll`, `.content` in DOM) picks `initPage` (section) / `initPageItem` (textId) / `initPageCommentary` / `initPageImage` / `initPageFax`.
3. `initPageItem` (`initPipeline.js:32-83`): scroll to the target row (`itemToScrollTo.offsetTop - 20%vh`), then for each text to open: scroll to it (`getCoords`), `.click()` it, `awaitDomOpen` (expansion), repeat. Then `markAsInitiated`.
4. `markAsInitiated` → `onScrollPage` (`Page.js:582-617`) attaches a `window.onscroll` scroll-spy that updates `activeSection` → `setSlug` → **history entry**.
5. Auto-play: `autoAdvance` (`Page.js:115-126`) scrolls the *next* row's link to viewport center, then clicks it (box opens → content expands after the scroll).

Each step works; the reported symptoms come from their interactions:

---

## Findings

### 1 (HIGH) — Up-then-down whiplash on every deep link: mount scrolls to top *smoothly*, then the pipeline scrolls down

`Page.js:68` runs `window.scrollTo({ top: 0, behavior: "smooth" })` on every `pageIdentityKey` change — including the initial deep-link mount and SPA navigation onto a `/page/textid` URL. The init pipeline then smooth-scrolls *down* to the target. Two opposing animated scrolls back-to-back is the textbook whiplash users describe. Worse, if the top-scroll is still animating when `initPageItem`'s first `scrollToAsync` starts, the second scroll interrupts the first mid-flight (jerk).

**Fix:** make the reset instant (`behavior: "auto"`), and skip it entirely when `initOpen` has a scroll target (textId/section/commentary/image) — the pipeline will position the viewport anyway.

### 2 (HIGH) — `scrollTo` skips negative/zero distances instead of clamping → off-target for targets near the top

`Utils.js:397-407`: distance `0` is a "noop" and anything `< 0` is "invalid, skipping scroll". But callers compute `target.top - 20%vh` (`initPipeline.js:34,53,70`) — any target in the first ~20% of the document yields a **negative** distance, and the scroll is *silently skipped*, leaving the viewport wherever it was. Same for a legitimate "scroll back to 0". This is a direct off-target mechanism: deep links to the first rows of a page do nothing.

**Fix:** clamp instead of skip: `scrollHeight = Math.max(0, scrollHeight)` and treat "already within a pixel of target" (not "target == 0") as the noop case.

### 3 (HIGH) — No `scrollend` on Safari/iOS: every pipeline step waits the full 2s fallback

`Utils.js:420-430` resolves the smooth scroll via the `scrollend` event with a `SCROLL_FALLBACK_MS = 2000` timeout. Safari (desktop & iOS) has not shipped `scrollend`, so for those users **every** `scrollToAsync` step resolves only after 2 seconds. A textId deep link that opens a parent + child does 3 sequential scrolls → ~6s of sluggish, stop-and-go pipeline; combined with Finding 1's contested scroll this reads as "jerky". This likely explains why reports are intermittent ("sometimes") — it's per-browser.

**Fix:** add a position-settled poll as the primary completion signal (e.g. rAF loop: resolve when `window.scrollY` is stable for ~3 frames or within 2px of target), keeping `scrollend` as a fast-path and the 2s timer as the last resort.

### 4 (MEDIUM) — Scroll-spy pushes a history entry per section scrolled past

`onScrollPage` → `setActiveSection` → `appController.functions.setSlug(sectionSlug)` (`Page.js:738`), and `setSlug` defaults to **`history.push`** (`appController.js:232-240`; `replace` only when explicitly passed). Scrolling down a long page stacks an entry per section; Back then walks the user through every section they scrolled past. During the tail of programmatic scrolls (the spy attaches via `markAsInitiated`, which `initPage` fires while its smooth scroll may still be running — `initPipeline.js:16-23` only waits 1s), the animation itself can push entries.

**Fix:** scroll-driven URL sync should use `replace` (`setSlug({val, replace: true})` — the mechanism already exists). Optionally suppress the spy until the pipeline's last scroll fully settles.

### 5 (MEDIUM) — `initPage` (section links): unguarded element, fixed timers, and a stuck-init failure mode

`initPipeline.js:12-23`: `itemToScrollTo` is fetched by id and **not null-checked** — a stale/wrong section slug throws inside the `setTimeout`, and since `markAsInitiated` is only called in that callback chain, init never completes: the scroll-spy never attaches and `states.init` stays false. The two fixed 1000ms timers are also guesswork: scroll starts 1s after data render (feels laggy) and `markAsInitiated` fires 1s later whether or not the smooth scroll finished (long pages → spy attaches mid-animation, see Finding 4).

**Fix:** null-check (fall back to `markAsInitiated()`), replace the outer 1s delay with a paint-settled check (double rAF), and reuse `scrollToAsync` + `getCoords` instead of `scrollIntoView` + timer so completion is event-driven like the rest of the pipeline.

### 6 (MEDIUM) — Mixed position math: `offsetTop` for the first scroll, `getCoords` for the rest

`initPipeline.js:53` uses `itemToScrollTo.offsetTop`, which is relative to the nearest *positioned ancestor*, not the document; `initPipeline.js:70` uses `getCoords` (document-absolute via `getBoundingClientRect`). Today `.row`'s offset chain happens to reach the body, so the values coincide — but any future `position: relative` on a container silently breaks the first scroll (off-target) while the per-item scrolls stay correct. This is exactly the class of "off-target sometimes" bug that's hard to reproduce.

**Fix:** use `getCoords(itemToScrollTo).top - offsetTop` for the outer scroll too.

### 7 (MEDIUM) — Auto-play catch-up scrolls *before* the box opens, so the opened content lands off-screen

`autoAdvance` (`Page.js:115-126`) scrolls the next row's **link** to `block: "center"`, then clicks. The click expands a text box *below* that link (often hundreds of px of narration + commentary); nothing re-scrolls after expansion, so the freshly opened content frequently extends below the fold — the "scroll catches up with recently opened boxes" experience users describe is the link centering, not the content. There's also a race: `scrollIntoView` (smooth) and the click-triggered expansion animate simultaneously, and the expansion *moves the element being scrolled to* — the browser's smooth scroll targets stale coordinates (jerk + off-target).

**Fix:** click first, await the open (the `awaitDomOpen` utility already exists for the init pipeline), then scroll the opened row's top to ~20% viewport (same offset as deep links, for consistency). Alternatively scroll after `setActiveRow` fires.

### 8 (MEDIUM) — The scroll-spy is a raw `window.onscroll` assignment: clobbering + leak + stale closure

`Page.js:585` assigns `window.onscroll = ...` (not `addEventListener`): it silently clobbers any other scroll listener using the same slot, is **never removed on unmount** (leaks a closure over the whole `pageController` after navigating away — on other views `_sections` is empty so it's inert but alive), and re-attaches per `markAsInitiated` call. It also runs unthrottled layout reads (`offsetTop` per section per scroll event).

**Fix:** convert to `addEventListener("scroll", handler, {passive: true})` with cleanup in a `useEffect` return; throttle (the Read view's `useThrottle` hook exists) or switch to an `IntersectionObserver` on section headings.

### 9 (LOW) — Init gating quirks that delay or double the scroll

- `handlePageInit`'s effect deps include `document.querySelector(".content")` (`Page.js:262-266`) — a DOM query evaluated during every render to trigger an effect; works by accident (element identity is stable) but re-runs the query per render.
- In study mode, `readyToScroll` stays false until group comments index (or the user dismisses the notice) — the deep-link scroll silently waits, then fires long after the user started reading/scrolling manually: perceived as a random later jump. Consider running the positioning scroll immediately and letting comments hydrate after, or visually indicating the pending jump.
- `scrollTo`'s `callback === 0` instant-mode check (`Utils.js:410`) has zero callers passing `0` — dead, confusing flag; prefers-reduced-motion handling is good though.

### 10 (LOW) — `initPageItem` opens boxes without correcting for late layout shift

Images and embedded media inside just-opened boxes load after `awaitDomOpen` resolves, shifting layout post-scroll. The pipeline never re-checks the final target position, so the landing can drift by the height of whatever loaded late. Mitigations: reserve media space in CSS (aspect-ratio boxes) or do one final corrective `scrollToAsync` after the last open settles.

---

## Recommended fix order

1. **Finding 2 (clamp negative distances)** + **Finding 1 (skip/instant the mount top-scroll)** — small, surgical, directly remove the two most common whiplash/off-target mechanisms.
2. **Finding 3 (Safari scrollend fallback → settled-position polling)** — fixes the per-browser sluggishness; testable in jest (the `scrollTo` suite already exists).
3. **Finding 7 (auto-play: open-then-scroll)** and **Finding 4 (replace, not push)** — the auto-play UX and history hygiene.
4. **Findings 5, 6, 8** — robustness of initPage, position math unification, scroll-spy hygiene.
5. **Findings 9–10** — polish.

Findings 2, 3 and the `setSlug` replace flag have existing unit-test surface (`src/utils/__tests__/scrollTo.test.js` already covers `scrollTo`), so this fix set is unusually TDD-friendly for frontend work.
