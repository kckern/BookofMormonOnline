# History Hub Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/history` hub landing (`HistoryHub.jsx`) into an archival front door — a 2×2 of horizontal split cards (image-left at a clamped 4:3, text-right), each showing a hero and a live `COUNT · DATE-RANGE`, with the Witnesses card rendered as a three-portrait radial "pie."

**Architecture:** Frontend-only, inside `frontend/webapp/src/views/History/`. `sections.js` becomes the single source of section config (order, hero descriptor, unit, blurb). A pure helper derives the count/date-range signal from an archive list. `HistoryHub.jsx` fetches the three document archives (reusing the existing transcript-free `history` call), derives per-section signals, and renders the masthead + split cards. `HistoryHub.css` is rewritten for the split card, 4:3 clamp, radial pie, house link styling, dark mode, and responsive breakpoints. No backend or GraphQL-query changes.

**Tech Stack:** React 17 (function components + hooks), `BoMOnlineAPI` (GraphQL-over-REST, IndexedDB-cached), plain CSS, Jest + React Testing Library v11 (`react-scripts test`).

**Spec:** `docs/specs/2026-08-09-history-hub-redesign.md`

---

## File Structure

- `frontend/webapp/src/views/History/sections.js` — **modify.** Reorder to JS → Witnesses → Translation → Reception; add `hero`, `unit`, `blurb` per section; keep `key/title/path/icon/status`; keep `getSection`/`pickRandom`. Retitle "Translation Sources" → "Translation Process".
- `frontend/webapp/src/views/History/sections.test.js` — **modify.** Extend existing tests for the new fields and order.
- `frontend/webapp/src/views/History/historySignal.js` — **create.** Pure helpers: `deriveSignal(list)` → `{count,minYear,maxYear}`, and `formatSignal(count, unit, minYear, maxYear)` → display string.
- `frontend/webapp/src/views/History/historySignal.test.js` — **create.** Unit tests for the helpers.
- `frontend/webapp/src/views/History/HistoryHub.jsx` — **rewrite.** Masthead + split-card grid; `useArchiveSignals()` hook; per-hero rendering (image / pie / placeholder / randomThumb).
- `frontend/webapp/src/views/History/HistoryHub.css` — **rewrite.** Split card, 4:3 clamp, radial pie, gold divider, house card bg/hover, masthead, dark mode, responsive.

---

## Task 1: Section registry — reorder + hero/unit/blurb config

**Files:**
- Modify: `frontend/webapp/src/views/History/sections.js`
- Test: `frontend/webapp/src/views/History/sections.test.js`

- [ ] **Step 1: Update the test to lock the new order and fields**

Replace the entire contents of `sections.test.js` with:

```js
import { HISTORY_SECTIONS, getSection, pickRandom } from "./sections";

test("registry has four sections in the JS → Witnesses → Translation → Reception order", () => {
  expect(HISTORY_SECTIONS.map((s) => s.key)).toEqual([
    "josephSmith",
    "witnesses",
    "translation",
    "reception",
  ]);
});

test("every section has the required display + hero fields", () => {
  const HERO_TYPES = ["image", "pie", "placeholder", "randomThumb"];
  for (const s of HISTORY_SECTIONS) {
    expect(s.key).toBeTruthy();
    expect(s.title).toBeTruthy();
    expect(s.path).toMatch(/^\/history/);
    expect(s.blurb).toBeTruthy();
    expect(s.unit).toBeTruthy();
    expect(["live", "placeholder"]).toContain(s.status);
    expect(s.hero).toBeTruthy();
    expect(HERO_TYPES).toContain(s.hero.type);
  }
});

test("Translation is retitled to 'Translation Process'", () => {
  expect(getSection("translation").title).toBe("Translation Process");
});

test("hero descriptors carry the data each type needs", () => {
  expect(getSection("josephSmith").hero.src).toMatch(/joseph-smith\.jpg$/);
  expect(getSection("witnesses").hero.srcs).toHaveLength(3);
  expect(getSection("translation").hero.icon).toBeTruthy();
  expect(getSection("reception").hero.archive).toBe("reception");
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

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/History/sections.test.js --watchAll=false`
Expected: FAIL — order assertion and missing `hero`/`unit`/`blurb` fields.

- [ ] **Step 3: Rewrite `sections.js`**

Replace the entire contents of `sections.js` with:

```js
/** @format */
// Single source of truth for the /history sections. Order = display order in the
// hub (JS → Witnesses → Translation → Reception). Reorder here.
import { assetUrl } from "src/models/BoMOnlineAPI";
import receptionIcon from "src/views/_Common/svg/history.svg";
import witnessIcon from "src/views/People/svg/group.svg";
import translationIcon from "src/views/_Common/svg/book.svg";
import josephIcon from "src/views/People/svg/prophet.svg";

const person = (slug) => `${assetUrl}/history/witnesses/people/${slug}.jpg`;

export const HISTORY_SECTIONS = [
  {
    key: "josephSmith",
    title: "Joseph Smith",
    path: "/history/joseph-smith",
    icon: josephIcon,
    blurb: "Statements by and about Joseph Smith.",
    unit: "statements",
    status: "live",
    hero: { type: "image", src: person("joseph-smith") },
  },
  {
    key: "witnesses",
    title: "The Witnesses",
    path: "/history/witnesses",
    icon: witnessIcon,
    blurb: "Those who testified they saw and handled the plates.",
    unit: "witnesses",
    status: "live",
    // radial 3-wedge pie, vertex @ 50%/38% (see HistoryHub.css .pie)
    hero: {
      type: "pie",
      srcs: [person("oliver-cowdery"), person("david-whitmer"), person("martin-harris")],
    },
    // static signal — no archive fetch
    signal: "22 WITNESSES · THREE, EIGHT & OTHERS",
  },
  {
    key: "translation",
    title: "Translation Process",
    path: "/history/translation",
    icon: translationIcon,
    blurb: "How the Book of Mormon was brought forth and rendered into English.",
    unit: "documents",
    status: "live",
    // Translation docs have no thumbnails — icon placeholder on the paper field
    hero: { type: "placeholder", icon: translationIcon },
    archive: "translation",
  },
  {
    key: "reception",
    title: "Reception History",
    path: "/history/reception",
    icon: receptionIcon,
    blurb: "How the book was reviewed, attacked, and defended in its own day.",
    unit: "documents",
    status: "live",
    hero: { type: "randomThumb", archive: "reception" },
    archive: "reception",
  },
];

export const getSection = (key) =>
  HISTORY_SECTIONS.find((s) => s.key === key) || null;

export const pickRandom = (arr) =>
  Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
```

> Note: `josephSmith`'s archive is `"joseph-smith-statements"` (see `JosephSmith.js:63`). It is intentionally **not** on the section object — the hub maps it explicitly in Task 3 so the section stays UI-only. Verify the four SVG import paths resolve (they are the same imports the current `sections.js` uses).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/History/sections.test.js --watchAll=false`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/sections.js frontend/webapp/src/views/History/sections.test.js
git commit -m "feat(history): reorder hub sections + add hero/unit/blurb config"
```

---

## Task 2: Signal-derivation helpers (pure)

**Files:**
- Create: `frontend/webapp/src/views/History/historySignal.js`
- Test: `frontend/webapp/src/views/History/historySignal.test.js`

- [ ] **Step 1: Write the failing test**

Create `historySignal.test.js`:

```js
import { deriveSignal, formatSignal } from "./historySignal";

test("deriveSignal returns count and year range, ignoring missing years", () => {
  const list = [{ year: 1830 }, { year: 1829 }, { year: null }, { year: 1844 }];
  expect(deriveSignal(list)).toEqual({ count: 4, minYear: 1829, maxYear: 1844 });
});

test("deriveSignal handles empty / non-array input", () => {
  expect(deriveSignal([])).toEqual({ count: 0, minYear: null, maxYear: null });
  expect(deriveSignal(null)).toEqual({ count: 0, minYear: null, maxYear: null });
});

test("formatSignal builds the uppercase COUNT · RANGE line", () => {
  expect(formatSignal(580, "documents", 1829, 1844)).toBe("580 DOCUMENTS · 1829–1844");
});

test("formatSignal collapses a single-year range", () => {
  expect(formatSignal(3, "statements", 1830, 1830)).toBe("3 STATEMENTS · 1830");
});

test("formatSignal returns null when there is no count", () => {
  expect(formatSignal(0, "documents", null, null)).toBeNull();
});

test("formatSignal omits the range when years are unknown", () => {
  expect(formatSignal(5, "documents", null, null)).toBe("5 DOCUMENTS");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/History/historySignal.test.js --watchAll=false`
Expected: FAIL — "Cannot find module './historySignal'".

- [ ] **Step 3: Write the implementation**

Create `historySignal.js`:

```js
/** @format */
// Pure helpers: turn a history archive list into a display "COUNT · RANGE" signal.

export function deriveSignal(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return { count: 0, minYear: null, maxYear: null };
  }
  const years = list
    .map((d) => parseInt(d && d.year, 10))
    .filter((y) => Number.isFinite(y));
  return {
    count: list.length,
    minYear: years.length ? Math.min(...years) : null,
    maxYear: years.length ? Math.max(...years) : null,
  };
}

export function formatSignal(count, unit, minYear, maxYear) {
  if (!count) return null;
  const head = `${count} ${String(unit).toUpperCase()}`;
  if (minYear == null || maxYear == null) return head;
  const range = minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`;
  return `${head} · ${range}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/History/historySignal.test.js --watchAll=false`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/historySignal.js frontend/webapp/src/views/History/historySignal.test.js
git commit -m "feat(history): pure signal-derivation helpers for hub cards"
```

---

## Task 3: Rewrite `HistoryHub.jsx` (masthead + split cards + heroes)

**Files:**
- Rewrite: `frontend/webapp/src/views/History/HistoryHub.jsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `HistoryHub.jsx` with:

```jsx
/** @format */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "../../models/Utils";
import { HISTORY_SECTIONS, pickRandom } from "./sections";
import { deriveSignal, formatSignal } from "./historySignal";
import "./HistoryHub.css";

// Section key -> archive name to fetch a live list for (count + date range).
// josephSmith's archive name differs from its key (see JosephSmith.js).
const ARCHIVE_BY_KEY = {
  josephSmith: "joseph-smith-statements",
  translation: "translation",
  reception: "reception",
};

const thumbUrl = (id) => `${assetUrl}/history/thumbs/${String(id).padStart(4, "0")}`;

// Fetch each document archive once; expose { list } per section key.
function useArchiveLists() {
  const [lists, setLists] = useState({});
  useEffect(() => {
    let alive = true;
    Object.entries(ARCHIVE_BY_KEY).forEach(([key, archive]) => {
      BoMOnlineAPI({ history: { archive } }).then((r) => {
        if (alive) setLists((prev) => ({ ...prev, [key]: (r && r.history) || [] }));
      });
    });
    return () => { alive = false; };
  }, []);
  return lists;
}

function HeroImage({ src }) {
  return (
    <div className="historyHero">
      <img src={src} alt="" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
    </div>
  );
}

function HeroPie({ srcs }) {
  // radial 3-wedge pie; wedge geometry + object-position live in CSS classes w0/w1/w2
  return (
    <div className="historyHero historyHero--pie">
      {srcs.map((src, i) => (
        <img key={i} className={`w${i}`} src={src} alt="" />
      ))}
    </div>
  );
}

function HeroPlaceholder({ icon }) {
  return (
    <div className="historyHero historyHero--placeholder">
      <img src={icon} alt="" />
    </div>
  );
}

function Hero({ section, list }) {
  const { hero } = section;
  if (hero.type === "image") return <HeroImage src={hero.src} />;
  if (hero.type === "pie") return <HeroPie srcs={hero.srcs} />;
  if (hero.type === "placeholder") return <HeroPlaceholder icon={hero.icon} />;
  if (hero.type === "randomThumb") {
    const pick = pickRandom(list);
    return pick && pick.id != null
      ? <HeroImage src={thumbUrl(pick.id)} />
      : <HeroPlaceholder icon={section.icon} />;
  }
  return <HeroPlaceholder icon={section.icon} />;
}

function Card({ section, list }) {
  const signal = useMemo(() => {
    if (section.signal) return section.signal; // static (Witnesses)
    if (!list) return null; // still loading — omit line, never gape
    const { count, minYear, maxYear } = deriveSignal(list);
    return formatSignal(count, section.unit, minYear, maxYear);
  }, [section, list]);

  return (
    <Link className="historyCard" to={section.path}>
      <Hero section={section} list={list} />
      <div className="historyCard-body">
        <div className="historyCard-name">{section.title}</div>
        {signal ? <div className="historyCard-sig">{signal}</div> : null}
        <div className="historyCard-blurb">{section.blurb}</div>
      </div>
    </Link>
  );
}

export default function HistoryHub() {
  useEffect(() => {
    document.title = label("menu_history") + " | " + label("home_title");
  }, []);
  const lists = useArchiveLists();
  return (
    <div className="container" style={{ display: "block" }}>
      <div id="page">
        <div className="historyHub">
          <div className="historyHub-masthead">
            <div className="historyHub-kicker">The Book of Mormon in History</div>
            <h1 className="historyHub-title">Historical Sources</h1>
            <p className="historyHub-lede">
              Four collections tracing the record from its coming forth to its reception in the world.
            </p>
            <div className="historyHub-rule" />
          </div>
          <div className="historyHub-grid">
            {HISTORY_SECTIONS.map((s) => (
              <Card key={s.key} section={s} list={lists[s.key]} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

> Notes for the implementer:
> - `witnesses` has no entry in `ARCHIVE_BY_KEY`, so `lists.witnesses` stays `undefined` — fine, its `section.signal` is static.
> - The old `useFeatured()` + `WITNESSES` import are intentionally gone.
> - The masthead uses literal English strings (matching the current hardcoded English in `sections.js`); the previous `label("title_history")` heading is replaced by the kicker/title/lede. Leave the `document.title` label calls intact.

- [ ] **Step 2: Verify the app compiles**

Run: `cd frontend/webapp && CI=true npx eslint src/views/History/HistoryHub.jsx`
Expected: no errors (warnings from the shared config are acceptable).

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/History/HistoryHub.jsx
git commit -m "feat(history): rebuild hub as split cards with live signals + heroes"
```

---

## Task 4: Rewrite `HistoryHub.css` (split card, 4:3 clamp, pie, house style, dark, responsive)

**Files:**
- Rewrite: `frontend/webapp/src/views/History/HistoryHub.css`

- [ ] **Step 1: Replace the stylesheet**

Replace the entire contents of `HistoryHub.css` with:

```css
/** @format */
/* History hub — archival front door. Palette + card behavior borrowed from
   HistorySourceCard.css so the hub reads as part of the same collection. */

.historyHub {
  --paper: #f2ede1;
  --paper2: #e8ddc8;
  --ink: #1c1a16;
  --ink-soft: #6b5f4d;
  --gold: #c9a24b;
  --meta: #555;
  --line: rgba(0, 0, 0, 0.25);
  max-width: 960px;
  margin: 1.5em auto;
  padding: 1.6em;
  background: linear-gradient(180deg, var(--paper), var(--paper2));
  border: 1px solid #d9cdb4;
  border-radius: 10px;
  color: var(--ink);
}

/* ── masthead ─────────────────────────────────────────────── */
.historyHub-masthead { text-align: center; }
.historyHub-kicker {
  font-family: "Roboto", "Roboto Condensed", sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.64rem;
  font-weight: 700;
  color: #9a7d2e;
}
.historyHub-title {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.9rem;
  font-weight: 800;
  margin: 0.12em 0 0.1em;
}
.historyHub-lede {
  color: var(--ink-soft);
  font-family: Georgia, serif;
  font-size: 0.9rem;
  max-width: 46ch;
  margin: 0 auto;
}
.historyHub-rule {
  width: 64px;
  height: 2px;
  background: var(--gold);
  margin: 0.9em auto 1.4em;
}

/* ── grid of split cards ──────────────────────────────────── */
.historyHub-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

/* card: image full-height LEFT (clamped 4:3), text RIGHT. Follows the house
   HistorySourceCard: #EEE bg, dark border, hover -> #FFF + lift. */
.historyCard {
  display: grid;
  grid-template-columns: 46% 1fr;
  text-decoration: none;
  color: inherit;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  background: #eee;
  position: relative;
  transition: background-color 0.12s, border-color 0.12s;
}
.historyCard:hover {
  background: #fff;
  border-color: #000;
  bottom: 2px;
}

/* ── hero (left column) — ASPECT CLAMP: 4:3, never panoramic ── */
.historyHero {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-right: 3px solid var(--gold);
  background: #cfc6b4;
}
.historyHero > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  filter: sepia(0.18) contrast(1.02);
}

/* icon placeholder (Translation): centered mark on the paper field */
.historyHero--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 42%, #efe7d6, #e2d6bd);
}
.historyHero--placeholder > img {
  width: 42%;
  height: auto;
  object-fit: contain;
  opacity: 0.55;
  filter: none;
}

/* radial 3-wedge pie (Witnesses): wedges converge at 50%/38% (eye-line) */
.historyHero--pie > img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: sepia(0.18) contrast(1.02);
}
.historyHero--pie .w0 { /* Oliver — upper-left */
  object-position: 34% 24%;
  clip-path: polygon(50% 38%, 50% 0, 0 0, 0 67%);
}
.historyHero--pie .w1 { /* David — upper-right */
  object-position: 66% 24%;
  clip-path: polygon(50% 38%, 50% 0, 100% 0, 100% 67%);
}
.historyHero--pie .w2 { /* Martin — lower center */
  object-position: center 44%;
  clip-path: polygon(50% 38%, 0 67%, 0 100%, 100% 100%, 100% 67%);
}

/* ── text (right column) ──────────────────────────────────── */
.historyCard-body {
  padding: 14px 16px;
  align-self: center;
}
.historyCard-name {
  font-family: Georgia, serif;
  font-size: 1.32rem;
  font-weight: 800;
  color: #000; /* house link style: black, no underline */
  line-height: 1.06;
}
.historyCard-sig {
  font-family: "Roboto", "Roboto Condensed", sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--meta);
  margin: 0.32em 0 0.45em;
}
.historyCard-blurb {
  font-family: Georgia, serif;
  color: var(--ink-soft);
  font-size: 0.85rem;
  line-height: 1.34;
}

/* ── dark mode — parity with HistorySourceCard dark treatment ── */
html[data-theme="dark"] .historyHub {
  --ink: #e8dfce;
  --ink-soft: #a99e88;
  --paper: #1c1913;
  --paper2: #141109;
  border-color: #3a352b;
}
html[data-theme="dark"] .historyCard { background: #222; border-color: #000; }
html[data-theme="dark"] .historyCard:hover { background: #2b2b2b; }
html[data-theme="dark"] .historyCard-name { color: #eee; }
html[data-theme="dark"] .historyCard-sig { color: #9a9a9a; }
html[data-theme="dark"] .historyHero > img,
html[data-theme="dark"] .historyHero--pie > img { filter: sepia(0.26) brightness(0.8) contrast(1.02); }

/* ── responsive ───────────────────────────────────────────── */
@media (max-width: 700px) {
  .historyHub-grid { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .historyCard { grid-template-columns: 1fr; }        /* stack: image over text */
  .historyHero { border-right: none; border-bottom: 3px solid var(--gold); }
}
```

- [ ] **Step 2: Verify the app builds the styles (no syntax errors)**

Run: `cd frontend/webapp && node -e "require('fs').readFileSync('src/views/History/HistoryHub.css','utf8'); console.log('css read ok')"`
Expected: `css read ok` (sanity that the file is present/valid text; CRA compiles CSS at dev/build time).

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/History/HistoryHub.css
git commit -m "style(history): archival split-card hub — 4:3 clamp, pie, dark, responsive"
```

---

## Task 5: Visual verification (desktop, mobile, dark) + full suite

**Files:** none (verification only)

- [ ] **Step 1: Confirm the dev server serves the new hub**

The dev unit (`bom-dev`) serves the CRA bundle on `:8200` with HMR. Confirm it is up:
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8201` (CRA human bundle) — expect `200`.
If the app is not running locally, start it per CLAUDE.md (`systemctl --user status bom-dev`).

- [ ] **Step 2: Screenshot desktop, mobile, and dark mode**

Run this Node script (Playwright is installed at the repo root):

```bash
node -e '
const { chromium } = require("/home/bom/BookofMormonOnline/node_modules/playwright");
(async () => {
  const b = await chromium.launch();
  const shots = [
    ["hub-desktop", 1280, "light"],
    ["hub-mobile", 420, "light"],
    ["hub-dark", 1280, "dark"],
  ];
  for (const [name, w, theme] of shots) {
    const p = await b.newPage({ viewport: { width: w, height: 1000 } });
    await p.goto("http://localhost:8200/history", { waitUntil: "networkidle", timeout: 45000 });
    if (theme === "dark") { await p.evaluate(() => document.documentElement.setAttribute("data-theme","dark")); await p.waitForTimeout(500); }
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `/tmp/${name}.png`, fullPage: true });
    await p.close();
    console.log(name, "ok");
  }
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
'
```

- [ ] **Step 3: Inspect the three screenshots against acceptance criteria**

Read `/tmp/hub-desktop.png`, `/tmp/hub-mobile.png`, `/tmp/hub-dark.png` and confirm each spec acceptance criterion:
- Order JS · Witnesses / Translation · Reception; masthead present.
- **No empty/gaping tile.** Translation shows the icon placeholder; every card has a hero.
- Heroes clamped to 4:3, no panoramic overcrop; faces intact.
- Witnesses shows the 3-portrait radial pie, faces un-cut around the 38% vertex.
- Live `COUNT · DATE-RANGE` on JS / Translation / Reception (≈ `26 STATEMENTS · 1823–1844`, `155 DOCUMENTS · 1827–1998`, `580 DOCUMENTS · 1829–1844`); Witnesses shows the static line.
- Titles black serif, no underline; hover behavior matches source card.
- Mobile: single column; Dark: card `#222`, readable.

If any portrait face is mis-centered in its wedge, tune the `object-position` values in `.historyHero--pie .w0/.w1/.w2` and re-shoot.

- [ ] **Step 4: Run the History test suite**

Run: `cd frontend/webapp && CI=true npx react-scripts test src/views/History --watchAll=false`
Expected: PASS — including `sections.test.js`, `historySignal.test.js`, and the existing `HistoryBreadcrumb.test.jsx`.

- [ ] **Step 5: Commit any object-position tuning**

```bash
git add -A frontend/webapp/src/views/History/
git commit -m "test(history): verify hub redesign across desktop/mobile/dark"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Layout / split card / order → Task 3 (JSX) + Task 4 (CSS). ✓
- 4:3 aspect clamp → Task 4 `.historyHero`. ✓
- Witnesses radial pie @ 50%/38% → Task 4 `.historyHero--pie`. ✓
- House link style (black, no underline, #EEE→#FFF hover-lift) → Task 4. ✓
- Curated/placeholder/random heroes → Task 1 config + Task 3 `Hero`. ✓
- Live COUNT·DATE-RANGE + graceful fallback → Task 2 helpers + Task 3 `Card`. ✓ (fallback: `signal` null while `list` undefined → line omitted.)
- Reception random thumb reuses fetched list → Task 3 `Hero` randomThumb branch. ✓
- Dark mode parity → Task 4. ✓
- Responsive 2-col/1-col/stacked → Task 4 media queries. ✓
- No sub-page regression → no sub-page files touched; Task 5 runs the History suite. ✓

**Open copy item (not blocking):** Joseph Smith blurb ships as "Statements by and about Joseph Smith." (spec §Copy item 1); swap the string in `sections.js` when final wording lands.

**Placeholder scan:** No TBD/TODO code steps; every code step shows complete content. ✓

**Type consistency:** `deriveSignal`/`formatSignal` signatures match between Task 2 definition and Task 3 usage; hero `type` values (`image`/`pie`/`placeholder`/`randomThumb`) match between `sections.js` (Task 1) and `Hero` (Task 3); CSS classes `w0/w1/w2` match between `HeroPie` (Task 3) and `.historyHero--pie` (Task 4). ✓
