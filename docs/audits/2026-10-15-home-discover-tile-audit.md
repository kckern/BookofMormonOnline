# Home / Discover — tile-by-tile UX audit

**Date:** 2026-10-15
**Scope:** `frontend/webapp/src/views/Home/` — the Sampler shell and every tile in
`tiles/registry.js` (default `tileRegistry`, `reservePool`, `batchTiles`), plus the
destinations those tiles lead to. The People / Places / Matters destinations (both
the single-entity pages and the "view all" index pages) get a dedicated
**Destination Study** (§S) because they are new and immature.
**Status:** Rubric approved; page-level pass (§K) done 2026-10-15; per-tile pass and Destination Study pending.

This document holds the rubric first, then (once run) the results. Screenshots and
videos go in `docs/audits/home-discover-audit-2026-10-15/` — **gitignored**
(34MB+, and tiles such as Notes can carry user-generated content; the community
tile is masked in every capture). Harness: Playwright scripts kept alongside.

---

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
  | Anything with its own canonical URL (entity, page, document) | Page — **or** route-backed modal, pending §S5 |

  Same content type → same mechanism across all tiles. Deviations are findings.
- **C5** Hover / focus-visible / active states exist and are consistent; no UA
  focus ring or default tap-highlight color.

### D. Destination (popup or page)

Scope: the destination's **above-the-fold state and its return path** only —
not a full review of every destination page (the entity pages get that in §S).

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

## 3. Destination Study — People / Places / Matters (§S)

Covers both the single-entity pages (`/people/:slug`, `/places/:slug`,
`/matters/:slug`) and the "view all" index pages (`/people`, `/places`,
`/matters`). These are new and immature, and the popup-vs-page question is
open: **the study answers it with evidence rather than assuming it.**

- **S1 Maturity** — full D-criteria plus A/F/G on each page (desktop + tablet +
  phone): layout, hierarchy, half-baked sections, stub or empty data, image
  quality, back-control placement.
- **S2 Consistency** — are person / place / matter (and the three index pages)
  one template with the same anatomy, or three separate builds?
- **S3 Cost of leaving Home** — time to interactive, context lost, and whether
  the return trip (E1/E2) restores Home intact. Measured, not assumed.
- **S4 Popup fitness** — content volume per entity (median / max / outliers):
  would most entities fit a compact view?
- **S5 Recommendation** — per entity type and per index page: **page**,
  **popup**, or **route-backed modal** (the URL changes to the canonical
  `/people/:slug`, but it renders as an overlay over Home; Back closes it
  without scroll loss; a direct load, a new tab, or a crawler gets the full
  SSR page, so SEO is unaffected). The result also settles row 3 of the C4
  Destination Rule.

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
- **Order:** page-level pass (§K) first → each tile (A–M) → Destination Study (§S).

## 5. Report structure (filled in when the audit runs)

1. Summary matrix — tiles × criteria (✓ / ✗ with severity / –), plus gestalt scores
2. Cross-cutting findings (systemic, one root cause → many tiles)
3. Page-level findings (§K)
4. Per-tile sections — gestalt scores, then findings by severity
5. Destination Study results and the S5 recommendation
6. Prioritized fix list (P0 → P3)

### Tile inventory

| Pool | Tiles |
|---|---|
| Default | readingplan, section (Narration), contents, community, people, text, commentary ×3, history, fax, places, mattersNarrative, mattersMaterial, mattersConcept, biblephrases, chiasmus, art, notes, faxVerse, mapstory |
| Reserve | personProfile, witness, translation, josephSmith, placeProfile, matterProfile, artFill1/2, chiasmus2, map |
| Batch-only | personProfile, placeProfile, matterProfile, witness, artB (+ repeatable default types) |

---

# Results

## R1. Page-level pass (§K + page-scope B/E) — 2026-10-15

Core config: 1440×900 desktop and 390×844 phone (DPR 2), guest, English, light.
Raw measurements: `home-discover-audit-2026-10-15/page/pagepass.json`.

### Findings

**P1 · E1/E2 — Back from any tile destination rebuilds a different Home.**
Variable tiles are re-shuffled with `Math.random` on every mount
(`Sampler.js:120`, `shuffle(...)` in the `useState` initializer), and infinite
batches live only in component state (`extraBatches`), so leaving Home discards
both. Measured: desktop, Back from `/fax/printer` landed at y=1988 instead of
3000 with a different main-column order; phone, Back from a history doc dropped
40 infinite tiles → 0, landed at y=3426 instead of 4179, order reshuffled. The
new route-level restore (`2791b37c`) can't help — the page it restores to no
longer exists. Same reshuffle on a tab round-trip (Explore → Community →
Explore: different order). *Fix hint:* persist the shuffled order + revealed
batches (session-scoped, keyed by seed) and rehydrate on POP; or keep Home
mounted across tile navigations.

**P1 · K1/F1 — Phone layout buries the page under the rail.** At ≤800px the
rail stacks *above* the main column, so a phone reader scrolls past 12 rail
tiles (reading plan, narration, contents, history, fax, faxVerse, chiasmus, and
5 reserves) before People appears at **y≈4007** (~5 screens). The balancer
(`Sampler.js` reserve `useLayoutEffect`) still compares rail vs main *heights*
when they are stacked, which is meaningless, so it keeps feeding reserves into
the rail and making it worse. Infinite-scroll tiles are also binned into the
rail on phone (`railInfinite`), i.e. inserted **above** the reader's position
mid-page — Chromium's scroll anchoring hides that, but iOS Safari has no
`overflow-anchor` (not measured here, likely visible jump). *Fix hint:* at
single-column widths disable the balancer and rail binning, interleave rail and
main into one curated order, and append batches only at the end.

**P1 · B2 — Phone reading-plan grid rug-pull above the fold.** On phone the
52-week grid in ReadingPlanTile pops in 1–3 s after first paint and shoves
everything ~175px down (CLS 0.103 at ~4.2 s, sources: readingplan, narration,
contents). Screenshots `phone-warm-1000ms.png` vs `phone-warm-3000ms.png`.
Desktop warm load is clean (CLS 0.015).

**P2 · B1/B2 — Desktop cold-load shift.** Cold load CLS 0.133 (>0.1): one
shift of 0.117 at ~2.4 s sourced to the masonry + contents tile — consistent
with the live community payload landing and the balancer re-binning. Warm load
avoids it.

**P1 · K4/B4 — Batch fetch failure leaves 3 permanent skeletons.** With
`homesampler` batch requests failing (forced via route abort, and seen once
naturally after `ERR_NETWORK_CHANGED`), the bottom of the feed shows three grey
skeleton tiles indefinitely: no retry, no message, no terminus. On desktop the
reader was parked at the bottom for 8 s+ looking at skeletons.
`desktop-fetchfail-bottom.png`. *Fix hint:* on failure drop the skeletons and
render a quiet end-of-feed with a retry link; also define the MAX_BATCHES
terminus.

**P2 · I1/F — No refresh/resample affordance on phone.** `HomeTabs` (which owns
the resample button) is not rendered on mobile (`Home.js:77`), so phone users
have no way to get a new sample and no Explore/Community/User tabs.

**P2 · A1/F1 — Phone header clips and overlaps.** At 390px the header's user
area is cut off ("Gu…" for Guest) and a `0.0% · 0.0%` progress pill shows for
a guest; the tile "READING PLAN" label sits under the fixed header at y=0.

**P2 · M2 — Runtime errors on a normal load.**
- `TypeError: map.delete is not a function` in MapStoryTileInner `regNode`
  (`MapStoryTileInner.js:80-83`, called from the leader-line refs at :630/:643)
  — the ref map isn't a `Map` at unmount time.
- Uncaught `SyntaxError: Unexpected token '<'` — something is parsing an HTML
  response as JSON (to pin down in the tile pass).
- 404s for fax edition tab images: `media.bookofmormon.online/fax/tabs/1877`,
  `/1891` (FaxVerse/Fax edition rail, A2).
- React warning: unknown `activeClassName` prop on a DOM element (router-7
  leftover on a NavLink).

**P2 · B4 — BiblePhrases renders as a 2px empty shell** on both viewports in
the sampled seed (measured height 2px) — a grid slot with nothing in it.

**P3 · J3 — Long tasks** at load: 917 ms (desktop) / 1306 ms (phone), plus
300–460 ms tasks while batches append on phone. Dev-mode inflated; re-measure
on a prod build before acting.

**P3 · Resample replaces the whole page with skeletons** (CLS 0.49, user-
initiated so not a CLS violation). Acceptable, but a cross-fade or keeping the
fixed rail would feel less like a reload.

### Passes

- Desktop warm load: instant paint from cache, no skeleton flash, CLS 0.015,
  no horizontal overflow at either width.
- Infinite scroll on desktop: batches arrive in 250–500 ms, append below the
  viewport, no measurable shift while scrolling (`scrollCls` empty).
- Commentary anti-stacking holds: the three commentary tiles alternate columns.

### Gestalt (page)

- **Craft 3/5** — desktop is composed and dense with real content; phone is an
  unedited stack of the desktop rail.
- **Beauty 4/5 desktop, 2/5 phone** — the people mosaic and art carry desktop;
  phone opens on a grid of 52 grey week-buttons.
- **Belonging 4/5** — consistent card chrome, gold accents restrained.
