# Multi-Edition Cropped-Verse FaxVerseTile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the FaxVerseTile's single whole-page thumbnail with cropped-verse images from up to 3 editions of the sampled verse, stacked and edition-labeled, each deep-linking to that edition's fax viewer.

**Architecture:** Extend the backend `faxVerse` sampler resolver to return the verse plus up-to-3 editions and a canonical render `selector` (reusing `canonicalSelector`). The frontend tile renders one cropped `<img>` per edition from the backend render route (via a new configurable `renderBaseUrl`), each wrapped in a per-edition deep link.

**Tech Stack:** Backend: TypeScript ESM, GraphQL (graphql-yoga + SDL in `backend/schema/`), Kysely, Vitest. Frontend: React 17, Jest + React Testing Library, CRA.

**Design spec:** `docs/specs/2026-07-18-fax-verse-tile-multi-edition-design.md` — read it first.

**Conventions:**
- Backend ESM: relative imports end in `.js`. Tests in `backend/test/`, run `npx vitest run <path>`. Integration tests hit the live DB.
- Frontend tests: Jest (`jest.mock`), run from `frontend/webapp/` with `npx jest <path>` (or `CI=true npx jest`). Module paths use the `src/` root alias.
- The backend render route is `/fax/render/{version}/crop/w{width}/{selector}.jpg`; `canonicalSelector([verseId])` (in `backend/src/media/fax/canonical.ts`) produces the selector.

---

## File Structure

```
backend/schema/HomeSampler.graphql                          # + FaxEdition type, editions/selector fields
backend/src/graphql/resolvers/homesampler.ts               # sampleFaxVerse: editions + selector
backend/test/graphql/homesampler-wave1.test.ts             # + faxVerse editions contract test
frontend/webapp/src/models/BoMOnlineAPI.js                 # + renderBaseUrl constant
frontend/webapp/src/models/GraphQLQueries.js               # faxVerse query: + selector editions{...}
frontend/webapp/src/views/Home/tiles/FaxVerseTile.js       # rebuild: stacked edition crops
frontend/webapp/src/views/Home/Sampler.css                 # + .faxVerseEditions styles
frontend/webapp/src/views/Home/tiles/__tests__/FaxVerseTile.test.js  # updated tests
```

---

## Task 1: Backend — `faxVerse` returns editions + selector

**Files:**
- Modify: `backend/schema/HomeSampler.graphql`
- Modify: `backend/src/graphql/resolvers/homesampler.ts`
- Test: `backend/test/graphql/homesampler-wave1.test.ts`

- [ ] **Step 1: Write the failing test** — append this describe block to `backend/test/graphql/homesampler-wave1.test.ts` (reuse the existing `exec` helper defined in that file):

```ts
describe('faxVerse editions', () => {
  it('returns the sampled edition first plus up to 3 editions with a shared selector', async () => {
    type FV = { faxVerse: {
      version: string; verseId: number; ref: string; selector: string;
      editions: { version: string; title: string | null; page: number }[];
    } | null };
    const d = await exec<FV>('faxVerse { version verseId ref selector editions { version title page } }', 7);
    expect(d.faxVerse).toBeTruthy();
    const fv = d.faxVerse!;
    expect(fv.editions.length).toBeGreaterThanOrEqual(1);
    expect(fv.editions.length).toBeLessThanOrEqual(3);
    expect(fv.editions[0]!.version).toBe(fv.version);          // sampled edition first
    expect(fv.selector).toMatch(/^([a-z0-9.-]+|ids\/[0-9-]+)$/); // canonical render selector
    for (const e of fv.editions) expect(e.page).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/graphql/homesampler-wave1.test.ts -t "faxVerse editions"`
Expected: FAIL — GraphQL error "Cannot query field \"selector\"/\"editions\" on type \"FaxVersePage\"".

- [ ] **Step 3: Extend the schema** — in `backend/schema/HomeSampler.graphql`, replace the `FaxVersePage` type (currently lines ~101-108) with:

```graphql
type FaxEdition {
  version: String!
  title: String
  page: Int!
}

type FaxVersePage {
  version: String
  title: String
  format: String
  page: Int
  verseId: Int
  ref: String
  selector: String
  editions: [FaxEdition!]!
}
```

- [ ] **Step 4: Extend the resolver** — in `backend/src/graphql/resolvers/homesampler.ts`:

Add the import near the other imports at the top of the file:
```ts
import { canonicalSelector } from '../../media/fax/canonical.js';
```

Replace the `sampleFaxVerse` function body's `return { ... }` and add the editions query. The full updated function:
```ts
const sampleFaxVerse = async (ctx: AppContext, seed: number) => {
  const rows = await ctx.db
    .selectFrom('bom_xtras_fax_index as i')
    .innerJoin('bom_xtras_fax as f', 'f.slug', 'i.version')
    .select(['i.version as version', 'i.page as page', 'i.verse_id as verseId', 'f.title as title', 'f.format as format'])
    .where('f.hide', '=', 0)
    .where('i.verse_id', 'is not', null)
    .orderBy(sql`MD5(CONCAT(${sql.ref('i.version')}, ':', ${sql.ref('i.page')}, ':', ${seed}))`)
    .limit(1)
    .execute();
  const r = rows[0];
  if (!r) return null;
  const verseId = Number(r.verseId);

  // Every edition that has a box for this verse (one row per edition, min page).
  const edRows = await ctx.db
    .selectFrom('bom_xtras_fax_index as i')
    .innerJoin('bom_xtras_fax as f', 'f.slug', 'i.version')
    .select(['i.version as version', 'f.title as title'])
    .select((eb) => eb.fn.min('i.page').as('page'))
    .where('i.verse_id', '=', String(verseId))
    .where('f.hide', '=', 0)
    .groupBy(['i.version', 'f.title'])
    .orderBy(sql`MD5(CONCAT(${sql.ref('i.version')}, ':', ${seed}))`)
    .execute();

  // Sampled edition first, then up to 2 seeded others.
  const ordered = [
    ...edRows.filter((e) => String(e.version) === String(r.version)),
    ...edRows.filter((e) => String(e.version) !== String(r.version)),
  ].slice(0, 3);
  const editions = ordered.map((e) => ({
    version: String(e.version),
    title: e.title ?? null,
    page: Number(e.page),
  }));

  return {
    version: String(r.version),
    title: r.title ?? null,
    format: r.format || 'jpg',
    page: Number(r.page),
    verseId,
    ref: generateReference([verseId]),
    selector: canonicalSelector([verseId]),
    editions,
  };
};
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/graphql/homesampler-wave1.test.ts -t "faxVerse editions"`
Expected: PASS.

- [ ] **Step 6: Typecheck (regen GraphQL types if needed)**

Run: `cd /home/bom/BookofMormonOnline/backend && npm run typecheck`
Expected: clean. If it errors on generated GraphQL types for the new fields, run `npm run codegen:graphql` then `npm run typecheck` again, and `git add backend/codegen/graphql.ts` in the commit.

- [ ] **Step 7: Run the full homesampler suite to confirm no regression**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/graphql/homesampler-wave1.test.ts test/graphql/homesampler.test.ts`
Expected: all pass (the added block plus the pre-existing ones).

- [ ] **Step 8: Commit**

```bash
cd /home/bom/BookofMormonOnline && git add backend/schema/HomeSampler.graphql backend/src/graphql/resolvers/homesampler.ts backend/test/graphql/homesampler-wave1.test.ts && git add -A backend/codegen/graphql.ts 2>/dev/null; git commit -m "feat(homesampler): faxVerse returns up-to-3 editions + render selector"
```

---

## Task 2: Frontend — `renderBaseUrl` + query fields

**Files:**
- Modify: `frontend/webapp/src/models/BoMOnlineAPI.js`
- Modify: `frontend/webapp/src/models/GraphQLQueries.js`

- [ ] **Step 1: Add the `renderBaseUrl` constant** — in `frontend/webapp/src/models/BoMOnlineAPI.js`, immediately after the existing `export const assetUrl = "https://media.bookofmormon.online";` line, add:

```js
// Base origin for the dynamic facsimile render API (/fax/render/...). Served by
// the backend, NOT the media CDN (yet). Flip to the media host once CloudFront
// origin-failover is wired. Same-origin fallback when the env var is unset.
export const renderBaseUrl = process.env.REACT_APP_API_URL || "";
```

- [ ] **Step 2: Add the new fields to the faxVerse query** — in `frontend/webapp/src/models/GraphQLQueries.js` line ~1789, change:

```js
        faxVerse { version title format page verseId ref }
```
to:
```js
        faxVerse { version title format page verseId ref selector editions { version title page } }
```

- [ ] **Step 3: Verify the query file still parses (build sanity)**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && node -e "require('@babel/core')" 2>/dev/null; node --check src/models/BoMOnlineAPI.js && echo "BoMOnlineAPI OK"`
Expected: `BoMOnlineAPI OK` (GraphQLQueries.js is a template-literal string, so a syntax check of the JS file is the meaningful check: `node --check src/models/GraphQLQueries.js && echo "Queries OK"`).

- [ ] **Step 4: Commit**

```bash
cd /home/bom/BookofMormonOnline && git add frontend/webapp/src/models/BoMOnlineAPI.js frontend/webapp/src/models/GraphQLQueries.js && git commit -m "feat(home): renderBaseUrl + faxVerse editions/selector query fields"
```

---

## Task 3: Frontend — FaxVerseTile stacked edition crops + CSS

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/FaxVerseTile.js`
- Modify: `frontend/webapp/src/views/Home/Sampler.css`
- Test: `frontend/webapp/src/views/Home/tiles/__tests__/FaxVerseTile.test.js`

- [ ] **Step 1: Rewrite the test** — replace the entire contents of `frontend/webapp/src/views/Home/tiles/__tests__/FaxVerseTile.test.js` with:

```js
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FaxVerseTile from "../FaxVerseTile";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
  renderBaseUrl: "http://localhost:5006",
}));
jest.mock("src/views/_Common/ScripturePopup", () => ({
  __esModule: true,
  default: () => null,
  openScripture: jest.fn(),
}));
jest.mock("src/views/_Common/ScriptureExcerpt", () => ({
  __esModule: true,
  default: () => null,
}));
import { openScripture } from "src/views/_Common/ScripturePopup";

const data = {
  version: "1830",
  title: "1830 Edition",
  format: "jpg",
  page: 117,
  verseId: 15234,
  ref: "Mosiah 2:17",
  selector: "mosiah-2.17",
  editions: [
    { version: "1830", title: "1830 Edition", page: 117 },
    { version: "1837", title: "1837 Edition", page: 120 },
    { version: "2013", title: "2013 Edition", page: 250 },
  ],
};

const renderTile = (d) =>
  render(
    <MemoryRouter>
      <FaxVerseTile data={d} />
    </MemoryRouter>
  );

describe("FaxVerseTile", () => {
  test("renders one cropped image per edition with render URL + per-edition deep link", () => {
    renderTile(data);
    const img = screen.getByAltText("1830 Edition Mosiah 2:17");
    expect(img.getAttribute("src")).toBe(
      "http://localhost:5006/fax/render/1830/crop/w800/mosiah-2.17.jpg"
    );
    expect(img.closest("a").getAttribute("href")).toBe("/fax/1830/mosiah.2.17");
    expect(screen.getAllByRole("img").length).toBe(3);
  });

  test("ref bar opens the scripture popup", () => {
    renderTile(data);
    fireEvent.click(screen.getByText("Mosiah 2:17"));
    expect(openScripture).toHaveBeenCalledWith("Mosiah 2:17");
  });

  test("falls back to a single row from legacy fields when editions is absent", () => {
    const legacy = { ...data, editions: undefined };
    renderTile(legacy);
    expect(screen.getAllByRole("img").length).toBe(1);
  });

  test("returns null without data", () => {
    const { container } = renderTile(null);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx jest src/views/Home/tiles/__tests__/FaxVerseTile.test.js`
Expected: FAIL (component still renders the old single thumbnail; alt text / img count mismatch).

- [ ] **Step 3: Rewrite the component** — replace the entire contents of `frontend/webapp/src/views/Home/tiles/FaxVerseTile.js` with:

```jsx
import React from "react";
import { Link } from "react-router-dom";
import { renderBaseUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import ScriptureExcerpt from "src/views/_Common/ScriptureExcerpt";
import { openScripture } from "./ScripturePopup";

const CROP_WIDTH = 800;

// The app's existing fax-viewer ref-slug convention, e.g. "Mosiah 2:17" -> "mosiah.2.17".
const refSlug = (ref) => (ref || "").replace(/[ :]+/g, ".").toLowerCase();

/**
 * A sampled verse shown as cropped-verse facsimile images from up to 3 editions,
 * stacked and edition-labeled. Each crop deep-links to that edition's fax viewer
 * at the verse. The verse text is rendered below via ScriptureExcerpt.
 */
export default function FaxVerseTile({ data }) {
  if (!data || (!data.selector && !data.version)) return null;

  // Prefer the editions list; fall back to a single row from legacy fields.
  const editions =
    data.editions && data.editions.length
      ? data.editions
      : data.version
      ? [{ version: data.version, title: data.title, page: data.page }]
      : [];
  if (!editions.length) return null;

  const selector = data.selector || null;
  const slug = refSlug(data.ref);

  const hideRow = (e) => {
    const row = e.target.closest(".faxEditionRow");
    if (row) row.style.display = "none";
  };

  return (
    <div className="samplerTileInner faxVerseTile">
      <h3 className="tileHeading">
        <Link to="/fax">{label("facsimiles")}</Link>
      </h3>
      <div className="faxVerseEditions">
        {editions.map((ed) => {
          const to = slug ? `/fax/${ed.version}/${slug}` : `/fax/${ed.version}/${ed.page}`;
          const src = selector
            ? `${renderBaseUrl}/fax/render/${ed.version}/crop/w${CROP_WIDTH}/${selector}.jpg`
            : null;
          return (
            <Link key={ed.version} to={to} className="faxEditionRow">
              <span className="faxEditionLabel">{ed.title || ed.version}</span>
              {src ? (
                <img
                  className="faxEditionCrop"
                  src={src}
                  alt={`${ed.title || ed.version} ${data.ref || ""}`.trim()}
                  loading="lazy"
                  onError={hideRow}
                />
              ) : null}
            </Link>
          );
        })}
      </div>
      <span className="faxPageBar">
        {data.ref ? (
          <span
            className="faxPageBarRef"
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openScripture(data.ref);
            }}
          >
            {data.ref}
          </span>
        ) : (
          <span />
        )}
      </span>
      {data.title ? <div className="faxVerseTitle">{data.title}</div> : null}
      {data.ref ? (
        <div className="read-content scriptureExcerptCompact">
          <ScriptureExcerpt refText={data.ref} hideStudy />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx jest src/views/Home/tiles/__tests__/FaxVerseTile.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the CSS** — append to `frontend/webapp/src/views/Home/Sampler.css`:

```css
/* Multi-edition cropped-verse facsimile tile */
.faxVerseTile .faxVerseEditions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 6px 0;
}
.faxVerseTile .faxEditionRow {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
}
.faxVerseTile .faxEditionLabel {
  font-size: 0.72rem;
  opacity: 0.7;
  margin-bottom: 2px;
}
.faxVerseTile .faxEditionCrop {
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 3px;
  background: #faf7f0;
}
```

- [ ] **Step 6: Re-run the tile test (CSS import must not break it)**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx jest src/views/Home/tiles/__tests__/FaxVerseTile.test.js`
Expected: PASS (unchanged).

- [ ] **Step 7: Commit**

```bash
cd /home/bom/BookofMormonOnline && git add frontend/webapp/src/views/Home/tiles/FaxVerseTile.js frontend/webapp/src/views/Home/Sampler.css frontend/webapp/src/views/Home/tiles/__tests__/FaxVerseTile.test.js && git commit -m "feat(home): FaxVerseTile shows stacked cropped-verse crops per edition"
```

---

## Task 4: Live verification + regression

**Files:** none (verification only)

- [ ] **Step 1: Restart the backend so the schema/resolver change is live**

Run: `systemctl --user restart bom-greenfield` then wait for health:
`for i in $(seq 1 30); do curl -sf -o /dev/null http://localhost:5006/health && break; sleep 1; done; echo up`

- [ ] **Step 2: Confirm the resolver returns editions + selector**

Run:
```bash
curl -s http://localhost:5006/graphql -H 'content-type: application/json' \
  -d '{"query":"query($s:Int){homesampler(seed:$s){faxVerse{version ref selector editions{version title page}}}}","variables":{"s":7}}' | head -c 600; echo
```
Expected: JSON with `faxVerse.selector` a slug and `faxVerse.editions` an array of ≤3 `{version,title,page}`, the first matching `faxVerse.version`.

- [ ] **Step 3: Confirm a crop URL renders for one of the returned editions**

Take a `version` + `selector` from Step 2 and run:
```bash
curl -s -o /tmp/tile-crop.jpg -w "%{http_code} %{content_type}\n" \
  "http://localhost:5006/fax/render/<version>/crop/w800/<selector>.jpg"
```
Expected: `200 image/jpeg`. Optionally open/Read `/tmp/tile-crop.jpg` to confirm it's a legible cropped verse.

- [ ] **Step 4: Frontend regression — run the Home tiles test folder**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx jest src/views/Home/tiles/__tests__/`
Expected: the tile suite passes; note (do not fix) any pre-existing unrelated failures.

- [ ] **Step 5: Backend regression — fax + homesampler suites**

Run: `cd /home/bom/BookofMormonOnline/backend && npx vitest run test/fax/ test/graphql/homesampler-wave1.test.ts test/graphql/homesampler.test.ts`
Expected: all pass.

---

## Out of scope (tracked elsewhere)

- Wiring the render endpoint onto the media CDN (CloudFront failover) — the `renderBaseUrl` constant is the switch point.
- Fixing edition-specific verse-box alignment data quirks (e.g. some 2013 boxes on chapter headings).
