# Entity Standalone Pages Implementation Plan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A direct load of `/people/noah1`, `/places/zarahemla`, `/matters/<slug>`, `/history/<slug>`, `/art/<id>` renders a standalone full-page view; clicking the same entity inside the app still opens the modal over your current context.

**Architecture:** No new routing machinery. The CRA already has two independent `createBrowserHistory()` instances — the Router listens to `App.js`'s, while `setPopUp`/`setSlug` push through `models/routeHistory.js`. In-app clicks therefore never reach the Router, which means **an entity item route can only mount on direct arrival** (fresh load, Back/Forward, or a real `<Link>`). So the item routes simply render a page component, the click path is untouched, and "maximize" is `routerHistory.replace(samePath)` to let the Router catch up to a URL that is already correct.

**Tech Stack:** React 17, react-router-dom 5.3.4, history 4.10.1, jest via react-scripts, @testing-library/react 11.

**Spec:** `docs/specs/2026-09-24-entity-url-presentation-model.md` — Phase 2 implements §1-§4. Phase 1 (§5-§6, SSR) is already merged.

## Global Constraints

- **Do NOT unify the two history instances.** The spec proposed it; investigation found 57 `push`/`replace` call sites across 10 files (Read, Timeline, Facsimiles, Theater, Sidebar, Welcome), all on the instance the Router ignores. Unifying would make every one of them drive Router re-renders — including the facsimile viewer's per-page-turn URL sync. Out of scope for this phase, and the approach below does not need it. Decision recorded 2026-09-24; see the Deviations section.
- **The click path must not change.** `setPopUp` → `setSlug` → `routeHistory.push` stays exactly as it is. Any task that alters modal-open behavior has gone wrong.
- **`commentary` never renders full-page** — licensing requires in-context only. Its deep links keep today's `Page.js` behavior (resolve to parent chapter, reopen modal). **`victory` stays modal-only.** Both are enforced by an explicit allowlist, not by omission.
- **Variant rule is exactly** `^<requested>-?\d+$`, case-insensitive, exact-match-wins — identical to Phase 1's `frontend/next/lib/slug-variants.ts`. A drift guard test keeps the two copies honest.
- **Entity thumbnails** are `${assetUrl}/<type>/<slug>` and art is `${assetUrl}/art/${id}`, where `assetUrl` is `https://media.bookofmormon.online` (exported from `src/models/BoMOnlineAPI.js`).
- **House style:** links are black, secondary UI neutral gray, gold `#c9a24b` is the only accent. Never `#345496`.
- **Commit style:** imperative, capitalized, no conventional-commit prefix. Every commit ends with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
  ```
- **Run CRA tests from `frontend/webapp/`**: `CI=true npx react-scripts test --testPathPattern <pattern>`. `CI=true` is required or the runner sits in watch mode forever. **8 test failures pre-date this work** and are out of scope — record the count before you start and compare, never assume green.
- **Verify in the browser at `http://localhost:8200` only** — never `bom.kckern.net`, which Cloudflare caches for 4 hours.

## Why the item route can only mount on direct arrival

This is the load-bearing fact of the whole plan. Verify it before Task 4 and stop if it does not hold:

- `src/App.js:27` creates a history instance and passes it to `<Router history={history}>`.
- `src/models/routeHistory.js` creates a **second** instance; `appController.setSlug` (`appController.js:208`) pushes through that one.
- In `history@4.10.1`, `push()` notifies only its own listeners, and `pushState` fires no `popstate`. The Router never learns about a `setSlug` push.
- Therefore: clicking a person updates the address bar and leaves `<Switch>` (`views/_Common/Main.js:181`) mounted on the previous route. The chapter/grid/map behind the modal stays put — which is exactly today's desired behavior, achieved by accident.
- Conversely, `<Switch>` matching `/people/:personName` means the Router's own location is that URL, which only happens on a cold load, a Back/Forward popstate, or a `<Link>`/`Redirect` navigation.

Confirm with: open `http://localhost:8200/people`, click a person, and observe the URL change to `/people/<slug>` while the grid stays behind the modal. Then reload and observe today's index+modal (which this phase replaces with a page).

## File structure

**New:**
- `src/models/slugVariants.js` — CRA port of `resolveSlug`. One responsibility: turn a requested slug + known list into `exact | redirect | chooser | none`.
- `src/views/_Common/entity/PersonBody.js`, `PlaceBody.js`, `MatterBody.js`, `HistoryBody.js` — the `.ppbody` content of each entity, data supplied by props. Rendered by both the modal and the page.
- `src/views/_Common/entity/useEntityData.js` — fetch hook for page mode (local state; does not touch `popUpData`, so the modal path is unaffected).
- `src/views/Entity/EntityPage.js` — page shell: heading, back-link, body, chooser state.
- `src/views/Entity/ArtPage.js` — standalone art view (no popup body exists to reuse).

**Modified:**
- `src/views/_Common/PopUp.js` — keeps modal chrome (Draggable, `#popUp` card, header, close ×), delegates content to the bodies, gains the maximize control.
- `src/models/Routes.js` — item routes point at `EntityPage`/`ArtPage`.

**Deleted:**
- `src/views/History/RedirectReceptionSlug.jsx` — `/history/:slug` becomes the document page, matching what SSR has always meant by that URL.

---

### Task 1: Port the slug-variant rule to the CRA

**Files:**
- Create: `frontend/webapp/src/models/slugVariants.js`
- Create: `frontend/webapp/src/models/__tests__/slugVariants.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveSlug(requested: string, known: string[]) => { kind: 'exact'|'redirect'|'chooser'|'none', slug?: string, candidates?: string[] }` — the same contract as `frontend/next/lib/slug-variants.ts`.

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/models/__tests__/slugVariants.test.js`:

```js
import fs from "fs";
import path from "path";
import { resolveSlug } from "../slugVariants";

// Same fixtures as frontend/next/test/unit/slug-variants.test.ts — the two
// implementations must agree outcome-for-outcome.
const PEOPLE = [
  "noah1", "noah2", "noah3", "noahs-priests", "people-of-noah",
  "nephi1", "nephi2", "nephites", "nephihah", "nephite-spies",
  "shem2",
  "angels-to-nephi", "angels-to-nephi3",
  "abinadi",
];
const PLACES = ["jerusalem-1", "jerusalem-2", "zarahemla", "bountiful-1"];

describe("resolveSlug", () => {
  test("exact slug wins even when numeric variants exist", () => {
    expect(resolveSlug("angels-to-nephi", PEOPLE)).toEqual({ kind: "exact", slug: "angels-to-nephi" });
    expect(resolveSlug("abinadi", PEOPLE)).toEqual({ kind: "exact", slug: "abinadi" });
  });

  test("exactly one variant → redirect", () => {
    expect(resolveSlug("shem", PEOPLE)).toEqual({ kind: "redirect", slug: "shem2" });
    expect(resolveSlug("bountiful", PLACES)).toEqual({ kind: "redirect", slug: "bountiful-1" });
  });

  test("several variants → chooser, in dataset order", () => {
    expect(resolveSlug("noah", PEOPLE)).toEqual({ kind: "chooser", candidates: ["noah1", "noah2", "noah3"] });
    expect(resolveSlug("jerusalem", PLACES)).toEqual({ kind: "chooser", candidates: ["jerusalem-1", "jerusalem-2"] });
  });

  test("rejects the loose prefix matches the old startsWith rule accepted", () => {
    expect(resolveSlug("noah", PEOPLE).candidates).not.toContain("noahs-priests");
    expect(resolveSlug("nephi", PEOPLE).candidates).toEqual(["nephi1", "nephi2"]);
  });

  test("no match → none", () => {
    expect(resolveSlug("king-noah", PEOPLE)).toEqual({ kind: "none" });
    expect(resolveSlug("", PEOPLE)).toEqual({ kind: "none" });
  });

  test("input is case-insensitive and trimmed", () => {
    expect(resolveSlug("NOAH", PEOPLE)).toEqual({ kind: "chooser", candidates: ["noah1", "noah2", "noah3"] });
    expect(resolveSlug("  Shem ", PEOPLE)).toEqual({ kind: "redirect", slug: "shem2" });
  });

  test("regex metacharacters are escaped, not interpreted", () => {
    expect(resolveSlug("noah.", PEOPLE)).toEqual({ kind: "none" });
    expect(resolveSlug("n(o)ah", PEOPLE)).toEqual({ kind: "none" });
  });

  // Drift guard, modelled on frontend/next/test/unit/vector-taxonomy-drift.test.ts:
  // the rule now lives in two languages in two packages. If one side is edited,
  // fail here rather than let SSR and the CRA disagree about what /people/noah means.
  test("stays in sync with the SSR implementation", () => {
    const ssr = fs.readFileSync(
      path.resolve(__dirname, "../../../../next/lib/slug-variants.ts"),
      "utf8",
    );
    // The variant pattern fragment, verbatim in both files.
    expect(ssr).toContain("-?\\\\d+$");
    // Neither side may fall back to prefix matching.
    expect(ssr).not.toContain("startsWith");
    // Exact-match-wins ordering must still be present on the SSR side.
    expect(ssr.indexOf("kind: 'exact'")).toBeLessThan(ssr.indexOf("kind: 'redirect'"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "slugVariants"`
Expected: FAIL — `Cannot find module '../slugVariants'`

- [ ] **Step 3: Write minimal implementation**

Create `frontend/webapp/src/models/slugVariants.js`:

```js
/**
 * Bare-name entity slugs (/people/noah) are not real slugs — the dataset
 * disambiguates homonyms with a numeric suffix (people: noah1/noah2/noah3;
 * places: jerusalem-1/jerusalem-2).
 *
 * This is a deliberate port of frontend/next/lib/slug-variants.ts so the CRA
 * and SSR agree on what /people/noah means. __tests__/slugVariants.test.js
 * guards the two against drift — edit both or neither.
 *
 * Supersedes the old PopUp.js rule (`slug.startsWith(input)`), which was too
 * loose: 'noah' also matched noahs-priests, and 'nephi' matched 13 slugs
 * including nephites and nephihah.
 */

function normalize(input) {
  // Route params arrive decoded. Do NOT decode again: a second pass turns
  // 'noah%2531' into 'noah1' and resolves a URL that names no entity.
  return (input ?? "").trim().toLowerCase();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function resolveSlug(requested, known = []) {
  const base = normalize(requested);
  if (!base) return { kind: "none" };

  const exact = known.find((s) => String(s).toLowerCase() === base);
  if (exact) return { kind: "exact", slug: exact };

  // The optional hyphen covers both conventions in the data.
  const variant = new RegExp(`^${escapeRe(base)}-?\\d+$`);
  // Dataset order is the backend's weight order — never re-sort.
  const candidates = known.filter((s) => variant.test(String(s).toLowerCase()));

  if (candidates.length === 1) return { kind: "redirect", slug: candidates[0] };
  if (candidates.length > 1) return { kind: "chooser", candidates };
  return { kind: "none" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "slugVariants"`
Expected: PASS — 8 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/models/slugVariants.js frontend/webapp/src/models/__tests__/slugVariants.test.js
git commit -m "$(cat <<'MSG'
Port the numeric-variant slug rule to the CRA

Same contract as the SSR copy, with a drift guard so the two cannot disagree
about what /people/noah means. No callers yet.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
MSG
)"
```

---

### Task 2: Extract PersonBody and prove the seam

**Files:**
- Create: `frontend/webapp/src/views/_Common/entity/PersonBody.js`
- Create: `frontend/webapp/src/views/_Common/entity/__tests__/PersonBody.test.js`
- Modify: `frontend/webapp/src/views/_Common/PopUp.js` — the `Person()` function

**Interfaces:**
- Consumes: `resolveSlug` from Task 1.
- Produces:
  - `PersonBody({ data, setPopUpRef, PopUpRef, onEntityClick })` — renders only the `.ppbody` content (bodytext + refbox). `data` is one person record; `onEntityClick(slug)` is called when a related person is clicked.
  - `PersonChooser({ requested, candidates, onEntityClick })` — the ambiguous-slug list.

This task establishes the pattern the next task repeats three times: **the body takes its record as a prop instead of reading `appController.popUpData`, and navigation goes through an `onEntityClick` callback instead of calling `setPopUp` directly.** That is what lets the page reuse it without opening a modal.

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/_Common/entity/__tests__/PersonBody.test.js`:

```js
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PersonBody, { PersonChooser } from "../PersonBody";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({})),
  assetUrl: "https://media.bookofmormon.online",
}));

const NOAH = {
  slug: "noah2",
  name: "Noah2",
  title: "Wicked king of the Nephites",
  description: "King Noah taxed his people one fifth of all they possessed.",
  index: [],
  relations: [],
  xrels: [],
};

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("PersonBody", () => {
  test("renders the person's name, title and description from props alone", () => {
    wrap(<PersonBody data={NOAH} setPopUpRef={() => {}} PopUpRef={null} onEntityClick={() => {}} />);
    expect(screen.getByText(/Noah/)).toBeInTheDocument();
    expect(screen.getByText(/Wicked king/)).toBeInTheDocument();
    expect(screen.getByText(/taxed his people/)).toBeInTheDocument();
  });

  test("renders no modal chrome — no popUp card, no close button", () => {
    const { container } = wrap(
      <PersonBody data={NOAH} setPopUpRef={() => {}} PopUpRef={null} onEntityClick={() => {}} />,
    );
    expect(container.querySelector("#popUp")).toBeNull();
    expect(container.querySelector(".close")).toBeNull();
  });

  test("chooser lists each candidate and reports the clicked slug", () => {
    const onEntityClick = jest.fn();
    wrap(
      <PersonChooser
        requested="noah"
        candidates={[
          { slug: "noah1", name: "Noah1", title: "Son of Lamech" },
          { slug: "noah2", name: "Noah2", title: "Wicked king" },
        ]}
        onEntityClick={onEntityClick}
      />,
    );
    expect(screen.getByText(/Son of Lamech/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Wicked king/));
    expect(onEntityClick).toHaveBeenCalledWith("noah2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "PersonBody"`
Expected: FAIL — `Cannot find module '../PersonBody'`

- [ ] **Step 3: Extract the body**

Create `frontend/webapp/src/views/_Common/entity/PersonBody.js`. Move the JSX **verbatim** out of `PopUp.js`'s `Person()` — specifically the `<div className="ppbody">…</div>` block (it starts with `<div className="bodytext">` and ends after the `<div className="refbox">` block) — into this component, and move the `ofs` object with it. Import from `PopUp.js`'s existing import list whatever the moved JSX references: `processName`, `replaceNumbers`, `detectScripturesPreservingTokens`, `determineLanguage`, `renderPersonPlaceHTML`, `label`, `EntityThumb`, `Relationships`, `XrelSection`, `ReferenceList`.

`Relationships` and `ReferenceList` are currently unexported locals in `PopUp.js`. Export both (`export function Relationships`, `export function ReferenceList`) and import them here rather than moving them — they are shared with `Place`/`Matter` bodies in Task 3.

The component shape:

```jsx
export default function PersonBody({ data, setPopUpRef, PopUpRef, onEntityClick }) {
  const person = data;
  if (!person) return null;
  return (
    <div className="ppbody">
      {/* …moved bodytext + refbox JSX, with these two substitutions… */}
    </div>
  );
}
```

Two substitutions inside the moved JSX:
1. Any `appController.functions.setPopUp({ type: "people", ids: [id] })` becomes `onEntityClick(id)`.
2. `appController` references that remain (the `renderPersonPlaceHTML(…, appController, setPopUpRef)` call needs it) come from `useAppController()` called at the top of this component — import it from `src/contexts/AppControllerContext`.

Then add the chooser, replacing the `startsWith` logic that lives in `Person()` today:

```jsx
export function PersonChooser({ requested, candidates, onEntityClick }) {
  return (
    <div className="ppbody" style={{ flexDirection: "column", gap: "0.5em" }}>
      {candidates.length > 0 ? (
        candidates.map((c) => (
          <div
            key={c.slug}
            className="related_row"
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.75em", padding: "0.5em" }}
            onClick={() => onEntityClick(c.slug)}
          >
            <div className="related_avatar">
              <img src={`${assetUrl}/people/${c.slug}`} alt={c.name} />
            </div>
            <div>
              <strong>{processName(c.name)}</strong>
              {c.title && (
                <div>
                  <small>{replaceNumbers(c.title)}</small>
                </div>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="emptyState" style={{ padding: "2em", textAlign: "center" }}>
          {processName(requested)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rewire the modal to use the body**

In `PopUp.js`'s `Person()`, replace the returned `.ppbody` block with `<PersonBody … />`, keeping every piece of modal chrome (`Draggable`, `#popUp` card, `card-header`, the `close` `×`, `ScripturePanelSingle`, `Comments`) exactly as it is:

```jsx
          <div className="card-body">
            <PersonBody
              data={person}
              setPopUpRef={setPopUpRef}
              PopUpRef={PopUpRef}
              onEntityClick={(id) =>
                appController.functions.setPopUp({ type: "people", ids: [id], underSlug: "people" })
              }
            />
          </div>
```

And replace the `person === null` branch's inline candidate markup with the shared chooser, now driven by `resolveSlug` instead of `startsWith`:

```jsx
  if (person === null) {
    const activeId = appController.states.popUp.activeId;
    const list = appController.preLoad?.personList || [];
    const resolution = resolveSlug(activeId, list.map((p) => p.slug));
    if (resolution.kind === "redirect" || resolution.kind === "exact") {
      appController.functions.setPopUp({ type: "people", ids: [resolution.slug], underSlug: "people" });
      return <Loading type="Person" />;
    }
    const candidates = (resolution.candidates || []).map(
      (slug) => list.find((p) => p.slug === slug) || { slug, name: slug, title: null },
    );
    return (
      /* …existing #popUp card + card-header chrome… */
      <div className="card-body">
        <PersonChooser
          requested={activeId}
          candidates={candidates}
          onEntityClick={(slug) =>
            appController.functions.setPopUp({ type: "people", ids: [slug], underSlug: "people" })
          }
        />
      </div>
    );
  }
```

Add `import { resolveSlug } from "src/models/slugVariants";` and `import PersonBody, { PersonChooser } from "./entity/PersonBody";` to `PopUp.js`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "PersonBody"`
Expected: PASS — 3 passed

Then the modal's own coverage, plus a manual check that the click path is untouched:

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "PopUp"`
Expected: no NEW failures versus the count you recorded before starting.

Smoke: at `http://localhost:8200/people`, click a person — the modal must open over the grid, draggable, with a working close ×, exactly as before. Then visit `http://localhost:8200/people/noah` and confirm the chooser still lists the three Noahs and excludes `noahs-priests`.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/_Common/entity/PersonBody.js \
        frontend/webapp/src/views/_Common/entity/__tests__/PersonBody.test.js \
        frontend/webapp/src/views/_Common/PopUp.js
git commit -m "$(cat <<'MSG'
Extract PersonBody from the popup so a page can reuse it

Body takes its record as a prop and reports navigation through onEntityClick,
instead of reading popUpData and calling setPopUp. Modal chrome unchanged.
Chooser now uses the shared variant rule rather than loose prefix matching.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
MSG
)"
```

---

### Task 3: Extract PlaceBody, MatterBody and HistoryBody

**Files:**
- Create: `frontend/webapp/src/views/_Common/entity/PlaceBody.js`
- Create: `frontend/webapp/src/views/_Common/entity/MatterBody.js`
- Create: `frontend/webapp/src/views/_Common/entity/HistoryBody.js`
- Create: `frontend/webapp/src/views/_Common/entity/__tests__/entityBodies.test.js`
- Modify: `frontend/webapp/src/views/_Common/PopUp.js` — `Place()`, `MatterPopUp()`, `History()`

**Interfaces:**
- Consumes: `resolveSlug` (Task 1); the extraction pattern and exported `Relationships`/`ReferenceList` (Task 2).
- Produces:
  - `PlaceBody({ data, setPopUpRef, PopUpRef, onEntityClick })` + `PlaceChooser({ requested, candidates, onEntityClick })`
  - `MatterBody({ data, setPopUpRef, PopUpRef, onEntityClick })` + `MatterChooser({ requested, candidates, onEntityClick })`
  - `HistoryBody({ data })` — history documents have no relations and no chooser (slugs are unique, not numbered), so it takes no `onEntityClick`.

Each of the three extractions is the same five mechanical edits. Stated in full so this task stands alone:

1. **Move** the `<div className="ppbody">…</div>` block verbatim out of the `PopUp.js` function into the new module, together with any helper objects declared alongside it purely for that markup.
2. **Take the record as a prop** — `function PlaceBody({ data, … })`, `const place = data;` — instead of reading `appController.popUpData[appController.states.popUp.activeId]`.
3. **Replace navigation calls**: every `appController.functions.setPopUp({ type: …, ids: [id] })` inside the moved JSX becomes `onEntityClick(id)`. In `PlaceBody`, the map-link `push(\`/map/${map}/place/${place}\`)` becomes `onMapClick(map, place)`.
4. **Keep `useAppController()`** at the top of the new module only if the moved JSX still needs it — `renderPersonPlaceHTML(…, appController, setPopUpRef)` does. Import it from `src/contexts/AppControllerContext`.
5. **Leave all modal chrome in `PopUp.js`** (`Draggable`, the `#popUp` card, `card-header`, the close `×`, `ScripturePanelSingle`, `Comments`) and render the new body inside the existing `<div className="card-body">`, passing `onEntityClick` (and `onMapClick` for places) wired to `setPopUp`/`push` exactly as the old inline JSX called them.

Then replace each `startsWith` candidate block with `resolveSlug` against `appController.preLoad?.placeList` / `?.matterList`, mapping the returned `candidates` slugs back to list rows, in the same shape Task 2 used for people:

```jsx
    const list = appController.preLoad?.placeList || [];
    const resolution = resolveSlug(activeId, list.map((p) => p.slug));
    if (resolution.kind === "redirect" || resolution.kind === "exact") {
      appController.functions.setPopUp({ type: "places", ids: [resolution.slug], underSlug: "places" });
      return <Loading type="Place" />;
    }
    const candidates = (resolution.candidates || []).map(
      (slug) => list.find((p) => p.slug === slug) || { slug, name: slug, info: null },
    );
```

`Place()`'s body additionally calls `push(\`/map/${map}/place/${place}\`)` for its map links (`PopUp.js` around the `handleMapClick` helper). Pass that through as a second callback prop, `onMapClick(mapSlug, placeSlug)`, so the page can navigate with the Router instead of the popup's history instance.

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/_Common/entity/__tests__/entityBodies.test.js`:

```js
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PlaceBody from "../PlaceBody";
import MatterBody from "../MatterBody";
import HistoryBody from "../HistoryBody";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({})),
  assetUrl: "https://media.bookofmormon.online",
}));

const PLACE = {
  slug: "zarahemla",
  name: "Zarahemla",
  info: "City and land",
  description: "The chief city of the Nephites for much of their history.",
  index: [],
  maps: [],
  xrels: [],
};
const MATTER = {
  slug: "faith",
  name: "Faith",
  description: "A principle of action and power.",
  index: [],
  rels: [],
  xrels: [],
};
const DOC = {
  slug: "1830-03-26-palmyra-freeman",
  document: "Golden Bible notice",
  source: "Palmyra Freeman",
  date: "1830-03-26",
  transcript: "The greatest piece of superstition that has ever come within our knowledge.",
};

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const noop = () => {};

describe("entity bodies render from props with no modal chrome", () => {
  test("PlaceBody", () => {
    const { container } = wrap(
      <PlaceBody data={PLACE} setPopUpRef={noop} PopUpRef={null} onEntityClick={noop} onMapClick={noop} />,
    );
    expect(screen.getByText(/Zarahemla/)).toBeInTheDocument();
    expect(screen.getByText(/chief city/)).toBeInTheDocument();
    expect(container.querySelector("#popUp")).toBeNull();
  });

  test("MatterBody", () => {
    const { container } = wrap(
      <MatterBody data={MATTER} setPopUpRef={noop} PopUpRef={null} onEntityClick={noop} />,
    );
    expect(screen.getByText(/Faith/)).toBeInTheDocument();
    expect(screen.getByText(/principle of action/)).toBeInTheDocument();
    expect(container.querySelector("#popUp")).toBeNull();
  });

  test("HistoryBody", () => {
    const { container } = wrap(<HistoryBody data={DOC} />);
    expect(screen.getByText(/Golden Bible notice/)).toBeInTheDocument();
    expect(screen.getByText(/Palmyra Freeman/)).toBeInTheDocument();
    expect(screen.getByText(/greatest piece of superstition/)).toBeInTheDocument();
    expect(container.querySelector("#popUp")).toBeNull();
  });

  test("bodies render nothing rather than crashing on missing data", () => {
    expect(wrap(<PlaceBody data={null} setPopUpRef={noop} PopUpRef={null} onEntityClick={noop} onMapClick={noop} />).container).toBeEmptyDOMElement();
    expect(wrap(<MatterBody data={null} setPopUpRef={noop} PopUpRef={null} onEntityClick={noop} />).container).toBeEmptyDOMElement();
    expect(wrap(<HistoryBody data={null} />).container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "entityBodies"`
Expected: FAIL — `Cannot find module '../PlaceBody'`

- [ ] **Step 3: Extract the three bodies**

Carry out the five edits listed at the top of this task for `Place()`, `MatterPopUp()` and `History()` in turn. Each body begins with the same guard:

```jsx
export default function PlaceBody({ data, setPopUpRef, PopUpRef, onEntityClick, onMapClick }) {
  const place = data;
  if (!place) return null;
  return <div className="ppbody">{/* …moved JSX… */}</div>;
}
```

`HistoryBody` keeps the field-adaptive rendering that `History()` already documents in its comment ("every part renders only when its data is present, so a doc missing a source, date, quote, teaser, or facsimile never shows a broken element") — move that logic and the `displayDate` usage across unchanged. `displayDate` is already exported from `PopUp.js`; import it rather than duplicating.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "entityBodies|PersonBody"`
Expected: PASS — 7 passed

Smoke each modal still works at `http://localhost:8200`: click a place from `/places`, a matter from `/matters`, and an archive document from `/history/reception` — each opens its modal with working chrome, and place map links still navigate.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/_Common/entity/ frontend/webapp/src/views/_Common/PopUp.js
git commit -m "$(cat <<'MSG'
Extract place, matter and history bodies from the popup

Same seam as PersonBody: record in through props, navigation out through
callbacks, modal chrome left behind. Place map links become an onMapClick prop
so a page can navigate with the Router.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
MSG
)"
```

---

### Task 4: EntityPage for people, places and matters

**Files:**
- Create: `frontend/webapp/src/views/_Common/entity/useEntityData.js`
- Create: `frontend/webapp/src/views/Entity/EntityPage.js`
- Create: `frontend/webapp/src/views/Entity/__tests__/EntityPage.test.js`
- Modify: `frontend/webapp/src/models/Routes.js`

**Interfaces:**
- Consumes: `resolveSlug` (Task 1); `PersonBody`/`PersonChooser` (Task 2); `PlaceBody`/`PlaceChooser`, `MatterBody`/`MatterChooser` (Task 3).
- Produces:
  - `useEntityData(type, slug)` → `{ data, status }` where `type` is `'people'|'places'|'matters'|'history'` and `status` is `'loading'|'ready'|'missing'`. Fetches into local state via `BoMOnlineAPI` and never writes `appController.popUpData`, so the modal path is untouched.
  - `EntityPage({ type })` — reads the slug from `useParams()`, renders page chrome + the matching body, or the chooser for an ambiguous slug.

**This is the shippable milestone.** After this task, a direct load of a person, place or matter URL renders a page; clicks still open modals.

`EntityPage` reads whichever route param the existing route patterns already use, so `Routes.js` needs no param renaming: `personName`, `placeName`, `matterSlug`.

Both `/place/:placeName` and `/places/:placeName` map to `type: "places"`, whose `base` is `/places`. A visitor who arrives on the singular alias therefore gets `/places` links onward. That is deliberate — it matches the canonical form SSR prefers — and the singular URL still renders.

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Entity/__tests__/EntityPage.test.js`:

```js
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import EntityPage from "../EntityPage";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
  assetUrl: "https://media.bookofmormon.online",
}));

const NOAH = {
  slug: "noah2",
  name: "Noah2",
  title: "Wicked king of the Nephites",
  description: "King Noah taxed his people one fifth of all they possessed.",
  index: [],
  relations: [],
  xrels: [],
};

// Minimal appController fixture — the provider's own docblock prescribes this
// pattern for tests. personList drives chooser resolution.
const fixture = {
  states: { popUp: { open: false, type: null, ids: [], activeId: null } },
  preLoad: {
    personList: [
      { slug: "noah1", name: "Noah1", title: "Son of Lamech" },
      { slug: "noah2", name: "Noah2", title: "Wicked king" },
      { slug: "noah3", name: "Noah3", title: "Jaredite" },
      { slug: "noahs-priests", name: "Noah's priests", title: null },
    ],
  },
  popUpData: {},
  functions: { setPopUp: jest.fn(), closePopUp: jest.fn() },
};

const renderAt = (path, routePath = "/people/:personName") =>
  render(
    <AppControllerProvider appController={fixture}>
      <MemoryRouter initialEntries={[path]}>
        <Route path={routePath}>
          <EntityPage type="people" />
        </Route>
      </MemoryRouter>
    </AppControllerProvider>,
  );

describe("EntityPage", () => {
  beforeEach(() => jest.clearAllMocks());

  test("renders the entity as a page, with no modal chrome and no index grid", async () => {
    BoMOnlineAPI.mockResolvedValue({ person: { noah2: NOAH } });
    const { container } = renderAt("/people/noah2");
    await waitFor(() => expect(screen.getByText(/Wicked king/)).toBeInTheDocument());
    expect(container.querySelector("#popUp")).toBeNull();
    expect(container.querySelector(".masonry-grid")).toBeNull();
  });

  test("does not open the modal", async () => {
    BoMOnlineAPI.mockResolvedValue({ person: { noah2: NOAH } });
    renderAt("/people/noah2");
    await waitFor(() => expect(screen.getByText(/Wicked king/)).toBeInTheDocument());
    expect(fixture.functions.setPopUp).not.toHaveBeenCalled();
  });

  test("shows a back link to the index", async () => {
    BoMOnlineAPI.mockResolvedValue({ person: { noah2: NOAH } });
    renderAt("/people/noah2");
    await waitFor(() => expect(screen.getByText(/Wicked king/)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /people/i })).toHaveAttribute("href", "/people");
  });

  test("an ambiguous bare slug renders the chooser, excluding loose matches", async () => {
    BoMOnlineAPI.mockResolvedValue({ person: { noah: null } });
    renderAt("/people/noah");
    await waitFor(() => expect(screen.getByText(/Son of Lamech/)).toBeInTheDocument());
    expect(screen.getByText(/Jaredite/)).toBeInTheDocument();
    expect(screen.queryByText(/Noah's priests/)).toBeNull();
  });

  test("an unresolvable slug renders a not-found state, not a crash", async () => {
    BoMOnlineAPI.mockResolvedValue({ person: { "king-noah": null } });
    renderAt("/people/king-noah");
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "EntityPage"`
Expected: FAIL — `Cannot find module '../EntityPage'`

- [ ] **Step 3: Write the fetch hook**

Create `frontend/webapp/src/views/_Common/entity/useEntityData.js`:

```js
import { useEffect, useState } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

// Query key + response key per entity type. These are the same keys the popup
// bodies use (BoMOnlineAPI({ person: [...] }) → response.person), so the page
// and the modal read identically shaped records.
const QUERY = {
  people: { key: "person", cache: ["person"] },
  places: { key: "places", cache: [] },
  matters: { key: "matter", cache: ["matter"] },
  history: { key: "history", cache: [] },
};

/**
 * Page-mode data fetch. Deliberately keeps its result in LOCAL state rather
 * than appController.popUpData: writing popUpData goes through setPopUp, which
 * would open the modal. Costs one extra request when a visitor opens a modal
 * for the same entity they already viewed as a page; buys complete isolation
 * from the click path.
 */
export default function useEntityData(type, slug) {
  const [state, setState] = useState({ data: null, status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const spec = QUERY[type];
    if (!spec || !slug) {
      setState({ data: null, status: "missing" });
      return undefined;
    }
    setState({ data: null, status: "loading" });
    const opts = spec.cache.length ? { useCache: spec.cache } : undefined;
    BoMOnlineAPI({ [spec.key]: [slug] }, opts).then((response) => {
      if (cancelled) return;
      const record = response?.[spec.key]?.[slug] ?? null;
      setState({ data: record, status: record ? "ready" : "missing" });
    });
    return () => {
      cancelled = true;
    };
  }, [type, slug]);

  return state;
}
```

- [ ] **Step 4: Write EntityPage**

Create `frontend/webapp/src/views/Entity/EntityPage.js`:

```jsx
import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { label } from "src/models/Utils";
import { useAppController } from "src/contexts/AppControllerContext";
import { resolveSlug } from "src/models/slugVariants";
import useEntityData from "src/views/_Common/entity/useEntityData";
import { Loading } from "src/views/_Common/PopUp";
import PersonBody, { PersonChooser } from "src/views/_Common/entity/PersonBody";
import PlaceBody, { PlaceChooser } from "src/views/_Common/entity/PlaceBody";
import MatterBody, { MatterChooser } from "src/views/_Common/entity/MatterBody";
import "./EntityPage.css";

// Per-type wiring. `param` matches the existing route patterns in Routes.js, so
// no route needs renaming. `listKey` is the preLoad list used to resolve an
// ambiguous bare slug (/people/noah → noah1, noah2, noah3).
// `indexText` is the fallback when a label key is missing from the labels table
// (menu_matters and menu_history are not guaranteed to exist). Without it the
// back link would render as a bare "❮".
const TYPES = {
  people: { param: "personName", base: "/people", listKey: "personList", indexLabel: "menu_people", indexText: "People", Body: PersonBody, Chooser: PersonChooser },
  places: { param: "placeName", base: "/places", listKey: "placeList", indexLabel: "menu_places", indexText: "Places", Body: PlaceBody, Chooser: PlaceChooser },
  matters: { param: "matterSlug", base: "/matters", listKey: "matterList", indexLabel: "menu_matters", indexText: "Matters", Body: MatterBody, Chooser: MatterChooser },
};

/**
 * Standalone page view of a single entity.
 *
 * Only ever mounts on DIRECT arrival. In-app clicks push through
 * models/routeHistory.js, an instance the Router does not listen to, so a click
 * never re-renders <Switch> — the modal opens over whatever was already there.
 * See docs/specs/2026-09-24-entity-url-presentation-model.md and the
 * "Why the item route can only mount on direct arrival" section of the plan.
 */
export default function EntityPage({ type }) {
  const cfg = TYPES[type];
  const params = useParams();
  const routerHistory = useHistory();
  const appController = useAppController();
  const requested = params[cfg.param];
  const { data, status } = useEntityData(type, requested);
  const [PopUpRef, setPopUpRef] = useState(null);

  useEffect(() => {
    if (data?.name) document.title = `${data.name} | ${label("home_title")}`;
  }, [data]);

  // Page → page: clicking a related entity navigates the Router, so the visitor
  // stays in page presentation instead of getting a modal over a stale page.
  const onEntityClick = (slug) => routerHistory.push(`${cfg.base}/${slug}`);
  const onMapClick = (mapSlug, placeSlug) => routerHistory.push(`/map/${mapSlug}/place/${placeSlug}`);

  const backLink = (
    <p className="entity-page-back">
      <a href={cfg.base}>❮ {label(cfg.indexLabel) || cfg.indexText}</a>
    </p>
  );

  if (status === "loading") return <Loading type={type} />;

  if (status === "missing") {
    const list = appController.preLoad?.[cfg.listKey] || [];
    const resolution = resolveSlug(requested, list.map((x) => x.slug));

    // A non-canonical spelling or a lone variant resolves straight through.
    if (resolution.kind === "exact" || resolution.kind === "redirect") {
      routerHistory.replace(`${cfg.base}/${resolution.slug}`);
      return <Loading type={type} />;
    }

    if (resolution.kind === "chooser") {
      const candidates = resolution.candidates.map(
        (slug) => list.find((x) => x.slug === slug) || { slug, name: slug, title: null },
      );
      return (
        <div className="entity-page">
          <cfg.Chooser requested={requested} candidates={candidates} onEntityClick={onEntityClick} />
          {backLink}
        </div>
      );
    }

    return (
      <div className="entity-page">
        <div className="emptyState" style={{ padding: "2em", textAlign: "center" }}>
          {label("not_found") || "Not found"}
        </div>
        {backLink}
      </div>
    );
  }

  return (
    <div className="entity-page">
      <cfg.Body
        data={data}
        setPopUpRef={setPopUpRef}
        PopUpRef={PopUpRef}
        onEntityClick={onEntityClick}
        onMapClick={onMapClick}
      />
      {backLink}
    </div>
  );
}
```

Create `frontend/webapp/src/views/Entity/EntityPage.css`. The body JSX was written for a modal card, so the page needs to undo the popup's fixed sizing and give the content a readable measure. House style: black links, neutral gray secondary text, gold `#c9a24b` the only accent — never `#345496`.

```css
.entity-page {
  max-width: 62rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

/* The bodies were authored inside .popupwindow, which constrains height and
   scrolls internally. On a page, let the document scroll instead. */
.entity-page .ppbody {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  max-height: none;
  overflow: visible;
}

.entity-page .ppbody .bodytext {
  flex: 1 1 22rem;
  min-width: 0;
}

.entity-page .ppbody .refbox {
  flex: 0 1 18rem;
}

.entity-page-back {
  margin-top: 2rem;
}

.entity-page-back a {
  color: #000;
  text-decoration: none;
  border-bottom: 1px solid #c9a24b;
}

@media (max-width: 700px) {
  .entity-page .ppbody {
    flex-direction: column;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "EntityPage"`
Expected: PASS — 5 passed

- [ ] **Step 6: Wire the routes**

In `frontend/webapp/src/models/Routes.js`, add the lazy import beside the others at the top:

```js
const EntityPage = lazy(() => import("../views/Entity/EntityPage"));
```

Then repoint the three **item** routes, leaving each bare index route on its grid component:

```js
  {
    path: "/people/:personName",
    component: () => <EntityPage type="people" />,
  },
  // ... "/people" stays on People
  {
    path: "/place/:placeName",
    component: () => <EntityPage type="places" />,
  },
  {
    path: "/places/:placeName",
    component: () => <EntityPage type="places" />,
  },
  // ... "/places" stays on Places
  {
    path: "/matters/:matterSlug",
    component: () => <EntityPage type="matters" />,
  },
  // ... "/matters" stays on Matters
```

`Main.js` renders `<x.component />`, so an arrow component that returns the configured `EntityPage` is the idiomatic fit for this routes table and needs no change to `Main.js`.

- [ ] **Step 7: Verify the wiring in the browser**

The route table is only exercised through the full app shell, which no test mounts — verify by hand at `http://localhost:8200`:

1. `http://localhost:8200/people/noah2` in a fresh tab → standalone page, no grid behind it, no modal chrome.
2. From `http://localhost:8200/people`, click Noah² → modal over the grid, URL becomes `/people/noah2`. **This must be unchanged from before the task.**
3. From a chapter (e.g. `http://localhost:8200/lehites/3`), click a person name → modal over the chapter, chapter still behind it.
4. Reload while that modal is open → the standalone page.
5. `http://localhost:8200/places/zarahemla` and `http://localhost:8200/matters/faith` → pages. `/place/zarahemla` → page too.
6. `http://localhost:8200/people/noah` → full-page chooser listing three Noahs.

- [ ] **Step 8: Commit**

```bash
git add frontend/webapp/src/views/_Common/entity/useEntityData.js \
        frontend/webapp/src/views/Entity/ frontend/webapp/src/models/Routes.js
git commit -m "$(cat <<'MSG'
Render people, place and matter URLs as standalone pages on direct load

The item routes only mount on direct arrival, since in-app clicks push through
the history instance the Router ignores. So the route renders a page and the
click path keeps its modal, with no background-location machinery.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
MSG
)"
```

---

### Task 5: History document page

**Files:**
- Modify: `frontend/webapp/src/views/Entity/EntityPage.js` — add the `history` type
- Modify: `frontend/webapp/src/models/Routes.js` — `/history/:slug`
- Delete: `frontend/webapp/src/views/History/RedirectReceptionSlug.jsx`
- Test: `frontend/webapp/src/views/Entity/__tests__/EntityPage.history.test.js`

**Interfaces:**
- Consumes: `EntityPage` (Task 4), `HistoryBody` (Task 3), `useEntityData` (Task 4).
- Produces: nothing new.

This is a behavior fix as much as a presentation change. Archive doc slugs are shared across four archives (reception, translation, witnesses, joseph-smith), but `setSlug` always pushes `/history/<slug>`, so reloading a *witnesses* document currently lands it under the **reception** hub via `RedirectReceptionSlug.jsx`. SSR has always treated `/history/<slug>` as the document itself (`frontend/next/app/history/[slug]/page.tsx`); this makes the CRA agree.

History documents have unique, non-numbered slugs, so there is no chooser for this type — an unknown slug goes straight to the not-found state.

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Entity/__tests__/EntityPage.history.test.js`:

```js
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import EntityPage from "../EntityPage";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
  assetUrl: "https://media.bookofmormon.online",
}));

const DOC = {
  slug: "1830-03-26-palmyra-freeman",
  document: "Golden Bible notice",
  source: "Palmyra Freeman",
  date: "1830-03-26",
  transcript: "The greatest piece of superstition that has ever come within our knowledge.",
};

const fixture = {
  states: { popUp: { open: false, type: null, ids: [], activeId: null } },
  preLoad: {},
  popUpData: {},
  functions: { setPopUp: jest.fn(), closePopUp: jest.fn() },
};

const renderDoc = (slug) =>
  render(
    <AppControllerProvider appController={fixture}>
      <MemoryRouter initialEntries={[`/history/${slug}`]}>
        <Route path="/history/:slug">
          <EntityPage type="history" />
        </Route>
      </MemoryRouter>
    </AppControllerProvider>,
  );

describe("EntityPage — history documents", () => {
  beforeEach(() => jest.clearAllMocks());

  test("renders the document itself, not a redirect to the reception hub", async () => {
    BoMOnlineAPI.mockResolvedValue({ history: { [DOC.slug]: DOC } });
    renderDoc(DOC.slug);
    await waitFor(() => expect(screen.getByText(/Golden Bible notice/)).toBeInTheDocument());
    expect(screen.getByText(/greatest piece of superstition/)).toBeInTheDocument();
  });

  test("does not open the modal", async () => {
    BoMOnlineAPI.mockResolvedValue({ history: { [DOC.slug]: DOC } });
    renderDoc(DOC.slug);
    await waitFor(() => expect(screen.getByText(/Golden Bible notice/)).toBeInTheDocument());
    expect(fixture.functions.setPopUp).not.toHaveBeenCalled();
  });

  test("unknown slug renders not-found (history slugs have no numeric variants)", async () => {
    BoMOnlineAPI.mockResolvedValue({ history: { nope: null } });
    renderDoc("nope");
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "EntityPage.history"`
Expected: FAIL — `TYPES[type]` is undefined for `history`, so `cfg.param` throws

- [ ] **Step 3: Add the history type**

In `EntityPage.js`, add to `TYPES`:

```js
  history: { param: "slug", base: "/history", listKey: null, indexLabel: "menu_history", indexText: "History", Body: HistoryBody, Chooser: null },
```

Import it: `import HistoryBody from "src/views/_Common/entity/HistoryBody";`

Guard the two places that assume a list and a chooser exist, so the `null`s above are safe:

```js
    const list = cfg.listKey ? appController.preLoad?.[cfg.listKey] || [] : [];
    const resolution = cfg.Chooser ? resolveSlug(requested, list.map((x) => x.slug)) : { kind: "none" };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "EntityPage"`
Expected: PASS — 8 passed

- [ ] **Step 5: Wire the route and delete the redirect**

In `Routes.js`, replace the `/history/:slug` entry:

```js
  {
      path: "/history/:slug",
      component: () => <EntityPage type="history" />,
  },
```

Delete the now-unused lazy import of `RedirectReceptionSlug` (declared around `Routes.js:54`) and remove the file:

```bash
git rm frontend/webapp/src/views/History/RedirectReceptionSlug.jsx
```

Leave `/history/reception/:slug?`, `/history/witnesses/...`, `/history/joseph-smith`, `/history/translation`, `/history/lost-116-pages`, `/history/1820s-ny-pa` and `/history` untouched — they are hub routes and are matched before `/history/:slug` by the `<Switch>`.

- [ ] **Step 6: Verify in the browser**

1. Open `http://localhost:8200/history/reception`, click a document → modal over the hub (unchanged).
2. Reload that URL → the document as a standalone page.
3. Open a *witnesses* document from `http://localhost:8200/history/witnesses`, note its `/history/<slug>` URL, reload → the document page. Previously this landed under the reception hub; that is the bug being fixed.
4. Confirm `http://localhost:8200/history` and each hub route above still render their hubs.

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Entity/EntityPage.js \
        frontend/webapp/src/views/Entity/__tests__/EntityPage.history.test.js \
        frontend/webapp/src/models/Routes.js
git commit -m "$(cat <<'MSG'
Render /history/<slug> as the document page it already is in SSR

Archive doc slugs are shared across four archives, but setSlug always pushes
/history/<slug>, so reloading a witnesses doc used to land under the reception
hub. Drops RedirectReceptionSlug in favour of the document page.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
MSG
)"
```

---

### Task 6: Art page

**Files:**
- Create: `frontend/webapp/src/views/Entity/ArtPage.js`
- Create: `frontend/webapp/src/views/Entity/__tests__/ArtPage.test.js`
- Modify: `frontend/webapp/src/models/Routes.js` — `/art/:imageId`, `/image/:imageId`

**Interfaces:**
- Consumes: `BoMOnlineAPI` image query, which returns `{ id, title, artist, link, width, height, location: { slug } }`.
- Produces: `ArtPage()` — reads `imageId` from `useParams()`.

Art is the one type with no popup body to reuse: in-chapter art goes through `requestImageActivation` (`src/views/Page/Annotations.js:213`), not the popup system. That in-chapter path is **unchanged** by this task; only direct loads of `/art/:id` and `/image/:id` change, which today resolve the image to its parent chapter and activate it inline (`src/views/Page/Page.js:368-372`).

The image itself is served at `${assetUrl}/art/${id}` (`assetUrl` = `https://media.bookofmormon.online`), the same pattern Theater and Narration use.

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Entity/__tests__/ArtPage.test.js`:

```js
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import ArtPage from "../ArtPage";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
  assetUrl: "https://media.bookofmormon.online",
}));

const ART = {
  id: 1000,
  title: "Lehi's Dream",
  artist: "Minerva Teichert",
  link: "https://example.org/source",
  width: 1200,
  height: 800,
  location: { slug: "lehites/3" },
};

const fixture = {
  states: { popUp: { open: false, type: null, ids: [], activeId: null } },
  preLoad: {},
  popUpData: {},
  functions: { setPopUp: jest.fn(), closePopUp: jest.fn(), requestImageActivation: jest.fn() },
};

const renderArt = (id, routePath = "/art/:imageId") =>
  render(
    <AppControllerProvider appController={fixture}>
      <MemoryRouter initialEntries={[`/art/${id}`]}>
        <Route path={routePath}>
          <ArtPage />
        </Route>
      </MemoryRouter>
    </AppControllerProvider>,
  );

describe("ArtPage", () => {
  beforeEach(() => jest.clearAllMocks());

  test("renders the artwork, title and artist", async () => {
    BoMOnlineAPI.mockResolvedValue({ image: { 1000: ART } });
    renderArt(1000);
    await waitFor(() => expect(screen.getByText(/Lehi's Dream/)).toBeInTheDocument());
    expect(screen.getByText(/Minerva Teichert/)).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://media.bookofmormon.online/art/1000",
    );
  });

  test("links to the passage the art illustrates", async () => {
    BoMOnlineAPI.mockResolvedValue({ image: { 1000: ART } });
    renderArt(1000);
    await waitFor(() => expect(screen.getByText(/Lehi's Dream/)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /passage/i })).toHaveAttribute("href", "/lehites/3");
  });

  test("does not activate the in-chapter image viewer", async () => {
    BoMOnlineAPI.mockResolvedValue({ image: { 1000: ART } });
    renderArt(1000);
    await waitFor(() => expect(screen.getByText(/Lehi's Dream/)).toBeInTheDocument());
    expect(fixture.functions.requestImageActivation).not.toHaveBeenCalled();
  });

  test("unknown id renders not-found rather than crashing", async () => {
    BoMOnlineAPI.mockResolvedValue({ image: { 999999: null } });
    renderArt(999999);
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });

  test("renders without a location, which older records lack", async () => {
    BoMOnlineAPI.mockResolvedValue({ image: { 1000: { ...ART, location: null } } });
    renderArt(1000);
    await waitFor(() => expect(screen.getByText(/Lehi's Dream/)).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /passage/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "ArtPage"`
Expected: FAIL — `Cannot find module '../ArtPage'`

- [ ] **Step 3: Write ArtPage**

Create `frontend/webapp/src/views/Entity/ArtPage.js`:

```jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { Loading } from "src/views/_Common/PopUp";
import "./EntityPage.css";

/**
 * Standalone view of one artwork.
 *
 * Art has no popup body to reuse — in-chapter art is activated inline through
 * appController.functions.requestImageActivation (views/Page/Annotations.js),
 * which this page deliberately does NOT call. Before this page existed, a
 * direct load of /art/:id resolved the image to its parent chapter and
 * activated it there (views/Page/Page.js); now the URL shows the artwork.
 */
export default function ArtPage() {
  const { imageId } = useParams();
  const [state, setState] = useState({ data: null, status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, status: "loading" });
    BoMOnlineAPI({ image: [imageId] }).then((response) => {
      if (cancelled) return;
      const record = response?.image?.[imageId] ?? null;
      setState({ data: record, status: record ? "ready" : "missing" });
    });
    return () => {
      cancelled = true;
    };
  }, [imageId]);

  const { data, status } = state;

  useEffect(() => {
    if (data?.title) document.title = `${data.title} | ${label("home_title")}`;
  }, [data]);

  if (status === "loading") return <Loading type="art" />;

  if (status === "missing") {
    return (
      <div className="entity-page">
        <div className="emptyState" style={{ padding: "2em", textAlign: "center" }}>
          {label("not_found") || "Not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="entity-page art-page">
      <img
        className="art-page-image"
        src={`${assetUrl}/art/${data.id}`}
        alt={data.title || ""}
        title={data.title || ""}
        width={data.width || undefined}
        height={data.height || undefined}
      />
      <h1>{data.title}</h1>
      {data.artist && <h2 className="art-page-artist">{data.artist}</h2>}
      {data.location?.slug && (
        <p>
          <a href={`/${data.location.slug}`}>❮ {label("read_passage") || "Read the passage"}</a>
        </p>
      )}
      {data.link && (
        <p className="art-page-source">
          <a href={data.link} target="_blank" rel="noreferrer noopener">
            {label("source") || "Source"}
          </a>
        </p>
      )}
    </div>
  );
}
```

Append to `frontend/webapp/src/views/Entity/EntityPage.css`:

```css
.art-page {
  max-width: 68rem;
}

.art-page-image {
  display: block;
  width: 100%;
  height: auto;
  margin-bottom: 1.25rem;
}

.art-page-artist {
  font-size: 1rem;
  font-weight: 400;
  color: #6b6b6b;
}

.art-page-source a {
  color: #000;
  border-bottom: 1px solid #c9a24b;
  text-decoration: none;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "ArtPage"`
Expected: PASS — 5 passed

- [ ] **Step 5: Wire the routes**

In `Routes.js`, add the lazy import beside `EntityPage`:

```js
const ArtPage = lazy(() => import("../views/Entity/ArtPage"));
```

Repoint both art entries, keeping their `exact: true`:

```js
  {
    path: "/image/:imageId(\\d+)",
    component: ArtPage,
    exact: true,
  },
  {
    path: "/art/:imageId(\\d+)",
    component: ArtPage,
    exact: true,
  },
```

- [ ] **Step 6: Verify in the browser**

1. `http://localhost:8200/art/1000` → the artwork as a page with title, artist and a passage link.
2. `http://localhost:8200/image/1000` → the same page.
3. Open a chapter with art (e.g. `http://localhost:8200/lehites/3`) and click an illustration → the **in-chapter** viewer still activates inline. This path must be unchanged.
4. `http://localhost:8200/art/99999999` → the not-found state, not a crash.

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/Entity/ArtPage.js \
        frontend/webapp/src/views/Entity/__tests__/ArtPage.test.js \
        frontend/webapp/src/views/Entity/EntityPage.css \
        frontend/webapp/src/models/Routes.js
git commit -m "$(cat <<'MSG'
Render /art/<id> and /image/<id> as a standalone artwork page

Direct loads used to resolve the image to its parent chapter and activate it
inline. In-chapter activation is untouched.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
MSG
)"
```

---

### Task 7: Maximize control on the modal

**Files:**
- Modify: `frontend/webapp/src/views/_Common/PopUp.js` — modal chrome for the four page-eligible types
- Create: `frontend/webapp/src/views/_Common/entity/MaximizeButton.js`
- Create: `frontend/webapp/src/views/_Common/entity/__tests__/MaximizeButton.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (it only navigates).
- Produces: `MaximizeButton({ type })` — renders nothing for types that may not go full-page.

The URL is **already** the entity URL whenever a modal is open (`setPopUp` → `setSlug`), so maximizing changes no URL. All it has to do is let the Router catch up to the address bar and close the modal:

```js
routerHistory.replace(window.location.pathname + window.location.search);
appController.functions.closePopUp();
```

`replace` (not `push`) keeps the history stack clean, and because the path is identical the address bar does not change — the Router simply re-evaluates, the item route mounts, and `EntityPage` renders.

**The allowlist is the safety-critical part of this task.** `commentary` must never go full-page (licensing requires in-context display) and `victory` is not an addressable entity. Encode that as an explicit allowlist with the reason, so a later refactor cannot promote commentary by generalising the control.

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/_Common/entity/__tests__/MaximizeButton.test.js`:

```js
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import MaximizeButton from "../MaximizeButton";

const fixture = () => ({
  states: { popUp: { open: true, type: "people", ids: ["noah2"], activeId: "noah2" } },
  preLoad: {},
  popUpData: {},
  functions: { setPopUp: jest.fn(), closePopUp: jest.fn() },
});

const renderAt = (type, path, appController) => {
  const history = createMemoryHistory({ initialEntries: [path] });
  jest.spyOn(history, "replace");
  jest.spyOn(history, "push");
  render(
    <AppControllerProvider appController={appController}>
      <Router history={history}>
        <MaximizeButton type={type} />
      </Router>
    </AppControllerProvider>,
  );
  return history;
};

describe("MaximizeButton", () => {
  test("promotes the modal to the page without changing the URL", () => {
    const app = fixture();
    const history = renderAt("people", "/people/noah2", app);
    fireEvent.click(screen.getByTitle(/full page/i));
    // replace, not push: same URL, no new history entry.
    expect(history.replace).toHaveBeenCalledWith("/people/noah2");
    expect(history.push).not.toHaveBeenCalled();
    expect(app.functions.closePopUp).toHaveBeenCalled();
  });

  test.each(["people", "places", "matters", "history"])("renders for %s", (type) => {
    renderAt(type, `/${type}/x`, fixture());
    expect(screen.getByTitle(/full page/i)).toBeInTheDocument();
  });

  test.each(["commentary", "victory"])("renders nothing for %s", (type) => {
    renderAt(type, "/commentary/1", fixture());
    expect(screen.queryByTitle(/full page/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "MaximizeButton"`
Expected: FAIL — `Cannot find module '../MaximizeButton'`

- [ ] **Step 3: Write the control**

Create `frontend/webapp/src/views/_Common/entity/MaximizeButton.js`:

```jsx
import React from "react";
import { useHistory } from "react-router-dom";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";

/**
 * Types that may be promoted from modal to standalone page.
 *
 * ALLOWLIST, not a denylist, and deliberately so:
 *  - 'commentary' must NEVER render full-page. Commentary is licensed for
 *    in-context display only, so it stays inside the chapter that frames it.
 *  - 'victory' is a session summary, not an addressable entity — it has no page.
 * Adding a type here without a route that renders it as a page produces a dead
 * button. See docs/specs/2026-09-24-entity-url-presentation-model.md §4.
 */
const PAGE_ELIGIBLE = new Set(["people", "places", "place", "matters", "history"]);

export default function MaximizeButton({ type }) {
  const routerHistory = useHistory();
  const appController = useAppController();
  if (!PAGE_ELIGIBLE.has(type)) return null;

  // The address bar already holds the entity URL — setPopUp pushed it through
  // models/routeHistory.js, an instance the Router never hears from. So this
  // only needs to let the Router catch up; `replace` keeps the URL identical
  // and adds no history entry.
  const maximize = () => {
    routerHistory.replace(window.location.pathname + window.location.search);
    appController.functions.closePopUp();
  };

  return (
    <li
      className="maximize"
      title={label("view_full_page") || "View full page"}
      onClick={maximize}
    >
      ⤢
    </li>
  );
}
```

- [ ] **Step 4: Add it to the modal chrome**

In `PopUp.js`, add `import MaximizeButton from "./entity/MaximizeButton";` and place it immediately before the existing close `×` in the header `<ul className="source_tabs …">` of `Person()`, `Place()`, `MatterPopUp()` and `History()`:

```jsx
              <MaximizeButton type={appController.states.popUp.type} />
              <li className="close" onClick={appController.functions.closePopUp}>
                ×
              </li>
```

Do **not** add it to `Commentary()`, `Victory()` or `GroupPopUp()`. The allowlist already refuses those, but leaving them alone keeps the intent visible in both places.

Add the button's styling to `frontend/webapp/src/views/_Common/PopUp.css` next to the existing `.close` rule, matching its metrics so the two read as one control group:

```css
#popUp .source_tabs .maximize {
  cursor: pointer;
  color: #6b6b6b;
}

#popUp .source_tabs .maximize:hover {
  color: #c9a24b;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern "MaximizeButton"`
Expected: PASS — 7 passed

- [ ] **Step 6: Verify in the browser**

1. From `http://localhost:8200/people`, click a person, then click ⤢ → the standalone page renders and **the URL does not change**.
2. Press Back → returns to `/people` with the grid.
3. From a chapter, click a person, then ⤢ → the person page renders at the person's URL.
4. Open a commentary from within a chapter → **no ⤢ button** appears. This is the licensing constraint; if a maximize control is present here, stop and fix the allowlist.

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/_Common/entity/MaximizeButton.js \
        frontend/webapp/src/views/_Common/entity/__tests__/MaximizeButton.test.js \
        frontend/webapp/src/views/_Common/PopUp.js \
        frontend/webapp/src/views/_Common/PopUp.css
git commit -m "$(cat <<'MSG'
Add a maximize control that promotes a modal to its standalone page

The URL is already the entity URL, so this only lets the Router catch up and
closes the modal. Allowlisted: commentary never goes full-page (licensed for
in-context display only) and victory has no page.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
MSG
)"
```

---

### Task 8: Full-suite verification, spec update, mainline merge

**Files:**
- Modify: `docs/specs/2026-09-24-entity-url-presentation-model.md`

**Interfaces:**
- Consumes: everything from Tasks 1-7.
- Produces: nothing code-facing.

- [ ] **Step 1: Run the CRA suite and compare to the recorded baseline**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false 2>&1 | tail -20`
Expected: the **same 8 pre-existing failures** you recorded before Task 1, and no others. Any new failure is a regression from this phase. Do not proceed on "probably flaky".

- [ ] **Step 2: Confirm SSR is untouched**

This phase changed no `frontend/next` code, so Phase 1's coverage must still be exactly green.

Run: `cd frontend/next && npm test 2>&1 | tail -3`
Expected: PASS — 307 passed

- [ ] **Step 3: Full manual pass on the five types**

At `http://localhost:8200` (never `bom.kckern.net` — 4-hour Cloudflare cache), confirm for **each** of `/people/noah2`, `/places/zarahemla`, `/matters/faith`, `/history/<a witnesses doc slug>`, `/art/1000`:

| Check | Expected |
|---|---|
| Fresh tab, direct URL | standalone page; no index grid, no modal chrome |
| Click the same entity from its index | modal over the grid, URL updates |
| Click from inside a chapter | modal over the chapter, chapter still behind it |
| Reload with that modal open | the standalone page |
| ⤢ on the modal | the page, URL unchanged (art has no modal, so skip) |
| Commentary opened in a chapter | in-context modal, **no ⤢** |

Then repeat the first two rows at a mobile viewport (DevTools device emulation, or a narrow window — `isMobile()` in `src/models/Utils.js` drives the branch). `PopUp.js` returns `<MobileDrawer />` instead of the modal on mobile, and this phase does not touch that: a **direct load** must still give the standalone page (the route decides, before `PopUp` is consulted), while a **click** must still give the drawer.

- [ ] **Step 4: Update the spec status**

In `docs/specs/2026-09-24-entity-url-presentation-model.md`, set:

```markdown
**Status:** Implemented 2026-09-24 (Phase 1 SSR + Phase 2 presentation model)
```

Add to the end of the spec a Deviations section recording where implementation departed from the approved design, so the next reader is not misled by §1:

```markdown
## Deviations from this design, as built

- **The two history instances were NOT unified** (§1 proposed it, and named it
  risk #1). Investigation found 57 `push`/`replace` call sites across 10 files —
  including the reader's chapter navigation and the facsimile viewer's
  per-page-turn URL sync — all on the instance the Router ignores. Unifying
  would have made every one of them drive Router re-renders.
- **Background-location routing was therefore unnecessary.** Because in-app
  clicks never reach the Router, an entity item route can only mount on direct
  arrival, so the route renders the page unconditionally and the click path is
  untouched. This is simpler than §1's design and has a far smaller blast
  radius, but it leaves the dual-history wart load-bearing: anyone who later
  unifies the instances must implement background locations at the same time or
  every modal open will swap its backdrop to an index grid.
- **Maximize is `routerHistory.replace(samePath)` plus `closePopUp()`**, not a
  presentation flag in controller state. The URL is already correct, so no
  state axis was needed.
- **Back/Forward into a modal entry renders the page, not the modal.** §1's
  chosen semantics ("fresh load primarily") expected the modal to be restored.
  Both history instances receive `popstate`, so the Router re-evaluates and the
  item route mounts. Accepted: the presentation is coherent with the URL.
```

- [ ] **Step 5: Commit and merge to mainline**

Note: this repo has **no `main` branch** — `origin/dev` is the mainline and `prod` tracks releases. Phase 1 merged to `dev`.

```bash
git add docs/specs/2026-09-24-entity-url-presentation-model.md
git commit -m "$(cat <<'MSG'
Mark the entity URL presentation model as implemented

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012zZtadopzV2rjtnwqa3Rr4
MSG
)"
```

Then follow superpowers:finishing-a-development-branch: verify the suite on the tree being integrated, confirm the base branch is `dev`, and merge.

**Before merging, reconcile `dev` with `origin/dev`.** At the end of Phase 1 local `dev` was 16 commits behind `origin/dev`, and `git pull` was blocked by uncommitted changes to `backend/package.json`, `backend/package-lock.json` and `backend/src/index.ts`. Those belong to the repo owner — commit or stash them, then `git pull`, then re-run both suites before merging. Do not stash someone else's uncommitted work without asking.
