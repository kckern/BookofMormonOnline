# CLAUDE.md - Project Guide for Claude

## Project Overview
Book of Mormon Online - an interactive scripture study platform for the Book of Mormon. Full-stack application with separate frontend and backend.

## Architecture

### Frontend (`/frontend/webapp/`)
- React 17 with Redux state management
- Bootstrap 5 + Sass for styling
- Socket.io for real-time features
- Rich text editors (CKEditor, TinyMCE), maps (Leaflet), charts (Highcharts)

### Backend (`/src/`)
- Node.js with TypeScript
- Express + Apollo GraphQL
- Sequelize ORM with MySQL (remote AWS RDS)
- Redis for caching
- Socket.io for WebSocket connections

## Development Setup

### Frontend Development
```bash
cd frontend/webapp
npm install
npm start
```
- Runs on localhost, connects to **production backend by default**
- Environment config in `.env` file
- Use `.env.production` for prod-specific settings

### Backend Development
```bash
cd /Users/kckern/Documents/GitHub/BookofMormonOnline
npm install
npm run dev:backend
```
- Connects to remote MySQL database (no local DB needed)
- TypeScript source in `src/`

### Production Access
```bash
ssh bom 'docker bookofmormon-online'
```
SSH aliases configured in `~/.ssh/config`

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
