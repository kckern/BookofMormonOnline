# Reception History Quotes — Design Spec

**Date:** 2026-08-07
**Area:** `frontend/webapp/src/views/History/`, `frontend/webapp/src/views/Home/tiles/HistoryTile.js`, `backend/` (GraphQL surfacing of `mini_quote`)
**Status:** Approved design, pending spec review → implementation plan

## Goal
Feature reception-history **money quotes** (and the shorter **mini quotes**) on the surfaces where reception documents appear — the reception main view and the Home history tile — taking cues from the already-polished witness source cards. Extract the witness card into a shared component so both surfaces render the same money-quote-led card.

## Background / current state
- The witness view (`Witnesses.js` → `SingleWitness`) already renders each source as a money-quote-led card: a header (identicon + date chip + teaser), a `blockquote.historyLead` money quote in two voices, then a support row (thumb + citation). Helper `withBrackets` styles editorial marks `[Name]`/`[…]`. CSS is scoped under `.single-witnesses .witness-sources`.
- Reception main view (`History.js`) renders a plain reactstrap `Card` grid, **title-led**: source/date header → thumb + teaser → `<h5>document</h5>` → citation. No money quote.
- Home tile (`HistoryTile.js`) leads with document title + an expandable teaser lead + bullets. No quote. Its data comes from `homesampler`, whose `history {…}` selection omits the quote fields.
- **Data:** reception has 580 docs, **459 (79%) with a `money_quote`**. The frontend `history` query (`GraphQLQueries.js`) already selects `money_quote`, `quote_is_witness_voice`, `quote_speaker`, `witness_label`, `reporter_label` — so reception/witness lists already carry money quotes client-side.
- **`mini_quote` is NOT surfaced anywhere** (GraphQL errors on the field; string absent from the repo). It exists in the DB `metadata` JSON under key **`mini_quote`** (assumed; confirm at review) and must be added to the backend, exactly parallel to `money_quote`.

## Decisions (settled during brainstorming)
- **mini_quote = a short version of the money quote** (compact pull-phrase), for tight spaces.
- **Mapping:** reception main cards (roomy) lead with the **full money quote**; the Home tile (tight) leads with the **mini quote**.
- **Reception cards lead with the money quote and demote the document title to support** (like witnesses).
- **Mini quote is Home-tile-only** (not shown in the main reception cards).
- **Extract a shared card** used by both Witnesses and reception; the **witness view stays pixel-identical**.
- Do **both** backend (`mini_quote`) and frontend in one pass.

## Architecture

### 1. Backend — surface `mini_quote` (mirror of `money_quote`)
Three edits, all parallel to the existing `money_quote`:
- `backend/schema/BomNotes.graphql` — add `mini_quote: String` to `type HistoricalDocument` (next to `money_quote` at line 87). Because `HomeSampler.graphql` already types `history: HistoricalDocument`, no HomeSampler SDL change is needed.
- `backend/src/data/loaders/searchhist.ts` — add `mini_quote: string | null;` to the `HistoryRow` interface, and `mini_quote: metaString('mini_quote'),` to the row builder (beside `money_quote`).
- `backend/src/graphql/resolvers/searchhist.ts` — add `mini_quote: (parent) => (parent as unknown as HistoryRow).mini_quote ?? null,` (beside `money_quote`).

Acceptance: `{ history(archive:"reception"){ mini_quote } }` returns strings instead of a validation error.

### 2. Shared `HistorySourceCard` component
Create `frontend/webapp/src/views/History/HistorySourceCard.jsx` + `HistorySourceCard.css`. Move the witness card's markup (`Witnesses.js` inline `.historycard`, lines ~230–273), the two-voice money-quote block, and the `withBrackets` helper (lines ~21–29) into it. Move the witness card CSS (`Witnesses.css` ~319–443) into `HistorySourceCard.css` under a **neutral shared class** (e.g. `.historySourceCard …`) instead of `.single-witnesses .witness-sources …`.

**API:** `<HistorySourceCard doc={doc} variant="witness" | "reception" onOpen={(doc) => void} />`
- **Always renders:**
  - Header: `Identicon` (seed = `doc.slug || doc.document || doc.source`) + `dateChip` (formatted `doc.date`) + teaser (`doc.teaser`, when present).
  - **Money-quote lead** (the hero): when `doc.money_quote && doc.quote_speaker`, render `blockquote.historyLead` — first-hand voice (`doc.quote_is_witness_voice`) as `"quote" — speaker`, otherwise `speaker: "quote"`; run the quote text through `withBrackets`. When no money quote, render nothing here (header teaser carries the description).
  - Support row: thumb (`/history/thumbs/<id>`, when `doc.id`) + citation (`doc.citation`, when present).
- **Variant differences (the only per-surface variation):**
  - `variant="reception"`: also render the **source** (`doc.source`) in the header and the **document title** (`doc.document`) in the support row.
  - `variant="witness"`: render exactly today's witness card (no source line, no document heading) — **pixel-identical**.
- Card root is a clickable `div` calling `onOpen(doc)` (both surfaces open a popup).

Export `withBrackets` and the component for unit testing.

### 3. Witnesses adoption
`Witnesses.js` `SingleWitness` renders `<HistorySourceCard doc={doc} variant="witness" onOpen={openSource} />` inside its Masonry, replacing the inline card. `withBrackets` and the money-quote block are removed from `Witnesses.js` (now imported/owned by the shared card). `Witnesses.css` loses the migrated `.witness-sources .history*`/`.money_quote*`/`.editorialMark` rules (now in `HistorySourceCard.css`); any witness-only layout (rail, heatmap, grid) stays.

### 4. Reception main view adoption
`History.js` renders `<HistorySourceCard doc={doc} variant="reception" onOpen={(d) => appController.functions.setPopUp({...})} />` inside the existing year-grid Masonry, replacing the reactstrap `Card`. The year `ButtonGroup` filter, the popup-on-click behavior, and the intro markdown stay. The reception list already carries `money_quote` (add `mini_quote` to the query too — §6 — even though the main card doesn't show it, so the popup/other consumers can).

### 5. Home tile redesign
`HistoryTile.js`: replace the expandable teaser lead with a **quote hero** using a fallback ladder:
1. `data.mini_quote` (preferred — compact), else
2. `data.money_quote` trimmed to ~14 words (via existing `clampWords`), else
3. the current teaser lead (unchanged behavior for quote-less docs).

When a quote is shown and `data.quote_speaker` exists, show a compact attribution (`— speaker` for first-hand, `speaker:` prefix otherwise), reusing the same quote typography as the card (shared class or a tile-scoped echo). The document title remains the tile's primary `Link`; meta, thumb, citation, deeplink, and bullets are unchanged. `parseTeaser` stays for the fallback lead.

### 6. Data flow
- `GraphQLQueries.js` `history` query: add `mini_quote` to the field list (beside `money_quote`) so reception/witness lists carry it.
- `GraphQLQueries.js` `homesampler` query: add `money_quote mini_quote quote_speaker quote_is_witness_voice` to the `history { … }` selection (the backend resolves them via the `HistoricalDocument` type).

## Components / files
| File | Change |
|---|---|
| `backend/schema/BomNotes.graphql` | `mini_quote: String` on `HistoricalDocument` |
| `backend/src/data/loaders/searchhist.ts` | `mini_quote` on `HistoryRow` + `metaString('mini_quote')` |
| `backend/src/graphql/resolvers/searchhist.ts` | `mini_quote` resolver |
| `frontend/.../History/HistorySourceCard.jsx` | **new** shared card + `withBrackets` |
| `frontend/.../History/HistorySourceCard.css` | **new** de-scoped card styles |
| `frontend/.../History/Witnesses.js` | render shared card; drop inline card/helper |
| `frontend/.../History/Witnesses.css` | remove migrated card rules |
| `frontend/.../History/History.js` | render shared card in the year grid |
| `frontend/.../Home/tiles/HistoryTile.js` | mini→money→teaser quote hero |
| `frontend/.../Home/Sampler.css` | tile quote-hero styles |
| `frontend/webapp/src/models/GraphQLQueries.js` | `mini_quote` on `history`; quote fields on `homesampler.history` |

## Testing
- **`HistorySourceCard`** (new test): first-hand voice renders `"…" — speaker`; reporter voice renders `speaker: "…"`; `[Name]`/`[…]` become `.editorialMark`; no-money-quote doc renders the header teaser and no blockquote; `variant="reception"` shows source + document, `variant="witness"` does not; clicking calls `onOpen(doc)`.
- **Witnesses** (regression): `SingleWitness` still renders a money-quote card for a doc with `money_quote` (no visual regression — same classes/structure).
- **`HistoryTile`** (new/extended test): mini→money→teaser fallback ladder (doc with `mini_quote` shows it; with only `money_quote` shows a trimmed money quote; with neither shows the teaser lead); attribution renders when `quote_speaker` present.
- **Backend**: a resolver/loader test (or the existing history GraphQL suite) asserts `mini_quote` is surfaced from metadata.

## Out of scope (YAGNI)
- No change to witness data, the history hub, or the popup/detail view.
- No new quote fields beyond `mini_quote`.
- No mini quote in the main reception cards (Home-tile-only).
- No redesign of the year-filter, heatmap, or breadcrumbs.

## Acceptance criteria
1. `mini_quote` is queryable on `HistoricalDocument` and returned for reception docs that have it.
2. One shared `HistorySourceCard` renders both witness and reception cards; the witness view is visually unchanged.
3. Reception main-view cards lead with the money quote (two voices, editorial marks), with source + document title + citation as support; clicking opens the history popup.
4. The Home history tile leads with the mini quote, falling back to a trimmed money quote, then the teaser.
5. The `homesampler` query supplies the quote fields to the tile.
6. All new/updated tests pass; no regression in the existing History/Home suites.
