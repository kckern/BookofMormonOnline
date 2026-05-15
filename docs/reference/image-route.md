# `/image/<imageId>` and `/art/<imageId>` routes

Deep-link routes that open the scripture page containing a piece of artwork,
scroll to the text row the image is anchored to, expand that row, and
activate the image in the right-side **art panel** (NOT a popup — the image
appears inline alongside the scripture text). The URL is rewritten to
`/art/<imageId>` once the image is "active", regardless of which of the two
routes was used to enter.

## Route definitions

`frontend/webapp/src/models/Routes.js:254-262`

```js
{
  path: "/image/:imageId(\\d+)",
  component: Page,
  exact: true,
},
{
  path: "/art/:imageId(\\d+)",
  component: Page,
  exact: true,
}
```

- Both routes accept `imageId` as a digit string and both resolve to the
  same `Page` component with `match.params.imageId` set.
- The behavioral difference between the two is purely the URL the user
  starts on. The flow below is identical; the only end-state difference is
  that the URL bar always ends up at `/art/<imageId>` (see step 7).

## Entry points that produce these URLs

- `frontend/webapp/src/views/Page/Annotations.js:292` — once the image is
  activated by deep-link, the page calls `history.push('/art/<imageId>')`
  to canonicalize the URL.
- External links and direct address-bar navigation.
- There is **no** in-app component that links to `/image/<id>` — that path
  exists for legacy URLs and external incoming links. The internal art
  picker normally navigates the panel state in place without changing the
  URL except via the `history.push` mentioned above.

## Full flow

The flow mirrors the commentary route up to step 5; the divergence is at
step 6 (no popup; an in-panel image activation instead).

### 1. Route mounts → `Page` component initializes

`frontend/webapp/src/views/Page/Page.js:29-41` — `prepareInitOpen` builds:

```js
initOpen = { pageSlug: undefined, imageId: "<id>" }
```

`pageSlug` and `textId` are undefined at this point — the URL has only
`imageId`.

### 2. Resolve image → page slug + text id

`Page.js:60-62`:

```js
if (match.params.imageId || match.params.commentaryId)
  getPageDataFromAPIViaNote(match.params);
```

`getPageDataFromAPIViaNote` (Page.js:312-327) does:

```js
let response = await BoMOnlineAPI({ image: params.imageId });
let image = response.image[params.imageId];
pageSlug = image.location.slug.replace(/\/\d+$/, "");
textId   = image.location.slug.match(/\d+$/)[0];
```

The backend resolver (`src/resolvers/BomNotes.ts:106-130`) returns the
`BomXtrasImage` record joined with its `BomText` `location`, so
`image.location.slug` is `<pageSlug>/<textId>` and the frontend splits it
into the two halves.

Then `getPageDataFromAPI(pageSlug, textId)` runs.

### 3. Load the page data

Identical to the commentary route: `BoMOnlineAPI({page, pageprogress})`,
then `setPageSlugId({pageSlug, textId, lastLeaf})` folds `textId` and
`pageSlug` back into `initOpen`, then `setPageData(...)` triggers the
section/row render.

### 4. Wait for "ready to scroll"

Same gate as the commentary flow — `handlePageInit` only fires once
`readyToScroll`, `pageData`, and `document.querySelector(".content")` are
all in place. `readyToScroll` is set immediately for guests; for logged-in
study-mode users it waits on `loadPageComments` (Page.js:369+).

### 5. Dispatch to `initPageImage`

`handlePageInit` (Page.js:213-233) checks flags in order. With
`initOpen.imageId` set:

```js
if (pageController.states.initOpen.imageId)
  return initPageImage(pageController);
```

```js
function initPageImage(pageController) {
  initPageItem(pageController);
}
```

**Note the absence of a callback** — unlike `initPageCommentary`, there's
no `setPopUp` call. The image route relies on a *side effect* inside the
expanded row (step 6) to activate the artwork.

### 6. Scroll, then expand the text row(s)

`initPageItem` (Page.js:567-597) — exact same routine documented for the
commentary route:

1. `findTextToOpen` locates `[textid="<pageSlug>/<textId>"]` and walks up
   to its `.row` ancestor. If the text is nested, the parent's textid is
   also queued.
2. `scrollTo(distance, callback)`: 1 s wait, smooth-scroll to row top
   minus 20% viewport, 1 s wait, callback.
3. For each entry in `textToOpen` (parent first), `setTimeout` staggered
   1000 ms apart: find `.reference a`, scroll, `.click()`. The click
   triggers `TextContent.js:27-43` (`toggleOpenClose`), which expands the
   row and dispatches `setActiveRow` (`Page.js:689-765`).
4. `setActiveRow` does a lot of side work: starts audio, updates document
   title, **calls `appController.functions.setSlug(slug)`** (pushing the
   URL to `/<pageSlug>/<textId>`), logs progress, fetches user summary.
   This is why the URL briefly flickers to the page/text URL before
   landing at `/art/<id>`.

### 7. Image activation (in `ImageBubble`)

Once the row is open, its `Narration` subtree renders `ImageBubbles`
(`Annotations.js:236-254`) — small image bubbles in the margin next to
the verse, one per image group. Each `ImageBubble` runs this effect on
mount (`Annotations.js:279-301`):

```js
let urlOpenImageId =
  narrationController.pageController.states.initOpen.imageId;
if (
  urlOpenImageId &&
  item.ids.indexOf(urlOpenImageId) >= 0 &&
  !narrationController.pageController.states.loading &&
  !narrationController.states.activeImageId
) {
  narrationController.functions.setActiveImageId(urlOpenImageId);
  narrationController.functions.setPanelImageIds(item.ids);
  history.push(`/art/${urlOpenImageId}`)
  setAutoCyle(false);
}
```

So:

- The deep-linked imageId is matched against this bubble's `item.ids` (the
  group of images attached to one anchor in the text). If it's in there,
  the bubble claims it.
- `setActiveImageId(urlOpenImageId)` marks the image active in the panel.
- `setPanelImageIds(item.ids)` populates the panel's thumbnail tab strip
  with all images in this group (used for tab-switching).
- **`history.push('/art/<imageId>')` rewrites the URL** so the canonical
  shareable URL is always `/art/<id>` even if the user came in via
  `/image/<id>`.
- `setAutoCyle(false)` stops the auto-rotation of images within the group
  so the deep-linked image stays focused.

### 8. `ImagePanel` renders the activated image

`Narration.js:512-650` — `ImagePanel` is the right-side art panel inside
the expanded row. It reads `activeImageId` and `panelImageIds` from the
narration controller and:

- Renders a tab strip if multiple images are in the group.
- Renders the active image at `${assetUrl}/art/<activeImageId>` with a
  caption (title), artist credit, link to the source, and a "fullscreen"
  button that opens a `LightBox` overlay (uses `SimpleReactLightbox`).
- Renders a study-group `Comments` thread keyed to `{ img: <activeImageId> }`.
- Updates `document.title` to `"Art: <caption> | <home_title>"`.

The lightbox (`Narration.js:434-510`) is a separate modal that only opens
when the fullscreen button is clicked — it does **not** open
automatically on deep-link.

## What changes in the URL bar

| Moment | URL |
| --- | --- |
| User hits `/image/<id>` or `/art/<id>` | as typed |
| After page data loads | unchanged |
| After auto-click of `.reference a` (in `setActiveRow`) | briefly `/<pageSlug>/<textId>` via `setSlug` |
| After `ImageBubble` effect fires (`history.push('/art/<id>')`) | `/art/<id>` |

Consequently, the canonical end-state URL for any image deep-link is
`/art/<id>`, regardless of entry path.

## What does NOT happen

- **No popup or modal opens on deep-link.** The artwork shows in the
  in-page right-side panel only. A lightbox is reachable only via the
  fullscreen button.
- `initPageImage` does not pass a callback to `initPageItem` — there is
  no analogue to `setPopUp` for images. The activation is implicit, done
  by the bubble component reading `initOpen.imageId` once it renders.
- The activation depends on the matching `ImageBubble` actually being
  rendered. If the row's content doesn't include the image as an annotation
  (or the bubbles haven't appeared yet because of `pageController.states.loading`),
  nothing activates.

## Backend support

`src/resolvers/BomNotes.ts:106-130` — `image(id: [String])` returns:

```graphql
type Image {
  id
  title
  artist
  link
  width
  height
  location { slug }      # "<pageSlug>/<textId>" — same shape as commentary
}
```

The `location.slug` is again the load-bearing field.

## File map

| File | Lines | Role |
| --- | --- | --- |
| `frontend/webapp/src/models/Routes.js` | 254-262 | Both `/image` and `/art` route definitions |
| `frontend/webapp/src/views/Page/Page.js` | 29-41 | `prepareInitOpen` stashes `imageId` into `initOpen` |
| `frontend/webapp/src/views/Page/Page.js` | 60-63 | useEffect routes image loads to `getPageDataFromAPIViaNote` |
| `frontend/webapp/src/views/Page/Page.js` | 312-327 | `getPageDataFromAPIViaNote` — image → pageSlug + textId |
| `frontend/webapp/src/views/Page/Page.js` | 213-240 | `handlePageInit` — dispatches to `initPageImage` once ready |
| `frontend/webapp/src/views/Page/Page.js` | 567-601 | `initPageItem` / `initPageImage` — scroll, expand row (no callback) |
| `frontend/webapp/src/views/Page/Page.js` | 689-765 | `setActiveRow` reducer — runs when reference link is clicked; pushes URL to `/<pageSlug>/<textId>` via `setSlug` |
| `frontend/webapp/src/views/Page/Annotations.js` | 279-301 | `ImageBubble` effect — claims the deep-linked imageId and pushes URL to `/art/<id>` |
| `frontend/webapp/src/views/Page/Narration.js` | 47-52 | `setActiveImageId` / `setPanelImageIds` reducers |
| `frontend/webapp/src/views/Page/Narration.js` | 512-650 | `ImagePanel` — renders the active art in the right-side panel |
| `frontend/webapp/src/views/Page/Narration.js` | 434-510 | `LightBox` — fullscreen overlay (manual button only) |
| `frontend/webapp/src/models/GraphQLQueries.js` | 479-497 | `image` query builder |
| `src/resolvers/BomNotes.ts` | 106-130 | `image` GraphQL resolver |
