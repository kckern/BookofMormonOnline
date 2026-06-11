# Audit: green-field GraphQL resolvers declared in SDL but not implemented

**Date:** 2026-06-11
**Trigger:** `/user` stat widgets ("date started / study time / sessions") spun
forever. Root cause: the `studylog` query is in the SDL (`backend/schema/*.graphql`,
the frozen legacy contract) but had **no resolver** in `src/graphql/resolvers/`,
so it silently resolved to `null` → stripped to `{data:{}}`. The frontend never
set `studySummary` and the widgets spun.

This is a **class of bug**: the SDL declares the full legacy API; any field
without a resolver returns null with no error. This audit enumerates every such
gap so they're visible instead of failing silently.

## Method
Diff every `type Query` / `extend type Query` field across `backend/schema/*.graphql`
against every implemented `Query: {…}` resolver in `src/graphql/resolvers/*.ts`,
then verify each candidate against the running backend and check frontend usage.

## Mutations: complete ✅
All 26 SDL Mutation fields have resolvers. No gaps.

## Queries: 16 declared with no resolver

### Fixed
| Field | Frontend use | Status |
|---|---|---|
| `studylog` | `/user` stats (StudyHistory) | ✅ **FIXED** — ported bom_log session aggregation to `data/loaders/studylog.ts` + wired in `useractivity.ts`. Verified: staff → `{first,duration:22987,count:34}`; widgets resolve. |

### Frontend-used, still missing (real user-facing gaps)
| Field | SDL | Frontend view | Notes / effort |
|---|---|---|---|
| `userdailyscores` | `(token): UserDailyScore` | `User/History.js` (daily-scores chart) | Legacy uses `getStandardizedValuesFromUserList` (per-day standardized progress over bom_log). Needs that aggregation ported. Chart currently renders empty/broken. |
| `pageprogress` | `(token, slug:[String]): [ProgressScore]` | `Page/Page.js` (per-page progress bars on study pages) | Depends on the legacy **scoring engine** (`getUserForLog` → `findScoredPageTextItems` → `scoreTextItems`). Green-field replaced the scorer with the lightweight `computeUserProgress` (used by `userprogress`/`log`); pageprogress needs the per-page scorer ported or a green-field equivalent. |
| `socialsignin` | `(network, token, social_token): SignIn` | `User/SocialSignIn.js` ("Sign in with Google/Facebook") | OAuth: verify the social token with the provider, find-or-create the bom_user, mint a session token. Needs provider config (Google/FB client IDs). Form login is unaffected. |
| `readingplansegment` | `(token, guid): ReadingPlanSegment` | `Home/ReadingPlan.js` (reading plan) | Reading-plan segment lookup + per-user progress. Moderate. |
| `sourceUsage` | `(token, source): Float` | `_Common/PopUp.js` (commentary popup stat) | Single Float — how much of a source the user has used. Small aggregation. |

### Declared but NOT called by the frontend query layer (lower priority)
`books`, `closetab`, `generateToken`, `mapstory`, `menu`, `moregroups`,
`peoplenetwork`, `postcomments`, `sources`, `studygrouphistory`, `test`, `users`.

These aren't referenced as query definitions in `frontend/.../GraphQLQueries.js`.
Some may be dead legacy surface; **`postcomments`** and **`studygrouphistory`**
are worth a closer look (community/page-comment display), and `menu`/`books` are
worth confirming they're truly served from elsewhere (the nav/book list render,
so likely loaded via `objects`/preload). `closetab`/`test` are beacons/no-ops.

## Recommendation / priority order
1. ✅ `studylog` — done.
2. `userdailyscores`, `pageprogress` — port the legacy scorer/standardizer (these
   are the remaining `/user` + study-page data gaps). Largest effort.
3. `sourceUsage` (small), `readingplansegment` (moderate).
4. `socialsignin` — needs OAuth provider config; do when social login is in scope.
5. Confirm `postcomments` / `studygrouphistory` are needed (community), and that
   the rest are genuinely unused before deleting them from the SDL.

## Guardrail going forward
Add a schema-vs-resolver coverage check (the diff in this audit) to CI so a
declared-but-unimplemented field fails the build instead of returning null at
runtime.
