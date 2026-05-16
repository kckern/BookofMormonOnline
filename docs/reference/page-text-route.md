# `/<pageSlug>/<textId>` route

Canonical scripture-text deep-link. Opens the page identified by
`pageSlug`, scrolls to the text row identified by `textId`, and expands
that row. This is the most common deep-link in the app — it's the URL
generated whenever a user opens a row, and it's the target of nearly every
internal scripture-text link.

No popup, no panel activation, no auxiliary state. Just *page → scroll →
expand*.

## Route definition

`frontend/webapp/src/models/Routes.js:263-274` — the page+text route is
one of three closely related patterns:

```js
{
  path: "/:pageSlug+/:textId(\\d+)/fax/:faxVersion+",
  component: Page,
},
{
  path: "/:pageSlug+/:textId(\\d+)",
  component: Page,
},
{
  path: "/:pageSlug+",
  component: Page,
  exact: true,
}
```

- `pageSlug+` is a **plus-suffixed** route param — it accepts one or more
  URL segments joined by `/`, so a slug like `mosiah/chapter-1` is captured
  whole. The pattern stays a string with embedded slashes inside the param.
- `textId(\\d+)` is digit-only. Non-numeric trailing segments fall through
  to `/:pageSlug+` and are treated as part of the page slug.
- The fax variant adds a third positional segment; it shares the same flow
  but dispatches to `initPageFax` (which today just calls `initPageItem`
  — same behavior as the plain text route, except other parts of the page
  open the facsimile view on top).
- Route ordering matters: the fax variant must come before the bare
  page+text variant, which must come before bare `pageSlug+`, since the
  router matches first-to-last.

## Entry points that produce this URL

This URL is produced by **almost every interaction with text rows**:

| Source | File | What it does |
| --- | --- | --- |
| Reference link inside each row | `views/Page/TextContent.js:296-310` | Each row's `<a href="/<slug>">` inside `<CardHeader className="reference">` produces this URL on hover/Ctrl-click. `onClick` calls `toggleOpenClose` / `toggleOpenCloseHeader` instead of navigating — so a normal click *doesn't* navigate but the URL is still the link target. |
| `setActiveRow` reducer | `views/Page/Page.js:738-817` | When any row is expanded (whether by user click or by `initPageItem`'s auto-click), `setSlug(slug, { replace: auto === true })` is called, pushing `/<pageSlug>/<textId>` into history (or `history.replace`ing it if the click came from the init pipeline). |
| `localStorage.studybookmark` | `views/Page/Page.js:756` | The same `setActiveRow` writes the slug to `localStorage` so `/study` reopens to the same row. |
| External links / address bar | — | Anyone sharing a scripture position uses this URL. |

This is the route the app **gravitates toward** — opening any row
rewrites the URL to this shape, even if the user came in via
`/commentary/<id>` or `/image/<id>`. (The popup/panel flows then
re-rewrite on top of it.)

## Full flow

### 1. Route mounts → `Page` component initializes

`frontend/webapp/src/views/Page/Page.js:47-58`

`match.params` contains `pageSlug` and `textId` (both set from the URL).

`prepareInitOpen` (Page.js:33-45) builds:

```js
initOpen = { pageSlug: "<slug>", textId: "<id>" }
```

There is also a special case at Page.js:49-56: if `match.params.pageSlug
=== "study"`, the slug is replaced with the most-recent slug from
`localStorage.studybookmark` (falling back to `lehites/1`). This is what
makes `/study` resume where the user left off.

The page controller also seeds `autoClicked: new Set()` and
`notFound: null` for this mount (Page.js:94-95).

### Two route keys

`Page.js` computes two composite strings (Page.js:60-61) that scope the
two main effects independently:

- `pageIdentityKey = pageSlug|commentaryId|imageId` — drives the
  data-fetch effect (Page.js:63-70). Re-fires only when the underlying
  page changes; an in-page row click that updates only `textId` does NOT
  trigger a refetch or Loader flicker.
- `routeKey = pageSlug|textId|commentaryId|imageId|faxVersion` — drives
  the reset/init effect (Page.js:201-211). Re-fires on any
  route-param change, so navigating from `/<page>/<textA>` to
  `/<page>/<textB>` correctly re-runs `initPageItem` and clears
  `autoClicked` / `notFound` / `imageActivationRequest` between
  transitions.

The split is what allows R4 (re-init on commentary→commentary
navigation) without regressing in-page row clicks into a Loader flicker.
For the page+text route specifically, this means clicking a different
row inside the same page only fires the route-reset effect — the
GraphQL page data is reused.

### 2. Load page data (no commentary/image indirection)

`Page.js:63-70`:

```js
useEffect(() => {
  pageController.functions.setPageData(null);
  window.scrollTo({ top: 0, behavior: "smooth" });
  pageController.functions.setLoading(true);
  if (match.params.imageId || match.params.commentaryId)
    getPageDataFromAPIViaNote(match.params);
  else getPageDataFromAPI(match.params.pageSlug);
}, [pageIdentityKey]);
```

Neither `imageId` nor `commentaryId` is set, so
`getPageDataFromAPI(pageSlug)` runs directly (textId is *not* passed
as the second argument). The function (Page.js:281-328) then runs its
standard query:

```js
BoMOnlineAPI(
  { page: pageSlug, pageprogress: { token, slug: [pageSlug] } },
  { useCache: ["page"] }
)
```

A subtle detail (Page.js:300-312): if the response doesn't contain an
exact-match key for `pageSlug`, the function strips the trailing segment
of the slug and re-fetches — letting nested slugs like `mosiah/chapter-1`
fall back to `mosiah` if needed. If the matched page has no `sections`,
it simulates a click on `.contents_link a` (i.e. routes to the contents
page).

When the response arrives (Page.js:318-324):

```js
pageController.functions.setPageSlugId({
  pageSlug,
  textId,                                 // undefined here
  lastLeaf: match.url.split("/").pop(),   // "<textId>" for this route
});
pageController.functions.setPageData(response.page[index]);
pageController.functions.setPageProgress(response.pageprogress);
```

The reducer (Page.js:907-918) only updates `initOpen.textId` if
`textId` is truthy — so for this route, `initOpen.textId` keeps the
value it got at component mount from `match.params.textId`. The
`lastLeaf` value matters for the `initPage` fallback path (step 5b) but
not for the primary text-row path.

### 3. Wait for "ready to scroll"

The page-init effect (Page.js:254-259) won't run until **all** of:

- `initStarted === false` (it hasn't already run; flipped back to
  `false` by the route-reset effect on any param change)
- `readyToScroll === true` (set by `loadPageComments` once page
  comments are loaded — or immediately if study mode is off)
- `document.querySelector(".content")` exists (rows are in the DOM)

`readyToScroll` is set by `loadPageComments` (Page.js:403-511). When
study mode is off / no active group / user logged out, it short-circuits
to `setReadyToScroll(true)` immediately. Otherwise, the chat-list load
is bounded by a **2.5 s `COMMENTS_FALLBACK_MS` fallback timer**
(Page.js:478-482) so the deep-link can't wedge on a slow chat service.

### 4. Dispatch to `initPageItem`

`handlePageInit` (Page.js:232-252) checks flags in order:

```js
if (pageController.states.initOpen.faxVersion)   return initPageFax(...);
if (pageController.states.initOpen.imageId)      return initPageImage(...);
if (pageController.states.initOpen.commentaryId) return initPageCommentary(...);
if (pageController.states.pageSlug && pageController.states.initOpen.textId)
  return initPageItem(pageController);
if (pageController.states.initOpen.pageSlug === pageController.pageData?.slug) {
  return initPage(pageController, pageController.states.initOpen.lastLeaf);
}
```

For `/<pageSlug>/<textId>`, the first three are unset; `pageSlug` and
`initOpen.textId` are both set, so it dispatches to
`initPageItem(pageController)` **with no callback** — that's the
differentiator from `initPageCommentary` and `initPageImage`, which
both pass a post-open callback.

### 5. Scroll, then expand the text row(s)

`initPageItem` (Page.js:594-639) is an `async` function that drives the
visual choreography sequentially. The pipeline is **signal-driven**, not
timer-paced — there is no `setTimeout(..., 1000)` stagger anymore.

1. `findTextToOpen(pageController)` (Page.js:664-690) walks the DOM to
   find the row whose element has `textid="<pageSlug>/<textId>"`. It
   also walks up to the closest `.row > [textid]` ancestor to find a
   **parent text slug** (for nested rows like quotations inside a
   containing block) and pushes both into the `textToOpen` array.

2. The raw `textToOpen` array is reordered via
   `orderByDomAncestry(rawTextToOpen)`
   (`frontend/webapp/src/utils/orderByDomAncestry.js`). This uses
   `compareDocumentPosition` so an ancestor row always sorts before its
   descendant, regardless of the order `findTextToOpen` produced. Net
   effect: a containing quotation block (if any) opens first, then the
   leaf text — so the leaf is visible when its parent expands.

3. The outer scroll: `await scrollToAsync(itemToScrollTo.offsetTop -
   offsetTop)`, where `offsetTop` is 20% of the viewport height (so the
   row lands roughly one-fifth from the top). `scrollToAsync`
   (Page.js:641-643) wraps the `scrollTo` helper at
   `models/Utils.js:387-425`. That helper calls
   `window.scrollTo({ top, behavior: "smooth" })` and resolves the
   callback when the browser fires the **`scrollend`** event — with a
   `SCROLL_FALLBACK_MS = 2000` `setTimeout` for browsers that don't yet
   support `scrollend` (older Safari). If `prefers-reduced-motion` is
   set the scroll runs in `instant` mode and resolves synchronously.

4. For **each** slug in the DOM-ancestry-ordered list, in order:
   - Look up `[textid='<slug>'] .reference a` (the verse-reference link
     that toggles the row open/closed).
   - **Skip if missing** (the row never rendered) and continue.
   - **Skip if `pageController.states.autoClicked.has(slug)`** —
     `autoClicked` is a `Set` on controller state (Page.js:94) that
     records which slugs the init pipeline has already dispatched to,
     so re-entry of the loop can't double-click the same row.
   - Otherwise, add the slug to `autoClicked`, scroll to the row's
     `.reference a` coordinates (`getCoords(el).top - offsetTop`) via
     another `await scrollToAsync(...)`, then call `el.click()`.
   - `await awaitDomOpen(slug, 2000)`
     (`frontend/webapp/src/utils/awaitDomOpen.js`). This returns a
     Promise that resolves when `[textid='<slug>'] .reference` gains
     the `open` class — driven by a `MutationObserver` watching the
     `class` attribute. A 2 s timeout backstops it so a row that
     refuses to open can't stall the rest of the chain.

5. After the loop, `markAsInitiated()` flips the controller into its
   "init complete" state. For this route there is no callback to fire
   after `markAsInitiated`.

Net effect: a single smooth outer scroll → per-row scroll/click → wait
for the DOM to confirm the row opened → next row → done. No magic-number
timers; all waits are on actual browser signals. Per-step
`setTimeout(..., 1000)` stagger is gone — the previous
"1-second-per-item loop" model no longer applies.

#### 5a. What the click does

The `<a>` inside `.reference` (TextContent.js:296-310) has
`href="/<slug>"` but its `onClick` calls
`toggleOpenClose` / `toggleOpenCloseHeader` (TextContent.js:25-67). The
reducer:

- Toggles the row's local `isOpen` / `isHeaderOpen` boolean.
- On open: calls
  `pageController.functions.setActiveRow({ slug, duration, pagetitle,
  heading, auto: pageController.states.autoClicked?.has(slug) === true })`
  (TextContent.js:33-40 and :51-57). The `auto` flag is critical — it
  is `true` only when the row's slug is currently in the
  `autoClicked` Set, i.e. when the click was synthesized by
  `initPageItem` rather than typed by a human.
- On close: calls `pageController.functions.removeOpenRow(slug)`.

#### 5b. `setActiveRow` side effects

`Page.js:738-817` — this is where most of the URL/state changes happen.
The reducer:

- Pushes `slug` onto `openRows`.
- Pauses any active audio, loads new audio for this slug, plays it if
  the `audio` preference is on.
- Updates `document.title` to `"<heading> | <home_title>"`.
- **Calls `appController.functions.setSlug(slug, { replace: auto === true })`
  (Page.js:753)** — pushes `/<pageSlug>/<textId>` into the router
  history, or `history.replace`s it instead when `auto === true`. The
  init pipeline thus rewrites the URL **without** adding history
  entries; user clicks push normally.
- Immediately after, **`pageController.states.autoClicked.delete(slug)`
  (Page.js:754)** — so any subsequent manual re-open of the same slug
  (e.g. user closes the row, then clicks it again) pushes normally
  instead of replacing.
- Writes the slug to `localStorage.studybookmark`.
- Fires an analytics/log API call.
- 900 ms × duration after the click, requests page-progress and
  user-progress from the API, updates the controller, and (if
  `summary.completed >= 100`) opens a `victory` popup as a side effect
  of reaching 100% completion.

The "victory" popup is the only deep-link-time UI surprise on this route
— it only fires when the user has just hit 100% completion, which is
rare.

### 6. Idle steady state

There is no step 6 — no popup, no panel. The row stays open, the user
scrolls/reads/listens. If they click another row, that row opens, the
URL updates via `setSlug` (pushing, because the new slug is *not* in
`autoClicked`), and `openRows` grows. Closing the row
(`removeOpenRow`, Page.js:821-841) reverts `setSlug` to either the
active section or the bare `pageSlug`.

## `findTextToOpen` corner cases

`Page.js:664-690` has three branches:

1. `initOpen.goToSection` set → returns the section element by id (no
   textToOpen, just scroll). This branch is used by section-jump links
   (e.g. table-of-contents clicks), not by `/<page>/<textId>` deep-links.
2. `initOpen.textId` falsy → returns `{textToOpen: [], itemToScrollTo:
   null}`. In `initPageItem`, the early-return at Page.js:599-604
   fires `markAsInitiated` (and any callback) immediately; the page is
   left at the top with no row opened. So for a bare `/<pageSlug>`
   route the flow falls through to `initPage` instead (handlePageInit's
   last branch).
3. Normal case → returns the row element and the parent+leaf textids.

If the `[textid="<slug>"]` element is missing — e.g. textId doesn't
exist on this page — `el` is `null`, `findAncestor(null, ".row")`
returns `null`, `itemToScrollTo` is `null`, and `initPageItem` hits the
same early return as case 2. The page is left in its initial scroll
position with no row opened. There is no error or user feedback today
(see F4 in the deep-link follow-ups plan for the planned inline alert).

## What changes in the URL bar

| Moment | URL |
| --- | --- |
| User hits `/<pageSlug>/<textId>` | as typed |
| After page data loads | unchanged |
| After auto-click of `.reference a` (`auto: true` → `setSlug(slug, { replace: true })`) | unchanged in URL bar (already there); `setSlug` is a no-op when the new slug matches the current one anyway, but the call goes through `history.replace` not `push` |
| User clicks a different row later (`auto: false` → push) | URL pushes to the new `/<pageSlug>/<newTextId>` |
| User closes row later | `setSlug(activeSection ?? pageSlug)` → URL drops the textId |

## What does NOT happen

- The route does **not** redirect anywhere first. The URL stays
  `/<pageSlug>/<textId>` from mount through render.
- `initPageItem` is called with **no callback** for this route — there
  is no popup or panel to open after the row expands. The commentary
  and image routes both pass callbacks; this one does not.
- The flow does **not** rely on a polling loop or fixed timer for row
  opens. `awaitDomOpen`'s `MutationObserver` is the only signal the
  pipeline waits on (with a 2 s timeout as a backstop).

### `autoClicked` lifecycle

The `autoClicked` Set on `pageController.states` tracks slugs added by
`initPageItem`'s auto-click loop. When `setActiveRow` reducer
(Page.js:738-817) fires for those slugs — triggered by the synthesized
`el.click()` flowing through `TextContent.js`'s `toggleOpenClose`
(which copies `auto:
pageController.states.autoClicked?.has(slug) === true` into the
payload) — it passes `{ replace: auto }` to `setSlug`, then
`pageController.states.autoClicked.delete(slug)` so any subsequent
manual re-open of the same slug pushes normally instead of replacing.
The route-reset effect (Page.js:201-211) calls
`resetAutoClicked()` (Page.js:920-922) on every route-param change, so
the Set never carries stale slugs across navigations.

## The `/study` shortcut

`Page.js:49-56` rewrites `/study` to the most recent bookmarked
`<pageSlug>/<textId>` from `localStorage.studybookmark` (or `lehites/1`
if no bookmark). The match params are mutated in place before
`prepareInitOpen` runs, so the rest of the flow is identical to a normal
text deep-link. The URL bar still reads `/study`, though — the route
doesn't push the rewritten slug.

## File map

| File | Lines | Role |
| --- | --- | --- |
| `frontend/webapp/src/models/Routes.js` | 263-274 | Route definitions (fax, page+text, page only) |
| `frontend/webapp/src/views/Page/Page.js` | 33-45 | `prepareInitOpen` — stashes route params into `initOpen` |
| `frontend/webapp/src/views/Page/Page.js` | 47-58 | Component entry + `/study` shortcut |
| `frontend/webapp/src/views/Page/Page.js` | 60-61 | `routeKey` / `pageIdentityKey` composite deps |
| `frontend/webapp/src/views/Page/Page.js` | 63-70 | Data-fetch effect (`getPageDataFromAPI` for this route) |
| `frontend/webapp/src/views/Page/Page.js` | 94-95 | `autoClicked` Set + `notFound` initial state |
| `frontend/webapp/src/views/Page/Page.js` | 201-211 | Route-reset effect — clears init flags, `autoClicked`, `notFound`, `imageActivationRequest` |
| `frontend/webapp/src/views/Page/Page.js` | 232-252 | `handlePageInit` — dispatches to `initPageItem` once ready |
| `frontend/webapp/src/views/Page/Page.js` | 281-328 | `getPageDataFromAPI` — page data fetch + slug-fallback retry |
| `frontend/webapp/src/views/Page/Page.js` | 572-592 | `initPage` — fallback path when only `pageSlug` is set, scrolls to last leaf if any |
| `frontend/webapp/src/views/Page/Page.js` | 594-639 | `initPageItem` — async sequential scroll/click/await per row |
| `frontend/webapp/src/views/Page/Page.js` | 641-643 | `scrollToAsync` Promise wrapper around `scrollTo` |
| `frontend/webapp/src/views/Page/Page.js` | 664-690 | `findTextToOpen` — locates the target row and any parent |
| `frontend/webapp/src/views/Page/Page.js` | 738-817 | `setActiveRow` reducer — `setSlug(slug, { replace: auto === true })`, `autoClicked.delete(slug)`, audio, progress logging |
| `frontend/webapp/src/views/Page/Page.js` | 821-841 | `removeOpenRow` reducer — restores URL to active section / bare slug |
| `frontend/webapp/src/views/Page/Page.js` | 907-922 | `setPageSlugId` + `resetAutoClicked` reducers |
| `frontend/webapp/src/views/Page/TextContent.js` | 25-67 | Row local reducer — `toggleOpenClose` / `toggleOpenCloseHeader` copy the `auto` flag from `autoClicked.has(slug)` into the `setActiveRow` payload |
| `frontend/webapp/src/views/Page/TextContent.js` | 296-310 | Row reference link rendering (`.reference a`) |
| `frontend/webapp/src/utils/orderByDomAncestry.js` | 1-19 | Sort slugs by DOM ancestry so ancestor rows open before descendants |
| `frontend/webapp/src/utils/awaitDomOpen.js` | 1-25 | `MutationObserver`-backed wait for a row's `.reference` to gain `open` |
| `frontend/webapp/src/utils/deepLinkInstrument.js` | 1-17 | Opt-in event recorder (`window.__deepLinkInstrument`) used by init pipeline |
| `frontend/webapp/src/models/appController.js` | 231-240 | `setSlug` — push by default, `history.replace` when `{replace: true}` is passed |
| `frontend/webapp/src/models/Utils.js` | 387-425 | `scrollTo` — `scrollend`-event-driven, 2 s fallback for older browsers |
