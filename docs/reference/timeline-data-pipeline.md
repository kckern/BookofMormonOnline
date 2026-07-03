# Timeline Data Pipeline — Source of Truth

The `/timeline` view renders two baked JSON artifacts. This document is the
authoritative statement of **what generates each, what the source of truth is
now, and how to change them safely.** Read this before touching any timeline
data or re-running any `scripts/timeline-grid/*.py` generator.

## `frontend/webapp/src/views/Timeline/gridTiles.json` — FROZEN ARTIFACT

The canvas layer: territory band fills, shape tiles (bevel/grad/fade/break),
the date axis. Shape: `{ cols, rows, tiles: [{r,c,w,h,bg,k,dir,from,to,rd,sq,...}], dateAxis }`.

- **Nominal generator:** `scripts/timeline-grid/build_tiles.py`, which parses an
  **out-of-repo spreadsheet** (`~/Downloads/Timeline Grid/Sheet1.html`) plus
  `labels.json` and `overrides.json`.
- **Source of truth NOW: this committed file.** During the 2026-07 design pass
  the canvas was extensively hand-edited (interior negative-space holes filled
  with territory color, gold Zarahemla void closed, record-keeper connector band
  made continuous, two-color bevels, wedge-relevant cells, apex-battle spans).
  None of that lives in the spreadsheet.
- **DO NOT re-run `build_tiles.py` to regenerate the shipped canvas** — it would
  discard the design polish and also re-emit in compact (`separators=",",":"`)
  format, whereas the shipped file is pretty-printed (`indent=2`). The script is
  retained for history / a hypothetical from-scratch rebuild only.
- **To change the canvas:** edit `gridTiles.json` directly (it is the source),
  keep `indent=2` formatting, and re-run the timeline unit tests + a screenshot
  diff. There is no regeneration step to keep in sync.

## `frontend/webapp/src/views/Timeline/timelineData.json` — REGENERABLE

The event/label/marker layer: `{ events: [{slug, heading, label, date, html,
kind, p, textSlug, text, grid:{row,col,rowSpan,colSpan,bg,bgTo,dir,anchor,tier,
icon,rd,sq,wedge,chip}}] }`.

- **Generator:** `scripts/timeline-grid/gen_timeline_data.py` =
  GraphQL dump (`:5006/graphql`) + `battleTiles.json` (icon-events) +
  `scripts/timeline-grid/data-overrides.json` (deep-merged; scalars overwrite,
  `grid` per-key, `+new` appends whole events).
- **Source of truth for edits: `data-overrides.json`.** Every placement, label,
  icon, span, direction, and merge tweak made during the design pass was mirrored
  into overrides. **Do not hand-edit `timelineData.json`** — edit overrides and
  regenerate, so the change survives the next regen.
- **Regenerate:**
  ```bash
  cd scripts/timeline-grid
  GQL_URL=http://localhost:5006/graphql python3 gen_timeline_data.py
  ```
  Requires the backend on `:5006`. The GraphQL content (headings/html/dates/text)
  is the one input not reproducible offline; overrides carry everything the design
  pass changed on top of it.
- **`label` vs `heading`:** `label` (short, ≤28 chars) is what renders on the
  timeline; `heading` (full, descriptive) is what the popup shows. Keep them
  distinct. `Timeline.js` uses `e.label || e.heading` for the tile, `info.heading`
  for the popover.

## Guard

`scripts/timeline-grid/test_regen_stable.py` asserts every `data-overrides.json`
slug is present in `timelineData.json` with matching grid, so overrides can't
silently drift from the shipped file.
