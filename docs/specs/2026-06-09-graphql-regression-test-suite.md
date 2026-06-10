# GraphQL Regression Test Suite — Design Spec

**Date:** 2026-06-09
**Status:** Approved design, pre-implementation
**Motivation:** A full backend resolver overhaul (`src/resolvers/`) is planned, with concurrent
frontend refactoring. The GraphQL surface consumed by
`frontend/webapp/src/models/GraphQLQueries.js` must stay byte-identical through the overhaul.
Before any resolver work begins, we freeze current behavior as a golden-snapshot regression
suite that can verify prod, dev, or a local refactored backend against committed baselines.

## Goals

1. Inventory and exercise the **entire query surface** defined in `GraphQLQueries.js`
   (~50 builders incl. mutations and the dynamic `passagenotes_N` aliases).
2. Capture **golden baselines from the production API** and commit them.
3. Verify any target (`prod`, `dev`, `local`) against those baselines with readable diffs.
4. Build queries with the **actual frontend code** (`import { prepareQueries } / queries`)
   so the suite can never drift from the real surface.
5. Self-bootstrap a **dedicated test user** for authenticated reads and user-scoped mutations.

## Non-Goals

- Unit-testing resolvers in-process (the existing `test/regression/` ApolloServer suite does that).
- Load/perf testing.
- Languages beyond English and Korean — other `/{lang}` prefixes are a future phase.
- Sendbird-dependent community functions — **parked** (see below).

## Language coverage

The API is multilingual via a URL path prefix (`POST /{lang}`). Translation functions are part
of the contract being frozen, so **every read query runs twice: English (`POST /en`) and
Korean (`POST /ko`)**, with baselines stored per language
(`tests/baselines/<lang>/<query>/<case>.json`). Verified working: prod and the local backend
return translated content on `/ko`.

Mutations and the signin/signout/signup flow run **English-only** in v1 — running the mutation
chain twice would double state writes for no translation-path coverage; localized mutation
messages can be added later.

**Known dev defect (pre-existing):** the public dev URL (`bom.kckern.net`) proxies API paths
through CRA's `setupProxy.js`, and Express `app.use('/ko', …)` strips the mount path before
`http-proxy-middleware` forwards it — so `POST bom.kckern.net/ko` reaches the backend as `/`
and returns English. Direct backend (`localhost:5005/ko`) is correctly Korean. Korean cases
against `TARGET=dev` will fail until that proxy is fixed; this gets a write-up in `docs/bugs/`
and is a known-diff, not a regression-suite bug.

## Architecture

New root `tests/` directory, registered as a standalone Jest project (root `package.json`
scripts `test:gql` and `test:gql:capture`). The existing `test/` directory is untouched.

```
tests/
├── jest.config.js        # standalone Jest project; babel transform so the suite can
│                         # import the frontend ESM file GraphQLQueries.js
├── README.md             # capture/verify workflow, test-user setup, baseline policy
├── harness/
│   ├── client.js         # mirrors BoMOnlineAPI.serverGQLCall: wrap queries in a compound
│   │                     # "{...}" string, POST {query} to the target root, 45s timeout
│   ├── targets.js        # TARGET=prod|dev|local → base URL; requests POST to {base}/{lang}
│   │                     #   prod:  https://bookofmormon.online   (verified live)
│   │                     #   dev:   https://bom.kckern.net        (API POSTs bypass CDN cache)
│   │                     #   local: http://localhost:5005         (verified live)
│   ├── normalize.js      # volatile-field scrubbing applied before capture AND compare
│   ├── baseline.js       # load/save/diff tests/baselines/<query>/<case>.json
│   └── auth.js           # test-user bootstrap: signin → fallback signup → token
├── matrix/
│   ├── harvest.mjs       # one-time: query prod list endpoints (personList, placeList,
│   │                     # objectList, maplist, contents, publications, …), sample a
│   │                     # deterministic spread of slugs/IDs, write inputs.json
│   └── inputs.json       # committed input matrix: query type → named cases
├── baselines/            # committed prod-captured, normalized JSON
│   ├── en/<query>/<case>.json
│   └── ko/<query>/<case>.json
└── suites/
    ├── content.test.js   # person/personList/place/placeList/object/objectList/page/
    │                     # contents/divisionShell/markdown/about/labels/passagenotes(+_N)
    ├── scripture.test.js # scripture/verses/read/lookup/versehighlights/chiasmus/chiasm
    ├── media.test.js     # image/imageInFeed/imageLocations/commentary/commentaryInFeed/
    │                     # commentaryLocations/textInFeed/sectionInFeed/fax/faxIndex/
    │                     # maplist/map/mapstories/timeline/publications
    ├── search.test.js    # search/shortLink/setShortLink/history
    ├── user.test.js      # auth bootstrap, tokenSignIn, signin/signout, studylog,
    │                     # userdailyscores/userprogress/divisionProgress(Details)/
    │                     # pageprogress/pageinfoprogress/readingplan(segment)/queue/
    │                     # queuestatus, mutations: log/editProfile/changePassword/
    │                     # uploadProfileImage/signup, sourceUsage
    └── community.test.js # leaderboard (active) + parked Sendbird surface as test.todo
```

## Execution model

Each case:

1. Build the query with the real builder: `queries[type](caseInputs)` imported from
   `frontend/webapp/src/models/GraphQLQueries.js`.
2. Wrap exactly as the frontend does (`"{" + q.query + "}"`, mutation unwrap regex —
   `BoMOnlineAPI.js:39-40`).
3. POST `{ query }` to the selected target root.
4. Normalize the response (per the query's volatility tier).
5. **Capture mode** (`CAPTURE=1 TARGET=prod`): write the normalized response to
   `tests/baselines/<query>/<case>.json`. Refuses to overwrite an existing baseline
   unless `RECAPTURE=1`.
6. **Verify mode** (default; `TARGET=prod|dev|local`): `expect(normalized).toEqual(baseline)`.
   Jest's native object diff reports the exact regressed field path.
   A missing baseline **fails loudly** ("run capture first") — never a silent pass.

One matrix file (`inputs.json`) drives both modes, so capture and verify cannot diverge.
Network errors retry once; a second failure fails the case with the transport error attached.

## Prod schema drift (`prodStale` types)

Discovered during implementation: the deployed prod backend predates the current repo code.
Prod's schema rejects parts of the current frontend surface with validation errors:
no `object` root query, no `objects` field on `PassageNotes`, no `archive`/`principal`
fields on `HistoricalDocument`. Affected types: `object`, `objectList`, `passagenotes`,
`passagenotes_0`, `passagenotes_7`, `history`.

The regression contract is the **current code's** behavior (that is what the resolver
overhaul must preserve), so these types are marked `prodStale: true` in the matrix and:

- **Capture** pulls them from the local backend (`http://localhost:5005`, current code,
  same `bom_prd` database) instead of prod. All other types remain prod-captured.
- **Verify vs prod** skips them visibly (Jest skip with reason) — prod cannot serve them.
- **Verify vs dev/local** runs them normally.

Acceptance criterion #2 is amended accordingly: `TARGET=prod npm run test:gql` passes 100%
**with the prodStale cases reported as skipped**, not silently absent.

## Input matrix

Generated once by `harvest.mjs` against prod, then committed and stable. Per query:

- **single** — one representative slug/ID/ref.
- **batch** — multi-item array (exercises the `q()` array-vs-scalar arg formatting).
- **missing** — nonexistent slug/ID. The current null/empty/error response is part of
  the frozen contract.
- **query-specific permutations**, e.g.:
  - `history`: bare, `{slug}`, `{archive}`, `{principal}` arg forms (`GraphQLQueries.js:553`)
  - `scripture`/`read`/`lookup`: single verse, verse range, cross-chapter ref
  - `queue`/`queuestatus`: with and without `items`
  - `passagenotes_0` and `passagenotes_7`: prove dynamic aliasing
  - `fax`: filter input form vs `faxIndex` slug form
  - `search`: single-word, multi-word, no-results term

## Language priming

The backend mutates a process-global `scripture-guide` language per request and leaks it
across requests (see `docs/bugs/2026-06-09-scripture-guide-global-lang-leak.md`), so an
English response can contain Korean generated references depending on what the process
served last. To make capture and verify deterministic, the runner POSTs a trivial
scripture query to the target in the case's language immediately before every case,
forcing the global to a known state. Baselines therefore freeze **steady-state
per-language** behavior — which remains the correct expectation after the leak is fixed.

## Volatility tiers

Declared per query in the matrix; normalization runs before capture and before compare,
so baselines never contain masked values.

| Tier | Treatment | Queries (examples) |
|---|---|---|
| `exact` | byte-for-byte | scripture, verses, read, person, place, object, page, chiasmus, contents, maps, fax, publications, markdown, labels, about, history, lookup |
| `scrubbed` | mask volatile fields (`access_token`, timestamps, `lastseen`, `laststudied`, `joined_ts`, `created_at`, `datetime`, `timestamp`, durations of live sessions), then exact | tokenSignIn, signin, studylog, userprogress, userdailyscores, pageprogress, divisionProgress* |
| `shape` | assert structure/types only (deep shape walk), values free | search (ranking churn), leaderboard, queue/queuestatus next-content, anything whose values move with live user activity |

When `TARGET=dev`, all of `user.test.js` automatically downgrades to `shape`:
dev's sandbox mode (`sandboxMode.ts`) swallows writes and auth state doesn't persist,
so exact user-state baselines are a prod-only (and later refactored-prod-candidate) check.

## Test user & mutations

- Credentials live in `tests/.env.test` (**gitignored — this repo is public; never commit
  tokens or passwords**). `tests/README.md` documents creation.
- `auth.js` bootstrap: attempt `signin`; on failure run `signup` (username e.g.
  `regression-test`), then `signin`. The token feeds all gated queries in the run.
- Mutations run against the test user only, in a controlled order:
  `log` → `editProfile` (same values re-applied) → `changePassword` (re-set to the same
  password so state is fixed) → `uploadProfileImage` (tiny fixed image) → `signout`
  (last; invalidates the session deliberately). `setShortLink` is tokenless and lives in
  `search.test.js` with a deterministic input string.
- `signup` exact-baseline runs only when the user doesn't exist yet; otherwise its case
  verifies the "already exists" failure response — both shapes are captured.

## Parked: Sendbird-dependent surface

Sendbird has been gutted from the backend (`BomCommunity.ts` shim, `MESSENGER_ENABLED = false`)
pending the rip-and-replace messaging work. These queries currently return shim/degraded data
on dev and possibly different data on prod (older deploy). **They are inventoried but parked**:
each gets a `test.todo()` entry tagged `PARKED-SENDBIRD` in `community.test.js` so they appear
in every test report and can be activated after the messaging replacement lands.

Parked: `loadGroupsFromHash`, `homegroups`, `homefeed`, `homethread`, `requestedUsers`,
`processRequest`, `joinGroup`, `joinOpenGroup`, `requestToJoinGroup`, `withdrawRequest`,
`botlist`, `addBot`, `removeBot`.

Also parked: `socialsignin` (requires a live third-party OAuth token; cannot be automated).

In scope despite living in the community resolver: `leaderboard` (DB-backed, `shape` tier).

## Error handling

- Transport failure: one retry, then fail with the axios error summarized.
- GraphQL `errors` array in a response is **captured as part of the baseline** — error
  behavior is contract too. Before capture/compare, every error entry is reduced to its
  **sorted, deduplicated messages**: Apollo stacktraces embed server filesystem paths
  (this repo is public) and racing resolver crashes produce unstable error paths/indices,
  so messages are the deterministic, leak-free part of the error contract.
- Capture mode aborts (does not write) if the response is a transport-level failure.
- Harvest script failures (e.g. a list endpoint empty) abort harvest with a clear message
  rather than writing a partial matrix.

## Acceptance criteria

1. `npm run test:gql:capture` against prod populates en + ko baselines for every in-scope
   case; re-running without `RECAPTURE=1` changes nothing.
2. `TARGET=prod npm run test:gql` passes 100% immediately after capture.
3. `TARGET=dev npm run test:gql` passes apart from documented known-diffs (the `/ko`
   proxy-strip defect, sandbox-mode user behavior); each known-diff gets a write-up in
   `docs/bugs/` before the overhaul starts.
4. Parked Sendbird cases are visible as todos in the report, not silently absent.
5. A deliberately broken resolver field (manual smoke check) produces a failing test that
   names the query, case, and field path.

## Future phases (out of scope now)

- Activate parked Sendbird cases after the messaging replacement.
- Languages beyond en/ko; localized mutation responses.
- CI wiring (run verify vs dev on PRs to `dev`).
- Group-mutation coverage once a test group fixture exists in the new messaging system.
