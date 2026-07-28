# FilterPanel Design-System Component — Design Spec

**Date:** 2026-07-28
**Status:** Approved (brainstorm) — pending implementation plan
**Scope:** Frontend CRA app only (`frontend/webapp/src/`). Consolidates the People / Places / Matters filter UIs. Follows the `<Breadcrumb>` precedent (`docs/reference/breadcrumb-component.md`).

## Problem

The People, Places, and Matters views each render an **identical** filter panel, tracked in the design-system audit (`docs/audits/2026-07-28-design-system-inventory.md`) as the highest-ROI consolidation. Verified duplication:

- `views/People/People.js` — `PeopleFilters` (~L182–372)
- `views/Places/Places.js` — `PlaceFilters` (~L212–397)
- `views/Matters/MattersFilter.js` — whole file

All three render the same structure and share the same CSS (`.ppFiltersHeading` heading + `.ppFilters` container + a desktop 🔍 button + `.ppColumns` of per-axis `<ul>`s [`.lihead` title, `.lifoot` select-all/clear, `.item` rows with a `BootstrapSwitchButton` + label] + `SearchPopUp` on desktop + a `.filterDrawerButton` mobile path opening a `"pFilter"` popup). The `toggleFilter`/`toggleFilterCategory`/`isOpen` logic and the mobile wiring are triplicated (~500 lines total).

The differences are narrow:
- **Selection state shape** — People/Places store a concatenated string of single-letter codes per axis (`"NBJ"`); Matters stores a `Set` of multi-char tags per axis. *This is the crux.*
- **Options source** — People/Places build inline `filterSections` (labels are JSX with colored-dot icons); Matters imports `filterAxes` from `mattersFilterData.js` (labels via i18n key).
- **Axis count** (3/3/5), heading word (`"filters"` vs `"selectors"`), and the `SearchPopUp` data props.
- **List-filtering logic** (regex substring vs `Set.has`) lives in the parent views, separate from the panel UI.

`views/People/PeoplePlacesFilter.js` is dead (imported nowhere). `SearchPopUp` is already shared.

## Goal

One reusable, **controlled, config-driven** `<FilterPanel>` that owns the axes/toggles, the `SearchPopUp` wiring, and the mobile-drawer path — so each view keeps only its options data, a tiny adapter, and its own list-filtering. Extensibility is data-driven (an `axes` config), not compound/render-prop, because every axis is uniform.

## Architecture

**Location:** `views/_Common/FilterPanel/FilterPanel.jsx` + `FilterPanel.css` (folder, matching `_Common/Breadcrumb/`). Imported as `src/views/_Common/FilterPanel/FilterPanel`.

**Controlled component.** The parent owns filter state (it also uses it to filter the list); the panel renders + emits changes.

### API

- `heading: node` — the `.ppFiltersHeading` text (`"filters"` / `"selectors"`).
- `axes: Array<{ name, title, options: Array<{ tag, label }> }>` — `title` and `label` are **nodes**; each view pre-resolves i18n + icon dots (People/Places keep their JSX labels; Matters passes `label(chip.key) || chip.label`).
- `value: Record<axisName, string[]>` — normalized selected tags per axis. Controlled.
- `onChange(nextValue: Record<axisName, string[]>)` — the panel owns toggle / select-all / clear and emits the **whole** next selection map (all axes); the view stores it, adapting to its native string/`Set`.
- `search?: { placeholder, preLoadData, testFieldNames, assetName, selectItemHandler, initSearchString }` — when present, the panel renders the 🔍 button and wires `SearchPopUp`, owning the `isOpen` state internally. Omit → no search UI.

### Internals absorbed (the dedup)

- The `.ppFilters` / `.ppColumns` / `.lihead` / `.lifoot` / `.item` markup and per-option `BootstrapSwitchButton`.
- `toggleFilter` / `toggleFilterCategory` logic, now on normalized arrays: option checked-state is `value[axis].includes(tag)` (retiring People/Places' `new RegExp(tag).test(...)`); toggle adds/removes a tag; select-all sets the axis to all its tags; clear sets it to `[]`.
- The `SearchPopUp` `isOpen` state.

### Responsive / mobile

The panel calls `isMobile()` internally. Desktop → inline `.ppColumns` panel. Mobile → the `.filterDrawerButton` (a "Filters" button + mobile 🔍) that opens the existing `"pFilter"` popup rendering the panel in inline mode. The mobile path is owned here, not re-wired per view.

**Integration point to confirm in the plan:** the `"pFilter"` popup contract in `views/_Common/PopUp.js` — how it receives and renders the panel content — so `FilterPanel` can drive it via `useAppController().functions.setPopUp(...)`.

## Per-view adapters

The panel speaks normalized arrays; each view converts at the edge and keeps its own state + list-filtering. The `search` field each view tracks separately is carried through untouched by the adapter.

**People** (`identification`/`classification`/`unit`, letter-code strings):
```jsx
const axes = [sections.identification, sections.classification, sections.unit].map(s => ({
  name: s.key, title: s.title,
  options: s.filters.map(f => ({ tag: f.tag, label: f.label })),
}));
const value = {
  identification: (peopleFilters.identification || "").split(""),
  classification: (peopleFilters.classification || "").split(""),
  unit:           (peopleFilters.unit || "").split(""),
};
const onChange = next => setFilter({
  ...peopleFilters,
  identification: next.identification.join("") || null,
  classification: next.classification.join("") || null,
  unit:           next.unit.join("") || null,
});
<FilterPanel heading={label("filters")} axes={axes} value={value} onChange={onChange}
  search={{ placeholder:"search_for_a_person", preLoadData:personList,
            testFieldNames:{primary:"name",secondary:"title"}, assetName:"people",
            selectItemHandler, initSearchString }} />
```

**Places** — the same adapter; only the axis keys (`occupants`/`location`/`type`), `heading={label("selectors")}`, and search props (`search_for_a_place`, `{primary:"name",secondary:"info"}`, `"places"`) differ.

**Matters** (Sets, multi-char tags):
```jsx
const axes = filterAxes.map(a => ({
  name: a.name, title: label(a.title) || a.titleEn,
  options: a.chips.map(c => ({ tag: c.tag, label: label(c.key) || c.label })),
}));
const value = Object.fromEntries(filterAxes.map(a => [a.name, [...matterFilters[a.name]]]));
const onChange = next => setFilter({
  ...matterFilters,
  ...Object.fromEntries(filterAxes.map(a => [a.name, new Set(next[a.name])])),
});
<FilterPanel heading={label("selectors")} axes={axes} value={value} onChange={onChange}
  search={{ placeholder:"search_for_a_matter", preLoadData:matterList,
            testFieldNames:{primary:"name",secondary:"subtitle"}, assetName:"matters",
            selectItemHandler, initSearchString }} />
```

Each view loses ~120–190 lines (panel markup + toggle/select-all/clear + `isOpen` + mobile wiring), keeping only its options data, a ~6-line adapter, and its existing list-filtering.

## CSS & dark mode

**Relocate, keep the class names.** Move the filter-panel base rules from `People/People.css` into a new `FilterPanel.css` (imported by `FilterPanel.jsx`), keeping the exact selectors: `.ppFilters`, `.ppColumns`, `.ppFiltersHeading`, `.lihead`, `.lifoot`, the filter-scoped `li.item`, `.ppFiltersSearchButton`, `.ppFiltersSearchButtonMobile`, `.filterDrawerButton`, and the `BootstrapSwitchButton` overrides.

**Why keep the names:** the dark-mode overrides in `assets/theme/scss/darkmode/_lists.scss` (`h5.ppFiltersHeading`, `.lifoot .btn`) match those exact selectors and use the app's global semantic tokens (`--text-secondary`, `--control`, `--border-strong`). Keeping the names means **dark mode needs no changes and nothing is orphaned** — avoiding the failure mode hit when renaming breadcrumb classes. A `.filterPanel-*` rename is deferred as an optional cosmetic pass.

**Cleanup:**
- `FilterPanel.jsx` imports `FilterPanel.css`; panel styles travel with the component.
- Remove the relocated rules from `People.css`; keep the rest (`.dot` label icons, `.personCard`, etc.).
- `Places.js`/`Matters.js` import `../People/People.css` today — keep only if they still need non-filter bits (e.g. `.dot`); the plan verifies and trims.
- Reconcile the two stray references found by grep: `_Common/Main.css` `.item` (likely a generic, unrelated rule — leave) and `_Common/Drawer.css` `.filterDrawerButton` (confirm it isn't a conflicting duplicate).

## Testing

`FilterPanel/FilterPanel.test.jsx` (React Testing Library; mock `isMobile`, `SearchPopUp`, `BootstrapSwitchButton`, `useAppController`, `label`):
- Renders each axis's title + options; option checked-state reflects `value[axis].includes(tag)`.
- Clicking an unchecked option → `onChange` with that tag added to the axis; a checked one → removed.
- Select-all → `onChange` with all of that axis's tags; Clear → `[]` for that axis; other axes untouched.
- `search` present → renders 🔍 and opens `SearchPopUp` (panel owns `isOpen`); absent → no button.
- `isMobile()` true → renders `.filterDrawerButton` instead of the inline `.ppColumns`.

The three migrations are behavior-preserving; each PR gets a manual parity check on `localhost:8200` (desktop + mobile width + dark mode), confirming the list actually filters as before. Verify against `localhost:8200`, not `bom.kckern.net` (CDN-cached bundle).

## Rollout

One PR per row; each behavior-preserving:

| Step | Change |
|---|---|
| 1 | Build `FilterPanel` + tests; relocate CSS from `People.css` → `FilterPanel.css`. |
| 2 | Migrate **People** → `<FilterPanel>` + adapter. |
| 3 | Migrate **Places** → `<FilterPanel>` + adapter. |
| 4 | Migrate **Matters** → `<FilterPanel>` + adapter. |
| 5 | Delete dead `views/People/PeoplePlacesFilter.js`; trim now-unused `People.css` imports. |

## Documentation

- JSDoc header on `FilterPanel.jsx` (props, the normalized-array contract, the `search` config).
- `docs/reference/filter-panel.md`: the API, the array-normalization contract, the string/`Set` adapter recipes, and the retained class names — the reusable pattern the next data-driven design-system component copies.

## Non-goals

- No change to list-filtering logic — views keep their regex (People/Places) and `Set.has` (Matters) matching; the panel manages selection only.
- No change to `SearchPopUp` internals — the panel only wires it.
- No `.filterPanel-*` rename / token re-key in this effort (deferred cosmetic follow-up).
- No change to the Next.js app.
