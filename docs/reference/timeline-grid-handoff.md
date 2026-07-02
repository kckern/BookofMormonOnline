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

## Backends — IMPORTANT (updated 2026-07-01)

**Dev runs `backend/` (Yoga + Kysely) on `:5006`** — systemd unit
`bom-greenfield`. The legacy `src/` Apollo server was retired to
`_deprecated/src/` (2026-06-16) and no longer exists at the repo root; the
timeline GraphQL surface (`Event.grid` incl. `anchor/tier/dir/icon`,
`Event.label`) lives ONLY in `backend/`.

**Prod caveat:** prod historically ran the legacy server. The frontend now
queries `grid { … anchor tier dir icon }`; a backend without those fields
errors the whole query → blank grid (the "labels missing" failure). **Do not
deploy this frontend to prod until prod is confirmed on `backend/`** (KC gate
#4 below).

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

## Done since this handoff was written

### Illuminated-manuscript visual overhaul (was #2)
`Timeline.css` + `Timeline.js` redesigned to an aged-parchment canvas: warm
parchment gradient + faint SVG paper-grain (multiply) + top vignette; band gaps
read as intentional negative space; tone-adaptive label halos
(`.tg-on-dark`/`.tg-on-light` via `textOn(bg)`); gutter / date axis / place names
/ zoom controls / info-box all re-themed sepia-on-parchment with the app serif
(`Nanum Myeongjo`); grid `margin: 0 auto` in a block scroller (equal L/R margins,
left edge scroll-reachable when zoomed wide). Verified via headless screenshots
at `localhost:8201` (NOT `bom.kckern.net` — Cloudflare edge-caches the bundle 4h).

### World-class UX round (plan `docs/plans/2026-07-01-timeline-grid-world-class-ux.md`, Tasks 1–17)
- **Compositor + marker architecture** — `timelineModel.js` (pure, unit-tested)
  extracts the geometry model; `buildComposite` composes band fills + bars +
  markers into a single ordered draw list with `under|over` layering. 52 frontend
  tests across `timelineModel.test.js` + `TimelinePopover.test.js`; 3 backend
  tests in `backend/test/graphql/timeline-grid.test.ts`; `tsc --noEmit` clean.
- **Corner rule v2 + size-aware radii** — junctions stay square, true silhouette
  corners round, radius scales with tile size (thin bars → stadium caps, big
  bands → base radius, stacked bands flush — no junction slivers). Evidence:
  `docs/audits/timeline-ux-screenshots-2026-07-01/task4-corner-v2-*.png`.
- **Color tokens + themes** — every fill goes through `var(--c-<token>)`; source
  hexes act only as keys. Parchment + Dark canvas themes swap wholesale; band
  hover highlight driven by `data-lin` identity, works in both themes.
- **Icon-event model** — battle tiles routed through a unified compositor path as
  icon markers (struck-gold medallion + inline crossed-swords SVG, no emoji);
  incursion markers get an attacker-tab that reveals the true surface beneath.
- **Clickable battles (16)** — `bind_battles.py` → `battleSlugs.json` binds 16
  battle tiles to dated events; each renders as a focusable `<button>` opening the
  event story. 22 remaining battle medallions stay decorative (unbound). Report:
  `scripts/timeline-grid/battle-binding-report.md`.
- **Anchors, content-sized chips, LOD, axis** — labels are anchored + content-
  sized chips (no parchment squares, no label crossing a color boundary mid-word);
  zoom LOD hides tier-3 below ~0.85 (verified: 10/10 tier-3 hidden at min zoom);
  axis normalized (decade ticks like `80s BC`, no bogus `545s BC` plurals; century
  hairlines subtle); zoomed+scrolled gutter edge hard and clean.
- **Speech-bubble popover** — anchored callout with tail that flips side and
  clamps to the grid (verified: right on left-edge marker, left on right-edge
  marker); narrow screens (≤640px) fall back to the centered `tg-infobox` modal
  with backdrop. Escape closes, focus returns to the opener, Tab is trapped;
  `aria-label`s carry heading + date (101/104 events; 3 legitimately undated).
- **Gutter + post-Christ contrast** — post-Christ era now reads as a distinct
  silver-gray band (was near-invisible cream); destruction band full-width with
  rounded top corners; record-end maroon feathers out (fade device).
- **Shape-language tiles + 6 pilots** — `k:"grad"|"fillet"|"fade"|"bevel"` canvas
  devices (no DB change); 6 pilot sites authored. Evidence:
  `docs/audits/timeline-ux-screenshots-2026-07-01/task16-shapes-*.png`.

### Label humanize (part of #3)
Events/locations with no translated `label`/`heading` humanize the slug client-
side (`humanize()` in `Timeline.js`): `land-of-first-inheritance` → "Land of
First Inheritance".

## OUTSTANDING — KC gates

These are decisions/actions that require KC or a workspace-DB operator. Nothing
below blocks the dev branch; several block a *prod* deploy or further data work.

1. **Corner rule v2 approval** — v2 squares the "alongside-tip" case that v1
   deliberately rounded (per KC's earlier direction). Confirm the square reading
   is wanted. Evidence: `task4-corner-v2-*.png`.
2. **`battleSlugs.json` final sign-off** — 16 kept / 6 dropped / 16 tiles left
   unbound + 9 unmatched slugs. Review the kept/dropped pairs and the unmatched
   list, then confirm bindings or add date data for undated events. Evidence:
   `scripts/timeline-grid/battle-binding-report.md`.
3. **SQL artifacts — apply via BoMOnlineWorkspace IN ORDER:**
   1. `scripts/timeline-grid/2026-07-01_bom_timeline_label_params.sql` (DDL +
      anchor/tier/dir seeds) — **first** (the DDL adds the columns the seeds and
      the placements file expect).
   2. `scripts/timeline-grid/2026-07-01_bom_timeline_battle_placements.sql`
      (rollback: `..._battle_placements_rollback.sql`).
   - At apply time: **delete the `k:'battle'` tiles from `gridTiles.json`** (DB
     icon-events take over from the canvas markers), and **re-run
     `bind_battles.py` + `build_tiles.py`** if the mapping changed.
4. **Prod precondition** — the anchor/tier/dir/icon query change must NOT reach
   prod until prod runs `backend/` (or an equivalent schema). Frontend requests
   the new fields; a backend without them errors the whole query → blank grid.
5. **Shape-pilot review** (evidence `task16-shapes-*.png`) — accept or revert each:
   - **Strong (4):** Jaredite teal→mustard handoff gradient; destruction-band
     rounded tops; post-Christ silver-gray band + dissolve; record-end fade-out.
   - **Weak but shipped:** schism gradient reads thin (bevels unauthored — maroon
     and navy are not adjacent in the grid data, so the diagonal seam has nothing
     to bevel against); kings→judges dissolve near-invisible (green→green — the
     token values on both sides resolve too close to differentiate).
   - **DEFERRED with reasons:** Ammon-block fillets (1-cell fillets can't smooth
     2–3-cell steps — needs a multi-cell fillet primitive or data re-granular-
     ization); pass-under U-turn (geometry ambiguous in the current data);
     bevel mechanism shipped but has no live site yet.
6. **Non-battle placement residue (~49 slugs)** — editorial placement pass via
   `scripts/timeline-grid/overrides.json`, to be done AFTER the SQL gates land.

## Remaining work (NOT done — non-gated)

1. **Deploy backend + frontend together** — `dev` requests `grid`/`label` +
   anchor/tier/dir; the live grid stays blank until a backend serving those
   fields ships. See gate #4 for the prod schema precondition.
2. **Translations** — non-EN event labels need `bom_translation` rows
   (`refkey='heading'`, keyed by `bom_timeline.id`); people/place reuse already
   covers the overlapping ~73.
3. **Deferred source-artwork devices** (no pilot this round) — tone-on-tone
   insets (region 10), interior lozenges (8b), full Zeniff journey-ribbon
   re-authoring (5). Task 16 mechanisms support all three; authoring is the next
   data round after the pilots are accepted.
4. **Retire `x/y/w/h/z/o`** once the grid columns are trusted (only after prod
   cuts over to the grid).

## Key files
- Frontend: `frontend/webapp/src/views/Timeline/{Timeline.js,Timeline.css,gridTiles.json,timelineModel.js,TimelinePopover.js,battleSlugs.json}`, `models/GraphQLQueries.js`
- Legacy backend: `src/database/models/bom_timeline.ts`, `src/typeDefs/BomPage.ts`, `src/resolvers/BomPeoplePlace.ts`
- New backend: `backend/schema/BomPage.graphql`, `backend/src/graphql/resolvers/mediamisc.ts`
- Data pipeline: `scripts/timeline-grid/{build_tiles.py,bind_battles.py,reconcile.py,overrides.json,placements.json,screenshot.js,battle-binding-report.md}`
- SQL gates: `scripts/timeline-grid/2026-07-01_bom_timeline_{label_params,battle_placements,battle_placements_rollback}.sql`
- Plans: `docs/plans/2026-07-01-timeline-grid-world-class-ux.md`, `docs/plans/2026-06-13-timeline-grid-migration-design.md`
- Audit + evidence: `docs/audits/2026-07-01-timeline-grid-ux-audit.md`, `docs/audits/timeline-ux-screenshots-2026-07-01/`
- Design language (13-region table): `docs/reference/timeline-source-design-language.md`
- Migrations (applied): `BoMOnlineWorkspace/sql/migrations/2026-06-13_bom_timeline_*.sql`
