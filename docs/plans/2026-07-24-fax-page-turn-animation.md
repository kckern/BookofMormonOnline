# Facsimile page-turn animation (archive.org-style curl)

**Date:** 2026-07-24
**Status:** prototype in progress
**Scope:** `frontend/webapp/src/views/Facsimiles/` (desktop viewer only)

## Goal

Add an archive.org-style animated page turn to the desktop facsimile viewer
(`FacsimilePageViewer.js`) **without refactoring** the data layer, routing, or
sizing math. A physical single-leaf 3D curl when the reader advances/retreats by
one spread.

## Why the naive approach failed before

The viewer's architecture fights animating the *live* pages:

1. **URL-driven nav.** Every turn is `history.replace('/fax/{slug}/{pageSlug}')`;
   `currentPageIndex` is re-derived from the URL and `PageImage` just swaps its
   `<img src>`. There is no stable DOM node representing "the leaf being turned."
2. **Async width-first sizing.** `leftPageWidth/rightPageWidth/calculatedHeight`
   settle over several frames (ResizeObserver + per-image `onload`). A transform
   keyed to them jitters mid-animation.
3. **Variable aspect ratios + 2-pages-per-turn.** Scans differ in width and nav
   advances by 2, so a symmetric book-flip looks wrong if applied to live nodes.

## Key insight

**A 2-page advance IS one physical leaf flip.** A spread is `[2k, 2k+1]`; the
next is `[2k+2, 2k+3]`. Turning the right leaf: front = current right page
(`2k+1`), back = new left page (`2k+2`); behind it the new right page (`2k+3`)
is revealed. This matches the existing nav step exactly — no nav-model change.

## Design: transient overlay, commit on land

Do **not** animate the live pages. On a single-step turn, render a short-lived
absolutely-positioned overlay over the spread and commit the real navigation
only when the animation lands.

### Forward ("next") geometry — turning the right leaf right→left

- **Behind layer** (static, under the leaf):
  - left slot = current left page `2k` (stays; gets covered when the leaf lands)
  - right slot = new right page `2k+3` (revealed as the leaf lifts)
- **Flipping leaf** occupies the right slot, `transform-origin: left center`
  (the spine/seam), `rotateY(0 → -180deg)`:
  - front face = old right `2k+1`
  - back face  = new left `2k+2` (`rotateY(180deg)`, `backface-visibility:hidden`)
- On `animationend` → `handlePageChange(2k+2)` → clear overlay once
  `currentPageIndex === 2k+2` (watch effect, avoids a 1-frame flash).

### Backward ("prev") geometry — mirror

- Behind: left = new left `2k-2` (revealed), right = current right `2k+1` (covered)
- Leaf occupies the left slot, `transform-origin: right center`,
  `rotateY(0 → +180deg)`: front = old left `2k`, back = new right `2k-1`.
- Commit `handlePageChange(2k-2)`.

### Geometry source

All offsets come from values already computed in render scope:
`leftStackWidth`, `leftPageWidth`, `rightPageWidth`, `calculatedHeight`.
Seam x = `leftStackWidth + leftPageWidth`. The overlay mounts inside
`.spreadInner` (made `position: relative`) with `perspective` on the flip layer.

For the prototype the leaf uses its **starting slot width** for both faces
(consecutive scans are near-identical size); minor back-face width mismatch is
accepted. Full per-face aspect fidelity is a follow-up.

## Gating (only single-step curls animate)

Animate on `handleSwipeLeft` / `handleSwipeRight` (arrows, nav buttons,
empty-padding click, swipe). **Skip** animation (commit instantly) for:

- slider scrub, jump-to-page form, deep links, volume up/down
- boundaries (no next/prev spread), the even-last-page special case
- `prefers-reduced-motion: reduce`
- a turn already in progress (ignore re-triggers)

## Files touched

- **new** `FaxPageFlip.jsx` — the overlay layer (behind faces + flipping leaf)
- `FacsimilePageViewer.js` — `flip` state machine, wrapped swipe handlers,
  render the overlay, commit-on-land effect
- `FacsimilePageViewer.scss` — `.faxFlipLayer`, `.flip-leaf`, `.face`, keyframes

**Untouched:** `faxGeometry`, `faxThumbCache`, `PageImage`, routing, sizing math,
`FacsimilePageViewerMobile.js` (single-page vertical — a curl doesn't fit; a
horizontal slide/fade is a separate follow-up).

## Explicitly rejected

- **`react-pageflip` / StPageFlip / turn.js** — they own the whole book DOM with
  fixed-size pages; adopting one conflicts with URL-driven nav + variable aspect
  + dynamic sizing. That would be the full refactor we're avoiding.

## Known imperfections (prototype)

- Back-face width uses the starting slot width (slight mismatch on unequal scans).
- `PageStack` widths shift by one leaf per turn; stacks are frozen visually under
  the overlay and settle on commit.
- Blank first/last leaves render a plain backing face.
