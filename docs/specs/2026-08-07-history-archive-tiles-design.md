# History Archive Home Tiles — Design Spec

**Date:** 2026-08-07
**Area:** `frontend/webapp/src/views/Home/tiles/`, `backend/` (homesampler)
**Status:** Approved design (DRY-with-param), pending spec review → implementation plan

## Goal
Give the Home sampler board a tile for each of the four history archives — **reception, witnesses, translation, joseph-smith** — each modeled on `HistoryTile.js`. Two already exist (reception = `HistoryTile`, witnesses = `WitnessTile`); build the **translation** and **joseph-smith** tiles, and refactor the shared quote-hero core into one `ArchiveDocTile` so the three doc-style tiles stay consistent (witness stays its own portrait-first layout).

## Current state
- `HistoryTile.js` renders a featured single history doc (`homesampler.history`, pinned to the **reception** archive): heading, document title (Link), meta (year·source·author), archive, a **quote hero** (mini→money→teaser fallback with two-voice attribution), key-points bullets, citation, a **facsimile thumbnail** (`/history/thumbs/<id>`), and a gated deep-link. It **gates on `data.id`** and derives the thumb from `id`.
- `WitnessTile.js` renders a witness (`homesampler.witnesses`) with a large portrait — a different, portrait-first layout. **Leave it as-is** (witness = its avatar, already done).
- The Home board is data-driven: `registry.js` maps a payload key → tile component; the documented recipe for a new tile is (1) `homesampler.ts` sampler fn + `HomeSampler.graphql` field, (2) add the field to the homesampler query in `GraphQLQueries.js`, (3) the tile component, (4) a registry entry.
- `homesampler.ts` `sampleHistory` selects `bom_xtras_history WHERE archive='reception' AND teaser>30 AND aspect IS NOT NULL AND money_quote IS NOT NULL`.

## Data facts (drive the design)
- **translation** archive: docs have `id`/`aspect` (thumbs exist) and attributed money/mini quotes. **But the translation tile shows NO image** (per direction) — the thumb is intentionally omitted.
- **joseph-smith-statements** archive: docs have **no `id`/`aspect`** (no thumbs) and **no `quote_speaker`** (bare money quotes). The tile uses the **Joseph portrait** (`/history/witnesses/people/joseph-smith.jpg`), not a doc thumb.
- Consequence: the shared tile must **gate on `data` (not `data.id`)** and take the **image as an explicit prop** (thumb URL / portrait URL / `null`), and the joseph sampler must **not** require `aspect`.

## Architecture

### 1. Backend — two samplers (mirror `sampleHistory`)
In `backend/src/graphql/resolvers/homesampler.ts`:
- `sampleTranslation` — `archive='translation'`, keep the `teaser>30` + `money_quote IS NOT NULL` filters and (translation has thumbs) `aspect IS NOT NULL`; parse the metadata quote fields onto the row (`money_quote`, `mini_quote` from key `miniquote`, `quote_speaker`, `quote_is_witness_voice`) exactly as `sampleHistory` does.
- `sampleJosephSmith` — `archive='joseph-smith-statements'`, `teaser>30` + `money_quote IS NOT NULL`, **omit** the `aspect` filter (no thumbs); parse the same quote fields.
- Register both in the `samplers` map (`translation: sampleTranslation`, `josephSmith: sampleJosephSmith`).

In `backend/schema/HomeSampler.graphql`: add `translation: HistoricalDocument` and `josephSmith: HistoricalDocument` fields (the `HistoricalDocument` type already exposes the quote fields).

### 2. Frontend query
In `frontend/webapp/src/models/GraphQLQueries.js` homesampler query, add `translation { … }` and `josephSmith { … }` selections mirroring the existing `history { … }` selection (id, slug, year, date, source, archive, author, document, teaser, citation, aspect, money_quote, mini_quote, quote_speaker, quote_is_witness_voice). (joseph's id/aspect will be null — harmless.)

### 3. Shared `ArchiveDocTile` (extract from HistoryTile)
Create `frontend/webapp/src/views/Home/tiles/ArchiveDocTile.jsx` holding the current `HistoryTile` body + `parseTeaser`, generalized:
- Props: `{ data, heading, to, image }` where `image` is a URL string or `null`.
- Gate on `if (!data) return null` (NOT `data.id`).
- Render the thumb block only when `image` is truthy (so translation renders no image); use `image` as the `src` (thumb for reception, portrait for joseph). Keep the `onError` hide.
- `to` is the tile's title/thumb/deep-link target.
- Everything else (title, meta, archive, quote hero, bullets, citation, `TileDeepLink`, `RevealProvider`) is unchanged from HistoryTile.
- Export `parseTeaser` (some code/tests import it from HistoryTile — keep a re-export, see below).

### 4. The three doc tiles (thin wrappers)
- `HistoryTile.js` (reception) → `<ArchiveDocTile data={data} heading={label("history")} to={data.slug ? "/history/"+data.slug : "/history"} image={data.id ? `${assetUrl}/history/thumbs/${pad(data.id)}` : null} />`. Re-export `parseTeaser` from ArchiveDocTile for backward compatibility (its test imports it).
- `TranslationTile.js` (new) → `<ArchiveDocTile data={data} heading="Translation" to="/history/translation" image={null} />`.
- `JosephSmithTile.js` (new) → `<ArchiveDocTile data={data} heading="Joseph Smith" to="/history/joseph-smith" image={`${assetUrl}/history/witnesses/people/joseph-smith.jpg`} />`.

(`heading` labels: reception keeps `label("history")`; translation/joseph use plain strings — acceptable, matching the section titles.)

### 5. Registry
In `frontend/webapp/src/views/Home/tiles/registry.js`, add `translation` and `josephSmith` to the **reserve pool** (like `witness`), so they surface via the balancer without over-weighting the default grid:
- `{ key: "translation", component: TranslationTile, dataKey: "translation", isReady: (p) => !!p?.translation }`
- `{ key: "josephSmith", component: JosephSmithTile, dataKey: "josephSmith", isReady: (p) => !!p?.josephSmith }`

(Confirm during implementation how Sampler's `renderReserve` passes `payload[dataKey]` as the tile's `data` prop, matching the `witness` entry's contract.)

## Components / files
| File | Change |
|---|---|
| `backend/src/graphql/resolvers/homesampler.ts` | `sampleTranslation` + `sampleJosephSmith` + registry |
| `backend/schema/HomeSampler.graphql` | `translation` + `josephSmith` fields |
| `frontend/.../models/GraphQLQueries.js` | homesampler `translation`/`josephSmith` selections |
| `frontend/.../Home/tiles/ArchiveDocTile.jsx` | **new** shared doc-tile core (from HistoryTile) |
| `frontend/.../Home/tiles/HistoryTile.js` | thin wrapper (reception, thumb) + re-export `parseTeaser` |
| `frontend/.../Home/tiles/TranslationTile.js` | **new** wrapper (no image) |
| `frontend/.../Home/tiles/JosephSmithTile.js` | **new** wrapper (portrait) |
| `frontend/.../Home/tiles/registry.js` | reserve-pool entries |
| `frontend/.../Home/tiles/__tests__/ArchiveDocTile.test.js` | **new** tests |

## Testing
- **`ArchiveDocTile`**: renders the quote hero (mini→money→teaser ladder) + title/citation; renders the thumb when `image` is set and **omits it when `image` is null**; gates to `null` on missing `data` (not on `id`), so an id-less (joseph) doc still renders.
- **Wrappers**: HistoryTile passes the thumb URL (has id) / null (no id); TranslationTile passes `image={null}`; JosephSmithTile passes the portrait URL — assert each wrapper's `to` + image.
- **HistoryTile regression**: the existing `HistoryTile.test.js` fallback-ladder tests still pass (via the wrapper).
- **Backend**: `sampleTranslation`/`sampleJosephSmith` surface money/mini quotes (verify via a live homesampler query per archive after a backend restart; joseph returns a doc despite no thumb).

## Out of scope (YAGNI)
- No change to `WitnessTile` (witness tile already exists).
- No default-rotation placement (reserve pool only).
- No new quote fields; `mini_quote` already surfaced.

## Acceptance criteria
1. `homesampler` returns a `translation` and a `josephSmith` HistoricalDocument (joseph despite having no thumbnail).
2. `ArchiveDocTile` renders reception (thumb), translation (no image), and joseph (portrait) consistently, gating on `data` not `id`.
3. The four archives each have a Home tile (reception=HistoryTile, witness=WitnessTile, translation=TranslationTile, joseph=JosephSmithTile), surfaced on the board.
4. New + existing tile tests pass; no regression in the Home tiles suite.
