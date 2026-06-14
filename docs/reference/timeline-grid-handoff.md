# Timeline tile-grid — handoff

Status as of the `feat/timeline-grid` work merged to `dev`. The Timeline view was
rebuilt from a Leaflet image-map into a scrollable **tile grid** (rows = time,
columns = lineage/place), driven by the DB. This doc is the single source of
truth for state + what's left.

## Architecture (how it renders)

Two layers:
1. **Canvas (hardcoded)** — `frontend/webapp/src/views/Timeline/gridTiles.json`:
   lineage band fills, the sticky date-axis gutter, battle markers, and the 2
   pins that have no DB row (Shilom, Reign of Judges). Pure presentation; no DB.
2. **Events + locations (from the API)** — every `bom_timeline` row with a grid
   placement renders from the GraphQL `timeline` query: `Event.grid` (position +
   colour) + `Event.label` (translated text). `p=1` → event tile, `p=0` →
   location pin (📍).

`frontend/webapp/src/views/Timeline/Timeline.js` renders canvas (`gridTiles`) +
API events; `GraphQLQueries.js` requests `grid { row col rowSpan colSpan bg }`
and `label`.

## Database (already applied to PROD `bom_prd`)

`bom_timeline` gained: `grid_row, grid_col, grid_w, grid_h, grid_bg,
label_category ENUM('people','place','event')`. **All three migrations are
applied to prod.** Source: `BoMOnlineWorkspace/sql/migrations/`
(`2026-06-13_bom_timeline_grid.sql`, `..._locations.sql`,
`..._label_category.sql`). 112 rows placed (104 p=1 + 8 p=0).

`label_category` routes the display label (so it reuses existing translations):
- `people` → `bom_people[slug].name` (translated, `refkey='name'`)
- `place`  → `bom_places[slug].name` (translated)
- `event`  → `bom_timeline.heading` (translated, `refkey='heading'`)

Derived from the placement's tile-kind (NOT raw slug overlap, which mis-tags
events like "King Noah's Reign" that share a slug with a city).

## Backends — IMPORTANT

There are **two** backends and both now serve the grid:
- **Legacy `src/` (Apollo + Sequelize)** — this is what runs **dev (`:5005`) and
  prod**. `Event.grid`/`Event.label` added here (model, typedef, resolver). This
  is the one that matters for the live site.
- **New `backend/` (Yoga + Kysely, `:5006`)** — green-field; also has
  `Event.grid`/`Event.label`. Not currently the deployed server.

If you touch timeline GraphQL, change **both** or you'll get the "labels missing"
failure (frontend requests `grid`/`label`; a backend without them errors the
whole query → blank grid).

`tsconfig.json` now sets `ts-node.transpileOnly` so `npm start` / `npm run dev`
actually boot — the legacy codebase has long-standing implicit-any errors that
otherwise abort ts-node's type-check.

## Running dev

```
npm run dev      # backend :5005 (ts-node, transpile-only) + frontend :8200/:3000
```
The frontend dev proxy: `frontend/webapp/src/setupProxy.js` →
`bookofmormon.online` by default, or `localhost:5006` when
`REACT_APP_LOCAL_BACKEND=true` (note: `npm run dev` sets this). For the legacy
`:5005` backend, point it there or rely on the systemd `bom-dev` unit.

## Data pipeline (regenerating the grid)

`scripts/timeline-grid/` (Python):
- `build_tiles.py` — parses the source spreadsheet (`~/Downloads/Timeline
  Grid/Sheet1.html`) → `gridTiles.json` (canvas) + `placements.json` (DB feed).
- `reconcile.py` — audit report only (shares parser/matcher with build_tiles).
- `overrides.json` — manual slug fixes (keyed `"row,col"`).
The workspace generators (`BoMOnlineWorkspace/sql/migrations/gen_*.mjs`) turn
`placements.json` into the SQL.

## Remaining work (NOT done)

1. **Deploy the legacy backend** — `dev` has the frontend requesting
   `grid`/`label`; the live grid stays blank until the `src/` backend ships.
   Frontend + backend must deploy together.
2. **Visual overhaul (requested, not started)** — bg colour, the glyph-driven
   rounded corners, and the battle markers all look crude; needs a real design
   pass. The grid only became judge-able once labels render.
3. **Label polish** — `land-of-first-inheritance` (headingless, not in
   `bom_places`) falls back to its raw slug; humanize or add a `bom_places` row.
   Dense rows have label overlap.
4. **Translations** — non-EN event labels need `bom_translation` rows
   (`refkey='heading'`, keyed by `bom_timeline.id`); people/place reuse already
   covers the overlapping ~73.
5. **Retire `x/y/w/h/z/o`** once the grid columns are trusted.

## Key files
- Frontend: `frontend/webapp/src/views/Timeline/{Timeline.js,Timeline.css,gridTiles.json}`, `models/GraphQLQueries.js`
- Legacy backend: `src/database/models/bom_timeline.ts`, `src/typeDefs/BomPage.ts`, `src/resolvers/BomPeoplePlace.ts`
- New backend: `backend/schema/BomPage.graphql`, `backend/src/graphql/resolvers/mediamisc.ts`
- Design/audit: `docs/plans/2026-06-13-timeline-grid-migration-design.md`, `docs/audits/2026-06-13-timeline-grid-*.md`
- Migrations: `BoMOnlineWorkspace/sql/migrations/2026-06-13_bom_timeline_*.sql`
