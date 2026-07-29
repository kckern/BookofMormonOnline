# Matters Filter — Two-Level Detail Column + FilterPanel Tokens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flattened Matters detail list with a two-level (form switches → per-form radio subform chips) right column with show-more, and move filter-panel spacing/accent onto shared CSS tokens.

**Architecture:** FilterPanel stays generic and gains one optional `extraColumn` node prop. A new `MatterDetailColumn` owns all cascade/show-more logic and reuses FilterPanel's `li.item` classes + shared tokens for visual parity. Matters state returns to two axes (`form`, `subform_label`); the predicate keys subforms off `subformsByForm[item.form]` to avoid the duplicate-tag collision.

**Tech Stack:** React 17 function components + hooks, `bootstrap-switch-button-react`, plain CSS with custom properties. Verification: dev server recompile (`journalctl --user -u bom-dev`) + manual check at `http://localhost:8200/matters`.

**Spec:** `docs/specs/2026-07-28-matters-filter-detail-column-and-filterpanel-tokens.md`

---

## File structure

- `frontend/webapp/src/views/_Common/FilterPanel/FilterPanel.jsx` — add `extraColumn` prop.
- `frontend/webapp/src/views/_Common/FilterPanel/FilterPanel.css` — add `.ppFilters` tokens, shared row-gap rule, delete dead `.ppAxis*` block.
- `frontend/webapp/src/views/Matters/mattersFilterData.js` — remove `detailAxis` + `detailOptionsForGroups`.
- `frontend/webapp/src/views/Matters/MatterDetailColumn.jsx` — NEW cascade column.
- `frontend/webapp/src/views/Matters/MatterDetailColumn.css` — NEW chip/show-more styles.
- `frontend/webapp/src/views/Matters/MattersFilter.js` — conditionally pass Prominence axis vs. `extraColumn`.
- `frontend/webapp/src/views/Matters/Matters.js` — state, prune, predicate (Matters JSX unchanged).

---

## Task 1: FilterPanel gains an `extraColumn` slot

**Files:**
- Modify: `frontend/webapp/src/views/_Common/FilterPanel/FilterPanel.jsx`

- [ ] **Step 1: Add the prop and render it as a peer column**

Change the signature and the `.ppColumns` render:

```jsx
export default function FilterPanel({ heading, axes, value, onChange, search, extraColumn }) {
```

```jsx
        <div className="ppColumns">
          {axes.map(renderAxis)}
          {extraColumn}
        </div>
```

Update the JSDoc prop list to add:
```
 *  - extraColumn?: node — an extra column rendered as a peer after the axes
 *      (Matters uses it for its cascading form/subform detail column).
```

- [ ] **Step 2: Verify compile**

Run: `journalctl --user -u bom-dev --no-pager -n 6 | grep -iE "compiled|failed|error in"`
Expected: `webpack compiled` (no `Failed to compile`). `extraColumn` is undefined for People/Places, so nothing renders for them.

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/_Common/FilterPanel/FilterPanel.jsx
git commit -m "FilterPanel: add optional extraColumn slot"
```

---

## Task 2: FilterPanel tokens + shared row gap + delete dead CSS

**Files:**
- Modify: `frontend/webapp/src/views/_Common/FilterPanel/FilterPanel.css`

- [ ] **Step 1: Add design tokens to `.ppFilters`**

In the `.ppFilters` rule, add the custom properties and route padding through one:

```css
.ppFilters
{
    --pp-row-gap: .4em;
    --pp-col-gap: 0;
    --pp-pad: 1em;
    --pp-accent: #198754;
    margin-left: 10vw;
    margin-right: 10vw;
    margin-bottom: 2em;
    border-radius: 1em;
    padding: var(--pp-pad);
    background-color:#DDD;
    position: relative;
    border-top-right-radius: 0;
}
```

- [ ] **Step 2: Route column gap through the token**

```css
.ppColumns
{
    display: flex;
    gap: var(--pp-col-gap);
}
```

- [ ] **Step 3: Add the one shared row-gap rule**

Extend the existing `.ppColumns li.item` rule (keep its current properties) so it reads:

```css
.ppColumns li.item
{
    cursor: pointer;
    display: flex;
    align-items: center;
    margin-bottom: var(--pp-row-gap);
}
```

- [ ] **Step 4: Delete the dead `.ppAxis*` block**

Remove the entire block starting at the comment `/* ── Grouped / chip axes (Matters) ──` through the last `.ppAxisActions button { ... }` rule (no JSX references any of these classes). Verify none remain:

Run: `grep -rn "ppAxisHead\|ppAxisTitle\|ppAxisCount\|ppAxisActions" frontend/webapp/src`
Expected: no output.

- [ ] **Step 5: Verify compile + eyeball People/Places**

Run: `journalctl --user -u bom-dev --no-pager -n 6 | grep -iE "compiled|failed"`
Expected: `webpack compiled`. Manually: open `http://localhost:8200/people` and `/places` — rows have a small consistent gap; nothing else shifted.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/_Common/FilterPanel/FilterPanel.css
git commit -m "FilterPanel: shared spacing/accent tokens; drop dead ppAxis CSS"
```

---

## Task 3: Trim `mattersFilterData.js` to the two-axis model

**Files:**
- Modify: `frontend/webapp/src/views/Matters/mattersFilterData.js`

- [ ] **Step 1: Remove the flatten helpers**

Delete the `detailAxis` export and the entire `detailOptionsForGroups` function. Keep `formsByGroup`, `subformsByForm`, `filterAxes`, `prominenceBucket`, and the chip arrays. No reverse-map is added — the predicate uses `subformsByForm[item.form]` directly.

- [ ] **Step 2: Verify no stale references remain**

Run: `grep -rn "detailAxis\|detailOptionsForGroups" frontend/webapp/src`
Expected: no output (Tasks 4–5 replace all consumers; if this errors before those tasks, that's expected mid-sequence — run after Task 5).

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/Matters/mattersFilterData.js
git commit -m "matters: drop flattened detail vocabulary"
```

---

## Task 4: New `MatterDetailColumn` component + styles

**Files:**
- Create: `frontend/webapp/src/views/Matters/MatterDetailColumn.jsx`
- Create: `frontend/webapp/src/views/Matters/MatterDetailColumn.css`

- [ ] **Step 1: Write the component**

Create `MatterDetailColumn.jsx`:

```jsx
/** @format */

import React, { useState } from "react";
import BootstrapSwitchButton from "bootstrap-switch-button-react";
import { label } from "src/models/Utils";
import { formsByGroup, subformsByForm } from "./mattersFilterData";
import "./MatterDetailColumn.css";

/** label() echoes the key back when the dictionary lacks it — treat that as a miss. */
const t = (key, fallback) => {
  const v = label(key);
  return !v || v === key || !String(v).trim() ? fallback : v;
};

const CAP = 10; // max form rows shown collapsed

/**
 * The Matters right column once a Kind is active. Primary level: form switches
 * (reusing FilterPanel's li.item chrome). Each ON form reveals its subform chips
 * beneath it; those chips are radio-per-form (picking one clears its siblings).
 * Collapsed to ~CAP form rows — selected forms are always shown — with Show more.
 */
export function MatterDetailColumn({ matterFilters, setFilter }) {
  const [expanded, setExpanded] = useState(false);
  const kinds = matterFilters.form_group ?? new Set();
  const formSel = matterFilters.form ?? new Set();
  const subSel = matterFilters.subform_label ?? new Set();

  // Forms revealed by the selected kinds, deduped, group order preserved.
  const seen = new Set();
  const forms = [];
  for (const g of kinds) {
    for (const f of formsByGroup[g] || []) {
      if (!seen.has(f.tag)) { seen.add(f.tag); forms.push(f); }
    }
  }

  // Collapsed: always show selected forms, fill up to CAP with the rest.
  let visible = forms;
  let hiddenCount = 0;
  if (!expanded && forms.length > CAP) {
    const selected = forms.filter((f) => formSel.has(f.tag));
    const unselected = forms.filter((f) => !formSel.has(f.tag));
    const fill = unselected.slice(0, Math.max(0, CAP - selected.length));
    const keep = new Set([...selected, ...fill].map((f) => f.tag));
    visible = forms.filter((f) => keep.has(f.tag));
    hiddenCount = forms.length - visible.length;
  }

  const toggleForm = (tag) => {
    const next = new Set(formSel);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setFilter({ ...matterFilters, form: next });
  };

  const toggleSub = (formTag, subTag) => {
    const next = new Set(subSel);
    const wasOn = next.has(subTag);
    // Radio within this form: clear its siblings first.
    for (const s of subformsByForm[formTag] || []) next.delete(s.tag);
    if (!wasOn) next.add(subTag);
    setFilter({ ...matterFilters, subform_label: next });
  };

  return (
    <ul className="ppDetailColumn">
      <li className="lihead">{t("matter_axis_detail", "Detail")}</li>
      {visible.map((f) => {
        const on = formSel.has(f.tag);
        const subs = subformsByForm[f.tag] || [];
        return (
          <React.Fragment key={f.tag}>
            <li className="item" onClick={() => toggleForm(f.tag)}>
              <BootstrapSwitchButton
                checked={on}
                onstyle="success"
                offlabel={label("off")}
                onlabel={label("on")}
                size="xs"
              />
              {t(f.key, f.label)}
            </li>
            {on && subs.length > 0 && (
              <li className="ppSubChips">
                {subs.map((s) => (
                  <button
                    type="button"
                    key={s.tag}
                    className={"ppChip" + (subSel.has(s.tag) ? " on" : "")}
                    onClick={() => toggleSub(f.tag, s.tag)}
                  >
                    {t(s.key, s.label)}
                  </button>
                ))}
              </li>
            )}
          </React.Fragment>
        );
      })}
      {hiddenCount > 0 && (
        <li className="ppShowMore">
          <button type="button" onClick={() => setExpanded(true)}>
            {t("show_more", "Show more")} ({hiddenCount})
          </button>
        </li>
      )}
      {expanded && forms.length > CAP && (
        <li className="ppShowMore">
          <button type="button" onClick={() => setExpanded(false)}>
            {t("show_less", "Show less")}
          </button>
        </li>
      )}
    </ul>
  );
}
```

- [ ] **Step 2: Write the styles**

Create `MatterDetailColumn.css` (width + `li.item` chrome come from the shared `.ppFilters ul` / `.ppColumns li.item` rules; this file only adds the chip row and show-more):

```css
.ppSubChips {
  display: flex;
  flex-wrap: wrap;
  gap: .35em;
  padding: .1em 0 .3em 2.5em;   /* indent so chips sit under the switch label */
  margin-bottom: var(--pp-row-gap);
  list-style: none;
}

.ppChip {
  border: 1px solid #b7b7b7;
  background: #eee;
  color: #444;
  border-radius: 999px;
  font-size: .74em;
  line-height: 1.4;
  padding: .12em .7em;
  cursor: pointer;
}
.ppChip:hover { border-color: #888; }
.ppChip.on {
  background: var(--pp-accent);
  border-color: var(--pp-accent);
  color: #fff;
}

.ppShowMore { padding: .3em 0; }
.ppShowMore button {
  border: none;
  background: none;
  color: var(--pp-accent);
  font-size: .8em;
  text-transform: uppercase;
  letter-spacing: .04em;
  cursor: pointer;
  padding: 0;
}
```

- [ ] **Step 3: Verify compile** (component not yet mounted; just confirm it parses once Task 5 imports it)

Run: `npx --prefix frontend/webapp eslint frontend/webapp/src/views/Matters/MatterDetailColumn.jsx --no-eslintrc --parser-options=ecmaVersion:2021,sourceType:module,ecmaFeatures:{jsx:true}`
Expected: no output (clean parse).

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Matters/MatterDetailColumn.jsx frontend/webapp/src/views/Matters/MatterDetailColumn.css
git commit -m "matters: add two-level detail column (form switches + per-form radio subforms)"
```

---

## Task 5: Wire MattersFilter + Matters.js to the two-axis model

**Files:**
- Modify: `frontend/webapp/src/views/Matters/MattersFilter.js`
- Modify: `frontend/webapp/src/views/Matters/Matters.js`

- [ ] **Step 1: MattersFilter — swap Prominence for the detail column when a Kind is on**

Replace the imports and the axis-building block:

```jsx
import { filterAxes } from "./mattersFilterData";
import { MatterDetailColumn } from "./MatterDetailColumn";
```

```jsx
export function MattersFilter({ matterFilters, setFilter, matterList }) {
  const appController = useAppController();

  const byName = Object.fromEntries(filterAxes.map((a) => [a.name, a]));
  const kindActive = (matterFilters.form_group?.size ?? 0) > 0;

  // Right column is Prominence until a Kind is on, then the detail column.
  const shown = kindActive
    ? [byName.era_culture, byName.form_group]
    : [byName.era_culture, byName.form_group, byName.prominence];

  const axes = shown.map((a) => ({
    name: a.name,
    title: t(a.title, a.titleEn),
    options: a.chips.map((c) => ({ tag: c.tag, label: t(c.key, c.label) })),
  }));

  const axisNames = shown.map((a) => a.name);
  const value = Object.fromEntries(axisNames.map((n) => [n, [...(matterFilters[n] || [])]]));

  const onChange = (next) =>
    setFilter({
      ...matterFilters,
      ...Object.fromEntries(axisNames.map((n) => [n, new Set(next[n] || [])])),
    });

  const extraColumn = kindActive ? (
    <MatterDetailColumn matterFilters={matterFilters} setFilter={setFilter} />
  ) : null;

  const selectItemHandler = (slug) =>
    appController.functions.setPopUp({ type: "matters", ids: [slug], underSlug: "matters" });

  return (
    <FilterPanel
      heading={label("selectors")}
      axes={axes}
      value={value}
      onChange={onChange}
      extraColumn={extraColumn}
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

- [ ] **Step 2: Matters.js — imports, empty state, prune, predicate**

Replace the data import:

```jsx
import { prominenceBucket, formsByGroup, subformsByForm } from "./mattersFilterData";
```

Replace `emptyFilters`:

```jsx
  const emptyFilters = {
    era_culture: new Set(),
    form_group: new Set(),
    prominence: new Set(),
    form: new Set(),
    subform_label: new Set(),
    search: null,
  };
```

Replace `setFilter` with the two-axis prune:

```jsx
  /**
   * Keep the dynamic right column honest. Prominence and the detail column
   * share the third slot, and form/subform selections cascade off the Kind:
   *   - Kind empty     → clear form + subform_label (their column is gone).
   *   - Kind non-empty → clear Prominence; drop forms not reachable from the
   *                      selected kinds, then subforms whose parent form dropped.
   */
  const setFilter = (next) => {
    let result = next;
    const kind = result.form_group ?? new Set();
    if (!kind.size) {
      if (result.form?.size) result = { ...result, form: new Set() };
      if (result.subform_label?.size) result = { ...result, subform_label: new Set() };
    } else {
      if (result.prominence?.size) result = { ...result, prominence: new Set() };
      const reachableForms = new Set(
        [...kind].flatMap((g) => (formsByGroup[g] || []).map((f) => f.tag))
      );
      const forms = result.form ?? new Set();
      const keptForms = new Set([...forms].filter((f) => reachableForms.has(f)));
      if (keptForms.size !== forms.size) result = { ...result, form: keptForms };

      const subs = result.subform_label ?? new Set();
      if (subs.size) {
        const validSubs = new Set(
          [...keptForms].flatMap((f) => (subformsByForm[f] || []).map((s) => s.tag))
        );
        const keptSubs = new Set([...subs].filter((s) => validSubs.has(s)));
        if (keptSubs.size !== subs.size) result = { ...result, subform_label: keptSubs };
      }
    }
    setFilterRaw(result);
  };
```

Replace the axis loop + prominence block in `passesFilters`:

```jsx
    for (const axis of ["era_culture", "form_group"]) {
      const set = matterFilters[axis];
      if (set && set.size > 0 && !set.has(item[axis])) return false;
    }
    const formSel = matterFilters.form;
    if (formSel && formSel.size > 0 && !formSel.has(item.form)) return false;
    // Per-form subform narrowing: only the item's own form's chips constrain it.
    const subSel = matterFilters.subform_label;
    if (subSel && subSel.size > 0) {
      const active = (subformsByForm[item.form] || [])
        .map((s) => s.tag)
        .filter((tag) => subSel.has(tag));
      if (active.length > 0 && !active.includes(item.subform_label)) return false;
    }
    const prom = matterFilters.prominence;
    if (prom && prom.size > 0 && !prom.has(prominenceBucket(item.nrefs))) return false;
    return true;
```

- [ ] **Step 3: Verify no stale references anywhere**

Run: `grep -rn "detailAxis\|detailOptionsForGroups\|matterFilters.detail\|\\bdetail:" frontend/webapp/src/views/Matters`
Expected: no output.

- [ ] **Step 4: Verify compile**

Run: `journalctl --user -u bom-dev --no-pager -n 6 | grep -iE "compiled|failed|error in"`
Expected: `webpack compiled` (no `Failed to compile`).

- [ ] **Step 5: Manual verification at `http://localhost:8200/matters`**

Confirm each acceptance criterion:
- No Kind selected → right column is Prominence.
- Select Kind "Made Things" → right column shows form switches (not a 35-item flat list), capped ~10 with `Show more (N)`.
- Switch on "Arms & Armor" → subform chips appear indented beneath it.
- Click "Swords" then "Armor" under Arms & Armor → selection switches (only one on).
- Switch on a second form, pick a subform → the first form's subform stays selected.
- Clear the Kind → detail column disappears, form/subform filters drop, Prominence returns.

- [ ] **Step 6: Commit**

```bash
git add frontend/webapp/src/views/Matters/MattersFilter.js frontend/webapp/src/views/Matters/Matters.js
git commit -m "matters: two-axis form/subform filter wired to detail column"
```

---

## Self-review

- **Spec coverage:** D1 per-form radio → Task 4 `toggleSub` + Task 5 predicate; D2 show-more/cap → Task 4 collapse logic; D3 `extraColumn` seam → Task 1 + Task 5 wiring; D4 tokens/dead-CSS → Task 2. Prune/predicate/state → Task 5. All spec sections map to a task.
- **Placeholder scan:** none — every code step is complete.
- **Type/name consistency:** `matterFilters.form` / `.subform_label` / `.form_group` / `.prominence` used identically across `MatterDetailColumn`, `MattersFilter`, and `Matters.js`; `formsByGroup` / `subformsByForm` imported where used; `extraColumn` prop name matches between Task 1 and Task 5.
- **Refinement vs. spec:** predicate uses `subformsByForm[item.form]` instead of the spec's `subformParent` reverse-map, because the subform tag "Agriculture" is shared by two forms and a reverse-map would collide. Noted in this plan's header.
