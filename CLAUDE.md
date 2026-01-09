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
