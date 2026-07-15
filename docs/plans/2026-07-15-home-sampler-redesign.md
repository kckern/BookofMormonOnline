# Home Sampler Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `/home` with a tile-based "random sampler" explore page; move the current community view to `/community` (with redirects), all per the validated design in `docs/plans/2026-07-15-home-sampler-redesign-design.md`.

**Architecture:** Backend adds one new GraphQL query `homesampler(seed)` (new SDL file + one aggregate resolver with an extensible sampler-function map, seeded deterministic sampling). Frontend adds a `Sampler` view built from a tile registry; community data (spotlight/activity) reuses the existing `homegroups`/`leaderboard` queries batched into the same single HTTP request by `BoMOnlineAPI`.

**Tech Stack:** Backend: TypeScript ESM, Fastify + graphql-yoga, Kysely/MySQL, vitest, graphql-codegen. Frontend: React 17 (CRA), react-router v5, plain CSS, Jest + React Testing Library. E2E: Playwright in `e2e/`.

---

## Design refinement vs. the design doc (read first)

The design doc's `HomeSampler` type listed `spotlight`, `activity`, and `readingplan` fields. Implementation refines this: **`homesampler` returns only the seeded content samples** (`people`, `places`, `fax`, `commentary`, `contents`); the spotlight/activity/reading-plan tiles are assembled client-side from the existing `homegroups`, `leaderboard`, and `readingplan` queries. Rationale:

- `BoMOnlineAPI` batches every requested query into **one compound GraphQL POST** (`prepareQueries`, `frontend/webapp/src/models/BoMOnlineAPI.js:33`), so the "single round trip" property is preserved exactly.
- The community logic (`assembleHomeUser`, `maskUserPrivacy`, `getFeaturedChannels`, …) is module-local to `backend/src/graphql/resolvers/community.ts` and inline in its resolvers; duplicating or extracting it buys nothing since the client can already ask for those root fields in the same request.
- Spotlight/activity were decided to be seed-independent ("what's happening now") anyway.

The extensibility contract is unchanged: a future tile = 1 SDL field + 1 sampler function + 1 tile component + 1 registry entry.

## Environment facts the executor must know

- **Work in the worktree** `/Users/kckern/Documents/GitHub/BookofMormonOnline/.worktrees/home-sampler` on branch `feature/home-sampler`. All paths below are relative to the worktree root.
- Backend deps are installed; `backend/.env` is present (copied from the main checkout). DB user is **read-only** (`reader`) — never write to the DB.
- **Known-failing backend test files (pre-existing, environmental — do NOT try to fix):** `test/preview.test.ts`, `test/searchhist-dedupe.test.ts`, `test/graphql/mutations.test.ts`, `test/messaging/bans.test.ts`, `test/messaging/community-graphql-auth.test.ts`, `test/messaging/community-graphql.test.ts` (collection-time INSERTs denied for `reader`), `test/search/candidates.test.ts` (missing `scripture-guide` package). Baseline: 249 tests pass, 0 fail. Judge success by *your* new test files plus no regression in the passing set.
- Backend test command: `cd backend && npx vitest run test/graphql/homesampler.test.ts`. Tests hit the real remote DB (read-only) through graphql-yoga.
- Frontend test command: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern=<pattern>`.
- Backend typecheck: `cd backend && npm run typecheck`. Codegen after SDL changes: `npm run codegen:graphql` (regenerates `backend/codegen/graphql.ts`; commit the generated file).
- Backend dev server: `cd backend && PORT=5005 npm run dev` (frontend local dev calls `http://localhost:5005` — `BoMOnlineAPI.js:16`; backend's default PORT is 5006, so override). `SANDBOX=1` is already set in `.env`.
- Frontend dev server: `cd frontend/webapp && npm start` (port 8200; deps installed).
- Commit after every green step with the trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## Task 1: Backend SDL — `HomeSampler` schema + codegen

**Files:**
- Create: `backend/schema/HomeSampler.graphql`
- Generated: `backend/codegen/graphql.ts` (via codegen, do not hand-edit)

Schema files in `backend/schema/` are auto-discovered alphabetically by `backend/src/graphql/schema.ts:12-17`; no registration needed. All member types (`People`, `Place`, `Fax`, `Commentary`, `Division`) already exist in the SDL.

**Step 1: Create the SDL file**

```graphql
# HomeSampler — aggregate seeded random samples for the /home sampler page.
# New surface (post-legacy contract). Design: docs/plans/2026-07-15-home-sampler-redesign-design.md
# Adding a tile type: add a field here + a sampler fn in src/graphql/resolvers/homesampler.ts.
extend type Query {
  homesampler(seed: Int): HomeSampler
}

type HomeSampler {
  seed: Int
  people: [People]
  places: [Place]
  fax: Fax
  commentary: Commentary
  contents: Division
}
```

**Step 2: Regenerate resolver types**

Run: `cd backend && npm run codegen:graphql`
Expected: exits 0, `codegen/graphql.ts` diff includes `HomeSampler`.

**Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exits 0 (resolver fields are optional in the generated `Resolvers` type, so no resolver yet is fine).

**Step 4: Commit**

```bash
git add schema/HomeSampler.graphql codegen/graphql.ts
git commit -m "feat(backend): add homesampler SDL surface"
```

---

## Task 2: Backend — failing test for `homesampler`

**Files:**
- Create: `backend/test/graphql/homesampler.test.ts`

**Step 1: Write the failing test.** Before writing, open `backend/test/messaging/community-graphql.test.ts:1-75` and copy its yoga/`exec` scaffolding verbatim if it differs from the sketch below (it executes operations through `createYoga`, not raw `graphql()`, to avoid vitest cross-realm schema errors — keep that property).

```ts
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';

const db = getDb();
let yoga: ReturnType<typeof createYoga>;

beforeAll(() => {
  yoga = createYoga({ schema: buildSchema(), context: () => buildContext(db, 'en') });
});
afterAll(async () => {
  await closeDb();
});

const QUERY = /* GraphQL */ `
  query Sampler($seed: Int) {
    homesampler(seed: $seed) {
      seed
      people { slug name }
      places { slug name }
      fax { slug title }
      commentary { id title text }
      contents { slug title }
    }
  }
`;

async function exec(seed?: number) {
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { seed } }),
  });
  const body = (await res.json()) as { data?: { homesampler: never }; errors?: unknown[] };
  if (body.errors?.length) throw new Error(JSON.stringify(body.errors));
  return body.data!.homesampler as {
    seed: number;
    people: { slug: string; name: string | null }[];
    places: { slug: string; name: string | null }[];
    fax: { slug: string; title: string | null } | null;
    commentary: { id: string; title: string | null; text: string | null } | null;
    contents: { slug: string | null; title: string | null } | null;
  };
}

describe('homesampler', () => {
  it('returns a full sampler payload', async () => {
    const s = await exec(12345);
    expect(s.people).toHaveLength(8);
    expect(s.people.every((p) => p.slug)).toBe(true);
    expect(s.places).toHaveLength(5);
    expect(s.fax?.slug).toBeTruthy();
    expect(s.commentary?.id).toBeTruthy();
    expect(s.contents?.slug).toBeTruthy();
    expect(s.seed).toBe(12345);
  });

  it('is deterministic for the same seed', async () => {
    const [a, b] = await Promise.all([exec(777), exec(777)]);
    expect(a.people.map((p) => p.slug)).toEqual(b.people.map((p) => p.slug));
    expect(a.places.map((p) => p.slug)).toEqual(b.places.map((p) => p.slug));
    expect(a.commentary?.id).toBe(b.commentary?.id);
    expect(a.fax?.slug).toBe(b.fax?.slug);
    expect(a.contents?.slug).toBe(b.contents?.slug);
  });

  it('varies across seeds', async () => {
    const [a, b] = await Promise.all([exec(1001), exec(2002)]);
    // 8-of-N seeded picks colliding entirely is astronomically unlikely.
    expect(a.people.map((p) => p.slug)).not.toEqual(b.people.map((p) => p.slug));
  });

  it('generates and echoes a seed when none is given', async () => {
    const s = await exec(undefined);
    expect(Number.isInteger(s.seed)).toBe(true);
    expect(s.seed).toBeGreaterThan(0);
    expect(s.people).toHaveLength(8);
  });

  it('samples only substantive commentary', async () => {
    const s = await exec(4242);
    expect((s.commentary?.text ?? '').length).toBeGreaterThan(500);
  });
});
```

**Step 2: Run it to make sure it fails**

Run: `cd backend && npx vitest run test/graphql/homesampler.test.ts`
Expected: FAIL — `homesampler` resolves to `null` (no resolver), so `body.data.homesampler` is null and assertions throw.

**Step 3: Commit the failing test** (red commit is fine on a feature branch)

```bash
git add test/graphql/homesampler.test.ts
git commit -m "test(backend): failing homesampler contract tests"
```

---

## Task 3: Backend — `homesampler` resolver

**Files:**
- Create: `backend/src/graphql/resolvers/homesampler.ts`
- Modify: `backend/src/graphql/resolvers.ts` (import block ends ~line 31; `mergeResolverMaps(...)` call at ~lines 247-268)

Design notes baked into the code below:
- **Deterministic sampling** uses `ORDER BY MD5(CONCAT(pk, ':', seed))`, not `RAND(seed)` — MySQL's seeded RAND depends on row-scan order; hashing the primary key with the seed is stable regardless of engine/scan order.
- Row shapes must match what the existing type field-resolvers expect as parents: `People` parents are `PeopleRow` (columns as in `allPeople`, `backend/src/data/loaders/peopleplaces.ts:144-154`), `Place` parents are full `bom_places` rows, `Fax` parents come from the existing `faxByFilter` loader, `Commentary` parents are raw `bom_xtras_commentary` rows (`selectAll`, like `commentaryById` in `backend/src/data/loaders/media.ts:76-85`), `Division` parents are `DivisionRow` from `ctx.services.contents.divisions(null)`.
- Samplers live in an extensible map; each failure degrades that field to `null` (missing tile), never a failed query.

**Step 1: Write the resolver**

```ts
/**
 * homesampler — aggregate seeded random samples for the /home sampler page.
 * Design: docs/plans/2026-07-15-home-sampler-redesign-design.md
 *
 * Determinism: ORDER BY MD5(CONCAT(<pk>, ':', <seed>)) — stable for a given
 * seed regardless of storage-engine scan order (unlike seeded RAND()).
 *
 * Extensibility: add a field to schema/HomeSampler.graphql, a sampler here,
 * run codegen — nothing else changes.
 */
import { sql } from 'kysely';
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';

const PEOPLE_COUNT = 8;
const PLACES_COUNT = 5;
const MIN_COMMENTARY_CHARS = 500;
const MIN_PERSON_DESC_CHARS = 40;

/** Seed-keyed deterministic shuffle order for a column. */
const seededOrder = (column: string, seed: number) =>
  sql`MD5(CONCAT(${sql.ref(column)}, ':', ${seed}))`;

/** Deterministic pick from a pre-ordered list. */
const seededPick = <T>(rows: T[], seed: number): T | null =>
  rows.length ? rows[seed % rows.length] : null;

const samplePeople = (ctx: AppContext, seed: number) =>
  ctx.db
    .selectFrom('bom_people')
    .select([
      'slug', 'guid', 'name', 'title', 'classification', 'identification',
      'unit', 'date', 'description', 'weight',
    ])
    .where('description', 'is not', null)
    .where(sql<boolean>`CHAR_LENGTH(description) > ${MIN_PERSON_DESC_CHARS}`)
    .orderBy(seededOrder('slug', seed))
    .limit(PEOPLE_COUNT)
    .execute();

const samplePlaces = (ctx: AppContext, seed: number) =>
  ctx.db
    .selectFrom('bom_places')
    .selectAll()
    .where('name', 'is not', null)
    .orderBy(seededOrder('slug', seed))
    .limit(PLACES_COUNT)
    .execute();

const sampleFax = async (ctx: AppContext, seed: number) => {
  // Reuse the loader (lang fallback + translation tagging handled there).
  const rows = await ctx.loaders.faxByFilter.load('');
  return seededPick(rows.filter((r) => !r.hide), seed);
};

const sampleCommentary = async (ctx: AppContext, seed: number) => {
  const rows = await ctx.db
    .selectFrom('bom_xtras_commentary')
    .selectAll()
    .where('length', '>', MIN_COMMENTARY_CHARS)
    .orderBy(seededOrder('id', seed))
    .limit(1)
    .execute();
  return rows[0] ?? null;
};

const sampleContents = async (ctx: AppContext, seed: number) => {
  const divisions = await ctx.services.contents.divisions(null);
  return seededPick(divisions, seed);
};

/** One entry per HomeSampler field. Add future tile types here. */
const samplers: Record<string, (ctx: AppContext, seed: number) => Promise<unknown>> = {
  people: samplePeople,
  places: samplePlaces,
  fax: sampleFax,
  commentary: sampleCommentary,
  contents: sampleContents,
};

export const homesamplerResolvers: Resolvers = {
  Query: {
    homesampler: async (_root, args, ctx: AppContext) => {
      const argSeed = args.seed as number | null | undefined;
      const seed =
        typeof argSeed === 'number' && Number.isInteger(argSeed) && argSeed > 0
          ? argSeed
          : Math.floor(Math.random() * 2 ** 31) + 1;

      const entries = await Promise.all(
        Object.entries(samplers).map(async ([key, fn]) => {
          try {
            return [key, await fn(ctx, seed)] as const;
          } catch (error) {
            console.error(`homesampler ${key} error:`, error);
            return [key, null] as const;
          }
        }),
      );

      return { seed, ...Object.fromEntries(entries) } as never;
    },
  },
};
```

**Step 2: Register it.** In `backend/src/graphql/resolvers.ts`, add to the import block:

```ts
import { homesamplerResolvers } from './resolvers/homesampler.js';
```

and add `homesamplerResolvers,` to the `mergeResolverMaps(...)` argument list (after `communityResolvers,`).

**Step 3: Typecheck, then run the tests**

Run: `npm run typecheck && npx vitest run test/graphql/homesampler.test.ts`
Expected: typecheck 0; all 5 tests PASS. If a column name trips typecheck (e.g. `bom_places.name` nullability), check `backend/codegen/db.d.ts` for the actual column and adjust the where-clause — do not regenerate db types.

**Step 4: Full backend suite — no regressions**

Run: `npx vitest run`
Expected: 249 + 5 passing; only the 7 known-failing files above still fail.

**Step 5: Commit**

```bash
git add src/graphql/resolvers/homesampler.ts src/graphql/resolvers.ts
git commit -m "feat(backend): homesampler aggregate resolver with seeded sampler map"
```

---

## Task 4: Frontend — declare the `homesampler` client query

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js` (the `queries` object starts at line 5; put the new entry next to `homegroups` at ~line 1616)

**Step 1: Add the query builder** (single-input pattern like `homegroups`; `val: false` singleton → consumed as `results.homesampler[0]`):

```js
homesampler: (input) => {
  input = input.shift() || {};
  const seed = parseInt(input.seed, 10);
  const seedArg = seed > 0 ? `(seed: ${seed})` : "";
  return {
    type: "homesampler",
    key: "token",
    val: false,
    query: `homesampler${seedArg} {
      seed
      people { slug name title }
      places { slug name info }
      fax { slug title pages info }
      commentary { id title text preview publication { source_title } }
      contents { slug title description }
    }`,
  };
},
```

**Step 2: Sanity-run the frontend test suite** (nothing imports this yet; just confirms no syntax error)

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern=contexts`
Expected: existing context tests pass.

**Step 3: Commit**

```bash
git add src/models/GraphQLQueries.js
git commit -m "feat(frontend): declare homesampler client query"
```

---

## Task 5: Frontend — move the community view to `Community.js`

**Files:**
- Rename: `frontend/webapp/src/views/Home/Home.js` → `frontend/webapp/src/views/Home/Community.js`
- Modify: `frontend/webapp/src/views/Home/Community.js`, `frontend/webapp/src/views/Home/Feed.js`, `frontend/webapp/src/views/_Common/Group.js:6`, `frontend/webapp/src/views/_Common/Drawer.js:18`, `frontend/webapp/src/models/Routes.js:26`

**Step 1: Rename the file**

```bash
cd frontend/webapp && git mv src/views/Home/Home.js src/views/Home/Community.js
```

**Step 2: Edit `Community.js`:**
1. Rename `function Home()` (line 66) → `function Community()` and the default export (line 663) → `export default Community;`.
2. The URL-base gate (lines 69-82): change both occurrences of `base === "home"` to `base === "community"`.
3. `GroupCard`'s link (line 375): `<Link to={`/home/${groupData.url}`}>` → `<Link to={`/community/${groupData.url}`}>`.
4. Document title (line 84): `document.title = label("home_title")` → `document.title = label("community")` (existing key, used at line 149).

**Step 3: Update every importer.** Find them:

```bash
grep -rn "Home/Home\|from \"./Home\"\|from './Home'" src/
```

Expected hits — update each to point at `Community`:
- `src/models/Routes.js:26` — leave for Task 6 (route rewiring) but update the path now: `const Home = lazy(() => import("../views/Home/Community.js"));`
- `src/views/_Common/Group.js:6`
- `src/views/_Common/Drawer.js:18` (imports `GroupLeaderBoard`)
- `src/views/Home/Feed.js` (imports `GroupCallToAction`/`groupToolTipHtml` from `./Home`)

**Step 4: Verify nothing still resolves the old module**

Run: `grep -rn "Home/Home" src/ ; CI=true npx react-scripts test --watchAll=false --testPathPattern=contexts`
Expected: no grep hits; tests pass.

**Step 5: Commit**

```bash
git add -A src/
git commit -m "refactor(frontend): move community view Home.js -> Community.js, base /community"
```

---

## Task 6: Frontend — routes: `/home` sampler, `/community`, redirects

**Files:**
- Modify: `frontend/webapp/src/models/Routes.js` (lazy imports lines 13-39; `/home` routes at lines 49-63; `Redirect` already imported at line 4)

**Step 1: Add imports and redirect component.** Near the top (after line 10's `DisabledRedirect`):

```js
const Sampler = lazy(() => import("../views/Home/Sampler.js"));
const Community = lazy(() => import("../views/Home/Community.js"));

// Param-preserving redirect for legacy /home/:channelId(/:messageId) deep links.
const HomeChannelRedirect = () => {
  const { channelId, messageId } = useParams();
  return <Redirect to={`/community/${channelId}${messageId ? `/${messageId}` : ""}`} />;
};
```

`useParams` must be added to the existing `react-router-dom` import (line 4). Rename the old `const Home = lazy(...)` (line 26, pointing at `Community.js` since Task 5) to `Community` and delete the duplicate if Step 1 created one.

**Step 2: Replace the `/home` route block (lines 49-63) with:**

```js
{
  // /home — the sampler explore page (design: docs/plans/2026-07-15-home-sampler-redesign-design.md)
  exact: true,
  path: "/home",
  component: Sampler,
},
{
  path: "/home/:channelId/:messageId(\\d+)",
  component: HomeChannelRedirect,
},
{
  path: "/home/:channelId",
  component: HomeChannelRedirect,
},
{
  exact: true,
  path: "/community",
  component: Community,
},
{
  path: "/community/:channelId/:messageId(\\d+)",
  component: Community,
},
{
  path: "/community/:channelId",
  component: Community,
},
```

**Step 3: Create a placeholder `frontend/webapp/src/views/Home/Sampler.js`** so the app compiles before Task 7:

```js
import React from "react";
export default function Sampler() {
  return <div className="sampler container" />;
}
```

**Step 4: Verify compile**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=Read`
Expected: the Read route-view test still passes (it mounts the router).

**Step 5: Commit**

```bash
git add src/models/Routes.js src/views/Home/Sampler.js
git commit -m "feat(frontend): route /home to sampler, community to /community with redirects"
```

---

## Task 7: Frontend — tile registry + Sampler shell (TDD)

**Files:**
- Create: `frontend/webapp/src/views/Home/__tests__/Sampler.test.js`
- Create: `frontend/webapp/src/views/Home/tiles/registry.js`
- Replace: `frontend/webapp/src/views/Home/Sampler.js`
- Create: `frontend/webapp/src/views/Home/Sampler.css`, `frontend/webapp/src/views/Home/Sampler.m.css`

**Step 1: Write the failing tests.** Before writing, open `src/views/Read/__tests__/Read.test.js` and mirror its provider/router scaffolding (it wraps `AppControllerProvider` + `MemoryRouter`; copy how it builds the fake `appController`). Test skeleton:

```js
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import Sampler from "../Sampler";
import { tileRegistry } from "../tiles/registry";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

const payloadFixture = {
  homesampler: [{
    seed: 42,
    people: [{ slug: "nephi", name: "Nephi", title: "Prophet" }],
    places: [{ slug: "zarahemla", name: "Zarahemla", info: null }],
    fax: { slug: "1830", title: "1830 Edition", pages: 590, info: null },
    commentary: { id: "77", title: "On Faith", text: "x".repeat(600), preview: "…", publication: { source_title: "Journal" } },
    contents: { slug: "1-nephi", title: "First Nephi", description: "The record of Nephi" },
  }],
  homegroups: [{ url: "g1", name: "Group One", picture: "", members: [], latest: { id: 9, timestamp: 1e12, msg: "hello", user: { nickname: "Sam", picture: "" } } }],
  leaderboard: [{ currentProgress: [{ nickname: "Sam", picture: "", progress: 50 }], recentFinishers: [] }],
};

// Minimal appController — mirror Read.test.js's fake, ensuring
// states.user = { token: null, user: null } and states.studyGroup.groupList = [].

describe("tile registry contract", () => {
  it("every entry has key, component, span class, and isReady", () => {
    for (const t of tileRegistry) {
      expect(typeof t.key).toBe("string");
      expect(typeof t.component).toBe("function");
      expect(typeof t.span).toBe("string");
      expect(typeof t.isReady).toBe("function");
    }
  });
  it("isReady is false on an empty payload for data tiles", () => {
    for (const t of tileRegistry.filter((t) => t.key !== "readingplan")) {
      expect(t.isReady({})).toBeFalsy();
    }
  });
});

describe("Sampler shell", () => {
  it("renders one tile per ready registry entry and skips missing data", async () => {
    BoMOnlineAPI.mockResolvedValue(payloadFixture);
    render(/* Sampler wrapped in providers + MemoryRouter */);
    await waitFor(() => expect(screen.getByText("Nephi")).toBeInTheDocument());
    expect(screen.getByText("Zarahemla")).toBeInTheDocument();
    expect(document.querySelectorAll(".tile:not(.skeleton)").length).toBeGreaterThanOrEqual(6);
  });
  it("hides a tile whose payload slice is null", async () => {
    const noFax = JSON.parse(JSON.stringify(payloadFixture));
    noFax.homesampler[0].fax = null;
    BoMOnlineAPI.mockResolvedValue(noFax);
    render(/* wrapped */);
    await waitFor(() => expect(screen.getByText("Nephi")).toBeInTheDocument());
    expect(document.querySelector(".tile-fax")).toBeNull();
  });
  it("shows skeletons while loading", () => {
    BoMOnlineAPI.mockReturnValue(new Promise(() => {}));
    render(/* wrapped */);
    expect(document.querySelectorAll(".tile.skeleton").length).toBe(tileRegistry.length);
  });
});
```

**Step 2: Run to verify failure**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=Sampler`
Expected: FAIL — `../tiles/registry` doesn't exist.

**Step 3: Implement `tiles/registry.js`** (tile components arrive in Task 8; import them now, create them as trivial stubs `export default () => null;` in this task so the registry loads):

```js
import PeopleTile from "./PeopleTile";
import PlacesTile from "./PlacesTile";
import FaxTile from "./FaxTile";
import CommentaryTile from "./CommentaryTile";
import ContentsTile from "./ContentsTile";
import ReadingPlanTile from "./ReadingPlanTile";
import SpotlightTile from "./SpotlightTile";
import ActivityTile from "./ActivityTile";

/**
 * Sampler tile registry. Adding a tile type:
 *   1. backend: field on HomeSampler + sampler fn (see homesampler.ts)
 *   2. add the field to the homesampler query in GraphQLQueries.js
 *   3. write a tile component in this directory
 *   4. append an entry here — key must match the payload field
 * span is a CSS class in Sampler.css controlling the grid footprint.
 */
export const tileRegistry = [
  { key: "people",      component: PeopleTile,      span: "tile-people",      isReady: (p) => p?.people?.length > 0 },
  { key: "places",      component: PlacesTile,      span: "tile-places",      isReady: (p) => p?.places?.length > 0 },
  { key: "readingplan", component: ReadingPlanTile, span: "tile-readingplan", isReady: () => true },
  { key: "fax",         component: FaxTile,         span: "tile-fax",         isReady: (p) => !!p?.fax },
  { key: "commentary",  component: CommentaryTile,  span: "tile-commentary",  isReady: (p) => !!p?.commentary },
  { key: "contents",    component: ContentsTile,    span: "tile-contents",    isReady: (p) => !!p?.contents },
  { key: "spotlight",   component: SpotlightTile,   span: "tile-spotlight",   isReady: (p) => !!p?.spotlight },
  { key: "activity",    component: ActivityTile,    span: "tile-activity",    isReady: (p) => !!p?.activity },
];
```

**Step 4: Implement the shell `Sampler.js`:**

```js
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import { tileRegistry } from "./tiles/registry";
import "./Sampler.css";
import "./Sampler.m.css";

/** Session-stable seed: same page on refresh/back, new sample next session. */
const getSessionSeed = () => {
  let seed = parseInt(sessionStorage.getItem("samplerSeed"), 10);
  if (!(seed > 0)) {
    seed = Math.floor(Math.random() * 2 ** 31) + 1;
    sessionStorage.setItem("samplerSeed", String(seed));
  }
  return seed;
};

/** Merge the compound API response into one payload keyed by registry tile key. */
export const assemblePayload = (r) => {
  const sampler = r?.homesampler?.[0] || {};
  const groups = r?.homegroups || [];
  const board = r?.leaderboard?.[0] || {};
  const latestGroup = groups
    .filter((g) => g?.latest?.timestamp)
    .sort((a, b) => b.latest.timestamp - a.latest.timestamp)[0];
  const flavors = [
    groups.length && { flavor: "group", group: groups[Math.floor(Math.random() * groups.length)] },
    board.recentFinishers?.length && { flavor: "finishers", users: board.recentFinishers },
    board.currentProgress?.length && { flavor: "leaders", users: board.currentProgress },
  ].filter(Boolean);
  return {
    ...sampler,
    activity: latestGroup ? { ...latestGroup.latest, channel: latestGroup.url } : null,
    spotlight: flavors.length ? flavors[Math.floor(Math.random() * flavors.length)] : null,
  };
};

export default function Sampler() {
  const appController = useAppController();
  const token = appController.states.user.token;
  const [payload, setPayload] = useState(null);
  const [failed, setFailed] = useState(false);
  const seed = getSessionSeed();

  useEffect(() => {
    document.title = label("home_title");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = (attempt) =>
      BoMOnlineAPI(
        { homesampler: { seed }, homegroups: { token }, leaderboard: { token } },
        { useCache: false },
      )
        .then((r) => !cancelled && setPayload(assemblePayload(r)))
        .catch(() => {
          if (cancelled) return;
          if (attempt < 1) load(attempt + 1);
          else setFailed(true);
        });
    load(0);
    return () => {
      cancelled = true;
    };
  }, [token, seed]);

  if (failed) return <SamplerFallback />;

  return (
    <div className="sampler container">
      <div className="samplerGrid">
        {tileRegistry.map(({ key, component: Tile, span, isReady }) => {
          if (!payload) return <div key={key} className={`tile skeleton ${span}`} />;
          if (!isReady(payload)) return null;
          return (
            <div key={key} className={`tile ${span}`}>
              <Tile data={payload[key]} seed={payload.seed} />
            </div>
          );
        })}
      </div>
      <SamplerFooter />
    </div>
  );
}

/** Static nav rail — the page's bounded "pick your path" ending. */
export function SamplerFooter() {
  const links = [
    ["contents", "/contents"],
    ["people", "/people"],
    ["places", "/places"],
    ["community", "/community"],
    ["search", "/search"],
  ];
  return (
    <div className="samplerFooter noselect">
      {links.map(([key, to]) => (
        <Link key={key} to={to} className="samplerFooterLink">
          {label(key)}
        </Link>
      ))}
    </div>
  );
}

/** Whole-query failure: never render a blank homepage. */
function SamplerFallback() {
  return (
    <div className="sampler container">
      <div className="samplerFallback">
        <SamplerFooter />
      </div>
    </div>
  );
}
```

**Step 5: Create tile component stubs** (`tiles/PeopleTile.js` … `tiles/ActivityTile.js`, 8 files):

```js
export default function PeopleTile() {
  return null;
}
```

(Real markup in Task 8 — but note tests asserting "Nephi"/"Zarahemla" text will still fail with stubs.)

**Step 6: Implement `PeopleTile` and `PlacesTile` for real now** (they're asserted in the shell test — see Task 8 Step 1-2 for their code; implement those two here).

**Step 7: Write minimal `Sampler.css` / `Sampler.m.css`** (full styling pass is Task 9; enough now for structure):

```css
/* Sampler.css — bento grid for /home. Dark mode via body.dark overrides. */
.sampler.container { padding: 1rem 0 3rem; }
.samplerGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}
.tile {
  border-radius: 0.75rem;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
body.dark .tile { background: #2a2a2a; }
.tile.skeleton { min-height: 10rem; animation: samplerShimmer 1.2s infinite; background: #eee; }
body.dark .tile.skeleton { background: #333; }
@keyframes samplerShimmer { 50% { opacity: 0.5; } }
.tile-people { grid-column: span 4; }
.tile-places { grid-column: span 4; }
.tile-readingplan { grid-column: span 2; }
.tile-fax { grid-column: span 2; }
.tile-commentary { grid-column: span 2; }
.tile-contents { grid-column: span 2; }
.tile-spotlight { grid-column: span 2; }
.tile-activity { grid-column: span 2; }
.samplerFooter { display: flex; gap: 1rem; justify-content: center; margin-top: 2rem; flex-wrap: wrap; }
```

```css
/* Sampler.m.css — mobile overrides; 900px is the app's established breakpoint. */
@media only screen and (max-width: 900px) {
  .samplerGrid { grid-template-columns: 1fr; }
  .samplerGrid .tile { grid-column: span 1 !important; }
}
```

**Step 8: Run the tests until green**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern=Sampler`
Expected: PASS (registry contract + shell rendering + skeleton + hidden-tile tests).

**Step 9: Commit**

```bash
git add src/views/Home/Sampler.js src/views/Home/Sampler.css src/views/Home/Sampler.m.css src/views/Home/tiles/ src/views/Home/__tests__/Sampler.test.js
git commit -m "feat(frontend): sampler shell, tile registry, skeleton/fallback states"
```

---

## Task 8: Frontend — the eight tile components

**Files:** replace the stubs in `frontend/webapp/src/views/Home/tiles/` one component per step; commit after each runs green (`--testPathPattern=Sampler` plus eyeballing where noted).

Shared conventions: each tile receives `{ data, seed }`; images come from `assetUrl` (`import { assetUrl } from "src/models/BoMOnlineAPI"`); every visible string goes through `label()` (key inventory in Task 10); links use `react-router-dom`'s `Link`.

**Step 1: `PeopleTile.js`** (hero — grid of portraits):

```js
import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";

export default function PeopleTile({ data }) {
  return (
    <div className="samplerTileInner peopleTile">
      <h3 className="tileHeading">
        <Link to="/people">{label("people")}</Link>
      </h3>
      <div className="peopleTileGrid">
        {data.map((p) => (
          <Link to={`/people/${p.slug}`} key={p.slug} className="peopleTileCard">
            <img
              src={`${assetUrl}/people/${p.slug}`}
              alt={p.name || ""}
              loading="lazy"
              onError={(e) => (e.target.style.visibility = "hidden")}
            />
            <div className="peopleTileName">{p.name}</div>
            {p.title ? <div className="peopleTileTitle">{p.title}</div> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: `PlacesTile.js`** (horizontal strip):

```js
import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";

export default function PlacesTile({ data }) {
  return (
    <div className="samplerTileInner placesTile">
      <h3 className="tileHeading">
        <Link to="/places">{label("places")}</Link>
      </h3>
      <div className="placesTileStrip">
        {data.map((p) => (
          <Link to={`/places/${p.slug}`} key={p.slug} className="placesTileCard">
            <img
              src={`${assetUrl}/places/${p.slug}`}
              alt={p.name || ""}
              loading="lazy"
              onError={(e) => (e.target.style.visibility = "hidden")}
            />
            <div className="placesTileName">{p.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: `FaxTile.js`.** Before writing, check `src/views/Facsimiles/Facsimiles.js:47` for the exact page-thumbnail URL convention (`${assetUrl}/fax/pages/${slug}/…`) and reuse it; link to `/fax/${data.slug}` (note: the route is `/fax`, not `/facsimiles` — Routes.js:96-107):

```js
import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
// import the thumbnail URL convention verified from Facsimiles.js:47

export default function FaxTile({ data }) {
  return (
    <Link to={`/fax/${data.slug}`} className="samplerTileInner faxTile">
      <h3 className="tileHeading">{label("facsimiles")}</h3>
      {/* thumbnail img per Facsimiles.js convention */}
      <div className="faxTileTitle">{data.title}</div>
      {data.pages ? <div className="faxTileMeta">{data.pages} pp.</div> : null}
    </Link>
  );
}
```

**Step 4: `CommentaryTile.js`** (excerpt ~40 words; strip HTML like `Community.js`'s `groupMessage` does with `.replace(/<[^>]*>/gi, "")`):

```js
import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";

const excerpt = (c, words = 40) =>
  (c.preview || c.text || "")
    .replace(/<[^>]*>/gi, "")
    .split(/\s+/)
    .slice(0, words)
    .join(" ") + "…";

export default function CommentaryTile({ data }) {
  return (
    <Link to={`/commentary/${data.id}`} className="samplerTileInner commentaryTile">
      <h3 className="tileHeading">{label("commentary")}</h3>
      <div className="commentaryTileTitle">{data.title}</div>
      <p className="commentaryTileExcerpt">{excerpt(data)}</p>
      {data.publication?.source_title ? (
        <div className="commentaryTileSource">— {data.publication.source_title}</div>
      ) : null}
    </Link>
  );
}
```

**Step 5: `ContentsTile.js`** (division outline teaser; cover image convention from `Contents.js:55` is `${assetUrl}/home/${slug}-1`):

```js
import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";

export default function ContentsTile({ data }) {
  return (
    <Link to="/contents" className="samplerTileInner contentsTile">
      <h3 className="tileHeading">{label("contents")}</h3>
      <img src={`${assetUrl}/home/${data.slug}-1`} alt="" loading="lazy"
        onError={(e) => (e.target.style.display = "none")} />
      <div className="contentsTileTitle">{data.title}</div>
      {data.description ? <p className="contentsTileDesc">{data.description}</p> : null}
    </Link>
  );
}
```

**Step 6: `ReadingPlanTile.js`** (signed-in: the existing widget; signed-out: sign-in prompt — the tile doubles as the sign-in entry point, per design):

```js
import React from "react";
import { Link } from "react-router-dom";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import { ReadingPlan } from "../ReadingPlan";
import login from "../login.svg";

export default function ReadingPlanTile() {
  const appController = useAppController();
  if (!appController.states.user.user) {
    return (
      <Link to="/user/signin" className="samplerTileInner signinTile">
        <img src={login} alt="" />
        <div>{label("sign_in")}</div>
      </Link>
    );
  }
  return (
    <div className="samplerTileInner readingPlanTile">
      <ReadingPlan slug={"cfm2024"} />
    </div>
  );
}
```

**Step 7: `SpotlightTile.js`** (rotating flavor assembled by `assemblePayload`):

```js
import React from "react";
import { Link } from "react-router-dom";
import { label, breakCache } from "src/models/Utils";

export default function SpotlightTile({ data }) {
  return (
    <Link to="/community" className="samplerTileInner spotlightTile">
      <h3 className="tileHeading">{label("community")}</h3>
      {data.flavor === "group" ? (
        <div className="spotlightGroup">
          <img src={data.group.picture} alt="" onError={breakCache} />
          <div className="spotlightGroupName">{data.group.name}</div>
          <div className="spotlightGroupMeta">
            {(data.group.members || []).length} {label("members")}
          </div>
        </div>
      ) : (
        <div className="spotlightUsers">
          <h4>{label(data.flavor === "finishers" ? "recent_finishers" : "leader_board")}</h4>
          {data.users.slice(0, 5).map((u, i) => (
            <div key={i} className="spotlightUser">
              <img src={u.picture} alt="" onError={breakCache} />
              <span>{u.nickname}</span>
              {u.progress != null && <span className="spotlightProgress">{u.progress}%</span>}
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}
```

**Step 8: `ActivityTile.js`** (deep-links into the community feed):

```js
import React from "react";
import { Link } from "react-router-dom";
import { label, breakCache, timeAgoString } from "src/models/Utils";

export default function ActivityTile({ data }) {
  const text = (data.msg || "").replace(/<[^>]*>/gi, "").replace(/^•$/, label("highlight_msg"));
  return (
    <Link to={`/community/${data.channel}/${data.id}`} className="samplerTileInner activityTile">
      <h3 className="tileHeading">{label("latest_activity")}</h3>
      <div className="activityTileMsg">
        <img src={data.user?.picture} alt="" onError={breakCache} />
        <div>
          <div className="activityTileUser">
            {data.user?.nickname}
            <span className="activityTileTime">{timeAgoString(data.timestamp)}</span>
          </div>
          <p>{text}</p>
        </div>
      </div>
    </Link>
  );
}
```

Check `timeAgoString`'s expected unit (`src/models/Utils.js`) — `Community.js` passes `lastseen` values to it; match whether `latest.timestamp` is ms or s before dividing.

**Step 9: Run all Sampler tests + full frontend suite**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: everything green.

**Step 10: Commit**

```bash
git add src/views/Home/tiles/
git commit -m "feat(frontend): implement the eight sampler tiles"
```

---

## Task 9: Frontend — styling pass (bento grid, dark mode, mobile)

**Files:**
- Modify: `frontend/webapp/src/views/Home/Sampler.css`, `Sampler.m.css`

**Step 1: Flesh out `Sampler.css`:** people grid (`.peopleTileGrid { display:grid; grid-template-columns: repeat(4, 1fr); }` desktop → 8 portraits as 4×2), places strip (`.placesTileStrip { display:flex; overflow-x:auto; }`), tile inner padding/typography, `body.dark` overrides for every text/background pair, hover states (`transform: translateY(-2px)` + shadow). Keep heading style consistent with `.Community .card-header h3` in `Home.css`.

**Step 2: Verify visually.** Start both dev servers (backend `PORT=5005 npm run dev`, frontend `npm start`), then screenshot `http://localhost:8200/home` (NOT bom.kckern.net — CDN caching) in default and dark themes, desktop and a ~400px viewport. The page must end at the footer rail — no infinite scroll.

**Step 3: Commit**

```bash
git add src/views/Home/Sampler.css src/views/Home/Sampler.m.css
git commit -m "style(frontend): sampler bento grid, dark mode, mobile layout"
```

---

## Task 10: Menu, nav, and label keys

**Files:**
- Modify: `frontend/webapp/src/views/_Common/menuConfig.js` (home entry at lines 18-22), `frontend/webapp/src/views/_Common/Sidebar.js` (svg imports ~line 15+, `iconMap` ~line 53)
- Create: `docs/reference/sampler-label-keys.md`

**Step 1: menuConfig.** Remove `requiresMessenger: true` from the `home` entry (the sampler is for everyone). Add below it:

```js
{ slug: "community", labelKey: "community", requiresMessenger: true },
```

**Step 2: Sidebar icon.** Add to the svg imports `import community from "../Home/community.svg";` (the icon already exists in `views/Home/`) and add `community,` to the `iconMap`. Mirror the exact import style of the neighboring icons.

**Step 3: Audit hardcoded `/home` refs** — `Header.js:37` (logo), `BottomNav.js:75`, `Sidebar.js:174` all still point at `/home`, which is now the sampler: correct, leave them. Confirm nothing else deep-links to `/home/<channel>`:

```bash
grep -rn '"/home/' src/ | grep -v views/Home/
```

Any hit outside test fixtures must be changed to `/community/`.

**Step 4: Label-key inventory.** The dictionary comes from the DB (`labels` GraphQL query); missing keys render as the raw key. Verify which keys the tiles use already exist:

```bash
curl -s http://localhost:5005/en -H 'content-type: application/json' \
  -d '{"query":"{labels{key val}}"}' | \
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const keys=JSON.parse(d).data.labels.map(l=>l.key);for(const k of ['people','places','commentary','contents','facsimiles','community','members','latest_activity','sign_in','recent_finishers','leader_board','highlight_msg','home_title','search']) console.log(k, keys.includes(k))})"
```

For each `false`, either switch the tile to an existing key (check the dump for near-matches like `menu_people`) or list it in `docs/reference/sampler-label-keys.md` with its English value, formatted as a table KC can insert with writable credentials (the dev DB user is read-only — do NOT attempt inserts). Raw-key fallback is acceptable interim behavior.

**Step 5: Run the full frontend suite, commit**

```bash
CI=true npx react-scripts test --watchAll=false
git add src/views/_Common/menuConfig.js src/views/_Common/Sidebar.js ../../docs/reference/sampler-label-keys.md
git commit -m "feat(frontend): menu entries for sampler home and community; label-key inventory"
```

---

## Task 11: E2E — route-walk update + sampler smoke

**Files:**
- Modify: `e2e/route-walk.spec.js` (the `ROUTES` array has `{ name: 'study feed (/home)', path: '/home', login: true }`)
- Create: `e2e/sampler.spec.js`

E2E needs live servers (`E2E_BASE_URL`, default `http://localhost:8200`). If servers can't run in your environment, still write the specs, run what you can, and report what was skipped.

**Step 1: Update `route-walk.spec.js`:** rename the `/home` entry to `sampler (/home)` (drop `login: true` if the walker supports anonymous routes — read the file header first), and add `{ name: 'community (/community)', path: '/community', login: true }`.

**Step 2: Write `e2e/sampler.spec.js`** (mirror `e2e/smoke.spec.js`'s use of `./fixtures`):

```js
const { test, expect } = require("./fixtures");

test("sampler renders a bounded tile grid", async ({ instrumentedPage: page }) => {
  await page.goto("/home");
  await page.waitForSelector(".samplerGrid .tile:not(.skeleton)", { timeout: 15000 });
  const tiles = await page.locator(".samplerGrid .tile:not(.skeleton)").count();
  expect(tiles).toBeGreaterThanOrEqual(6);
  await expect(page.locator(".samplerFooter")).toBeVisible();
});

test("legacy /home/:channelId deep links redirect to /community", async ({ instrumentedPage: page }) => {
  await page.goto("/home/some-legacy-channel");
  await page.waitForURL(/\/community\/some-legacy-channel/, { timeout: 15000 });
});

test("people tile navigates to a person page", async ({ instrumentedPage: page }) => {
  await page.goto("/home");
  await page.waitForSelector(".peopleTileCard", { timeout: 15000 });
  await page.locator(".peopleTileCard").first().click();
  await page.waitForURL(/\/people\/.+/, { timeout: 15000 });
});
```

**Step 3: Run** (with both dev servers up): `cd e2e && npx playwright test sampler route-walk`
Expected: sampler specs pass; route-walk passes for the updated entries.

**Step 4: Commit**

```bash
git add e2e/route-walk.spec.js e2e/sampler.spec.js
git commit -m "test(e2e): sampler smoke + community redirect coverage"
```

---

## Task 12: Full verification sweep

**Step 1: Backend:** `cd backend && npm run typecheck && npx vitest run` — expect 254+ passing, only the 7 known-environmental file failures.

**Step 2: Frontend:** `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false` — all green.

**Step 3: Manual walkthrough** (both dev servers up, screenshot each): `/home` signed-out (sign-in tile present, no blank grid), `/home` signed-in, refresh `/home` twice (same sample — session seed), new incognito session (different sample), `/community` (full community view, groups clickable), `/home/<real-channel-url>` redirects, dark mode, ~400px viewport.

**Step 4: Update the design doc.** Append to the decisions log in `docs/plans/2026-07-15-home-sampler-redesign-design.md`:

```
- Implementation refinement: spotlight/activity/readingplan assembled client-side from existing
  homegroups/leaderboard queries batched into the same single POST; HomeSampler carries only the
  seeded content samples. (implementation, 2026-07-15)
```

**Step 5: Final commit + report.** Commit any stragglers, then summarize for KC: what shipped, test counts, the label keys that need DB inserts (from Task 10), and that merging to `dev` + restarting `bom-dev` is KC's call (restart bounces the public dev URL — coordinate first).
