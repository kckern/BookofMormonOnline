# Deep-link initialization audit: scroll / open-row / popup mechanism

**Date:** 2026-05-15
**Scope:** The `Page` component's `initPageItem` pipeline used by
`/commentary/<id>`, `/image/<id>`, `/art/<id>`, `/<pageSlug>/<textId>`, and
fax routes. Companion reference docs:
- `docs/reference/commentary-route.md`
- `docs/reference/image-route.md`
- `docs/reference/page-text-route.md`

**Verdict:** The mechanism is fundamentally **timer-driven, not
signal-driven**. It works most of the time on fast desktops because the
timer budgets happen to exceed the actual operations, but it has multiple
guaranteed race conditions on slower devices, on nested rows, and on
re-navigation between deep-links. The user-reported bugs ("popup appears
after all scrolling completes" — sometimes desired, sometimes too late;
"nested text opens before scrolling there") are not edge cases: they are
**direct, predictable consequences of the design**. This audit catalogs
the hazards and the conditions under which each fires. An improvement
plan should replace the timer-stack with a signal-driven sequence
(scrollend events, DOM-mutation awaits, deterministic ordering).

---

## 1. Executive summary

The init pipeline composes ~7 asynchronous, timer-gated steps:

```
URL → fetch commentary/image record → derive (pageSlug, textId)
    → fetch page data → wait for page comments (study mode only)
    → wait for DOM .content node → scrollTo(row top)
    → for each text in textToOpen: setTimeout → scrollTo(link) → click
    → setTimeout markAsInitiated → setTimeout setPopUp
```

Every "wait" in that chain is a **fixed setTimeout**, not a signal. The
only true signal-driven wait is the React effect that fires when
`pageComments` updates (and even that one short-circuits to a 1-second
default for non-study-mode users).

The total deterministic latency before the popup fires is:

> `2 s` (outer scrollTo) + `N × 1 s` (per-item stagger) + `2 s` (final
> popup-callback timer) = **4 + N seconds**

where N = number of text rows to open (typically 1 for non-nested, 2 for
nested). Concretely:

- Non-nested commentary deep-link: **5 seconds** from page-ready to popup.
- Nested commentary deep-link: **6 seconds** from page-ready to popup.
- And **the click on row N is scheduled at a separate timer that may
  resolve _after_ the popup is already open**, because each per-item
  click runs its own `scrollTo(distance, callback)` that adds another 1 s
  of latency on top of its stagger offset.

The race conditions below all stem from these fixed timers being out of
sync with the actual asynchronous operations they're trying to
coordinate.

---

## 2. The timing model

### 2.1 The `scrollTo` helper (`frontend/webapp/src/models/Utils.js:386-401`)

```js
export function scrollTo(scrollHeight, callback) {
  let time = 1000;
  if (!scrollHeight || scrollHeight < 0)
    if (typeof callback === "function") return callback();
    else return false;
  let behavior = { top: scrollHeight, behavior: "smooth" };
  if (callback === 0) behavior.behavior = "instant";
  setTimeout(() => window.scrollTo(behavior), time);
  if (typeof callback === "function") setTimeout(() => callback(), time);
}
```

**Hazards:**

- **The scroll and the callback fire on _independent timers, both at
  1000 ms_.** The callback is NOT chained off the scroll completing. In
  the same event-loop tick, the smooth scroll is dispatched and the
  callback fires. The callback assumes the scroll has finished; it
  hasn't.
- A smooth `window.scrollTo` on a typical page takes 300-1200 ms,
  depending on distance. So at the 1000 ms mark the page may still be
  mid-scroll when the callback runs.
- The "if no scrollHeight, fire callback immediately" branch (line 388-390)
  silently swallows the failure mode where the target element wasn't
  found. The caller can't distinguish "scrolled to here" from "couldn't
  find anywhere to scroll to."
- `behavior: "smooth"` is overridden to `"instant"` only when
  `callback === 0` (the literal number zero) — an undocumented sentinel.

### 2.2 The `initPageItem` orchestrator (`Page.js:567-597`)

```js
function initPageItem(pageController, callback) {
  const offsetTop = document.documentElement.clientHeight * 0.2;
  let { textToOpen, itemToScrollTo } = findTextToOpen(pageController);
  let distance = itemToScrollTo?.offsetTop - offsetTop;
  textToOpen = textToOpen.sort();

  let time = 0;
  scrollTo(distance, () => {
    for (let i in textToOpen) {
      if (!textToOpen[i]) return false;
      setTimeout(() => {
        let el = document.querySelector(`[textid='${textToOpen[i]}'] .reference a`);
        if (!el || el?.attributes.autoclicked) return false;
        let coords = getCoords(el);
        el?.setAttribute("autoclicked", true);
        scrollTo(coords?.top - offsetTop, () => el?.click());
      }, time);
      time = time + 1000;
    }

    setTimeout(() => pageController.functions.markAsInitiated(), time);
    if (callback) setTimeout(callback, time);
  });
}
```

**Timeline for a commentary deep-link with one parent and one leaf row
(textToOpen.length === 2):**

| t (ms) | Event |
| --- | --- |
| 0 | `scrollTo(distance, ...)` called. Internal `setTimeout(window.scrollTo, 1000)` and `setTimeout(callback, 1000)` are scheduled. |
| 1000 | Outer smooth scroll begins toward `itemToScrollTo.offsetTop - 20vh`. Outer callback enters; loop schedules item[0] at t+0 (= 1000 absolute), item[1] at t+1000 (= 2000 absolute). markAsInitiated and popup-callback are scheduled at t+2000 (= 3000 absolute). |
| 1000 | item[0] timer fires. `coords = getCoords(parent .reference a)` — reads the link's coordinates *while the outer scroll is still in flight*. `scrollTo(coords.top - 20vh, () => el.click())` is called. Internal setTimeout schedules `window.scrollTo` and `el.click()` both at t+1000 (= 2000 absolute). |
| ~1300-2200 | Outer smooth scroll completes (depending on browser/distance). The page is now near the parent row. |
| 2000 | item[1] timer fires. `coords = getCoords(leaf .reference a)`. The leaf link's position is calculated *before its parent has been clicked open* (item[0]'s click hasn't fired yet — that's scheduled at 2000 too, but per the event-loop ordering item[0]'s scrollTo was scheduled first). `scrollTo(...)` schedules window.scrollTo + el.click both at t+1000 (= 3000 absolute). |
| 2000 | item[0]'s window.scrollTo and el.click() fire **in the same tick**. Click → `toggleOpenClose` → row expands → React rerenders → leaf row mounts (or remounts) with new geometry. Smooth scroll starts moving toward the (now-stale) parent-link coordinates. |
| 2000 | markAsInitiated and popup-callback timers fire — *popup opens*. |
| ~2300-3200 | Parent row's smooth-scroll completes; layout has shifted because the parent is expanding. |
| 3000 | item[1]'s window.scrollTo and el.click() fire. By now, leaf coords are likely wrong (parent expanded, leaf moved). Click → toggleOpenClose for leaf. |
| ~3300-4200 | Leaf smooth-scroll completes. **But the popup has been open for ~1 second already.** |

So for a 2-row nested deep-link **the popup opens before the leaf row
is clicked open, and the final scroll-and-click on the leaf happens while
the popup is already covering the page**.

This is exactly the user-reported symptom: *"sometimes the opening of the
text areas, especially if it's nested, is happening before it scrolls
there."* (In fact: it's happening **after** the popup opens, not just
before its own scroll.)

### 2.3 Total fixed-budget latencies

| Scenario | textToOpen | Fixed-budget total | When popup fires (commentary) |
| --- | --- | --- | --- |
| Non-nested deep-link | 1 entry | 1000 + 1×1000 + 1000 = 3000 ms | t=3000 ms after init starts |
| Nested deep-link (parent + leaf) | 2 entries | 1000 + 2×1000 + 1000 = 4000 ms | t=4000 ms |
| Triple-nested (rare) | 3 entries | 1000 + 3×1000 + 1000 = 5000 ms | t=5000 ms |

These are **wall-clock costs that exist on every machine**, regardless
of network speed or device. They are pure baked-in latency.

---

## 3. Race conditions (by severity)

### R1. Popup fires before nested row click completes — **HIGH**

**Where:** `Page.js:594-595`.

**Cause:** `setTimeout(callback, time)` fires at the loop's cumulative
`time`, but each per-item iteration starts a *new* `scrollTo` whose
internal timers add another 1000 ms past the iteration's start. So the
last click happens at `time + 1000`, but the popup callback fires at
`time`. The popup wins by 1 second.

**Symptom:** The user lands at the commentary, the popup appears,
underneath the popup the leaf row is *still in the process of expanding*.
If they close the popup, they see the row mid-animation or — worse —
freshly expanded with the page scrolled to the wrong place (because the
last scroll-target was a pre-expansion coordinate).

**When it triggers:** Every nested deep-link (parent + leaf). Probably
~30-60% of commentary deep-links given the prevalence of quotation
blocks.

**Fix sketch:** Either (a) replace the loop with sequential promises that
await each click, then fire the callback after the final click; or
(b) base the popup trigger on a DOM-state signal (the leaf row's
`isOpen === true` or a mutation observer on the row).

---

### R2. `scrollTo` callback fires before scroll completes — **HIGH**

**Where:** `Utils.js:386-401`.

**Cause:** `setTimeout(window.scrollTo, 1000)` and `setTimeout(callback,
1000)` are scheduled independently in the same tick. The callback
assumes the scroll has settled; it hasn't necessarily.

**Symptom:**

- Per-item `coords = getCoords(el)` reads link coordinates while the
  page is still scrolling, getting stale top-of-document-relative
  coordinates (i.e. the right top in the document, but the viewport
  position will be wrong by the time the scroll completes).
- The subsequent `scrollTo(coords - offsetTop)` then aims for a position
  that's already (partly) where the page is heading — so the effective
  scroll motion is tiny or zero, and the row may end up off-screen.
- The `el.click()` inside the callback fires while the page is still
  visually scrolling, so the row expansion happens before the user has
  finished moving toward it.

**When it triggers:** Any deep-link on a page tall enough that the
target row is more than ~1 viewport away. Most scripture pages.

**Fix sketch:** Use the [`scrollend` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/scrollend_event)
(Chrome 114+, Firefox 109+, Safari 17+ — covers modern browsers) to
trigger the callback. Fallback: poll `window.scrollY` for stability
(no change across 3-4 RAF cycles).

---

### R3. Stale coords for leaf link — **HIGH**

**Where:** `Page.js:586` (`let coords = getCoords(el);`).

**Cause:** `getCoords(el)` is called before the parent has been clicked
open. The leaf's `[textid="<leaf>"]` element exists in the DOM (the row
component is always rendered; only its content is collapsed), but its
`.reference a` is at the un-expanded geometry. After the parent click,
the parent expands, pushing the leaf row downward. The captured coords
are now stale.

The leaf's per-item `scrollTo(coords - offsetTop)` aims for a stale
position, and 1 second later the smooth scroll begins moving toward
that wrong position while the parent is mid-expansion. The leaf click
then fires at a moment when the leaf row is in motion.

**When it triggers:** Any deep-link to a nested row (typical commentary
or image inside a quotation).

**Fix sketch:** Recompute coords inside each per-item iteration, after
awaiting the previous click's DOM stabilization (mutation observer,
`requestAnimationFrame` x 2, or React's `flushSync`).

---

### R4. `match.params` change does not re-run init — **HIGH**

**Where:** `Page.js:56-63` and `Page.js:186-192`, both keyed on
`[match.params.pageSlug]`.

**Cause:** For deep-link routes that have no `pageSlug` in the URL
(`/commentary/<id>`, `/image/<id>`, `/art/<id>`), `match.params.pageSlug`
is `undefined`. Navigating from `/commentary/1` to `/commentary/2`
leaves the dep array unchanged (still `undefined`), so neither effect
re-fires. The component keeps showing the *original* commentary's
underlying page, and `initOpen` (set in the useReducer initializer at
mount) still points at the original commentary id.

Compounding this, `prepareInitOpen(match.params)` is invoked inside the
second effect (line 190) but **its return value is discarded** — there's
no dispatch to update `initOpen`. So even if the effect did re-fire,
`initOpen` would still be stale.

**When it triggers:**

- User clicks commentary feed card → `/commentary/A` opens. User then
  clicks another commentary feed card → `/commentary/B`. The route
  param changes but neither pageSlug change-effect fires and `initOpen`
  is frozen at A. The page now shows A's underlying scripture with B's
  commentary popup (because `setPopUp` does run from the link's onClick
  via in-feed mechanisms, but the underlying page is wrong).

**Severity caveat:** In practice, react-router v5 with the same
`component` prop *does* keep the component mounted across param changes.
So this hazard is live. The fact that users haven't reported it
prominently may mean (a) most users navigate via direct typed URLs (full
reload), or (b) the `<Link>` clicks from in-feed components happen to
also call `setPopUp` directly, masking the bug.

**Fix sketch:** Key the effects on a stable identifier of the route
intent (e.g. `match.url`), and dispatch `setInitOpen(prepareInitOpen(match.params))`
inside the effect.

---

### R5. `readyToScroll` gate depends on async chat-service load — **MEDIUM**

**Where:** `Page.js:369-476` (`loadPageComments`) and `Page.js:204-206`
(the effect setting `readyToScroll` when `pageComments` updates).

**Cause:** For logged-in users in study mode with an active group, the
gate waits on:

1. `listQuery.load()` — async network call to the chat service for
   previous messages (up to 100).
2. `indexPageComments(messages)` — synchronous JS work.
3. `pageController.functions.setPageComments({groupId, index, counts: null})`.
4. The effect at line 204 sees `pageComments` changed and calls
   `setReadyToScroll(true)`.

If this chain is slow (network latency to messenger backend, message
volume, etc.), the init pipeline starts late. There's no upper bound;
the user just stares at a `LoadingPageCommentsNotice` banner.

The banner offers a manual override (`×` to force `setReadyToScroll(true)`),
which is good — but most users won't notice it.

**When it triggers:** Study-mode users with slow messenger backend or
large message history.

**Fix sketch:** Cap the wait with a deterministic timeout; for
deep-links specifically, decouple "open the row and pop up the
commentary" from "load the study-group context."

---

### R6. `findTextToOpen` returns nothing → silent failure — **MEDIUM**

**Where:** `Page.js:615-641`.

**Cause:** `findTextToOpen` returns `{textToOpen: [], itemToScrollTo:
null}` if either `initOpen.textId` is missing or the `[textid="<slug>"]`
element isn't found in the DOM. `initPageItem` then computes `distance =
null?.offsetTop - offsetTop` = NaN, and `scrollTo(NaN, callback)` hits
the early-return path (line 388: `if (!scrollHeight || scrollHeight <
0)`), calling the callback immediately. The callback loops over an empty
`textToOpen`, fires the markAsInitiated and popup-callback at `t=0`.

So the popup appears at the *top of the page* with no scroll, no row
opened. The user sees the commentary popup floating over a page they
weren't expecting.

**When it triggers:**

- `commentary.location.slug` was malformed.
- The page schema has changed and the textId no longer exists.
- DOM rendering raced behind the init effect's fire (very rare — gate
  is `document.querySelector(".content")` which is the outer container,
  not the row).

**Fix sketch:** Make the failure observable — log a warning, show a
toast, or at minimum keep `initStarted` false so the effect retries
when the DOM updates.

---

### R7. `scrollTo` early-return swallows the scroll — **MEDIUM**

**Where:** `Utils.js:388-390`.

**Cause:** The condition `if (!scrollHeight || scrollHeight < 0)` skips
the scroll for any falsy or negative value. `null`, `0`, `undefined`,
`NaN`, and negative offsets all bypass. This means:

- If the target row happens to already be at the top of the document
  (offsetTop = 0), the scroll is skipped — fine.
- If the target row is *above* the current scroll position by less than
  20% viewport, distance becomes negative — the scroll is skipped, but
  the callback still fires. The page stays where it is. This may be
  intentional but is undocumented.
- If `itemToScrollTo` is null, distance is NaN — the scroll is skipped
  and the callback fires immediately (see R6).

**When it triggers:** Mostly the R6 path, but also when the page is
already near the target.

**Fix sketch:** Split "no scroll needed" (intentional) from "scroll
failed" (should retry or report).

---

### R8. `autoclicked` attribute is permanent — **LOW**

**Where:** `Page.js:587` (`el?.setAttribute("autoclicked", true);`) and
`Page.js:585` (the check).

**Cause:** Once a reference link has `autoclicked="true"`, subsequent
init runs on the same DOM node skip it. If a user closes the row
manually and then somehow re-triggers init (e.g. by re-navigating to
the same `/commentary/<id>` URL while the Page component remains
mounted), the click won't re-fire and the row won't re-open.

**Mitigated by:** Route changes usually trigger React's reconciliation,
remounting rows. The hazard is mostly dormant.

**When it triggers:** If R4 is fixed (param-change re-init), this hazard
becomes active.

**Fix sketch:** Use a per-init-session set kept in the controller state
rather than a DOM attribute.

---

### R9. `setActiveRow` pushes URL during init — **LOW**

**Where:** `Page.js:704` — `setSlug(slug)` inside the `setActiveRow`
reducer.

**Cause:** Each auto-click triggers `setActiveRow`, which calls
`appController.functions.setSlug(slug)`. This pushes
`/<pageSlug>/<textId>` into history. For deep-links to
`/commentary/<id>`, the URL briefly becomes `/<pageSlug>/<textId>` during
the auto-click, then `setPopUp` overrides it back to `/commentary/<id>`.

For 2-row nested deep-links, this happens twice (one push per click),
both before the popup overrides. History stack accumulates extra
entries, which subtly breaks back-button navigation.

**Mitigated by:** `setSlug`'s early-return when slug is unchanged
(`appController.js:229`). But each row click pushes a *different* slug
(parent then leaf), so both entries persist.

**Symptom:** Pressing back after closing a commentary popup may step
through the auto-clicked row slugs before going to the previous page.

**Fix sketch:** Use `history.replace` during init, or suppress the
`setSlug` call when the click was auto-triggered.

---

### R10. `prefers-reduced-motion` ignored — **LOW**

**Where:** `Utils.js:391-393` — `behavior: "smooth"` is hard-coded.

**Cause:** Browser respects `prefers-reduced-motion` for smooth
scrolling automatically, but the 1000 ms timer doesn't. Users with
reduced motion enabled see instant scrolls followed by long dead-time
gaps before the click/popup.

**When it triggers:** Reduced-motion users (accessibility, motion
sensitivity, OS-level toggle).

**Fix sketch:** Use the `scrollend` event so the timer adapts to actual
scroll duration.

---

### R11. `justScroll` ResizeObserver dead code, but observer attached — **LOW**

**Where:** `Page.js:432-436` and `Page.js:556-565`.

**Cause:** `loadPageComments` attaches a `ResizeObserver` that calls
`justScroll(pageController)` on every resize of `.main-panel`.
`justScroll` (line 556) starts with `return false;` — the function is
intentionally a no-op. So the observer fires on every layout shift
(row opening, popup opening, image loading) and does nothing.

**Mitigated by:** The function is cheap. Mostly a code-smell.

**Severity:** Cosmetic, but the dead code obscures intent.

**Fix sketch:** Remove the observer attachment entirely, or implement
`justScroll` properly.

---

### R12. `textToOpen.sort()` is a string sort, not a tree-walk — **LOW**

**Where:** `Page.js:572`.

**Cause:** `textToOpen` is sorted lexically. With slugs like
`lehites/100` and `lehites/85`, `lehites/100` sorts before `lehites/85`
because '1' < '8'. The parent-first invariant the sort is trying to
enforce works *only because* the parent and leaf textIds happen to be
ordered such that lex sort matches DOM hierarchy in most cases. Counterexample:
parent textId = `lehites/85`, leaf textId = `lehites/9` → lex sort puts
the leaf first.

**When it triggers:** Edge cases where a quoting parent has a
higher-numbered textId than its quoted child. Rare but possible.

**Fix sketch:** Determine order by DOM ancestry, not string sort. The
parent was already identified via `el?.closest(".row > [textid]")` in
`findTextToOpen` — emit them in that order.

---

### R13. Empty `data` from backend → silent stuck state — **MEDIUM**

**Where:** `Page.js:312-327` and `Page.js:262-309`.

**Cause:** `getPageDataFromAPIViaNote` and `getPageDataFromAPI` don't
guard against `response.commentary[id]` or `response.image[id]` being
undefined. If the backend returns `{data: {}}` or `{data: {commentary:
[]}}` (e.g. id not found, sandbox mode, permissions), the next access
`commentary.location?.slug` is `undefined?.replace(...)` which throws.

Even when an exception is caught by React's error boundary, the page
ends up in a loading state with no recovery. The user sees a spinner
forever.

**When it triggers:**

- Stale or invalid IDs from external links.
- Dev sandbox mode (per CLAUDE.md memory — observed in this audit, the
  GraphQL endpoint returns `{data: {}}` for arbitrary commentary IDs).
- Permissions denied for a commentary the user can't access.

**Fix sketch:** Validate response shape, show a "commentary not found"
state, and either redirect to home or fall back to opening the
underlying page slug if we have one.

---

### R14. Image deep-link relies on `ImageBubble` rendering — **MEDIUM**

**Where:** `Annotations.js:279-301`.

**Cause:** The `/image/<id>` route depends on a side-effect inside
`ImageBubble.useEffect` to activate the image. The effect's guards
include `!narrationController.pageController.states.loading` and
`item.ids.indexOf(urlOpenImageId) >= 0`. If:

- The image isn't grouped into any `ImageBubble` (e.g. an image not
  referenced by an `[i]` anchor in the text), no bubble claims it.
- The bubble renders before `loading` becomes false (race with page
  rendering), the guard rejects.
- The image is in a row that hasn't been auto-opened yet, the bubble
  doesn't mount at all.

In any of these cases, the URL stays at `/image/<id>` and no image is
shown — silent failure.

**Fix sketch:** Move image activation to the `initPageImage` callback
(analogous to `initPageCommentary`), and make it explicit rather than
relying on a side-effect race.

---

## 4. Cumulative failure surface

The mechanism's overall reliability is approximately the **product** of
each component's reliability:

| Component | Failure mode | Approx. failure rate |
| --- | --- | --- |
| Page data fetch | Backend down / 404 | < 1% |
| `loadPageComments` | Messenger backend slow | 1-3% (study mode) |
| `findTextToOpen` finds row | textId missing | < 1% |
| Outer scroll completes by t=2000 | slow device, tall page | 5-20% |
| Per-item coords still valid | nested rows shift | 30-60% (nested) |
| Per-item scroll completes by click | depends on previous | 5-20% |
| Popup callback timing matches user expectation | nested only | 30-60% (nested) |
| `match.params` re-init when navigating | param change between deep-links | 100% bug rate |

For a non-nested commentary deep-link on a fast desktop: **~80-90%
success**. For a nested commentary deep-link on a moderate device: **~40-60%
success**. For successive deep-link navigation without page reload: **~0%
success** (R4 is deterministic).

These numbers are estimates from code reading; live measurement (R15
below) would refine them.

---

## 5. What an improvement plan needs to address

Listed in order of impact-per-effort:

1. **Replace `scrollTo`'s timer-based callback with `scrollend`**
   (Utils.js:386-401). Single-function change, fixes R2 and R10
   across all callers.
2. **Sequence per-item clicks promise-style with mutation-observer awaits**
   (Page.js:567-597). Recompute coords after each open. Fixes R1, R3,
   R12.
3. **Wire `initOpen` to route changes via dispatch**
   (Page.js:186-192). Move `prepareInitOpen` into the reducer and call
   `dispatch({fn: "setInitOpen", val: prepareInitOpen(match.params)})`.
   Key effects on `match.url`, not `match.params.pageSlug`. Fixes R4
   and unlocks fix R8.
4. **Make data-not-found a first-class state.** `Page.js:312-327` should
   detect missing `response.commentary[id]` / `response.image[id]` and
   route to a not-found UI. Fixes R13.
5. **Cap `readyToScroll` wait at 2-3 seconds** for deep-links.
   `Page.js:369-476`. Fixes R5; surfaces the manual-override banner
   sooner.
6. **Lift image activation into `initPageImage` callback**
   (Page.js:599-601). Mirrors the commentary pattern. Fixes R14.
7. **Replace `setSlug` push with replace during auto-clicks**
   (Page.js:704). Add an `auto` flag to `setActiveRow` payload. Fixes R9.
8. **Remove ResizeObserver / dead `justScroll`** (Page.js:432-436,
   556-565). Cosmetic, but cleanup.

A more ambitious rewrite would replace the entire `initPage*` family
with a single state machine (idle → fetching → ready → scrolling →
opening-parent → opening-leaf → done → popup), driven by signals
(network responses, scrollend, mutation observer) rather than timers.
That would also fix R6 by making "failed to find row" an explicit
terminal state.

---

## 6. Recommended verification before / after a fix

This audit was code-based. To pre-validate fixes and quantify the
real-world failure rates, the following measurements would be valuable:

- **R15 (recommended):** Install Playwright (not currently in
  `package.json`); add a test that hits each deep-link variant
  (commentary, nested commentary, image, page+text) against the dev
  server with deterministic page seeds, captures the sequence of
  `scroll`, `click`, `setSlug`, and `setPopUp` events with timestamps,
  and asserts the ordering invariants this audit identifies as broken.
- **R16:** Add temporary `console.time/timeEnd` markers in
  `initPageItem` and ship to one canary user; collect 50 traces;
  histogram the per-stage durations to confirm the 80-20 split between
  "fast path" (everything inside fixed budgets) and "slow path"
  (something runs over).
- **R17:** Synthetic test on `prefers-reduced-motion: reduce` (R10) and
  on a CPU-throttled profile (Lighthouse's "Slow 4G + 6x CPU slowdown")
  to confirm the timer budgets break down predictably.

---

## 7. Out of scope

- Mobile drawer (`PopUp.js:98`). Mobile uses a different popup
  presentation; some of the desktop-specific positioning hazards don't
  apply. A separate audit of `MobileDrawer` would be worthwhile.
- Lightbox (`Narration.js:434-510`). Only triggered by the fullscreen
  button, not by deep-link.
- The fax route's facsimile rendering. Init logic is shared
  (`initPageFax` calls `initPageItem`), so all the same race conditions
  apply, but the facsimile-rendering layer adds independent hazards
  not covered here.
- Audio auto-start inside `setActiveRow`. Audio plays during init;
  whether that's desirable UX is a product question, not a correctness
  one.
