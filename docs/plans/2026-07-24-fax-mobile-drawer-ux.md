# Fax Mobile Drawer UX — Implementation Plan

**Date:** 2026-07-24
**Status:** in progress — items 1, 4, 7 done & verified; 2, 3, 5, 6 remaining

## Decisions confirmed by KC
- Mobile-only (desktop keeps modal + hover tooltip).
- Current page/ref stays in the per-page divider rails (no persistent chip/label).
- ScripturePopup on mobile is IN scope — route it through the drawer too.

## Goal
On mobile (`isMobile()` = viewport ≤ 900px), the facsimile reader adopts the app's
right side-drawer pattern for every overlay. **No centered modals, popups, or hover
tooltips on mobile — everything is a drawer or a tap.** Desktop is unchanged.

## Architectural decisions
- **Drawer mechanism:** `react-modern-drawer` (already a dependency; the same lib
  `_Common/Drawer.js` uses), rendered *locally* inside the Facsimiles views —
  `direction="right"`, size ~90vw, swipe-to-close. This matches the MobileDrawer
  look without coupling fax to the global `appController.popUp` state.
- **Responsive split:** branch on `isMobile()`. Desktop keeps the centered
  `FaxVerseModal` + hover tooltip exactly as-is.
- **One source of verse-inspector content** shared by the desktop modal shell and
  the mobile drawer shell (extract the current modal body).

## Work items

1. **Mobile skips the contact sheet → infinite scroll.** ✅ DONE
   `Facsimiles.js`: `showGrid = isGridMode && !isMobile()`.

2. **Verse inspector → drawer on mobile.**
   Extract the modal body into a shared `FaxVerseInspector`. Desktop renders it in
   the existing centered card; mobile renders it in a right `Drawer`. Prev/next +
   image + text carry over.

3. **Tappable verses on the mobile scroll viewer (no hover).**
   The mobile viewer has no per-verse hotspots today. Fetch verse boxes for the
   windowed (visible) leaves via `useFaxVerses`, overlay tap targets per page row,
   tap → open the verse drawer. Tap-only: no hover dim, no tooltip.

4. **Breadcrumb edition switcher → drawer on mobile.**
   `FaxBreadcrumbs`: on mobile, the chevron opens the edition list in a right
   `Drawer` (avatar + title rows) instead of the absolute-positioned dropdown.

5. **No tooltips/popups on mobile (audit).**
   Confirm `FaxVerseCutout`'s hover tooltip is desktop-only. The mobile page-ref tap
   (`openScripture` → `ScripturePopup`) should also resolve to the drawer, not a
   popup — verify what ScripturePopup does on mobile and route it through the drawer
   if it doesn't already.

6. **Routing parity on mobile.**
   `/fax/<ed>/<ref>` and `/fax/<ed>/<verse-id>` on mobile resolve to the page
   (scroll there) **and** open the verse drawer; verse-id resolves to a ref and the
   URL is rewritten (never a raw verse-id in the URL) — mirroring the desktop
   taxonomy. Page/roman slugs just scroll. Cross-version + hacked-URL suppression
   applies here too.

7. **Remove the mobile header rail; floating thumbscroller button.**
   Drop `.faxScrollHeader` (the sticky "Page X · ref · ⇅" rail under the breadcrumb).
   Add a floating button, **bottom-left**, that opens the existing scrubber sheet
   (`.faxScrubSheet` — fling slider + preview thumb + jump-to). The current-page/ref
   context moves into the scrubber preview.

## Sequencing
4 (breadcrumb drawer) → 2 (inspector drawer shell) → 3 (mobile hotspots) →
6 (routing parity) → 7 (floating button + rail removal) → 5 (popup audit).

## Verify
Playwright at a 390×844 mobile viewport against `localhost:8200`: grid skipped,
verse tap opens the drawer (no tooltip), breadcrumb opens the drawer, deep-link
refs scroll+open, floating button opens the scrubber, no centered modal anywhere.
