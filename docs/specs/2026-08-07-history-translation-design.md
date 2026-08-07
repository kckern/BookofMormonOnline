# /history/translation — Design Spec

**Date:** 2026-08-07
**Area:** `frontend/webapp/src/views/History/`
**Status:** Approved design, pending spec review → implementation plan

## Goal
Build out `/history/translation` (currently a "Coming soon" stub) as a **chronological feed of testimony about the translation** of the Book of Mormon, reusing the shared money-quote card. Flip the history-hub section from placeholder to live.

## Background / data
- The route `/history/translation` renders `frontend/webapp/src/views/History/TranslationSources.jsx`, which today shows only a "Coming soon" line. (`Translation.js` is an empty, unused file.)
- The **translation archive** (`history(archive:"translation")`) has **155 documents**. Every one carries: `document`, `year`, `date`, `event_year`, `event_date`, `seq`, `author`, **`principal`** (the person the account is attributed to), **`money_quote`**, **`mini_quote`**, **`quote_speaker`**, **`quote_is_witness_voice`**, `citation`, `teaser`. There is **no `source`** (0/155).
- These are **statements *about* the translation made across 1827–1998** (here `event_year` == the record `year`), clustered in the 1830s–1880s — not a 3-year event timeline. Sorting ascending by year yields a timeline of how testimony accrued.
- Principals: Joseph Smith Jr. (25), David Whitmer (10), Oliver Cowdery (5), plus ~40 others (some annotated, e.g. "David Whitmer Excommunicated").
- The frontend `history` query already selects every field needed (`seq`, `principal`, `event_year`, `money_quote`, `mini_quote`, `quote_speaker`, `quote_is_witness_voice`, `document`, `citation`, `teaser`, `date`, `year`). **No query or backend change is needed.**

## Decisions (settled during brainstorming)
- **Chronological feed**, grouped by year, ascending (oldest first).
- **Year-section headers** (a timeline marker per year), not decade buckets (switchable later if too fragmented).
- **Cards reuse `HistorySourceCard`** with `variant="reception"` — money-quote-led with two-voice speaker attribution (translation quotes *are* attributed), document title + citation as support, date chip in header. Click → the existing history popup.
- **Person filter**: a `<select>` of the distinct `principal` values (with counts), narrowing the feed. Default = all.
- **No** per-person hero pages, thematic curation, or backend work (YAGNI).

## Architecture

### `TranslationSources.jsx` (replace the stub)
- On mount, `BoMOnlineAPI({ history: { archive: "translation" } })` → `docs`.
- **Filter**: `useState` for the selected principal (default `""` = all). The visible list = `docs.filter(d => !selected || d.principal === selected)`.
- **Sort + group**: sort ascending by `(event_year || year || 0)` then `(seq || 0)`; group into an ordered list of `{ year, items }` buckets by `event_year || year`.
- **Render**:
  - `HistoryBreadcrumb sectionKey="translation"` + `<h3>` title + a short intro line (the section blurb from `sections.js`).
  - A person `<select>` (options = distinct principals sorted by descending count, each labelled `"<principal> (<n>)"`, plus an "All voices" default).
  - For each year bucket: a `.translationYear` header (the year) + a `Masonry` grid (`react-masonry-css`, same breakpoints as the witness/reception grids) of `HistorySourceCard`.
  - `<HistorySourceCard doc={doc} variant="reception" displayDate={displayDate} onOpen={openDoc} />` where `openDoc` calls `appController.functions.setPopUp({ type:"history", ids:[doc.slug], popUpData: doc, underSlug:"history/translation", vhtop:10 })`.
  - Loading → `Spinner`; empty (filter yields nothing) → a small empty-state with a "clear filter" affordance.
- `displayDate(date)` — the moment-based formatter used by reception/witnesses (year/month/full by string length + the `history_date_format_*` labels).

### `TranslationSources.css` (new, small)
- `.translationYear` timeline header (year label with a rule/accent).
- Person-filter `<select>` styling.
- The Masonry grid reuses `.my-masonry-grid` / `.my-masonry-grid_column`; card internals come from `HistorySourceCard.css`. Add only the container/year-header/filter styling here.

### `sections.js`
- Flip the `translation` entry `status: "placeholder"` → `"live"`.

### `HistoryHub.jsx` (`useFeatured`)
- Add a `translation` featured pick so the now-live hub tile shows a preview (mirrors the `reception` pick): fetch `history({ archive:"translation" })`, `pickRandom`, and expose `{ img: /history/thumbs/<id>, caption: principal || document }`. Return it under the `translation` key so `<Tile section={translation} featured={featured.translation} />` renders a preview instead of an empty "soon" slot.

## Components / files
| File | Change |
|---|---|
| `frontend/.../History/TranslationSources.jsx` | Replace stub with the feed (fetch + filter + group-by-year + cards) |
| `frontend/.../History/TranslationSources.css` | **new** — year headers, filter, grid container |
| `frontend/.../History/sections.js` | translation `status` → `live` |
| `frontend/.../History/HistoryHub.jsx` | `useFeatured` adds a translation preview pick |
| `frontend/.../History/__tests__/translationSources.test.js` | **new** — sort/group/filter + render |

## Testing
- **Grouping/sort** (pure helper, extracted + exported): given docs with mixed `event_year`/`seq`, returns year buckets ascending with items ordered by seq; missing years sort last.
- **Person filter**: selecting a principal narrows the rendered cards to that principal; "All" shows every card.
- **Render smoke** (RTL, `BoMOnlineAPI` mocked like `reader.test.js`): renders year headers + `HistorySourceCard`s; a card carries the money quote; clicking calls the popup.
- Reuse the established History test patterns (`MemoryRouter`, mocked `BoMOnlineAPI`, `AppController` context stub as needed).

## Acceptance criteria
1. `/history/translation` shows a year-grouped, ascending chronological feed of all 155 translation accounts as money-quote cards (not "Coming soon").
2. A person filter narrows the feed to a single principal; clearing restores all.
3. Cards are the shared `HistorySourceCard` (attributed money quote + document + citation); clicking opens the history popup.
4. The `/history` hub lists Translation as **live** with a featured preview.
5. New tests pass; no regression in the existing History suite.
