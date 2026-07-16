# Bible Cross-Reference View Overhaul — Specification

**Date:** 2026-07-16
**Status:** Approved direction (Option B + C from the audit)
**Related:** `docs/audits/2026-07-16-bible-cross-reference-ux-dataviz-audit.md` (findings), `docs/plans/2026-07-16-bible-cross-reference-overhaul.md` (build plan)

---

## 1. Summary

Replace the drill-down circle matrix at `/analysis/bible` with a three-layer experience over the same dataset (`data.js`: 2,957 `[bomVerseId, bibleVerseId, isQuote]` pairs):

1. **Overview (landing):** a bipartite ribbon diagram — Bible spine and Book of Mormon spine connected by ribbons whose thickness encodes correspondence count and whose two-tone fill splits direct quotes from phrase echoes.
2. **Anchored view (workhorse):** pick any book (either canon) and see a ranked, quote/phrase-split bar list of its partner books, plus a per-chapter density strip for narrowing.
3. **Reader (kept, repaired):** the existing side-by-side verse-pair screen, scoped by the anchor, with its dead ends fixed.

The URL is the single source of truth for all states. The old matrix, its circle encoding, and its DOM-scraped routing are removed.

### Goals

- Answer the three real user questions directly: *what does this BoM book draw on*, *where does this Bible book land in the BoM*, *show me the actual paired text*.
- Honest magnitude encoding everywhere (length and thickness, never log-radius/opacity circles).
- Make the quote-vs-phrase dimension visible at every level.
- Working deep links, browser Back, and breadcrumbs.
- Keyboard- and screen-reader-operable, light and dark mode, mobile-usable.

### Non-goals

- No changes to the underlying dataset or the GraphQL API shape (except the reader may batch its fetches).
- No verse-level grid or verse-level ribbons — verse granularity lives only in the reader.
- No new npm dependencies (SVG is hand-rolled; layout math is pure functions).
- The verse-heading bug observed in the reader ("Six Days of Creation…" repeated) is an API/data issue tracked separately, not part of this UI work.

---

## 2. Users & user stories

| Story | Served by |
|---|---|
| "I'm curious — show me the big picture of how the Bible surfaces in the Book of Mormon." | Overview ribbons |
| "What does 2 Nephi draw on, and how much of it is verbatim Isaiah?" | Anchor on 2 Nephi → ranked bars, quote split |
| "Where does Isaiah land across the Book of Mormon?" | Flip toggle → anchor on Isaiah |
| "Show me the actual verse pairs, side by side, phrases highlighted." | Reader |
| "I'm a scholar; I want the numbers as a sortable table I can cite." | Table twin (overview + anchored views) |

---

## 3. Information architecture & URLs

All routes live under the existing `/analysis/:value*` route (`models/Routes.js:157`); the `Analysis.js` dispatcher already forwards any `value` starting with `bible` to this view. Canon segments: `bom` (Book of Mormon) and `kjv` (Bible).

| State | URL | Notes |
|---|---|---|
| Overview | `/analysis/bible` | Landing |
| Anchored, BoM book | `/analysis/bible/bom/2-nephi` | |
| Anchored, narrowed to chapter | `/analysis/bible/bom/2-nephi/12` | |
| Anchored, Bible book | `/analysis/bible/kjv/isaiah` | The "flip" |
| Reader, book pair | `/analysis/bible/bom/2-nephi~isaiah` | Always serialized BoM-first |
| Reader, chapter-narrowed | `/analysis/bible/bom/2-nephi/12~isaiah` | |

Rules:

- **URL → state, one way.** Components never push state that isn't derived from the URL; navigation = `history.push(serialize(state))`; render = `parse(match.params.value)`. Browser Back therefore just works.
- **Slug matching is case-insensitive both directions** (fixes the audit's `"torah" ≠ "Torah"` round-trip bug). Slug = lowercase, spaces→`-`, apostrophes stripped (`solomons-song`).
- **Legacy URLs** (`/analysis/bible/<a>~<b>` old format) parse best-effort: two book slugs → reader; anything unresolvable → overview. Never a blank or broken screen.
- `document.title` derives from parsed state, not from scraping rendered headers.

Navigation graph (every arrow is a URL change; browser Back reverses it):

```
Overview ──click book───────▶ Anchored(book)
Overview ──click ribbon─────▶ Anchored(bom book, partner pre-highlighted)
Anchored ──click chapter────▶ Anchored(book, chapter)
Anchored ──click partner bar▶ Reader(pair, scoped by current anchor+chapter)
Anchored ──flip toggle──────▶ Anchored(other canon; keeps context when a pair is implied)
Reader   ──Back/Esc─────────▶ the Anchored state it came from
Breadcrumb: ⌂ Overview › 2 Nephi › ch. 12  (each segment a link)
```

---

## 4. State specifications

### 4.1 Overview — bipartite ribbon diagram

**Layout.** Full-width SVG. Left spine: the Bible's 66 books as stacked segments, height ∝ verse count, grouped visually under the 9 division labels (Torah, Historical, … Apocalyptic). Right spine: the Book of Mormon's 15 books under its 3 divisions. Between them, one ribbon per book pair with ≥ 1 correspondence (~200 after aggregation), thickness ∝ pair count (minimum 1.5px so hairlines stay visible), drawn as cubic Béziers. Ribbons are two-tone along their thickness: saturated core = quote share, lighter sheath = phrase share.

**Header strip.** Title, one-line dataset summary ("2,957 connections · 766 direct quotes"), the quote/phrase legend, and a `[Chart | Table]` toggle. No other chrome.

**Interaction.**

- *Hover book segment:* that book's full ribbon fan stays at 100% opacity; all other ribbons drop to 15%. Tooltip: book name, partner count, total refs, quote count. Same behavior from either spine.
- *Hover ribbon:* only that ribbon highlighted. Tooltip: "Isaiah ↔ 2 Nephi · 434 refs · 402 quotes".
- *Click book segment:* navigate to Anchored on that book.
- *Click ribbon:* navigate to Anchored on the BoM book with the Bible partner pre-highlighted in the bar list.
- *Keyboard:* spines are two toolbars; Tab enters a spine, arrow keys move through books in canonical order, Enter anchors. Focused book gets the same fan-highlight as hover. Each segment has an `aria-label` with the tooltip content.
- *Reduced motion:* no transition animations; hover fades become instant.

**Table twin.** The toggle swaps the SVG for a sortable table (BoM book, Bible book, refs, quotes, phrases), same data, keyboard/scReader-clean. This is the accessibility twin required for a color/geometry encoding; it must not be an afterthought.

**Ribbon-legibility guardrails** (the known risk of this form): books are in canonical order on both spines (stable, meaningful, and minimizes long crossings since correspondence clusters are roughly diagonal); ribbons sort within each node by partner position; ribbon fill at 65% opacity with `mix-blend: normal` (no additive blending mud); if visual QA still shows spaghetti, the fallback is aggregating the left spine to division level by default with per-division expand — decided at the visual-QA milestone, not before.

### 4.2 Anchored view — rail + ranked bars

**Layout.** Two panels. Left rail (~240px): the anchor canon as a vertical list of books, each with name + a small horizontal density bar (total refs, linear scale, shared max across the canon); the anchored book is expanded, showing its **chapter strip** — one cell per chapter, sequential green fill by count, chapter numbers beneath, current chapter outlined. Main panel: heading ("2 Nephi draws on:" / "Isaiah appears in:"), total count, then ranked horizontal bars, one per partner book: label, stacked quote (dark) + phrase (light) segments on a linear scale, count at bar end. Bars below a fold threshold (>8 partners) collapse behind "show all". Sort control: by count (default) or canonical order. Legend row: quote/phrase swatches.

**Interaction.**

- *Click rail book:* re-anchor (URL change).
- *Click chapter cell:* narrow to that chapter (URL change); click again to clear. Bars re-rank to chapter scope; a scope chip ("ch. 12 ✕") appears by the heading.
- *Hover partner bar:* the chapters containing that partner's refs pulse on the chapter strip (the two panels answer each other). Tooltip: partner, refs, quotes, phrases.
- *Click partner bar:* → Reader scoped to (anchor book [+ chapter]) × partner.
- *Flip toggle* (`⇄ anchor on Bible`): switches rail canon; if arriving from a ribbon/bar with a pair in context, flipping re-anchors on the partner rather than losing context.
- *Keyboard:* rail and bar list are standard focus order; chapter strip is a radiogroup (arrows + Enter). All counts are text, so no extra aria math needed; bars carry `aria-label="Isaiah, 434 references, 402 quotes"`.

**Empty/edge states.** A book with zero correspondences (e.g. Obadiah as anchor) shows the rail normally and an empty-state panel: "No known correspondences between Obadiah and the Book of Mormon" + a link back to Overview. Zero is a stated fact, not a gray disc.

### 4.3 Reader — kept, repaired

Same two-column verse-pair table as today (`VerseView.js`), with:

- **Scope from URL** (book pair, optional BoM chapter), not from component-state plumbing. Back/Esc return to the anchored state.
- **Quote badges:** each pair row carries a small `QUOTE` badge when `isQuote`; the orphaned `.quote` CSS and no-op ternaries are removed or wired.
- **Reference navigation:** BoM references link to `/read/<slug>` (via `verseIdToSlug`, as `views/Read/Read.js:330` does). Bible references render as plain text (no in-app destination; no clipboard-alert dead end). All `alert()` calls removed; the zero-match case renders an inline empty state.
- **Fetching:** paginated — first 20 pairs fetched immediately, remainder in the background or on scroll; cache enabled (drop `{useCache: false}` unless a correctness reason surfaces; if the API misbehaves with cache, document why inline). Loading holds layout (no spinner-only screen once first page arrives).
- **Sort arrows** reflect the actual sort column (fix the `sort.column !== 'row'` logic).
- **Debug output removed:** `highlighter.jsx` never renders its `<pre>` JSON dump; unmatched highlights degrade to unhighlighted text.

### 4.4 Removed

The circle-matrix grid, `GridCell`, the `levels` array machinery, orientation-swap axis logic, DOM-scraped URL building, `.emptyCell` discs, and the dead sibling `views/Analysis/Bible.js` file (superseded by `views/Analysis/Bible/` directory).

---

## 5. Visual design

**Direction.** The subject is textual kinship between two canons — the design language is *the two spines of a book and the threads between them*. Restraint everywhere except the ribbons: the overview diagram is the signature element and the only place with expressive geometry; everything else (bars, strips, reader) is quiet, typographic, and token-driven. No card chrome, no decorative borders; hairline rules and whitespace do the structuring, consistent with the reader's existing typographic character (serif scripture text, small-caps-style headings).

**Color.** Plugs into the app's semantic token system (`assets/theme/scss/darkmode/_tokens.scss`; dark overrides via `html[data-theme="dark"]`). New chart tokens, validated with the palette validator (six-check gate) on 2026-07-16:

| Token | Light | Dark | Role |
|---|---|---|---|
| `--xref-quote` | `#1a6446` | `#4ea578` | Direct-quote fill (ordinal pair, dark step) |
| `--xref-phrase` | `#4ea578` | `#1a6446` | Phrase/allusion fill (light step) |
| `--xref-ramp-1…6` | `#dcece4 → #0b4530` | reversed | Chapter-density sequential ramp |

Validation results: quote/phrase pair passes the full ordinal gate (monotone lightness, ΔL ≥ 0.06, light-end ≥ 2:1 vs. both surfaces, single hue) in **both** modes; the sequential ramp is monotone/single-hue with its near-zero end intentionally receding toward the surface (standard for continuous density). Counts are always printed as text (`--text-*` tokens, never series color), so no encoding is color-alone. One hue family total — identity is carried by position/labels, magnitude by geometry, and the only color meaning is the quote/phrase split plus density. Status/accent colors are not borrowed.

**Marks.** Bars ≤ 16px tall with 2px surface gaps between quote/phrase segments and between bars; 4px rounded data-end only; chapter-strip cells with 2px gaps; ribbons at 65% fill opacity, 1.5px minimum thickness; grid/axis hairlines use `--border`; selective direct labels (count at bar end; never a number on every ribbon).

**Typography.** Reuses the app's stack: existing display treatment for the view title, `"Scripture", serif` stays in the reader verse text, sans-serif UI text elsewhere. Counts in bars/tooltips use tabular figures (they align in columns); no display faces on numbers.

**Motion.** One orchestrated moment: on overview load, ribbons draw in with a 250ms staggered fade (order = canonical). Hover fades 120ms. Everything gated by `prefers-reduced-motion`. No other animation.

---

## 6. Data & modules

No API changes. New pure modules (all unit-testable, no React):

| Module | Responsibility |
|---|---|
| `canon.js` | Book/group structures for both canons (extracted from `Bible.js`, with the duplicated "Mormon" rows 36884–37032 + 37033–37110 merged into one book); verse-id ranges; chapter counts; slug ↔ book/group resolution (case-insensitive); `bookOfVid()` via range lookup |
| `aggregate.js` | One-pass rollups of `data.js` at module scope: book-pair map `{total, quotes}`; `partnersFor(canon, book)` ranked lists; per-book totals; per-chapter counts for a book (chapter derived by parsing `generateReference(vid)` from `scripture-guide`); dataset headline numbers |
| `urlState.js` | `parse(value) ⇄ serialize(state)` for §3's scheme, including legacy-URL fallback |
| `ribbonLayout.js` | Pure geometry: spine segment positions (∝ verse count, 2px gaps), per-node ribbon slot allocation (sorted by partner position), Bézier path descriptors for a given width/height |

Component tree:

```
Bible/index.jsx (controller: parse URL → render state, own document.title)
├── Overview.jsx        (SVG spines + ribbons; TableTwin.jsx toggle)
├── AnchorView.jsx
│   ├── Rail.jsx        (canon book list + density bars + ChapterStrip.jsx)
│   └── PartnerBars.jsx (ranked stacked bars)
├── Reader.jsx          (repaired VerseView)
└── crossref.css        (tokens, marks, dark overrides)
```

---

## 7. Accessibility requirements (acceptance-gating)

1. Every interactive element reachable and operable by keyboard, visible focus ring, logical order; Esc closes the reader.
2. Overview has a full-fidelity table twin; anchored view's bars are text-labeled (counts as text); nothing is communicated by color alone (quote/phrase also differ by position within the bar/ribbon and are named in labels/tooltips).
3. `aria-label`s on spine segments, ribbons (or a summarized ribbon description at the container level), bars, chapter cells; the two spines and the bar list expose sensible roles (`list`/`listitem`, `radiogroup` for chapter strip).
4. Both themes meet the token system's contrast conventions; printed counts always use text tokens.
5. `prefers-reduced-motion` disables the draw-in and hover transitions.
6. Tooltips duplicate, never gate: everything a tooltip says is available via labels, the table twin, or the reader.

---

## 8. Responsive behavior

- **≥1100px:** as specified.
- **700–1100px:** overview ribbons keep book-level spines but labels rotate to eyebrow size; anchored rail collapses to a top drawer (current anchor + chevron opens the book list).
- **<700px (mobile):** overview renders division-level spines (9×3, ~25 ribbons); anchored view stacks (chapter strip above bars); reader keeps two columns until 480px, then alternates verse blocks vertically (BoM verse, Bible verse, divider). No horizontal page scroll at any width; wide internals get their own `overflow-x: auto`.
- Orientation changes re-render from a resize listener (no mount-time-only sampling).

---

## 9. Acceptance criteria

**Overview**
- [ ] Landing at `/analysis/bible` renders spines + ribbons from live `data.js` aggregation; headline numbers correct (2,957 / 766 against current data).
- [ ] Hover/focus fan-highlight; tooltips with book, partners, refs, quotes.
- [ ] Click book → anchored URL; click ribbon → anchored URL with partner highlighted; browser Back returns.
- [ ] Table twin renders the same aggregation, sortable, keyboard-clean.

**Anchored**
- [ ] `/analysis/bible/bom/2-nephi` shows ranked partner bars (Isaiah first) with correct quote/phrase splits; `/analysis/bible/kjv/isaiah` shows the mirror.
- [ ] Chapter strip counts sum to the book total; clicking a chapter narrows bars and URL; scope chip clears it.
- [ ] Flip toggle preserves context; zero-correspondence anchors show the empty state.

**Reader**
- [ ] Reachable only via URL state; Back/Esc restore the anchored view.
- [ ] Quote badges; BoM refs navigate to `/read/…`; no `alert()` anywhere; no debug `<pre>` ever renders.
- [ ] First page of pairs visible without loading the full set; sort arrows match applied sort.

**Cross-cutting**
- [ ] Every §3 URL round-trips (serialize→parse identity, and legacy formats degrade gracefully).
- [ ] All §7 accessibility gates; both themes; §8 breakpoints verified by screenshot.
- [ ] Old matrix code paths deleted; no `console.log` in the view; `npm test` green.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Ribbon clutter (~200 ribbons) reads as spaghetti | Canonical ordering + within-node sorting + opacity discipline; explicit visual-QA milestone with a pre-agreed fallback (division-level default with expand) |
| `scripture-guide` chapter parsing for density strips is slow or locale-fragile | Computed once per anchored book and memoized; parse digits-before-colon only; unit tests pin behavior for multi-word and single-chapter books |
| Reader API can't paginate | Client-side pagination of the request list (chunked `BoMOnlineAPI` calls) — no server change required |
| SVG performance on low-end mobile | Division-level aggregation on mobile (~25 ribbons); no filters/shadows on ribbons |
| Losing the matrix's "whole landscape" poster | That's precisely what the ribbon overview replaces, deliberately — the matrix's only unique strength is retained in better form |

---

## Acceptance verification — 2026-07-16

Verified on `feature/bible-crossref-overhaul` against the local dev server (Playwright screenshots) and the Jest suite (11 suites / 63 tests in `views/Analysis/Bible/__tests__/`, full app suite green, production build passing).

**Overview**
- [x] Landing renders spines + ribbons from live aggregation; headline 2,957 / 766 correct.
- [x] Hover/focus fan-highlight; tooltips (SVG `<title>`) with book, partners, refs, quotes.
- [x] Click book → anchored URL; click ribbon → anchored URL (with partner highlight at book level); browser Back returns.
- [x] Table twin renders the same aggregation, sortable, keyboard-clean.
- [x] **Visual-QA fallback invoked as pre-agreed (§4.1 guardrails / §10):** book-level ribbons on both spines read as spaghetti, so the Bible spine defaults to its 9 divisions with per-division expand into books. Ribbon opacity scales with magnitude; the two-tone quote core renders only when ≥3px thick.

**Anchored**
- [x] `/analysis/bible/bom/2-nephi` ranks Isaiah first (406 of 692) with quote/phrase splits; `/analysis/bible/kjv/isaiah` mirrors.
- [x] Chapter strip sums to book totals (unit-tested); chapter click narrows bars + URL; scope chip clears.
- [x] Flip preserves context (re-anchors on highlighted or top partner); zero-correspondence anchors show the empty state.

**Reader**
- [x] Reachable only via URL state; Back/Esc restore the anchored view.
- [x] Quote badges; BoM refs navigate to `/read/…`; no `alert()`; no debug `<pre>` (unmatched highlights also no longer blank the verse text — a worse failure found during implementation).
- [x] Paginated (20/page, Load more); sort arrows match applied sort.

**Cross-cutting**
- [x] §3 URLs round-trip (serialize⇄parse identity unit-tested); legacy `/analysis/bible/<bom>~<bible>` renders the reader (home-tile deep links keep working); garbage degrades to overview.
- [x] Keyboard operability (Tab/arrows/Enter/Esc), aria-labels on segments/ribbons/bars/cells, table twin as accessible equivalent; both themes screenshotted; 1440/390 verified, chapter strip and bars single-column under 700px.
- [x] Old matrix deleted (`Bible.js`, `Bible.css`, `VerseView.js`, dead sibling `views/Analysis/Bible.js`); no `console.log`; suite green.

**Deferred (follow-ups, not blockers)**
- The repeated verse-heading data bug (e.g. "Six Days of Creation…" on every row) is an API/data issue, out of scope per §1 non-goals — needs its own investigation.
- i18n of canon labels (`canon.js` is English-only, matching the pre-existing state).
- Bar-hover → chapter-strip pulse (spec §4.2 nicety) omitted; highlight-on-select covers the workflow.
