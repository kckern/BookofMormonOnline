# Witnesses View UX Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the nine defects and four layout/interaction weaknesses found in `docs/audits/2026-07-18-witnesses-view-ux-audit.md`, so the Witnesses detail page displays the field it sorts on, accounts for every source it summarizes, uses its full width, and is reachable by keyboard.

**Architecture:** Almost all the page's bugs come from one root cause — the UI reads the `date` column, which is corrupt. All date logic moves out of the two components into a new pure module `frontend/webapp/src/views/History/witnessSources.js`, unit-tested in isolation, and both `Witnesses.js` and `WitnessLifeHeatmap.js` become consumers of it. Layout work follows as CSS + JSX changes verified in the browser.

**Tech Stack:** React 17 (function components + hooks), CRA/Jest + React Testing Library (`npx react-scripts test`), plain CSS with `--hm-*` custom properties for light/dark theming, `react-masonry-css` (being removed).

---

## Critical context: the data, verified

Read this before Task 1. It supersedes §2 of the audit, which was written before the `event_*` columns were profiled.

Profiling `bom_xtras_history WHERE archive='witnesses'` (444 rows, read-only via the private workspace repo's `cli/db.mjs`):

| column | coverage | verdict |
|---|---|---|
| `year` | 444/444 non-null | **Composition year. Trustworthy. This is the sort key.** |
| `event_year` | 444/444 non-null | Year of the event being recounted. Trustworthy. |
| `event_date` | 428/444 non-empty | Full/month date of that event. Trustworthy. |
| `date` | 36 empty, 102 year-only | **Corrupt. Do not use.** Holds publication/reprint dates (`2003`, `2014`, `1991`, `1902`) and typos (`8795`, `4806`) on the rows where it diverges. |
| `source` | **blank on 444/444** | Dead column. Stop rendering it. |
| `author` | 439/444 non-empty | Use this where `source` was used. |
| `reporter_label` | from the JSON `meta` blob (`backend/src/data/loaders/searchhist.ts:482`) | Nullable; render only when present. |

The two ways `year` and `date` diverge (76 rows):

- **Case A — `date` holds the recounted event.** Moyle: `year=1940`, `date=1885-06-28`, `event_year=1885`, `event_date=1885-06-28`. Composition 1940, recalling an 1885 meeting.
- **Case B — `date` holds a publication date.** `year=1918`, `date=2003`, `event_year=1918`, `event_date=1918-04-25`. Composition 1918; the `2003` is a modern reprint.

In **both** cases `event_date` is correct and `date` is not.

### The rule this plan implements

```
composition year  = year                         (always present)
composition month = month(event_date)  IF year(event_date) === year AND event_date has a month
                    otherwise null (year-only precision)
recalled event    = {event_year, event_date}     IF event_year !== year, else null
                    (suppressed when event_year > year — recounting the future is impossible)
```

**Amended during Task 1** (was `event_year === year`). On 20 rows `event_date` holds the *composition*
date while `event_year` points at the older occasion being recounted — e.g. `Oliver Cowdery to
W. W. Phelps, Letter I (1834-09-07)` has `year=1834`, `event_date=1834-09-07`, `event_year=1829`:
the letter was written in Sep 1834 about the 1829 translation. Gating on `event_year` discarded a
good month on all 20. Gating on `event_date`'s own year asks the actual question — "does this date
describe the composition year?" — and recovers them, cutting year-only precision across the archive
from 94 rows (21%) to 74 (16.7%). The Moyle case is unaffected: `year=1940`, `event_date=1885-06-28`,
so 1885 ≠ 1940 and it stays year-precision with a "recalling Jun 1885" line, as intended.

Case A yields composition 1940 year-only + a "recalling Jun 1885" line. Case B yields composition April 1918, full month precision, and the `2003` reprint date is simply never read.

**Measured effect for David Whitmer (152 sources):**

| | today (`date`) | predicted | **measured after Task 4** |
|---|---|---|---|
| month-precise (placeable on the grid) | 109 | 128+ | **125** |
| year-only | 40 (unaccounted for in the meta strip) | 18 | **27** (accounted for) |
| recalls an earlier event | — | 6 | **6** |
| junk/undated | 4 | 0 | **0** |
| axis end year | 2023 | 1945 | **1945** |
| posthumous (year > 1888) | — | 16 | **16** |

125 + 27 + 0 = 152. Every source is accounted for, the "4 undated" line disappears because
nothing is undated, and the axis loses 78 years of phantom publication history. Audit findings
**D1, D3, D5** and most of **W6** all fall out of this one change.

**Prediction corrected during Task 4.** The original 128/18 pair was never self-consistent —
128 + 18 = 146, not 152, and the two figures came from two different rules: 128 is the count
under the *pre-amendment* `event_year === year` gate, and 18 is the count with *no* gate at all
(any `event_date` carrying a month). The shipped module uses the amended
`event_date.year === year` gate and measures 125/27, verified by rendering the real 152 rows
through `WitnessLifeHeatmap` and reading the strip out of the DOM.

The 3-row gap between 128 and 125 is the amendment working as designed:

| year | event_year | event_date | slug |
|---|---|---|---|
| 1886 | 1886 | 1933-02-15 | `1933-02-15-d-c-dunbar-david-whitmer` |
| 1830 | 1830 | 2023-02-13 | `2023-02-13-three-witnesses` |
| 1839 | 1839 | 2023-02-13 | `2023-02-13-john-corrill-three-witnesses` |

The old gate passes all three (`event_year === year`) and would place an 1830 document in
February **2023**. Declining them is the point. No rows are gained on Whitmer's slice — the
Cowdery-shaped recoveries the amendment also makes land on other principals.

### Design decisions already made (do not relitigate)

1. **Composition year is primary.** Cards display the composition year as the date; the recounted event appears as a secondary "↳ recalling Jun 1885" line only when it differs. Chosen by the user.
2. **Full scope.** Defects + layout reclaim + masonry replacement + heatmap death split + a11y + index cleanup.
3. **`date` is never read again** anywhere in the Witnesses views after Task 3. Leave the field in the GraphQL query (other views use it); just stop consuming it here.
4. **`event_date` is never read directly either — always go through `witnessSources`.** Established in Task 1: the `date` corruption has bled into `event_date` on ~17 rows, which carry data-entry timestamps (`2022-11-02`, `2023-02-13`) on 19th-century documents. `compositionDate` neutralizes them by declining any `event_date` whose year disagrees with `year`, so they degrade to year precision instead of landing a cell in a fabricated month. Any later task that reaches for `event_date` on its own re-opens that hole.

---

## Task 1: Create the `witnessSources` module — composition dates

**Files:**
- Create: `frontend/webapp/src/views/History/witnessSources.js`
- Test: `frontend/webapp/src/views/History/__tests__/witnessSources.test.js`

**Step 1: Write the failing test**

Create `frontend/webapp/src/views/History/__tests__/witnessSources.test.js`:

```js
import { compositionDate, recalledEvent } from "../witnessSources";

// Fixtures mirror real bom_xtras_history rows (see plan's data table).
const caseB = { year: 1918, date: "2003", event_year: 1918, event_date: "1918-04-25" };
const caseA = { year: 1940, date: "1885-06-28", event_year: 1885, event_date: "1885-06-28" };
const yearOnly = { year: 1888, date: "2003", event_year: 1888, event_date: "1888-10" };
const noEventDate = { year: 1875, date: "1875-07-10", event_year: 1875, event_date: null };
const junkDate = { year: 1907, date: "8795", event_year: 1907, event_date: "1907-05-10" };

describe("compositionDate", () => {
  it("takes the month from event_date when event_year matches year", () => {
    expect(compositionDate(caseB)).toEqual({ year: 1918, month: 4, precision: "month" });
  });
  it("accepts month-only event_date", () => {
    expect(compositionDate(yearOnly)).toEqual({ year: 1888, month: 10, precision: "month" });
  });
  it("falls back to year precision when the event is an earlier one", () => {
    expect(compositionDate(caseA)).toEqual({ year: 1940, month: null, precision: "year" });
  });
  it("falls back to year precision when event_date is missing", () => {
    expect(compositionDate(noEventDate)).toEqual({ year: 1875, month: null, precision: "year" });
  });
  it("never reads the corrupt date column", () => {
    expect(compositionDate(junkDate)).toEqual({ year: 1907, month: 5, precision: "month" });
  });
  it("returns null when year is missing", () => {
    expect(compositionDate({ year: 0, event_date: "1850-01" })).toBeNull();
    expect(compositionDate({})).toBeNull();
  });
});

describe("recalledEvent", () => {
  it("returns the earlier event when event_year differs from year", () => {
    expect(recalledEvent(caseA)).toEqual({ year: 1885, month: 6, precision: "month" });
  });
  it("returns null when the event is the composition occasion", () => {
    expect(recalledEvent(caseB)).toBeNull();
    expect(recalledEvent(yearOnly)).toBeNull();
  });
  it("returns year precision when event_date is missing but event_year differs", () => {
    expect(recalledEvent({ year: 1901, event_year: 1850, event_date: null }))
      .toEqual({ year: 1850, month: null, precision: "year" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/witnessSources.test.js`
Expected: FAIL — `Cannot find module '../witnessSources'`

**Step 3: Write minimal implementation**

Create `frontend/webapp/src/views/History/witnessSources.js`:

```js
/**
 * Date logic for the Witnesses archive.
 *
 * The `date` column in bom_xtras_history is corrupt — it holds publication
 * dates and typos on ~17% of rows. `year` (composition) and `event_year` /
 * `event_date` (the occasion being recounted) are complete and trustworthy.
 * Nothing in this module reads `date`.
 */

const parseYm = (value) => {
    if (!value) return null;
    const m = String(value).match(/^(\d{4})(?:-(\d{2}))?/);
    if (!m) return null;
    const month = m[2] ? parseInt(m[2], 10) : null;
    return {
        year: parseInt(m[1], 10),
        month: month >= 1 && month <= 12 ? month : null,
    };
};

/** When the account was composed. Month precision only when event_date describes that same year. */
export const compositionDate = (src) => {
    const year = parseInt(src?.year, 10);
    if (!year) return null;
    const event = parseYm(src.event_date);
    const describesCompositionYear = event && event.year === year;
    return describesCompositionYear && event.month
        ? { year, month: event.month, precision: 'month' }
        : { year, month: null, precision: 'year' };
};

/** The earlier occasion an account recounts, when that is not the composition occasion. */
export const recalledEvent = (src) => {
    const year = parseInt(src?.year, 10);
    const eventYear = parseInt(src?.event_year, 10);
    if (!eventYear || eventYear === year) return null;
    if (year && eventYear > year) return null;   // recounting the future is impossible
    const event = parseYm(src.event_date);
    return event && event.year === eventYear
        ? { year: eventYear, month: event.month, precision: event.month ? 'month' : 'year' }
        : { year: eventYear, month: null, precision: 'year' };
};
```

> **Amended during implementation** — this block reflects the shipped module. The gate is
> `event.year === year` (does this date describe the composition year?), not
> `event_year === year`. See the amendment note in "The rule this plan implements" above for why,
> and add the four extra tests listed there. Measured against all 444 rows the amendment recovers
> 20 correct months and removes 18 fabricated ones, where `event_date` carried a data-entry
> timestamp (`2022-11-02` on an 1830 document) that the old gate would have placed as a real month.

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/witnessSources.test.js`
Expected: PASS, 9 tests

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/witnessSources.js frontend/webapp/src/views/History/__tests__/witnessSources.test.js
git commit -m "feat(witnesses): add composition-date module reading event_date not date"
```

---

## Task 2: Sort comparator and source accounting

**Files:**
- Modify: `frontend/webapp/src/views/History/witnessSources.js`
- Test: `frontend/webapp/src/views/History/__tests__/witnessSources.test.js`

**Step 1: Write the failing test**

Append to the test file:

```js
import { byCompositionDesc, accountSources, ymKey, matchesYearMonth } from "../witnessSources";

describe("byCompositionDesc", () => {
  const list = [
    { slug: "a", year: 1930, event_year: 1930, event_date: "1930-04-08", seq: 1 },
    { slug: "b", year: 1945, event_year: 1945, event_date: "1945-09", seq: 2 },
    { slug: "c", year: 1940, event_year: 1885, event_date: "1885-06-28", seq: 3 },
    { slug: "d", year: 1938, event_year: 1938, event_date: "1938-09-13", seq: 4 },
  ];
  it("sorts newest composition first", () => {
    expect([...list].sort(byCompositionDesc).map(s => s.slug)).toEqual(["b", "c", "d", "a"]);
  });
  it("orders within a year by month descending", () => {
    const sameYear = [
      { slug: "jan", year: 1885, event_year: 1885, event_date: "1885-01", seq: 1 },
      { slug: "dec", year: 1885, event_year: 1885, event_date: "1885-12", seq: 2 },
    ];
    expect([...sameYear].sort(byCompositionDesc).map(s => s.slug)).toEqual(["dec", "jan"]);
  });
  it("puts year-only sources after month-dated ones in the same year", () => {
    const mixed = [
      { slug: "vague", year: 1885, event_year: 1870, event_date: "1870-01", seq: 9 },
      { slug: "precise", year: 1885, event_year: 1885, event_date: "1885-03", seq: 1 },
    ];
    expect([...mixed].sort(byCompositionDesc).map(s => s.slug)).toEqual(["precise", "vague"]);
  });
});

describe("accountSources", () => {
  const list = [
    { year: 1885, event_year: 1885, event_date: "1885-06" },   // month-precise
    { year: 1886, event_year: 1886, event_date: null },        // year-only
    { year: 1940, event_year: 1885, event_date: "1885-06-28" },// year-only AND recalls earlier
    { year: 1834, event_year: 1829, event_date: "1834-09-07" },// month-precise AND recalls earlier
    { year: 0 },                                               // unusable
  ];

  it("puts every source in exactly one placement bucket", () => {
    const a = accountSources(list);
    expect(a.monthPrecise).toBe(2);
    expect(a.yearOnly).toBe(2);
    expect(a.unusable).toBe(1);
    expect(a.monthPrecise + a.yearOnly + a.unusable).toBe(a.total);
  });

  it("counts recalled events as an overlapping annotation, not a placement", () => {
    const a = accountSources(list);
    expect(a.recallsEarlier).toBe(2);
    // Overlap stated directly: the four buckets sum past `total` precisely because
    // recallsEarlier double-counts sources already placed elsewhere.
    expect(a.monthPrecise + a.yearOnly + a.unusable + a.recallsEarlier)
      .toBeGreaterThan(a.total);
  });

  it("counts a month-precise source that recalls an earlier event in BOTH buckets", () => {
    // The Cowdery shape on its own — written Sep 1834, recounting 1829. It draws a
    // grid cell in Sep 1834 AND carries a "recalling 1829" line.
    const a = accountSources([{ year: 1834, event_year: 1829, event_date: "1834-09-07" }]);
    expect(a).toEqual({
      total: 1, monthPrecise: 1, yearOnly: 0, unusable: 0, recallsEarlier: 1,
    });
  });
});

describe("matchesYearMonth", () => {
  const monthSrc = { year: 1885, event_year: 1885, event_date: "1885-06-28" };
  const yearSrc  = { year: 1885, event_year: 1885, event_date: null };
  it("matches a month-precise source to its own month", () => {
    expect(matchesYearMonth(monthSrc, "1885-06")).toBe(true);
    expect(matchesYearMonth(monthSrc, "1885-07")).toBe(false);
  });
  it("includes year-only sources for any month of their year", () => {
    expect(matchesYearMonth(yearSrc, "1885-03")).toBe(true);
    expect(matchesYearMonth(yearSrc, "1886-03")).toBe(false);
  });
  it("returns everything when no month is selected", () => {
    expect(matchesYearMonth(yearSrc, null)).toBe(true);
  });
});
```

**Amended after Task 2 review — a month key is month-strict; a bare year key selects the whole year.**

The first draft had year-only sources match every month of their year. Code review proved that
lies to the user: only month-precise sources draw heatmap cells, so a cell reading "1 source"
would open 8 cards (measured on the Lucy Mack Smith 1845 cluster, which has 7 year-only sources).
That is a worse defect than the D3 gap it was meant to close.

The audit offered two remedies for D3 — *include year-dated sources in month filters*, **or**
*give year-only sources their own affordance*. Take the second. So:

- `matchesYearMonth(src, "1845-06")` → month-precise June 1845 only. **The cell count and the
  card count are always equal.** No cell ever misrepresents what it opens.
- `matchesYearMonth(src, "1845")` → everything composed in 1845, both precisions. This is the
  primitive Task 13's chip uses for "7 more are dated 1845 without a month — show them", which
  is how year-only sources stay reachable.

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/witnessSources.test.js`
Expected: FAIL — `byCompositionDesc is not a function`

**Step 3: Write minimal implementation**

Append to `witnessSources.js`:

```js
export const ymKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

/** Newest composition first; month-dated before year-only within a year; `seq` breaks ties. */
export const byCompositionDesc = (a, b) => {
    const ca = compositionDate(a);
    const cb = compositionDate(b);
    if (!ca || !cb) return (cb ? 1 : 0) - (ca ? 1 : 0);
    if (cb.year !== ca.year) return cb.year - ca.year;
    if ((cb.month || 0) !== (ca.month || 0)) return (cb.month || 0) - (ca.month || 0);
    return (a.seq || 0) - (b.seq || 0);
};

/**
 * Placement accounting for the heatmap meta strip.
 *
 * `monthPrecise` / `yearOnly` / `unusable` are exclusive and sum to `total` — that invariant
 * is the whole point, since the strip's job is to explain where every source went.
 * `recallsEarlier` OVERLAPS them: a source can draw a grid cell in its composition month
 * and still recount an older occasion (the Cowdery letter — written Sep 1834 about 1829).
 * It is an annotation, not a placement, so it is never part of the sum.
 */
export const accountSources = (sources) => {
    const acc = { total: 0, monthPrecise: 0, yearOnly: 0, unusable: 0, recallsEarlier: 0 };
    for (const src of sources || []) {
        acc.total += 1;
        const comp = compositionDate(src);
        if (!comp) acc.unusable += 1;
        else if (comp.precision === 'month') acc.monthPrecise += 1;
        else acc.yearOnly += 1;
        if (recalledEvent(src)) acc.recallsEarlier += 1;
    }
    return acc;
};

/**
 * Does a source belong to the selected slice?
 *
 * `"YYYY-MM"` is MONTH-STRICT: only month-precise sources match. This keeps every heatmap
 * cell honest — the count on the cell is the count of cards clicking it opens. Year-only
 * sources deliberately do NOT match a month they were never dated to.
 * `"YYYY"` selects the whole year, both precisions — the primitive behind Task 13's
 * "N more are dated YYYY without a month" disclosure, which is how year-only sources
 * stay reachable now that months exclude them.
 */
export const matchesYearMonth = (source, yearMonth) => {
    if (!yearMonth) return true;
    const comp = compositionDate(source);
    if (!comp) return false;
    const [year, month] = String(yearMonth).split('-').map(n => parseInt(n, 10));
    if (!year || comp.year !== year) return false;
    if (!month) return true;              // bare "YYYY" — the whole year
    return comp.month === month;          // month-strict
};
```

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/witnessSources.test.js`
Expected: PASS, ~17 tests

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/
git commit -m "feat(witnesses): composition sort, full source accounting, year-aware month filter"
```

---

## Task 3: Wire the card list to composition dates (fixes D1)

**Files:**
- Modify: `frontend/webapp/src/views/History/Witnesses.js:9` (import), `:130` (sort), `:161-165` (filter), `:151-159` (`displayDate`)
- Test: `frontend/webapp/src/views/History/__tests__/Witnesses.render.test.js` (create)

**Step 1: Write the failing test**

Create `frontend/webapp/src/views/History/__tests__/Witnesses.render.test.js`. Follow the mocking style of `src/views/Analysis/Names/Names.render.test.js`:

```js
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const FIXTURE = [
  { slug: "s1", year: 1945, event_year: 1945, event_date: "1945-09", document: "Moyle lengthy account", author: "James H. Moyle", citation: "The Instructor 80" },
  { slug: "s2", year: 1940, event_year: 1885, event_date: "1885-06-28", document: "Moyle ca. 1940 memoir", author: "James H. Moyle", citation: "Mormon Democrat" },
  { slug: "s3", year: 1938, event_year: 1938, event_date: "1938-09-13", document: "Moyle interview", author: "James H. Moyle", citation: "Liahona 36" },
];

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({ history: FIXTURE })),
  assetUrl: "https://assets.test",
}));
jest.mock("src/contexts/AppControllerContext", () => ({
  useAppController: () => ({ functions: { setPopUp: jest.fn() } }),
}));
jest.mock("../../../models/Utils", () => ({ label: (k) => k }));

import Witnesses from "../Witnesses";

const renderAt = (path) =>
  render(<MemoryRouter initialEntries={[path]}><Witnesses /></MemoryRouter>);

// react-router v5: useParams needs a Route. If the app's router version makes
// this awkward, render <SingleWitness> directly by exporting it from Witnesses.js.

describe("witness source cards", () => {
  it("renders cards in composition order, newest first", async () => {
    renderAt("/history/witnesses/david-whitmer");
    const titles = await screen.findAllByRole("heading", { level: 3 });
    expect(titles.map(h => h.textContent)).toEqual([
      "Moyle lengthy account", "Moyle ca. 1940 memoir", "Moyle interview",
    ]);
  });

  it("shows the composition year as the card date", async () => {
    renderAt("/history/witnesses/david-whitmer");
    expect(await screen.findByText("Sep 1945")).toBeInTheDocument();
    expect(await screen.findByText("1940")).toBeInTheDocument();
  });

  it("shows a recalling line only when the account describes an earlier event", async () => {
    renderAt("/history/witnesses/david-whitmer");
    expect(await screen.findByText(/recalling Jun 1885/)).toBeInTheDocument();
    expect(screen.queryByText(/recalling Sep 1945/)).not.toBeInTheDocument();
  });

  it("never renders the corrupt publication date", async () => {
    renderAt("/history/witnesses/david-whitmer");
    expect(screen.queryByText(/28 Jun 1885/)).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/Witnesses.render.test.js`
Expected: FAIL — cards render in `year`-sorted order but display `28 Jun 1885`, and no "recalling" line exists.

**Step 3: Write the implementation**

In `Witnesses.js`, replace the import at line 9:

```js
import WitnessLifeHeatmap from './WitnessLifeHeatmap';
import { compositionDate, recalledEvent, byCompositionDesc, matchesYearMonth } from './witnessSources';
```

Replace the sort at line 130:

```js
list.sort(byCompositionDesc);
```

Replace `displayDate` (lines 151–159) with two formatters:

```js
const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sep 1945" for month precision, "1940" for year precision. */
const formatComposition = (comp) =>
    !comp ? '' : comp.month ? `${MONTHS_ABBR[comp.month - 1]} ${comp.year}` : `${comp.year}`;
```

In the card body (replacing lines 223–228 — the full header restructure lands in Task 11; for now just fix the date):

```js
<div className='card-header text-left'>
    <div className='sourcebox'>
        <div className='date'>{formatComposition(compositionDate(doc))}</div>
    </div>
</div>
```

And after the `<h5>` title (line 250), add the recalling line:

```js
{(() => {
    const recalled = recalledEvent(doc);
    return recalled && (
        <div className='recalling'>↳ recalling {formatComposition(recalled)}</div>
    );
})()}
```

The local `matchesYearMonth` import from `WitnessLifeHeatmap` is now the one from `witnessSources` — `visibleSources` (lines 161–165) needs no change beyond that swapped import.

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/Witnesses.render.test.js`
Expected: PASS, 4 tests

Then confirm nothing else consumed the old export:
Run: `grep -rn "matchesYearMonth" frontend/webapp/src --exclude-dir=node_modules`
Expected: imports resolve to `witnessSources` only; `WitnessLifeHeatmap.js` still exports its copy (removed in Task 4).

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/
git commit -m "fix(witnesses): sort and display the same date field (composition year)"
```

---

## Task 3b: Make date resolution polymorphic by archive

**Added after Task 3.** Nothing has regressed — this closes a trap before a later task falls into it.

### The problem

`bom_xtras_history` holds two archives with **incompatible date semantics**, verified against live data:

| | `witnesses` (444 rows) | `reception` (580 rows) |
|---|---|---|
| `year` | trustworthy | trustworthy |
| `date` | **corrupt** — 76 rows diverge; publication dates, data-entry timestamps, typos | **clean** — 0 rows diverge, all 580 have `year(date) === year` |
| `event_year` / `event_date` | present and trustworthy | **absent entirely** — 580/580 null |
| precision available | 349 full + 137 month via `event_date` | 349 full + 137 month **via `date`** |

`compositionDate` currently hardcodes the witnesses rule — derive the month from `event_date`, never
read `date`. Applied to a reception row that rule finds no `event_date`, so **all 580 degrade to
year-only**, discarding month precision on 486 of them. Silently: no error, just worse output.

Today `Witnesses.js` only ever fetches `archive: "witnesses"` and `History.js:61` only ever fetches
`archive: "reception"` and formats `doc.date` with its own `displayDate` (`History.js:89`). Both are
correct. The hazard is forward-looking:

- `witnessSources.js` has a general name, lives in the shared `views/History/` folder, and exports a
  function called `compositionDate` that any reasonable person would reach for on a reception row.
- Task 11 rebuilds the source card. The two views already share `.historycard` CSS, so a later
  consolidation is likely — and would break reception dates invisibly.

### The fix — dispatch on `archive`, not on row shape

Per-**row** capability dispatch ("use `event_date` if present, else `date`") is WRONG and must not be
used: 16 witnesses rows have no `event_date`, and falling back to `date` for those reads the corrupt
column — exactly what the module exists to prevent. Whether `date` is trustworthy is a fact about the
*archive*, not about the row.

Add an explicit strategy table to `witnessSources.js`:

```js
/**
 * Date resolution differs by archive, so it is dispatched explicitly rather than
 * inferred from row shape.
 *
 *   witnesses — `date` is corrupt (publication dates, data-entry timestamps, typos).
 *               Month precision comes from `event_date`, gated on its own year. See
 *               compositionDate's docblock for the Cowdery/Moyle shapes that rule exists for.
 *   reception — no `event_year`/`event_date` columns at all, and `date` is clean:
 *               all 580 rows have year(date) === year. Trust `date`.
 *
 * Adding an archive means deciding which strategy it gets.
 */
const DATE_STRATEGY = new Map([
    ['witnesses', 'event'],
    ['reception', 'date'],
]);
const FALLBACK_STRATEGY = 'event';
```

**The fallback is `event`, not `date` — corrected during implementation.** My first draft defaulted
to `date` on the reasoning that reception's shape is the more common one (580 rows vs 444). That was
wrong on two counts:

1. It broke 6 existing tests. No fixture in either suite sets `archive`, so all of them would take
   the default path — including the two tests literally named *"never reads the corrupt date column."*
2. More importantly, **commonality is the wrong criterion for a fail-safe default; blast radius is.**
   Every consumer of this module today is a witnesses consumer, so an unlabeled row is likelier to be
   a witnesses row. And the two defaults fail differently: defaulting to `date` fabricates a month
   from a corrupt column — the exact defect the module exists to prevent — while defaulting to
   `event` yields year-only precision, degraded but honest. That is the same principle the
   `parsed.year === year` guard already encodes, applied to strategy selection.

Use a `Map`, not an object literal. `DATE_STRATEGY[src?.archive]` does an inherited-property lookup,
so `archive: "constructor"` resolves truthy-but-not-`'event'`, `??` never fires, and the row reads
the corrupt column. Unreachable from current data, but a `Map` removes the whole class of reasoning.

`compositionDate` then branches:

```js
export const compositionDate = (src) => {
    const year = parseInt(src?.year, 10);
    if (!year) return null;
    const strategy = DATE_STRATEGY[src?.archive] ?? DEFAULT_STRATEGY;
    const source = strategy === 'event' ? src?.event_date : src?.date;
    const parsed = parseYearMonth(source);
    const describesCompositionYear = parsed && parsed.year === year;
    return ymResult(year, describesCompositionYear ? parsed.month : null);
};
```

Note the `parsed.year === year` guard stays in **both** paths. For reception it is a no-op today
(0 divergent rows) but it is the same protection that neutralized the 18 witnesses rows whose
`event_date` carried a data-entry timestamp — a cheap invariant that turns future corruption into
degraded-but-honest output rather than a fabricated month.

`recalledEvent` needs no dispatch: reception rows have no `event_year`, so it already returns `null`
for all 580. Add a test pinning that rather than leaving it to inference.

### Required tests

- a reception row with a full `date` keeps month precision: `{archive:'reception', year:1842, date:'1842-09-14'}` → `{year:1842, month:9, precision:'month'}`
- a reception row with a month `date`: `{archive:'reception', year:1836, date:'1836-03'}` → month 3
- a reception row with a year-only `date`: → year precision
- **a witnesses row still ignores `date` entirely** — the existing corrupt-column mutation test, re-asserted with `archive:'witnesses'` set explicitly
- **a witnesses row with no `event_date` degrades to year precision rather than falling back to `date`** — this is the case per-row dispatch would get wrong; assert it directly with a comment saying so
- an unknown/missing `archive` uses the date strategy
- `recalledEvent` returns `null` for a reception row
- `byCompositionDesc` sorts a mixed-archive list correctly (it calls `compositionDate`, so it inherits dispatch for free — pin it)

### Also

Rename the module file? **No** — 41 tests and three consumers import it, and the churn is not worth
it mid-plan. Instead update the header docblock to say it serves **both** archives and that the
dispatch table is the first thing to read. Note in `History.js` near `displayDate` (`:89`) that a
`compositionDate`-based formatter is available and archive-aware, so the next person consolidating
the two views has a pointer rather than a landmine.

---

## Task 4: Point the heatmap at composition dates (fixes D3, D5)

**Files:**
- Modify: `frontend/webapp/src/views/History/WitnessLifeHeatmap.js:13-33` (remove local parsers), `:59-92` (the memo), `:167-182` (meta strip), `:318-323` (remove the duplicate export)
- Test: `frontend/webapp/src/views/History/__tests__/WitnessLifeHeatmap.test.js` (create)

**Step 1: Write the failing test**

```js
import React from "react";
import { render, screen } from "@testing-library/react";
import WitnessLifeHeatmap from "../WitnessLifeHeatmap";

const WHITMER = {
  slug: "david-whitmer", name: "David Whitmer",
  birthday: "1805-01-07", deathday: "1888-01-25", excommunication: "1838-04-13",
};

const sources = [
  { slug: "a", year: 1885, event_year: 1885, event_date: "1885-06-28" },
  { slug: "b", year: 1886, event_year: 1886, event_date: null },          // year-only
  { slug: "c", year: 1940, event_year: 1885, event_date: "1885-06-28" },  // recalls earlier
  { slug: "d", year: 1918, event_year: 1918, event_date: "1918-04-25" },  // was date="2003"
];

const setup = (props = {}) => render(
  <WitnessLifeHeatmap witness={WHITMER} sources={sources}
    selectedYearMonth={null} onSelectYearMonth={jest.fn()} {...props} />
);

describe("heatmap meta strip", () => {
  it("accounts for every source, and the numbers add up", () => {
    setup();
    // 4 sources: 2 month-precise (1885-06, 1918-04), 1 year-only (1886), 1 recalling (1940).
    // The 1940 row is year-precision, so: 2 placed + 2 year-only = 4.
    expect(screen.getByText(/2 of 4 sources placed/)).toBeInTheDocument();
    expect(screen.getByText(/2 year-only/)).toBeInTheDocument();
    // CORRECTED during Task 4. The draft asserted
    //   queryByText(/recalls an earlier event/) → not.toBeInTheDocument()
    // which is the opposite of the truth: fixture row `c` (year 1940, event_year 1885)
    // DOES recall an earlier event, so accounting.recallsEarlier === 1 and the strip
    // renders it. The assertion only passed on a typo — the draft regex said
    // "recallS" while the strip says "also recall". Assert the count exactly instead,
    // so a wrong count fails.
    expect(screen.getByText("1 also recall an earlier event")).toBeInTheDocument();
  });
  it("never reports undated sources when every row has a year", () => {
    setup();
    expect(screen.queryByText(/undated/)).not.toBeInTheDocument();
  });
});

describe("heatmap axis", () => {
  it("ends at the latest composition year, not a publication date", () => {
    setup();
    // 1940 is the latest composition year in the fixture; nothing reads date="2003".
    // TASK 8 CHANGES THIS to 1829–1888 — bounding the grid at the death year moves
    // the 1918/1940 rows into the posthumous strip. That update is intentional,
    // not a regression; the shipped test carries the same note.
    expect(screen.getByText(/1829–1940/)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/WitnessLifeHeatmap.test.js`
Expected: FAIL — the strip reads "0 of 4 sources placed · 4 undated" (the fixture rows have no `date` field at all).

**Step 3: Write the implementation**

In `WitnessLifeHeatmap.js`:

Delete `parseYearMonth` (13–20), `ymKey` (32), and the exported `matchesYearMonth` (318–323). Import instead:

```js
import { compositionDate, accountSources, ymKey } from './witnessSources';
```

Keep `ymOrdinal`. Add a local parser for the *witness's own* dates (birthday/deathday/excommunication are static strings in `Witnesses.js`, not source rows):

```js
const parseWitnessDate = (dateStr) => {
    if (!dateStr) return null;
    const m = String(dateStr).match(/^(\d{4})(?:-(\d{2}))?/);
    return m ? { year: parseInt(m[1], 10), month: m[2] ? parseInt(m[2], 10) : null } : null;
};
```

Replace the memo body (lines 59–92):

```js
const { yearStart, yearEnd, sourcesByYm, accounting, deathOrdinal, excommunicationOrdinal, birthYear } = useMemo(() => {
    const birth = parseWitnessDate(witness?.birthday);
    const death = parseWitnessDate(witness?.deathday);
    const excom = parseWitnessDate(witness?.excommunication);
    const birthYear = birth?.year ?? null;

    const sourcesByYm = new Map();
    let latestSourceYear = null;

    for (const src of sources || []) {
        const comp = compositionDate(src);
        if (!comp || comp.year < HEATMAP_START_YEAR) continue;
        if (latestSourceYear === null || comp.year > latestSourceYear) latestSourceYear = comp.year;
        if (!comp.month) continue;
        const key = ymKey(comp.year, comp.month);
        if (!sourcesByYm.has(key)) sourcesByYm.set(key, []);
        sourcesByYm.get(key).push(src);
    }

    const yearStart = HEATMAP_START_YEAR;
    const yearEnd = Math.max(latestSourceYear ?? yearStart, death?.year ?? yearStart);
    const deathOrdinal = death ? ymOrdinal(death.year, death.month || 12) : null;
    const excommunicationOrdinal = excom ? ymOrdinal(excom.year, excom.month || 12) : null;

    return { yearStart, yearEnd, sourcesByYm, accounting: accountSources(sources),
             deathOrdinal, excommunicationOrdinal, birthYear };
}, [witness?.birthday, witness?.deathday, witness?.excommunication, sources]);
```

The `maxReasonableYear` guard goes away — `year` is clean, so nothing needs clamping.

Replace the meta strip (lines 167–176) so it adds up:

```js
<div className='witness-life-heatmap-meta'>
    <span>{yearStart}–{yearEnd}</span>
    <span className='dot'>·</span>
    <span>{accounting.monthPrecise} of {accounting.total} sources placed</span>
    {accounting.yearOnly > 0 && <><span className='dot'>·</span>
        <span>{accounting.yearOnly} year-only</span></>}
    {accounting.unusable > 0 && <><span className='dot'>·</span>
        <span>{accounting.unusable} undated</span></>}
    {accounting.recallsEarlier > 0 && <><span className='dot'>·</span>
        <span>{accounting.recallsEarlier} also recall an earlier event</span></>}
    {/* "also" is doing real work — recallsEarlier OVERLAPS the placement counts above it
        and must not read as a fourth addend. See accountSources' docblock. */}
    {shouldCompress && <><span className='dot'>·</span>
        <span className='witness-life-heatmap-compressed-note'>
            {years.length - displayColumns.length} empty years compressed
        </span></>}
    {/* Clear button moves to the card grid in Task 13 — leave it here for now */}
</div>
```

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/`
Expected: PASS — all three files green.

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/
git commit -m "fix(witnesses): heatmap places sources by composition date, meta strip adds up"
```

---

## Task 5: Fix the legend color ramp (D4)

**Files:**
- Modify: `frontend/webapp/src/views/History/WitnessLifeHeatmap.js:263-272`
- Modify: `frontend/webapp/src/views/History/WitnessLifeHeatmap.css:233-235`
- Test: `frontend/webapp/src/views/History/__tests__/WitnessLifeHeatmap.test.js`

**Step 1: Write the failing test**

Append:

```js
describe("legend", () => {
  it("shows every bucket in the ramp, not a mislabeled subset", () => {
    const { container } = setup();
    expect(screen.queryByText("1–3 sources")).not.toBeInTheDocument();
    expect(screen.getByText("fewer")).toBeInTheDocument();
    expect(screen.getByText("more")).toBeInTheDocument();
    // buckets 1..4 each get a swatch
    [1, 2, 3, 4].forEach(b => {
      expect(container.querySelector(`.witness-life-heatmap-legend .swatch.bucket-${b}`)).toBeTruthy();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/WitnessLifeHeatmap.test.js`
Expected: FAIL — `1–3 sources` is present; `.bucket-1` and `.bucket-3` swatches are absent.

**Step 3: Write the implementation**

Replace the two green legend entries (lines 266–267) with a GitHub-style ramp:

```js
<span className='legend-ramp'>
    <span className='legend-ramp-label'>fewer</span>
    <span className='swatch era-witness bucket-1' title='1 source' />
    <span className='swatch era-witness bucket-2' title='2–3 sources' />
    <span className='swatch era-witness bucket-3' title='4–6 sources' />
    <span className='swatch era-witness bucket-4' title='7+ sources' />
    <span className='legend-ramp-label'>more</span>
</span>
```

Add the missing swatch colors and ramp layout to `WitnessLifeHeatmap.css` beside line 234:

```css
.witness-life-heatmap-legend .swatch.era-witness.bucket-1 { background: var(--hm-level-1); border-color: var(--hm-level-2-border); }
.witness-life-heatmap-legend .swatch.era-witness.bucket-3 { background: var(--hm-level-3); border-color: var(--hm-level-4-border); }

.witness-life-heatmap-legend .legend-ramp {
    display: inline-flex;
    align-items: center;
    gap: 0.2em;
}

.witness-life-heatmap-legend .legend-ramp .swatch { margin-right: 0; }
.witness-life-heatmap-legend .legend-ramp-label { color: var(--hm-text-faint); }
```

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/WitnessLifeHeatmap.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/
git commit -m "fix(witnesses): legend shows the full four-step color ramp"
```

---

## Task 6: Remove false click affordances (D6)

**Files:**
- Modify: `frontend/webapp/src/views/History/WitnessLifeHeatmap.js:229-235`
- Modify: `frontend/webapp/src/views/History/WitnessLifeHeatmap.css:155-164`

**Step 1: Write the failing test**

Append to `WitnessLifeHeatmap.test.js`:

```js
describe("cell affordances", () => {
  it("marks only cells with sources as clickable", () => {
    const { container } = setup();
    const clickable = container.querySelectorAll(".cell.is-clickable");
    const withSources = container.querySelectorAll(".cell:not(.bucket-0)");
    expect(clickable.length).toBe(withSources.length);
    expect(clickable.length).toBeGreaterThan(0);
  });
  it("does not mark the empty death-marker cell as clickable", () => {
    const { container } = setup({ sources: [] });
    expect(container.querySelector(".cell.era-death.is-clickable")).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/WitnessLifeHeatmap.test.js`
Expected: FAIL — no `is-clickable` class exists.

**Step 3: Write the implementation**

The `has-sources` class does double duty today: it darkens marker cells that contain sources *and* it sets `cursor: pointer`. Split the two concerns. In the cell class list (lines 229–235):

```js
const cls = [
    'cell',
    `era-${era}`,
    `bucket-${colorBucket(count)}`,
    isSelected ? 'selected' : '',
    count || isMarker ? 'has-sources' : '',   // keeps the darker marker fills
    count ? 'is-clickable' : '',              // pointer + hit target only where a click does something
].filter(Boolean).join(' ');
```

In the CSS, move the cursor off `has-sources` (lines 155–158) and scope the hover ring to cells that have something to show:

```css
.witness-life-heatmap-grid .cell.has-sources { position: relative; }

.witness-life-heatmap-grid .cell.is-clickable { cursor: pointer; }

.witness-life-heatmap-grid .cell.is-clickable:hover,
.witness-life-heatmap-grid .cell.has-sources:hover {
    box-shadow: 0 0 0 1px var(--hm-text-strong);
    z-index: 10;
    position: relative;
}
```

Empty cells keep their hover detail in the panel (the `onMouseEnter` stays) but no longer draw an outline implying they are targets.

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/WitnessLifeHeatmap.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/
git commit -m "fix(witnesses): pointer cursor only on heatmap cells that filter"
```

---

## Task 7: Make the heatmap keyboard- and screen-reader-accessible

**Files:**
- Modify: `frontend/webapp/src/views/History/WitnessLifeHeatmap.js:203-247` (grid), `:277-316` (hover panel)
- Modify: `frontend/webapp/src/views/History/WitnessLifeHeatmap.css`

**Step 1: Write the failing test**

```js
import userEvent from "@testing-library/user-event";

describe("heatmap accessibility", () => {
  it("exposes the grid with a role and label", () => {
    setup();
    expect(screen.getByRole("grid", { name: /David Whitmer/i })).toBeInTheDocument();
  });
  it("gives clickable cells an accessible name", () => {
    setup();
    expect(screen.getByRole("gridcell", { name: /June 1885, 1 source/i })).toBeInTheDocument();
  });
  // NOTE: `skipClick: true` and the call-count assertion are both required, not stylistic.
  // `userEvent.type()` auto-clicks the target before sending keys unless told not to — since
  // the cell's onClick and onKeyDown call the same `activate` fn, that implicit click alone
  // satisfies a bare `toHaveBeenCalledWith(...)`. Without both fixes here, these two tests pass
  // even with onKeyDown deleted (confirmed during Task 7 review).
  it("filters on Enter", () => {
    const onSelect = jest.fn();
    setup({ onSelectYearMonth: onSelect });
    const cell = screen.getByRole("gridcell", { name: /June 1885, 1 source/i });
    cell.focus();
    userEvent.type(cell, "{enter}", { skipClick: true });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("1885-06");
  });
  it("filters on Space", () => {
    const onSelect = jest.fn();
    setup({ onSelectYearMonth: onSelect });
    const cell = screen.getByRole("gridcell", { name: /June 1885, 1 source/i });
    cell.focus();
    userEvent.type(cell, "{space}", { skipClick: true });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("1885-06");
  });
  it("announces the hover/focus detail panel politely", () => {
    const { container } = setup();
    expect(container.querySelector(".witness-life-heatmap-hover").getAttribute("aria-live"))
      .toBe("polite");
  });
  it("keeps empty cells out of the tab order", () => {
    const { container } = setup();
    container.querySelectorAll(".cell:not(.is-clickable)").forEach(cell => {
      expect(cell.getAttribute("tabindex")).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/WitnessLifeHeatmap.test.js`
Expected: FAIL — `Unable to find role="grid"`.

**Step 3: Write the implementation**

Add a label builder near `eraOf`:

```js
const cellLabel = (year, month, count, era) => {
    const when = `${MONTHS_FULL[month - 1]} ${year}`;
    const what = count ? `${count} source${count === 1 ? '' : 's'}` : 'no sources';
    const tag = era === 'death' ? ', death month'
        : era === 'excommunication' ? ', excommunication'
        : era === 'event' ? ', witness event'
        : '';
    return `${when}, ${what}${tag}`;
};
```

Give the grid container grid semantics (line 207):

```js
<div
    className='witness-life-heatmap-grid'
    role='grid'
    aria-label={`${witness.name}: sources by month, ${yearStart} to ${yearEnd}`}
    style={{ gridTemplateColumns: `repeat(${displayColumns.length}, var(--bom-heatmap-cell, 8px))` }}
>
```

Note the DOM is month-major (12 rows of N columns) but has no per-row wrapper, so `role="row"` cannot be added without restructuring. `role="grid"` + labeled `gridcell`s is the honest, achievable improvement; a full row structure is out of scope for this plan — record it as a follow-up.

Replace the cell element (lines 236–244):

```js
const activate = count ? () => onSelectYearMonth(isSelected ? null : key) : undefined;
return (
    <div
        key={key}
        className={cls}
        role='gridcell'
        aria-label={cellLabel(year, month, count, era)}
        aria-selected={isSelected || undefined}
        tabIndex={count ? 0 : undefined}
        onClick={activate}
        onKeyDown={activate ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
        } : undefined}
        onFocus={() => setHoveredKey(key)}
        onBlur={() => setHoveredKey(prev => prev === key ? null : prev)}
        onMouseEnter={() => setHoveredKey(key)}
        onMouseLeave={() => setHoveredKey(prev => prev === key ? null : prev)}
    />
);
```

`onFocus`/`onBlur` mirroring hover is what makes the detail panel reachable without a mouse — and, as a bonus, gives touch users a path to it once they tap.

Make the panel a live region (line 279 and 285 and 305 — all three return branches):

```js
<div className='witness-life-heatmap-hover' aria-live='polite'>
```

Add a visible focus ring in the CSS beside the `.selected` rule:

```css
.witness-life-heatmap-grid .cell.is-clickable:focus-visible {
    outline: 2px solid var(--hm-selected);
    outline-offset: 1px;
    z-index: 12;
    position: relative;
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/WitnessLifeHeatmap.test.js`
Expected: PASS

### Also: give the legend swatches an accessible name

**Flagged during Task 5.** The legend's four ramp swatches (`bucket-1`..`bucket-4`, added in Task 5)
carry a `title` attribute only — a mouse-hover tooltip with no touch affordance and inconsistent
screen-reader support on a non-interactive `<span>`. Task 5 was correctly scoped to fixing the ramp
structure, not accessibility, but this task is the accessibility pass and should not skip the legend
just because the grid cells are the more obvious target. Add `role="img"` and `aria-label` to each
swatch (or convert `title` to `aria-label` directly, since these are decorative color samples, not
interactive controls):

```jsx
<span className='swatch era-witness bucket-1' role='img' aria-label='1 source' />
```

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/
git commit -m "feat(witnesses): keyboard and screen-reader access to heatmap cells"
```

---

## Task 7b: Full ARIA grid conformance — row wrapper, roving tabindex, arrow keys

**Added after Task 7's code-quality review.** Not a blocker for Task 7 — `role="grid"` +
labeled `gridcell`s with no `row` in between and no arrow-key navigation is strictly better than
the unlabeled div soup it replaced, so Task 7 shipped. But the reviewer is right that this is a
real conformance gap, not a cosmetic one: `gridcell`'s required ARIA context role is `row`, and a
screen reader that switches into grid-browse mode on seeing `role="grid"` may offer navigation
commands (arrow keys, cell announcements assuming row/column structure) that simply don't work
here. Every clickable cell is currently its own independent Tab stop, so a witness with many
sourced months means dozens of consecutive Tab presses to traverse.

### What's missing

1. **Row wrapper.** The grid DOM is month-major with no per-row element — `MONTHS.map` is the
   outer loop, `displayColumns.map` the inner, and CSS Grid auto-placement lays cells out visually
   without a DOM row boundary. Needs each month to render inside a `role="row"` wrapper (a
   `display: contents` element keeps the CSS Grid layout intact without an extra visual box).
2. **Roving tabindex.** Only one cell in the whole grid should be a Tab stop at a time
   (`tabIndex={0}` on the "current" cell, `tabIndex={-1}` on every other clickable cell) — Tab
   enters/exits the grid once; arrow keys move the "current" cell inside it.
3. **Arrow-key navigation.** Left/Right move within a row (month), Up/Down move within a column
   (year) skipping non-clickable cells or landing on them with an announced "no sources" state —
   decide which on implementation. Home/End per row is a nice-to-have, not required.

### Compressed-run cells (Minor, same review)

`era-compressed` cells currently have no `role`/`aria-label` at all inside an otherwise fully
labeled grid. Give them one while restructuring — `role="gridcell"` with a label like
`"{startYear}–{endYear}, {N} empty years compressed"`, matching the hover panel's existing
compressed-run copy.

### Required tests

- arrow keys move focus between clickable cells in the expected directions
- only one cell has `tabindex="0"` at a time; the rest of the clickable cells have `tabindex="-1"`
- Tab from outside the grid lands on exactly one cell (the roving one), not on all of them
- `role="row"` exists on 12 elements (one per month), each containing that month's cells
- compressed-run cells get a `gridcell` role and a real label

### Do this task after Task 9

Task 9 changes `CELL_PX_MAX` and the wrapper's width/centering — restructuring row markup at the
same time as a layout change multiplies the surface area for a browser-verification pass to miss
something. Land Task 9's layout first, then this task's DOM restructure on top of a settled layout.

---

## Task 8: Split the heatmap at death, add a posthumous strip (W6)

**Files:**
- Modify: `frontend/webapp/src/views/History/WitnessLifeHeatmap.js`
- Modify: `frontend/webapp/src/views/History/WitnessLifeHeatmap.css`

The main grid should answer "when did this witness testify, and did it continue after excommunication, up to death?" Sources composed after death are a different kind of thing (reprints, family recollections, compilations) and should not claim grid columns.

**Step 1: Write the failing test**

```js
describe("posthumous split", () => {
  it("ends the grid at the death year", () => {
    setup();
    expect(screen.getByText(/1829–1888/)).toBeInTheDocument();
  });
  it("lists posthumous sources in a separate strip", () => {
    setup();
    const strip = screen.getByRole("group", { name: /after his death/i });
    expect(strip).toHaveTextContent("1918");
    expect(strip).toHaveTextContent("1940");
  });
  it("omits the strip when nothing is posthumous", () => {
    setup({ sources: [{ slug: "x", year: 1885, event_year: 1885, event_date: "1885-06" }] });
    expect(screen.queryByRole("group", { name: /after his death/i })).toBeNull();
  });
  it("omits the strip for a witness with no recorded death", () => {
    setup({ witness: { ...WHITMER, deathday: null } });
    expect(screen.queryByRole("group", { name: /after his death/i })).toBeNull();
  });
  it("excludes a source composed later in the death year itself, not just later years", () => {
    // WHITMER died 25 Jan 1888. A source composed in Feb 1888 — same calendar year, but
    // after the death — must NOT appear as a grid cell. This is real: the archive has
    // an obituary and three interviews all dated Feb 1888. A year-only exclusion check
    // (`comp.year > deathYear`) would miss all four; only an ordinal check catches them.
    const { container } = setup({
        sources: [{ slug: "obit", year: 1888, event_year: 1888, event_date: "1888-02-02" }],
    });
    expect(container.querySelector(".cell.bucket-1")).toBeNull();
    const strip = screen.getByRole("group", { name: /after his death/i });
    expect(strip).toHaveTextContent("1888");
  });
});
```

Note this **supersedes** the Task 4 axis test (`1829–1940`); update that earlier assertion to `1829–1888` in the same commit and leave a comment saying the death split now bounds the axis.

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/WitnessLifeHeatmap.test.js`
Expected: FAIL — grid still runs to 1940; no `group` role.

**Step 3: Write the implementation**

**Amended before dispatch — the exclusion must be ordinal-aware, not year-only.** A bare
`comp.year > deathYear` check misses sources composed later in the death year itself, and this is
not theoretical: David Whitmer died **25 January 1888**, and the real archive has **two sources
composed in February 1888** — an obituary (Feb 2) and a newspaper interview (Feb 12) — both dated
after his death but within the same calendar year. (Corrected during Task 8: an earlier pass over
this data misread the count as four; verified as two directly against `bom_xtras_history`.) Under
a year-only check these would stay in the
main grid as ordinary cells, directly contradicting this task's stated goal ("sources composed
after death... should not claim grid columns") and disagreeing with `eraOf`'s own logic one screen
below, which already compares at the *ordinal* level (`ord > deathOrdinal`) and would label the
same cells `'posthumous'` — so the grid and the era coloring would disagree with each other.

Use ordinal comparison when the source has a month; fall back to year comparison only for
year-only sources, where no finer comparison is possible:

```js
const posthumous = [];
for (const src of sources || []) {
    const comp = compositionDate(src);
    if (!comp || comp.year < HEATMAP_START_YEAR) continue;
    const isPosthumous = deathOrdinal !== null && (
        comp.month !== null
            ? ymOrdinal(comp.year, comp.month) > deathOrdinal
            : comp.year > Math.floor(deathOrdinal / 12)   // year-only: can't compare finer than the year
    );
    if (isPosthumous) { posthumous.push({ src, comp }); continue; }
    if (latestSourceYear === null || comp.year > latestSourceYear) latestSourceYear = comp.year;
    if (!comp.month) continue;
    const key = ymKey(comp.year, comp.month);
    if (!sourcesByYm.has(key)) sourcesByYm.set(key, []);
    sourcesByYm.get(key).push(src);
}
posthumous.sort((a, b) => a.comp.year - b.comp.year);
```

**Ordering note:** in the current file, `deathOrdinal` is computed *after* the `sourcesByYm`-building
loop (it depends on `death`, which is available earlier). This amendment needs `deathOrdinal` inside
the loop, so move that one line — `const deathOrdinal = death ? ymOrdinal(death.year, death.month || 12) : null;`
— up before the loop starts. `excommunicationOrdinal` doesn't need to move; leave it where it is.

Add `posthumous` to the memo's return value and destructuring. `yearEnd` needs no special case: with posthumous rows excluded from `latestSourceYear`, `Math.max(latestSourceYear, death.year)` naturally lands on the death year.

### The strip must learn about death, or D3 reopens here

**Flagged by Task 4's implementer, and quantified.** Pulling posthumous rows out of `sourcesByYm`
without telling `accountSources` makes the meta strip claim more cells than the grid draws. For
David Whitmer: the strip would read **"125 of 152 sources placed"** while the grid renders only
**112** — because 13 of his 16 posthumous sources are month-precise. That is exactly the
strip-doesn't-match-the-grid defect D3 exists to fix, reintroduced one task later in a new place.

Fix it by making posthumous a **fourth exclusive placement bucket**, checked first. Extend
`accountSources` in `witnessSources.js` to take an optional death year:

```js
/**
 * ... existing docblock ...
 *
 * `deathYear`, when given, splits out a fourth exclusive bucket: sources composed after the
 * witness died do not draw grid cells (Task 8 renders them as a separate strip), so counting
 * them as "placed" would make the strip claim more cells than the grid draws. Checked BEFORE
 * precision, because a posthumous source is not placed regardless of how precisely it is dated.
 */
export const accountSources = (sources, { deathYear = null } = {}) => {
    const acc = { total: 0, monthPrecise: 0, yearOnly: 0, posthumous: 0, unusable: 0, recallsEarlier: 0 };
    for (const src of sources || []) {
        acc.total += 1;
        const comp = compositionDate(src);
        if (!comp) acc.unusable += 1;
        else if (deathYear !== null && comp.year > deathYear) acc.posthumous += 1;
        else if (comp.precision === 'month') acc.monthPrecise += 1;
        else acc.yearOnly += 1;
        if (recalledEvent(src)) acc.recallsEarlier += 1;
    }
    return acc;
};
```

The invariant becomes `monthPrecise + yearOnly + posthumous + unusable === total`, with
`recallsEarlier` still overlapping. Whitmer then reads 112 + 24 + 16 + 0 = 152, and "112 placed"
matches the 112 cells actually drawn.

Pass `deathYear` from the memo, and add the posthumous count to the strip:

```js
{accounting.posthumous > 0 && <><span className='dot'>·</span>
    <span>{accounting.posthumous} after his death</span></>}
```

**Tests this needs:**
- the four-bucket sum invariant holds with a `deathYear` given
- a month-precise posthumous source counts as `posthumous`, NOT `monthPrecise` — the exact bug
- omitting `deathYear` preserves the current three-bucket behavior (all existing tests must pass unchanged)
- a witness with no `deathday` (Hussey/Vandruver) has `posthumous === 0` and every source still bucketed
- **the strip's placed count equals the number of grid cells rendered** — assert this against the
  real component, since it is the property all of this exists to protect

### Also from Task 4: a latent guard becomes reachable here

Task 4's grid loop skips `comp.year < HEATMAP_START_YEAR` while `accountSources` counts such rows as
placed. Unreachable today (`MIN(year)` across all 444 witnesses rows is 1829), but Task 8 creates the
same class of divergence deliberately, so resolve both the same way: any row the grid skips must be
in a bucket the strip does not call "placed".

Render the strip between the grid and the legend:

```js
{posthumous.length > 0 && (
    <div className='witness-life-posthumous' role='group'
         aria-label={`Sources composed after ${witness.name}'s death`}>
        <span className='posthumous-label'>After his death</span>
        <span className='posthumous-years'>
            {[...new Set(posthumous.map(p => p.comp.year))].map(y => (
                <span key={y} className='posthumous-year'>{y}</span>
            ))}
        </span>
        <span className='posthumous-count'>
            {posthumous.length} source{posthumous.length === 1 ? '' : 's'}
        </span>
    </div>
)}
```

The `era-posthumous` cell styles in the CSS (lines 206–210) and the posthumous legend entry (line 270) are now unreachable for witnesses with a death date — keep them, because witnesses with `deathday: null` (Hussey/Vandruver) still render posthumous-free grids and the era logic is shared. Verify with a quick pass whether `eraOf` can still return `'posthumous'`; if it cannot for any witness in `data`, delete the era, its CSS, and its legend entry in this commit.

Strip styles:

```css
.witness-life-posthumous {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5em;
    margin-top: 0.75rem;
    padding: 0.4rem 0.7rem;
    background: var(--hm-panel);
    border: 1px solid var(--hm-border);
    border-radius: 4px;
    font-size: 0.7rem;
    color: var(--hm-text-soft);
}

.witness-life-posthumous .posthumous-label {
    font-weight: 600;
    color: var(--hm-text);
}

.witness-life-posthumous .posthumous-years {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4em;
}

.witness-life-posthumous .posthumous-year {
    padding: 0 0.4em;
    border-radius: 1em;
    background: var(--hm-posthumous);
    color: var(--hm-text);
}

.witness-life-posthumous .posthumous-count { margin-left: auto; }
```

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/`
Expected: PASS across all History tests.

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/
git commit -m "feat(witnesses): bound heatmap at death, list posthumous sources separately"
```

---

## Task 9: Give the heatmap its width back (W1, part 1)

**Files:**
- Modify: `frontend/webapp/src/views/History/WitnessLifeHeatmap.js:4` (`CELL_PX_MAX`)
- Modify: `frontend/webapp/src/views/History/WitnessLifeHeatmap.css:76-82, 258-271, 298-309, 348-358`

This is visual work with no meaningful unit test — verify in the browser.

**Minor nit noticed during Task 5, worth a look while you're in this CSS but not worth its own
task:** the legend's `bucket-1`/`bucket-3` swatches borrow `--hm-level-2-border`/`--hm-level-4-border`
because `--hm-level-1-border`/`--hm-level-3-border` were never defined — only buckets 2 and 4 had
legend swatches before Task 5. It reads fine (grid cells have no border at all; only legend swatches
do, to stay visible against the page background), so this is cosmetic-only. Add the two missing
variables to both theme blocks if you want the ramp visually exact; skip it if browser time is tight.

**Step 1: Start the app**

```bash
cd backend && PORT=5006 npm run dev
```
and in a second shell:
```bash
cd frontend/webapp && PORT=3000 BROWSER=none \
  REACT_APP_LOCAL_BACKEND=true REACT_APP_LOCAL_BACKEND_PORT=5006 npm start
```

Open `http://localhost:3000/history/witnesses/david-whitmer` at a ~1900px viewport. Confirm the current state: grid ~700px wide, hover box full width.

**Step 2: Widen the cells**

`WitnessLifeHeatmap.js:4`:

```js
const CELL_PX_MAX = 16;
```

With the axis now ending at 1888 (Task 8) rather than 2023, there are far fewer columns to spend width on, so cells will actually reach the new maximum on a desktop.

**Step 3: Make the whole block one column**

The grid, the hover box, the legend, and the posthumous strip must share one width. Wrap them by constraining the component root, `WitnessLifeHeatmap.css:76`:

```css
.witness-life-heatmap {
    --bom-heatmap-cell: 8px;
    --bom-heatmap-gap: 1px;
    --bom-heatmap-months-col: calc(0.6rem + 6px);
    margin: 1.5rem auto;
    width: fit-content;
    max-width: 100%;
    min-width: min(100%, 640px);
    font-size: 0.75rem;
    color: var(--hm-text);
}
```

`width: fit-content` sizes the block to the grid; `min-width` keeps a short-lived witness (Christian Whitmer, d. 1835 — very few columns) from collapsing into a sliver.

**Step 4: Kill the hand-tuned axis offset (W7)**

Both axis rows approximate the months column with a magic number. Replace lines 303 and 353 (`margin-left: calc(0.6rem + 6px)`) with the variable declared in Step 3:

```css
margin-left: var(--bom-heatmap-months-col);
```

Now a font change in `.witness-life-heatmap-months` requires one edit, not three.

**Step 5: Verify visually**

Reload `http://localhost:3000/history/witnesses/david-whitmer`. Confirm:
- Grid, hover box, legend, and posthumous strip all share the same left and right edges.
- The block is centered in the container with no dead half.
- Age ticks sit over their columns (check the red death tick lands on the last column).
- Repeat at 1200px and 800px.
- Check `/history/witnesses/christian-whitmer` (d. 1835, few columns) — the `min-width` floor should keep it reasonable.

**Step 6: Commit**

```bash
git add frontend/webapp/src/views/History/
git commit -m "refine(witnesses): heatmap block shares one centered width, axis offset from a variable"
```

---

## Task 10: Rebuild the hero (W1 part 2, W2, W3)

**Files:**
- Modify: `frontend/webapp/src/views/History/Witnesses.js:174-193`
- Modify: `frontend/webapp/src/views/History/Witnesses.css:211-277`
- Test: `frontend/webapp/src/views/History/__tests__/Witnesses.render.test.js`

The witness `data` objects already carry `deathday` and `excommunication` and the page shows neither. The hero is where they belong.

**Step 1: Write the failing test**

```js
describe("witness hero", () => {
  it("shows the name once, in the hero, not as a separate centered title", async () => {
    renderAt("/history/witnesses/david-whitmer");
    expect(await screen.findAllByText("David Whitmer")).toHaveLength(2); // breadcrumb + hero
    expect(document.querySelector(".title.text-center")).toBeNull();
  });
  it("shows the full life facts", async () => {
    renderAt("/history/witnesses/david-whitmer");
    expect(await screen.findByText("Born")).toBeInTheDocument();
    expect(screen.getByText("7 Jan 1805")).toBeInTheDocument();
    expect(screen.getByText("Died")).toBeInTheDocument();
    expect(screen.getByText("25 Jan 1888")).toBeInTheDocument();
    expect(screen.getByText("Excommunicated")).toBeInTheDocument();
    expect(screen.getByText("13 Apr 1838")).toBeInTheDocument();
    expect(screen.getByText("Age in 1829")).toBeInTheDocument();
  });
  it("omits the excommunication fact for witnesses who were never excommunicated", async () => {
    renderAt("/history/witnesses/hyrum-smith");
    await screen.findByText("Born");
    expect(screen.queryByText("Excommunicated")).toBeNull();
  });
  it("renders no placeholder when the biography is empty", async () => {
    renderAt("/history/witnesses/david-whitmer");
    await screen.findByText("Born");
    expect(screen.queryByText(/Biography coming soon/)).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/Witnesses.render.test.js`
Expected: FAIL — "Biography coming soon." is present, `Died` is not.

**Step 3: Write the implementation**

Delete the centered title (`Witnesses.js:174`) entirely. Replace the hero block (lines 176–193):

```js
<div className='witness-hero'>
    <div className='witness-hero-portrait'>
        <img src={`${assetUrl}/history/witnesses/people/${witness.slug}.jpg`} alt={witness.name} />
    </div>
    <div className='witness-hero-bio'>
        <h1 className='witness-hero-name'>{witness.name}</h1>
        <dl className='witness-hero-facts'>
            {witness.birthday && (
                <div className='witness-fact'>
                    <dt>Born</dt><dd>{displayLifeDate(witness.birthday)}</dd>
                </div>
            )}
            {witness.deathday && (
                <div className='witness-fact'>
                    <dt>Died</dt><dd>{displayLifeDate(witness.deathday)}</dd>
                </div>
            )}
            {witness.excommunication && (
                <div className='witness-fact'>
                    <dt>Excommunicated</dt><dd>{displayLifeDate(witness.excommunication)}</dd>
                </div>
            )}
            {witnessAge !== null && !Number.isNaN(witnessAge) && (
                <div className='witness-fact'>
                    <dt>Age in 1829</dt><dd>{witnessAge}</dd>
                </div>
            )}
        </dl>
        {witness.bio && <div className='witness-bio'>{witness.bio}</div>}
    </div>
</div>
```

Add the life-date formatter beside `formatComposition`. Year-only birthdays (`"1800"`) are placeholders — render them as a bare year so nothing implies a precision that is not there:

```js
const displayLifeDate = (date) => {
    if (!date) return '';
    const [y, m, d] = String(date).split('-');
    if (!m) return y;
    return d ? `${parseInt(d, 10)} ${MONTHS_ABBR[parseInt(m, 10) - 1]} ${y}`
             : `${MONTHS_ABBR[parseInt(m, 10) - 1]} ${y}`;
};
```

CSS — replace the hero rules (`Witnesses.css:211-277`):

```css
.single-witnesses .witness-hero {
    display: flex;
    gap: 1.75rem;
    align-items: flex-start;
    margin: 0.5rem 0 1.5rem;
}

.single-witnesses .witness-hero-portrait {
    flex: 0 0 220px;
    overflow: hidden;
    border-radius: 12px;
    background: #EEE;
    aspect-ratio: 1 / 1;
}

.single-witnesses .witness-hero-portrait img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
}

.single-witnesses .witness-hero-bio {
    flex: 1 1 auto;
    min-width: 0;
}

.single-witnesses .witness-hero-name {
    font-size: 2.25rem;
    font-weight: 800;
    letter-spacing: -0.5px;
    line-height: 1.1;
    margin: 0 0 1rem;
}

.single-witnesses .witness-hero-facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, max-content));
    gap: 0.9rem 2.5rem;
    margin: 0;
}

.single-witnesses .witness-fact dt {
    color: #767676;               /* was #999 — 4.5:1 on #FFF */
    font-size: 0.7rem;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.2em;
}

.single-witnesses .witness-fact dd {
    margin: 0;
    font-size: 0.95rem;
    color: #222;
}

.single-witnesses .witness-bio {
    font-size: 0.95rem;
    line-height: 1.6;
    color: #333;
    margin-top: 1.25rem;
    max-width: 60ch;
}

@media (max-width: 700px) {
    .single-witnesses .witness-hero { flex-direction: column; }
    .single-witnesses .witness-hero-portrait { flex: 0 0 auto; width: 160px; }
    .single-witnesses .witness-hero-name { font-size: 1.75rem; }
}
```

Delete `.witness-bio-placeholder` (265–268) — nothing renders it now.

Update the dark-mode block in `frontend/webapp/src/assets/theme/scss/darkmode/_history.scss` (lines 19–22) to match the new class names:

```scss
.single-witnesses .witness-hero-portrait { background-color: var(--surface-3); }
.single-witnesses .witness-hero-name { color: var(--text-primary); }
.single-witnesses .witness-fact dt { color: var(--text-muted); }
.single-witnesses .witness-fact dd { color: var(--text-primary); }
.single-witnesses .witness-bio { color: var(--text-secondary); }
```

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/Witnesses.render.test.js`
Expected: PASS

Then look at it: reload `http://localhost:3000/history/witnesses/david-whitmer` and confirm the hero fills its row, the name sits beside the portrait, and no vertical hole remains. Toggle dark mode and re-check.

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/ frontend/webapp/src/assets/theme/scss/darkmode/_history.scss
git commit -m "refine(witnesses): hero carries the name and full life facts, drop the placeholder bio"
```

---

## Task 11: Rebuild the source card (D2, W5)

**Files:**
- Modify: `frontend/webapp/src/views/History/Witnesses.js:217-252`
- Modify: `frontend/webapp/src/views/History/Witnesses.css:315-364`
- Test: `frontend/webapp/src/views/History/__tests__/Witnesses.render.test.js`

`source` is blank on all 444 rows; `author` is present on 439. The card header should stop reserving space for a dead column and start carrying the byline that tells four Moyle cards apart.

**Step 1: Write the failing test**

```js
describe("source cards", () => {
  it("shows the author byline instead of the blank source column", async () => {
    renderAt("/history/witnesses/david-whitmer");
    expect(await screen.findAllByText("James H. Moyle")).toHaveLength(3);
    expect(document.querySelector(".sourcebox .pub")).toBeNull();
  });
  it("marks firsthand accounts", async () => {
    renderAt("/history/witnesses/david-whitmer");
    await screen.findByText("Moyle interview");
    expect(document.querySelectorAll(".historycard.is-firsthand")).toHaveLength(0);
  });
  it("renders the citation at readable contrast", async () => {
    renderAt("/history/witnesses/david-whitmer");
    const citation = await screen.findByText(/The Instructor 80/);
    expect(citation).toBeInTheDocument();
  });
});
```

Extend `FIXTURE` at the top of the file with a firsthand row so the badge has something to assert against:

```js
{ slug: "s4", year: 1881, event_year: 1881, event_date: "1881-12", document: "Whitmer's own statement",
  author: "David Whitmer", quote_is_witness_voice: true, witness_label: "David Whitmer", citation: "Richmond Conservator" },
```

and update the firsthand assertion to `toHaveLength(1)`.

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/Witnesses.render.test.js`
Expected: FAIL — `.sourcebox .pub` still exists.

**Step 3: Write the implementation**

Replace the card JSX (lines 217–252):

```js
{visibleSources.map((doc, i) => {
    const comp = compositionDate(doc);
    const recalled = recalledEvent(doc);
    const firsthand = !!doc.quote_is_witness_voice;
    const byline = doc.reporter_label || doc.author;
    return (
        <article
            key={doc.slug || i}
            className={`historycard card${firsthand ? ' is-firsthand' : ''}`}
            role='button'
            tabIndex={0}
            aria-label={`${doc.document}${comp ? `, ${formatComposition(comp)}` : ''}`}
            onClick={() => openSource(doc)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSource(doc); }
            }}
        >
            <div className='card-header text-left'>
                <div className='sourcebox'>
                    {byline && <div className='byline'>{byline}</div>}
                    <div className='date'>{formatComposition(comp)}</div>
                </div>
            </div>
            <div className='thumbbox'>
                {doc.id && (
                    <img
                        style={{ aspectRatio: "1 / " + (parseFloat(doc.aspect) || 1) }}
                        src={`${assetUrl}/history/thumbs/${String(doc.id).padStart(4, '0')}`}
                        alt=''
                    />
                )}
                {doc.money_quote ? (
                    <blockquote className='thumb_money_quote'>
                        &ldquo;{doc.money_quote}&rdquo;
                        <footer className='money_quote_attribution'>
                            {firsthand
                                ? `— ${doc.witness_label || doc.principal}`
                                : `— ${doc.witness_label || doc.principal}${doc.reporter_label ? `, as recorded by ${doc.reporter_label}` : ''}`}
                        </footer>
                    </blockquote>
                ) : (
                    doc.teaser && <div className='thumb_teaser'>{Parser(doc.teaser)}</div>
                )}
            </div>
            <h3 className='historycard-title'>{doc.document}</h3>
            {recalled && <div className='recalling'>↳ recalling {formatComposition(recalled)}</div>}
            {firsthand && <div className='firsthand-badge'>In his own words</div>}
            {doc.citation && <div className='citation'>{Parser(doc.citation + "")}</div>}
        </article>
    );
})}
```

Three things changed beyond the byline: the card is an `article` with `role="button"` and a key handler (§7 of the audit — cards were unfocusable divs); the thumbnail `alt` is now empty because the adjacent heading already names the document; and the `h5` became `h3`, fixing the h3→h5 heading jump now that the hero owns `h1`.

CSS — replace the header and citation rules (`Witnesses.css:315-364`):

```css
.single-witnesses .witness-sources .sourcebox {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75em;
    margin-bottom: 0.75ex;
}

.single-witnesses .witness-sources .sourcebox .byline {
    font-size: 0.75rem;
    font-weight: 600;
    color: #444;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.single-witnesses .witness-sources .sourcebox .date {
    font-size: 0.75rem;
    color: #555;
    white-space: nowrap;
    flex: 0 0 auto;
}

.single-witnesses .witness-sources .historycard-title {
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: -0.3px;
    padding: 0.25em;
    margin: 0;
}

.single-witnesses .witness-sources .recalling {
    padding: 0 0.4em 0.3em;
    font-size: 0.75rem;
    color: #666;
    font-style: italic;
}

.single-witnesses .witness-sources .firsthand-badge {
    display: inline-block;
    margin: 0.2em 0.4em;
    padding: 0.1em 0.6em;
    border-radius: 1em;
    background: #1565c01a;
    color: #0d47a1;
    font-size: 0.7rem;
    font-weight: 600;
}

.single-witnesses .witness-sources .historycard.is-firsthand {
    border-left: 3px solid #1565c0;
}

.single-witnesses .witness-sources .citation {
    padding: 1ex;
    font-size: 0.75rem;
    color: #666;              /* was #AAA on #EEE — about 2:1 */
    line-height: 1.35;
}

.single-witnesses .witness-sources .historycard:focus-visible {
    outline: 3px solid #1565c0;
    outline-offset: 2px;
}
```

Add the dark-mode counterparts to `_history.scss`:

```scss
.single-witnesses .witness-sources .sourcebox .byline { color: var(--text-secondary); }
.single-witnesses .witness-sources .sourcebox .date { color: var(--text-muted); }
.single-witnesses .witness-sources .citation { color: var(--text-muted); }
.single-witnesses .witness-sources .recalling { color: var(--text-muted); }
```

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/Witnesses.render.test.js`
Expected: PASS

Verify by keyboard in the browser: Tab to a card, press Enter, confirm the source popup opens.

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/ frontend/webapp/src/assets/theme/scss/darkmode/_history.scss
git commit -m "feat(witnesses): card byline, firsthand badge, keyboard access, readable citations"
```

### Noted but not fixed: `role="button"` on `<article>` flattens descendant semantics

**Flagged during implementation, tracked here rather than silently shipped or silently fixed.**
Per WAI-ARIA's Presentational Roles Conflict Resolution, `role="button"` forces every descendant
into presentational mode — the card's `<h3>` title, `.recalling` annotation, and `.citation`/
`.thumb_teaser` text (rendered through `html-react-parser`, which does not sanitize) all lose their
semantic roles. Checked against real data: `citation`/`teaser` are typed `string | null` from
`searchhist.ts` with no evidence of embedded links today, so the practical risk is low. But if a
future data edit puts a link in a citation, that link becomes silently unreachable by keyboard/AT
users — no error, no warning, just gone. Same shape of decision as Task 7b (heatmap row/arrow-key
conformance): ship the strictly-better-than-before version now, track the full-conformance gap
rather than let it disappear. Revisit if/when `citation`/`teaser` content is ever expected to carry
interactive elements; until then, no action needed.

### Noted but not fixed: the byline can show a publication name, not a person

**Flagged during code review, confirmed against live data.** `byline = doc.reporter_label ||
doc.author` falls back to `author` when no reporter is named, and `author` is not always a person —
David Whitmer's own source set has rows with `author: "Kansas City Journal"`, `"Chicago Tribune"`,
and bare `"Correspondent"`. These render in the same byline slot, styled identically to `"James H.
Moyle"` elsewhere on the same page, with nothing distinguishing "this names a reporter" from "this
names the publication that ran the story." Arguably fine — attributing a quote to its outlet when no
reporter is named is a normal convention — but the UI doesn't currently signal which case it's in.
Pre-existing ambiguity in the `author` field itself; this task surfaces it rather than causes it, and
the card is strictly better than showing nothing. Revisit if bylines are ever expected to distinguish
person-authored from institution-authored sources — e.g. a small "via" prefix when `author` isn't a
known reporter name — otherwise no action needed.

---

## Task 12: Replace masonry with a decade-grouped grid (W4)

**Files:**
- Modify: `frontend/webapp/src/views/History/witnessSources.js` (add `groupByDecade`)
- Modify: `frontend/webapp/src/views/History/Witnesses.js:3` (drop the Masonry import), `:169`, `:212-255`
- Modify: `frontend/webapp/src/views/History/Witnesses.css:290-299`
- Test: both test files

**Step 1: Write the failing test**

In `witnessSources.test.js`:

```js
import { groupByDecade } from "../witnessSources";

describe("groupByDecade", () => {
  const sorted = [
    { slug: "a", year: 1945, event_year: 1945, event_date: "1945-09" },
    { slug: "b", year: 1888, event_year: 1888, event_date: "1888-01" },
    { slug: "c", year: 1885, event_year: 1885, event_date: "1885-06" },
    { slug: "d", year: 1881, event_year: 1881, event_date: "1881-12" },
  ];
  it("groups into decades, preserving the incoming order", () => {
    expect(groupByDecade(sorted)).toEqual([
      { decade: 1940, label: "1940s", sources: [sorted[0]] },
      { decade: 1880, label: "1880s", sources: [sorted[1], sorted[2], sorted[3]] },
    ]);
  });
  it("returns an empty array for no sources", () => {
    expect(groupByDecade([])).toEqual([]);
  });
});
```

In `Witnesses.render.test.js`:

```js
describe("card grid", () => {
  it("groups cards under decade headings", async () => {
    renderAt("/history/witnesses/david-whitmer");
    expect(await screen.findByRole("heading", { name: "1940s", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1930s", level: 2 })).toBeInTheDocument();
  });
  it("renders cards in DOM order matching the sort", async () => {
    renderAt("/history/witnesses/david-whitmer");
    const titles = await screen.findAllByRole("heading", { level: 3 });
    expect(titles.map(h => h.textContent)).toEqual([
      "Moyle lengthy account", "Moyle ca. 1940 memoir", "Moyle interview", "Whitmer's own statement",
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/`
Expected: FAIL — `groupByDecade is not a function`; no `1940s` heading.

**Step 3: Write the implementation**

Add to `witnessSources.js`:

```js
/** Groups an already-sorted list into decade buckets, preserving order within each. */
export const groupByDecade = (sources) => {
    const groups = [];
    let current = null;
    for (const src of sources || []) {
        const comp = compositionDate(src);
        const decade = comp ? Math.floor(comp.year / 10) * 10 : null;
        if (!current || current.decade !== decade) {
            current = { decade, label: decade === null ? 'Undated' : `${decade}s`, sources: [] };
            groups.push(current);
        }
        current.sources.push(src);
    }
    return groups;
};
```

In `Witnesses.js`: delete the `Masonry` import (line 3) and `breakpointColumnsObj` (line 169). Replace the `<Masonry>` block (lines 212–255):

```js
{visibleSources && visibleSources.length > 0 && (
    <div className='witness-source-decades'>
        {groupByDecade(visibleSources).map(group => (
            <section key={group.label} className='witness-decade'>
                <h2 className='witness-decade-label'>{group.label}</h2>
                <div className='witness-source-grid'>
                    {group.sources.map((doc, i) => (
                        /* the <article> card from Task 11, unchanged */
                    ))}
                </div>
            </section>
        ))}
    </div>
)}
```

Add `groupByDecade` to the `witnessSources` import.

CSS — replace the masonry rules (`Witnesses.css:290-299`):

```css
.single-witnesses .witness-decade {
    margin-bottom: 2.5rem;
}

.single-witnesses .witness-decade-label {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #767676;
    padding-bottom: 0.4rem;
    margin: 0 0 1rem;
    border-bottom: 1px solid #DDD;
}

.single-witnesses .witness-source-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1rem;
    align-items: start;
}
```

`auto-fill` + `minmax` replaces the four hardcoded breakpoints with one rule that adapts continuously, and `align-items: start` lets cards keep their natural heights without stretching — the one thing masonry was buying.

**Do NOT uninstall `react-masonry-css`.** This was checked before Task 3 and settled: six other
views import it — `Home/Sampler.js`, `Contents/Contents.js`, `Contact/Contact.js`,
`Analysis/Analysis.js`, `Places/Places.js`, `About/About.js`. Only the Witnesses view stops using
it; the package stays. Leave `package.json` and `package-lock.json` untouched by this task.

Two further reasons not to run `npm uninstall` here:

- This branch is being developed in a **git worktree** at `../bom-witnesses` whose
  `frontend/webapp/node_modules` is a **symlink** to the main checkout's. Any `npm install` or
  `npm uninstall` run from the worktree mutates the main checkout's dependencies and can break
  whatever branch is checked out there.
- `Home/Sampler.js` documents its dependence on masonry's *round-robin fill order* in three
  separate comments, so it is a deliberate consumer, not a leftover import.

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/`
Expected: PASS

Verify in the browser at 1900 / 1200 / 800 / 400px that rows stay aligned and reading order runs left-to-right, newest decade first.

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/
git commit -m "feat(witnesses): decade-grouped row-major source grid replaces masonry"
```

(Just the History directory — Step 3 says explicitly not to touch `package.json`/`package-lock.json`;
an earlier draft of this step contradicted that. Corrected.)

---

## Task 13: Move the filter control to the cards (W8)

**Files:**
- Modify: `frontend/webapp/src/views/History/WitnessLifeHeatmap.js:177-181` (remove the clear button)
- Modify: `frontend/webapp/src/views/History/Witnesses.js:204-211`
- Modify: `frontend/webapp/src/views/History/Witnesses.css`
- Test: `frontend/webapp/src/views/History/__tests__/Witnesses.render.test.js`

**Step 1: Write the failing test**

```js
import userEvent from "@testing-library/user-event";

describe("month filter", () => {
  it("shows a readable filter chip above the cards", async () => {
    renderAt("/history/witnesses/david-whitmer");
    const cell = await screen.findByRole("gridcell", { name: /September 1945/i });
    userEvent.click(cell);
    const chip = await screen.findByRole("status");
    expect(chip).toHaveTextContent("September 1945");
    expect(chip).not.toHaveTextContent("1945-09");
  });

  it("clears the filter from the chip", async () => {
    renderAt("/history/witnesses/david-whitmer");
    userEvent.click(await screen.findByRole("gridcell", { name: /September 1945/i }));
    userEvent.click(await screen.findByRole("button", { name: /show all sources/i }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(await screen.findAllByRole("heading", { level: 3 })).toHaveLength(4);
  });

  it("offers a way out of the empty state", async () => {
    renderAt("/history/witnesses/david-whitmer");
    userEvent.click(await screen.findByRole("gridcell", { name: /June 1885/i }));
    expect(await screen.findByText(/No sources in June 1885/)).toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: /show all sources/i }));
    expect(await screen.findAllByRole("heading", { level: 3 })).toHaveLength(4);
  });
});
```

The third case needs a month with a heatmap cell but no matching source; pick one from the fixture accordingly, or click an adjacent empty month once Task 7 made empty cells focusable but not clickable — in that case assert the empty state differently. Adjust the fixture rather than the assertion.

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/Witnesses.render.test.js`
Expected: FAIL — no `role="status"` element; the clear button reads `Clear filter (1945-09)`.

**Step 3: Write the implementation**

Delete the clear button from `WitnessLifeHeatmap.js` (lines 177–181) — the filter's consequence lives with the cards, so its control should too.

In `Witnesses.js`, add a month formatter and the chip above the grid (replacing lines 204–211):

```js
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

const formatYearMonth = (ym) => {
    if (!ym) return '';
    const [y, m] = String(ym).split('-').map(n => parseInt(n, 10));
    return m ? `${MONTHS_FULL[m - 1]} ${y}` : `${y}`;   // bare year selects the whole year
};
```

```js
<div className='witness-sources'>
    {selectedYearMonth && (() => {
        // Month filtering is month-strict, so a cell's count always equals the card
        // count. Year-only sources from the same year are unreachable that way — this
        // chip is how they stay findable. Selecting the bare year widens to both precisions.
        const selectedYear = String(selectedYearMonth).split('-')[0];
        const isMonthView = String(selectedYearMonth).includes('-');
        const yearOnlyInYear = isMonthView && sources
            ? sources.filter(s => {
                  const c = compositionDate(s);
                  return c && c.precision === 'year' && String(c.year) === selectedYear;
              }).length
            : 0;
        return (
            <div className='witness-filter-chip' role='status'>
                <span>
                    Showing <strong>{formatYearMonth(selectedYearMonth)}</strong>
                    {' · '}{visibleSources ? visibleSources.length : 0} source
                    {visibleSources && visibleSources.length === 1 ? '' : 's'}
                </span>
                {yearOnlyInYear > 0 && (
                    <button type='button' className='chip-widen'
                            onClick={() => setSelectedYearMonth(selectedYear)}>
                        {yearOnlyInYear} more dated {selectedYear} without a month — show them
                    </button>
                )}
                <button type='button' onClick={() => setSelectedYearMonth(null)}>
                    Show all sources
                </button>
            </div>
        );
    })()}

    {sources === null && <div className='witness-sources-loading'>Loading sources…</div>}

    {sources && sources.length === 0 && (
        <div className='witness-sources-empty'>No sources available for this witness.</div>
    )}

    {visibleSources && visibleSources.length === 0 && sources && sources.length > 0 && (
        <div className='witness-sources-empty'>
            <p>No sources in {formatYearMonth(selectedYearMonth)}.</p>
            <button type='button' className='btn btn-link'
                    onClick={() => setSelectedYearMonth(null)}>
                Show all sources
            </button>
        </div>
    )}
    {/* … the decade grid from Task 12 … */}
</div>
```

`role="status"` makes the count change audible to screen readers when a month is picked — the audit's "announce the filter's effect" point, satisfied by the chip that was needed anyway.

CSS:

```css
.single-witnesses .witness-filter-chip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75em;
    margin-bottom: 1.5rem;
    padding: 0.5rem 0.9rem;
    background: #F4F4F4;
    border: 1px solid #DDD;
    border-radius: 2em;
    font-size: 0.85rem;
    color: #333;
    width: fit-content;
}

.single-witnesses .witness-filter-chip button {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 0.1em 0.5em;
    border-radius: 1em;
    font: inherit;
    font-size: 0.8rem;
    color: #555;
    cursor: pointer;
    text-decoration: underline;
}

.single-witnesses .witness-filter-chip button:hover { color: #000; background: #E4E4E4; }
```

Dark mode in `_history.scss`:

```scss
.single-witnesses .witness-filter-chip {
    background: var(--surface-2); border-color: var(--border); color: var(--text-primary);
    button { color: var(--text-secondary); &:hover { color: var(--text-primary); background: var(--surface-3); } }
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/ frontend/webapp/src/assets/theme/scss/darkmode/_history.scss
git commit -m "feat(witnesses): filter chip and clearable empty state next to the cards"
```

---

## Task 14: Fix the Escape hijack and the dropdown semantics

**Files:**
- Modify: `frontend/webapp/src/views/History/Witnesses.js:47-106` (breadcrumbs), `:114-118` (the global handler)
- Test: `frontend/webapp/src/views/History/__tests__/Witnesses.render.test.js`

**Step 1: Write the failing test**

```js
describe("breadcrumb dropdown", () => {
  it("closes on Escape without navigating away", async () => {
    const back = jest.spyOn(window.history, "back").mockImplementation(() => {});
    renderAt("/history/witnesses/david-whitmer");
    userEvent.click(await screen.findByRole("button", { name: /David Whitmer/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    userEvent.type(document.body, "{esc}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("exposes options as menu items", async () => {
    renderAt("/history/witnesses/david-whitmer");
    userEvent.click(await screen.findByRole("button", { name: /David Whitmer/ }));
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(15);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/Witnesses.render.test.js`
Expected: FAIL — no `role="menu"` (it is `listbox`), and `window.history.back` was called.

**Step 3: Write the implementation**

**Delete the global Escape handler entirely** (`Witnesses.js:114-118`). It uses deprecated `keyCode`, fires for the page's whole lifetime, double-fires against the dropdown, and `history.back()` can navigate off-site when the page was entered directly. The breadcrumb is the page's wayfinding and it is always visible — nothing is lost.

In `WitnessBreadcrumbs`, correct the ARIA to describe what the widget actually is (a menu of links, not a listbox of options):

```js
aria-haspopup='menu'
```

```js
<div className='breadcrumb-dropdown' role='menu'>
```

and on each option:

```js
<Link
    key={w.slug}
    to={`/history/witnesses/${w.slug}`}
    role='menuitem'
    className={`breadcrumb-option${isCurrent ? ' current' : ''}`}
    aria-current={isCurrent ? 'page' : undefined}
    onClick={() => setOpen(false)}
>
```

Return focus to the trigger when the menu closes by Escape, so keyboard users are not dropped at the top of the document. Add a ref and extend the existing key handler (line 56):

```js
const triggerRef = useRef(null);
```

```js
const onKey = (e) => {
    if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
    }
};
```

and put `ref={triggerRef}` on the `<button className='breadcrumb-current'>`.

Give the dropdown a scroll ceiling so 19 entries in one column cannot run off a phone screen (`Witnesses.css`, in the ≤700px block at line 204):

```css
@media (max-width: 700px) {
    .single-witnesses .witness-breadcrumbs .breadcrumb-dropdown {
        grid-template-columns: 1fr;
        min-width: 240px;
        max-height: 70vh;
        overflow-y: auto;
    }
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/Witnesses.render.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/
git commit -m "fix(witnesses): drop the global Escape hijack, correct dropdown menu semantics"
```

---

## Task 15: Clean up the index page (D7, D8, D9 + comparator + mobile)

**Files:**
- Modify: `frontend/webapp/src/views/History/Witnesses.js:262-365`
- Modify: `frontend/webapp/src/views/History/Witnesses.css:3-88`
- Test: `frontend/webapp/src/views/History/__tests__/Witnesses.render.test.js`

**Step 1: Write the failing test**

```js
describe("witness index", () => {
  it("has no empty section heading", async () => {
    renderAt("/history/witnesses");
    expect(screen.queryByRole("heading", { name: "Witness Statements" })).toBeNull();
  });

  it("does not invent an age from a placeholder birthday", async () => {
    renderAt("/history/witnesses");
    // Hiram Page's birthday is the placeholder "1800" — no confident age chip.
    const page = screen.getByText("Hiram Page").closest(".witness");
    expect(page.textContent).not.toMatch(/Age \d/);
  });

  it("shows real ages where the birthday is precise", async () => {
    renderAt("/history/witnesses");
    const whitmer = screen.getByText("David Whitmer").closest(".witness");
    expect(whitmer.textContent).toMatch(/Age 24/);
  });

  it("spells possession correctly", async () => {
    renderAt("/history/witnesses");
    expect(screen.getByText(/while in possession of the plates/)).toBeInTheDocument();
    expect(screen.queryByText(/posession/)).toBeNull();
  });

  it("does not mutate the module data while sorting", async () => {
    const { rerender } = renderAt("/history/witnesses");
    const firstOrder = screen.getAllByText(/^Age /).map(n => n.textContent);
    rerender(<MemoryRouter initialEntries={["/history/witnesses"]}><Witnesses /></MemoryRouter>);
    expect(screen.getAllByText(/^Age /).map(n => n.textContent)).toEqual(firstOrder);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/Witnesses.render.test.js`
Expected: FAIL — the "Witness Statements" heading exists; Hiram Page shows "Age 29"; "posession" is present.

**Step 3: Write the implementation**

Hoist one comparator and one card renderer; the three group blocks are otherwise identical. Above the `Witnesses` component:

```js
const WITNESS_EVENT_DATE = '1829-06-28';

/** Year-only birthdays in `data` are placeholders, not real dates — no age is claimed for them. */
const preciseAge = (birthday) => {
    if (!birthday || String(birthday).length <= 4) return null;
    const age = moment(WITNESS_EVENT_DATE).diff(moment(birthday), 'years');
    return Number.isNaN(age) ? null : age;
};

/** Oldest first at the time of the witness event. Sorts a copy — `data` is module state. */
const byAgeAtEvent = (a, b) =>
    moment(a.birthday).valueOf() - moment(b.birthday).valueOf();

const WitnessGroup = ({ groupKey, heading, subtitle, children }) => (
    <div className={groupKey}>
        <h4>{heading}</h4>
        <h5>{subtitle}</h5>
        <div className='witness-container'>
            {[...data[groupKey]].sort(byAgeAtEvent).map(w => {
                const age = preciseAge(w.birthday);
                return (
                    <div key={w.slug} className='witness'>
                        <Link to={`/history/witnesses/${w.slug}`}>
                            <img src={`${assetUrl}/history/witnesses/people/${w.slug}.jpg`}
                                 alt={w.name} className='witness-image' />
                            <div className='witness-name'>{w.name}</div>
                            {age !== null && <div className='witness-age'>Age {age}</div>}
                        </Link>
                    </div>
                );
            })}
        </div>
        {children}
    </div>
);
```

`[...data[groupKey]]` is the fix for the in-place mutation: the old `.sort((b, a) => …)` reordered the module-level arrays on every render, which also silently reordered the breadcrumb dropdown.

Use it for all three groups, fix the typo in the Other Sources subtitle (`posession` → `possession`), and **delete the empty `<h4>Witness Statements</h4>` block** (lines 358–360) — the statements it promises do not exist, and the two real statements already render inside their own groups.

Add responsive rules (`Witnesses.css`, after line 14):

```css
.witnesses .eight-witnesses .witness-container,
.witnesses .other-witnesses .witness-container {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 1rem 0.5rem;
}

@media (max-width: 1100px) {
    .witnesses .eight-witnesses .witness-container,
    .witnesses .other-witnesses .witness-container { grid-template-columns: repeat(4, 1fr); }
}

@media (max-width: 600px) {
    .witnesses .witness-container { flex-wrap: wrap; }
    .witnesses .eight-witnesses .witness-container,
    .witnesses .other-witnesses .witness-container { grid-template-columns: repeat(2, 1fr); }
}
```

Fix the solid leading on the testimony text (lines 60–69) — bulleted scripture set at `line-height: 1rem` is unreadable:

```css
.witnesses .witness-statement {
    font-family: "Scripture", serif;
    cursor: text;
    font-size: 1rem;
    line-height: 1.5;
    font-weight: 400;
    color: #444;
    margin: 0 auto;
    max-width: 65ch;
}

@media (max-width: 700px) {
    .witnesses .witness-statement { margin: 0 1rem; }
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend/webapp && npx react-scripts test --watchAll=false src/views/History/__tests__/`
Expected: PASS

Check `http://localhost:3000/history/witnesses` at 1900 / 800 / 375px.

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/History/
git commit -m "fix(witnesses): index page dead heading, fabricated ages, typo, mutation, mobile rules"
```

---

## Task 16: Touch support for the heatmap and a load skeleton

**Files:**
- Modify: `frontend/webapp/src/views/History/WitnessLifeHeatmap.css`
- Modify: `frontend/webapp/src/views/History/Witnesses.js:195-202`

**Step 1: Coarse-pointer cell sizing**

Tasks 7 and 8 already made the panel reachable by focus, which touch triggers. What remains is hit size: at `CELL_PX_MIN = 4` a cell is untappable.

**A bare CSS override here does not work — verified before dispatch.** `--bom-heatmap-cell` is set via an
INLINE `style` attribute on `.witness-life-heatmap` (`WitnessLifeHeatmap.js:231`,
`style={{ '--bom-heatmap-cell': \`${cellPx}px\` }}`). Inline styles out-rank every external stylesheet
rule regardless of specificity or media query — a plain `@media (pointer: coarse) { .witness-life-heatmap
{ --bom-heatmap-cell: max(var(--bom-heatmap-cell), 12px); } }` rule would never win against the inline
value, so it would be dead CSS on every touch device: the floor would silently not apply and cells could
still render at `CELL_PX_MIN` (4px) on a phone. CSS custom properties DO respect `!important`, so add it:

```css
@media (pointer: coarse) {
    .witness-life-heatmap { --bom-heatmap-cell: max(var(--bom-heatmap-cell), 12px) !important; }
    .witness-life-heatmap-scroll { -webkit-overflow-scrolling: touch; }
}
```

Confirm this actually wins over the inline style — don't just trust that `!important` on a custom property
behaves the way it does for a normal CSS property; verify it (in a browser if you can reach one, otherwise
by reasoning through the CSS Custom Properties spec's cascade rules and saying so explicitly) before
committing. If `!important` on a custom property turns out not to behave as expected in whatever
environment you can check, the fallback is to compute this floor in JS instead — inside `widthFor`,
check `window.matchMedia('(pointer: coarse)').matches` and clamp the returned value to a minimum there,
which sidesteps the inline-style-vs-stylesheet cascade question entirely at the cost of coupling
touch-detection into JS that was otherwise presentation-only.

**Amended during Task 16 — the CSS snippet above is not merely untested, it is broken, and shipped as
the JS fallback instead.** Verified with a standalone Playwright/Chromium harness (headless, via the
Python `playwright` package — no Node `playwright` package is installed in this worktree, and
`node_modules` cannot be touched here) reproducing this exact shape: an element with an inline
`style="--x: 4px"` plus a `@media (pointer: coarse) { --x: max(var(--x), 12px) !important }` rule
targeting the *same selector*. `!important` does correctly win the cascade — a flat, non-self-referential
override (`--x: 12px !important`, no `var(--x)` inside it) measurably beats the inline value, confirmed
first. But `max(var(--bom-heatmap-cell), 12px)` reads the variable it is itself redefining on the same
element, which is a **cycle** under the CSS Custom Properties spec's cycle rule (the spec's own canonical
example, `foo { --prop: calc(var(--prop) + 10px); }`, was reproduced too, as a sanity check on this
Chromium build, and fails identically). A cyclic custom property is invalid at computed-value time —
not 12px, not the inline 4px, genuinely invalid — and a `var()` fallback inside the cyclic reference does
not rescue it (tested directly: `var(--x, 999px)` inside the same self-reference still resolves to
invalid). Every consumer of the variable (`grid-auto-rows`, `.cell`'s `width`/`height`) then falls back to
its own initial value, so cells lose their explicit size entirely on every touch device — worse than
shipping no floor at all. The floor is computed in JS instead, inside `widthFor()`'s caller in
`WitnessLifeHeatmap.js` (see the comment there for the full derivation and the empirical check).

One further wrinkle found while implementing the JS fallback: flooring inside `widthFor()` itself (rather
than only on its caller's final `cellPx`) also inflates `uncompressedCellPx`, the probe `shouldCompress`
compares against `COMFORT_CELL_PX` — an unrelated legibility threshold, not a touch-tappability one. That
silently changed the compression decision by pointer type alone. Fixed by applying the floor only to the
already-selected `displayColumns`' final width, never to the internal probe; pinned by a test asserting
the coarse- and fine-pointer renders agree on how many columns compress.

The block already scrolls horizontally (`.witness-life-heatmap-scroll`), so wider cells push the grid into a scroll rather than off the page.

**Step 2: Hold the layout during load**

`Witnesses.js:195` mounts the heatmap only after sources arrive, so the cards jump down mid-load. Reserve the space:

```js
{sources === null && <div className='witness-life-heatmap-skeleton' aria-hidden='true' />}
{sources && sources.length > 0 && (
    <WitnessLifeHeatmap … />
)}
```

```css
.single-witnesses .witness-life-heatmap-skeleton {
    height: 260px;
    margin: 1.5rem auto;
    border-radius: 4px;
    background: linear-gradient(90deg, #F4F4F4 0%, #ECECEC 50%, #F4F4F4 100%);
}
```

Match the height to what the real block occupies at desktop — measure it in the browser and adjust rather than guessing.

**Amended during Task 16 — 260px was never re-measured after Task 8/9 changed the real dimensions;
the shipped value is 295px, measured, not guessed.** No live app/browser was reachable in this worktree,
so the real David Whitmer render was reconstructed rather than screenshotted: his actual 152
`bom_xtras_history` rows (pulled read-only via the private workspace repo's `cli/db.mjs`) were run
through the exact `witnessSources.js` pipeline and `WitnessLifeHeatmap.js`'s layout math (column
compression, the `widthFor`/ResizeObserver convergence loop) reproduced faithfully against the real
`WitnessLifeHeatmap.css`, rendered in headless Chromium (same Python-`playwright` approach as the
CSS-cycle check above) at a desktop container width. That converges to a 640px-wide, 9px-cell grid —
the layout's 640px `min-width` floor binds before the container width does, for any viewport ≥ the `lg`
breakpoint — at a measured height of ~295px. Whitmer was chosen because he carries both optional
elements (an excommunication swatch and a posthumous strip), so his card is close to the tallest a real
witness renders. Narrower/mobile viewports render shorter, so 295px is the desktop case, matching this
step's stated scope.

**Step 3: Verify**

Chrome DevTools device toolbar, iPhone SE (375px): confirm cells are tappable and tapping one shows the detail panel and filters the cards. Throttle the network to Slow 3G and confirm the cards no longer jump when sources land.

**Step 4: Commit**

```bash
git add frontend/webapp/src/views/History/
git commit -m "refine(witnesses): tappable heatmap cells on touch, skeleton holds layout during load"
```

---

## Task 17: Full-page verification sweep

**Files:** none — verification only.

**Step 1: Run the whole frontend suite**

Run: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false`
Expected: PASS. Any failure outside `src/views/History/` means this work broke something else — fix before proceeding, do not skip.

**Step 2: Walk every witness**

With the app running, visit each of the 19 slugs in `data`. Watch for:
- Witnesses with no `excommunication` (Hyrum Smith, Emma Smith) — no stray fact, no purple legend entry.
- Witnesses with bare-year placeholder birthdays — Hiram Page, Willard Chase, Hussey/Vandruver
  (all `"1800"`), and **Josiah Stoal** (`"1771"`, missed in this list until Task 15's implementer
  grepped `data` directly instead of trusting it) — no age claimed, hero renders the bare year.
- Hussey/Vandruver — no `deathday`, so no posthumous strip and no death tick.
- Christian Whitmer (d. 1835) and Peter Whitmer Jr. (d. 1836) — short lifespans; the heatmap `min-width` floor should keep the grid sane.
- Any witness whose sources are all year-only — the grid should be empty but the meta strip must still account for them.

**Step 3: Dark mode**

Toggle the theme and re-check the hero facts, decade headers, filter chip, card bylines, citations, firsthand badge, and posthumous strip. Every new color introduced in this plan needs a dark counterpart in `_history.scss` — grep for hardcoded hex values added to `Witnesses.css` and confirm each has one:

```bash
grep -n "#[0-9A-Fa-f]\{3,6\}" frontend/webapp/src/views/History/Witnesses.css
```

**Step 4: Keyboard-only pass**

From the breadcrumb, Tab through the whole page without a mouse. Confirm: the dropdown opens and closes with focus returning to the trigger; heatmap cells take focus and Enter filters; the filter chip's clear button is reachable; every card is focusable and Enter opens its popup; focus rings are visible everywhere in both themes.

**Step 5: Update the audit**

Add a short resolution note to the top of `docs/audits/2026-07-18-witnesses-view-ux-audit.md` recording which findings this plan closed, and correcting §2 — the audit blamed the sort while the real cause was the corrupt `date` column, with `event_date` available and clean all along.

**Step 6: Commit**

```bash
git add docs/audits/2026-07-18-witnesses-view-ux-audit.md
git commit -m "docs(audits): record resolution of the witnesses UX findings"
```

---

## Deferred — not in this plan

- **`role="row"` on the heatmap.** The grid DOM is month-major with no per-row wrapper; proper grid semantics need a restructure. `role="grid"` + labeled cells is what Task 7 achieves.
- **Collapsing same-reporter runs** ("4 accounts by James H. Moyle, 1885–1945") — the decade grouping plus bylines from Tasks 11–12 may resolve the repetition well enough. Re-evaluate after seeing it.
- **Syncing the selected month to the querystring.** Worth doing to match the app's deep-link investment, but it is a router change, not a UX fix.
- **Writing the biographies.** Every `bio` in `data` is `""`. Task 10 stops apologizing for it; filling them in is content work.
- **Backfilling `source` or dropping the column** — the frontend stops reading it in Task 11, but 444 blank rows are a data question for whoever owns the archive.
