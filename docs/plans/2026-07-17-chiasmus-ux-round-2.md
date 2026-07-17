# Chiasmus UX Round 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the P0/P1 findings of `docs/audits/2026-07-17-chiasmus-ux-audit-round-2.md` — two broken states (mobile close trap, bad-deep-link hang), toolbar comprehension, layout at mid widths, missing legends, and the sloppy details.

**Architecture:** All frontend, in `frontend/webapp/src/views/Analysis/Chiasmus/` plus `_Common/ChiasmGlyph` and one new breadcrumb component. The one structural refactor: the open-chiasm URL becomes the source of truth in `Container` (push on open, replace while browsing, so Back closes the panel). Everything else is markup/CSS reshaping with component tests.

**Tech Stack:** React 17 (CRA + react-app-rewired), react-router v5 (`useHistory`/`useRouteMatch`), Jest + React Testing Library (existing suites in `__tests__/`), plain CSS with the dark-mode token system (`--surface-*`, `--link`, `--highlight`), Playwright (`playwright-core` + cached Chromium) for visual verification.

**Verification setup (used by several tasks):** the audit's screenshot harness lives at the session scratchpad as `shoot.js`; Task 0 recreates a minimal version. Servers: backend `cd backend && npm run dev` (:5006, uses `backend/.env`), frontend `cd frontend/webapp && REACT_APP_LOCAL_BACKEND=true BROWSER=none PORT=3000 npm start`. Playwright Chromium executable: `~/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`.

**Test command (all tasks):**
```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern "Analysis/Chiasmus"
```
For shared components: `--testPathPattern "_Common"`.

**Reference audit:** `docs/audits/2026-07-17-chiasmus-ux-audit-round-2.md` (finding numbers cited per task). Screenshots: `docs/audits/chiasmus-ux-screenshots-2026-07-17/`.

---

### Task 0: Branch + harness + baseline

**Step 1: Branch off dev**

```bash
git checkout dev && git pull && git checkout -b chiasmus-ux-round-2
```

**Step 2: Baseline test run**

```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false --testPathPattern "Analysis/Chiasmus|_Common"
```
Expected: all pass (audit baseline was green). If not, stop and report.

**Step 3: Start both servers in background**

```bash
cd backend && npm run dev            # wait for "bom-backend listening on :5006"
cd frontend/webapp && REACT_APP_LOCAL_BACKEND=true BROWSER=none PORT=3000 npm start
# poll: curl -sf http://localhost:3000 >/dev/null
```

**Step 4: Create the verify harness** at `<scratchpad>/verify.js` (NOT in the repo):

```js
const { chromium } = require('playwright-core'); // npm i playwright-core in scratchpad
const EXE = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
module.exports.run = async (fn, vp = { width: 1440, height: 900 }, opts = {}) => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await (await browser.newContext({ viewport: vp, ...opts })).newPage();
  await page.goto('http://localhost:3000/analysis/chiasmus');
  await page.waitForSelector('.chiasmus_list .chiasmus', { timeout: 60000 });
  try { return await fn(page); } finally { await browser.close(); }
};
```

No commit (nothing in-repo changed).

---

### Task 1: Bad deep link — never hang, centered spinner

Audit §2.2. Observed: `/analysis/chiasmus/<unknown-id>` spins ≥12s with no error; statically every path in `fetchChiasm`/`Chiasm` should reach the error state, so the root cause is undiagnosed — this task diagnoses live, then hardens regardless.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasm.js` (fetch effect ~line 96, loading render ~line 137)
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css` (`.chiasm .loadBar` ~line 518)
- Test: `frontend/webapp/src/views/Analysis/Chiasmus/__tests__/fetchChiasm.test.js`, `__tests__/Chiasm.test.js`

**Step 1: Write failing/characterizing tests**

In `fetchChiasm.test.js` (follow the existing `jest.mock("src/models/BoMOnlineAPI", …)` pattern in that file):

```js
test("resolves undefined when the id is not in the result", async () => {
  BoMOnlineAPI.mockResolvedValueOnce({ chiasm: {} });
  await expect(fetchChiasm("nonexistent999")).resolves.toBeUndefined();
});
test("resolves undefined when the API returns an error object", async () => {
  BoMOnlineAPI.mockResolvedValueOnce({ error: { data: null } });
  await expect(fetchChiasm("nonexistent999")).resolves.toBeUndefined();
});
```

In `Chiasm.test.js`:

```js
test("shows the error state when the fetch resolves empty", async () => {
  BoMOnlineAPI.mockResolvedValueOnce({ chiasm: {} });
  renderChiasm();
  expect(await screen.findByText(/couldn't load this chiasm/i)).toBeInTheDocument();
});
test("times out to the error state if the fetch never settles", async () => {
  jest.useFakeTimers();
  BoMOnlineAPI.mockReturnValueOnce(new Promise(() => {})); // never resolves
  renderChiasm();
  act(() => { jest.advanceTimersByTime(16000); });
  expect(await screen.findByText(/couldn't load this chiasm/i)).toBeInTheDocument();
  jest.useRealTimers();
});
```

**Step 2: Run — expect the timeout test to FAIL** (no timeout exists). The first two may pass; keep them as regression pins.

```bash
CI=true npx react-scripts test --watchAll=false --testPathPattern "fetchChiasm|Chiasm.test"
```

**Step 3: Implement**

In `Chiasm.js`, fetch effect:

```js
useEffect(() => {
    let cancelled = false;
    setChiasm(null);
    setPinnedScheme(null);
    setCopied(false);
    // Belt-and-braces: whatever stalls upstream, the panel must not spin forever
    const failsafe = setTimeout(() => {
        if (!cancelled) setChiasm((c) => (c === null ? undefined : c));
    }, 15000);
    fetchChiasm(chiasm_id).then((c) => {
        if (!cancelled) setChiasm(c);           // c === undefined → error state
    }).catch((e) => {
        console.error(e);
        if (!cancelled) setChiasm(undefined);
    });
    return () => { cancelled = true; clearTimeout(failsafe); };
}, [chiasm_id]);
```

Loading render: `if (!chiasm) return <div className="chiasm loading"><Spinner/></div>`

In `Chiasmus.css`: delete the block
```css
.chiasm .loadBar{ position: relative; margin-top: -10rem; }
```
and add:
```css
.chiasm.loading { display: flex; justify-content: center; padding: 4rem 0; }
```

**Step 4: Run tests — all pass.**

**Step 5: Live diagnosis of the actual hang.** With servers up, run via harness:

```js
run(async (page) => {
  const responses = [];
  page.on('response', r => { if (r.url().includes('/en')) responses.push(r.status()); });
  await page.goto('http://localhost:3000/analysis/chiasmus/nonexistent999');
  await page.waitForTimeout(8000);
  console.log('gql statuses:', responses);
  console.log('panel:', await page.evaluate(() => document.querySelector('.chiasmPanel')?.innerHTML?.slice(0, 400)));
});
```

- If the error state now shows within 15s, the failsafe covers it — note what the network log showed in the commit message.
- If the network response reveals a backend 500/hang for unknown ids, file it: append the finding to the audit §2.2 and fix only if it's a one-liner in `backend/src/graphql/resolvers/scriptureextras.ts`; otherwise it's out of scope for this frontend plan.

**Step 6: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Chiasmus
git commit -m "fix(chiasmus): bad-id detail fetch resolves to error state, 15s failsafe, centered spinner"
```

---

### Task 2: URL as source of truth — Back closes the panel

Audit §7.2, §2.1 (the Back-gesture half), §6.6 (`document.title` reset). Today `chiasmus_id` is React state seeded once from the URL, every open is `history.replace`, and `Chiasm.js` separately replaces the URL. After this task: the route param IS the open chiasm; opening from closed **pushes** one entry; prev/next/arrows **replace**; Back and Escape both land on `/analysis/chiasmus` with browse state intact.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.js` (`Container`, ~lines 236–348)
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasm.js` (delete the URL-replace effect, ~lines 115–120; drop the now-unused `useHistory` import)
- Test: create `frontend/webapp/src/views/Analysis/Chiasmus/__tests__/Container.test.js`

**Step 1: Write the failing test**

```js
jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true, default: jest.fn(), assetUrl: "https://media.test", ApiBaseUrl: "",
}));
jest.mock("../../../Home/tiles/ScripturePopup", () => ({
  __esModule: true, default: () => null, openScripture: jest.fn(),
}));

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { Router, Route } from "react-router-dom";
import { createMemoryHistory } from "history";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import Container from "../Chiasmus";
import { __clearChiasmCache } from "../Chiasm";

const LIST = [
  { chiasmus_id: "x1", title: "First Chiasm", reference: "1 Nephi 1:1-3", scheme: "ABBA", verse_id: 31103 },
  { chiasmus_id: "x2", title: "Second Chiasm", reference: "1 Nephi 2:2-4", scheme: "ABA", verse_id: 31120 },
];
const DETAIL = (id) => ({ chiasmus_id: id, title: `Detail ${id}`, reference: "1 Nephi 1:1-3", scheme: "ABBA",
  lines: [{ line_key: "A", label: "1", line_text: "alpha", highlights: "[]" }] });

beforeEach(() => {
  __clearChiasmCache();
  BoMOnlineAPI.mockImplementation((input) =>
    input.chiasmus ? Promise.resolve({ chiasmus: LIST })
    : input.chiasm ? Promise.resolve({ chiasm: { [input.chiasm[0]]: DETAIL(input.chiasm[0]) } })
    : Promise.resolve({}));
});

const renderAt = (path) => {
  const history = createMemoryHistory({ initialEntries: [path] });
  render(<Router history={history}><Route path="/analysis/:value*"><Container/></Route></Router>);
  return history;
};

test("opening a chiasm pushes one entry; Back closes the panel", async () => {
  const history = renderAt("/analysis/chiasmus");
  fireEvent.click(await screen.findByRole("button", { name: /first chiasm/i }));
  expect(await screen.findByText("Detail x1")).toBeInTheDocument();
  expect(history.location.pathname).toBe("/analysis/chiasmus/x1");
  expect(history.length).toBe(2);
  act(() => history.goBack());
  expect(history.location.pathname).toBe("/analysis/chiasmus");
  expect(screen.queryByText("Detail x1")).not.toBeInTheDocument();
});

test("switching chiasms while open replaces instead of pushing", async () => {
  const history = renderAt("/analysis/chiasmus");
  fireEvent.click(await screen.findByRole("button", { name: /first chiasm/i }));
  await screen.findByText("Detail x1");
  fireEvent.click(screen.getByRole("button", { name: /second chiasm/i }));
  await screen.findByText("Detail x2");
  expect(history.location.pathname).toBe("/analysis/chiasmus/x2");
  expect(history.length).toBe(2); // still one pushed entry
});

test("browse query string survives open and close", async () => {
  const history = renderAt("/analysis/chiasmus?group=speaker");
  fireEvent.click(await screen.findByRole("button", { name: /first chiasm/i }));
  expect(history.location.search).toBe("?group=speaker");
  act(() => history.goBack());
  expect(history.location.search).toBe("?group=speaker");
});
```

Note: the route pattern must match the app's actual mount for `params.value` to be `"chiasmus/x1"` — check `App.js`/router for the real path (`/analysis/:value*` or similar) and mirror it exactly.

**Step 2: Run — expect FAIL** (history.length is 1 today because open replaces; Back doesn't close because state ignores URL).

**Step 3: Implement in `Container`:**

```js
function Container() {
    const [chiasmus, setChiasmus] = useState(null);
    const { params } = useRouteMatch();
    // URL is the source of truth for the open chiasm
    const chiasmus_id = params?.value?.split("/")[1] || null;
    const { replace, push } = useHistory();
    const lang = determineLanguage();

    const { state, set } = useBrowseState();
    const enriched = useMemo(() => enrichChiasmus(Array.isArray(chiasmus) ? chiasmus : [], lang), [chiasmus, lang]);
    const { flat, groups } = useMemo(() => applyBrowseState(enriched, state), [enriched, state]);

    const chiasmusIdRef = useRef(chiasmus_id);

    // First open from the index PUSHES (Back closes the panel);
    // prev/next/arrow browsing REPLACES (no history spam). Query string kept.
    const setChiasmusId = (id) => {
        const qs = window.location.search;
        if (!id) { replace("/analysis/chiasmus" + qs); return; }
        if (chiasmusIdRef.current) replace(`/analysis/chiasmus/${id}` + qs);
        else push(`/analysis/chiasmus/${id}` + qs);
    };
    const closeChiasm = () => setChiasmusId(null);
```

Keep the existing `chiasmusIdRef` effect (it also scrolls the active card) and the `flatRef`/`navigateChiasmus`/keydown code unchanged — they already read through refs, and `setChiasmusId` now only touches refs + stable history fns, so the mount-only listener stays correct. Delete the `useState(urlChiasmId || null)` pair.

Add the title-reset effect:

```js
useEffect(() => {
    if (!chiasmus_id) document.title = t("chiasms_doc_title", "Chiasmus") + " | " + label("home_title");
}, [chiasmus_id]);
```

(Change the fallback string from "Chiasms" to "Chiasmus" here and in the `Chiasmus` component's mount effect — audit §6.6 naming.)

In `Chiasm.js`: delete the whole `useEffect(() => { replace(…) }, [chiasm_id])` block and the `useHistory` import.

**Step 4: Run the new Container tests + the whole Chiasmus pattern.** `Chiasm.test.js` may have asserted the old replace behavior — if so, delete that assertion (URL is Container's job now). Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Chiasmus
git commit -m "feat(chiasmus): URL-driven detail panel — push on open so Back closes, replace while browsing"
```

---

### Task 3: Mobile overlay — visible, tappable close

Audit §2.1. The app's fixed top bar covers the overlay's first ~110px, hiding the sticky `.chiasm-header` (title + ×). `.navbar` is `position: fixed` (Main.css:49), paper-dashboard sets `z-index: 1029` (`_navbar.scss:78`); our overlay is 1050 yet loses — suspect a stacking context between `.main-panel` and the overlay. This task is probe-driven CSS.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css` (`@media (max-width: 800px)` block, ~line 525)

**Step 1: Probe the current failure** (servers up):

```js
run(async (page) => {
  await (await page.$('.chiasmus_list .chiasmus')).click();
  await page.waitForSelector('.chiasmPanel.open .chiasmus_line');
  return page.evaluate(() => {
    const btn = document.querySelector('.chiasm .close');
    const r = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { rect: r.toJSON(), covered: hit !== btn, coveredBy: hit?.className || hit?.tagName,
             coverZ: hit ? getComputedStyle(hit.closest('[style],*')).zIndex : null };
  });
}, { width: 390, height: 844 }, { isMobile: true, hasTouch: true });
```
Expected today: `covered: true` with the top-bar element named. Record `coveredBy`.

**Step 2: Fix.** First attempt — raise the overlay above the bar but below ScripturePopup (z 2000, which must stay on top for Read-in-context):

```css
@media (max-width: 800px) {
    .chiasmPanel.open {
        /* above the fixed app bar (navbar z1029 + whatever wrapper beat 1050),
           below ScripturePopup (2000) */
        z-index: 1900;
    }
}
```
Re-run the probe. If **still covered** (stacking-context ancestor), fall back to starting the overlay below the bar instead of over it:

```css
@media (max-width: 800px) {
    .chiasmPanel.open {
        top: 62px; /* measured app-bar height at mobile; verify with the probe:
                      document.querySelector('<coveredBy selector>').offsetHeight */
        height: auto;
        bottom: 0;
    }
}
```
(Use the actual measured height from Step 1's element, not a guess.)

**Step 3: Verify end-to-end on touch:** extend the probe — after the fix, `covered` must be `false`; then `await btn.tap()` (or `.click()`) and assert `page.waitForSelector('.chiasmPanel.closed', …)` — actually assert `document.querySelector('.chiasmPanel.open') === null` and URL is `/analysis/chiasmus`. Also `history.back()` after reopening → overlay closes (Task 2 behavior on mobile). Screenshot the open overlay for the record.

**Step 4: Also verify** desktop (1440) and dark mode are unaffected: run the harness at 1440, open/close a chiasm, screenshot, eyeball.

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css
git commit -m "fix(chiasmus): mobile overlay no longer hides its header/close under the app bar"
```

---

### Task 4: Toolbar comprehension + sticky toolbar + result count

Audit §4.1–4.4, §3.3 (toolbar scrolls away), §3.4 (result count). Restructure the toolbar into labeled zones, fix the chip format (value first: `4 · 60`, `8+ · 11`), make selected chips read as *selected* (accent, not gray), keep the toolbar fixed above the scrolling card area, and show "N of M shown".

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.js` (`BrowseToolbar` ~lines 15–141, `Chiasmus` render ~lines 208–231; export `BrowseToolbar` as a named export for tests)
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css` (toolbar/chip/scroll rules)
- Test: create `frontend/webapp/src/views/Analysis/Chiasmus/__tests__/BrowseToolbar.test.js`

**Step 1: Write the failing test**

```js
jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true, default: jest.fn(), assetUrl: "https://media.test", ApiBaseUrl: "",
}));
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { BrowseToolbar } from "../Chiasmus";
import { DEFAULTS } from "../useBrowseState";

const props = {
  state: { ...DEFAULTS }, set: jest.fn(),
  depthCounts: { 2: 145, 3: 91, "+": 11 },
  categoryCounts: { compound: 35, biblical: 28 },
  shownCount: 12, totalCount: 367,
};

test("selects carry visible Group/Sort labels", () => {
  render(<BrowseToolbar {...props} />);
  expect(screen.getByLabelText(/group/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^sort/i)).toBeInTheDocument();
  expect(screen.getByText("Group")).toBeVisible();
  expect(screen.getByText("Sort")).toBeVisible();
});

test("depth chips read value-first with a Levels caption, and bucket + renders as 8+", () => {
  render(<BrowseToolbar {...props} />);
  expect(screen.getByText(/levels/i)).toBeVisible();
  const chip = screen.getByRole("button", { name: /depth 2 — 145 chiasms/i });
  expect(chip.textContent).toMatch(/^2/);          // value before count
  expect(screen.getByRole("button", { name: /depth 8\+ — 11 chiasms/i })).toBeInTheDocument();
});

test("shows the result count", () => {
  render(<BrowseToolbar {...props} />);
  expect(screen.getByText(/12 of 367/i)).toBeVisible();
});
```

**Step 2: Run — expect FAIL** (no labels, count-first chips, no result line).

**Step 3: Implement.** New `BrowseToolbar` return (search-debounce plumbing above it is unchanged):

```jsx
const displayDepth = (d) => (d === "+" ? "8+" : d);

return (
    <div className="browse_toolbar">
        <div className="toolbar_controls">
            <input type="search" className="browse_search"
                placeholder={t("search_chiasms", "Search chiasms…")}
                aria-label={t("search_chiasms", "Search chiasms…")}
                value={q} onChange={onSearchChange} />
            <label className="toolbar_field">{t("group_by", "Group")}
                <select value={state.group} onChange={(e) => set({ group: e.target.value })}>
                    {/* options unchanged */}
                </select>
            </label>
            <label className="toolbar_field">{t("sort_by", "Sort")}
                <select value={state.sort} onChange={(e) => set({ sort: e.target.value })}>
                    {/* options unchanged */}
                </select>
            </label>
            <button type="button" className="dir_button"
                aria-pressed={state.dir === "desc"}
                title={t("sort_direction", "Reverse sort direction")}
                aria-label={t("sort_direction", "Reverse sort direction")}
                onClick={() => set({ dir: state.dir === "asc" ? "desc" : "asc" })}>
                {state.dir === "asc" ? "↓" : "↑"}
            </button>
            <span className="browse_count">
                {t("results_shown", "$1 of $2 shown", [shownCount, totalCount])}
            </span>
        </div>
        <div className="toolbar_chips">
            <span className="chip_caption">{t("levels", "Levels")}</span>
            {depthKeys.map((d) => { /* selected as before */ return (
                <button key={d} type="button"
                    className={`chip depth_chip${selected ? " selected" : ""}`}
                    aria-pressed={selected}
                    aria-label={t("depth_chip_label", "Depth $1 — $2 chiasms", [displayDepth(d), depthCounts[d]])}
                    onClick={() => toggleDepth(d)}>
                    {displayDepth(d)}<span className="chip_count" aria-hidden="true">· {depthCounts[d]}</span>
                </button>
            );})}
            <span className="chip_divider" aria-hidden="true" />
            {typeChips.map(([value, chipLabel, count]) => ( /* as before, but: */
                <button /* … */>
                    {chipLabel}{count != null && <span className="chip_count" aria-hidden="true">· {count}</span>}
                </button>
            ))}
        </div>
    </div>
);
```

Function signature: `function BrowseToolbar({ state, set, depthCounts, categoryCounts, shownCount, totalCount })`; add `export { BrowseToolbar };` at the bottom of the file. `Chiasmus` passes `shownCount={flat.length} totalCount={enriched.length}`.

**Sticky toolbar** — split the scroll container in `Chiasmus`'s return:

```jsx
return <div className="chiasmIndexPanel noselect">
    <BrowseToolbar … />
    <div className="chiasmIndexScroll">
        {/* the existing empty-state / groups / flat card markup moves here unchanged */}
    </div>
</div>;
```

CSS — replace the `.chiasmIndexPanel` rule and add the new pieces (one shared height for both panels kills the audit's mismatched magic numbers):

```css
.innerChiasmContainer { --panel-viewport-offset: 10.5rem; }

.chiasmIndexPanel {
    width: 100%; flex-grow: 1; min-width: 0;
    display: flex; flex-direction: column;
    max-height: calc(100vh - var(--panel-viewport-offset));
    overflow: hidden;
}
.chiasmIndexScroll { overflow: auto; flex: 1; }
.chiasmPanel { height: calc(100vh - var(--panel-viewport-offset)); }

.browse_toolbar { display: flex; flex-direction: column; gap: .5ex; margin: 1ex 0; }
.toolbar_controls, .toolbar_chips { display: flex; flex-wrap: wrap; gap: 1ex; align-items: center; }
.toolbar_field { display: flex; gap: .6ex; align-items: center; font-size: .85rem; color: var(--text-muted); }
.chip_caption { font-size: .8rem; color: var(--text-muted); }
.chip_divider { width: 1px; align-self: stretch; background: var(--border); }
.browse_count { margin-left: auto; font-size: .8rem; color: var(--text-muted); }
.chip .chip_count { font-size: .75em; margin-left: .5ex; margin-right: 0; }
.chip.selected { background: var(--link); color: var(--surface-0); border-color: var(--link); }

@media (max-width: 800px) {
    /* chips scroll sideways instead of stacking four rows (audit §3.1) */
    .toolbar_chips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: .5ex; }
}
```

Delete the old `.chip .chip_count { margin-right: .5ex }` rule and old `.chip.selected` (gray) rule. Group headers keep `top: 0` — they now stick inside `.chiasmIndexScroll`, below the always-visible toolbar.

Note on `--link` as selected color: light `#345496` + white text ≈ 7.6:1, dark `#a8c7fa` + `--surface-0` (#1a1a1a) ≈ 9:1 — both AA; no new palette work needed (@dataviz not required, tokens already validated).

**Step 4: Run tests** (new + existing — `useBrowseState.test.js` and `Chiasm.test.js` untouched). Expected: PASS.

**Step 5: Visual verify:** harness at 1440 — screenshot; scroll `.chiasmIndexScroll` down 1500px and confirm the toolbar is still visible above the cards and a sticky book header sits directly under it. At 390 — chips are one scrollable row; count line visible. Eyeball both screenshots.

**Step 6: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Chiasmus
git commit -m "feat(chiasmus): labeled toolbar zones, value-first chips, accent selection, sticky toolbar, result count"
```

---

### Task 5: Panel min-width at mid viewports

Audit §3.2 — 801–1100px gives a ~300px detail column.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css` (`.chiasmPanel.open`, ~line 395)

**Step 1: Implement**

```css
.chiasmPanel.open {
    width: 40%;
    min-width: 26rem;   /* ≥416px of readable column at any two-pane width */
    flex-shrink: 0;
}
```
(`.chiasmIndexPanel` already got `min-width: 0` in Task 4 so it can absorb the shrink.)

**Step 2: Verify** with the harness at `{width: 900, height: 800}` and `{width: 1100, height: 800}`: open the first card, screenshot both. The panel must be ≥416px (`page.evaluate(() => document.querySelector('.chiasmPanel.open').offsetWidth)`), the title unwrapped or 2 lines max, and the index showing 1–2 readable columns. Compare against audit shots `25-1100px-panel-open.png` / `18-tablet-900-detail.png`.

**Step 3: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css
git commit -m "fix(chiasmus): detail panel min-width so 800-1100px viewports stay readable"
```

---

### Task 6: Header diet + breadcrumb

Audit §3.1, §7.1, §9 (`lg-4`). Shrink the display title, surface the total count, add an "Analysis ›" breadcrumb usable by all four Analysis sub-views.

**Files:**
- Create: `frontend/webapp/src/views/Analysis/AnalysisBreadcrumb.js`
- Modify: `frontend/webapp/src/views/Analysis/Analysis.css` (breadcrumb styles)
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.js` (`Container` return, ~line 341)
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css`
- Test: create `frontend/webapp/src/views/Analysis/__tests__/AnalysisBreadcrumb.test.js`

**Step 1: Write the failing test**

```js
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AnalysisBreadcrumb from "../AnalysisBreadcrumb";

test("links back to the analysis hub and names the current view", () => {
  render(<MemoryRouter><AnalysisBreadcrumb>Chiasmus</AnalysisBreadcrumb></MemoryRouter>);
  expect(screen.getByRole("link", { name: /analysis/i })).toHaveAttribute("href", "/analysis");
  expect(screen.getByText("Chiasmus")).toBeInTheDocument();
});
```

**Step 2: Run — FAIL (module not found).**

**Step 3: Implement**

`AnalysisBreadcrumb.js`:
```jsx
import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";

// label() returns the raw key (or " ") when the dictionary lacks it
const hubName = () => {
    const v = label("menu_analysis");
    return v && v !== " " && v !== "menu_analysis" ? v : "Analysis";
};

export default function AnalysisBreadcrumb({ children }) {
    return (
        <nav className="analysis-breadcrumb" aria-label="Breadcrumb">
            <Link to="/analysis">{hubName()}</Link>
            <span aria-hidden="true"> › </span>
            <span className="current">{children}</span>
        </nav>
    );
}
```

`Analysis.css` append:
```css
.analysis-breadcrumb { font-size: .85rem; color: var(--text-muted); margin: .5rem 0 0; }
.analysis-breadcrumb a { color: var(--link); }
.analysis-breadcrumb .current { color: var(--text-secondary); }
```

`Container` return — replace the `h3` line:
```jsx
return <div className="container">
    <AnalysisBreadcrumb>{t("chiasmus_page_title_short", "Chiasmus")}</AnalysisBreadcrumb>
    <h3 className="title chiasmus_title">
        {t("chiasmus_page_title", "Chiasmus in the Book of Mormon")}
        {enriched.length > 0 && <span className="total_count">{enriched.length}</span>}
    </h3>
    <div className="innerChiasmContainer">…</div>
</div>;
```
(imports: `import AnalysisBreadcrumb from "../AnalysisBreadcrumb";`. The bogus `lg-4` class is gone with the rewrite. `text-center` is dropped deliberately — left-aligned with the breadcrumb.)

`Chiasmus.css`:
```css
.chiasmus_title { font-size: 1.5rem; margin: .25rem 0 .75rem; }
.chiasmus_title .total_count { font-size: .8em; font-weight: 400; color: var(--text-muted); margin-left: 1ex; }
@media (max-width: 800px) { .chiasmus_title { font-size: 1.2rem; } }
```
Then re-tune `--panel-viewport-offset` (Task 4's var): measure in the harness — first card row should start ≈120–150px from the top at 1440 and the index bottom should reach the viewport bottom minus ~1rem. Adjust the rem value until both hold.

**Step 4: Run tests, then visual verify** at 1440 and 390 (phone: title one line, cards above the fold — compare `15-mobile-index.png`). Expected: PASS + visibly denser header.

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/Analysis
git commit -m "feat(analysis): breadcrumb to hub; chiasmus header diet with total count"
```

---

### Task 7: Prev/Next in the panel header + arrow-key hint

Audit §6.1 — nav only at the bottom of a 7,000px panel; arrow keys undiscoverable.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasm.js` (header JSX, ~lines 152–162)
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css`
- Test: `frontend/webapp/src/views/Analysis/Chiasmus/__tests__/Chiasm.test.js`

**Step 1: Write the failing test**

```js
test("header has prev/next that follow visible order and hint at arrow keys", async () => {
  BoMOnlineAPI.mockResolvedValue({ chiasm: { x1: fixture } });
  const setChiasmusId = jest.fn();
  render(<MemoryRouter><Chiasm chiasm_id="x1" setChiasmusId={setChiasmusId}
      closeChiasm={jest.fn()} nextId="x2" prevId={null}/></MemoryRouter>);
  await screen.findByText("Test Chiasm");
  const header = document.querySelector(".chiasm-header");
  const next = within(header).getByRole("button", { name: /next/i });
  expect(within(header).getByRole("button", { name: /previous/i })).toBeDisabled();
  expect(next.title).toMatch(/→/);
  fireEvent.click(next);
  expect(setChiasmusId).toHaveBeenCalledWith("x2");
});
```
(add `within` to the testing-library import.)

**Step 2: Run — FAIL.**

**Step 3: Implement** — in the header, before the close button:

```jsx
<div className="chiasm-header">
    <ChiasmGlyph … />
    <div className="chiasm-titles">…</div>
    <div className="chiasm-header-nav noselect">
        <button type="button" disabled={!prevId}
            aria-label={t("previous", "Previous")}
            title={t("prev_hint", "Previous chiasm (← arrow key)")}
            onClick={() => setChiasmusId(prevId)}>‹</button>
        <button type="button" disabled={!nextId}
            aria-label={t("next", "Next")}
            title={t("next_hint", "Next chiasm (→ arrow key)")}
            onClick={() => setChiasmusId(nextId)}>›</button>
        <button type="button" className="close" aria-label={t("close", "Close")}
            title={t("close_hint", "Close (Esc)")} onClick={closeChiasm}>×</button>
    </div>
</div>
```

CSS:
```css
.chiasm-header-nav { display: flex; gap: .5ex; align-items: center; }
.chiasm-header-nav button {
    background: var(--control); border: 1px solid var(--border); border-radius: .5ex;
    color: var(--text-secondary); font-size: 1.1rem; line-height: 1;
    padding: .3ex 1.2ex; cursor: pointer; min-width: 2rem;
}
.chiasm-header-nav button:disabled { opacity: .4; cursor: default; }
.chiasm-header-nav button:hover:not(:disabled) { background: var(--control-hover); color: var(--text-primary); }
.chiasm-header-nav .close { border: 0; background: none; font-size: 1.5rem; padding: 0 .5ex; }
```
Remove the old standalone `.chiasm .close { float: right; … }` float rule (the button now lives in the flex row); keep the bottom `.chiasmus_nav` as-is (long-scroll convenience). The existing mobile sticky-header rule now keeps prev/next/close reachable while scrolling — verify.

**Step 4: Run tests — PASS. Visual verify** on desktop + mobile (sticky header shows ‹ › × at top while scrolled mid-chiasm).

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Chiasmus
git commit -m "feat(chiasmus): prev/next + close in sticky detail header with keyboard hints"
```

---### Task 8: Legends — "how to read" + rail color key

Audit §6.3, §8.1.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasm.js` (after `.chiasm-actions`)
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.js` (`Chiasmus` component, between toolbar and scroll area)
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css`
- Test: `__tests__/Chiasm.test.js`, `__tests__/BrowseToolbar.test.js` (or a small new `RailLegend` test in `Container.test.js`)

**Step 1: Failing tests**

```js
// Chiasm.test.js
test("renders a collapsed how-to explainer", async () => {
  BoMOnlineAPI.mockResolvedValue({ chiasm: { x1: fixture } });
  renderChiasm();
  await screen.findByText("Test Chiasm");
  const details = screen.getByText(/how to read a chiasm/i).closest("details");
  expect(details).not.toHaveAttribute("open");
  expect(details).toHaveTextContent(/pivot/i);
});
```
```js
// Container.test.js
test("rail legend shows when grouped by book, hidden otherwise", async () => {
  const history = renderAt("/analysis/chiasmus");           // default group=book
  await screen.findByRole("button", { name: /first chiasm/i });
  expect(screen.getByText(/small plates/i)).toBeInTheDocument();
  act(() => history.replace("/analysis/chiasmus?group=speaker"));
  expect(screen.queryByText(/small plates/i)).not.toBeInTheDocument();
});
```

**Step 2: Run — FAIL.**

**Step 3: Implement**

`Chiasm.js`, after the actions row:
```jsx
<details className="chiasm-help noselect">
    <summary>{t("chiasm_help_title", "How to read a chiasm")}</summary>
    <p>{t("chiasm_help_body",
        "A chiasm mirrors its ideas around a center: matching letters (A, B, C…) mark paired, mirrored statements, and the amber line is the pivot — the idea the passage turns on. Hover or tap a letter badge to highlight its pair; click the badge to pin the pair.")}</p>
</details>
```

`Chiasmus.js` — add a small component and render it inside the index panel when `state.group === "book"`:
```jsx
const RAIL_LEGEND = [
    ["small-plates", "Small Plates (1 Nephi–Omni)"],
    ["abridgment", "Abridgment (Mosiah–Helaman)"],
    ["ministry", "Ministry (3–4 Nephi)"],
    ["mormon", "Mormon"],
    ["ether", "Ether"],
    ["moroni", "Moroni"],
];
function RailLegend() {
    return <div className="rail_legend noselect">
        {RAIL_LEGEND.map(([slug, name]) => (
            <span key={slug} className={`legend_item rail-${slug}`}>
                <span className="legend_dot" aria-hidden="true" />{t(`rail_${slug.replace("-","_")}`, name)}
            </span>
        ))}
    </div>;
}
// in Chiasmus's return, directly after <BrowseToolbar …/>:
{state.group === "book" && <RailLegend />}
```

CSS:
```css
.chiasm-help { margin: 0 0 1ex; font-size: .85rem; color: var(--text-muted); }
.chiasm-help summary { cursor: pointer; }
.chiasm-help p { margin: .5ex 0 0; color: var(--text-secondary); max-width: 34rem; }

.rail_legend { display: flex; flex-wrap: wrap; gap: 1ex 2ex; font-size: .75rem; color: var(--text-muted); margin: 0 1ex .5ex; }
.legend_item { display: inline-flex; align-items: center; gap: .6ex; }
.legend_dot { width: .8em; height: .8em; border-radius: 50%; background: var(--rail-color, var(--border)); }
@media (max-width: 800px) { .rail_legend { flex-wrap: nowrap; overflow-x: auto; } }
```
(`rail-*` classes already set `--rail-color` for both themes — no new colors introduced.)

**Step 4: Run tests — PASS. Visual verify** light + dark (legend dots must show the re-stepped dark rail hues).

**Step 5: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Chiasmus
git commit -m "feat(chiasmus): how-to explainer in detail panel + book-group rail legend"
```

---

### Task 9: Glyph degradation — compact long schemes, no all-amber depth-1

Audit §5.2.

**Files:**
- Modify: `frontend/webapp/src/views/_Common/ChiasmGlyph.js` (`glyphBars`)
- Test: `frontend/webapp/src/views/_Common/__tests__/ChiasmGlyph.test.js` (exists — extend)

**Step 1: Failing tests** (append to the existing suite, matching its import style):

```js
test("schemes over 16 entries compact to de-duplicated majors", () => {
  const scheme = "AaAbAcBaBbCaCbDaDbDcCcBcAd".slice(0, 26); // 26 entries, majors AABBCCDDCBA-ish
  const bars = glyphBars(scheme);
  expect(bars.length).toBeLessThanOrEqual(16);
  // compact bars are whole-number indents (majors only)
  bars.forEach((b) => expect(Number.isInteger(b.indent)).toBe(true));
});

test("compact mode ignores lineLengths (uniform widths)", () => {
  const scheme = "A".repeat(9) + "B".repeat(9); // 18 majors → compacts to AB
  const bars = glyphBars(scheme, Array(18).fill(5));
  expect(bars.map((b) => b.widthFactor)).toEqual(bars.map(() => 1));
});

test("depth-1 schemes get no pivot accent", () => {
  expect(glyphBars("AAAA").every((b) => !b.isPivot)).toBe(true);
});
```

**Step 2: Run — FAIL** (`--testPathPattern "_Common"`).

**Step 3: Implement** in `glyphBars`:

```js
export function glyphBars(scheme, lineLengths) {
  let chars = (scheme || "").split("");
  if (!chars.length) return [];
  // Long schemes render as sub-2px blobs at card size (audit 2026-07-17 §5.2):
  // compact to the major-letter silhouette, collapsing consecutive repeats.
  const compact = chars.length > 16;
  if (compact) {
    chars = chars.filter((c) => /[A-Z]/.test(c)).filter((c, i, arr) => c !== arr[i - 1]);
  }
  let currentMajor = 0;
  const bars = chars.map((ch) => {
    const isMajor = /[A-Z]/.test(ch);
    if (isMajor) currentMajor = ch.charCodeAt(0) - 65;
    return { indent: isMajor ? currentMajor : currentMajor + 0.5, widthFactor: 1, isPivot: false };
  });
  const maxMajor = Math.max(...bars.map((b) => Math.floor(b.indent)));
  // depth-1: everything would be "the pivot" — an all-amber glyph reads as an error
  if (maxMajor > 0) bars.forEach((b) => { b.isPivot = Math.floor(b.indent) === maxMajor; });
  if (!compact && Array.isArray(lineLengths) && lineLengths.length === bars.length) {
    /* existing tertile block unchanged */
  }
  return bars;
}
```
(A perfect deep mirror like `ABCDEFGHIHGFEDCBA` still yields 17 bars after dedupe — acceptable, they're all majors and stay legible.)

**Step 4: Run `_Common` tests — all pass** (existing tertile/pivot tests must stay green). Then run the Chiasmus pattern too (cards use `glyphBars`).

**Step 5: Visual verify:** harness — search "1 Nephi 1:15" (the 30-line compound) and screenshot its card: the glyph must show a discernible staircase, not a slab. Check the depth-1 card (`3 Nephi 6:2`, group by depth → Level 1): all-gray glyph.

**Step 6: Commit**

```bash
git add frontend/webapp/src/views/_Common
git commit -m "fix(glyph): compact long schemes to major silhouette; no pivot accent at depth 1"
```

---

### Task 10: Pair-highlight visibility + distinct pin accent

Audit §6.2, §8.2. Replace the `#FFFF0022` wash with the `--highlight` token (both themes theme it: `#fff3b0` light / `#55502a` dark) and move pinning off amber (amber = pivot only) onto `--link`.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css` (~lines 315–324, 363–368, 213–216)
- Modify: `frontend/webapp/src/assets/theme/scss/darkmode/_analysis.scss` (~lines 18–19 — the rgba wash overrides become redundant)

**Step 1: Implement** (CSS-only; the render test net is Chiasm.test's existing class assertions — run them after):

`Chiasmus.css`:
```css
.chiasmus_line.active .highlight {
    font-weight: 500;
    color: var(--text-primary);
    background-color: var(--highlight);
    padding-left: 1ex; padding-right: 1ex; margin-left: -1ex; margin-right: -1ex;
}
.chiasmus_line.active .scheme {
    background-color: var(--highlight);
    color: var(--text-primary);
    border: 1px solid var(--text-muted);
}
.chiasmus_line .scheme.pinned {
    outline: 2px solid var(--link);   /* was --accent-amber: amber means pivot, not selection */
    outline-offset: 1px;
}
```

`darkmode/_analysis.scss`: delete the two `rgba(255, 243, 176, 0.14)` override lines (the token now carries the dark value); keep the pivot-badge protection rule that follows them — re-read its comment and confirm it still outranks the new `.active .scheme` rule (it does: the themed selector adds specificity).

**Step 2: Run the Chiasmus test pattern** — expect PASS (no class names changed).

**Step 3: Visual verify** light + dark: open a chiasm, hover an outer line — the pair must be *obviously* marked now (compare `04-detail-hover-pair.png`). Pin a pair — blue ring on the badges, pivot stays amber. Screenshot both themes.

**Step 4: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css frontend/webapp/src/assets/theme/scss/darkmode/_analysis.scss
git commit -m "fix(chiasmus): real --highlight token for active pairs; pin accent moves to --link"
```

---

### Task 11: Card readability + group-header cleanup

Audit §5.1, §5.3–5.7, §4.6-adjacent i18n (§9). **Priority sub-goal: titles must actually be readable** — at `minmax(10rem, 1fr)` nearly every title truncates ("Record of Kn…", "Divine Deliv…"), making the card's primary text useless. Fix = wider minimum columns + two-line clamp + tooltip fallback. Plus: contextual speaker display, avatar `onError`, ellipsized reference pill with tooltip, `(n)` group counts, `8+` card chip, calmer active/hover outlines, translated depth/type group headers.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.js` (`ChiasmCard`, `Chiasmus` group render)
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/chiasmUtils.js` (`applyBrowseState` depth keyFn + new `groupLabel`)
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasmus.css`
- Test: `__tests__/chiasmUtils.test.js`, `__tests__/Container.test.js`

**Step 1: Failing tests**

```js
// chiasmUtils.test.js
import { groupLabel } from "../chiasmUtils"; // add to existing imports
test("depth groups key by raw bucket and label via groupLabel", () => {
  const { groups } = applyBrowseState(enrich([{ scheme: "ABCBA", reference: "Alma 36:1" }]), { ...DEFAULTS, group: "depth" });
  expect(groups[0].key).toBe("3");                       // raw bucket, not "Level 3"
  expect(groupLabel("3", "depth")).toBe("Level 3");
  expect(groupLabel("+", "depth")).toBe("Level 8+");
  expect(groupLabel("Simple", "type")).toBe("Simple");
  expect(groupLabel("Alma", "book")).toBe("Alma");
});
```
(Adapt `enrich`/`DEFAULTS` helpers to whatever the existing suite already uses.)

```js
// Container.test.js
test("speaker grouping drops the redundant per-card speaker line", async () => {
  // give LIST fixtures speaker: { name: "Nephi1", person_slug: "nephi1" }
  const history = renderAt("/analysis/chiasmus?group=speaker");
  await screen.findByRole("button", { name: /first chiasm/i });
  expect(screen.getByRole("heading", { name: /nephi/i })).toBeInTheDocument(); // group header
  expect(document.querySelectorAll(".speaker-name").length).toBe(0);           // not on cards
  expect(document.querySelectorAll(".speaker-avatar").length).toBe(0);
});
test("group headers show a parenthesized count", async () => {
  const history = renderAt("/analysis/chiasmus");
  await screen.findByRole("button", { name: /first chiasm/i });
  expect(screen.getByText("(2)")).toBeInTheDocument();
});
```

**Step 2: Run — FAIL.**

**Step 3: Implement**

`chiasmUtils.js`:
```js
import { t } from "./t";   // top of file

// applyBrowseState: depth keyFn + sorter change
depth: (c) => String(c.depthBucket),
…
} else if (s.group === "depth") {
    const levelRank = (k) => (k === "+" ? Infinity : Number(k));
    keys.sort((a, b) => levelRank(a) - levelRank(b));
}

// new export, used by the group-header render
export function groupLabel(key, group) {
  if (group === "depth") return t("group_level", "Level $1", [key === "+" ? "8+" : key]);
  if (group === "type") return t(`type_${key.toLowerCase()}`, key);
  return key;   // book & speaker keys are already display strings
}
```

`Chiasmus.js` — `ChiasmCard` gains `hideSpeaker`; title/pill tooltips; `8+` chip:
```jsx
const ChiasmCard = memo(function ChiasmCard({ chiasm, active, onSelect, hideSpeaker }) {
    const { chiasmus_id, reference, depthBucket, title, scheme, bookGroup } = chiasm;
    const depthLabel = depthBucket === "+" ? "8+" : depthBucket;
    return (
        <button type="button" onClick={() => onSelect(chiasmus_id)}
            className={`chiasmus rail-${bookGroup} ${active ? "active" : ""}`} aria-pressed={active}>
            <div className="card-head">
                {!hideSpeaker && chiasm.speaker?.person_slug && (
                    <img className="speaker-avatar" loading="lazy" width="36" height="36"
                        alt={chiasm.speakerName || ""}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                        src={`${assetUrl}/people/${chiasm.speaker.person_slug}`} />
                )}
                <div className="card-titles">
                    <div className="title" title={title || undefined}>{title || t("untitled_chiasm", "Untitled")}</div>
                    {!hideSpeaker && chiasm.speakerName && <div className="speaker-name">{chiasm.speakerName}</div>}
                </div>
                <span className="depth-chip" title={t("chiastic_depth", "Chiastic depth: $1 levels", [depthLabel])}>{depthLabel}</span>
            </div>
            <div className="card-body">
                <ChiasmGlyph scheme={scheme} lineLengths={chiasm.line_lengths} size={44}
                    title={t("chiasm_structure", "Structure: $1", [scheme])} />
                <span className="reference" title={reference}>{reference}</span>
            </div>
        </button>
    );
});
```
`cards()` passes `hideSpeaker={state.group === "speaker"}`. Group header render becomes:
```jsx
<h4 className="group-header">{groupLabel(group.key, state.group)} <span className="count">({group.items.length})</span></h4>
```
(import `groupLabel` alongside the other chiasmUtils imports.)

`Chiasmus.css`:
```css
/* Cards wide enough that titles actually fit (was 10rem — truncated ~everything) */
.chiasmus_list { grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); }

/* Titles: wrap to two lines, then ellipsis. Replaces the one-line cut. */
.card-titles .title {
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1.15;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.chiasmus .reference {
    /* existing props … */
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 100%; min-width: 0;
}
.chiasmus_list .chiasmus:hover { background-color: var(--surface-4); outline: 2px solid var(--border-strong); }
.chiasmus.active:hover, .chiasmus.active { outline: 2px solid var(--link); /* keep existing border-color lines */ }
```
(Replace the old 3px `--shadow` / `--text-primary` outlines — audit §5.7. The old `.card-titles .title` one-line rule is superseded by the clamp block above; delete it. Keep the mobile `1fr 1fr` / `1fr` overrides — they already give full-width cards.)

**Step 4: Run the full Chiasmus pattern — PASS** (fix any existing test that asserted `"Level 3"` group keys).

**Step 5: Visual + measured verify (readability gate):** with the harness at 1440 (panel closed), count clipped titles:

```js
run(async (page) => page.evaluate(() => {
  const titles = [...document.querySelectorAll('.card-titles .title')];
  const clipped = titles.filter((el) => el.scrollHeight > el.clientHeight + 1);
  return { total: titles.length, clipped: clipped.length,
           sample: clipped.slice(0, 5).map((el) => el.textContent) };
}));
```
Pass condition: **≤10% of visible titles clipped at 1440 with the panel closed**, and ≤25% with the panel open (narrower grid). If over, widen the minimum (16rem) or shrink the depth chip before moving on — do not ship with the wall of "Record of Kn…" cards. Also check 390px (single column: nothing should clip) and group-by-speaker (no per-card name/avatar under speaker headers), long-reference card shows `…`, active card ring is blue not black. Screenshot 1440 + 390 for the record.

**Step 6: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Chiasmus
git commit -m "feat(chiasmus): readable card titles (15rem grid + 2-line clamp), contextual speaker display, tooltips, (n) group counts, 8+ chips, accent selection ring, i18n group labels"
```

---

### Task 12: Slop sweep

Audit §9, §2.3.

**Files:**
- Modify: `frontend/webapp/src/views/Analysis/Chiasmus/Chiasm.js` (`ChiasticLine`, ~lines 61–68)
- Test: `__tests__/Container.test.js`

**Step 1: NaN margin fix** — in `ChiasticLine`, the minor indent is computed even for major-only keys (`charCodeAt(0)` of `""` → `NaN` → `marginLeft: "NaNex"`, currently masked by the conditional render). Make it conditional:

```js
const minorCSS = lowerCaseLetter
    ? { marginLeft: `${(lowerCaseLetter.replace(/[αβγδ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 848)).charCodeAt(0) - 97) * 1.5}ex` }
    : undefined;
```

**Step 2: Duplicate-key canary** (audit §2.3 — intermittent warning, source unknown). Add to `Container.test.js`:

```js
test("browsing produces no duplicate-key warnings", async () => {
  const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  const history = renderAt("/analysis/chiasmus");
  fireEvent.click(await screen.findByRole("button", { name: /first chiasm/i }));
  await screen.findByText("Detail x1");
  act(() => history.replace("/analysis/chiasmus?group=depth"));
  act(() => history.replace("/analysis/chiasmus?group=speaker"));
  const keyWarnings = errSpy.mock.calls.filter((c) => String(c[0]).includes("same key"));
  errSpy.mockRestore();
  expect(keyWarnings).toEqual([]);
});
```
If this test FAILS, the canary caught the audit's intermittent warning — fix the offending key before proceeding (likely candidates: a group key colliding across sections, or a non-unique `key` in a view outside this one; follow the component named in the warning). If it passes, keep it as a tripwire.

**Step 3: Run the Chiasmus pattern — PASS.**

**Step 4: Commit**

```bash
git add frontend/webapp/src/views/Analysis/Chiasmus
git commit -m "chore(chiasmus): conditional minor-indent computation; duplicate-key canary test"
```

---

### Task 13: Full verification sweep

**REQUIRED SUB-SKILL:** @superpowers:verification-before-completion — run everything, look at everything, before claiming done.

**Step 1: Full frontend test run**

```bash
cd frontend/webapp && CI=true npx react-scripts test --watchAll=false
```
Expected: green (note any pre-existing failures unrelated to Chiasmus by name).

**Step 2: Screenshot sweep** — re-run the audit's full harness (`shoot.js` flow) against localhost:3000 and **eyeball every frame** against the round-2 findings:

| Check | Pass condition |
|---|---|
| 1440 index | toolbar labeled + count line; legend row; header ≤150px tall; ≤10% card titles clipped (Task 11 probe) |
| 1440 scrolled | toolbar still visible, sticky book header beneath it |
| 1440 detail open | header ‹ › ×; help `<details>`; visible pair highlight on hover |
| 900 + 1100 detail | panel ≥416px, no word-per-line wrap |
| 390 index | title 1 line, chips one scroll row, cards above the fold |
| 390 detail open | close button visible and tappable; Back closes overlay |
| dark index + detail | tokens intact, legend dots dark-variant, highlight visible |
| `/analysis/chiasmus/badid999` | error message ≤15s, no floating pill |

**Step 3: Update the audit doc** — append a status header to `docs/audits/2026-07-17-chiasmus-ux-audit-round-2.md` (mirroring the round-1 convention): which findings are fixed by this branch, which remain (deferred P2s: §3.4 sparse-state polish beyond the count line, §5.1 avatar-differs-from-group heuristic, §4.5 length-definition unification).

**Step 4: Stop the dev servers**, then commit docs and finish:

```bash
git add docs/
git commit -m "docs: chiasmus round-2 audit status after UX fixes"
```

**Step 5:** Use @superpowers:finishing-a-development-branch to decide merge/PR next steps with the user.
