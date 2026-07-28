# FilterPanel Design-System Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the triplicated People/Places/Matters filter UIs with one shared, controlled, config-driven `<FilterPanel>` that owns the axes, the `SearchPopUp` wiring, and the mobile-drawer path.

**Architecture:** A controlled component in `views/_Common/FilterPanel/`. It takes a `heading`, an `axes` config (`[{name, title, options:[{tag,label}]}]`), a normalized `value` (`{axisName: string[]}`), an `onChange(nextValue)`, and an optional `search` config. It owns toggle/select-all/clear (on arrays), the `SearchPopUp` `isOpen` + type-to-search, and the mobile `.filterDrawerButton` → `"pFilter"` popup path (with a live-update effect). Each view keeps its native state (letter-code string / `Set`) and its own list-filtering, converting at the boundary with a ~6-line adapter.

**Tech Stack:** React 17 hooks, reactstrap `Button`, `bootstrap-switch-button-react`, CRA Jest + React Testing Library 11. Helpers `isMobile`/`label` from `src/models/Utils`; `SearchPopUp` from `src/views/_Common/SearchPopUp`; `useAppController` from `src/contexts/AppControllerContext`. Module alias `src/*`.

**Working directory for all commands:** `/home/bom/BookofMormonOnline/frontend/webapp`
**Run one test file:** `CI=true npx react-scripts test <path> --watchAll=false`

---

## File Structure

**Create:**
- `src/views/_Common/FilterPanel/FilterPanel.jsx` — the component.
- `src/views/_Common/FilterPanel/FilterPanel.css` — relocated filter styles (same class names).
- `src/views/_Common/FilterPanel/FilterPanel.test.jsx` — behavior tests.
- `docs/reference/filter-panel.md` — API + adapter reference.

**Modify:**
- `src/views/People/People.js` — `PeopleFilters` → `<FilterPanel>` + adapter.
- `src/views/Places/Places.js` — `PlaceFilters` → `<FilterPanel>` + adapter.
- `src/views/Matters/MattersFilter.js` — `MattersFilter` → `<FilterPanel>` + adapter.
- `src/views/People/People.css` — remove relocated filter rules.

**Delete:**
- `src/views/People/PeoplePlacesFilter.js` — dead (imported nowhere).

**Key facts about the mobile path (from `views/_Common/Drawer.js`):** the `"pFilter"` popup renders `appController.popUpData.filterBox` (the `PFilter` drawer component returns `data.filterBox`). The panel opens it via `setPopUp({ type:"pFilter", ids:[user_id], underSlug, popUpData:{ filterBox } })`, and a `useEffect` re-pushes `popUpData` on selection change so the open drawer stays live (People does this today; Matters does not — folding it in fixes that).

---

## Task 1: Build `<FilterPanel>` (all behaviors, TDD)

**Files:**
- Create: `src/views/_Common/FilterPanel/FilterPanel.jsx`
- Create: `src/views/_Common/FilterPanel/FilterPanel.css` (stub now; filled in Task 2)
- Test: `src/views/_Common/FilterPanel/FilterPanel.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/views/_Common/FilterPanel/FilterPanel.test.jsx`:

```jsx
/* eslint-disable testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import FilterPanel from "./FilterPanel";
import { isMobile } from "src/models/Utils";

jest.mock("src/models/Utils", () => ({ label: (k) => k, isMobile: jest.fn(() => false) }));
jest.mock("src/views/_Common/SearchPopUp", () => ({
  SearchPopUp: (props) =>
    props.isOpen ? <div data-testid="searchpopup">{props.placeholder}:{props.initSearchString}</div> : null,
}));
jest.mock("bootstrap-switch-button-react", () => ({
  __esModule: true,
  default: ({ checked }) => <span data-testid="switch" data-checked={checked ? "1" : "0"} />,
}));
const mockSetPopUp = jest.fn();
const mockCtx = {
  states: { popUp: { type: null }, user: { social: { user_id: "u1" } } },
  functions: { setPopUp: mockSetPopUp },
  preLoad: {},
};
jest.mock("src/contexts/AppControllerContext", () => ({ useAppController: () => mockCtx }));

const AXES = [
  { name: "id", title: "Identification", options: [{ tag: "N", label: "Nephite" }, { tag: "J", label: "Jaredite" }] },
  { name: "unit", title: "Unit", options: [{ tag: "I", label: "Individual" }] },
];
const SEARCH = {
  placeholder: "search_for_a_person", preLoadData: [],
  testFieldNames: { primary: "name", secondary: "title" }, assetName: "people",
  selectItemHandler: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  isMobile.mockReturnValue(false);
  mockCtx.states.popUp.type = null;
});

describe("FilterPanel — trail/axes", () => {
  test("renders each axis title and its options", () => {
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} />);
    expect(screen.getByText("Identification")).toBeInTheDocument();
    expect(screen.getByText("Unit")).toBeInTheDocument();
    expect(screen.getByText("Nephite")).toBeInTheDocument();
    expect(screen.getByText("Individual")).toBeInTheDocument();
  });

  test("option checked-state reflects value[axis].includes(tag)", () => {
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: ["N"], unit: [] }} onChange={() => {}} />);
    const switches = screen.getAllByTestId("switch");
    // order: id→N, id→J, unit→I
    expect(switches[0]).toHaveAttribute("data-checked", "1");
    expect(switches[1]).toHaveAttribute("data-checked", "0");
    expect(switches[2]).toHaveAttribute("data-checked", "0");
  });

  test("clicking an unchecked option adds its tag; a checked one removes it", () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={onChange} />
    );
    fireEvent.click(screen.getByText("Nephite"));
    expect(onChange).toHaveBeenLastCalledWith({ id: ["N"], unit: [] });

    rerender(<FilterPanel heading="filters" axes={AXES} value={{ id: ["N"], unit: [] }} onChange={onChange} />);
    fireEvent.click(screen.getByText("Nephite"));
    expect(onChange).toHaveBeenLastCalledWith({ id: [], unit: [] });
  });

  test("select-all sets the axis to all tags; clear sets it to [] without touching other axes", () => {
    const onChange = jest.fn();
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: ["I"] }} onChange={onChange} />);
    fireEvent.click(screen.getAllByText("select_all")[0]); // first axis (id)
    expect(onChange).toHaveBeenLastCalledWith({ id: ["N", "J"], unit: ["I"] });
    fireEvent.click(screen.getAllByText("clear")[0]);
    expect(onChange).toHaveBeenLastCalledWith({ id: [], unit: ["I"] });
  });
});

describe("FilterPanel — search", () => {
  test("with search: 🔍 opens the SearchPopUp; without search: no button", () => {
    const { rerender } = render(
      <FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} search={SEARCH} />
    );
    expect(screen.queryByTestId("searchpopup")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "🔍" }));
    expect(screen.getByTestId("searchpopup")).toHaveTextContent("search_for_a_person");

    rerender(<FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "🔍" })).toBeNull();
  });

  test("type-to-search: a printable key opens the popup seeded with that key", () => {
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} search={SEARCH} />);
    fireEvent.keyDown(window, { key: "a" });
    expect(screen.getByTestId("searchpopup")).toHaveTextContent("search_for_a_person:a");
  });
});

describe("FilterPanel — mobile", () => {
  test("mobile renders the filter-drawer button, not the inline columns", () => {
    isMobile.mockReturnValue(true);
    const { container } = render(
      <FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} search={SEARCH} />
    );
    expect(container.querySelector(".filterDrawerButton")).toBeInTheDocument();
    expect(container.querySelector(".ppColumns")).toBeNull();
  });

  test("mobile Filters button opens the pFilter popup with a filterBox", () => {
    isMobile.mockReturnValue(true);
    render(<FilterPanel heading="filters" axes={AXES} value={{ id: [], unit: [] }} onChange={() => {}} search={SEARCH} />);
    fireEvent.click(screen.getByRole("button", { name: "filters" }));
    expect(mockSetPopUp).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pFilter", underSlug: "people", popUpData: expect.objectContaining({ filterBox: expect.anything() }) })
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test src/views/_Common/FilterPanel/FilterPanel.test.jsx --watchAll=false`
Expected: FAIL — `Cannot find module './FilterPanel'`.

- [ ] **Step 3: Create the CSS stub so the import resolves**

Create `src/views/_Common/FilterPanel/FilterPanel.css`:

```css
/* FilterPanel styles are relocated from People.css in Task 2. */
```

- [ ] **Step 4: Write the component**

Create `src/views/_Common/FilterPanel/FilterPanel.jsx`:

```jsx
import React, { useEffect, useState } from "react";
import { Button } from "reactstrap";
import BootstrapSwitchButton from "bootstrap-switch-button-react";
import { isMobile, label } from "src/models/Utils";
import { SearchPopUp } from "src/views/_Common/SearchPopUp";
import { useAppController } from "src/contexts/AppControllerContext";
import "./FilterPanel.css";

/**
 * FilterPanel — shared, controlled, config-driven filter UI (People/Places/Matters).
 *
 * The parent owns filter state (it also filters its list); this panel renders the
 * axes + toggles + select-all/clear, wires SearchPopUp, and owns the mobile drawer.
 * Selection is normalized: `value` is { axisName: string[] } (selected tags), and
 * `onChange` receives the whole next map. Each view adapts its native format
 * (letter-code string / Set) at the boundary.
 *
 * Props:
 *  - heading: node — the .ppFiltersHeading text.
 *  - axes: [{ name, title, options: [{ tag, label }] }] — title/label are nodes.
 *  - value: { [axisName]: string[] } — selected tags per axis (controlled).
 *  - onChange(nextValue) — panel computes toggle/select-all/clear; emits the whole map.
 *  - search?: { placeholder, preLoadData, testFieldNames, assetName, selectItemHandler }
 *      — when present, renders 🔍 + SearchPopUp (panel owns isOpen + type-to-search).
 */
export default function FilterPanel({ heading, axes, value, onChange, search }) {
  const appController = useAppController();
  const [isOpen, setIsOpen] = useState(false);
  const [initSearchString, setInitSearchString] = useState("");

  const toggleTag = (axisName, tag) => {
    const cur = value[axisName] || [];
    const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag];
    onChange({ ...value, [axisName]: next });
  };

  const setAll = (axisName, all) => {
    const axis = axes.find((a) => a.name === axisName);
    onChange({ ...value, [axisName]: all ? axis.options.map((o) => o.tag) : [] });
  };

  const renderAxis = (axis) => (
    <ul key={axis.name}>
      <li className="lihead">{axis.title}</li>
      <li className="lifoot">
        <Button onClick={() => setAll(axis.name, true)}>{label("select_all")}</Button>
        <Button onClick={() => setAll(axis.name, false)}>{label("clear")}</Button>
      </li>
      {axis.options.map((opt) => (
        <li className="item" key={opt.tag} onClick={() => toggleTag(axis.name, opt.tag)}>
          <BootstrapSwitchButton
            checked={(value[axis.name] || []).includes(opt.tag)}
            onstyle="success"
            offlabel={label("off")}
            onlabel={label("on")}
            size="xs"
          />
          {opt.label}
        </li>
      ))}
    </ul>
  );

  const searchEl = search ? (
    <SearchPopUp
      placeholder={search.placeholder}
      preLoadData={search.preLoadData}
      // Wrap so a RESULT CLICK closes the popup: SearchPopUp self-closes on Enter
      // but not on click (it only calls selectItemHandler there).
      selectItemHandler={(slug) => { search.selectItemHandler(slug); setIsOpen(false); }}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      testFieldNames={search.testFieldNames}
      assetName={search.assetName}
      initSearchString={initSearchString}
    />
  ) : null;

  const panel = (
    <>
      <h5 className="ppFiltersHeading">{heading}</h5>
      <div className="ppFilters">
        {search && !isMobile() && (
          <button className="ppFiltersSearchButton" onClick={() => setIsOpen(true)}>🔍</button>
        )}
        <div className="ppColumns">{axes.map(renderAxis)}</div>
        {!isMobile() && searchEl}
      </div>
    </>
  );

  // Type-to-search: any printable key opens the SearchPopUp seeded with that key.
  useEffect(() => {
    if (!search) return undefined;
    const onKey = (event) => {
      const ignoreKeys = ["-", "_", "=", "+", "[", "]", "Tab", "\\", "/", "|"];
      if (document.activeElement.tagName !== "INPUT" && ignoreKeys.includes(event.key)) return;
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key === "Escape") setIsOpen(false);
      if (document.activeElement.tagName === "INPUT") { event.stopPropagation(); return; }
      if (event.key.length > 1) return;
      setIsOpen(true);
      setInitSearchString(event.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [search]);

  // Mobile drawer live-update: while the pFilter drawer is open, re-push the panel
  // snapshot on selection change so the drawer reflects current state.
  useEffect(() => {
    if (isMobile() && appController.states.popUp.type === "pFilter") {
      appController.functions.setPopUp({
        ...appController.states.popUp,
        popUpData: { filterBox: panel },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, appController.states.popUp.type]);

  if (isMobile()) {
    const openDrawer = () =>
      appController.functions.setPopUp({
        type: "pFilter",
        ids: [appController.states.user.social?.user_id],
        underSlug: search?.assetName,
        popUpData: { filterBox: panel },
      });
    return (
      <div className="filterDrawerButton">
        <Button onClick={openDrawer}>{heading}</Button>
        {search && (
          <button className="ppFiltersSearchButtonMobile" onClick={() => setIsOpen(true)}>🔍</button>
        )}
        {search && searchEl}
      </div>
    );
  }

  return panel;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test src/views/_Common/FilterPanel/FilterPanel.test.jsx --watchAll=false`
Expected: PASS (all axis/search/mobile tests green).

- [ ] **Step 6: Commit**

```bash
git add src/views/_Common/FilterPanel/FilterPanel.jsx src/views/_Common/FilterPanel/FilterPanel.css src/views/_Common/FilterPanel/FilterPanel.test.jsx
git commit -m "feat(filter-panel): controlled config-driven FilterPanel (axes, search, mobile)"
```

---

## Task 2: Relocate filter CSS into `FilterPanel.css`

The filter styles live in `People/People.css` (imported by People, Places, Matters). Move them into `FilterPanel.css` **keeping the exact class names**, so the dark-mode overrides in `assets/theme/scss/darkmode/_lists.scss` (which target `h5.ppFiltersHeading` and `.lifoot .btn`) keep matching — no re-key, no orphaning.

**Files:**
- Modify: `src/views/_Common/FilterPanel/FilterPanel.css`
- Modify: `src/views/People/People.css`

- [ ] **Step 1: Identify the filter rule blocks**

Run: `grep -n "ppFilters\|ppColumns\|ppFiltersHeading\|lihead\|lifoot\|li.item\|\.item\b\|ppFiltersSearchButton\|filterDrawerButton\|bootstrap-switch\|switch-off\|switch-on\|switch-handle" src/views/People/People.css`

The filter rules are the contiguous block covering: `.ppFilters`, `.ppColumns`, `.ppFiltersHeading`, `.lihead`, `.lifoot` (and `.lifoot .btn`), the filter option row `li.item` (with its `:hover`), `.ppFiltersSearchButton`, `.ppFiltersSearchButtonMobile`, `.filterDrawerButton`, and the `BootstrapSwitchButton` overrides (`.bootstrap-switch`, `.switch-off.btn-xs`, `.switch-on.btn-xs`, `.switch-handle`).

- [ ] **Step 2: Move the rules verbatim into `FilterPanel.css`**

Replace the stub `FilterPanel.css` with the moved rule blocks, **byte-identical selectors and declarations**, EXCEPT: if the option-row selector is a bare `li.item` / `.item`, scope it as `.ppColumns li.item` in `FilterPanel.css` so it can't leak onto unrelated `.item` elements elsewhere in the app. (The `.ppColumns` ancestor is always present around filter option rows.)

- [ ] **Step 3: Delete the moved rules from `People.css`**

Remove exactly those blocks from `People/People.css`. Leave everything else intact — especially `.dot` (label icon dots used by People/Places option labels), `.personCard`, and any non-filter rules.

- [ ] **Step 4: Verify no other consumer breaks**

Run: `grep -rn "filterDrawerButton\|ppFiltersSearchButton" src/views/_Common/Drawer.css src/views/_Common/Main.css`
If `Drawer.css` defines `.filterDrawerButton` with different/extra rules, KEEP that copy (the mobile drawer container may rely on it) — do not delete Drawer.css. `Main.css` `.item` is a generic unrelated rule — leave it untouched.

- [ ] **Step 5: Confirm the panel still styles + tests pass**

Run: `CI=true npx react-scripts test src/views/_Common/FilterPanel/FilterPanel.test.jsx --watchAll=false`
Expected: PASS (tests assert class names/behavior, unaffected by which file holds the CSS).

- [ ] **Step 6: Commit**

```bash
git add src/views/_Common/FilterPanel/FilterPanel.css src/views/People/People.css
git commit -m "style(filter-panel): relocate filter CSS from People.css (class names kept)"
```

---

## Task 3: Migrate People

Replace the `PeopleFilters` body with an adapter + `<FilterPanel>`. Keep `filterSections` (the data) and the icon imports it references. Remove `filterUI`, `toggleFilter`, `toggleFilterCategory`, the mobile branch, `filterBox`, `handleClick`, `handleKeyDown`, the pFilter live-update effect, and the local `isOpen`/`initSearchString` state (all now in `FilterPanel`).

**Files:**
- Modify: `src/views/People/People.js`

- [ ] **Step 1: Add the import**

At the top of `People.js` with the other imports, add:
```jsx
import FilterPanel from "src/views/_Common/FilterPanel/FilterPanel";
```

- [ ] **Step 2: Replace the entire `PeopleFilters` function**

Replace `export function PeopleFilters({ setFilter, peopleFilters }) { … }` (through its closing brace) with:

```jsx
export function PeopleFilters({ setFilter, peopleFilters }) {
  const appController = useAppController();
  const { personList } = appController.preLoad;

  const filterSections = {
    identification: {
      title: label("social_identification"),
      key: "identification",
      filters: [
        { label: <span><img className="dot" src={grey} alt="" /> {label("biblical_israelite")}</span>, tag: "B" },
        { label: <span><img className="dot" src={yellow} alt="" /> {label("jaredite")}</span>, tag: "J" },
        { label: <span><img className="dot" src={green} alt="" /> {label("nephite")}</span>, tag: "N" },
        { label: <span><img className="dot" src={blue} alt="" /> {label("lamanite")}</span>, tag: "L" },
        { label: <span><img className="dot" src={orange} alt="" /> {label("mulekite")}</span>, tag: "M" },
        { label: <span><img className="dot" src={red} alt="" /> {label("gadianton")}</span>, tag: "G" },
        { label: <span><img className="dot" src={black} alt="" /> {label("other")}</span>, tag: "O" },
      ],
    },
    classification: {
      title: label("social_classification"),
      key: "classification",
      filters: [
        { label: <span><img src={royalty} alt="" />{label("royalty")}</span>, tag: "R" },
        { label: <span><img src={prophet} alt="" />{label("prophet")}</span>, tag: "P" },
        { label: <span><img src={priest} alt="" />{label("priest")}</span>, tag: "I" },
        { label: <span><img src={record_keeper} alt="" />{label("record_keeper")}</span>, tag: "H" },
        { label: <span><img src={warrior} alt="" />{label("warrior")}</span>, tag: "W" },
        { label: <span><img src={judge} alt="" />{label("judge")}</span>, tag: "J" },
        { label: <span><img src={other} alt="" />{label("other")}</span>, tag: "O" },
      ],
    },
    unit: {
      title: label("social_unit"),
      key: "unit",
      filters: [
        { label: <span><img src={individual} alt="" />{label("individual")}</span>, tag: "I" },
        { label: <span><img src={group} alt="" />{label("group")}</span>, tag: "G" },
        { label: <span><img src={organization} alt="" />{label("organization")}</span>, tag: "O" },
        { label: <span><img src={society} alt="" />{label("society")}</span>, tag: "S" },
        { label: <span><img src={civilization} alt="" />{label("civilization")}</span>, tag: "C" },
        { label: <span><img src={other} alt="" />{label("other")}</span>, tag: "X" },
      ],
    },
  };

  const axes = [filterSections.identification, filterSections.classification, filterSections.unit].map((s) => ({
    name: s.key,
    title: s.title,
    options: s.filters.map((f) => ({ tag: f.tag, label: f.label })),
  }));

  const value = {
    identification: (peopleFilters.identification || "").split(""),
    classification: (peopleFilters.classification || "").split(""),
    unit: (peopleFilters.unit || "").split(""),
  };

  const onChange = (next) =>
    setFilter({
      ...peopleFilters,
      identification: next.identification.join("") || null,
      classification: next.classification.join("") || null,
      unit: next.unit.join("") || null,
    });

  const selectItemHandler = (slug) =>
    appController.functions.setPopUp({ type: "people", ids: [slug], underSlug: "people" });

  return (
    <FilterPanel
      heading={label("filters")}
      axes={axes}
      value={value}
      onChange={onChange}
      search={{
        placeholder: "search_for_a_person",
        preLoadData: personList,
        testFieldNames: { primary: "name", secondary: "title" },
        assetName: "people",
        selectItemHandler,
      }}
    />
  );
}
```

- [ ] **Step 3: Remove now-unused imports in People.js**

After the edit, remove any imports only the old code used (e.g. `BootstrapSwitchButton`, `SearchPopUp`, `isMobile`, reactstrap `Button`) — but ONLY if grep shows they're unused elsewhere in `People.js`:
Run: `grep -n "BootstrapSwitchButton\|SearchPopUp\|isMobile\|<Button" src/views/People/People.js`
Remove each import whose symbol no longer appears. Keep everything still referenced (the icon imports `grey`/`green`/`royalty`/… are all still used by `filterSections`).

- [ ] **Step 4: Run the full test suite**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS. (2 pre-existing flaky failures in `Analysis/Bible/__tests__/reader.test.js` are known and unrelated — confirm nothing NEW fails.)

- [ ] **Step 5: Manual parity check**

`http://localhost:8200/people` (NOT `bom.kckern.net`). Confirm: 3 filter columns with colored-dot labels; toggling a switch filters the person list exactly as before; select-all/clear work; the 🔍 opens search and picking a person opens their popup AND closes the search; typing a letter opens search seeded with it; at a narrow width the "Filters" button opens the drawer, filtering there updates the list live. Check dark mode.

- [ ] **Step 6: Commit**

```bash
git add src/views/People/People.js
git commit -m "refactor(filter-panel): People uses shared FilterPanel"
```

---

## Task 4: Migrate Places

Same shape as People; axis keys `occupants`/`location`/`type`, heading `"selectors"`, search props for places.

**Files:**
- Modify: `src/views/Places/Places.js`

- [ ] **Step 1: Add the import**

At the top of `Places.js`, add:
```jsx
import FilterPanel from "src/views/_Common/FilterPanel/FilterPanel";
```

- [ ] **Step 2: Replace the entire `PlaceFilters` function**

Replace `export function PlaceFilters({ setFilter, placeFilters }) { … }` (through its closing brace) with:

```jsx
export function PlaceFilters({ setFilter, placeFilters }) {
  const appController = useAppController();
  const { placeList } = appController.preLoad;

  const filterSections = {
    occupants: {
      title: label("occupants"),
      key: "occupants",
      filters: [
        { label: <span><img className="dot" src={grey} alt="" /> {label("biblical_israelite")}</span>, tag: "I" },
        { label: <span><img className="dot" src={yellow} alt="" /> {label("jaredite")}</span>, tag: "J" },
        { label: <span><img className="dot" src={green} alt="" /> {label("nephite")}</span>, tag: "N" },
        { label: <span><img className="dot" src={blue} alt="" /> {label("lamanite")}</span>, tag: "L" },
        { label: <span><img className="dot" src={orange} alt="" /> {label("mulekite")}</span>, tag: "M" },
        { label: <span><img className="dot" src={red} alt="" /> {label("gadianton")}</span>, tag: "G" },
        { label: <span><img className="dot" src={black} alt="" /> {label("other")}</span>, tag: "O" },
      ],
    },
    location: {
      title: label("greater_locale"),
      key: "location",
      filters: [
        { label: <span><img className="dot" src={brown} alt="" /> {label("land_of_first_Inheritance")}</span>, tag: "F" },
        { label: <span><img className="dot" src={red} alt="" /> {label("land_of_nephi")}</span>, tag: "N" },
        { label: <span><img className="dot" src={blue} alt="" /> {label("land_of_zarahemla")}</span>, tag: "Z" },
        { label: <span><img className="dot" src={green} alt="" /> {label("land_bountiful")}</span>, tag: "B" },
        { label: <span><img className="dot" src={yellow} alt="" /> {label("land_of_desolation")}</span>, tag: "D" },
        { label: <span><img className="dot" src={grey} alt="" /> {label("old_world")}</span>, tag: "W" },
        { label: <span><img className="dot" src={black} alt="" /> {label("geo_other")}</span>, tag: "O" },
      ],
    },
    type: {
      title: label("geo_type"),
      key: "type",
      filters: [
        { label: <span><img src={nation} alt="" />{label("nation")}</span>, tag: "N" },
        { label: <span><img src={land} alt="" />{label("land")}</span>, tag: "L" },
        { label: <span><img src={city} alt="" />{label("city")}</span>, tag: "C" },
        { label: <span><img src={town} alt="" />{label("town")}</span>, tag: "T" },
        { label: <span><img src={geographic_feature} alt="" />{label("geographic_feature")}</span>, tag: "G" },
        { label: <span><img src={geo_other} alt="" />{label("geo_other")}</span>, tag: "O" },
      ],
    },
  };

  const axes = [filterSections.occupants, filterSections.location, filterSections.type].map((s) => ({
    name: s.key,
    title: s.title,
    options: s.filters.map((f) => ({ tag: f.tag, label: f.label })),
  }));

  const value = {
    occupants: (placeFilters.occupants || "").split(""),
    location: (placeFilters.location || "").split(""),
    type: (placeFilters.type || "").split(""),
  };

  const onChange = (next) =>
    setFilter({
      ...placeFilters,
      occupants: next.occupants.join("") || null,
      location: next.location.join("") || null,
      type: next.type.join("") || null,
    });

  const selectItemHandler = (slug) =>
    appController.functions.setPopUp({ type: "places", ids: [slug], underSlug: "places" });

  return (
    <FilterPanel
      heading={label("selectors")}
      axes={axes}
      value={value}
      onChange={onChange}
      search={{
        placeholder: "search_for_a_place",
        preLoadData: placeList,
        testFieldNames: { primary: "name", secondary: "info" },
        assetName: "places",
        selectItemHandler,
      }}
    />
  );
}
```

- [ ] **Step 3: Remove now-unused imports in Places.js**

Run: `grep -n "BootstrapSwitchButton\|SearchPopUp\|isMobile\|<Button" src/views/Places/Places.js`
Remove each import whose symbol no longer appears anywhere in the file. Keep the icon imports still used by `filterSections` (`grey`, `brown`, `nation`, …).

- [ ] **Step 4: Run the full suite**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS (only the 2 known flaky reader.test.js failures).

- [ ] **Step 5: Manual parity check**

`http://localhost:8200/places` — same checks as People (3 columns, list filters correctly, search + type-to-search + mobile drawer + dark mode).

- [ ] **Step 6: Commit**

```bash
git add src/views/Places/Places.js
git commit -m "refactor(filter-panel): Places uses shared FilterPanel"
```

---

## Task 5: Migrate Matters

Matters uses `Set` state and imports its axes from `mattersFilterData.js`.

**Files:**
- Modify: `src/views/Matters/MattersFilter.js`

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `src/views/Matters/MattersFilter.js` with:

```jsx
/** @format */

import React from "react";
import { label } from "src/models/Utils";
import { filterAxes } from "./mattersFilterData";
import { useAppController } from "src/contexts/AppControllerContext";
import FilterPanel from "src/views/_Common/FilterPanel/FilterPanel";

export function MattersFilter({ matterFilters, setFilter, matterList }) {
  const appController = useAppController();

  const axes = filterAxes.map((a) => ({
    name: a.name,
    title: label(a.title) || a.titleEn,
    options: a.chips.map((c) => ({ tag: c.tag, label: label(c.key) || c.label })),
  }));

  const value = Object.fromEntries(filterAxes.map((a) => [a.name, [...matterFilters[a.name]]]));

  const onChange = (next) =>
    setFilter({
      ...matterFilters,
      ...Object.fromEntries(filterAxes.map((a) => [a.name, new Set(next[a.name])])),
    });

  const selectItemHandler = (slug) =>
    appController.functions.setPopUp({ type: "matters", ids: [slug], underSlug: "matters" });

  return (
    <FilterPanel
      heading={label("selectors")}
      axes={axes}
      value={value}
      onChange={onChange}
      search={{
        placeholder: "search_for_a_matter",
        preLoadData: matterList,
        testFieldNames: { primary: "name", secondary: "subtitle" },
        assetName: "matters",
        selectItemHandler,
      }}
    />
  );
}
```

- [ ] **Step 2: Run the full suite**

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: PASS (only the 2 known flaky reader.test.js failures).

- [ ] **Step 3: Manual parity check**

`http://localhost:8200/matters` — 5 filter axes; toggling filters the matter list (Set-based `Set.has` matching still works because the view keeps `matterFilters` as Sets); select-all/clear; search + type-to-search; mobile drawer now live-updates (an improvement — Matters lacked that before). Check dark mode.

- [ ] **Step 4: Commit**

```bash
git add src/views/Matters/MattersFilter.js
git commit -m "refactor(filter-panel): Matters uses shared FilterPanel"
```

---

## Task 6: Delete dead code + trim CSS imports + final verification

**Files:**
- Delete: `src/views/People/PeoplePlacesFilter.js`
- Possibly modify: `src/views/Places/Places.js`, `src/views/Matters/Matters.js` (CSS imports)

- [ ] **Step 1: Confirm `PeoplePlacesFilter.js` is unreferenced, then delete it**

Run: `grep -rn "PeoplePlacesFilter" src/`
Expected: only the file's own definition. Then:
```bash
git rm src/views/People/PeoplePlacesFilter.js
```

- [ ] **Step 2: Check whether Places/Matters still need `../People/People.css`**

`Places.js` and `Matters.js` import `../People/People.css`. After Task 2 relocated the filter rules, they only still need it if they use OTHER People.css classes (e.g. `.dot`).
Run: `grep -rn "className=\"dot\"\|className='dot'\|personCard\|peopleFeature" src/views/Places/Places.js src/views/Matters/Matters.js`
- If a view still uses `.dot` (Places option labels use `<img className="dot">`) or another People.css class, KEEP its `../People/People.css` import.
- Only remove the import from a view that references nothing left in People.css. (Places uses `.dot` → keep. Verify Matters.)

- [ ] **Step 3: Full stale-class + regression sweep**

Run:
```
grep -rn "toggleFilterCategory\|filterUI\|const filterBox" src/views/People/People.js src/views/Places/Places.js src/views/Matters/MattersFilter.js
grep -rn "ppFilters\|ppColumns\|lihead\|lifoot\|filterDrawerButton" src/ --include=*.css --include=*.scss
```
First grep: expected EMPTY (old filter logic fully removed from the three views). Second grep: the filter CSS should now live in `FilterPanel.css` (+ the unchanged dark overrides in `darkmode/_lists.scss` and any legitimately-separate `Drawer.css` `.filterDrawerButton`). No leftover copies in `People.css`.

- [ ] **Step 4: Full suite + lint**

Run: `CI=true npx react-scripts test --watchAll=false` → PASS (only the 2 known flaky reader.test.js failures).
Run: `npx eslint src/views/_Common/FilterPanel/ src/views/People/People.js src/views/Places/Places.js src/views/Matters/MattersFilter.js` → no NEW errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(filter-panel): delete dead PeoplePlacesFilter, trim CSS imports"
```

---

## Task 7: Documentation

**Files:**
- Create: `docs/reference/filter-panel.md`

- [ ] **Step 1: Write the reference doc**

Create `docs/reference/filter-panel.md`:

```markdown
# FilterPanel component

Shared, controlled, config-driven filter UI. Lives at
`frontend/webapp/src/views/_Common/FilterPanel/FilterPanel.jsx`. Used by People,
Places, and Matters.

## Usage

    <FilterPanel
      heading={label("filters")}
      axes={[{ name: "id", title: <node>, options: [{ tag: "N", label: <node> }] }]}
      value={{ id: ["N"] }}            // normalized: selected tags per axis
      onChange={next => setFilter(adapt(next))}
      search={{ placeholder, preLoadData, testFieldNames, assetName, selectItemHandler }}
    />

## API

- `heading: node` — the `.ppFiltersHeading` text.
- `axes: [{ name, title, options: [{ tag, label }] }]` — `title`/`label` are nodes.
- `value: { [axisName]: string[] }` — selected tags per axis (controlled).
- `onChange(nextValue)` — the panel computes toggle/select-all/clear and emits the
  whole next map; the parent stores it (adapting to its native format).
- `search?: { placeholder, preLoadData, testFieldNames, assetName, selectItemHandler }`
  — when present, renders the 🔍 button + `SearchPopUp` (the panel owns `isOpen`,
  wraps `selectItemHandler` to close on result-click, and handles type-to-search).

The panel owns the mobile path: below the mobile breakpoint it renders the
`.filterDrawerButton` and opens the app's `"pFilter"` popup (rendered by
`_Common/Drawer.js`), re-pushing the panel on selection change so the drawer stays live.

## Adapter recipe (native state ↔ normalized arrays)

The parent keeps its own selection state and list-filtering; convert at the edge.

- **Letter-code string (People/Places):** `value` = `(filters[axis] || "").split("")`;
  in `onChange`, `filters[axis] = next[axis].join("") || null`.
- **Set (Matters):** `value` = `[...filters[axis]]`; in `onChange`,
  `filters[axis] = new Set(next[axis])`.

## Styling

Class names are retained from the original views (`.ppFilters`, `.ppColumns`,
`.ppFiltersHeading`, `.lihead`, `.lifoot`, `.item`, `.ppFiltersSearchButton`,
`.filterDrawerButton`), relocated into `FilterPanel.css`. Dark-mode overrides live
in `assets/theme/scss/darkmode/_lists.scss` and use the app's global tokens.
```

- [ ] **Step 2: Confirm JSDoc exists on `FilterPanel.jsx`** (added in Task 1) — no code change; just verify the header block is present.

- [ ] **Step 3: Commit**

```bash
git add docs/reference/filter-panel.md
git commit -m "docs(filter-panel): API + adapter reference"
```

---

## Final verification

- [ ] **Full suite green:** `CI=true npx react-scripts test --watchAll=false` → PASS (only the 2 known flaky reader.test.js failures).
- [ ] **No leftovers:** the Task 6 greps return only intentional survivors.
- [ ] **Lint:** `npx eslint src/views/_Common/FilterPanel/` → clean.
- [ ] **Manual sweep** on `http://localhost:8200` (NOT `bom.kckern.net`): `/people`, `/places`, `/matters` — each: columns render, list filters correctly on toggle, select-all/clear, 🔍 search + pick + close, type-to-search, mobile drawer live-updates, dark mode.
```
