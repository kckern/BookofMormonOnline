# Fax Verse Inspector — Spec

**Date:** 2026-07-24
**Status:** Approved (design), pending implementation plan
**Area:** `frontend/webapp/src/views/Facsimiles/`

## Summary

Upgrade the facsimile viewer's passive verse-highlight overlay into an
interactive **verse inspector**. When an edition has a verse-level fax index,
every verse on the visible spread becomes a hotspot:

- **Hover** a verse → the rest of the page dims and the verse is "cut out"
  (spotlight), with a tooltip above it showing the actual verse text.
- **Click** a verse → a modal opens with an enlarged, pan/zoomable cutout, the
  speaker/voice avatar + label, the verse text, and on-demand comparison of the
  same verse across other indexed editions.
- **Deep-link** to a verse → that verse loads already "pinned" in the same
  cutout+tooltip state (no hover needed); the pin releases after the user first
  interacts with it (enter→exit), hovers another verse, or clicks.

This replaces the current `useFaxHighlight` / `FaxHighlightOverlay` pair, which
only draws non-interactive boxes for the active reference.

## Background — what exists today

- `useFaxHighlight.js` — fetches `GET {renderBaseUrl}/fax/boxes/{version}/ids/{verseIds}`
  for the **current reference only**, returns `{boxesByPage, pageScale, allPages}`.
  Box coords are in a `pageScale`-wide space (default 700), scaled to display
  width via `k = displayedWidth / pageScale`.
- `FaxHighlightOverlay.js` — renders those boxes as absolute-positioned,
  `pointer-events:none` divs. Has a ResizeObserver fallback to self-measure
  width on mobile. Covered by `__tests__/FaxHighlightOverlay.test.js`.
- Fax index (`Facsimiles.js`): `pages[n] = [startingVerseId, verseCount]` per
  page. `getRefFromIndex(pageIndex, pageNum)` → a scripture reference. This
  means **the full verse_id list for any page is already derivable client-side**
  with no fetch.
- Verse text + speaker: GraphQL `read(ref)` returns
  `sections[].blocks[]{ person_slug, voice, verse_id, lines[]{ verse_id, text } }`.
  Speaker avatar asset: `${assetUrl}/people/{person_slug}`; voice label via
  `label(voice)`.
- No cross-edition coverage API exists; each edition's index is independent.
- `simple-react-lightbox` is wired at the app root but is a gallery lightbox —
  wrong shape for this bespoke modal. We build a small self-contained pan-zoom.

## Goals

1. Every indexed verse on the visible spread is hoverable/tappable.
2. Hover/pin renders a dimming scrim with the verse cut out + a text tooltip.
3. Click opens an inspector modal: avatar + voice + reference + text, a
   pan/zoomable cutout, and cross-edition comparison.
4. Deep-linked verse loads pre-pinned in the hover-equivalent visual state.
5. Works on both desktop (`FacsimilePageViewer`) and mobile
   (`FacsimilePageViewerMobile`) viewers.

## Non-goals

- No backend changes. Cross-edition coverage is computed client-side.
- No magnifier loupe in this pass (pan-zoom only; loupe is a future add).
- No editing/authoring of the index or boxes.

## Architecture

### 1. Data layer — `useFaxVerses(version, spread, faxIndex)`

Replaces `useFaxHighlight`. Produces, for the visible spread, a per-page list of
fully-hydrated verse objects.

- **verse_ids per page**: derived from the fax index tuples
  (`[startVerseId, count]`) — no fetch.
- **boxes**: one `GET /fax/boxes/{version}/ids/{allSpreadVerseIds}` per spread.
  Grouped by `imagePage` (reuse the existing `buildHighlightState` grouping).
  Cached by `version + pageRange` key.
- **text + speaker**: one GraphQL `read(spreadRef)` per spread; flatten
  `sections[].blocks[].lines[]` into a `Map<verse_id, {text, person_slug, voice, ref}>`.
  Cached by `spreadRef`.

Output:

```
{
  versesByPage: Map<imagePage, Array<{
    verse_id, ref, box: {x, y, w, h}, text, person_slug, voice
  }>>,
  pageScale: number,
}
```

A verse with a box but no text (or vice-versa) still renders its hotspot; the
missing half degrades gracefully (tooltip shows the reference only, etc.).

### 2. Cutout + tooltip layer — `FaxVerseCutout` (supersedes `FaxHighlightOverlay`)

Rendered per page image, positioned like the current overlay
(`k = displayedWidth / pageScale`).

- **Hotspots**: one transparent `pointer-events:auto` hit-target per verse box
  (`cursor: pointer`), carrying the verse object. These are the only
  interactive elements; they sit above the page image.
- **Scrim + cutout**: a single SVG overlay sized to the page. A dark `<rect>`
  covers the whole page; an SVG `<mask>` (white full-page rect, black verse-box
  rect with rounded corners) punches the active verse out, so only that verse
  stays bright. A soft ring strokes the cutout box. Moving the active verse
  animates the mask box → "spotlight travels." The scrim renders only when a
  verse is active (hover/pinned); `pointer-events:none` so it never blocks the
  hit-targets beneath it.
- **Tooltip**: a caret-pointed card anchored above the active cutout box
  (flips below when near the top edge; x-clamped to the viewport). Shows the
  reference label + verse text. `pointer-events:none`.

`FaxHighlightOverlay`'s scaling math and its test are folded in here.

### 3. Interaction state machine

State: `{ activeVerseId, source: 'hover' | 'pinned' | null, pinnedEngaged: bool }`.
Modeled as a pure reducer (`faxVerseState.js`) so it is unit-testable
independent of the DOM.

- **idle**: no scrim.
- **hover** (desktop, pointer): entering a hotspot sets
  `{active, source:'hover'}`; leaving clears (unless a pin is re-asserted).
- **pinned** (deep-link): initialized from the active ref on mount →
  `{active: firstActiveVerseId, source:'pinned', pinnedEngaged:false}`, shown
  identically to hover. Release rules:
  - entering the pinned verse sets `pinnedEngaged:true`; the subsequent leave
    releases the pin (the "enter→exit to unlock" behavior),
  - hovering a *different* verse releases it immediately,
  - clicking opens the modal (and releases).
- **open**: click sets a separate `openVerseId` consumed by the modal; the
  scrim state is unaffected underneath.
- **touch**: tap a hotspot pins it (hover-equivalent); tap the scrim releases;
  tap the same pinned verse again opens the modal.

### 4. Inspector modal — `FaxVerseModal`

- Portaled to `document.body`, dark backdrop. Closes on X, backdrop click, and
  Esc — Esc uses a **capture-phase handler with `stopPropagation` /
  `stopImmediatePropagation`** so it never bubbles to the viewer's Escape
  handler (which exits to the grid). Same guard already used in `ScripturePopup`
  and `FaxBreadcrumbs`.
- **Header**: `<img src={assetUrl}/people/{person_slug}>` (hidden on error) +
  `label(voice)` + the reference.
- **Body**: `FaxPanZoom` viewport showing the page image positioned/scaled to
  the verse box (starts fit-to-box; wheel/pinch to zoom, drag to pan; clamped so
  the page can't be dragged fully out of frame). Verse text beside/below.
- **Compare**: a "Compare editions" affordance. On open (lazy), `faxCompare.js`
  determines which *other* indexed editions cover this `verse_id`, fetches each
  one's boxes for that verse, and renders labeled cutout thumbnails. Selecting a
  thumbnail loads it into the main pan-zoom viewport (or side-by-side). Editions
  without coverage are omitted.

### 5. Cross-edition coverage — `faxCompare.js`

- Input: a `verse_id` and the list of indexed editions (`indexRef` present).
- For each other edition: load its fax index (same `BoMOnlineAPI({faxIndex})`
  call the viewer uses; cached), find the page whose `[start, count]` range
  contains the `verse_id`, then fetch that edition's box for the verse.
- Output: `Array<{ slug, title, imagePage, box, pageAssetUrl }>` for editions
  that cover it. Coverage lookups and indices are memoized.

### 6. Pan-zoom — `FaxPanZoom`

Small self-contained component: a positioned `<img>` inside an
`overflow:hidden` frame, transformed by `translate/scale` state. Wheel and
pinch adjust scale about the pointer; pointer-drag pans; scale and translation
are clamped to keep content in view. No new dependency.

### 7. Viewer wiring

- `FacsimilePageViewer.js`: replace the `useFaxHighlight`/`FaxHighlightOverlay`
  usage with `useFaxVerses` + `FaxVerseCutout` per page; add `openVerseId` state
  driving `FaxVerseModal`; seed the pinned state from the active ref.
- `FacsimilePageViewerMobile.js`: mount the same cutout layer + modal per page
  in the vertical scroller; tap semantics per the state machine.

## Data flow

```
spread ref + fax index
      │
      ├─ derive verse_ids (no fetch) ──┐
      │                                 ▼
      ├─ GET /fax/boxes/…/ids/…  ──► boxes by page ──┐
      │                                               ├─► useFaxVerses → versesByPage
      └─ GraphQL read(spreadRef) ─► text/speaker ─────┘
                                                        │
                       hover / pin / tap  ──►  FaxVerseCutout (scrim+tooltip)
                                                        │ click
                                                        ▼
                                                 FaxVerseModal
                                                   ├─ FaxPanZoom (cutout)
                                                   ├─ avatar + voice + ref + text
                                                   └─ faxCompare → other editions
```

## Error / edge handling

- Edition has no index → no hotspots, no scrim (current behavior preserved).
- Verse has a box but `read` returned no text → hotspot + cutout still work;
  tooltip shows the reference only.
- `/fax/boxes` or `read` fails → the layer renders nothing rather than erroring;
  the page image is unaffected.
- Deep-link ref not present on the loaded spread → no pin (nothing to pin to).
- Compare finds zero covering editions → the compare section shows an empty
  state, not an error.
- Rapid page turns → data fetches are cancellable (existing `cancelled` guard
  pattern in `useFaxHighlight`); a stale response never applies.
- `prefers-reduced-motion` → the spotlight-travel and cutout transitions
  collapse to instant.

## Testing

- **Unit**: `useFaxVerses` grouping/merge (extend the existing
  `buildHighlightState` test); the `faxVerseState` reducer (idle/hover/pinned/
  unlock/open transitions); `faxCompare` coverage scan against fixture indices.
- **Playwright** (localhost:8200): hover shows scrim+cutout+tooltip with correct
  text; deep-link renders the pinned state without hover and releases on
  enter→exit; click opens the modal with avatar + text; compare loads other
  editions.

## Rollout

- Feature is inert for non-indexed editions, so it ships without gating.
- No backend/deploy dependency (coverage is client-side).
