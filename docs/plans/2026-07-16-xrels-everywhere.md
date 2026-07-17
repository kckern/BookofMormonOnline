# Xrels Everywhere Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend cross-entity relationships (bom_xrels) to every surface that can carry them: a Group entity (fixing 446 dead-end rows), relationships-in-this-passage in the Read view, mobile drawer parity, and person/place/group hubs in the home sampler's RelationshipsTile.

**Architecture:** All four features ride the loaders shipped in `84b220a4` (People/Place xrels). Groups become a synthesized GraphQL entity (no table exists — name is de-slugged, content is reverse xrels via a type-widened `xrelsByDstEntity`). Passage relationships get a module-scope verse→xrels index built from note-parsed scripture refs. The sampler's hub pool gains reverse-direction (destination-side) hubs with a `reverse` flag so the tile can flip name/verb order. Mobile drawers reuse the existing `XrelSection` component.

**Tech Stack:** Backend: Fastify + graphql-yoga, Kysely/MySQL (read-only `reader` user), vitest contract tests against the live DB, graphql-codegen. Frontend: React 17 (CRA 5 / react-app-rewired), jest + @testing-library/react.

---

## Context you must know before starting

Read these first:
- `docs/plans/2026-07-16-bible-cross-reference-overhaul.md` — the working conventions this plan inherits (worktree isolation, test commands, merge/push procedure).
- `backend/src/data/loaders/peopleplaces.ts` — `xrelsByDstEntity`, the reverse-direction loader you'll widen.
- `backend/src/data/loaders/objects.ts` — `XrelRow`, `sortXrels`, `parseVerseIdFromNote` (all exported).
- `frontend/webapp/src/views/_Common/XrelSection.js` — the shared popup relationships component.
- `backend/src/graphql/resolvers/homesampler.ts:254-330` — `entityNames` + `sampleRelationship` (the tile's hub sampler).

**Verified data facts (probed live 2026-07-16 — trust these over intuition):**
- Every `bom_xrels` row has `src_type='object'` (2,868 rows). Destinations: people 1,447 · object 754 · **group 446** · place 221.
- **There is no groups table.** 79 distinct group slugs (`nephites` ×124, `jaredites` ×55, `lamanites` ×54, …) exist *only* as `bom_xrels.dst_slug` values. `bom_people.unit` is single-letter codes (I/G/S/O/C) — you can NOT derive group membership from it. `bom_index` has no `group` rows and `bom_markdown` has no group entries. A Group entity is therefore: de-slugged name + reverse xrels. Nothing more — do not invent members.
- `parseVerseIdFromNote` extracts a verse anchor from note strings like `"Slew Amalickiah on Christmas Eve (Alma 51:34)"`; not every note has one.
- The mobile `Drawer.js` has its own `Person`/`Place` components that do NOT render xrels (the July 16 popup work only touched `PopUp.js`), and has no `object` or `group` branch at all.
- The Names view needs **no work**: it opens the shared person/place popups (`Names.js:243`), which already show xrels.
- Timeline events are **out of scope**: `bom_timeline` has zero xrel rows; that's data authoring, not code.

**Environment:**
- Backend contract tests hit the live DB via `backend/.env` (read-only). `test/readingplan/mutations.test.ts` fails on this laptop (needs DELETE) — pre-existing, ignore it; every other suite must pass.
- The repo's main working tree belongs to another active session — **never work in it**. Worktree only.
- Push over SSH (`git@github.com:kckern/BookofMormonOnline.git`) — the HTTPS credential path is broken on this machine.

Shorthand used below:
```bash
# FE tests (run from <worktree>/frontend/webapp)
CI=true npx react-scripts test --watchAll=false --testPathPattern="<pattern>"
# BE tests (run from <worktree>/backend)
npx vitest run test/graphql/<file>.test.ts
```

---

## Phase 0 — Workspace

### Task 0: Worktree from fresh dev

**Step 1:** From the repo root (`/Users/kckern/Documents/GitHub/BookofMormonOnline`):
```bash
git fetch origin dev
git worktree add .worktrees/xrels-everywhere -b feature/xrels-everywhere origin/dev
```
**Step 2:** Install deps. Backend needs a real install (vite resolves through symlinks and breaks); frontend tolerates a symlink:
```bash
cp backend/.env .worktrees/xrels-everywhere/backend/.env
cd .worktrees/xrels-everywhere/backend && npm ci --no-audit --no-fund
ln -s /Users/kckern/Documents/GitHub/BookofMormonOnline/frontend/webapp/node_modules \
      ../frontend/webapp/node_modules
```
**Step 3:** Copy this plan into the worktree (`docs/plans/2026-07-16-xrels-everywhere.md`) so it ships with the branch.
**Step 4:** Baselines: `npx vitest run test/graphql/xrels-people-places.test.ts` (4 pass) and, from `frontend/webapp`, the full jest suite (all pass). Commit nothing yet.

---

## Phase A — Group entity (fixes 446 dead-end rows)

### Task A1: Widen the reverse loader to groups

**Files:**
- Modify: `backend/src/data/loaders/peopleplaces.ts` (the `xrelsByDstEntity` DataLoader)
- Test: `backend/test/graphql/group.test.ts` (created here, grown in A2)

**Step 1: Write the failing test**

```ts
/**
 * test/graphql/group.test.ts
 * Contract tests for the synthesized Group entity. Groups have no table —
 * 79 slugs exist only as bom_xrels.dst_slug values (nephites ×124 …), so a
 * Group is: slug + de-slugged name + reverse xrels.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';

const db = getDb();
let yoga: ReturnType<typeof createYoga>;
let groupSlug: string;
let groupRowCount: number;

async function gql(query: string) {
  const res = await yoga.fetch('http://yoga/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

beforeAll(async () => {
  yoga = createYoga({ schema: buildSchema(), context: () => buildContext(db, 'en') });
  const top = await db
    .selectFrom('bom_xrels')
    .select(['dst_slug', (eb) => eb.fn.countAll().as('n')])
    .where('dst_type', '=', 'group')
    .groupBy('dst_slug')
    .orderBy('n', 'desc')
    .limit(1)
    .executeTakeFirstOrThrow();
  groupSlug = top.dst_slug;         // expected: 'nephites'
  groupRowCount = Number(top.n);    // expected: 124
}, 30000);

afterAll(async () => { await closeDb(); });

describe('Group', () => {
  it('resolves a synthesized group with de-slugged name and reverse xrels', async () => {
    const body = await gql(`{
      group(slug: "${groupSlug}") {
        slug name
        xrels { rel dst_type dst_slug dst_name direction }
      }
    }`);
    expect(body.errors).toBeUndefined();
    const g = body.data.group[0];
    expect(g.slug).toBe(groupSlug);
    expect(g.name).toMatch(/^[A-Z]/);          // "Nephites", not "nephites"
    expect(g.xrels).toHaveLength(groupRowCount);
    for (const x of g.xrels) {
      expect(x.direction).toBe('dst');
      expect(x.dst_name).toBeTruthy();          // source entity resolved
    }
  }, 30000);

  it('unknown group slug resolves to an empty list, not an error', async () => {
    const body = await gql(`{ group(slug: "no-such-group") { slug } }`);
    expect(body.errors).toBeUndefined();
    expect(body.data.group ?? []).toHaveLength(0);
  }, 30000);
});
```

**Step 2: Run to verify it fails**
`npx vitest run test/graphql/group.test.ts` → FAIL: `Cannot query field "group" on type "Query"`.

**Step 3: Widen the loader key type** in `peopleplaces.ts`. Change the DataLoader generic and nothing else — the SQL already accepts any `dst_type`:
```ts
const xrelsByDstEntity = new DataLoader<{ type: 'people' | 'place' | 'group'; slug: string }, XrelRow[], string>(
```
(one-line change; the union appears once in the generic).

**Step 4:** `npm run typecheck` → clean. Test still fails (schema next) — expected.
**Step 5:** Commit: `git add -A backend && git commit -m "feat(backend): widen reverse xrels loader to group destinations"`

### Task A2: Group type, query, and resolver

**Files:**
- Modify: `backend/schema/BomPeoplePlaces.graphql` (Query extension + Group type)
- Modify: `backend/src/graphql/resolvers/peopleplaces.ts`
- Test: `backend/test/graphql/group.test.ts` (from A1)

**Step 1:** Schema — in `BomPeoplePlaces.graphql`, add to the `extend type Query` block:
```graphql
  group(slug: [String]): [Group]
```
and a new type (Xrel is already defined in BomObjects.graphql):
```graphql
"""
Synthesized entity: groups exist only as bom_xrels destinations (79 slugs,
no table), so a Group is its slug, a de-slugged display name, and its
reverse-direction relationships.
"""
type Group {
  slug: String
  name: String
  xrels: [Xrel]
}
```

**Step 2:** `npm run codegen:graphql` → SUCCESS ×3.

**Step 3:** Resolver — in `resolvers/peopleplaces.ts`, add a de-slug helper near the top:
```ts
// No groups table exists — display name is the slug, title-cased.
const deSlugGroupName = (slug: string) =>
  slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
```
In the `Query` resolver block add:
```ts
    group: async (_parent, args, ctx) => {
      const slugs: string[] = (args as { slug?: string[] }).slug ?? [];
      // A group "exists" iff at least one xrel row points at it.
      const results = await Promise.all(
        slugs.map(async (slug) => {
          const xrels = await ctx.loaders.xrelsByDstEntity.load({ type: 'group', slug });
          return xrels.length ? { slug, name: deSlugGroupName(slug), xrels } : null;
        })
      );
      return results.filter(Boolean) as unknown as never[];
    },
```
No `Group` field resolvers needed — the query returns complete objects (YAGNI).

**Step 4:** `npm run typecheck` → clean. `npx vitest run test/graphql/group.test.ts` → 2 pass.
**Step 5:** Full backend check: `npx vitest run test/graphql/xrels-people-places.test.ts test/graphql/group.test.ts` → 6 pass.
**Step 6:** Commit: `feat(backend): synthesized Group entity with reverse xrels`

### Task A3: Group popup + clickable group rows

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js` (new `group` query)
- Modify: `frontend/webapp/src/views/_Common/XrelSection.js` (group rows clickable)
- Modify: `frontend/webapp/src/views/_Common/PopUp.js` (dispatch + `GroupPopUp`)
- Test: `frontend/webapp/src/views/_Common/__tests__/XrelSection.test.js` (extend)
- Test: `frontend/webapp/src/views/_Common/__tests__/GroupPopUp.test.js` (create)

**Step 1: Extend the failing XrelSection test.** In `XrelSection.test.js`, REPLACE the `"group rows are not clickable"` test with:
```js
  test("group rows open the group popup", () => {
    render(<XrelSection xrels={[{ ...srcRow, dst_type: "group", dst_slug: "nephites", dst_name: "Nephites" }]} />);
    fireEvent.click(screen.getByText("Nephites"));
    expect(mockSetPopUp).toHaveBeenCalledWith({ type: "group", ids: ["nephites"], underSlug: "group" });
  });
```
Run `--testPathPattern="XrelSection"` → 1 fail (group is a no-op today).

**Step 2: Make group rows clickable** in `XrelSection.js`:
- In `handleXrelClick`, add:
```js
    } else if (xrel.dst_type === "group") {
      appController.functions.setPopUp({ type: "group", ids: [xrel.dst_slug], underSlug: "group" });
```
- Change the clickable list to `["people", "place", "object", "group"]` and delete the `// group: non-clickable` comment.

Run → all XrelSection tests pass.

**Step 3: Failing GroupPopUp test:**
```js
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { GroupPopUp } from "../PopUp";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

jest.mock("src/models/BoMOnlineAPI", () => ({ __esModule: true, default: jest.fn(), assetUrl: "" }));
jest.mock("src/models/Utils", () => ({
  label: (k) => k, isMobile: () => false, determineLanguage: () => "en",
  processName: (n) => n, replaceNumbers: (n) => n, snapSelectionToWord: () => {}, log: () => {},
}));

const mockController = {
  states: { popUp: { open: true, type: "group", ids: ["nephites"], activeId: "nephites", top: 0, left: 0 } },
  functions: { setPopUp: jest.fn(), closePopUp: jest.fn() },
  popUpData: {},
};
jest.mock("src/contexts/AppControllerContext", () => ({
  useAppController: () => mockController,
}));

describe("GroupPopUp", () => {
  beforeEach(() => {
    mockController.popUpData = {};
    BoMOnlineAPI.mockImplementation(() =>
      Promise.resolve({ group: { nephites: {
        slug: "nephites", name: "Nephites",
        xrels: [{ rel: "kept-by", dst_type: "object", dst_slug: "plates", dst_name: "Plates", direction: "dst" }],
      } } })
    );
  });

  test("fetches and renders name plus xrel rows", async () => {
    render(<GroupPopUp />);
    await waitFor(() => expect(screen.getByText("Nephites")).toBeInTheDocument());
    expect(screen.getByText("Plates")).toBeInTheDocument();
    expect(screen.getByText("kept-by")).toBeInTheDocument();
  });
});
```
Run `--testPathPattern="GroupPopUp"` → FAIL (`GroupPopUp` is not exported).

**Step 4: Implement.** In `GraphQLQueries.js` add (mirror the `person` entry's shape; `q()` is the local query-builder):
```js
  group: (ids) => {
    return {
      type: "group",
      key: "slug",
      val: ids,
      query:
        q("group", "slug", ids) +
        `{
                slug
                name
                xrels {
                    rel
                    srcweight
                    dst_type
                    dst_slug
                    dst_name
                    dst_title
                    note
                    verse_id
                    direction
                }
            }`,
    }
  },
```
In `PopUp.js`:
- dispatch: after the `"object"` branch in `PopUp()`, add
  `if (appController.states.popUp.type === "group") return <GroupPopUp />;`
- component (model it on `ObjectPopUp`'s fetch/guard shape — read that function first; export it for the test):
```jsx
export function GroupPopUp() {
  const appController = useAppController();
  const activeId = appController.states.popUp.activeId;

  if (appController.popUpData[activeId] === undefined) {
    BoMOnlineAPI({ group: appController.states.popUp.ids }).then((response) => {
      appController.functions.setPopUp({
        type: "group",
        ids: appController.states.popUp.ids,
        popUpData: response.group,
      });
    });
    return <Loading type="Group" />;
  }
  const group = appController.popUpData[activeId];
  if (!group) return null;

  return (
    <Draggable handle=".card-header">
      <div id="popUp" className="card pp popupwindow"
        style={{ top: appController.states.popUp.top, left: appController.states.popUp.left }}>
        <div className="card-header">
          <div className="group_head">{label("group_profile") === "group_profile" ? "Group Profile" : label("group_profile")}</div>
          <ul className="source_tabs souce_tab_list_0">
            <li className="close" onClick={appController.functions.closePopUp}>×</li>
          </ul>
        </div>
        <div className="card-body">
          <div className="ppbody">
            <div className="bodytext"><h3>{group.name}</h3></div>
            <div className="refbox">
              <XrelSection xrels={group.xrels} showEmpty />
            </div>
          </div>
        </div>
      </div>
    </Draggable>
  );
}
```
Note the label fallback: `group_profile` won't exist in the dictionary yet and `label()` echoes unknown keys — the ternary keeps the UI readable either way.
The jest mock above renders without Draggable issues (react-draggable renders children fine in jsdom); if `Loading` pulls unmocked context, check how `reader.test.js`-style mocks handled it in the July 16 work.

**Step 5:** Run `--testPathPattern="XrelSection|GroupPopUp"` → all pass. Then the full FE suite → all pass.
**Step 6:** Commit: `feat(frontend): group popup; group xrel rows clickable`

### Task A4: Mobile drawer parity

**Files:**
- Modify: `frontend/webapp/src/views/_Common/Drawer.js`
- Test: extend `GroupPopUp.test.js` only if Drawer exports cleanly; otherwise this task is verified by the FE suite + Phase D screenshots.

**Step 1:** Read `Drawer.js` end to end. Locate its own `Person` and `Place` components (defined in-file; the dispatch is around line 84–100).
**Step 2:** In Drawer's `Person` body, after the section that renders relations/description (match the pattern used in `PopUp.js`), add `<XrelSection xrels={person?.xrels} noHeading />`. In Drawer's `Place` body add `<XrelSection xrels={place?.xrels} />`. Import `XrelSection` at the top.
**Step 3:** Add a `group` drawer branch: `if (type === "group") return <GroupDrawer setLocalOpen={setLocalOpen} />;` with a minimal `GroupDrawer` that fetches via `BoMOnlineAPI({ group: ids })` (same guard pattern as Drawer's `Person`) and renders `<h3>{group.name}</h3><XrelSection xrels={group.xrels} showEmpty />`.
**Step 4:** Note the pre-existing hole you will see while in there: Drawer has no `object` branch either (`<pre>{type}</pre>` fallback). Fix it the same way ONLY if it's a ≤20-line mirror of GroupDrawer; otherwise file it in the commit message as a known gap — do not rabbit-hole.
**Step 5:** Full FE suite → pass. Commit: `feat(frontend): xrels in mobile drawers; group drawer`

---

## Phase B — Relationships in this passage (Read view)

### Task B1: Verse-indexed xrels in `passagenotes`

**Files:**
- Modify: `backend/schema/BomNotes.graphql` (PassageNotes type + new PassageXrel)
- Modify: `backend/src/data/loaders/scriptureextras.ts` (verse→xrels index)
- Modify: `backend/src/graphql/resolvers/scriptureextras.ts` (wire the field)
- Test: `backend/test/graphql/passage-xrels.test.ts`

**Design constraint:** an Xrel row assumes an implicit anchor entity; a passage has none, so passage rows carry BOTH endpoints:

**Step 1: Failing test** (pick a verse dynamically — scan bom_xrels notes for the first parseable ref, mirroring how `xrels-people-places.test.ts` picks slugs):
```ts
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';
import { parseVerseIdFromNote } from '../../src/data/loaders/objects.js';

const db = getDb();
let yoga: ReturnType<typeof createYoga>;
let verseId: number;

async function gql(query: string) {
  const res = await yoga.fetch('http://yoga/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

beforeAll(async () => {
  yoga = createYoga({ schema: buildSchema(), context: () => buildContext(db, 'en') });
  const rows = await db.selectFrom('bom_xrels').select(['note']).where('note', 'is not', null).limit(500).execute();
  for (const r of rows) {
    const v = parseVerseIdFromNote(r.note);
    if (v) { verseId = v; break; }
  }
  expect(verseId).toBeGreaterThan(0);
}, 30000);

afterAll(async () => { await closeDb(); });

describe('passagenotes.xrels', () => {
  it('returns both-endpoint rows anchored to verses in range', async () => {
    const body = await gql(`{
      passagenotes(start_verse_id: ${verseId}, end_verse_id: ${verseId}) {
        xrels { rel src_type src_slug src_name dst_type dst_slug dst_name note verse_id }
      }
    }`);
    expect(body.errors).toBeUndefined();
    const xrels = body.data.passagenotes.xrels;
    expect(xrels.length).toBeGreaterThan(0);
    for (const x of xrels) {
      expect(x.verse_id).toBe(verseId);
      expect(x.src_name).toBeTruthy();
      expect(x.dst_name).toBeTruthy();
    }
  }, 30000);
});
```
Run → FAIL: `Cannot query field "xrels" on type "PassageNotes"`.

**Step 2: Schema** — in `BomNotes.graphql` add `xrels: [PassageXrel]` to `type PassageNotes` and:
```graphql
"""A bom_xrels row anchored to a passage via the scripture ref in its note."""
type PassageXrel {
  rel: String
  src_type: String
  src_slug: String
  src_name: String
  dst_type: String
  dst_slug: String
  dst_name: String
  note: String
  verse_id: Int
}
```
Run `npm run codegen:graphql`.

**Step 3: Loader** — in `loaders/scriptureextras.ts`, add a module-scope lazy index (the table is 2,868 static rows; scan once per process):
```ts
import { parseVerseIdFromNote } from './objects.js';

type PassageXrelRow = {
  rel: string; src_type: string; src_slug: string; src_name: string;
  dst_type: string; dst_slug: string; dst_name: string;
  note: string | null; verse_id: number;
};

let verseXrelIndex: Map<number, PassageXrelRow[]> | null = null;

async function buildVerseXrelIndex(db: Kysely<DB>): Promise<Map<number, PassageXrelRow[]>> {
  if (verseXrelIndex) return verseXrelIndex;
  const rows = await db
    .selectFrom('bom_xrels')
    .select(['rel', 'src_type', 'src_slug', 'dst_type', 'dst_slug', 'note'])
    .where('note', 'is not', null)
    .execute();
  const anchored = rows
    .map((r) => ({ ...r, verse_id: parseVerseIdFromNote(r.note) }))
    .filter((r): r is typeof r & { verse_id: number } => r.verse_id != null);

  // resolve BOTH endpoints' names across the three entity tables + de-slugged groups
  const wanted = anchored.flatMap((r) => [
    { type: r.src_type, slug: r.src_slug },
    { type: r.dst_type, slug: r.dst_slug },
  ]);
  const slugsOf = (t: string) => [...new Set(wanted.filter((w) => w.type === t).map((w) => w.slug))];
  const [people, places, objects] = await Promise.all([
    slugsOf('people').length ? db.selectFrom('bom_people').select(['slug', 'name']).where('slug', 'in', slugsOf('people')).execute() : [],
    slugsOf('place').length ? db.selectFrom('bom_places').select(['slug', 'name']).where('slug', 'in', slugsOf('place')).execute() : [],
    slugsOf('object').length ? db.selectFrom('bom_objects').select(['slug', 'name']).where('slug', 'in', slugsOf('object')).execute() : [],
  ]);
  const names = new Map<string, string>();
  for (const p of people) if (p.name) names.set(`people:${p.slug}`, p.name);
  for (const p of places) if (p.name) names.set(`place:${p.slug}`, p.name);
  for (const o of objects) if (o.name) names.set(`object:${o.slug}`, o.name);
  const nameOf = (type: string, slug: string) =>
    names.get(`${type}:${slug}`) ??
    (type === 'group'
      ? slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : slug);

  const index = new Map<number, PassageXrelRow[]>();
  for (const r of anchored) {
    const row: PassageXrelRow = {
      rel: r.rel, note: r.note, verse_id: r.verse_id,
      src_type: r.src_type, src_slug: r.src_slug, src_name: nameOf(r.src_type, r.src_slug),
      dst_type: r.dst_type, dst_slug: r.dst_slug, dst_name: nameOf(r.dst_type, r.dst_slug),
    };
    const list = index.get(r.verse_id) ?? [];
    list.push(row);
    index.set(r.verse_id, list);
  }
  verseXrelIndex = index;
  return index;
}

export const xrelsByVerseRange = async (db: Kysely<DB>, start: number, end: number): Promise<PassageXrelRow[]> => {
  const index = await buildVerseXrelIndex(db);
  const out: PassageXrelRow[] = [];
  for (let v = start; v <= end; v++) {
    const rows = index.get(v);
    if (rows) out.push(...rows);
  }
  return out;
};
```
Adjust import specifics to the file's existing style (it already imports Kysely/DB types).

**Step 4: Resolver** — find where `passagenotes` assembles its category fields in `resolvers/scriptureextras.ts` (it computes a verse range from `verse_ids`/`start_verse_id`/`end_verse_id`). Add to the returned object:
```ts
    xrels: await xrelsByVerseRange(ctx.db, startVerseId, endVerseId),
```
matching however the existing categories receive the range (read the resolver first — mirror its exact range-derivation variables).

**Step 5:** `npm run typecheck`; run the new test → pass; run the two existing xrels test files → still pass.
**Step 6:** Commit: `feat(backend): passage-anchored xrels in passagenotes`

### Task B2: Passage relationships panel

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js` (`passagenotes` query: add xrels block)
- Modify: `frontend/webapp/src/views/Read/PassageNotes.js` (new category)
- Create: `frontend/webapp/src/views/Read/CategoryPanels/RelationshipsPanel.js` (match how the existing category panels in that directory are structured — read one, e.g. the people/refs panel, first)
- Test: `frontend/webapp/src/views/Read/__tests__/RelationshipsPanel.test.js`

**Step 1: Failing test** — render `RelationshipsPanel` with two rows and assert: both endpoint names render, clicking a name calls `setPopUp` with the right type (mock AppControllerContext as in `XrelSection.test.js`), and rows read `src — rel — dst` in order:
```js
const row = {
  rel: "used-to-slay", note: "…(Alma 51:34)", verse_id: 35154,
  src_type: "object", src_slug: "teancum-javelin", src_name: "Teancum Javelin",
  dst_type: "people", dst_slug: "amalickiah", dst_name: "Amalickiah",
};
```
**Step 2:** Implement `RelationshipsPanel` — a list of rows, each `<a>{src_name}</a> <span className="rel-verb">{rel}</span> <a>{dst_name}</a>`, clicks dispatching `setPopUp` by endpoint type (people/places/object/group — same mapping as `XrelSection.handleXrelClick`; extract that mapping into a tiny exported helper `popUpTargetFor(type, slug)` in `XrelSection.js` and reuse it — one definition, two call sites).
**Step 3:** Wire the category: in `PassageNotes.js`, add `xrels` to the counts aggregation (`if (verseData.xrels) counts.xrels.push(...verseData.xrels);` — mirror the other seven categories exactly, including wherever the category list/tabs are declared) and render the panel where the other category panels mount. Add the xrels block to the `passagenotes` query in `GraphQLQueries.js` (all nine PassageXrel fields).
**Step 4:** Run panel test + full FE suite → pass.
**Step 5:** Commit: `feat(frontend): relationships category in passage notes`

---

## Phase C — Sampler: person/place/group hubs

### Task C1: Reverse-direction hubs in `sampleRelationship`

**Files:**
- Modify: `backend/schema/HomeSampler.graphql` (`RelEdge` gains `reverse: Boolean`)
- Modify: `backend/src/graphql/resolvers/homesampler.ts` (`entityNames`, `sampleRelationship`)
- Test: `backend/test/graphql/homesampler-hubs.test.ts`

Today the hub pool is `GROUP BY src_type, src_slug` — always objects. Add destination-side hubs so Nephi, Bountiful, and the Nephites can headline the tile.

**Step 1: Failing test** — over a fixed spread of seeds, at least one sampled hub must be non-object, and reverse edges must carry `reverse: true`:
```ts
// beforeAll: yoga per the other sampler tests (see test/graphql/homesampler.test.ts)
it('hub pool includes destination-side hubs across seeds', async () => {
  const hubTypes = new Set<string>();
  for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]) {
    const body = await gql(`{ homesampler(seed: ${seed}) { relationship { hubType edges { reverse } } } }`);
    const rel = body.data?.homesampler?.relationship;
    if (rel) hubTypes.add(rel.hubType);
  }
  expect([...hubTypes].some((t) => t !== 'object')).toBe(true);
}, 60000);

it('a destination-side hub marks every edge reverse', async () => {
  // scan seeds until a non-object hub appears, then assert its edges
  for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]) {
    const body = await gql(`{ homesampler(seed: ${seed}) { relationship { hubType edges { reverse } } } }`);
    const rel = body.data?.homesampler?.relationship;
    if (rel && rel.hubType !== 'object') {
      for (const e of rel.edges) expect(e.reverse).toBe(true);
      return;
    }
  }
  throw new Error('no destination-side hub in 10 seeds — pool weighting broken');
}, 60000);
```
Run → FAIL (`reverse` not in schema).

**Step 2: Schema:** add `reverse: Boolean` to `type RelEdge` with a docstring: `"""true when the hub is the row's destination — render name before verb."""` Then codegen.

**Step 3: Implement** in `homesampler.ts`:
- `entityNames`: add a `group` branch — no table, so after building the map, resolve missing `group:` keys by de-slugging (`{ name: deSlug(slug), title: null }`). Extract/duplicate the same `deSlugGroupName` helper (3 lines — duplication is fine across backend modules per existing style, or export it from `resolvers/peopleplaces.ts` if imports stay acyclic).
- `sampleRelationship`: build the hub pool from BOTH directions in one raw query:
```ts
  const hub = await sql<{ hub_type: string; hub_slug: string; is_dst: number }>`
    SELECT hub_type, hub_slug, is_dst FROM (
      SELECT src_type AS hub_type, src_slug AS hub_slug, 0 AS is_dst FROM bom_xrels GROUP BY src_type, src_slug HAVING COUNT(*) >= 2
      UNION ALL
      SELECT dst_type, dst_slug, 1 FROM bom_xrels WHERE dst_type IN ('people','place','group') GROUP BY dst_type, dst_slug HAVING COUNT(*) >= 2
    ) hubs
    ORDER BY MD5(CONCAT(hub_type, ':', hub_slug, ':', is_dst, ':', ${seed}))
    LIMIT 1
  `.execute(ctx.db);
```
  For `is_dst=1` hubs, fetch edges with `where('dst_type','=',h.hub_type).where('dst_slug','=',h.hub_slug)`, and map each edge's displayed entity from the row's **src** columns, with `reverse: true`. For `is_dst=0` keep today's behavior plus `reverse: false` on each edge. Keep the existing name-resolution-drop rule and the `>= 2 edges` floor.

**Step 4:** `npm run typecheck`; new test passes; **regression:** `npx vitest run test/graphql/homesampler.test.ts` — the existing determinism assertions must still pass (same seed → same result). If a pinned baseline asserts a specific hub for a specific seed, update the pin in that test with a comment (`hub pool doubled 2026-07-16`) — determinism matters, not the particular hub.
**Step 5:** Commit: `feat(backend): sampler relationship hubs from both xrel directions`

### Task C2: Tile renders reverse edges name-first

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/RelationshipsTile.js`
- Modify: `frontend/webapp/src/views/Home/Sampler.js` (add `reverse` to the homesampler query's edge fields — find the `relationship { edges {` block)
- Test: `frontend/webapp/src/views/Home/tiles/__tests__/RelationshipsTile.test.js` (extend)

**Step 1: Failing test** — add to the existing test file:
```js
test("reverse edges render name before verb", () => {
  const data = {
    hubType: "people", hubSlug: "nephi1", hubName: "Nephi",
    edges: [
      { rel: "wielded-by", dstType: "object", dstSlug: "sword", dstName: "Sword of Laban", reverse: true },
      { rel: "quoted-by", dstType: "object", dstSlug: "thorns", dstName: "Thorns", reverse: true },
    ],
  };
  const { container } = render(<MemoryRouter><RelationshipsTile data={data} /></MemoryRouter>);
  const li = container.querySelector("li.relEdge");
  expect(li.textContent.indexOf("Sword of Laban")).toBeLessThan(li.textContent.indexOf("wielded-by"));
});
```
(Wrap in MemoryRouter as the existing tests in that file do.)
**Step 2:** In the tile's edge `map`, order by `e.reverse`: name-then-verb when true, verb-then-name otherwise (same two-fragment pattern as `XrelSection`). Also add group hub/edge routing: `PROFILE_PATH` has no `group` entry, so group names render unlinked — acceptable; leave a one-line comment pointing at the group popup as the richer surface.
**Step 3:** Run tile tests + full FE suite → pass.
**Step 4:** Commit: `feat(frontend): RelationshipsTile name-first ordering for reverse edges`

---

## Phase D — Verification, merge, ship

### Task D1: Full-stack verification

**Step 1:** Backend: `npx vitest run` → everything passes except the pre-existing `test/readingplan/mutations.test.ts` permission failure. `npm run typecheck` clean.
**Step 2:** Frontend: full jest suite + `npx react-app-rewired build` → both clean.
**Step 3:** E2E (same recipe as the xrels feature): backend `npx tsx src/index.ts` (:5006), frontend `REACT_APP_LOCAL_BACKEND=true BROWSER=none PORT=8212 npm start`. Playwright-screenshot and eyeball:
  - `/objects/liahona` (or any object with a group xrel — probe for one) → click a group row → **Group popup** renders name + connections.
  - A Read chapter whose passage has anchored xrels (derive the chapter from the B1 test's verseId) → **relationships category** appears with both-endpoint rows.
  - `/` home, several reloads → RelationshipsTile eventually shows a person/place/group hub with name-first edges.
  - Mobile viewport (390×844) → person drawer shows xrels.
**Step 4:** Kill both servers (`pkill -f "tsx src/index.ts"; pkill -f "PORT=8212"`).

### Task D2: Merge to dev and push

**Step 1:** `git fetch origin dev`; if it moved, merge `origin/dev` into the feature branch first and re-run both suites (concurrent sessions are active in this repo — expect movement; resolve conflicts by reading both sides' intent, as documented in the July 16 merge).
**Step 2:** From the repo root: `git branch -f dev origin/dev && git worktree add .worktrees/tmp-dev-merge dev`, then in the temp worktree `git merge --no-ff feature/xrels-everywhere -m "Merge feature/xrels-everywhere into dev"` and `git push git@github.com:kckern/BookofMormonOnline.git dev`.
**Step 3:** Cleanup: remove both worktrees, `git branch -D feature/xrels-everywhere` (after `git merge-base --is-ancestor` confirms containment), verify `git worktree list` shows only the main tree.
**Step 4:** Use superpowers:verification-before-completion before declaring done.

---

## Out of scope (explicit, with reasons)

- **Timeline events** — zero xrel rows exist; pure data authoring. When rows appear, `xrelsByDstEntity` + a widened key type light them up.
- **Names view** — already covered transitively: it opens the shared person/place popups, which render xrels since `84b220a4`.
- **People↔place relationship rows** (born-in, reigned-in…) — data entry against a write-enabled DB (this laptop's `reader` user cannot). The loaders already resolve any `src_type`, so authored rows appear everywhere with no code change.
- **A groups index/landing page** — no route, no list view. The popup is the whole surface until someone asks for more (YAGNI).
