# Names View — Frontend Design Audit

**Date:** 2026-07-16
**Scope:** `frontend/webapp/src/views/Analysis/Names/` (`Names.js`, `Names.css`, `data.js`) as of the filter wiring landed earlier today.
**Method:** live audit against the CRA dev server on `localhost:8200` in headless Chromium — desktop 1440px (light + dark via `html[data-theme="dark"]`), mobile 375px, dropdown/hover/keyboard states, plus the `/analysis` landing page as the entry context. Computed-style probes for typography, focus visibility, and contrast.

---

## 1. Verdict

The machinery now works — 210 names, six live facets, correct AND/OR semantics — but the page presents a rich dataset as an undifferentiated wall of gray pills behind a row of jargon-labeled dropdowns. Nothing on the surface shows *why* these names are interesting: the morphology, cultures, glosses, and family relationships in `data.js` are invisible until you already know what to ask for, and the only payoff for asking is a smaller wall of pills. The single biggest defect is a false affordance: every tile advertises clickability (`cursor: pointer`, hover lift) and does nothing. Dark mode has one outright bug (hover erases the text) and one contrast failure. Mobile loses two of the six filter columns entirely.

The fix direction is not more chrome — it's letting the dataset be the design: the segmentation and culture tags the view already owns should be visible on the tiles, in the dropdowns (as counts), and in a click-through detail. Specific recommendations in §5.

## 2. Look

### The wall
- 210 identical 31px-tall pills in a uniform grid: no grouping, no size/weight variation, no color information. Alphabetical order is the only structure, and it's the least interesting ordering this dataset supports. A person landing here reads "list of words," not "name system with families and origins."
- The `/analysis` landing card for Names is a warm photograph of paper tags; clicking through lands on the most visually austere page in the Analysis suite. The entry sets an expectation the page immediately drops.
- Every piece of the scholarship — types, cultures, morphemes, notes — is hidden behind a native `title` tooltip: ~1s hover delay, invisible on touch, not announced by screen readers by default.

### Typography
- Everything is Roboto Condensed: title 42px/700, column headers 19.2px/800, tiles 14px, status line 14px. One face at three sizes is monotone rather than minimal; nothing distinguishes data (the names) from apparatus (the controls).
- The six column headers are the loudest elements on the page (800 weight) yet label empty "Select…" boxes; the actual content whispers below them.
- **Prefix / Stem / Affix / Suffix** is linguist vocabulary offered with zero explanation, and the tilde notation (`Am~`, `~iah`) appears only inside dropdowns, unexplained. The `ThWithPopup` stub that existed in the original scaffold (removed in the rewrite) was clearly intended to gloss these — the need it addressed is real.

### Consistency nits
- Inline styles fight the stylesheet: the tile's inline `border: 1px solid #ddd` overrides `.nameAnalysisItem`'s `#ccc`; the `h3` carries leftover `whiteSpace: nowrap / textOverflow: ellipsis / flexGrow: 0` inline styles.
- That `h3` style truncates the page title to **"Book of Mormo…"** at 375px — the page's own name is the first casualty of mobile.

### Dark mode (`html[data-theme="dark"]`)
- **Bug — hover erases text:** tiles inherit white text from `.main-panel`, and `.nameAnalysisItem:hover` hardcodes `background-color: #f9f9f9`. Confirmed computed: `color: rgb(255,255,255)` on `background: rgb(249,249,249)`. Hovered names vanish.
- **Contrast failure:** the status line hardcodes `color: #666` on the dark `#1a1a1a` canvas ≈ 3.1:1 — below AA for 14px text.
- The rmsc dropdown fields stay white-on-white-theme (untinted by the dark token layer), so the filter row floats as a light band on the dark canvas. Every other themed view routes these through `darkmode/_*.scss`; Names has no dark-mode coverage at all.

## 3. Behavior

- **False affordance (top issue):** `cursor: pointer` + hover lift on every tile, no `onClick`. Users will click 210 times and get nothing. Either remove the pointer/hover treatment or ship the detail interaction — the current state is worse than either.
- **Dropdowns are stock rmsc defaults.** "Select All" on a 136-option stem list is meaningless (selecting all stems matches everything). Options carry no counts, so nothing distinguishes a productive family (`Mor` → 9 names) from a singleton (`Abl` → 1); the alphabetical option order buries the interesting stems.
- **The filter model is right but unstated.** OR within a facet, AND across facets — verified working — but nothing communicates it. The empty state ("No names match the selected filters.") is honest but could name the likely fix (remove the last filter added).
- **Keyboard focus is invisible.** Tabbing reaches the dropdown containers with `outline: none` and no box-shadow (computed-style confirmed). Fine for mouse, unusable for keyboard. Tiles are unfocusable `div`s — acceptable while inert, blocking once they become clickable.
- **No URL state.** Filters don't serialize to the querystring: a filtered view can't be shared or bookmarked, and refresh resets it. This app already invests in deep links elsewhere (`e2e/deeplink-*.spec.js`); this view opts out.
- **No i18n.** "Book of Mormon Names", "Clear filters", "N of 210 names", the empty state — all hardcoded English in an app that routes copy through `label()`.

## 4. Flow

1. **Entry:** Analysis landing → photographic "Names" card → jargon dropdowns over an alphabet wall. No orienting sentence, no example, no suggested first move. The user must already know what a "stem" is *and* that `Mor` is worth selecting.
2. **Journey:** the good stories this page could tell — *the Mor dynasty of names*, *Egyptian-flavored Nephite names*, *what Jaredite names sound like* — each require 2–3 correct dropdown choices to discover, and the reward is a smaller pile of identical pills. Facet counts, or a default grouping, would surface these stories for free.
3. **Dead end:** after filtering, there is nowhere to go. Person/place names have entity pages elsewhere in the app (People view, Places view) but tiles don't link to them; the etymology notes in `data.js` never render anywhere; there's no related-names hop (from Moroni to the rest of stem `Mor`). The flow terminates exactly where curiosity peaks.

## 5. Recommendations

Ordered; 1–4 are small, 5–7 are the real design work.

1. **Fix the dark-mode bugs and focus visibility** (CSS-only): hover colors via theme tokens instead of `#f9f9f9`/`#ddd`, status line ≥ AA contrast in both themes, `:focus-visible` ring on dropdown containers. Fix the mobile title truncation (drop the inline nowrap/ellipsis).
2. **Remove the lie or ship the click.** Until tile detail exists, drop `cursor: pointer` and the hover lift. (Better: do #5.)
3. **Counts in facet options** — "Mor (9)", "Jaredite (58)" — and sort stem/suffix options by count descending; disable rmsc "Select All". This alone converts the dropdowns from a guessing game into a map of the dataset.
4. **One orienting line** under the title (through `label()`): what this page is, what Prefix/Stem/Affix/Suffix mean, in one sentence each via header tooltips (resurrect the `ThWithPopup` idea).
5. **Tile detail popover/panel** on click: the name segmented into its parts, culture badges (reuse the People view's `IdBadge` styles for visual continuity), the `note` gloss, and — when `types` includes person/place — a link into the existing entity page. This closes the dead end and finally spends the dataset.
6. **Make the morphology visible on the wall — the signature move.** Render each tile as its segmentation with subdued color-coded morpheme spans (one hue family each for prefix/stem/suffix, dimmed until hover or until a "show structure" toggle). The grid itself becomes the visualization of the naming system; clicking a morpheme span filters by it. Everything else on the page should stay disciplined to let this carry the identity.
7. **Culture and Type as toggle-chip rows, not dropdowns** (9 values each — hiding them in a select costs discoverability for nothing), leaving searchable selects only where the option count demands it (stems, suffixes). On mobile, collapse the remaining selects into a single "Filters" disclosure instead of a six-column table that clips Culture and Type off-screen (confirmed at 375px).
8. **Sync filters to the querystring** for shareable views, matching the app's deep-link investment.

## 6. Evidence index

Screenshots captured during the audit (session scratchpad, `pw/audit/`): `desktop-initial`, `desktop-dropdown-open`, `desktop-dark`, `desktop-dark-dropdown`, `dark-hover` (text-vanish bug), `mobile-initial` (truncated title, clipped columns), `mobile-dropdown`, `analysis-landing`. Computed-style probes: tile/heading/header typography, dark hover colors, status-line contrast, focus outline state.

---

## Addendum (2026-07-16, later same day)

All eight recommendations were implemented on `feature/names-view-redesign`
per `docs/plans/2026-07-16-names-view-redesign.md`: theme-variable dark mode
(hover and contrast bugs fixed at the root), real tile clicks opening a detail
panel with entity-popup links and morpheme drill-in, count-annotated
frequency-sorted facet selects without Select All, Culture/Type toggle chips,
orienting copy with facet tooltips, morpheme-colored structure rendering with
legend and toggle (the signature), responsive filter disclosure with the mobile
title fix, and querystring-synced shareable filters. Verified by an
8-checkpoint headless-browser sweep (light/dark/mobile/keyboard) — all passing.
