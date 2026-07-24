# Facsimile mobile viewer — continuous vertical scroll

**Date:** 2026-07-24
**Status:** design / awaiting decisions
**Scope:** `FacsimilePageViewerMobile.js` (rewrite) + supporting bits; desktop viewer untouched

## Goal

Replace the paged, one-page-at-a-time mobile viewer with a **continuous
vertical scroll** — every page stacked full-width like a PDF / archive.org
mobile reader — with page numbers + references in horizontal rails between
pages, and drawer-based navigation (scrubber / contact sheet / jump-to-ref).

## Why change

The current mobile viewer forces discrete page turns (swipe + slider). On a
phone, vertical scroll is the natural gesture for a long scanned book; page
turns fight it and make skimming slow.

## Architecture

### Virtualized column (no new deps)
- Single vertical column; each page a full-width slot.
- Hand-rolled **IntersectionObserver windowing** — only pages near the viewport
  mount (full scans are multi-MB). Spacer divs above/below the mounted window
  preserve total scroll height.
- **Height estimation from the aspect-ratio cache** (the Tier-1 cache from the
  smoothing thread): each slot reserves its correct height *before* the image
  loads, so scroll height is stable — no rug-pull, no scroll-position jump.
  Reconcile the estimate against the measured natural height on load (estimate
  ≈ actual, so negligible reflow).
- Progressive image via `PageImage`: thumb/blur placeholder → full scan swaps in
  as the slot nears the viewport (`rootMargin` preloads ahead).

### Rails between pages
- A slim horizontal rail between each page: `— Page 25 · 1 Nephi 10:9–19 —`
  (printed folio + the reference on that page). Doubles as page separator and
  per-page "where am I."
- A **sticky mini-header** shows the current page + reference, updated as the
  viewport-centered page changes (IntersectionObserver on slot centers).

### Header
- Reuse `FaxBreadcrumbs` (edition switcher) — switching editions carries the
  reference and scrolls to the mapped page.

### Navigation drawers
Candidate affordances (final set = decision D1):
1. **Scrubber sheet** — bottom slider + thumbnail preview (reuse existing) to
   fling across the book; release → scroll-to. For long jumps scrolling can't do.
2. **Contact-sheet drawer** — slide-up thumbnail grid (reuse grid thumbs); tap →
   scroll-to. Mobile table-of-contents / grid equivalent.
3. **Jump-to-reference** — enter/pick a scripture ref → scroll to the page.

### Position ↔ URL
- Deep link `/fax/{slug}/{page|ref}`: resolve target index → scroll to it (after
  ratio-based height estimation so the offset is right on first paint).
- Scroll → `history.replace` (debounced) as the centered page changes, so Back
  and the breadcrumb reference stay in sync. Guard against feedback (don't
  re-scroll when the URL change originated from our own scroll).
- Edition switch: carry ref → scroll to mapped page.

### Perf / robustness
- IntersectionObserver everywhere (windowing + current-page), no scroll-loop.
- `prefers-reduced-motion`: instant `scrollTo` instead of smooth.
- Keep `key`-by-slug remount semantics so switching editions resets cleanly.

## Decisions (2026-07-24)
- **D1 — drawers**: **Scrubber sheet + Jump-to-reference**. No contact-sheet drawer.
- **D2 — rails**: **Inline rails between every page + sticky header**.

## Out of scope / follow-ups
- Desktop viewer (unchanged).
- Two-up spreads on landscape tablet (could reuse desktop path via breakpoint).
