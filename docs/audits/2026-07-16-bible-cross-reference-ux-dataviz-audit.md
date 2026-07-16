# Bible Cross-Reference View — UX & Data-Viz Audit

**Date:** 2026-07-16
**Scope:** `frontend/webapp/src/views/Analysis/Bible/` (`Bible.js`, `VerseView.js`, `highlighter.jsx`, `Bible.css`, `data.js`)
**Method:** full code read; live session against the CRA dev server (`localhost:8210`) with Playwright screenshots of every reachable state; findings checked against standard data-viz practice (form choice, encoding channels, color-contrast, legend/table-twin conventions).
**Screenshots:** `bible-analysis-screenshots-2026-07-16/`
**Status:** Superseded by implementation (2026-07-16) — see `docs/specs/2026-07-16-bible-cross-reference-overhaul.md` and `docs/plans/2026-07-16-bible-cross-reference-overhaul.md`; Option B + C shipped on `feature/bible-crossref-overhaul`.

---

## 1. What this view is

An interactive matrix of the ~2,957 known textual correspondences between the Bible and the Book of Mormon (766 flagged as direct quotes, 2,191 as phrases/allusions — `data.js` triplets of `[bomVerseId, bibleVerseId, isQuote]`). The UI is a two-axis grid: Book of Mormon divisions on one axis, Bible divisions on the other, one numbered circle per cell showing how many correspondences fall in that intersection. Clicking drills from division groups → books → (in principle chapters/verses) → a side-by-side verse-pair reader with phrase-level highlighting.

The concept is strong. A cross-reference corpus really is a bipartite relation, the hierarchical zoom (canon → group → book → chapter → verse) matches how people think about scripture, and the destination screen — two columns of verse pairs with the shared phrases highlighted — is the payoff readers actually want. The problems are in the middle: the encoding of the overview, the navigation model between overview and payoff, and a layer of unfinished mechanics.

### What it does right

- **The verse-pair reader is the best screen in the flow** (`verse-viewer.png`): side-by-side layout, phrase highlighting, per-column sort, Esc to close. This should survive any overhaul.
- Marginal totals on row/column headers give the reader a scent of where the mass is before clicking.
- Log scaling is a defensible instinct — the distribution is power-law (697 in one cell, 4 in another), and linear area would flatten everything but Isaiah.
- Orientation-aware axis swap (portrait puts the 9 Bible groups vertical) shows real thought about aspect ratio.
- Deep-link intent (`/analysis/bible/<row>~<col>`) is the right idea, even though the implementation is broken (§4).

---

## 2. Data-viz findings

### 2.1 The circle encoding triple-encodes one number and still fails to communicate it

`Bible.js:446-485`: each cell's count drives **radius** (log-scaled, 2–6ex), **opacity** (`percentage / 100`), and a **printed number** — three channels, one datum. Consequences:

- **Low counts are illegible.** Opacity applies to the whole div, including the white numeral. A cell of 4 renders white text at ~30% opacity on a pale green disc on a near-white page (see the Moroni row in `base-landscape.png`, and the "10" under Minor Prophets). This is a hard WCAG contrast failure and, worse, an inverted salience: the encoding decides small values aren't worth reading, but a reader scanning "does Moroni quote the Gospels?" cares exactly about those cells.
- **Log-radius makes ratios unreadable.** 173 vs 697 (a 4× difference) renders as circles perhaps 20% apart in diameter. Readers judge circles by area, so perceived difference is compressed twice — once by the log, once by area-vs-radius perception. Nobody can recover magnitude from these circles; the printed number is doing all the work, which means the circles are decoration.
- **No legend, no scale, anywhere.** Nothing explains what a circle's size/darkness means, what the gray pills under headers are (they're marginal totals), or that scale is re-normalized to `maxCount` at every drill level — so a big dark circle at book level can represent fewer refs than a small pale one did at group level. Cross-level size comparisons, the thing a zoomable viz invites, are meaningless.

### 2.2 Empty cells are rendered as data

`Bible.js:482`, `.emptyCell` in `Bible.css:195-201`: zero-count cells get a solid gray 2rem disc. At group level this is merely noise; at chapter level it is fatal. `deeplink-chapters.png` (1 Nephi × Genesis) shows the honest result: **hundreds of uniform gray circles and three green ones.** The eye reads the gray discs as marks — a texture of fake data that buries the real data. A matrix that is ~99% empty at fine grain needs empty to be *blank*.

### 2.3 The most interesting dimension in the dataset is invisible

Every pair carries `isQuote` — direct quotation vs. phrase echo. This is the scholarly heart of the dataset ("Is 2 Nephi quoting Isaiah verbatim or riffing on it?"). `GridCell` computes `quoteCount`/`nonQuoteCount` (`Bible.js:451-452`) and then **never uses them**. `VerseView.js:159,173` sets `className={isQuote ? "" : ""}` — literally the same value on both branches — and the `.quote` CSS rules in `Bible.css:304-307` are orphaned. One boolean would let the grid answer "quotation density" and the reader distinguish citation from allusion; it's wired to nothing.

### 2.4 The matrix paradigm itself is only right at the top level

At 3×9 (groups) a matrix is fine: dense, small, both axes meaningful. But the data is extremely skewed — Isaiah/2 Nephi and the Gospels/3 Nephi dominate — so as you descend, the matrix's cost (cells = rows × columns) explodes while its payload (nonzero cells) grows barely at all:

| Level | Cells | Nonzero | Density |
|---|---|---|---|
| Groups (3×9) | 27 | 25 | ~93% |
| Books (e.g. Small Plates × Torah, 6×5) | 30 | ~14 | ~47% |
| Chapters (1 Nephi × Genesis, 22×50) | 1,100 | 3 | **0.3%** |

The paradigm is effective *as an overview* and collapses *as a navigator*. That's the "doesn't quite get there" feeling: the view asks the matrix to be both the map and the road.

### 2.5 Missing standard affordances

- **No hover layer.** No tooltip naming the intersection ("2 Nephi × Isaiah — 513 references, 402 direct quotes") before committing to a click.
- **No table twin / export.** For a dataset this citable, scholars will want a sortable list ("top book pairs by quote count"). The only tabular surface is the verse reader, at maximum zoom.
- **Color carries no meaning beyond redundant magnitude.** One green for everything; header pills gray. Nothing distinguishes quote/allusion, OT/NT, or selected/unselected.

---

## 3. Interaction & navigation findings

### 3.1 The drill model is inconsistent and partly unreachable

- `levels = ["groups", "books"]` (`Bible.js:16`) is the whole click hierarchy, yet `getColumnRowValues` fully supports `"chapters"` and `"verses"` (`Bible.js:166-179`). **Chapter grids are real, working screens that no click path can reach** — only a hand-typed URL like `/analysis/bible/1-nephi~genesis` renders one (`deeplink-chapters.png`). Dead feature or unfinished ambition; either way it confuses maintenance and QA.
- Once *on* that chapter grid, clicking any header computes `levels.indexOf("chapters") === -1`, so `nextLevel = levels[0] = "groups"` — clicking *forward* teleports you *back to the root* with a mismatched key. The hierarchy walks off its own array.
- Clicking a **circle** drills *both* axes simultaneously (`handleCircleClick`, `Bible.js:307-322`); clicking a **header** drills one. Same-looking gesture, different magnitudes of jump, no visual hint which you're about to get. The both-axes jump (27 cells → different 30 cells with new labels on both edges) is disorienting; there's no transition, breadcrumb, or highlight of what you clicked.
- **"Back" is a reset, not a back.** `handleBackClick` (`Bible.js:300-305`) throws away both axes and returns to the root. Drill three steps in, misclick, lose everything.

### 3.2 URL/state round-trip is broken in both directions

- **The app writes URLs it cannot read.** Slugs are built by scraping the rendered DOM headers (`document.querySelector(".leftHeader")…`, `Bible.js:231-240`) and lowercased (`slugify`), but `loadLevelAndKeyFromSlug` compares group slugs against the *raw* keys (`groups.includes(slug)`, `Bible.js:189`) — `"torah" ≠ "Torah"`, `"plates-of-mormon" ≠ "Plates of Mormon"`. Verified live: loading `/analysis/bible/plates-of-mormon~torah` silently renders the base state. Only book-name slugs round-trip (that branch slugifies both sides).
- **Browser Back doesn't work.** State is pushed *to* history on every drill (`push`, not `replace` — history spam), but nothing listens to location changes, so the browser's Back button changes the URL and leaves the grid untouched.
- Deriving app state by scraping your own rendered header text is a fragility multiplier — any label/i18n change breaks routing.

### 3.3 The reader screen's dead ends

- Clicking a verse reference does not navigate anywhere: `navigateToSearch` (`VerseView.js:88-93`) copies a raw numeric `verse_id` to the clipboard and fires a **blocking `alert()`**. A reader who clicks "1 Nephi 5:14" expects to go read 1 Nephi 5 in the app; instead they get `Copied to clipboard: … (Verse ID: 31245)`.
- Zero matches also fires an `alert("No verses found")` (`VerseView.js:60`) and bounces the user — but the grid already disables zero cells, so when this fires it signals a range bug, shown to the user as a browser alert.
- The whole pair list fetches in one request with `{useCache: false}` (`VerseView.js:68`) — no pagination, no cache; 2 Nephi × Isaiah (513 pairs, both verse texts + highlight spans each) re-downloads in full on every open, behind a bare spinner.
- Sort-arrow logic is wrong: `sort.column !== 'row' && sort.direction === 'asc'` (`VerseView.js:121`) renders the *col* header's active arrow from the *row* column's state — arrows shown don't match the applied sort.

### 3.4 Debug artifacts ship to users

- `highlighter.jsx:9-11`: whenever highlight matching yields fewer than 2 cutpoints, the component renders a `<pre>` **JSON debug dump into the reader UI** — verse text, patterns, cutpoint arrays. Any un-matchable highlight string (translation differences, punctuation) puts a wall of JSON in front of an end user.
- `console.log` in click handlers and render paths (`Bible.js:310,319`, `VerseView.js:56`).

### 3.5 Responsiveness & a11y

- Orientation is sampled once at mount (`Bible.js:198-200`); `setOrientation` is never called again — rotate a tablet and the axis layout is wrong until reload. (The row/col swap also inverts URL semantics between devices: the same `a~b` URL means different axes in portrait vs. landscape.)
- Portrait/mobile (`base-portrait.png`): title clipped, third column truncated mid-cell, no horizontal-scroll affordance; the 9-row Bible axis pushes rows off-canvas.
- Nothing is keyboard-operable: drills are `onClick` on `div`/`td`/`th` with no `tabindex`, `role`, or key handlers; `noselect` everywhere; empty cells show `cursor: not-allowed` while nonzero circles rely on cursor alone. Count is encoded in color+size with no text alternative at cell level except the (low-contrast) numeral. No `aria-label`s naming intersections.

### 3.6 Code-level notes (maintenance risk, brief)

- **Axis naming is inverted at both call sites.** `data.js` triplets are `[bomVid, bibleVid, isQuote]` (verified: first elements sit in the 31103+ BoM id range), but `Bible.js:258` destructures them as `[bibleId, bomId]` — backwards — and `VerseView.js:47-50` then swaps `rowRef`/`colRef` again to compensate. Two wrongs currently make the display right; the next person to touch either file will "fix" one and break the view.
- The canon structure (books, verse-id ranges, chapter counts) is hardcoded English in `Bible.js:18-126` while labels elsewhere flow through `determineLanguage()` — half-i18n.
- Dead code: `~30` lines of orphaned `.bibleContainer` CSS from an earlier layout, the unused `quoteCount` math, the no-op `className` ternaries, `percentage` computed twice differently.

---

## 4. Analysis — why it "does a lot right" and still feels wrong

1. **The overview lies about magnitude.** Triple-encoding one number through log-radius, opacity, and a numeral means none of the channels is trustworthy, so the user falls back to reading 27 tiny numbers — at which point a plain table would honestly outperform it.
2. **The map and the road are the same artifact.** The matrix is asked to be an at-a-glance distribution picture *and* a click-through navigator. As a picture it should be dense and fixed-scale; as a navigator it must re-layout, re-normalize, and (at fine grain) go 99% empty. Every drill destroys the picture the user was just reading — new axes, new scale, no transition — which is why navigation feels disorienting even though each screen individually "works."
3. **The interesting question isn't symmetric, but the UI is.** Users arrive with a directional question — "what does *this BoM book* draw on?" or "where does *Isaiah* land in the BoM?" — one anchor, one distribution. The matrix forces choosing both coordinates at once and gives no way to hold one axis and scan the other (row/column highlight, sorting, an anchored panel).
4. **The payoff screen is good, but the road to it is unpaved:** broken back, broken deep links, clipboard dead ends, debug dumps. Polish problems compound the paradigm problem — it's hard to tell which frustration comes from which.

---

## 5. Recommendations

Three options, in ascending order of ambition. All three keep the verse-pair reader (with its §3.3/§3.4 fixes) — it's the right destination regardless of paradigm.

### Option A — Repair in place: honest heatmap matrix (low risk, ~days)

Keep the matrix paradigm; fix the encoding and mechanics:

- Replace circles with **filled cells** — a sequential single-hue ramp (light→dark), *fixed* scale communicated by a small legend; count on hover/tooltip and optionally as text in dark-enough cells only. Empty cells are blank surface, not gray discs.
- Optional second read: a small corner glyph or two-tone split for quote vs. allusion share (finally using `isQuote`).
- Fix the drill: one gesture = one meaning (cell click zooms to that intersection, header click zooms one axis), stepwise Back, breadcrumb trail (`Book of Mormon › Small Plates › 1 Nephi`), state derived *from* the URL so browser Back and deep links work (fix the slug-case bug; stop scraping DOM for state).
- Add hover tooltips, a "view as table" toggle, keyboard/aria on cells.

**Tradeoffs:** cheapest path, preserves users' existing mental model, and a heatmap genuinely is the canonical form for grid magnitude. But it does not solve §4.2 — chapter-level grids stay ~99% empty, so either cap the drill at book level (cell click goes straight to the reader, arguably fine) or accept sparse deep grids. The view gets *correct* rather than *compelling*; visual appeal ceiling is moderate.

### Option B — New paradigm: anchored flow ("what does this book draw on?") (medium, ~1-2 weeks)

Replace the symmetric matrix with an **asymmetric master-detail**:

- **Left rail — the anchor spine:** the Book of Mormon as a vertical strip of books (scaled by verse count) with an inline density strip (per-chapter heat) showing where Bible material concentrates. Click to anchor a book, click again for a chapter.
- **Main panel — the distribution:** for the current anchor, a horizontal bar list of Bible sources ranked by count, each bar split quote/allusion (two shades), labeled with counts — an honest, instantly readable magnitude encoding that replaces the entire circle grid. Clicking a bar opens the existing verse-pair reader scoped to that pair.
- **Axis flip toggle** ("anchor on Bible instead") covers the reverse question — Isaiah's footprint across the BoM — without a symmetric grid.

**Tradeoffs:** matches the actual questions users ask, every encoding is a ranked bar (the most legible magnitude form), sparse levels stop being a problem because you only ever render one anchor's nonzero partners, and mobile collapses naturally (rail becomes a drawer). Costs: you lose the single-glance "whole landscape at once" poster that the matrix gives at group level; it's a rebuild of `Bible.js` (though `data.js`, the id-range machinery, and the reader all carry over); ranked lists feel more utilitarian, less like a signature visualization.

### Option C — Signature piece: bipartite ribbon overview + Option B detail (high, ~2-4 weeks)

Add an overview worthy of being the page's identity: **two parallel spines** (Bible left, Book of Mormon right, each a proportional stacked bar of its books) connected by **ribbons** whose thickness = correspondence count and whose tint distinguishes quote vs. allusion. Isaiah→2 Nephi would read as a thick cable; Obadiah as a hairline. Hover highlights a book's full fan; click anchors into the Option B detail view. (SVG, ~66+15 nodes and ~200 book-pair ribbons after aggregation — comfortably renderable; d3-sankey or hand-rolled cubic paths.)

**Tradeoffs:** this is the "enormous dataset made visible" moment the current grid gestures at and misses — genuinely distinctive, screenshot-able, and it encodes direction (Bible → BoM) which the matrix cannot express at all. Costs: highest effort and the only option with real technical risk (ribbon crossing clutter needs careful ordering/bundling; needs a static fallback for reduced-motion/print; hardest to make accessible — must ship with the Option B list as its keyboard/screen-reader twin, not as an afterthought). Skip the chapter-level ribbon idea entirely; ribbons only work at book aggregation.

### Recommendation

**B now, C as the second phase, A only if bandwidth is very tight.** The matrix's deepest problem is paradigm (symmetric drill over an asymmetric, power-law relation), which A cannot fix. B solves the actual UX while reusing the reader and data layer, and C layers a memorable overview on top of B's skeleton rather than replacing it — the ribbon clicks into B's anchor model cleanly, so the work compounds. Whichever option is chosen, the §3 mechanical fixes (URL round-trip, browser Back, clipboard dead end, debug `<pre>`, alerts, sort arrows, `isQuote` wiring) are table stakes and mostly independent of paradigm — several are half-day fixes worth doing immediately.

---

## Appendix: screenshot index

| File | State |
|---|---|
| `base-landscape.png` | Root grid, 1440×900 — group × group circles, opacity/contrast failures visible (Moroni row, "10" cell) |
| `verse-or-chapters.png` | Books level (Small Plates × Torah) after a circle click — both axes jumped at once; gray placeholder discs on empty rows (Enos, Jarom) |
| `deeplink-chapters.png` | Chapter grid (1 Nephi × Genesis), reachable only by hand-typed URL — 1,100 cells, 3 data points, sea of gray |
| `verse-viewer.png` | Verse-pair reader — the strong screen; note repeated/incorrect verse headings ("Six Days of Creation…" on every row — needs separate investigation) |
| `base-portrait.png` | 390×844 — axis swap works, but title and third column clipped, no scroll affordance |
