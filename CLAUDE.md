# CLAUDE.md - Project Guide for Claude

## Project Overview
Book of Mormon Online - an interactive scripture study platform for the Book of Mormon. Full-stack application with separate frontend and backend.

## Architecture

### Frontend (`/frontend/webapp/`)
- React 17; view state via per-view controllers (immutable useReducer + React context — see docs/plans/2026-07-15-controller-state-migration.md). NOTE: the `redux`/`react-redux` packages are still in package.json but are NOT wired up (no store/Provider); only About/Tos import them and those imports are dead — see docs/bugs/2026-07-14-about-tos-dead-react-redux.md
- Bootstrap 5 + Sass for styling
- Socket.io for real-time features
- Rich text editors (CKEditor, TinyMCE), maps (Leaflet), charts (Highcharts)

### Backend (`/src/`)
- Node.js with TypeScript
- Express + Apollo GraphQL
- Sequelize ORM with MySQL (remote container, creds in Infisical)
- Redis for caching
- Socket.io for WebSocket connections

## Environments

| Env | URL | Where it runs |
|---|---|---|
| **dev** | `bom.kckern.net` | systemd user unit `bom-dev` on the host this CLAUDE.md sits on; frontend on `:8200`, backend on `:5005`, fronted by Nginx Proxy Manager + Cloudflare. Secrets loaded from local Infisical via `bom-load-env` ExecStartPre. |
| **prod** | (separate deployment) | Tracked by the `prod` branch; deployment target is currently out of date relative to `origin/prod` source. Confirm with the team before assuming where prod lives. |

`bom.kckern.net` is **dev**, not prod. Do not treat traffic there as production. Restarting `bom-dev` (e.g. `systemctl --user restart bom-dev`) bounces the public dev URL — coordinate before doing it.

**Cloudflare caches frontend assets at the edge** with `cache-control: max-age=14400` (4 hours) — including `/static/js/bundle.js`, the live CRA dev bundle. Frontend source edits propagate to `localhost:8200` instantly via HMR, but `bom.kckern.net` continues to serve a stale bundle until the CDN cache expires (`cf-cache-status: HIT` confirms a cached response). When verifying frontend changes during a session, **screenshot/curl `http://localhost:8200` directly** rather than `bom.kckern.net` — same content, no edge caching. To force the public URL fresh: purge in the Cloudflare dashboard, append a cache-busting query string, or wait out the TTL. (Note: this applies to the dev URL only; production has its own deploy path.)

## Development setup

### On this dev host (the one CLAUDE.md lives on)
```bash
systemctl --user status bom-dev          # is it running?
systemctl --user restart bom-dev         # bounce frontend + backend together
journalctl --user -u bom-dev -f          # tail logs
```
The unit's `ExecStartPre=/usr/local/bin/bom-load-env` pulls fresh secrets from local Infisical (`http://localhost:8070`, `bom-dev` machine identity in `~/infisical/`) into `$XDG_RUNTIME_DIR/bom-dev.env` (tmpfs, mode 600) before each start.

### On a developer laptop
```bash
cd frontend/webapp && npm install && npm start    # frontend dev server
npm install && npm run dev:backend                # backend (TypeScript via ts-node)
```
The backend connects to the remote MySQL — no local DB needed. Credentials must be supplied via env (the laptop is not on Infisical).

### Database
MySQL 8.0.40 in a container on a remote host. Default db is `bom_prd`. Read-only user `reader@%` for dev/staging traffic; the writable `bom_app` user lives in `BoMOnlineWorkspace` and is not used here.

## Code Conventions

- **Follow existing patterns** in the codebase
- Frontend components: React functional components with hooks
- Backend: TypeScript, GraphQL resolvers in `src/resolvers/`
- GraphQL schema definitions in `src/typeDefs/`
- Database models in `src/database/`

## Files to Avoid

- `node_modules/`
- `frontend/webapp/build/`
- `dist/`
- Any generated/compiled output

## Domain Context

Scripture terminology follows standard conventions:
- Books (e.g., "1 Nephi", "Alma", "Moroni")
- Chapters and verses (e.g., "Alma 32:21")
- No special LDS-specific terminology handling needed

## Testing

Currently minimal test coverage. Tests located in `/test/` directory.
Run with: `npm test`

## Key Directories

```
src/
├── api/          # REST API routes
├── resolvers/    # GraphQL resolvers
├── typeDefs/     # GraphQL schema
├── database/     # Sequelize models
├── library/      # Shared utilities
├── config/       # Configuration
└── index.ts      # Server entry point

frontend/webapp/
├── src/          # React components
├── public/       # Static assets
└── package.json  # Frontend dependencies
```

## Working Notes & Documentation Layout

When you (Claude) need to persist non-code working artifacts — design specs, implementation plans, audit findings, bug write-ups, or external-system references — **write them to `docs/<category>/`**, not to the repo root, not to `/tmp`, and not as inline conversation summaries the user has to scroll back to find.

```
docs/
├── api/         # GraphQL/REST API reference (queries.md, mutations.md, types.md, README.md)
├── specs/       # Feature specifications: what is being built, requirements, acceptance criteria
├── plans/       # Implementation plans: step-by-step approach for a feature/refactor before coding
├── audits/      # Code audits, security reviews, performance investigations, dependency scans
├── bugs/        # Bug investigations & post-mortems: symptom, root cause, fix, regression test
└── reference/   # External pointers, environment notes, on-call dashboards, config catalogs
```

**Conventions:**
- Filename in `specs/`, `plans/`, `audits/`, `bugs/`: `YYYY-MM-DD-kebab-case-title.md` — point-in-time artifacts, dated by when they were written.
- Filename in `reference/`: `kebab-case-title.md` — evergreen, no date prefix. Update in place as facts change rather than dating new versions.
- `api/` follows its own existing structure (`README.md`, `queries.md`, etc.) and is also evergreen; keep it in sync with the schema.
- One artifact per file. Don't dump unrelated work into one document.
- Update an existing file when the topic continues; create a new one when the topic is new.
- Specs and plans are written *before* implementation; audits and bugs are written *during or after*.
- For multi-step work, the plan in `docs/plans/` is the source of truth — the in-conversation TaskList is for execution-time tracking, the plan file is for the design decisions.

**When to skip docs/:** purely conversational work, single-file edits with no design decisions, or anything the user explicitly says doesn't need a record. Don't manufacture documents to look thorough.
