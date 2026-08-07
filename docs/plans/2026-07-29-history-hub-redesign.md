# /history Hub + Navigation Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/history` from the Reception view into a hub of four section tiles with a breadcrumb section-page framework, wiring in the two existing sections and scaffolding the two new ones.

**Architecture:** A `sections.js` registry (four peers) drives a new `HistoryHub` tile grid and a small `HistoryBreadcrumb`. Reception moves from `/history` to `/history/reception/:slug?` (with a back-compat redirect); the hub takes the root. Witnesses is unchanged; Translation Sources and Joseph Smith become placeholder pages. No backend changes.

**Tech Stack:** React 17 (CRA), react-router v5, `BoMOnlineAPI` (GraphQL), jest + @testing-library (CRA defaults). Verify UI via the dev server recompile (`journalctl --user -u bom-dev`) + manual checks at `http://localhost:8200`.

**Spec:** `docs/specs/2026-07-29-history-hub-redesign.md`

---

## File structure

- `src/views/History/sections.js` — **new**: the four-section registry + `getSection` + `pickRandom`.
- `src/views/History/HistoryBreadcrumb.jsx` — **new**: `History › [section]` breadcrumb.
- `src/views/History/HistoryHub.jsx` + `HistoryHub.css` — **new**: the tile grid + featured previews.
- `src/views/History/TranslationSources.jsx` — **new**: placeholder section page.
- `src/views/History/RedirectReceptionSlug.jsx` — **new**: back-compat redirect for old `/history/:slug`.
- `src/views/History/JosephSmith.js` — **modify**: redress bare portrait as a placeholder shell.
- `src/views/History/History.js` — **modify**: add the breadcrumb (reception keeps its `slug` param).
- `src/views/History/Witnesses.js` — **modify**: export the flattened witness list for the hub's featured pick.
- `src/models/Routes.js` — **modify**: new route table + lazy imports.

Test commands assume repo root `/home/bom/BookofMormonOnline`. Jest runs from the frontend package:
`cd frontend/webapp && CI=true npx react-scripts test <path> --watchAll=false`

---

## Task 1: Section registry + helpers

**Files:**
- Create: `frontend/webapp/src/views/History/sections.js`
- Test: `frontend/webapp/src/views/History/sections.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/History/sections.test.js`:

```js
import { HISTORY_SECTIONS, getSection, pickRandom } from "./sections";

test("registry has four sections, each with required fields", () => {
  expect(HISTORY_SECTIONS).toHaveLength(4);
  for (const s of HISTORY_SECTIONS) {
    expect(s.key).toBeTruthy();
    expect(s.title).toBeTruthy();
    expect(s.path).toMatch(/^\/history/);
    expect(s.icon).toBeTruthy();
    expect(["live", "placeholder"]).toContain(s.status);
  }
});

test("getSection resolves by key, null otherwise", () => {
  expect(getSection("reception").title).toBe("Reception History");
  expect(getSection("nope")).toBeNull();
});

test("pickRandom returns a member or null", () => {
  expect([1, 2, 3]).toContain(pickRandom([1, 2, 3]));
  expect(pickRandom([])).toBeNull();
  expect(pickRandom(null)).toBeNull();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/History/sections.test.js --watchAll=false`
Expected: FAIL — `Cannot find module './sections'`.

- [ ] **Step 3: Create the registry**

Create `frontend/webapp/src/views/History/sections.js` (SVGs reused from existing assets — all four files exist):

```js
/** @format */
// Single source of truth for the /history sections. Order = display order in the
// hub = the "priority" call (narrative: coming-forth → aftermath). Reorder here.
import receptionIcon from "src/views/_Common/svg/history.svg";
import witnessIcon from "src/views/People/svg/group.svg";
import translationIcon from "src/views/_Common/svg/book.svg";
import josephIcon from "src/views/People/svg/prophet.svg";

export const HISTORY_SECTIONS = [
  {
    key: "translation",
    title: "Translation Sources",
    path: "/history/translation",
    icon: translationIcon,
    blurb: "How the Book of Mormon was brought forth and rendered into English.",
    status: "placeholder",
  },
  {
    key: "witnesses",
    title: "The Witnesses",
    path: "/history/witnesses",
    icon: witnessIcon,
    blurb: "The three, the eight, and others who testified of the plates.",
    status: "live",
  },
  {
    key: "reception",
    title: "Reception History",
    path: "/history/reception",
    icon: receptionIcon,
    blurb: "How the book was reviewed, attacked, and defended in its own day.",
    status: "live",
  },
  {
    key: "josephSmith",
    title: "Joseph Smith",
    path: "/history/joseph-smith",
    icon: josephIcon,
    blurb: "The life and work of the translator.",
    status: "placeholder",
  },
];

export const getSection = (key) =>
  HISTORY_SECTIONS.find((s) => s.key === key) || null;

export const pickRandom = (arr) =>
  Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/History/sections.test.js --watchAll=false`
Expected: PASS (3 tests). SVG imports resolve to CRA's file mock (truthy strings).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/sections.js frontend/webapp/src/views/History/sections.test.js
git commit -m "history: section registry (4 peers) + helpers"
```

---

## Task 2: HistoryBreadcrumb

**Files:**
- Create: `frontend/webapp/src/views/History/HistoryBreadcrumb.jsx`
- Test: `frontend/webapp/src/views/History/HistoryBreadcrumb.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/History/HistoryBreadcrumb.test.jsx`:

```jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HistoryBreadcrumb from "./HistoryBreadcrumb";

test("renders History and the section title", () => {
  render(
    <MemoryRouter>
      <HistoryBreadcrumb sectionKey="reception" />
    </MemoryRouter>
  );
  expect(screen.getByText("History")).toBeInTheDocument();
  expect(screen.getByText("Reception History")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/History/HistoryBreadcrumb.test.jsx --watchAll=false`
Expected: FAIL — `Cannot find module './HistoryBreadcrumb'`.

- [ ] **Step 3: Create the component**

Create `frontend/webapp/src/views/History/HistoryBreadcrumb.jsx`:

```jsx
/** @format */
import React from "react";
import Breadcrumb from "src/views/_Common/Breadcrumb/Breadcrumb";
import { getSection } from "./sections";

/** History › [section]. "History" links back to the hub at /history. */
export default function HistoryBreadcrumb({ sectionKey }) {
  const section = getSection(sectionKey);
  return (
    <Breadcrumb
      items={[
        { label: "History", to: "/history" },
        { label: section ? section.title : "", current: true },
      ]}
    />
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/History/HistoryBreadcrumb.test.jsx --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/HistoryBreadcrumb.jsx frontend/webapp/src/views/History/HistoryBreadcrumb.test.jsx
git commit -m "history: HistoryBreadcrumb (History › section, back to hub)"
```

---

## Task 3: Placeholder section pages

**Files:**
- Create: `frontend/webapp/src/views/History/TranslationSources.jsx`
- Modify: `frontend/webapp/src/views/History/JosephSmith.js`
- Uses (created in Task 5): `HistoryHub.css` — so this task ships its own minimal styles inline via className `historyComingSoon`, styled in Task 5's CSS. Until Task 5, the class is simply unstyled (plain text), which is acceptable mid-sequence.

- [ ] **Step 1: Create TranslationSources placeholder**

Create `frontend/webapp/src/views/History/TranslationSources.jsx`:

```jsx
/** @format */
import React, { useEffect } from "react";
import HistoryBreadcrumb from "./HistoryBreadcrumb";
import { label } from "../../models/Utils";

export default function TranslationSources() {
  useEffect(() => {
    document.title = "Translation Sources | " + label("home_title");
  }, []);
  return (
    <div className="container" style={{ display: "block" }}>
      <div id="page">
        <HistoryBreadcrumb sectionKey="translation" />
        <h3 className="title lg-4 text-center">Translation Sources</h3>
        <div className="historyComingSoon">Coming soon.</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Redress JosephSmith as a placeholder shell**

Replace the entire contents of `frontend/webapp/src/views/History/JosephSmith.js` with:

```jsx
/** @format */
import React, { useEffect } from "react";
import "./Witnesses.css";
import { label } from "../../models/Utils";
import { assetUrl } from "src/models/BoMOnlineAPI";
import HistoryBreadcrumb from "./HistoryBreadcrumb";

export default function JosephSmith() {
  useEffect(() => {
    document.title = "Joseph Smith | " + label("home_title");
  }, []);
  return (
    <div className="container" style={{ display: "block" }}>
      <div id="page" className="single-witnesses">
        <HistoryBreadcrumb sectionKey="josephSmith" />
        <h3 className="title lg-4 text-center">Joseph Smith</h3>
        <div className="witness-image">
          <img
            src={`${assetUrl}/history/witnesses/people/joseph-smith.jpg`}
            alt="Joseph Smith"
          />
        </div>
        <div className="historyComingSoon">More coming soon.</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify compile**

Run: `journalctl --user -u bom-dev --no-pager -n 6 | grep -iE "compiled|failed to compile|error in"`
Expected: `webpack compiled` (no `Failed to compile`). These aren't routed yet (Task 6), so no visual check here — just that they parse.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/History/TranslationSources.jsx frontend/webapp/src/views/History/JosephSmith.js
git commit -m "history: Translation + Joseph Smith placeholder pages"
```

---

## Task 4: Export the witness list for the hub

**Files:**
- Modify: `frontend/webapp/src/views/History/Witnesses.js`

- [ ] **Step 1: Add the export after the `data` object**

In `frontend/webapp/src/views/History/Witnesses.js`, immediately after the closing `}` of the `const data = { ... }` object (the object ends with the `"other-witnesses"` array around line 57), add:

```js
// Flattened list of every witness, for the hub's featured pick.
export const WITNESSES = Object.values(data).flat();
```

- [ ] **Step 2: Verify compile**

Run: `journalctl --user -u bom-dev --no-pager -n 6 | grep -iE "compiled|failed to compile|error in"`
Expected: `webpack compiled`.

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/History/Witnesses.js
git commit -m "history: export flattened WITNESSES list"
```

---

## Task 5: HistoryHub (tiles + featured previews)

**Files:**
- Create: `frontend/webapp/src/views/History/HistoryHub.jsx`
- Create: `frontend/webapp/src/views/History/HistoryHub.css`

- [ ] **Step 1: Create the CSS**

Create `frontend/webapp/src/views/History/HistoryHub.css`:

```css
/** @format */
.historyHub {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5em;
  max-width: 900px;
  margin: 2em auto;
}
@media (max-width: 700px) {
  .historyHub { grid-template-columns: 1fr; }
}
.historyTile {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5em;
  border: 1px solid #ddd;
  border-radius: 1em;
  text-decoration: none;
  color: inherit;
  background: #fff;
  transition: box-shadow .15s, transform .15s;
}
.historyTile:hover { box-shadow: 0 4px 16px #0002; transform: translateY(-2px); }
.historyTile-icon { width: 4rem; height: 4rem; opacity: .8; margin-bottom: .5em; }
.historyTile-title { font-weight: 800; font-size: 1.3rem; }
.historyTile-blurb { color: #666; font-size: .9rem; margin: .25em 0 .75em; }
.historyTile-featured { display: flex; flex-direction: column; align-items: center; gap: .25em; }
.historyTile-featured img { max-height: 6rem; border-radius: .4em; }
.historyTile-featured span { font-size: .8rem; color: #888; }
.historyTile-soon { font-size: .8rem; color: #aaa; font-style: italic; min-height: 1.2em; }
.historyComingSoon { text-align: center; color: #aaa; font-style: italic; padding: 3em; }
```

- [ ] **Step 2: Create the hub component**

Create `frontend/webapp/src/views/History/HistoryHub.jsx`:

```jsx
/** @format */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "../../models/Utils";
import { HISTORY_SECTIONS, pickRandom } from "./sections";
import { WITNESSES } from "./Witnesses";
import "./HistoryHub.css";

// One featured preview per live section: { img, caption }.
function useFeatured() {
  const [receptionDoc, setReceptionDoc] = useState(null);
  useEffect(() => {
    let alive = true;
    BoMOnlineAPI({ history: { archive: "reception" } }).then((r) => {
      if (alive) setReceptionDoc(pickRandom(r && r.history));
    });
    return () => { alive = false; };
  }, []);
  const witness = useMemo(() => pickRandom(WITNESSES), []);
  return {
    reception: receptionDoc && {
      img: `${assetUrl}/history/thumbs/${String(receptionDoc.id).padStart(4, "0")}`,
      caption: receptionDoc.source,
    },
    witnesses: witness && {
      img: `${assetUrl}/history/witnesses/people/${witness.slug}.jpg`,
      caption: witness.name,
    },
  };
}

function Tile({ section, featured }) {
  return (
    <Link className="historyTile" to={section.path}>
      <img className="historyTile-icon" src={section.icon} alt="" />
      <div className="historyTile-title">{section.title}</div>
      <div className="historyTile-blurb">{section.blurb}</div>
      {section.status === "live" && featured ? (
        <div className="historyTile-featured">
          <img
            src={featured.img}
            alt=""
            onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
          />
          <span>{featured.caption}</span>
        </div>
      ) : (
        <div className="historyTile-soon">
          {section.status === "placeholder" ? "Coming soon" : ""}
        </div>
      )}
    </Link>
  );
}

export default function HistoryHub() {
  useEffect(() => {
    document.title = label("menu_history") + " | " + label("home_title");
  }, []);
  const featured = useFeatured();
  return (
    <div className="container" style={{ display: "block" }}>
      <div id="page">
        <h3 className="title lg-4 text-center">{label("title_history")}</h3>
        <div className="historyHub">
          {HISTORY_SECTIONS.map((s) => (
            <Tile key={s.key} section={s} featured={featured[s.key]} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify compile**

Run: `journalctl --user -u bom-dev --no-pager -n 6 | grep -iE "compiled|failed to compile|error in"`
Expected: `webpack compiled`. (Still not routed until Task 6.)

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/History/HistoryHub.jsx frontend/webapp/src/views/History/HistoryHub.css
git commit -m "history: HistoryHub tile grid with featured previews"
```

---

## Task 6: Wire routing + reception breadcrumb + verify

**Files:**
- Create: `frontend/webapp/src/views/History/RedirectReceptionSlug.jsx`
- Modify: `frontend/webapp/src/models/Routes.js`
- Modify: `frontend/webapp/src/views/History/History.js`

- [ ] **Step 1: Create the back-compat redirect**

Create `frontend/webapp/src/views/History/RedirectReceptionSlug.jsx`:

```jsx
/** @format */
import React from "react";
import { Redirect, useParams } from "react-router-dom";

// Old single-segment reception deep links (/history/<slug>) → /history/reception/<slug>.
export default function RedirectReceptionSlug() {
  const { slug } = useParams();
  return <Redirect to={`/history/reception/${slug}`} />;
}
```

- [ ] **Step 2: Add lazy imports in Routes.js**

In `frontend/webapp/src/models/Routes.js`, next to the existing history lazy imports (near lines 40/48/49: `const History = lazy(...)`, `const Witnesses = lazy(...)`, `const JosephSmith = lazy(...)`), add:

```js
const HistoryHub = lazy(() => import("../views/History/HistoryHub.jsx"));
const TranslationSources = lazy(() => import("../views/History/TranslationSources.jsx"));
const RedirectReceptionSlug = lazy(() => import("../views/History/RedirectReceptionSlug.jsx"));
```

- [ ] **Step 3: Replace the history route block**

In `frontend/webapp/src/models/Routes.js`, replace this block (currently lines ~190–205):

```js
  {
      path: "/history/witnesses/:witness?/:source?",
      component: Witnesses,
  },
  {
      path: "/history/joseph-smith",
      component: JosephSmith,
  },
  {
    path: "/history/:slug",
    component: History,
  },
  {
    path: "/history",
    component: History,
  },
```

with (order matters — specific static paths before `:slug`, hub last):

```js
  {
      path: "/history/witnesses/:witness?/:source?",
      component: Witnesses,
  },
  {
      path: "/history/joseph-smith",
      component: JosephSmith,
  },
  {
      path: "/history/translation",
      component: TranslationSources,
  },
  {
      path: "/history/reception/:slug?",
      component: History,
  },
  {
      path: "/history/:slug",
      component: RedirectReceptionSlug,
  },
  {
      path: "/history",
      component: HistoryHub,
  },
```

- [ ] **Step 4: Add the breadcrumb to the reception view**

In `frontend/webapp/src/views/History/History.js`, add the import near the other imports (after line 4's react-router import):

```js
import HistoryBreadcrumb from "./HistoryBreadcrumb";
```

Then in its `return (...)` (the block starting around line 146), insert the breadcrumb as the first child inside `<div id="page" >`:

```jsx
  return (
    <div className="container " style={{ display: 'block' }}>
      <div id="page" >
        <HistoryBreadcrumb sectionKey="reception" />
        <h3 className="title lg-4 text-center">{label("title_history")}</h3>
        <div className='archive_intro'><ReactMarkdown linkTarget={'_blank'}>{introText}</ReactMarkdown></div>
        {contents}
      </div>
    </div>);
```

- [ ] **Step 5: Verify compile**

Run: `journalctl --user -u bom-dev --no-pager -n 8 | grep -iE "compiled|failed to compile|error in"`
Expected: `webpack compiled` (no `Failed to compile`).

- [ ] **Step 6: Manual verification at `http://localhost:8200`**

Check each acceptance criterion:
- `/history` → hub with four tiles (icon + title + blurb). Reception & Witnesses tiles show a featured image + caption; Translation & Joseph Smith show "Coming soon".
- Click **Reception History** → `/history/reception`, shows the year-filter grid with a `History › Reception History` breadcrumb; "History" returns to the hub.
- Visit an old deep link, e.g. `/history/1830` → redirects to `/history/reception/1830` and still filters/opens as before.
- Click **The Witnesses** → `/history/witnesses` (unchanged view, its own breadcrumb).
- Click **Translation Sources** → `/history/translation` placeholder with breadcrumb.
- Click **Joseph Smith** → `/history/joseph-smith` placeholder (portrait + breadcrumb).

- [ ] **Step 7: Commit**

```bash
git add frontend/webapp/src/views/History/RedirectReceptionSlug.jsx frontend/webapp/src/models/Routes.js frontend/webapp/src/views/History/History.js
git commit -m "history: route /history to the hub, reception to /history/reception, add breadcrumb"
```

---

## Self-review

- **Spec coverage:** hub (Task 5) · flat 4-section registry (Task 1) · breadcrumb framework (Tasks 2, 3, 6) · reception moved + back-compat redirect (Task 6) · Translation/Joseph Smith placeholders (Task 3) · witnesses unchanged + featured pick (Tasks 4, 5) · featured = single random item (Task 5 `pickRandom`/`useFeatured`) · SVG icons reused (Task 1). All spec sections map to a task.
- **Placeholder scan:** none — every code step is complete. Task 3's note about `historyComingSoon` being unstyled until Task 5 is an accepted mid-sequence state, not a gap (the class is styled in Task 5, both land before merge).
- **Name consistency:** `HISTORY_SECTIONS`, `getSection`, `pickRandom` (Task 1) are the names imported in Tasks 2 & 5; `WITNESSES` exported in Task 4 is imported in Task 5; `sectionKey` prop is consistent across HistoryBreadcrumb usages; `status` values `"live"`/`"placeholder"` match between registry (Task 1) and hub/tile logic (Task 5). Route `component` names match the lazy imports added in Task 6.
- **Ordering safety:** Task 6 places `/history/translation` and `/history/reception/:slug?` before `/history/:slug`, and `/history` (hub) last, so the first-match `<Switch>` resolves each correctly and the redirect can't loop (`/history/reception` is caught before `/history/:slug`).
