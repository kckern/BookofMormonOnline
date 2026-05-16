# `/commentary/<commentaryId>` route

Deep-link route that opens a single commentary entry in its original scriptural
context. Confirmed behavior end-to-end: the app loads the underlying page,
scrolls to the verse/text the commentary is anchored to, expands the text row,
and then opens the commentary in a popup window (desktop) or drawer (mobile).

This page documents the exact mechanics: which files, which API calls, in
which order, and what happens at each step.

## Route definition

`frontend/webapp/src/models/Routes.js:250`

```js
{
  path: "/commentary/:commentaryId(\\d+)",
  component: Page,
}
```

- `commentaryId` is constrained to digits (`\d+`). Non-numeric values won't
  match this route — they'll fall through to `/:pageSlug+` and try to load a
  page slug named after the input.
- The matched component is `Page` (the same component that renders normal
  scripture pages). All commentary-deep-link behavior is implemented inside
  `Page.js` and the popup components.

## Entry points that produce this URL

Three places in the codebase navigate to `/commentary/<id>`:

| Source | File | What it does |
| --- | --- | --- |
| Study feed cards | `views/_Common/Study/StudyInFeed.js:121,128,145` | `<Link to="/commentary/<id>">` on commentary cards in feed views — full route push, runs the flow below from scratch. |
| Chat URL preview | `models/Utils.js` (`CommentaryPreview`) | A URL pasted into chat that matches `/commentary/\d+$` is rendered as a `CommentaryPreview` card. Clicking the card calls `setPopUp({ type: "commentary", ids: [id], underSlug: <current URL> })` **directly**, without changing the route — so the underlying page does *not* change. Closing the popup returns to the previous URL via `underSlug`. |
| Direct navigation | external link, address bar, shared URL | Hits the React Router route and runs the full flow. |

The "full flow" documented below applies to entry points 1 and 3. Entry
point 2 (chat preview click) skips straight to the popup with the data
already in hand.

## Full flow (direct navigation / Link from feed)

### 1. Route mounts → `Page` component initializes

`frontend/webapp/src/views/Page/Page.js`

`match.params` only contains `commentaryId`. `match.params.pageSlug` and
`match.params.textId` are **undefined** at this stage — the route has no slug.

`prepareInitOpen(match.params)` (Page.js:33-45) builds:

```js
initOpen = { pageSlug: undefined, commentaryId: "<id>" }
```

This is stored on the page-controller state as `initOpen`. The page is then
considered "loading" and the controller's `pageData` is `null`. The
controller also seeds `autoClicked: new Set()` and `notFound: null` for this
mount (Page.js:94-95).

Two composite keys drive the effects that follow:

- `pageIdentityKey = pageSlug | commentaryId | imageId` (Page.js:61) — gates
  the data-fetch effect, so navigating within the same `/commentary/<id>`
  doesn't refire the GraphQL load.
- `routeKey = pageSlug | textId | commentaryId | imageId | faxVersion`
  (Page.js:60) — gates the route-reset effect, which clears `initStarted`,
  `readyToScroll`, `autoClicked`, `notFound`, and any pending
  `imageActivationRequest` before re-running `handlePageInit`
  (Page.js:201-211).

### 2. Resolve commentary → page slug + text id

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

`getPageDataFromAPIViaNote` (Page.js:331-361) issues a GraphQL query for the
commentary inside a `try/catch`:

```js
let response = await BoMOnlineAPI({ commentary: params.commentaryId });
let commentary = response?.commentary?.[params.commentaryId];
if (!commentary?.location?.slug) {
  pageController.functions.setNotFound({ type: "commentary", id: params.commentaryId });
  return;
}
pageSlug = commentary.location.slug.replace(/\/\d+$/, "");
textId   = commentary.location.slug.match(/\d+$/)?.[0];
```

The commentary record's `location` is a `BomText` row (see
`src/resolvers/BomNotes.ts:19-37` — the resolver eagerly joins
`BomText` as `location` with `parent_page`, `parent_section`, and
`narration`). `location.slug` looks like `<pageSlug>/<textId>`, e.g.
`lehi-leaves-jerusalem/4231`. The frontend splits that into the two halves.

Then `getPageDataFromAPI(pageSlug, textId)` is called.

If the commentary is missing (`response.commentary[id]` empty or
`location.slug` null) or the fetch throws, `setNotFound({type:"commentary",
id})` is dispatched and the render branch switches to `<PageNotFound />` —
see the "Edge case: not found" section below.

### 3. Load the page data

`getPageDataFromAPI` (Page.js:281-328) queries:

```js
BoMOnlineAPI(
  { page: pageSlug, pageprogress: { token, slug: [pageSlug] } },
  { useCache: ["page"] }
)
```

When it returns, it dispatches:

```js
pageController.functions.setPageSlugId({
  pageSlug,
  textId,
  lastLeaf: match.url.split("/").pop(),  // "<commentaryId>" for this route
});
pageController.functions.setPageData(response.page[index]);
pageController.functions.setPageProgress(response.pageprogress);
```

The `setPageSlugId` reducer folds `textId` and `pageSlug` back into
`initOpen` so the subsequent init logic can use them — they weren't in the
URL params, but they exist on `initOpen` now.

`setPageData` triggers the React render of the page sections and rows.

### 4. Wait for "ready to scroll"

The page-init effect (Page.js:254-259) won't run until **all** of:

- `initStarted === false` (it hasn't already run)
- `readyToScroll === true`
- `document.querySelector(".content")` exists (rows are in the DOM)

`readyToScroll` is set by `loadPageComments` (Page.js:403-511). If the user
is logged in **and** in study mode **and** an active study group is
selected, the page comments must finish loading first (it subscribes to
socket events, fetches existing comments, and only then calls
`setReadyToScroll(true)`). Otherwise it short-circuits to
`setReadyToScroll(true)` immediately.

To prevent that pipeline from hanging the deep-link forever, the chat-list
load is bounded by a **2.5 s `COMMENTS_FALLBACK_MS` fallback timer**
(Page.js:478-482):

```js
const COMMENTS_FALLBACK_MS = 2500;
const fallbackTimer = setTimeout(() => {
  recordDeepLinkEvent("loadPageComments:fallback");
  setReadyToScroll(true);
}, COMMENTS_FALLBACK_MS);
```

If `listQuery.load()` resolves first the timer is cleared. Either way,
`readyToScroll` is guaranteed to flip true within ~2.5 s of the page data
arriving, so the commentary deep-link can never wedge on a slow chat
service.

### 5. Dispatch to `initPageCommentary`

`handlePageInit` (Page.js:232-252) routes by `initOpen` flags. With
`commentaryId` set, it dispatches to:

```js
function initPageCommentary(pageController) {
  initPageItem(pageController, () =>
    pageController.appController.functions.setPopUp({
      type: "commentary",
      ids: [pageController.states.initOpen.commentaryId],
    }),
  );
}
```

(Page.js:652-658.) So the open-popup call is supplied as the **callback**
to `initPageItem` — it only fires after the scroll-and-expand has
completed.

### 6. Scroll, then expand the text row(s)

`initPageItem` (Page.js:594-639) is an `async` function that drives the
visual choreography sequentially. The pipeline is **signal-driven**, not
timer-paced — there is no `setTimeout(..., 1000)` stagger anymore.

1. `findTextToOpen(pageController)` (Page.js:664-690) walks the DOM to find
   the row whose element has `textid="<pageSlug>/<textId>"`. It also walks
   up to the closest `.row > [textid]` ancestor to find a **parent text
   slug** (if the target text is nested inside a parent text, e.g. a
   subordinate row inside a quotation block) and pushes both into the
   `textToOpen` array.

2. The raw `textToOpen` array is reordered via
   `orderByDomAncestry(rawTextToOpen)`
   (`frontend/webapp/src/utils/orderByDomAncestry.js`). This uses
   `compareDocumentPosition` so an ancestor row always sorts before its
   descendant, regardless of the order `findTextToOpen` produced. Net
   effect for commentaries: a containing quotation block (if any) opens
   first, then the leaf text — so the leaf is visible when its parent
   expands.

3. The outer scroll: `await scrollToAsync(itemToScrollTo.offsetTop -
   offsetTop)`, where `offsetTop` is 20% of the viewport height (so the
   row lands roughly one-fifth from the top). `scrollToAsync` wraps the
   `scrollTo` helper at `models/Utils.js:387-425`. That helper calls
   `window.scrollTo({ top, behavior: "smooth" })` and resolves the
   callback when the browser fires the **`scrollend`** event — with a
   `SCROLL_FALLBACK_MS = 2000` `setTimeout` for browsers that don't yet
   support `scrollend` (older Safari). If `prefers-reduced-motion` is set
   the scroll runs in `instant` mode and resolves synchronously.

4. For **each** slug in the DOM-ancestry-ordered list, in order:
   - Look up `[textid='<slug>'] .reference a` (the verse-reference link
     that toggles the row open/closed).
   - **Skip if missing** (the row never rendered) and continue to the
     next slug.
   - **Skip if `pageController.states.autoClicked.has(slug)`** —
     `autoClicked` is a `Set` on controller state (Page.js:94) that
     records which slugs the init pipeline has already dispatched to,
     so re-entry of the loop can't double-click the same row.
   - Otherwise, add the slug to `autoClicked`, scroll to the row's
     `.reference a` coordinates (`getCoords(el).top - offsetTop`) via
     another `await scrollToAsync(...)`, then call `el.click()`.
   - `await awaitDomOpen(slug, 2000)`
     (`frontend/webapp/src/utils/awaitDomOpen.js`). This returns a
     Promise that resolves when `[textid='<slug>'] .reference` gains the
     `open` class — driven by a `MutationObserver` watching `class`
     attribute mutations. A 2 s timeout backstops it so a row that
     refuses to open can't stall the rest of the chain.

5. After the loop, `markAsInitiated()` flips the controller into its
   "init complete" state, and the supplied callback (the one from
   `initPageCommentary`) fires — opening the popup.

Net effect: a single smooth outer scroll → per-row scroll/click → wait for
the DOM to confirm the row opened → next row → popup. No magic-number
timers; all waits are on actual browser signals.

The auto-click side-effect on URL bar: when `el.click()` fires the row's
toggle handler, `setActiveRow` is dispatched with `auto: true` (because the
slug was just added to `autoClicked`, so `autoClicked?.has(slug)` is true).
The reducer at Page.js:738-755 then calls `setSlug(slug, { replace: true })`
and deletes the slug from `autoClicked`. The auto-click thus
`history.replace`s the URL into the row, rather than pushing a new history
entry. See the URL-bar section below.

### 7. Open the commentary popup

The callback runs `appController.functions.setPopUp(...)`. The reducer
(`models/appController.js:263-290`) does:

- If the popup wasn't already open, captures `underSlug` from the current
  app slug. (This is what closing the popup will restore.)
- Sets `popUp.open = true`, `popUp.type = "commentary"`,
  `popUp.ids = [<commentaryId>]`, `popUp.activeId = <commentaryId>`.
- Sets `popUp.top = window.scrollY + window.innerHeight * 0.20` so the
  popup is positioned near the user's current scroll position, just below
  the row that was opened. (The `0.20` is the default — callers can
  override via `vhtop` on the `setPopUp` input, which the reducer expands
  as `window.innerHeight / (100 / (input.val.vhtop || 20))`, but
  `initPageCommentary` doesn't pass it.)
- **Marks `popUp.loading = true`** because no `popUpData` was passed in.
- Calls `setSlug("commentary/<id>")` **without** the `{replace: true}`
  flag — so this is a `history.push`, not a replace. The URL bar moves
  back to `/commentary/<id>`. (See the URL-bar table below for how this
  composes with the prior auto-click replace.)
- Updates the document title via `setPopDocTitle`.

### 8. PopUp component decides which renderer

`views/_Common/PopUp.js`:

- `if (isMobile()) return <MobileDrawer ... />` — mobile uses a drawer
  variant; the same `popUp.type === "commentary"` branch applies but the
  layout is a bottom drawer rather than a draggable card.
- Otherwise `popUp.type === "commentary"` renders `<Commentary />`.

### 9. `Commentary` fetches data if it doesn't already have it

`views/_Common/Commentary.js`. With `popUp.loading === true` and no
`appController.popUpData`, it fires:

```js
BoMOnlineAPI({ commentary: appController.states.popUp.ids })
  .then(response => {
    appController.functions.setPopUp({
      type: "commentary",
      ids: Object.keys(response.commentary),
      popUpData: response.commentary,
    });
  });
```

This is a **second** fetch of the same commentary record (the first was in
step 2). For the direct-navigation flow documented here, this fetch always
runs — `setPopUp` was called without `popUpData`, so `popUp.loading ===
true` is guaranteed and `Commentary` fires the request. (When entered via
the chat-preview path, `popUpData` is supplied and this fetch is skipped.)
`BoMOnlineAPI` has no in-flight request coalescing — the two requests are
not deduplicated at the call site, so expect two network requests on the
direct-navigation flow. While the second fetch is in flight, the popup
shows `<Loading type="Commentary" />`.

### 10. Render

Once the data is in place, `Commentary` renders a draggable card
containing:

- **Header** — `commentary_on_x` label populated with `reference`, plus a
  tab strip if multiple commentaries are in `ids` (Tab/ArrowRight/ArrowLeft
  cycle between them), and a close `×`.
- **Source cover image** — `${assetUrl}/source/cover/<source_id>`, links to
  the publication's external URL.
- **Source caption** — title, author/name, publisher, copyright year, and
  a "legal notice" toggle that lazy-fetches markdown via the
  `markdown: "access_notice"` + `sourceUsage` query.
- **Body text** — the commentary's `text` (HTML) is parsed with
  `detectScriptures` (auto-linking scripture references) and rendered with
  `html-react-parser`. Selecting text in the body adds it to a local
  highlight list. Any `.source` block inside the HTML is hoisted into an
  `ATVHeader` above the body.
- **Inline scripture mini-panel** — `ScripturePanelSingle` opens when the
  user clicks a scripture link inside the commentary text.
- **Comments thread** — `<Comments linkData={{ com: <id> }} ... />`
  attaches the studygroup chat scoped to this commentary id.

## Timing model

Total deterministic latency from page-ready to popup is now dominated by
actual scroll completion plus a single `MutationObserver` wait per row. On a
fast desktop with a 1000 px scroll distance, a non-nested commentary
deep-link completes in roughly 400-800 ms (one outer scroll, one row open).
A nested commentary deep-link (parent + leaf) takes roughly 800-1400 ms
(two scrolls, two row opens). Per-step `setTimeout(..., 1000)` stagger is
gone — the previous "4 + N seconds" model no longer applies.

## What changes in the URL bar

| Moment | URL |
| --- | --- |
| User hits `/commentary/<id>` | `/commentary/<id>` |
| Page data loads, init begins | unchanged |
| Auto-click of `.reference a` fires `setActiveRow({...auto: true})` → `setSlug(slug, { replace: true })` | URL replaces in place (no new history entry) — `/<pageSlug>/<textId>` |
| Each subsequent auto-click of a nested row | URL keeps replacing — only the last replaced entry remains, e.g. the leaf `/<pageSlug>/<leafTextId>` |
| `setPopUp` fires `setSlug("commentary/<id>")` (no `replace` flag, so it's a push) | URL pushes back to `/commentary/<id>` — net 2 history entries after init: `[/<row>, /commentary/<id>]` |
| Back button once | Lands on `/<row>` (single back-stop) — the row stays open, popup closes |
| Back button twice | Escapes to the page that preceded the `/commentary/<id>` navigation |
| User closes popup via × | `closePopUp` runs `setSlug(underSlug)`. For a cold direct-navigation load `underSlug` is the slug captured at `setPopUp` time (the auto-clicked row slug), so the URL returns to `/<pageSlug>/<textId>`. |

The two-entry history trail is intentional: it lets a single back-button
press land the user on the row that the popup was anchored to (so they can
keep reading the surrounding scripture), rather than skipping that context
on the way to the previous page.

## What does NOT happen

- The route does **not** redirect to `/<pageSlug>/<textId>` first and then
  open the popup. The user-visible URL during init is the auto-click
  replace target (`/<pageSlug>/<textId>`) and then the popup push
  (`/commentary/<id>`) — there is no separate scripted redirect.
- `findTextToOpen` does **not** rely on `match.params.textId` — for this
  route there is none. It uses `initOpen.textId`, which was populated by
  `setPageSlugId` after the commentary record was fetched in step 2.
- The page's normal "open the row when you visit `/<pageSlug>/<textId>`"
  path (`initPageItem` called directly) is reused; the only addition for
  commentaries is the callback that fires `setPopUp` after the row opens.
- The flow does **not** rely on a polling loop or fixed timer for row
  opens. `awaitDomOpen`'s `MutationObserver` is the only signal the
  pipeline waits on (with a 2 s timeout as a backstop).

## Edge case: not found

If `BoMOnlineAPI({commentary: id})` returns empty data (sandbox mode,
invalid id, permissions) or rejects with a network error,
`getPageDataFromAPIViaNote` (Page.js:331-361) catches the failure mode and
dispatches `setNotFound({type: "commentary", id})`. The render branch at
Page.js:514-516 short-circuits to `<PageNotFound />` (in
`frontend/webapp/src/views/Page/PageNotFound.js`) instead of looping on a
`<Loader />`. The route-change effect at Page.js:201-211 clears
`notFound` (alongside `autoClicked`, `imageActivationRequest`, and the init
flags) on any subsequent navigation, so the user can recover by clicking
another link without a hard reload.

## Backend support

`src/resolvers/BomNotes.ts:19-37` — `commentary(id: [String])` returns:

```graphql
type Commentary {
  id
  slug
  title
  reference
  publication { source_title, source_rating, source_name, source_short,
                source_slug, source_id, source_url, source_year,
                source_publisher }
  location {           # BomText with parent_page, parent_section, narration
    slug               # "<pageSlug>/<textId>" — this is the anchor used
  }                    # to find the row on the page.
  text                 # HTML body
}
```

The `location.slug` is the load-bearing field for this whole flow — if it
is null or missing, the frontend short-circuits to `setNotFound` rather
than calling `getPageDataFromAPI(undefined, undefined)`.

## File map

| File | Lines | Role |
| --- | --- | --- |
| `frontend/webapp/src/models/Routes.js` | 249-252 | Route definition |
| `frontend/webapp/src/views/Page/Page.js` | 33-45 | `prepareInitOpen` — stashes `commentaryId` into `initOpen` |
| `frontend/webapp/src/views/Page/Page.js` | 60-61 | `routeKey` / `pageIdentityKey` composite deps |
| `frontend/webapp/src/views/Page/Page.js` | 63-70 | Data-fetch effect routes commentary loads to `getPageDataFromAPIViaNote` |
| `frontend/webapp/src/views/Page/Page.js` | 94-95 | `autoClicked` Set + `notFound` initial state |
| `frontend/webapp/src/views/Page/Page.js` | 201-211 | Route-reset effect — clears init flags, `autoClicked`, `notFound`, `imageActivationRequest` |
| `frontend/webapp/src/views/Page/Page.js` | 232-252 | `handlePageInit` — dispatches to `initPageCommentary` once ready |
| `frontend/webapp/src/views/Page/Page.js` | 281-328 | `getPageDataFromAPI` — fetches page + progress |
| `frontend/webapp/src/views/Page/Page.js` | 331-361 | `getPageDataFromAPIViaNote` — commentary → pageSlug + textId, with `setNotFound` on miss + try/catch |
| `frontend/webapp/src/views/Page/Page.js` | 478-482 | `COMMENTS_FALLBACK_MS` (2.5 s) backstop for the chat-list wait |
| `frontend/webapp/src/views/Page/Page.js` | 514-516 | Render branch that short-circuits to `<PageNotFound />` |
| `frontend/webapp/src/views/Page/Page.js` | 594-639 | `initPageItem` — async sequential scroll/click/await per row |
| `frontend/webapp/src/views/Page/Page.js` | 641-643 | `scrollToAsync` Promise wrapper around `scrollTo` |
| `frontend/webapp/src/views/Page/Page.js` | 652-658 | `initPageCommentary` — one-line wrapper passing the popup callback to `initPageItem` |
| `frontend/webapp/src/views/Page/Page.js` | 664-690 | `findTextToOpen` — locates target row and its parent |
| `frontend/webapp/src/views/Page/Page.js` | 738-755 | `setActiveRow` reducer — `setSlug(..., {replace: auto === true})` and `autoClicked.delete(slug)` |
| `frontend/webapp/src/views/Page/PageNotFound.js` | 1-19 | Not-found UI shown when `notFound` is set |
| `frontend/webapp/src/utils/orderByDomAncestry.js` | 1-19 | Sort slugs by DOM ancestry so ancestor rows open before descendants |
| `frontend/webapp/src/utils/awaitDomOpen.js` | 1-25 | `MutationObserver`-backed wait for a row's `.reference` to gain `open` |
| `frontend/webapp/src/utils/deepLinkInstrument.js` | 1-17 | Opt-in event recorder (`window.__deepLinkInstrument`) used by init pipeline |
| `frontend/webapp/src/models/Utils.js` | 387-425 | `scrollTo` — `scrollend`-event-driven, 2 s fallback for older browsers |
| `frontend/webapp/src/models/appController.js` | 231-240 | `setSlug` — push by default, `history.replace` when `{replace: true}` opts passed |
| `frontend/webapp/src/models/appController.js` | 263-290 | `setPopUp` reducer — opens the popup, pushes `/commentary/<id>` |
| `frontend/webapp/src/views/_Common/PopUp.js` | — | `<PopUp>` — routes to `<Commentary>` (or `<MobileDrawer>`) |
| `frontend/webapp/src/views/_Common/Commentary.js` | — | Lazy-fetches commentary data when popup loads and renders the card UI |
| `frontend/webapp/src/models/GraphQLQueries.js` | — | `commentary` query builder |
| `src/resolvers/BomNotes.ts` | 19-37 | `commentary` GraphQL resolver |
| `frontend/webapp/src/models/Utils.js` | — | `CommentaryPreview` — chat-link card that opens the popup without changing the route |
| `frontend/webapp/src/views/_Common/Study/StudyInFeed.js` | 121, 128, 145 | Feed cards that link to `/commentary/<id>` |
