# Single-Witness Layout Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/history/witnesses/:slug` (`.single-witnesses`) so the source cards own the page from the top: compact sidebar hero, a one-row life strip (no confusing legend), a real CSS grid of cards, and no wasted vertical space.

**Architecture:** Reorganize `SingleWitness` (in `Witnesses.js`) into a two-column CSS grid — a ~280px sticky sidebar (portrait + facts + bio + a compact life strip) and a `1fr` sources column that starts at the top. Replace `react-masonry-css` with a native CSS grid. Replace the 326-line month-grid `WitnessLifeHeatmap` with a small `WitnessLifeStrip` (one row per year, density-colored, on-axis death/excom markers, click-a-year → month chips → filter, hover tooltip, inline 5-swatch key, no legend).

**Tech Stack:** React 17 (function components + hooks), CRA (`react-scripts test` = Jest + jsdom), plain CSS (+ `assets/theme/scss/darkmode/_history.scss` tokens), `moment`, `react-masonry-css` (being removed here).

**Source of truth:** the Fable design memo in this conversation. This redesign is entirely `.single-witnesses`-scoped; it must not touch the witness *grid/index* page or the home tiles.

**Verification reality:** jsdom has no layout engine, so layout/CSS is verified by **eslint + `react-scripts build`-via-`react-app-rewired` (the live `bom-dev` webpack compile) + manual check on `http://localhost:8200/history/witnesses/david-whitmer`** (NOT `bom.kckern.net` — CDN-cached; see CLAUDE.md). Only the pure date/count helpers are unit-tested. Per-task "verify" steps use lint + compile + a stated manual check.

**Commands:**
- Run one test file: `cd frontend/webapp && CI=true npx react-scripts test --watchAll=false <path-regex>`
- Lint a file: `cd frontend/webapp && npx eslint <path>`
- Compile check: `journalctl --user -u bom-dev --no-pager -n 6 | grep -iE "compiled|failed"` (HMR recompiles on save)

---

## File Structure

**New files:**
- `frontend/webapp/src/views/History/WitnessLifeStrip.js` — compact one-row-per-year life strip + month-chip filter + hover tooltip + inline density key. Exports `default WitnessLifeStrip` and the pure helpers `buildYearBuckets`, `monthChipsForYear`, `matchesYearMonth` (the last moved here from the old heatmap so `Witnesses.js` keeps a single import source).
- `frontend/webapp/src/views/History/WitnessLifeStrip.css` — the strip styles.
- `frontend/webapp/src/views/History/__tests__/WitnessLifeStrip.test.js` — unit tests for the pure helpers.

**Modified files:**
- `frontend/webapp/src/views/History/Witnesses.js` — `SingleWitness`: delete duplicate `h3`; fix facts; two-column layout; CSS grid instead of Masonry; filter chip; swap `WitnessLifeHeatmap` → `WitnessLifeStrip`.
- `frontend/webapp/src/views/History/Witnesses.css` — sidebar layout, portrait 3:4, sources CSS grid, `.historyLead` line-clamp, filter chip.
- `frontend/webapp/src/assets/theme/scss/darkmode/_history.scss` — dark tokens for the new sidebar/chip (strip carries its own `--hm-*` tokens).

**Deleted at the end:**
- `frontend/webapp/src/views/History/WitnessLifeHeatmap.js` and `WitnessLifeHeatmap.css` (once nothing imports them).

---

## Task 1: Delete the duplicate centered page title

**Files:** Modify `frontend/webapp/src/views/History/Witnesses.js:188`

- [ ] **Step 1: Remove the `<h3>`**

In `SingleWitness`'s return, delete this line (the witness name is already the bold `.breadcrumb-current` in `WitnessBreadcrumbs`):

```jsx
            <h3 className="title lg-4 text-center">{witness.name}</h3>
```

(Leave the OTHER `h3.title` at ~line 298 — that's the witness *index* page heading, a different component.)

- [ ] **Step 2: Verify**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && grep -n 'className="title lg-4 text-center">{witness.name}' src/views/History/Witnesses.js`
Expected: no match. Then `npx eslint src/views/History/Witnesses.js` — no new errors.
Manual: `/history/witnesses/david-whitmer` no longer shows the name twice; ~55px reclaimed.

- [ ] **Step 3: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/History/Witnesses.js
git commit -m "fix(witnesses): drop duplicate centered name heading on single-witness page"
```

---

## Task 2: Fix the facts block (formatted dates + Died/Excommunicated rows)

**Files:** Modify `frontend/webapp/src/views/History/Witnesses.js:195-200`

- [ ] **Step 1: Replace the facts block**

`displayDate` is defined at `Witnesses.js:165`. Replace the `.witness-hero-facts` block:

```jsx
                    <div className='witness-hero-facts'>
                        {witness.birthday && <div><span className='witness-hero-facts-label'>Born</span> {witness.birthday}</div>}
                        {witnessAge !== null && !Number.isNaN(witnessAge) && (
                            <div><span className='witness-hero-facts-label'>Age in 1829</span> {witnessAge}</div>
                        )}
                    </div>
```

with:

```jsx
                    <div className='witness-hero-facts'>
                        {witness.birthday && <div><span className='witness-hero-facts-label'>Born</span> {displayDate(witness.birthday)}</div>}
                        {witnessAge !== null && !Number.isNaN(witnessAge) && (
                            <div><span className='witness-hero-facts-label'>Age in 1829</span> {witnessAge}</div>
                        )}
                        {witness.excommunication && <div><span className='witness-hero-facts-label'>Excommunicated</span> {displayDate(witness.excommunication)}</div>}
                        {witness.deathday && <div><span className='witness-hero-facts-label'>Died</span> {displayDate(witness.deathday)}</div>}
                    </div>
```

(`witness.excommunication` and `witness.deathday` exist in the `data` object at the top of the file; some witnesses lack one — the `&&` guards handle that.)

- [ ] **Step 2: Verify**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && npx eslint src/views/History/Witnesses.js` — no new errors.
Manual: David Whitmer shows `Born Jan 7, 1805` (formatted, not `1805-01-07`), `Excommunicated …`, `Died Jan 25, 1888`.

- [ ] **Step 3: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/History/Witnesses.js
git commit -m "feat(witnesses): format hero dates + add Excommunicated/Died facts rows"
```

---

## Task 3: Fix the portrait (fixed 3:4, no stretch-crop)

**Files:** Modify `frontend/webapp/src/views/History/Witnesses.css` (the `.witness-hero-portrait` rules, ~lines 219-232)

- [ ] **Step 1: Replace the portrait rules**

Replace:

```css
.single-witnesses .witness-hero-portrait {
    flex: 0 0 220px;
    overflow: hidden;
    border-radius: 12px 0 0 12px;
    background: #EEE;
}

.single-witnesses .witness-hero-portrait img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
}
```

with:

```css
.single-witnesses .witness-hero-portrait {
    width: 100%;
    aspect-ratio: 3 / 4;
    overflow: hidden;
    border-radius: 12px;
    background: #EEE;
}

.single-witnesses .witness-hero-portrait img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
}
```

(Width becomes 100% of the sidebar rail set up in Task 5. The `aspect-ratio` fixes the letterbox-crop bug; all four corners round.)

- [ ] **Step 2: Verify**

Manual (after Task 5 lands the rail, the portrait fills the rail at 3:4): for now confirm the file still compiles — save and check `journalctl --user -u bom-dev -n 4 | grep compiled`.

- [ ] **Step 3: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/History/Witnesses.css
git commit -m "fix(witnesses): portrait fixed 3:4 aspect, rounded, no stretch-crop"
```

---

## Task 4: Replace Masonry with a CSS grid + clamp the lead quote

**Files:** Modify `frontend/webapp/src/views/History/Witnesses.js` (import, `breakpointColumnsObj`, the `<Masonry>` wrapper) and `frontend/webapp/src/views/History/Witnesses.css` (grid rules + `.historyLead` clamp)

- [ ] **Step 1: Swap the Masonry wrapper for a plain grid div**

In `Witnesses.js`, the sources render currently uses `<Masonry breakpointCols={breakpointColumnsObj} className="my-masonry-grid" columnClassName="my-masonry-grid_column">…</Masonry>`. Replace the opening/closing `<Masonry …>` / `</Masonry>` tags with a single `<div className='witness-sources-grid'>` / `</div>` — keep the `{visibleSources.map((doc, i) => ( …card… ))}` body exactly as-is.

Then delete the now-unused pieces:
- the line `const breakpointColumnsObj = { default: 4, 1400: 3, 1100: 2, 800: 1 };`
- the import `import Masonry from 'react-masonry-css';` (line 3)

- [ ] **Step 2: Add the grid + clamp CSS**

In `Witnesses.css`, replace the two masonry rules:

```css
.single-witnesses .witness-sources .my-masonry-grid {
    display: flex;
    margin-left: -1rem;
    width: auto;
}

.single-witnesses .witness-sources .my-masonry-grid_column {
    padding-left: 1rem;
    background-clip: padding-box;
}
```

with:

```css
.single-witnesses .witness-sources .witness-sources-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
    align-items: start;
}
/* clamp the lead quote so rows align; the full quote is in the click-through popup */
.single-witnesses .witness-sources .historyLead .money_quote_text {
    display: -webkit-box;
    -webkit-line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
```

- [ ] **Step 3: Verify**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && grep -c "Masonry\|breakpointColumnsObj" src/views/History/Witnesses.js` → expect `0`. Then `npx eslint src/views/History/Witnesses.js` — no `no-undef`/unused for Masonry.
Manual: cards flow left→right in rows (newest-first honored), no empty phantom columns when a filter narrows to 2 cards, long quotes clamp at ~6 lines.

- [ ] **Step 4: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/History/Witnesses.js frontend/webapp/src/views/History/Witnesses.css
git commit -m "perf(witnesses): CSS grid source list (drop react-masonry-css) + 6-line lead clamp"
```

---

## Task 5: Two-column sidebar layout (hero rail + sources from the top)

**Files:** Modify `frontend/webapp/src/views/History/Witnesses.js` (wrap hero+strip in a rail, sources in a main column) and `frontend/webapp/src/views/History/Witnesses.css` (grid shell + sticky rail + responsive)

- [ ] **Step 1: Restructure the JSX shell**

In `SingleWitness`'s return, the current order is: `<WitnessBreadcrumbs/>`, `<div className='witness-hero'>…</div>`, `<WitnessLifeHeatmap/>` (conditional), `<div className='witness-sources'>…</div>`.

Wrap them into a rail + main split. Replace from the `witness-hero` div through the end of the `witness-sources` div with:

```jsx
            <div className='witness-layout'>
                <aside className='witness-rail'>
                    <div className='witness-hero'>
                        <div className='witness-hero-portrait'>
                            <img src={`${assetUrl}/history/witnesses/people/${witness.slug}.jpg`} alt={witness.name} />
                        </div>
                        <div className='witness-hero-bio'>
                            <div className='witness-hero-facts'>
                                {witness.birthday && <div><span className='witness-hero-facts-label'>Born</span> {displayDate(witness.birthday)}</div>}
                                {witnessAge !== null && !Number.isNaN(witnessAge) && (
                                    <div><span className='witness-hero-facts-label'>Age in 1829</span> {witnessAge}</div>
                                )}
                                {witness.excommunication && <div><span className='witness-hero-facts-label'>Excommunicated</span> {displayDate(witness.excommunication)}</div>}
                                {witness.deathday && <div><span className='witness-hero-facts-label'>Died</span> {displayDate(witness.deathday)}</div>}
                            </div>
                            <div className='witness-bio'>
                                {witness.bio
                                    ? witness.bio
                                    : <span className='witness-bio-placeholder'>Biography coming soon.</span>}
                            </div>
                        </div>
                    </div>
                    {sources && sources.length > 0 && (
                        <WitnessLifeHeatmap
                            witness={witness}
                            sources={sources}
                            selectedYearMonth={selectedYearMonth}
                            onSelectYearMonth={setSelectedYearMonth}
                        />
                    )}
                </aside>
                <main className='witness-sources'>
                    {sources === null && <div className='witness-sources-loading'>Loading sources…</div>}
                    {sources && sources.length === 0 && (
                        <div className='witness-sources-empty'>No sources available for this witness.</div>
                    )}
                    {visibleSources && visibleSources.length === 0 && sources && sources.length > 0 && (
                        <div className='witness-sources-empty'>No sources in this month.</div>
                    )}
                    {visibleSources && visibleSources.length > 0 && (
                        <div className='witness-sources-grid'>
                            {/* KEEP the existing {visibleSources.map((doc, i) => ( …historycard… ))} body verbatim */}
                        </div>
                    )}
                </main>
            </div>
```

IMPORTANT: preserve the existing `{visibleSources.map((doc, i) => ( … ))}` card body verbatim inside `.witness-sources-grid` — do not rewrite the cards (today's card design is final). This task only moves/wraps existing JSX.

- [ ] **Step 2: Add the layout CSS**

In `Witnesses.css`, replace the `.witness-hero` block (currently `display:flex; gap:1.5rem; align-items:stretch; margin:1rem 0`) and the `.witness-sources { margin-top: 2rem; }` rule, and add the shell:

```css
.single-witnesses .witness-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 1.5rem;
    align-items: start;
    margin-top: 0.5rem;
}
.single-witnesses .witness-rail {
    position: sticky;
    top: 70px;               /* clears the site nav */
    align-self: start;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
}
.single-witnesses .witness-hero {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}
.single-witnesses .witness-sources { margin-top: 0; min-width: 0; }

/* narrow: rail becomes a compact horizontal header, strip goes full width under it */
@media (max-width: 900px) {
    .single-witnesses .witness-layout { grid-template-columns: 1fr; }
    .single-witnesses .witness-rail { position: static; }
    .single-witnesses .witness-hero { flex-direction: row; align-items: center; gap: 1rem; }
    .single-witnesses .witness-hero-portrait { width: 88px; flex: 0 0 88px; }
}
```

- [ ] **Step 3: Verify**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && npx eslint src/views/History/Witnesses.js` — no new errors; confirm compile (`journalctl … | grep compiled`).
Manual (desktop ≥1200px): portrait+facts+bio+strip in a ~280px left rail; the first row of source cards is visible at the top of the viewport (above the fold). Narrow (<900px): rail collapses to a horizontal header, cards below.

- [ ] **Step 4: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/History/Witnesses.js frontend/webapp/src/views/History/Witnesses.css
git commit -m "redesign(witnesses): two-column layout — sticky hero rail + sources from the top"
```

---

## Task 6: Pure helpers for the life strip (TDD)

**Files:** Create `frontend/webapp/src/views/History/WitnessLifeStrip.js`, Test `frontend/webapp/src/views/History/__tests__/WitnessLifeStrip.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/History/__tests__/WitnessLifeStrip.test.js`:

```js
import { buildYearBuckets, monthChipsForYear, matchesYearMonth, colorBucket } from "../WitnessLifeStrip";

const SOURCES = [
  { date: "1829-06-01" }, { date: "1878-09-07" }, { date: "1878-09-20" }, { date: "1878-11-02" },
  { date: "1881" }, { date: "bogus" }, { date: "1200-01-01" },
];
const WITNESS = { birthday: "1805-01-07", deathday: "1888-01-25", excommunication: "1838-04-13" };

describe("colorBucket", () => {
  test("bins: 0 / 1 / 2-3 / 4-6 / 7+", () => {
    expect([0,1,2,3,4,6,7,20].map(colorBucket)).toEqual([0,1,2,2,3,3,4,4]);
  });
});

describe("buildYearBuckets", () => {
  const b = buildYearBuckets(SOURCES, WITNESS);
  test("spans 1829..deathYear and counts dated in-range sources per year", () => {
    expect(b.years[0]).toBe(1829);
    expect(b.years[b.years.length - 1]).toBe(1888); // death year >= last source year
    const y1878 = b.byYear.get(1878);
    expect(y1878).toBe(3);             // three Sep/Nov 1878 sources
    expect(b.byYear.get(1881)).toBe(1); // year-only date still counts by year
  });
  test("flags death and excommunication years", () => {
    expect(b.deathYear).toBe(1888);
    expect(b.excomYear).toBe(1838);
  });
  test("counts undated / out-of-range separately (not placed)", () => {
    expect(b.undated).toBe(2); // "bogus" + "1200-01-01"
  });
});

describe("monthChipsForYear", () => {
  test("returns months with sources in that year, with counts, in order", () => {
    const chips = monthChipsForYear(SOURCES, 1878);
    expect(chips).toEqual([{ month: 9, count: 2 }, { month: 11, count: 1 }]);
  });
  test("empty for a year with no dated-month sources", () => {
    expect(monthChipsForYear(SOURCES, 1881)).toEqual([]); // 1881 is year-only, no month
  });
});

describe("matchesYearMonth", () => {
  test("month key matches a same year+month source", () => {
    expect(matchesYearMonth({ date: "1878-09-07" }, "1878-09")).toBe(true);
    expect(matchesYearMonth({ date: "1878-11-02" }, "1878-09")).toBe(false);
  });
  test("YEAR-ONLY key matches any source in that year (incl. year-only dates)", () => {
    expect(matchesYearMonth({ date: "1878-11-02" }, "1878")).toBe(true);
    expect(matchesYearMonth({ date: "1881" }, "1881")).toBe(true);
    expect(matchesYearMonth({ date: "1878-11-02" }, "1879")).toBe(false);
  });
  test("null key matches everything", () => {
    expect(matchesYearMonth({ date: "x" }, null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, verify FAIL**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/History/__tests__/WitnessLifeStrip.test.js`
Expected: FAIL — "Cannot find module '../WitnessLifeStrip'".

- [ ] **Step 3: Create `WitnessLifeStrip.js` with the helpers only**

Create `frontend/webapp/src/views/History/WitnessLifeStrip.js`:

```js
import React, { useMemo, useState } from "react";
import "./WitnessLifeStrip.css";

const HEATMAP_START_YEAR = 1829;
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const parseYearMonth = (dateStr) => {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})(?:-(\d{2}))?/);
  if (!m) return null;
  return { year: parseInt(m[1], 10), month: m[2] ? parseInt(m[2], 10) : null };
};

export const colorBucket = (count) => {
  if (!count) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
};

/** Per-year source counts across 1829..max(lastSourceYear, deathYear), plus event years. */
export const buildYearBuckets = (sources, witness) => {
  const death = parseYearMonth(witness?.deathday);
  const excom = parseYearMonth(witness?.excommunication);
  const maxReasonableYear = new Date().getFullYear() + 5;
  const byYear = new Map();
  let latestSourceYear = null;
  let undated = 0;
  for (const s of sources || []) {
    const p = parseYearMonth(s.date);
    if (!p || p.year < HEATMAP_START_YEAR || p.year > maxReasonableYear) { undated += 1; continue; }
    byYear.set(p.year, (byYear.get(p.year) || 0) + 1);
    if (latestSourceYear === null || p.year > latestSourceYear) latestSourceYear = p.year;
  }
  const yearStart = HEATMAP_START_YEAR;
  const yearEnd = Math.max(latestSourceYear ?? yearStart, death?.year ?? yearStart);
  const years = [];
  for (let y = yearStart; y <= yearEnd; y++) years.push(y);
  return {
    years, byYear, undated,
    deathYear: death?.year ?? null,
    excomYear: excom?.year ?? null,
    total: [...byYear.values()].reduce((a, b) => a + b, 0),
  };
};

/** Months (1-12) that have sources in `year`, with counts, ascending. */
export const monthChipsForYear = (sources, year) => {
  const counts = new Map();
  for (const s of sources || []) {
    const p = parseYearMonth(s.date);
    if (!p || p.year !== year || !p.month) continue;
    counts.set(p.month, (counts.get(p.month) || 0) + 1);
  }
  return [...counts.keys()].sort((a, b) => a - b).map((month) => ({ month, count: counts.get(month) }));
};

/** Card filter. Accepts a "YYYY-MM" month key OR a "YYYY" year-only key. */
export const matchesYearMonth = (source, key) => {
  if (!key) return true;
  const p = parseYearMonth(source.date);
  if (!p) return false;
  if (/^\d{4}$/.test(key)) return String(p.year) === key;      // year-only
  if (!p.month) return false;
  return `${p.year}-${String(p.month).padStart(2, "0")}` === key;
};

export { MONTHS_FULL };
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && CI=true npx react-scripts test --watchAll=false src/views/History/__tests__/WitnessLifeStrip.test.js`
Expected: PASS (all describes).

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/History/WitnessLifeStrip.js frontend/webapp/src/views/History/__tests__/WitnessLifeStrip.test.js
git commit -m "feat(witnesses): pure helpers for the compact life strip (year buckets, month chips, year-aware filter)"
```

---

## Task 7: The `WitnessLifeStrip` component (render + CSS)

**Files:** Modify `frontend/webapp/src/views/History/WitnessLifeStrip.js` (add the component), Create `frontend/webapp/src/views/History/WitnessLifeStrip.css`

- [ ] **Step 1: Add the default-export component to `WitnessLifeStrip.js`**

Append to `WitnessLifeStrip.js` (below the helpers):

```js
const ymKey = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

export default function WitnessLifeStrip({ witness, sources, selectedYearMonth, onSelectYearMonth }) {
  const { years, byYear, deathYear, excomYear, total, undated } = useMemo(
    () => buildYearBuckets(sources, witness), [sources, witness]
  );
  // which year's month-chips are open: derive from the active month filter, else local click
  const activeYear = selectedYearMonth ? parseInt(String(selectedYearMonth).slice(0, 4), 10) : null;
  const [openYear, setOpenYear] = useState(activeYear);
  const [hover, setHover] = useState(null); // { year, x }

  if (!years.length) return null;
  const shownYear = openYear ?? activeYear;
  const chips = shownYear ? monthChipsForYear(sources, shownYear) : [];
  const birthYear = (witness?.birthday && /^\d{4}/.test(witness.birthday)) ? parseInt(witness.birthday.slice(0, 4), 10) : null;

  const onYearClick = (year) => {
    const has = (byYear.get(year) || 0) > 0;
    if (!has) return;
    if (shownYear === year) { setOpenYear(null); onSelectYearMonth(null); }
    else { setOpenYear(year); onSelectYearMonth(String(year)); } // year-only filter
  };

  return (
    <div className='witness-life-strip'>
      <div className='wls-head'>
        <span>{total} of {sources.length} placed</span>
        {undated > 0 && <span className='wls-dot'>· {undated} undated</span>}
        <span className='wls-key' aria-hidden='true'>
          less
          <i className='wls-sw bucket-1' /><i className='wls-sw bucket-2' /><i className='wls-sw bucket-3' /><i className='wls-sw bucket-4' />
          more
        </span>
      </div>
      <div className='wls-track'>
        {years.map((year) => {
          const count = byYear.get(year) || 0;
          const isDeath = year === deathYear;
          const isExcom = year === excomYear;
          const cls = `wls-year bucket-${colorBucket(count)}${count ? ' has' : ''}${shownYear === year ? ' active' : ''}`;
          return (
            <button
              key={year}
              type='button'
              className={cls}
              disabled={!count}
              onClick={() => onYearClick(year)}
              onMouseEnter={(e) => setHover({ year, x: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2 })}
              onMouseLeave={() => setHover((h) => (h && h.year === year ? null : h))}
            >
              {isDeath && <span className='wls-mark wls-death' aria-hidden='true'>✝</span>}
              {isExcom && !isDeath && <span className='wls-mark wls-excom' aria-hidden='true'>×</span>}
            </button>
          );
        })}
        {hover && (
          <div className='wls-tip' style={{ left: `${hover.x}px` }}>
            <b>{hover.year}</b>
            {' · '}{(byYear.get(hover.year) || 0)} source{(byYear.get(hover.year) || 0) === 1 ? '' : 's'}
            {hover.year === deathYear && <span className='wls-tip-era death'> · died{birthYear ? ` (age ${hover.year - birthYear})` : ''}</span>}
            {hover.year === excomYear && hover.year !== deathYear && <span className='wls-tip-era excom'> · excommunicated</span>}
          </div>
        )}
      </div>
      <div className='wls-axis'>
        <span>{years[0]}</span>
        <span>{years[years.length - 1]}</span>
      </div>
      {chips.length > 0 && (
        <div className='wls-chips'>
          {chips.map(({ month, count }) => {
            const key = ymKey(shownYear, month);
            return (
              <button
                key={key}
                type='button'
                className={`wls-chip${selectedYearMonth === key ? ' active' : ''}`}
                onClick={() => onSelectYearMonth(selectedYearMonth === key ? String(shownYear) : key)}
              >
                {MONTHS_FULL[month - 1].slice(0, 3)}{count > 1 ? ` ·${count}` : ''}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `WitnessLifeStrip.css`**

Create `frontend/webapp/src/views/History/WitnessLifeStrip.css`:

```css
.witness-life-strip {
  --wls-1: #c6e48b; --wls-2: #7bc96f; --wls-3: #239a3b; --wls-4: #196127;
  --wls-empty: #ebedf0; --wls-text: #777; --wls-death: #c62828; --wls-excom: #7b1fa2;
  font-size: 0.7rem; color: var(--wls-text);
}
html[data-theme="dark"] .witness-life-strip {
  --wls-1: #1f4423; --wls-2: #2c6a30; --wls-3: #3f9446; --wls-4: #5cb85c;
  --wls-empty: #333; --wls-text: #9a9a9a; --wls-death: #e57373; --wls-excom: #ab47bc;
}
.witness-life-strip .wls-head { display: flex; align-items: center; gap: 0.4em; margin-bottom: 0.3rem; }
.witness-life-strip .wls-key { display: inline-flex; align-items: center; gap: 2px; margin-left: auto; }
.witness-life-strip .wls-sw { width: 9px; height: 9px; border-radius: 2px; display: inline-block; margin: 0 1px; }
.witness-life-strip .wls-sw.bucket-1 { background: var(--wls-1); }
.witness-life-strip .wls-sw.bucket-2 { background: var(--wls-2); }
.witness-life-strip .wls-sw.bucket-3 { background: var(--wls-3); }
.witness-life-strip .wls-sw.bucket-4 { background: var(--wls-4); }

.witness-life-strip .wls-track { position: relative; display: flex; gap: 1px; height: 22px; }
.witness-life-strip .wls-year {
  flex: 1 1 0; min-width: 3px; height: 100%; padding: 0; border: 0; border-radius: 2px;
  background: var(--wls-empty); position: relative;
}
.witness-life-strip .wls-year.has { cursor: pointer; }
.witness-life-strip .wls-year.bucket-1 { background: var(--wls-1); }
.witness-life-strip .wls-year.bucket-2 { background: var(--wls-2); }
.witness-life-strip .wls-year.bucket-3 { background: var(--wls-3); }
.witness-life-strip .wls-year.bucket-4 { background: var(--wls-4); }
.witness-life-strip .wls-year.active { box-shadow: 0 0 0 2px #c75200; z-index: 2; }
.witness-life-strip .wls-year:hover.has { box-shadow: 0 0 0 1px #000; z-index: 3; }
.witness-life-strip .wls-mark {
  position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
  font-size: 0.7rem; line-height: 1;
}
.witness-life-strip .wls-mark.wls-death { color: var(--wls-death); }
.witness-life-strip .wls-mark.wls-excom { color: var(--wls-excom); font-weight: 700; }

.witness-life-strip .wls-tip {
  position: absolute; bottom: calc(100% + 6px); transform: translateX(-50%);
  white-space: nowrap; background: #222; color: #fff; padding: 0.2rem 0.5rem;
  border-radius: 4px; font-size: 0.68rem; pointer-events: none; z-index: 5;
}
.witness-life-strip .wls-tip-era.death { color: #ff9a9a; }
.witness-life-strip .wls-tip-era.excom { color: #d9a3e8; }

.witness-life-strip .wls-axis { display: flex; justify-content: space-between; font-size: 0.6rem; margin-top: 3px; }

.witness-life-strip .wls-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.5rem; }
.witness-life-strip .wls-chip {
  border: 1px solid rgba(0,0,0,0.18); background: transparent; border-radius: 999px;
  padding: 0.08rem 0.55rem; font-size: 0.68rem; color: inherit; cursor: pointer;
}
.witness-life-strip .wls-chip.active { background: #c75200; color: #fff; border-color: #c75200; }
html[data-theme="dark"] .witness-life-strip .wls-chip { border-color: #4a4a4a; }
```

- [ ] **Step 3: Verify**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && npx eslint src/views/History/WitnessLifeStrip.js` — no errors. Re-run the Task-6 test file — still PASS. Confirm compile.
(Manual check happens in Task 8 once it's wired into the page.)

- [ ] **Step 4: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/History/WitnessLifeStrip.js frontend/webapp/src/views/History/WitnessLifeStrip.css
git commit -m "feat(witnesses): compact life strip component — year density row, on-axis death/excom marks, month chips, tooltip, inline key"
```

---

## Task 8: Wire the strip in + a dismissible filter chip in the sources header

**Files:** Modify `frontend/webapp/src/views/History/Witnesses.js` and `frontend/webapp/src/views/History/Witnesses.css`

- [ ] **Step 1: Swap the import and the component**

In `Witnesses.js` line 9, change:

```js
import WitnessLifeHeatmap, { matchesYearMonth } from './WitnessLifeHeatmap';
```
to:
```js
import WitnessLifeStrip, { matchesYearMonth } from './WitnessLifeStrip';
```

In the rail (added in Task 5), change the element `<WitnessLifeHeatmap … />` to `<WitnessLifeStrip … />` (same four props: `witness`, `sources`, `selectedYearMonth`, `onSelectYearMonth`).

- [ ] **Step 2: Add a filter chip in the sources header**

Inside `<main className='witness-sources'>`, immediately before the `{sources === null && …}` line, add a header row that shows the count and a dismissible active-filter chip:

```jsx
                    {sources && sources.length > 0 && (
                        <div className='witness-sources-head'>
                            <span className='witness-sources-count'>
                                {visibleSources ? visibleSources.length : sources.length} source{(visibleSources ? visibleSources.length : sources.length) === 1 ? '' : 's'}
                            </span>
                            {selectedYearMonth && (
                                <button type='button' className='witness-filter-chip' onClick={() => setSelectedYearMonth(null)}>
                                    {selectedYearMonth} <span aria-hidden='true'>✕</span>
                                </button>
                            )}
                        </div>
                    )}
```

- [ ] **Step 3: Style the header + chip**

Add to `Witnesses.css`:

```css
.single-witnesses .witness-sources-head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
}
.single-witnesses .witness-sources-count { font-size: 0.85rem; font-weight: 600; color: #555; }
.single-witnesses .witness-filter-chip {
    border: 1px solid #c75200;
    background: #fff;
    color: #c75200;
    border-radius: 999px;
    padding: 0.1rem 0.6rem;
    font-size: 0.72rem;
    cursor: pointer;
}
.single-witnesses .witness-filter-chip:hover { background: #c75200; color: #fff; }
```

- [ ] **Step 4: Verify**

Run: `cd /home/bom/BookofMormonOnline/frontend/webapp && grep -c "WitnessLifeHeatmap" src/views/History/Witnesses.js` → expect `0`. `npx eslint src/views/History/Witnesses.js` — no errors. Confirm compile.
Manual on `/history/witnesses/david-whitmer`: the rail shows a one-row year strip with a ✝ over 1888; clicking a green year filters the cards and reveals month chips (e.g. "Sep ·5"); clicking a month narrows further; the sources header shows "N sources" + a dismissible `1878-09 ✕` chip; hovering a year shows the tooltip.

- [ ] **Step 5: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add frontend/webapp/src/views/History/Witnesses.js frontend/webapp/src/views/History/Witnesses.css
git commit -m "redesign(witnesses): wire compact life strip + dismissible filter chip; retire the month-grid heatmap from the page"
```

---

## Task 9: Delete the old heatmap, dark-mode polish, final verify

**Files:** Delete `frontend/webapp/src/views/History/WitnessLifeHeatmap.js` + `.css`; Modify `frontend/webapp/src/assets/theme/scss/darkmode/_history.scss`

- [ ] **Step 1: Confirm nothing imports the old heatmap, then delete it**

Run: `cd /home/bom/BookofMormonOnline && grep -rn "WitnessLifeHeatmap" frontend/webapp/src`
Expected: no references (Task 8 removed the last one). Then:
```bash
git rm frontend/webapp/src/views/History/WitnessLifeHeatmap.js frontend/webapp/src/views/History/WitnessLifeHeatmap.css
```

- [ ] **Step 2: Dark-mode tokens for the new sidebar bits**

Add inside the `html[data-theme="dark"] { … }` block of `frontend/webapp/src/assets/theme/scss/darkmode/_history.scss` (the strip and chip carry their own dark rules; these cover the facts/sidebar/sources-head/filter-chip):

```scss
  .single-witnesses .witness-sources-count { color: var(--text-secondary); }
  .single-witnesses .witness-filter-chip { background: var(--surface-2); }
```

(The `.witness-hero-facts`, `.witness-bio`, etc. already have dark overrides in this file from before; leave them.)

- [ ] **Step 3: Full verify**

Run:
```bash
cd /home/bom/BookofMormonOnline/frontend/webapp
CI=true npx react-scripts test --watchAll=false src/views/History/__tests__/WitnessLifeStrip.test.js
npx eslint src/views/History/Witnesses.js src/views/History/WitnessLifeStrip.js
```
Expected: tests PASS; eslint 0 errors. Confirm `journalctl --user -u bom-dev -n 8 | grep -iE "compiled|failed"` shows compiled.
Manual sweep (`http://localhost:8200/history/witnesses/david-whitmer`, and toggle dark mode): cards above the fold; sticky rail; one-row strip with ✝/× marks + tooltip + month chips; filter chip dismisses; no legend; narrow viewport collapses the rail. Screenshot into `docs/audits/witnesses-after-2026-07-23/`.

- [ ] **Step 4: Commit**

```bash
cd /home/bom/BookofMormonOnline
git add -A frontend/webapp/src/views/History frontend/webapp/src/assets/theme/scss/darkmode/_history.scss
git commit -m "chore(witnesses): remove legacy month-grid heatmap; dark-mode polish for redesigned sidebar"
```

---

## Self-Review

**Spec coverage (vs the 7 memo fixes):** #1 delete h3 → Task 1. #6 facts → Task 2. #7 portrait → Task 3. #2 masonry→grid + clamp → Task 4. #3 sidebar → Task 5. #4 heatmap→strip + month-chip filter → Tasks 6-8. #5 legend delete + inline key + on-axis marks + tooltip → Tasks 7-8 (legend never rendered by `WitnessLifeStrip`; old legend deleted with the file in Task 9). All 7 covered.

**Placeholder scan:** every code step has literal code; the one "keep verbatim" (Task 5 card body) explicitly means *do not modify the existing card JSX* — the cards are final and out of scope, so re-pasting ~50 lines would risk drift; the instruction is to move, not rewrite.

**Type/name consistency:** helper names (`buildYearBuckets`, `monthChipsForYear`, `matchesYearMonth`, `colorBucket`) are identical across the test (Task 6), the component (Task 7), and the import (Task 8). Props (`witness`, `sources`, `selectedYearMonth`, `onSelectYearMonth`) match `SingleWitness`'s existing state (`selectedYearMonth`/`setSelectedYearMonth`) unchanged. `matchesYearMonth` now also accepts a `YYYY` key — `visibleSources` (Witnesses.js:178) already routes through it, so the year-only filter set by a year click works without touching `visibleSources`.

**Risk to watch:** the strip's `matchesYearMonth` is imported into `Witnesses.js` from `WitnessLifeStrip` (Task 8) — after Task 9 deletes `WitnessLifeHeatmap.js`, no dangling import remains (Task 9 Step 1 greps to confirm). Tasks 1-4 are independently shippable if the sidebar/strip work (5-9) needs to pause.
