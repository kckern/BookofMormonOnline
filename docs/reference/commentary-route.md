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
| Chat URL preview | `models/Utils.js:748` (`CommentaryPreview`) | A URL pasted into chat that matches `/commentary/\d+$` is rendered as a `CommentaryPreview` card. Clicking the card calls `setPopUp({ type: "commentary", ids: [id], underSlug: <current URL> })` **directly**, without changing the route — so the underlying page does *not* change. Closing the popup returns to the previous URL via `underSlug`. |
| Direct navigation | external link, address bar, shared URL | Hits the React Router route and runs the full flow. |

The "full flow" documented below applies to entry points 1 and 3. Entry
point 2 (chat preview click) skips straight to the popup with the data
already in hand.

## Full flow (direct navigation / Link from feed)

### 1. Route mounts → `Page` component initializes

`frontend/webapp/src/views/Page/Page.js`

`match.params` only contains `commentaryId`. `match.params.pageSlug` and
`match.params.textId` are **undefined** at this stage — the route has no slug.

`prepareInitOpen(match.params)` (Page.js:29) builds:

```js
initOpen = { pageSlug: undefined, commentaryId: "<id>" }
```

This is stored on the page-controller state as `initOpen`. The page is then
considered "loading" and the controller's `pageData` is `null`.

### 2. Resolve commentary → page slug + text id

`Page.js:60-62`:

```js
if (match.params.imageId || match.params.commentaryId)
  getPageDataFromAPIViaNote(match.params);
else getPageDataFromAPI(match.params.pageSlug);
```

`getPageDataFromAPIViaNote` (Page.js:312-327) issues a GraphQL query for the
commentary:

```js
let response = await BoMOnlineAPI({ commentary: params.commentaryId });
let commentary = response.commentary[params.commentaryId];
pageSlug = commentary.location?.slug.replace(/\/\d+$/, "");
textId   = commentary.location?.slug.match(/\d+$/)[0];
```

The commentary record's `location` is a `BomText` row (see
`src/resolvers/BomNotes.ts:19-37` — the resolver eagerly joins
`BomText` as `location` with `parent_page`, `parent_section`, and
`narration`). `location.slug` looks like `<pageSlug>/<textId>`, e.g.
`lehi-leaves-jerusalem/4231`. The frontend splits that into the two halves.

Then `getPageDataFromAPI(pageSlug, textId)` is called.

### 3. Load the page data

`getPageDataFromAPI` (Page.js:262-309) queries:

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

The `setPageSlugId` reducer (Page.js:855-866) folds `textId` and `pageSlug`
back into `initOpen` so the subsequent init logic can use them — they
weren't in the URL params, but they exist on `initOpen` now.

`setPageData` triggers the React render of the page sections and rows.

### 4. Wait for "ready to scroll"

The page-init effect (Page.js:213-240) won't run until **all** of:

- `initStarted === false` (it hasn't already run)
- `readyToScroll === true`
- `document.querySelector(".content")` exists (rows are in the DOM)

`readyToScroll` is set by `loadPageComments` (Page.js:369+). If the user is
logged in **and** in study mode **and** an active study group is selected,
the page comments must finish loading first (it subscribes to socket events,
fetches existing comments, and only then calls `setReadyToScroll(true)`).
Otherwise it short-circuits to `setReadyToScroll(true)` immediately.

This is why the commentary popup sometimes appears almost instantly and
sometimes takes a second or two — the timing follows the page-comment
pipeline, not the commentary fetch.

### 5. Dispatch to `initPageCommentary`

`handlePageInit` (Page.js:213-233) routes by `initOpen` flags. With
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

So the open-popup call is supplied as the **callback** to `initPageItem` —
it only fires after the scroll-and-expand has completed.

### 6. Scroll, then expand the text row(s)

`initPageItem` (Page.js:567-597) does the visual choreography:

1. `findTextToOpen(pageController)` walks the DOM to find the row whose
   element has `textid="<pageSlug>/<textId>"`. It also walks up to the
   closest `.row > [textid]` ancestor to find a **parent text slug** (if
   the target text is nested inside a parent text, e.g. a subordinate row
   inside a quotation block) and includes both in `textToOpen`.
2. It computes a scroll target: the row's `offsetTop` minus 20% of the
   viewport height (so the row lands roughly one-fifth from the top).
3. `scrollTo(distance, callback)` (Utils.js:386-401) waits one second and
   then calls `window.scrollTo({ top, behavior: "smooth" })`. After another
   second it fires the callback.
4. Inside the callback, for **each** `textToOpen` entry (parent first,
   then leaf — they're sorted), it:
   - Looks up `[textid='<slug>'] .reference a` (the verse-reference link
     that toggles the row open/closed).
   - If the element is missing or already has the `autoclicked` attribute,
     skips it.
   - Otherwise tags the element with `autoclicked="true"`, scrolls the
     element into view, and synthesizes a `.click()`.
   - Each click is staggered by 1000 ms (`time += 1000` per item).
5. After all the staggered clicks, `setTimeout(callback, time)` fires the
   outer callback supplied by `initPageCommentary` — which is what opens
   the popup.

Net effect: smooth scroll → ~1 s pause → row reference link clicked open
→ ~1 s per nested level → popup appears.

### 7. Open the commentary popup

The callback runs `appController.functions.setPopUp(...)`. The reducer
(`models/appController.js:256-283`) does:

- If the popup wasn't already open, captures `underSlug` from the current
  app slug. (This is what closing the popup will restore.)
- Sets `popUp.open = true`, `popUp.type = "commentary"`,
  `popUp.ids = [<commentaryId>]`, `popUp.activeId = <commentaryId>`.
- Sets `popUp.top = window.scrollY + window.innerHeight * 0.20` so the
  popup is positioned near the user's current scroll position, just below
  the row that was opened.
- **Marks `popUp.loading = true`** because no `popUpData` was passed in.
- Calls `setSlug("commentary/<id>")` — which pushes the path into
  `react-router`'s history (`models/appController.js:225-232`). The URL bar
  now reads `/commentary/<id>` (which is already the URL you're on, so this
  is effectively a no-op on direct navigation, but matters when the popup
  is opened from a chat preview that started on a different URL).
- Updates the document title via `setPopDocTitle`.

### 8. PopUp component decides which renderer

`views/_Common/PopUp.js:98-115`:

- `if (isMobile()) return <MobileDrawer ... />` — mobile uses a drawer
  variant; the same `popUp.type === "commentary"` branch applies but the
  layout is a bottom drawer rather than a draggable card.
- Otherwise `popUp.type === "commentary"` renders `<Commentary />`.

### 9. `Commentary` fetches data if it doesn't already have it

`views/_Common/Commentary.js:114-137`. With `popUp.loading === true` and
no `appController.popUpData`, it fires:

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
step 2). They're not deduplicated at the call site, but `BoMOnlineAPI`'s
own request batching/caching may collapse them depending on cache settings.
While the second fetch is in flight, the popup shows `<Loading
type="Commentary" />`.

### 10. Render

Once the data is in place, `Commentary` (Commentary.js:222+) renders a
draggable card containing:

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

## What changes in the URL bar

| Moment | URL |
| --- | --- |
| User hits `/commentary/<id>` | `/commentary/<id>` |
| After page data loads, before scroll | unchanged |
| After `initPageCommentary` opens popup | `setSlug("commentary/<id>")` → unchanged in practice (same path); `underSlug` is the page's previous slug (empty string on cold load). |
| User closes popup | `setSlug(underSlug)` — for a cold load this is `""`, so the URL pushes to `/`. For a popup opened from another page (via chat preview), it returns to that page. |

This means **closing the commentary popup after a deep-link load drops you
on the home page, not the underlying scripture page you were just looking
at**. The underlying page is still mounted (the popup never unmounted it),
so visually you stay there, but the URL is `/`. This is a known quirk of
`underSlug` being captured at `setPopUp` time, when the deep-link's
"under" slug was never set.

## What does NOT happen

- The route does **not** redirect to `/<pageSlug>/<textId>` first and then
  open the popup. It stays at `/commentary/<id>` for the entire init
  sequence; only the popup opening pushes a new slug.
- `findTextToOpen` does **not** rely on `match.params.textId` — for this
  route there is none. It uses `initOpen.textId`, which was populated by
  `setPageSlugId` after the commentary record was fetched in step 2.
- The page's normal "open the row when you visit `/<pageSlug>/<textId>`"
  path (`initPageItem` called directly) is reused; the only addition for
  commentaries is the callback that fires `setPopUp` after the row opens.

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
were ever null, `getPageDataFromAPIViaNote` would call `getPageDataFromAPI(undefined, undefined)` and the page would silently fail to load.

## File map

| File | Lines | Role |
| --- | --- | --- |
| `frontend/webapp/src/models/Routes.js` | 250-252 | Route definition |
| `frontend/webapp/src/views/Page/Page.js` | 29-41 | `prepareInitOpen` — stashes `commentaryId` into `initOpen` |
| `frontend/webapp/src/views/Page/Page.js` | 56-63 | useEffect routes commentary loads to `getPageDataFromAPIViaNote` |
| `frontend/webapp/src/views/Page/Page.js` | 312-327 | `getPageDataFromAPIViaNote` — commentary → pageSlug + textId |
| `frontend/webapp/src/views/Page/Page.js` | 213-240 | `handlePageInit` — dispatches to `initPageCommentary` once ready |
| `frontend/webapp/src/views/Page/Page.js` | 567-613 | `initPageItem` / `initPageCommentary` — scroll, expand row, fire callback |
| `frontend/webapp/src/views/Page/Page.js` | 615-641 | `findTextToOpen` — locates target row and its parent |
| `frontend/webapp/src/models/appController.js` | 256-283 | `setPopUp` reducer — opens the popup |
| `frontend/webapp/src/models/appController.js` | 225-232 | `setSlug` — pushes the popup's slug into history |
| `frontend/webapp/src/views/_Common/PopUp.js` | 70-118 | `<PopUp>` — routes to `<Commentary>` (or `<MobileDrawer>`) |
| `frontend/webapp/src/views/_Common/Commentary.js` | 114-137 | Lazy-fetches commentary data when popup loads |
| `frontend/webapp/src/views/_Common/Commentary.js` | 222-440 | Renders the commentary card UI |
| `frontend/webapp/src/models/GraphQLQueries.js` | 449-478 | `commentary` query builder |
| `src/resolvers/BomNotes.ts` | 19-37 | `commentary` GraphQL resolver |
| `frontend/webapp/src/models/Utils.js` | 748-784 | `CommentaryPreview` — chat-link card that opens the popup without changing the route |
| `frontend/webapp/src/views/_Common/Study/StudyInFeed.js` | 121, 128, 145 | Feed cards that link to `/commentary/<id>` |
