# /history redesign: section hub + navigation framework

**Date:** 2026-07-29
**Status:** Approved (design), pending implementation plan
**Area:** `frontend/webapp/src/views/History/` + `src/models/Routes.js`

## Problem

`/history` currently *is* the Reception History view — it renders the reception
document grid directly. But the section now also has Witnesses, and Translation
Sources and a broader Joseph Smith section are coming. There's no taxonomy and no
menu: the landing dumps straight into reception history, and Witnesses is a
disconnected sibling route. We need a hub that presents the sections and a
consistent way to navigate them.

## Goals

1. Turn `/history` into a **hub** that presents the sections as a flat set of peers.
2. Establish a **section-page framework** (breadcrumb back to the hub) that both
   existing sections and future ones plug into.
3. Wire the two sections that already have content (Reception, Witnesses) into the
   new structure without changing their internal UIs.
4. Give the two not-yet-built sections (Translation Sources, Joseph Smith) real
   hub tiles that route to a minimal placeholder — so the framework is complete
   and they slot in later by adding content only.

## Non-goals

- Building Translation Sources' data or a fuller Joseph Smith section (each is
  separate future work — its own spec).
- Changing Reception's year-filter grid or Witnesses' groups/profile internals.
- A persistent cross-section menu bar, tabs, or a featured carousel (YAGNI for v1).
- Any backend/GraphQL schema change.

## Decisions

- **Flat taxonomy** — four peer sections, no theme grouping.
- **Hub landing** — `/history` is its own overview page of four tiles, each with a
  big SVG icon, title, one-line description, and a live "featured" preview.
- **Cross-section nav = breadcrumb back to the hub** (`Home › History › [Section]`),
  reusing the existing `Breadcrumb` component. The hub is the switchboard; there is
  no persistent section menu.
- **Featured preview = one randomly-chosen item per section, picked on load** (not a
  carousel). Pulled from the existing GraphQL archives; no new endpoint.

## Section registry (single source of truth)

A config array drives the hub tiles and section metadata, so adding a section later
is a one-entry change:

```
// src/views/History/sections.js
[
  { key: 'translation', title: 'Translation Sources', path: '/history/translation',
    icon: <svg>, blurb: '…', status: 'placeholder', featured: null },
  { key: 'witnesses',   title: 'The Witnesses',       path: '/history/witnesses',
    icon: <svg>, blurb: '…', status: 'live',
    featured: () => /* pick a random witness/source from archive:"witnesses" */ },
  { key: 'reception',   title: 'Reception History',   path: '/history/reception',
    icon: <svg>, blurb: '…', status: 'live',
    featured: () => /* pick a random doc from archive:"reception" */ },
  { key: 'josephSmith', title: 'Joseph Smith',        path: '/history/joseph-smith',
    icon: <svg>, blurb: '…', status: 'placeholder', featured: null },
]
```

Order = display order = the "priority" call (currently narrative: coming-forth →
aftermath). Reorder by reordering the array.

## Routing

Matched top-down in the existing `<Switch>`; specific paths before generic, with
`exact` where needed (details in the plan).

| Route | Renders | Change |
|---|---|---|
| `/history/witnesses/:witness?/:source?` | `Witnesses` | unchanged |
| `/history/joseph-smith` | `JosephSmith` (placeholder) | unchanged route; view redressed |
| `/history/translation` | `TranslationSources` (placeholder) | **new** |
| `/history/reception/:slug?` | `History` (reception grid) | **new — moved off root** |
| `/history/:slug` | redirect → `/history/reception/:slug` | **new — back-compat** |
| `/history` | `HistoryHub` | **changed** (was `History`) |

The back-compat redirect keeps existing single-segment reception deep-links working.
`History.js` gains no new behavior beyond reading its slug from the new route param.

## Components / files

- **`HistoryHub`** (new, `src/views/History/HistoryHub.jsx` + `.css`) — renders the
  tiles from the section registry. Live tiles fetch a featured item; placeholder
  tiles render a "coming soon" state in the same shell. Title/intro at top.
- **`HistoryBreadcrumb`** (new, small) — wraps the existing `Breadcrumb` as
  `Home › History › [Section]`, taking the current section from the registry.
  Rendered at the top of Reception, Witnesses, Translation, and Joseph Smith pages.
- **`TranslationSources`** (new placeholder) — breadcrumb + heading + "coming soon".
- **`sections.js`** (new) — the registry above; imported by the hub and breadcrumb.
  Each entry needs a **tile SVG icon**: reuse the existing history menu icon where
  it fits and add simple inline SVGs for the rest (the plan picks the four).
- **`JosephSmith.js`** — redressed from bare portrait to the placeholder shell
  (breadcrumb + heading + coming-soon), matching Translation.
- **`Routes.js`** — the route changes above.
- **`History.js`** / **`Witnesses.js`** — add the breadcrumb at the top; Reception
  also reads its slug from `/history/reception/:slug`. No other internal changes.

## Featured preview

Each live section exposes a `featured()` that returns one item to preview (image +
short label + deep link into the section). Reception: a random doc from
`archive:"reception"`. Witnesses: a random witness (or a source with a money quote).
Chosen once per hub load (random index; no timers). Placeholder sections show no
featured item — just the icon, title, blurb, and a muted "coming soon" tag.

## Acceptance criteria

- `/history` renders four tiles (icon + title + blurb); Reception & Witnesses tiles
  show a featured item, Translation & Joseph Smith show "coming soon".
- Clicking a tile routes to its section; each section page shows the breadcrumb and,
  for the two live sections, its existing UI unchanged beneath it.
- `/history/reception` shows the reception grid; an old `/history/<docslug>` link
  redirects to `/history/reception/<docslug>` and still opens that document.
- `/history/translation` and `/history/joseph-smith` show the placeholder shell.
- No console/route errors; frontend compiles clean; no backend changes.

## Deferred (future, separate specs)

- Translation Sources content + data model (likely a new document `archive`,
  reusing the Reception grid pattern).
- A fuller Joseph Smith section.
- Optional featured **carousel** and/or a persistent section menu, if wanted later.

## Rollout

Dev only (`localhost:8200`; `bom.kckern.net` is Cloudflare-cached). No DB/backend deploy.
