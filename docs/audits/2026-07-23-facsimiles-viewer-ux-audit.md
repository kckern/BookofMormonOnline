# Facsimiles Viewer — UX Audit & Polish Roadmap

**Date:** 2026-07-23
**Scope:** `frontend/webapp/src/views/Facsimiles/` — the page-turning document
viewer for scanned Book of Mormon editions.
**Goal:** Bring the experience from "the pieces are in place but it feels
stilted/amateurish/janky" up to a world-class document reader (à la the
archive.org BookReader) on desktop and mobile.
**Method:** Full read of all nine source files + SCSS + the shared `useSwipe` /
`isMobile` helpers. Cross-referenced with the two prior fax audits
(`2026-07-18-fax-verse-highlight-assets.md`, `2026-07-23-fax-stray-bounding-boxes.md`).

---

## TL;DR — the five things that make it feel amateurish

1. **There is no zoom.** A scanned-document viewer whose entire job is showing
   legible page images has no way to magnify. Pages are hard-fit to the viewport
   height and that's it. This is the single biggest gap vs. archive.org and the
   first thing a reader reaches for. (§2.1)
2. **Every page turn is a full URL navigation.** `history.push` on each
   forward/back re-mounts state, re-runs the init effect, and swaps the `<img>`
   with no transition — so turns *flicker* and *jump* in width when adjacent
   spreads have different aspect ratios, instead of animating like a page flip.
   (§2.2, §2.3)
3. **The passage-highlight feature is built, tested, and completely unwired.**
   `useFaxHighlight.js` + `FaxHighlightOverlay.js` + their tests + the entire
   `.faxHighlightLayer` / `.faxContinuesHint` SCSS block exist, but **nothing
   imports them.** Navigating to `/fax/1830/alma.32.21` resolves to the right
   page but never draws the highlight the code was written to draw. Dead
   headline feature. (§2.4)
4. **The grid renders every page at once with no virtualization.** A 380-leaf
   edition mounts ~380 `PageImage` components (each an image + shimmer +
   overlay), every tile flagged `willChange: transform`. Scroll is heavy and
   first paint is slow. (§2.5)
5. **Two SCSS files fight over the same selectors.** `.page`, `.page img`,
   `.pageContainer`, `.facsimile-navigation`, `.custom-slider`, `.custom-tooltip`
   are each defined in *both* `Facsimiles.scss` and `FacsimilePageViewer.scss`
   with conflicting values (`object-fit: fill` vs `contain`, different nav
   backgrounds, different thumb widths). Whichever wins is a specificity
   accident, not a decision. (§2.9)

---

## Implementation status (2026-07-23) — branch `feat/fax-viewer-polish`

Executed via the plan `docs/plans/2026-07-23-facsimiles-viewer-fixes.md`
(subagent-driven, per-task TDD/verify). **Automated gates green:** 19/19 module
unit tests pass; no new eslint errors (only the pre-existing dead-highlight
test-lint remains); `react-app-rewired` (live dev server) compiled the branch
with warnings only.

**Resolved:**
- §2.14 leafIndex memoized (extracted + tested `buildLeafIndex`, faithful to the
  original `i = idx - pgoffset`)
- §2.16 `pgOffset`/`pgoffset` resolved once via tested `resolvePgOffset`
- §2.15 list fetch moved to `useEffect` + error Alert
- §2.13 stale-closure resize effect replaced by `useElementSize` (−83 lines)
- §2.2 `history.replace` for turns; no-shimmer-for-warm images (tested
  `faxThumbCache`); page-box width transitions removed
- §2.5 grid `loading="lazy"` + `will-change` dropped (virtualization still
  deferred — see below)
- §2.3 single slider source of truth + mobile drag preview
- §2.11 PageStack hover: prefetch window + URL-keyed no-flash + rAF-throttle
- §2.10 `normalizeStackWidths` (tested, fixed-footprint) + corrected stripe
  gradient
- §2.9 removed the dead `object-fit:fill` global rule (the correctness slice)
- §2.6/§2.8 slim toolbar + compact title + router Escape + page indicator/jump
- §2.17 aria labels + keyboard-reachable stacks + scoped arrow handling
- §2.4/§2.19 passage-highlight overlay **integrated** (ref preserved via `?ref=`)

**Deferred (tracked):**
- Full SCSS consolidation beyond the dead rule (§2.9) — needs before/after
  screenshot diffing; some "duplicate" globals carry unique props
  (e.g. `.pagesContainer` background). Follow-up task logged.
- Profile-gated features — zoom/pan/fullscreen (§2.1), gesture layer (§2.7),
  grid virtualization (§2.5), filmstrip (§4) — sibling plans, per §0's gate.

**Still required before merge:** manual browser regression sweep on
`http://localhost:8200/fax/...` (dev server is live on this branch) — automated
gates can't verify visual layout, highlight-box alignment, or drag UX.

---

## 0. Second-opinion reconciliation (2026-07-23)

This audit was reviewed against the code a second time. Several claims were
**wrong or overstated** and are corrected below; several **real bugs were
missed** and are added. The review's core verdict — *"trustworthy on the whats,
shaky on the whys, blind to the actual code-level bugs; audited by reading, not
by running"* — is accepted. Read this section as authoritative where it conflicts
with the findings below it.

### Corrections to claims in §2

- **§2.2 mechanism is wrong.** A page turn does **not** re-mount the component —
  `/fax/1830/12` → `/fax/1830/14` match the same route with the same key, so
  React Router v5 keeps the instance and state. The real flicker sources are
  (a) `PageImage` resetting `loaded=false` on every `src` change
  (`PageImage.jsx:12-17`), flashing the shimmer even for HTTP-cached images, and
  (b) the `width 0.15s` transitions on the page boxes
  (`FacsimilePageViewer.js:613,633`). The recommended fixes (`history.replace`,
  stable spread box, no width animation) still stand — the *diagnosis* was wrong.
- **§2.10 "width/hit-test drift ±1" is FALSE.** `adjustedPageIndex` is always
  even, so parent `floor(adjustedPageIndex/2)` and child even-index-count are
  equal for both parities. Two formulas is a real fragility; the observable bug
  is not. Retract.
- **§2.10 "front-matter placeholders inflate the stack" conflates two arrays.**
  The `[0,0]` placeholders live in `pageIndex` (the verse index); the
  `leafIndex` front-matter entries are **real roman-numeral scans** with real
  `000.NN` asset URLs. Counting them as book thickness is arguably correct.
  Retract.
- **§2.9 `object-fit: fill` scaremongering.** `.page img` (0,1,1) loses
  deterministically to the viewer's nested `.faxPageViewer .page img` (0,2,1) —
  scans are not one refactor from stretching. The *duplication* is still worth
  consolidating (some other pairs genuinely tie on import order), but the fill
  rule is not a latent disaster.
- **§2.6 "add click-left/right-half to turn" — already shipped.**
  `renderPage(leftPage, handleSwipeRight)` / `renderPage(rightPage,
  handleSwipeLeft)` (`FacsimilePageViewer.js:624,641-644`) already turn the page
  on image click. Don't rebuild it.
- **Severity recalibration:** §2.11 (hover-thumb lag) → **Medium**, not High
  (it's a shimmer flash). §2.10 (stack cosmetics) → **Medium/Low** polish even
  with the KC "keep the stacks" directive. The stripe-gradient degeneracy claim
  stands but "collapses to a flat band" is dramatic — there is visible 2px
  texture; it simply doesn't encode page count.

### Real bugs the audit missed (these outrank most of §2)

- **§2.13 — The 130-line resize throttle is defeated by a stale closure.**  🔴
  The effect has `[]` deps (`FacsimilePageViewer.js:284`) but `processResize`
  reads `containerSize.width/height/top` from the closure (`:177-179,195`),
  which is frozen at the initial `{width:0}`. So `widthDiff` is always huge,
  `hasSizeChanged` always true, the entire MIN_UPDATE_INTERVAL/pending machinery
  is dead code, and `setContainerSize` fires a new object on every RAF'd tick.
  This isn't a "maintenance hazard" (as §2.8 called it) — it's a bug that
  neuters the mechanism. Replace the whole thing with a standard
  `ResizeObserver` hook; it's a fix, not gold-plating.
- **§2.14 — `leafIndex` is rebuilt every render, unmemoized.**  🔴 Likely the
  real "stilted turn" culprit. `Facsimiles.js:45-68` builds ~380 fresh objects
  per parent render, each calling `getRefFromIndex` → `generateReference` over a
  verse array. The new array identity also re-triggers the viewer's init effect
  **and** the ±4 full-res preload effect (9 `new Image()`s) on every render. One
  `useMemo` keyed on `item.slug` + `pageIndex` fixes it. Bigger perf win than
  anything in §2.5.
- **§2.15 — Fetch-in-render + no error/empty states anywhere.**  🟠
  `if (!FaxList) BoMOnlineAPI({ fax: "pdf" }).then(...)` sits in the render body
  (`Facsimiles.js:462`) — a side effect per render; on failure it's an eternal
  `<Loader/>` that re-fires forever. The faxIndex fetch (`:33-37`) has no
  `.catch`, and `const { pages } = r?.fax[indexRef]` throws if `r.fax` lacks the
  key (the optional chain only guards `r`). There is **no error or empty state**
  in the entire viewer. Move to `useEffect` + add failure UI.
- **§2.16 — `pgOffset` vs `pgoffset` field-name ambiguity.**  🟡 Line 31
  destructures `pgOffset`; line 40 destructures `pgoffset` from the same `item`;
  the redirect effect hedges *both* (`:347-348`). One reader is silently getting
  `undefined` — front-matter page math is running on a coin-flip. Pin the field
  name.
- **§2.17 — Accessibility is worse than the §2.12 footnote admits.**  🟡
  `PageStack` has `role="button"` but no `tabIndex` and no key handler
  (`PageStack.jsx:146-147`) — announced to screen readers, unreachable by
  keyboard. Range inputs have no `aria-label`/`aria-valuetext`. Nav buttons are
  bare glyphs (`&#8249;`) with no accessible name. And the window-level keydown
  handler `preventDefault`s arrows unconditionally
  (`FacsimilePageViewer.js:428-431`), breaking native arrow operation of the
  focused slider.
- **§2.18 — Test coverage is inverted.** The only tests in the module
  (`__tests__/`) cover the **dead** highlight feature; the two shipped viewers
  have zero coverage. Any refactor flies blind.
- **§2.19 — The §2.4 highlight-wiring recipe won't work as written.** For
  indexed editions the redirect effect `history.replace`s the reference URL to a
  *numeric* page before the viewer settles (`Facsimiles.js:370-373`), so
  `useFaxHighlight(item.slug, pageNumber)` receives a page number, and
  `lookupReference(number)` yields nothing (`useFaxHighlight.js:35`). Wiring it
  up requires *preserving the reference* (local state, a query param, or
  dropping the redirect) — real design work this audit didn't scope.

### The actual 20%-effort / 80%-value ship list (do this BEFORE the Phase plan)

1. `history.push` → `history.replace` (2 lines: `FacsimilePageViewer.js:401`,
   `FacsimilePageViewerMobile.js:122`). Kills history pollution.
2. Stop `PageImage` from flashing the shimmer for already-loaded `src` + delete
   the `width 0.15s` transitions (~20 lines). Kills the flicker + resize jiggle.
3. `useMemo` the `leafIndex` build (§2.14). Kills the per-render O(pages) churn.
4. `loading="lazy"` on `PageImage`'s `<img>` + drop `willChange`/`translate3d`
   from grid tiles (§2.5). Fixes 80% of the grid cost — the network stampede
   matters more than DOM-node count; virtualization can wait for a profile.
5. Replace the stale-closure resize effect with a standard hook (§2.13).
6. Reuse the existing desktop slider tooltip in the mobile slider (§2.3).
7. Zoom **MVP only**: `+ / − / fit` buttons + wheel + drag-pan (§2.1). Defer
   double-tap-to-point, tiled sources, and the three-view-mode system.
8. Decide integrate-vs-delete on the highlight feature (§2.4/§2.19).

Everything else (gesture layer, `react-window` virtualization, page-curl
animation, filmstrip + shared `<FaxThumb>`) is **Phase 2+ and should not be
funded without a profile** confirming the cheap fixes above didn't already
resolve the perceived jank.

---

## 1. What's actually good (keep these)

- **The book-spread mental model is right.** Even-left / odd-right pairing with a
  blank facing page for the cover is the correct metaphor.
- **PageStack is a genuinely nice idea.** The 1px-per-page edge stripes on either
  side of the spread, with a hover thumbnail + reference tooltip, is a
  distinctive way to scrub a physical book. It just needs polish, not removal.
- **Progressive image loading** (`PageImage`): shimmer + blurred thumb underlay +
  fade-in, with a page/reference label during load, is the right pattern.
- **Reference-aware routing.** `/fax/{edition}/{scriptureRef}` mapping a verse to
  the physical page it appears on is a strong scripture-specific feature that
  archive.org can't do. `last` and numeric-overflow clamping are thoughtful.
- **Adjacent-page preloading** (±4 desktop, ±3 mobile) is the right instinct.

The bones are good. The problems below are execution, not architecture.

---

## 2. Findings (severity-ordered)

### 2.1 — No zoom / pan / fullscreen  🔴 Critical — the defining gap

**Where:** entire module. Grep for `zoom|scale|wheel|pinch|fullscreen|dblclick`
returns only the (dead) highlight entry animation.

Pages are sized to fit viewport height (`calculatedHeight` in
`FacsimilePageViewer.js:329-386`) and images are `object-fit: contain`. The user
cannot enlarge a page to read fine print, footnotes, or marginalia — the whole
reason to look at a facsimile.

**World-class bar (archive.org BookReader):** scroll-wheel / +/− buttons /
pinch-to-zoom, double-click to zoom to a point, drag-to-pan when zoomed,
one-page vs two-page vs thumbnail modes, and a fullscreen toggle.

**Recommendation:**
- Add a zoom layer around the spread. Minimum viable: `+` / `−` / "fit"
  buttons in the nav bar and `wheel` (ctrl/⌘+wheel or plain wheel) → scale the
  `spreadInner` via `transform: scale()`; when scaled > 1, enable pointer
  drag-to-pan and switch overflow to `auto`.
- Double-click / double-tap toggles between fit and ~2× centered on the cursor.
- Mobile: pinch-to-zoom (the current `useSwipe` only tracks single-touch X;
  it needs a two-pointer gesture path, see §2.7).
- The full-resolution `pageAssetUrl` is already loaded, so zoom has real pixels
  to show. For deeper zoom, the media server exposes
  `/fax/render/{version}/crop/w{N}/...` (per the stray-boxes audit) — a tiled/
  higher-res source if `pageAssetUrl` proves too soft.
- Add a **fullscreen** button (`element.requestFullscreen()`); a document reader
  living inside the app chrome at partial height wastes the screen.

### 2.2 — Page turns are URL navigations, so they flicker instead of animate  🔴 Critical

**Where:** `handlePageChange` → `history.push(...)`
(`FacsimilePageViewer.js:397-403`, `FacsimilePageViewerMobile.js:117-124`).
Each turn changes the route, which re-runs the init `useEffect`
(`:37-108`) to recompute `currentPageIndex`, which swaps the `<img src>`.

Consequences:
- **No page-turn animation.** Archive.org's signature is the curl/slide of a leaf
  turning. Here the old image is simply replaced by the new one after a network
  fetch (mitigated by preload, but still a hard cut).
- **Width jump.** The `.page` divs animate `width 0.15s`
  (`:613`, `:633`) whenever `leftRatio`/`rightRatio` change, so when consecutive
  spreads have slightly different scan dimensions the whole spread visibly
  *resizes* on each turn — reads as jank, not motion design.
- **History pollution.** Every single page turn pushes a history entry, so the
  browser Back button steps one leaf at a time instead of leaving the viewer.

**Recommendation:**
- Decouple "which spread is showing" from the URL. Keep local index state as the
  source of truth for turning; sync the URL with `history.replace` (not `push`)
  so Back exits the viewer and deep links still work.
- Add a real transition: cross-fade at minimum; ideally a horizontal
  slide/curl. Pre-render the incoming spread offscreen and animate it in over the
  outgoing one so there's never a blank frame.
- Lock a **stable spread box** (fixed width/height for the current viewport)
  and letterbox pages of odd ratios inside it, so the frame doesn't resize
  every turn. Animate *page content*, never the container geometry.

### 2.3 — Doubled, desyncing slider state + drag has no live feedback  🟠 High

**Where:** `currentPageIndex` **and** `sliderValue` are separate state
(`FacsimilePageViewer.js:21-22`). `onChange` updates only `sliderValue`;
navigation fires on `onMouseUp`/`onTouchEnd` (`:713-714`).

- **Desktop:** while dragging you see the thumb move but the page doesn't update
  until release. The hover *tooltip* (`handleSliderMouseMove`, `:481-540`) only
  fires on `mousemove`, which during a drag is inconsistent across browsers, and
  is a separate code path from the drag value — so the preview and the thumb can
  disagree.
- **Mobile:** `FacsimilePageViewerMobile.js` has **no tooltip at all**. Dragging
  the slider across a 380-page book gives zero preview — you release blind and
  hope.
- `handleSliderMouseMove` rebuilds a full JSX tooltip (two `lookupReference`
  calls + `generateReference` + `<img>` elements) **on every mousemove event**
  (`:500-531`). That's a lot of work per pixel.

**Recommendation:**
- Single source of truth: drive the slider from `currentPageIndex`; on drag,
  update a lightweight `previewIndex` and show the thumbnail preview live
  (desktop tooltip *and* mobile — a floating preview above the thumb works on
  touch too). Commit on release.
- Memoize/throttle the preview: compute page refs once per index change, not per
  mousemove; throttle to animation frames.
- Consider making the slider update the page live (scrubbing) with a debounced
  image swap — that's what makes archive.org's scrubber feel immediate.

### 2.4 — The passage-highlight feature is fully built but never rendered  🟠 High (dead headline feature)

**Where:** `useFaxHighlight.js`, `FaxHighlightOverlay.js`, their tests, and the
`.faxHighlightLayer` / `.faxHighlightBox` / `.faxContinuesHint`
SCSS (`FacsimilePageViewer.scss:381-418`) all exist. **No component imports any
of them** (verified by grep — the only references are the definitions and their
own tests).

So the pipeline is: reference routing already lands the user on the correct page
(§1), the box API (`/fax/boxes/{version}/ids/...`) is implemented, the overlay
that would draw the highlight is implemented and unit-tested — and then it's
just… not on screen. A reader who follows `/fax/1830/alma.32.21` sees the page
but not *where on the page* the verse is. That's the payoff the whole
reference-routing machinery was built for.

(Note: the box *data* has known quality issues — see
`2026-07-23-fax-stray-bounding-boxes.md`, 26 stray-box pairs — but that's
orthogonal; the feature is dark regardless.)

**Recommendation:**
- Wire `useFaxHighlight(item.slug, pageNumber)` into both viewers and render
  `<FaxHighlightOverlay>` inside the `.page` box, passing the known
  `leftPageWidth`/`rightPageWidth` as `displayedWidth` (desktop) or letting it
  self-measure (mobile). Group boxes by page and render only those matching the
  displayed leaf(s).
- Add a subtle "verse continues →" affordance (the `.faxContinuesHint` styles
  are already there) when the passage spills onto the next page.
- Gate it behind the reference route so plain page browsing isn't decorated.
- If it's being intentionally parked, delete the dead code + tests so the next
  developer doesn't think highlighting works. Right now it's Schrödinger's
  feature.

### 2.5 — Grid view mounts every tile, no virtualization  🟠 High

**Where:** `FacsimileGridViewer` (`Facsimiles.js:117-276`) maps **all**
`validLeaves` to `<Link><PageImage/></Link>`; each tile carries
`willChange: transform` + `translate3d` (`:254-257`).

- 380 leaves → 380 image wrappers, 380 shimmer nodes, 380 overlays, all live.
  First paint is slow; scrolling a few hundred `will-change` layers is memory-
  and compositor-heavy.
- `previewSrc === src` (both `thumbAssetUrl`, `:262-263`) so the "progressive"
  path is a no-op in the grid — the shimmer shows, then the same image fades in;
  there's no low-res→high-res step.
- Aspect detection samples `validLeaves[10]` (`:145`) — a magic index that is
  out of range for editions with < 11 valid leaves, silently falling back to the
  default ratio.

**Recommendation:**
- Virtualize the grid (`react-window`/`react-virtuoso`, or a lightweight
  `IntersectionObserver` + `loading="lazy"` on the `<img>`). Only mount tiles
  near the viewport.
- Drop `willChange: transform` from static tiles — it's meant for elements about
  to animate, not a whole gallery. Keeping it pins hundreds of layers in memory.
- Sample the aspect ratio from the first *valid numbered* leaf (or clamp the
  index), not a hard-coded `[10]`.

### 2.6 — Discoverability & control affordances are thin  🟡 Medium

- **No persistent page indicator on desktop.** Mobile has `{i+1} / {total}`
  (`Mobile:237-239`); desktop shows only the scripture reference in
  `.pageReferences`, which is blank for front-matter pages. A reader can't tell
  "page 212 of 380" at a glance, and there's no **jump-to-page** input.
- **Arrow Up/Down silently switches editions** (`:432-466`). Powerful, but
  totally undiscoverable and surprising — a user pressing Down expecting to
  scroll suddenly jumps from the 1830 to the 1837 edition. Needs a visible
  volume switcher (prev/next edition chips or a dropdown) and/or a hint.
- **`Escape` closes via `document.getElementById("fax_back").click()`**
  (`Facsimiles.js:72-74`) — reaching into the DOM to synth-click a link is
  fragile; call the router directly.
- **Keyboard help / shortcuts** aren't surfaced anywhere. Arrow keys, Home/End
  (jump to first/last), and `+`/`−` (zoom, once added) should be listed.
- **Nav arrows are tiny grey circles** (`:200-221`) that don't communicate
  "turn the page." Archive.org uses large edge-hotzones; consider click-left-
  half / click-right-half of the spread to turn, plus the buttons.

### 2.7 — Touch/swipe is minimal and can hijack scroll  🟡 Medium

**Where:** `useSwipe` (`Utils.js:898-929`) tracks only single-touch X delta with a
50px threshold; no velocity, no vertical guard, no multi-touch.

- A mostly-vertical drag with >50px horizontal component still fires a page turn
  — so trying to scroll can accidentally flip the page.
- No pinch (blocks §2.1 mobile zoom).
- No momentum/rubber-band; a turn is a hard cut.
- Threshold is a flat 50px regardless of screen width or velocity.

**Recommendation:** upgrade to a proper gesture layer (e.g. `@use-gesture/react`,
already ergonomic with React) giving: horizontal-intent detection (ignore swipes
whose vertical delta dominates), pinch-zoom, drag-to-pan, and velocity-based
turns with a follow-the-finger animation.

### 2.8 — Layout jitter, magic numbers, and hard-coded chrome  🟡 Medium

- **The title heading is oversized.** `h1.facsimileViewerTitle`
  (`Facsimiles.scss:499-506`) sets no `font-size`, so it inherits Bootstrap's
  default `<h1>` (~2.5rem) at weight 800. In a viewer whose page image is
  hard-fit to the *remaining* viewport height, that fat header directly steals
  vertical space from the scan and feels heavy/chrome-forward. Drop it to a
  compact toolbar title (~1.1–1.25rem, weight 600) and treat the whole top row
  as a slim viewer toolbar rather than a page heading — this also buys back
  pixels for the page (and helps §2.1's fit-height math).
- **`h1.facsimileViewerTitle { margin-right: 6rem }`** (`Facsimiles.scss:503`)
  hard-shifts the centered title to dodge something off-screen — brittle; the
  title is visibly off-center. Fold the fix into the toolbar rework above
  (flex layout with the back button, title, and — once added — page indicator /
  zoom controls as real toolbar items, so nothing needs a magic margin).
- **`.pageReferences`** reserves `min-height: 1.2rem` but content pops in only
  after the image + `lookupReference` resolve, causing a small CLS on each turn.
- The container-measurement effect in `FacsimilePageViewer.js:151-284` is **130
  lines of hand-rolled throttle/debounce/RAF** with manual timestamp bookkeeping
  to dodge ResizeObserver loops. It works but is a maintenance hazard and a
  likely source of the "sometimes the spread is briefly the wrong size" jank. A
  small `ResizeObserver` + `requestAnimationFrame` (or a tested hook like
  `use-resize-observer`) would be a fraction of the code.
- **`item` in the deps array** of the page-index fetch effect
  (`Facsimiles.js:38`) — if `item` is a fresh object per render, the fax index
  re-fetches more than necessary. Depend on `item.slug`/`item.indexRef` only.

### 2.9 — Duplicated, conflicting SCSS  🟡 Medium (correctness + maintainability)

`.page`, `.page img`, `.pageContainer`, `.pageImageWrapper`,
`.facsimile-navigation`, `.nav-button`, `.slider-container`, `.custom-slider`,
`.custom-tooltip`, `.pageReferences` are each defined in **both**
`Facsimiles.scss` and `FacsimilePageViewer.scss`, with different values:

| Selector | `Facsimiles.scss` | `FacsimilePageViewer.scss` |
|---|---|---|
| `.page img` object-fit | `fill` (distorts!) | `contain` |
| `.facsimile-navigation` bg | `#f0f0f0` | none / flex-only |
| `.custom-slider` thumb | `#000`, 1rem | `#4a90e2`, 15px |
| stack tooltip thumb | 84px | 96px |

Whichever applies is decided by import order + specificity, not intent. The
`object-fit: fill` rule in particular would stretch scans if it ever wins.

**Recommendation:** consolidate into one stylesheet (or clearly split
"grid/list" vs "spread viewer" with non-overlapping selector roots), delete the
loser rules, and remove the "legacy … removed" comment tombstones.

### 2.10 — PageStack side-stripes get out of balance  🟡 Medium/Low (was High — see §0; the ±1-drift and front-matter bullets below are retracted)

**Where:** stack width math in `FacsimilePageViewer.js:317-325`, hit-test math in
`PageStack.jsx:25-49`, stripe CSS in `FacsimilePageViewer.scss:47-53`.

The two edge-stacks are meant to read as "book thickness before / after the
current spread." They are **staying** — KC confirmed (2026-07-23) the stacks
remain as ambient desktop thickness alongside the new filmstrip (§4) — so these
fixes are worth making rather than deferring to a rewrite. Several things throw
the balance off:

- **The stripe pattern doesn't encode page count — and is malformed.** Despite
  the "1px per page" comments (`PageStack.jsx:6-7,49,66`), the stripes are a
  fixed CSS `repeating-linear-gradient` whose stops are non-monotonic
  (`#AAA 0, #888 2px, #AAA 1px, #888 2px` — `1px` after `2px` is degenerate;
  browsers clamp it, collapsing to a flat ~2px band). So a 40px stack and a
  190px stack have **identical texture**; only their width carries meaning. The
  eye reads two same-textured bars of different length as arbitrary, not as
  "thick side / thin side."
- **The 200px cap flattens proportion and makes stacks "stick."**
  `Math.min(200, leftEvenCount)` / `Math.min(200, rightOddCount)`. For editions
  over ~400 leaves the left stack pins at 200 and stops growing even as you keep
  turning — it looks frozen and lopsided against a shrinking right side that
  isn't yet capped.
- **Width and hit-test are computed by two different formulas.** The parent
  passes `leftStackWidth = floor(adjustedPageIndex/2)` (px), while the child
  independently recomputes `count = stackIndices.length` for click mapping
  (`PageStack.jsx:33-49`). They *usually* agree but drift by ±1 at the ends
  (parity of `totalPages`), so the last pixel of a stack can map to the wrong
  page and the visible width can be 1px off the represented count.
- **Front-matter placeholder leaves inflate the left stack.** `leafIndex`
  prepends `[0,0]` roman-numeral leaves for `pgoffset`; those count toward
  `adjustedPageIndex`, so even on "page 1" there can already be a left stack of
  ~`pgoffset/2`px representing blank front matter.
- **Compounding the width-jitter from §2.2:** page area is
  `containerW − (leftStackWidth + rightStackWidth)`, and total stack space isn't
  constant across turns (grows/shrinks near the caps), so the *pages themselves*
  get squeezed in the middle of the book and widen at the ends — another source
  of the per-turn resize jump.

**Recommendation:**
- **Normalize the two stacks to a fixed total footprint**, preserving their
  ratio: `leftPx = TOTAL * left/(left+right)`, `rightPx = TOTAL − leftPx`. Now
  the stacks always sum to a constant (no page-width jitter, §2.2), never
  "stick" at a cap, and the *ratio* — which is the meaningful signal — is always
  faithful regardless of book length.
- **Make the texture carry the count** (or accept it's decorative and say so).
  Either render real per-page columns (sampled when pages > pixels, as the old
  comment intended) or scale the gradient period to `width/count` so denser
  books look denser. Fix the degenerate stops regardless.
- **Single source of truth for width + hit-test** — compute the stack's page
  list once and derive both the px width and the position→page map from it, so
  they can't drift.
- Decide whether front-matter placeholders belong in the stacks; if not, offset
  the counts by `pgoffset`.

### 2.11 — Hover thumbnails lag (stack tooltip + slider tooltip)  🟡 Medium (was High — see §0; it's a shimmer flash, not a blocker)

**Where:** `PageStack.jsx:98-183` (stack hover thumb) and
`FacsimilePageViewer.js:481-540` (slider hover thumb).

Every hover position mounts a **fresh, unprefetched `<img>`** and fetches the
thumb on demand:

- `thumbLoaded` resets to `false` whenever `page.thumbAssetUrl` **or**
  `hover.visible` changes (`PageStack.jsx:100-103`). So each column you sweep
  across → new fetch → shimmer flash → load, and even re-hovering a page you
  already saw flashes the skeleton again before the (now HTTP-cached) image
  paints.
- Nothing is prefetched for the stack range. The viewer preloads full
  `pageAssetUrl` for ±4 of the *current spread* only (`:129-144`); the stack can
  address any of hundreds of thumbs, none warmed.
- `onMouseMove` recomputes `positionToPageIdx` and churns hover state on every
  raw pointer event (`PageStack.jsx:79-87`) — unthrottled — which drives the
  reset/flash thrash.
- The slider tooltip rebuilds its entire JSX (two `lookupReference` +
  `generateReference` + two `<img>`) per `mousemove` (§2.3), same lazy-fetch
  pattern, same lag.

**Recommendation (your instinct is right — prefetch + keyed elements):**
- **Prefetch thumbs around the hovered column.** On hover-enter and as the
  pointer moves, `new Image().src = ...` for a small window (±N columns / the
  sampled stripe indices), and keep a module-level `Set` of already-warmed URLs
  so it's cheap and idempotent. Thumbs are ~57KB; warming a neighborhood is
  trivial, warming all 380 (~21MB) is not — so window, don't bulk-load.
- **Key the tooltip `<img>` by URL** (`key={page.thumbAssetUrl}`) and **don't
  reset `thumbLoaded` for an already-warmed URL** — track loaded URLs in the
  `Set` and skip the shimmer when it's a hit, so re-hovers are instant with no
  flash.
- **Throttle `onMouseMove` to `requestAnimationFrame`** (compute page index /
  hover state at most once per frame) to stop the reset thrash.
- Optionally, idle-prefetch the *sparse* stripe sample (the ~200 representative
  thumbs the stack can land on) via `requestIdleCallback` after first paint, so
  the common landing spots are always warm.

### 2.12 — Smaller polish items  🟢 Low

- `main-image` renders even while `opacity:0` loading — fine, but the `onError`
  handler just marks it loaded (`PageImage.jsx:40`), leaving a broken-image
  frame with no fallback (the PageStack tooltip *does* have a placeholder
  fallback — inconsistent).
- Grid `alt` text is good; spread `renderPage` alt is just `Page N` — include the
  reference when known for a11y.
- `.last-page { border: 2px solid #f0c040 }` (gold border on the final leaf) is
  undocumented and looks like a stray debug style; either make it intentional
  (a "back cover" treatment) or drop it.
- `convertIntToRomanNumeral` front-matter handling and the `000.NN` asset naming
  are fragile string math; a mislabeled offset silently produces 404 page URLs
  with no visible error state.
- No empty/error state for a page image that 404s in the main viewer (only the
  stack tooltip degrades gracefully).

---

## 3. Recommended sequencing

**Phase 1 — kill the jank (perceptual quality):**
1. Stable spread box + real turn transition; stop animating container width (§2.2).
2. `history.replace` instead of `push`; local index as source of truth (§2.2).
3. Single slider state + live preview on desktop **and** mobile (§2.3).
4. Normalize the two side-stacks to a fixed total footprint (fixes both the
   imbalance and a contributor to the width-jitter) (§2.10).
5. Prefetch-window + URL-keyed, throttled hover thumbnails (§2.11).
6. Consolidate the conflicting SCSS; kill `object-fit: fill`; fix the degenerate
   stripe gradient (§2.9, §2.10).

**Phase 2 — the missing headline features:**
7. Zoom / pan / fullscreen (§2.1) — biggest perceived-quality jump.
8. Wire up passage highlighting, or delete it (§2.4).
9. Persistent page indicator + jump-to-page + visible edition switcher (§2.6).
9a. Filmstrip / contact-sheet rail toggle, reusing the grid as an in-viewer
    panel + a shared `<FaxThumb>` component (§4).

**Phase 3 — scale & touch:**
10. Virtualize the grid; drop blanket `will-change` (§2.5).
11. Proper gesture layer: pinch-zoom, intent-aware swipe, momentum (§2.7).
12. Replace the 130-line resize throttle with a standard hook (§2.8).

Phase 1 alone removes most of the "stilted/amateurish" feel; Phase 2 is what
makes it read as *world-class* rather than merely functional.

---

## 4. Enhancement idea — filmstrip / contact-sheet rail toggle

A viewer-level toggle that swaps the navigation model between three views —
**spread** (today), **filmstrip** (a scrollable horizontal thumbnail rail with
the current page centered/highlighted), and **contact sheet** (the full grid) —
is exactly the archive.org-class affordance the current UI is missing, and most
of it already exists.

**Why it fits here:**
- The contact sheet is *already built* — `FacsimileGridViewer`
  (`Facsimiles.js:117-276`). Today it only appears as a separate route
  (`/fax/{slug}` with no page number), so opening it **loses your spread**. The
  win is making it an *in-viewer panel/overlay* you toggle without navigating
  away, with the current page scrolled into view and highlighted.
- A **filmstrip** is a more literal, thumbnail-based version of what `PageStack`
  already gestures at ("where am I in the book"). On mobile — where `PageStack`
  is `display:none` (`Facsimiles.scss:550-552`) — a filmstrip is the natural
  replacement for that lost sense of position.

**Design notes:**
- **One toggle, remembered.** A small control group in the slim toolbar (§2.8):
  spread / filmstrip / grid, persisted (localStorage) so a reader's preference
  sticks across pages and editions.
- **Reuse, don't rebuild.** Filmstrip and contact sheet are the same tile
  (`PageImage` + `PageOverlay` + reference) at different densities; factor a
  shared `<FaxThumb>` so the grid, the filmstrip, the stack tooltip, and the
  slider tooltip all render one component (also consolidates the thumbnail
  prefetch/caching from §2.11 in one place).
- **Virtualize both** (§2.5) — a horizontal rail over 380 leaves needs the same
  windowing as the grid; render only what's near view.
- **Highlight + auto-center the current page**, and keep the active reference
  label visible so the rail doubles as a position indicator (covers part of
  §2.6's "no persistent page indicator").
- **Interaction parity:** clicking a rail/sheet thumb turns to that spread using
  the same `handlePageChange` path; keep arrow-key nav working while the rail is
  open.
- **Relationship to `PageStack` — DECIDED (KC, 2026-07-23): they coexist on
  desktop.** The edge-stacks stay as *ambient book-thickness*; the filmstrip is
  the *explicit thumbnail* layer layered on top. The filmstrip is also the
  **mobile** answer to the stacks (which are `display:none` there). Because the
  stacks are staying, the §2.10 normalization work (fixed-footprint, faithful
  ratio, corrected stripes) is confirmed worth doing — it's not throwaway.

Scope-wise this is a **Phase 2** item (item 9a below): it leans on the slim
toolbar (§2.8), the shared thumb component + prefetch (§2.11), and grid
virtualization (§2.5), so it's cheapest *after* those land.

## 5. Open questions for the team

- Is the passage-highlight overlay (§2.4) parked-on-purpose or an unfinished
  wire-up? That decides "integrate" vs "delete."
- Are the full-res `pageAssetUrl` images sharp enough to zoom to ~2–3×, or do we
  need the `/fax/render/.../crop/w{N}` path (or tiles) for deep zoom?
- Is arrow-key edition switching (§2.6) a wanted feature? If so it needs a
  visible control; if not, reclaim Up/Down for scroll/zoom.

---

*No code was changed during this audit. Observations are derived from source
reading of the module and shared helpers; UI behaviors marked "flicker/jump" are
inferred from the navigation + transition code paths and should be confirmed with
a screen capture on `http://localhost:8200/fax/...` (dev URL is CDN-cached — see
CLAUDE.md).*
