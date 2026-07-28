# Design-System Inventory — Reusable-Component Audit

**Date:** 2026-07-28
**Scope:** Frontend CRA app (`frontend/webapp/src/`). Cataloging recurring UI patterns that are reinvented per-view, to prioritize what to extract into shared design-system components — following the pattern set by the reusable `<Breadcrumb>` (see `docs/reference/breadcrumb-component.md`).
**Method:** Three parallel read-only sweeps (cards/tiles; filters/search; atomic primitives). Headline duplication claims spot-verified by grep. Line numbers below are approximate — verify before editing.

## Executive summary

The codebase already has a **convention-based** design system (shared components in `views/_Common/`, plain paired CSS, `label()` i18n, `html[data-theme="dark"]` theming) and several genuinely-shared pieces. The gaps are concentrated in three places, ranked by return on effort:

1. **Filters (People/Places/Matters)** — the clearest win. ~500 lines of near-identical filter UI triplicated. One `<FilterPanel>` collapses it.
2. **Atoms — buttons, headings, badges** — highest recurrence, most inconsistent. No unified primitives; a mix of reactstrap, Bootstrap `.btn/.badge`, and one-off spans.
3. **Modals** — fragmented across 4+ mechanisms with inconsistent a11y. Highest-risk to unify, medium ROI.

Cards/tiles are **mostly a non-problem**: the Sampler tile system is already well-abstracted via shared chrome. The opportunity there is smaller (a base `<Tile>` wrapper + a few recurring sub-blocks), not a rewrite.

**Already shared — leave alone / reuse as-is:** `SearchPopUp` (People/Places/Matters/Map), `RangeSlider` (Map), `UserAvatar`, `Identicon`, `Loader`/`Spinner`, `RefPill`, `AppModal` + `useModalA11y`, and now `<Breadcrumb>`.

**Dead code found:** `views/People/PeoplePlacesFilter.js` — an alternative filter UI imported nowhere (self-reference only). Delete candidate.

---

## Cluster A — Filters & Search  ★ highest ROI

### A1. Triplicated filter panel (People / Places / Matters)
Verified: `People.js`, `Places.js`, and `Matters/MattersFilter.js` all render the same structure and share the same CSS.

- **Shared markup/classes:** `.ppFiltersHeading`, `.ppFilters`, `.ppColumns`, `li.lihead`/`li.lifoot`/`li.item`, `.ppFiltersSearchButton`; `BootstrapSwitchButton` toggles; select-all/clear `<Button>`s; a `SearchPopUp`.
- **CSS home:** `People/People.css` (`.ppFilters` ~L115, `.ppColumns` ~L127, `li.item` ~L167), reused by Places and Matters.
- **Only real difference:** state shape — People/Places use string codes (`identification: "NBJ"`), Matters uses a `Set`. Both reduce to "toggle a set of keys."
- **Volume:** People filter ~190 LOC, Places ~185 LOC, Matters ~123 LOC — ~500 lines, mostly identical.

**→ Extract `<FilterPanel>`** (title + toggle list + select-all/clear + optional search button), driven by an `options[]` + `selected` + `onToggle/onSelectAll/onClear` API. Consolidates all three; ~300 LOC removable.

### A2. Search inputs — 3 variants
- Sidebar quick-search `.searchbox` (`_Common/Sidebar.js` ~L145).
- On-page search `.searchboxWrapper` + `input.onpage.searchbox` + button (`Search/Search.js` ~L54).
- `SearchPopUp` header input (`_Common/SearchPopUp.js`) — **already shared** (People/Places/Matters/Map).

**→ Extract `<SearchInput>`** (placeholder/value/onChange/onSubmit, optional icon + trailing button). `SearchPopUp` can consume it internally.

### A3. Filter chip — one-off
- `.witness-filter-chip` pill with inline ✕ (`History/Witnesses.js` ~L213, `Witnesses.css` ~L447).

**→ Extract `<FilterChip>`** (label + onRemove, tokenized colors). Reusable for the witness date filter, Map selected-type, etc.

### A4. Already-good, leave alone
- **`RangeSlider`** (`Map/RangeSlider.js` + `.scss`) — standalone dual-handle slider with `--slider-*` CSS vars. Document its API; candidate for timeline/date reuse.
- **`SearchPopUp`** — shared modal typeahead. Keep.

---

## Cluster B — Cards & Tiles  ◐ partial, smaller than it looks

### B1. Sampler tiles — already abstracted (don't rewrite)
~18–24 tiles in `Home/tiles/` all share chrome via `Sampler.css`: `.tile` (border/shadow/hover-lift), `.samplerTileInner` (padding/flex), `.tileHeading` (uppercase label). A `registry.js` wires them up. Each tile owns its body — appropriate. **The only gap:** the shared chrome is CSS-only; there's no `<Tile>` React wrapper. Low-priority `<Tile>`/`<TileHeading>` wrapper would formalize it.

### B2. Multiple distinct card "languages" coexist (mostly fine to leave separate)
| System | Where | Mechanism |
|---|---|---|
| Sampler tiles | `Home/tiles/` | custom `.tile` chrome |
| reactstrap `<Card>` | History `.historycard`, Feed banner, ReadingPlan, ~19 files | Bootstrap |
| Draggable popup `.card.popupwindow` | `_Common/PopUp.js`, `Commentary.js` | custom + Draggable |
| Page section `.pagesection.card` | `Page/Section.js` | custom |

These serve different contexts; unifying all under one `<Card>` is **not** recommended now. A shared token set (radius/shadow/surface colors) applied across them is the lighter, safer move.

### B3. Recurring sub-blocks worth extracting (medium value)
- **Identity block** (image/avatar + name + title + optional ref pill): reinvented in `PeopleTile`, `PersonProfileTile`, `PlaceProfileTile`, `WitnessTile`, and inline 3× in `Feed.js` (HomeFeedItem/Comment/MyComment as avatar+name+progress+trophy). → `<IdentityBlock>` / `<AuthorBlock>`.
- **Face card** `.samplerCard` (portrait + overlaid name/title) in People/Places tiles → `<SamplerCard>`.
- **Clamp + read-more**: `ExpandableText.js` exists but is used inconsistently — standardize Commentary/History/Notes tiles onto it.

---

## Cluster C — Atomic primitives

Ranked by recurrence × inconsistency.

### C1. Buttons ★ (highest recurrence)
Mix of reactstrap `<Button>`, native `<button className="btn btn-*">`, and the `.buttonRow` action-row pattern (Feed like/comment, ReadingPlan). `GroupCallToAction` is a one-off stateful button. **→ `<Button>` wrapper (size/intent variants) + `<ButtonRow>`.** Highest LOC touched; do carefully (visual regression risk across ~50 sites).

### C2. Headings ★
≥5 approaches: `.title.lg-4.text-center` (page titles, ~7 views), `.card-header h4/h5`, `.label` (small uppercase, PassageNotes/Timeline), `.heading`, `.subtitle`. **→ `<Heading>` + `<Label>` primitives**, or at least a shared type scale in tokens.

### C3. Badges / pills / chips ★
`RefPill` (good, keep) vs. one-off `.botBadge`, `.progressBadge`/`.progress`, `.editorialMark`, `.witness-age`, Bootstrap `.badge`, and inline chips (`.theologyChip`, `.depth-chip`, `map_story_distance_badge`). **→ `<Badge>` (variants) + `<Chip>`.** Pairs naturally with A3's `<FilterChip>`.

### C4. Avatars / identity — mostly good
`UserAvatar` (~25 uses) and `Identicon` are well-consolidated. Gap is the **identity block** (see B3), not the avatars themselves.

### C5. Loaders / skeletons — medium
`Loader`/`Spinner` (`_Common/Loader/`) are shared and fine. Fragmentation is in skeletons: `Read/components/SkeletonLoader.js` (Read-only), `BlankWord`/`BlankParagraph` (`Utils.js`, ~2 uses), and ad-hoc `.spinnerBox`/`.faxDeepLinkSpinner`/`.uploadingSpinner`. **→ promote a shared `<Skeleton>`; replace custom spinner divs with `<Spinner>`.**

### C6. Modals ◑ (fragmented, higher risk)
Coexisting mechanisms: **SweetAlert** via `AppModal` (has `useModalA11y`), **custom draggable** `PopUp.js` (~800 LOC, multi-purpose) + `Commentary.js` + `ScripturePopup.js`, **`FaxVerseModal.jsx`** (custom div on desktop, `react-modern-drawer` on mobile), and a legacy `_Common/Drawer.js`. a11y is inconsistent (only AppModal uses `useModalA11y`). **→ converge on one content-modal API + one alert API; adopt `useModalA11y` everywhere; split the `PopUp.js` monolith.** Biggest structural cleanup; schedule after the cheaper wins.

### C7. Tooltips — low/medium
`react-tooltip` used ~10–15 places with per-site `place/effect/type` config. **→ `<Tooltip>` wrapper with shared defaults.**

### C8. Empty / loading / error states — low
No shared component; ad-hoc `label()` text with scattered classes (`.no-results`, `.xrels-empty`, `.NotificationList-empty`). **→ `<EmptyState>` primitive.**

---

## UI libraries in play (overlap = tech-debt signal)
`reactstrap` (Button/Card/Nav/Tab/Badge), `react-bootstrap-sweetalert` (AppModal), `react-tooltip`, `react-modern-drawer` (FaxVerseModal, Breadcrumb), `bootstrap` CSS. Overlaps: **3+ modal systems**; reactstrap `Button` vs Bootstrap `.btn`; Bootstrap `.badge` vs custom badges. Consolidating primitives is also a path to shrinking this surface.

---

## Recommended sequencing

Each item is its own brainstorm → spec → plan → build cycle (the breadcrumb workflow). Rough order by ROI vs. risk:

1. **`<FilterPanel>`** (A1) — biggest LOC win, contained blast radius (3 views), clear parity bar. Delete dead `PeoplePlacesFilter.js` alongside.
2. **Tokens + `<Badge>`/`<Chip>`/`<FilterChip>`** (C3, A3) — small, high-visibility, seeds the shared token layer beyond `--bc-*`.
3. **`<SearchInput>`** (A2) — small, unifies 3 inputs; feeds `SearchPopUp`.
4. **`<Button>` + `<ButtonRow>`** (C1) — high value but touches ~50 sites; do with visual QA.
5. **`<Heading>`/`<Label>` + type scale** (C2).
6. **Identity block + `<Tile>` wrapper + ExpandableText standardization** (B1–B3).
7. **Modal convergence** (C6) — largest structural refactor; last.
8. **`<Tooltip>`, `<Skeleton>`, `<EmptyState>`** (C5, C7, C8) — polish.

## Confidence notes
- **High confidence (grep-verified):** A1 filter triplication, `SearchPopUp` shared, `PeoplePlacesFilter` dead, modal fragmentation.
- **Medium confidence (single-sweep, line numbers approximate):** exact tile counts, per-atom usage counts, some class-name line refs. Re-verify the specific files when scoping each component.
