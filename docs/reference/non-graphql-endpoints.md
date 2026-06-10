# Non-GraphQL Endpoints (legacy `src/`)

The green-field backend (`/backend`, :5006) is **GraphQL-only by design**. The legacy
server (`src/index.ts`) also exposes a REST/raw surface that is NOT part of the GraphQL
port and has **no regression baselines**. Catalogued here so it isn't lost at cutover.

## POST REST APIs — `src/api/index.ts` `apis` map → `app.post('/<name>')`

| Path | Handler | Storage | Notes |
|---|---|---|---|
| `/coords` | `updateCoords` (`api/coords.ts`) | **WRITES**: `INSERT … ON DUPLICATE KEY UPDATE bom_places_coords`; `UPDATE bom_places`; `UPDATE bom_translation` | token→user via `bom_user_token`; raw `queryDB`. Map-editor coordinate saving. |
| `/translate` | `translate` (`api/translate.ts`) | **WRITES**: `UPDATE bom_translation` (auditor score; contributor value) | Translation review tool. |
| `/webhook` | `webhook` (`api/index.ts`) | Sendbird studybuddy bot trigger | Gutted/shimmed (`MESSENGER_ENABLED=false`). |
| `/studybuddy` | `studyBuddyTextBlock` (`api/studybuddy.ts`) | raw SQL reads | Bot text generation. |

## GET endpoints — `src/api/index.ts` `endpoints` map → `app.get('/<name>')`

| Path | Handler | Returns | Notes |
|---|---|---|---|
| `/mapmarker/:id` | `mapMarker` (`api/mapmarkers.ts`) | **SVG image** (`image/svg+xml`), not JSON | raw `SELECT bom_places` + `bom_translation`. |

## Raw middleware in `src/index.ts` (not in the api registry)

- `/ping` (`app.all`) — health.
- `/network-check` — live `axios`/socket port probe, returns status JSON.
- `/sphinx` (path or `sphinx.*` host) — `processSphinx`.
- SSR proxy (`PROXY_BOM_SSR`) + per-target reverse proxy (`apiProxy.web`).
- Static file serving for `frontend/{webapp,game,welcome}/build` + SPA `index.html` catch-all.

## Frontend invocations (`frontend/webapp/src`)

Where each endpoint is actually called from. `ApiBaseUrl` is from
`models/BoMOnlineAPI.js`; all calls are `axios` POSTs except where noted.

| Endpoint | Call site | Trigger / purpose |
|---|---|---|
| `/coords` | `views/Map/MapPanel.js:291`, `:330` | Map editor: drag-saving a place's lat/lng/zoom (POST `{lat,lng,map,slug,…}` + `token` header). Map mounts at routes `/map*` (`models/Routes.js:243`, `views/Map/Map.js`). |
| `/coords` | `views/Audit/Audit.js:229` (`updatePlaceCoords`, re-imported by `views/Map/MapContents.js`) | Same coordinate write from the audit/place-edit path. |
| `/translate` | `views/Audit/Audit.js:127` `action:"list"` · `:213` `action:"audit"` (score) · `:243` `action:"update"` (value) · `:643` `action:"context"` | Translation review tool — the `/audit/:key*` route (`models/Routes.js:122`, lazy `views/Audit/Audit.js`). `list`/`context` read; `audit`/`update` **write** `bom_translation`. |
| `/mapmarker/:id` | **not invoked by webapp** | Server-rendered SVG marker; consumed as an image URL by SSR/legacy map tooling, not the React app (no reference in `frontend/webapp/`). |
| `/webhook`, `/studybuddy` | **not invoked by webapp** | Server-to-server (Sendbird → backend). |
| `/ping`, `/network-check`, `/sphinx` | **not invoked by webapp** | Ops/diagnostics + SSR plumbing. |

Note: the GraphQL `closetab` "exit beacon" (`models/BoMOnlineAPI.js:20`,
`views/_Common/Main.js:46`) uses `navigator.sendBeacon(ApiBaseUrl, …)` with a GraphQL
body — it's a GraphQL call, not part of this REST surface, listed only to avoid confusion.

The two user-facing REST consumers — the **Map editor** and the **Audit/translation
tool** — are admin/contributor tools, not the main reader flow. Any green-field
replacement of these endpoints must also port these call sites (or keep them pointed at
the legacy server).

## Files containing raw SQL (`sequelize.query` / `queryDB`) outside resolvers

`src/api/`: `coords.ts`, `translate.ts`, `mapmarkers.ts`, `virtualgroup.ts`, `studybuddy.ts`.

## Two flags for any future migration

1. **These are unguarded write paths.** `/coords` and `/translate` mutate the DB via raw
   `queryDB` and bypass the GraphQL layer's `sandboxMode` write-suppression — the
   "raw sequelize.query writes still slip through" caveat. A green-field equivalent must
   re-establish that guard.
2. **No safety net.** Nothing in `tests/` covers this surface. Porting any of it should
   start by building capture→verify baselines the same way the GraphQL suite did, since
   byte-parity can't otherwise be proven.

**Scope:** out of the current green-field GraphQL effort entirely. Separate phase if ever
undertaken.
