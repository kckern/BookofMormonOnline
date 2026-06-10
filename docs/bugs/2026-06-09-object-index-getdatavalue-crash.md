# object query returns partial errors — index resolver crashes on getDataValue

**Symptom:** `{ object(slug:"...") { index { slug ... } } }` against the current backend
returns data **plus** a partial `errors` array:
`TypeError: Cannot read properties of undefined (reading 'getDataValue')` at
`path: ["object", 0, "index", N, "slug"]`, originating around
`src/resolvers/BomPeoplePlace.ts:424`. Found while capturing regression baselines —
`tests/baselines/en/object/single.json` records the partial error.

**Root cause (preliminary):** the shared `index` field resolver pattern assumes every
index entry is a Sequelize instance (`i.getDataValue('type')`,
`i.getDataValue('slug')`); for the object query's include path some entries arrive as
plain objects (or the sub-resolver receives `undefined`), so `getDataValue` access
crashes per-row. Needs precise tracing during the overhaul.

**Regression-suite handling:** the partial-error response is captured as-is in the
baselines (`object/single`, `object/batch`) — error behavior is part of the frozen
contract. When the overhaul fixes this, the change will (correctly) show up as a baseline
diff: recapture those cases deliberately with
`RECAPTURE=1 CAPTURE=1 TARGET=prod npx jest --config tests/jest.config.js -t "object."`
and commit the new baselines with the fix.

**Status:** open; fix deferred to the resolver overhaul.
