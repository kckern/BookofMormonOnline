# Faceted filter toolbar — dual main/mini mode for the shared FilterPanel

**Date:** 2026-08-09
**Scope:** `FilterPanel` (shared by People, Places, Matters) gains a compact "mini"
faceted-toolbar mode alongside the existing "main" expanded-columns mode.

## Goal

The index filter panels are tall and always fully expanded. Add a **mini** mode —
a sticky, compact toolbar of per-axis dropdown buttons with count badges + popovers —
as the **default**, with a **⤢ Expand** toggle to the classic **main** columns. The
choice persists per view. Desktop only; mobile keeps its existing drawer.

## UX

```
MINI (default):
[Era & Culture ▾] [Kind · 1 ▾] [Category · 1 ▾] [🔍]   5 results · Clear all · ⤢ Expand
      click ▼ one popover at a time (click-away / Esc / Done closes)
   ┌ Kind ──────────────┐
   │ Select all · Clear │
   │ ☑ Society          │
   │ ☐ Natural World    │
   │ (Matters: Form/Subform detail folds in here when a Kind is on)
   └────────────────────┘

MAIN (via ⤢): today's inline columns, unchanged, + a ⤢ Collapse control.
```

## Component changes — `FilterPanel.jsx` / `.css`

New props (all optional, backward-compatible):
- `resultCount?: number` — shown as "N results" in the toolbar tail.
- `extraColumnAxis?: string` — the axis whose popover hosts `extraColumn` (Matters
  passes `"form_group"`; the detail column folds into the Kind popover in mini mode
  and renders as a peer column in main mode, as today).

State:
- `mode` ∈ {`"mini"`,`"main"`}, initialized from `localStorage["fpMode:"+assetName]`,
  default `"mini"`. Toggling persists it. Guarded try/catch.
- `openAxis` — which axis popover is open (one at a time). `null` = none.

Rendering:
- Extract the current per-axis option list (switches + Select-all/Clear) into a
  `renderAxisList(axis)` helper reused by both modes.
- **Mini:** a `.fpToolbar` of `.fpAxisWrap` → `<button aria-expanded>` (title +
  `.fpBadge` count when `value[axis].length`) + `.fpPopover` (rendered when open,
  containing `renderAxisList(axis)` and, if `extraColumnAxis===axis.name`,
  `extraColumn`). Tail: 🔍 search button, `resultCount`, **Clear all**
  (`onChange` with every axis → `[]`; Matters' `setFilter` cascade then also clears
  form/subform), **⤢ Expand**.
- **Main:** the existing `.ppColumns` block + a **⤢ Collapse** control.
- Popover dismissal: `mousedown` outside `.fpAxisWrap.open` closes; `Escape` closes
  and returns focus to the trigger; opening focuses the first control.
- **Mobile** (`isMobile()`): unchanged drawer path.

## Parent wiring (one line each)
- `Matters.js` → `<MattersFilter … />` already; `MattersFilter` passes
  `resultCount={filtered.length}` and `extraColumnAxis="form_group"` to FilterPanel.
- `People.js`, `Places.js` → pass `resultCount={<their filtered count>}`.

## Tests — `FilterPanel.test.jsx`
- Default is now mini: update "renders each axis title/options" to open the axis
  popover first (button by title → options visible). Keep checked-state/toggle/
  select-all/clear tests, driving through the popover.
- Add: badge shows selected count; **Clear all** empties every axis; **⤢ Expand**
  reveals `.ppColumns`; `resultCount` renders; one-popover-at-a-time; Esc closes.
- Mobile tests unchanged.

## Non-goals / accepted scope
- No hard focus-trap (Esc-close + focus-first only).
- Mobile drawer untouched.
- No change to axis/filter data or parent filtering logic.
