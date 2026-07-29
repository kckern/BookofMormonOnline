# FaxVerseModal cross-page crop height — image-driven, jank-free reserve

**Date:** 2026-07-29
**Status:** Approved (design)
**Area:** `frontend/webapp/src/views/Facsimiles/`

## Problem

When a verse straddles a page break (or a column break) — e.g. one line at the
bottom of page N and three lines at the top of page N+1 — the `.faxVerseModal-cutout.landscape`
box in the verse inspector reserves a height sized for **only the fragments on
the page that was clicked**, not the whole verse. Observed with
`fax/1842/jacob.1.8` (1 line + 3 lines): the modal reserved a ~1-line-tall slot,
and the full crop was shrunk to fit it and became unreadable.

### Root cause

Boxes are grouped **per scan page**, upstream of the modal:

- `faxVerseData.js#mergeBoxes` builds `byPageVerse: Map<imagePage, Map<verseId, boxes[]>>`.
  A verse straddling a page break appears under **two `imagePage` keys**, each
  holding only that page's fragments.
- `faxVerseData.js#hydrateVerses` emits a **separate verse object per page**, each
  carrying only that page's `boxes`.
- `useFaxVerses.js` exposes this as `versesByPage`; the viewer opens the modal
  with the verse object from the **specific page clicked**
  (`FacsimilePageViewer.js` `versesByPage.get(page.pageNumInt)` → `OPEN`).

So `FaxVerseModal`'s `modalBoxes = verse.boxes` contains only one page's
fragments. `renderBox.h = boxes.reduce((s,b) => s + b.h, 0)` therefore sums a
single page's height. Meanwhile the crop image is requested by `verse_id` alone
(`/fax/render/${version}/crop/wfull/ids/${verse.verse_id}.jpg`) and the render
service stacks the **entire** verse (all fragments, both pages) into one tall
image. Result: a full-height crop crammed into a one-line reservation, displayed
via `backgroundSize: contain` → shrunk and unreadable.

## Approach (A: self-correct from the loaded image)

The crop image itself is the exact source of truth for the stacked aspect ratio,
regardless of the per-page box split. `FaxVerseZoom` already loads a hidden
`<img>` and reads its `naturalWidth`/`naturalHeight` (for the magnifier). Lift
that value to the modal and let it drive the reserved height once known. The
per-page box estimate remains the instant pre-load reservation so there is no
zero-height flash.

This was chosen over reuniting the cross-page boxes upstream (Approach B) because:

- The image is the ground truth; re-deriving the server's stacking geometry on the
  client is only an estimate (inter-fragment padding, etc. can differ).
- It is a small, localized change.
- Correctness is guaranteed for **every** case — cross-page, cross-column,
  single-box — because the box adopts the actual image aspect.

Trade-off: for a cross-page verse the pre-load estimate is short, so there is a
one-time height correction after the image loads. The whole design goal below is
to make that correction read as a single smooth, intentional expand.

## Design

### Data flow

- `FaxVerseZoom` gains an `onNaturalSize({ w, h })` prop, invoked from its
  existing hidden-`<img>` `onLoad` (same value it already captures for zoom — no
  extra network request).
- `FaxVerseModal` holds `natSize` state and passes the callback down.
- **Single aspect source:** `cropAspect = (natSize && natSize.w) ? natSize : aspectBox`.
  Both the `useLayoutEffect` height measurement and the fallback inline style read
  `cropAspect`. Nothing derives height from two different aspect sources.

### Height driving

One explicit pixel height (`cutoutH = measuredWidth × cropAspect.h / cropAspect.w`),
eased by the existing CSS `transition: height 0.28s cubic-bezier(0.4,0,0.2,1)` on
`.faxVerseModal-cutout`:

1. **First paint** — `cutoutH` unknown → render with `aspect-ratio: ${aspectBox.w} / ${aspectBox.h}`
   (reserves height, no zero-height flash). `useLayoutEffect` measures width and
   sets `cutoutH` from the **same** estimate → identical value → zero motion.
2. **Image load** — `natSize` arrives → `cropAspect` flips to the true aspect →
   `cutoutH` recomputes → height eases **once** to the correct value. The crop
   (`backgroundSize: contain`) scales up in lockstep, reading as a deliberate
   expand rather than a correction.

### Anti-jank guarantees

- **Consistent aspect source** — because both the measure-effect and the fallback
  read `cropAspect`, a window resize or re-measure after correction never bounces
  back to the estimate. No flip-flop.
- **rAF-debounced `ResizeObserver`** (already present) absorbs measurement jitter.
- **No feedback loop** — width is `100%` (not height-derived), so setting height
  cannot retrigger a width change.
- **Single-page verses do not move** — estimate ≈ true aspect → ~0px delta → no
  visible animation. Only cross-page/column verses animate (the currently-broken
  case) — a strict improvement.
- **Content below slides, does not jump** — verse text and nav ride the eased
  height; the modal card grows in step. That easing is the "intentional" feel.
- **Verse switching stays consistent** — on prev/next, `FaxVerseZoom` remounts
  (`key=verse_id`), `natSize` resets, the new verse shows its estimate then eases
  to true on load — same smooth path, matching the height animation prev/next
  already uses.

## Scope

- `FaxVerseZoom.jsx` — add `onNaturalSize` prop, call it from the existing
  `onLoad` (keep internal `nat` state for the magnifier).
- `FaxVerseModal.jsx` — add `natSize` state + callback; introduce `cropAspect`;
  route both the `useLayoutEffect` and the fallback style through `cropAspect`.
- No CSS change required — the existing `height` transition and `landscape`
  rules already support the behavior. (`FacsimilePageViewer.scss:953-966`.)
- No backend / data-layer change. The per-page box split in
  `mergeBoxes`/`hydrateVerses` is left as-is.

## Out of scope

- Reuniting cross-page boxes upstream (Approach B). Deferred; only revisit if the
  eased grow distance feels too large in practice, in which case B narrows the
  pre-load estimate so the grow is small.
- The non-render CSS-crop fallback path (`FaxVerseModal.jsx` `verse.pageAssetUrl`
  branch, the non-`landscape` cutout). It is not the reported case and does not
  use the render crop.

## Acceptance criteria

1. Opening `fax/1842/jacob.1.8` (or any cross-page verse), from either page,
   reserves a box tall enough to show the full stacked crop legibly.
2. The height settles via a single smooth eased transition — no snap, no
   zero-height flash, no reflow-jump of the text below.
3. Single-page verses show no visible height animation on open (unchanged feel).
4. Prev/next navigation between verses of differing height remains smooth.
