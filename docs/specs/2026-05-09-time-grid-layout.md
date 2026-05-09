# TimeGrid — grid-based timeline visualization (alternative to current Timeline)

**Status:** Abandoned init spike. ~90 lines of skeleton; no real data integration.
**Source:** `origin/TimeGrid` branch, single commit `6db2c7b "Init TimeGrid"` (2024-02-16).
**Branch deletion plan:** Branch will be removed; this spec is the record.

## Concept

A **grid-based** timeline visualization: instead of the existing horizontal `Timeline.js` (linear scrubber over years), render time as a 2-D matrix of cells (40 cols × 100 rows in the spike). Events occupy contiguous rectangular regions of the grid, with rounded corners controllable per-corner. Think of it as a spreadsheet view of history where overlapping/parallel events naturally stack visually.

## Why it might matter

- Linear timelines compress poorly when events overlap heavily (as they do throughout BoM history — multiple kingdoms, parallel migrations, concurrent revelations).
- A 2-D grid lets parallel storylines occupy different rows without obscuring each other.
- Rectangular events with per-corner radii allow nuanced visual encoding ("this event flows into the next" → shared rounded corner; "discrete event" → all four corners rounded).
- Could complement, not replace, the existing `Timeline.js`.

## What was built (in the abandoned commit)

- New file `frontend/webapp/src/views/Timeline/TimeGrid.js` (~90 lines).
- Three components: `timeGridWrapper`, `TimeGrid` (the grid renderer), `TimeGridCell`, `TimeGridCellContent`.
- Hardcoded 40×100 grid of empty cells.
- Hardcoded sample data: one red square at `xywh: [1,1,10,5]` with all four corners rounded at 50%.
- Cell-level rendering supports `back` (cell background color), `fore` (filled rectangle inside the cell), and `borderRadius` per-corner expressed as percentages.
- Route registration in `Routes.js` so the page is reachable.
- New `TimeGrid.css` (17 lines, basic grid styling).

What was **not** built:
- No data wiring to the actual BoM event corpus.
- No legend, no scale indicators, no zoom/pan.
- No accessibility (keyboard nav, ARIA).
- No interactivity (click to view event, hover for details).

## Why it didn't ship

- Spike-level: title is "Init TimeGrid", clearly an exploratory prototype.
- 27 months stale (Feb 2024 → today).
- Dev has the existing `Timeline.js` / `Timeline.css` which the team has continued investing in. TimeGrid was a parallel design exploration, never integrated.

## How to pick this up later

The grid-rendering primitive is straightforward enough to rebuild from scratch in <100 lines; the value here is the **design idea**, not the abandoned code. To revive:

1. **Data shape first.** Decide what `events` looks like:
   ```ts
   type Event = {
       id: string;
       row: number;           // which "track" / parallel storyline
       startCol: number;      // start time column
       endCol: number;        // end time column
       label: string;
       color: string;
       refs?: VerseRef[];     // links to scripture
       corners?: { tl?, tr?, bl?, br? };  // for connecting adjacent events
   };
   ```
   The `xywh` in the spike conflates position with size; explicit `start/end` is clearer.
2. **Decide axis semantics.** X-axis = time (BCE → AD), Y-axis = … what? Geography (Lands of Nephi/Zarahemla/etc.)? Lineage (Nephite/Lamanite/Jaredite)? Pick one and document it.
3. **Use the existing event data.** `BomMapStory`, `BomNarration`, `BomTimeline` models in the backend already hold timeline-relevant events. Don't re-collect.
4. **Compare to the existing Timeline.** Decide if TimeGrid replaces it, augments it (toggle), or is a different page. The spike was at `/timegrid`; could be a view-mode toggle on `/timeline`.
5. **Performance.** 40×100 = 4000 cells render fine, but a real BoM timeline (hundreds of years × dozens of tracks) will need virtualization. The original cell-by-cell `cellData.find(...)` is O(N²) per render — replace with a map keyed by `${col},${row}`.
6. **Accessibility.** A grid view is a hard target for screen readers; pair it with a list-view fallback (the existing Timeline could *be* that fallback).

## Out of scope

- Animation between time-slices. Cool but not the MVP.
- Editing / drag-drop authoring. This is a read-only visualization.

## Appendix: Original `TimeGrid.js` (verbatim, from `6db2c7b`)

The whole spike is small enough to embed. The interesting bits are: (a) the `xywh + corners` data shape for events, (b) the per-corner radius rendering (top-left/top-right/bottom-left/bottom-right percentages), (c) the cell-by-cell rendering pattern. The rest is scaffolding worth re-implementing fresh.

```jsx
import React from 'react';
import "./TimeGrid.css";

function timeGridWrapper() {
    return (
        <div className="time-grid-wrapper container">
            <h1>TimeGrid</h1>
            <TimeGrid />
        </div>
    );
}

function TimeGrid() {
    const cols = 40;
    const rows = 100;
    const cells = Array.from({ length: cols * rows }, (_, i) => {
        const x = i % cols;
        const y = Math.floor(i / cols);
        return [x, y, {}];
    });
    return (
        <div className="time-grid">
            {cells.map((cell, i) => <TimeGridCell key={i} x={cell[0]} y={cell[1]} />)}
        </div>
    );
}

// Event data shape: each square has a position+size and per-corner border radii.
// Corners can be 0 (square corner), >0 (rounded). Use 0.5 for hemicircle ends.
const squares = [
    { xywh: [1, 1, 10, 5], color: "#F00", corners: { tl: 0.5, tr: 0.5, bl: 0.5, br: 0.5 } },
];

// Flatten squares to a per-cell map. NB: this is O(N²) and should be a
// `Map<\`${x},${y}\`, cellData>` lookup at production scale.
const cellData = squares.reduce((acc, square) => {
    const [x, y, width, height] = square.xywh;
    for (let i = x; i < x + width; i++) {
        for (let j = y; j < y + height; j++) {
            const isTopLeft = i === x && j === y;
            const isTopRight = i === x + width - 1 && j === y;
            const isBottomLeft = i === x && j === y + height - 1;
            const isBottomRight = i === x + width - 1 && j === y + height - 1;
            const radius = {};
            if (isTopLeft && square.corners.tl) radius.tl = square.corners.tl;
            if (isTopRight && square.corners.tr) radius.tr = square.corners.tr;
            if (isBottomLeft && square.corners.bl) radius.bl = square.corners.bl;
            if (isBottomRight && square.corners.br) radius.br = square.corners.br;
            acc.push([i, j, { back: null, fore: square.color, borderRadius: radius }]);
        }
    }
    return acc;
}, []);

function TimeGridCell({ x, y }) {
    let [, , item] = cellData.find(d => d[0] === x && d[1] === y) || [0, 0, {}];
    item = item || {};
    const style = {};
    if (item.back) style.backgroundColor = item.back;
    return (
        <div className="time-grid-cell" {...style}>
            {item.fore && <TimeGridCellContent {...item} />}
        </div>
    );
}

function TimeGridCellContent({ fore, borderRadius }) {
    const radius = Object.keys(borderRadius).reduce((acc, key) => {
        const value = borderRadius[key];
        if (!value) return acc;
        if (key === "tl") acc.borderTopLeftRadius = `${value * 100}%`;
        if (key === "tr") acc.borderTopRightRadius = `${value * 100}%`;
        if (key === "bl") acc.borderBottomLeftRadius = `${value * 100}%`;
        if (key === "br") acc.borderBottomRightRadius = `${value * 100}%`;
        return acc;
    }, {});
    return (
        <div className="time-grid-cell-content" style={{ backgroundColor: fore || "#FFF", ...radius }} />
    );
}

export default timeGridWrapper;
```

Companion `TimeGrid.css` was 17 lines of `display: grid; grid-template-columns: repeat(40, 1fr);` plus cell sizing — trivial to recreate.
