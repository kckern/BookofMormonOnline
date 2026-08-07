# /history Archive Feeds (translation + joseph-smith) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/history/translation` and `/history/joseph-smith` "Coming soon" stubs with year-grouped chronological feeds of their archive accounts, built from ONE shared `HistoryArchiveFeed` component + two thin wrappers, and light up both hub sections.

**Architecture:** `HistoryArchiveFeed` fetches `history(archive:<archive>)`, groups docs into ascending year buckets, and renders each with the shared money-quote `HistorySourceCard`. Title/blurb/underSlug derive from `getSection(sectionKey)`. A person `<select>` filters by `principal`, shown only when >1 distinct principal exists. No backend/query change — the `history` query already returns every field. `HistorySourceCard` already gates the thumbnail on `doc.id` and the attribution on `doc.quote_speaker`, so joseph-smith's missing-thumb/bare-quote docs need no special handling. Spec: `docs/specs/2026-08-07-history-translation-design.md`.

**Tech Stack:** React 17, `react-masonry-css`, `moment`, Jest + `@testing-library/react` (`react-scripts test`, `resetMocks:true`), plain CSS.

**Working directory:** paths relative to repo root `/home/bom/BookofMormonOnline`. Run test commands from `frontend/webapp/`:
```bash
cd frontend/webapp
```
Test runner: `CI=true npx react-scripts test <path> --watchAll=false`.

**Branch:** `feat/history-translation` (already checked out).

**Commit trailer (every commit):**
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `frontend/.../History/HistoryArchiveFeed.jsx` | **new** shared feed + pure helpers | 1 |
| `frontend/.../History/HistoryArchiveFeed.css` | **new** intro/filter/year-header/empty styling | 1 |
| `frontend/.../History/__tests__/historyArchiveFeed.test.js` | **new** helper + render tests | 1 |
| `frontend/.../History/TranslationSources.jsx` | thin wrapper → shared feed | 2 |
| `frontend/.../History/JosephSmith.js` | thin wrapper → shared feed | 2 |
| `frontend/.../History/sections.js` | translation + josephSmith `status` → `live` | 3 |
| `frontend/.../History/HistoryHub.jsx` | `useFeatured` adds translation + joseph previews | 3 |
| `frontend/.../History/__tests__/sections.test.js` | assert both sections live | 3 |

**Dependency:** Task 1 (shared component) → Task 2 (wrappers) → Task 3 (hub). In order.

---

## Task 1: Shared `HistoryArchiveFeed` component

**Files:**
- Create: `frontend/webapp/src/views/History/HistoryArchiveFeed.jsx`
- Create: `frontend/webapp/src/views/History/HistoryArchiveFeed.css`
- Create: `frontend/webapp/src/views/History/__tests__/historyArchiveFeed.test.js`

- [ ] **Step 1: Write the failing tests**

Create `frontend/webapp/src/views/History/__tests__/historyArchiveFeed.test.js`:
```jsx
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { useAppController } from "src/contexts/AppControllerContext";
import HistoryArchiveFeed, { groupByYearAscending, principalOptions } from "../HistoryArchiveFeed";

jest.mock("src/models/BoMOnlineAPI", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("src/contexts/AppControllerContext");

const MULTI = [
  { slug: "a", id: 1, event_year: 1830, seq: 2, date: "1830-03-26", principal: "Joseph Smith, Jr.", document: "Doc A", citation: "Cite A.", money_quote: "I translated by the gift of God", quote_speaker: "Joseph Smith, Jr.", quote_is_witness_voice: true },
  { slug: "b", id: 2, event_year: 1829, seq: 1, date: "1829", principal: "Oliver Cowdery", document: "Doc B", citation: "Cite B.", money_quote: "day of days", quote_speaker: "Oliver Cowdery", quote_is_witness_voice: true },
  { slug: "c", id: 3, event_year: 1830, seq: 1, date: "1830", principal: "David Whitmer", document: "Doc C", citation: "Cite C.", money_quote: "a seer stone", quote_speaker: "David Whitmer", quote_is_witness_voice: true },
];
// joseph shape: one principal, no quote_speaker (bare quote), no id (no thumb)
const SINGLE = [
  { slug: "j1", event_year: 1830, seq: 1, date: "1830", principal: "Joseph Smith", document: "JS 1", citation: "C1.", money_quote: "by the gift and power of God" },
  { slug: "j2", event_year: 1831, seq: 1, date: "1831", principal: "Joseph Smith", document: "JS 2", citation: "C2.", money_quote: "the fulness of the everlasting gospel" },
];

describe("archive feed helpers", () => {
  test("groupByYearAscending buckets ascending, seq-ordered within a year", () => {
    const buckets = groupByYearAscending(MULTI);
    expect(buckets.map((x) => x.year)).toEqual([1829, 1830]);
    expect(buckets[1].items.map((d) => d.slug)).toEqual(["c", "a"]);
  });
  test("groupByYearAscending puts undated docs last", () => {
    const buckets = groupByYearAscending([...MULTI, { slug: "z", seq: 0 }]);
    expect(buckets[buckets.length - 1].year).toBeNull();
    expect(buckets[buckets.length - 1].items[0].slug).toBe("z");
  });
  test("principalOptions returns distinct principals with counts, most-frequent first", () => {
    const opts = principalOptions([...MULTI, { principal: "Joseph Smith, Jr." }]);
    expect(opts[0]).toEqual(["Joseph Smith, Jr.", 2]);
    expect(opts.map((o) => o[0])).toContain("Oliver Cowdery");
  });
});

describe("HistoryArchiveFeed view", () => {
  const setPopUp = jest.fn();
  beforeEach(() => {
    useAppController.mockReturnValue({ functions: { setPopUp } });
  });
  const setup = (archive, sectionKey) =>
    render(
      <MemoryRouter>
        <HistoryArchiveFeed archive={archive} sectionKey={sectionKey} />
      </MemoryRouter>
    );

  test("renders year headers, the section title, and a money-quote card per account", async () => {
    BoMOnlineAPI.mockResolvedValue({ history: MULTI });
    setup("translation", "translation");
    await waitFor(() => expect(screen.getByRole("heading", { name: "1829" })).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: /Translation Sources/ })).toBeInTheDocument();
    expect(screen.getByText(/I translated by the gift of God/)).toBeInTheDocument();
  });

  test("the person filter narrows to one voice (multi-principal archive)", async () => {
    BoMOnlineAPI.mockResolvedValue({ history: MULTI });
    setup("translation", "translation");
    await waitFor(() => expect(screen.getByText(/a seer stone/)).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "David Whitmer" } });
    expect(screen.getByText(/a seer stone/)).toBeInTheDocument();
    expect(screen.queryByText(/I translated by the gift of God/)).toBeNull();
  });

  test("the filter is hidden for a single-principal archive (joseph)", async () => {
    BoMOnlineAPI.mockResolvedValue({ history: SINGLE });
    setup("joseph-smith-statements", "josephSmith");
    await waitFor(() => expect(screen.getByText(/by the gift and power of God/)).toBeInTheDocument());
    expect(screen.queryByRole("combobox")).toBeNull();
    // bare quote (no speaker) still renders
    expect(screen.getByText(/the fulness of the everlasting gospel/)).toBeInTheDocument();
  });

  test("clicking a card opens the history popup with the section's underSlug", async () => {
    BoMOnlineAPI.mockResolvedValue({ history: MULTI });
    setup("translation", "translation");
    await waitFor(() => expect(screen.getByText(/day of days/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/day of days/));
    expect(setPopUp).toHaveBeenCalledWith(
      expect.objectContaining({ type: "history", ids: ["b"], underSlug: "history/translation" })
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**
```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/History/__tests__/historyArchiveFeed.test.js --watchAll=false
```
Expected: FAIL — "Cannot find module '../HistoryArchiveFeed'".

- [ ] **Step 3: Create the shared component**

Create `frontend/webapp/src/views/History/HistoryArchiveFeed.jsx`:
```jsx
/** @format */
import React, { useEffect, useMemo, useState } from "react";
import Masonry from "react-masonry-css";
import moment from "moment";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { isMobile, label } from "src/models/Utils";
import { Spinner } from "../_Common/Loader";
import { useAppController } from "src/contexts/AppControllerContext";
import HistoryBreadcrumb from "./HistoryBreadcrumb";
import HistorySourceCard from "./HistorySourceCard";
import { getSection } from "./sections";
import "./HistoryArchiveFeed.css";

const breakpointColumnsObj = { default: 4, 1600: 3, 1200: 2, 700: 1 };

// Ascending year buckets; items ordered by seq within a year; undated docs last.
export function groupByYearAscending(docs) {
  const yearOf = (d) => {
    const y = Number(d.event_year || d.year);
    return Number.isFinite(y) && y > 0 ? y : null;
  };
  const sorted = [...(docs || [])].sort((a, b) => {
    const ya = yearOf(a);
    const yb = yearOf(b);
    if (ya === null && yb === null) return (a.seq || 0) - (b.seq || 0);
    if (ya === null) return 1;
    if (yb === null) return -1;
    return ya - yb || (a.seq || 0) - (b.seq || 0);
  });
  const buckets = [];
  let cur = null;
  for (const d of sorted) {
    const y = yearOf(d);
    if (!cur || cur.year !== y) {
      cur = { year: y, items: [] };
      buckets.push(cur);
    }
    cur.items.push(d);
  }
  return buckets;
}

// Distinct principals with counts, most frequent first.
export function principalOptions(docs) {
  const counts = new Map();
  for (const d of docs || []) {
    if (d.principal) counts.set(d.principal, (counts.get(d.principal) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// Date formatter reception/witnesses use (year / month / full by string length).
const displayDate = (date) => {
  if (!date) return "";
  const len = String(date).length;
  return moment(date, [len === 4 ? "YYYY" : "YYYY-MM-DD"]).format(
    len === 4
      ? label("history_date_format_year")
      : len === 7
      ? label("history_date_format_month")
      : label("history_date_format_full")
  );
};

// A chronological, year-grouped feed of one history archive's accounts, each an
// attributed money-quote card. Reused by /history/translation and
// /history/joseph-smith. archive = the DB archive key; sectionKey = the
// sections.js key (drives title / blurb / breadcrumb / popup underSlug).
export default function HistoryArchiveFeed({ archive, sectionKey }) {
  const appController = useAppController();
  const section = getSection(sectionKey) || {};
  const underSlug = (section.path || "/history").replace(/^\//, "");

  const [docs, setDocs] = useState(null);
  const [principal, setPrincipal] = useState("");

  useEffect(() => {
    document.title = (section.title || "History") + " | " + label("home_title");
  }, [section.title]);

  useEffect(() => {
    let alive = true;
    setDocs(null);
    setPrincipal("");
    BoMOnlineAPI({ history: { archive } }).then((r) => {
      if (alive) setDocs((r && r.history) || []);
    });
    return () => {
      alive = false;
    };
  }, [archive]);

  const options = useMemo(() => principalOptions(docs), [docs]);
  const visible = useMemo(
    () => (docs || []).filter((d) => !principal || d.principal === principal),
    [docs, principal]
  );
  const buckets = useMemo(() => groupByYearAscending(visible), [visible]);

  const openDoc = (doc) =>
    appController.functions.setPopUp({
      type: "history",
      ids: [doc.slug],
      popUpData: doc,
      underSlug,
      vhtop: 10,
    });

  return (
    <div className="container" style={{ display: "block" }}>
      <div id="page" className="historyArchiveFeed">
        <HistoryBreadcrumb sectionKey={sectionKey} />
        <h3 className="title lg-4 text-center">{section.title || "History"}</h3>
        {section.blurb ? <p className="archiveIntro">{section.blurb}</p> : null}

        {docs === null ? (
          <Spinner top={isMobile() ? "50vh" : "40vh"} />
        ) : (
          <>
            {options.length > 1 ? (
              <div className="archiveControls">
                <label className="archiveFilter">
                  <span>Voice</span>
                  <select value={principal} onChange={(e) => setPrincipal(e.target.value)}>
                    <option value="">All voices ({docs.length})</option>
                    {options.map(([p, n]) => (
                      <option key={p} value={p}>
                        {p} ({n})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {visible.length === 0 ? (
              <div className="archiveEmpty">
                No accounts for this voice.{" "}
                <button type="button" className="archiveClear" onClick={() => setPrincipal("")}>
                  Show all
                </button>
              </div>
            ) : (
              buckets.map((bucket) => (
                <section key={bucket.year ?? "undated"} className="archiveYearGroup">
                  <h4 className="archiveYear">{bucket.year ?? "Undated"}</h4>
                  <Masonry
                    breakpointCols={breakpointColumnsObj}
                    className="my-masonry-grid"
                    columnClassName="my-masonry-grid_column"
                  >
                    {bucket.items.map((doc) => (
                      <HistorySourceCard
                        key={doc.slug}
                        doc={doc}
                        variant="reception"
                        displayDate={displayDate}
                        onOpen={openDoc}
                      />
                    ))}
                  </Masonry>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the stylesheet**

Create `frontend/webapp/src/views/History/HistoryArchiveFeed.css`:
```css
.historyArchiveFeed .archiveIntro {
  text-align: center;
  color: #666;
  max-width: 46em;
  margin: 0 auto 1.2em;
}
.historyArchiveFeed .archiveControls {
  display: flex;
  justify-content: center;
  margin-bottom: 1.2em;
}
.historyArchiveFeed .archiveFilter {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  font-size: 0.9rem;
  color: #555;
}
.historyArchiveFeed .archiveFilter select {
  font: inherit;
  padding: 0.3em 0.6em;
  border: 1px solid #bbb;
  border-radius: 0.4em;
  background: #fff;
  max-width: 22em;
}
.historyArchiveFeed .archiveYearGroup {
  margin-bottom: 1.5em;
}
.historyArchiveFeed .archiveYear {
  font-size: 1.1rem;
  font-weight: 800;
  color: #345496;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 0.2em;
  margin: 0 0 0.8em;
}
.historyArchiveFeed .archiveEmpty {
  text-align: center;
  color: #888;
  padding: 3em 1em;
}
.historyArchiveFeed .archiveClear {
  background: none;
  border: none;
  color: #345496;
  cursor: pointer;
  text-decoration: underline;
  font: inherit;
}
html[data-theme="dark"] .historyArchiveFeed .archiveFilter select {
  background: #222;
  color: #eee;
  border-color: #555;
}
html[data-theme="dark"] .historyArchiveFeed .archiveYear {
  color: #93c6ef;
  border-bottom-color: #444;
}
```

- [ ] **Step 5: Run the tests to verify they pass**
```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/History/__tests__/historyArchiveFeed.test.js --watchAll=false
```
Expected: PASS (3 helper + 4 view tests). If `useAppController` auto-mock isn't a callable jest.fn, ensure `jest.mock("src/contexts/AppControllerContext")` produced an automock (it replaces the named `useAppController` export with a `jest.fn`). If a money-quote text isn't found, open `HistorySourceCard.jsx` and confirm the `variant="reception"` path renders `doc.money_quote` (bare when no `quote_speaker`).

- [ ] **Step 6: Run the whole History suite (no regression)**
```bash
CI=true npx react-scripts test src/views/History --watchAll=false
```
Expected: all PASS.

- [ ] **Step 7: Commit**
```bash
git add frontend/webapp/src/views/History/HistoryArchiveFeed.jsx frontend/webapp/src/views/History/HistoryArchiveFeed.css frontend/webapp/src/views/History/__tests__/historyArchiveFeed.test.js
git commit -m "feat(history): shared HistoryArchiveFeed (year-grouped money-quote feed)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Wire the two route wrappers

**Files:**
- Modify (replace contents): `frontend/webapp/src/views/History/TranslationSources.jsx`
- Modify (replace contents): `frontend/webapp/src/views/History/JosephSmith.js`

- [ ] **Step 1: Translation wrapper**

Replace the ENTIRE contents of `frontend/webapp/src/views/History/TranslationSources.jsx` with:
```jsx
/** @format */
import React from "react";
import HistoryArchiveFeed from "./HistoryArchiveFeed";

export default function TranslationSources() {
  return <HistoryArchiveFeed archive="translation" sectionKey="translation" />;
}
```

- [ ] **Step 2: Joseph Smith wrapper**

Replace the ENTIRE contents of `frontend/webapp/src/views/History/JosephSmith.js` with:
```jsx
/** @format */
import React from "react";
import HistoryArchiveFeed from "./HistoryArchiveFeed";

export default function JosephSmith() {
  return <HistoryArchiveFeed archive="joseph-smith-statements" sectionKey="josephSmith" />;
}
```

- [ ] **Step 3: Verify both routes render (tests + visual)**
```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/History --watchAll=false
```
Expected: all PASS.

Then screenshot both:
- `http://localhost:8200/history/translation` — year-grouped feed with a "Voice" filter (many principals).
- `http://localhost:8200/history/joseph-smith` — year-grouped feed of Joseph's statements, **no** filter (single voice), bare money quotes (no "— speaker"), no thumbnails.

- [ ] **Step 4: Commit**
```bash
git add frontend/webapp/src/views/History/TranslationSources.jsx frontend/webapp/src/views/History/JosephSmith.js
git commit -m "feat(history): translation + joseph-smith pages use the shared archive feed

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Light up both hub sections

**Files:**
- Modify: `frontend/webapp/src/views/History/sections.js`
- Modify: `frontend/webapp/src/views/History/HistoryHub.jsx`
- Test: `frontend/webapp/src/views/History/__tests__/sections.test.js`

- [ ] **Step 1: Write/extend the failing test**

Add to `frontend/webapp/src/views/History/__tests__/sections.test.js` (create the file if absent; else add inside its describe block):
```javascript
import { getSection } from "../sections";

test("the translation and joseph-smith sections are live", () => {
  expect(getSection("translation").status).toBe("live");
  expect(getSection("josephSmith").status).toBe("live");
});
```

- [ ] **Step 2: Run to verify it fails**
```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/History/__tests__/sections.test.js --watchAll=false
```
Expected: FAIL — both are still `"placeholder"`.

- [ ] **Step 3: Flip both sections to live**

In `frontend/webapp/src/views/History/sections.js`, change the `translation` entry's `status: "placeholder"` to `status: "live"`, and the `josephSmith` entry's `status: "placeholder"` to `status: "live"`. (Two separate one-line edits — the `translation` entry is the first in the array, `josephSmith` the last.)

- [ ] **Step 4: Add hub featured picks for both**

In `frontend/webapp/src/views/History/HistoryHub.jsx`, `useFeatured()` currently tracks only `receptionDoc`. Add a translation doc pick and a static joseph portrait.

Change the state:
```javascript
  const [receptionDoc, setReceptionDoc] = useState(null);
```
to:
```javascript
  const [receptionDoc, setReceptionDoc] = useState(null);
  const [translationDoc, setTranslationDoc] = useState(null);
```

Change the effect body to also fetch translation:
```javascript
    BoMOnlineAPI({ history: { archive: "reception" } }).then((r) => {
      if (alive) setReceptionDoc(pickRandom(r && r.history));
    });
```
to:
```javascript
    BoMOnlineAPI({ history: { archive: "reception" } }).then((r) => {
      if (alive) setReceptionDoc(pickRandom(r && r.history));
    });
    BoMOnlineAPI({ history: { archive: "translation" } }).then((r) => {
      if (alive) setTranslationDoc(pickRandom(r && r.history));
    });
```

Add two keys to the returned object (beside `reception`/`witnesses`):
```javascript
    translation: translationDoc && {
      img: `${assetUrl}/history/thumbs/${String(translationDoc.id).padStart(4, "0")}`,
      caption: translationDoc.principal || translationDoc.document,
    },
    josephSmith: {
      img: `${assetUrl}/history/witnesses/people/joseph-smith.jpg`,
      caption: "Joseph Smith",
    },
```
(joseph-smith-statements docs have no thumbnail `id`, so the hub uses the existing Joseph portrait asset; the translation thumb 404s hide via the tile's existing `onError`.)

- [ ] **Step 5: Run the tests + the History suite**
```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/History --watchAll=false
```
Expected: all PASS.

- [ ] **Step 6: Visual check**
Screenshot `http://localhost:8200/history`: both **Translation Sources** and **Joseph Smith** tiles are live (not "Coming soon"), each with a featured preview (translation: a doc thumb + principal caption; joseph: the portrait + "Joseph Smith").

- [ ] **Step 7: Commit**
```bash
git add frontend/webapp/src/views/History/sections.js frontend/webapp/src/views/History/HistoryHub.jsx frontend/webapp/src/views/History/__tests__/sections.test.js
git commit -m "feat(history): mark translation + joseph-smith live and feature them on the hub

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] **Full History suite:**
```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/History --watchAll=false
```
Expected: all PASS.

- [ ] **End-to-end** at `http://localhost:8200`:
  - `/history` — Translation Sources and Joseph Smith are both live with previews.
  - `/history/translation` — year-grouped feed; Voice filter narrows to a principal; card opens the popup.
  - `/history/joseph-smith` — year-grouped feed of Joseph's statements; no filter; bare quotes; card opens the popup.

---

## Self-Review (against the spec)

**Spec coverage:**
- Shared `HistoryArchiveFeed` parameterized by archive + sectionKey → Task 1 ✅
- Year-grouped ascending feed, money-quote `HistorySourceCard`, popup on click → Task 1 ✅
- Person filter, shown only when >1 principal → Task 1 (`options.length > 1`) ✅
- joseph-smith graceful (bare quote / no thumb / hidden filter) → Task 1 (card gates + filter gate), verified by the SINGLE test ✅
- Two route wrappers → Task 2 ✅
- Both sections live + hub previews → Task 3 ✅
- No backend/query change → confirmed (history query already returns the fields) ✅
- Tests (group/sort, filter multi + hidden-single, render, popup underSlug, sections live) → Tasks 1 & 3 ✅

**Placeholder scan:** none — every step has concrete code/commands.

**Type/name consistency:** `groupByYearAscending`/`principalOptions` shapes (`[{year,items}]`, `[[principal,n]]`) match component + tests. `HistoryArchiveFeed({archive, sectionKey})` prop names match the wrappers (Task 2) and tests (Task 1). `underSlug` derived as `getSection(sectionKey).path` sans leading slash → `history/translation` / `history/joseph-smith`, matching the popup convention. Section keys (`translation`, `josephSmith`) match `sections.js` and the Task 3 assertions.
```
