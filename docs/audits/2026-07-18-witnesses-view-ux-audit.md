# Witnesses View — UX / Visual Design Audit

**Date:** 2026-07-18
**Scope:** `frontend/webapp/src/views/History/Witnesses.js` (index + `SingleWitness`), `Witnesses.css`, `WitnessLifeHeatmap.js`, `WitnessLifeHeatmap.css`, plus the dark-mode rules in `assets/theme/scss/darkmode/_history.scss`.
**Method:** static code audit against a desktop (~2000px) screenshot of the David Whitmer detail page, with data claims verified against `bom_xtras_history` via the private workspace repo's read-only DB CLI. No source files were modified.

---

## Resolution — 2026-07-21

All findings below were implemented via `docs/plans/2026-07-18-witnesses-view-ux-fixes.md`, executed as
17 tasks plus two tracked follow-ups (3b, 7b) on branch `feat/witnesses-ux-fixes`, each implemented and
independently reviewed twice (spec compliance, then code quality) before being accepted.

**Closed:** D1–D5, D6–D9, W1–W8, and the accessibility gaps in §7 are all closed. Notably:

- **D1/D3/D5's actual root cause was corrected during execution, not just fixed** — see the §2
  correction below. The fix ended up deeper than "sort and display the same field": it required
  building an archive-polymorphic date-resolution module (`witnessSources.js`), because the
  `reception` archive (a different set of History rows, sharing this same table) has no `event_date`
  at all and a *clean* `date` column — the opposite of `witnesses`'s shape. A row-shape-based fix would
  have silently corrupted `reception` the first time anyone reused the card component there.
- **D3's "40 year-only sources" turned out to include a data-corruption case the audit didn't catch**:
  15 rows have the ingest date written into `date`, `event_date`, *and* the slug simultaneously (see
  `docs/bugs/2026-07-19-witnesses-ingest-timestamp-dates.md`) — a February-2023 date on an 1830
  document. The shipped date-resolution rule degrades these to year-only precision rather than
  displaying the fabricated date, which is why the "26% of sources missing" framing below undercounts
  the corruption it was pointing at.
- **W4's masonry replacement surfaced a second use of `react-masonry-css`** in ten other views; the
  package was kept installed, only this view stopped importing it.
- **W8's month filter shipped stricter than this audit asked for.** The original recommendation
  ("include year-dated sources when any month of their year is selected") was implemented, code-reviewed,
  and then reverted after review proved it made heatmap cell counts lie (a cell reading "1 source" could
  open 8 cards). The shipped behavior is month-strict: a month filter shows exactly what its cell says,
  and a separate "N more dated YYYY without a month" control widens to the full year. This is a stronger
  fix than what this audit proposed, arrived at because the first attempt was checked against real data
  before shipping.
- **New findings surfaced during implementation, tracked rather than silently fixed:** a `role="button"`
  on `<article>` ARIA-conformance gap (Task 11), a byline that can show a publication name instead of a
  person's (Task 11), and full ARIA-grid conformance for the heatmap — row semantics and arrow-key
  navigation — deferred to Task 7b and completed after the layout work in Tasks 9/16 settled.
- **New findings surfaced during the final verification sweep (Task 17), fixed within this plan's scope:**
  two dark-mode contrast gaps this plan itself introduced (Task 11's firsthand badge, Task 12's decade
  label) were found and fixed before merge.
- **New findings surfaced during the same sweep, out of this plan's scope:** several pre-existing
  dark-mode contrast failures in the breadcrumb trail/dropdown and source-card hover state — these
  predate this branch (2026-05-13/2026-07-13) and are documented separately in
  `docs/bugs/2026-07-21-dark-mode-contrast-gaps-breadcrumb-cards.md` rather than fixed here, to keep this
  branch scoped to the audit that motivated it.

**Correction to §2's own diagnosis:** every "the sort is broken" framing below is imprecise. The sort was
never broken — `year`/`seq` sorting was correct throughout. The card **displayed** a different, corrupt
field (`date`) than the one it sorted by (`year`), which is why a correctly-sorted list *read* as
shuffled. The actual fix was not "pick one field," it was discovering that `event_date` — already
fetched, already in the query — was clean and unused, while `date` was the corrupt column all along.
See `docs/plans/2026-07-18-witnesses-view-ux-fixes.md`'s "Critical context: the data, verified" section
for the full data profile this correction is based on.

---

## 1. Verdict

The detail page has real substance — a life-span heatmap with era markers, month filtering, and a large primary-source archive — but the presentation undercuts it three ways. First, **the data contradicts the chrome**: the card list is sorted by one field (`year`, composition) while displaying another (`date`, event/publication), so a "sorted" list reads shuffled; the publication line is blank on every card; and the heatmap's own meta strip can't account for a quarter of the sources it summarizes. Second, **the page abandons its right half**: at desktop width both the hero and the heatmap occupy ~45% of the container and leave the rest empty, while the hover box below the grid stretches full width — the mismatch makes the layout look unfinished rather than minimal. Third, **the interactions are mouse-only and partly false**: heatmap cells and source cards are unfocusable `div`s, marker cells advertise a pointer cursor with no click handler, and a global Escape handler navigates the user away even when they meant to close the breadcrumb dropdown.

The index page is serviceable but carries an empty dead heading, fabricated ages from placeholder birthdays, an 8-column grid with no mobile fallback, and a typo in user-facing copy.

Findings below are classified **(a) defect** (wrong behavior/content), **(b) weakness** (works, but a worse choice than available alternatives), **(c) opportunity** (unspent potential), ranked by impact within each section. §6 gives concrete layout fixes.

---

## 2. Data-vs-UI defects (highest impact)

### D1 (defect) — Sort key ≠ displayed date: the list looks unsorted
`Witnesses.js:130` sorts by `year` descending:

```js
list.sort((a, b) => (b.year || 0) - (a.year || 0) || (a.seq || 0) - (b.seq || 0));
```

but the card renders `displayDate(doc.date)` (`Witnesses.js:226`). In the data these diverge — verified against `bom_xtras_history` for David Whitmer:

| year | date | document |
|---|---|---|
| 1945 | 1945-09 | Moyle lengthy account |
| 1940 | **1885-06-28** | Moyle ca. 1940 memoir recalling the 1885 meeting |
| 1938 | 1938-09-13 | Moyle interview |
| 1930 | 1930-04-08 | Moyle recalls description |

The user sees the first row of cards dated 1945, 1885, 1938, 1930 and concludes the sort is broken. The `year` column is the composition/recording year; `date` is sometimes the recounted event's date, sometimes a modern publication date (`2003` on three rows, `1991` on one, and one typo `4806`). **Fix:** pick one semantic — sort and display the same field. Recommended: display the composition year prominently (it is what the sort means) and show the recounted-event date as a secondary "recalling Jun 1885" line when `event_date ≠ date`. The `event_year`/`event_date` columns already exist and are already fetched (`GraphQLQueries.js:599–650`).

### D2 (defect) — Publication line blank on every card, but space is reserved for it
`Witnesses.js:225` renders `<div className='pub'>{doc.source}</div>`; in the DB, `source` is empty on **all 152** David Whitmer rows. Every card header carries a 2em-tall flex row (`Witnesses.css:315–329`) whose left half is guaranteed empty, leaving the small right-aligned date floating alone. Either populate `source` in the data, or fall back to `doc.author` / the citation's leading fragment, or collapse the header to a single right-aligned date and stop reserving the row.

### D3 (defect) — Heatmap meta strip can't account for 26% of the sources
`WitnessLifeHeatmap.js:71–82`: sources with month precision increment `totalMapped`; unparseable/out-of-range dates increment `undated`; **year-only dates increment neither**. David Whitmer: 152 total = 109 month-precision + 40 year-only + 3 junk. The strip reads "109 of 152 sources placed · 4 undated" — 39 sources vanish from the arithmetic. Worse, `matchesYearMonth` (`WitnessLifeHeatmap.js:318–323`) returns `false` for year-only dates, so clicking a month filters out sources dated to that same year, and clicking a month in a year that has only year-dated sources yields "No sources in this month" while the sources exist. **Fix:** count them ("40 year-only") in the strip, and either include year-dated sources when any month of their year is selected, or add a per-year annotation row (see O3).

### D4 (defect) — Legend mislabels the color ramp
`colorBucket` (`WitnessLifeHeatmap.js:22–28`) defines five states: 0 empty, 1 = 1 source, 2 = 2–3, 3 = 4–6, 4 = 7+. The legend (`WitnessLifeHeatmap.js:264–267`) shows only bucket-0, bucket-2, and bucket-4 — and labels the bucket-2 swatch "**1–3 sources**" when a 1-source cell actually renders the lighter bucket-1 green. Two of the four greens visible in the grid never appear in the legend. **Fix:** render the ramp GitHub-style — `less ▪▪▪▪ more` with all four swatches, or four labeled swatches `1 · 2–3 · 4–6 · 7+`.

### D5 (defect) — Publication-date garbage stretches the axis
Rows with `date = '2003'`, `'1991'`, `'2023-02-13'` (modern reprint/publication dates for 19th-century accounts) pass the `maxReasonableYear` check (`WitnessLifeHeatmap.js:70–74`) and set `yearEnd`, producing a 1829–2023 axis where the last 135 years are posthumous publication events, not testimony. The `'4806'` typo row is at least caught and binned as undated. This is half data hygiene, half design: even with clean data, "date the account was published" and "date the witness spoke" belong to different timelines (see W6).

---

## 3. Use of space & layout

### W1 (weakness) — The dead right half, twice
Two independent causes produce the same visual: a page whose content hugs the left 45% at desktop width.

- **Heatmap:** `CELL_PX_MAX = 10` (`WitnessLifeHeatmap.js:4`) caps cell width, so with ~60 display columns the grid tops out near 700px regardless of container width (`widthFor`, lines 133–137). Meanwhile the hover box and legend below it are block-level and span the full container (`WitnessLifeHeatmap.css:258–271`) — a full-width empty box captioned "Hover a cell for details" sitting under a half-width grid reads as a rendering bug.
- **Hero:** the portrait is `flex: 0 0 220px` (`Witnesses.css:219`) and the bio column (`flex: 1 1 auto`) contains ~100px of content — one facts line and an italic placeholder — inside a ~300px-tall row. The right ~1100px of the hero is empty, and the space under the facts line beside the portrait is empty too.

**Fix (concrete):**
1. Raise `CELL_PX_MAX` to ~16 and let `widthFor` spend available width, **or** wrap the heatmap block in `max-width: fit-content; margin-inline: auto` so grid, hover box, and legend share one centered, equal-width column. The hover box must match the grid's width, whichever is chosen.
2. Restructure the hero as a two-column card: portrait left (220px), and a **facts grid** right — Born, Died, Excommunicated, Age at the 1829 witness event, "152 sources · 1829–1888 (+ posthumous)" — all of which exist in the `data` objects (`Witnesses.js:13–15`) and are currently shown nowhere except as single heatmap pixels. The bio paragraph goes below the facts grid when it exists; while it doesn't, drop the placeholder entirely (see W3) and the hero shrinks to the portrait's height with no hole.

### W2 (weakness) — Centered display title over a left-aligned page
`Witnesses.js:174` uses `title lg-4 text-center`: a ~60px centered heading floats above a left-aligned breadcrumb, left-aligned hero, and left-hugging heatmap. Nothing else on the page is centered, so the title's axis belongs to a different layout. Since the breadcrumb already ends in the witness's name (bold, with a switcher), the giant title is also redundant. **Fix:** left-align the title at the top of the hero's text column (name → facts grid → bio), sized ~2rem, and let the breadcrumb be the page-level wayfinding. This removes a full vertical band and puts the name next to the face it labels.

### W3 (weakness) — "Biography coming soon." occupies prime real estate
`Witnesses.js:187–191` renders the placeholder for every witness (every `bio` in the static data is `""`, lines 13–35). Placeholder copy in the hero position tells every visitor the page is unfinished. **Fix:** render nothing when `bio` is empty — the facts grid (W1) fills the role. If a teaser is wanted, one auto-derivable sentence ("One of the Three Witnesses; interviewed about the plates until his death in 1888") beats an apology.

### Nit — layout jump on load
The heatmap only mounts once sources arrive (`Witnesses.js:195`), so the cards region jumps down after fetch. A fixed-height skeleton for the heatmap block would hold the layout.

---

## 4. Arrangement — masonry vs. a sorted list

### W4 (weakness) — Masonry breaks the chronological reading order it sits on
The list is (intended to be) date-sorted, and the month filter reinforces that time is the organizing axis — but `react-masonry-css` (`Witnesses.js:213–216`) distributes cards round-robin into 4 columns and stacks each column independently. Row 1 is in order; from row 2 on, varying card heights de-align the rows, so the perceived reading order (Z-pattern) no longer matches the sort. Combined with D1 the user has no chance of perceiving any order at all. Masonry is the right tool for unordered galleries; it is the wrong tool for a sorted archive. **Fix:** a CSS grid of uniform-width cards in row-major order (natural DOM order = reading order), letting card heights vary within a row (`align-items: start`), or — better — group cards under **decade headers** (`1820s … 1880s · Posthumous`), which makes the sort legible, gives the near-duplicate Moyle titles a container, and mirrors the heatmap's axis.

### W5 (weakness) — Near-duplicate cards with no differentiation
Four consecutive cards are all "James H. Moyle recalls/gives account of…" with the title as the card's heaviest element (h5 at 800 weight, `Witnesses.css:347–356`) and the distinguishing facts (date, medium, publication) tiny or blank. The data can differentiate: `quote_is_witness_voice`, `witness_label`, `reporter_label` are fetched (`GraphQLQueries.js`) but only used inside the hover-only quote overlay (`Witnesses.js:237–245`). **Fix:** surface a small "Reported by J. H. Moyle" byline chip on the card face, and consider collapsing same-reporter runs ("4 accounts by James H. Moyle, 1885–1945") into an expandable stack. Also distinguish firsthand (witness's own words) from secondhand accounts with a subtle border or badge — for a witnesses archive that is *the* dimension readers care about.

---

## 5. The heatmap — intuitiveness & usefulness

### What works
The concept is sound and the execution is careful in places: month-precision cells, era markers (event/excommunication/death), a real clear-filter button (`WitnessLifeHeatmap.js:177–181`), clicking a selected cell to deselect (line 240), a visible selection ring (`WitnessLifeHeatmap.css:166–170`), compression with a hatch pattern and a meta note, and a full dark-mode token set (`WitnessLifeHeatmap.css:38–74`).

### W6 (weakness) — One axis conflates testimony-time and publication-time
For David Whitmer the axis runs 1829–2023: 59 years of life after the event, then 135 years of posthumous publication. The questions a reader brings — *when did he testify, did it continue after excommunication, until death?* — live entirely in 1829–1888; the posthumous tail is a different kind of event (reprints, compilations) sharing the axis only by accident of the `date` field (see D5). Even compressed, the tail claims columns and legend space. **Fix:** end the main grid at the death month, and render posthumous sources as a separate single-row strip ("Published after his death: 1891 · 1991 · 2003 · 2023 …") below the grid. This also removes the odd age-axis behavior where ages stop but year columns continue.

### W7 (weakness) — The dual axis is fragile and half-illegible
- Age labels are 0.6rem (~9.6px) (`WitnessLifeHeatmap.css:298–309`) and only appear on the same sparse columns as year labels, so the "second axis" is 8 floating numbers.
- Compression makes both axes non-linear (24, 29, 54, 59…) with visually equal gaps — an axis that looks linear but isn't. The hatched columns do mark the breaks, but the tick labels themselves give no cue (compare a broken-axis `≈` glyph).
- Alignment between the age row and the grid is hand-tuned: `margin-left: calc(0.6rem + 6px)` (`WitnessLifeHeatmap.css:303`) approximating `MONTHS_COL_PX + padding + gap` from JS constants (`WitnessLifeHeatmap.js:7–8`). Any font or padding change shifts the axes off the columns with nothing to flag it. Derive both from one CSS variable.
- **Fix direction:** one primary year axis below; show age in the hover panel (it already does, `WitnessLifeHeatmap.js:297–302`) and keep only the red death-age tick above as an annotation, labeled "d. 83".

### D6 (defect) — False affordances on cells
- Marker months with zero sources get the `has-sources` class (`WitnessLifeHeatmap.js:234`: `count || isMarker`) → `cursor: pointer` (`WitnessLifeHeatmap.css:155–158`) but no `onClick` (line 240 gates on `count`). The death-month cell invites a click and does nothing.
- Every cell, including empty ones, gets the hover outline (`WitnessLifeHeatmap.css:160–164`), implying interactivity grid-wide.
**Fix:** pointer cursor only where `count > 0`; `cursor: default` with hover detail elsewhere.

### W8 (weakness) — Filter state and its exit are far apart
The Clear button lives in the 0.7rem meta strip *above* the grid, while the filtered consequence (the cards) is below the legend, potentially a screen away. Its label leaks the internal key — "Clear filter (1829-06)" instead of "Jun 1829" (`WitnessLifeHeatmap.js:179–180`). The "No sources in this month" empty state (`Witnesses.js:209–211`) offers no clear action at the point of frustration. **Fix:** a filter chip **above the card grid** — "Showing Jun 1829 · 5 sources ×" — plus a "Show all" button inside the empty state; format the month with `MONTHS_FULL`.

### Discoverability notes (c)
"Hover a cell for details · click to filter" does teach the interaction, but only to mouse users who notice a full-width gray box (see W1 — matching its width to the grid also fixes its noticeability). The compression convention is discoverable via three redundant cues (hatch, meta note, legend) — adequate. What is *not* discoverable: that year-only sources are excluded from month filtering (D3), and that the selected month persists while scrolling the cards.

---

## 6. Responsive & mobile

- **Heatmap on touch is decorative.** Cells shrink to `CELL_PX_MIN = 4` px (`WitnessLifeHeatmap.js:5`); even at max they are 10px — far below any touch-target guideline (~44px), and the hover panel, the only place cell details exist, requires a `mouseenter` that touch never fires. On a phone the heatmap conveys only its color blobs. **Fix:** on coarse pointers, make the first tap select-and-show-details (reuse the hover panel as a tap panel), and consider a taller row height / year-level aggregation below 700px.
- **Hero stacks correctly** at ≤700px (`Witnesses.css:270–277`); the breadcrumb dropdown collapses to one column (`Witnesses.css:204–209`) but has no `max-height`/scroll — 19 entries in one column can exceed a phone viewport with no way to reach the bottom items except page scroll under an absolutely-positioned box.
- **Index page has no responsive rules at all.** The eight-witnesses container is a fixed `repeat(8, 1fr)` grid (`Witnesses.css:10–14`) — eight ~45px portraits in a row at 375px. The testimony blocks keep `margin: 0 5rem` (`Witnesses.css:68`) — a ~135px text column on a phone. Both need breakpoints (8→4→2 columns; margin → 1rem).
- Masonry breakpoints (`Witnesses.js:169`) are sensible (4/3/2/1).

---

## 7. Accessibility

- **The heatmap is invisible to keyboard and screen-reader users** — every cell is a bare `div` with no `tabindex`, `role`, or accessible name (`WitnessLifeHeatmap.js:236–244`); the hover panel is not `aria-live`; the information exists nowhere in text form. Minimum fix: `role="grid"`, focusable cells with `aria-label` ("June 1829, 5 sources, Three Witnesses event"), Enter/Space to filter, and `aria-live="polite"` on the detail panel. The month filter's effect on the card list should be announced (`aria-live` on the results count).
- **Color-only encoding**, including red/green/purple distinctions, with no shape/pattern channel except the compression hatch. The green ramp on white is fine, but era distinctions (event blue vs. dark greens at 8px) are hard even for full color vision; for red-green CVD the death month vs. dense-source months is ambiguous. A one-pixel glyph budget is real — consider a dot/ring overlay on marker months.
- **Cards are click-only `div`s** (`Witnesses.js:218–222`): no `role="button"`, no `tabindex`, no key handler, and the money-quote/teaser content is hover-revealed only (`Witnesses.css:389, 394`) — keyboard and touch users never see it.
- **Global Escape hijack (defect):** `Witnesses.js:114–118` binds `keydown → window.history.back()` for the page's whole life, using deprecated `keyCode`. The breadcrumb dropdown's own Escape handler (`Witnesses.js:56`) closes the dropdown but does not stop propagation, so **Escape with the dropdown open closes it and navigates back simultaneously**. The same double-fire risk applies while the source popup is open. Fix: remove the global handler, or gate it (ignore when the dropdown/popup is open, use `event.key`, and prefer navigating to `/history/witnesses` over blind `history.back()` which can leave the site).
- **Breadcrumb dropdown semantics:** the trigger declares `aria-haspopup="listbox"` (`Witnesses.js:74`) and the panel `role="listbox"` (line 82), but the children are links without `role="option"`, there is no keyboard navigation between them and no focus management on open. Menu semantics (`role="menu"`/`menuitem` or just a plain disclosure of links) would match the actual widget.
- **Contrast:** card citation text `#AAA` on `#EEE` cards (`Witnesses.css:358–364` on `:305`) ≈ 2:1 — far below AA even for small "incidental" text that here carries the source citation, the card's only provenance info. The bio placeholder `#AAA` (`Witnesses.css:265–268`) has the same problem but is disposable (W3).
- Heading order jumps h3 → h5 on both pages (cards `Witnesses.js:250`, index subtitles `:279`).

---

## 8. Index page (`/history/witnesses`)

- **D7 (defect) — Dead heading:** `<h4>Witness Statements</h4>` with nothing under it (`Witnesses.js:358–360`) in the Other Sources section. Either render the statements it promises (a `witness-statement` block per person, or links) or delete it.
- **D8 (defect) — Fabricated ages from placeholder birthdays:** `"1800"` is a stand-in birthday for Hiram Page, Willard Chase, and Hussey/Vandruver (`Witnesses.js:22, 34–35`), yet the UI renders a confident "Age 29" chip (`:293`). Hussey/Vandruver is *two people* sharing one card and one fake age. Show "Age unknown" (or nothing) when the birthday is year-only placeholder data, and split or annotate the two-person entry.
- **D9 (defect) — Typo in user-facing copy:** "while in posession of the plates" (`Witnesses.js:339`) → "possession".
- **Weakness — sort comparator:** `.sort((b, a) => …)` (`Witnesses.js:284, 311, 343`) works (oldest-first by age) but the swapped parameter names read as a bug, the identical 3-line comparator is pasted three times, and it **mutates the module-level `data` arrays in place on every render**. Hoist one `byAgeDesc` comparator and sort a copy.
- **Weakness — testimony blobs:** the Three Witnesses statement is a single ~2,300-character JSX line (`Witnesses.js:300`) — unreadable in diffs and untranslatable (no `label()`), and it renders with solid leading (`font-size: 1rem; line-height: 1rem`, `Witnesses.css:64–65`) — bulleted scripture set solid is cramped; 1.4–1.5 leading is the floor for body text.
- The group subtitle pattern (`h5` italic gray summarizing what each group witnessed) is good content design — keep it.

---

## 9. Recommendations, in order

1. **Fix the sort/display mismatch (D1) and the meta arithmetic (D3)** — these break trust in the data on a page whose entire point is documentary trust. Sort and display the same field; account for year-only sources in both the strip and the filter.
2. **Reclaim the right half (W1/W2/W3):** left-aligned ~2rem name in the hero text column (drop the centered display title), facts grid (born / died / excommunicated / age in 1829 / source count) replacing the placeholder bio, heatmap block width-matched and centered (grid, hover box, legend as one column).
3. **Replace masonry with a row-major grid grouped by decade (W4)**, with reporter bylines and firsthand/secondhand badges on cards (W5), populated or removed pub line (D2), and a filter chip + clearable empty state above the grid (W8).
4. **Split the heatmap at death (W6/D5):** main grid 1829–death, posthumous publications as a compact strip; prefer `event_date` where the `date` field carries publication dates; fix the legend ramp (D4) and the false pointer cursors (D6).
5. **Accessibility pass (§7):** focusable labeled cells, keyboard-activatable cards, remove/gate the global Escape handler, fix citation contrast, correct the dropdown semantics.
6. **Index cleanup (§8):** remove or fill the dead heading, stop rendering fake ages, fix the typo, add mobile rules for the 8-column grid and statement margins, hoist the comparator.
7. **(Opportunity)** Link heatmap and cards bidirectionally — hovering a card flashes its heatmap cell; year-only sources get a year-level annotation row — and sync the selected month to the querystring to match the app's deep-link investment.

---

## 10. Evidence index

- DB verification (read-only, `bom_xtras_history`, David Whitmer + Three Witnesses principals): 152 rows; 109 month-precision, 40 year-only, 3 junk/out-of-range; `source` blank on 152/152; `year`≠year(`date`) on the ca.-1940 memoir row (1940 vs 1885-06-28) and publication-dated rows (`date` = 2003 ×3, 1991, 2023-02-13, and the `4806` typo); max in-range date 2023-02-13, matching the screenshot's 1829–2023 axis.
- Screenshot (desktop ~2000px, David Whitmer): left-hugging hero and heatmap with empty right half; full-width hover box; first card row dated 1945 / 1885 / 1938 / 1930; four consecutive Moyle cards; blank pub lines.
- All `file:line` references are to the working tree at commit `aeea69b6`.
