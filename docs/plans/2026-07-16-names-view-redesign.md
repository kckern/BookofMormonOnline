# Names View Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all eight recommendations of `docs/audits/2026-07-16-names-view-design-audit.md` — turning the Names view from a wall of inert gray pills into a faceted, themeable, shareable onomasticon browser whose signature element is visible name morphology.

**Architecture:** Extract all filter/segmentation/URL logic into a pure module (`logic.js`) developed test-first with jest; `Names.js` becomes a thin component layer over it. Facets move from six stock dropdowns to four count-annotated searchable selects plus chip rows for Culture/Type. A tile click opens an inline detail panel (segmentation, culture badges, gloss, entity-popup links via the app's cached `personList`/`placeList`). Filters serialize to the querystring. Dark mode is covered by a new `darkmode/_names.scss` partial following the app's `html[data-theme="dark"]` override pattern.

**Tech Stack:** React 17 (hooks, no controller migration needed for this leaf view), react-multi-select-component 4.3.4, react-router-dom 5.2 (`useLocation`/`useHistory`), jest + @testing-library/react 11 via `react-scripts test`, Sass dark-mode partials.

---

## Context for a zero-context engineer

**Read these first:**
- `docs/audits/2026-07-16-names-view-design-audit.md` — the eight recommendations this plan implements.
- `docs/reference/bom-names-dataset.md` — dataset schema and provenance.
- `frontend/webapp/src/views/Analysis/Names/` — the three files you'll mostly touch (`Names.js`, `Names.css`, `data.js`).

**Codebase facts you need (verified 2026-07-16):**
- `data.js` default-exports 210 entries `{ name, types[], cultures[], prefix, stems[], affix, suffix, note }` and a named export `facets` (unique value inventories). Morphemes are written with tildes: prefix `"Am~"`, affix `"~iant~"`, suffix `"~on"`.
- `label(key)` (`src/models/Utils.js:95`) returns the **key itself** when it's not in `global.dictionary`, and `" "` when the dictionary hasn't loaded. New keys won't exist in the backend dictionary, so always go through the `t(key, fallback)` helper added in Task 8.
- Entity popups open via `appController.functions.setPopUp({ type: "people"|"places", ids: [slug] })` (see `views/Places/Places.js:123`). `useAppController` comes from `src/models/AppController` — copy the exact import path from `views/People/People.js`.
- `BoMOnlineAPI({ personList: true, placeList: true })` (`src/models/BoMOnlineAPI.js`) returns cached `{ personList: {slug: {name, slug, ...}}, ...}` maps; the app preloads them, so this is cheap.
- Dark mode = `html[data-theme="dark"]` overrides, one Sass partial per area in `src/assets/theme/scss/darkmode/`, imported from `darkmode.scss`. rmsc v4 themes via CSS variables (`--rmsc-bg`, `--rmsc-border`, `--rmsc-hover`, `--rmsc-selected`, `--rmsc-gray`).
- Jest: `cd frontend/webapp && CI=true npx react-scripts test --testPathPattern="Analysis/Names" --watchAll=false`. Existing test examples: `src/utils/themeColors.test.js`.
- Manual browser verification: `cd frontend/webapp && BROWSER=none PORT=8200 npm start`, view at `http://localhost:8200/analysis/names`. On a laptop without the backend, an app-shell XHR 400 raises the CRA error overlay — dismiss it (×); it's unrelated (see the audit). A ready-made Playwright driver from the audit session can be recreated from Task 15.
- React state must be updated immutably (this exact view previously shipped a mutate-in-place bug — see git history of `Names.js`).

**Filter state shape used throughout this plan** (plain string arrays, NOT rmsc option objects — conversion happens only at the MultiSelect boundary):

```js
{ prefix: [], stems: [], affix: [], suffix: [], cultures: [], types: [] }
```

---

### Task 1: Branch setup

**Step 1:** Create the working branch (use superpowers:using-git-worktrees if running in a shared checkout):

```bash
cd /Users/kckern/Documents/GitHub/BookofMormonOnline
git checkout dev && git pull
git checkout -b feature/names-view-redesign
```

**Step 2:** Confirm the test runner works at all:

```bash
cd frontend/webapp && CI=true npx react-scripts test --testPathPattern="themeColors" --watchAll=false
```

Expected: PASS (existing suite). If this fails, stop and report — the environment is broken, not your change.

---

### Task 2: `logic.js` — `applyFilters`

**Files:**
- Create: `frontend/webapp/src/views/Analysis/Names/logic.js`
- Create: `frontend/webapp/src/views/Analysis/Names/logic.test.js`

**Step 1: Write the failing tests**

```js
// logic.test.js
import { FIELD_DEFS, emptyFilters, applyFilters } from "./logic";

const fixture = [
  { name: "Moroni", types: ["person", "place"], cultures: ["Nephite"], prefix: null, stems: ["Mor"], affix: "~on~", suffix: "~i", note: null },
  { name: "Ammoron", types: ["person"], cultures: ["Nephite"], prefix: "Am~", stems: ["Mor"], affix: null, suffix: "~on", note: null },
  { name: "Shiz", types: ["person"], cultures: ["Jaredite"], prefix: null, stems: ["Shiz"], affix: null, suffix: null, note: null },
  { name: "Teancum", types: ["person", "place"], cultures: ["Nephite"], prefix: null, stems: ["Tean", "Cum"], affix: null, suffix: null, note: null },
];

describe("applyFilters", () => {
  it("returns everything for empty filters", () => {
    expect(applyFilters(fixture, emptyFilters())).toHaveLength(4);
  });
  it("ORs within a facet", () => {
    const f = { ...emptyFilters(), cultures: ["Jaredite", "Nephite"] };
    expect(applyFilters(fixture, f)).toHaveLength(4);
  });
  it("ANDs across facets", () => {
    const f = { ...emptyFilters(), stems: ["Mor"], prefix: ["Am~"] };
    expect(applyFilters(fixture, f).map((e) => e.name)).toEqual(["Ammoron"]);
  });
  it("matches any stem of a multi-stem name", () => {
    const f = { ...emptyFilters(), stems: ["Cum"] };
    expect(applyFilters(fixture, f).map((e) => e.name)).toEqual(["Teancum"]);
  });
  it("never matches null prefix/affix/suffix against a selection", () => {
    const f = { ...emptyFilters(), suffix: ["~on"] };
    expect(applyFilters(fixture, f).map((e) => e.name)).toEqual(["Ammoron"]);
  });
});
```

**Step 2: Run to verify failure**

```bash
cd frontend/webapp && CI=true npx react-scripts test --testPathPattern="Analysis/Names" --watchAll=false
```

Expected: FAIL — `Cannot find module './logic'`.

**Step 3: Minimal implementation**

```js
// logic.js — pure logic for the Names view. No React imports here, ever.

/** Facet definitions: state key, entry accessor, singular querystring key. */
export const FIELD_DEFS = [
  { key: "prefix", qs: "prefix", get: (e) => (e.prefix ? [e.prefix] : []) },
  { key: "stems", qs: "stem", get: (e) => e.stems },
  { key: "affix", qs: "affix", get: (e) => (e.affix ? [e.affix] : []) },
  { key: "suffix", qs: "suffix", get: (e) => (e.suffix ? [e.suffix] : []) },
  { key: "cultures", qs: "culture", get: (e) => e.cultures },
  { key: "types", qs: "type", get: (e) => e.types },
];

export const emptyFilters = () =>
  FIELD_DEFS.reduce((acc, f) => ({ ...acc, [f.key]: [] }), {});

const matchesField = (entry, field, selected) =>
  !selected.length || field.get(entry).some((v) => selected.includes(v));

export const applyFilters = (names, filters) =>
  names.filter((entry) =>
    FIELD_DEFS.every((field) => matchesField(entry, field, filters[field.key]))
  );
```

**Step 4: Run tests** — expected: 5 passing.

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Names/logic.js frontend/webapp/src/views/Analysis/Names/logic.test.js
git commit -m "feat(names): extract pure filter logic with tests"
```

---

### Task 3: `logic.js` — `facetCounts`

Faceted-search counts: for facet F, count matches against names filtered by **all other facets** (so picking a stem doesn't zero out the other stems' counts).

**Step 1: Failing tests** (append to `logic.test.js`)

```js
import { facetCounts } from "./logic";

describe("facetCounts", () => {
  it("counts values with no filters active", () => {
    const counts = facetCounts(fixture, emptyFilters(), "stems");
    expect(counts.get("Mor")).toBe(2);
    expect(counts.get("Cum")).toBe(1);
  });
  it("ignores the facet's own selection but honors others", () => {
    const f = { ...emptyFilters(), stems: ["Shiz"], cultures: ["Nephite"] };
    const counts = facetCounts(fixture, f, "stems");
    expect(counts.get("Mor")).toBe(2);      // own facet's selection ignored
    expect(counts.get("Shiz")).toBeUndefined(); // culture filter still applies
  });
});
```

**Step 2: Run** — expected: FAIL, `facetCounts` not exported.

**Step 3: Implementation** (append to `logic.js`)

```js
/** Counts for one facet, computed with that facet's own selection ignored. */
export const facetCounts = (names, filters, facetKey) => {
  const others = { ...filters, [facetKey]: [] };
  const pool = applyFilters(names, others);
  const field = FIELD_DEFS.find((f) => f.key === facetKey);
  const counts = new Map();
  for (const entry of pool)
    for (const v of field.get(entry)) counts.set(v, (counts.get(v) || 0) + 1);
  return counts;
};
```

**Step 4: Run tests** — all passing. **Step 5: Commit** `feat(names): facet counts for filter UI`.

---

### Task 4: `logic.js` — `segmentName`

Splits a display name into role-tagged spans by matching its morphemes against the actual string. Segmentation is heuristic; when the morphemes don't reconstruct the name (K/C spellings like Kumen/stem `Cumen`), return `null` and the UI falls back to a plain tile.

**Step 1: Failing tests** (append)

```js
import { segmentName } from "./logic";

describe("segmentName", () => {
  const seg = (over) => segmentName({ prefix: null, stems: [], affix: null, suffix: null, ...over });
  it("splits stem + affix + suffix", () => {
    expect(seg({ name: "Moroni", stems: ["Mor"], affix: "~on~", suffix: "~i" }))
      .toEqual([{ text: "Mor", role: "stem" }, { text: "on", role: "affix" }, { text: "i", role: "suffix" }]);
  });
  it("splits prefix + stem + suffix", () => {
    expect(seg({ name: "Ammoron", prefix: "Am~", stems: ["Mor"], suffix: "~on" }))
      .toEqual([{ text: "Am", role: "prefix" }, { text: "mor", role: "stem" }, { text: "on", role: "suffix" }]);
  });
  it("splits two stems with medial affix", () => {
    expect(seg({ name: "Moriancumer", stems: ["Mor", "Cum"], affix: "~ian~", suffix: "~er" }))
      .toEqual([{ text: "Mor", role: "stem" }, { text: "ian", role: "affix" }, { text: "cum", role: "stem" }, { text: "er", role: "suffix" }]);
  });
  it("tolerates hyphens between parts, preserving original text", () => {
    expect(seg({ name: "Ani-Anti", stems: ["Ani", "Ant"], suffix: "~i" }))
      .toEqual([{ text: "Ani", role: "stem" }, { text: "-", role: "sep" }, { text: "Ant", role: "stem" }, { text: "i", role: "suffix" }]);
  });
  it("returns null when morphemes cannot reconstruct the name", () => {
    expect(seg({ name: "Kumen", stems: ["Cumen"] })).toBeNull();
  });
  it("returns single whole-name stem span", () => {
    expect(seg({ name: "Shiz", stems: ["Shiz"] })).toEqual([{ text: "Shiz", role: "stem" }]);
  });
});
```

**Step 2: Run** — FAIL. **Step 3: Implementation** (append to `logic.js`)

```js
const strip = (s) => (s || "").replace(/~/g, "");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Segment a name into [{text, role}] spans (roles: prefix|stem|affix|sep|suffix)
 * by matching prefix + stem1 + affix + stem2 + suffix against the real string,
 * case-insensitively, allowing a single separator char (- or ') between parts.
 * Returns null when the morphemes don't reconstruct the name.
 */
export const segmentName = (entry) => {
  const parts = [];
  if (entry.prefix) parts.push({ role: "prefix", m: strip(entry.prefix) });
  parts.push({ role: "stem", m: strip(entry.stems[0] || "") });
  if (entry.affix) parts.push({ role: "affix", m: strip(entry.affix) });
  if (entry.stems[1]) parts.push({ role: "stem", m: strip(entry.stems[1]) });
  if (entry.suffix) parts.push({ role: "suffix", m: strip(entry.suffix) });

  const pattern = "^" + parts.map((p) => `([-']?)(${esc(p.m)})`).join("") + "$";
  const match = entry.name.match(new RegExp(pattern, "i"));
  if (!match) return null;

  const spans = [];
  let g = 1;
  for (const p of parts) {
    const sep = match[g++];
    const text = match[g++];
    if (sep) spans.push({ text: sep, role: "sep" });
    spans.push({ text, role: p.role });
  }
  return spans;
};
```

**Step 4: Run tests** — all passing. Also run a coverage probe over the real dataset and record the number in the commit message (this is data QA, not a unit test):

```bash
cd frontend/webapp && node -e "
Promise.all([import('./src/views/Analysis/Names/data.js'), import('./src/views/Analysis/Names/logic.js')]).then(([d, l]) => {
  const misses = d.default.filter(e => !l.segmentName(e)).map(e => e.name);
  console.log('segmentable:', d.default.length - misses.length, '/', d.default.length, 'misses:', misses.join(', '));
})"
```

If more than ~15 names miss, inspect the misses — most should be K/C spelling cases; fix any `data.js` segmentation typos the probe exposes (that's dataset repair, do it in this task).

**Step 5: Commit** `feat(names): morpheme segmentation with reconstruction guard (N/210 segmentable)`.

---

### Task 5: `logic.js` — querystring codec

Format: `?stem=Mor,Cor&culture=Jaredite&prefix=Am~` (singular keys from `FIELD_DEFS.qs`, comma-joined, URL-encoded). Also carries `name=<Name>` for the detail panel (Task 12).

**Step 1: Failing tests** (append)

```js
import { filtersToQuery, queryToFilters } from "./logic";

describe("querystring codec", () => {
  it("round-trips filters", () => {
    const f = { ...emptyFilters(), stems: ["Mor", "Cum"], cultures: ["Jaredite"], prefix: ["Am~"] };
    expect(queryToFilters(filtersToQuery(f))).toEqual(f);
  });
  it("omits empty facets and returns empty string for no filters", () => {
    expect(filtersToQuery(emptyFilters())).toBe("");
  });
  it("ignores unknown params and preserves detail name", () => {
    const { filters, name } = { filters: queryToFilters("?stem=Mor&foo=1"), name: new URLSearchParams("?name=Moroni").get("name") };
    expect(filters.stems).toEqual(["Mor"]);
    expect(name).toBe("Moroni");
  });
  it("encodes tildes safely", () => {
    const f = { ...emptyFilters(), suffix: ["~iah"] };
    expect(queryToFilters(filtersToQuery(f)).suffix).toEqual(["~iah"]);
  });
});
```

**Step 2: Run** — FAIL. **Step 3: Implementation** (append)

```js
export const filtersToQuery = (filters) => {
  const p = new URLSearchParams();
  for (const f of FIELD_DEFS)
    if (filters[f.key].length) p.set(f.qs, filters[f.key].join(","));
  const s = p.toString();
  return s ? "?" + s : "";
};

export const queryToFilters = (search) => {
  const p = new URLSearchParams(search);
  const filters = emptyFilters();
  for (const f of FIELD_DEFS) {
    const raw = p.get(f.qs);
    if (raw) filters[f.key] = raw.split(",").filter(Boolean);
  }
  return filters;
};
```

**Step 4: Run tests** — passing. **Step 5: Commit** `feat(names): filter querystring codec`.

---

### Task 6: `logic.js` — entity slug matcher

Maps a dataset name to a person/place slug from the app's cached lists, so the detail panel can open the existing entity popups. Entity names are stored with disambiguating digits (`Nephi1`) and places sometimes with descriptive prefixes (`Hill Cumorah`).

**Step 1: Failing tests** (append)

```js
import { entitySlugs } from "./logic";

describe("entitySlugs", () => {
  const people = { nephi1: { name: "Nephi1", slug: "nephi1" }, abinadi: { name: "Abinadi", slug: "abinadi" } };
  const places = { "hill-cumorah": { name: "Hill Cumorah", slug: "hill-cumorah" } };
  it("matches a person by base name, digits stripped", () => {
    expect(entitySlugs("Nephi", people, places).person).toBe("nephi1");
  });
  it("matches a place by last word of descriptive name", () => {
    expect(entitySlugs("Cumorah", people, places).place).toBe("hill-cumorah");
  });
  it("returns nulls when nothing matches", () => {
    expect(entitySlugs("Ziff", people, places)).toEqual({ person: null, place: null });
  });
});
```

**Step 2: Run** — FAIL. **Step 3: Implementation** (append)

```js
const baseName = (n) => n.replace(/\d+$/, "").trim().toLowerCase();

/** Find person/place slugs for a name in the app's cached entity maps. */
export const entitySlugs = (name, personMap, placeMap) => {
  const target = name.toLowerCase();
  let person = null, place = null;
  for (const p of Object.values(personMap || {}))
    if (baseName(p.name) === target) { person = p.slug; break; }
  for (const p of Object.values(placeMap || {})) {
    const full = baseName(p.name);
    const last = full.split(" ").pop();
    if (full === target || last === target) { place = p.slug; break; }
  }
  return { person, place };
};
```

**Step 4: Run tests** — passing. **Step 5: Commit** `feat(names): entity slug matcher for detail links`.

---

### Task 7: Refactor `Names.js` onto `logic.js` (no visual change)

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Names/Names.js` (full rewrite below)
- Create: `frontend/webapp/src/views/Analysis/Names/Names.render.test.js`

Filter state becomes plain string arrays; rmsc option objects exist only inside `FacetSelect`.

**Step 1: Failing render test**

```js
// Names.render.test.js
import React from "react";
import { render, screen } from "@testing-library/react";
import Names from "./Names";

jest.mock("src/models/Utils", () => ({ label: (k) => k }));

it("renders the grid and the six facet controls", () => {
  render(<Names />);
  expect(screen.getByText("Moroni")).toBeInTheDocument();
  expect(screen.getByText(/210 names/)).toBeInTheDocument();
});
```

Run — FAIL (current file exports work but `210 names` text assertion pins the refactor; if it passes already, proceed — the test is the safety net for the rewrite).

**Step 2: Rewrite `Names.js`**

```js
import React, { useEffect, useMemo, useState } from "react";
import { MultiSelect } from "react-multi-select-component";
import { label } from "src/models/Utils";

import "./Names.css";
import names, { facets } from "./data.js";
import { FIELD_DEFS, emptyFilters, applyFilters, facetCounts } from "./logic";

const FACET_META = {
  prefix: { label: "Prefix", options: facets.prefixes },
  stems: { label: "Stem", options: facets.stems },
  affix: { label: "Affix", options: facets.affixes },
  suffix: { label: "Suffix", options: facets.suffixes },
  cultures: { label: "Culture", options: facets.cultures },
  types: { label: "Type", options: facets.types },
};

function Container() {
  const [filters, setFilters] = useState(emptyFilters);
  useEffect(() => { document.title = "Names | " + label("home_title"); }, []);

  const filtered = useMemo(() => applyFilters(names, filters), [filters]);
  const hasSelection = FIELD_DEFS.some((f) => filters[f.key].length > 0);
  const setFacet = (key, values) => setFilters((prev) => ({ ...prev, [key]: values }));

  return (
    <div className="container namesView">
      <h3 className="title lg-4 text-center">Book of Mormon Names</h3>
      <FilterBar filters={filters} setFacet={setFacet} />
      <div className="nameFilterStatus">
        <span>{filtered.length === names.length ? `${names.length} names` : `${filtered.length} of ${names.length} names`}</span>
        {hasSelection && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setFilters(emptyFilters())}>
            Clear filters
          </button>
        )}
      </div>
      <div className="nameAnalysisList">
        {filtered.map((entry) => (
          <div key={entry.name} className="nameAnalysisItem" title={[...entry.cultures, ...entry.types].join(" · ")}>
            {entry.name}
          </div>
        ))}
        {!filtered.length && <div className="nameAnalysisEmpty">No names match the selected filters.</div>}
      </div>
    </div>
  );
}

function FilterBar({ filters, setFacet }) {
  return (
    <table className="nameform" style={{ width: "100%" }}>
      <thead>
        <tr>{FIELD_DEFS.map((f) => <th key={f.key}>{FACET_META[f.key].label}</th>)}</tr>
      </thead>
      <tbody>
        <tr>
          {FIELD_DEFS.map((f) => (
            <td key={f.key}>
              <FacetSelect
                facetKey={f.key}
                values={filters[f.key]}
                onChange={(vals) => setFacet(f.key, vals)}
              />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function FacetSelect({ facetKey, values, onChange }) {
  const meta = FACET_META[facetKey];
  const options = meta.options.map((v) => ({ label: v, value: v }));
  return (
    <div className="form-group">
      <MultiSelect
        options={options}
        value={values.map((v) => ({ label: v, value: v }))}
        onChange={(selected) => onChange(selected.map((o) => o.value))}
        labelledBy={meta.label}
      />
    </div>
  );
}

export default Container;
```

Note the `h3` inline nowrap/ellipsis styles are **gone** (audit §2 title truncation) — the CSS task adds a proper responsive rule.

**Step 3: Run all Names tests** — render test + logic tests pass.

**Step 4: Quick visual check** (dev server) — page looks identical to before, filters still work.

**Step 5: Commit** `refactor(names): components over pure logic module, string-array filter state`.

---

### Task 8: `t()` fallback helper + orienting copy + header tooltips

**Files:**
- Modify: `Names.js`

**Step 1:** Add the helper and intro copy. Below the imports in `Names.js`:

```js
/** label() returns the key when untranslated — fall back to English copy. */
const t = (key, fallback) => {
  const v = label(key);
  return !v || v === " " || v === key ? fallback : v;
};

const FACET_HELP = {
  prefix: "A short element attached to the front of a base name: Zeezrom = Ze~ + ezrom.",
  stems: "The core building block a family of names shares: Mormon, Moroni, and Morianton all carry Mor.",
  affix: "A linking element inside a name: Cor + iant + umr.",
  suffix: "A closing element: ~iah, ~ihah, ~om, ~um.",
  cultures: "The people a name belongs to, or the language its proposed origin comes from.",
  types: "What the name refers to: a person, place, measure of money, animal, plant…",
};
```

Replace hardcoded strings: page `<h3>` text → `{t("names_title", "Book of Mormon Names")}`, clear button → `{t("names_clear_filters", "Clear filters")}`, status → `` t("names_count", `${filtered.length} of ${names.length} names`) `` (keep the two-branch count logic, wrap both branches), empty state → `{t("names_empty", "No names match the selected filters. Try removing the last filter you added.")}`.

**Step 2:** Add an intro line under the title:

```jsx
<p className="namesIntro">
  {t("names_intro", "Every proper name in the Book of Mormon, broken into its building blocks. Filter by shared elements to see name families, or by culture to see who used them.")}
</p>
```

**Step 3:** Header tooltips — in `FilterBar`, each `<th>` becomes:

```jsx
<th key={f.key}>
  <span className="facetHeader" title={FACET_HELP[f.key]}>
    {FACET_META[f.key].label}<sup className="facetHelpMark" aria-hidden="true">?</sup>
  </span>
</th>
```

**Step 4:** Run render test (still green), visual check: intro renders, `?` marks show tooltips on hover.

**Step 5: Commit** `feat(names): orienting copy, facet help tooltips, i18n-ready strings`.

---

### Task 9: Counts + ordering in the four morpheme selects; drop Select All

**Files:** Modify `Names.js`.

**Step 1:** In `FacetSelect`, build options from `facetCounts`, sorted by count descending then alphabetically, zero-count options disabled; kill Select All:

```js
function FacetSelect({ facetKey, values, onChange, filters }) {
  const meta = FACET_META[facetKey];
  const counts = useMemo(() => facetCounts(names, filters, facetKey), [filters, facetKey]);
  const options = useMemo(
    () =>
      [...meta.options]
        .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b))
        .map((v) => ({
          label: `${v} (${counts.get(v) || 0})`,
          value: v,
          disabled: !counts.get(v) && !values.includes(v),
        })),
    [counts, meta.options, values]
  );
  return (
    <div className="form-group">
      <MultiSelect
        options={options}
        value={values.map((v) => ({ label: v, value: v }))}
        onChange={(selected) => onChange(selected.map((o) => o.value))}
        labelledBy={meta.label}
        hasSelectAll={false}
      />
    </div>
  );
}
```

Pass `filters` down from `FilterBar` (add prop). Note `value` items match on `.value` — labels with counts don't need to match.

**Step 2:** Visual check: Stem dropdown now opens with `Mor (9)`, `Cor (7)`… at the top; selecting `Jaredite` culture first grays out non-Jaredite stems.

**Step 3:** Run tests (green). **Step 4: Commit** `feat(names): facet counts, frequency ordering, no select-all`.

---

### Task 10: Culture & Type as chip rows

**Files:** Modify `Names.js`, `Names.css`.

**Step 1:** New component in `Names.js`:

```jsx
function ChipRow({ facetKey, filters, setFacet }) {
  const meta = FACET_META[facetKey];
  const counts = useMemo(() => facetCounts(names, filters, facetKey), [filters, facetKey]);
  const values = filters[facetKey];
  const toggle = (v) =>
    setFacet(facetKey, values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div className="nameChipRow" role="group" aria-label={meta.label}>
      <span className="nameChipRowLabel">{meta.label}</span>
      {meta.options.map((v) => {
        const count = counts.get(v) || 0;
        const active = values.includes(v);
        return (
          <button
            key={v}
            type="button"
            className={"nameChip" + (active ? " active" : "")}
            disabled={!count && !active}
            aria-pressed={active}
            onClick={() => toggle(v)}
          >
            {v} <span className="nameChipCount">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
```

**Step 2:** In `Container`, render `FilterBar` with only the four morpheme facets (filter `FIELD_DEFS` to `["prefix","stems","affix","suffix"]` inside `FilterBar`), then:

```jsx
<ChipRow facetKey="cultures" filters={filters} setFacet={setFacet} />
<ChipRow facetKey="types" filters={filters} setFacet={setFacet} />
```

**Step 3:** CSS (append to `Names.css`):

```css
.nameChipRow{ display:flex; flex-wrap:wrap; gap:0.4ex; align-items:center; margin:0.4rem 0; }
.nameChipRowLabel{ font-weight:800; font-size:0.9rem; margin-right:0.5ex; min-width:4.5rem; }
.nameChip{ border:1px solid var(--names-border,#ccc); border-radius:999px; background:transparent; padding:0.1rem 0.7rem; font-size:0.85rem; cursor:pointer; }
.nameChip.active{ background:#2c7fb8; border-color:#2c7fb8; color:#fff; }
.nameChip:disabled{ opacity:0.35; cursor:default; }
.nameChip:focus-visible{ outline:2px solid #2c7fb8; outline-offset:2px; }
.nameChipCount{ opacity:0.65; font-size:0.75rem; }
```

**Step 4:** Visual check: two chip rows under the four selects; toggling `Jaredite` filters instantly and updates all counts. Run tests. **Step 5: Commit** `feat(names): culture and type as toggle chips with counts`.

---### Task 11: URL sync

**Files:** Modify `Names.js`.

**Step 1:** Wire router v5 hooks:

```js
import { useHistory, useLocation } from "react-router-dom";
```

In `Container`:

```js
const history = useHistory();
const location = useLocation();
const [filters, setFilters] = useState(() => queryToFilters(location.search));

useEffect(() => {
  const q = filtersToQuery(filters);
  if (q !== location.search && !(q === "" && location.search === ""))
    history.replace({ pathname: location.pathname, search: q });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [filters]);
```

(`queryToFilters`/`filtersToQuery` imported from `./logic`.)

**Step 2:** Render-test fix: the test renders `<Names/>` outside a router — wrap with `MemoryRouter` in `Names.render.test.js`:

```js
import { MemoryRouter } from "react-router-dom";
render(<MemoryRouter initialEntries={["/analysis/names"]}><Names /></MemoryRouter>);
```

Add a test: initial entry `"/analysis/names?stem=Mor"` → `screen.getByText(/9 of 210 names/)`.

**Step 3:** Run tests — green. Visual check: select stem `Mor` → address bar shows `?stem=Mor`; paste `?stem=Mor&culture=Jaredite` into a fresh tab → pre-filtered view.

**Step 4: Commit** `feat(names): shareable filter state via querystring`.

---

### Task 12: Detail panel + real tile clicks

**Files:** Modify `Names.js`, `Names.css`.

**Step 1:** Data plumbing in `Container`:

```js
import { BoMOnlineAPI } from "src/models/BoMOnlineAPI";   // ⚠ copy exact import style from People.js — default vs named varies
import { useAppController } from "src/models/AppController"; // ⚠ same: copy from People.js
import { entitySlugs, segmentName } from "./logic";

const appController = useAppController();
const [detailName, setDetailName] = useState(() => new URLSearchParams(location.search).get("name"));
const [entities, setEntities] = useState({ people: null, places: null });
useEffect(() => {
  BoMOnlineAPI({ personList: true, placeList: true }).then((r) =>
    setEntities({ people: r.personList || {}, places: r.placeList || {} })
  );
}, []);
const detailEntry = useMemo(() => names.find((n) => n.name === detailName) || null, [detailName]);
```

Keep `name` in the querystring: extend the URL-sync effect to append `&name=` when `detailName` is set (use `URLSearchParams` on the codec output; parse it back on load — already done in the `useState` initializer above).

**Step 2:** Tiles become buttons (keyboard-focusable, real affordance — audit's top issue):

```jsx
<button
  type="button"
  key={entry.name}
  className={"nameAnalysisItem" + (detailName === entry.name ? " selected" : "")}
  onClick={() => setDetailName(entry.name === detailName ? null : entry.name)}
>
  {entry.name}
</button>
```

Remove the `title` tooltip (superseded by the panel).

**Step 3:** `NameDetail` component, rendered between the status row and the grid when `detailEntry` is set:

```jsx
function NameDetail({ entry, entities, appController, onClose, onPickMorpheme }) {
  const spans = segmentName(entry);
  const slugs = entitySlugs(entry.name, entities.people, entities.places);
  const openEntity = (type, slug) =>
    appController.functions.setPopUp({ type, ids: [slug], underSlug: type });
  const CULTURE_BADGE = { Nephite: "N", Lamanite: "L", Jaredite: "J", Mulekite: "M", Israelite: "I" };
  return (
    <div className="nameDetail" role="region" aria-label={entry.name}>
      <div className="nameDetailHeader">
        <span className="nameDetailName">
          {spans
            ? spans.map((s, i) => (
                <button key={i} type="button" disabled={s.role === "sep"}
                  className={"morpheme morpheme-" + s.role}
                  onClick={() => onPickMorpheme(s.role, entry)}>{s.text}</button>
              ))
            : entry.name}
        </span>
        <button type="button" className="btn-close nameDetailClose" aria-label="Close" onClick={onClose}>×</button>
      </div>
      <div className="nameDetailBadges">
        {entry.cultures.map((c) => (
          <span key={c} className={"IdBadge " + (CULTURE_BADGE[c] || "lang")}>{c}</span>
        ))}
        {entry.types.map((tp) => <span key={tp} className="nameTypeBadge">{tp}</span>)}
      </div>
      {entry.note && <p className="nameDetailNote">{entry.note}</p>}
      <div className="nameDetailLinks">
        {slugs.person && entry.types.includes("person") && (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openEntity("people", slugs.person)}>View person</button>
        )}
        {slugs.place && entry.types.includes("place") && (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openEntity("places", slugs.place)}>View place</button>
        )}
      </div>
    </div>
  );
}
```

`onPickMorpheme(role, entry)` maps role→facet and adds the entry's own value: `prefix→prefix: entry.prefix`, `stem→stems: (clicked span's matching stem)`, `affix→affix`, `suffix→suffix` — implement as:

```js
const pickMorpheme = (role, entry) => {
  const map = { prefix: ["prefix", entry.prefix], affix: ["affix", entry.affix], suffix: ["suffix", entry.suffix] };
  if (role === "stem") setFacet("stems", [...new Set([...filters.stems, ...entry.stems])]);
  else if (map[role] && map[role][1]) setFacet(map[role][0], [...new Set([...filters[map[role][0]], map[role][1]])]);
};
```

**Step 4:** CSS (append):

```css
.nameDetail{ border:1px solid var(--names-border,#ccc); border-radius:8px; padding:0.75rem 1rem; margin-bottom:1rem; }
.nameDetailHeader{ display:flex; justify-content:space-between; align-items:baseline; }
.nameDetailName{ font-size:1.6rem; font-weight:700; }
.nameDetailName .morpheme{ background:none; border:none; padding:0; font:inherit; cursor:pointer; }
.nameDetailClose{ background:none; border:none; font-size:1.4rem; cursor:pointer; line-height:1; }
.nameDetailBadges{ display:flex; gap:0.4ex; flex-wrap:wrap; margin:0.3rem 0; }
.nameTypeBadge,{ } /* replaced below in same commit */
.nameTypeBadge, .IdBadge.lang{ border:1px solid var(--names-border,#ccc); border-radius:4px; padding:0 0.4em; font-size:0.75rem; }
.nameDetailNote{ margin:0.3rem 0 0.5rem; color:var(--names-muted,#555); font-style:italic; }
.nameAnalysisItem.selected{ border-color:#2c7fb8; box-shadow:0 0 0 1px #2c7fb8 inset; }
.nameAnalysisItem:focus-visible{ outline:2px solid #2c7fb8; outline-offset:1px; }
```

The five affiliation `IdBadge` colors are scoped `.peopleList .IdBadge.N` etc. in `People.css` — copy those five color rules into `Names.css` scoped as `.nameDetail .IdBadge.N` (etc.) rather than importing People.css.

**Step 5:** Visual check: click Moroni → panel shows `Mor·on·i` spans, Nephite badge, person/place buttons; clicking `Mor` span adds the stem filter; person button opens the existing People popup; Esc… (add `onKeyDown` Escape on the panel → `onClose`). Tab reaches tiles and shows a focus ring. Run tests.

**Step 6: Commit** `feat(names): clickable tiles with detail panel, entity popup links, morpheme drill-in`.

---

### Task 13: Signature — morpheme structure on the wall

**Files:** Modify `Names.js`, `Names.css`.

**Step 1:** Add a "Show structure" toggle + legend to the status row:

```jsx
const [showStructure, setShowStructure] = useState(true);
```

```jsx
<label className="structureToggle">
  <input type="checkbox" checked={showStructure} onChange={(e) => setShowStructure(e.target.checked)} />
  {t("names_show_structure", "Show structure")}
</label>
{showStructure && (
  <span className="morphemeLegend" aria-hidden="true">
    <span className="morpheme-prefix">prefix</span><span className="morpheme-stem">stem</span>
    <span className="morpheme-affix">affix</span><span className="morpheme-suffix">suffix</span>
  </span>
)}
```

**Step 2:** Tile rendering — when `showStructure` and `segmentName(entry)` returns spans, render each span with a role class; memoize segmentation once at module load:

```js
const SEGMENTS = new Map(names.map((n) => [n.name, segmentName(n)]));
```

```jsx
{showStructure && SEGMENTS.get(entry.name)
  ? SEGMENTS.get(entry.name).map((s, i) => <span key={i} className={"morpheme-" + s.role}>{s.text}</span>)
  : entry.name}
```

**Step 3:** CSS — subdued colored underlines on tiles, stronger tints in the detail panel. One hue per role, consistent everywhere:

```css
/* role hues: prefix purple, stem blue, affix orange, suffix green */
.nameAnalysisItem .morpheme-prefix{ box-shadow: inset 0 -2px 0 #8e6cc3; }
.nameAnalysisItem .morpheme-stem{ box-shadow: inset 0 -2px 0 #2c7fb8; }
.nameAnalysisItem .morpheme-affix{ box-shadow: inset 0 -2px 0 #d95f0e; }
.nameAnalysisItem .morpheme-suffix{ box-shadow: inset 0 -2px 0 #38875f; }
.nameDetail .morpheme-prefix{ background:rgba(142,108,195,.18); }
.nameDetail .morpheme-stem{ background:rgba(44,127,184,.18); }
.nameDetail .morpheme-affix{ background:rgba(217,95,14,.18); }
.nameDetail .morpheme-suffix{ background:rgba(56,135,95,.18); }
.morphemeLegend{ display:inline-flex; gap:0.8ex; font-size:0.75rem; }
.morphemeLegend span{ padding:0 0.3em; }
.morphemeLegend .morpheme-prefix{ box-shadow: inset 0 -2px 0 #8e6cc3; }
.morphemeLegend .morpheme-stem{ box-shadow: inset 0 -2px 0 #2c7fb8; }
.morphemeLegend .morpheme-affix{ box-shadow: inset 0 -2px 0 #d95f0e; }
.morphemeLegend .morpheme-suffix{ box-shadow: inset 0 -2px 0 #38875f; }
.structureToggle{ display:inline-flex; gap:0.5ex; align-items:center; font-size:0.85rem; cursor:pointer; margin:0; }
```

**Step 4:** Visual check at 1440px: the wall now *shows* the naming system — `Mor|on|i`, `Am|mor|on` — with names that share elements visibly rhyming. Toggle off → plain tiles. Check restraint: underlines should read as subtle texture, not carnival; if it shouts, drop opacity of the underline colors by ~30% and re-look.

**Step 5:** Run tests, commit `feat(names): morpheme structure rendering on tiles with legend and toggle`.

---

### Task 14: Responsive/mobile + light-theme CSS cleanup

**Files:** Modify `Names.js`, `Names.css`.

**Step 1:** Remove the remaining inline styles from `Names.js` (`FilterBar`'s `style={{width:"100%"}}` → CSS `.nameform{width:100%}`; tile inline border already gone via Task 12 button conversion — confirm none remain by grepping `style={{` in the file; the h3's are gone since Task 7).

**Step 2:** Wrap the whole filter block (selects + chip rows) in a disclosure that's always open on desktop, collapsible on mobile:

```jsx
<details className="nameFilters" open>
  <summary className="nameFiltersSummary">
    {t("names_filters", "Filters")}{activeCount ? ` (${activeCount})` : ""}
  </summary>
  <FilterBar ... />
  <ChipRow ... />
  <ChipRow ... />
</details>
```

`activeCount = FIELD_DEFS.reduce((n, f) => n + filters[f.key].length, 0)`.

**Step 3:** CSS:

```css
.nameform{ width:100%; }
.nameFiltersSummary{ display:none; font-weight:800; cursor:pointer; padding:0.4rem 0; }
@media (max-width: 767px){
  .nameFiltersSummary{ display:list-item; }
  .nameform, .nameform thead, .nameform tbody, .nameform tr, .nameform th, .nameform td{ display:block; text-align:left; }
  .nameform th{ font-size:0.9rem; margin-top:0.4rem; }
  .namesView h3.title{ white-space:normal; font-size:1.7rem; }
}
```

Note: `<details open>` stays open on desktop because the `open` attribute is set; on mobile the summary is visible so users can collapse. (Optional refinement — default-collapsed on mobile — needs a `useEffect` with a matchMedia check; do it only if trivial: `useState(() => window.matchMedia("(min-width: 768px)").matches)` driving `open`.)

**Step 4:** Visual check at 375px: title wraps instead of truncating, all six facets reachable, chips wrap, grid readable. At 1440px: unchanged.

**Step 5:** Run tests, commit `fix(names): responsive filters, mobile title, inline styles removed`.

---

### Task 15: Dark mode partial

**Files:**
- Create: `frontend/webapp/src/assets/theme/scss/darkmode/_names.scss`
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode.scss` (one `@import` line)
- Modify: `Names.css` (introduce the two CSS variables used above)

**Step 1:** In `Names.css`, define light-theme variables at the top and use them for every hardcoded gray still present (tile borders, hover, status text, empty state):

```css
.namesView{ --names-border:#ccc; --names-muted:#666; --names-hover:#f1f1f1; }
.nameAnalysisList .nameAnalysisItem{ border:1px solid var(--names-border); background:transparent; }
.nameAnalysisList .nameAnalysisItem:hover{ background-color:var(--names-hover); }
.nameFilterStatus{ color:var(--names-muted); }
.nameAnalysisEmpty{ color:var(--names-muted); }
```

(Remove the old `#f9f9f9` hover rule and `#ddd`/`#888` values — this kills the audit's two dark-mode bugs at the root.)

**Step 2:** `_names.scss`:

```scss
html[data-theme="dark"] {
  .namesView {
    --names-border: #3a3a3a;
    --names-muted: #a5a5a5;   // ≥ 4.5:1 on #1a1a1a
    --names-hover: #2a2a2a;

    // react-multi-select-component theming
    .rmsc {
      --rmsc-bg: #222;
      --rmsc-border: #3a3a3a;
      --rmsc-hover: #2f2f2f;
      --rmsc-selected: #333;
      --rmsc-gray: #a5a5a5;
      --rmsc-main: #2c7fb8;
      color: #eee;
    }
    .nameChip{ color:#eee; }
    .nameChip.active{ background:#2c7fb8; color:#fff; }
    .nameDetail{ background:#222; }
  }
}
```

**Step 3:** Add `@import "./darkmode/names";` to `darkmode.scss` beside the other imports.

**Step 4:** Visual check in dark mode (set `document.documentElement.setAttribute('data-theme','dark')` in devtools, or use the app's theme toggle): hover keeps text readable, status line legible, dropdowns and chips dark, morpheme underline hues still read (they were chosen to survive both themes).

**Step 5:** Run tests, commit `feat(names): dark mode coverage via _names.scss partial and theme variables`.

---

### Task 16: End-to-end verification sweep + docs

**Step 1:** REQUIRED: use the `verify` skill. Drive `http://localhost:8200/analysis/names` (dev server) in headless Chromium — a driver script pattern from the audit session works; assert at minimum:

1. Initial: 210 tiles, morpheme underlines visible, legend present.
2. `?stem=Mor&culture=Jaredite` deep link → 3 names.
3. Click a tile → detail panel; click its stem span → filter added, URL updates.
4. "View person" opens the People popup.
5. Culture chip toggle → counts update everywhere.
6. Dark mode: hover a tile → text still readable (computed color vs background).
7. 375px: title wraps, Filters disclosure collapses/expands, all facets reachable.
8. Keyboard: Tab reaches chips and tiles with visible focus rings.

**Step 2:** Update `docs/reference/bom-names-dataset.md` "Next steps" section — items 1 and 2 are now done; note the view's logic lives in `logic.js`.

**Step 3:** Append a one-paragraph addendum to `docs/audits/2026-07-16-names-view-design-audit.md`: date, "all eight recommendations implemented", link to this plan.

**Step 4:** Full test suite for the view + final commit:

```bash
cd frontend/webapp && CI=true npx react-scripts test --testPathPattern="Analysis/Names" --watchAll=false
git add -A && git commit -m "docs(names): close out design-audit recommendations"
```

---

## Out of scope (deliberate — YAGNI)

- Backend dictionary entries for the new `names_*` label keys (the `t()` fallbacks ship English; translation is a content task).
- Object-entity links from the detail panel (objects table popups exist, but slug matching for multi-word object names is fuzzy; person/place covers the audit's flow gap).
- Grouping/sections in the grid (audit floated "group by stem family" — the count-sorted dropdowns + structure rendering deliver the same discovery value with far less layout work; revisit only if users ask).
- Scripture-occurrence lists in the detail panel (needs a backend search query per name; separate feature).
