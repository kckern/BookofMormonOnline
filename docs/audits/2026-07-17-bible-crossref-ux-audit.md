# Bible Cross-Reference View — Post-Overhaul UX Audit

**Date:** 2026-07-17
**Scope:** `frontend/webapp/src/views/Analysis/Bible/` as rebuilt on `dev` (ribbon overview + anchored master-detail + paginated reader; commits `118f2321`…`1b7420b8`).
**Method:** full code read of all 15 files; live Playwright session against the CRA dev server (`10.0.0.10:8201` — note the Next.js migration now occupies `:8200`) at 1440×900, 1280×700, and 390×844, light and dark, with DOM measurements to confirm every visual suspicion. Screenshots in `bible-analysis-screenshots-2026-07-17/`.
**Prior art:** `2026-07-16-bible-cross-reference-ux-dataviz-audit.md` (audited the old circle matrix, superseded). This audit covers the replacement.

**Status: RESOLVED (2026-07-17)** by `docs/plans/2026-07-17-bible-crossref-ux-pass2.md`, executed on `feature/bible-crossref-ux-pass2` (18 tasks, each spec- and quality-reviewed; final whole-branch review verdict SHIP; 91/91 Bible tests pass). All four P0 defects fixed (hover dimming restored; mobile bars full-width; ResizeObserver loop removed structurally by measuring an svg-only box; rail centers the anchored book), the overview re-grounded as a true Sankey (spine height = reference count — user-approved) with a colorblind/contrast-validated light+dark palette, all view state (highlight, reader origin, mode/expand) moved into the URL, the table twin made sticky/filterable/clickable, and the mobile experience fixed end to end. After-screenshots: `bible-analysis-screenshots-2026-07-17-after/`. Still open (deferred): the backend verse-heading misassignment (§6 — Alma 47:4 shows Alma 34's heading; a data-layer issue, out of scope for this UI pass); minor a11y/UX follow-ups noted in the final review (table→reader in-app Back lands on the BoM anchor rather than the table).

---

## Verdict

The overhaul fixed the old view's worst sins — the fake-data gray discs are gone, quote-vs-phrase is finally encoded, the anchored master-detail is a real navigation model, and the reader survived intact. But the shipped result has **four outright defects confirmed by measurement** (hover dimming dead, mobile partner bars invisible, a ResizeObserver error loop on mobile, anchored book not scrolled into view), a headline visualization whose strongest visual channel encodes the wrong variable, and a mobile experience that ranges from useless (overview) to broken (anchor bars, truncated refs). It reads as a desktop-first feature that was never once opened on a phone before merging.

| # | Finding | Severity |
|---|---|---|
| 1 | Ribbon hover/focus dimming never works — animation `fill-mode: both` pins `opacity: 1` | Broken |
| 2 | Mobile anchor view: partner bars render at 0px — the entire chart is invisible | Broken |
| 3 | Mobile overview: ResizeObserver error loop; CRA overlay covers the page | Broken |
| 4 | Bible-side rail doesn't scroll the anchored book into view (Isaiah at 1091px in a 680px rail) | Broken |
| 5 | Mobile reader truncates the BoM verse reference ("Alma 34:11" → "Alma 3…") | Broken |
| 6 | Ribbon thickness encodes verse-count share, not reference count — the ink lies | Dataviz |
| 7 | Dark-mode overview is murk: 74% of ribbons are near-black on near-black | Dataviz |
| 8 | Table twin: 335-row, 11,336px dump — no sticky header, no filter, rows aren't links | Dataviz/Nav |
| 9 | Reader back-crumb/Esc always returns to the BoM anchor, even when you came from a Bible anchor | Nav |
| 10 | Ribbon click discards the Bible half of what you clicked (division-level) | Nav |
| 11 | Assorted: jargon, redundant scope indicators, dead space, a11y misuse | Polish |

---

## 1. What works — keep it

- **The anchored master-detail is the right model** (`05-anchor-2nephi.png`). Rail + chapter strip + ranked partner bars answers "what does 2 Nephi draw on?" in one glance, and the URL captures all of it (`urlState.js` is clean, legacy URLs parse, garbage degrades to overview instead of a crash).
- **Quote vs phrase is finally visible** — split bars, two-tone ribbons, QUOTE badges, a consistent green pair with a documented ramp. The old audit's top data complaint is addressed.
- **The chapter strip** (`ChapterStrip.jsx`) is genuinely good: compact, keyboard-navigable, counts in `title`/`aria-label` instead of crammed into 12px cells, ramp legible in both themes.
- **Empty and loading states exist** and are worded specifically ("No known correspondences between X and Y"), not generic.
- **Reader highlighting degrades gracefully** (`highlighter.jsx`) — unmatched highlight strings no longer eat text.
- Every component has a test file. The module-scope aggregation (`aggregate.js`) is tidy and documented.

That's the floor. Now the problems.

---

## 2. Broken behavior (measured, not speculative)

### 2.1 Hover dimming is dead — the overview's only focus mechanism does nothing

`crossref.css:209-214` gives every ribbon path `animation: xref-fadein 250ms both`. Animation fill mode `both` holds the keyframe's final `opacity: 1` **forever**, and CSS animations beat normal declarations — so `.xref-ribbon.dim path { opacity: 0.15 }` (`crossref.css:205-207`) is permanently overridden.

Measured live: hovering the Moroni spine puts `class="xref-ribbon dim"` on the 2 Nephi ribbon, computed `opacity: 1`. Compare `01-overview-1440.png` and `02-overview-hover-majorprophets.png`: identical spaghetti; only the hovered rect changes.

Consequence: in a 104-ribbon overplot, hover-isolation is the feature that makes the chart readable at all, and it silently doesn't exist. Same for keyboard focus (`onFocus` sets the same state). Fix is one line — animate only the initial mount (e.g., animate a wrapper, or drop `both` and use `fill-opacity` in the keyframes since `fill-opacity` is the property the non-dim styles already use).

### 2.2 Mobile anchor view: the partner bars are invisible

`crossref.css:244-248` — `.xref-anchorbody { align-items: flex-start }`. On desktop (row direction) that's harmless. In the ≤700px media query the flex direction flips to `column` (`crossref.css:563-567`), so `flex-start` now controls the **cross-axis width**: children shrink to content. The media query gives `.xref-rail` an explicit `width: 100%` but not `.xref-detail`.

Measured at 390×844: `.xref-detail` = **199px** wide on a 390px screen, the bar `1fr` track resolves to **2px** (just the flex gap), quote and phrase segments = **0px**. `15-mobile-anchor-viewport.png` shows the result: a centered column of `Isaiah 406 / Matthew 38 / …` — labels and numbers with no bars between them, floating in an ocean of margin. The entire quote/phrase encoding, the view's main event, is gone on mobile, and nothing looks "broken" enough for a user to know they're missing anything. One `width: 100%` (or `align-items: stretch` in the column branch) fixes it.

### 2.3 Mobile overview: ResizeObserver feedback loop, dev overlay covers everything

`14-mobile-overview-viewport.png` is a wall of red: repeated `ResizeObserver loop completed with undelivered notifications` errors, with the CRA overlay blocking the page. The measure loop in `Overview.jsx:22-38` sets `height = max(clientHeight, 640)`, the SVG re-renders at that height, which changes the wrapper's height, which re-fires the observer. On narrow viewports (where the meta-viewport also rescales — `scrollW` 421 vs a 390 device) it oscillates enough to throw repeatedly.

In production there's no overlay, but the errors still fire — every error tracker and `window.onerror` hook will eat a stream of them, and the loop is wasted layout work on every rotation/resize. Debounce the measure or only grow, never shrink, from the observed height.

### 2.4 The Bible rail ignores its own anchor

Anchor on Isaiah (`07-anchor-kjv-isaiah.png`): the 66-book rail renders scrolled to Genesis. Measured: anchored button `offsetTop` 1091 in a 680px-tall scrollbox, `scrollTop` 0. The one thing the rail exists to show — *where you are* — is off-screen; the user sees Torah books and has to hunt for the highlighted item. `Rail.jsx` has no `scrollIntoView`/ref logic at all. On the BoM side the list is short enough to mask the bug, which is presumably how it shipped.

### 2.5 Mobile reader amputates the verse reference

`verseViewerTable` is `table-layout: fixed` at 50/50, and `.ref` is `white-space: nowrap; overflow: hidden` with no min-width (`crossref.css:510-519`). At 390px: measured `clientWidth` 41 vs `scrollWidth` 82 for "Alma 34:11" — it renders as "Alma 3" (`16-mobile-reader-viewport.png`), which is not truncation, it's a **different reference**. The row's identity is destroyed. (The heading next to it truncates too, which is fine — but the ref must win the space fight; drop the heading on narrow screens instead.)

Also mobile reader: justified text (`text-align: justify`, `crossref.css:541`) in ~150px columns produces grotesque rivers — "Now there is not any man that can" stretches word gaps to 3+ spaces. Justification needs line lengths it will never get on a phone; use `text-align: left` under the breakpoint.

---

## 3. The overview: the ink encodes the wrong thing

### 3.1 Ribbon thickness ≠ reference count

Spine segments are weighted by **verse count** (`Overview.jsx:47,53,73` — `weight: b.verses`), and `ribbonLayout.js` then distributes each node's *full span* among its ribbons pro-rata (`raw = value/total × span`). So a ribbon's thickness is "share of this node's verses-tall strip," not "number of references." Two consequences, both visible in `01-overview-1440.png`:

- **Fat ≠ many.** "Historical" and "Wisdom" are tall spines (lots of verses) with modest reference counts, so their ribbons render as the widest bands on the canvas. The 2 Nephi–Isaiah connection — the single largest correspondence in the corpus (406 refs) — reads as a middling dark stripe beneath them. The viewer's eye ranks Historical→Alma above Isaiah→2 Nephi. That ordering is wrong by roughly an order of magnitude.
- **Cross-node comparison is meaningless.** The same 20 refs is a hairline on Psalms and a slab on Obadiah. Nothing on screen says so.

The `--emphasis` opacity ramp (`Overview.jsx:244`) is a tacit admission — darkness patches what width breaks. "Area lies, color corrects" is the classic Sankey failure. Either make node heights = sum of link values (a true Sankey, so thickness means refs), or keep verse-proportional spines but say so on screen ("spine height = book length") and let *color alone* carry magnitude with a real scale. Right now the only place the actual number exists is a native `<title>` tooltip with its 500ms delay (`Overview.jsx:264`) — invisible on touch, invisible to anyone who doesn't think to hover and wait.

### 3.2 Dark mode turns the chart into mud

`crossref.css:32-41` swaps the pair so phrase = `#1a6446` in dark mode. Phrases are 74% of all connections, drawn at `fill-opacity` 0.3–0.75 on a near-black page: `10-overview-dark.png` shows a canvas where most ribbons are barely distinguishable from the background and from each other; only the two big quote cores read. The light-mode chart is overplotted; the dark-mode chart is *absent*. The dark ramp inversion is right for the chapter-strip cells (light text surfaces) but wrong for large translucent fills — the ribbon pair needs its own dark-mode values with enough luminance to separate from `--surface-0`.

### 3.3 Small books are anonymous

Labels are dropped for spine segments under 9px (`Overview.jsx:132,165`) — Enos, Jarom, Omni, Words of Mormon, 4 Nephi, and a dozen Bible books have no label, no number, nothing but a 16px sliver whose meaning lives in an `aria-label` sighted users never see. Expanding "Major Prophets" (`03-overview-expanded-majorprophets.png`) labels Isaiah/Jeremiah/Ezekiel but leaves Lamentations and Daniel as unlabeled ticks, visually identical to divisions. There's no fallback (leader lines, hover label, side list). On mobile it's total: ≤700px hides *all* spine labels (`crossref.css:573`), and touch has no hover — the mobile overview is an unlabeled, un-tooltipped, wrongly-weighted ribbon texture. It communicates literally nothing except "green."

### 3.4 The expand interaction is jumpy and half-invisible

Clicking a division relayouts the entire canvas with no position continuity — every ribbon jumps and replays its stagger animation, so the user loses the thread they clicked to follow. The "collapse Major Prophets" button materializes inside the hint line and shifts the chart down ~11px (layout jump). And since `expanded` is component state, not URL state (`Overview.jsx:17`), refresh/share/back all silently lose it — in a view whose own header comment declares "the URL is the single source of truth" (`urlState.js:1-2`). Same for chart-vs-table mode.

### 3.5 The table twin is a data dump with no exits

"View as table" renders all **335 rows at once — an 11,336px page** (`04-overview-table.png`): no sticky header (sort context scrolls away instantly), no filter, no pagination, no totals row. Worse, rows are inert `<td>` text (`TableTwin.jsx:43-51`): the chart's ribbons navigate to anchors, but the table — pitched by the SVG's own aria-label as the full-detail alternative — navigates nowhere. For the accessibility-fallback audience it's a dead end; for everyone else it's scroll punishment. Rows should link to the reader (`/analysis/bible/bom/X~Y` already exists for exactly this), the header should stick, and a book filter would cost one input.

---

## 4. Navigation and information architecture

### 4.1 The reader forgets where you came from

`Reader.jsx:76-91`: `backState` is hard-coded `canon: "bom"`. Anchor on **Isaiah**, click the 2 Nephi bar, then Esc or the breadcrumb — you land on the **2 Nephi** anchor, a screen you've never visited. The breadcrumb (`⌂ Overview › 2 Nephi › × Isaiah`) rewrites history to match, presenting a path you didn't take. Round-tripping from a Bible anchor is impossible without the browser back button — which, confusingly, behaves differently from the UI's own back affordances. The reader state needs to carry (or infer from history) which canon anchored it.

### 4.2 Ribbon clicks throw away half the click

At division level, clicking the Torah→Mosiah ribbon navigates to `anchor bom/Mosiah` — the Torah half evaporates (`Overview.jsx:248-253`, `highlight` only set when the left node is an expanded book). The user clicked a *relationship* and got a *book*, with a partner list re-sorted by total and no trace of Torah emphasis. And when the left *is* a book, the highlight travels in ephemeral `location.state` (`index.jsx:15-20`) — refresh and it's gone, share the URL and the recipient never sees it. Cheap improvement: division clicks land with the partner list filtered/marked to that division's books; book-level highlight belongs in the URL.

### 4.3 Esc is a global grenade

`Reader.jsx:76-84` binds Escape on `document` — pressing Esc while focus is in the site-wide search box (or any future modal) yanks the user out of the reader. Guard on `e.target`.

### 4.4 Small asymmetries that read as unfinished

- BoM refs are links to `/read/...`; Bible refs are inert spans (`Reader.jsx:152,162`). If Bible text has no destination, fine — but then the two columns shouldn't style refs identically, promising a parity that isn't there.
- "⇄ anchor on Bible" (`AnchorView.jsx:39-41`): "anchor" is the codebase's word, not the user's, and the button doesn't say where it lands (it goes to the highlighted-or-top partner — from 2 Nephi you're teleported to Isaiah). "View from Isaiah's side ⇄" would say what it does.
- The reader's crumb tail is `× 2 Samuel` — a multiplication sign as a nav label (`Reader.jsx:205`).
- Reader header: breadcrumb left, *title* pushed to the far right corner by the header's `space-between` (`08-reader-alma-2samuel.png`). Titles don't live in the top-right; it reads as a layout accident. And "**Alma references to 2 Samuel**" is not a sentence (Alma's references? Alma, references to?).
- Sort affordances are three different dialects: reader columns use `▲/▼/△` with `aria-pressed`-when-desc (`Reader.jsx:113-130`), the table twin shows an arrow only on the active column, and neither uses `aria-sort` (the actual ARIA mechanism for sorted columns). The hollow `△` on the inactive column reads as "sorted, weird direction," not "sortable."

---

## 5. Layout, spacing, use of space

- **Anchor view wastes the right half of the screen.** Bars cap at 640px (`crossref.css:366-371`) inside a `flex: 1` detail column — at 1440px, everything interesting occupies the left ~55% and the right 500px is blank (`05-anchor-2nephi.png`). Chapter-scoped, it's worse: one bar and a chip in a field of nothing (`06-anchor-2nephi-ch12.png`). Either let the bars breathe wider or use the dead column for something (the top pair's verse preview would sell the click into the reader).
- **Chapter scope is announced three times** — breadcrumb `› ch. 12`, heading "2 Nephi 12", and a `ch. 12 ✕` chip (`AnchorView.jsx:34-73`). One dismissible chip *or* the heading, not a chorus.
- **The scoped bar rescales to fill.** Scope to ch. 12 and Isaiah's 23 refs draws exactly as long as 406 did unscoped — per-view max scaling is defensible for ranking, but with a single bar it looks like a bug. Showing the bar against the unscoped max (or just dropping the bar when n=1) would keep lengths meaningful.
- **1280×700 clips the overview** below the fold (823px page: min-height 640 chart + header) — the two bottom divisions and Moroni are cut at exactly the viewport heights most laptops have (`13-overview-1280x700-viewport.png`). The SVG never shrinks below 640; letting it compress to ~540 would fit the fold.
- **Legend placement drifts per screen**: header-right on the overview, *below* the bars and below the "Show all" button on the anchor view (`AnchorView.jsx:74-84`), absent in the reader (where QUOTE badges appear). Pick a place.
- **Quote/phrase bar segments read as two bars.** The 2px gap between segments (`crossref.css:401-405`) plus independent rounded corners makes "1 Nephi ▮▮ ▯▯" look like two data points, not one split bar (`07-anchor-kjv-isaiah.png`). Stack them flush; the two greens don't need a gutter.
- **Rail density bars are decorative.** Linear scale, max = Isaiah/2 Nephi, so 60 of 66 Bible books show sub-2px dots (`07`). The channel exists but carries ~2 bits. Sqrt-scale it or drop it.
- **Touch targets:** chapter cells are 22×22px, spine rects 16px wide — half the 44px guideline, on the two elements mobile users must hit.

---

## 6. Data presentation details

- **Verse headings look misassigned.** Alma 34:11 and Alma 47:4 both display "Amulek Explains the Plan of Redemption through Christ" (`08-reader-alma-2samuel.png`) — right for 34, flatly wrong for 47 (Amalickiah's plot). Isaiah 14:12 shows "Thanksgiving and Praise." Either the API returns the enclosing-page heading rather than the verse's section heading, or the join is off by one somewhere. Worth a backend look; wrong scholarship labels undermine the whole feature's credibility.
- **"refs" everywhere** — "692 refs", "406", "23 refs". It's a scholarly audience; "references" costs eight characters and reads like the site's register. Also "2 Nephi **draws on**" vs "Isaiah **appears in**" is a nice asymmetry — keep that, it's the one piece of microcopy doing real work.
- **Load more is a grind**: 406 pairs ÷ 20/page = 20 clicks to read 2 Nephi × Isaiah end-to-end (`Reader.jsx:11,181-189`), with no "load all" and no position indicator (the button count "386 remaining" is the only inventory). Reading flow wants infinite scroll or at least a much larger page.
- **No total in the reader header** — the anchor view told you "406"; the reader forgets it. "406 correspondences · 356 quotes" belongs under the title.
- **Repeated partner verses aren't grouped**: Isaiah 52:2 appears in consecutive rows with its full text re-rendered (`09-reader-2nephi-isaiah-viewport.png`). When N BoM verses map to one Bible verse, grouping would both shorten the page and *show* the fan-out, which is the interesting fact.
- **Highlight coverage is thin and the color is alien**: rows whose texts visibly share phrases ("arise from the dust" / "shake thyself from the dust") show no highlight, and where one appears it's only on one side, in red-on-yellow (`crossref.css:546-549`) — the lone red element in an otherwise all-green system, reading as an error state. If the API can't produce bilateral matches reliably, a client-side common-phrase fallback exists in `highlighter.jsx` waiting to be pointed at both texts.
- **a11y misuse in the bars**: `role="listitem"` on a `<button>` (`PartnerBars.jsx:31`) *replaces* the button role — screen readers announce a list item, not an actionable control. Put the role on a wrapper. Ribbons (`<g onClick>`) are entirely keyboard-unreachable — acceptable only if the table twin were the real equivalent, which (§3.5) it currently isn't.
- Console shows 8× resource 404s on load (also present on other views; likely a shared-asset issue, not this view's — but it's noise worth running down separately).

---

## 7. Priority fix list

**P0 — broken, cheap, do first**
1. Kill the animation/`opacity` collision so hover-dim works (`crossref.css:209-219`). One-line class or keyframe change.
2. `width: 100%` on `.xref-detail` in the ≤700px branch (mobile bars). One line.
3. `scrollIntoView({block: "center"})` on the anchored rail item on mount. Three lines.
4. Let `.ref` win the truncation fight on mobile; unjustify text ≤700px. CSS only.
5. Debounce/stabilize the Overview resize measure (ResizeObserver loop).

**P1 — the visualization tells the truth**
6. Decide the spine semantics: true Sankey (node = sum of link values) **or** labeled verse-proportional spines with color-only magnitude + on-screen scale. Today's hybrid misleads.
7. Dark-mode ribbon palette that separates from the background.
8. Table twin: sticky header, rows link to the reader, book filter.
9. Reader remembers its origin canon (back/Esc/breadcrumb).

**P2 — polish**
10. Put `expanded`/mode/highlight in the URL; label small books on demand; consolidate scope indicators; fix `role="listitem"`/`aria-sort`; reader pair grouping and totals; investigate the heading misassignment (backend).

---

*Screenshots: `docs/audits/bible-analysis-screenshots-2026-07-17/` — numbered 01–16, filenames describe state; `console.log.txt` has the captured errors.*
