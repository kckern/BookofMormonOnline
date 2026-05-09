# Facsimile Page Viewer overhaul — slider + tooltip navigation

**Status:** Likely superseded by post-2024 Facsimiles work on dev, but the design ideas are preserved here in case any are still relevant.
**Source:** `origin/FaxFix` branch, single commit `a1d519f "Faxfix"` (2024-10-26). Diff is +490 / −358 across `Facsimiles.js` and `Facsimiles.scss`.
**Branch deletion plan:** Branch will be removed; this spec is the record.

## Concept

Replace the existing leaf-cursor-based facsimile navigation (where each URL points to a specific leaf and prev/next URLs are pre-computed) with a **slider-driven page navigator** with hover tooltips and mobile-aware behavior.

## Why it mattered

- The original viewer rendered prev/next buttons keyed off `leafCursor` math (`leftPage = activeLeaf.isRightSide ? leafIndex[activeLeafIndexInt - 1] : activeLeaf`, etc.) — fragile when leafIndex shifts and not friendly for jumping multiple pages at once.
- Slider lets users scrub quickly through a long facsimile (e.g. printer's manuscript) without N clicks.
- Tooltip lets users see what page they're hovering before committing.
- Mobile users in particular benefit from a slider over button-mashing.

## What was built (in the abandoned commit)

The branch refactored `FacsimilePageViewer` to introduce:

- New state: `currentPageIndex`, `sliderValue`, `showTooltip`, `tooltipContent`.
- `useHistory` for programmatic navigation instead of `<Link>` components.
- `isMobile()` detection used to gate which controls render.
- A range-input slider whose value is the page index; on commit, `history.push` to that page's URL.
- A floating tooltip element following the slider thumb showing the page number / page label as the user drags.
- ~250 lines of new SCSS in `Facsimiles.scss` to support the new layout (much of the diff was reflow rather than additions).

The old `prev/next URL` flow was removed in favor of slider-driven navigation.

## Why it didn't ship

- Branch is 19 months stale relative to current dev.
- Dev has had 5+ subsequent commits in the Facsimiles area: `Update FacsimilePageViewer.js`, `Improve facsimile page viewer layout and resizing`, `Improve facsimile page viewer reference handling`, `Handle reference-based page URLs in facsimile viewer`, `Optimize grid tile sizing and rendering in Facsimiles`. Some of those may have re-solved or sidestepped the same problems; some may have entrenched the leaf-cursor model further.
- Merging would conflict heavily; the cleanest path is reading this spec, looking at the current `FacsimilePageViewer.js`, and deciding what (if anything) is still missing.

## How to pick this up later

1. **First, audit the current state.** Read the current `frontend/webapp/src/views/Facsimiles/Facsimiles.js` and `FacsimilePageViewer.js`. The slider may already exist (if a later commit ported the idea), or the leaf-cursor model may still be in place.
2. **Preserve URL stability.** Whichever flow ships, deep-linkable per-page URLs (`/fax/<slug>/<pageSlugLeaf>`) must still work — the original leaf-cursor system was deep-link-friendly even if cumbersome.
3. **Mobile slider gotcha.** The original spike used `isMobile()` (utility detection). Today's dev may have a different mobile-detect helper; reuse what's already in the codebase rather than adding another.
4. **Tooltip contents.** Show the page label (e.g. "Page 24" or section title) rather than just the leaf index. The `leafIndex` array already has the data.
5. **Keyboard support.** The original had no arrow-key support for the slider. Add it.
6. **Reference jumping.** Dev's `Handle reference-based page URLs` commit suggests a pattern for jumping to a verse-referenced page; the slider should preserve this — when arriving via verse URL, the slider should snap to the relevant page.

## Open questions

- Is there still a UX problem to solve here? If users aren't complaining about the current navigation, this might be permanently shelved. Look at telemetry / `leaderboard`-adjacent usage data before reviving.
- Tablet vs phone — the original `isMobile()` is binary; tablet users may want desktop-style controls.
