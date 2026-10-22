# Home / Discover — tile-by-tile UX audit

**Date:** 2026-10-15
**Scope:** `frontend/webapp/src/views/Home/` — the Sampler shell and every tile in
`tiles/registry.js` (default `tileRegistry`, `reservePool`, `batchTiles`), plus the
destinations those tiles lead to. The People / Places / Matters destinations (both
the single-entity pages and the "view all" index pages) get a dedicated
**Destination Study** (§S) because they are new and immature.
**Status:** Rubric approved. Page-level pass (R1), tile pass (R2) and Destination Study (R3) done 2026-10-15. Page-level P1s fixed in `ac3c63e8`.

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
(`Sampler.js:113`, `shuffle(...)` in the `useState` initializer), and infinite
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

## R2. Tile pass — 2026-10-15

Eight auditors (one per tile family) ran the full rubric with live captures on
Vite :8201, then a consistency critic re-checked every P0/P1 against its
evidence, calibrated gestalt scores, merged cross-cutting root causes, and
listed inconsistencies no single auditor could see. Critic verdicts are applied
below (severity changes are marked; one refuted finding is dropped).
Screenshots: `home-discover-audit-2026-10-15/tiles/<family>/` (gitignored).

**Totals (per-tile, after critic):** P0 4 · P1 21 · P2 91 · P3 109, plus 20 merged cross-cutting root causes.

> Status note: the page-level P1 fixes in `ac3c63e8` (session restore, single-column phone layout, reading-plan placeholder, feed terminus) landed after this pass. Findings they address are re-verified in the improvement phase, not silently closed here.

### R2.1 Summary matrix

| Tile | Family | Craft | Beauty | Belonging | P0 | P1 | P2 | P3 | Duds (H1) |
|---|---|---|---|---|---|---|---|---|---|
| readingplan | rail | 3 | 2 | 3 |  | 1 | 8 | 3 | 0/5 seeds were duds (the guest tile is not randomized: always the default 52-week program) |
| section | rail | 3 | 3 | 4 |  |  | 3 | 5 | 0/5 seeds were duds (6–13 beats each; shortest beat 64–98 chars; 1–4 art thumbs). Heights  |
| contents | rail | 2 | 2 | 3 |  | 1 | 4 | 3 | 0/5 seeds were duds. Only ~11 divisions exist, so the same division repeats across resampl |
| people | people | 3 | 4 | 4 |  |  | 6 | 7 | 2/5 featured samples were duds (Jerusalem Prophets, an anonymous group with a short bio; N |
| personProfile | people | 2 | 3 | 4 |  |  | 3 | 3 | 0/4 visually checked samples were duds (Abinadom, Lamanite King³, Coriantor, Gilead), and  |
| places | places | 3 | 4 | 3 |  | 4 | 5 | 3 | 0/5 seeds were duds: all 25 sampled cards had images (naturalWidth >0, none hidden) and an |
| placeProfile | places | 3 | 4 | 4 |  | 2 | 3 | 6 | 0/3 seeds were duds (Land of Midian, Land of Lehi's Inheritance, Egypt): all have hero art |
| map | places | 2 | 2 | 3 |  |  | 3 | 4 | 5/5 seeds would be duds: the tile renders the identical unlabeled view regardless of seed  |
| mattersNarrative | matters | 2 | 3 | 4 | 1 | 1 | 4 | 4 | 0/5 seeds were duds. Every card had an image and a ref with a gloss of at least 42 charact |
| mattersMaterial | matters | 2 | 4 | 4 | 1 | 1 | 1 | 4 | 0/5 seeds were duds. All cards had images and refs, with glosses of 51–113 characters. 1 n |
| mattersConcept | matters | 2 | 4 | 4 | 1 | 1 | 1 | 4 | 0/5 seeds were duds. All cards had images and refs, with glosses of at least 43 characters |
| matterProfile | matters | 3 | 4 | 4 |  | 1 | 3 | 6 | 0/2 observed seeds were duds. The tile appeared in 2 of 5 resample seeds, plus 3 loads in  |
| text | scripture | 2 | 3 | 2 |  | 1 | 1 | 7 | 0/10 samples were duds (5 seeds, main and infinite); every block was a substantive passage |
| commentary | scripture | 3 | 4 | 4 |  |  | 4 | 5 | 6/27 commentary samples were duds across 5 seeds: 4 Book of Mormon Minute rows titled with |
| notes | scripture | 3 | 4 | 4 |  | 2 | 4 | 5 | 2/9 notes samples were duds (one-line cross-reference stubs); all 9 were by the same autho |
| fax | archive | 3 | 4 | 4 |  |  | 3 | 5 | 0/5 fax samples were duds (Printer's MS, 1883 Liverpool ×3, 1866 Liverpool, 1920 SLC). Cov |
| faxVerse | archive | 2 | 3 | 4 |  |  | 4 | 3 | 0/3 distinct verses were content duds (1 Ne 4:5, Mosiah 19:28, Moroni 2:1), but 1/3 had a  |
| history | archive | 4 | 4 | 4 |  |  | 1 | 3 | 0/5 duds ('We have received', The Biter bit, The Mormons 1839, Palmyra Reflector 'Book of  |
| translation | archive | 1 | 1 | 1 |  |  | 1 | 2 | Not applicable: 0 renders across 10+ loads and 6 seed replays (100% absent). |
| josephSmith | archive | 2 | 3 | 3 |  |  | 3 | 3 | 1 distinct sample across 13 observations (100% repetition): every seed shows the 1839 titl |
| witness | archive | 3 | 4 | 4 |  |  | 4 | 3 | 2/9 samples were duds (secondhand accounts clamped before substance: St. Joseph Weekly Her |
| biblephrases | analysis | 2 | 3 | 2 |  | 2 | 4 | 2 | 4/7 seeds were duds (2px empty slot): the tile gave up after 5 pairs without a 4-word shar |
| chiasmus | analysis | 3 | 4 | 4 |  |  | 3 | 6 | 0/5 seeds were duds (8–12 line chiasms: 2 Nephi 2:7, Alma 15:3, 3 Nephi 10:4–5, Mosiah 5:1 |
| art | analysis | 3 | 4 | 4 |  | 2 | 3 | 5 | 0/4 seeds were duds (Zarahemla is Rebuilt, 'Depart into the Wilderness', Loading the Ship, |
| mapstory | story | 2 | 2 | 2 | 1 | 2 | 10 | 5 | 1/5 seeds were duds: Omer's Flight to Ablom (2 moves, so a one-hop 'journey'). A further 2 |
| community | story | 3 | 3 | 4 |  |  | 2 | 3 | 0/5 seeds were duds (live, not seeded): every sample had 4 groups (2 shown), 1 fresh messa |

Criterion-level status per tile (P pass · F fail · NA · NR not run):

<details><summary>Full criterion matrix</summary>

- **readingplan** — `A1:P A2:NA A3:P A4:F A5:P A6:P A7:P B1:F B2:F B3:NA B4:F C1:F C2:NA C3:NA C4:P C5:F D1:NA D2:NA D3:P D4:F D5:F E1:F E2:F E3:NA E4:P F1:P F2:F F3:NA G1:P G2:P G3:NA H1:P H2:F H3:NA H4:P H6:NA I1:NA I2:NA J1:NA J2:NA J3:NA L1:F L2:NR L3:F L5:P M2:F`
- **section** — `A1:P A2:P A3:F A4:P A5:F A6:P A7:P B1:P B2:P B3:NA B4:P C1:P C2:NA C3:P C4:P C5:F D1:F D2:P D3:F D4:P D5:F E1:F E2:F E3:F E4:P F1:F F2:F F3:F G1:F G2:P G3:F H1:P H2:P H3:P H4:P H6:NR I1:NA I2:NA J1:F J2:NA J3:NA L1:NR L2:NR L3:F L5:P M2:F`
- **contents** — `A1:F A2:P A3:P A4:F A5:P A6:NA A7:P B1:P B2:P B3:NA B4:P C1:F C2:F C3:F C4:P C5:F D1:NA D2:NA D3:P D4:P D5:P E1:F E2:F E3:NA E4:P F1:F F2:F F3:NA G1:F G2:F G3:P H1:P H2:F H3:P H4:P H6:NA I1:NA I2:NA J1:P J2:NA J3:NA L1:NA L2:NR L3:P L5:P M2:F`
- **people** — `A1:F A2:P A3:F A4:F A5:P A6:P A7:F B1:P B2:P B3:NA B4:P C1:P C2:F C3:NA C4:P C5:F D1:P D2:P D3:F D4:P D5:P E1:F E2:F E3:F E4:P F1:F F2:F F3:P G1:F G2:F G3:P H1:F H2:P H3:F H4:P H6:NA I1:NA I2:NA J1:F J2:NA J3:NR L1:NA L2:NR L3:P L5:P M2:P`
- **personProfile** — `A1:F A2:P A3:P A4:F A5:P A6:P A7:P B1:NA B2:P B3:P B4:P C1:P C2:F C3:P C4:P C5:F D1:P D2:P D3:F D4:P D5:P E1:F E2:F E3:F E4:P F1:P F2:F F3:P G1:P G2:F G3:P H1:P H2:F H3:F H4:P H6:NA I1:NA I2:NA J1:F J2:NA J3:NR L1:NA L2:NR L3:P L5:P M2:F`
- **places** — `A1:F A2:P A3:P A4:P A5:P A6:P A7:F B1:P B2:P B3:P B4:P C1:F C2:NA C3:NA C4:P C5:F D1:P D2:P D3:F D4:P D5:F E1:F E2:F E3:P E4:P F1:F F2:F F3:NR G1:P G2:P G3:P H1:P H2:P H3:F H4:F H6:NA I1:NA I2:NA J1:F J2:NA J3:NA L1:NA L2:NR L3:P L5:NA M2:P`
- **placeProfile** — `A1:F A2:F A3:P A4:F A5:P A6:P A7:F B1:P B2:P B3:P B4:P C1:P C2:F C3:P C4:P C5:F D1:P D2:P D3:F D4:P D5:P E1:F E2:F E3:P E4:P F1:F F2:F F3:NR G1:F G2:F G3:P H1:P H2:F H3:F H4:F H6:NA I1:NA I2:NA J1:F J2:NA J3:NA L1:NA L2:NR L3:P L5:NA M2:P`
- **map** — `A1:F A2:P A3:P A4:P A5:P A6:P A7:F B1:P B2:P B3:NA B4:P C1:F C2:NA C3:P C4:P C5:F D1:NA D2:NA D3:P D4:F D5:P E1:P E2:F E3:NA E4:P F1:P F2:P F3:NA G1:P G2:P G3:NA H1:F H2:F H3:NA H4:NA H6:NA I1:NA I2:NA J1:P J2:P J3:NA L1:NA L2:NR L3:F L5:NA M2:P`
- **mattersNarrative** — `A1:F A2:P A3:P A4:P A5:P A6:NA A7:F B1:F B2:P B3:P B4:P C1:P C2:NA C3:NA C4:P C5:F D1:P D2:P D3:F D4:P D5:F E1:F E2:F E3:P E4:P F1:F F2:F F3:F G1:F G2:P G3:P H1:P H2:P H3:F H4:P H6:NA I1:NA I2:NA J1:F J2:NA J3:NA L1:NR L2:NR L3:F L5:P M2:P`
- **mattersMaterial** — `A1:F A2:P A3:P A4:P A5:P A6:NA A7:P B1:F B2:P B3:P B4:P C1:P C2:NA C3:NA C4:P C5:F D1:P D2:P D3:F D4:P D5:F E1:F E2:F E3:P E4:P F1:F F2:F F3:F G1:F G2:P G3:P H1:P H2:P H3:P H4:F H6:NA I1:NA I2:NA J1:F J2:NA J3:NA L1:NR L2:NR L3:F L5:P M2:P`
- **mattersConcept** — `A1:F A2:P A3:P A4:P A5:P A6:NA A7:F B1:F B2:P B3:P B4:P C1:P C2:NA C3:NA C4:P C5:F D1:P D2:P D3:F D4:P D5:F E1:F E2:F E3:P E4:P F1:F F2:F F3:F G1:F G2:P G3:P H1:P H2:P H3:P H4:F H6:NA I1:NA I2:NA J1:F J2:NA J3:NA L1:NR L2:NR L3:F L5:P M2:P`
- **matterProfile** — `A1:F A2:P A3:P A4:P A5:P A6:NA A7:P B1:F B2:P B3:P B4:P C1:P C2:F C3:P C4:P C5:F D1:P D2:P D3:F D4:F D5:P E1:F E2:F E3:P E4:P F1:F F2:F F3:F G1:F G2:F G3:P H1:P H2:F H3:F H4:F H6:NA I1:NA I2:NA J1:F J2:NA J3:NA L1:NR L2:NR L3:F L5:P M2:P`
- **text** — `A1:F A2:P A3:F A4:P A5:F A6:F A7:F B1:P B2:P B3:P B4:P C1:F C2:NA C3:P C4:P C5:F D1:NA D2:NA D3:F D4:P D5:P E1:F E2:F E3:NA E4:P F1:F F2:F F3:NA G1:P G2:F G3:P H1:P H2:P H3:NA H4:P H6:NA I1:NA I2:NA J1:P J2:F J3:NR L1:NR L2:NR L3:F L5:NA M2:F`
- **commentary** — `A1:F A2:P A3:P A4:F A5:P A6:NA A7:F B1:P B2:P B3:P B4:P C1:P C2:F C3:P C4:P C5:F D1:P D2:F D3:P D4:F D5:F E1:P E2:F E3:F E4:P F1:F F2:F F3:F G1:F G2:F G3:P H1:F H2:F H3:P H4:P H6:P I1:NA I2:NA J1:P J2:NA J3:NR L1:NR L2:NR L3:F L5:NA M2:F`
- **notes** — `A1:P A2:P A3:F A4:P A5:P A6:NA A7:F B1:P B2:F B3:F B4:NR C1:P C2:NA C3:P C4:P C5:F D1:P D2:F D3:F D4:P D5:P E1:F E2:F E3:F E4:P F1:F F2:F F3:F G1:F G2:F G3:F H1:F H2:F H3:NA H4:P H6:P I1:NA I2:NA J1:F J2:NA J3:NR L1:NR L2:NR L3:F L5:F M2:F`
- **fax** — `A1:F A2:F A3:P A4:P A5:P A6:F A7:P B1:P B2:P B3:P B4:P C1:F C2:NA C3:P C4:P C5:F D1:P D2:P D3:P D4:P D5:P E1:F E2:F E3:F E4:P F1:F F2:F F3:NR G1:F G2:F G3:P H1:P H2:P H3:F H4:P H6:P I1:NA I2:NA J1:F J2:NA J3:NR L1:NR L2:F L3:F L5:NA M2:F`
- **faxVerse** — `A1:F A2:F A3:P A4:F A5:F A6:NA A7:F B1:P B2:P B3:P B4:P C1:F C2:NA C3:P C4:P C5:F D1:P D2:P D3:P D4:P D5:P E1:F E2:F E3:F E4:P F1:F F2:P F3:NR G1:P G2:P G3:F H1:P H2:P H3:F H4:F H6:P I1:NA I2:NA J1:P J2:NA J3:NR L1:NR L2:P L3:F L5:NA M2:F`
- **history** — `A1:P A2:P A3:F A4:P A5:P A6:NA A7:P B1:P B2:P B3:P B4:P C1:P C2:NA C3:P C4:P C5:F D1:NA D2:NA D3:F D4:P D5:F E1:F E2:F E3:NA E4:P F1:P F2:P F3:NA G1:P G2:F G3:P H1:P H2:P H3:P H4:P H6:P I1:NA I2:NA J1:P J2:NA J3:NR L1:NR L2:P L3:P L5:NR M2:F`
- **translation** — `A1:NR A2:NR A3:NR A4:NR A5:NR A6:NA A7:NR B1:NR B2:NR B3:NA B4:F C1:NR C2:NA C3:NR C4:F C5:NR D1:NA D2:NA D3:NR D4:NR D5:NR E1:NR E2:NR E3:NA E4:NR F1:NR F2:NR F3:NA G1:NR G2:NR G3:NR H1:F H2:NR H3:NR H4:NR H6:NR I1:NA I2:NA J1:NA J2:NA J3:NR L1:NR L2:F L3:NR L5:NR M2:NR`
- **josephSmith** — `A1:P A2:P A3:F A4:P A5:P A6:NA A7:P B1:P B2:P B3:NA B4:P C1:P C2:NA C3:P C4:P C5:F D1:NA D2:NA D3:P D4:P D5:P E1:F E2:F E3:NA E4:P F1:P F2:P F3:NA G1:P G2:P G3:P H1:F H2:P H3:F H4:P H6:P I1:F I2:NA J1:F J2:NA J3:NR L1:NR L2:F L3:F L5:NA M2:F`
- **witness** — `A1:P A2:P A3:F A4:P A5:P A6:NA A7:F B1:P B2:P B3:P B4:P C1:P C2:NA C3:P C4:P C5:F D1:NA D2:NA D3:P D4:F D5:F E1:F E2:F E3:NA E4:P F1:P F2:P F3:NA G1:P G2:P G3:P H1:F H2:P H3:F H4:P H6:P I1:NA I2:NA J1:F J2:NA J3:NR L1:NR L2:P L3:P L5:NA M2:F`
- **biblephrases** — `A1:P A2:NA A3:F A4:P A5:F A6:NA A7:F B1:F B2:F B3:P B4:F C1:P C2:NA C3:P C4:P C5:F D1:P D2:F D3:P D4:F D5:P E1:F E2:F E3:P E4:P F1:NR F2:F F3:NR G1:F G2:P G3:NA H1:F H2:P H3:F H4:NR H6:NA I1:NA I2:NA J1:NA J2:NA J3:NR L1:NR L2:NR L3:NR L5:NA M2:NR`
- **chiasmus** — `A1:P A2:F A3:F A4:F A5:P A6:NA A7:F B1:F B2:F B3:P B4:NR C1:F C2:NA C3:P C4:P C5:F D1:P D2:F D3:P D4:P D5:P E1:F E2:F E3:P E4:P F1:P F2:F F3:NR G1:F G2:P G3:P H1:P H2:P H3:P H4:P H6:NA I1:NA I2:NA J1:F J2:P J3:NR L1:NR L2:NR L3:F L5:NA M2:NR`
- **art** — `A1:F A2:P A3:F A4:P A5:P A6:NA A7:F B1:F B2:F B3:P B4:F C1:F C2:NA C3:P C4:P C5:F D1:P D2:F D3:F D4:P D5:F E1:F E2:F E3:P E4:P F1:F F2:F F3:NR G1:F G2:F G3:F H1:P H2:P H3:P H4:P H6:P I1:NA I2:NA J1:F J2:NA J3:NR L1:NR L2:NR L3:F L5:NA M2:F`
- **mapstory** — `A1:F A2:P A3:P A4:F A5:F A6:P A7:F B1:P B2:F B3:NA B4:P C1:P C2:NA C3:P C4:P C5:F D1:P D2:P D3:P D4:P D5:F E1:F E2:F E3:P E4:P F1:F F2:F F3:F G1:P G2:F G3:P H1:P H2:F H3:F H4:P H6:NA I1:P I2:NA J1:F J2:P J3:F L1:NR L2:F L3:F L5:P M2:F`
- **community** — `A1:F A2:NR A3:P A4:P A5:P A6:NA A7:P B1:NR B2:NR B3:NA B4:P C1:P C2:NA C3:P C4:P C5:F D1:NA D2:NA D3:NR D4:NR D5:NR E1:F E2:F E3:NA E4:P F1:F F2:F F3:NA G1:P G2:P G3:P H1:P H2:F H3:P H4:NR H6:NA I1:NA I2:P J1:NR J2:NA J3:NA L1:NR L2:P L3:P L5:P M2:P`

</details>

### R2.2 Cross-cutting root causes (merged by the critic)

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P0 | M2 | ol/Map import shadows the global Map in MapStoryTileInner, so new Map() builds OpenLayers maps without .delete. The interactive map dies about 2s after mount for every visitor, and the ref-detach throw on unmount blanks the entire app when leaving Home (4/6 archive navigations). | MapStoryTileInner.js:3, :80-83, :125-137. Screenshots: story/desktop-ol-live-b.png; archive/desktop-faxVerse-row-dest.png, desktop-history-title-dest.png (blank navy). Affected: mapstory (P0 tile), every Home exit (fax, faxVerse, witness, josephSmith CTAs). | Import as OlMap (or use globalThis.Map) with lazy useRef init. Add a per-tile boundary plus a route-level boundary. |
| P0 | D5 | /matters/narrative\|material\|concepts route to EntityPage and render 'Not found', so every matters group heading and '+N Matters' view-all is a dead end. | models/Routes.js:269 vs :273; Entity/EntityPage.js:108-113; matters/desktop-tile-mattersNarrative-dest-viewall.png. Affected: mattersNarrative, mattersMaterial, mattersConcept. | Add explicit group routes to Matters before /matters/:matterSlug. |
| P1 | F1 | Phone (and tablet at 820, +44px) layout viewport is 469px on a 390px device. .samplerMain sizes to max-content (445px) because .samplerColumns is align-items:flex-start in a column flex. MapStory min-content is the identified trigger. Every main-column tile, the header ('Gu…') and the bottom nav are cut on the right. | Sampler.css:54, Sampler.m.css:7. places/phone-vp-places.png. Measured independently by people, places, matters, scripture, analysis and story (innerWidth 469 / scrollWidth 469; hiding tile-mapstory takes samplerMain from 445 to 342.8). Affected: places, mapstory, art, biblephrases, mattersMaterial/Concept, text, commentary, community, people. | .samplerColumns{align-items:stretch} at ≤900px, min-width:0 on .samplerMain, .samplerMasonry and the MapStory frame. Harness assert clientWidth===scrollWidth. |
| P1 | A1 | At ≤900px every rail tile is hard-capped at max-height:24rem with overflow hidden and no fade. Content and Layer-1/Layer-2 CTAs are silently clipped. | Sampler.m.css:9. rail/phone-p3-tile-contents.png, phone-p3-tile-narration.png; places/tablet-placeProfile.png; matters/phone-tile-matterProfile-rest.png, phone-tile-mattersNarrative-rest.png; archive/phone-rest-tile-fax.png, phone-rest-tile-faxVerse.png. Affected: narration, contents (Read More inert), placeProfile, matterProfile (Read More unreachable), matters group tiles, fax, faxVerse. | Drop the cap. Bound content per tile (line-clamp, hero max-height) and never clip a CTA row. |
| P1 | F3 | Phone ScripturePopup drawer opens offset right and partly off-screen, with the close button at x≈430 of 390. Header and close are not visible. | scripture/phone-popup-drawer.png; rail/phone-p2-drawer.png; story/phone-popup-6s.png; matters/phone-tile-mattersNarrative-pillpopup.png. Measured drawer x118 w351, close x430. | Fix F1, then use a bottom sheet / full-width drawer with max-width:100vw and a sticky ≥44px close. |
| P1 | D5 | ScripturePopup renders wrong scripture: verse 1 is duplicated (Helaman 1:1-4 shows the superscription plus verse 1 twice), and multi-range refs repeat a verse and drop the second range (Alma 6:7-8; 7:1). | rail/desktop-nar-popup.png; story/phone-popup-6s.png; views/_Common/ScripturePopup.js:110 → ScriptureExcerpt. | Dedupe by verse id in ScriptureExcerpt and fix '; '-separated range merging. |
| P1 | E1 | Canonicalizing re-navigations use PUSH, so Back from tile deeplinks needs two or more presses (sometimes never reaches Home). Three code sites: Read slug canonicalization, the Study page block route, and the map place route. | Read.js:538 (navigate without replace) plus ScriptureExcerpt.js:20-25 readPath emitting non-canonical 'book-ch/v'. Text tile history 2→4 (scripture s8/s9). Map pin history +2 (places s4). Affected: art, notes, ScripturePopup 'Read', text, places/placeProfile map pin. | navigate(..., {replace:true}) for every canonicalization. Make readPath emit the canonical slug. |
| P1 | J1 | No image size variants anywhere: 1024-1672px JPEGs (130-640KB) serve 24-128px thumbnails. That is about 8MB per People tile, 6MB per Places tile, 2.5MB per Matters tile, 2MB per MapStory and more than 1MB of fax covers, repeated on every infinite batch. | people p4 run (8.09MB/34 imgs); places curl (~350KB each, 17 per tile, 17 tiles per scroll session); matters d1.json; story curl; archive curl (fax covers 638KB). Affected: people, personProfile, places, placeProfile, matters×4, mapstory, fax, josephSmith, witness, chiasmus avatar, narration art, art. | A media-host ?w= resize variant plus srcset/sizes. Featured or LCP images eager with fetchpriority=high. |
| P2 | M2 | No per-tile error boundary in Sampler (only MapStory has one), so any tile throw unmounts the grid. A failed lazy route chunk renders a blank page with no retry. | Sampler.js:347-354; grep ErrorBoundary → MapStoryTile.js:46 only; analysis/desktop-ch-deeplink-dest.png. | Wrap renderTile/renderReserve/infinite tiles in a null-rendering boundary. Add a route-level chunk-error boundary with reload. |
| P2 | G1 | Scripture references have three implementations with different semantics: RefPill (span role=button with key handler, nested inside card &lt;a>), ad-hoc spans with no key handler (CommentaryTile aside, NotesTile body), and replacer &lt;a> with no href (unfocusable, used in all parsed prose). | RefPill.js:22-30; CommentaryTile.js:129; NotesTile.js:179-186; scriptureLinkReplacer.js:22-25 / ViewUtils.js:81. Keyboard probes in people p1, places s5, matters s3, scripture s5/s18. Affected: every tile with prose or cards. | One &lt;button type=button class=scripture_link> primitive, used everywhere, placed as a sibling of card links rather than nested. |
| P2 | G2 | ScripturePopup focus management: focus is not moved in, not trapped, and has no aria-labelledby. Restore-on-close is inconsistent. Background still scrolls under the popup. | ScripturePopup.js:141-152. activeElement stays on SPAN.scripture_link (rail, people, archive, scripture). Scroll deltas while open (analysis a6/a15). | Focus the close button on open, trap Tab, restore to the trigger, aria-labelledby the heading, and lock html scroll. |
| P2 | C2 | ExpandableText Read More is one-way: the button unmounts, focus drops to &lt;body>, there is no Show less, and the CTA jumps position to a right-aligned 'See in context'. | ExpandableText.js:45-51; contents interact.mjs, matters s3, places s5. Affected: people, personProfile, placeProfile, matterProfile, contents, commentary (282→1669px). | Toggle the button to 'Show less' with aria-expanded and keep focus on it. Keep the Layer-2 CTA in the same slot. |
| P2 | F2 | Shared primitives have tap targets far below 44px on touch: tileHeading links 11px, RefPill 13-17px, TileCTA 25px, map pin 18px, breadcrumbs 16px, popup close 26px. | Phone tap scans in rail, people, places, matters, scripture, analysis and story. | Hit-area ::after insets to ≥44px on coarse pointers for .tileCTA, .scripture_link, .tileHeading a, .placesMapBtn. |
| P2 | A4 | Meta and eyebrow text below AA: .tileHeading #8a8a8a at 9.9px (3.4:1), .peopleFeatureTitle #888 (3.5:1), .scripture_link chip ~3.7:1 at 10px, commentary source #888, chiasm keys via --link #cfcfcf (1.6:1), reading-plan bubble numbers white on #d3d3d3 (1.5:1). | Sampler.css:147-154, 169-183, 251-256, 631-636; MiniChiasm.css:15; _tokens.scss:22. | One meta-gray token at ≥#666. Stop reusing --link for non-link text. |
| P2 | A1 | Shared name/info overlay clamps (.placesNameOverlay) leak a third line through their padding and reserve 1.7rem for a map pin that matters cards lack, cutting the key noun of entity names. | Sampler.css:1200-1211, 1232; places/desktop-places-rest.png; matters/desktop-mattersNarrative-overlay-zoom.png. Affected: places, mattersNarrative/Material/Concept, people face names. | Clamp an inner span and scope pin clearance to cards with .placesMapBtn. Give names priority over the info band. |
| P2 | D3 | Entity destination pages (/people, /places, /matters/:slug, /history/:slug, /art/:id) put the only back control below the article or omit it entirely. | people/desktop-dest-mosiah2-fold.png (y=4106); matters/desktop-profile-dest.png; archive/desktop-dest-direct-hist.png; analysis/desktop-dest-art.png. | Breadcrumb/back above the H1 on the entity template. |
| P3 | C5 | No designed :focus-visible anywhere in the sampler except MapStory, which uses an off-palette blue ring. Everything else shows the UA 'auto 1px' ring. The Read More pill and .mapStoryRef have outline:none, so focus is invisible. | Sampler.css :focus-visible only at 1789-2064; computed outline in every family's tab walk; people/desktop-people-readmore-focus.png. | One sampler-wide gold #c9a24b 2px offset ring. Replace the MapStory blue. |
| P3 | L3 | Dark mode tints TileCTA / readMorePill light blue rgba(147,198,239), and chiasm keys turn #a8c7fa. Stray blue against the gold/neutral house style. | Sampler.css:1384-1385, 1447-1457; _tokens.scss:49. Dark shots in rail, people, matters, scripture and analysis. | Gold rgba(201,162,75,…) or neutral tints in dark. |
| P3 | C1 | .tile:hover and .samplerCard:hover lift every card, including non-link containers and cards where only the image is a link. The motion is not disabled under prefers-reduced-motion. | Sampler.css:117-120, 327; reduced-motion block at 2205 covers only mapStory. | Scope the lift to real link targets and add it to the reduced-motion block. |
| P3 | A3 | Detected-scripture pills wrapped in literal parentheses wrap apart, orphaning '(' and ')' at line breaks. | getDetectedScripturesHtml; people/desktop-people-readmore-after.png, places/desktop-placeProfile-rest.png, matters/desktop-profile-revealed.png. Affected: people, personProfile, placeProfile, matterProfile. | Strip the parens or wrap '('+pill+')' in a nowrap span. |

### R2.3 Cross-tile inconsistencies

- C4/H2 Layer-2 CTA verb: 'See in context' (contents, personProfile, placeProfile, matterProfile, history, witness, text, commentary, notes, art, biblephrases) vs 'View more' (narration, map, fax, faxVerse, community) vs 'Explore full journey' (mapstory) vs '+N Places/People/Matters' cards. Worse, 'See in context' is used for entity self-pages where there is no context (profiles go to the same URL as their hero).
- CTA casing: 'Read More' (title case) beside 'See in context' (sentence case) in the same tile; 'View more' sentence case.
- Tile heading links: most eyebrows (People, Places, Facsimiles, Witnesses, Joseph Smith, Map, Matters·group, Biblical Language) link to their index, but History's is plain text and Text's 'SCRIPTURE' eyebrow links to the same passage as the card. Neither group looks clickable.
- Scripture-ref click mechanism: RefPill (popup, keyboard-operable), ad-hoc spans (popup, no keyboard), href-less replacer anchors (popup, unfocusable), and faxVerse row pills styled identically but navigating to the fax viewer.
- Person entities: face cards, PersonProfile and witness portraits link to /people or /history pages, but the chiasmus speaker avatar and name are inert, and MapStory travelers render as raw keys ('Alma2') while the popup shows 'Alma²'.
- Card link scope: people and matters cards wrap the whole card in &lt;a>; places cards link only the image (yet the whole card lifts); text tile has 3 links to one href; history has 3 tab stops to one href; art has 2.
- Reveal gating: ExpandableText/Reveal on people, profiles, contents and commentary, but josephSmith and witness clamp at 4 lines mid-word with no reveal, and placeProfile gates prose that overflows by one line.
- Scripture typography: biblephrases sets scripture in Roboto Condensed 12.5px gray, the text tile uses justified legacy feed type, while chiasmus, art and notes use the Read serif.
- Accent palette: gold #c9a24b in most tiles; MapStory uses oxblood/green plus blue focus rings; dark-mode CTAs go light blue; reading-plan dark primary is slate-blue #5c6b8a.
- Card chrome: text tile nests a second card (border, radius, grey slabs) inside the tile; every other tile is single-chrome.
- Dark-mode image treatment: history thumbs get brightness(.85), but fax covers, faxVerse crops, matters parchment images and the map tile glare at full brightness.
- Profile tiles: the profiled entity duplicates a thumbnail in the sibling group tile's mosaic (placeIndex=10 and matterIndex=6, both inside slice(5,17)). Same bug, two families.
- Skeleton heights: matters 15rem vs 373px actual, matterProfile 18rem vs 430px, readingplan 9rem vs 233px; chiasmus, biblephrases and notes render null or '…' with no skeleton at all. No shared sizing rule.
- Superscript disambiguators: People uses superscripts (Mosiah²), 'Attendees at Nephi₂'s Trial' uses a subscript, MapStory shows 'Alma2', and PlaceProfile prose shows 'Ammon 2'.

### R2.4 Coverage gaps

- Tiles never observed live: translation (backend returns null for every seed), map (structurally unreachable at reserve index 10 with MAX_RESERVES=5), chiasmus2, artFill1, artFill2, batch-only artB. Map and translation should be either fixed or removed. Do not average their gestalt into the family scores.
- ReadingProgressTile (signed-in with bookmark) was never screenshotted. Its B2 double-grow comes from code only.
- L1 logged-in was not driven for any family. The readingplan signed-in branch (chooser swap with no way back, L1 P2) is code-read only, and it is the one tile with real auth branching.
- L2 Korean was not driven anywhere. Code reads found hardcoded English in MapStory (most strings, P2), FaxTile, TranslationTile, JosephSmithTile, ScripturePopup aria-label and StudyInFeed. One Korean render pass is needed to confirm.
- F3 phone popup was not run for places, placeProfile, fax and faxVerse. That is fine because it is covered by the shared ScripturePopup F3, but backdrop-click dismissal is verified only in matters and story.
- B4 fetch-failure paths were not forced for readingplan (blank 9rem card per code), notes (rp_error_loading), chiasmus and biblephrases.
- J3 long tasks are NR across all families (Vite dev only). The 7-instances-of-OL-Map-per-render finding (mapstory J3) suggests a prod-build profile is warranted.
- The 'Unexpected token &lt;' page error was pinned by the analysis and story auditors to a root-level hashed .js (Clicky proxy path) served index.html by the Vite dev server. It is a dev-only artifact, not a tile defect, and should be closed at page level.
- The 'two children with the same key 36835/36884' (verse ids) console warnings remain unattributed across rail, archive and analysis.
- BiblePhrases F1/F3/L3 are NR because it never rendered on phone.
- MapStory on a long (20-move) story was never captured, so overlay crowding is unverified.
- Community destination D3-D5 is NR (deliberately not screenshotted: user content).
- Notes L5 (prod feature flag leak) needs a quick prod-build check, since dev doesn't apply HIDE_* consts. If confirmed, it is P1.
- History H6 / art credit for narration art thumbs is NR (/art/:id below the fold not checked).

### R2.5 Per-tile findings

#### readingplan (rail)

Craft **3** — Clean structure and real data, but a late-filling shell, inert pseudo-buttons and a mis-aimed primary CTA.
Beauty **2** — A wall of 52 washed-out grey pills with near-invisible numbers is the first thing on the page.
Belonging **3** — Card chrome matches; the pill-grid idiom is borrowed from the plan page without its color meaning.

Destinations: Start Reading → page /contents (C4 OK, but D4 mismatch). Sign In → page /home/user/signin→/home/user (needs a double Back). Bubbles: no destination though they look clickable. All real &lt;a href>.
Duds (H1): 0/5 seeds were duds (the guest tile is not randomized: always the default 52-week program)

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P1 | B1 | Root cause of the page-level phone reading-plan rug-pull: the guest tile paints as an empty 146px shell, then grows to 233px about 1.3 s later, once two uncached fetches run one after the other (mybookmark, then readingplanprograms, then readingplanpreview with useCache:false) | Height timeline, desktop: 144 skeleton @1.4s, 146 empty @2.2s, 233 with 52 segments @3.6s. Phone: 146 @2.9s, 233 @3.9s. Requests: mybookmark @2.2s, programs @2.5s, preview @2.5s. ReadingPlanTile.js:51-61 and :66; valuePropTile min-height 9rem at Sampler.css:727-731. Desktop CLS 0.0152 (src narration, readingplan). | Cache programs+preview with the sampler payload, or reserve the final height (bubble grid rows) in the shell; don't refetch with useCache:false on every mount |
| P2 | B2 | (code read) While mybookmark is in flight, the tile renders GuestPlanPreview, which starts its own fetches. If a bookmark then arrives, the whole tile is swapped for ReadingProgressTile, a different layout and height, after first paint | ReadingPlanTile.js:185-202 (bookmark undefined → falls through to GuestPlanPreview/SignedInPlanTile; `if (bookmark) return &lt;ReadingProgressTile>`). ReadingProgressTile.js:279-281 renders an empty pane until pageinfoprogress resolves, a second grow | Render a fixed-height neutral placeholder while bookmark===undefined, and resolve the bookmark with the sampler payload |
| P2 | B4 | (code read) If readingplanprograms fails or returns nothing, the tile stays a blank 9rem white card forever, with no heading or CTA | ReadingPlanTile.js:63 (catch → console.warn only) and :66 `if (!program) return &lt;div className="samplerTileInner valuePropTile" />`; same for the signed-in loading state at :135 | On failure, render the heading + Start Reading CTA without bubbles, or hide the tile |
| P2 | C1 | The 52 week bubbles look interactive (cursor:pointer, hover tooltip with the passage range) but do nothing on click | desktop-rp-hover-bubble.png; computed cursor 'pointer' from ReadingPlan.css:16-37 (.segmentListItem cursor:pointer); ReadingPlanTile.js:26-32 renders plain &lt;div title> with no handler | Either make each bubble a link to its segment's first page, or set cursor:default in the tile scope |
| P2 | A4 | Bubble numbers are white 9.6px text on #d3d3d3, about 1.5:1 contrast, so they're illegible | desktop-rest-tile-readingplan.png; computed color rgb(255,255,255) on rgb(211,211,211), font-size 9.6px | Use #555 text on #e6e6e6 (or drop the numbers and use a cleaner dot grid) |
| P2 | D4 | 'Start Reading' sits under a 'Book of Mormon in a Year' plan preview, but goes to the generic /contents table of contents; it doesn't start the plan or open week 1 | desktop-rp-dest-start.png (Table of Contents); ReadingPlanTile.js:74 `to="/contents"` | Link to the plan's first segment (/1-nephi…) or to the plan wizard; otherwise label it 'Browse contents' |
| P2 | D5 | 'Sign In' lands on /home/user: a 'Study progress for Guest: % Completed • % Started' panel with the numbers missing. The login form is pushed to the right column | desktop-rp-dest-signin.png | Route Sign In to a login-first view, and don't render the progress header for guests |
| P2 | E1 | Back from Sign In takes two presses: /home/user/signin pushes a redirect to /home/user, so the first Back lands on /home/user/signin | Back chain measured: /home/user → /home/user/signin → /home (dest.mjs output) | Use &lt;Navigate replace> for the signin → user redirect |
| P2 | L1 | (code read) For signed-in users, 'Start Reading'/'Manage plan' swaps the small rail tile for the full ReadingPlan Gallery/Wizard, and the tile has no path back to the bubble view | ReadingPlanTile.js:128-133 (chooser → &lt;ReadingPlan/>); setChooser(false) is only called inside load() at :96, which runs only on token change | Open the plan chooser as its own page/modal (it has a canonical home), or add a Close that resets chooser |
| P3 | F2 | Start Reading / Sign In pills are 33px tall on phone (&lt;44px) | phone tap-target scan: Start Reading 110×33, Sign In 74×33 | min-height 44px on .valuePropPrimary/.valuePropSecondary at ≤900px |
| P3 | L3 | Dark mode: bubble numbers are #aaa on #777 (~2:1), and the primary CTA turns slate-blue #5c6b8a, off house style | desktop-dark-tile-readingplan.png; computed seg color rgb(170,170,170) on rgb(119,119,119); .valuePropPrimary dark bg rgb(92,107,138) (Sampler.css:776) | Neutral-gray dark palette for both; a gold or near-white primary |
| P3 | H2 | The guest hook is a grid of 52 identical grey numbered pills; it says 'calendar', not 'why read' | desktop-rest-tile-readingplan.png, phone-rest-tile-readingplan.png | Collapse to a compact progress strip + one line of value proposition / today's reading |

#### section (rail)

Craft **3** — Good content model (beat → page, ref → popup), but the art strip spacing, inverted hierarchy and nameless links feel unfinished.
Beauty **3** — Readable and calm on desktop; the floating thumbnails and pill-heavy beats look busy.
Belonging **4** — Same refs, dots and story-beat language as the Study page it links to.

Destinations: Beats → page /:page/:id (study page, scrolled to section; correct per C4). View more and crumbs → section/page study pages (page, correct). RefPill → ScripturePopup (popup, correct per C4; desktop modal, phone right drawer). Art → page /art/:id (canonical URL, so page is acceptable, but see D3). All navigation is real &lt;a href>; the RefPill is a span with role=button.
Duds (H1): 0/5 seeds were duds (6–13 beats each; shortest beat 64–98 chars; 1–4 art thumbs). Heights range 491–1030px.

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P2 | G3 | Art thumbnails are links with no accessible name: img alt="" inside an &lt;a> with no text or aria-label, so screen readers announce 'link' twice | NarrationTile.js:76-84; tab-order dump shows two A elements with empty text in tile-narration | alt from the art title, or aria-label on the link |
| P2 | D3 | Art thumbnails open /art/:id, where the whole fold is the image: no title, caption or back/return control | desktop-nar-dest-art.png (/art/3294) | Title + caption + back control above the image; or open the art in the existing image popup (quick look) |
| P2 | F2 | Breadcrumb links are 16px tall, too small to tap on phone (RefPills are 17px, see cross-cutting) | phone tap-target scan: 'Zarahemla's Age of War' 115×16, 'Judgment–Seat Dispute' 118×16 | Pad crumbs to ≥44px hit area at ≤900px |
| P3 | A3 | Hierarchy inverted: the current section's title appears only as a small grey breadcrumb, while the continuation section ('Pahoran's Assassination') gets a 0.95rem/800 heading, so the next section reads as the main subject | desktop-rest-tile-narration.png; Sampler.css:952-961 vs .narrationCrumbs | Give the current section a title of the same weight; demote the 'next' title to a labeled divider ('continues: …') |
| P3 | A5 | Art strip uses space-around with mixed aspect ratios, so two thumbs float at 1/4 and 3/4 with big holes, and four wrap into a ragged 2×2 | desktop-rest-tile-narration.png, desktop-seed2-narration.png; Sampler.css:969-976 | Fixed-height row with gap and justify-content:flex-start, or a cropped equal-cell strip |
| P3 | J1 | Art thumbs load full 700px originals to display at ~66–70px (≈5× needed at DPR2) | rest-desktop.json: art/3294 natural 700×789 shown 66×74; art/3293 700×732 shown 70×74 | Request a thumbnail size (e.g. /art/:id?w=160) or srcset |
| P3 | L3 | Dark mode: the read-status dots (blank.svg, fill #DDD) render as bright white dots down the left edge, the loudest thing in the tile | desktop-dark-tile-narration.png; NarrationTile.js:7 blank.svg | Dark variant of the dot (e.g. #555) or a CSS dot driven by status |
| P3 | H2 | For guests every beat shows the same grey 'not read' dot, so the column carries no information | desktop-rest-tile-narration.png (7/7 dots blank) | Hide status dots for guests / when no beat has progress |

#### contents (rail)

Craft **2** — Real links into the guide, but the reveal is broken on mobile, nested interactives, and a gate that hides a duplicate link.
Beauty **2** — A strong banner image, then a long grey wall of middot-separated links.
Belonging **3** — Same image and title as /contents, but the dense inline outline looks nothing like the airy /contents card lists.

Destinations: Title/image/description → page /:division (correct per C4). Outline links → page /:page/:section (correct). Heading 'Contents' → /contents. Read More → inline reveal (Layer 1, correct, but not reversible). See in context → page. All real &lt;a href>.
Duds (H1): 0/5 seeds were duds. Only ~11 divisions exist, so the same division repeats across resamples (Downfall ×2, Age of War ×2 in 6 samples)

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P1 | C2 | On phone/tablet, 'Read More' does nothing visible: the text expands and the gated 'See in context' link appears, but both are inside the 24rem clipped tile, so the reader taps and nothing changes | phone after Read More: tile height 384 → 384, scrollHeight 1033, deeplink present but below the clip (sweep.mjs). Sampler.m.css:9 + .tile overflow:hidden (Sampler.css:107) | See cross-cutting rail clip: let rail tiles grow on mobile, or clamp the outline rather than the card |
| P2 | A1 | The tile is a 650–1000px wall of 27–58 small grey outline links; on desktop it's the tallest thing on the page and reads as a sitemap, not a tile | desktop-ct-after-reveal.png; seeds: 1000px/58 links, 894/52, 646/30, 658/27 | Show the division's pages only (3–6 bold links) and fold sections behind the reveal or the deeplink |
| P2 | C3 | The Layer-2 'See in context' link is gated behind Read More, but appears ~900px below the button, under the whole outline. The title and image above already link to the same URL, so the gate hides a duplicate | desktop-ct-before-reveal.png vs desktop-ct-after-reveal.png (deeplink count 0 → 1, placed after the outline); ContentsTile.js:403 and :438 both go to /${data.slug} | Drop the gate here (no RevealProvider) or put the deeplink directly under the description |
| P2 | G1 | The Read More &lt;button> is nested inside the contentsTileHead &lt;a> (invalid interactive nesting); a single 339px link wraps title, image and description | ContentsTile.js:403-416; links dump: A /downfall 337×339 containing BUTTON 'Read More' | Make only the title (and image) the link; put the description and its reveal outside the &lt;a> |
| P2 | F2 | Dozens of 13px-tall inline outline links, separated only by middots, on phone | phone tap-target scan: outline section links 13px tall (e.g. 'Mormon's Youth' 70×13) | Fewer, block-level links with ≥44px rows on mobile |
| P3 | C1 | The large head link (title, image and prose) has no hover or underline state, so it's unclear that clicking the description navigates while the pill under it expands | Sampler.css:671-675 (.contentsTileHead has no :hover rule); desktop-ct-before-reveal.png | Hover state on the title/image only, after narrowing the link per G1 |
| P3 | H2 | CTA wording drifts: this tile says 'See in context' (label view_in_context) while its rail neighbour Narration says 'View more' for the same 'open the study page' action | desktop-ct-after-reveal.png vs desktop-rest-tile-narration.png; ContentsTile.js:438, NarrationTile.js:92 | One verb for 'open the page' across tiles |
| P3 | A4 | Outline section links are #777 at 11.2px on white (4.48:1), just under AA | computed .contentsOutlineSections a rgb(119,119,119) 11.2px; Sampler.css:702-705 | #6b6b6b or darker |

#### people (people)

Craft **3** — The structure is solid, but the details are half-finished: mid-word name ellipses on half the cards, 9.6px meta type, dangling 'of…' titles, 8MB of unresized images, and a cramped 4-up phone strip that clips its own pills.
Beauty **4** — At 1440 the painted portraits in a 6-up strip under a featured bio are the most attractive thing on Home, and a marketing screenshot would use it.
Belonging **4** — It uses the site's scripture-pill style and card chrome; the featured bio reads like the person page.

Destinations: Face card / featured name / portrait → page /people/:slug (real &lt;a href>, middle-click opens a tab); view-all mosaic and heading → page /people; RefPill and bio scripture refs → ScripturePopup (modal on desktop, side drawer on phone, no history entry); Read More → inline reveal. All match the C4 rule.
Duds (H1): 2/5 featured samples were duds (Jerusalem Prophets, an anonymous group with a short bio; Nephites of the City of Moroni, a group shown with a landscape image), plus Uzziah, a Bible king, as a weak hook

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P2 | A1 | Face-card names, the primary label of each card, are cut mid-word by the CSS ellipsis: 'Famished Neph…', 'Twelve Discipl…', 'Lamanite Quee…', 'Gadianton Rob…', 'Nephite Trialg…', 'Three Nephite …'. Up to 6 of 11 cards on desktop, worse on phone ('Angel t…', 'Manas…', 'Seezor…', 'Lamani…'). | desktop-resample-2.png (6/11 truncated), desktop-h1-sample-1.png, desktop-h1-sample-4.png, phone-people-rest-nomapstory.png; Sampler.css:364-379 .peopleFaceName white-space:nowrap + text-overflow:ellipsis | Let the name wrap to 2 lines (line-clamp 2, like .peopleFaceTitle), or move it into the card body instead of a one-line overlay chip |
| P2 | F1 | Phone (4-up at 97px cards): scripture pills in the face-card body overflow the card and are clipped at its edge ('Helaman 11:8', '2 Nephi 19:21', 'Helaman 9:26' cut off), and titles and bodies collapse to 1-2 word fragments ('Pleading Du…', 'Gives up kingdom to…'). | phone-people-rest-nomapstory.png (cards 97×182px); Sampler.css:186-194 pill white-space:nowrap; Sampler.m.css:26 repeat(4,1fr) | At ≤480px go 3-up (or 2-up) face cards, or drop the index body on phone and keep portrait + name |
| P2 | A3 | Type in the face strip is below a legible floor: titles 9.6px, index text 9.92px, pills 9px (0.56rem), all on a 1440 desktop. | p1 run computed styles: .peopleFaceTitle 9.6px, .peopleFaceIndexText 9.92px; Sampler.css:380-419, 186-194 | Raise the face-strip floor to ~11-12px; 11 cards plus 1 is too dense, so 8 faces at a readable size would beat 11 at 9.6px |
| P2 | A4 | Text contrast fails WCAG AA: face index text #777 on #fbfbfb ≈4.3:1 at 9.9px, and featured title #888 on white ≈3.5:1 at 12px. | Sampler.css:251-256 (.peopleFeatureTitle #888), Sampler.css:411-419 (.peopleFaceIndexText #777); p1 run computed colors | Use #666 or darker for meta text at these sizes |
| P2 | F2 | On phone the face-card RefPill tap target is 45×13.6px, sitting inside a card-sized link. A slightly missed tap navigates to the person page instead of opening the verse. | p8 run: face pill box 45.4×13.6px; Read More pill 85×25px | Pad the pill's hit area (e.g. ::after inset -12px), or drop the pill from cards on touch |
| P2 | J1 | The tile pulls 34 full-size 1024×1024 JPEGs (≈7-8 MB) to paint 128px portraits, 111px cards and 36×49px mosaic thumbs. There is no srcset or resized variant. The above-the-fold featured portrait (likely LCP) is loading=lazy with no fetchpriority. | p4 run: total people img bytes 8,090,996 (desktop) / 7,232,855 (phone), n=34; mosaic img natural 1024 vs rendered 36×49; PeopleTile.js:37,65,93 | Serve sized variants (e.g. /people/&lt;slug>?w=256) via srcset, and make the featured image eager with fetchpriority=high |
| P3 | A1 | Phone: the 2-line-clamped face title leaks a third line into its bottom padding, so ghost text shows under 'Divine Messenger…' and 'Son of Joseph¹,…'. | phone-people-rest-nomapstory.png (Angel to Amulek, Manasseh cards); Sampler.css:380-397 padding on a -webkit-line-clamp box | Put the padding on a wrapper, or set max-height to exactly 2 line-heights on the clamped element |
| P3 | H3 | Face titles word-budgeted by clampWords(…,5) end on a dangling function word: 'Namesake of the valley of…', 'Son of Joseph¹, father of…', 'Conquerors of Jerusalem, Exilers of…', 'Son of Lehi¹, prophet and…'. Seen in 4 of 4 samples checked. The featured bio's CSS clamp also cuts mid-word ('Uzziah is also named in the genealog…'). | PeopleTile.js:70; desktop-people-facerow.png; desktop-h1-sample-1.png (featured bio 'genealog…'); p9 run titleOrphan list | In clampWords, back off trailing stop-words (of/and/the/to/by) before adding the ellipsis |
| P3 | A3 | Detected-scripture pills in the bio sit inside literal parentheses, giving doubled bracketing '( Mosiah 6:3–5 )'. Because the parens can wrap away from the pill, '(' is orphaned at a line end and ')' at the start of the next line. | desktop-people-readmore-after.png ('answered for (' / 'Mosiah 29:25–26 )'); PeopleTile.js:49 getDetectedScripturesHtml | Strip the wrapping parens when a detected ref is rendered as a pill (or glue them to it with a nowrap span) |
| P3 | A7 | Data junk in titles and index text: subscript digit 'Attendees at Nephi₂'s Trial' (every other disambiguator is superscript), and the typo 'Did raise rebellion againts Kim'. | desktop-resample-2.png (Nephite Trialg… card), desktop-h1-sample-4.png (Brother of Kim card) | Normalize ₀-₉ to superscripts in supDigits/replaceNumbers; fix the source row |
| P3 | G1 | Each face card is an &lt;a> wrapping a role=button span (RefPill), which nests interactive content inside a link. Screen readers announce a button inside a link, and Tab stops twice per card (22 stops for the strip). | PeopleTile.js:59-81; p1 focus sequence A.peopleFaceCard → SPAN.scripture_link → A.peopleFaceCard… | Make the card a container with a stretched name link and a sibling pill button, rather than a link wrapping a button |
| P3 | H1 | Dud rate 2/5 for the featured slot: anonymous collectives lead the tile ('Jerusalem Prophets', 'Nephites of the City of Moroni', the latter with a landscape image instead of a person), and 1 more (Uzziah, King of Judah) is a Bible figure as the hook of a Book of Mormon site. | desktop-h1-sample-4.png, desktop-resample-2.png, desktop-h1-sample-1.png; good samples: desktop-people-rest.png (Mosiah²) | Bias the featured pick server-side toward named Book of Mormon individuals with a portrait and a ≥N-char bio; keep groups to face cards |
| P3 | A1 | Dead phone CSS: Sampler.m.css sets .peopleFeatureDesc -webkit-line-clamp:3, but the clamp lives on ExpandableText's inner div via an inline style (lines=7), so phone shows a 7-line bio. | Sampler.m.css:23 vs ExpandableText.js:40-44; phone-people-rest-nomapstory.png (7 lines) | Pass lines responsively (or via a CSS variable), and delete the dead rule |

#### personProfile (people)

Craft **2** — It is a copy of the People featured block dropped into a column a third as wide, without adapting the layout. It has no image fallback, and the CTA label is wrong.
Beauty **3** — Collapsed, it looks like a tidy portrait-plus-bio card. Expanded, it is a tall, narrow wall of text.
Belonging **4** — It reuses the People featured anatomy and the site's scripture pills, so it is visibly the same product.

Destinations: Name / portrait / 'See in context' deeplink (shown only after Read More, exit-arrow TileCTA) → page /people/:slug; bio scripture refs → ScripturePopup; Read More → inline reveal. Matches the C4 rule. Back from the deeplink restored scrollY 2886→2886, but Home reshuffles (page-level E1/E2).
Duds (H1): 0/4 visually checked samples were duds (Abinadom, Lamanite King³, Coriantor, Gilead), and the batch profiles collected while scrolling (Seantum, Aaron², Five Men, Zerahemnah, Jeremiah¹, Coriantor, Other Sheep) did not repeat. Not checked: whether group entries like 'Five Men' or 'Other Sheep' read as duds.

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P2 | A1 | In a 1/3-width column the fixed 8rem portrait leaves a narrow ~340px text column. Once expanded, the bio runs to ~1,100px tall while the area under the portrait stays empty for ~800px, so the tile becomes a long thin ribbon of text beside a dead gutter. | desktop-profile-expanded.png (tile 260→552px, column ~340px), desktop-dark-profile.png (Gilead, ~1,250px tall at 2x) | In narrow spans stack the portrait above the bio (or float it so text wraps under), or cap the expanded height and hand off to the person page |
| P2 | M2 | When the portrait errors, onError sets visibility:hidden on the image, which also hides its grey placeholder. The tile shows a blank 128×171 white hole beside the name, and there is no fallback image. | desktop-profile-rest-0.png (Abinadom: no portrait, no placeholder); p3 run measured naturalWidth 0, computed visibility 'hidden'; PersonProfileTile.js:38 (same pattern PeopleTile.js:38) | On error swap to a monogram/silhouette fallback (or collapse to a no-image layout) instead of hiding |
| P2 | A4 | The featured title #888 on white is about 3.5:1 at 12px, the same as on the People tile (shared .peopleFeatureTitle). | Sampler.css:251-256 | Darken to #666 |
| P3 | H2 | The Layer-2 CTA reads 'See in context' (label view_in_context) but leads to the person's own page, which is not 'context'. The heading is the same 'PEOPLE' as the People tile, so the reserve reads as a stray second People tile. | PersonProfileTile.js:29,51; desktop-profile-expanded.png | Use 'Read profile' or '&lt;Name> →', and a distinct eyebrow (e.g. 'Person' / 'Who was…') |
| P3 | H3 | The bio has the same paren-around-pill problem, with '(' and ')' orphaned across line breaks; in a narrow column it happens on nearly every ref. | desktop-dark-profile.png ('drunk (' / 'Ether 14:5 )', 'throne (Ether 14:6' / ')'), desktop-profile-expanded.png | See People A3: strip or glue the parens |
| P3 | J1 | A 1024×1024 JPEG (≈186KB for Abinadom) is used for a 128×171 portrait. On batch insertion portraits are still grey placeholders 1.5 s after scroll-into-view. | p4 run (abinadom 186,373 bytes, natural 1024); desktop-h1-sample-0-profile-4.png (Coriantor grey placeholder) | Serve a sized variant via srcset |

#### places (places)

Craft **3** — Clipped names, a half-visible third info line, a phone overflow, 6 MB of 1024px JPEGs for 104px thumbnails, and nine dead CSS classes (.placesTileName, .placesTileMapLink, .placesThumb, .placesTileDesc, .placesTileRef, .placesMosaicWrap, .placesViewAll, .placesMosaicCaption, .placesTileNameRow) plus a '16:9' comment on a 1:1 rule (Sampler.css:1183-1186) read as unfinished.
Beauty **4** — The painted place art in a 3×2 grid with a mosaic end-cell is the most attractive card set on the page, though the three stacked text layers (name chip, info band, index line) crowd each 104px card.
Belonging **3** — Card chrome and the RefPill match siblings, but the serif scripture pill inside a Roboto Condensed overlay card and the people-style name chips on landscape art feel bolted together rather than designed for Read.

Destinations: Image → /places/:slug (page, entity with canonical URL: matches C4). Map pin → /map/internal/place/:slug (page: matches C4, but Back is broken, E1). RefPill → scripture popup (popup for a verse: matches C4; Esc closes, focus returns to the pill, no history entry). Heading 'Places' and mosaic '+171 Places' → /places index (page: matches). All are real &lt;a href> except the RefPill (span role=button, which is correct for a popup). E2 reshuffle on Back was reproduced (Back from /places/moroni landed scrollY 1311 vs 1224 with a different layout) but is already filed at page level.
Duds (H1): 0/5 seeds were duds: all 25 sampled cards had images (naturalWidth >0, none hidden) and an index ref. 1 of 5 resamples produced no Places tile in the initial page.

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P1 | F1 | On phone (390px) the Places tile is 445px wide and runs off the right edge. The second card column is cut mid-text ('Jaredite population hub near the…'). _Critic: downgrade → merged: These are symptoms of the single cross-cutting F1 overflow, not tile defects. Fold them into the merged F1 so it is not counted 4 more times as P1._ | phone-vp-places.png. Measured: tile width 445.25 at x=23.6 in a 390 viewport. documentElement.scrollWidth 469 vs innerWidth 390. Parent .samplerMasonryCol is 456px wide. Forcing .placesTileGrid to minmax(0,1fr) does not fix it (still 469), so the root cause is the masonry column width (see crossCutting). | Constrain the phone masonry column to the viewport (min-width:0 / max-width:100% on .samplerMasonryCol and its tiles), then re-check the Places 2-up grid. |
| P1 | J1 | Every place image is a full 1024×1024 JPEG of about 350 KB, but it renders at 104 CSS px (card) or about 35 px (mosaic). One Places tile pulls about 6 MB, and infinite scroll repeats it. | PlacesTile.js:32 and :68 (`${assetUrl}/places/${slug}`, no srcset or size variant). curl: moroni 348004 B, amulon 351094 B, midian 354364 B. naturalWidth 1024 vs rendered 104. 17 images per tile. 17 Places tiles appeared in one 45-wheel scroll session. | Serve a sized variant (for example /places/{slug}?w=240 or a thumbs path) with srcset, and use a tiny thumb for mosaic cells. |
| P1 | E1 | The corner map-pin deeplink lands on /map/internal/place/:slug with a duplicate history entry. The first Back stays on the same map URL and only the second Back reaches Home. | desktop-dest-map-pin.png. s4.mjs: history.length went 2 to 4 after one click, framenavigated fired twice for /map/internal/place/moroni, back#1 stayed on /map/internal/place/moroni, back#2 reached /home. /map (no place) returned in one Back. | In the map route, use replace (not push) when it canonicalizes or re-navigates to the place URL on load. |
| P1 | D5 | The map-pin destination looks half-baked above the fold. The panel title 'City of and Land of Moroni' wraps over its subtitle, and the description shows raw link markup ('{The Nephites\|nephites}', '[Nephihah\|nephihah]', '{Moroni\|moroni1}'). | desktop-dest-map-pin.png (left panel, top and body). Also 4× HTTP 404 for media.bookofmormon.online/map/internal/7/31/55-58 on that page. | Render the description through the same entity-link parser the /places page uses; give the panel title its own line box (no fixed height) so it can wrap. |
| P2 | A1 | The info overlay band (p.info, double-truncated by clampWords plus CSS) overflows its 2-line box, so half of a third line shows at the image bottom edge. | desktop-places-rest.png (Great Jaredite City, City of Aaron, Land of Amulon cards). Measured .placesInfoOverlay scrollHeight 42-54 vs clientHeight 30 on 4/5 cards (seed 0) and 1/5 on seed 2. PlacesTile.js:40, Sampler.css:1232. | Apply a real -webkit-line-clamp/overflow:hidden to .placesInfoOverlay (or a max-height in line units), and drop the clampWords(…,8) pre-ellipsis so there is one truncation, not two. |
| P2 | H3 | Place names, the card's primary text, are clamped to 2 lines on a 104px card. Readers see 'City of and Land of…' and 'Great Jaredite…', and the same truncated name repeats on 2/5 cards in a seed. | desktop-places-rest.png. Measured .placesNameOverlay clipped on 'City of and Land of Moroni' and 'Great Jaredite City'. Sampler.css:1200-1210 (line-clamp:2, max-width calc(100% - 1.7rem)). | Use a smaller name tier on 3-up cards or let the name take a third line; never clip the entity name while the secondary info band gets two lines. |
| P2 | F2 | The map-pin deeplink is an 18×18px target in the image corner, below the 44px minimum on phone and tablet and right beside the image link. | Measured 18x18 on phone, tablet and desktop (s7.mjs pins). Sampler.css:1223 (.placesImgWrap > a.placesMapBtn 1.1rem). | Keep the 1.1rem glyph but pad the anchor to 44×44 (negative margin or an inset hit area). |
| P2 | C1 | The whole card lifts on hover (.samplerCard:hover), but only the image is a link. The name overlay is pointer-events:none, and the body text under the image is inert except for the RefPill. | desktop-places-hover.png. PlacesTile.js:28-58 (Link wraps only the img; .placesTileInfo is outside it). Sampler.css:327 (.samplerCard:hover). | Make the card a stretched-link target (a pseudo-element overlay from the image link, with the pill and pin raised above it), or limit the hover lift to the image. |
| P2 | H4 | Places saturates the infinite feed. Every batch carries both a Places tile and a PlaceProfile, and card places repeat across batches. | s10.mjs, one desktop scroll session: 17 Places tiles + 17 PlaceProfile tiles out of 349 tiles. 102 place slots, only 76 unique. moab and samaria appeared 3×; 13 others 2×. registry.js:96 ('places' in INFINITE_REGISTRY_KEYS) and :102. | Exclude places already shown this session when assembling a batch (pass seen slugs or dedupe client-side), and show Places/PlaceProfile only every N batches. |
| P3 | A7 | Data junk in the info and index lines: 'Pool near Jerusalem1' (stray footnote digit), a trailing ';' ('record depository;'), and the typos 'Penninsula', 'Capitol of Syria' and 'conquerers'. | s2.out seeds 2-3: Waters of Shiloah, Hill Cumorah, Horeb, Damascus, Assyria info strings. | Clean bom places.info data; strip trailing punctuation in clampWords. |
| P3 | D3 | On the /places/:slug destination the only return control ('❮ Places') sits after the article body, bottom-left, not at the top where people look for it. It stays above the fold here only because the article is short. | desktop-dest-place-page.png ('❮ Places' at about y=680 CSS px, after the prose). | Move the breadcrumb/back link above the title (part of §S). |
| P3 | C5 | Keyboard focus on the image, pin and heading links shows the UA default ring (outline auto 1px rgb(16,16,16)). It is a dark ring on dark imagery, inconsistent with the styled mapStory focus rings. | desktop-places-focus-tab1.png, desktop-places-focus-tab2.png. tabseq outline 'auto 1px rgb(16, 16, 16)'. Root cause is shared (see crossCutting C5). | See crossCutting: add a sampler-wide :focus-visible ring. |

#### placeProfile (places)

Craft **3** — Solid at 1440 and 390, but clipped to a bare image at tablet, a token Read More that reveals one line, leaked 'Ammon 2', and the profiled place duplicated in the neighbouring mosaic.
Beauty **4** — A large painted hero with a clean name chip and readable body copy. It screenshots well on desktop and phone.
Belonging **4** — Matches PersonProfile/MatterProfile anatomy (hero, prose, Reveal then deeplink) and Read-page scripture styling.

Destinations: Hero image → /places/:slug (page; matches C4). 'See in context' deeplink → the same /places/:slug (page; matches C4 but redundant with the hero). Map pin → /map/internal/place/:slug (page; Back double-push, E1). Read More → Layer-1 inline reveal (matches C4). Detected scripture in prose → scripture popup (matches C4; opens without a URL change; not keyboard reachable, G2). Back from the deeplink returned to /home in one press (E2 reshuffle already filed at page level).
Duds (H1): 0/3 seeds were duds (Land of Midian, Land of Lehi's Inheritance, Egypt): all have hero art and 374-2399 chars of description. Batch instances (17 seen) had no repeats of the profiled place.

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P1 | F1 | At tablet (820px) PlaceProfile lands in the stacked left rail at full width (772px). Its 16:9 hero alone is about 430px, and the rail's max-height:24rem cuts the tile at 384px, so the description and CTA are hidden with no affordance. | tablet-placeProfile.png (tile shows only the image). Measured: tile h 384, inner scrollHeight 548, overflow hidden, so 164px are clipped. Sampler.m.css:9 (.samplerLeftRail .tile { max-height: 24rem }). Root cause is shared (see crossCutting A1). | Drop the blanket rail max-height (or replace it with a line-clamp on the description), and cap the hero height on wide single-column layouts (max-height ~14rem). |
| P1 | E1 | The map-pin deeplink (shared .placesMapBtn) has the same duplicate-history bug as Places: two Backs are needed to get home. | PlaceProfileTile.js:42-49 links to /map/internal/place/:slug, the same route measured in s4.mjs (history +2 per click). | Same fix as the Places E1 finding: use replace() in the map route's place canonicalization. |
| P2 | G2 | Detected scripture references in the description render as &lt;a class=scripture_link> with no href, so keyboard users cannot reach them. Tab goes image, then pin, then CTA, skipping 'Alma 24:5'. | s5.mjs tab sequence (placeProfileImgLink → placesMapBtn → tileMoreLink). The anchors list shows A.scripture_link href=null. ViewUtils.js:81. Root cause is shared (see crossCutting G1). | See crossCutting: emit RefPill-style role=button tabIndex=0 or a real href in getDetectedScripturesHtml. |
| P2 | H4 | The profiled place always also appears as a thumbnail in the same seed's Places mosaic. placeIndex defaults to 10 and the mosaic is data.slice(5,17). | s2.out: mosaicHasProfile=true on 3/3 seeds that had both (midian, lehis-inheritance, egypt). PlaceProfileTile.js:21 (placeIndex = 10), PlacesTile.js:16. | Pick a place outside indices 0-16 (for example index 17+), or pass the Places tile's used slugs and exclude them. |
| P2 | F2 | The map-pin target is 18×18px. On bright sky imagery the white pin is nearly invisible (top-right of Land of Midian). | phone-vp-placeProfile.png (pin barely visible against the sky). Measured 18x18. Sampler.css:1568-1569. | Use a 44px hit area and a subtle dark scrim circle behind the glyph. |
| P3 | A7 | A disambiguation suffix leaks into prose: 'When Ammon 2 and his brethren…'. | desktop-profile-before.png, phone-vp-placeProfile.png (Land of Midian description). | Strip numeric person-disambiguation suffixes from place.description at the source or in flatten(). |
| P3 | H3 | 'Read More' adds about one line (the tile grew from 368 to 405px, +37px) and cannot be collapsed again. | desktop-profile-before.png vs desktop-profile-after-reveal.png. s5.mjs: reveal h 368→405, collapse control count 0, and siblings below shift +37px. | Don't gate prose that overflows by less than about 2 lines (show it in full and the CTA at once); the collapse issue is crossCutting C2. |
| P3 | H2 | The deeplink reads 'See in context' but goes to the same /places/:slug page as the hero image. There is no 'context'; it is the place page. The label is also inconsistent with Map's 'View more' and Places' '+171 Places'. | s5.mjs: deeplink /places/midian 'See in context'. PlaceProfileTile.js:56. | Label entity-page deeplinks with the entity ('Open Land of Midian' / 'Place details'). |
| P3 | A2 | Some hero images are slightly upscaled at 2× DPR. For example the Egypt source is 593px wide displayed at 337 CSS px (674 device px). | s2.out seed 3: prof egypt nw 593, rw 337. | Ensure ≥ 800px sources for hero use, or cap the rendered width. |
| P3 | A4 | Scripture refs inside the description render as the serif gray-boxed pill with stray spacing ('( ↵ [2 Nephi 20:30; Isaiah 10:30] )'), which breaks the line with an orphaned '('. | desktop-placeProfile-rest.png (Gallim description, lines 3-4). | Keep the parenthesis attached (nowrap the '(' + pill + ')' run) in getDetectedScripturesHtml output. |
| P3 | C5 | UA default focus ring on the hero, pin and CTA. | desktop-profile-focus.png; outline 'auto 1px'. | See crossCutting C5. |

#### map (places)

Craft **2** — Unreachable in production. When forced it letterboxes, pans into the void, and has a '…' fallback: a taster that was never finished.
Beauty **2** — An unlabeled green-and-blue blob between gray bars; on its own it doesn't read as a Book of Mormon map.
Belonging **3** — Card chrome and the CTA pill match siblings, but the content looks nothing like the labeled /map it links to.

Destinations: Heading 'Map' and 'View more' CTA → /map (page, own canonical URL: matches C4). Real &lt;a href>. Back returned to /home in one press (E2 reshuffle is page-level). The canvas has no destination (not a link). Destination above the fold is fine (labeled FARMS map, zoom controls).
Duds (H1): 5/5 seeds would be duds: the tile renders the identical unlabeled view regardless of seed (and in practice 0/5 seeds rendered it at all).

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P2 | H1 | The Map tile can never appear. It is the 10th of 10 reserve entries, the balancer always takes the first unused ready entry, and MAX_RESERVES is 5, so at least five always-ready reserves fill every slot before it. It is also absent from batchTiles. | Sampler.js:12 (MAX_RESERVES = 5), Sampler.js:216-219 (reservePool.find first unused). registry.js:80-91 (map last; personProfile/translation/josephSmith/placeProfile/chiasmus2 effectively always ready), registry.js:97-104 (not in batchTiles). Live: absent in 5 desktop seeds + a 30-step scroll, and on phone and tablet (s1, s2, s7 logs). | Either give the map a guaranteed slot (for example a fixed main-column position below the fold or every Nth batch) or delete MapTile/MapTileInner and the reserve entry. |
| P2 | H2 | When forced to render, the tile is a featureless coloured landmass: no place labels, no markers, no title or hint of what it is. It is the same view every seed, so it is a guaranteed dud and gives no hook to click. | desktop-map-rest.png vs desktop-dest-map-cta.png (the real /map has labels and dots). MapTileInner.js:21-24 (deliberately no markers), :32-52 (single XYZ layer). | Add the labels layer and a few seeded markers (for example this seed's Places), or replace it with a static labeled preview image linking to /map. |
| P2 | A1 | At zoom 6 the tile source covers only the middle of the 16rem frame, leaving flat gray letterbox bars on both sides (about 22% each at desktop). Dragging pans freely into empty gray because there is no view extent. | desktop-map-rest.png (side bars), desktop-map-dragged.png (frame almost entirely gray after a 120×60px drag), tablet-map.png. MapTileInner.js:44-49 (no extent/constrainOnlyCenter). | Fit the view to the source extent (view.fit(extent, {size})) and set extent on the View so panning can't leave the map, or crop with a background matching the sea colour. |
| P3 | C1 | The canvas is draggable and double-click zooms, but nothing signals that it is interactive, and dragging is a dead end (see A1). Meanwhile the only path to /map is a small 'View more' pill. Clicking the map itself does nothing. | desktop-map-dblclick.png. s6.mjs anchors: canvas tabIndex -1, only the heading and CTA are links. | Make the frame itself a link to /map (disable drag) or add visible zoom/expand affordances. |
| P3 | A7 | The Suspense fallback is a bare '…' glyph centred in a gray box, a placeholder that reads as unfinished while the OpenLayers chunk loads. | MapTile.js:22 (&lt;div className="mapTileLoading">…&lt;/div>), Sampler.css:1587. | Use the shared skeleton shimmer or a static low-res map image as the fallback. |
| P3 | L3 | In dark mode the bright pastel map sits in a dark navy frame (#22282e), with the gray letterbox bars rendered dark navy: a high-contrast glare block with a visible dark coastline seam. | desktop-dark-map.png. | Dim the canvas in dark mode (filter: brightness(.85)) and fit the extent so no letterbox shows. |
| P3 | H2 | The CTA reads 'View more' for opening the full interactive map, a generic label inconsistent with sibling deeplinks. | MapTile.js:26. desktop-map-rest.png. | Use 'Open map' / 'Explore the map'. |

#### mattersNarrative (matters)

Craft **2** — Text bleeds out of its clamps, overlays wrap for a map pin that doesn't exist, and both 'see more' paths go to a 'Not found' page.
Beauty **3** — The painted narrative scenes are lovely, but four stacked text layers on 104px cards bury them.
Belonging **4** — It uses the same card chrome, ref chip and mosaic as People/Places, so it clearly reads as the same product.

Destinations: Card: page /matters/&lt;slug> (C4-compliant: entity page). Its back link '❮ Matters' sits at the bottom of the article, not the top (D3). RefPill: scripture popup (compliant), Esc and backdrop close it, focus returns to the chip, no history entry. Heading and view-all: page /matters/narrative, which renders 'Not found' (P0).
Duds (H1): 0/5 seeds were duds. Every card had an image and a ref with a gloss of at least 42 characters. In 4/5 seeds, 1 to 3 names were clamp-truncated.

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P0 | D5 | The tile heading 'MATTERS · NARRATIVE' and the '+143 Matters' view-all card both go to /matters/narrative, which shows a bare 'Not found' page. This is a dead end. | desktop-tile-mattersNarrative-dest-viewall.png. Root cause: Routes.js:269 sends /matters/:matterSlug to &lt;EntityPage type=matters>, which renders 'Not found' (EntityPage.js:111). The /matters/&lt;group> handling lives in Matters.js:23-28 and :85, but the route never reaches it. Matters.js is mounted only at the exact path /matters (Routes.js:273). | Add explicit /matters/narrative\|material\|concepts routes to Matters before /matters/:matterSlug, or make EntityPage hand group keywords to Matters. |
| P1 | F1 | On phone, if the balancer puts this tile in the rail, it is cut to 24rem (384px). Only the first row of 2 cards shows, the gloss is cut mid-line, and the view-all card can't be reached. | phone-tile-mattersNarrative-rest.png (rail, h=384). Cause: Sampler.m.css:9 '.samplerLeftRail .tile { max-height: 24rem }' with overflow hidden. Tile-level consequence of R1 'phone stacks the rail'. | Don't put grid/mosaic tiles in the rail at ≤900px, or remove the max-height there. |
| P2 | A1 | The name overlay and subtitle overlay are clamped to 2 lines, but the top of a third line shows below the dark pill, and the key noun gets cut ('Lamoni's Father's…', 'Limhi's Escape…'). | desktop-mattersNarrative-overlay-zoom.png and desktop-rest-tile-mattersNarrative.png. Across 5 seeds, 8 of 25 names and 16 of 25 subtitles overflowed their clamp (s7.out). CSS: Sampler.css:1200-1211 (.placesNameOverlay -webkit-line-clamp:2 with vertical padding) plus .peopleFaceTitle. | Put the clamp on an inner span so padding can't reveal line 3. On 104px cards, drop the subtitle overlay or the index row; four text layers on one thumbnail is too much. |
| P2 | H3 | Clamps cut names at the point that carries the meaning ('Lamoni's Father's…' instead of 'Feast', 'Daughters of Zion's…'). The 104px desktop card cannot fit a 2-line name, a 2-line subtitle, a ref chip and a 3-line gloss. | desktop-rest-tile-mattersNarrative.png and desktop-profile-popup-backdropclose.png (the 'Daughters of Zion's…' card). The narrative tile is the only one with showSubtitle (MattersNarrativeTile.js). | Show the subtitle only on hover/focus or only at wider widths. Give the name up to 3 lines. |
| P2 | F2 | Tap targets are too small on phone. RefPill chips are 41–74 × 14px, nested inside the card link. The heading link is about 113 × 11px. | s4 phone output: scripture_link 61x14, 52x14 and similar; heading A 113x11. | Pad the chip hit area to at least 32px tall with a pseudo-element, and give the heading link a 44px hit box. |
| P2 | J1 | Each group tile loads 17 full-size JPEGs (1254–1672px, about 136–176KB each), about 2.5MB per tile. They feed 104px cards and 34px mosaic cells; with three group tiles, that is about 7.5MB of thumbnails. | naturalWidth 1254 shown at 104x104 and 34x38 (d1.json). curl: lamoni-fathers-feast 176454 bytes, rust 139227 bytes. MattersGroupTile.js:45 and :71 use the bare `${assetUrl}/matters/${slug}`. | Serve a ~256px (cards) and ~96px (mosaic) thumbnail variant via srcset/sizes, preferably as WebP/AVIF. |
| P3 | A1 | The name pill wraps early ('Cave of / Ether', 'Daytime / Heat') because max-width reserves 1.7rem for a map pin that matters cards don't have. | Sampler.css:1210 'max-width: calc(100% - 1.7rem); /* clear the map pin */'. Visible in desktop-rest-tile-mattersNarrative.png and desktop-tile-mattersMaterial-rest.png. | Scope the pin clearance to .placesTile:not(.mattersTile), or to cards that actually have a .placesMapBtn. |
| P3 | A7 | Matter names in the data have dropped apostrophes and mixed quote styles: 'Ammons Sling', 'Almas Sword', 'Nephis Ore' appear next to 'Lamoni's House' and 'Noah’s Great Tower'. | Seeds 1 and 3 in /tmp/claude-1003/-home-bom-BookofMormonOnline/524d9f80-ee41-4628-b4a6-fb0690560be9/scratchpad/matters/s7.out (bom_matters.name). | Clean bom_matters.name: restore possessives and normalize to one apostrophe style. |
| P3 | B1 | The skeleton is 15rem (240px), but the tile renders at 373px on desktop and 808px on phone, so a cold load that shows the skeleton grows by 133px or more. | Sampler.css:2296-2298 against measured tile heights of 373/375 (desktop) and 808 (phone). In one cold desktop load this tile was among the sources of a 0.116 shift at 4.4s, with samplerMasonry and contents (d1.json). That is tile-level detail for the R1 cold-load finding. | Set the skeleton min-height to the real footprint, roughly 23rem on desktop, and give the phone its own value. |
| P3 | L3 | In dark mode, the parchment-white matter illustrations glare inside dark cards. | desktop-dark-tile-mattersMaterial.png (same pattern in the narrative and concept dark shots). | In dark mode, dim the images slightly with filter: brightness(.85), or tint the card ground to match. |

#### mattersMaterial (matters)

Craft **2** — The grid is clean with no overlays fighting each other, but the view-all is a dead end and the images are full-size. _(adjusted 3→2 (critic: It has the same P0 dead-end view-all and heading (/matters/material shows 'Not found') that cost mattersNarrative its craft point. The same defect should get the same score across the three matters group tiles.))_
Beauty **4** — The consistent illustrated object studies on parchment read like a museum catalogue; this is the best-looking of the three.
Belonging **4** — It matches the People/Places card system exactly.

Destinations: Card: page /matters/&lt;slug> (compliant). RefPill: popup (compliant; Esc closes it, focus returns, no history entry). Heading and view-all: /matters/material shows 'Not found' (P0).
Duds (H1): 0/5 seeds were duds. All cards had images and refs, with glosses of 51–113 characters. 1 name was clamped in 25 cards ('Nephite Gold and Silver Idols').

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P0 | D5 | The heading and the '+191 Matters' view-all card go to /matters/material, which shows 'Not found'. Same root cause as the narrative tile. | desktop-tile-mattersMaterial-dest-viewall.png. Routes.js:269 against Matters.js:23-28. | Route /matters/material to the Matters index with the Category chip pre-selected. |
| P1 | F1 | At 390px the tile renders 445px wide inside an overflowing main column, so its right edge, and the right edge of any popup opened from it, is off-screen. | s4/s5: innerWidth 469 against visualViewport 390; .samplerMain 445px inside .samplerColumns 343px; tile w=445. Root cause filed once under cross-cutting F1. | See the cross-cutting F1 fix: align-items stretch on .samplerColumns at ≤900px. |
| P2 | J1 | 17 full-size JPEGs per tile (~2.5MB) for 104px cards and 34px mosaic cells. | rust 1254px / 139227 bytes shown at 104px (d1.json, curl). | Use thumbnail variants and srcset. |
| P3 | H4 | Near-duplicate across tiles in one seed: 'Sackcloth' (Material) appeared with 'Sackcloth and ashes' (Concept), with near-identical images and the same Helaman 11:9 reference. | Seed 0 in s7.out; desktop-rest-tile-mattersMaterial.png / desktop-tile-mattersConcept-focus.png. | In the sampler, exclude matters whose slug or name stem matches one already chosen for a sibling group. |
| P3 | A1 | The name pill wraps early ('Daytime / Heat') because of the map-pin max-width reservation. | desktop-tile-mattersMaterial-rest.png; Sampler.css:1210. | Remove the pin clearance on matters cards. |
| P3 | B1 | The 15rem skeleton is too short for the 373px tile (808px on phone). | Sampler.css:2297 against the measured h=373/808. | Match the skeleton to the footprint. |
| P3 | L3 | Cream-background object studies glare in dark mode. This is the most visible case of the three tiles because every image is on a near-white ground. | desktop-dark-tile-mattersMaterial.png | Dim the images in dark mode or give them a matching card ground. |

#### mattersConcept (matters)

Craft **2** — Visually tidy, but the view-all dead-ends, names mix casing, and the same concepts keep recurring. _(adjusted 3→2 (critic: Same P0 dead-end (/matters/concepts shows 'Not found') as mattersNarrative, which scored 2. On a single bar, a tile whose primary 'see more' paths are 404s cannot be 'acceptable'.))_
Beauty **4** — The ink-and-wash concept sketches are distinctive and give the abstract ideas a coherent look.
Belonging **4** — Same card and mosaic system as the siblings.

Destinations: Card: page /matters/&lt;slug> (compliant; the title and image match the card). RefPill: popup (compliant). Heading and view-all: /matters/concepts shows 'Not found' (P0).
Duds (H1): 0/5 seeds were duds. All cards had images and refs, with glosses of at least 43 characters. 5 of 25 names were clamped (for example 'Plural Marriage and Concubinage').

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P0 | D5 | The heading and the '+91 Matters' view-all card go to /matters/concepts, which shows 'Not found'. | desktop-tile-mattersConcept-dest-viewall.png. Routes.js:269 against Matters.js:23-28. | Add the /matters/concepts route to Matters. |
| P1 | F1 | At 390px the tile renders 445px wide inside the overflowing main column, so its third column and popup close buttons are off-screen. | s4: tile w=445, innerWidth 469 against visualViewport 390. Root cause is the cross-cutting F1. | See cross-cutting F1. |
| P2 | J1 | 17 full-size JPEGs per tile (~2.5MB). | d1.json: 1254px sources shown at 104px and 34px. | Use thumbnail variants and srcset. |
| P3 | H4 | The same concepts keep coming back across seeds: 'Sackcloth and ashes' appeared in 3 of 5 seeds, and 'Night Operations' and 'Plural Marriage and Concubinage' in 2 of 5 each, out of a pool of about 108. In seed 0 it also duplicated Material's 'Sackcloth'. | s7.out seeds 0, 3 and 4 (Sackcloth and ashes). Backend: homesampler.ts:691-699 uses seededOrder('slug', seed). | Check how well seededOrder mixes for adjacent batch/resample seeds, and de-dup across sibling matters groups. |
| P3 | A7 | Names mix casing styles: 'Forbidden touch', 'Sackcloth and ashes' and 'Ridding the garments' sit beside 'Night Operations' and 'Priests and Teachers'. | s7.out seeds 0–4; desktop-tile-mattersConcept-focus.png. | Normalize bom_matters.name to Title Case. |
| P3 | B1 | The 15rem skeleton is too short for the 373px tile (833px on phone). | Sampler.css:2298 | Match the skeleton to the footprint. |
| P3 | L3 | Parchment-ground sketches glare in dark mode. | desktop-dark-tile-mattersConcept.png | Dim the images in dark mode. |

#### matterProfile (matters)

Craft **3** — Composed and readable on desktop with a sensible reveal, but it falls apart on phone/tablet, where the reveal is clipped away.
Beauty **4** — A big sketch hero, an italic subtitle between rules, and scripture-chip prose make a handsome editorial card.
Belonging **4** — It mirrors PlaceProfileTile and uses the shared CTA pills, so it feels native to the product.

Destinations: Hero image and the 'See in context' deeplink both go to page /matters/&lt;slug> (compliant, but redundant). Inline scripture links open a popup (compliant). Esc and backdrop close it, with no history entry. The heading link goes to /matters, the index, which works.
Duds (H1): 0/2 observed seeds were duds. The tile appeared in 2 of 5 resample seeds, plus 3 loads in total, always as 'Secret combinations' with a 626-character description.

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P1 | C2 | On phone and tablet the tile is put in the rail and capped at 24rem, which clips off the Layer-1 'Read More' pill. The reveal cannot be reached, and so neither can the 'See in context' deeplink it gates. On tablet the 16:9 hero alone (773px wide) fills the whole 384px, so the tile is an image with no text at all. | phone-tile-matterProfile-rest.png and tablet-sweep-tile-matterProfile.png. s8: phone inner scrollHeight 412 against max-height 384, read-more pill 4px below the tile bottom. Tablet: inner 634 against 384, pill 226px below. Sampler.m.css:9. | Lift the rail max-height for profile tiles at ≤900px, or never rail them. Cap the hero height (e.g. max-height 12rem) at single-column widths. |
| P2 | D4 | On phone, a direct load of the destination /matters/secret-combinations shows the gradient 'SC' initials fallback instead of the illustration shown on the tile, so you can't tell you landed where you meant to. Desktop showed the image. | phone-dest-matter.png against desktop-profile-dest.png | Find out why the entity hero fails on mobile; it may be the image variant, a race, or onError. Fall back to the same media URL the tile used. |
| P2 | D3 | The entity page's only return control, '❮ Matters', sits below the article and sidebar. On phone it is under the fold, past the hero and relationships. This is the same template every matters card lands on. | desktop-profile-dest.png (y≈700 CSS px), desktop-tile-mattersNarrative-dest-card.png, phone-dest-matter.png (no back control in the first viewport). | Move the back/breadcrumb above the h1. Feeds §S1. |
| P2 | G2 | Expanding with 'Read More' unmounts the focused button, and focus drops to &lt;body>. A keyboard user is thrown back to the top of the document. | s3: 'focus after BODY.sweetalert-overflow-hidden' after the Read More click. ExpandableText.js:47-51 removes the TileCTA on open. Shared primitive, also filed cross-cutting. | Move focus to the revealed text or the newly visible TileDeepLink on expand. |
| P3 | H3 | The 5-line clamp cuts right after an opening parenthesis ('at that time (…'), and in the revealed text the '(' sits alone at a line end with the ref chip on the next line. | desktop-rest-tile-matterProfile.png and desktop-profile-revealed.png ('at that time ( / Helaman 3:23 )'). | Join the surrounding parentheses to the chip with nowrap, e.g. wrap '(' + chip + ')' in a white-space:nowrap span. |
| P3 | H2 | The Layer-2 CTA says 'See in context', but it goes to the same /matters/&lt;slug> page the hero image already links to, and that page has no other context. The label is generic and misleading for an entity. | MatterProfileTile.js:57 (TileDeepLink to /matters/${slug} with label view_in_context); hrefs output ['/matters','/matters/secret-combinations']. | Use an entity verb such as 'Open Secret combinations' or 'Explore this matter'. |
| P3 | H4 | The profile always shows mattersConcept[6], which is by construction one of the 12 images in the Concept tile's view-all mosaic on the same page. Seed variety is also low: the same matter ('Secret combinations') appeared every time I saw this tile, across 3 page loads and 2 resample seeds. | MatterProfileTile.js:31 (matterIndex=6) against MattersGroupTile.js:27 (mosaic = slice(5,17)); s3/s7 output. | Pick from beyond index 17, or exclude every slug rendered by the Concept tile, mosaic included. |
| P3 | B1 | The skeleton is 18rem (288px), but the tile renders at 419–438px. | Sampler.css:2299 against the measured h=419/438. | Set min-height to about 27rem. |
| P3 | J1 | The hero is a 1254px, about 136KB JPEG shown at 337×189 (674px at 2×), with no srcset. | MatterProfileTile.js:42-47; curl secret-combinations 136274 bytes. | Use srcset with a 720px variant. |
| P3 | L3 | In dark mode the Read More pill turns light blue (rgba(147,198,239)), a stray blue outside the house palette. The parchment hero also glares. | Sampler.css:1384 (dark .readMorePill). Shared, so also filed cross-cutting. | Use the gold/neutral tokens in dark mode. |

#### text (scripture)

Craft **2** — A legacy feed component dropped into the grid with display:none on its notch; triple links, a dangling colon and a double Back.
Beauty **3** — The scripture typeface is lovely, but the grey header bar and grey caption slab make it look like a 2015 widget.
Belonging **2** — It is the only tile with nested card chrome and justified text; it looks neither like its siblings nor like the Read page.

Destinations: Card, eyebrow and 'See in context' all go to a page (/&lt;page-slug>/&lt;block>, the Study page, block expanded). That matches C4 row 3 (canonical URL → page). No popup. Back is broken (E1).
Duds (H1): 0/10 samples were duds (5 seeds, main and infinite); every block was a substantive passage with narration

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P1 | E1 | Clicking the card or 'See in context' adds two history entries for the same URL, so the first Back does nothing visible (it only scrolls the Study page) and a second Back is needed to reach Home | s8.mjs/s9.mjs: history.length 2→4, framenavigated fired twice for /reign-of-judges/zarahemla-sermon/39; back 1 → same URL (scrollY 2557), back 2 → /home. Same result via .tileMoreLink and via the card | Find the duplicate navigate() on the Page route mount/scroll-to-block path and make it {replace:true} |
| P2 | A3 | The tile embeds the legacy community-feed card unchanged: a heavy grey rounded header bar, justified scripture text with visible rivers, and a grey caption slab with a '▸' breadcrumb. It reads as a different product from the sibling tiles | desktop-rest-tile-text-0.png, desktop-text-with-img.png (justified 'whose   name   was   Jonas'), StudyInFeed.js:82-109, Sampler.css:1179-1181 | Give TextTile its own sampler layout: left-aligned Read typography, no inner card chrome, the section breadcrumb as a tile meta line |
| P3 | A5 | Card-in-card: the feed card brings its own border, radius and grey fills inside the tile's own card, so the frame is doubled and the inner padding differs from sibling tiles | desktop-rest-tile-text-0.png | Strip .itemInFeed border, background and radius inside .textTile |
| P3 | A7 | The breadcrumb always ends in a dangling colon ('Conclusion and Invitation: '), and the passage shows entity chips as grey boxes behind the names, which look like a rendering artifact | s4 data: pageSection '… ▸ Conclusion and Invitation: ' in 10/10 samples; StudyInFeed.js:98; desktop-text-with-img.png (grey boxes on Nephi, Timothy, Jonas…) | Drop the trailing ':' and render entity highlights as plain text (or the house underline) in the tile |
| P3 | A6 | The 42px art thumbnail swaps images at random every 3–13 s with no crossfade, ignores prefers-reduced-motion, and keeps its timer running when offscreen (J2) | s17.mjs with reducedMotion:'reduce': 3 distinct backgroundImages in 20 s (art/3407→2055→1878); StudyInFeed.js:57-72 (setTimeout loop, no matchMedia or visibility check) | Show one image; if rotating, honor reduced motion and pause via IntersectionObserver or visibilitychange |
| P3 | C1 | The whole card is a link but has no hover state, and the tiny 'SCRIPTURE' eyebrow is also a link. Clickability is invisible, then tripled | desktop-t-hover.png is identical to rest; TextTile.js:18-21 (three &lt;a> to the same href) | Keep one primary link (card or CTA) with a hover lift; make the heading plain text |
| P3 | G2 | Three consecutive tab stops all go to the same URL (eyebrow link, the whole card, 'See in context') | s7.mjs TEXT tabs: 3 × href=/reign-of-judges/zarahemla-sermon/39 | Make the heading non-interactive and give the card tabIndex=-1 or drop the duplicate |
| P3 | D3 | The destination lands with the target block near the bottom of the viewport, and the only return control above the fold is 'Back to Alma's preaching…' (parent page), not a way back to Home | desktop-dest-text.png | Scroll the target block to the upper third; rely on Back (fix E1) or add a contextual 'Back to Explore' |
| P3 | L3 | Dark mode is half-themed: an off-palette green bar on the poetry indent and mismatched grey rectangles behind the breadcrumb and narration | desktop-dark-tile-text.png; darkmode.scss:1159-1175 (.itemInFeed .pageSection/.narration/.caption fills) | Theme .textTile explicitly: no slabs, and a neutral or gold rule if a quote bar is wanted |

#### commentary (scripture)

Craft **3** — The column-balanced clamp is clever and lands cleanly at rest, but the reveal is a 1669px unstyled dump, the deeplink overflows its column and the refs aren't keyboard-operable.
Beauty **4** — Bold title, readable excerpt and a real book cover make it handsome at rest.
Belonging **4** — Same heading tier, pill CTAs and scripture chips as the siblings; the destination modal matches the Study experience.

Destinations: Read More is an inline reveal (C4 row 1, correct but unbounded). The aside ref and inline refs open the ScripturePopup (row 2, correct). Title, cover and 'See in context' go to /commentary/:id, a route-backed modal over the Study page with a real &lt;a href> (row 3, acceptable); one Back returns to Home at the same scroll (738→738).
Duds (H1): 6/27 commentary samples were duds across 5 seeds: 4 Book of Mormon Minute rows titled with a bare (and off-by-one) reference, 2 ATV textual-variant rows

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P2 | C2 | 'Read More' expands a 282px tile to 1669px of flattened prose inside the feed, moving 7 tiles. There is no collapse control, and stripTags merges every paragraph, editorial bracket and cross-reference into one wall of text | s5.mjs: READMORE height 282→1669, moved tiles 7, collapse ctl 0; desktop-c-after-readmore.png ('[Alan C. Miner, Personal Notes] [See the commentary for Ether 1:1] "They Began…"' run together); CommentaryTile.js:17-18,69,97 | Cap the reveal (e.g. +2 clamps) then hand off to the /commentary modal, keep paragraph breaks (don't stripTags block elements), add 'Show less' |
| P2 | A7 | For Book of Mormon Minute rows, the title and the reference pill disagree by one verse, every time (title 'Alma 37:16–20' vs pill 'Alma 37:17–21'). The commentary modal repeats the mismatch, and the prose ('Verse 19… Verse 20') shows the title is the correct one | 4/4 BoM Minute samples: Alma 37:16–20/17–21, 3 Ne 6:13–16/14–17, 3 Ne 8:18–19/19–20, 3 Ne 11:28–31/29–32 (s4.mjs); desktop-rest-tile-commentary-2.png; desktop-dest-comm-inapp-12000.png (header 'Commentary on Alma 37:17-21' over title 'Alma 37:16-20') | Data fix: correct the reference/verse_id for the Book of Mormon Minute source (systematic +1 offset) |
| P2 | D5 | In-app navigation to /commentary/:id shows a completely blank content panel for 6–12 s with no loader. A direct load of the same URL renders in about 3 s | s11.mjs: content innerText length 0 at 1.5 s/3 s/6 s, 3682 at 12 s; desktop-dest-comm.png (blank grey panel); desktop-dest-comm-inapp-12000.png; direct load s10.mjs renders by 3 s. Dev server was under load, so re-check on prod | Render the commentary modal immediately from the tile's data (title/text/publication are already in hand) while the Study page loads beneath; at minimum show a skeleton |
| P2 | G1 | The aside reference is a span role=button with no key handler (Enter does nothing), and the inline scripture refs in the excerpt are &lt;a> without href, so they are not focusable | s5.mjs: 'ref Enter opens popup? 0'; tab sequence skips all 7 inline refs (href:null); CommentaryTile.js:129; scriptureLinkReplacer.js:22-25 | Render the aside ref with RefPill (which has onKeyDown) and give replacer anchors href or role=button + tabIndex + key handler |
| P3 | A1 | The 'See in context' pill is wider than the fixed 5.6rem aside column, so it overruns toward the tile edge (ATV tiles, and every tile after Read More) | desktop-atv-commentary.png (pill right edge 8px from tile edge vs 16px padding); desktop-c-after-readmore.png (pill clipped at right); Sampler.css:623-628, 1419-1434 (white-space:nowrap) | Put the deeplink below both columns (full-width row) or let it wrap |
| P3 | A7 | Source-text junk shows through: '(see verses 6. 11)', 'blessing-a constant', 'north countries ?', straight-quote pairs next to curly ones | desktop-rest-tile-commentary-0.png, desktop-rest-tile-commentary-1.png | Typographic clean-up pass in textUtils (hyphen-between-words→em dash, space-before-? strip) plus a data clean-up |
| P3 | A4 | Attribution text #888 on white is about 3.5:1 at 0.66rem italic, below WCAG AA | Sampler.css:631-636 (.commentaryTileSource color #888, 0.66rem) | Use #666 or darker |
| P3 | H2 | CTA casing is inconsistent ('Read More' title case beside 'See in context' sentence case), and the BoM Minute and ATV rows use a bare reference ('Alma 37:16–20', 'Alma 17:13 Textual Variants') as the headline, which gives a non-member no hook | desktop-rest-tile-commentary-2.png, desktop-atv-commentary.png | Sentence-case the read_more label; for ref-only titles lead with the first sentence of the prose instead |
| P3 | H1 | About 22% duds: ref-only BoM Minute headlines and ATV textual-variant tiles (125–282 chars of apparatus in monospace) are obscure for a Discover feed | 6/27 commentary samples across 5 seeds (s4.mjs); desktop-atv-commentary.png | Down-weight ATV and ref-titled sources in the sampler pool |

#### notes (scripture)

Craft **3** — The speech-bubble gloss pointing at the verse is a strong idea, but cramped line-height, doubled quotes, late-loading verses and a weak anchor highlight let it down.
Beauty **4** — Speaker portrait, Read-typography verse and a cream bubble with a cover make a genuinely attractive card.
Belonging **4** — Reuses the Read excerpt and site scripture chips; the deeplink lands on the exact highlighted verse.

Destinations: The passage-header ref and note refs open the ScripturePopup (C4 row 2, correct). The popup shows the whole section (Ether 6:1-13) without marking the annotated verse. 'See in context' goes to a page (/read/&lt;book>-&lt;ch>/&lt;v>, verse highlighted, D4 pass), but the URL is non-canonical and breaks Back (E1).
Duds (H1): 2/9 notes samples were duds (one-line cross-reference stubs); all 9 were by the same author

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P1 | E1 | 'See in context' links to a non-canonical /read/ether-6/8. Read then canonicalizes with a pushing navigate(), so Back needs 2 presses, and in one run 3 Backs never reached Home | s9.mjs: history 2→4, navs ether-6/8 → ether.6/8; back 1 → /read/ether-6/8, back 2 → /home. s8.mjs run: navs …/ether.6/8 → /read/ether.6, 3× Back stuck on /read/ether.6/8. Root: NotesTile.js:203 readPath() (ScriptureExcerpt.js:20-25 emits 'ether-6') + Read.js:538 navigate() without {replace:true} | Emit the canonical slug from readPath (book.chapter/verse) and use navigate(…, {replace:true}) for URL canonicalization in Read.js:538 |
| P1 (was P2) | L5 | features.yml hides passage notes in prod (passageNotes hidden:true), but the Home Notes tile is not gated. Prod readers get a 'Passage Notes' tile whose deeplink lands on a Read page that does not show the note _Critic: upgrade → P1: If features.yml hides passage notes in prod, the Home tile advertises a feature whose deeplink destination does not show it, so every prod click is a broken promise. This is a feature-flag leak on the shipped prod build. The cutover_feature_flags memory confirms HIDE_* consts are prod-build-only and drive PassageNotes. Verify the registry with grep before acting._ | frontend/webapp/config/features.yml:14; featureFlags.js:93 used only in Read.js:22 and ChapterContent.js:8; registry.js:67 has no HIDE_PASSAGE_NOTES check | Gate the notes registry entry (and INFINITE_REGISTRY_KEYS) on !HIDE_PASSAGE_NOTES, or retarget the deeplink to a surface that shows the note |
| P2 | B2 | The passage is self-fetched after paint (BoMOnlineAPI read of the whole chapter, useCache:false, on every mount). The tile first shows a lone '…' and then grows, e.g. 322→490px on infinite notes | desktop-rest-tile-notes-0.png ('…' placeholder above the bubble); s4.mjs infinite notes err:'…' at capture in 2 seeds; s19.mjs infinite notes h 490 vs 322 batch slot; CLS entries 0.0103 and 0.0175 sourced infiniteTile.tile-notes (s1.mjs); ScriptureExcerpt.js:110,147 | Ship the verse text in the sampler payload (or cache the chapter fetch) and reserve height with a sized skeleton |
| P2 | A7 | Doubled opening quotes: when the note starts with a quoted phrase, the non-anchor branch wraps it in another pair of quotes (““Driven forth…”) | 2/9 samples (s4.mjs: '““Driven forth…', '““Know good from evil…'); desktop-notes-probe.png; NotesTile.js:239 | Skip the wrapping quotes when the note text already begins with a quote |
| P2 | A3 | Note text is set at line-height 1 in the bubble, so multi-line glosses are cramped, and the attribution (0.85rem) is larger than the note itself (0.8rem) | desktop-rest-tile-notes-1.png, desktop-notes-probe.png; Sampler.css:1675 (.notesText line-height:1), 1689 (bubble line-height:1), 1724 (.notesAttr 0.85rem) | line-height ~1.4 on .notesBody; attribution ≤ body size |
| P2 | G1 | Scripture refs inside the note are span role=button with no key handler, so Enter does nothing (the passage-header ref works) | s18.mjs: 'inline ref Enter -> popup 0', 'header ref Enter -> popup 1'; NotesTile.js:179-186 | Render with RefPill (which handles Enter/Space) |
| P3 | H2 | The anchor-phrase highlight promised by the design (phrase marked in the passage) fires in only 1 of 4 anchored samples; it fails on ellipsis anchors and punctuation differences | s4.mjs: mark true only for 'O be wise'; false for 'Ask the Father in my name', 'My soul was rent with anguish…the slain…', 'Inasmuch as they will not hearken…cut off…'; ScriptureExcerpt.js:59-73 | Split anchors on '…' and match each fragment; normalize punctuation and whitespace before matching |
| P3 | H1 | Monoculture and thin glosses: 9/9 notes were by Grant Hardy, and 2/9 were one-line cross-reference stubs ('In contrast to the people of Jerusalem at 3 Nephi 16.4') | s4.mjs notes across 5 seeds | Weight by note length and rotate sources if other is_note publications exist |
| P3 | D3 | The Read destination has no back/return control above the fold, only chapter prev/next | desktop-dest-notes.png | Rely on a fixed Back (E1) or add a contextual return chip |
| P3 | L3 | In dark mode the passage sits on a lighter #333 slab inside the dark tile, a visible grey rectangle | desktop-dark-tile-notes.png; darkmode.scss:78-81 (.read-content .read-section background #333) | Override to transparent inside .notesTile / .scriptureExcerptCompact |
| P3 | G3 | The cover image alt is the author's name ('Grant Hardy') rather than the publication | NotesTile.js:224-229 | alt = publication.source_title, or empty since the author is in the text |

#### fax (archive)

Craft **3** — The desktop layout is careful (equal-height pages at natural aspect), but there is a nested interactive inside a link, a keyboard-dead ref, megabyte covers and a clipped phone/tablet version.
Beauty **4** — The manuscript pages and title-page covers are genuinely handsome archive imagery, though the tile is very tall (~630px) for a sampler card.
Belonging **4** — Card chrome, tile heading and the ref pill styling match the Read page's scripture pills.

Destinations: Heading, title and 'View more' go to the /fax/:slug page; each page image goes to /fax/:slug/:page (page with a back control, D3 pass). Covers go to /fax/:edition (page). The ref rail opens a ScripturePopup. All match the C4 rule (verse = popup, document = page), but the popup trigger is nested inside the page link.
Duds (H1): 0/5 fax samples were duds (Printer's MS, 1883 Liverpool ×3, 1866 Liverpool, 1920 SLC). Covers and pages were always populated.

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P2 | G1 | The scripture-ref rail is a &lt;span role=button tabIndex=0> nested inside the page's &lt;a>: an interactive element inside a link, and it has no key handler, so Enter on it does nothing. | FaxTile.js:49-57. s8-desktop.log: 'fax-refrail Enter -> no nav dialog false'. Inventory shows nestedInteractive=1 on both page links. | Make the ref a real &lt;button> that is a sibling of the page link (not inside it), so Enter/Space open the popup. |
| P2 | A2 | Page thumbnails are upscaled on some editions: 1866 thumbs are 228×400 natural but render at 164×285 CSS (1.43× at DPR 2). On tablet, 400px-wide thumbs fill ~370 CSS px (≈1.85×) and look visibly soft. | s2.log seed 5 (fax/thumb/1866/328.jpg n228x400 r164x285). tablet-tablet-tile-fax.png. | Serve thumbs at ≥2× rendered width (srcset with a 600–800px variant). |
| P2 | J1 | Edition covers are full 1600×1000 JPEGs (162–639 KB each) shown at 164×92: four covers can cost >1 MB for postage-stamp images. | curl: fax/covers/printer 638,633 B, fax/covers/1866 162,390 B. s2.log shows n1600x1000 r164x92. | Add a 400px cover-thumb rendition and a srcset. |
| P3 | C1 | The ref rail opens a scripture popup, but it sits on top of a page link that navigates. Two different destinations are stacked in one visual card, and a near-miss click on the ref goes to the fax viewer. | FaxTile.js:42-58. Clicking .faxPageBarRef opened the popup (desktop-fax-refrail-open.png); clicking the image went to /fax/printer/6 (desktop-fax-page-dest.png). | Separate the ref into its own row/button above the image link, with clear spacing. |
| P3 | F2 | The ref rail tap target is ~20px tall (0.66rem text, 0.15rem padding), well under 44px. | Sampler.css:1248-1263. phone-rest-tile-fax.png. | Raise the hit area to ≥44px via padding or a pseudo-element. |
| P3 | L3 | In dark mode the four edition covers are bright white blocks that glare. History thumbs get brightness(0.85); fax covers do not. | desktop-dark-tile-fax.png. Sampler.css:1494 sets only border/background. | Apply the same brightness(0.85) filter as .historyTileThumb to .faxTileEdition img and .faxTilePage img in dark mode. |
| P3 | A6 | Hover scale transforms on pages and covers are not disabled under prefers-reduced-motion. | Sampler.css:1245, :1493. The reduced-motion block at :2205 covers mapStory only. | Add .faxTilePage img, .faxTileEdition img { transition:none; transform:none } to the reduced-motion block. |
| P3 | L2 | Hardcoded English 'pp.', 'p.' and the alt text pattern '&lt;title> p.N'. | FaxTile.js:32, :62, :71 | Route through label(). |

#### faxVerse (archive)

Craft **2** — Broken tab assets, clipped crops, a repeated pill, a pill that lies about what it does, and no dark theming for the crops.
Beauty **3** — The idea (one verse across four printings) is great, but in execution the crops are mismatched in scale, cut off and unevenly framed.
Belonging **4** — The excerpt block and ref pills are straight from the Read page.

Destinations: Header pill opens a ScripturePopup (popup, matches C4). Each edition row and 'View more' go to /fax/:edition/:verse, a page that opens with that verse's crop highlighted in a modal (D4 strong pass, desktop-dest-direct-faxv.png). The rows' look-alike ref pills are a C1 deviation.
Duds (H1): 0/3 distinct verses were content duds (1 Ne 4:5, Mosiah 19:28, Moroni 2:1), but 1/3 had a visibly broken crop (1891) and 3/3 had missing tab graphics.

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P2 | A2 | Verse crops vary badly in quality. The 1891 crop is cut off on the right edge ('sh', 'f') and shows a sliver of the line above ('Jerusalem.'). Some crops are under 800px natural (459px for 1981) yet render at 337 CSS px (1.47× upscaled at DPR 2), and 2013 type is ~3× the size of 1877 type in the same column. | desktop-rest-tile-faxVerse-s1.png (1891 row). s2.log seed 5: ender/1981/crop/w800/moroni-2.1.jpg n459x117 r337x87. | Pad crop selectors by a margin and clamp to the column. Normalise crops to a common x-height or cap display height per row. |
| P2 | A5 | Edition rails are inconsistent. Rows whose tab graphic 404s collapse to a bare title, while rows with a tab show a framed cardboard tab, so the list zig-zags. Tab graphics are 120×40 shown at 97×32 (1.6× upscaled, soft). Root cause of page-level finding (fax/tabs 404s). | desktop-rest-tile-faxVerse-s1.png (1877/1891 have no tab, 2013/1829 do). s2.log: tabs n120x40 r97x32 and many tabs HIDDEN (n0x0). FaxVerseTile.js:67-73 onError display:none. | Give every edition a tab asset (or a text-tab fallback with the same box), and ship tabs at ≥2× resolution. |
| P2 | C1 | Each edition row carries a ref pill styled exactly like a scripture popup pill (.scripture_link), but it is just part of the row link and navigates to the fax viewer. The header ref pill of the same look opens a popup. | FaxVerseTile.js:66 (faxEditionRailRef scripture_link inside &lt;Link>). The header pill opened .samplerScripturePopup (s8-desktop.log); the rows navigate to /fax/:ed/1.nephi.4.5. | Drop the per-row pill (the verse is already named in the header), or render it as plain meta text. |
| P2 | L3 | Dark mode: the pure-white print crops glare at full brightness, and the brown edition titles (#6b5330, no dark override) sink into the dark ground at low contrast. | desktop-dark-tile-faxVerse.png. Sampler.css:2248-2258 has no html[data-theme=dark] rule for .faxEditionRailTitle / .faxEditionCrop. | Add dark overrides: crops filter brightness(0.85); titles in a light warm gray (#c9b48a or similar). |
| P3 | H4 | The same reference ('1 Nephi 4:5') is repeated as a pill on every edition row (4×) under a header that already shows the range. That is visual noise. | desktop-rest-tile-faxVerse-s1.png | Show the ref once; keep only the edition names on rows. |
| P3 | A7 | Long edition names truncate with an ellipsis and drop the ref pill ('2013 Salt Lake City (Current) Edition …'). | desktop-rest-tile-faxVerse-s1.png, phone-rest-tile-faxVerse.png | Use short edition labels (e.g. '2013 SLC') in the rail. |
| P3 | G3 | The tab image alt repeats the visible edition title, so screen readers read every edition name twice. | FaxVerseTile.js:70 alt={ed.title} | alt='' on the decorative tab. |

#### history (archive)

Craft **4** — Well-structured (quote, key points, citation) and dims its scan in dark mode. Its gaps are on the destination, not the tile.
Beauty **4** — The gold-ruled pull quote with the highlighted excerpt, plus the newspaper thumbnail, reads like an editorial feature.
Belonging **4** — Same serif quote treatment and meta tiers as the History source cards.

Destinations: Title, rail and 'See in context' all go to /history/:slug, a real page with a canonical URL (C4 pass). Title and quote match the tile (D4 pass), but there is no back/breadcrumb (D3 fail).
Duds (H1): 0/5 duds ('We have received', The Biter bit, The Mormons 1839, Palmyra Reflector 'Book of Mormon', 1836 letter to the editor); all had a quote plus a thumbnail.

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P2 | D3 | The /history/:slug destination has no back control or breadcrumb above the fold. It opens straight on the H1, unlike the fax viewer and witness pages, which have them. | desktop-dest-direct-hist.png (compare desktop-fax-page-dest.png with its back arrow and breadcrumb, and desktop-dest-direct-witness.png with its History › Witnesses breadcrumb). | Add the same History › &lt;archive> breadcrumb plus back affordance used on the witness page. |
| P3 | D5 | The destination prints the citation twice, back to back (plain, then bold-italic), and document.title is the generic 'Book of Mormon Online'. | desktop-dest-direct-hist.png ('Painesville Telegraph (Painesville, Ohio) (1 March 1831).' ×2). s11 title='Book of Mormon Online'. | Render the citation once; set the document title to the document name. |
| P3 | A3 | The 'HISTORY' tile heading is plain text, while every sibling archive tile (Facsimiles, Witnesses, Joseph Smith) links its heading to the archive index. | ArchiveDocTile.jsx:31 vs FaxTile.js:25, WitnessTile.js:69 | Link the heading to /history. |
| P3 | G2 | Three consecutive tab stops (title, rail image, CTA) all lead to the same URL. | s7.mjs FOCUS walk: historyTileTitle, historyTileRail, tileCTA, all /history/1831-03-01-we-have-received | tabIndex=-1 plus aria-hidden on the rail link (the title and CTA already cover it). |

#### translation (archive)

Craft **1** — Registered, wired and styled, but structurally unable to appear with the current data.
Beauty **1** — Never rendered, so there was nothing to judge; scored at floor because the slot ships nothing.
Belonging **1** — Not observable.

Destinations: Code only: /history/translation (a feed page). Not verified live.
Duds (H1): Not applicable: 0 renders across 10+ loads and 6 seed replays (100% absent).

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P2 | H1 | Dead tile: the backend returns translation=null for every seed tried, so the reserve entry never renders. The 'translation' archive apparently has no row with a money_quote and a teaser over 30 chars. | 6/6 homesampler(seed:N) replays and every Home load in this pass lacked a translation payload (s5.mjs: 'translation undefined'). homesampler.ts:669 sampleArchiveDoc('translation', false) with the money_quote filter at :645. registry.js:83 isReady=!!p.translation. | Either curate money quotes for the translation archive or remove the tile from reservePool until data exists. |
| P3 | C4 | Code read: the tile links its title, rail and CTA to the feed /history/translation instead of the featured document's own URL, so the deep link would land on a list rather than the doc shown. | TranslationTile.js:6 to='/history/translation' | Link to the document's canonical URL (or an anchor for it on the archive page). |
| P3 | L2 | Code read: the heading is hardcoded English 'Translation'. | TranslationTile.js:6 | Use label('translation'). |

#### josephSmith (archive)

Craft **2** — The highlight collision is visibly broken, and the same quote ships on every seed.
Beauty **3** — The portrait and serif quote are attractive, but the overlapping highlight slab spoils it.
Belonging **3** — Shares the witness card layout, but the highlight treatment differs from the History tile's.

Destinations: Heading, portrait and CTA go to /history/joseph-smith, a page (C4 pass). At 1440 the featured statement is visible above the fold in the third card (D4 pass). The deep link points at the archive, not the document.
Duds (H1): 1 distinct sample across 13 observations (100% repetition): every seed shows the 1839 title-page statement.

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P2 | A3 | The mini-quote highlight (&lt;mark class=miniHighlight>) gets a cream background block, but .witnessStatement uses line-height 1.05, so the highlight boxes overlap the line above and cut through 'Mormon is a literal translation' and the '[...]' mark. It looks visibly broken. | desktop-rest-tile-josephSmith-s1.png. Sampler.css:1615 line-height:1.05. Only .historyTileQuote neutralises the mark background (Sampler.css:1112); .witnessStatement doesn't. | Style .witnessStatement .miniHighlight like .historyTileQuote (background:none; color:#000) and raise line-height to ~1.25. |
| P2 | H1 | The tile always features the same document: the 1839 title-page statement appeared on 7 of 7 Home loads and in 6 of 6 seed replays, even though the destination page shows 26 Joseph Smith sources, many with money quotes. | s2.log seeds 2-7 and s1 show the identical quote. curl homesampler(seed:3/777/4141/9001/123457) returned josephSmith.slug=1839-joseph-smith-book-of-mormon-title-page-literal-translation each time. homesampler.ts:670. | Investigate why only one 'joseph-smith-statements' row passes the teaser/money_quote filter (likely metadata key mismatch); widen it so seeds rotate. |
| P2 | L3 | In dark mode the highlight renders as a glaring cream slab with dark text in the middle of light-on-dark text. | desktop-dark-tile-josephSmith.png | Same fix as A3; no background highlight in the dark theme. |
| P3 | H3 | The 4-line clamp cuts the quote mid-phrase ('of the title-page of…') with no Layer-1 reveal; RevealProvider is mounted but no gate is registered. | JosephSmithTile.js:48 clampLines WebkitLineClamp 4. desktop-rest-tile-josephSmith-s1.png | Use ExpandableText for the statement, or clamp the money quote server-side to whole sentences. |
| P3 | J1 | The portrait is a 1024×1024 JPEG (~190 KB class) displayed at 86px. | s2.log n1024x1024 r86x86. The witness portrait david-whitmer.jpg is 193,245 B (same asset family). | Ship a 256px portrait variant. |
| P3 | L2 | Code read: the name and alt text 'Joseph Smith' are hardcoded English, and the heading falls back to English via tr(). | JosephSmithTile.js:39, :44 | Localise via label(). |

#### witness (archive)

Craft **3** — Solid layout and dedupe logic, undercut by Markdown leakage, an oversized speaker prefix and a mid-word clamp.
Beauty **4** — Big circular portraits beside a serif statement make a strong, human card when the quote is first-person.
Belonging **4** — Portrait-plus-quote matches the People/Witnesses pages.

Destinations: The portrait and 'See in context' go to the /history/witnesses/:slug page (C4 pass). The heading goes to /history/witnesses. Breadcrumb present (D3 pass), but it doesn't land on the quoted statement (D4 fail).
Duds (H1): 2/9 samples were duds (secondhand accounts clamped before substance: St. Joseph Weekly Herald, Woolley). Principals seen: Whitmer, Harris, Hyrum Smith; Oliver Cowdery and John Whitmer appear in payloads only.

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P2 | A7 | Raw Markdown leaks into the source line: '_St. Joseph Weekly Herald_' and '_Times and Seasons_' render with literal underscores. | desktop-rest-tile-witness-s1.png, desktop-dark-tile-witness.png. WitnessTile.js:61 flatten(w.source) does not parse _italic_. | Render source Markdown (convert _x_ to &lt;em>), or strip the underscores. |
| P2 | A3 | A third-party speaker prefix ('St. Joseph Weekly Herald:', 'Edwin Gordon Woolley:') renders at the 1.1rem statement size in black bold Roboto, so it reads as the tile's headline and pushes the quote down. | desktop-rest-tile-witness-s1.png, phone-rest-tile-witness.png. Sampler.css:1623 .witnessSpeaker has no font-size, so it inherits 1.1rem. | Set .witnessSpeaker to the meta tier (0.72rem, gray), as the history tile's .historyTileQuoteBy.prefix does. |
| P2 | H1 | Secondhand-account samples are duds: once the speaker prefix eats a line, the 4-line clamp ends before the witness says anything ('Mr. Whitmer reiterated his testimony as given at the…'; '…the death bed of Martin Harris, o…'). | 2/9 samples: desktop-rest-tile-witness-s1.png, phone-rest-tile-witness.png | Prefer quote_is_witness_voice rows for the featured slot, or allow 5–6 lines for attributed accounts. |
| P2 | D4 | The deep link lands on the witness's page timeline, not on the quoted statement: Martin Harris opens on a 1973 card while the tile quoted the 1884 Herald. | desktop-dest-direct-witness.png | Append an anchor or filter for the source id (e.g. /history/witnesses/martin-harris#&lt;slug>) and scroll to and highlight it. |
| P3 | H3 | The clamp cuts mid-word ('Martin Harris, o…') with no Layer-1 reveal. | desktop-rest-tile-witness-s1.png. WitnessTile.js:84 clampLines 4. | Use ExpandableText, or sentence-trim server-side. |
| P3 | D5 | The destination bio panel reads 'Biography coming soon.', which is stub copy above the fold. | desktop-dest-direct-witness.png | Hide the bio block until copy exists. |
| P3 | J1 | Portraits are 1024² JPEGs (193 KB for david-whitmer.jpg) rendered at 86px. | curl history/witnesses/people/david-whitmer.jpg 193,245 B. s2.log n1024x1024 r86x86. | Ship 256px variants. |

#### biblephrases (analysis)

Craft **2** — More than half the seeds produce nothing; when it does render, the highlights split words and the deep link loses the pair.
Beauty **3** — The side-by-side layout with gold marks is a good idea, but the small gray sans text and slab pills look unfinished.
Belonging **2** — It is the only tile that shows scripture in a UI sans face, so it does not look like the Read page.

Destinations: Heading 'Biblical Language' link and the TileCTA deeplink both go to page /analysis/bible/{book}~{book}, the canonical analysis URL, which matches C4 row 3. Two RefPills open the scripture popup (a quick verse look, matching C4 row 2). D4 fails because the page is book-level, not pair-level.
Duds (H1): 4/7 seeds were duds (2px empty slot): the tile gave up after 5 pairs without a 4-word shared phrase; 0 phone runs rendered

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P1 | B4 | Root cause of page-level finding (BiblePhrases 2px empty shell): most sampled intertext pairs share no 4+ word verbatim phrase, so the 5-pair walk gives up and the tile renders null. Measured dud rate 4 of 7 seeds. | BiblePhrasesTile.js:19-20,78,93,103. The index has a 3rd field that the tile ignores: 292 of 2335 eligible pairs are flag=1. Offline run over 60 spread pairs (scratchpad/analysis/bp.mjs): flag=0 pairs mark a phrase 10/53 times (19%), flag=1 pairs 5/7 (71%). Overall 25% marked, so ~24% of seeds fail all 5 tries even with independent pairs; observed live it was 4/7. Each failed seed also costs up to 10 scripture GraphQL calls (a2.mjs request log) | Sample only flag=1 (quotation) pairs, or precompute which pairs have marks at build time; also render a skeleton while walking |
| P1 | H1 | Dud rate 4/7 seeds: the tile is missing more often than it is present | desktop seeds 0, 2 (same window seed), 4, and run a15 tries 0-1 → height 2px; seeds 1 and 5 plus a15 try 2 rendered (desktop-seed1-tile-biblephrases.png, desktop-seed5-tile-biblephrases.png, desktop-bp-deeplink-hover.png). Phone: 2px on every run | Same as B4: restrict to flag=1 pairs |
| P2 | H3 | Shared-phrase highlights cut mid-word and swallow leading punctuation: 'un[to him that knocketh]', '[for the]m', '[, my God, and the rock…]' | desktop-seed1-tile-biblephrases.png ('unto' split), desktop-bp-deeplink-hover.png ('them' split), desktop-seed5-tile-biblephrases.png (mark starts at the comma); markShared diffs characters with no word-boundary snapping, BiblePhrasesTile.js:24-29,36-39 | Diff on word tokens (diff_linesToChars-style word mode) or expand each span to word boundaries and trim punctuation |
| P2 | A3 | Scripture is set in Roboto Condensed at 0.78rem (12.5px) gray, while chiasmus, art and the Read page all use the Scripture serif at about 15px, so this tile reads like UI chrome rather than scripture | Sampler.css:1400-1405; compare desktop-seed1-tile-biblephrases.png with desktop-rest2-tile-chiasmus.png | Use font-family Scripture and the miniChiasmText size; keep the two-column layout |
| P2 | D4 | The 'See in context' and heading links go to the whole book-pair grid, not the sampled pair: Alma 9:15↔Matthew 10:15 lands on 'Alma references to Matthew, 76 references' with Alma 5:21 at the top, and the user has to hunt for the pair | desktop-bp-deeplink-dest.png (/analysis/bible/alma~matthew); also desktop-dest-bible.png (3 Nephi×Matthew opens at 3 Nephi 1:25 of 181). BiblePhrasesTile.js:106-107 strips the chapter and verse | Deep-link to the specific pair (e.g. a ?v=bomVid~kjvVid anchor that the Bible view scrolls to and pulses) |
| P2 | B1 | No reserved space: the tile is a 2px slot until its 2–10 sequential fetches resolve, then jumps to 210–246px | a2.mjs timeline and a15 run (height 2 → 246.2); BiblePhrasesTile.js:103 returns null while loading | Render a fixed-height skeleton while walking; collapse the slot (or swap in a reserve) only on a final give-up |
| P3 | A5 | Ref pills are forced to full column width (display:block, 155px grey bars), unlike the inline pills on every other tile; it looks like a form field | Sampler.css:1399; desktop-seed5-tile-biblephrases.png; interactive inventory shows 155x17 pills | Drop display:block and left-align inline pills like chiasmus |
| P3 | L2 | Code read (not run): bookSlug parses the localized reference with an English-shaped regex, so Korean refs would produce Korean-name slugs the Bible view may not route | BiblePhrasesTile.js:80-81 (generateReference(..., lang)) and :106 | Build the slug from verse ids or the English book table, not the localized string |

#### chiasmus (analysis)

Craft **3** — Solid structure, a real deep link that opens the matching chiasm panel, and no duds in 5 seeds; the faint key letters and cramped wraps are the rough spots. _(adjusted 4→3 (critic: Three things count against a 4: the structural legend (key letters) is at 1.6:1 contrast, the tile is a 2px empty slot for about 5s before growing to 300-500px with no skeleton, and wrapped lines collide at line-height 1.1. history (also 4) has none of these. chiasmus belongs with commentary, notes and places at 3.))_
Beauty **4** — The stepped indent with the glyph is distinctive and readable at a glance.
Belonging **4** — Scripture serif, site ref pills and avatar style all match Read; only the over-gold marks drift.

Destinations: TileCTA goes to page /analysis/chiasmus/:id, which opens the index with the matching chiasm's detail panel ('Law and Heart') above the fold (D4 pass). The heading link goes to page /analysis/chiasmus. The RefPill opens the scripture popup. All match C4.
Duds (H1): 0/5 seeds were duds (8–12 line chiasms: 2 Nephi 2:7, Alma 15:3, 3 Nephi 10:4–5, Mosiah 5:10–12, Alma 31:16–23)

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P2 | A4 | Chiasm key letters (A B C D…) are #cfcfcf on white, about 1.6:1 contrast; they are the structural legend of the tile and are nearly invisible. MiniChiasm colors them with the --link token, whose light value is #cfcfcf | a14.mjs computed .miniChiasmKey color rgb(207,207,207) at 10.9px; MiniChiasm.css:15; darkmode/_tokens.scss:22 (--link:#cfcfcf); desktop-rest2-tile-chiasmus.png | Use --text-secondary or #888 for the keys and do not reuse --link for non-link text |
| P2 | L3 | In dark mode the key letters turn blue (--link dark = #a8c7fa), adding stray blue to a gold/gray house palette | desktop-dark-real-tile-chiasmus.png; darkmode/_tokens.scss:49 | Same token fix as A4 |
| P2 | B1 | Self-fetch pop-in with no skeleton: the tile is a 2px slot for about 5 s on a cold load (10 s under load), then grows to 307–533px and pushes its column | a2.mjs timeline: tile-chiasmus height 2 at 5.2–9.1 s → 307 at 10.1 s; ChiasmusTile.js:41 returns null while loading | Reserve a skeleton sized from scheme length, or move the chiasm pick into the homesampler payload so it is cached like the other tiles |
| P3 | A4 | Gold overuse: nearly every line carries one or two gold marks, plus the gold glyph bars, so the accent stops being an accent | desktop-seed5-tile-chiasmus.png (15 marks in 12 lines), desktop-rest-tile-chiasmus.png | Mark only the mirrored keyword pair per level at lower opacity, or underline instead of filling |
| P3 | A3 | Scripture lines use line-height 1.1 (16.7px on 15.2px text), so wrapped lines collide | MiniChiasm.css:22; a14 computed lh 16.72px; desktop-seed5-tile-chiasmus.png (wrapped A/C/E lines) | line-height ~1.35 on .miniChiasmText |
| P3 | A7 | Data typo 'lef t hand of God', an extraction artifact, shown twice in the 'Eternal Name' chiasm | desktop-seed5-tile-chiasmus.png; chall.json for chiasm 3f9029c234 lines 3 and 10 | Fix the two line_text rows (and scan the chiasm table for split words) |
| P3 | C1 | Speaker avatar and name (a person entity with a canonical page) are inert, while the same face elsewhere on Home links to /people/:slug | interactive inventory in a4.mjs: IMG.chiasmusTileAvatar has no link; ChiasmusTile.js:59-73 | Wrap avatar and name in a Link to /people/{person_slug} |
| P3 | A2 | Avatar is lazy-loaded with no placeholder background, so it shows as an empty hole beside the speaker name until it arrives | tablet-real-tile-chiasmus.png (blank avatar slot); Sampler.css:1462 | Give .chiasmusTileAvatar a neutral background and load it eagerly (it is 40px) |
| P3 | J1 | The 40px avatar downloads a 1024×1024 source | a4.mjs inventory: chiasmusTileAvatar nat 1024x1024 at 40x40 | Request a sized variant (e.g. ?w=96) |

#### art (analysis)

Craft **3** — The image and credit badge are handled well, but the late-growing excerpt, failed-image shell and Back trap from its CTA hold it back.
Beauty **4** — Big sharp painting with a tasteful credit badge; the scripture below in the Read serif works, though it is longer than the image.
Belonging **4** — It reuses the Read page's excerpt rendering, so it clearly belongs; the stacked double title is the odd note.

Destinations: Title bar and image frame go to page /art/:id (canonical, matching C4); RefPill opens the scripture popup (matching C4); 'See in context' goes to page /read/{book-ch}/{v} with the verse highlighted (matching C4, but Back is trapped, see E1).
Duds (H1): 0/4 seeds were duds (Zarahemla is Rebuilt, 'Depart into the Wilderness', Loading the Ship, Ammon Rejoices); every sample had an image, a credit and a resolvable ref

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P1 | E1 | 'See in context' into /read traps Back: Read canonicalizes the slug with navigate() (push), so Back from the destination lands on another /read URL, and a second Back still does not reach Home (cross-cutting root cause filed once) | a8.mjs: history ops push /read/4-nephi-1/6 → push /read/4.nephi.1/6 → replace /read/4.nephi.1; back1=/read/4.nephi.1/6, back2=/read/4.nephi.1/6; desktop-art-deeplink-dest2.png | See crossCutting E1 (Read.js:538 navigate with replace:true) |
| P1 | A1 | On phone the art tile renders 445px wide in a 390px viewport (right edge off-screen); see the crossCutting MapStory root cause | phone-real-tile-art.png; a9 box w=445 at x=24 | See crossCutting F1 |
| P2 | M2 | Image onError only hides the &lt;img>, leaving a 226px blank beige frame that still shows '© Intellectual Reserve, Inc.' for an image that is not there | desktop-imgfail-tile-art.png (art images forced to 404); ImageArtTile.js:247-249 | On error, drop the frame and badge (or the whole tile) and let the balancer reflow |
| P2 | B2 | The scripture excerpt self-fetches after paint: the tile grows from 368 to 609px (+241px). After Back restores scroll, the tile is in view showing a '…' placeholder that then expands under the reader | a2.mjs timeline (tile-art 368 @5.2 s → 609 @7.6 s); desktop-art-frame-hover.png (post-Back, excerpt shows only '…') | Ship the excerpt verses in the homesampler art payload, or reserve its height |
| P2 | D3 | The /art/:id page has no back control, and its only link, '❮ Read the passage', uses a left/back chevron for a forward navigation | desktop-dest-art.png | Use a forward/exit glyph for Read the passage; add a top-left back affordance consistent with the entity pages |
| P3 | A3 | Two competing titles stacked: the art title bar ('Zarahemla is Rebuilt') and then the excerpt's section heading ('A New Society') at a larger size, so the tile's hierarchy is upside-down | desktop-rest2-tile-art.png, desktop-seed4-tile-art.png ('Loading the Ship' / 'Preparing the Ship') | Suppress the section heading in the art excerpt (keep only the ref pill), or demote it to meta |
| P3 | G2 | The title bar and image frame are two separate tab stops to the same /art/:id, and the image frame has no hover state (C5) | a14.mjs focus walk (afocus 0 and 1 both /art/1943); desktop-art-frame-hover.png shows no change on hover; ImageArtTile.js:241-242 | Make one link (frame + title in one &lt;a>), and add a subtle hover (scale/brightness) on the image |
| P3 | D5 | The art destination is thin (image, title, credit, one link: 257 chars of text), and the sidebar highlights 'Study' instead of nothing or 'Home' | desktop-dest-art.png; a7.mjs text length 257 | Add the illustrated passage and other works by the artist; fix the nav active state |
| P3 | L3 | In dark mode the read-content excerpt sits on a lighter gray inset rectangle that does not match the card ground | desktop-dark-real-tile-art.png | Make .imageArtScripture .read-content background transparent in dark |
| P3 | J1 | A single 700px source, no srcset or modern format, loading=lazy even when the tile is in the first screen on tablet | ImageArtTile.js:243-248; a4 inventory nat 700x438 at 361 CSS px (1.94x, just under 2x) | srcset 480/720/1080 and eager + fetchpriority when in the first row |

#### mapstory (story)

Craft **2** — Crashes to a static fallback about 2s in for everyone, leaks a raw i18n key and slug-style names, and jiggles its column while autoplaying.
Beauty **2** — The live frame (terrain art, traveler avatar, route) is the most handsome thing on Home, but in practice users see a pale sage box with a dashed line. _(adjusted 3→2 (critic: The P0 (map dies about 2s after mount for every visitor) means what users actually see is the pale sage fallback box with a dashed line (desktop-ol-live-b.png). Beauty should score the shipped state, as was done for the Map tile (2), not the reduced-motion-only live frame.))_
Belonging **2** — Its own oxblood/green palette, blue focus rings and bespoke round transport buttons read as an embedded widget, not a sibling of the gold-accented tiles.

Destinations: Title link and 'Explore full journey' go to the page /map/internal/story/:slug (redirects to /move/1; real &lt;a href>; Back returns to /home, scroll 2275 to 2362 with Home reshuffled, which is already filed). The 'MAP' heading goes to the /map page. The scripture ref opens a popup (ScripturePopup; Esc, backdrop and close all work; scroll locked; focus returns to the ref; URL unchanged). Place labels and clusters on the map are inline step-selection buttons. All match the C4 rule (canonical story is a page, verse quick-look is a popup).
Duds (H1): 1/5 seeds were duds: Omer's Flight to Ablom (2 moves, so a one-hop 'journey'). A further 2 of 9 distinct stories had junk titles or names (Recolonization Limhi; digit-suffixed people in 5 of 9).

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P0 | M2 | Root cause of the page-level 'map.delete is not a function': import Map from 'ol/Map' shadows the global Map, so every new Map() in the tile builds an OpenLayers map. The first step change throws, the error boundary swaps in the static fallback for good, and the interactive map dies for every visitor about 2s after it mounts. | MapStoryTileInner.js:3 (import), :126-131 and :137 (new Map() is an OL Map; it has BaseObject.set/get but no .delete), :82 (map.delete). A MutationObserver run measured OL mounted at 12284ms and fallback at 14135ms, with 16 'map.delete' errors. Before/after: desktop-ol-live-a.png (live map, move 1) vs desktop-ol-live-b.png (fallback, move 2). The same fallback shows in desktop-mapstory-t0/t2.png, tablet-light-mapstory-8s.png and desktop-dark-mapstory-0.png. Only reduced motion (no step change) keeps the map alive: desktop-rm-mapstory-0.png. | import OlMap from 'ol/Map' (or use globalThis.Map) and use lazy useRef initializers. |
| P1 | D5 | The 'Explore full journey' destination (/map/internal/story/almas-ministry/move/1) shows a huge opaque portrait of Alma covering most of the map; the story route is not visible above the fold, even 14s after load. The map-tile edges also 404. | desktop-dest-story.png, desktop-dest-story-14s.png. About 40 'http 404 media.bookofmormon.online/map/internal/7/27-31/55-59' on that page. | The portrait overlay on the story page needs to be a small card or dismissible, never full-map; clamp the tile extent to the artwork. |
| P1 | F3 | On phone, the ref popup opened from this tile is not a sheet: it is offset right, its header and close button sit above the visible area, and the backdrop leaves the lower viewport uncovered. The root cause is shared (see crossCutting). | phone-popup.png, phone-popup-6s.png. | See crossCutting ScripturePopup F3. |
| P2 (was P1) | M2 | Once the error boundary trips, autoplay keeps running against the fallback. The counter, scrubber and beat card step through 'Move 4 of 10' while the 'map' is a fixed two-dot dashed line from origin to destination. The tile looks alive but shows nothing, and there is no retry, including after a transient chunk-load failure (seen once: 'Failed to fetch dynamically imported module MapStoryTileInner.js'). _Critic: downgrade → P2: This is a symptom of the P0 ol/Map shadowing and goes away once that is fixed. The remaining defect, that the boundary has no reset and playback ignores the failed state, is a resilience gap, not an independent P1._ | desktop-mapstory-t2.png (Move 4 of 10 over the static Zarahemla to Melek line). MapStoryTile.js:46-60 (boundary has no reset) and :106 ('playing' ignores the failed state). | When the boundary trips, stop playback and hide the scrubber, or show a static route preview; add a reset or retry keyed on the story slug. |
| P2 (was P1) | A7 | A raw i18n key is visible: the complete card reads 'Alma's Ministry Circuit · mapstory_meta'. The play/pause aria-labels are also the raw keys 'mapstory_play' and 'mapstory_pause'. The server label store lacks the mapstory_* keys, which exist only in the test mock. _Critic: downgrade → P2: Confirmed in desktop-rm-mapstory-0.png ('Alma's Ministry Circuit · mapstory_meta'). It appears only in the journey-complete state, at the meta tier, and the rest of the tile is legible. A visible raw key is a polish or trust defect, not a P1 blocker. The aria-label raw keys fit better under L2/G3 at P2._ | desktop-rm-mapstory-0.png and desktop-reduce-the-recovery-of-mulek-and-gid.png (visible 'mapstory_meta'). The Tab-order probe read aria-label='mapstory_play'. MapStoryCard.js:79 and MapStoryTile.js:278. Keys appear only in __tests__/MapStoryTile.test.js:112-118. | Add the mapstory_* labels server-side, or use tr() with English fallbacks as mapstory_complete does. |
| P2 | A7 | Data junk is shown as names: travelers render as disambiguation keys ('Alma2', 'Aaron2', 'Ammon2', 'Moroni1', 'Pahoran1', 'Lamanite King1'). The scripture popup uses 'Alma²'. Story titles come out inverted ('Recolonization Limhi'; the homeStoryTitle hack covers only Noah). The footer reads 'City of Bountiful → City of Bountiful' on round trips. | Every desktop mapstory shot ('Traveling: Alma2'). Payload capture: 5 of 9 sampled stories have digit-suffixed names. Seed 581319297 gave 'Recolonization Limhi'. desktop-reduce-the-recovery-of-mulek-and-gid.png shows the Bountiful → Bountiful footer. MapStoryTile.js:24-30. | Render person names through the same superscript formatter as the rest of the app; fix the titles in the data; show 'round trip from X' when origin equals destination. |
| P2 | A4 | Off-palette chrome: the tile uses its own oxblood (#96362f/#9f3029) and green (#2f6749) accents instead of gold, and focus rings are blue rgba(69,103,158) / #45679e, the 'not house style' blue family. In dark mode the ref link is bluish #b9c9df. Legend text is #737b76 at about 9.3px on white (4.35:1, below AA). | Sampler.css:1790, 2025, 2064 (blue focus), 2022 and 2045 (red), 2002 and 2150 (green), 2003 (legend), and the dark-mode .mapStoryRef override about 20 lines below 2180. Tab probe: outline solid rgba(69,103,158,0.52) 3px. | Use the neutral focus ring every tile shares; keep red only for the on-map route; move the status, primary button and scrubber to gold or neutral. |
| P2 | B2 | Autoplay changes the tile's height (beat descriptions run 2-3 lines; min-height 116px). That shifts every tile below in the masonry column every few seconds without user input. | Desktop heights sampled once a second during autoplay: 649,649,649,649,633,633,633,633. Layout-shift entries with input:false came from tile-witness and tile-mapstory (0.0014 and 0.0006). Tablet: 649 to 633. Sampler.css:2068-2076. | Give the stage a fixed height sized for a 3-line description, or reserve the max with a line clamp plus a fixed meta row. |
| P2 | C5 | The scripture ref button has outline:none and no :focus-visible style, so keyboard focus on it is invisible. The story title link falls back to the UA focus ring. | Tab-order probe: 'BUTTON.mapStoryRef\|outline:none 0px\|bs:none'; 'A.mapStoryTitle\|outline:auto rgb(16,16,16)'. Sampler.css:2109-2125. | Add a :focus-visible ring on .mapStoryRef and .mapStoryTitle that matches the tile family. |
| P2 | J1 | The 24px place thumbnails and 36px traveler avatars load full 1024x1024 JPEGs (about 320KB each, no srcset). A 10-move story pulls more than 2MB of images for postage-stamp thumbs. | naturalWidth 1024 vs clientWidth 24 (valley-of-gideon, zarahemla). curl: media/places/melek 324356B, places/zarahemla 358314B, people/alma2 196858B. MapStoryCard.js:11-17; MapStoryTileInner.js:713-718. | Request a small thumb size from the media host (e.g. a ?w=64 variant) or add a srcset. |
| P2 | J3 | useRef(new Map()) arguments run on every render, so each render of MapStoryTileInner constructs 7 throwaway OpenLayers Map instances (6 overlay registries plus the projection cache). The overlay calls setState on every layout settle. | MapStoryTileInner.js:125-137 (code read, combined with the import shadowing at :3). | Use a native Map with lazy init (useRef(null) plus an if-null-then-create guard, or useState(() => ...)). |
| P2 | L3 | In dark mode the 'MOVE n OF 10' status keeps #8b2f29 on #222 (1.92:1). The fallback panel keeps its light sage gradient, which glares inside the dark tile. | desktop-dark-mapstory-0.png. Sampler.css:1995-2001 (no dark override) and 1972-1981 (.mapStoryFallback). | Add dark overrides for .mapStoryMoveState and .mapStoryFallback. |
| P2 | L2 | Most visible strings are hardcoded English and bypass label(): the counts line 'N moves · N places', 'Move n of N', 'Journey complete', legend 'Active/Visited/Later', 'Explore full journey', 'Recenter story', 'Playback paused while you explore the map.', the cluster 'places', 'Origin/Destination', and all aria-labels and the sr summary. | Code read: MapStoryTile.js:102-105, 198-201, 221, 225-227, 260, 309, 330; MapStoryTileInner.js:619, 703, 732. | Route through label() and the mapstory_* keys (which already exist in the test mock). |
| P3 | A1 | In the live map, place labels clip at the frame edge ('elek' for Melek). In the beat card, both place names truncate mid-word at desktop width ('City of Za…', 'Land and Valley…'). | desktop-ol-live-a.png (Melek label cut at left edge; both names truncated in the beat row). | Constrain labels to the frame in buildStoryOverlay; let the leg row wrap to two lines instead of ellipsizing both ends. |
| P3 | A5 | The arrow between the two place names in the beat card sits roughly half a line below the names (align-items: baseline against thumb-led flex items), which looks misaligned. | desktop-mapstory-t2.png, desktop-ol-live-a.png. Sampler.css:2092. | Use align-items:center on .mapStoryLeg. |
| P3 | F2 | Small tap targets: the scripture ref is 24px tall, and on phone the transport buttons shrink to 42x42. | Phone targets probe: mapStoryControlButton 42x42, mapStoryRef 118x24. Desktop: mapStoryRef 66x24. | Use min-height 44px on .mapStoryRef; flex:0 0 44px is being squeezed, so add min-width:44px. |
| P3 | H3 | The complete-state description is clamped at 3 lines ('…by the stratage…'), cutting mid-word, and there is no way to read the rest in the tile. | desktop-reduce-the-recovery-of-mulek-and-gid.png; Sampler.css:2127-2136. | Clamp at a sentence boundary server-side, or drop the clamp in the complete card (it has the room). |
| P3 | H2 | In the complete state 'Journey complete' appears twice (status line and card heading), and the 'Active' legend entry still shows when nothing is active. | desktop-rm-mapstory-0.png. | Hide the status label or the legend in the complete state. |

#### community (story)

Craft **3** — Degrades sensibly (groups, then reading, then invite) and is dark-themed, but the width rule throws away the message content and the more-card.
Beauty **3** — Tidy cards and facepiles, but a sparse, form-like strip next to richly illustrated neighbors.
Belonging **4** — Neutral grays, the standard tile heading and the TileCTA match the family; only the emoji label jars.

Destinations: The heading, the '+N groups' card and 'View more' go to /home/community. Group cards go to /home/community/:group and message rows to /home/community/:group/:msg. All are real &lt;a href> pages, which matches C4. Destination screenshots were deliberately not taken (user content); the DOM showed no error boundary.
Duds (H1): 0/5 seeds were duds (live, not seeded): every sample had 4 groups (2 shown), 1 fresh message, and finishers. The same composition every time.

| Sev | Crit. | Defect | Evidence | Fix hint |
|---|---|---|---|---|
| P2 | A1 | The container query hides message text at 460px or narrower, but the tile is never wider than 445px (desktop 363, tablet 414, phone 445). So the 'recent messages' row always shows only a group chip, an avatar and a nickname, never what was said. | desktop-rm-community-anon.png, desktop-dark-community-anon.png (row = 'Group · Reader', no text). Probe msgTextShown:false at desktop, tablet and phone. Sampler.css:1347-1352. | Lower the breakpoint (about 300px) or wrap the text onto its own line under the name instead of hiding it. |
| P2 | E1 | This tile's links go to /home/community/&lt;group>, a Home tab route. Back to /home lands at scrollY 0 (was 2202), a full loss rather than the near-miss seen from other destinations. Tile-specific detail of the page-level E1. | s12 probe: back /home scroll 2202 -> 0. | Treat Home tab routes as scroll-preserving siblings (or store the Explore scroll per tab). |
| P3 | A1 | The same nth-child(n+3) rule also hides the '+N groups' more-card (it is a child of the strip). Two groups render, two are silently hidden, and the overflow count never shows. The member meta also wraps '11 / Members' onto two lines on desktop. | Probe: communityGroupCard 0x0 for the 3rd and 4th children, including the more-card linking to /home/community. desktop-rm-community-anon.png. Sampler.css:1349, 1303. | Exclude .communityMoreCard from the hide rule and fold the hidden groups into its count; set nowrap on the meta. |
| P3 | H2 | As a hook the tile is thin: 2 group cards, one nameless-content message row, and a '🎉 Recent Finishers:' line (the only emoji-led label among the tiles). Nothing says why a visitor should join. | desktop-rm-community-anon.png. | Lead with one real message excerpt and a 'join a study group' verb CTA instead of 'View more'. |
| P3 | C5 | Group cards and message rows have hover styles but no :focus-visible style, so keyboard focus uses the UA ring. | Focus probe on .communityGroupCard: 'outline auto rgb(16,16,16) 1px, box-shadow none'. Sampler.css:1290-1296, 1315-1320. | Mirror the hover border/shadow on :focus-visible. |

### R2.6 Family notes (what could not be run)

- **rail:** Logged-in (L1) not driven: no cheap test login. Did a code read of the signed-in ReadingPlanTile and ReadingProgressTile branches instead (findings marked "code read"). Korean (L2) not driven. Code read of the 4 tile files found no hardcoded English: every string goes through label(), and "52 weeks" comes from the server's durationLabel. The ReadingProgressTile variant (only shows with a reading bookmark) never appeared for a fresh guest, so I couldn't screenshot it; its B2 finding is from code. I didn't force the readingplanprograms fetch to fail, so the B4 empty-shell finding is from code (ReadingPlanTile.js:66). Narration H6 (art credit) is NR: /art/:id shows only the image above the fold, and I didn't check below it. Destination pages (/war/*, /downfall) took 7–10 s to fill on Vite dev, with a blank panel at 4 s. That is dev-inflated, so I didn't file it. The run was noisy with ERR_NETWORK_CHANGED, and one harness h.home() timed out and was retried. The "Unexpected token '&lt;'" pageerror fires on every Home load, but I couldn't tie it to any rail tile. Reduced motion: these tiles only animate on hover (the card lift and a 1.03 art scale), so I did a code check instead of a capture run.
- **people:** L2 Korean: not driven. Code read instead: every UI string in PeopleTile.js and PersonProfileTile.js goes through label(), and names, titles and alt text come from API data, so nothing is hardcoded in English. L1 logged-in: not driven. Neither tile has an auth branch (code read), so it is marked NA. J3 long tasks were not measured per tile (dev build). H1 for the People tile: home:resample on this dev stack took 10 s or more and twice never resolved (p11/p12 runs: the tile stayed a skeleton for 40 s). The 5 featured samples were gathered across several runs (Mosiah², Uzziah, Jerusalem Prophets, Ammonihah, Nephites of the City of Moroni). Only 4 of them have screenshots; Ammonihah was logged but not captured. PersonProfile popup backdrop-click dismissal was not tested; it is a shared ScripturePopup concern. Reduced-motion: neither tile has looping animation, only a 2px hover lift, so a spot check was not needed. The person destination took more than 3 s to render under Vite (desktop-profile-dest.png still shows a spinner). That is dev-mode and not filed. Note for the page-level owner: R1 says 'no horizontal overflow at either width', but in today's phone seed the page overflows by 79px. See crossCutting F1.
- **places:** MapTile never appears in the live sampler. I checked 5 desktop seeds plus a 30-step infinite scroll, and it was absent at phone and tablet too. To audit it I patched tiles/registry.js inside the browser only (Playwright route, map moved to the front of reservePool, service worker blocked via a copy of the harness at scratchpad/places/harnessNoSW.mjs). Product code on disk was not touched. All map-tile visuals come from that forced render. Not run: - Phone popup sheet behaviour (F3) for the RefPill popup on phone. - Backdrop-click dismissal for the RefPill popup. Only Esc was exercised: it closes and focus returns to the pill. - Korean (L2). Code read only: every UI string in the four files goes through label(), including aria-label "map", "+N Places", view_in_context and view_more. Place names and info come from the API. No hardcoded English found. - Logged-in (L1). Code read only: none of the four tiles has an auth branch. Measurement limits: - Element screenshots at phone and tablet often captured the wrong region because of the phone page-width overflow and the fixed header. I used viewport shots instead (phone-vp-*.png, tablet-vpshot-*.png). - Some desktop element shots have the sticky header over the top of the tile. That is a harness artifact, not a product defect. - The server load average was about 35, so resample fetches took 30-60 s. One of the 5 seeds had no Places tile in the initial page (it was resampled away).
- **matters:** L1 (logged-in) and L2 (Korean) were not driven live; I read the code instead. None of the four tiles has an auth branch. All strings go through label()/tr(): menu_matters, matters_group_*, view_all, view_more, read_more and view_in_context. The only English is the tr() fallbacks ("Narrative" etc.) and the alt text, which is the matter name from data. The "+N Matters" overlay uses label() but builds the count by string concatenation, so word order in Korean is not localized. Also not checked: middle-click/open-in-new-tab (I only verified that real hrefs exist), the iOS Safari scroll-anchor behaviour, and a prod-build J3. E1/E2 are marked F in the matrices (Back reshuffles Home and lands at the wrong scroll: measured y 546 to 633 and 5220 to 3538 after Back from /matters/&lt;slug>), but that is the page-level R1 finding and is not re-filed here. The SyntaxError "Unexpected token '&lt;'" appeared on every load, but no matters tile traces to it: matters images are plain &lt;img> tags, and the tiles do no fetching of their own. matterProfile is a reserve/batch tile. It showed up in 3 of my desktop loads and in 2 of the 5 resample seeds, always as "Secret combinations", so I saw only one matter (dud rate 0/2). I could not get a dark-mode screenshot of matterProfile because it was absent in the seed where the dark sweep ran, so its L3 finding is from code. The machine was heavily loaded (load average around 30, so Vite boots took 30–120 s). Timings are unreliable; behaviour and ordering are not affected.
- **scripture:** L1 (logged-in): not driven. Code read found no auth branches in TextTile, CommentaryTile, NotesTile, RefPill, ScripturePopup or ExpandableText, so these tiles should look the same for guests and members. L2 (Korean): not driven. Code read found these hardcoded strings: aria-label="Close" (ScripturePopup.js:111); the "▸" separator and trailing ":" in TextInFeed (StudyInFeed.js:98); curly quotes and an em-dash attribution in NotesTile.js:239-241. Every Notes sample was an English Grant Hardy gloss, so whether a Korean notes payload exists is unknown. J3 (long tasks): not measured per tile; the timings are inflated by Vite dev. B4 for Notes (the ScriptureExcerpt fetch-failure path that shows label rp_error_loading inside the tile) was not forced. Dud rate (H1) used 5 desktop seeds: the seed-0 window plus 4 resamples. I did not pin the page-level "Unexpected token '&lt;'" to this family: it also fires on a direct load of /commentary/:id (s10.mjs), so its origin is outside these tiles. Dev :8201 was heavily loaded by parallel agents. /home often needed 2–3 retries to render, and one run showed net::ERR_NETWORK_CHANGED and AxiosError Network Error. So the absolute timings (the 6–12 s commentary blank, the late Notes excerpts) need re-checking on a prod build; ordering and behavior are representative. Phone element screenshots of the main-column tiles came out mis-framed because of the horizontal overflow (cross-cutting F1), so phone judgements use the viewport captures (phone-phone-viewport-at-*.png). Scripts are in /tmp/claude-1003/-home-bom-BookofMormonOnline/524d9f80-ee41-4628-b4a6-fb0690560be9/scratchpad/scripture/ (s1–s19.mjs).
- **archive:** TRANSLATION tile: never rendered. I tried 10+ Home loads/resamples on desktop, phone and tablet and scrolled about 28k px of infinite batches. Replaying homesampler(seed:N) for seeds 3/777/4141/9001/123457 plus the window seed returned translation=null every time, so it has no rest/interaction/visual checks; it is scored from code only. L1 (logged-in) was not driven for any tile. Code read: none of the six tiles has an auth branch, so guest and logged-in should be identical. L2 (Korean) was not driven; I did a code read for hardcoded strings instead (findings filed under L2). F3 (phone popup presentation) and popup backdrop-click dismissal were not exercised: Esc dismissal was verified, backdrop click was not. The phone viewport-scroll screenshots (phone-vp-*.png) did not scroll to the tile (they all show the top of the feed), so phone evidence comes from element shots plus measured heights. J3 long tasks were not measured per tile. Resample timed out (no non-skeleton tile within 30s) on 4 of 6 attempts while parallel audit agents were loading the backend (an uncached seed takes ~10s), so the H1 samples come from a mix of resamples and reloads. On direct load of /history/* and /fax/* routes, the uncaught "SyntaxError: Unexpected token '&lt;'" comes with an HTTP 415 from POST localhost:8201/graphql. It also fires on destination pages with no archive tile mounted, so it does not originate in this family; its source was not pinned. "Encountered two children with the same key 36884" console warnings were seen on Home but not attributed to a tile.
- **analysis:** Reserve variants chiasmus2, artFill1 and artFill2 never appeared in about 10 desktop, phone and tablet loads. The balancer did not insert them in any of the sampled seeds. They share code with chiasmus and art, so those findings apply to them too. I did not isolate the batch-only artB; infinite-batch art and chiasmus tiles did appear while scrolling. BiblePhrases never rendered in a phone run, because every phone load drew a dud seed. So F1, F3 and L3 for BiblePhrases are not run, and its tile-level CLS is measured on desktop only. Logged-in (L1) is not run; a code read finds no auth branches in any of the three tiles. Korean (L2) is not run; the code read is in the BiblePhrases L2 note. Reduced motion is N/A because none of the three tiles animates (no animation or transition in MiniChiasm.css, ChiasmGlyph or the imageArt rules). I could not get a chiasmus fetch failure (B4/M2): the aborted graphql route still rendered the tile, apparently from BoMOnlineAPI's own cache. J3 is not run. Load average on the host was 12–35 during the pass, so several homesampler loads and resamples hung on skeletons for over 90 s. That is consistent with the page-level batch-failure finding, but timings here are inflated. The 'Unexpected token &lt;' pageerror is NOT from this family: an HTML response is served for script http://localhost:8201/c219f11b23e6304d69.js (the obfuscated Clicky proxy path). The 'two children with the same key' warnings (keys 36835/36884, verse ids) were seen but not attributed.
- **story:** Logged-in (L1): not driven; code read shows no auth branch in either tile (community refetches with the token, but the tile renders the same either way). Korean (L2): not driven; code read only. Community destinations (D3-D5): checked through the DOM only (URL, back control, error boundary). I took no screenshots there because the group page shows real member messages. Community at-rest captures were made after replacing names, messages and avatars in the DOM (files *-community-anon.png), so A2 for its avatars is NR. Phone element screenshots from h.shot come out wrong because of the 469px layout viewport (see crossCutting F1), so I used viewport shots for phone (phone-mapstory-vp-top.png, phone-community-vp.png, phone-popup-6s.png). The resample endpoint sometimes stalled for more than 10s with 21 skeletons on dev, which made seed sampling slow. For H1 I used captured homesampler payloads instead (11 seeds, 9 distinct stories). I did not get a capture of a 20-move story (Recolonization Limhi) with the live map, so overlay crowding on long stories is unverified. Timings come from Vite dev (J3 is a code read).

## R3. Destination Study (§S) — 2026-10-15

Five investigators (S1 per entity type, S3 cost of leaving Home, S4 content
volume from the API) and one synthesizer (S2 + S5). Screenshots:
`home-discover-audit-2026-10-15/tiles/dest-*` (gitignored).

### S5 Recommendation

| Destination | Choice | Rationale | Preconditions |
|---|---|---|---|
| person entity (/people/:slug) | **route-backed modal** | S3 shows the cost of opening a page is almost all in the return trip. Leaving takes 276-1828ms and is clean, but after Back the clicked item ends up 1.7-11.8 screens from where it was, and Home is rebuilt reshuffled. Keeping Home mounted under an overlay removes that cost entirely, and is the only way to do so without first building full sampler-state persistence. S4: 59.5% of people fit a compact view and 84.6% fit a scrollable one. The tail is hubs (nephi1 127 cards, alma2 724 words / 104 refs, lamanites 124 refs) that a capped modal plus 'See full page' handles. S1 entity craft is 2/5: the page is the popup body poured onto a page. Sending Home readers to it is the worse experience. SEO is unaffected: the URL stays canonical /people/:slug, tiles stay real &lt;a href>, and direct load, new tab and crawlers get the Next SSR page (frontend/next/app/people/[slug]). This matches the ScripturePopup convention on Home (overlay, Esc closes) and the presentation model already specified in docs/specs/2026-09-24-entity-url-presentation-model.md. Phone renders the same route-backed state as a full-height sheet (the existing MobileDrawer slot), not a centered modal. | (1) Fix the mechanism: Back must close the modal and close must history.back() instead of pushing underSlug (appController.js:273-288; no popstate listener exists). Push with state so a Back into the entry reopens it. (2) Home tiles (PeopleTile.js, PersonProfileTile.js) must open through the shared opener: plain left-click intercepted, modifier/middle-click and new tab left to the browser, href unchanged. (3) A compact modal body: References capped at 8 and related cards at 8 (4-6 per xrel verb group), each with 'See all N →'. A visible Maximize / 'Open full page' (MaximizeButton.js exists). No empty headings. Close control fixed at top. Internal scroll. Focus trap and focus restore. (4) The full page must still be fixed, because hubs, maximize, new tabs and shares land there. Required: top return control (history.back() when in-app, else the index), phone refbox at full width, h1 title, real hrefs on references and relationships. (5) Nested entity clicks inside the modal swap content and replace (or push with state) so a single Back returns to Home. |
| place entity (/places/:slug, /place/:slug) | **route-backed modal** | Places are the most popup-shaped type. S4: 79.3% fit compact and 93.6% fit scrollable; the median place has about 159 words, 1 reference, 0 related cards (152 of 188 have none) and 1 image. As a full page the median place is mostly empty space with the return link at the bottom (S1 D3). The S3 return cost is worst for places: on phone the scroll overshot by 2257px, the doc grew from 10.8k to 17.5k px, and /places view-all left the clicked item 11.8 screens away. SSR exists (frontend/next/app/places/[slug]), so crawlers and shares are unaffected. | Same mechanism fixes as person (Back closes, close pops, tiles route through the opener, including PlacesTile.js and PlaceProfileTile.js). Place-specific: (1) replace the 18-button map stack with one 'View on map' plus an 'Other maps (N)' menu (PlaceBody.js:63-75). Opening a map from the modal is a real navigation to /map/..., which is acceptable because the reader chose to leave. (2) Add the facets row (locale, occupants, type) so the compact view says what kind of place this is. (3) Fix the literal '&lt;sup>1&lt;/sup>' leak. (4) Cap References at 8 for the hubs (jerusalem-1 74, land-of-nephi 46). |
| matter entity (/matters/:slug) | **route-backed modal** | Matters are short by construction. S4: every matter is 228 words or fewer (median 94), the median has 3 refs and 4 related cards, 77.1% fit compact and 91.4% fit scrollable. Only refs and cards overflow (swords 123 refs, houses 74). S1 rates the entity page 2/5 craft and 2/5 beauty: thin column, 288px rail of 123 references, slug leaks. The full page is the weakest destination of the three. S3 measured the matters round trip: the clicked tile was gone after Back, the Material tile resampled, and the clicked item was 5.8 screens away on phone. An overlay over Home avoids all of it. | (1) P0 first: /matters/narrative\|material\|concepts must route to the Matters index, not EntityPage (Routes.js:268-275). Otherwise every group view-all lands on 'Not found'. (2) SEO precondition before matters is un-hidden: there is no SSR route for matters (no frontend/next/app/matters) and features.yml:10 marks /matters seo: remove. Add the SSR page so direct load and crawlers get a full page like people and places. (3) Compact body: drop showEmpty (MatterBody.js:51), map dst_name to display names (XrelSection.js:113), cap refs and cards at 8 with 'See all', add a Kind · Era · Category facets row. (4) Same mechanism fixes as person (Back closes, close pops, MattersGroupTile.js and MatterProfileTile.js route through the opener). |
| people index (/people) | **page** | A 435-card browsing surface with filters is a place the reader chose to go, not a quick look. It is 17k px on desktop and does not fit any overlay. S4's fit criteria don't apply to it. It is the 'view all' intent. SSR exists (frontend/next/app/people/page.tsx). Its own item clicks already open the entity modal over the grid, which is consistent with the entity recommendation once the mechanism is fixed. | (1) Home must survive the round trip. S3 shows Back reshuffles Home and loses the clicked item (R1 E1/E2), so persist the sampler order, per-tile samples and revealed batches per session and rehydrate on POP. Leaving for a page is acceptable only once this is fixed. (2) Top return control (backCtl was null in S3) that goes back to Home via history.back() when the reader came from Home. (3) Move the fetch out of render into useEffect, with error and retry (People.js:66). (4) Sort and grouping (A–Z / narrative / era), lazy image thumbnails, a placeholder for blank portraits, and an end state. (5) Investigate the phone People view-all tap that never became actionable. |
| places index (/places) | **page** | 188 cards at 28k px on phone is a browsing destination, not a glance. The 'view all' card states the intent to leave. S3's worst context loss, the clicked item 11.8 screens away on phone, is a Home-restoration defect, not a reason to overlay an index. | Same Home state-persistence precondition (R1 E1/E2). A top return control. Fetch in useEffect with error state (Places.js:63-66; S1 saw it hang on spinners). Group by greater locale with section headers, lazy-load images, center the phone grid, and fix document.title. |
| matters index (/matters, /matters/:group) | **page** | 476 cards at 40k px. The three group entry points from Home are 'view all' intents, and they should land on a sectioned index page that is pre-filtered to the group. | (1) P0: route /matters/:group(narrative\|material\|concepts) to Matters ahead of /matters/:matterSlug, with a route test for all three keywords. (2) Section the index by the canonical three groups, show the count, and paginate or virtualize. (3) Same Home state-persistence and top-return preconditions. (4) Before un-hiding: SSR index route plus the seo intent flip (features.yml:10). |

**C4 Destination Rule, row 3 (settled):**

| An entity with its own canonical URL (person, place, matter) | Route-backed modal. The link is a real <a href> to the canonical URL. A plain click opens the entity as an overlay over the current view (full-height sheet on phone) and pushes that URL. Back, Esc, backdrop and close all return to Home with the same tiles and scroll, and closing pops the entry rather than pushing a new one. Long lists are capped with 'See all N →', and a Maximize control opens the full page. Modifier-click, new tab, direct load, shares and crawlers get the full SSR page. |
| A collection or document (view-all indexes /people, /places, /matters[/group], chapters, history docs, maps) | Page. It gets a top return control, and Back restores Home intact (same order, samples, batches and scroll). |

**Risks:** 1. The modal mechanism is not a real route-backed modal yet. Back does not close it (no popstate handler in webapp/src), and closePopUp pushes underSlug, which piles up history entries (appController.js:273-288). Switching Home tiles to the modal before fixing this trades one E1 defect for another. This is the gating precondition, and it should ship with tests for Back, Forward, close, reload and new tab. 2. SEO regressions: - Tiles must keep a real href to the canonical URL and intercept only plain left-click. Turning them into buttons or onClick-only elements would take crawlable internal links out of Home's SSR. - Matters has no SSR route and is seo: remove. The 'crawler gets the full page' promise is false for matters until that route exists. - The modal must not render its own canonical or meta tags in a way that fights the page's. 3. Two bodies to maintain. A compact modal body and a full page body can drift apart. Mitigate with one EntityBody that takes a `compact` prop (caps and a maximize slot), not two components. The current popup bodies are already shared, so this is a refactor, not a fork. 4. Hub entities (nephi1 127 cards, alma2, lamanites, swords) will push readers to Maximize. If the full page stays at today's 2/5 craft, those readers hit the worst experience. The S1 page fixes (top back control, phone rail, h1, reference layout) are required, not optional. 5. Phone: a sheet over Home must lock background scroll and restore focus. MobileDrawer currently closes via setTimeout (Drawer.js:44,73), and that path needs the same Back semantics. 6. Index pages stay pages, so the Home state-persistence fix (R1 E1/E2) is still needed for view-all trips. The modal removes the cost only for entity clicks. 7. Evidence caveats: - Back-not-closing and the history pile-up are derived from code, not captured live. - S1/S3 D4 tile-click arrivals, the phone People view-all tap, and the phone indexes were partially unmeasured because of network flaps and the Bash isolation guard. - Timings are from the Vite dev server and are inflated; compare them relative to each other, not as absolute values. 8. The docs are out of date and will mislead implementers. The EntityPage.js:40-45 comment and docs/specs/2026-09-24-entity-url-presentation-model.md say 'in-app clicks never mount the page', which Home tiles contradict. Update both when the opener lands.

### S2 Consistency

Entity pages share one shell, but each type renders a different body. The index pages are three separate builds. ENTITY PAGES. A single shell, views/Entity/EntityPage.js, drives people, places, matters and history from one TYPES table (EntityPage.js:20-25). It provides the same data hook (useEntityData), the same not-found and chooser handling, and the same bottom-of-page back link (EntityPage.js:67-71 and :127). What the shell renders is three popup bodies "moved verbatim" out of PopUp.js (MatterBody.js:11), each styled by PopUp.css's .ppbody/.refbox with EntityPage.css overriding the popup sizing. All three bodies share the same skeleton: an &lt;h3> title with &lt;br/>&lt;small> subtitle (PersonBody.js:27, PlaceBody.js:31, MatterBody.js:26), an 18rem right rail and ReferenceList. None of them was designed as a page. Concrete divergences inside that skeleton: (1) Relationships section, one per type. - Person: an unconditional &lt;h4>Relationships&lt;/h4> (PersonBody.js:46), then Relationships.js div-onClick avatar rows, then XrelSection noHeading. Result: the heading renders over nothing for the 10 people with no relationships. - Place: XrelSection with its own heading, labeled like "… Located in 13". Hidden when empty. - Matter: XrelSection showEmpty (MatterBody.js:51), which renders a stub "No relationships." on 52 matters. (2) Places get a "View on Map" button above the hero that expands to up to 18 stacked buttons (PlaceBody.js:63-75). No other type has an equivalent action, so person and matter pages have no "read it" or "see it" action. (3) Prose. Person and place descriptions carry inline entity links (median 17 and 12). Matter prose has 0 across all 476. Matter xrels print dst_name raw ("Nephi1", "lamanites"; XrelSection.js:113). The place prose leaks a literal "&lt;sup>1&lt;/sup>". (4) Facets. None of the three types shows its classification, even though the index cards do (occupants/locale/type for places, kind/era/category for matters). (5) Clicks. Relationship clicks call setPopUp from inside the page (XrelSection.js:83), so page→page navigation breaks into a modal on top of the page. EntityPage's onEntityClick is passed but XrelSection never receives it. INDEX PAGES. Three separate builds that share only _Common/FilterPanel and the same click-intercept idea (Link + preventDefault + setPopUp: People.js:83/153, Places.js:122/166, Matters.js:115). - People: react-masonry-css with fixed 18em cards (People.css:117). The header carries an icon and the name, the portrait is a CSS background with a date chip, and the footer holds a colored affiliation pill plus classification icons. - Places: react-masonry-css with reactstrap Cards at 19em (Places.css:190). It borrows People.css, overlays a translucent locale strip on the art, and puts occupant badges and a geo icon in the footer. - Matters: a different layout engine (CSS grid .MatterGrid, not Masonry; Matters.js:202) with 22em cards (Matters.css:68). It has saturated gradient-plus-initials fallbacks, single-letter badges, and the filter bar collapsed to "SELECTORS". It also has a /matters/:group mode that is unreachable because of route order. - All three: an &lt;h3> page title, no h1, and no return control. People and Places fetch the list in the render body (People.js:66, Places.js:63). There is no sort, grouping, pagination or end state anywhere: 435 / 188 / 476 cards at 17k / 28k (phone) / 40k px. Verdict: one shell carrying three transplanted popup bodies, and three index builds. A redesign should set one anatomy for all three bodies: h1 title, facets row, prose, related cards capped with "see all", references grouped with real hrefs, and a top return control. It should also build one shared index grid component.

| Page | Sev | Crit. | Defect | Evidence | Fix |
|---|---|---|---|---|---|
| /people/:slug, /places/:slug, /matters/:slug | P2 | S2 | The entity 'template' is a page shell around three popup bodies. Relationships are handled three ways: an unconditional heading (people), a self-headed and hidden-when-empty section (places), and a 'No relationships.' stub (matters). | PersonBody.js:46 (unconditional &lt;h4>) + Relationships.js + XrelSection noHeading; PlaceBody.js uses a headed XrelSection; MatterBody.js:51 `&lt;XrelSection xrels={obj.xrels} showEmpty />`; MatterBody.js:11 says the body was 'moved verbatim out of PopUp.js'. S4 measured 10 people with an empty heading and 52 matters with the stub. | Use one EntityBody anatomy (h1 → facets → prose → related (capped) → references) with per-type slots. Section headings render only when the section has content. |
| /people/:slug, /places/:slug, /matters/:slug | P1 | S2 | Clicking a relationship card inside an entity PAGE opens a modal on top of the page instead of navigating to the next page, because XrelSection never receives EntityPage's onEntityClick. | EntityPage.js:59-61 defines onEntityClick (navigate) and passes it to Body. XrelSection.js:83 calls appController.setPopUp directly, and XrelSection.js:90-106 renders li onClick with no href (S1 matters G1). | Render xrel cards as &lt;a href> to the canonical URL, intercepting plain left-click via the presentation-aware opener (modal when in modal, navigate when on a page). |
| /places/:slug, /matters/:slug | P2 | S2 | Each type has its own action and facet treatment. Places get a stacked map-button chooser (up to 18). People and matters have no primary action. No type shows its own classification, although the index cards do. | PlaceBody.js:63-75 renders one Button per map (max 18, S4). GraphQLQueries.js fetches matter category/era (122-145) and place occupants/type/location (74-79), and the bodies do not render them (S1 places D5, matters D5). | Add a facets row under the title for all types and one primary action slot: Map for places, 'Read references' for people and matters. The map chooser becomes a compact menu. |
| /matters/:slug | P2 | S2 | Matter prose has no inline entity links, while person and place prose links names. Matter relationship names print raw slugs. | S4: {Name\|slug} tokens are 0 in all 476 matters, against medians of 17 for people and 12 for places. XrelSection.js:113 prints x.dst_name raw ('Nephi1', 'lamanites'; S1 matters A7). | Run dst_name through the display-name lookup. Backfill entity-link markup in matter descriptions. |
| /people, /places, /matters | P2 | S2 | The index pages are three separate builds: two masonry layouts plus one CSS grid, card heights of 18/19/22em, three footer badge systems, and three image-overlay treatments. They share only FilterPanel. | People.js:148 Masonry with People.css:117 height 18em; Places.js:158 Masonry with Places.css:190 height 19em and an imported People.css; Matters.js:202 .MatterGrid with Matters.css:68 height 22em. Footers differ too: colored affiliation pills (People.css:26-65), occupant badges plus a geo icon, and single-letter badges (Matters.js:246-266). | Build one EntityIndexGrid (uniform aspect image, 2-line name, neutral facet chips, lazy images, sort plus section grouping, count and end state) and feed it three configs. |
| /people, /places, /matters | P1 | S2 | Nothing navigates the same way. The index opens a modal (setPopUp), Home tiles mount the full page (router Link), and relationship cards on a page open a modal on top of the page. The same URL /people/:slug gets three presentations depending on where it was clicked. | People.js:83/153 and Places.js:122/166 call setPopUp. PeopleTile.js:32, PlacesTile.js:30,63, MattersGroupTile.js:42 and MatterProfileTile.js:41 use react-router &lt;Link>, which mounts EntityPage. The EntityPage.js:40-45 comment ('Only ever mounts on DIRECT arrival') is false for Home tiles. | Route every in-app entity click through one opener (the S5 route-backed modal). Correct the EntityPage comment and docs/specs/2026-09-24-entity-url-presentation-model.md. |
| (modal mechanism) /people/:slug etc. | P1 | E3 | The existing route-backed modal is half a route-backed modal. Browser Back does not close it, and closing it pushes a NEW history entry instead of popping the one it created. | appController.js:256 opening calls setSlug, which calls history.push (routeHistory.js: native pushState that the Router does not hear). appController.js:273-288 closePopUp calls setSlug(underSlug), which pushes again. grep finds no popstate listener anywhere in webapp/src that closes the popup, so Back changes the URL but leaves the modal open (from code, not live-verified). Open then close leaves history as /home → /people/x → /home. | Push with state {modal:true}. On close, call history.back() when the current entry is the modal's own entry, otherwise replace. Add a popstate listener that closes or re-opens the modal from history state. |
| /matters/:slug | P2 | S2/SEO | Matters is the only entity type with no SSR route, and its URLs are marked seo: remove, so the 'direct load / crawler gets the full SSR page' guarantee does not hold for matters today. | frontend/next/app has people/[slug] and places/[slug] but no matters directory. frontend/webapp/config/features.yml:10 has mattersNav { hidden: true, seo: remove, paths: [/matters] }. The Next catch-all [...path] has no matters handling. | Before matters is un-hidden, add frontend/next/app/matters/[slug] (and /matters) using the same SSR body as people and places, then flip the seo intent. |

### S3 Cost of leaving Home

S3 was measured live on Vite dev at :8201, for People, Places and Matters item links and view-all cards, at desktop 1440 and phone 390. Timings are dev-inflated, so read them relatively. Going out is cheap and clean. Destination content appears 276-1828ms after the click (mostly 300-900ms). Navigation stays in the SPA, the page arrives at scrollY 0, CLS not caused by user input is 0 everywhere (only an input-window 0.033 header/bottom-nav shift on phone), and history is correct: one entry per click, Back/Forward/Back land properly, no duplicate entries. Coming back costs about as much as going out (Home usable after 826-1522ms) and loses the reader's place. Home first paints at the top, then the scroll restore jumps in one or two steps over about 1.5s. The scroll number is usually restored (within 29-424px; once overshot by 2257px on phone), but tile order and per-tile samples are rebuilt. So the item the reader clicked ends up 1.7 to 11.8 screens away; the worst case was phone /places view-all, which also dropped infinite tiles from 66 to 46. Only the top-pinned People tile survives the round trip. Other findings: - **P0:** the Matters view-all cards (/matters/concepts and /matters/narrative) render 'Not found', because the /matters/:matterSlug route is declared first (Routes.js:269). - **P1:** entity pages have only a bottom-of-page '❮ Index' link, which is below the fold on desktop person pages and 1.7-2.7 screens down on phone. It is a plain &lt;a href> to the index, not back to Home (EntityPage.js:67-71). - **P2:** /people and /places have no return control at all. Two phone cases were not measured: People view-all (the click never became actionable) and Matters view-all (Home load timed out during network churn). These numbers back the S5 case for a route-backed modal or a kept-alive Home: leaving is fast, and nearly all the cost of S3 is in the return trip. Artifacts: - Screenshots: /home/bom/BookofMormonOnline/docs/audits/home-discover-audit-2026-10-15/tiles/dest-s3/ - Raw JSON: /tmp/claude-1003/-home-bom-BookofMormonOnline/524d9f80-ee41-4628-b4a6-fb0690560be9/scratchpad/dest/s3-*.json - Script: .../scratchpad/dest/s3cost.mjs Late in the run, the Bash tool started refusing commands because of worktree isolation, so the failed cases could not be re-run.

| Link | VP | To content (ms) | Dest CLS | Back usable (ms) | Scroll before → after | Clicked tile still there | Notes |
|---|---|---|---|---|---|---|---|
| People tile person (/people/amlici) | desktop | 360 | 0 | 1086 | 0 → 0 | true | People tile is pinned at grid top, so a scroll-0 round trip loses nothing visible: clicked face at y=377 before, 373 after. First-15 tile order still reshuffled. Back control '❮ People' sits at viewportY 1055 in a 900px viewport (below the fold, bottom of a 1138px page). History 2→3, Back→/home, Forward→dest, no duplicate entries. Run 1 (cold Vite) measured toContent 1714ms. JSON: scratchpad/dest/s3-desktop-people.json |
| People tile view-all (/people) | desktop | 1081 | 0 | 1522 | 0 → 0 | true | Index page has no back/return control (backCtl=null). The view-all card moved from y=586 to y=132 after Back because the tile re-sampled and changed its layout. History clean. |
| Places tile place (/places/moroni) | desktop | 425 | 0 | 1308 | 1004 → 1092 | true | Home first paints at scrollY=2, then jumps to 1092 about 1.5s later. The clicked link moved from viewport y=518 to y=1211, so it is now below the fold. Back control at y=696 on a short page (fits). History clean. |
| Places tile view-all (/places) | desktop | 729 | 0 | 1226 | 3410 → 3410 | true | Scroll number is restored exactly (after an initial paint at y=2), but the view-all link the reader clicked is now at viewport y=3372 instead of 497, about 3.2 screens away. Same tile set (25/25 nearby tiles present, 66→66), different order. /places has no back control. |
| Matters tile matter (/matters/rust) | desktop | 276 | 0 | 1343 | 3262 → 3349 | false | Restore happens in steps: y=1054 at first usable, then 3349. Screenshots before vs back are completely different at the same scrollY. The Matters·Material tile changed its contents (Rust/Sackcloth/Thorns became Mattock/Lightning/Daytime Heat), and the Places mosaic became a single 'Land of Midian' card. An href=/matters/rust was found at y=-1537 (another instance), not where the reader was. Back control at y=657 (fits). |
| Matters tile view-all (/matters/concepts) | desktop | 384 | 0 | 906 | 3430 → 3430 | true | BROKEN: the destination renders 'Not found' plus '❮ Matters' (screenshot desktop-matters-viewall-2-dest-settled.png). The 'timing' is the time to reach the empty state. |
| People tile person (/people/amlici) | phone | 592 | 0 | 832 | 3719 → 3690 | true | Arrives at top with no image and no back control above the fold. '❮ People' is at y=2288 on an 844px screen (2.7 screens down). The bottom nav highlights 'Study' on a person page. After Back, scroll is restored within 29px after an initial paint at y=2, and the face moved from y=451 to y=247 (still visible). Only input-window CLS on arrival (0.033, header/bottom-nav). |
| People tile view-all (/people) | phone |  |  |  |  →  |  | NOT MEASURED: Playwright click on .viewAllCard timed out after 30s (locator resolved; actionability failed, likely obscured or not stable). Worth a manual tap test because it may be a real tap-target problem on phone. scrollBefore 4101. |
| Places tile place (/places/moroni) | phone | 1828 | 0 | 826 | 7349 → 9606 | true | Scroll lands 2257px (2.7 screens) past where the reader was. Doc height went from 10851 to 17472 and tiles from 26 to 46 because batches were refetched and binned differently. The clicked link happens to sit at y=52. Back control at y=1637 (about 2 screens down). |
| Places tile view-all (/places) | phone | 890 | 0 | 1360 | 12776 → 13200 | true | The worst context loss measured. Infinite tiles dropped from 66 to 46, and the clicked link is now at viewport y=-9980 (about 11.8 screens above the reader). Scroll is restored by number (12776→13200) into unrelated content. /places has no back control. |
| Matters tile matter (/matters/sackcloth-and-ashes) | phone | 548 | 0 | 939 | 1656 → 1705 | true | Scroll restored within 49px (steps: 464, then 1705). The clicked link is now at viewport y=4889, about 5.8 screens below where it was. Back control at y=1465 (1.7 screens down). |
| Matters tile view-all | phone |  |  |  |  →  |  | NOT MEASURED: Home load timed out during ERR_NETWORK_CHANGED churn. The same /matters/&lt;group> to Not found routing applies on phone (route table is shared). |

| Page | Sev | Crit. | Defect | Evidence | Fix |
|---|---|---|---|---|---|
| /matters/:group (Matters tile view-all) | P0 | C4/D5 | The Matters tiles' 'view all' cards (e.g. +191 Matters) open a 'Not found' page. | Desktop: click on .tile-mattersConcept a.viewAllCard went to /matters/concepts and rendered 'Not found' + '❮ Matters' (docs/audits/home-discover-audit-2026-10-15/tiles/dest-s3/desktop-matters-viewall-2-dest-settled.png). Cause: Routes.js:269-275 registers /matters/:matterSlug → &lt;EntityPage type="matters"> before /matters, and no route sends the group keywords to Matters. Matters.js:23-27 says 'these keywords are intercepted before the slug is treated as a popup target', but nothing does that interception. Targets come from MattersConceptTile.js:13 ('/matters/concepts') and MattersNarrativeTile ('/matters/narrative'); the material tile presumably uses the same pattern. | Add an explicit route for /matters/:group(narrative\|material\|concepts) → Matters ahead of /matters/:matterSlug, or have EntityPage(matters) hand group keywords to Matters. Add a route test. |
| /home (return from People/Places/Matters) | P1 | E1/E2 (S3 quantified) | Back puts the reader back at a similar scrollY, but the content there is different, so restoring the scroll number does not restore their place. The clicked item ends up 1.7 to 11.8 screens away. | In every run the first 15 tiles' order differed after Back. Distance of the clicked link from its pre-click viewport position (~450-520px): desktop places 518→1211, places view-all 497→3372, matters 490→-1537; phone places view-all 419→-9980 (infinite tiles 66→46), matters 439→4889, places scroll 7349→9606 (doc 10851→17472). Desktop matters before/after screenshots at the same y≈3300 show unrelated tiles, and the Matters·Material tile's items changed (desktop-matters-matter-0-before.png vs -3-back.png). Only the People tile (pinned at grid top) survives the trip, because its face sample is stable (amlici in every run). | Same as R1 E1/E2: persist the shuffle order, per-tile samples and the revealed batches per session and rehydrate on POP. Or keep Home mounted (route-backed modal, S5), which makes this whole cost disappear. |
| /home (return) | P2 | E1 | Scroll restoration is delayed and done in steps. Home first paints at the top, then jumps once or twice about 1-1.5s later. | scrollY right after Home became usable vs at 1.5s: desktop places 2→1092; places view-all 2→3055→3410; matters 1054→3349; phone places 2→9745→9606; phone matters 464→1705; phone people 2→3690. backUsableMs (826-1522ms) is about the same as or more than the forward toContentMs (276-1828ms), so the return trip costs as much as leaving. | Restore only after the rehydrated layout is final (or render from a cached snapshot synchronously). Hide the feed until the restore lands so the reader never sees the top-then-jump. |
| /people/:slug, /places/:slug, /matters/:slug | P1 | D3 | The only return control is a '❮ People/Places/Matters' link at the bottom of the page. It is below the fold on desktop person pages and 1.7-2.7 screens down on phone, and it goes to the index page, not back to Home. | backCtl viewportY / viewport height: desktop person 1055/900; phone person 2288/844, place 1637/844, matter 1465/844 (phone-people-person-1-arrival.png shows no return control on the first screen). EntityPage.js:67-71 renders it after the body as a plain &lt;a href={cfg.base}> (not a router Link), so it likely triggers a full reload (from code, not measured). | Put a top back control that calls history.back() when the referrer is in-app (Home) and otherwise links to the index, and use the router Link. |
| /people, /places | P2 | D3 | The index pages reached from the tiles' 'view all' cards have no back or return control at all. | backCtl=null for people-viewall and places-viewall at both viewports (no .entity-page-back or equivalent). | Use the same header back affordance as on the entity pages. |
| /people/:slug (phone) | P2 | D4/F | On phone, the person page loses tile continuity: the tile showed a face, the page opens on a bare name with no image. The bottom nav also highlights 'Study' on a person page. | phone-people-person-1-arrival.png: 'Amlici' heading, subtitle, then prose. The Study tab is shown active. | Show the portrait above the fold, and map entity routes to the correct nav tab (or none). |
| /home → People tile view-all (phone) | P2 | F2/C1 | An automated tap on the People 'view all' card at 390px never became actionable (30s timeout) even though the locator resolved. It may be obscured or never stable. | scratchpad/dest/s3-phone-people.json people-viewall: locator.click Timeout 30000ms on &lt;a class="peopleFaceCard samplerCard viewAllCard" href="/people">, at viewport y=451. | Tap-test manually. Check for an overlay or animation over the card (Playwright reports either 'intercepts pointer events' or 'not stable'). |

### S4 Popup fitness

Method: Read the entity bodies the app renders (frontend/webapp/src/views/_Common/entity/PersonBody.js, PlaceBody.js, MatterBody.js, Relationships.js, ReferenceList.js, XrelSection.js, EntityThumb.jsx) to find what makes a page long. Each body has a prose description, one hero image (EntityThumb), person `relations` cards with avatars, xrel cards with thumbnails, the `index` reference list and, for places, a `maps` button list. I then fetched the full population, not a sample, with one bulk POST per type to http://localhost:8201/graphql/en, using the same field shapes as GraphQLQueries.js (person/places/matter): 435 people, 188 places, 476 matters. Bulk results match single-slug results (nephi1 gives 84 refs, 114 xrels and 13 relations both ways; cannibalism-in-war gives 2 and 3). Word counts come from the description HTML after stripping tags and reducing {Name\|slug} and [Name\|slug] tokens to their display text. Refs is the length of `index`, which is the rendered References list. Related is relations plus xrels, i.e. the number of rendered cards. Rendered images are 1 hero plus one per relation avatar plus one per xrel card that has a thumbnail. To check hero images I sent a HEAD request to https://media.bookofmormon.online/{type}/{slug} for all 1,099 entities. All returned 200 and every ETag was unique, so every entity has its own hero image and none is a shared placeholder. The EntityThumb.jsx comment saying "314 of 487 are placeholders" is out of date. Scratch files (people.json, places.json, matters.json, img.txt, stats.py, stats.json) are only in /tmp/claude-1003/-home-bom-BookofMormonOnline/524d9f80-ee41-4628-b4a6-fb0690560be9/scratchpad/dest/. Nothing was written to the repo.
Fit definition: An entity fits a compact popup when its body is 250 words or fewer, it has 8 or fewer references in its References list, and it has 8 or fewer related cards (relations plus xrels), with its 1 hero image. Every entity has exactly one hero image, so images never decide the result. I also report a looser "scrollable popup" tier: 400 words or fewer, 15 refs or fewer, 12 related or fewer. Overall, 70.5% of all 1,099 entities fit the compact definition (775 of 1,099) and about 89% fit the loose one. The rest are a small set of heavy hubs (major prophets, peoples, macro-regions, common material objects) whose pages run to dozens or hundreds of references and cards.

| Type | Count | Median words | p90 words | Max words | Median refs | Share fits popup | Largest | Sparse | Notes |
|---|---|---|---|---|---|---|---|---|---|
| people | 435 | 194 | 372 | 724 | 3 | 0.595 | nephi1 (469 words, 84 refs, 127 related cards, 128 images); alma2 (724 words, the maximum; 104 refs; 59 related); mormon2 (519 words, 24 refs, 100 related). Also lamanites (647 words, 124 refs, the most refs). | com-prophets (34 words, 1 ref, 0 related, the only person under 40 words); shez2 (51 words, 1 ref); emron (51 words, 1 ref). jeberechiah has 54 words and 1 ref. 10 people have 0 related, but PersonBody still renders the 'Relationships' heading. | Refs: median 3, p90 20, max 124. Related cards: median 3, p90 11, max 127. Rendered images: median 4, p90 12, max 128. Paragraphs: median 2, max 7. Inline entity links in the prose: median 17. Words is the binding constraint: only 66.7% have 250 words or fewer. 78.9% have 8 refs or fewer and 83.7% have 8 related or fewer. Loose tier: 84.6%. Person xrels point only to matters (826 rows), and 327 of 435 people have no xrels. Outliers are major figures and groups filed as people (lamanites, saints-of-the-church), plus a 'com-prophets' record whose community-style slug sits in the people table. |
| places | 188 | 158.5 | 319 | 516 | 1 | 0.793 | jerusalem-1 (334 words, 74 refs, 12 related); land-of-nephi (516 words, the maximum; 46 refs; 14 related; 18 maps); promised-land (459 words, 43 refs, 13 related, 0 maps). Also zarahemla (16 related, the most), and narrow-neck and land-of-zarahemla (18 maps each). | siron (52 words, 1 ref, 0 related); cavity-of-a-rock (55 words, 2 refs, 0 related); elam (64 words, 1 ref, 0 related). Also mount-zerin and midian (64 to 65 words, 1 ref, 0 related). | Refs: median 1, p90 7, max 74. Related cards: median 0, p90 2, max 16 (places have no `relations`, only xrels to matters). Rendered images: median 1, max 17. Maps: median 4, p90 11, max 18. 181 of 188 places have at least one map; 7 have none. Loose tier: 93.6%. The typical place page is about 160 words, one image, one reference and no relationships, so it is popup-sized. 152 of 188 (81%) have no relationship cards at all. The real long-content risk on a place is not prose but the map chooser: 'View on map' expands to one button per map, up to 18 stacked buttons. |
| matters | 476 | 93.5 | 153 | 228 | 3 | 0.771 | swords (136 words, 123 refs, 16 related); houses (141 words, 74 refs, 12 related); flocks (159 words, 65 refs, 15 related). ornaments and tents have the most related cards (23 each); jaredite-barges is the wordiest (228). | antion (22 words, 1 ref); shiblum (24 words, 2 refs); bees (26 words, 3 refs). oaks-of-bashan and coriantumrs-throne have 29 words and 1 ref each. liahona has 33 words of prose against 16 refs and 14 cards: a thin description on a central object. | Refs: median 3, p90 12, max 123. Related cards: median 4, p90 10, max 23. Rendered images: median 4.5, p90 9, max 22. Every matter is under 250 words (max 228). The binding constraint is references (86.6% have 8 or fewer) and related cards (82.8% have 8 or fewer). Loose tier: 91.4%. Reference rows are the wordiest of the three types: median 9 words, max 47, full-sentence glosses where people and places use short labels. Matter descriptions contain 0 inline entity links, while people have a median of 17, so the two prose templates are inconsistent. 52 matters have 0 xrels, and because MatterBody passes showEmpty they render a stub line, 'No relationships.' 12 matters have under 40 words. |

| Page | Sev | Crit. | Defect | Evidence | Fix |
|---|---|---|---|---|---|
| /people/:slug, /places/:slug, /matters/:slug | P2 | S4 | Most entities are popup-sized. 70.5% of all 1,099 fit a compact popup (people 59.5%, places 79.3%, matters 77.1%) and about 89% fit a scrollable one. A heavy tail of hub entities does not fit any popup, so one mechanism for all entities either cramps the hubs or wastes a full page on the typical small entity. | Bulk GraphQL pull of all 435/188/476 entities from localhost:8201/graphql/en. Median body is 194/158/94 words, median refs 3/1/3, median related cards 3/0/4. The tail: nephi1 has 127 related cards and 128 images; alma2 has 724 words and 104 refs; lamanites has 124 refs; swords has 123 refs; jerusalem-1 has 74 refs. Data is in scratchpad/dest/stats.json. | Use a route-backed modal by default, with the canonical URL and SSR on direct load. The infrastructure already exists: EntityPage.js:40-45 says in-app clicks open a modal over the current view via routeHistory. Inside the modal, cap References at about 8 and related cards at about 8, each with a 'See all N →' link to the full page. Only hub entities would then need the full page, and the modal never becomes a 100-card scroll. |
| /people/:slug | P1 | S4 | Hub people render unbounded card grids and reference lists in the refbox column. nephi1 has 127 relationship cards, each with its own image request, plus 84 references. In a popup this means an extremely long internal scroll and more than 100 image fetches. | nephi1: 13 relations + 114 xrels = 127 cards and 128 images. mormon2: 100 related. alma2: 104 refs. Relationships.js and XrelSection.js render every row with no cap. ReferenceList.js renders every index entry. | Cap visible cards per xrel verb group (XrelSection already groups by verb and shows a count) at 4 to 6, with 'show all'. Cap ReferenceList at about 8 in compact mode. Lazy-load related thumbnails (loading="lazy"). |
| /matters/:slug | P2 | D5 | 52 of 476 matters (11%) render a stub 'No relationships.' line under a Relationships heading, which reads as half-baked. | MatterBody.js:51 passes `showEmpty` to XrelSection. XrelSection.js:150 renders `&lt;p className="xrels-empty">No relationships.&lt;/p>`. 52 matters have xrels=0 in the bulk pull. | Drop showEmpty, matching people and places, which hide the empty section, or populate xrels for those 52. |
| /people/:slug | P2 | D5 | 10 people have no relations and no xrels, but PersonBody always renders the 'Relationships' h4, so the heading sits over nothing. | PersonBody.js:46 renders `&lt;h4>{label("relationships")}&lt;/h4>` unconditionally. XrelSection is noHeading (PersonBody.js:48) and returns null when empty. 10 of 435 people have related=0. | Render the heading only when relations.length plus xrels.length is greater than 0. |
| /places/:slug | P2 | S4 | The place 'View on map' control expands into one stacked button per map, up to 18, inside the image column. This is the longest element on most place pages and an unusual chooser pattern. | PlaceBody.js:63-75: showOptions maps place.maps to individual &lt;Button>s. Maps per place: median 4, p90 11, max 18 (narrow-neck, land-of-zarahemla, land-of-nephi). 7 places have 0 maps. | Open the most relevant map directly, with a compact dropdown or segmented 'Other maps (17)' menu, instead of an inline button stack. |
| /places/:slug | P3 | D5 | Place pages are thin on structure: 81% (152 of 188) have no relationship cards and the median place has 1 reference. As a full page they look sparse, which supports showing places as a modal or popup. | Places: related median 0, zero for 152 of 188; refs median 1, p90 7. Sparse examples are siron, cavity-of-a-rock and elam (52 to 64 words, 1 to 2 refs, 0 related). | Show places as a popup or route-backed modal. Separately, backfill xrels and references for the sparse places. |
| /matters/:slug | P3 | D5 | Some matters have very thin prose: 12 are under 40 words, and liahona has 33 words of prose against 16 refs. Matter prose also has no inline entity links, while person and place prose links names (median 17 and 12 per entity), so the prose experience differs by type. | Sparse matters: antion (22 words), shiblum (24), bees (26), oaks-of-bashan (29), coriantumrs-throne (29). Count of `{Name\|slug}` and `[Name\|slug]` tokens in descriptions: matters 0 for all 476, people median 17, places median 12. | Flag matters under 40 words for content backfill. Consider adding entity-link markup to matter descriptions so all three types behave the same. |
| /matters/:slug | P3 | S4 | The EntityThumb fallback comment claims most matters are placeholders, but every matter, person and place now has a unique hero image. The comment is stale and the gradient fallback is effectively dead for valid slugs. | EntityThumb.jsx comment: '314 of 487 are placeholders'. HEAD requests to media.bookofmormon.online/{type}/{slug} returned 200 with a unique ETag for all 1,099 entities (scratchpad/dest/img.txt). | Update the comment. For popup design, assume one real image per entity. |

### S1 Maturity, per entity type

#### people

Components: Index /people: frontend/webapp/src/views/People/People.js (PeopleComponent + PeopleFilters → _Common/FilterPanel), People.css; react-masonry-css. Entity /people/:personName: views/Entity/EntityPage.js (generic for people/places/matters/history, TYPES table) + EntityPage.css, data via _Common/entity/useEntityData.js; body _Common/entity/PersonBody.js → EntityThumb, Relationships.js, XrelSection, ReferenceList.js, renderPersonPlaceHTML (Page/PersonPlace). The same PersonBody serves the popup (PopUp.js chrome + MaximizeButton.js). Route wiring: models/Routes.js:249-254. Home entry: views/Home/tiles/PeopleTile.js, which uses Router &lt;Link to=/people/:slug>, so a tile click mounts EntityPage rather than the modal.

Gestalt: index craft 3 / beauty 3; entity craft 2 / beauty 3. Index: the portrait wall is striking at desktop and the filter bar is solid. But blank no-image cards, cramped wrapped headers, traffic-light/blue badges, 435 cards with no sort or end, and click-opens-popup make it a gallery more than a tool. Entity: the description typography and portraits are good and the content is real. But it is the popup body poured onto a page: H3 instead of H1, dead gaps around a faint subtitle, back link at the very bottom, empty headings on sparse entities, a 6,000px rail beside an empty column on rich entities, and a squeezed half-width column on phone. That is a page that works but was not designed as a page.

Sampled: alma2 (rich: description 4,445 chars, 27 relations, 32 xrels, 104 references; the maximum on every axis among 435 people), ammaron (median: 1,288 chars, 3 relations, 1 xrel, 4 refs, exactly the median description), com-prophets (sparse: 257 chars, the minimum; 0 relations, 0 xrels, 1 ref). Volume stats from GraphQL over all 435 people: description p25/50/75 = 849/1288/1863 chars; relations median 3 (max 27, 10 people have 0); references median 3, p75 7, max 124; xrels 0 for over 75% of people. Captured: desktop 1440 and phone 390 fold + full for index and all 3 entities (phone index blank, see finding). Not captured: tablet, dark mode and the live Home-tile click-through (D4). The session's Bash tool started refusing all commands mid-audit (worktree-isolation guard), so those parts rest on code reading.

<details><summary>Anatomy</summary>

ENTITY /people/:slug (desktop 1440, .entity-page max-width 62rem, two-column .ppbody): 1. App chrome: dark top header + left nav rail (People highlighted). There is no breadcrumb and no back control at the top. 2. LEFT .bodytext (634px): H3 name (with superscript disambiguator) → about 95px gap → small italic light-gray subtitle (title/epithet) → about 70px gap → description paragraphs with bold inline entity names and grey serif scripture-ref pills. 3. RIGHT .refbox (288px, dotted left rule): rounded square portrait → H4 "Relationships" (2-up grid of relation-text + 65x78 avatar) → XrelSection groups ("… Owned by", "Wielded by", "Taught by" … small image cards with name + note) → H4 "References" (numbered ol of index entries; 104 items for alma2). 4. Back link "❮ People" (plain &lt;a href="/people">, gold underline) after both columns, at the very bottom of the page. Phone 390: same order, single column: header (with 0.0%/0.0% pill) → H3 name → subtitle → description → refbox shoved into a narrow indented column (149px wide at x=44) holding portrait, relationships, xrels, references → back link at the bottom → fixed bottom tab bar (Groups/Home/Study/User/More, with Study wrongly active). INDEX /people: app chrome → centered H3 "People in the Book of Mormon" → FilterPanel bar (Social Identification / Social Classification / Social Unit dropdowns, search icon, "435 Results", Clear All, expand ⤢) → react-masonry-css grid (8/7/6/5/4/3/2 cols by breakpoint) of 435 fixed-height (18em) person cards. Each card: header (unit icon + name), body (CSS background-image portrait, date chip top-right, dark title overlay at bottom), grey footer (affiliation badge pill + classification icons). No pagination, sort control, alphabet jump or end state; all 435 render at once (desktop doc height 16,996px).

</details>

| Page | Sev | Crit. | Defect | Evidence | Fix |
|---|---|---|---|---|---|
| /people/:slug | P1 | D3 | The only back/return control is at the very bottom of the page, after both columns | EntityPage.js:127 renders {backLink} after &lt;cfg.Body>. Measured backY: alma2 6115px desktop / 12779px phone (doc 6198 / 12862); ammaron 798 desktop / 1584 phone; com-prophets 529 / 778. The back link is never above the fold on phone, and on a rich page it is 14 phone screens down. Screenshots dest-people/desktop-alma2-full.png, phone-alma2-full.png, phone-ammaron-full.png. | Move a breadcrumb-style '❮ People' above the H1 (sticky on phone, or in the header slot). Keep the bottom one as a secondary link if wanted. |
| /people/:slug | P1 | F1 | On phone the right column (portrait, relationships, xrels, references) collapses into a squeezed 149px half-width column | Measured refbox {x:44, w:149} inside a 330px content width on every phone sample (alma2 refbox height 10,882px at 149px wide). phone-ammaron-full.png: the 'Plates of Nephi' xrel card wraps one word per line and the right half of the screen is empty. The cause: EntityPage.css sets .refbox flex: 0 1 18rem, which becomes the flex-basis height-wise under flex-direction:column, and the popup's own refbox width/margins still apply. | In the ≤700px block, set .entity-page .ppbody .refbox { flex: none; width: 100%; margin-left: 0; border-left: 0 }. Render the portrait at the top beside or under the name rather than after the body text. |
| /people/:slug | P1 | D5 | Rich entities become a 6,000px sidebar: the refbox runs 3x longer than the body text, leaving a vast empty left column | desktop-alma2-full.png: body text ends around y≈1900, but refbox height is 6,009px (xrel groups plus a 104-item References ol). From about y=2000 to 6100 the 634px left column is blank and everything is crammed into a 288px rail. Content volume across all 435 people (GraphQL): index refs median 3, p75 7, max 124; relations max 27; xrels max 114. | Move References and the xrel groups to full-width sections below the description (or into tabs), collapse long lists ('Show all 104'), and keep only the portrait and relationships in the rail. |
| /people/:slug | P1 | G1 | Relationship rows are divs with onClick, and reference items are &lt;a> elements with no href, so neither is a link, keyboard-reachable or openable in a new tab | Relationships.js:131-133 (&lt;div style={{display:flex}} onClick=…>). ReferenceList.js:175-178 (&lt;a className="ppref" onClick=…> with no href). Measured on alma2: 27 div-onClick relationship rows and 124 visible &lt;a> elements without href (ammaron 3 / 8). | Render relationships as &lt;Link to={`/people/${slug}`}> and references as &lt;a href> to the read/verse URL, or as &lt;button> if they open a popup. Add a focus style. |
| /people | P1 | D5 | Many index cards are blank white boxes (no portrait) above the fold | desktop-index-fold.png, 3 seconds after cards rendered: Lehi¹, Laman¹, Ishmael¹, Ishmael's Daughter, Nephites and Jacob² cards show an empty white image area with only the title overlay. Portraits are CSS background-image (People.js:158). There is no loading placeholder or onError fallback, and brokenImgs detection can't see backgrounds. Not determined: slow load of 435 x 1024px images vs missing assets (a later curl check was blocked). | Use &lt;img loading=lazy> with a sized thumbnail variant, a neutral placeholder tint, and the same data-URI fallback used elsewhere for missing portraits. Verify the media host for the blank slugs. |
| /people | P1 | C4 | Index card clicks open a popup while Home tiles and direct loads open the full page: two presentations for the same URL | People.js:81-85 and 153: &lt;Link to=/people/slug onClick={e => {e.preventDefault(); setPopUp(...)}}>, so the index opens the modal. PeopleTile.js uses plain Router &lt;Link to=/people/slug>, which mounts EntityPage (Routes.js:249). The EntityPage.js:40-43 comment says in-app clicks never mount the page, which is no longer true for Home tiles. | Pick one presentation per the S5 recommendation. If route-backed modal: Home tile and index both open the overlay, and direct load or new tab gets the page. Update the EntityPage comment either way. |
| /people | P1 | F1 | Phone /people did not render in either of 2 attempts (blank white screen after 30s); needs recheck | phone-index-fold.png is fully blank (7KB) on both runs. Waiting for .personCard timed out at 30s, with repeated net::ERR_NETWORK_CHANGED. Desktop /people also failed once in run 1 and then rendered in 2.2s, so this may be network flakiness rather than a defect. Treat as PLAUSIBLE, not confirmed. | Re-capture phone /people. If reproducible, check that the personList fetch in render (People.js:66) isn't racing or failing silently with no error state. Add an error/retry state either way (the spinner currently spins forever on failure). |
| /people/:slug | P2 | D5 | Empty 'Relationships' heading renders with nothing under it for people who have no relations | PersonBody.js:46 renders &lt;h4>Relationships&lt;/h4> unconditionally. desktop-com-prophets-fold.png and phone-com-prophets-full.png show a bare 'Relationships' heading directly above 'References'. Affects 10 of 435 people (relations count 0). | Render the heading only when relations?.length > 0, and do the same for References and the xrel groups. |
| /people/:slug | P2 | A3 | The title block reads as a stub: huge dead gaps around a faint italic subtitle, and the page has no H1 | desktop-ammaron-fold.png: H3 at y=72, subtitle at about y=235 and body at about y=320 (2x CSS px). That leaves about 95px between name and subtitle and about 70px more before the text. phone-com-prophets-full.png: the title plus gaps use the first 280px of the screen. Measured h1: [] on every people page; the entity name is an &lt;h3> (PersonBody.js:27), from the popup markup. | Make the name an &lt;h1>, put the subtitle directly under it at body-meta size (≤8px gap), and drop the &lt;br/>+&lt;small> construct. Consider putting the portrait beside the title on phone so the fold carries identity. |
| /people/:slug | P2 | A4 | Subtitle and meta text fail contrast: light gray #aaa on #eee background (about 2.0:1) | Computed colors include rgb(170,170,170) for .ppbody-title against the #eeeeee page ground (contrast ≈ 2.0:1, AA needs 4.5:1). Visible as 'Nephite record keeper' in desktop-ammaron-fold.png. | Use the house neutral gray at ≥#6b6b6b (the value art-page-artist already uses in EntityPage.css:208). |
| /people/:slug | P2 | F1 | Phone bottom tab bar highlights 'Study' while the reader is on a People page | phone-alma2-fold.png, phone-ammaron-full.png and phone-com-prophets-full.png all show the 'Study' tab active in dark navy. | Map /people, /places and /matters to the More tab (or to none) in the tab-bar active-route logic. |
| /people/:slug | P2 | G3 | Inline description and xrel thumbnails have generic alt text 'people' / 'places'; full 1024px images are served into 65x78 slots | Measured on alma2 and ammaron: img alt='people' (src …/people/alma1, nephi3 …) and alt='places' (land-of-zarahemla). naturalWidth 1024 rendered at 65x78, so about 16x oversampling at DPR 2 and 30+ such images on alma2. | Use the entity name for alt (or empty alt when the name is adjacent), and request a thumbnail size variant from the media host. |
| /people/:slug | P2 | M2 | Runtime errors on every people page load | Captured on all 6 entity loads: 'pageerror: SyntaxError: Unexpected token '&lt;'' (HTML parsed as JSON) and the React warning 'activeClassName' unknown prop (router-7 leftover NavLink). Same pair as R1. | Find the JSON.parse of an HTML response (likely a missing asset or API fallback to index.html), and replace activeClassName with a className function on NavLink. |
| /people | P2 | B4 | The data fetch fires from the render body, has no error state, and logs a React warning | People.js:66-68: `if (!peopleList) BoMOnlineAPI(...).then(setPersonList)` runs during render, so it can issue duplicate requests. Captured console error: 'Can't perform a React state update on a component that hasn't mounted yet'. There is no catch, so a failure leaves the spinner forever. | Move the fetch into useEffect with a catch and an error/retry UI. Reuse appController.preLoad.personList, which is already loaded (People.js:184). |
| /people | P2 | A1 | Masonry over fixed-height cards: uneven headers shrink portraits, a 435-card wall with no sort, grouping or end | desktop-index-fold.png: header wrap (e.g. 'Twelve Disciples of Christ', 3 lines) eats the 18em card, so the 'Jerusalem Prophets' portrait is cut to a thin strip with white below it. Doc height 16,996px desktop. Order is unexplained (narrative order). There is no A–Z, era or sort control. | Use a CSS grid with uniform card anatomy (fixed image aspect, name clamped to 2 lines under the image). Add sort (A–Z / narrative / era) and group or section headers. Lazy-render or paginate. |
| /people | P2 | A4 | Affiliation badges use stray blue and traffic-light colors outside house palette | People.css:33-37 Lamanite badge #084298 text on #c3dbff (blue); also green N, red G, orange M (lines 26-65). Visible as blue 'Lamanite' pills in desktop-index-fold.png. House style: neutral gray, gold #c9a24b sole accent, no blue. | Make badges neutral gray outline chips, and encode affiliation with a small dot or icon if color is needed, in a muted earth palette agreed as house style. |
| /people | P2 | G1 | Filter search builds a RegExp from raw user input | People.js:127: new RegExp(peopleFilters.search, 'gi'). Typing '(' or '[' throws a SyntaxError during render. | Escape the input, or use case-insensitive includes(). |
| /people/:slug | P3 | E4 | The back link is a plain &lt;a href> and forces a full SPA reload back to /people | EntityPage.js:69 uses &lt;a href={cfg.base}> rather than &lt;Link>, so returning to the index reloads the bundle and refetches 435 people, and the index scroll position is lost. | Use &lt;Link to={cfg.base}>, or navigate(-1) when history came from the index, so the index scroll position is restored. |
| /people | P3 | A7 | Card footer shows meaningless empty-circle icons and a desktop H3 page title | desktop-index-fold.png: most footers end in an empty circle glyph (the 'other' classification icon at 50% opacity, People.css:108-112), which reads as an unchecked radio. Page title is an &lt;h3> (People.js:145); measured h1: []. | Hide the 'other' icon, give the icons tooltips/labels, and make the page title an &lt;h1>. |
| /people/:slug | P3 | D4 | Continuity from Home tile not live-verified; code shows the tile lands on the full page with matching name and portrait but no context back to Home | PeopleTile.js: Router &lt;Link to=/people/slug> (featured and face cards) mounts EntityPage. The page shows the same name (H3) and portrait (right rail, desktop; below the text on phone), so identity carries over. The only return control is '❮ People' at the bottom, which points to the index, not Home. Live click-through capture was blocked when the session's Bash tool was disabled mid-audit. | Re-run the click-through. Give the destination a top-left return that honors the origin (Back to Home when referrer is /home). |

#### places

Components: Index /places: frontend/webapp/src/views/Places/Places.js (PlacesComponent + PlaceFilters → _Common/FilterPanel), Places.css + borrows ../People/People.css; react-masonry-css grid of reactstrap Cards; card click is a &lt;Link> whose onClick preventDefaults and calls appController.setPopUp (modal "Location Profile" via PopUp.js). Entity /places/:slug (and legacy /place/:slug): views/Entity/EntityPage.js type="places" (shared template with people/matters/history) → _Common/entity/useEntityData.js (GraphQL `places`) → _Common/entity/PlaceBody.js (same body the modal uses) + XrelSection + EntityThumb + ReferenceList; EntityPage.css. Ambiguous slug → PlaceChooser/EntityChooser. Home entry points: views/Home/tiles/PlacesTile.js and PlaceProfileTile.js (react-router &lt;Link> to /places/:slug, /places, and /map/internal/place/:slug which mounts views/Map/Map.js via the /map/* splat in models/Routes.js:294). Routes: models/Routes.js:257-266.

Gestalt: index craft 3 / beauty 4; entity craft 2 / beauty 3. Index: the painted art gives it real presence and the filter bar is tidy, but the cards are busy (overlay strips colliding with map labels, wrapping badges), the list fetch is fragile, and the phone version is an unbroken 28k-px wall. Entity page: honest prose and nice imagery, but it reads as the popup body dropped onto a page: weak h3 title with a dead gap, faint subtitle, foreign gray scripture pills, a debug-looking '… Located in 13' section, a 46-row reference dump, a literal '&lt;sup>1&lt;/sup>' leak, no facets, and the only way back buried at the bottom.

Sampled: Distribution from GraphQL `place` (188 places, all slugged; median description 1,015 chars, median 1 index ref; 7 have no maps). Rich: land-of-nephi (3,322-char description, 46 references, 14 xrels, 18 maps). Median: valley-of-alma (1,009 chars, 2 refs, 1 xrel, 6 maps). Sparse: cavity-of-a-rock (366 chars, 2 refs, 0 xrels, 1 map). Captured: desktop 1440 index fold/full/card, index card-click (modal), and fold/full for all three entities, with CLS and errors (dest/capture-desktop.json). Phone 390 index fold captured (phone-debug-phone-index.png). NOT captured: phone/tablet entity pages, tablet index, dark mode, arrival-by-clicking-the-Home-tile, and /map/internal/place/:slug. The phone and tablet runs timed out waiting for the index cards (see the P1 index finding). After that, the session's Bash tool started refusing every command with a worktree-isolation error ('session is isolated in the worktree …/.claude/worktrees/home-page-p1s'), so no further Playwright runs were possible. Those checks should be re-run. Data oddities worth noting: names 'Land of Bountiful1/2', 'Jerusalem1/2' carry digit suffixes (rendered as superscripts); valley-of-nimrod's name is 'Gathering place for Jaredites'.

<details><summary>Anatomy</summary>

ENTITY /places/:slug (desktop, top→bottom): [app chrome: fixed dark header + left nav] → two-column flex .ppbody (max 62rem): LEFT .bodytext = h3 title (light weight, no h1) + &lt;br> + small gray italic `info` subtitle (large dead gap between them) → description prose with bolded entity names and inline serif gray scripture "pills" (Parser of renderPersonPlaceHTML). RIGHT .refbox (18rem) = gray "VIEW ON MAP" button (expands to N map buttons if >1 map) → rounded square image (EntityThumb) → "Relationships" (XrelSection, grouped by relation, e.g. "… Located in 13" then cards with thumb+name+gloss; absent when no xrels) → "References" h4 + ordered list of index events (text only, refs only in tooltip). → BOTTOM: "❮ Places" text link (only return control). NOT shown although fetched/available: occupants badges, greater-locale, geo type (all present on the index card). Phone (≤700px): same, columns stack (body text first, then map button/image/relationships/references), back link last. INDEX /places: dark chrome → centered H3 "Places in the Book of Mormon" → FilterPanel bar (Occupants / Greater Locale / Geo Type dropdown pills, search icon, "188 Results", Clear All, expand icon; on phone collapses to a gray "SELECTORS" button + search icon) → masonry of 188 fixed-height (19em) cards, 7 cols @1440 / 2 cols @390: card = name header → background-image body with translucent white "Old World"-style locale strip at top and dark caption (info) at bottom → gray footer with occupant badges (left) + geo-type icon (right). No pagination, no intro, no footer; all 188 render at once (phone docH 27,997px).

</details>

| Page | Sev | Crit. | Defect | Evidence | Fix |
|---|---|---|---|---|---|
| /places/:slug | P1 | D3 | The only return control ('❮ Places') sits at the very bottom of the page, below all prose, relationships and references; on rich places it is 2.8 screens down. No back affordance near the title on any viewport. | EntityPage.js:362-366,413-424 (backLink rendered after Body). Measured desktop 1440x900: land-of-nephi back link y=2561 (docH 2644, viewport 900); valley-of-alma y=668; cavity-of-a-rock y=553. Screens: dest-places/desktop-rich-full.png, desktop-rich-fold.png (no back control visible). | Move the return link above the title (breadcrumb 'Places ›' or ❮ Places at top-left of .entity-page), keep the bottom one as secondary; when arriving from Home, label it '❮ Home' / use history.back(). |
| /places/:slug | P1 | A7 | Raw HTML leaks into the prose: 'Alma&lt;sup>1&lt;/sup>' renders literally on the Valley of Alma page. | dest-places/desktop-median-fold.png first line: 'where Alma&lt;sup>1&lt;/sup> and his people camped'. Description goes through detectScripturesPreservingTokens → renderPersonPlaceHTML (PlaceBody.js:468-472); the escaped sup inside an entity token is not re-parsed. | Normalise superscript markers in the entity-name token path (render the token's name through the same name→&lt;sup> replacement used for the title, PlaceBody.js:458-461) and add a data scan for literal '&lt;sup>' in place descriptions. |
| /places | P1 | M/B4 | Index fetches its list inside render (no effect), triggering React's 'state update on a component that hasn't mounted yet' warning; under load the setState can be dropped and the page sits on a spinner indefinitely. | Places.js:63-66 (`if (!PlaceList) BoMOnlineAPI({placeList:true}).then(setPlaceList)` in the render body). Warning captured on every index load (capture-desktop.json errors). Both phone and tablet runs (run concurrently) waited 90s for `.PlaceList .card` and timed out (dest/log-p.txt, log-t.txt), while an isolated phone load rendered 188 cards in 5.9s — consistent with a lost update; not proven deterministic. | Move the fetch into useEffect with a cancelled flag (or read appController.preLoad.placeList which already exists, Places.js:213) and render an error/retry state on failure. |
| /places/:slug | P2 | D5 | The entity page drops the place's own classification: occupants, greater locale and geo type are fetched and shown on the index card, but absent from the detail page — the detail is less informative than its own card. | GraphQLQueries.js places query fetches occupants/type/location (lines 74-79); PlaceBody.js renders only name, info, description, maps, xrels, index. Compare dest-places/desktop-index-card.png (Old World / Israelites / type icon) with desktop-sparse-fold.png (none). | Add a facet row under the subtitle (locale · occupants badges · type icon), linking each back to /places with that filter applied. |
| /places/:slug | P2 | A3 | Title block is clumsy: light-weight h3 title, then a ~60px dead gap, then a faint gray italic one-liner; nothing anchors the page as a place (no type, no locale, no small map). | desktop-rich-fold.png, desktop-sparse-fold.png: title at y≈140 (display px), subtitle at y≈235 with empty band between. PlaceBody.js:456-466 uses &lt;h3>&lt;span/>&lt;br/>&lt;small/>&lt;/h3>. | Use an h1 for the name, place the info line directly beneath at body size in neutral #555, and remove the &lt;br>/margin gap. |
| /places/:slug | P2 | A4 | Subtitle and relationship glosses are low-contrast light gray; inline scripture pills are tiny gray serif boxes inside sans prose, below AA and typographically foreign. | desktop-rich-fold.png: subtitle 'Land established by Nephi…' and pills 'Alma 22:27' visibly faint (~#aaa on #eee); relationship glosses light gray on white. Link color audit: 14 links at rgba(50,59,77,0.667) on rich page (capture-desktop.json linkColors). | Raise secondary text to ≥#595959 on #eee; restyle pills in the body font at 0.85em with a darker text color, or as plain black ref links with a gold underline per house style. |
| /places/:slug | P2 | G1 | Interactive elements are not real links/buttons: scripture links and References items are &lt;a> with no href (keyboard-unreachable, no new-tab), relationship rows are divs with onClick. | noHref probe: rich page 8+ a.scripture_link, median/sparse a.ppref items without href (capture-desktop.json). ReferenceList.js:395-401 (&lt;a onClick> no href); Relationships.js:351-354 (div onClick). | Give scripture/reference anchors real hrefs (/read/... permalinks) and render them as &lt;a href> or &lt;button>; make relationship rows &lt;a href='/places\|people\|matters/slug'>. |
| /places/:slug | P2 | G1 | Heading semantics are wrong: page has no h1; the name is h3, sections are h4. | Heading probe (capture-desktop.json): ['H3:Land of Nephi…','H4:Relationships','H4:References']. | h1 for the entity name, h2 for Relationships/References. |
| /places/:slug | P2 | D5 | Relationships section is half-baked: header '… Located in 13' (leading ellipsis + bare count) reads like a debug label, and the direction is confusing (lists Walls/Barley/Wine-Press as 'located in' the land); References is a 46-item list of terse event captions in small text with refs only in a hover tooltip. | desktop-rich-fold.png and desktop-rich-full.png right column; desktop-median-fold.png '… Located in'. | Rewrite group labels as sentences ('Things found here (13)'), collapse long lists after ~6 with 'Show all', show the verse reference beside each References item. |
| /places/:slug | P2 | M2 | Runtime errors on every place page: 415 from /graphql (median and sparse), uncaught 'SyntaxError: Unexpected token &lt;', React unknown-prop activeClassName. | capture-desktop.json errors for desktop-median and desktop-sparse: 'http 415: http://localhost:8201/graphql', 'pageerror: SyntaxError: Unexpected token '&lt;''. | Find the request sending a non-JSON content-type (415) and the HTML-as-JSON parse; likely the same fetch. Remove activeClassName from the NavLink. |
| /places | P2 | A7 | Index title document.title stays the generic 'Book of Mormon Online' — label() not loaded when the empty-deps effect runs. | capture-desktop.json desktop-index title='Book of Mormon Online'; Places.js:43 useEffect(..., []). | Depend on dictionary readiness (or use the text() fallback helper from EntityPage.js:326) for the title. |
| /places | P2 | A1 | Card overlays collide with the art: the translucent white locale strip ('Old World') sits on top of every image and clashes with map-style images' own labels; long names squeeze the image. | desktop-index-fold.png Judah card: 'Old World' over 'Israel' map label; phone-debug-phone-index.png same. Places.css:187-201. | Move locale to the footer as a badge (or a small caption under the name), keep the image clean; cap name to one line with ellipsis so image heights stay uniform. |
| /places | P2 | F1 | Phone index is a 28,000px wall of 188 cards with no pagination, grouping, or jump/back-to-top; masonry grid is offset (2em left margin, uneven gutters). | Phone docH 27,997 (dest/dbg2 run); phone-debug-phone-index.png shows left gutter ≈40px vs right ≈30px (Places.css:87-92 margin-left:2em + column padding-left:1em). | Group by greater locale with section headers (or paginate/virtualise), lazy-load card images (currently CSS backgrounds load eagerly), and center the grid with symmetric gutters. |
| /places | P2 | F/nav | On phone the bottom tab bar highlights 'Study' while viewing Places. | phone-debug-phone-index.png bottom nav: Study active. | Map /places (and /people, /matters) to the correct tab or no active tab. |
| /places (modal) | P2 | C4/D1 | In-app click on an index card opens a route-backed 'Location Profile' modal (URL → /places/canaan) instead of the page, so the same URL has two presentations; the modal body is short and 'References' is clipped at its bottom edge, and the grid behind scrolls to re-anchor the card. | desktop-index-click-card.png (url /places/canaan, #popUp present, 'References' heading cut at the modal bottom); Places.js:120-124. | Decide per S5; if modal stays, give it a max-height with an internal scroll hint, and a 'Open as page' maximize control. |
| / (Home tile) → /places/:slug | P2 | D4 | Home Places tiles use react-router &lt;Link>, so a tile click mounts the standalone EntityPage (unmounting Home), unlike the index which opens a modal; the page's return link points to /places, not back to Home. | PlacesTile.js:30,63 and PlaceProfileTile.js:33,56 use react-router Link; EntityPage.js:362-366 back link href=cfg.base ('/places'). NOT verified live — the arrival-from-tile capture could not run (see sampled note). | Make return label/behavior context-aware (history.back() to Home when referrer is Home) and align tile vs index click mechanism per C4. |
| /places | P3 | H | Editorial typos visible in index captions: 'Captial of the Northern Kingdom of Israel', 'Capitol of Syria'. | desktop-index-click-card.png bottom row (Samaria, Damascus cards). | Fix data: 'Capital'. |
| /places/:slug | P3 | G2/F2 | Small targets: 'View on Map' is 35px tall; 134 visible targets under 44px on the rich page (pills, reference items, back link 52x17). | capture-desktop.json btns r.h=35; smallTargets=134 (rich), 48 (median), 41 (sparse); back link 52x17. | Min 44px tap height on touch for button and back link; increase line-height/padding on reference items. |
| /places/:slug | P3 | B2 | Minor late shift on rich page load (CLS 0.0596 at ~1.77s, text nodes reflowing), plus 18 maps rendered as 18 stacked buttons when 'View on Map' is expanded. | capture-desktop.json desktop-rich cls entry t=1767 v=0.0596; PlaceBody.js:477-501 renders one Button per map (land-of-nephi has 18 maps). | Reserve space for the description/pills; replace the multi-map button list with a select/dropdown or a compact list of map names. |

#### matters

Components: Routes: frontend/webapp/src/models/Routes.js:268-275 (/matters/:matterSlug → &lt;EntityPage type="matters"/>, /matters → Matters). Index: frontend/webapp/src/views/Matters/Matters.js (+ MattersFilter.js → _Common/FilterPanel/FilterPanel.jsx, MatterDetailColumn.jsx, mattersFilterData.js, Matters.css; also imports Places.css and People.css). Entity page: frontend/webapp/src/views/Entity/EntityPage.js + EntityPage.css (shared generic shell for people/places/matters/history) rendering frontend/webapp/src/views/_Common/entity/MatterBody.js (the popup body 'moved verbatim' out of PopUp.js), which composes _Common/EntityThumb.jsx, _Common/XrelSection.js, _Common/entity/ReferenceList.js; popup CSS from _Common/PopUp.css (.ppbody/.refbox) still styles the page. Data: _Common/entity/useEntityData.js (GraphQL `matter`). Home entry points: views/Home/tiles/MattersGroupTile.js (+ MattersNarrativeTile/MaterialTile/ConceptTile), MatterProfileTile.js.

Gestalt: index craft 2 / beauty 3; entity craft 2 / beauty 2. Index: the commissioned artwork is genuinely attractive in the top rows, but it's a 476-card unsorted wall behind a 'SELECTORS' button, with rainbow-gradient placeholders and wrong initials, cryptic letter badges, and the three group entry routes from Home 404 to 'Not found'. Entity: a popup body dropped on a grey page — thin left column, the bulk of content crammed in a 288px rail, slugs ('Nephi1', 'lamanites') leaking, no metadata, back link at the very bottom, and on phone the rail collapses to a half-width column with mid-word breaks. Hero art is the only polished element.

Sampled: Picked from the live GraphQL list (476 matters; nrefs median 3, max 118): RICH = swords (118 nrefs, 123 index rows, 16 xrels, 777-char description); MEDIAN = corn (nrefs 3, 4 index rows, 9 xrels, 447 chars); SPARSE = agricultural-tools (nrefs 1, 1 index row, 5 xrels, 297 chars — min-nrefs bucket). Also probed /matters/narrative (the Home group-tile target). Captured: desktop 1440 fold+full for swords/corn/agricultural-tools/narrative; phone 390 fold+full for corn and agricultural-tools; tablet 820 fold+full for /matters index and swords. Measurements in /tmp/claude-1003/-home-bom-BookofMormonOnline/524d9f80-ee41-4628-b4a6-fb0690560be9/scratchpad/dest/matters-measure.json (script: .../scratchpad/dest/matters.mjs). LIMITATIONS: desktop and phone /matters index and phone /matters/swords failed to render within 30s (net::ERR_NETWORK_CHANGED flaps; desktop-index-fold.png is blank), so the index was only judged at tablet. Mid-task the Bash tool began refusing every command (worktree-isolation guard: 'this command's working directory resolved to the shared checkout'), so the planned live D4 tile-click arrival from /home, the dark-mode look (html[data-theme=dark] / preferences.darkMode toggle in Main.js:164-166), and keyboard focus-order checks could NOT be run; D4/G1/G2 above are derived from code, not live capture. These should be re-run by a session with a working shell.

<details><summary>Anatomy</summary>

ENTITY /matters/:slug (desktop 1440, top→bottom): app chrome (fixed dark header + left nav sidebar) → .entity-page container (max-width 62rem, 4.5rem top pad) as a 2-column flex: LEFT .bodytext (634px): h3 title 42px Roboto Condensed, &lt;br>, &lt;small> pale-grey italic subtitle with ~60px dead gap above it; description paragraphs (14px/21px) with inline boxed serif scripture-ref pills. RIGHT .refbox rail (288px, dotted left rule): 273px square rounded thumbnail; h4 'Relationships' → verb-grouped xrel cards ('Wielded by 4', 'Includes 7', 'Used by', 'Hidden by', 'Related to', 'Subtype of'…), each 54px thumb + bold name + grey note; h4 'References' → numbered &lt;ol> of index summaries (unlinked &lt;a> without href, tooltip on hover). Then (below both columns, i.e. at page bottom) '❮ Matters' text back link. No breadcrumb, no hero, no facts/metadata block (era/kind/category are not shown at all on the entity page), no 'open in reader' action, no prev/next. PHONE 390: same order stacked: title → subtitle → description → refbox squeezed to ~149px wide on the left half (thumb 134px, cards 134px) → Relationships → References → back link at bottom; fixed bottom tab bar. TABLET 820: desktop 2-col layout retained (bodytext 434px + 288px rail). INDEX /matters (tablet 820 captured): app chrome → centered h3 'Matters in the Book of Mormon' (≈48px) → 'SELECTORS' grey button + magnifier icon (FilterPanel collapsed; axes Era&Culture / Kind / Category, Kind adds a Form/Subform column) → MatterGrid of ALL 476 fixed-height (22em) cards in one unpaginated grid (8/7/6/5/4/3/2 cols by breakpoint; 4 cols at 820), each card = name header, artwork (or slug-gradient + huge initials fallback) with dark gradient subtitle overlay, grey footer with cryptic single-letter badges (Kind initial, Era initial, ★ for named). docH 40,336px (~34 screens). No count shown at rest, no grouping/section headings, no back control. /matters/&lt;group> variant (narrative\|material\|concepts) was designed to add a '· Narrative  VIEW ALL' qualifier to the h3, but that route is unreachable (see P0).

</details>

| Page | Sev | Crit. | Defect | Evidence | Fix |
|---|---|---|---|---|---|
| /matters/narrative, /matters/material, /matters/concepts | P0 | D5 | Every Home matters-group tile heading and its '+N Matters' view-all card lands on a bare 'Not found' page. | desktop-index-narrative-fold.png: grey 'Not found' + '❮ Matters', nothing else (measured textSnippet 'Not found\n\n❮ Matters'). Cause: Routes.js:268-271 sends /matters/:matterSlug to EntityPage, which queries a matter with slug 'narrative' and gets none; the group-keyword handling in Matters.js:23-28,85-103 (CATEGORY_TEST seeding the Category chip) is dead code because Matters never mounts for that path. Links: MattersGroupTile.js:32 and :66 use `to` = '/matters/narrative' (MattersNarrativeTile.js:13), '/matters/concepts' (MattersConceptTile.js:13), and material likewise. | Route /matters/:group(narrative\|material\|concepts) to Matters before the slug route (or have EntityPage delegate CATEGORY_TEST keys to Matters), and add a route test for all three keywords. |
| /matters/:slug | P1 | D3 | The only return control ('❮ Matters') is at the very bottom of the page, far below the fold on every sampled entity. | Measured back-link y: swords 4150px (desktop & tablet, viewport 900/1180), corn 1409 desktop / 2135 phone, agricultural-tools 1000 desktop / 1746 phone. EntityPage.js:127 renders {backLink} after &lt;cfg.Body>. desktop-rich-full.png shows it alone at the foot after 123 references. It is also a plain &lt;a href> (EntityPage.js:69) → full document reload instead of SPA nav, and it always points to /matters, never back to Home where the user came from. | Move a breadcrumb/back control above the title (e.g. '❮ Matters' or '❮ Back' using history when the referrer is in-app), keep the bottom one as a secondary; use &lt;Link>. |
| /matters/:slug | P1 | F1 | On phone the relationships/references rail collapses to a ~149px column on the left half of the screen, breaking words mid-syllable and wasting the right half. | phone-sparse-fold.png and phone-median-full.png: refbox measured w=149px at x=44 (bodytext is 330px). Card text wraps as 'Cultivatio\|n and Sowing', 'Agricultura\|l tools', 'resettleme\|nt'; each card becomes ~190px tall. EntityPage.css:40-42 gives .refbox `flex: 0 1 18rem`; the ≤700px rule (EntityPage.css:54-58) switches to column but never sets width:100%/align-self:stretch, and PopUp.css .refbox rules still apply. | At ≤700px set `.entity-page .ppbody .refbox { flex: 1 1 auto; width: 100%; }` and center the thumbnail; drop overflow-wrap:anywhere on names. |
| /matters/:slug | P1 | A1 | Desktop/tablet 2-column layout leaves a huge dead left column: the description ends near y≈620 while the right rail runs to y≈4044 on rich matters. | desktop-rich-full.png: Swords description is 3 short paragraphs; .bodytext and .refbox both measure h=4044 because the flex row stretches; ~3,400px of empty grey left of a 288px rail carrying 16 relationship cards + 123 references. Same shape on corn (desc ends ~400, rail 1303). | Move References (and long relationship groups) into the main column under the description, or make the rail sticky and the references a collapsible/‘show more’ list; don't put the longest content in the narrowest column. |
| /matters/:slug | P1 | A7 | Raw slugs and machine names leak into the Relationships list: 'Nephi1', lowercase group slugs 'lamanites', 'jaredites', 'nephites', 'anti-nephi-lehies', 'zeniffites'. | desktop-rich-fold.png ('Nephi1' card heading, img alt 'Nephi1' measured), desktop-rich-full.png ('Used by 3: lamanites / jaredites / nephites', 'Hidden by: anti-nephi-lehies'), phone-median-full.png ('lamanites', 'zeniffites', 'nephites'). XrelSection.js:113 prints x.dst_name raw for people and group endpoints; group endpoints have no thumbnail (ASSET_PATH has no 'group'). | Run dst_name through processName()/a display-name lookup (Nephi1 → 'Nephi', son of Lehi) and title-case group names via the groups table; give group cards a glyph so they don't render as text-only orphans. |
| /matters/:slug | P1 | G1 | Primary interactions are non-semantic: references are &lt;a> with no href, relationship cards are &lt;li onClick>. | Measured on swords: anchorsNoHref=129, clickable &lt;li>=15; ReferenceList.js:15-21 (&lt;a className='ppref' onClick> with no href → not focusable, no keyboard activation, no open-in-new-tab); XrelSection.js:90-106 (li with tabIndex+onClick). Relationship clicks call setPopUp (XrelSection.js:83) so from a page they open a modal, contradicting EntityPage's page→page onEntityClick (EntityPage.js:59-61), which XrelSection never receives. | Render references as &lt;a href='/read/…#verse'> or &lt;button>, and relationship cards as &lt;Link to='/people/…'> (real URLs, middle-click works); pass onEntityClick through so page stays page. |
| /matters | P1 | A2 | Index grid is heavy with loud placeholder art: saturated slug-gradient cards with giant wrong initials. | tablet-index-fold.png: 5 of the first 12 cards are magenta/purple/red/olive gradients (Lehis Treasure 'LT', Lehi's Tent 'LS', Lehi's Altar 'LS', Plates of Brass 'PO', Laban's House 'LS'); measured fallbackCards=54 of 476 at capture (EntityThumb.jsx:36 notes 314/487 matters lack artwork; some of the 54 may be transient ERR_FAILED loads). Initials bug: entityInitials (EntityThumb.jsx:25-31) turns apostrophes into spaces so "Lehi's Tent" → 'Lehi s Tent' → 'LS', "Plates of Brass" → 'PO'. Gradients (hsl 45–70% sat) clash with house palette (black/neutral gray/gold #c9a24b). | Strip apostrophes (not replace with space) and skip stopwords in initials; replace rainbow gradients with a neutral parchment/gray treatment plus a small kind glyph; sort art-bearing matters first or hide art-less ones from the default view. |
| /matters | P2 | D5 | Index is one undifferentiated wall of 476 cards (~34 screens) with no grouping, count, or pagination; filters hidden behind a grey 'SELECTORS' button. | tablet-index measured cardCount=476, docH=40,336px at 820px; tablet-index-fold.png shows 'SELECTORS' + bare magnifier and the grid starting cold. The canonical three-group taxonomy (Narrative/Material/Concepts) exists as a filter axis but isn't used to structure the page. | Section the index by the three groups (each with a row of top items and 'see all'), show the count, and paginate/virtualize the grid. |
| /matters | P2 | A3 | Card footer badges are cryptic single letters (B, N, P, M, S, I, ★) meaningful only via hover title; Matters.css header comment says they are meant to be hidden. | tablet-index-fold.png footers 'B I ★', 'P I ★', 'M I ★'; Matters.js:246-266; Matters.css:2-3 ('Footer badges are hidden for now (display:none)') — but no such rule exists, the grey #CCC footer renders on every card. Not usable on touch (title tooltips only). | Either remove the footer or show readable chips ('Made Things · Israelite'); drop the grey #CCC bar. |
| /matters/:slug | P2 | A3 | Title block typography is off: 60px dead gap between title and subtitle, subtitle pale-grey italic at low contrast; scripture refs styled as tiny boxed serif pills unlike the rest of the app. | desktop-rich-fold.png / desktop-sparse-full.png: h3 box 118px tall for a one-line 42px title + subtitle (MatterBody.js:26-34 &lt;br/>&lt;small>); subtitle ≈#aaa italic on #eee (estimated &lt;3:1, fails AA). Inline refs render as grey-bordered serif boxes ('1 Nephi 4:9') mid-sentence; body text 14px/21px. | Use an h1 for the title, subtitle as a 16–18px dark-gray deck directly beneath, body 16px; restyle refs as plain underlined links (black, gold underline per house style). |
| /matters/:slug | P2 | D5 | Entity page is the popup body transplanted: no metadata (kind, era/culture, category), no scripture-reading action, references are one-line summaries with no verse text or links. | MatterBody.js:11 ('moved verbatim out of PopUp.js'); EntityPage.css:16-38 neutralises popup sizing. Fields fetched but never rendered: category, era, provenance, aliases, tags, usage (GraphQLQueries.js:122-145). desktop-rich-full.png: 123 references as a dense 12px list in the rail. Corn shows duplicate references ('Half of the corn yielded as Lamanite tribute' ×2, phone-median-full.png). | Design a page template: facts strip (Kind · Era · Category · N references), references grouped by book with verse links, art larger as hero on phone; dedupe identical index rows. |
| /matters/:slug | P2 | G3 | Thumbnails in Relationships use slug-ish names as alt and decorative images carry redundant alt duplicating the visible name. | Measured alt 'Nephi1' (people/nephi1), alt equals adjacent bold name for every xrel card (EntityThumb.jsx:62 alt={name}); index card images alt='' (Matters.js:234) but the visible artwork is a CSS background, so screen readers get no image info — acceptable since name is in header. | Use alt='' on thumbs that sit next to the same name; fix the name source. |
| /matters/:slug | P2 | M2 | Runtime errors on every entity load: uncaught SyntaxError 'Unexpected token &lt;' and a GraphQL 415; React activeClassName warning. | matters-measure.json errors for swords/corn/agricultural-tools (desktop, phone, tablet): 'pageerror: SyntaxError: Unexpected token '&lt;'', 'http 415: http://localhost:8201/graphql' (sparse + tablet rich), 'React does not recognize activeClassName'. Same SyntaxError seen in R1 page pass. | Find the fetch that JSON-parses an HTML/415 response (likely a GET/side query without content-type) and guard it. |
| /matters, /matters/:slug | P2 | B1 | Cold loads intermittently hang 30s+ with a blank white page (no spinner, no error). | desktop-index-fold.png is pure white; desktop & phone /matters and phone /matters/swords never rendered within 30s (tReady≈31,000ms) with 22–43 'net::ERR_NETWORK_CHANGED' errors; the same URLs rendered in 1–2.5s on tablet/other runs. Likely environment network flaps, but the app shows nothing at all while bootstrapping. | Show an app-shell skeleton from index.html and a retry message when bootstrap requests fail. |
| /matters/:slug | P2 | F2 | Tap targets too small: back link 58×17px, reference links 13px tall. | Measured back 58×17 (all viewports), refsFirst h=13 desktop/tablet (swords: 130 small targets &lt;44px). Phone ref rows 30–47px. | Pad back control to ≥44px; give reference rows ≥32px line boxes with padding. |
| /matters/:slug | P3 | A2 | Image weight: 1254–1672px square originals served for 54px relationship thumbs and 273px hero. | Measured natural 1254×1254 / 1672×1672 rendered at 54×54 and 273×273 (swords, corn). Sharp at 2× but ~20–30× pixel overdraw for thumbs; 16 on swords. | Serve sized variants (e.g. ?w=128 / ?w=600) from media host. |
| /matters/:slug | P3 | D4 | Continuity from a Home matters card is acceptable (same name + same artwork), but the arrival is a different visual world (popup body on grey page) and Back target ('❮ Matters') differs from origin (Home). | Code path: MattersGroupTile.js:42 / MatterProfileTile.js:41 Link to /matters/:slug → Routes.js:269 EntityPage; title/art match (same assetUrl/matters/:slug). Live tile-click capture NOT performed (see limitations in sampled). | Make the page header reuse the tile's image treatment; return control should go back to Home when arriving from Home. |
| /matters/:slug | P3 | A4 | Body links in description use a translucent navy rgba(50,59,77,.67) rather than house black. | Measured bodyLinkColors ['rgba(50, 59, 77, 0.667)'] on all three entities; house style = links black. | Set .entity-page .bodytext a { color:#000 } with gold underline as the back link already does (EntityPage.css:48-52). |

## R4. Fix log — 2026-10-15/16

Implementation: `docs/plans/2026-10-15-home-tiles-production-readiness.md`. Every in-scope R1–R3 finding is listed with its outcome (fixed in <sha> / accepted: reason / not reproducible: evidence).

### R4.1 Page level and shared (Phases 1–3, plus post-merge verification)

| Finding | Outcome |
|---|---|
| R1 E1/E2 Back/tab rebuilds a different Home | fixed: session snapshot (ac3c63e8); Back pins the tile the reader was looking at (e6e4aa5f). Live: 6/6 round-trips land on the same tile, 0–14px drift |
| R1 K1/F1 phone buries People | fixed (ac3c63e8): single curated column; People at y≈256 (was ≈4000) |
| R1 B2 phone reading-plan rug-pull | fixed (ac3c63e8 + rail family dcf01a55) |
| R1 K4 batch failure strands skeletons | fixed (ac3c63e8): terminus + Retry; live Retry loads the next batch |
| R1 B3 on-screen shifts during infinite scroll | fixed (e6e4aa5f): removed content-visibility placeholders; scroll CLS 0.075 → 0.000 |
| R1 I1 no resample on phone | accepted for now: phone has no tab bar by design; the end-of-sample terminus offers resample |
| R1 M2 runtime errors | fixed: ol/Map shadowing (8f043da9, P0); RR5 activeClassName (da114295); duplicate cluster keys (story family). The `Unexpected token <` and the 404 are a Vite-dev-only Clicky path; absent on a prod build |
| R2.2 P0 MapStory dies ~2s after mount | fixed (8f043da9) |
| R2.2 P0 /matters/<group> Not found | fixed (1fdc10d8) |
| R2.2 E1 canonicalizing pushes | fixed (4242eb85; commentary deeplink d7019803; closePopUp no stale push). Live sweep: one Back → /home from all 16 desktop / 18 phone destination classes |
| R2.2 E1 restore animated from the top | fixed (7e7fba3b): instant scroll (Bootstrap reboot set smooth) |
| R2.2 F1 phone overflow, A1 silent clipping | fixed (fc31b274, d824a672) |
| R2.2 F3/D5/G2 ScripturePopup | fixed (5a8d3523, 5f8d7400) |
| R2.2 J1 image weight | fixed: 2,186 WebP variants uploaded (people/places/matters, 256/640w); TileImage srcset on by default (c54fa54d). Desktop deep-scroll 21MB → 8.3MB; people/places/matters load variants only. Archive media (fax/history/art) has no variants: accepted, follow-up |
| R2.2 M2 no per-tile error boundary | fixed (012baa2b) |
| R2.2 G1/C2/F2/A4/C5/L3/C1 shared primitives | fixed (0c6567c9, 64ae0f30, fc31b274) |
| R2.2 D3 entity back control below the fold | fixed (edba8db8) |
| Labels | 53 new keys + Korean applied to bom_prd; read_more → "Read more" |

### R4.2 Per tile (Phase 4 families)

#### rail

Review: approve. Commits: `d857055f`, `25925e56`, `597e4f71`, `dcf01a55`, `315425a4`.

Decisions: Contents tile: shows the division's pages (not sections) as block rows, capped at MAX_PAGES=6 plus '+ N more' (plain text). The division's own intro page (same slug/title) is omitted. The banner is a pointer-only duplicate link (tabindex -1, aria-hidden), and the title is a plain h4, so 'See in context' is the single tab stop to the division. Inside a phone BoundedTile (detected via TileBoundContext) the description renders unclamped under the bound's single reveal, avoiding two stacked Read more pills. Narration tile: section title is plain (h4) rather than a link, because the CTA covers that href. CTA verb is seeInContext. Reading plan tile: - Bubbles are decorative (aria-hidden), not links. Linking 52 cells would add 52 tab stops, and the preview refs are cross-range strings that don't map to sensible destinations. - Guest 'Start reading' goes to /read/&lt;first chapter of week 1>. - Signed-in 'Start reading'/'Manage plan' still opens the in-tile chooser, which now has a Close button. Shared changes, minimal: - TileImage: widths=[] disables srcset. - ProgressBox: push changed to replace. - skeletonHeights: contents 1000 to 560px, narration 617 to 650px. Sampler.js BOUNDED_SPANS is unchanged.

| Tile | Crit. | Sev | Outcome |
|---|---|---|---|
| readingplan | B1 | P1 | fixed in dcf01a55: the plan preview is fetched in parallel with mybookmark (it was fetched after it), and the pending slot is an invisible copy of the plan tile with the same layout, so it holds the final footprint at every width (desktop 238, phone 249, tablet 189) |
| readingplan | B2 | P2 | fixed in dcf01a55: while bookmark===undefined the slot shows a neutral invisible ghost (aria-busy) instead of GuestPlanPreview. ReadingProgressTile reserves its page box while loading, so there is no second grow |
| readingplan | B4 | P2 | fixed in dcf01a55: if the programs/preview fetch fails, the tile shows the heading and CTAs with no bubbles. Covered for guests and for signed-in users with no plan. ReadingProgressTile failure shows a link back to the page |
| readingplan | C1 | P2 | fixed in dcf01a55: the bubbles are a status picture (aria-hidden, cursor default, no hover filter, no handlers) |
| readingplan | A4 | P2 | fixed in dcf01a55: #555 on #e9e9e9 (~6:1); dark #bdbdbd on #3a3a3a (~5.5:1). Verified live via computed style |
| readingplan | D4 | P2 | fixed in dcf01a55: guest Start reading goes to readPath(first segment ref) = /read/1-nephi-1, with the same fallback when the preview is unknown. Verified live href |
| readingplan | D5 | P2 | accepted: the Sign in destination layout (progress header for guests, login in the right column) belongs to the User page (views/User/User.js), outside the rail family. Needs a User-page task |
| readingplan | E1 | P2 | fixed in dcf01a55: ProgressBox canonicalizes /home/user/&lt;sub> to /home/user with replaceState, keeping the router's history.state. It previously used pushState, even on /home/user itself |
| readingplan | L1 | P2 | fixed in dcf01a55: the signed-in chooser has a Close button. Focus moves into the chooser on open and back to the opener on close, and the plan is re-read without a loading flash. Unit-tested; not driven live (no signed-in session in the harness) |
| readingplan | F2 | P3 | fixed in dcf01a55: valueProp pills and Close are min-height 44px on (pointer: coarse). Live phone/tablet height 44 |
| readingplan | L3 | P3 | fixed in dcf01a55: dark primary is near-white #ececec (light primary is #1f1f1f, not slate-blue). The global dark bubble border and green current-week marker are neutralized; week 1 is outlined in gold |
| readingplan | H2 | P3 | partially fixed in dcf01a55: week 1 is gold as the start point; the grid fills the width evenly; there is no ragged right gap. accepted: a value-proposition line or today's reading needs copy and labels (Task 12) |
| section | G3 | P2 | fixed in 597e4f71: art thumbs use TileImage with alt 'Art for &lt;section>' (n) |
| section | D3 | P2 | accepted: the /art/:id destination layout (title, caption, back) is the art page, owned by family 10g (art E1/H6). Not changed here |
| section | F2 | P2 | fixed in 597e4f71: invisible 44px hit areas (::after) on the crumb and Next links on touch. RefPill/TileCTA touch sizes come from the shared Phase 2 rules |
| section | A3 | P3 | fixed in 597e4f71: the section title is an h4 under the page crumb; the continuation is a 'Next · &lt;title>' divider |
| section | A5 | P3 | fixed in 597e4f71: equal 4:3 cropped cells in one grid row, max 9rem each (no stretched slivers at tablet) |
| section | J1 | P3 | accepted: art has no media variants (Task 11 covers people/places/matters only); TileImage now skips srcset for it (d857055f). Needs art variants upstream |
| section | L3 | P3 | fixed in 597e4f71: the blank dot is at opacity .3 in dark mode, and dots render only when some beat has progress |
| section | H2 | P3 | fixed in 597e4f71: status dots are hidden when no beat has progress (all guests) |
| section | G1/refPill | P2 | fixed in 597e4f71: the RefPill is a sibling of the beat link, and NarrationTile.js is removed from the refPillPlacement ALLOW set |
| section | H2/CTA verb (R2.3) | P3 | fixed in 597e4f71: 'View more' becomes 'See in context' via TileDeepLink verb. The title no longer duplicates the CTA href (one link per destination) |
| contents | C2 | P1 | fixed in 25925e56 (with the Task 7 BoundedTile): inside the bound there is one Read more (the description renders plain, so no stacked second pill). Verified live on phone: 384 to 826px, CTA visible |
| contents | A1 | P2 | fixed in 25925e56: the outline lists pages only, as block rows with section counts, at most 6 plus '+ N more'. Desktop 1000 to 518px |
| contents | C3 | P2 | fixed in 25925e56: See in context is always visible (TileDeepLink always). The banner link is tabindex -1 and aria-hidden, so the division has one tab stop |
| contents | G1 | P2 | fixed in 25925e56: the description and its Read more sit outside any &lt;a> |
| contents | F2 | P2 | fixed in 25925e56: outline rows are block links, min-height 44px on touch |
| contents | C1 | P3 | fixed in 25925e56: the head link is narrowed to the banner (brightness hover); rows get a gold underline on hover |
| contents | H2 | P3 | fixed in 597e4f71: narration now also says 'See in context' |
| contents | A4 | P3 | fixed in 25925e56: section links are removed; counts use var(--tile-meta) #6b6b6b |

Open: 1. **Shared primitives touched** (minimal, flagged for merge):    - tiles/_ds/TileImage.js: `widths.length > 0` added to the useVariants condition. Families 10f/10g, which use TileImage for art, fax and history, may want `widths={[]}` for media without variants, to avoid a 404 per image and to keep the caller's onError working.    - views/User/ProgressBox.js: push changed to replace, with history.state preserved.    - tiles/_ds/skeletonHeights.js: the tile-contents and tile-narration entries. 2. **Sampler.css:** edits stay inside the CONTENTS, READING PLAN, NARRATION and READING PROGRESS blocks. One `@media (pointer: coarse)` sits inside each block. 3. **Title case from the labels table:** 'Read More', 'Start Reading' and 'Sign In' come from the DB, so the sentence-case rule depends on Task 12 label rows (read_more, start_reading, sign_in). The new label keys are listed separately. 4. **readingplan D5** (Sign in destination layout on the User page) and **section D3** (the /art/:id page) are destination pages outside this family. Recorded as accepted. 5. **Balancer estimate:** Sampler.js estimates contents height as `12 + pages*2.6` rem. That was never accurate, and the tile is now shorter. I left it alone because Sampler.js is shared. 6. **Capture harness:** on this loaded machine the harness's fixed 30s `waitForSelector` in `home()` timed out repeatedly on cold Vite loads. I used a polling pre-load in a scratchpad driver; the harness itself may need a longer or env-configurable timeout. 7. No push or merge, no screenshots committed, audit doc not edited.

#### people

Review: approve. Commits: `d5e8bfbb`, `e2ba7596`.

Decisions: 1. Face strip is 9 faces at 5-up instead of 11 at 6-up, as the audit suggested (fewer faces, readable size). The 24-person sample is split as featured + profile reserve + 9 faces + 12 mosaic, so no person repeats between People and PersonProfile. 2. One keyboard stop per destination. In the featured block the 'Open &lt;name>' TileDeepLink is the Tab stop. The portrait (aria-hidden) and the name link stay clickable for the mouse but are tabIndex -1. The Open CTA is not gated behind Read more, because the auditor flagged gating a duplicate as C3. ProfileTiles.test.js PersonProfile case updated to match. 3. Layout follows the tile's own width (container queries on .peopleTile/.personProfileTile), not the viewport. 4. PersonProfileTile is added to twoLayerCompliance EXEMPT as a thin wrapper; its deeplink lives in the new PersonFeature.js, which imports TileDeepLink. 5. The featured pick is done client-side, which needed `unit identification` added to the people line of the homesampler query in GraphQLQueries.js. There is no backend change.

| Tile | Crit. | Sev | Outcome |
|---|---|---|---|
| people | A1 (face names cut mid-word) | P2 | fixed in d5e8bfbb: name chips wrap to 2 lines, with the clamp on an inner span; at 1440, 820 and 390 no names are cut mid-word |
| people | F1 (phone 4-up, clipped pills, 1-2 word fragments) | P2 | fixed in d5e8bfbb: container queries give 5-up x2 (9 faces) when wide, 3-up x3 (8 faces) under 600px, and portrait+name+title only under 440px. Phone cards are 99px (were 72px); docW equals vw at 390, 820 and 1440 |
| people | A3 (9.6px type) | P2 | fixed in d5e8bfbb: names 12.5px, titles and pills 11.2px, index text 11.5px (measured live at 1440) |
| people | A4 (meta contrast) | P2 | fixed in d5e8bfbb: index text and featured title use the --tile-meta token (#6b6b6b light / #a3a3a3 dark) |
| people | F2 (pill tap target inside card link) | P2 | fixed in d5e8bfbb: the pill is now a sibling button above a stretched card link. On coarse pointers its ::after hit area reaches 44px. Live tablet tap 8px above the pill opened the popup and did not navigate. Phone hides the body, so no pill there |
| people | J1 (8MB of full-size JPEGs, lazy LCP) | P2 | fixed in d5e8bfbb: every image goes through TileImage. Live currentSrc is variants/256/people/*.webp. The featured portrait is eager with fetchpriority=high. Face sizes are tuned so 256w is picked at DPR2 |
| people | A1 (title band leaks 3rd line through padding) | P3 | fixed in d5e8bfbb: the clamp moved to an inner .peopleFaceTitleText span |
| people | H3 (dangling 'of…' titles; bio clamp 'genealog…') | P3 | titles fixed in d5e8bfbb: clampWords backs off trailing function words, e.g. 'Son of Joseph¹, father of a tribe…'. Bio mid-word cut accepted: it is the browser's CSS line-clamp ellipsis, and the reversible Read more shows the full text |
| people | A3 (parens around detected-ref pills) | P3 | fixed in d5e8bfbb: _ds/refProse.js strips '(' and ')' around bare refs, so pills no longer orphan parentheses |
| people | A7 (subscript Nephi₂, typo 'againts') | P3 | subscript fixed in d5e8bfbb: supDigits maps ₁-₄ to superscripts. Typo accepted: it is in a source data row (bom_people index text), not frontend; needs a prod DB edit |
| people | G1 (button inside card &lt;a>, 2 tab stops/card) | P3 | fixed in d5e8bfbb: card is a container with one link plus a sibling RefPill button. PeopleTile.js removed from refPillPlacement ALLOW. Live Tab order is pill, link, pill, link; the focused card gets a gold ring |
| people | H1 (dud featured: groups, Bible figures) | P3 | fixed in d5e8bfbb (client-side): featured picks the first unit=I, non-Bible person with a bio of at least 600 chars, else falls back to data[0]. The homesampler query now asks for unit and identification. On 9 live seeds this replaced 3 group/short leads |
| people | A1 (dead phone .peopleFeatureDesc clamp rule) | P3 | fixed in d5e8bfbb: dead Sampler.m.css people rules deleted; layout now follows container queries |
| people | R2.3 superscript disambiguators / inverted names | P2 | fixed in d5e8bfbb: personName() = supDigits(processName()). 'Gideon, Chief Judge of' now reads 'Chief Judge of Gideon'; Mosiah2 reads Mosiah². Raw-digit title= tooltips removed |
| people | CTA 'Open &lt;name>' + view-all fallback | P2 | fixed in d5e8bfbb: featured has one TileDeepLink verb=open ('Open Mosiah²'). Portrait and name links are tabIndex -1. View-all falls back to verbLabel('viewAll'), and its +N now counts the people not shown (featured + faces) |
| people | M2 (onError hides image -> blank hole) | P2 | fixed in d5e8bfbb: PersonPortrait swaps to a gold serif monogram in the same box. Verified live by forcing 404s on the featured portrait and one face portrait |
| personProfile | A1 (fixed portrait + narrow ribbon of text, dead gutter) | P2 | fixed in e2ba7596: under 520px the portrait becomes a 4.75rem header avatar and the bio runs full width. At 1440 the expanded tile is 778px with no gutter |
| personProfile | M2 (blank 128x171 hole on image error) | P2 | fixed in e2ba7596: shares PersonPortrait, so a failed image shows the monogram |
| personProfile | A4 (featured title #888) | P2 | fixed in d5e8bfbb: shared .peopleFeatureTitle uses --tile-meta |
| personProfile | H2 ('See in context' to own page; same 'PEOPLE' eyebrow) | P3 | fixed in e2ba7596: CTA is 'Open &lt;name>' and is always visible as the single tab stop. Eyebrow is 'People · Profile'. Profiles the payload's reserved person, never one shown in the People tile |
| personProfile | H3 (paren around pills) | P3 | fixed in e2ba7596 via refProse; bio refs are also RefPill buttons now, not href-less &lt;a> |
| personProfile | J1 (1024px JPEG for 128px portrait) | P3 | fixed in e2ba7596: TileImage srcset (sizes=128px); live serves variants/256 |

Open: **Shared primitives touched (minimal; please check when merging other families):** - tiles/textUtils.js   - supDigits now also maps subscripts ₁-₄ to superscripts.   - clampWords backs off trailing function words (of, and, the, …). This changes truncated output for Places, Matters, Witness, JosephSmith and Community too, as an improvement; their tests still pass here. - New tiles/_ds/refProse.js (detected refs as RefPill buttons, wrapping parens removed). It is reusable for the placeProfile and matterProfile paren and G1 issues (R2.2 A3). Families 10c and 10d may have written their own. - tiles/_ds/skeletonHeights.js: tile-people is 810px desktop / 775px phone; tile-personProfile is 330px desktop. - Sampler.js: est('people') goes from 46 to 51. - GraphQLQueries.js: the people line gains `unit identification`. - ProfileTiles.test.js and twoLayerCompliance EXEMPT (PersonProfileTile.js) are shared files, so merge conflicts are possible. **Not fixed in my scope:** - Labels table returns 'Read More' in title case for read_more (Task 12 label rows). - The shared `.sampler .scripture_link` chip contrast (~3.7:1, R2.2 A4) is unchanged; it is used by every tile, so it needs one shared fix. - Bio RefPills inside prose have no 44px coarse hit area. That is low risk because they are not inside a link. - Bio CSS line-clamp may still end mid-word; Read more reveals the rest (accepted). - 'againts' typo is in source data. - Destination /people/:slug defects (R3) are out of scope. **Scratchpad note:** the session scratchpad root is shared by all 8 parallel agents. My first cap.mjs and vite.log were overwritten by another family's files. My working scripts are in scratchpad/t10-people-work/.

#### places

Review: changes → fix pass. Commits: `5ea89fa8`, `5f922a4d`, `a4e3e9ed`, `9d2063db`, `05889ed7`, `9bf1b6a0`.

Decisions: MapTile reachability: REMOVED. It was 10th in reservePool behind MAX_RESERVES=5, never in batchTiles, and a seed-invariant dud when forced; MapStory and the place pins cover the map on Home. Pin hit area: the glyph disc stays at 1.6rem on fine pointers. On coarse pointers it is inset by (44px-1.6rem)/2 from the corner so the 44px ::after fits inside the overflow:hidden wrap. Both tiles slug-filter before profiledPlaceIndex so they index identical lists.

| Tile | Crit. | Sev | Outcome |
|---|---|---|---|
| places | F1 (phone overflow) | P1 (critic: merged into cross-cutting F1) | not reproducible: the cross-cutting masonry fix is already on the branch. At phone 390 the tile sits inside the viewport with both card columns intact (phase4/places/phone-phone-tile-places.png). |
| places | J1 (1024px JPEGs) | P1 | fixed in 5ea89fa8: card art and mosaic cells render through TileImage, using srcset variants 256/640 from the media CDN. |
| places | E1 (map-pin double history) | P1 | fixed upstream: canonicalize-with-replace on the map route was already on the branch (Phase 2/3). |
| places | D5 (map-pin destination raw markup / title overprint) | P1 | fixed in 9d2063db + 05889ed7: the place panel description goes through detectScripturesPreservingTokens + renderPersonPlaceHTML, the title wraps on its own line box, and scripture pills stay on one line. |
| places | A1 (info band half third line, double truncation) | P2 | fixed in 5ea89fa8: the clampWords pre-ellipsis is gone and the band uses a single CSS line-clamp on an inner span. |
| places | H3 (names clipped to 2 lines) | P2 | fixed in 5ea89fa8: names flatten with superscript disambiguators, take up to 3 lines and are never clipped while the info band shows two. |
| places | F2 (18px map pin) | P2 | fixed in 5ea89fa8 + 9bf1b6a0: a 1.6rem dark scrim disc (live on desktop: 26x26 on fine pointers). Under pointer:coarse the pin is inset (44px-1.6rem)/2 so its 44px ::after is no longer clipped by the overflow:hidden wrap. Measured live with elementFromPoint: 44x44 on all 5 Places pins at phone 390, tablet 820 and phone dark. |
| places | C1 (card lifts but only image links) | P2 | fixed in 5ea89fa8: the image link is stretched over the whole card, the pill and pin sit above it, and the hover state is scoped to the link. |
| places | H4 (places saturates infinite feed) | P2 | partly fixed in 5ea89fa8: within a sample the mosaic skips the profiled place and the cards. accepted (rest): cross-batch dedupe and cadence live in shared Sampler.js/registry batch assembly, outside this family's files. Recorded in openIssues. |
| places | A7 (data junk in info strings) | P3 | accepted: source-data typos in bom places.info need a data edit (writes are out of scope on the read-only dev DB). Trailing ';' and stray footnote digits are no longer pre-processed by clampWords, which was removed. |
| places | D3 (/places back link at bottom) | P3 | fixed upstream: the entity page back control/layout fix was already on the branch. |
| places | C5 (UA focus ring) | P3 | fixed in 5ea89fa8 for the card link (inset focus-visible offset so the ring shows on dark art). The sampler-wide ring is cross-cutting. |
| places | dead CSS / '16:9' comment | P3 | fixed in 5ea89fa8: dead places rules and the removed Map tile's rules are dropped, and the CSS is scoped under .placesTilePlaces. |
| placeProfile | F1 (tablet rail clips to bare image) | P1 | fixed in 5f922a4d: the hero is capped at max-height 15rem. Tablet 820 shows hero, prose with pills and the Read More CTA (phase4/places/tablet-tablet-tile-placeProfile.png). |
| placeProfile | E1 (map-pin double history) | P1 | fixed upstream: canonicalize-with-replace was already on the branch. |
| placeProfile | G2 (scripture refs not keyboard reachable) | P2 | fixed in 5f922a4d: detected scripture renders as RefPill buttons. The file is removed from the refPillPlacement ALLOW set. |
| placeProfile | H4 (profiled place duplicated in mosaic) | P2 | fixed in 5f922a4d + 9bf1b6a0: the shared profiledPlaceIndex runs on the same slug-filtered list in both tiles. A regression test with a slugless payload entry fails without the fix and passes with it. |
| placeProfile | F2 (18px pin, invisible on sky) | P2 | fixed in 5ea89fa8 + 9bf1b6a0: same scrim disc as Places. Coarse-pointer inset measured live at 45x44 / 45x45 at phone, tablet and phone dark. |
| placeProfile | A7 ('Ammon 2' leak) | P3 | fixed in 5f922a4d: flatten() turns &lt;sup>n&lt;/sup> into a superscript before stripping tags, so 'Alma 2' and 'Ammon 2' no longer turn into chapter pills. |
| placeProfile | H3 (token Read More, not collapsible) | P3 | fixed via the shared reversible ExpandableText (Read more / Show less) used by the tile. |
| placeProfile | H2 ('See in context' label) | P3 | fixed in 5f922a4d: the Layer-2 CTA is 'Open &lt;place>' via the TileCTA verb. |
| placeProfile | A2 (upscaled hero at 2x) | P3 | accepted: source images are capped at 1024px. The 640 variant plus the 1024 original via srcset is the best available, and the hero height cap limits upscaling. |
| placeProfile | A4 (orphaned '(' around pills) | P3 | fixed in 5f922a4d: '(' + pill + ')' is kept on one line. |
| placeProfile | C5 (UA focus ring) | P3 | accepted: cross-cutting sampler-wide focus ring, not family-scoped. |
| map | H1/H2/A1/C1/A7/L3/H2 (unreachable, featureless, letterboxed) | P2/P3 | fixed in a4e3e9ed: the Map reserve tile and its module/CSS are removed. MapStory and every place card's map pin already carry the map on Home. A test asserts there is no map reserve or batch entry. |

Open: Places H4 cross-batch saturation (the same places across infinite batches, plus Places and PlaceProfile in every batch) needs a dedupe or cadence change in shared Sampler.js/registry batch assembly. That is outside the family files, so it is not done here. The sampler-wide :focus-visible ring (C5) is cross-cutting. Typos in places.info source data need a DB data edit. No shared primitives were changed in this follow-up.

#### matters

Review: changes → fix pass. Commits: `1c7b7f76`, `a6f4033d`, `866f4905`.

Decisions: On touch hit areas, I took the reviewer's first option: the ref chip moved out of the clamped row onto its own line (align-self: flex-start), and only the gloss is clamped. Hit areas are centered with percent insets, top/bottom = calc((100% - 44px)/2). The eyebrow is the exception: it grows 12px up and the rest down (bottom: calc(100% - 36px)), because the tile's top edge clipped a centered area to 41-42px. To keep first-line prose chips from being clipped, the profile's collapsed prose clamp uses an offset padding-top/negative margin-top pair. When the profile hero fails to load, it now collapses to the name chip, not just visibility:hidden, because hiding the img alone left an empty 15rem white box. Earlier decisions are unchanged: profile index 17 (PROFILE_MATTER_INDEX) so it never repeats a Concept-tile matter, and the CTA verb 'open'.

| Tile | Crit. | Sev | Outcome |
|---|---|---|---|
| mattersNarrative/Material/Concept | D5 (dead /matters/&lt;group> heading + view-all) | P0 | fixed upstream: /matters/&lt;group> routes landed in fix/t2-matters-routes, which is merged into this branch. The tile links to those routes, and I confirmed live that the hrefs are /matters/narrative\|material\|concepts |
| mattersNarrative | F1 (rail cap 24rem on phone) | P1 | fixed: live phone render shows the full tile (h=702), including the second card row and the view-all cell. The skeleton reservation is 373/670px via _ds/skeletonHeights |
| mattersMaterial/Concept | F1 (445px tile in a 390 viewport) | P1 | fixed by the cross-cutting column fix on this base. Live phone measurement: scrollWidth 390 = innerWidth 390 |
| matterProfile | C2 (Read More clipped by rail cap; hero too tall) | P1 | fixed in a6f4033d: hero capped at max-height 15rem, tile 424px on phone with Read More and Open &lt;name> reachable (verified in phone/tablet shots) |
| mattersNarrative | A1 (third line of name/subtitle leaks under the pill) | P2 | fixed in 1c7b7f76: the clamp moved to an inner span. clampOverflow measured 0 on every card live |
| mattersNarrative | H3 (four text layers; names cut at the key noun) | P2 | fixed in 1c7b7f76: names get 3 lines and no map-pin reservation. The narrative subtitle is now a hover/focus layer, not always on |
| mattersNarrative/Material/Concept | F2 (tap targets too small on phone) | P2 | fixed in 866f4905. The ref chip moved out of the line-clamped .placesTileIndexRow, so it sits on its own line and only the gloss is clamped. Chip and eyebrow get a z-index:1 ::after sized to 44px under pointer: coarse; the eyebrow grows 12px up and the rest downward, over the card grid. With the new tileharness hitHeights() elementFromPoint scan on phone, every chip measures 45px and every eyebrow 49px |
| matterProfile | F2 (prose RefPills 18px with no expansion; eyebrow 34px) | P2 | fixed in 866f4905: a coarse ::after on .placeProfileDesc .scripture_link plus the eyebrow. The collapsed clamp gets padding-top 14px offset by margin-top -14px, so first-line chips aren't clipped and nothing shifts. Live: eyebrow 48px; prose chips 45px both collapsed and expanded with realistic prose. Accepted residual: chips on directly adjacent prose lines (18px line height) overlap, so each gets about 18-22px. The WCAG 2.5.8 inline-in-sentence exception covers this |
| mattersNarrative/Material/Concept | J1 (17 full-size JPEGs per tile) | P2 | fixed in 1c7b7f76: TileImage with a 256/640 srcset for cards and 256 for mosaic cells. Live currentSrc is variants/256\|640/matters/&lt;slug>.webp |
| matterProfile | D4 (destination shows initials instead of the image on phone) | P2 | fixed upstream by the entity-page fix (fix/t9-entity-pages), which is merged into this branch |
| matterProfile | D3 (entity page back control below the article) | P2 | fixed upstream by the entity-page back control/layout fix (t9), which is merged |
| matterProfile | G2 (Read More unmounts the focused button, focus drops to body) | P2 | fixed via the shared reversible ExpandableText (Phase 2), now used by the tile. A test covers Read more -> Open &lt;name> reveal |
| matterProfile | R2: hero TileImage missing onError (broken glyph in a 15rem grey box) | minor | fixed in 866f4905. onError hides the img and records the failed slug in state. The hero then collapses (img unmounted, link .isNoImage) to a standalone name chip instead of an empty box. Unit-tested and verified live with a missing-asset slug |
| mattersNarrative/Material/Concept | R2: '+N more' used browser-locale toLocaleString | minor | fixed in 866f4905: plain String(more), as other tiles do. A test asserts Number.prototype.toLocaleString is not called |
| mattersNarrative/Material | A1 (name pill wraps early: map-pin max-width reservation) | P3 | fixed in 1c7b7f76 (no pin clearance on matters overlays) |
| mattersNarrative/Material/Concept | B1 (15rem skeleton vs 373/808px tile) | P3 | fixed: _ds/skeletonHeights reserves 373px desktop and 670px phone for the group tiles and 430px for the profile |
| matterProfile | B1 (18rem skeleton vs ~430px) | P3 | fixed: skeletonHeights tile-matterProfile = 430px |
| matterProfile | H3 (clamp cuts after an opening parenthesis) | P3 | fixed in a6f4033d: parentheses around a lone ref are dropped and the ref renders as a RefPill |
| matterProfile | H2 (generic 'See in context' CTA; redundant hero link) | P3 | fixed in a6f4033d: the CTA is TileDeepLink verb=open ('Open &lt;name>'), and the hero link has tabIndex=-1 so the tile has one tab stop |
| matterProfile | H4 (profile always repeats a Concept-tile mosaic matter) | P3 | fixed in a6f4033d: homesampler sends 18 per group and the profile uses index 17. The registry only offers the tile when that matter exists (backend test updated) |
| matterProfile | J1 (1254px hero without srcset) | P3 | fixed: TileImage hero with srcset; live currentSrc is 640/matters/&lt;slug>.webp |
| mattersMaterial/Concept | H4 (near-duplicate 'Sackcloth' vs 'Sackcloth and ashes' across tiles) | P3 | accepted: these are distinct bom_matters rows in different groups. Deduplicating them is a content/data decision, not a tile fix |
| mattersNarrative/Concept | A7 (dropped apostrophes / mixed name casing in bom_matters) | P3 | accepted: source-data cleanup in bom_matters.name, outside the tile layer (no DB writes from this task) |
| mattersNarrative/Material/Concept/matterProfile | L3 (parchment art glares in dark mode) | P3 | accepted: I reviewed the dark desktop shots, and the cards read cleanly. Dimming images is a cross-cutting treatment shared with people/places, so it should be one shared rule, not a matters-only one |
| matterProfile | L3 (dark Read More pill turns blue) | P3 | accepted: the shared .readMorePill/ExpandableText primitive is filed as cross-cutting, outside this family's CSS blocks |

Open: 1) I changed a shared script: scripts/home-audit/tileharness.mjs gained hitHeights(locator, selector), an elementFromPoint scan for touch hit height, as the reviewer requested. It is additive only. 2) In dense profile prose, chips on directly adjacent lines overlap at the 18px line height, so each gets about 18-22px. I accepted this under the WCAG 2.5.8 inline exception. 3) On phone, the Home infinite feed rendered matterProfile twice (y=11648 and y=19312) in one session. This looks like the infinite feed repeating the tile across batches, which is feed/registry behavior outside this family; worth a check by whoever owns the feed. 4) Not pushed or merged, per instructions.

#### scripture

Review: approve. Commits: `af42f6a6`, `637bfd94`, `c0e03c63`, `e6ed44b8`, `71c8850f`, `cc2f7a43`.

Decisions: Notes L5: CONFIRMED. HIDE_PASSAGE_NOTES (src/models/featureFlags.js:93 = NODE_ENV==='production' && features.yml passageNotes.hidden:true) hides the passage-notes destination in Read (Read.js:22, ChapterContent.js:8). The Notes tile is now never ready in prod builds: registry isReady is `!HIDE_PASSAGE_NOTES && ...`, and batchTiles reuses that predicate. Pinned by notesFeatureGate.test.js. Dev and tests still show the tile. Text tile: the legacy TextInFeed renderer is dropped for a sampler-native layout: - eyebrow plain text - meta line "page · section" - title, plus a RefPill for the bracketed or bare-reference heading - Read-serif passage in ExpandableText (9 lines) - narration with one static art thumb - TileDeepLink "See in context" Commentary: ref-only titles (BoM Minute) use the title's ref for the pill and lift the first prose sentence as the headline, removing it from the body. The revealed excerpt is bounded to about 1100 chars; the full text is behind "See in context". readPath: now canonical everywhere (popup Read button, art tile, fax viewers too), instead of a notes-only helper.

| Tile | Crit. | Sev | Outcome |
|---|---|---|---|
| text | E1 | P1 | not reproducible: live history 2->3 on deeplink, one Back returns to /home (Task 8's setSlug skip already fixed it); TextTile 637bfd94 also cuts the card to one link |
| text | A3 | P2 | fixed in 637bfd94 + 71c8850f (own layout: left-aligned Read serif, no grey slabs, page/section meta line) |
| text | A5 | P3 | fixed in 637bfd94 (single chrome, no nested itemInFeed card) |
| text | A7 | P3 | fixed in 637bfd94 + 71c8850f (no dangling colon or arrow; feed highlight chips neutralized) |
| text | A6 | P3 | fixed in 637bfd94 (one static TileImage thumb, no rotation timer) |
| text | C1 | P3 | fixed in 637bfd94 (eyebrow is plain text; title gets a hover underline; one deeplink) |
| text | G2 | P3 | fixed in 637bfd94 (one tab stop to the href; title is tabIndex -1; ref is a RefPill button) |
| text | D3 | P3 | accepted: destination scroll position belongs to the Page route. Back now works in one press (E1), which was the stated mitigation |
| text | L3 | P3 | fixed in 71c8850f (dark theme uses neutral text and a gold hairline poetry rule, no slabs or green bar) |
| commentary | C2 | P2 | fixed in c0e03c63 (reveal is reversible with focus and aria-expanded kept, keeps paragraphs, bounded to about 1100 chars with an ellipsis; line-clamp truncation always offers the reveal) |
| commentary | A7-offbyone | P2 | fixed in c0e03c63 (tile side): a reference-only title drives the pill and the headline becomes the first prose sentence, so title and pill no longer disagree. The underlying BoM Minute +1 data offset in the DB and the /commentary modal header remains a data fix |
| commentary | D5 | P2 | not reproducible as a blank panel: in-app nav renders the Study page with the host row open by 1.5s and the popup follows at about 4s on dev. Found and fixed a real E1 regression on the same path (history +3, Back landed on /downfall/34) in cc2f7a43; now +1 entry and Back goes to /home |
| commentary | G1 | P2 | fixed in c0e03c63 (aside ref and inline excerpt refs are RefPill buttons via refPillParserOptions) |
| commentary | A1 | P3 | fixed in c0e03c63 + 71c8850f (deeplink moved to a full-width footer row) |
| commentary | A7-junk | P3 | fixed in c0e03c63 (tidy: space before ?/!, hyphen-as-dash before function words, 'verses 6. 11' -> 'verses 6, 11'); straight-vs-curly quote mixing accepted (source data) |
| commentary | A4 | P3 | fixed in 71c8850f (source uses the --tile-meta token, size 0.7rem) |
| commentary | H2 | P3 | partially fixed in c0e03c63 (ref-only titles lead with the prose). CTA casing: the TileCTA verb is used, but the DB label read_more = 'Read More' (title case) overrides the sentence-case fallback. Needs a labels-row update (Task 12) |
| commentary | H1 | P3 | accepted: down-weighting ATV and ref-titled sources is a backend sampler change outside this family; ref-titled rows now read better in the tile |
| commentary | G2-triple-link | P3 | fixed in c0e03c63 (title and cover links are tabIndex -1, one tab stop to /commentary/:id) |
| notes | E1 | P1 | fixed in af42f6a6 (readPath emits the canonical /read/ether.6/8). Live: one history entry, Back goes to /home |
| notes | L5 | P1 | fixed in e6ed44b8 (confirmed HIDE_PASSAGE_NOTES = prod && features.yml passageNotes.hidden hides notes in Read.js/ChapterContent.js; the registry notes isReady is now gated on it, covering grid and batchTiles) |
| notes | B2 | P2 | fixed in 71c8850f + e6ed44b8 (sized 7.5rem shimmer placeholder instead of a lone '…'; a failed passage drops the block and shows a RefPill). The chapter fetch is still uncached (shared ScriptureExcerpt useCache:false) |
| notes | A7 | P2 | fixed in e6ed44b8 (no wrapping quotes when the note already opens with a quote) |
| notes | A3 | P2 | fixed in 71c8850f (body line-height 1.45 at 0.82rem, attribution 0.78rem meta gray) |
| notes | G1 | P2 | fixed in e6ed44b8 (inline refs are RefPill buttons). The passage-header ref from shared ScriptureExcerpt stays a span[role=button] with Enter/Space handling |
| notes | H2 | P3 | fixed in af42f6a6 (anchor matching ignores punctuation and case and works per elided fragment) |
| notes | H1 | P3 | accepted: source rotation and length weighting is a backend sampler change |
| notes | D3 | P3 | accepted: relies on the fixed Back (E1); the Read page chrome is out of scope |
| notes | L3 | P3 | fixed in 71c8850f (dark .read-section slab transparent inside the tile) |
| notes | G3 | P3 | fixed in e6ed44b8 (cover alt = publication title) |
| notes | phone/tablet layout (new) | P2 | fixed in 71c8850f (Read.scss &lt;=900px rules stacked the speaker gutter and pulled the section out by -0.6rem; Sampler.m.css keeps the compact row layout) |

Open: Shared-file edits outside the family (minimal, called out): 1. frontend/webapp/src/views/_Common/ScriptureExcerpt.js    - readPath now returns the canonical slug, e.g. /read/1.nephi.2/11. This also changes ScripturePopup, ImageArtTile (10g) and the Facsimile viewers, all for the better.    - highlightPhrase is exported and tolerant of punctuation and elisions.    - Possible merge overlap if 10g also touched readPath. 2. tiles/_ds/TileImage.js: `widths.length > 0` gate, so `widths={[]}` gives a plain src for art and source covers. 10f/10g may make the same change; it is a one-line merge. 3. tiles/RefPill.js    - new named export refPillParserOptions    - reworded the line-11 comment: its literal `&lt;Link>/&lt;a>` text made the refPillPlacement scanner flag the file 4. tiles/registry.js: the notes isReady gate (one line plus an import). 10c and 10f also edit this file. 5. tiles/_ds/skeletonHeights.js: text, commentary and notes values re-measured. 6. views/Page/Page.js: setActiveRow replaces while resolving a /commentary\|image/:id deeplink, and the commentary onTail popup passes replaceSlug:true. No unit test covers this; it was verified live only. Remaining: - DB label read_more is 'Read More' (title case), so the TileCTA sentence-case fallback never shows. Fix the labels row in Task 12 (show_less already uses the fallback). - BoM Minute reference/verse_id +1 offset is still in the data and in the /commentary modal header. - Read canonicalizes /read/ether.6/8 to /read/ether.6 with replace after highlighting. It costs no history entry, but the shareable URL loses the verse (a Read-side concern). - ScriptureExcerpt still fetches chapters with useCache:false. - The passage-header ref in ScriptureExcerpt is a span[role=button], keyboard-operable but not a native button. - A 415 on /graphql showed up once during the Read/Page navigation probes; I did not attribute it to these tiles.

#### archive

Review: approve. Commits: `8c088eb0`, `659c01f7`, `4289f388`, `91b8a204`, `c200a14a`, `6b3165b6`, `291360b8`, `136f5ae1`, `a755c6c0`, `9157c3f8`.

Decisions: TranslationTile: REMOVED from reservePool (registry.js keeps a commented re-add line; component kept and fixed). Root cause is data, not a query bug: all 155 'translation' archive rows have quote_curation_status 'needs-editorial-quote' and 0 have metadata.money_quote, so sampleArchiveDoc('translation') returns null for every seed. Re-add the pool entry once quotes are curated. Joseph Smith: the 'only one statement ever' bug WAS a query bug: joseph-smith-statements (and witnesses/lost-116-pages) rows have id NULL, so seededOrder('id') produced NULL for every row; sampleArchiveDoc now seeds on slug (non-null, unique). JosephSmithTile also added to batchTiles. FaxVerse CTA now goes to the verse in Read ('See in context') instead of duplicating row 1's viewer href; FaxTile CTA is 'Open &lt;short edition>'. Decorative fax tab graphics were removed rather than patched (assets exist for only 9 editions).

| Tile | Crit. | Sev | Outcome |
|---|---|---|---|
| fax | G1 | P2 | fixed in 659c01f7 (ref rail is a RefPill &lt;button> beside the page link; Enter opens popup, focus returns - verified live) |
| fax | A2 | P2 | fixed in 659c01f7 (page row max-width caps rendered page height at 20rem, so tablet no longer upscales the 400px thumbs ~1.85x; desktop unchanged) |
| fax | J1 | P2 | accepted: fax/covers has no smaller rendition and no variants on the media CDN (Task 11 covered people/places/matters only); covers are lazy + async via TileImage. Needs a variants run for fax/covers (outward upload, KC confirm) |
| fax | C1 | P3 | fixed in 659c01f7 (ref is its own row/button above the image link) |
| fax | F2 | P3 | fixed in 659c01f7 (min-height 44px under pointer:coarse) |
| fax | L3 | P3 | fixed in 659c01f7 (TileImage adoption -> global dark dim on img.tileImage) |
| fax | A6 | P3 | no_change_needed: Task 7 reduced-motion block already covers .faxTilePages img:hover / .faxTileEdition:hover img |
| fax | L2 | P3 | fixed in 659c01f7 ('pp.', 'p.', alt via labelOr: x_pages, page_n, x_page_n) |
| fax | tab-404 (R1 M2) | P2 | fixed in 4289f388 (fax/tabs/&lt;ed> only exists for 9 editions; the decorative tab graphic is removed, rows use a compact text label; no 404s in live capture) |
| fax/faxVerse | E1 Back x2 (plan) | P1 | not reproducible: Playwright on 8216 desktop+phone, every fax/faxVerse destination (page link, edition cover, title, CTA, row) adds 1 entry and one Back lands on /home (viewer already uses replace) |
| faxVerse | A2 | P2 | fixed in 4289f388/c200a14a (crops via TileImage with 1x w800 / 2x w1600 render srcset at intrinsic size, never upscaled, max-height 6.5rem). Residual: 1891 crop for 1 Ne 4:5 is cut off - bad bbox in the fax index data, not tile code (accepted) |
| faxVerse | A5 | P2 | fixed in 4289f388 (no tab graphics; every row has the same text rail: short edition + folio) |
| faxVerse | C1 | P2 | fixed in 4289f388 (per-row look-alike ref pill removed; header pill is the only popup trigger) |
| faxVerse | L3 | P2 | fixed in 4289f388 (crops dimmed via tileImage, dark border/background, rail titles #e8e8e8) |
| faxVerse | H4 | P3 | fixed in 4289f388 (ref shown once) |
| faxVerse | A7 | P3 | fixed in 4289f388 (shortEdition: '2013 Salt Lake City' etc.; full title as hover title) |
| faxVerse | G3 | P3 | fixed in 4289f388 (decorative tab img removed) |
| faxVerse | CTA dup href | P2 | fixed in 4289f388 (CTA 'See in context' -> Read verse, distinct from row 1; verified one Back) |
| history | D3 | P2 | no_change_needed: Task 9 back control ('&lt; History') verified live above the H1 |
| history | D5 | P3 | fixed in a755c6c0 (transcript's leading citation paragraph dropped); document.title already correct live |
| history | A3 | P3 | fixed in 4289f388 (eyebrow links /history) |
| history | G2 | P3 | fixed in 4289f388 (title + rail tabIndex -1, rail aria-hidden; CTA is the single tab stop) |
| translation | H1 | P2 | fixed in 91b8a204 (removed from reservePool: 0/155 translation rows have a money_quote, all 'needs-editorial-quote' - data, not a query bug) |
| translation | C4 | P3 | fixed in 4289f388 (CTA -> /history/&lt;slug>, eyebrow -> /history/translation) |
| translation | L2 | P3 | fixed in 4289f388 (labelOr('translation')) |
| josephSmith | A3 | P2 | fixed in 4289f388 (.witnessStatement .miniHighlight background none; line-height 1.05 -> 1.32) |
| josephSmith | H1 | P2 | fixed in c200a14a (rows have id NULL so MD5(CONCAT(id,..)) was NULL for all -> seeded on slug; live-DB test shows rotation; also added to batchTiles in 91b8a204). Needs backend deploy/restart to take effect |
| josephSmith | L3 | P2 | fixed in 4289f388 (no highlight slab in dark; verified dark capture) |
| josephSmith | H3 | P3 | fixed in 4289f388 + 6b3165b6 (ExpandableText, reversible, focus kept - verified live keyboard) |
| josephSmith | J1 | P3 | accepted: history/witnesses/people portraits have no variants on the media CDN; TileImage lazy/async |
| josephSmith | L2 | P3 | fixed in 4289f388 (labelOr joseph_smith; portrait alt '' since name is visible link text) |
| josephSmith | D4 (CTA to archive not doc) | P3 | fixed in 4289f388 (CTA -> /history/&lt;slug>, the featured document; verified live) |
| witness | A7 | P2 | fixed in 4289f388 (inlineMarkdown renders _x_/*x* as &lt;em>) |
| witness | A3 | P2 | fixed in 4289f388 (reporter is a 0.72rem meta-gray line above the quote) |
| witness | H1 | P2 | fixed in 4289f388 (reporter no longer eats the clamp + reversible Read more reveals the full statement) |
| witness | D4 | P2 | fixed in 4289f388 + 91b8a204 + 136f5ae1 (CTA -> /history/witnesses/&lt;w>/&lt;source>; that route crashed the app with 'Maximum update depth exceeded' pre-existing - fixed; popup opens with replaceSlug; one Back to /home verified) |
| witness | H3 | P3 | fixed in 4289f388 (ExpandableText) |
| witness | D5 | P3 | accepted: 'Biography coming soon.' is a recorded deliberate product choice (Witnesses.render.test.js 'KNOWN DIFFERENCE ... kept as-is') |
| witness | J1 | P3 | accepted: no variants for history/witnesses portraits; TileImage lazy/async |
| witness | remount swap (new) | P2 | fixed in 291360b8 (featured witness memoized per payload; masonry remount no longer swaps the person mid-read) |
| witness/josephSmith/history | ExpandableText re-measure (new) | P2 | fixed in 6b3165b6 (expanded box no longer re-measured on parent re-render, Show less no longer vanishes) |
| archive | B1 skeletons | P3 | fixed in 9157c3f8 (witness, fax phone, faxVerse phone rows re-measured) |

Open: 1. Shared primitives changed:    - `tiles/_ds/TileImage.js` and `mediaVariants.js` (8c088eb0): a new `hasVariants()` limits srcset to people/places/matters paths, and absolute or root-relative srcs are used as-is. Before this, archive images 404'd once each and the caller's `onError` never ran.    - `tiles/ExpandableText.js` (6b3165b6): it no longer re-measures while expanded. Before, any parent re-render with new JSX children made Show less disappear.    Other families editing these files may hit merge conflicts. 2. Files outside the tile folders changed:    - `views/History/Witnesses.js`: fixes an existing infinite loop on /history/witnesses/&lt;w>/&lt;source> that blanked the app, and adds `replaceSlug`.    - `views/_Common/entity/HistoryBody.js`: the citation is no longer printed twice.    - `backend/src/graphql/resolvers/homesampler.ts`: archive docs are now seeded on slug.    - `registry.js`, `skeletonHeights.js` and `twoLayerCompliance` EXEMPT (`faxLabels.js`): small edits; registry and skeletonHeights may conflict with 10c/10b. 3. The backend change needs bom-greenfield restarted, and later deployed, before Joseph Smith statements rotate. Cached sampler payloads (L1 and the shared L2, 6h) keep the old pick until they expire. 4. Page-level, not fixed here: the Sampler masonry remounts reserve and batch tiles when infinite batches append. That drops any expanded Read more state; the witness person-swap side effect is fixed. 5. The `read_more` label row in the database is 'Read More' (title case), so every Read more button is title case. That breaks the sentence-case rule and needs a row update in Task 12. 6. Data issues left as they are:    - The fax index bbox for the 1891 edition is wrong for some verses (the crop is cut off).    - fax/covers and the history portraits have no variants; this needs extending Task 11's upload scope, which KC must confirm. 7. The popup document title shows '(undefined)' for history sources opened from the Witnesses page (`setPopDocTitle` receives the doc itself instead of an id-keyed map). This is existing destination code and outside this family's scope. 8. New label rows needed for Task 12 are listed under newLabelKeys. 'history' and 'translation' are guarded by labelOr; a 'History' row exists but may not match the lowercase key.

#### analysis

Review: changes → fix pass. Commits: `f70f7adc`, `c2cf4183`, `5792e56d`, `cd54a885`, `e5859654`.

Decisions: For the reserve collapse I used reviewer option (b): reservePool entries artFill1, artFill2 and chiasmus2 now carry a span (tile-art / tile-chiasmus), and Sampler.renderReserve adds def.span to the class list. This is safe because tile-art and tile-chiasmus have no CSS other than the :empty collapse, so reserve layout does not change. For the single-column state I added a new file, tiles/_ds/useSingleColumn.js, which uses the same 900px query as Sampler. It is a separate file, not an edit to skeletonHeights.js, so it cannot conflict with other families editing that file.

| Tile | Crit. | Sev | Outcome |
|---|---|---|---|
| biblephrases | B4/H1 | P1 | fixed in c2cf4183 (six candidate pairs in one request, no dud picks, null collapses the tile). The reserve and batch collapse is covered in e5859654 |
| biblephrases | B1 | P2 | fixed in c2cf4183 (skeleton sized to the tile). In e5859654 the phone skeleton height is used in the single column: live phone skeleton 418px against a settled 414px, and no CLS from the tile |
| biblephrases | H3 | P2 | fixed in c2cf4183 (word-token diff; marks fall on word boundaries) |
| biblephrases | A3/A5 | P2 | fixed in c2cf4183 (Scripture serif, inline ref chips, stacks when narrow, house-gold marks) |
| biblephrases | D4/L2 | P2 | fixed in c2cf4183 (TileCTA verb seeInContext deep-links the pair's chapter grid; eyebrow links to /analysis/bible) |
| chiasmus | A4/L3 | P2 | fixed in 5792e56d (legend keys use --tile-meta, 5.3:1 in light, gray in dark; line-height 1.38) |
| chiasmus | C1/A2/J1 | P2 | fixed in 5792e56d (avatar and name are one link to the person; TileImage 256w variant; ref pill moved outside any link) |
| chiasmus | B1 | P1 | fixed in 5792e56d (sized skeleton; a failed fetch collapses). In e5859654 the reserve chiasmus2 also collapses, and the skeleton height follows the single-column layout |
| chiasmus | size | P2 | fixed in 5792e56d (pool limited to chiasms of at most 600 chars; tile stays about 300-490px) |
| chiasmus | A4-marks | P3 | fixed in 5792e56d (quieter house-gold marks) |
| art | G2 | P2 | fixed in cd54a885 (title bar and image are one link) |
| art | M2 | P1 | fixed in cd54a885 (an image error drops the tile). In e5859654 reserve artFill1/artFill2 carry the tile-art span: live, with art images aborted, tile-artFill1.tile-art has display:none and height 0 |
| art | B2 | P2 | fixed in cd54a885 (excerpt placeholder reserves about 9rem; a failed excerpt hides) |
| art | A3 | P3 | fixed in cd54a885 (duplicate excerpt heading suppressed) |
| art | L3 | P2 | fixed in cd54a885 (dark Read inset transparent; phone caption and face layout fixed) |
| art | J1 | P2 | fixed in f70f7adc and cd54a885 (TileImage serves the original only when no variants exist) |
| art | D3 | P2 | fixed in cd54a885 (/art/:id gets a Back crumb, a forward Router link and an image capped at 72vh) |
| review-r2 | reserve-collapse (major) | P1 | fixed in e5859654 (reservePool art and chiasmus entries get a span; renderReserve emits tile tile-&lt;key> &lt;span>; tests added in registry.test.js and samplerCss.test.js) |
| review-r2 | in-tile skeleton single-column (minor) | P2 | fixed in e5859654 (new tiles/_ds/useSingleColumn hook; BiblePhrases and Chiasmus call skeletonHeight(span, single); phone test added) |

Open: 1. Shared code touched, minimal changes: Sampler.js renderReserve now adds def.span to a reserve tile's class list, and there is a new file, tiles/_ds/useSingleColumn.js. Sampler.js still has its own copy of useSingleColumn and could import the shared hook later. 2. MAX_RESERVES is 5 and artFill1 is 7th in the reserve pool, so on normal payloads the art reserves rarely appear. To test them live I had to strip API fields; this is a pre-existing balancer property. 3. tileharness home() waits for the first .tile:not(.skeleton) to be visible. One early run timed out under machine load; the next run passed, and I left the harness unchanged.

#### story

Review: approve. Commits: `641cda11`, `483c80a2`, `25200211`, `58673e62`.

Decisions: - **"Explore full journey" is now "Explore".** It uses the TileCTA `explore` verb, per the fixed CTA vocabulary. - **Complete card heading is the route.** The heading reads "A → B", or "Round trip from A". The status line alone says "Journey complete", and the footer route hides in the complete state, so nothing is said twice. - **Map failure shows a static summary.** The fallback shows the route plus the whole-journey card, with no transport controls. - **MapStory ref is the shared RefPill.** It uses the `.scripture_link` chip rather than a bespoke underlined button, for Belonging and one implementation. - **Red kept only for map semantics.** Red stays on the on-map route and markers and on the matching legend dots; all chrome is gold or neutral. - **Community shows 2 group cards maximum.** The tile is never wider than about 445px, so the rest fold into the +N card computed in JS rather than CSS. - **Edit outside the tile files.** `views/Map/MapContents.js` was edited (one Icon option) because the plan's 10h must-fix D5 lives on the story destination page. **Shared-primitive change (minimal):** `tiles/_ds/skeletonHeights.js` - tile-community: 213 → 252px desktop, plus 283px phone. - tile-mapstory: 650 → 662px desktop, 625 → 655px phone. Both were measured live after the changes.

| Tile | Crit. | Sev | Outcome |
|---|---|---|---|
| mapstory | M2 (P0, ol/Map shadowing) | P0 | fixed before this task (Task 1); verified live: OL map stays mounted (.ol-viewport present, no .mapStoryFallback) through 12s of autoplay at 1440/390/820, no map.delete errors |
| mapstory | D5 Explore destination portrait covers map | P1 | fixed in 641cda11 (the OL walker Icon used scale 0.6 on a ~1024px people image; it is now a 24px icon inside the 36px halo; live desktop-dest-after.png shows the route and map) |
| mapstory | D5 map-tile edge 404s on story page | P1 (sub-item) | accepted: console-only 404s for out-of-extent tiles on the /map page; they are not visible and belong to the Map view's tile-extent config, outside the tile family |
| mapstory | F3 phone popup offset | P1 | fixed by Task 6 (shared). Verified live at phone 390: the dialog is at x=0, w=390, a bottom sheet with the close button visible (phone-popup-after.png) |
| mapstory | M2 autoplay continues after boundary trips / no reset | P2 | fixed in 483c80a2 (on boundary failure, playback stops, the status and transport hide, and the static route plus whole-journey card show; the boundary is keyed on the story slug) |
| mapstory | J2 autoplay offscreen / hidden tab | P2 | fixed in 483c80a2 (playing requires visible && !pageHidden; playback resumes when the tab is visible again; tests added) |
| mapstory | A6 reduced motion disables autoplay | P2 | fixed/verified in 483c80a2 (existing behavior pinned by test; live reduce capture: scrubber holds at 10/10, opens on the complete card) |
| mapstory | A7 raw keys mapstory_meta/play/pause | P2 | fixed in 483c80a2 (all strings go through labelOr with English fallbacks; tested with an empty labels table) |
| mapstory | A7 Alma2 / inverted titles / Bountiful→Bountiful | P2 | fixed in 483c80a2 (supDigits on travelers in the tile, card and map avatars/aria; 'Recolonization X' becomes 'X’s Recolonization'; round trips read 'Round trip from X') |
| mapstory | A4 off-palette oxblood/green/blue focus | P2 | fixed in 483c80a2 (gold primary button, scrubber and complete mark; neutral status, legend and meta; blue focus rules removed so the global gold ring applies, verified live: rgb(201,162,75) 2px; red kept only for the on-map route and legend dots; CSS guard test) |
| mapstory | B2 autoplay height jiggle | P2 | fixed in 483c80a2/58673e62 (fixed beat reserve; live heights sampled 1/s over 12s were constant: desktop 666/658, phone 655, tablet 677) |
| mapstory | C5 ref/title focus invisible | P2 | fixed in 483c80a2 (the ref is now the shared RefPill button; the title gets the global gold ring, verified live) |
| mapstory | J1 full-size thumbnails | P2 | fixed in 483c80a2 (place thumbs and traveler avatars use TileImage with the 256w variant srcset) |
| mapstory | J3 useRef(new Map()) per render | P2 | fixed in 483c80a2 (useLazyRef for the overlay registries and the projection cache; source guard test) |
| mapstory | L3 dark move-state contrast / sage fallback glare | P2 | fixed in 483c80a2 (dark #e0e0e0 status; dark fallback gradient; neutral dark tokens) |
| mapstory | L2 hardcoded English | P2 | fixed in 483c80a2 (every visible string and aria-label goes through labelOr; keys listed in newLabelKeys) |
| mapstory | duplicate React key from cluster ids | P2 | fixed in 483c80a2 (clusters key on `${id}-${index}`, used for both the React key and the DOM registry lookup) |
| mapstory | A1 labels clip at frame edge / leg names truncate | P3 | fixed in 483c80a2 (labels are clamped inside the frame during camera moves; leg names wrap to 2 lines in a 3-column grid. Very long names, e.g. 'Land and Valley of Gideon' at 342px, can still clamp after 2 lines) |
| mapstory | A5 arrow misaligned | P3 | fixed in 483c80a2 (grid with align-items:center) |
| mapstory | F2 small tap targets | P3 | fixed in 483c80a2 (phone transport stays 44px (live: 44,44,44); the ref chip gets a ≥44px ::after hit area under pointer:coarse) |
| mapstory | H3 complete description clamped mid-word | P3 | partially fixed in 483c80a2 (the complete card now clamps at 5 lines instead of 3). accepted: still ends with an ellipsis on long descriptions; sentence-boundary clamping needs server-side editorial copy, and the Explore CTA leads to the full text |
| mapstory | H2 'Journey complete' twice / Active legend when complete | P3 | fixed in 483c80a2 (the complete card heading is now the route; the legend shows only Visited when complete; the footer route is hidden in the complete state) |
| mapstory | R2.3 CTA verb 'Explore full journey' | P2 (inconsistency) | fixed in 483c80a2 (TileDeepLink verb='explore' → 'Explore') |
| community | A1 container query hides message text | P2 | fixed in 25200211 (message rows are two-line, with the text clamped to 2 lines and never hidden; the container query only wraps the strip below 340px; live msgShown at 1440/390/820) |
| community | E1 Back from /home/community loses scroll | P2 | accepted: this is page-level Home tab-route scroll restoration (Task 8/13, Sampler/routeHistory), not tile code |
| community | A1 hidden more-card / '11 Members' wraps | P3 | fixed in 25200211/58673e62 (at most 2 cards, with the rest folded into an always-visible '+N groups' card; the count sits beside the faces with the word in aria-label/title, so there is no wrap or truncation) |
| community | H2 thin hook / emoji label | P3 | fixed in 25200211 (it now leads with the message excerpt; the emoji is dropped and the finishers label is an eyebrow; the CTA is 'View all'. A 'join a study group' verb is outside the fixed CTA vocabulary) |
| community | C5 no focus-visible | P3 | fixed in 25200211 (:focus-visible mirrors hover on group cards and message rows, plus the global gold ring) |
| community | R2.3 CTA verb 'View more' | P2 (inconsistency) | fixed in 25200211 (verb='viewAll') |
| community | J1/A2 avatars (TileImage) | P3 | accepted: community avatars are external user-profile URLs, not media-CDN paths, so TileImage variants don't apply. They are now lazy/async, and a missing picture renders a neutral disc instead of a broken &lt;img> |

Open: **Needs another task or owner** 1. Every key in newLabelKeys needs `en`/`ko` rows (Task 12). Until then the English fallbacks render. 2. Community E1 (Back from `/home/community/&lt;group>` lands at scrollY 0) is page-level tab-route scroll restoration and was not touched (Sampler/routeHistory, Task 8/13). 3. I changed a shared primitive: `tiles/_ds/skeletonHeights.js`, the tile-community and tile-mapstory rows only. Other families editing that file may conflict on adjacent lines. Community height also depends on the payload (messages vs reading-now): about 250–283px. 4. I edited `views/Map/MapContents.js`, outside the tile family, one Icon option for D5.    - The story page's own palette (blue run-colors, blue distance badges) is not house style.    - Its out-of-extent tile 404s also remain.    - Both belong to the Map view, not Home. **Residual polish (accepted)** 5. MapStory overlay nodes are positioned with left/top, so the layout-shift API logs many tiny (0.0001–0.0006) non-input entries during camera moves. These predate this task; the tile's own height is now constant. Moving the overlay to transform/translate would remove them; I didn't do it here. 6. Long complete-card descriptions still end with an ellipsis after 5 lines (needs editorial copy). 7. A 20-move story was still not captured live. 8. Korean was not driven. **Process** 9. The scratchpad is shared with the other parallel families, and another agent overwrote my first `cap.mjs`. My scripts now live in `scratchpad/t10story/`.

## R5. Blind Fable review — rounds 1–3 (2026-10-16)

Reviewers: fresh Fable agents per tile family and round, given only `scripts/home-audit/rubric-blind.md`, the harness and the tile source; told not to read docs/, prior reviews or git history. Pass = no P0/P1 and Craft/Beauty/Belonging each ≥ 3. Failing families got a non-blind fixer, then a fresh reviewer.

### Round 1

| Family | Tile | Verdict | C | B | L | P0/P1 findings |
|---|---|---|---|---|---|---|
| rail | readingplan | **FAIL** | 4 | 3 | 4 | P1 XC-1 readingplan·A1: On phone (390) and tablet (820) the first tile sits under the 60px fixed header at scrollY 0: the READING PLAN eyebrow is fully covered and the plan title is half-clipped, and there is no way to scroll above 0 to see it. |
| rail | section | **FAIL** | 3 | 3 | 4 | P1 XC-2 narration·G2: In the phone/tablet bounded shell the links hidden under the fade stay in the tab order; focusing one makes the browser scroll the overflow:hidden card, leaving the eyebrow, crumb, title and art pushed off the top and a  |
| rail | contents | **FAIL** | 4 | 4 | 4 | P1 XC-2 contents·G2: Same root cause as XC-2 (narration): under the phone/tablet bound, the 2–6 page links and "See in context" hidden by the fade remain tabbable and focusing them scrolls the overflow-hidden card out of shape. |
| people | people | **FAIL** | 4 | 4 | 4 | P1 G2: Keyboard Tab reaches reference pills hidden below the bio clamp and scrolls the overflow:hidden clamp box, scrambling the featured bio (text starts mid-sentence, ellipsis gone, Read more now meaningless). Cross-cutting:  |
| people | personProfile | **FAIL** | 3 | 3 | 4 | P1 E1: On phone, Back from 'Open &lt;name>' on an infinite-batch Profile tile lands the reader 700–800px below where they were: the tile that was on screen is now 606px above the viewport (two tiles later are visible). Desktop <br>P1 G2: Same keyboard-into-hidden-pill clamp scroll as the people tile (shared PersonFeature/ExpandableText); profiles carry 4–16 pills of which most sit below the 7-line clamp. |
| places | places | **FAIL** | 3 | 4 | 4 | P1 XC-B2-STALE-PAYLOAD: Cross-cutting (Sampler shell; hits every tile incl. places/placeProfile): a slow or superseded homesampler response overwrites the page the reader is already looking at — no latest-request-wins guard<br>P1 XC-E3-POPUP-SCROLL: Cross-cutting (app-wide ScripturePopup, desktop): opening a RefPill popup throws the page to scrollY 0 and it stays there after close — the reader loses their place in the feed |
| places | placeProfile | **FAIL** | 2 | 4 | 4 | P1 PP-E1-BACK-DRIFT: On phone, Back from any placeProfile link lands 626px past the tile (tile top -391px, off-screen) and the expanded reveal collapses; desktop Back from 'Open &lt;place>' is 106px off for the same collapse reason<br>P1 PP-G2-CLAMP-FOCUS: Tab moves focus to RefPills clipped inside the 5-line clamp; the overflow:hidden box scrolls to reveal them, so the paragraph's opening lines vanish, 'Read more' sits under text that now looks complete, and the offset su |
| matters | mattersNarrative | **FAIL** | 4 | 4 | 4 | P0 matters-01: [Cross-cutting: all four matters tiles + every tile with a RefPill] Opening the scripture popup from a ref chip resets page scroll to 0 on desktop and never restores it; closing leaves the reader at the top of Home.<br>P1 matters-02: [Cross-cutting: batch copies of all matters tiles, phone] Back from a tile deep in the infinite feed lands ~740px past it on phone, so a different tile (People Profile) fills the viewport. |
| matters | mattersMaterial | pass | 4 | 3 | 4 |  |
| matters | mattersConcept | pass | 3 | 3 | 4 |  |
| matters | matterProfile | **FAIL** | 2 | 4 | 4 | P0 matters-11: Tile never renders in the live app: the sampler payload carries 17 matters per group and the tile demands an 18th, so both the reserve and the batch slot are dead. |
| scripture | shared-refpill-expandable-popup | **FAIL** | 2 | 4 | 5 | P0 E3: Opening the scripture popup on desktop scrolls Home to the top and the position is not restored on close — every RefPill in text, commentary, notes (and every other tile) loses the reader's place.<br>P1 D2: The variant-compare modal opened from the ATV reading chips inside ATV commentary tiles does not close on Escape (backdrop and × work). |
| scripture | text | pass | 4 | 4 | 5 |  |
| scripture | commentary | pass | 3 | 3 | 4 |  |
| scripture | notes | pass | 4 | 5 | 5 |  |
| archive | fax | **FAIL** | 4 | 4 | 4 | P0 XC1-popup-scroll-loss: Opening the scripture popup (RefPill above each page) scrolls Home to the top on desktop and leaves it there after close — the reader loses their place. Cross-cutting: fax, faxVerse (and every RefPill on Home).<br>P1 XC2-back-lands-elsewhere: Browser Back does not return to the same content: on phone every round-trip (all 5 tiles, 6 trips) lands ~1050px lower; on desktop the fax/faxVerse tiles are restored at ~369px and grow to ~600px once their lazy images l<br>P1 fax-B1-image-jump: The tile grows after first paint when its page thumbnails load (no reserved aspect; flex-grow is set from naturalWidth/Height on load), producing the largest layout shifts on the page. |
| archive | faxVerse | pass | 3 | 3 | 4 |  |
| archive | history | pass | 3 | 3 | 4 |  |
| archive | josephSmith | **FAIL** | 3 | 4 | 4 | P1 josephSmith-H1-seed-invariant: The tile never changes: the same 1839 'title-page … literal translation' statement appears in every seed, every resample and every infinite batch — 19 identical tiles in one scroll — because only one joseph-smith-stateme |
| archive | witness | **FAIL** | 3 | 4 | 3 | P0 witness-E1-drawer-survives-back: The 'See in context' CTA opens the quoted source as an app-level drawer/modal over the witness page (and redirects the URL); pressing Back returns to /home with that drawer still open over the feed, intercepting taps — t<br>P1 witness-E2-different-witness-after-back: After any link → Back round-trip the tile features a different witness: the module-level 'last featured' guard survives the SPA navigation while the WeakMap keyed on the payload object misses the payload restored from se<br>P1 witness-D1-drawer-clipped-no-close: On phone the source drawer is wider than the viewport — the document text is cut off at the right edge, the title is printed twice, and no close/back control is visible above the fold (also D3, F3). On desktop the modal  |
| analysis | biblephrases | **FAIL** | 4 | 4 | 4 | P0 XC-E3: CROSS-CUTTING (biblephrases, chiasmus, art, and every RefPill on Home): opening the scripture popup on desktop throws the page to scrollY=0; closing it leaves you at the top, so the reader loses their place in the feed |
| analysis | chiasmus | **FAIL** | 4 | 4 | 4 | P0 XC-E3: Cross-cutting popup scroll reset (filed in full under biblephrases XC-E3): clicking the chiasm's ref chip on desktop resets the page to the top |
| analysis | art | **FAIL** | 3 | 4 | 3 | P0 XC-E3: Cross-cutting popup scroll reset (see biblephrases XC-E3): the art excerpt's ref chip opens the popup and the desktop page jumps to the top<br>P1 E1: On phone, Back from either art deeplink (title/image -> /art, See in context -> /read) lands 700-1300px past the tile when it sits deep in the feed; desktop restores exactly |
| story | mapstory | **FAIL** | 4 | 4 | 3 | P0 D5: On phone the Explore/title deeplink lands on a bare map: the story panel (title, description, 5 movements, back arrow) is rendered underneath the map canvas and cannot be reached by scrolling or any control<br>P1 D3: No back/return control above the fold on the phone destination (the ⬅ lives in the hidden panel); the bottom nav offers Home, not back<br>P1 E1: On phone, browser Back from the story page lands 480–800px past the tile (2 of 3 trials), so the reader returns to a different tile than the one they left |
| story | community | **FAIL** | 3 | 2 | 3 | P1 B2: The tile is not rendered until its live fetch lands (~1.4s after the cached sampler paints), then it is inserted mid-masonry and re-flows 14 tiles across columns; after every Back the same gap/re-insert moves in-view con |

Fixes after round 1:

- **rail:** `5b3a81fd`, `a3bbd568`
- **people:** `df59b44c`, `cf893c98`
- **places:** `ade5d5b2`, `10e24177`, `34c4c87a`, `f0dc9374`, `411afbb8`
- **matters:** `d0d5f1f4`, `40e42d4a`
- **scripture:** `ca4602f7`, `916e8f84`, `bf04a515`, `b3b8983f`
- **archive:** `c14b5ee1`, `56dcb2e5`, `93de5a3d`, `99e476e5`, `aeda7f21`
- **analysis:** `0b90ba6c`, `1bbebd8c`
- **story:** `957896a2`, `cf17f5b0`, `7915df52`, `c51c490b`, `55d66a2c`

### Round 2

| Family | Tile | Verdict | C | B | L | P0/P1 findings |
|---|---|---|---|---|---|---|
| rail | readingplan | pass | 4 | 3 | 4 |  |
| rail | section | pass | 4 | 4 | 4 |  |
| rail | contents | pass | 3 | 4 | 4 |  |
| people | people | **FAIL** | 4 | 4 | 4 | P1 E1: Browser Back from any People-tile link lands Home at the top of the page, not where the reader was (5/5 desktop trials; scroll position lost). |
| people | personProfile | pass | 4 | 3 | 4 |  |
| places | places | **FAIL** | 4 | 3 | 4 | P1 places-D5: On phone the map-pin destination is visibly broken: the place panel is a ~660px-wide overlay on a 390px map with its header/close control cut off, and the URL is rewritten to /places/&lt;slug> while still showing the map<br>P1 places-B3: Cross-cutting (all infinite-batch tiles incl. places/placeProfile): appending a batch shifts on-screen content — layout-shift entries of 0.24-0.26 with no input, sourced from infiniteTile.tile-places et al.; react-masonr |
| places | placeProfile | **FAIL** | 3 | 4 | 4 | P1 placeProfile-E2: Back from the profile's 'Open &lt;place>' deeplink (a reserve/infinite tile deep in the feed) returns to a reshuffled page: tile count 65→66 / 66→68, the two masonry columns re-split (tile-notes became tile-art at the sa |
| matters | mattersNarrative | pass | 4 | 4 | 4 |  |
| matters | mattersMaterial | pass | 3 | 4 | 4 |  |
| matters | mattersConcept | pass | 3 | 3 | 4 |  |
| matters | matterProfile | pass | 3 | 4 | 4 |  |
| scripture | text | pass | 4 | 4 | 5 |  |
| scripture | commentary | pass | 3 | 4 | 4 |  |
| scripture | notes | **FAIL** | 4 | 4 | 5 | P1 notes-D4: 'See in context' (href /read/mormon.8/23) lands on the Read page at the chapter top (scrollY 0 for 15s), with the verse segment stripped from the URL (/read/mormon.8); verse 23 is marked .highlighted but sits several scr |
| scripture | refpill-popup | **FAIL** | 4 | 4 | 5 | P1 popup-B4: A detected relative reference ('v. 25' inside a commentary excerpt) becomes a RefPill; clicking it opens a popup titled 'v. 25' whose only content is 'Could not load your reading plan.' (an unrelated reading-plan error l |
| scripture | cross-cutting | pass | 4 | 4 | 5 |  |
| archive | fax | pass | 4 | 4 | 4 |  |
| archive | faxVerse | pass | 3 | 3 | 4 |  |
| archive | history | pass | 3 | 3 | 4 |  |
| archive | josephSmith | pass | 3 | 3 | 4 |  |
| archive | witness | pass | 3 | 4 | 4 |  |
| analysis | biblephrases | **FAIL** | 4 | 4 | 4 | P1 XC2-biblephrases-B2-E2: Cross-cutting (biblephrases, chiasmus): the self-fetching tiles remount in `loading` on every Back, replace their content with a fixed-height skeleton (320/400px) and then re-fill at a different height (241-461 / 311-488<br>P1 XC3-biblephrases-E2: Cross-cutting (all tiles incl. artFill/chiasmus2 reserves): once infinite batches exist, Back re-runs the balancer and inserts two reserve tiles mid-page, shifting every tile below by two slots. |
| analysis | chiasmus | **FAIL** | 4 | 4 | 4 | P1 chiasmus-D5-phone: The 'See in context' destination (/analysis/chiasmus/:id) clips its chiasm lines and the Previous / Read in context / Copy link / Next bar at the right edge of a 390px phone; text is cut mid-word above the fold. |
| analysis | art | **FAIL** | 3 | 4 | 4 | P1 art-D4-read-landing: 'See in context' (/read/&lt;book>.&lt;ch>/&lt;verse>) lands at the top of the chapter: the target verse is highlighted but sits 1.7 screens below the fold, the page never scrolls to it, and the URL is rewritten to the ba |
| story | mapstory | **FAIL** | 3 | 4 | 4 | P1 B2: Autoplay changes the tile's height every few seconds: the beat card's fixed reserve (min-height 10.5rem = 168px) is smaller than beats that carry a 3-line description plus a Read-more pill (180px), so the footer and ever |
| story | community | pass | 3 | 3 | 4 |  |

Fixes after round 2:

- **people:** `d600bc2b`, `443eb62f`
- **places:** `18440755`, `448f5731`, `bd7f43af`, `41000603`, `bd4ea7c0`, `3384d64c`
- **scripture:** `d1728730`, `506bf6bf`
- **analysis:** `26f6a998`, `0c534fd4`, `eee7c8f0`, `77f5fff3`
- **story:** `092b2a8b`

### Round 3

| Family | Tile | Verdict | C | B | L | P0/P1 findings |
|---|---|---|---|---|---|---|
| people | people | pass | 4 | 4 | 4 |  |
| people | personProfile | pass | 4 | 3 | 4 |  |
| places | places | **FAIL** | 3 | 3 | 4 | P1 E1: Browser Back from a card or map pin intermittently lands thousands of px from where the reader left (cross-cutting: Sampler anchor/batch restore, not tile-owned) |
| places | placeProfile | pass | 4 | 4 | 4 |  |
| scripture | text | pass | 4 | 4 | 5 |  |
| scripture | commentary | pass | 3 | 3 | 4 |  |
| scripture | notes | **FAIL** | 3 | 4 | 5 | P1 notes-A1: No verse window: the tile renders the note's entire reference range, so a note on Moroni 7:20-39 becomes a 1343px wall of 20 verses (3 Nephi 4:1-14 = 515px, 1 Nephi 19:8-21 = 589px) with the one-line gloss at the very bo<br>P1 notes-B2: Rug-pull after paint (also B1/B3, one root cause): the passage is fetched after mount behind a fixed 7.5rem placeholder, so the tile grows once the verses land - measured +53 to +234px on short refs and ~+1200px on the M |
| scripture | scripture-popup | pass | 4 | 4 | 5 |  |
| analysis | biblephrases | **FAIL** | 2 | 3 | 4 | P0 D5: "See in context" lands on a spinner that never resolves whenever the tile already cached the pair (every 1-reference chapter pairing seen)<br>P1 B2: Self-fetch pop-in resizes the tile while it is on screen, shoving the column below |
| analysis | chiasmus | **FAIL** | 3 | 4 | 4 | P1 B2: Chiasm resolves to a different height than its skeleton while on screen, yanking the tile below |
| analysis | art | **FAIL** | 3 | 4 | 4 | P1 B2: The 18rem excerpt placeholder collapses to the real excerpt while the tile is on screen, pulling the next tile up by 64-171 px |
| story | mapstory | pass | 3 | 3 | 3 |  |
| story | community | **FAIL** | 4 | 4 | 4 | P1 D4: Tapping the pull quote lands on the channel page with the quoted message far below the fold and the message panel unscrolled, so the reader cannot tell they arrived at the message they chose |

### Cycle 2 (2026-10-17 → 10-20)

Started with fixers for the round-3 failures (analysis, scripture, places, story), then full 8-family rounds. Paused once on a usage limit (the interrupted archive fixer was committed as `f37d6f49` and completed on resume).

Start fixes: **analysis** `bfd8772f`, `bc9835e8`; **scripture** `cf992ece`, `c5867cf4`; **places** `59335a2b`; **story** `23e01564`

#### Round 4 — 19 pass / 6 fail

| Family | Tile | Verdict | C | B | L | P0/P1 findings |
|---|---|---|---|---|---|---|
| rail | readingplan | pass | 4 | 3 | 4 |  |
| rail | section | pass | 4 | 4 | 4 |  |
| rail | contents | pass | 4 | 3 | 4 |  |
| people | people | pass | 4 | 4 | 4 |  |
| people | personProfile | pass | 4 | 3 | 4 |  |
| places | places | pass | 4 | 3 | 4 |  |
| places | placeProfile | **FAIL** | 4 | 4 | 4 | P1 E1: Phone: the first Back from the profile's "Open &lt;place>" link lands ~400px too low (the tile's hero and eyebrow are above the viewport, the reader is dropped mid-prose); reproduced 2/2, desktop clean 3/3 |
| matters | mattersNarrative | pass | 4 | 4 | 4 |  |
| matters | mattersMaterial | pass | 4 | 3 | 4 |  |
| matters | mattersConcept | pass | 4 | 3 | 4 |  |
| matters | matterProfile | pass | 3 | 3 | 3 |  |
| scripture | text | pass | 4 | 4 | 5 |  |
| scripture | commentary | **FAIL** | 2 | 3 | 3 | P1 H4: In 2 of 5 desktop seeds one of the three commentary slots rendered an exact duplicate of a sibling (same id, title, cover) while the third base commentary was missing; phone and tablet rendered three distinct ones from t<br>P1 C4: The Layer-2 deeplink can dead-end: /commentary/1569518101 ('What is the difference between transfiguration and translation?') renders a not-found card both on fresh load and via the tile's 'See in context' (1 of 4 ids te |
| scripture | notes | pass | 3 | 4 | 4 |  |
| scripture | refpill-popup | pass | 4 | 4 | 5 |  |
| archive | fax | **FAIL** | 3 | 4 | 4 | P1 fax-D4: Page deeplink lands on a different folio than the one the tile shows: thumbnail + ref bar say Words of Mormon 1:17 (printed p.145), label says p. 154, and /fax/1981/154 opens Mosiah 3:22–4:4 |
| archive | faxVerse | pass | 4 | 4 | 5 |  |
| archive | history | pass | 4 | 4 | 4 |  |
| archive | josephSmith | pass | 3 | 4 | 4 |  |
| archive | witness | pass | 4 | 4 | 4 |  |
| analysis | biblephrases | **FAIL** | 3 | 3 | 4 | P1 E1: Chained link→Back cycles from this tile do not restore scroll: second Back landed 757px above the tile, the next 752px below; a single Back after pre-scrolled batches landed 154px low with the tile's heading cut off (cro |
| analysis | chiasmus | **FAIL** | 3 | 4 | 4 | P1 E1: Browser Back after a second link from this tile landed 6,496px away (tile had moved; a batch-copy chiasmus was pinned instead), a speaker-link Back drifted 200px, and a heading-link Back on phone drifted 385px; first-vis |
| analysis | art | **FAIL** | 3 | 4 | 4 | P1 E1: Every chained Back from this tile landed 153px low (tile header scrolled off the top): CTA +153, art-title link +70, CTA +153 again; shared root cause with chiasmus/biblephrases |
| story | mapstory | pass | 3 | 3 | 3 |  |
| story | community | pass | 4 | 3 | 4 |  |

Fixes after round 4: **places** `72796d9b`, `25e7bdd0`; **scripture** `e9328105`, `853d2909`, `1ca05844`, `452cc89c`, `cf5a710b`, `0bcd42d1`, `1cc71c44`; **archive** `f37d6f49`; **analysis** `6924c885`, `a58d6921`, `bec47564`, `032767b4`

#### Round 5 — 20 pass / 4 fail

| Family | Tile | Verdict | C | B | L | P0/P1 findings |
|---|---|---|---|---|---|---|
| rail | readingplan | pass | 4 | 3 | 4 |  |
| rail | section | **FAIL** | 3 | 3 | 4 | P1 narration-C1: On touch viewports the ref pill's invisible 44px hit area (::after inset -15px -4px) covers the first ~50px of every wrapped beat link's second line, so tapping visible link text ('steadfast in the faith.' etc.) opens th |
| rail | contents | pass | 4 | 4 | 4 |  |
| people | people | pass | 4 | 4 | 4 |  |
| people | personProfile | pass | 4 | 3 | 4 |  |
| places | places | pass | 4 | 4 | 4 |  |
| places | placeProfile | pass | 4 | 4 | 4 |  |
| matters | mattersNarrative | pass | 4 | 4 | 4 |  |
| matters | mattersMaterial | pass | 4 | 3 | 4 |  |
| matters | mattersConcept | pass | 4 | 3 | 4 |  |
| matters | matterProfile | pass | 3 | 3 | 3 |  |
| scripture | text | **FAIL** | 4 | 4 | 5 | P1 xc-popup-E3-scrolljump: Opening the shared scripture popup from a tile intermittently throws the page to a different scroll position, and closing it leaves the reader there (lost place). Observed 2 of 8 fresh-page openings; 0 of 6 targeted re-p |
| scripture | commentary | **FAIL** | 3 | 3 | 4 | P1 commentary-D5-curtain: 'See in context' lands on a blank dark-navy curtain for 8-17s while the URL bounces through the host page (/jesus/64 -> /jesus/74 -> /commentary/:id) before the commentary note finally opens; a 3.5s look shows an empty g |
| scripture | notes | pass | 3 | 3 | 4 |  |
| archive | fax | pass | 4 | 3 | 4 |  |
| archive | faxVerse | **FAIL** | 3 | 4 | 4 | P1 XC-E1: Cross-cutting (faxVerse, history; drift also seen beside josephSmith): browser Back lands hundreds of px from where the reader left and never corrects — reproduced 5 times: faxVerse CTA→Read 678px off (desktop) and 388px |
| archive | history | pass | 4 | 3 | 4 |  |
| archive | josephSmith | pass | 4 | 4 | 4 |  |
| archive | witness | pass | 3 | 4 | 4 |  |
| analysis | biblephrases | pass | 4 | 3 | 4 |  |
| analysis | chiasmus | pass | 4 | 4 | 4 |  |
| analysis | art | pass | 3 | 4 | 5 |  |
| story | mapstory | pass | 4 | 3 | 4 |  |
| story | community | pass | 3 | 3 | 4 |  |

Fixes after round 5: **rail** `f51a170a`, `3a3f95ab`, `4bc19c0e`; **scripture** `05277e66`, `bef49323`, `f70611fb`, `369376f9`; **archive** `977feba5`, `4c160a5b`

#### Round 6 — 16 pass / 8 fail

| Family | Tile | Verdict | C | B | L | P0/P1 findings |
|---|---|---|---|---|---|---|
| rail | readingplan | pass | 4 | 3 | 4 |  |
| rail | section | pass | 4 | 4 | 4 |  |
| rail | contents | pass | 3 | 4 | 4 |  |
| people | people | **FAIL** | 4 | 4 | 4 | P1 people-E2: Expanded featured bio is lost on Back: the tile remounts collapsed and its CTAs jump, unlike every sibling profile tile which restores its expansion (cross-cutting with personProfile; one root cause in PersonFeature.js). |
| people | personProfile | **FAIL** | 4 | 3 | 4 | P1 personProfile-E2: Same root cause as people-E2 (PersonFeature without persistKey), but worse here: a reader who expands a deep-feed profile, taps Open and comes Back finds the bio collapsed and the tapped CTA (and most of the tile) scroll |
| places | places | pass | 3 | 4 | 4 |  |
| places | placeProfile | pass | 4 | 4 | 4 |  |
| matters | mattersNarrative | pass | 4 | 4 | 4 |  |
| matters | mattersMaterial | pass | 4 | 3 | 4 |  |
| matters | mattersConcept | pass | 3 | 3 | 4 |  |
| matters | matterProfile | **FAIL** | 2 | 3 | 3 | P1 A1: On touch viewports (phone 390, tablet 820) the collapsed description clamp slices the fifth line through the middle and leaves a sliver of the next line's ref chip showing under the fade: the 14px touch padding is counte |
| scripture | tile-text | pass | 4 | 4 | 5 |  |
| scripture | tile-commentary | **FAIL** | 3 | 4 | 4 | P1 commentary-G2: Keyboard Tab into a clamped commentary scrolls the overflow:hidden excerpt (scrollTop up to 1083px) so the collapsed prose shows a sliced line under the title and loses its opening; the ref pills hidden under the clamp s<br>P1 commentary-E1: Seen once (dark sweep): after a commentary deeplink and Back, a later Back from the notes Read page landed on /commentary/1521304102 as a blank navy page with zero tiles and a 'Cannot read properties of null (reading slu |
| scripture | tile-notes | **FAIL** | 3 | 4 | 5 | P1 notes-D4: On phone, See in context lands the Read page with the annotated verse under the fixed bottom nav: verse 50 top at y=766 in an 844px viewport whose bottom-nav starts at 780, so the reader sees the previous section and not |
| archive | fax | pass | 3 | 4 | 4 |  |
| archive | faxVerse | pass | 3 | 3 | 4 |  |
| archive | history | pass | 3 | 3 | 4 |  |
| archive | josephSmith | **FAIL** | 2 | 4 | 4 | P1 josephSmith-C3: The tile sometimes renders with NO Layer-2 link at all (no Read more, no See in context): the reveal gate is registered on a pre-paint measurement that overflowed (fallback font), never un-registered when the re-measure  |
| archive | witness | pass | 3 | 4 | 4 |  |
| analysis | tile-biblephrases | pass | 4 | 4 | 4 |  |
| analysis | tile-chiasmus | pass | 4 | 4 | 4 |  |
| analysis | tile-art | **FAIL** | 3 | 3 | 4 | P1 art-A1/F1-aspect: The artwork frame has no aspect cap, so a tall portrait source (186×600) becomes a 1526px-tall tile at desktop, 1469px on phone and 2837px on the 820px tablet — one tile spanning two to three viewports, breaking the colu |
| story | mapstory | **FAIL** | 3 | 3 | 3 | P1 mapstory-E1: Browser Back from the story title link can land hundreds of px away from where the reader left when the page was scrolled by keyboard focus / the tile top sat just above the fold |
| story | community | pass | 3 | 3 | 4 |  |

### Cycle 3 (2026-10-20): systemic hardening, rounds 7–9

A systemic fixer read all 69 P0/P1 findings from rounds 1–6 and fixed each recurring class once in the shared layer: clamps are `overflow: clip` with a shared Tab guard (`02f2cd39`, `31e73d4b`); every reveal persists per tile identity across Back (`b9e04c09`); fade clamps snap to whole lines (`1c7234de`); tile images are portrait-capped at 3:4 (`46e5414f`); deeplink targets land between the fixed bars (`a2fd8ae0`); the Back pin holds the clicked link (`975d98d2`). Per-family fixers followed.

| Round | Pass | Fail |
|---|---|---|
| 7 | 17 | 8 |
| 8 | 22 | 3 |
| 9 | 20 | 5 |

Round 9 failures fixed directly (each with a regression test and a live check): guest phone `/home/user` crashed the app — P0, null progress row (`7f43a4e8`); the Tab guard demoted chips of unclipped notes (`cfb2b4cb`); the phone fax viewer opened on the unlabeled roman-0 slot (`6cd61ef8`); the community index showed one group and a blank pane (`df628e2a`). Back edge cases: 24/24 within 1px (desktop/phone, first batch and deep feed).

### Cycle 4 (2026-10-20): rounds 10–11

| Round | Result |
|---|---|
| 10 | 25 of 26 tiles pass; only mapstory failed (P1 E1: chained Backs through different links landed 538–807px off) |
| 11 | interrupted at session end after 4 of 8 families; all passed except mapstory (P1 F1: a one-finger phone swipe on the map panned the map instead of scrolling) |

Fixed after rounds 10–11: map-story labels/dwell/touch targets (`b6eef433`, `a0a8955f`); cooperative touch gestures — one finger scrolls the page, two pan the map (`6e152e4c`, verified with raw touch events); the Back anchor keys the clicked link by href + label (`9148aa82`, `verify-back-chain-mapstory.mjs` 10/10 within 1px).

Round 13 (fresh full 8-family round) did not run: every reviewer stopped on exhausted Fable usage credits. A clean blind round on the current `dev` is still outstanding.

### Final round (2026-10-20): lean Sonnet review, no Fable

Fable was dropped from the process (cost). One blind round, 8 fresh Sonnet reviewers (one per family; desktop + phone only, 2 seeds/tile, rubric-only, no fixers; ~0.7M tokens). Pass bar unchanged: no P0/P1, Craft/Beauty/Belonging ≥ 3.

| Family | Tile | Verdict | C | B | L | P2 | P3 |
|---|---|---|---|---|---|---|---|
| rail | readingplan | pass | 4 | 3 | 4 |  | 3 |
| rail | narration | pass | 3 | 3 | 4 | 3 | 3 |
| rail | contents | pass | 4 | 4 | 4 | 1 | 2 |
| people | people | pass | 4 | 4 | 4 | 2 | 2 |
| people | personProfile | pass | 4 | 4 | 4 | 1 | 1 |
| places | places | pass | 4 | 4 | 4 | 2 | 2 |
| places | placeProfile | pass | 4 | 4 | 4 | 2 | 2 |
| matters | mattersNarrative | pass | 4 | 4 | 4 | 1 | 5 |
| matters | mattersMaterial | pass | 4 | 4 | 4 |  | 2 |
| matters | mattersConcept | pass | 4 | 5 | 4 |  | 2 |
| matters | matterProfile | pass | 5 | 4 | 5 |  | 2 |
| scripture | text | pass | 4 | 4 | 4 | 2 | 3 |
| scripture | commentary | pass | 3 | 3 | 4 | 1 | 3 |
| scripture | notes | pass | 4 | 4 | 5 |  | 4 |
| archive | fax | pass | 4 | 4 | 4 |  | 1 |
| archive | faxVerse | pass | 3 | 3 | 4 | 2 |  |
| archive | history | pass | 3 | 3 | 4 | 2 | 2 |
| archive | josephSmith | pass | 4 | 4 | 4 |  | 2 |
| archive | witness | pass | 3 | 4 | 4 | 1 | 1 |
| analysis | biblephrases | pass | 4 | 3 | 4 | 1 |  |
| analysis | chiasmus | pass | 3 | 4 | 4 | 3 | 1 |
| analysis | art | pass | 4 | 4 | 4 |  | 3 |
| story | tile-mapstory | pass | 4 | 5 | 4 | 2 | 5 |
| story | tile-community | pass | 3 | 3 | 3 |  | 1 |

**Result: 24/24 observed tiles pass, 0 P0/P1.** Not run (budget): tablet, dark mode, Korean, logged-in, infinite-batch rug-pull timing. Remaining P2/P3s are recorded in the review output (polish: back controls on some destination pages, phone tap heights, spacing); none block shipping.

## R6. Deploy — 2026-10-20

`dev` fast-forwarded to `prod` at `a2ece831` (198 commits); CI run 39470831845 (build-push + blue-green deploy via the self-hosted runner) succeeded. Prod smoke (desktop + phone, 15 checks): Home renders; People at y=332 on phone (single column, was ≈4000); warm CLS 0.000; 92/38 media variants served with 0 errors; one Back from a tile link returns to `/home`; guest `/home/user` renders on phone (was a whole-app crash); `/matters/narrative` shows the index (was "Not found"); no page errors.

**Known, accepted (P2):** infinite-feed scroll CLS measures 0.014–0.13 under a deliberately aggressive scroll (14 screens / 600ms) because commentary tiles settle 277 → 240px and faxVerse ~30px after mount; 0.059 in the standard page pass (the web-vitals "good" bar is 0.1). Other open P2/P3s are listed in the review rounds above. Not covered: tablet / dark / Korean / logged-in sweeps in the final round; the route-backed entity modal (deferred by decision).

**Process note:** the Fable-based blind review (13 rounds) was dropped after cost; the final gate was one lean Sonnet round (24/24 tiles pass) plus the live verification scripts.

## R7. Follow-ups — 2026-10-20 (soak, archive image variants, state sweeps)

Plan: `docs/plans/2026-10-20-home-tiles-followups.md` (executed inline, no subagents).

### Soak of the 2026-10-20 deploy (first reading, ~19 h of NPM telemetry)
161k requests; **51 returned 500 (0.03%)**. Pre-deploy bursts on `/` (SSR) are older. One cluster at 18:31–18:40 UTC (crawler SSR: `/art/2515`, commentaries, `/people/moroni1`) coincides with a **DB connection refused** blip (`ECONNREFUSED …:3306`). `/people/moroni1` kept returning 500 for crawlers hours later, with cache-busting making no difference: GraphQL errors arrive as HTTP 200, so Next's data cache stored the failed response for the 1 h revalidate window. **Fixed** in `frontend/next/lib/graphql.ts`: an errors-bearing response is re-asked once with `cache: 'no-store'` before throwing (4 new tests; 99 Next unit tests pass). Takes effect on the next deploy. A second reading ~24 h after the deploy is still to be appended.

### Archive image variants
Enumerated with S3 `ListObjectsV2` (not the API): art 2,625 · history thumbs 582 · history pages 3,367 (5.1 GB of originals) · fax thumbs 35,159 · fax covers 59 · source covers 67 · witness portraits 21 = **41.9k originals → 48.5k WebP variants** (≈1.4 GB; fax thumbs and source covers 256 px only — their originals are ~261 px wide). Variant keys follow the path the tile requests (S3 holds `art/1000.jpg`, tiles request `art/1000`) — a mismatch caught in the dry run before upload. Spot check: 18/18 random keys `200 image/webp`. Live (new frontend against the prod API, desktop deep scroll): **8.3 MB → 2.2 MB; phone 4.4 MB → 2.0 MB**, 0 broken, 0 4xx. Archive tile images now pass `sizes` (a static test guards it). Page pass: warm CLS 0.000, scroll CLS 0.000–0.018 (one 0.477 outlier during Vite warm-up did not reproduce in 3 reruns); Back edge cases 6/6 desktop + 6/6 phone.

### State sweeps (tablet 820, desktop dark, phone dark; `scripts/home-audit/sweep-states.mjs`)
No horizontal overflow, no broken images, no tile over 1.5 viewports, **0 low-contrast text nodes in dark mode (731 sampled)**, a visible focus style on every tabbed control, 0 page errors, CLS ≤ 0.018. Screenshots read: dark and tablet layouts are coherent (neutral surfaces, gold accent, no glare).

### Korean (host-mapped Chromium `kr.bomtest.test` → Vite; `/graphql/ko`)
Hangul wraps cleanly, no overflow or clipping. Found and fixed: `<html lang>` was `en` on every language host (now `htmlLangFor`, BCP-47-mapped). Remaining English on the Korean host is (a) **22 tile labels with no Korean row** (PEOPLE, PLACES, CONTENTS, "Read more", "Start reading", "See in context", "View all"…) and 12 keys used only through code fallbacks, and (b) English-only source data (history documents, names, matter glosses). The label fix is prepared as `scripts/sql/2026-10-20-home-labels-ko.sql` (idempotent) and **not applied**: it needs KC's go and a reachable DB. `hardcodedStrings.test.js` (47 checks) confirms no tile hardcodes English.

### Logged-in branches
Component tests for `ReadingProgressTile` (signed-in header/tooltip, three response shapes) pass; the other branches were already covered.

### Environment finding
This dev machine cannot reach the database host over TCP (`ETIMEDOUT`; prod is fine; Chromium also logged `ERR_NETWORK_CHANGED` earlier) — likely the public IP no longer matches the DB firewall's allowed admin IP. Not touched (AWS security groups are out of scope). Live checks used a second Vite serving the new frontend against the prod API.

### Self-review of the follow-up diff — deferred minors
- `gql()`'s uncached retry would, under static generation (e.g. the pinned-`lang` sitemap), surface a dynamic-server error instead of the GraphQL error on an already failing request.
- `with-prod-secrets.sh ssh` leaves the 0600 key file in `$XDG_RUNTIME_DIR` after the command (`exec` prevents cleanup).
- 2 keys listed under the archive prefixes had no original on the CDN, and `art/sh.sh` is a stray non-image object; neither affects tiles.
- New media added later has no variant until `build-media-variants.mjs --families … --upload` is re-run (idempotent); until then the tile falls back to the original.
- `rp_*` reading-plan wizard strings and `home_tab_explore` still lack Korean rows (not tile-visible).

### R7 post-deploy (prod `1206135f`, CI run 39494841636 success)
`prod-smoke.mjs` 15/15; **`/people/moroni1` for a crawler: 500 → 200**; desktop deep-scroll images **8.3 MB → 2.75–2.8 MB** (3 runs, 0 originals, 0 broken, 0 4xx), phone 4.4 MB → 1.6 MB. (A reading ~1 min after the swap showed 7.6 MB while the edge still served the old bundle.) Open: the second soak reading ~24 h after the deploy; the Korean label SQL (needs KC + a reachable DB); `<html lang>` fix is deployed but the CRA shell still ships `lang="en"` in the static HTML (it is corrected on boot).

## R8. First real click — 2026-10-20 evening

**Finding (KC's first manual pass, after 13 review rounds):** Discover → place tile → full page → the page's own "‹ Places" control → landed in the Places index, out of Discover. The harness only ever pressed the *browser* Back button; it never clicked the page's own back control or the tile → popup path. (Product decision of record: places/people/matters open a popup that can maximize; never an immediate page switch.)

**Fixed + on prod (e7be1739, baedf477):**
- `tiles/_ds/entityPopup.js`: one delegated handler on the Sampler root opens the existing popup for tile links to `/people|places|matters/<slug>` (modified clicks, `target=_blank`, and matter-group index links navigate normally).
- `EntityPage`: the top/bottom back control is a history Back when the reader arrived in-app (as `ArtPage` already did); direct loads keep the index link.
- Phone drawer: Full-page + close toolbar, and a Matter drawer (`matters` had no drawer branch and rendered the raw type name).
- `_Common/navPath.js`: sidebar and bottom bar follow the page under a popup (they highlighted Places / Study over a Discover popup).

**CI:** `ci-build` had been red on every push since `b9e04c09` (hooks after an early `return null` in `NarrationTile`, `react-hooks/rules-of-hooks`). Fixed in `8bf95cba` (dev; green). It stays red on the `prod` branch until that commit is deployed. Lesson: run `npm run lint` before pushing, not only vitest.

**New verification (`scripts/home-audit/click-sweep.mjs`, `verify-entity-popup.mjs`):** every control in every tile clicked on prod, phone and desktop (~270 controls): **0 dead-end / blank / "Not found" destinations**, entity links open the popup, no page errors apart from 429s caused by the sweep itself.
- Back, isolated with real input: link offset **0–15 px** at 12/50/88% of the viewport, at feed depths 0–8, and over **9–11 consecutive round trips per viewport in one session** (±1 px). All 88 desktop tiles had identical content after a round trip; on phone, four self-fetching tiles went unloaded → loaded (not a swap).
- The sweep's own "control moved after Back" flags did **not** reproduce with real input. Harness traps found along the way: `scrollIntoViewIfNeeded` honors the site's smooth scroll; programmatic scrolls don't cancel `pinAnchor`'s 3 s window; the default headless UA is classed as a crawler; DOM attributes added by a script vanish after Back (tiles remount); `aria-hidden`/`tabindex=-1`/`data-clamp-hidden` controls are not real controls. Treated as sweep artifacts, not defects.

**Soak reading 2 (≈6 h after the second deploy, 27.4k requests):** 3 × 5xx (2 on `/` SSR, 1 on the analytics proxy path); no container errors. 429s: **1,785 — correction:** an earlier check of mine reported zero because it compared a number to the string status; 1,250 of them are my own harness (one IPv6 address, iPhone UA, `/fax/*` and `/commentary/*`), the rest are DotBot/AhrefsBot-style crawlers being limited as intended. A lone human visit gets **zero 429s** even on `/fax/1852` (~600 requests). 912 × 403, all on the analytics reverse-proxy path (my harness plus ~45 real Windows/Mac requests): an analytics-collection quirk, not a Discover issue (path is an env-only secret; not recorded here).

**Still open:** deploy `8bf95cba` to prod (needs KC's go); Korean label SQL (needs KC + reachable DB); soak reading 3 at ≈24 h; the analytics-proxy 403s for real browsers (low priority).

### R8 addendum — Korean labels applied, 2026-10-21 (KC approved)
`scripts/sql/2026-10-20-home-labels-ko.sql` applied to prod `bom_prd` from inside the prod container (dev machine can't reach the DB; creds never left the box). Dry-run (rolled-back transaction) first, then apply: **46 rows** (12 new English label keys + 34 Korean), then **6 more** (matter-group names). Read-back and the live Korean host (`몰몬경.kr` = `xn--289a67xla.kr`; note `kr.bookofmormon.online` 301s to English) confirm Korean eyebrows: 인물, 장소, 경전, 해설, 목차, 사본, 성경 언어, 주제 개념 / 물건, `<html lang="ko">`.
- **My SQL was wrong once:** `bom_translation` has no unique key on (guid, lang, refkey), so `INSERT IGNORE` would not dedupe; the file is now `NOT EXISTS`-guarded and re-running it was proven a no-op (48 of 54 statements skipped).
- **Translation calls (mine, not KC's — please review):** `matters_group_concepts`→개념, `matters_group_material`→물건, `matters_group_narrative`→이야기; `read_more`→더 보기, `people`→인물, `places`→장소, `reading_now`→읽는 중, `start_reading`→읽기 시작, `view_in_context`→문맥에서 보기, `n_pages`→`$1쪽`, others in the file.
- **Case-sensitive keys:** the label dictionary is case-sensitive; `HistoryTile` asked for `history` but the table key is `History` (already translated). Fixed in code (`ba1eab40`, dev); still English on Korean until deployed.

### R8 soak reading 3 — 2026-10-21 04:14Z, last 90 min (spans the final deploy at 04:10Z; ~8.2k requests)
4 × 5xx (0.05%): 2 × `/` SSR 500 (02:57, 03:37 — before the final deploy, matching the known transient SSR 500s) and 2 × 502 on `/fax/render/<edition>/crop/w800/alma-43.15.jpg` (xn--289a67xla.kr, 04:13:10, ~2.8 s each) three minutes after the container swap, i.e. during my own verification loads of the Korean Home. Re-requested both afterwards on both hosts: **200 image/jpeg** (cold 1.1–1.4 s on the Korean host, 0.3–0.4 s on the main host, warm 0.66 s). Not reproducible; treated as a post-swap cold-start transient — if it recurs, look at the crop renderer's first-request latency and the swap's readiness check. Container error logs: none. 429s in this window (262) are the same bots + my harness; 403s are the analytics-proxy path (see above). This is reading 3 of the planned series, not the 24 h reading.

### R8 — sweep "Back moved" flag resolved for the repeated case (2026-10-21)
The click-sweep repeatedly flagged the art tile's "See in context" (`/read/helaman.5/27`) as -610 px after Back on phone. Re-tested that exact link with real scrolling at 20 / 55 / 85 % of the viewport, phone and desktop, plus the History tile's "See in context": **Δ 0 (worst 1 px) in all 12 trials.** The sweep's flags for this class are sweep artifacts (its inventory/locator/scroll interplay), not product defects. Other sweep-flagged classes were each re-tested in isolation earlier in R8 (index-page eyebrows, contents/fax/commentary links, 14-visit chains) with the same result.

### R8 soak reading 4 — 33 h after the final deploy (2026-10-21 04:10Z → 2026-10-22 14:02Z; 106,269 requests)
**5xx: 12 (0.011%), all `500` on `/` SSR, all within 4 s (06:23:49–53Z) from one Windows-UA client** (~30 ms each) that sent 35 `/` requests in 25 s (23 × 303, 12 × 500, 18 × 429 from the rate limiter). Other SSR requests in that window: 41 of 41 × 200, so it was not an outage. Re-tested `/` on both hosts with plain / navigate / navigate+`ko-KR` headers and a 6-request burst: **all 200**. Treated as one scripted client hitting an edge case; no visitor-facing defect found. (Open question, low priority: why that client's request shape makes the `/` SSR throw in 30 ms — worth a look only if real browsers ever show up in it. Zero 5xx from non-browser-class traffic besides it; zero 5xx on any Discover route, popup, entity, fax, art or commentary path.)
Containers `Up 34 h (healthy)`; error-grep shows only crawler `render-decision` JSON lines and `415 Unsupported Media Type` (bots POSTing wrong content types). 429s (6.5k) are bots + my harness as before; 403s the analytics path.
