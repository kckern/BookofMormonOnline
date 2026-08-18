# Lost 116 Pages archive + placeholder tile

**Date:** 2026-08-18
**Status:** Design approved, pending spec review
**Scope:** Frontend only (`frontend/webapp/`). No backend changes.

## Goal

Surface the newly added `lost-116-pages` history archive (24 documents, already in
`bom_xtras_history` in `bom_prd`) on the `/history` landing hub as a live, clickable
collection — showcased immediately. At the same time, add a sixth tile as a visible
"coming soon" placeholder for a future archive, tentatively **Joseph Smith in New York**.

The hub grid grows from four tiles to six, in this order:

```
Joseph Smith · The Witnesses · Translation Process
Reception History · The Lost 116 Pages (live) · Joseph Smith in New York (coming soon)
```

## Context

- The `/history` hub is rendered by `HistoryHub.jsx`, driven by the single source of
  truth `HISTORY_SECTIONS` in `sections.js`.
- Archive detail views are a thin wrapper over the archive-generic
  `HistoryArchiveFeed` component. `TranslationSources.jsx` is the canonical one-liner:
  `<HistoryArchiveFeed archive="translation" sectionKey="translation" />`.
- `HistoryArchiveFeed` provides, for free: chronological year/decade grouping, the
  "Voice" (principal) filter, money-quote cards (`HistorySourceCard`), breadcrumb,
  and the history popup wiring.
- The backend `history` loader filters by a parameterized `archive` equality with **no
  allowlist** (`backend/src/data/loaders/searchhist.ts:433`), so `lost-116-pages`
  flows through the exact code path `reception` / `translation` /
  `joseph-smith-statements` already use.
- `sections.test.js` already anticipates `status: "placeholder"` as a valid value and
  `placeholder` as a valid hero type — the placeholder concept was pre-seeded but never
  populated. `LostPages.js` exists as an empty stub file.
- All 24 `lost-116-pages` rows have `id: null` (no thumbnails on the asset host), so the
  hero cannot use a real thumbnail yet.

## Design

### 1. `LostPages.js` — fill the empty stub

Mirror `TranslationSources.jsx`:

```jsx
/** @format */
import React from "react";
import HistoryArchiveFeed from "./HistoryArchiveFeed";

export default function LostPages() {
  return <HistoryArchiveFeed archive="lost-116-pages" sectionKey="lostPages" />;
}
```

### 2. `Routes.js` — register the detail route

- Add `const LostPages = lazy(() => import("../views/History/LostPages.js"));`
- Add the route **before** the `/history/:slug` catch-all (which redirects unmatched
  single-segment slugs to `/history/reception/:slug`):

```js
{ path: "/history/lost-116-pages", component: LostPages },
```

### 3. `sections.js` — two new registry entries

Appended after `reception`, preserving display order = array order.

**Live:**
```js
{
  key: "lostPages",
  title: "The Lost 116 Pages",
  path: "/history/lost-116-pages",
  icon: manuscriptIcon,            // facsimiles.svg
  blurb: "The lost Book of Lehi manuscript — what it contained and how it vanished.",
  unit: "documents",
  status: "live",
  hero: { type: "randomThumb", archive: "lost-116-pages" },
  archive: "lost-116-pages",
},
```
Rationale for `randomThumb`: it auto-upgrades to a real thumbnail if/when any row gets
an `id`, and today falls back gracefully to the section `icon` placeholder (the hub's
`Hero` component already does this fallback when `pick.id == null`).

**Placeholder:**
```js
{
  key: "josephNewYork",
  title: "Joseph Smith in New York",
  path: "/history/joseph-smith-new-york",   // reserved; not routed yet
  icon: josephIcon,                          // prophet.svg (already imported)
  blurb: "The prophet's early years and the coming forth of the record in New York.",
  unit: "documents",
  status: "placeholder",
  hero: { type: "placeholder", icon: josephIcon },
},
```

Add one icon import for the manuscript glyph:
`import manuscriptIcon from "src/views/_Common/svg/facsimiles.svg";`

### 4. `HistoryHub.jsx` — render the two states

- Add `lostPages: "lost-116-pages"` to `ARCHIVE_BY_KEY` so the live tile fetches its
  count + quote sampler. Do **not** add `josephNewYork` (no archive to fetch).
- Branch in the `Card` render on `section.status === "placeholder"`:
  - Render a non-clickable container (`<div>`, not `<Link>`) with class
    `historyCard historyCard--placeholder`.
  - Show the hero, title, blurb, and a `COMING SOON` badge.
  - Omit the signal line and the `Sampler` (no archive fetch, no quote).
- Update the masthead lede copy:
  - From: `Four collections tracing the record from its coming forth to its reception in the world.`
  - To:   `Five collections tracing the record from its coming forth to its reception in the world — with more on the way.`

### 5. `HistoryHub.css` — placeholder styling

- `.historyCard--placeholder`: muted treatment (reduced opacity / neutral gray),
  `cursor: default`, no hover lift.
- `.historyCard-badge`: small uppercase "COMING SOON" chip. Use house-style neutral
  gray, not the disallowed `#345496` blue (see house-style memory); gold accent
  `#c9a24b` acceptable if an accent is wanted.

### 6. Tests

The two files are **not** duplicates — they assert different things; both must stay green.

**`sections.test.js`** (root) — has a strict `.toEqual([...])` registry-order test that
  will fail once tiles are added. Update it to the six keys, in order:
  `["josephSmith", "witnesses", "translation", "reception", "lostPages", "josephNewYork"]`.
  Its "every section has required display + hero fields" test already covers
  `live`/`placeholder` status and the four hero types (including `placeholder`) — no change
  needed there. Add assertions: `getSection("lostPages").status === "live"` with
  `hero.archive === "lost-116-pages"`; `getSection("josephNewYork").status === "placeholder"`
  with `hero.type === "placeholder"`.

**`__tests__/sections.test.js`** — uses `length >= 4` and per-section
  `key/title/path/icon/blurb/status` presence checks; the new entries satisfy these
  (both carry an `icon`), so it needs no structural change. Optionally extend its
  "…are live" test to also assert `getSection("lostPages").status === "live"`.

## Out of scope

- The `josephNewYork` archive itself (no DB rows, no detail view, no route wired). The
  placeholder is display-only.
- Backfilling the 14 missing `transcript` values and 5 missing `source` values on
  `lost-116-pages` rows (a separate data task; the rows already have teasers and
  money-quotes, so the view is presentable now).
- Thumbnail generation for `lost-116-pages` (hero degrades gracefully to the icon).

## Acceptance criteria

1. `/history` shows six tiles in the specified order.
2. The "The Lost 116 Pages" tile is clickable, shows a live count + date-range signal
   and a real money-quote sampler, and navigates to `/history/lost-116-pages`.
3. `/history/lost-116-pages` renders all 24 documents, chronologically grouped, with a
   working "Voice" filter and openable money-quote cards.
4. The "Joseph Smith in New York" tile renders greyed with a COMING SOON badge and is
   not clickable.
5. The masthead lede reflects the new count.
6. `sections.test.js` (both copies) pass with the updated registry.
