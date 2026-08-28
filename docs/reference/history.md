# `bom_xtras_history` — Field Reference for Content Creators

**What this is:** the `bom_xtras_history` table is the single source for every
"historical document" surfaced on the site. One GraphQL field —
`history(archive: "...")` — hydrates a handful of React views. The data is
**inconsistent across the four archives** (different columns are filled in each),
which makes the front end render unevenly. This document maps every field to the
JSX that consumes it, shows which archives actually populate it, and lists the
conventions to follow so a document renders completely and consistently.

> Evergreen reference — update in place as the schema/data conventions change.
> Fill-rates below were **re-measured against `bom_prd` on 2026-08-18** (reception
> 580, witnesses 360, translation 155, joseph-smith-statements 26,
> lost-116-pages 24 — 1,145 docs total).

**Measured 2026-08-18** — the quote fields, which drive the card lead and the Home
sampler:

| archive | n | `money_quote` | `miniquote` | `quote_speaker` | `transcript` |
|---|---|---|---|---|---|
| reception | 580 | 99% | 99% | 0% | 100% |
| witnesses | 360 | 59% | 59% | 59% | 100% |
| translation | 155 | **0%** | **0%** | 100% | 100% |
| joseph-smith-statements | 26 | 100% | 100% | 0% | 100% |
| lost-116-pages | 24 | 63% | 63% | 63% | 42% |

⚠️ **`translation` has no `money_quote` or `miniquote` at all.** Its metadata
carries `quote_speaker`, `quote_is_witness_voice`, `evidence_chain` and
`quote_curation_status`, but no quote — so every translation card renders
teaser-only with a speaker and nothing to attribute, and no translation doc can
reach the Home sampler (which requires a money quote). An earlier revision of
this document recorded translation as 100% on both fields; that was wrong.

319 of 1,145 docs (28%) have no money quote. 541 (47%) have a teaser without the
`Key Points` list — that convention is followed by `reception` and
`lost-116-pages` and by neither `witnesses` nor `translation`.

---

## The four archives and where they surface

| `archive` value | Route | Primary component(s) | Home tile |
|---|---|---|---|
| `reception` | `/history/reception` | `History.js` → `HistorySourceCard variant="reception"`; facsimiles in `PopUp.js` | `HistoryTile` → `ArchiveDocTile` |
| `translation` | `/history/translation` | `HistoryArchiveFeed.jsx` | `TranslationTile` → `ArchiveDocTile` |
| `joseph-smith-statements` | `/history/joseph-smith` | `JosephSmith.js` (portrait + `WitnessLifeHeatmap`) → `HistorySourceCard variant="witness"` | `JosephSmithTile` → `ArchiveDocTile` |
| `witnesses` | `/history/witnesses`, `/history/witnesses/:slug` | `Witnesses.js` (`WitnessLifeHeatmap`) → `HistorySourceCard variant="witness"` | `WitnessTile` |

All four also feed the Home sampler (`homesampler.ts` selects `bom_xtras_history`
by archive, requiring a non-trivial `teaser` and a `money_quote`).

---

## Field-by-field reference

Legend for fill-rate: ✅ ≈always · ◑ partial · ⬚ ≈never. Percentages are the
sampled share of docs in that archive with a non-empty value.

| Field | Rendered by (JSX) | reception | translation | joseph-smith | witnesses | Convention |
|---|---|---|---|---|---|---|
| `slug` | routing, popup id, React keys | ✅100 | ✅100 | ✅100 | ✅100 | Stable unique id; date-prefixed kebab (`YYYY-MM-DD-…`). |
| `archive` | sampler/route selector | ✅100 | ✅100 | ✅100 | ✅100 | One of the four values above. |
| `document` | card/tile title (`.historyTileTitle`, `.historyDocTitle`), popup `<h3>` | ◑99 | ✅100 | ✅100 | ✅100 | Human title of the source. Always fill. |
| `teaser` | tile lead + Key-Points bullets (`parseTeaser`), card `.historyTeaserText`, popup | ✅100 | ✅100 | ✅100 | ✅100 | HTML. Lead paragraph, then `Key Points:` + `<ul>`. First `<p>` is the bold summary. |
| `citation` | `.citation` / `.historyTileCitation` | ◑99 | ✅100 | ✅100 | ◑97 | Full bibliographic citation. |
| `year` | reception year-bar filter, tile meta | ✅100 | ✅100 | ✅100 | ✅100 | Integer. Drives the reception timeline buttons. |
| `date` | date chip, `WitnessLifeHeatmap` placement | ✅100 | ✅100 | ✅100 | ◑90 | `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. **Month precision needed for the heatmap.** |
| `money_quote` | card lead `.historyLead`, tile `.historyTileQuote` | ◑79 | ✅100 | ✅100 | ◑87 | The pull quote shown in full. Required for the Home tile. |
| `mini_quote` | highlighted excerpt within the money quote; reception year-bar tooltip | ◑79 | ✅100 | ✅100 | ◑86 | **Must be verbatim excerpt(s) of `money_quote`** — see Conventions. |
| `quote_speaker` | card attribution (`— Speaker` / `Speaker:`) | ⬚0 | ✅100 | ⬚0 | ◑87 | Who said it. See the attribution gap below. |
| `quote_is_witness_voice` | firsthand styling (blue rule, `— Speaker`) vs reporter prefix | ⬚0 | ✅100 | ⬚0 | ◑87 | `true` = first-person testimony; `false` = third-party report. |
| `source` | reception card header `.historySource`, tile meta | ✅99 | ⬚0 | ⬚0 | ⬚0 | **reception only.** Publication name. Others put it in `author`. |
| `author` | tile meta (`year · source · author`); JS reporter attribution | ◑51 | ✅100 | ✅100 | ◑99 | Author/reporter. See the source-vs-author split below. |
| `principal` | witness/JS grouping (`Witnesses.js`, `HistoryArchiveFeed`), tile caption | ⬚0 | ✅100 | ✅100 | ◑98 | Subject of the statement (e.g. `Joseph Smith`, a witness name). |
| `event_year` / `event_date` | JS sort; heatmap fallbacks | ⬚0 | ✅100 | ✅100 | ✅100 / ◑95 | When the event happened (vs. `date` = when recorded). |
| `id` | facsimile thumbnail/rail + popup images (`/history/…/<id>`) | ✅100 | ✅100 | ⬚0 | ⬚0 | Present ⇒ a scan asset exists. |
| `aspect` | thumbnail aspect-ratio | ◑99 | ⬚0 | ⬚0 | ⬚0 | Height/width. **reception only** — translation has `id` but no scans. |
| `pages` | popup facsimile pages + Home reception rail (`/history/fax/<id>.<page>.jpg`) | ✅100 | ⬚0 | ⬚0 | ⬚0 | Page count; drives the multi-image rail. reception only. |
| `link` | (external link, where used) | ⬚3 | ◑92 | ◑30 | ◑68 | Optional external URL. |
| `transcript` | popup transcript block | — | — | — | — | Optional full transcript (opt-in query field). |
| `witness_label` / `reporter_label` | **nothing** | ⬚0 | ⬚0 | ⬚0 | ◑75 | ⚠️ Populated on witnesses but **no JSX reads them.** Dead unless wired up. |

---

## The inconsistencies that matter (and how to standardize)

1. **`source` vs `author` split.** reception fills `source` (the publication) and
   leaves `author` empty; the other three fill `author` and leave `source` empty.
   The Home tile meta line reads `year · source · author`, so a reception doc
   shows the paper once and the others show the author once — but nothing is
   guaranteed. Worse, **60 reception docs set `author` == `source`** (duplicated),
   which renders the same name twice in the tile meta. *Standardize:* pick one
   column per concept — `source` = publication/venue, `author` = person — and
   stop mirroring one into the other.

2. **Joseph-Smith statements have no `quote_speaker`.** `joseph-smith-statements`
   ships `money_quote`/`mini_quote` but **0% `quote_speaker` / `quote_is_witness_voice`**,
   so a reported statement (e.g. Dan Jones recording Joseph) had no speaker to
   show. The front end currently *derives* the reporter from `author` when it
   isn't Joseph (see `JosephSmith.js` `attributeReporter`). *Standardize:* fill
   `quote_speaker` + `quote_is_witness_voice` on these docs the way `witnesses`
   and `translation` do, instead of relying on the front-end heuristic.

3. **Elision-marker style differs.** `mini_quote` excerpts are joined by an
   elision marker, but the convention isn't uniform: reception & witnesses use
   **bracketed `[...]`**, joseph-smith uses **bare `...`**. The renderer now
   accepts both, but content should settle on one (bracketed `[...]` is the
   editorial standard used by the majority). Bare `…`/`...` inside a quote is
   ambiguous with a real ellipsis.

4. **`witness_label` / `reporter_label` are dead data.** Filled on ~75% of
   witnesses docs but read by no component. Either wire them into the card
   (e.g. a labelled attribution) or stop populating them.

5. **reception is ~21% missing `money_quote`/`mini_quote`.** Those docs fall back
   to the teaser and never appear in the Home sampler (which requires a money
   quote). Fill them to make the doc tile-eligible.

6. **`date` precision on witnesses (~10% missing).** `WitnessLifeHeatmap` needs
   at least `YYYY-MM` to place a source on the timeline; date-less docs are
   silently dropped from the heatmap (they still list below it).

---

## Conventions for the quote fields

- **`mini_quote` must be verbatim.** It is highlighted *in place* inside
  `money_quote` by locating each excerpt with an exact substring match
  (`renderMoneyQuote` in `src/views/_Common/moneyQuote.jsx`). If the mini quote
  isn't found character-for-character, **no highlight renders** (silent
  fallback). Copy the words exactly, including punctuation and curly quotes.
- **Elisions split the mini quote.** `"phrase A [...] phrase B"` is treated as
  two excerpts; each is matched and highlighted separately, with the skipped
  words left un-highlighted. Prefer bracketed `[...]`.
- **Editorial brackets** `[Name]` (supplied referent) render in a distinct grey
  sans-serif (`.editorialMark`) — use them for inserted/clarifying words.
- **Attribution styling** keys off `quote_is_witness_voice`: `true` → first-hand
  ("— Speaker", blue rule); `false` → reporter ("Speaker: …"); no `quote_speaker`
  → bare quote. Set both fields together.

---

## Per-archive fill checklist

**reception** — `source`, `document`, `year`, `date`, `teaser`, `citation`,
`money_quote` + verbatim `mini_quote`, `id`/`aspect`/`pages` (facsimile). Do
**not** duplicate `source` into `author`.

**translation** — `author`, `principal`, `document`, `year`, `date`/`event_date`,
`teaser`, `citation`, `money_quote` + `mini_quote`, `quote_speaker` +
`quote_is_witness_voice`. (No facsimile: `id` present but no `aspect`/`pages`.)

**joseph-smith-statements** — `author` (Joseph, or the reporter), `principal`
(`Joseph Smith`), `document`, `date`/`event_date`, `teaser`, `citation`,
`money_quote` + `mini_quote`. **Add** `quote_speaker` + `quote_is_witness_voice`
for reported statements (currently missing).

**witnesses** — `author`, `principal` (the witness), `document`,
`date` (≥ month precision), `event_date`, `teaser`, `citation`, `money_quote` +
`mini_quote`, `quote_speaker` + `quote_is_witness_voice`. Drop or wire up
`witness_label`/`reporter_label`.
