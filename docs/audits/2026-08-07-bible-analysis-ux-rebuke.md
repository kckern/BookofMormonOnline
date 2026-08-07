# Bible Analysis (`/analysis/bible`) — UX Rebuke

**Date:** 2026-08-07 · **Reviewer:** senior UX design review (screenshots via Playwright against local dev, 1440×900 and 390×844) · **Scope:** Overview ribbon chart, AnchorView (rail + partner bars), Reader, table twin.

---

## Verdict — Grade: C−

The skeleton is smarter than the skin. URL-as-single-source-of-truth (`urlState.js`), real ARIA roles, keyboard nav on the chapter strip, reduced-motion support, a table twin for the chart — someone read the accessibility chapter, and I'll say so once. But the front door is a wall of unlabeled monochrome spaghetti that literally cannot be operated on mobile, the ribbon interactions misfire (clicks land on the wrong ribbon, the highlight parameter corrupts itself in the URL, chapter scope silently evaporates on the way to the reader), and the product's entire payload — actual verse text, side by side — is hidden behind controls that don't look clickable, with **zero words of scripture visible on any screen until the final click**. This is a data-viz project that forgot it's a reading tool. The pieces are one honest week from a B+; today it ships confusion at 60fps.

---

## The four complaints, adjudicated

### 1. "Too many clicks before you get to a useful text comparison." — **Partially agree: it's not the count, it's the scent.**

Measured (see autopsy below): from the sidebar it's 4 clicks to side-by-side text; from the `/kjv/1-corinthians` anchor page it's **one click**. One click is not "too many." The complaint is still correct in spirit, for two reasons:

- **The one click is invisible.** The partner bars (`PartnerBars.jsx`) render as a chart. Nothing — no chevron, no "view verses" label, no hover hint text — says "this bar is a button that opens the verse reader." A bar chart is, in every user's prior experience, decoration. The affordance exists only in `cursor: pointer` and an `aria-label`. Users report "too many clicks" when they wander: they click chapters, the flip button, the rail, before stumbling onto the bar.
- **Not one verse of text appears before the last click.** Overview → counts. Anchor → counts. Chapter strip → counts (in a `title` attribute!). The user's goal is text; the interface makes them tunnel through three all-numeric screens to reach the first word of scripture, so every screen *feels* like an extra click even when it isn't.

Fix: put verse samples upstream (see P0-2) and label the drill-down (P1-4).

### 2. "The Sankey drilldown doesn't zoom as expected." — **Agree, with three concrete misfires.**

What clicking actually does (`Overview.jsx:166-167, 302-314`):
- **Division node** → in-place spine expansion (`?expand=major-prophets`). Closest thing to a drill, and the least broken — but there's no transition; the whole diagram relays instantly with no visual continuity, and the "◂ collapse Major Prophets" escape hatch appears in the *header*, nowhere near where you clicked.
- **Book node** → hard context switch to the AnchorView. Not a zoom; a different page with a different chart grammar (spine ribbons → horizontal bars). Users expecting focus+context get teleported.
- **Ribbon** → navigates to the *Book of Mormon* side's anchor with `?hl=<bible-side>`. You click a flow expecting to see the verses in that flow; you get another bar chart with one row tinted gray. That tint (`.xref-bar.highlighted`) is also the hover color — indistinguishable from your own mouse.

And two outright defects that make the interaction feel broken rather than merely unexpected:

- **Clicks land on the wrong ribbon.** 104 ribbons overlap; the topmost SVG path wins. Playwright could not even hover the first ribbon (`Alma|Pauline Epistles`) in 30 seconds because `3 Nephi|Gospels & Acts` intercepts the pointer. An `elementFromPoint` probe at dead center of the chart hits `Alma|Minor Prophets` — a hairline. 29 of the 104 ribbons carry ≤5 references; they're visually subordinate (good, `--emphasis` in `Overview.jsx:298`) but are equal-priority *hit targets* layered over the cables users actually aim for. My hover readout while sitting mid-chart: "Gospels & Acts ↔ Omni · 2 references · 0 quotes."
- **The highlight parameter corrupts itself.** `serialize()` at `urlState.js:94` string-concatenates `?hl=${slugify(state.highlight)}` with no `encodeURIComponent`, and `slugify` (`canon.js:115-116`) preserves `&`. Clicking any "Gospels & Acts" ribbon produces `?hl=gospels-&-acts` — the `&` splits the query string, `hl` parses as `gospels-`, resolves to nothing, and the highlight is silently dropped. Verified live: raw URL → 0 highlighted bars; `%26`-encoded → 5.

### 3. "Scroll panels are ugly and unhelpful." — **Partially agree.**

The rail (`Rail.jsx`, `.xref-rail` at `crossref.css:317-323`) is a 240px column with `max-height: calc(100vh - 220px); overflow-y: auto`. Measured on `/kjv/1-corinthians`: **680px viewport showing 2870px of content — 76% of the list hidden** in a nested scroll region while the main detail column holds 318px of content inside an ~840px-tall space that never scrolls (page scrollHeight = viewport = 900). So the layout is: a cramped scrolling tunnel on the left, a two-thirds-empty plain on the right. That's the "ugly and unhelpful" being reported — not the rail's *content* (the per-book density bars and auto-centering on the anchored book, `Rail.jsx:14-22`, are genuinely good) but its *proportions*: 66 Bible books at full text size to serve the one you're on, burning a fixed column while the money area sits vacant. On mobile the rail caps at 240px (`crossref.css:686-688`) — scroll-within-scroll on a touch screen, the classic trap.

Not agreed: the rail should not be deleted. It should be demoted (see P1-5).

### 4. "Statistical charts should be presented alongside actual data samples." — **Agree completely.**

Every pre-reader surface is pure aggregate: ribbons (counts), rail density bars (counts), chapter heatmap (counts hidden in `title`/`aria-label` only — `ChapterStrip.jsx:4-5`), partner bars (counts), table twin (counts). The hover readout is more counts ("181 references · 4 quotes"). At no point does the interface show a *single example* of what a "reference" even is — a quote? a shared phrase? how long? — until the reader. The chart asks for trust it hasn't earned. One sampled verse pair under the hovered/selected element would teach the unit of analysis instantly and double as the missing advertisement for the reader. This is the highest-leverage fix on the page (P0-2).

---

## Additional sins (worst first)

1. **The mobile overview is inoperable.** Below 700px, `.xref-spinelabel { display: none }` (`crossref.css:689`) removes every book/division label; `spineW` collapses to 24px (`Overview.jsx:132`). Result at 390px (screenshot `i8`): two stacks of anonymous gray boxes joined by pale green mist, under a hint that says "Click a Bible division to expand its books" — *which one?* Touch users also get no `title` tooltips and no hover readout. The chart communicates nothing and is honestly worse than not rendering it.
2. **Chapter scope is silently discarded en route to the reader.** On `/kjv/1-corinthians/15` the header says "1 Corinthians 15 appears in 40 references," Alma bar reads 11. Click Alma → reader shows "26 references" — the *unscoped* Alma×1 Cor set. Cause: `openReader` (`AnchorView.jsx:29-36`) only forwards `bomChapter` when `canon === "bom"`; a Bible-side chapter has no representation in reader state at all (`urlState.js` has no `bibleChapter`). The user filtered, the product agreed, then threw the filter away without a word.
3. **Quote/phrase presentation contradicts itself in the reader.** Header says "56 references · 48 quotes," yet the first four pairs — the sacrament prayers against 1 Cor 11:24-25, the most famous parallels in the corpus — render with no QUOTE badge and no highlighted text. Across the first 50 rows: 43 badges but only 28 highlight `span.highlight`s in 100 cells. Whether the classification or the highlight API is at fault, the visible effect is a green legend ("quote / phrase") that the actual rows refuse to corroborate.
4. **The reader's mirrored ref layout separates labels from their text.** Bible refs are flushed to the far-right page edge (`.scriptureRef.right .ref`, `crossref.css:637-639`) while their verse card starts mid-page; on a quiet row your eye travels ~500px of dead air to bind "1 Corinthians 11:24" to its card. Meanwhile the BoM heading ("The Sacrament: Blessing the Bread") repeats verbatim on *every* row (`Reader.jsx:167`) — four identical gray captions in one viewport — and the Bible side's heading slot is usually empty, so the header rows are asymmetric noise.
5. **Desktop justified text in 530px columns.** `.scriptureCell p { text-align: justify }` (`crossref.css:653`) produces visible rivers ("and always␣␣remember␣␣him"). The <700px media query already concedes justify is wrong in narrow columns (`crossref.css:693`) — 530px is a narrow column. Left-align everywhere.
6. **The table twin is buried and half-labeled.** "View as table" is a great legibility escape from the spaghetti, but it's a small toggle in the header, and my first instinct-guess `?mode=table` 404'd conceptually — the real param is `?view=table` while the *internal state key* is `mode` (`urlState.js:26` vs `Overview.jsx:16`). Naming drift like that is how the next engineer ships a broken link. The table itself (nice sticky header/footer) still shows zero text samples, and its Bible column entries aren't clickable — only the BoM side links.
7. **Bible verse refs in the reader are dead text.** BoM refs link to `/read/...` (`Reader.jsx:163`); the Bible ref is a bare `<span>` (`Reader.jsx:173`). Half the comparison has no destination.
8. **"⇄ view from Moroni" is insider jargon.** The flip button (`AnchorView.jsx:47-51`) changes both the anchor canon *and* the book, and its label only makes sense after you've understood the whole model. First-timers will read it as a typo.
9. **Hover feedback lives a foot from the cursor.** The readout (`Overview.jsx:261`) is a fixed status line *above* the chart. Hovering a ribbon at the bottom of a 640px diagram, the answering text appears 600px away in your peripheral nowhere. Native `<title>` tooltips exist but take a second to appear and never on touch.
10. **Scoped partner bars strand their counts.** When chapter-scoped, bars shrink against the unscoped max (`PartnerBars.jsx:25` — defensible for comparability) but the count column stays glued to the far grid edge, so short bars float in an acreage of blank track with their numbers orphaned ~500px right.

Credit where due, so the sins above land as choices, not ignorance: URL codec with legacy parsing and graceful degradation, `aria-live` readout, radiogroup + arrow-key chapter strip, `prefers-reduced-motion`, focus-visible outlines, emphasis-weighted ribbons, and the rail auto-centering its anchor. Good bones. Bad manners.

---

## Click-count autopsy (to first side-by-side text)

Cold start, sidebar navigation, 1440px:

| # | Action | Screen you get | Text visible? |
|---|--------|----------------|---------------|
| 1 | Sidebar → "Analysis" | Hub cards | No |
| 2 | "Bible References" card | Overview ribbons | No |
| 3 | Right-spine BoM book (if you guess that gray 16px rect is a button) | AnchorView | No |
| 4 | Top partner bar (if you guess the chart is a button) | **Reader — side-by-side verses** | **Yes** |

- Minimum from overview landing: **2 clicks**, both on affordances that don't announce themselves.
- From the reviewed URL (`/kjv/1-corinthians`): **1 click** — fine number, invisible target.
- Worst realistic path: expand a division first, or click a ribbon (which lands on an anchor, not the reader): **5 clicks**, and the ribbon path can misfire onto the wrong pair entirely.

The count is acceptable; the *scent* is absent. Verdict: fix discoverability and upstream samples, not the information architecture.

---

## Prioritized fixes

### P0 — broken, ship this week
1. **Encode the `hl` param.** `urlState.js:94`: `` `?hl=${encodeURIComponent(slugify(state.highlight))}` `` — or strip `&` in `slugify` (`canon.js:115`) and migrate the one affected slug. Add a round-trip unit test for every division name in `__tests__`.
2. **Put verse samples next to the stats.** In AnchorView, clicking a partner bar should (or on hover, a side flyout) show the top 2–3 verse pairs inline — ref + first ~120 chars, quote badge — with a "See all 26 →" that opens the reader. Data is already client-side in `data.js`/`aggregate.js` (`pairsFor`); only the text fetch is async, and `BoMOnlineAPI` already batches. This single change answers complaints 1 and 4 at once.
3. **Forward chapter scope to the reader, or say you dropped it.** Add `bibleChapter` to reader state in `urlState.js` and filter in `pairsFor`, or at minimum have `openReader` (`AnchorView.jsx:29`) warn/relabel ("all chapters") when scope is lost.
4. **Fix ribbon hit-testing.** Render hit priority by value: sort ribbon DOM order so high-value ribbons paint (and therefore hit) last, or give ribbons with <5 refs `pointer-events: none` unless a spine node is active. Also move hover feedback to a cursor-following tooltip; keep the status line as the `aria-live` mirror.
5. **Mobile overview: labels or bust.** Below 700px, replace the ribbon SVG with the table twin or the top-partners bar list by default. If the chart must stay, label at least the 9 divisions inside/beside the spine rects instead of `display:none`-ing everything (`crossref.css:689`).

### P1 — design debt, next sprint
6. **Label the drill-down.** Append a chevron + "verses ›" affix to each partner bar row, and set the anchor-view hint line ("Select a book to read matching verses side-by-side") in the vacant right-column space.
7. **Rebalance AnchorView.** Cap the rail's visual weight: collapse non-active groups to headers (accordion), freeing ~2000px of hidden scroll; let the detail column use the reclaimed width for the P0-2 verse samples. Kill the desktop nested scroll by letting the page scroll normally.
8. **Reader row cleanup.** Left-align verse text at all widths (`crossref.css:653`); pull the Bible ref adjacent to its card (left-align within the right column); show the section heading once per run instead of per row; make Bible refs link somewhere (or drop the BoM link styling so the asymmetry is at least honest); reconcile QUOTE badges/highlights with the header counts — if the highlight API has no data for a pair, don't count it as a quote in the header.
9. **Division expansion continuity.** Animate spine relayout (FLIP on `y`/`height`, ribbons can crossfade), and put the collapse control on the expanded group itself.
10. **Rename `?view=table` or the internal `mode` key** so URL and state vocabulary match (`urlState.js:26`, `Overview.jsx:16`).

### P2 — polish
11. Replace "⇄ view from Moroni" with "Flip: view from the Book of Mormon side" or an explicit two-tab canon switcher.
12. Chapter-strip cells: show counts on hover in a real tooltip, not just `title`; 26px cells with 0.65rem numerals are at the floor of legibility.
13. Scoped partner bars: move counts to sit at the end of each bar (or right-align the track column to the longest *scoped* bar) so numbers stop floating in space.
14. Table twin: make the Bible column clickable to the KJV anchor, and add a quotes/phrases mini-bar per row so it's not raw integers.
15. Overview header wraps clumsily at 390px ("2,957 connections ·" orphan dot — `Overview.jsx:233-235`); restructure the headline stack for narrow widths.

---

## Evidence log

**Method:** Playwright (repo-root `node_modules/playwright`, headless Chromium 1223) driving the live CRA app through the Next front door at `http://10.0.0.10:8200`. Real rendered screenshots at 1440×900 and 390×844, full-page and element crops, plus scripted interaction probes (`page.evaluate` for scroll metrics, hit-testing, selector counts). Note: plain `curl` of these URLs returns the Next 404 shell (bot-UA SSR gate); everything below was seen through the real browser path. I saw the pages; nothing below is inferred blind. Full-page screenshots rendered small in review, so judgments on fine detail were made from element-level crops.

**URLs exercised:**
- `/analysis` (hub), `/analysis/bible` (overview), `/analysis/bible?expand=major-prophets`, `/analysis/bible?view=table` (and the decoy `?mode=table`)
- `/analysis/bible/kjv/1-corinthians`, `/kjv/1-corinthians/15`, `/kjv/romans`
- `/analysis/bible/bom/3-nephi?hl=gospels-&-acts` vs `?hl=gospels-%26-acts`
- `/analysis/bible/bom/moroni~1-corinthians?from=kjv` (reader, desktop + 390px)

**Screenshots:** `/tmp/bible-audit/` — `i1–i9`, `c1–c5`, `d1–d9`, `m1–m4`, `r1` (desktop/mobile, fold/full, element crops).

**Measured facts:** rail 680px client vs 2870px scroll; anchor detail 318px content, page scroll = viewport (900); 104 ribbons, 29 with ≤5 refs; first-ribbon hover intercepted 30s by overlapping path; center-of-chart hit = `Alma|Minor Prophets`; `hl` raw `&` → 0 highlighted bars, `%26` → 5; reader first 50 rows: 43 QUOTE badges, 28 highlight spans/100 cells; ch-15 scoped Alma (11 refs shown) → reader renders 26.

**Code inspected:** `frontend/webapp/src/views/Analysis/Bible/` — `index.jsx`, `Overview.jsx`, `AnchorView.jsx`, `Reader.jsx`, `Rail.jsx`, `ChapterStrip.jsx`, `PartnerBars.jsx`, `TableTwin.jsx` (via Overview), `urlState.js`, `canon.js`, `crossref.css`; `frontend/webapp/src/views/Analysis/Analysis.js` (hub).
