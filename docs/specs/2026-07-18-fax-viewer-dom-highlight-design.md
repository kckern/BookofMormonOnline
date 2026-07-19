# Fax-Viewer DOM Passage Highlight — Design Spec

**Date:** 2026-07-18
**Status:** Approved design, pending implementation plan
**Author:** Claude (brainstormed with KC)

## 1. Background & motivation

Opening `/fax/{version}/{ref}` (e.g. `/fax/1840/mosiah.4.21`) already navigates the
facsimile viewer to the page whose verse-range contains the reference (via
`lookupReference` in `FacsimilePageViewer`/`FacsimilePageViewerMobile`). What's
missing is a **visual highlight of the passage on the page image** — drawn as a
**DOM overlay** (not a pre-rendered crop image), positioned from the
`bom_xtras_fax_index` bounding boxes.

The FaxVerseTile edition crops already deep-link here (`/fax/{version}/{slug}`), so
this makes those links land on a highlighted passage.

## 2. Decisions locked (from brainstorming)

1. **Highlight = DOM overlay** positioned over the page image, not an `<img>` crop.
2. **Multi-spread guardrail:** highlight *per visible spread* — as the user pages,
   the overlay re-appears on each spread that holds part of the passage. A subtle
   "continues →" affordance shows when more of the passage is off the current spread.
   No hard span cap (only a 40-verse fetch backstop).
3. **Scope:** both the desktop spread viewer AND the mobile single-page viewer, via a
   shared hook + overlay component.
4. **Data:** a lightweight backend JSON boxes endpoint (reusing the render module).

## 3. Current state (verified)

- Route: `/fax/:faxVersion/:pageNumber` (`Routes.js:114`); `pageNumber` may be a ref.
  `FacsimilePageViewer` resolves a ref → the leaf whose `pageReference` verse-range
  contains the min verse id, and navigates there.
- The desktop viewer renders a 2-page spread: `leftPage`/`rightPage` in `.page` divs
  with computed `leftPageWidth`/`rightPageWidth` and `calculatedHeight` (width-first
  layout). Each page renders `PageImage` (`.pageImageWrapper > img.main-image`).
- Leaves carry `pageNumInt` (the scan/leaf file number) and `pageReference`.
- Box coordinates (`X/Y/W/H`) are in a **700px-wide `pageScale` space** (per the fax
  render fix `docs/specs/2026-07-18-fax-render-api-design.md`); scale to a displayed
  image by `displayedWidth / pageScale`.
- The render backend already has `resolve.ts` (`selectorToVerseIds`,
  `verseIdsToBoxes`, `imageScanMeta` for the page offset + `pageScale`), and
  `setupProxy.js` proxies `/fax/render` + `/fax/text` to the backend (`:5006`).

## 4. Backend — box data endpoint

`GET /fax/boxes/{version}/{selector}` on the render backend (Fastify), a sibling of
`/fax/render`. Reuses the render module end-to-end.

Response (JSON):
```json
{
  "pageScale": 700,
  "clamped": false,
  "boxes": [
    { "verseId": 32899, "imagePage": 156, "x": 357, "y": 291, "w": 288, "h": 152 }
  ]
}
```
- `version` validated against the 13-slug whitelist; `selector` parsed exactly like the
  render route (canonical ref slug or `ids/...`).
- `imagePage` = `box.page + imageScanMeta(version).offset` — the **scan/leaf page
  number**, so the frontend matches it directly against `leaf.pageNumInt` (no
  client-side offset math).
- `x/y/w/h` are the raw box coords in `pageScale` space (the frontend scales them).
- Capped at `MAX_VERSE_IDS` (40); `clamped: true` when the ref resolved to more.
- Empty `boxes` (unknown verse/edition) → `{ boxes: [] }` (200), not an error.
- Registered in `faxRoutes`; add `/fax/boxes` to `setupProxy.js` `API_PATHS`.

## 5. Shared frontend core

Location: `frontend/webapp/src/views/Facsimiles/`.

- **`useFaxHighlight(version, ref)`** — hook. Fetches `${renderBaseUrl}/fax/boxes/...`
  once per (version, ref) (canonicalize the ref to the render selector, same
  `refSlug` convention). Returns:
  - `boxesByPage: Map<number, Box[]>` keyed by `imagePage`.
  - `pageScale: number`.
  - `allPages: number[]` (sorted image pages the passage touches).
  - `clamped: boolean`.
  Returns an empty map when `ref`/`version` is absent or the fetch fails (fail-soft —
  the viewer still works without the overlay).
- **`<FaxHighlightOverlay pageNum displayedWidth boxes pageScale />`** — renders one
  absolute-positioned `div.faxHighlightBox` per box on that page, each at
  `left/top/width/height = box{ x,y,w,h } × (displayedWidth / pageScale)`. The overlay
  container is `position: absolute; inset: 0; pointer-events: none` so it never blocks
  page-navigation clicks. Renders nothing when `boxes` is empty.

## 6. Viewer integration

- **Desktop (`FacsimilePageViewer`):** add `position: relative` to each `.page` div
  (left/right). Inside each, render `<FaxHighlightOverlay>` with that page's
  `pageNumInt`, its displayed width (`leftPageWidth`/`rightPageWidth`), and
  `boxesByPage.get(pageNumInt)`. The overlay sits over the centered page image.
- **Mobile (`FacsimilePageViewerMobile`):** same overlay on the single visible page,
  using that viewer's page width.
- Both read `ref` from the URL param (`pageNumber` when `hasLetters`), pass it to
  `useFaxHighlight`. When the URL is a plain page number (no ref), the hook is inert.

## 7. Multi-spread guardrail

- The viewer opens to the first page containing the passage (existing behavior).
- The overlay shows only boxes whose `imagePage` is currently visible → naturally
  "follows paging" across spreads.
- A subtle **"continues →" / "← continues"** hint renders (near the spread edge) when
  `allPages` includes pages beyond the visible spread in that direction. Purely
  informational; paging is the existing nav.
- The 40-verse fetch cap is the only hard backstop; `clamped` may drive a small note.

## 8. Visual

- `.faxHighlightBox`: translucent warm accent (e.g. `rgba(120,90,50,0.22)`) with a
  slightly darker border, small corner radius; a brief fade/scale-in on first mount to
  draw the eye; `pointer-events: none`.
- The "continues" hint: a small, unobtrusive chip/arrow near the outer edge.

## 9. Coordinate correctness

- Scale = `displayedWidth / pageScale`. Applied uniformly to x/y/w/h (same insight as
  the render `pageScale` fix).
- **Integration risk to verify first:** the endpoint's `imagePage` (fax page + render
  offset) must equal the viewer's `leaf.pageNumInt` (the viewer derives leaves via its
  own `pgoffset` in `Facsimiles.js`). Confirm with a known verse (e.g. 2013 Mosiah
  4:21 → `imagePage 156`, and the viewer shows that verse on the leaf numbered 156)
  before wiring the overlay; reconcile the two offsets if they differ.

## 10. Error handling / edge cases

- Fetch failure or empty boxes → no overlay, viewer unaffected.
- Ref not in this edition (no boxes) → no overlay (the page still opens).
- Notch geometry (`TL*/BR*`) is **ignored** for the overlay — a simple rectangle over
  the verse box is sufficient and clearer than a notched polygon for an on-page marker.
- Overlay recomputes on resize (it's derived from the live `displayedWidth`).

## 11. Testing

- **Backend:** `/fax/boxes/2013/mosiah-4.21` returns `imagePage 156`, `x357/y291`,
  `pageScale 700`; unknown ref → `{ boxes: [] }`; over-cap ref → `clamped: true`.
- **Frontend:** `useFaxHighlight` groups boxes by page and computes `allPages`
  (mock fetch, unit); `FaxHighlightOverlay` positions a box at the correct scaled px
  for a given `displayedWidth` (unit); a viewer test asserting an overlay box renders
  on the page matching the verse.

## 12. Out of scope

- Highlighting via notched polygons (rectangles only).
- Changing the render (crop/page) image API — this is DOM-only.
- Auto-scrolling/zooming to the box within a page (just highlight in place).
