# Green-Field Resolver Porting Guide

How to port a legacy GraphQL query type to the green-field backend (`/backend`).
Written after the labels, contents, and page slices; every rule here was earned.
Spec: `docs/specs/2026-06-09-greenfield-backend.md`.

## The contract

You are reproducing the legacy backend's responses **byte-for-byte**, in English AND
Korean, as pinned by `tests/baselines/<lang>/<type>/<case>.json`. The baseline is the
truth — not the legacy code, not your intuition. Exceptions (approved contract changes,
e.g. quote order) are flagged `nextTruth` in `tests/matrix/inputs.json` and their
baselines come from the green-field backend itself.

## Definition of done (per query type)

1. `npx tsc --noEmit` clean in `backend/`.
2. Suite green for your types, en+ko:
   `NEXT_BASE=http://localhost:<your-port> TARGET=next npx jest --config tests/jest.config.js -t "<type>."`
   (run from the repo root; mind that `-t` is a substring — `page.` also matches `pageprogress.`).
3. A/B byte-identical against live legacy for inputs BEYOND the suite cases:
   `cd backend && NEXT_URL=http://localhost:<your-port> node scripts/ab-compare.mjs '<query>'`
   — try several real slugs/ids (harvest more from the DB), both langs.
4. No edits outside your assigned files (see Workspace rules).

## Workspace rules (multi-agent concurrency)

- You own EXACTLY two files: `src/graphql/resolvers/<domain>.ts` and
  `src/data/loaders/<domain>.ts` (already stubbed and wired into the merge index).
  Do NOT edit `resolvers.ts`, `loaders.ts`, `context.ts`, `index.ts`, schema files,
  the suite, or another domain's files. If you believe a shared file needs a change,
  STOP and report it instead.
- Run your own server instance on your assigned port:
  `cd backend && PORT=<your-port> npx tsx src/index.ts` (foreground or nohup).
  Restart it after every code change (no watch mode — other agents share the tree).
  The shared instance on :5006 is not yours; never kill it or any port you don't own.
- Do NOT `git add`/`git commit` — the controller reviews and commits per wave.

## How to work a query type (the loop)

1. **Read the legacy resolver** (`src/resolvers/*.ts` at repo root) AND the SDL
   (`backend/schema/*.graphql`) AND the frontend query shape
   (`frontend/webapp/src/models/GraphQLQueries.js`) AND the matrix entry + baselines.
   The baseline shows you the EXACT target output — start there.
2. **Map the tables**: types come from `backend/codegen/db.d.ts` (introspected truth).
   Sequelize model files (`src/database/models/`) lie sometimes (bom_places' model
   says PK guid… which is right, but bom_people's PK is `slug` — always verify).
3. **Implement**: loaders in your loaders file (DataLoader per tree edge, batched,
   keyed simply; reuse `core` — translation, slugPathByLink/ByGuid, textByNarration,
   etc. — before writing anything new). Resolvers in your resolvers file: thin field
   resolvers, `Query.<field>` does the root fetch (a plain Kysely query inline in a
   loader-file helper is fine; only build a repository class if there's real logic).
4. **Verify**: restart your server → suite `-t` → ab-compare extra inputs → fix → repeat.

## Design rules

- **Selection-driven**: every tree edge is a field resolver + loader. Nothing fetches
  unless selected. Never assemble a whole tree eagerly in a repository.
- **Reuse `core` loaders**: `translation` ({guid, refkey}), `slugPathByLink` (entity
  guid → slug path), `slugPathByGuid` (bom_slug row guid → path, used by
  connection/capsulation-style `link` columns), `verseIdsByText`, `textByNarration`,
  `quotesByText`, `peopleByText`, `placesByText`, `refsByText`, `notesByText`,
  `textAggByPage`, `pageByGuid`, `sectionsByPage`. Read `src/data/loaders.ts` first.
- **Translations**: one `core.translation.load({guid, refkey})` per field, `?? base`.
  The translation row's `guid` column holds the entity's **primary key** — usually a
  guid, but bom_people keys by SLUG. Verify against the legacy association
  (`src/config/database.ts`: `hasMany(BomTranslation, {foreignKey:'guid', sourceKey?})`
  — no sourceKey means the model's PK).
- **Pin every ordering explicitly.** Legacy mostly has no ORDER BY and leans on engine
  artifacts. Rules learned: content tables order `(weight, guid)`; entity-by-PK scans
  return clustered (PK) order; check the BASELINE's array order first and reproduce it
  with an explicit ORDER BY. If no rational ORDER BY reproduces it (we hit three:
  duplicate page weights, quote join-buffer order, places optimizer-path order),
  STOP and report — that's a contract decision for the controller, not a hack.

## Gotchas (each cost real debugging time)

1. **Null-strip compat**: legacy deletes `''`/`null`/`[]` object keys recursively from
   `data` (Apollo formatResponse). Already replicated globally — so a missing key in
   the baseline usually means "null/empty", NOT "don't resolve it". Return null/[]
   freely; the filter handles parity. Empty arrays DISAPPEAR; `0`/`false` stay.
2. **Key order is contract**: the graphql-js executor is already pinned (selection
   order). Don't add async wrappers around the executor result.
3. **Error messages are contract**: `maskedErrors:false` is set; when legacy CRASHES
   (e.g. TextBlock.heading on digitless headings — see resolvers.ts) the baseline pins
   the message, sometimes lang-dependent. Replicate via a thrown Error with the exact
   message. Check baselines' `errors` arrays (they're reduced to sorted messages).
4. **Case-insensitive matching**: MySQL collation matches `'Zoramites2' = 'zoramites2'`.
   Any in-memory filter mirroring a SQL `IN` must lowercase both sides.
5. **Numbers from aggregates** arrive as strings/BigInt-ish from mysql2 — `Number()` them.
6. **`prodStale` types** (object, objectList, passagenotes*, history): legacy PROD can't
   serve them; their baselines came from the LOCAL legacy (:5005). ab-compare against
   :5005 works for everything.
7. **`getSlugTip`**: incoming slug args may be paths — take the LAST segment for the
   bom_slug match. Most root queries need this.
8. **Multilingual scripture references**: NEVER set any global language. scripture-guide
   (root dep, importable) takes lang per call: `generateReference(ids, lang)`,
   `lookupReference(ref, lang)`. `lang` comes from ctx only.
9. **JSON scalar** fields pass through graphql-type-json — return plain JS values.
10. **bom_lookup.verse_id is a STRING** column; bom_index joins on verse_id too —
    compare as strings, don't Number() the join keys.
11. **Legacy `include`-driven order side-effects**: a legacy resolver's output order can
    change with the SELECTION (the info-driven include builder). The baseline was
    captured with the exact frontend selection — that's the order you target.
12. **`q()` arg unwrap**: single-element arrays unwrap to a scalar in the query string
    (`(slug: "x")` vs `(slug: ["x","y"])`) — both must work; root queries should accept
    scalar-or-array via the generated arg types.

## Probing the DB (when the legacy code is ambiguous)

Run ad-hoc scripts from `backend/` (NOT /tmp — module resolution):

```bash
cd backend && cat > probe.tmp.mjs <<'EOF'
import { getDb } from '/home/bom/BookofMormonOnline/backend/src/data/db.js';
import { sql } from 'kysely';
const db = getDb();
// examples:
const { rows } = await sql`SHOW KEYS FROM bom_people WHERE Key_name='PRIMARY'`.execute(db);
console.log(rows);
console.log(await db.selectFrom('bom_label').selectAll().limit(3).execute());
await db.destroy();
EOF
npx tsx probe.tmp.mjs; rm probe.tmp.mjs
```

Probe LIVE legacy for ground truth (it runs on :5005):

```bash
curl -s -X POST http://localhost:5005/en -H 'Content-Type: application/json' \
  -d '{"query":"{verses(verse_ids:[31103]){verse_id text}}"}'
```

And read the baseline directly: `python3 -c "import json; ..."` over
`tests/baselines/en/<type>/<case>.json` — fastest way to see target shape/order.

## Cross-schema queries

`scripture.guide` schema lives on the same MySQL server; query it with raw sql
template tags (see `refsByText` in `src/data/loaders.ts`). The reader user has access.

## When you're blocked

Report precisely: the type, the case, the field path, what legacy produces, what you
produce, what you probed, your hypothesis. Do NOT: weaken a comparison, special-case a
slug, hardcode data, or edit shared/suite files. A clean failure report beats a dirty
pass every time.

## Report format (per assignment)

- Status: DONE | DONE_WITH_CONCERNS | BLOCKED (per type)
- Suite results for your types (en+ko, exact counts)
- ab-compare evidence beyond suite inputs (which extra slugs/queries, identical y/n)
- Files changed (must be only your two domain files)
- Gotchas encountered / anything the next agent should know
