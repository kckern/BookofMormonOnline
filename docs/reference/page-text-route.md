# `/<pageSlug>/<textId>` route

Canonical scripture-text deep-link. Opens the page identified by
`pageSlug`, scrolls to the text row identified by `textId`, and expands
that row. This is the most common deep-link in the app — it's the URL
generated whenever a user opens a row, and it's the target of nearly every
internal scripture-text link.

No popup, no panel activation, no auxiliary state. Just *page → scroll →
expand*.

## Route definition

`frontend/webapp/src/models/Routes.js:264-275` — the page+text route is
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
| Reference link inside each row | `views/Page/TextContent.js:295-296` | Each row's `<a className="reference" href="/<slug>">` produces this URL on hover/Ctrl-click. `onClick` calls `preventDefault()` and `toggleOpenClose` instead of navigating — so a normal click *doesn't* navigate but the URL is still the link target. |
| `setActiveRow` reducer | `views/Page/Page.js:704` | When any row is expanded (whether by user click or by `initPageItem`'s auto-click), `setSlug(slug)` is called, pushing `/<pageSlug>/<textId>` into history. |
| `localStorage.studybookmark` | `views/Page/Page.js:706` | The same `setActiveRow` writes the slug to `localStorage` so `/study` reopens to the same row. |
| External links / address bar | — | Anyone sharing a scripture position uses this URL. |

This is the route the app **gravitates toward** — opening any row
rewrites the URL to this shape, even if the user came in via
`/commentary/<id>` or `/image/<id>`. (The popup/panel flows then
re-rewrite on top of it.)

## Full flow

### 1. Route mounts → `Page` component initializes

`frontend/webapp/src/views/Page/Page.js:29-54`

`match.params` contains `pageSlug` and `textId` (both set from the URL).

`prepareInitOpen` builds:

```js
initOpen = { pageSlug: "<slug>", textId: "<id>" }
```

There is also a special case at line 45-52: if `match.params.pageSlug ===
"study"`, the slug is replaced with the most-recent slug from
`localStorage.studybookmark` (falling back to `lehites/1`). This is what
makes `/study` resume where the user left off.

### 2. Load page data (no commentary/image indirection)

`Page.js:60-63`:

```js
if (match.params.imageId || match.params.commentaryId)
  getPageDataFromAPIViaNote(match.params);
else getPageDataFromAPI(match.params.pageSlug);
```

Neither flag is set, so `getPageDataFromAPI(pageSlug)` runs directly
(textId is *not* passed as the second argument). The function then runs
its standard query:

```js
BoMOnlineAPI(
  { page: pageSlug, pageprogress: { token, slug: [pageSlug] } },
  { useCache: ["page"] }
)
```

A subtle detail (Page.js:281-292): if the response doesn't contain an
exact-match key for `pageSlug`, the function strips the trailing segment
of the slug and re-fetches — letting nested slugs like `mosiah/chapter-1`
fall back to `mosiah` if needed. If the matched page has no `sections`,
it simulates a click on `.contents_link a` (i.e. routes to the contents
page).

When the response arrives:

```js
pageController.functions.setPageSlugId({
  pageSlug,
  textId,                                 // undefined here
  lastLeaf: match.url.split("/").pop(),   // "<textId>" for this route
});
pageController.functions.setPageData(response.page[index]);
pageController.functions.setPageProgress(response.pageprogress);
```

The reducer (Page.js:855-866) only updates `initOpen.textId` if `textId`
is truthy — so for this route, `initOpen.textId` keeps the value it got
at component mount from `match.params.textId`. The `lastLeaf` value
matters for the `initPage` fallback path (step 5b) but not for the
primary text-row path.

### 3. Wait for "ready to scroll"

Same gate as the other deep-link routes — `handlePageInit` (Page.js:213-240)
waits on:

- `initStarted === false`
- `readyToScroll === true` (set by `loadPageComments` once page comments
  are loaded — or immediately if study mode is off)
- `document.querySelector(".content")` exists

### 4. Dispatch to `initPageItem`

`handlePageInit` checks flags in order:

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
`initOpen.textId` are both set, so it dispatches to `initPageItem(pageController)`
**with no callback** — that's the differentiator from `initPageCommentary`.

### 5. Scroll, then expand the text row(s)

`initPageItem` (Page.js:567-597) — same routine as documented for the
commentary and image routes:

1. `findTextToOpen` (Page.js:615-641) finds the row whose element has
   `textid="<pageSlug>/<textId>"`. It walks up to the closest `.row > [textid]`
   ancestor to find a parent text slug (for nested rows like quotations
   inside a containing block). If the parent slug differs from the leaf
   slug, both are queued in `textToOpen`.
2. `scrollTo(distance, callback)` (Utils.js:386-401): waits 1 second, then
   does a smooth `window.scrollTo` to row top minus 20% viewport, then
   waits another 1 second before invoking the callback.
3. For each entry in `textToOpen` (sorted, so parents come first by
   numeric slug), `setTimeout` staggered 1000 ms apart:
   - `[textid='<slug>'] .reference a` lookup.
   - Skip if missing or already tagged `autoclicked`.
   - Tag with `autoclicked="true"`, scroll the link into view, fire
     `.click()`.
4. After all clicks: `setTimeout(markAsInitiated, time)` and (for routes
   with a callback) the route-specific callback.

#### 5a. What the click does

The `<a>` inside `.reference` (TextContent.js:294-302) has `href="/<slug>"`
but its `onClick` (TextContent.js:194-197) calls `e.preventDefault()` and
dispatches `toggleOpenClose`. The reducer (TextContent.js:27-43):

- Toggles the row's local `isOpen` boolean.
- On open: calls `pageController.functions.setActiveRow({slug, duration, pagetitle, heading})`.
- On close: calls `pageController.functions.removeOpenRow(slug)`.

#### 5b. `setActiveRow` side effects

`Page.js:689-765` — this is where most of the URL/state changes happen.
For a deep-link to `/<pageSlug>/<textId>`, the auto-click hits this code
path, which:

- Pushes `slug` onto `openRows`.
- Pauses any active audio, loads new audio for this slug, plays it if
  the `audio` preference is on.
- Updates `document.title` to `"<heading> | <home_title>"`.
- **Calls `appController.functions.setSlug(slug)` (Page.js:704)** — pushes
  `/<pageSlug>/<textId>` into the router history. (No-op if the URL is
  already there.)
- Writes the slug to `localStorage.studybookmark`.
- Fires an analytics/log API call.
- 900 ms × duration after the click, requests page-progress and user-progress
  from the API, updates the controller, and (if `summary.completed >= 100`)
  opens a `victory` popup as a side effect of reaching 100% completion.

The "victory" popup is the only deep-link-time UI surprise on this route
— it only fires when the user has just hit 100% completion, which is rare.

### 6. Idle steady state

There is no step 6 — no popup, no panel. The row stays open, the user
scrolls/reads/listens. If they click another row, that row opens, the
URL updates via `setSlug`, and `openRows` grows. Closing the row
(`removeOpenRow`, Page.js:769-) reverts `setSlug` to either the active
section or the bare `pageSlug`.

## `findTextToOpen` corner cases

`Page.js:615-641` has three branches:

1. `initOpen.goToSection` set → returns the section element by id (no
   textToOpen, just scroll). This branch is used by section-jump links
   (e.g. table-of-contents clicks), not by `/<page>/<textId>` deep-links.
2. `initOpen.textId` falsy → returns `{textToOpen: [], itemToScrollTo: null}`.
   In `initPageItem`, the `scrollTo(distance, ...)` then sees a negative or
   NaN distance and `scrollTo` (Utils.js:387-390) early-returns; the
   callback (if supplied) still fires. So for a bare `/<pageSlug>` route
   the flow falls through to `initPage` instead (handlePageInit's last
   branch).
3. Normal case → returns the row element and the parent+leaf textids.

If the `[textid="<slug>"]` element is missing — e.g. textId doesn't
exist on this page — `el` is `null`, `findAncestor(null, ".row")` returns
`null`, `itemToScrollTo` is `null`, `scrollTo(undefined, ...)` early-returns,
and `setTimeout(markAsInitiated, 0)` fires. The page is left in its initial
scroll position with no row opened. There is no error or user feedback.

## What changes in the URL bar

| Moment | URL |
| --- | --- |
| User hits `/<pageSlug>/<textId>` | as typed |
| After page data loads | unchanged |
| After auto-click of `.reference a` | unchanged in URL bar (already there); `setSlug` is a no-op when slug matches |
| User closes row later | `setSlug(activeSection ?? pageSlug)` → URL drops the textId |

## The `/study` shortcut

`Page.js:45-52` rewrites `/study` to the most recent bookmarked
`<pageSlug>/<textId>` from `localStorage.studybookmark` (or `lehites/1`
if no bookmark). The match params are mutated in place before
`prepareInitOpen` runs, so the rest of the flow is identical to a normal
text deep-link. The URL bar still reads `/study`, though — the route
doesn't push the rewritten slug.

## File map

| File | Lines | Role |
| --- | --- | --- |
| `frontend/webapp/src/models/Routes.js` | 264-275 | Route definitions (fax, page+text, page only) |
| `frontend/webapp/src/views/Page/Page.js` | 29-54 | `prepareInitOpen` + `/study` shortcut |
| `frontend/webapp/src/views/Page/Page.js` | 60-63 | useEffect dispatches to `getPageDataFromAPI` for this route |
| `frontend/webapp/src/views/Page/Page.js` | 262-309 | `getPageDataFromAPI` — page data fetch + slug-fallback retry |
| `frontend/webapp/src/views/Page/Page.js` | 213-240 | `handlePageInit` — dispatches to `initPageItem` |
| `frontend/webapp/src/views/Page/Page.js` | 567-597 | `initPageItem` — scroll-and-expand routine |
| `frontend/webapp/src/views/Page/Page.js` | 615-641 | `findTextToOpen` — locates the target row |
| `frontend/webapp/src/views/Page/Page.js` | 689-765 | `setActiveRow` reducer — `setSlug`, audio start, progress logging |
| `frontend/webapp/src/views/Page/Page.js` | 533-554 | `initPage` — fallback path when only `pageSlug` is set, scrolls to last leaf if any |
| `frontend/webapp/src/views/Page/TextContent.js` | 25-65 | Row local reducer — `toggleOpenClose` swallows the `<a>` click |
| `frontend/webapp/src/views/Page/TextContent.js` | 294-310 | Row reference link rendering |
| `frontend/webapp/src/models/appController.js` | 225-232 | `setSlug` — pushes the row's URL into history |
| `frontend/webapp/src/models/Utils.js` | 386-401 | `scrollTo` — 1-second-delayed smooth scroll with callback |
