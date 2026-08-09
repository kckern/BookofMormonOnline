# Matters Home Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Matters to the `/home` sampler as three group grid tiles (Narrative/Concrete, Material/Indefinite, Concept) plus one shared singleton profile tile, mirroring the existing People/Places tile pattern.

**Architecture:** Three `bom_matters` groups are derived from `branch × specificity` (no schema change). The backend adds six `HomeSampler` fields (three `[Matter]` arrays + three counts) via the established "add a field + a sampler fn" path, reusing the existing `Matter` GraphQL type and its `index`/`xrels` resolvers. The frontend adds four tile components and wires them into the tile registry; layout is the existing JS-binned masonry, so tiles only need a span class to exist.

**Tech Stack:** Backend — TypeScript, Kysely (MySQL), graphql-yoga, graphql-codegen, vitest. Frontend — React 17, react-router, CRA/jest + @testing-library/react.

**Spec:** `docs/specs/2026-08-08-matters-home-tiles.md`

---

## The three groups (predicates — used everywhere)

| Group | Predicate | ~Count |
|-------|-----------|-------:|
| `narrative` | `branch='concrete' AND specificity='instance'` | 161 |
| `material` | `branch='concrete' AND specificity!='instance'` | 192 |
| `concept` | `branch='concepts'` | 123 |

Groups are total and disjoint over all 476 matters.

## File structure

**Backend**
- Modify: `backend/schema/HomeSampler.graphql` — six new fields on `HomeSampler`.
- Modify: `backend/src/graphql/resolvers/homesampler.ts` — samplers, counts, registry entries, cache-key bump.
- Create: `backend/test/graphql/homesampler-matters.test.ts` — group + determinism contract.
- Regenerated: `backend/codegen/graphql.ts` (via `npm run codegen:graphql`).

**Frontend**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js` — request the new fields.
- Create: `frontend/webapp/src/views/Home/tiles/MattersNarrativeTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/MattersMaterialTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/MattersConceptTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/MatterProfileTile.js`
- Modify: `frontend/webapp/src/views/Home/tiles/registry.js` — register the four tiles.
- Modify: `frontend/webapp/src/views/Home/Sampler.css` — span classes + tile-specific styles.
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/MattersNarrativeTile.test.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/MattersMaterialTile.test.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/MattersConceptTile.test.js`
- Modify: `frontend/webapp/src/views/Home/tiles/__tests__/ProfileTiles.test.js` — add `MatterProfileTile`.

---

## Task 1: Backend samplers + schema

**Files:**
- Create: `backend/test/graphql/homesampler-matters.test.ts`
- Modify: `backend/schema/HomeSampler.graphql`
- Modify: `backend/src/graphql/resolvers/homesampler.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/test/graphql/homesampler-matters.test.ts`:

```ts
/**
 * Contract tests for the matters samplers on `homesampler`.
 * Groups derive from bom_matters.branch × specificity:
 *   narrative = concrete + instance,  material = concrete + !instance,
 *   concept   = concepts.
 * Read-only, runs against the live DB via the `reader` user (mirrors homesampler.test.ts).
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';

const db = getDb();
let yoga: ReturnType<typeof createYoga>;

beforeAll(async () => {
  yoga = createYoga({ schema: buildSchema(), context: () => buildContext(db, 'en') });
  await db.selectFrom('bom_matters').select('slug').limit(1).execute();
});
afterAll(async () => { await closeDb(); });

const QUERY = /* GraphQL */ `
  query M($seed: Int) {
    homesampler(seed: $seed) {
      mattersNarrative { slug branch specificity }
      mattersMaterial  { slug branch specificity }
      mattersConcept   { slug branch }
      mattersNarrativeCount
      mattersMaterialCount
      mattersConceptCount
    }
  }
`;

type M = { slug: string; branch: string; specificity?: string };
type Payload = {
  mattersNarrative: M[]; mattersMaterial: M[]; mattersConcept: M[];
  mattersNarrativeCount: number; mattersMaterialCount: number; mattersConceptCount: number;
};

async function exec(seed?: number): Promise<Payload> {
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { seed } }),
  });
  const body = (await res.json()) as { data?: { homesampler: Payload }; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data!.homesampler;
}

describe('homesampler matters', () => {
  it('narrative = concrete + instance', async () => {
    const s = await exec(12345);
    expect(s.mattersNarrative.length).toBeGreaterThan(0);
    expect(s.mattersNarrative.length).toBeLessThanOrEqual(17);
    expect(s.mattersNarrative.every((m) => m.branch === 'concrete' && m.specificity === 'instance')).toBe(true);
  });

  it('material = concrete + not-instance', async () => {
    const s = await exec(12345);
    expect(s.mattersMaterial.length).toBeGreaterThan(0);
    expect(s.mattersMaterial.every((m) => m.branch === 'concrete' && m.specificity !== 'instance')).toBe(true);
  });

  it('concept = concepts branch', async () => {
    const s = await exec(12345);
    expect(s.mattersConcept.length).toBeGreaterThan(0);
    expect(s.mattersConcept.every((m) => m.branch === 'concepts')).toBe(true);
  });

  it('the three groups are disjoint within one sample', async () => {
    const s = await exec(12345);
    const all = [...s.mattersNarrative, ...s.mattersMaterial, ...s.mattersConcept].map((m) => m.slug);
    expect(new Set(all).size).toBe(all.length);
  });

  it('counts are populated and plausible', async () => {
    const s = await exec(999);
    expect(s.mattersNarrativeCount).toBeGreaterThan(100);
    expect(s.mattersMaterialCount).toBeGreaterThan(100);
    expect(s.mattersConceptCount).toBeGreaterThan(100);
  });

  it('is deterministic for the same seed', async () => {
    const [a, b] = await Promise.all([exec(777), exec(777)]);
    expect(a.mattersNarrative.map((m) => m.slug)).toEqual(b.mattersNarrative.map((m) => m.slug));
    expect(a.mattersConcept.map((m) => m.slug)).toEqual(b.mattersConcept.map((m) => m.slug));
  });

  it('varies across seeds', async () => {
    const [a, b] = await Promise.all([exec(1001), exec(2002)]);
    expect(a.mattersMaterial.map((m) => m.slug)).not.toEqual(b.mattersMaterial.map((m) => m.slug));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run test/graphql/homesampler-matters.test.ts`
Expected: FAIL — GraphQL errors like `Cannot query field "mattersNarrative" on type "HomeSampler"`.

- [ ] **Step 3: Add the six fields to the schema**

In `backend/schema/HomeSampler.graphql`, inside `type HomeSampler { … }`, add these lines just after the `places: [Place]` line:

```graphql
  # Matters, split by branch × specificity into three groups (see docs/specs/2026-08-08-matters-home-tiles.md).
  mattersNarrative: [Matter]   # concrete + instance — named artifacts in the narrative
  mattersMaterial: [Matter]    # concrete + !instance — material typologies
  mattersConcept: [Matter]     # concepts — abstractions
  mattersNarrativeCount: Int
  mattersMaterialCount: Int
  mattersConceptCount: Int
```

- [ ] **Step 4: Add the samplers, counts, and registry entries**

In `backend/src/graphql/resolvers/homesampler.ts`, add this block just above the `const samplers: Record<…>` declaration (near line 689):

```ts
// --- Matters: three groups by branch × specificity -----------------------
// 17 = 5 cards + a 3×4 mosaic end cell, mirroring places.
const MATTERS_COUNT = 17;
type MatterGroup = 'narrative' | 'material' | 'concept';

const sampleMatters = (group: MatterGroup) => async (ctx: AppContext, seed: number) => {
  let qb = ctx.db
    .selectFrom('bom_matters')
    .select(['slug', 'guid', 'name', 'subtitle', 'description', 'nrefs', 'era_culture', 'branch', 'specificity'])
    .where('name', 'is not', null);
  if (group === 'narrative') qb = qb.where('branch', '=', 'concrete').where('specificity', '=', 'instance');
  else if (group === 'material') qb = qb.where('branch', '=', 'concrete').where('specificity', '!=', 'instance');
  else qb = qb.where('branch', '=', 'concepts');
  return qb.orderBy(seededOrder('slug', seed)).limit(MATTERS_COUNT).execute();
};

const countMatters = (group: MatterGroup) => async (ctx: AppContext) => {
  let qb = ctx.db.selectFrom('bom_matters').where('name', 'is not', null);
  if (group === 'narrative') qb = qb.where('branch', '=', 'concrete').where('specificity', '=', 'instance');
  else if (group === 'material') qb = qb.where('branch', '=', 'concrete').where('specificity', '!=', 'instance');
  else qb = qb.where('branch', '=', 'concepts');
  const r = await qb.select(({ fn }) => fn.countAll<number>().as('n')).executeTakeFirst();
  return Number(r?.n ?? 0);
};
```

Then add these six entries inside the `samplers` object literal (after the `mapstory: sampleMapStory,` line):

```ts
  mattersNarrative: sampleMatters('narrative'),
  mattersMaterial: sampleMatters('material'),
  mattersConcept: sampleMatters('concept'),
  mattersNarrativeCount: countMatters('narrative'),
  mattersMaterialCount: countMatters('material'),
  mattersConceptCount: countMatters('concept'),
```

- [ ] **Step 5: Bump the sampler cache key so cached windows pick up the new fields**

In `backend/src/graphql/resolvers/homesampler.ts`, in the `homesampler` resolver, change both `v1` occurrences to `v2`:

```ts
      const key = hasSeed
        ? `homesampler:v2:${lang}:seed:${seed}`
        : `homesampler:v2:${lang}:${bucket}`;
```

- [ ] **Step 6: Regenerate GraphQL types**

Run: `cd backend && npm run codegen:graphql`
Expected: exits 0; `backend/codegen/graphql.ts` now includes the `mattersNarrative`/`mattersMaterial`/`mattersConcept` fields on the `HomeSampler` type.

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd backend && npx vitest run test/graphql/homesampler-matters.test.ts`
Expected: PASS (all 7 assertions).

- [ ] **Step 8: Commit**

```bash
git add backend/schema/HomeSampler.graphql backend/src/graphql/resolvers/homesampler.ts backend/test/graphql/homesampler-matters.test.ts backend/codegen/graphql.ts
git commit -m "feat(home): add matters samplers (narrative/material/concept) to homesampler"
```

---

## Task 2: Frontend GraphQL query fields

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js:1846` (after the `places { … }` line inside `homesampler`)

- [ ] **Step 1: Add the matters fields to the homesampler query**

In `frontend/webapp/src/models/GraphQLQueries.js`, inside the `homesampler` query template, add these lines immediately after the `places { … }` line (line ~1846):

```js
        mattersNarrative { slug name subtitle nrefs era_culture index { ref slug text } }
        mattersMaterial { slug name subtitle nrefs era_culture index { ref slug } }
        mattersConcept { slug name subtitle description nrefs xrels { rel dst_type dst_slug dst_name note } index { ref slug } }
        mattersNarrativeCount
        mattersMaterialCount
        mattersConceptCount
```

Note: `Xrel` fields are snake_case in the schema (`dst_type`, `dst_slug`, `dst_name`), unlike the sampler's `Relationship` type.

- [ ] **Step 2: Verify the query parses (no dedicated test — checked by Task 8 integration)**

Run: `cd frontend/webapp && node -e "require('@babel/core')" 2>/dev/null; node --check src/models/GraphQLQueries.js && echo OK`
Expected: `OK` (file is valid JS).

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/models/GraphQLQueries.js
git commit -m "feat(home): request matters group fields in homesampler query"
```

---

## Task 3: MattersNarrativeTile (grid — artifacts)

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/MattersNarrativeTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/MattersNarrativeTile.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/MattersNarrativeTile.test.js`:

```jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MattersNarrativeTile from "../MattersNarrativeTile";

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

test("renders an artifact card that links to the matter popup route", () => {
  const data = [
    { slug: "plates-of-brass", name: "Plates of Brass", subtitle: "Brass plates kept by Laban",
      index: [{ ref: "1 Nephi 3:3", slug: "1-nephi/3", text: "the record of the Jews" }] },
  ];
  renderIn(<MattersNarrativeTile data={data} seed={0} payload={{ mattersNarrativeCount: 161 }} />);
  const link = screen.getByRole("link", { name: /Plates of Brass/ });
  expect(link.getAttribute("href")).toBe("/matters/plates-of-brass");
  expect(screen.getByText("1 Nephi 3:3")).toBeInTheDocument();
});

test("does not crash on empty data", () => {
  expect(() => renderIn(<MattersNarrativeTile data={[]} payload={{}} />)).not.toThrow();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false src/views/Home/tiles/__tests__/MattersNarrativeTile.test.js`
Expected: FAIL — `Cannot find module '../MattersNarrativeTile'`.

- [ ] **Step 3: Write the component**

Create `frontend/webapp/src/views/Home/tiles/MattersNarrativeTile.js`:

```jsx
import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import RefPill from "./RefPill";
import { clampWords, flatten } from "./textUtils";

/**
 * Narrative/Concrete matters — named artifacts (branch=concrete, specificity=instance)
 * anchored to a specific verse. Places-style image mosaic: image + name overlay +
 * the key scripture ref from the matter's index. End cell = 3×4 "much more" mosaic
 * into /matters. Whole card → /matters/<slug> (opens the matters popup).
 */
export default function MattersNarrativeTile({ data = [], seed = 0, payload }) {
  const cards = data.slice(0, 5);
  const mosaic = data.slice(5, 17);
  const total = payload?.mattersNarrativeCount || 0;
  return (
    <div className="samplerTileInner placesTile mattersTile mattersNarrativeTile">
      <h3 className="tileHeading">
        <Link to="/matters">{label("menu_matters")}</Link>
      </h3>
      <div className="placesTileGrid">
        {cards.map((m, i) => {
          const idx = (m.index || []).filter((x) => x?.ref);
          const item = idx.length ? idx[(seed + i) % idx.length] : null;
          const ref = item?.ref || null;
          return (
            <Link to={`/matters/${m.slug}`} className="placesTileCard samplerCard" key={m.slug}>
              <div className="placesImgWrap">
                <img
                  src={`${assetUrl}/matters/${m.slug}`}
                  alt={m.name || ""}
                  loading="lazy"
                  onError={(e) => (e.target.style.visibility = "hidden")}
                />
                <span className="peopleFaceName placesNameOverlay">{replaceNumbers(m.name)}</span>
                {m.subtitle ? (
                  <span className="peopleFaceTitle placesInfoOverlay">{clampWords(m.subtitle, 8)}</span>
                ) : null}
              </div>
              {ref ? (
                <div className="placesTileInfo samplerCardBody">
                  <span className="placesTileIndexRow">
                    <RefPill refText={ref} />
                    {item?.text ? <> {clampWords(flatten(item.text), 10)}</> : null}
                  </span>
                </div>
              ) : null}
            </Link>
          );
        })}
        <Link to="/matters" className="placesTileCard samplerCard viewAllCard" title={label("view_all")}>
          <div className="viewAllMosaic viewAllMosaicFull placesMosaic">
            {mosaic.map((m) => (
              <img
                key={m.slug}
                src={`${assetUrl}/matters/${m.slug}`}
                alt=""
                loading="lazy"
                onError={(e) => (e.target.style.visibility = "hidden")}
              />
            ))}
          </div>
          <span className="peopleFaceName viewAllOverlay">
            {total ? `+${total - data.length} ${label("menu_matters")}` : label("view_more")}
          </span>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false src/views/Home/tiles/__tests__/MattersNarrativeTile.test.js`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/MattersNarrativeTile.js frontend/webapp/src/views/Home/tiles/__tests__/MattersNarrativeTile.test.js
git commit -m "feat(home): add MattersNarrativeTile (artifacts grid)"
```

---

## Task 4: MattersMaterialTile (grid — ubiquity/ref-count forward)

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/MattersMaterialTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/MattersMaterialTile.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/MattersMaterialTile.test.js`:

```jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MattersMaterialTile from "../MattersMaterialTile";

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

test("renders a ref-count badge and subtitle, links to the matter", () => {
  const data = [{ slug: "swords", name: "Swords", subtitle: "War blade of Nephite armies", nrefs: 118 }];
  renderIn(<MattersMaterialTile data={data} seed={0} payload={{ mattersMaterialCount: 192 }} />);
  const link = screen.getByRole("link", { name: /Swords/ });
  expect(link.getAttribute("href")).toBe("/matters/swords");
  expect(screen.getByText("118×")).toBeInTheDocument();
  expect(screen.getByText(/War blade/)).toBeInTheDocument();
});

test("does not crash on empty data", () => {
  expect(() => renderIn(<MattersMaterialTile data={[]} payload={{}} />)).not.toThrow();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false src/views/Home/tiles/__tests__/MattersMaterialTile.test.js`
Expected: FAIL — `Cannot find module '../MattersMaterialTile'`.

- [ ] **Step 3: Write the component**

Create `frontend/webapp/src/views/Home/tiles/MattersMaterialTile.js`:

```jsx
import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import { clampWords } from "./textUtils";

/**
 * Material/Indefinite matters — typological classes (branch=concrete,
 * specificity!=instance) like Swords, Gold, Houses. These appear everywhere, so
 * the hook is ubiquity: a ref-count badge (nrefs) + the subtitle, not one
 * arbitrary verse. Whole card → /matters/<slug> (opens the matters popup).
 */
export default function MattersMaterialTile({ data = [], seed = 0, payload }) {
  const cards = data.slice(0, 5);
  const mosaic = data.slice(5, 17);
  const total = payload?.mattersMaterialCount || 0;
  return (
    <div className="samplerTileInner placesTile mattersTile mattersMaterialTile">
      <h3 className="tileHeading">
        <Link to="/matters">{label("menu_matters")}</Link>
      </h3>
      <div className="placesTileGrid">
        {cards.map((m) => (
          <Link to={`/matters/${m.slug}`} className="placesTileCard samplerCard" key={m.slug}>
            <div className="placesImgWrap">
              <img
                src={`${assetUrl}/matters/${m.slug}`}
                alt={m.name || ""}
                loading="lazy"
                onError={(e) => (e.target.style.visibility = "hidden")}
              />
              <span className="peopleFaceName placesNameOverlay">{replaceNumbers(m.name)}</span>
              {m.nrefs ? (
                <span className="mattersRefBadge" title={label("references")}>{m.nrefs}×</span>
              ) : null}
            </div>
            {m.subtitle ? (
              <div className="placesTileInfo samplerCardBody">
                <span className="mattersMaterialSub">{clampWords(m.subtitle, 12)}</span>
              </div>
            ) : null}
          </Link>
        ))}
        <Link to="/matters" className="placesTileCard samplerCard viewAllCard" title={label("view_all")}>
          <div className="viewAllMosaic viewAllMosaicFull placesMosaic">
            {mosaic.map((m) => (
              <img
                key={m.slug}
                src={`${assetUrl}/matters/${m.slug}`}
                alt=""
                loading="lazy"
                onError={(e) => (e.target.style.visibility = "hidden")}
              />
            ))}
          </div>
          <span className="peopleFaceName viewAllOverlay">
            {total ? `+${total - data.length} ${label("menu_matters")}` : label("view_more")}
          </span>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false src/views/Home/tiles/__tests__/MattersMaterialTile.test.js`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/MattersMaterialTile.js frontend/webapp/src/views/Home/tiles/__tests__/MattersMaterialTile.test.js
git commit -m "feat(home): add MattersMaterialTile (material typologies grid)"
```

---

## Task 5: MattersConceptTile (grid — text-forward)

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/MattersConceptTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/MattersConceptTile.test.js`

Note: concept grid cards use PLAIN clamped description text (not `getDetectedScripturesHtml`). Live scripture links would render `<a>` tags nested inside the card's own `<Link>` anchor, which is invalid HTML. Live scripture links belong to the singleton `MatterProfileTile` (Task 6), where the description is not wrapped in an anchor.

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/MattersConceptTile.test.js`:

```jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MattersConceptTile from "../MattersConceptTile";

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

test("renders a text-forward concept card linking to the matter", () => {
  const data = [
    { slug: "judgment-seat", name: "Judgment Seat", subtitle: "Civic seat of Nephite judges",
      description: "The people established a reign of judges over the land." },
  ];
  renderIn(<MattersConceptTile data={data} seed={0} payload={{ mattersConceptCount: 123 }} />);
  const link = screen.getByRole("link", { name: /Judgment Seat/ });
  expect(link.getAttribute("href")).toBe("/matters/judgment-seat");
  expect(screen.getByText(/reign of judges/)).toBeInTheDocument();
});

test("does not crash on empty data", () => {
  expect(() => renderIn(<MattersConceptTile data={[]} payload={{}} />)).not.toThrow();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false src/views/Home/tiles/__tests__/MattersConceptTile.test.js`
Expected: FAIL — `Cannot find module '../MattersConceptTile'`.

- [ ] **Step 3: Write the component**

Create `frontend/webapp/src/views/Home/tiles/MattersConceptTile.js`:

```jsx
import React from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import { clampWords, flatten } from "./textUtils";

/**
 * Concept matters (branch=concepts) — abstractions like Judgment Seat, Family,
 * Oaths. These read poorly as thumbnail mosaics, so cards are text-forward: name
 * + subtitle + a short description snippet over a muted image background.
 * Description is plain text (no scripture-link parsing) because the whole card is
 * an anchor; live scripture links live in MatterProfileTile. Card → /matters/<slug>.
 */
export default function MattersConceptTile({ data = [], seed = 0, payload }) {
  const cards = data.slice(0, 5);
  const mosaic = data.slice(5, 17);
  const total = payload?.mattersConceptCount || 0;
  return (
    <div className="samplerTileInner mattersTile mattersConceptTile">
      <h3 className="tileHeading">
        <Link to="/matters">{label("menu_matters")}</Link>
      </h3>
      <div className="mattersConceptGrid">
        {cards.map((m) => {
          const desc = flatten(m.description || m.subtitle || "");
          return (
            <Link
              to={`/matters/${m.slug}`}
              className="mattersConceptCard samplerCard"
              key={m.slug}
              style={{ backgroundImage: `url(${assetUrl}/matters/${m.slug})` }}
            >
              <div className="mattersConceptScrim">
                <span className="mattersConceptName">{replaceNumbers(m.name)}</span>
                {m.subtitle ? <span className="mattersConceptSub">{clampWords(m.subtitle, 10)}</span> : null}
                {desc ? <span className="mattersConceptDesc">{clampWords(desc, 24)}</span> : null}
              </div>
            </Link>
          );
        })}
        <Link to="/matters" className="mattersConceptCard viewAllCard mattersConceptViewAll" title={label("view_all")}>
          <div className="mattersConceptScrim">
            <span className="mattersConceptName">
              {total ? `+${total - data.length} ${label("menu_matters")}` : label("view_more")}
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false src/views/Home/tiles/__tests__/MattersConceptTile.test.js`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/MattersConceptTile.js frontend/webapp/src/views/Home/tiles/__tests__/MattersConceptTile.test.js
git commit -m "feat(home): add MattersConceptTile (concepts text-forward grid)"
```

---

## Task 6: MatterProfileTile (singleton)

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/MatterProfileTile.js`
- Modify: `frontend/webapp/src/views/Home/tiles/__tests__/ProfileTiles.test.js`

- [ ] **Step 1: Write the failing test**

Append to `frontend/webapp/src/views/Home/tiles/__tests__/ProfileTiles.test.js` (after the existing imports add the import; after the last test add the new tests):

Add to the import block at the top:

```jsx
import MatterProfileTile from "../MatterProfileTile";
```

Add at the end of the file:

```jsx
test("MatterProfileTile: deeplink hidden until the description is expanded", () => {
  const payload = {
    mattersConcept: [
      { slug: "oaths", name: "Oaths", subtitle: "Oaths in Nephite society",
        description: "A long concept description that overflows its lines.",
        xrels: [{ rel: "related", dst_type: "people", dst_slug: "nephi", dst_name: "Nephi" }] },
    ],
  };
  renderIn(<MatterProfileTile payload={payload} group="concept" matterIndex={0} />);
  expect(deep()).toBeNull();
  fireEvent.click(readMore());
  expect(deep().getAttribute("href")).toBe("/matters/oaths");
});

test("MatterProfileTile: renders a linked relationship chip", () => {
  const payload = {
    mattersConcept: [
      { slug: "oaths", name: "Oaths", description: "desc",
        xrels: [{ rel: "related", dst_type: "people", dst_slug: "nephi", dst_name: "Nephi" }] },
    ],
  };
  renderIn(<MatterProfileTile payload={payload} group="concept" matterIndex={0} />);
  expect(screen.getByText("Nephi").closest("a").getAttribute("href")).toBe("/people/nephi");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false src/views/Home/tiles/__tests__/ProfileTiles.test.js`
Expected: FAIL — `Cannot find module '../MatterProfileTile'`.

- [ ] **Step 3: Write the component**

Create `frontend/webapp/src/views/Home/tiles/MatterProfileTile.js`:

```jsx
import React from "react";
import { Link } from "react-router-dom";
import Parser from "html-react-parser";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, replaceNumbers } from "src/models/Utils";
import { getDetectedScripturesHtml, getHtmlScriptureLinkParserOptions } from "src/views/_Common/ViewUtils";
import { openScripture } from "./ScripturePopup";
import { flatten } from "./textUtils";
import ExpandableText from "./ExpandableText";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";

const scriptureOpts = getHtmlScriptureLinkParserOptions((ref) => openScripture(ref));

// Which sampler array each group draws from.
const GROUP_KEY = {
  narrative: "mattersNarrative",
  material: "mattersMaterial",
  concept: "mattersConcept",
};

// Route for an xrel target by entity type (matters share people/places routing).
const relHref = (type, slug) =>
  type === "people" ? `/people/${slug}`
  : type === "place" ? `/places/${slug}`
  : type === "matter" ? `/matters/${slug}`
  : null;

/**
 * A single-matter deep profile — hero image, name, subtitle, description with
 * detected scripture links, and its xrels relationships as linked chips. Reserve
 * tile drawn from a matter the group grid tile didn't card. Mirrors
 * PlaceProfileTile; `group` selects which sampler array to feature.
 */
export default function MatterProfileTile({ payload, group = "concept", matterIndex = 6 }) {
  const list = payload?.[GROUP_KEY[group]] || [];
  if (!list.length) return null;
  const matter = list[matterIndex % list.length] || list[list.length - 1];
  if (!matter?.slug) return null;
  const desc = flatten(matter.description || matter.subtitle || "");
  const rels = (matter.xrels || []).filter((x) => x?.dst_name).slice(0, 4);
  return (
    <RevealProvider>
      <div className="samplerTileInner placeProfileTile matterProfileTile">
        <h3 className="tileHeading">
          <Link to="/matters">{label("menu_matters")}</Link>
        </h3>
        <div className="placeProfileHead">
          <Link to={`/matters/${matter.slug}`} className="placeProfileImgLink">
            <img
              src={`${assetUrl}/matters/${matter.slug}`}
              alt={matter.name || ""}
              loading="lazy"
              onError={(e) => (e.target.style.visibility = "hidden")}
            />
            <span className="peopleFaceName placesNameOverlay">{replaceNumbers(matter.name)}</span>
          </Link>
        </div>
        {matter.subtitle ? <div className="matterProfileSub">{matter.subtitle}</div> : null}
        {desc ? (
          <ExpandableText className="placeProfileDesc" lines={5}>
            {Parser(getDetectedScripturesHtml(desc), scriptureOpts)}
          </ExpandableText>
        ) : null}
        {rels.length ? (
          <div className="matterProfileRels">
            {rels.map((x) => {
              const to = relHref(x.dst_type, x.dst_slug);
              const chip = <span className="matterRelChip">{x.dst_name}</span>;
              return to ? (
                <Link key={`${x.dst_type}-${x.dst_slug}`} to={to}>{chip}</Link>
              ) : (
                <React.Fragment key={`${x.dst_type}-${x.dst_slug}`}>{chip}</React.Fragment>
              );
            })}
          </div>
        ) : null}
        <TileDeepLink to={`/matters/${matter.slug}`}>{label("view_in_context")}</TileDeepLink>
      </div>
    </RevealProvider>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false src/views/Home/tiles/__tests__/ProfileTiles.test.js`
Expected: PASS (existing 2 tests + new 2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/MatterProfileTile.js frontend/webapp/src/views/Home/tiles/__tests__/ProfileTiles.test.js
git commit -m "feat(home): add MatterProfileTile singleton (group-param)"
```

---

## Task 7: Register tiles + add CSS

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/registry.js`
- Modify: `frontend/webapp/src/views/Home/Sampler.css`
- Modify: `frontend/webapp/src/views/Home/tiles/__tests__/registry.test.js`

- [ ] **Step 1: Write the failing registry test**

Append to `frontend/webapp/src/views/Home/tiles/__tests__/registry.test.js`, inside the `describe("tile registry", …)` block (before its closing `});`):

```jsx
  test("registers the three matters grid tiles and the profile reserve", () => {
    const gridKeys = tileRegistry.map((t) => t.key);
    ["mattersNarrative", "mattersMaterial", "mattersConcept"].forEach((k) =>
      expect(gridKeys).toContain(k)
    );
    expect(reservePool.map((t) => t.key)).toContain("matterProfile");
    expect(batchTiles.map((t) => t.key)).toContain("matterProfile");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false src/views/Home/tiles/__tests__/registry.test.js`
Expected: FAIL — `expect(gridKeys).toContain("mattersNarrative")`.

- [ ] **Step 3: Wire up the registry**

In `frontend/webapp/src/views/Home/tiles/registry.js`:

Add imports after the existing tile imports (after the `import JosephSmithTile …` line):

```js
import MattersNarrativeTile from "./MattersNarrativeTile";
import MattersMaterialTile from "./MattersMaterialTile";
import MattersConceptTile from "./MattersConceptTile";
import MatterProfileTile from "./MatterProfileTile";
```

Add three entries to `tileRegistry` (after the `places` entry, line ~53):

```js
  { key: "mattersNarrative", component: MattersNarrativeTile, span: "tile-mattersNarrative", isReady: (p) => (p?.mattersNarrative?.length || 0) > 0 },
  { key: "mattersMaterial",  component: MattersMaterialTile,  span: "tile-mattersMaterial",  isReady: (p) => (p?.mattersMaterial?.length || 0) > 0 },
  { key: "mattersConcept",   component: MattersConceptTile,   span: "tile-mattersConcept",   isReady: (p) => (p?.mattersConcept?.length || 0) > 0 },
```

Add one entry to `reservePool` (after the `placeProfile` entry):

```js
  { key: "matterProfile", component: MatterProfileTile, props: { group: "concept" }, isReady: (p) => (p?.mattersConcept?.length || 0) > 5 },
```

In `INFINITE_REGISTRY_KEYS`, add the three grid keys:

```js
const INFINITE_REGISTRY_KEYS = ["art", "commentary", "commentary2", "commentary3", "history", "fax", "faxVerse", "places", "biblephrases", "chiasmus", "text", "notes", "mattersNarrative", "mattersMaterial", "mattersConcept"];
```

Add one entry to `batchTiles` (after the `placeProfile` batch entry):

```js
  { key: "matterProfile", component: MatterProfileTile, props: { group: "concept" }, isReady: (p) => (p?.mattersConcept?.length || 0) > 0, span: "tile-matterProfile" },
```

- [ ] **Step 4: Run the registry test to verify it passes**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false src/views/Home/tiles/__tests__/registry.test.js`
Expected: PASS (existing tests + the new one).

- [ ] **Step 5: Add the CSS**

Append to `frontend/webapp/src/views/Home/Sampler.css`:

```css
/* --- Matters tiles ------------------------------------------------------- */
/* Grid tiles reuse the Places footprint; the layout is JS-binned masonry, so
   the span classes only need to exist (skeleton sizing + hooks). */
.tile.skeleton.tile-mattersNarrative,
.tile.skeleton.tile-mattersMaterial,
.tile.skeleton.tile-mattersConcept { min-height: 15rem; }
.tile.skeleton.tile-matterProfile { min-height: 18rem; }

/* Material: ref-count badge over the image (top-right). */
.mattersRefBadge {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  padding: 0.05rem 0.4rem;
  border-radius: 0.7rem;
  background: rgba(0, 0, 0, 0.62);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.4;
  pointer-events: none;
}
.mattersMaterialSub { font-size: 0.8rem; color: inherit; }

/* Concept: text-forward cards over a muted image background. */
.mattersConceptGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}
.mattersConceptCard {
  position: relative;
  display: block;
  min-height: 8.5rem;
  border-radius: 0.4rem;
  overflow: hidden;
  color: #fff;
  text-decoration: none;
  background-size: cover;
  background-position: center;
  min-width: 0;
}
.mattersConceptScrim {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  height: 100%;
  padding: 0.5rem;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.78) 70%);
  justify-content: flex-end;
}
.mattersConceptName { font-weight: 700; font-size: 0.9rem; line-height: 1.15; }
.mattersConceptSub { font-size: 0.72rem; opacity: 0.9; }
.mattersConceptDesc { font-size: 0.72rem; opacity: 0.82; margin-top: 0.15rem; }
.mattersConceptViewAll .mattersConceptScrim { align-items: center; justify-content: center; }

/* Singleton profile: subtitle + relationship chips. */
.matterProfileSub { font-size: 0.85rem; opacity: 0.8; margin: 0.2rem 0 0.4rem; }
.matterProfileRels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0.4rem 0;
}
.matterProfileRels a { text-decoration: none; }
.matterRelChip {
  display: inline-block;
  padding: 0.05rem 0.5rem;
  border-radius: 0.7rem;
  background: rgba(0, 0, 0, 0.08);
  font-size: 0.75rem;
  color: inherit;
}
html[data-theme="dark"] .matterRelChip { background: rgba(255, 255, 255, 0.12); }
```

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Home/tiles/registry.js frontend/webapp/src/views/Home/Sampler.css frontend/webapp/src/views/Home/tiles/__tests__/registry.test.js
git commit -m "feat(home): register matters tiles + add matters tile styles"
```

---

## Task 8: Integration verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full frontend tile test suite**

Run: `cd frontend/webapp && CI=true npm test -- --watchAll=false src/views/Home/`
Expected: PASS — all Home tests green, including the four new tiles, the registry, and `Sampler`/`assemblePayload` (the new keys pass through `assembleSampler` untouched, so those tests remain green).

- [ ] **Step 2: Run the full backend graphql test suite**

Run: `cd backend && npx vitest run test/graphql/`
Expected: PASS — `homesampler.test.ts`, `homesampler-matters.test.ts`, and cache tests green.

- [ ] **Step 3: Verify the live payload carries the matters groups**

Restart the dev backend (KC pre-authorized) and query it:

```bash
systemctl --user restart bom-greenfield
sleep 4
curl -s -X POST http://localhost:5006/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ homesampler(seed:12345){ mattersNarrative{slug branch specificity} mattersMaterial{slug branch specificity} mattersConcept{slug branch} mattersNarrativeCount mattersMaterialCount mattersConceptCount } }"}' \
  | python3 -m json.tool | head -40
```
Expected: three non-empty arrays with the right branch/specificity per group, and three counts (~161/192/123).

- [ ] **Step 4: Visually confirm the tiles render**

Load `http://localhost:8200` (NOT `bom.kckern.net` — Cloudflare caches the dev bundle). Confirm the three matters grid tiles appear in the sampler and the concept profile can surface via the reserve balancer / on infinite scroll. Screenshot for the report.

- [ ] **Step 5: Final commit (if any lint/format fixups were needed)**

```bash
git add -A
git commit -m "chore(home): matters tiles verification fixups" || echo "nothing to commit"
```

---

## Self-review notes

- **Spec coverage:** three group grid tiles (Tasks 3–5), shared singleton (Task 6), GQL fields + samplers + cache bump (Task 1), frontend query (Task 2), registry + CSS (Task 7), tests throughout, live verification (Task 8). All spec sections mapped.
- **Card target:** every card links to `/matters/<slug>` (opens the matters popup) per the approved decision.
- **Type/name consistency:** sampler field keys (`mattersNarrative`/`mattersMaterial`/`mattersConcept` + `*Count`) are identical across schema, resolver, frontend query, registry `isReady`, and tile `payload` reads. `Xrel` fields are snake_case (`dst_type`/`dst_slug`/`dst_name`) in both the query (Task 2) and `MatterProfileTile` (Task 6).
- **Label keys:** `menu_matters`, `view_all`, `view_more`, `view_in_context`, `references` — `label()` echoes the key if a dictionary entry is missing, so tiles degrade gracefully; add a `references` label entry later if the raw key is undesirable.
- **Nested-anchor guard:** concept grid cards use plain text (no scripture-link parsing); live scripture links are confined to `MatterProfileTile`, where the description is not inside an anchor.
```
