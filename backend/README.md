# bom-backend — green-field GraphQL backend

Parallel rebuild of the GraphQL API on port **5006**. Spec:
`docs/specs/2026-06-09-greenfield-backend.md`. Acceptance gate: the regression suite —
`TARGET=next npm run test:gql` from the repo root must match the committed baselines
byte-for-byte.

## Layout

- `schema/` — the **frozen API contract**: legacy SDL carried over verbatim. Do not
  hand-edit; contract changes are a cross-team decision + baseline recapture.
- `codegen/` — committed generated types: `graphql.ts` (from schema), `db.d.ts`
  (from the live database). Regenerate: `npm run codegen:graphql` / `npm run codegen:db`.
- `src/domain` → pure entities · `src/data` → Kysely repositories + Translator ·
  `src/services` → use-cases · `src/graphql` → Yoga + thin resolvers ·
  `src/compat` → documented legacy-behavior shims.

## Run

```bash
cp .env.example .env       # fill from $XDG_RUNTIME_DIR/bom-dev.env on the dev host
npm install
npm run dev                # tsx watch, :5006
npm test                   # vitest unit tests
npm run typecheck
```

## Rules

- `lang` lives in request context only — never in module state.
- Resolvers call services only; services call repositories only.
- Every legacy quirk we intentionally reproduce lives in `src/compat/` with a comment
  explaining why and what retiring it requires.
- No imports from the legacy `src/` tree, ever.
