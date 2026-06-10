# Green-field Parallel Backend (`/backend`) — Design Spec

**Date:** 2026-06-09
**Status:** Approved design — skeleton phase in progress
**Gate:** `TARGET=next npm run test:gql` (the regression suite, `tests/`) must produce
byte-identical responses to the committed baselines. Phase exit = full green
(207 passed / 2 sandbox skips / 14 parked todos).

## Goal

A complete, parallel rebuild of the GraphQL backend in `/backend`: separate process
(port **5006**), own `package.json`/`node_modules`, zero imports from the legacy `src/`.
Same MySQL source database (`bom_prd`) and byte-identical GraphQL response payloads;
everything between the wire and the database rebuilt with 2026 best practices —
SSoT, modularity, portability, clean abstraction layers, separation of concerns.

## Decisions (approved)

| Concern | Decision |
|---|---|
| Phase-1 surface | GraphQL only (62 regression-gated types + Sendbird schema stubs). REST `/api` and socket.io stay legacy. |
| Server | GraphQL Yoga 5 on Fastify, Node 22 LTS, native ESM |
| Schema SSoT | Legacy SDL carried over **verbatim** as `backend/schema/*.graphql`; GraphQL Codegen derives resolver/arg types. graphql-js pinned to v16 (validation-error messages are baselined). |
| Data layer | Kysely over mysql2; `kysely-codegen` derives table types from the live DB |
| Architecture | Pragmatic DDD-lite: `domain/` (pure entities + logic) · `data/` (repositories + Translator + per-request DataLoaders) · `services/` (use-case orchestration; the only layer resolvers call) · `graphql/` (thin resolvers) |
| Runtime | `tsx watch` dev · `tsc → dist/` prod · strict TS · pino · zod-validated env |
| Suite integration | New `TARGET=next` → `http://localhost:5006` (sandbox-flagged) |
| Delivery | Vertical slices, suite-gated: skeleton → scripture → content → media → search → user → community |

## Layout

```
backend/
├── package.json            # own deps/scripts; no coupling to root
├── tsconfig.json           # strict, ESM, NodeNext
├── .env.example            # PORT, DB_*, SANDBOX, LOG_LEVEL (real .env gitignored)
├── schema/                 # ★ contract SSoT: legacy SDL verbatim (.graphql)
├── codegen/                # committed generated types (graphql resolvers, kysely db)
├── src/
│   ├── domain/             # Page, Section, TextBlock, Person, Place, ContentObject,
│   │                       #   ScriptureRef, Progress, User — pure, no I/O
│   ├── data/               # Kysely repos (one per aggregate), Translator, loaders
│   ├── services/           # content, scripture, notes, media, search, user, progress
│   ├── graphql/            # Yoga setup, context, thin resolvers
│   ├── compat/             # explicit legacy-behavior shims (each documented)
│   ├── config/             # zod env
│   └── index.ts            # Fastify bootstrap, lang routing, /health
└── test/                   # vitest: domain + services against fake repos
```

## Request pipeline

Fastify accepts `POST /` and `POST /{lang}` (language list + subdomain/`langDomains`
rules replicated from legacy `src/config/apollo.ts`) → `lang` resolved **per request**
into Yoga context `{ lang, sandbox, services, loaders }` (DataLoaders per-request,
lang-keyed — the global-language bug class is structurally impossible) → resolvers call
services only → **response-compat filter** strips `null`/`''`/empty-array keys from
`data` exactly like legacy Apollo's `formatResponse` (baselines were captured through
that filter; documented as a retirable shim).

## SSoT & type flow

- `schema/*.graphql` (frozen contract) → GraphQL Codegen → resolver types.
- Live DB → kysely-codegen → table types.
- Both generated artifacts are committed and regenerable; no hand-written shapes.
- **Translator** (`data/`): single point of truth for the translation join —
  batched lang-keyed lookups; each repository declares its translatable fields once.

## Behavioral-compat shims (`src/compat/`)

Null-stripping response filter · `cleanUsername` email-prefix signup · raw
`ER_DUP_ENTRY` duplicate-signup msg · MD5→bcrypt dual-verify signin (organic migration
preserved) · sandbox mode (env-gated write suppression) · explicit `ORDER BY` matching
legacy result ordering · Sendbird surface in schema, serving shim-empty data.

## Skeleton (this phase's deliverable)

Package + config + Fastify/Yoga bootstrap + lang routing + compat filter + Kysely +
Translator + full verbatim schema with stub resolvers + **`labels` implemented
end-to-end** (DB → repo → translation → resolver) + `TARGET=next` in the suite.
Definition of done: backend boots on :5006, `/health` OK, and
`TARGET=next npx jest --config tests/jest.config.js -t "labels."` passes en+ko —
proving server, schema, data access, translation, and compat filter in one slice.

## Risks

graphql error-message drift (pinned v16) · SQL ordering mismatches (explicit ORDER BY;
suite catches) · serialization differences (compat filter last) · auth subtleties
(ported faithfully; prod-verifiable after deploy).
