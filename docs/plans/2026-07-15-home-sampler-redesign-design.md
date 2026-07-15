# Home Sampler Redesign — Design

**Date:** 2026-07-15
**Status:** Validated design, pre-implementation

## Problem

The current homepage (`/home`) is the community view: study-group browser, activity feed, leaderboard. New users report confusion — they land in a social feed with no sense of what the site contains or where to start. The community content is valuable but is a poor front door.

## Goal

Make `/home` a **random sampler**: a bounded, tile-based explore page that shows one taste of each content type (people, places, facsimiles, commentary, contents, reading plan, community) so every visit surfaces something concrete to click into. Community moves to a secondary page.

Non-goals: infinite scroll, replacing `/welcome`, redesigning `/community` itself.

## Routing

| Route | Before | After |
|---|---|---|
| `/home` | Community view | Sampler page |
| `/home/:channelId(/:messageId)` | Community view, group open | Redirect → `/community/...` |
| `/community(/:channelId/:messageId)` | — | Community view (current Home.js content) |
| `/welcome` | Marketing page | Unchanged |

The sampler is shown to both signed-in and signed-out users.

## Tile inventory (initial)

Rendered as a bento-style CSS grid — mixed tile footprints, 4 columns desktop / 2 tablet / 1 mobile. Page ends with a footer row of "go deeper" nav links (Contents, People, Places, Community, Search). Some spill below the fold is acceptable; the page is finite.

| # | Tile | Contents | Click target |
|---|---|---|---|
| 1 | People (hero) | 4×2 grid of 8 random portraits + names | `/people/:slug` |
| 2 | Places | Strip of 5 random place thumbnails | `/places/:slug` |
| 3 | Facsimile | 1 random facsimile page image | `/facsimiles` |
| 4 | Commentary | Title, source, ~40-word excerpt | Annotated page |
| 5 | Contents | 1 random division/book outline snippet | `/contents` |
| 6 | Reading plan | Existing `ReadingPlan`, reskinned as a tile | Plan segment |
| 7 | Community spotlight | Rotates: featured group / recent finishers / leaderboard strip | `/community` |
| 8 | Recent activity | Latest public comment or highlight | `/community/:channelId/:messageId` |

## Backend: `homesampler` query

One new GraphQL query returning the whole page in one round trip:

```graphql
homesampler(token: String, seed: Int): HomeSampler

type HomeSampler {
  seed: Int
  people: [Person]
  places: [Place]
  fax: Fax
  commentary: Commentary
  contents: Division
  spotlight: Spotlight        # one of: group | finishers | leaders
  activity: FeedItem
  readingplan: ReadingPlanProgress
}
```

- **Session-stable randomness.** Frontend generates a seed once per session (`sessionStorage`), passes it in. Resolver samples deterministically from the seed (`ORDER BY RAND(seed)` or seeded shuffle over cached ID lists). Refresh/back replays the same page; new session, new sample.
- **`spotlight` and `activity` ignore the seed** — they reflect what's happening now.
- **Quality filters.** Sample only people with portraits and non-trivial bios, places with images, commentary above a minimum length. No stub records on the front door.
- **Reuse existing loaders.** The resolver picks random slugs/IDs, then delegates to the data paths behind `person`, `places`, `fax`, `commentary`, `division`, `leaderboard`, `homegroups`. No new models — a thin orchestration resolver.
- **Extensible sampler map.** The resolver is a map of sampler functions sharing one signature, run with `Promise.allSettled`:

```ts
const samplers = {
  people: samplePeople,      // (seed, token) => Promise<data>
  places: samplePlaces,
  // add future tile types here
};
```

One failed sampler yields a null field (missing tile), never a failed query.

## Frontend: tile registry

```
views/Home/
├── Home.js          # shell: fetch homesampler, render grid from registry
├── Sampler.css
└── tiles/
    ├── registry.js
    ├── PeopleTile.js … ActivityTile.js   # one component per tile
```

Each registry entry is a contract:

```js
{
  key: "people",                 // field in HomeSampler payload
  component: PeopleTile,         // receives { data, seed }
  span: { col: 4, row: 2 },      // grid footprint per breakpoint
  isReady: (d) => !!d?.people?.length,  // hide tile when data missing
  requiresAuth: false,           // swap in sign-in prompt when true & signed out
}
```

The shell maps the registry, skips not-ready tiles (grid reflows, no holes), and passes each tile its payload slice. **Adding a future tile type = one payload field + one sampler function + one component + one registry entry.** Unknown payload fields are ignored (forward compatible).

## Loading & errors

- **Skeletons:** grid renders instantly with shimmer placeholders sized by each tile's `span`; tiles fill in when the single response lands. No layout shift.
- **Whole query fails:** retry once, then a minimal fallback page — reading plan (signed in) + static nav tiles to People/Places/Contents/Community. Never blank.
- **One sampler fails:** null field → `isReady` hides the tile.
- **Signed out:** `readingplan` tile becomes the sign-in prompt tile (not hidden).

## Testing

- **Backend:** seed contract (same seed → same picks; different seed → different), quality filters exclude stubs, per-sampler failure isolation. Follow existing `/test/` patterns.
- **Frontend:** registry contract — not-ready tiles don't render; payload slices route correctly; unknown fields ignored.
- **E2E smoke:** `/home` renders ≥6 tiles; people tile click navigates to a person page; `/home/:channelId` redirects to `/community/:channelId`.

## Decisions log

- Community moves to `/community`; old `/home/:channelId` links redirect. (KC, 2026-07-15)
- Randomness is session-stable via client-held seed, not daily or per-load. (KC)
- Single aggregate `homesampler` query, not client-side composition. (KC)
- Sampler shown to everyone; `/welcome` untouched. (KC)
- Community tile is a rotating spotlight (group / finishers / leaders). (KC)
- Framework must be extensible for future tile types — registry + sampler map. (KC)

### Implementation refinements (during build, 2026-07-15)

- **`HomeSampler` carries only the seeded content samples** (`people`, `places`, `fax`, `commentary`, `contents`). The `spotlight`, `activity`, and `readingplan` tiles are assembled client-side (`Sampler.js` `assemblePayload`) from the existing `homegroups` / `leaderboard` / `readingplan` queries, which `BoMOnlineAPI` batches into the same single POST — the one-round-trip property is preserved without duplicating community resolver logic.
- **Two backend dependencies were missing from the manifest** and are now declared: `scripture-guide` and `axios`. They were imported by `src/` (lang, auth loaders, etc.) but absent from `package.json`, which broke `buildSchema()`/`buildContext()` at module load and prevented all yoga-based integration tests (7 files) from collecting. Adding them fixed the entire integration-test baseline, not just the new tests.
- **Deterministic sampling uses `ORDER BY MD5(CONCAT(col, ':', seed))`**, not MySQL `RAND(seed)` (whose order depends on scan order). The fax sampler additionally stable-sorts by slug before its modulo pick (the fax loader's own order is weight-only, no tiebreak). The commentary filter uses `CHAR_LENGTH(text) > 500` (aligned to what the client renders), not the stored `length` column.
- **Generated seed is bounded to the GraphQL `Int` domain** (`Math.floor(Math.random() * (2 ** 31 - 1)) + 1`) on both backend and the frontend session-seed generator, so an echoed seed can never overflow `Int`.
- **Dark mode uses `html[data-theme="dark"]`** (set on `document.documentElement` in `Main.js`), NOT `body.dark` — the design's original `body.dark` assumption was wrong and matched nothing.
- **The facsimile tile links to `/fax/:slug`** (the real route), not `/facsimiles`; its thumbnail uses `${assetUrl}/fax/thumb/${slug}/001.<fmt>` per the Facsimiles convention.
- **Activity timestamps are converted ms → s** before `timeAgoString` (which expects UNIX seconds), matching how `Feed.js` handles the same `latest.timestamp`.
- **Graceful degradation covers timeouts:** `BoMOnlineAPI` resolves (not rejects) on a request timeout, returning an `{error}` sentinel. The shell detects a response lacking the `homesampler` slice and routes it through the same retry-then-`SamplerFallback` path as a hard rejection, so a slow backend shows the fallback rather than a near-empty page.
- **New UI label keys** (`latest_activity`, `members`, `menu_community`, plus `community`/`contents` to verify) are inventoried in `docs/reference/sampler-label-keys.md`; they must be inserted into the labels DB table by someone with write access (the dev DB user is read-only). Until then they render as the raw key.
