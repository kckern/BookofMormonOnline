# Home/Discover tile review rubric

You are reviewing the tiles on the Home/Discover page of the Book of Mormon Online webapp against this rubric. Use the criterion IDs exactly. Judge what you see in live captures, not only what the code implies.

## 1. Scoring model

Two complementary outputs per tile:

### 1a. Checklist → findings

Every criterion below is marked **Pass / Fail / N/A**. Every **Fail** becomes a
finding:

```
[Tile] · [Criterion ID] · [Severity] — one-line defect
  Evidence: screenshot/video path, file:line
  Fix hint: one line
```

| Sev | Meaning |
|---|---|
| **P0** | Broken — crash, dead end, lost scroll/state, content unreachable |
| **P1** | Clearly wrong — rug-pull, Back goes to the wrong place, close/back control unfindable, visibly broken layout |
| **P2** | Rough — inconsistent with siblings, clumsy, half-styled, low-res imagery |
| **P3** | Polish nit |

A defect with one root cause that hits many tiles is filed **once** under
"Cross-cutting findings", with the affected tiles listed, rather than repeated per tile.

### 1b. Gestalt ratings (1–5, one-sentence justification each)

- **Craft** — finished, or half-baked?
- **Beauty** — would you put it in a screenshot of the product?
- **Belonging** — does it look like the same product as the Read page? (Grid
  balance is *not* judged here; it belongs to the page-level pass, §K.)

---

## 2. Criteria

### A. Tile at rest (visual)

- **A1** Fills its grid span: no dead whitespace, no overflow, no clipped text.
- **A2** Imagery: sharp at 2× DPR (no upscaled thumbnails); correct aspect and
  crop (no beheaded faces); no broken-image icons or alt-text fallbacks showing.
- **A3** Typography follows the tile tiers (heading / body / meta); sizes and
  weights consistent with sibling tiles.
- **A4** House color: links black, secondary UI neutral gray, gold `#c9a24b` the
  sole accent; no stray blue (incl. `#345496`); text contrast ≥ WCAG AA. Also
  check **gold overuse** — an accent on every tile is no accent.
- **A5** Spacing, padding, and corner radius match siblings.
- **A6** Animation is purposeful, smooth (no jank/flicker), honors
  `prefers-reduced-motion`, and doesn't loop distractingly.
- **A7** No leakage: debug text, placeholder copy, `undefined` / `null` / `NaN`,
  raw HTML entities, data junk.

### B. Load & rug-pulls

- **B1** Skeleton matches final dimensions — the tile doesn't jump in (measured
  with a `layout-shift` PerformanceObserver; per-tile CLS contribution recorded).
- **B2** **No rug-pull after first paint.** Content in view must not change,
  move, or reorder while the reader is looking. Known sources to exercise:
  1. balancer inserting reserve tiles into the rail/masonry,
  2. self-fetching tiles (biblephrases, chiasmus) popping in late,
  3. warm-cache payload swapped for a fresh one (incl. 6h window-seed roll
     mid-session),
  4. live community updates.
- **B3** Infinite-scroll batches append below the viewport and never shift
  on-screen content.
- **B4** Empty / thin-data / fetch-error state: the tile hides cleanly or
  degrades gracefully — no half-filled shell.

### C. Interaction model (two-layer)

- **C1** Affordance honesty: what looks clickable is clickable, and nothing
  clickable looks inert. Click target matches the visual affordance.
- **C2** Layer-1 reveal expands in place, smoothly, without shoving siblings
  around, and is reversible.
- **C3** Layer-2 deeplink clearly signals navigation (exit-arrow `TileCTA`
  deeplink variant), not a look-alike of the reveal pill.
- **C4** Destination mechanism follows the **Destination Rule**:

  | Content | Mechanism |
  |---|---|
  | More of the tile's own prose | Layer-1 inline reveal |
  | Quick look that returns you to the feed (a verse, a scripture passage, a short gloss) | Popup |
  | Anything with its own canonical URL (entity, page, document) | Page (with a top back control; one Back returns to Home with the same tiles and scroll) |

  Same content type → same mechanism across all tiles. Deviations are findings.
- **C5** Hover / focus-visible / active states exist and are consistent; no UA
  focus ring or default tap-highlight color.

### D. Destination (popup or page)

Scope: the destination's **above-the-fold state and its return path** only —
not a full review of every destination page.

- **D1** Popup: sized to content, never exceeds the viewport, scrolls
  internally, close control visible without scrolling.
- **D2** Popup dismisses via Esc, backdrop click, and close button; background
  scroll is locked while open.
- **D3** Page: a back / return control is above the fold and where people expect it.
- **D4** Continuity: the destination's title and imagery match the tile, so
  you know you landed where you meant to.
- **D5** Above the fold, the destination is not half-baked: no unstyled
  sections, broken layout, or stub content.

### E. Return journey

- **E1** Browser Back returns to Home at the same scroll position with
  infinite batches intact.
- **E2** Return shows the same tiles — no reshuffle after Back, tab restore,
  or PWA resume.
- **E3** Closing a popup restores focus and scroll; popups don't create
  history entries unless intentional (and then Back closes them).
- **E4** Deeplinks are real `<a href>` URLs: right-click, middle-click,
  open-in-new-tab, copy-link, and share all work.

### F. Responsive

Viewports: **1440** desktop, **768–1024** tablet / landscape (where masonry is
most fragile), **390** phone.

- **F1** Reflows sensibly at every breakpoint: no squeezed columns, no
  horizontal scroll, no orphaned single-column gaps.
- **F2** Tap targets ≥ 44px and not crowded.
- **F3** On phone, popups go full-screen or sheet; close control within thumb reach.

### G. Standards & accessibility

- **G1** Semantic elements: navigation is `<a>`, actions are `<button>` — no
  `div` with `onClick`.
- **G2** Keyboard reachable in a sensible order, with a visible focus style.
- **G3** Images have meaningful alt text, or empty alt if decorative.

### H. Content & editorial quality

- **H1** Representativeness: across 5 seeds, how many samples are duds (a
  one-line commentary, an imageless obscure place, a 2-line chiasmus)? Record
  the dud rate.
- **H2** Hook: the first visible line makes a non-member want to click; CTA
  verbs consistent across tiles.
- **H3** Truncation honesty: clamps cut at a sensible point (no mid-word,
  no orphaned heading); "read more" actually adds something.
- **H4** No cross-tile duplication: same person / verse / artwork twice in one
  seed, `commentary` / `commentary2` / `commentary3` from one source, or repeats
  clustering across infinite batches.
- **H6** Attribution: credit for art, commentary, and archive documents visible
  or one click away.

### I. Freshness & randomness

- **I1** Perceived randomness: within a 6h window, a return visit shows an
  identical page. Does that read as stable or as broken? Is there a refresh
  affordance, and does it set expectations?
- **I2** Live-vs-cached seams: the live community tile next to cached
  neighbors doesn't produce contradictory timestamps; relative times are
  localized and don't freeze.

### J. Performance

- **J1** Image weight: `srcset` / modern format; first-row tiles eager with
  `fetchpriority`, the rest `loading="lazy"`; LCP element identified.
- **J2** Offscreen cost: MapStory animation, the Leaflet map, and chiasmus
  pause when off screen or when the tab is hidden.
- **J3** No long main-thread tasks during balancer measurement or batch append.

### K. Page gestalt (Sampler shell — page-level pass, not per tile)

- **K1** Rhythm & balance: the "ORDER IS LAYOUT" pairing (text-with-text,
  visual-with-visual) survives balancer inserts and `isReady` drop-outs; no
  holes, no lopsided rail.
- **K2** Hierarchy & density: there is a clear first read; not a catalogue of
  equal-weight tiles.
- **K3** Information scent: a first-timer can tell what the site is within one
  viewport.
- **K4** End of feed: a deliberate terminus at the last batch or on fetch
  failure — not a loop or a blank.
- **K5** Tabs and left rail: consistent with the grid; no layout shift when
  switching tabs.

### L. Variants

- **L1** Guest vs logged-in: per tile, differences are intentional; login
  walls are graceful, not dead ends.
- **L2** Korean edition: text expansion/contraction, `word-break: keep-all`,
  fonts, no untranslated strings (incl. aria-labels and alt text), localized
  dates and numbers.
- **L3** Dark mode (`assets/theme/scss/darkmode.scss`): tiles themed; white-ground
  images (fax scans) don't glare; gold accent and gray text keep contrast.
- **L5** Feature flags: tiles whose destinations are hidden in the prod build
  (`HIDE_HOME_NAV`, `HIDE_MATTERS_NAV`, `HIDE_HISTORY_NAV`, `HIDE_PASSAGE_NOTES`)
  don't dead-end there.

### M. Resilience

- **M2** One tile throwing doesn't blank the grid (per-tile error boundary);
  image `onError` fallbacks exist and don't flicker.

---

## 4. Protocol

- **Target:** `http://localhost:8201` — the Vite dev server that the Next front
  door proxies human browsers to. (`localhost:8200` doesn't work for this: its
  `/graphql` 404s because the API route lives in NPM on the public host, and
  headless Chromium's `HeadlessChrome` UA is classified as a bot → SSR, which has
  no `/home`. Never `bom.kckern.net` — Cloudflare edge-caches stale bundles.)
  Harness overrides the UA to desktop Chrome / iOS Safari.
- **Caveat:** Vite dev serves unbundled modules, so absolute timings (first
  paint, long tasks) are slower than prod. Ordering, shifts, and behavior are
  representative; J-criteria timings must be re-checked on a prod build.
- **Core pass (full criteria):** 1440 and 390 viewports, warm cache, guest,
  English, light mode.
- **Spot-check sweeps (one pass each, all tiles, triage only):** 768–1024
  tablet (F1), cold load (B1/B2), logged-in (L1), Korean (L2), dark mode (L3).
  A failure found in a sweep is then examined in depth for that tile/state only.
- **Seeds:** 3 per tile for the visual and behavior checks; 5 for H1 dud rate.
  Reserve and batch tiles are reached by scrolling and balancer inserts.
- **Capture:** Playwright — a screenshot at each step, a CLS observer, a
  long-task observer, and short videos for rug-pulls and animations.
- **Order:** page-level pass (§K) first → each tile (A–M).

