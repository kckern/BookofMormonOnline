# Lost 116 Pages Archive Tile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the `lost-116-pages` history archive as a live, clickable tile on the `/history` hub, and add a sixth "coming soon" placeholder tile for a future Joseph-Smith-in-New-York archive.

**Architecture:** Pure frontend change in `frontend/webapp/`. The live view reuses the archive-generic `HistoryArchiveFeed` (one-line wrapper, like `TranslationSources.jsx`). The hub (`HistoryHub.jsx`) is driven by the `HISTORY_SECTIONS` registry in `sections.js`; we add two entries and teach the hub to render placeholder-status sections as non-clickable cards. No backend changes — the `history` loader already accepts any `archive` value with no allowlist.

**Tech Stack:** React 17 (function components + hooks), react-router-dom v5, react-scripts (CRA) Jest test runner, plain CSS.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `frontend/webapp/src/views/History/sections.js` | Single source of truth for hub tiles | Modify — add 2 entries + 1 icon import |
| `frontend/webapp/src/views/History/sections.test.js` | Strict registry-order + field contract | Modify — 6 keys, new assertions |
| `frontend/webapp/src/views/History/__tests__/sections.test.js` | Looser field-presence contract | Modify — extend live-status assertion |
| `frontend/webapp/src/views/History/LostPages.js` | Live detail view for the archive | Fill empty stub |
| `frontend/webapp/src/models/Routes.js` | Route table | Modify — lazy import + 1 route |
| `frontend/webapp/src/views/History/HistoryHub.jsx` | Renders the tile grid | Modify — archive map, placeholder card, lede |
| `frontend/webapp/src/views/History/HistoryHub.css` | Hub styling | Modify — placeholder + badge styles, lede wrap |

**Working directory for all commands:** `frontend/webapp/`

**Test command (CRA, single run):**
```bash
CI=true npx react-scripts test --watchAll=false src/views/History/sections.test.js src/views/History/__tests__/sections.test.js
```

---

## Task 1: Extend the section registry (TDD)

**Files:**
- Test: `frontend/webapp/src/views/History/sections.test.js`
- Test: `frontend/webapp/src/views/History/__tests__/sections.test.js`
- Modify: `frontend/webapp/src/views/History/sections.js`

- [ ] **Step 1: Update the strict test to expect six sections**

In `frontend/webapp/src/views/History/sections.test.js`, replace the first test (the
`.toEqual` registry-order test) and append two new assertions. Change:

```js
test("registry has four sections in the JS → Witnesses → Translation → Reception order", () => {
  expect(HISTORY_SECTIONS.map((s) => s.key)).toEqual([
    "josephSmith",
    "witnesses",
    "translation",
    "reception",
  ]);
});
```

to:

```js
test("registry has six sections in hub display order", () => {
  expect(HISTORY_SECTIONS.map((s) => s.key)).toEqual([
    "josephSmith",
    "witnesses",
    "translation",
    "reception",
    "lostPages",
    "josephNewYork",
  ]);
});

test("lostPages is a live thumbnail-hero archive", () => {
  const s = getSection("lostPages");
  expect(s.status).toBe("live");
  expect(s.archive).toBe("lost-116-pages");
  expect(s.hero).toEqual({ type: "randomThumb", archive: "lost-116-pages" });
});

test("josephNewYork is a placeholder section", () => {
  const s = getSection("josephNewYork");
  expect(s.status).toBe("placeholder");
  expect(s.hero.type).toBe("placeholder");
});
```

- [ ] **Step 2: Extend the looser test's live-status check**

In `frontend/webapp/src/views/History/__tests__/sections.test.js`, change:

```js
  test("the translation and joseph-smith sections are live", () => {
    expect(getSection("translation").status).toBe("live");
    expect(getSection("josephSmith").status).toBe("live");
  });
```

to:

```js
  test("the translation, joseph-smith, and lostPages sections are live", () => {
    expect(getSection("translation").status).toBe("live");
    expect(getSection("josephSmith").status).toBe("live");
    expect(getSection("lostPages").status).toBe("live");
  });
```

- [ ] **Step 3: Run the tests and verify they fail**

Run:
```bash
CI=true npx react-scripts test --watchAll=false src/views/History/sections.test.js src/views/History/__tests__/sections.test.js
```
Expected: FAIL — `lostPages` / `josephNewYork` are undefined (`getSection` returns null → "Cannot read properties of null"), and the `.toEqual` receives only 4 keys.

- [ ] **Step 4: Add the two registry entries and the icon import**

In `frontend/webapp/src/views/History/sections.js`, add this import after the existing
icon imports (after line 8, `import josephIcon ...`):

```js
import manuscriptIcon from "src/views/_Common/svg/facsimiles.svg";
```

Then, inside the `HISTORY_SECTIONS` array, insert these two entries immediately after the
`reception` object's closing `},` (before the array's closing `];`):

```js
  {
    key: "lostPages",
    title: "The Lost 116 Pages",
    path: "/history/lost-116-pages",
    icon: manuscriptIcon,
    blurb: "The lost Book of Lehi manuscript — what it contained and how it vanished.",
    unit: "documents",
    status: "live",
    // No thumbnails yet (rows have id: null); randomThumb falls back to the icon
    // placeholder and auto-upgrades if thumbnails ever land.
    hero: { type: "randomThumb", archive: "lost-116-pages" },
    archive: "lost-116-pages",
  },
  {
    key: "josephNewYork",
    title: "Joseph Smith in New York",
    path: "/history/joseph-smith-new-york", // reserved; not routed yet
    icon: josephIcon,
    blurb: "The prophet's early years and the coming forth of the record in New York.",
    unit: "documents",
    status: "placeholder",
    hero: { type: "placeholder", icon: josephIcon },
  },
```

Also update the order comment on line 2-3 of the file, changing:

```js
// hub (JS → Witnesses → Translation → Reception). Reorder here.
```

to:

```js
// hub (JS → Witnesses → Translation → Reception → Lost Pages → JS in New York).
// Reorder here.
```

- [ ] **Step 5: Run the tests and verify they pass**

Run:
```bash
CI=true npx react-scripts test --watchAll=false src/views/History/sections.test.js src/views/History/__tests__/sections.test.js
```
Expected: PASS — all tests green in both files.

- [ ] **Step 6: Commit**

```bash
git add src/views/History/sections.js src/views/History/sections.test.js src/views/History/__tests__/sections.test.js
git commit -m "feat(history): register Lost 116 Pages + JS-in-NY placeholder sections"
```

---

## Task 2: Live detail view + route

**Files:**
- Modify: `frontend/webapp/src/views/History/LostPages.js` (empty stub)
- Modify: `frontend/webapp/src/models/Routes.js`

- [ ] **Step 1: Fill the LostPages wrapper**

Replace the entire contents of `frontend/webapp/src/views/History/LostPages.js` with:

```jsx
/** @format */
import React from "react";
import HistoryArchiveFeed from "./HistoryArchiveFeed";

// Live view for the 'lost-116-pages' history archive — the lost Book of Lehi
// manuscript and the documents that describe it. Thin wrapper over the
// archive-generic feed, exactly like TranslationSources.jsx.
export default function LostPages() {
  return <HistoryArchiveFeed archive="lost-116-pages" sectionKey="lostPages" />;
}
```

- [ ] **Step 2: Add the lazy import in Routes.js**

In `frontend/webapp/src/models/Routes.js`, after the existing history lazy imports
(after line 51, `const TranslationSources = lazy(...)`), add:

```js
const LostPages = lazy(() => import("../views/History/LostPages.js"));
```

- [ ] **Step 3: Register the route before the catch-all**

In `frontend/webapp/src/models/Routes.js`, locate the `/history/reception/:slug?` route
(around line 205-208) and insert the new route immediately after it and **before** the
`/history/:slug` catch-all (which redirects to reception). The result should read:

```js
  {
      path: "/history/reception/:slug?",
      component: History,
  },
  {
      path: "/history/lost-116-pages",
      component: LostPages,
  },
  {
      path: "/history/:slug",
      component: RedirectReceptionSlug,
  },
```

- [ ] **Step 4: Verify the route resolves**

Ensure the dev frontend is running (`systemctl --user status bom-dev`, or
`npm start` on a laptop), then check the page loads without a redirect to reception:
```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8200/history/lost-116-pages
```
Expected: `200`. (This is a client-rendered SPA route — the 200 confirms the app shell
serves; visual confirmation happens in Task 5.)

- [ ] **Step 5: Commit**

```bash
git add src/views/History/LostPages.js src/models/Routes.js
git commit -m "feat(history): live /history/lost-116-pages archive view + route"
```

---

## Task 3: Hub renders both tile states

**Files:**
- Modify: `frontend/webapp/src/views/History/HistoryHub.jsx`

- [ ] **Step 1: Register the live archive so the tile fetches its count + sampler**

In `frontend/webapp/src/views/History/HistoryHub.jsx`, in the `ARCHIVE_BY_KEY` object
(lines 13-18), add the `lostPages` entry:

```js
const ARCHIVE_BY_KEY = {
  josephSmith: "joseph-smith-statements",
  translation: "translation",
  reception: "reception",
  witnesses: "witnesses",
  lostPages: "lost-116-pages",
};
```

Do **not** add `josephNewYork` — the placeholder has no archive to fetch.

- [ ] **Step 2: Add a PlaceholderCard component**

In `frontend/webapp/src/views/History/HistoryHub.jsx`, immediately before the existing
`function Card({ section, list })` (line 121), add:

```jsx
// A non-clickable "coming soon" tile: hero + title + badge + blurb, no archive
// fetch, no signal or sampler. Distinct component so the live Card's hooks stay
// unconditional (react-hooks/rules-of-hooks).
function PlaceholderCard({ section }) {
  return (
    <div className="historyCard historyCard--placeholder">
      <Hero section={section} list={null} />
      <div className="historyCard-body">
        <div className="historyCard-name">{section.title}</div>
        <div className="historyCard-badge">Coming Soon</div>
        <div className="historyCard-blurb">{section.blurb}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Branch the grid on section status**

In `frontend/webapp/src/views/History/HistoryHub.jsx`, in the `HistoryHub` component's
returned grid (lines 159-163), change:

```jsx
          <div className="historyHub-grid">
            {HISTORY_SECTIONS.map((s) => (
              <Card key={s.key} section={s} list={lists[s.key]} />
            ))}
          </div>
```

to:

```jsx
          <div className="historyHub-grid">
            {HISTORY_SECTIONS.map((s) =>
              s.status === "placeholder" ? (
                <PlaceholderCard key={s.key} section={s} />
              ) : (
                <Card key={s.key} section={s} list={lists[s.key]} />
              )
            )}
          </div>
```

- [ ] **Step 4: Update the masthead lede for the new count**

In `frontend/webapp/src/views/History/HistoryHub.jsx`, change the lede (lines 154-156):

```jsx
            <p className="historyHub-lede">
              Four collections tracing the record from its coming forth to its reception in the world.
            </p>
```

to:

```jsx
            <p className="historyHub-lede">
              Five collections tracing the record from its coming forth to its reception in the world — with more on the way.
            </p>
```

- [ ] **Step 5: Verify the app compiles**

Confirm the dev bundle rebuilds without errors:
```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8200/history
```
Expected: `200`, and (if running `npm start`) no compile errors / ESLint hook warnings
in the terminal. Visual confirmation happens in Task 5.

- [ ] **Step 6: Commit**

```bash
git add src/views/History/HistoryHub.jsx
git commit -m "feat(history): hub renders live Lost Pages tile + placeholder card"
```

---

## Task 4: Placeholder + badge styling

**Files:**
- Modify: `frontend/webapp/src/views/History/HistoryHub.css`

- [ ] **Step 1: Let the longer lede wrap gracefully**

In `frontend/webapp/src/views/History/HistoryHub.css`, change the `.historyHub-lede`
rule (lines 33-38) from:

```css
.historyHub-lede {
  color: var(--ink-soft);
  font-size: 0.9rem;
  white-space: nowrap;
  margin: 0 auto;
}
```

to:

```css
.historyHub-lede {
  color: var(--ink-soft);
  font-size: 0.9rem;
  max-width: 40em;
  margin: 0 auto;
}
```

(Removing `white-space: nowrap` so the longer sentence wraps instead of overflowing on
narrow viewports.)

- [ ] **Step 2: Add placeholder card + badge styles**

In `frontend/webapp/src/views/History/HistoryHub.css`, add the following block
immediately after the `.historyCard:hover` rule (after line 71):

```css
/* ── placeholder ("coming soon") tile — non-clickable, muted ── */
.historyCard--placeholder {
  background: #f3f3f3;
  cursor: default;
}
.historyCard--placeholder:hover {
  background: #f3f3f3; /* no hover lift/brighten */
  border-color: var(--line);
  bottom: 0;
}
.historyCard--placeholder .historyHero {
  filter: grayscale(0.45);
  opacity: 0.85;
}
.historyCard-badge {
  font-family: "Roboto", "Roboto Condensed", sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.62rem;
  font-weight: 700;
  color: #888;
  margin: 0.32em 0 0.45em;
}
```

- [ ] **Step 3: Add the dark-mode placeholder rule**

In `frontend/webapp/src/views/History/HistoryHub.css`, in the dark-mode block, add after
the `html[data-theme="dark"] .historyCard:hover` rule (after line 189):

```css
html[data-theme="dark"] .historyCard--placeholder { background: #1c1c1c; }
html[data-theme="dark"] .historyCard--placeholder:hover { background: #1c1c1c; }
```

- [ ] **Step 4: Commit**

```bash
git add src/views/History/HistoryHub.css
git commit -m "style(history): placeholder tile treatment + coming-soon badge"
```

---

## Task 5: Full manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full history test suite**

Run:
```bash
CI=true npx react-scripts test --watchAll=false src/views/History
```
Expected: PASS — all History tests green (sections, archive feed, source card,
breadcrumb).

- [ ] **Step 2: Verify the hub visually**

Open `http://localhost:8200/history` in a browser (use localhost, not `bom.kckern.net` —
Cloudflare caches the dev bundle for 4h). Confirm:
- Six tiles in order: Joseph Smith · The Witnesses · Translation Process · Reception
  History · The Lost 116 Pages · Joseph Smith in New York.
- "The Lost 116 Pages" tile shows a signal line (count + date range, e.g.
  "24 DOCUMENTS · 1828–1924") and a money-quote sampler, and its hero shows the
  manuscript icon placeholder.
- "Joseph Smith in New York" tile is greyed with a "COMING SOON" badge, no signal/quote,
  and does not respond to hover as a link (cursor is default).
- The lede reads "Five collections … with more on the way."

- [ ] **Step 3: Verify the live archive view**

Click "The Lost 116 Pages" (or open `http://localhost:8200/history/lost-116-pages`).
Confirm:
- Breadcrumb reads History › The Lost 116 Pages.
- Documents render in ascending chronological groups (1828 first).
- A "Voice" filter dropdown lists principals (Joseph Smith, Martin Harris, etc.) with
  counts; selecting one filters the cards.
- Clicking a card opens the history popup with the money-quote.

- [ ] **Step 4: Verify the placeholder is not navigable**

Confirm clicking the "Joseph Smith in New York" tile does nothing (no navigation, no
console error). Directly visiting `http://localhost:8200/history/joseph-smith-new-york`
falls through to the `/history/:slug` redirect (to `/history/reception/...`) — acceptable,
since the tile is display-only and not linked.

- [ ] **Step 5: Final confirmation**

All tests pass and all visual checks confirmed. No further commit needed (Tasks 1-4
committed their own changes).

---

## Self-Review Notes

- **Spec coverage:** All six spec files are covered — sections.js (Task 1), tests (Task 1),
  LostPages.js + Routes.js (Task 2), HistoryHub.jsx (Task 3), HistoryHub.css (Task 4).
  Acceptance criteria 1-6 map to Task 5 verification steps.
- **Hook safety:** PlaceholderCard is a separate component (Task 3 Step 2) so the live
  `Card`'s `useMemo` calls remain unconditional — avoids react-hooks/rules-of-hooks.
- **Naming consistency:** `lostPages` / `josephNewYork` keys and `lost-116-pages` archive
  string are used identically across sections.js, LostPages.js, Routes.js path, and
  HistoryHub.jsx `ARCHIVE_BY_KEY`.
- **No backend task:** confirmed the `history` loader has no archive allowlist.
