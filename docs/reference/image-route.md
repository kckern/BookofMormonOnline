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

- `frontend/webapp/src/views/Page/Annotations.js:291` — once the image is
  activated by deep-link, the bubble calls `history.push('/art/<imageId>')`
  to canonicalize the URL.
- External links and direct address-bar navigation.
- There is **no** in-app component that links to `/image/<id>` — that path
  exists for legacy URLs and external incoming links. The internal art
  picker normally navigates the panel state in place without changing the
  URL except via the `history.push` mentioned above.

## Full flow

The flow mirrors the commentary route up to step 5; the divergence is at
step 7 (no popup; an explicit-callback image activation request that an
`ImageBubble` claims).

### 1. Route mounts → `Page` component initializes

`frontend/webapp/src/views/Page/Page.js:33-45` — `prepareInitOpen` builds:

```js
initOpen = { pageSlug: undefined, imageId: "<id>" }
```

`pageSlug` and `textId` are undefined at this point — the URL has only
`imageId`. `Page.js:60-61` also derives two keys from `match.params`:

- `routeKey` — the full `pageSlug|textId|commentaryId|imageId|faxVersion`
  tuple. The route-reset effect (`Page.js:201-211`) is keyed on this.
- `pageIdentityKey` — `pageSlug|commentaryId|imageId` (no `textId`). The
  data-fetch effect (`Page.js:63-70`) is keyed on this so that changes to
  `textId` alone do not retrigger the network fetch.

### 2. Data-fetch effect resolves image → page slug + text id

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

`getPageDataFromAPIViaNote` (`Page.js:331-361`), image branch:

```js
try {
  if (params.imageId) {
    let response = await BoMOnlineAPI({ image: params.imageId });
    let image = response?.image?.[params.imageId];
    if (!image?.location?.slug) {
      pageController.functions.setNotFound({ type: "image", id: params.imageId });
      return;
    }
    pageSlug = image.location.slug.replace(/\/\d+$/, "");
    textId   = image.location.slug.match(/\d+$/)?.[0];
  }
  // …
  if (pageSlug) getPageDataFromAPI(pageSlug, textId);
} catch (err) {
  console.error("getPageDataFromAPIViaNote failed", err);
  const type = params.imageId ? "image" : "commentary";
  const id = params.imageId || params.commentaryId;
  pageController.functions.setNotFound({ type, id });
}
```

The backend resolver (`src/resolvers/BomNotes.ts:106`) returns the
`BomXtrasImage` record joined with its `BomText` `location`, so
`image.location.slug` is `<pageSlug>/<textId>` and the frontend splits it
into the two halves. Missing slug or thrown request → `notFound` is set
and rendering bails to `<PageNotFound />`.

### 3. Route-reset effect

`Page.js:201-211` runs on `[routeKey]`. On every route change it clears
the per-navigation state so a stale deep-link can't leak across pages:

```js
useEffect(() => {
  setReadyToScroll(false);
  startInit(false);
  dispatch({ fn: "markAsInitiated", val: false });
  pageController.functions.resetAutoClicked();
  pageController.functions.setNotFound(null);
  pageController.appController.functions.requestImageActivation(null);
  const newInitOpen = prepareInitOpen(match.params);
  pageController.functions.setInitOpen(newInitOpen);
  handlePageInit();
}, [routeKey]);
```

The `requestImageActivation(null)` call is load-bearing: it guarantees that
a request set on a previous page (e.g. by an unresolved bubble — see edge
cases below) doesn't survive into the next navigation.

### 4. Load the page data

Identical to the commentary route: `BoMOnlineAPI({page, pageprogress})`,
then `setPageSlugId({pageSlug, textId, lastLeaf})` folds `textId` and
`pageSlug` back into `initOpen`, then `setPageData(...)` triggers the
section/row render.

### 5. Wait for "ready to scroll"

Same gate as the commentary flow — `handlePageInit` (`Page.js:232-252`)
only fires once `readyToScroll`, `pageData`, and
`document.querySelector(".content")` are all in place. `readyToScroll` is
set immediately for guests; for logged-in study-mode users it waits on
`loadPageComments`.

### 6. Dispatch to `initPageImage`

`handlePageInit` checks flags in order. With `initOpen.imageId` set:

```js
if (pageController.states.initOpen.imageId)
  return initPageImage(pageController);
```

```js
// Page.js:645-650
function initPageImage(pageController) {
  const imageId = pageController.states.initOpen.imageId;
  initPageItem(pageController, () => {
    pageController.appController.functions.requestImageActivation({ imageId });
  });
}
```

The `imageId` is snapshotted into a closure-local `const` **before**
`initPageItem` runs any awaits. The callback fired when `initPageItem`
resolves uses that closure value, so it is shielded from any
`setInitOpen` that lands mid-flight (e.g. if the user re-navigates while
the row is still opening).

### 7. Scroll, then expand the text row(s)

`initPageItem` (`Page.js:594-639`) — exact same async-sequential routine
documented for the commentary route:

1. `findTextToOpen` locates `[textid="<pageSlug>/<textId>"]` and walks up
   to its `.row` ancestor. If the text is nested, the parent's textid is
   also queued. The list is then sorted via `orderByDomAncestry` so the
   outermost row opens first.
2. `await scrollToAsync(itemToScrollTo.offsetTop - offsetTop)` — promise
   wrapper around `scrollTo(distance, callback)` so the for-loop can
   `await` it.
3. For each entry, in DOM-ancestry order: find `[textid='<slug>'] .reference a`;
   if it exists and the slug isn't already in `pageController.states.autoClicked`,
   add it to the set, `await scrollToAsync(coords.top - offsetTop)`,
   `el.click()`, then `await awaitDomOpen(slug, 2000)`. `awaitDomOpen` is
   a `MutationObserver` wrapper that resolves when the row's content
   children mount (or times out at 2 s).
4. The click triggers `TextContent.js:27-43` (`toggleOpenClose`), which
   expands the row and dispatches `setActiveRow` (`Page.js:738-817`).
   `setActiveRow` does a lot of side work: starts audio, updates document
   title, calls `appController.functions.setSlug(slug)` (which on the
   image route uses `{ replace: true }` because `auto === true`, so the
   URL replaces in-place to `/<pageSlug>/<textId>` before being rewritten
   to `/art/<id>` in step 8), logs progress, fetches user summary.
5. Once the for-loop finishes, `markAsInitiated()` runs and the callback
   fires (step 8).

### 8. Image activation (request → claim)

1. `initPageImage` (`Page.js:645-650`) captures
   `imageId = pageController.states.initOpen.imageId` AT SCHEDULING TIME
   (before any await), then calls `initPageItem(pageController, callback)`.
   The closure-local `imageId` shields the callback from any
   `setInitOpen` that fires mid-flight if the user re-navigates.
2. When `initPageItem` resolves (rows fully open, `MutationObserver`
   awaits done), the callback fires
   `appController.functions.requestImageActivation({ imageId })`. This
   sets `appController.states.imageActivationRequest = { imageId }`
   (reducer at `appController.js:323-326`; initial state at
   `appController.js:164`).
3. The `ImageBubble` effect (`Annotations.js:279-301`) — which mounts
   only after its containing row is open — reads
   `appController.states.imageActivationRequest`. If `req?.imageId`
   matches one of the bubble's `item.ids` AND no image is yet active,
   the bubble claims it:

   ```js
   const req = narrationController.pageController.appController.states.imageActivationRequest;
   const urlOpenImageId = req?.imageId;
   if (
     urlOpenImageId &&
     item.ids.indexOf(urlOpenImageId) >= 0 &&
     !narrationController.states.activeImageId
   ) {
     narrationController.functions.setActiveImageId(urlOpenImageId);
     narrationController.functions.setPanelImageIds(item.ids);
     history.push(`/art/${urlOpenImageId}`);
     setAutoCyle(false);
     // Clear the request so re-renders don't repeat
     narrationController.pageController.appController.functions.requestImageActivation(null);
   }
   ```

   `setActiveImageId(urlOpenImageId)` marks the image active in the
   panel. `setPanelImageIds(item.ids)` populates the panel's thumbnail
   tab strip with all images in this group. `history.push('/art/<id>')`
   rewrites the URL to canonical form. `setAutoCyle(false)` stops the
   auto-rotation of images within the group so the deep-linked image
   stays focused. Finally `requestImageActivation(null)` clears the
   request so a re-render or sibling bubble doesn't re-claim it.
4. The `!loading` guard from the old implementation is gone — the
   request is only set AFTER the `initPageItem` callback, by which time
   the row is guaranteed open and `ImageBubble` is mounted.

### 9. `ImagePanel` renders the activated image

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
| After auto-click of `.reference a` (in `setActiveRow`) | briefly `/<pageSlug>/<textId>` via `setSlug` with `{replace:true}` |
| After `ImageBubble` claims the request (`history.push('/art/<id>')`) | `/art/<id>` |

Consequently, the canonical end-state URL for any image deep-link is
`/art/<id>`, regardless of entry path.

## What does NOT happen

- **No popup or modal opens on deep-link.** The artwork shows in the
  in-page right-side panel only. A lightbox is reachable only via the
  fullscreen button.
- `initPageImage` does not call `setPopUp` — there's no analogue to the
  commentary popup for images. Activation is handled by an explicit
  `imageActivationRequest` set in the `initPageItem` callback and
  claimed by an `ImageBubble` once it mounts.
- The activation depends on the matching `ImageBubble` actually being
  rendered. If no bubble matches, the request lingers in app state
  until the next route change clears it (see edge case below).

## Edge cases

**Image ID not in the DB.** Same as commentary —
`getPageDataFromAPIViaNote` (`Page.js:331-361`) catches missing/null
`image.location.slug` and rejection from `BoMOnlineAPI`, dispatches
`setNotFound({type: "image", id})`. Render bails to `<PageNotFound />`.

**Image deep-link to a page that doesn't contain a matching
`ImageBubble`.** Rare — would happen if the image's `location.slug`
resolved to a page where the `[i]` anchor was stripped or the bubble
didn't render. In that case, no bubble claims the request. The
route-change reset effect at `Page.js:207` calls
`requestImageActivation(null)` on the next navigation, so the stale
request doesn't leak across pages.

## Backend support

`src/resolvers/BomNotes.ts:106` — `image(id: [String])` returns:

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
| `frontend/webapp/src/views/Page/Page.js` | 33-45 | `prepareInitOpen` stashes `imageId` into `initOpen` |
| `frontend/webapp/src/views/Page/Page.js` | 60-61 | `routeKey` / `pageIdentityKey` derivation |
| `frontend/webapp/src/views/Page/Page.js` | 63-70 | Data-fetch effect (keyed on `pageIdentityKey`) routes image loads to `getPageDataFromAPIViaNote` |
| `frontend/webapp/src/views/Page/Page.js` | 201-211 | Route-reset effect (keyed on `routeKey`); clears `notFound`, `autoClicked`, **`imageActivationRequest`**, and rebuilds `initOpen` |
| `frontend/webapp/src/views/Page/Page.js` | 232-252 | `handlePageInit` — dispatches to `initPageImage` once ready |
| `frontend/webapp/src/views/Page/Page.js` | 331-361 | `getPageDataFromAPIViaNote` — image → pageSlug + textId, with try/catch + `setNotFound` |
| `frontend/webapp/src/views/Page/Page.js` | 594-639 | `initPageItem` — async-sequential scroll/click loop with `awaitDomOpen` per item, fires `callback` when done |
| `frontend/webapp/src/views/Page/Page.js` | 645-650 | `initPageImage` — snapshots `imageId`, passes callback that fires `requestImageActivation({imageId})` |
| `frontend/webapp/src/views/Page/Page.js` | 738-817 | `setActiveRow` reducer — runs when reference link is clicked; pushes URL to `/<pageSlug>/<textId>` via `setSlug` (with `{replace:true}` for auto-clicks) |
| `frontend/webapp/src/views/Page/Annotations.js` | 279-301 | `ImageBubble` effect — reads `imageActivationRequest`, claims the deep-linked imageId, pushes URL to `/art/<id>`, clears the request |
| `frontend/webapp/src/models/appController.js` | 164 | `imageActivationRequest` initial state (`null`) |
| `frontend/webapp/src/models/appController.js` | 323-326 | `requestImageActivation` reducer — sets `imageActivationRequest = input.val` |
| `frontend/webapp/src/views/Page/Narration.js` | 238-242 | `setActiveImageId` / `setPanelImageIds` controller wiring |
| `frontend/webapp/src/views/Page/Narration.js` | 512-650 | `ImagePanel` — renders the active art in the right-side panel |
| `frontend/webapp/src/views/Page/Narration.js` | 434-510 | `LightBox` — fullscreen overlay (manual button only) |
| `frontend/webapp/src/utils/awaitDomOpen.js` | — | `MutationObserver` wrapper used per click in `initPageItem` |
| `frontend/webapp/src/utils/orderByDomAncestry.js` | — | Sorts the `textToOpen` list so parents open before children |
| `frontend/webapp/src/models/GraphQLQueries.js` | 479 | `image` query builder |
| `src/resolvers/BomNotes.ts` | 106 | `image` GraphQL resolver |
