# Frontend shortLink query requests a field that exists in no schema

**Symptom:** the frontend's `shortLink` query
(`frontend/webapp/src/models/GraphQLQueries.js:724-735`) selects
`shortlink(hash: ...) { shortLink }`, but the `Shortlinks` GraphQL type only has `hash`
and `string` (`src/typeDefs/BomUtils.ts:86-89`) — on **every** backend (prod, dev,
local) the query fails validation with
`Cannot query field "shortLink" on type "Shortlinks"`. Whatever consumes short links in
the webapp has been receiving an error response, presumably forever (or since a schema
rename).

**Root cause:** frontend/schema field-name mismatch — the frontend wants `shortLink`,
the schema calls it `string` (the stored target path). Either the frontend should select
`string` or the schema should expose `shortLink`.

**Regression-suite handling:** the validation-error response is captured as the baseline
for `shortLink/single` and `shortLink/missing` — it IS the current contract. When the
mismatch is fixed (either side), recapture:
`RECAPTURE=1 CAPTURE=1 TARGET=prod npx jest --config tests/jest.config.js -t "shortLink."`.

**Status:** FIXED 2026-06-09 (commit 36852f7) — frontend selects `hash`/`string`; works
against prod and local. Baselines recaptured.
