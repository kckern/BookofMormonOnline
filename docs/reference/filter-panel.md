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

## Adapter recipe (native state <-> normalized arrays)

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
