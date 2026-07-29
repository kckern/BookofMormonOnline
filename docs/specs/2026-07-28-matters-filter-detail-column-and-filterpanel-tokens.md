# Matters filter: two-level detail column + FilterPanel design-system pass

**Date:** 2026-07-28
**Status:** Approved (design), pending implementation plan
**Views touched:** Matters (behavior + layout), People / Places (token re-express only, no visual change)

## Problem

The Matters filter's right column currently flattens forms and their subforms into one
long switch list. For a busy Kind like "Made Things" that is 35 switches — too tall and
noisy. Separately, the three filter panels (People, Places, Matters) all render through
the shared `FilterPanel.jsx`, yet Matters rows look cramped: the row rhythm in People/Places
is an accident of each row carrying a `1.5em` image, not an intentional shared rule. There
is also dead CSS (`.ppAxisHead/.ppAxisTitle/.ppAxisCount/.ppAxisActions`) referenced by no JSX.

## Goals

1. Replace the flattened detail list with two real levels: **form switches**, and per ON
   form a revealed row of **subform chips**.
2. Subform chips behave as **radio, scoped per form** (see Decisions).
3. Cap the form list height with a **Show more (N)** expander.
4. Put filter-panel spacing/accent on **shared CSS tokens** so all three panels are
   consistent by construction, not by copy-paste. Delete the dead `.ppAxis*` CSS.

## Non-goals

- No change to the visual appearance of People/Places beyond the one intentional shared
  row-gap. Tokens re-express current values.
- No change to Era & Culture / Kind / Prominence axes' vocabulary or ordering.
- No backend changes.

## Decisions

### D1 — Subform exclusivity is per-form, not global
A radio group's exclusivity should match its visual grouping. The chips sit indented under a
single form's row, so that form's chips are their own radio group:
- Click a subform → selects it, deselects the previously-active subform **for that form only**.
- Click the active subform again → clears it (form falls back to form-level match).
- Each ON form has an independent radio group; two forms may each have an active subform.

Rejected: one global active subform. It silently clears a selection under another (possibly
scrolled-out) form — a least-astonishment violation and higher cognitive load.

### D2 — Show-more caps the primary (form) rows
Cap ≈ 10 form rows. Collapsed view always renders **every selected form first** (never hide
an active filter), then fills up to the cap with unselected forms. `Show more (N)` reveals the
remainder; the control toggles back to collapsed. Revealed subform chip rows under a visible
selected form always render and do not count against the cap.

### D3 — FilterPanel stays generic; Matters owns the cascade
FilterPanel gains one optional prop, `extraColumn` (a React node), rendered as a peer inside
`.ppColumns` after the axis columns. All cascading/show-more logic lives in a new
`MatterDetailColumn` component. No Matters-specific knowledge enters FilterPanel.

### D4 — Full token pass, values-preserving
Introduce CSS custom properties scoped to `.ppFilters` and re-express existing values through
them, so People/Places are visually unchanged except the shared row gap.

## Component & data design

### FilterPanel.jsx
- New optional prop `extraColumn?: ReactNode`.
- Render order inside `.ppColumns`: `axes.map(renderAxis)` then, if present, `extraColumn`.
- No other behavior change. `value`/`onChange` continue to cover only the axes FilterPanel
  itself renders; the extra column is self-contained and calls `setFilter` directly.

### MatterDetailColumn.jsx (new)
Props: `{ matterFilters, setFilter }`.
- Reads selected Kinds (`matterFilters.form_group`) → forms via `formsByGroup`, deduped,
  group order preserved.
- Renders each form as a FilterPanel-style switch row (reusing `.ppFilters ul` / `li.item`
  classes + tokens so it reads as native).
- For each ON form (`matterFilters.form.has(formTag)`), renders that form's `subformsByForm`
  entries as a chip row beneath, single-select per D1.
- Show-more per D2 over the form rows.
- Toggling a form off clears its subform (delegated to the Matters prune, see below).
- Column heading mirrors the axis heading style ("Detail").

### mattersFilterData.js
- Keep `formsByGroup`, `subformsByForm`.
- Add `subformParent`: `{ [subformTag]: formTag }`, derived from `subformsByForm`, for the
  predicate. (Replaces the flattened `detailOptionsForGroups`, which is removed along with
  `detailAxis`.)
- `filterAxes` right-hand default stays Prominence.

### Matters.js
- `emptyFilters`: `{ era_culture, form_group, prominence, form, subform_label, search }`
  (drop `detail`).
- Right column wiring: when `form_group` is empty, pass Prominence as the third axis (current
  behavior). When non-empty, pass only Era & Culture + Kind axes to FilterPanel and pass
  `<MatterDetailColumn>` as `extraColumn`.
- **Prune** (in `setFilter`):
  - Kind empty → clear `form` and `subform_label`, and (as today) leave Prominence usable.
  - Kind non-empty → clear Prominence; drop `form` entries not reachable from selected kinds;
    drop `subform_label` entries whose parent form is no longer selected.
- **Predicate** (`passesFilters`), AND across axes:
  - `era_culture`, `form_group`: item field ∈ set (if set non-empty).
  - Detail (OR across forms): if `form` set non-empty, `item.form ∈ form`. Then for the item's
    form, if any selected `subform_label` has `subformParent === item.form`, require
    `item.subform_label` to equal it. (Per-form ≤1 subform makes this a single value.)
  - Prominence: only when Kind empty (bucket over `nrefs`).

### FilterPanel.css tokens
Scoped to `.ppFilters` (so they don't leak globally):
- `--pp-row-gap` — vertical gap between `.ppColumns li.item`. New shared rule; the one
  intentional visual change (applies to all three panels).
- `--pp-col-gap` — gap between axis columns (currently ~0 via 33% widths; token-express).
- `--pp-pad` — panel padding (currently `1em`).
- `--pp-accent` — switch/active accent (currently bootstrap success green `#198754`/`#28a745`).
Re-express existing People/Places rules through these tokens; delete the dead `.ppAxis*` block.

## Acceptance criteria

- Selecting a Kind shows form switches in the right column; no flattened 35-item list.
- Turning on a form reveals its subform chips; picking a second subform under the same form
  replaces the first; picking one under a different form leaves the first intact.
- With enough forms, only ~10 rows show with a working `Show more (N)`; selected forms are
  never hidden while collapsed.
- People and Places render pixel-equivalent to before except consistent row spacing; Matters
  row spacing now matches them.
- No JSX references removed `.ppAxis*` classes / `detailAxis` / `detailOptionsForGroups`.
- Frontend compiles with no new warnings/errors.

## Rollout

Dev only (`localhost:8200` for verification; `bom.kckern.net` is Cloudflare-cached). No DB or
backend deploy.
