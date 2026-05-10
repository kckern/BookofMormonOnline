# People Network Chart — force-directed visualization of relationships

**Status:** Abandoned. Most substantial of the abandoned features (11 commits, +1453 lines initial import).
**Source:** `origin/feature_network_chart` branch, 11 commits from 2024-01-06 → 2024-02-13. Initial import: `569f3ef "Library import"`. External contributor: Владислав Бондарчук.
**Branch deletion plan:** Branch will be removed; this spec is the record.

## Concept

A force-directed network diagram (think: Les Misérables character network, gephi-style) showing **people in the Book of Mormon as nodes and their relationships as edges**. Users can hover/click a node to see relationship details, filter by relationship type, and explore who-knew-whom across the narrative.

## Why it matters

- The BoM has hundreds of named people across millennia of history. A name list is unrevealing; a network diagram surfaces clusters (e.g. Lehi's family, the Nephite kings, the four sons of Mosiah), bridges between clusters, and isolated figures.
- Educational use case: students can see how a named figure connects to better-known figures.
- Fits naturally next to existing People views (`frontend/webapp/src/views/People/`).

## What was built (across 11 commits)

### Initial import — `569f3ef "Library import"` (2023-12-30, 1453 lines)
- Adopted **Vega** (`react-vega`) as the rendering library — added to `frontend/webapp/package.json` + lockfile.
- Created `frontend/webapp/src/views/People/PeopleNetwork.js` (260 new lines) with a Vega spec for a force-directed graph: `width/height` signals, `nodeRadius` / `nodeCharge` / `linkDistance` / `static` interactive controls, force-simulation transform.
- Static sample data shipped at `frontend/webapp/public/reldata.json` (338 lines) — relationship dataset (likely Les Misérables sample reused from Vega examples or a placeholder).
- Container size detection via `containerWidth`/`containerHeight` state; resize observer logic.
- New `Network.css` (18 lines) for layout.
- Touched `People.js` (route entry point) and `_Common/PopUp.js` (relationship panel popup).

### Subsequent fixes (10 follow-up commits)
- `57096ec Update Network.css` — visual tuning.
- `3172bcf fix:open filter on mobile` — mobile filter UX.
- `ff04353 bug fix:open filter in Mobile Menu` — same area.
- `4b2806c fix:diagram canvas full size` — sizing fixes.
- `60deb12 fix:detect of vegaBoxElement`, `50fc0cf fix:detect of vegaBoxElement after first render` — DOM-ready timing for the Vega container element.
- `fef985d fix:refactor of useEffect` — cleanup/dependency hygiene.
- `6137b1d fix:tooltip for relationshipPanel` — interactive hover state.
- 2 merge commits from the contributor merging their own branch back into itself (no behavior change).

The branch also touched `StudyChat.js`, `StudyGroupSelect.js`, `StudyHall.js` — likely incidental from rebases or because the network view was meant to embed in a study-group context.

## Why it didn't ship

- 28 months stale — older than most current code in the repo.
- 630 commits behind dev: the React 17 / Read.js / Routes.js / appController surfaces the branch was built against have all moved substantially.
- External contributor; no apparent ongoing engagement.
- The `reldata.json` looks like sample data, not a real BoM relationship dataset — implying the data-collection problem was unsolved.

## How to pick this up later

This is the highest-effort revival of any of the abandoned branches; treat it as a fresh feature with this spec as one input.

1. **Data first, visualization second.** The hardest unsolved problem is *generating the relationship graph* from BoM source data. Look at:
   - Existing `BomPeople`, `BomConnection` (the `_capsulation`/`_connection` models in the database typings) — `BomConnection` is suggestively named.
   - Genealogy / family trees in commentary content.
   - Cross-references from `BomXtrasCommentary`.
   Define a relationship taxonomy (parent, child, sibling, spouse, ally, enemy, teacher, descendant…) before visualization choices.
2. **Library choice.** Vega/Vega-Lite is heavy; alternatives worth considering:
   - **D3 directly** — more flexible, lighter, but more code.
   - **react-force-graph** — purpose-built, ergonomic.
   - **Cytoscape.js** — best for serious network analysis (filters, layouts, search built in).
   The original Vega spec is recoverable as a reference but rebuilding on a more targeted lib will likely be cleaner.
3. **Scope MVP.** Don't try to render every named person at once. Start with:
   - Filter by book (1 Nephi only, Alma only, etc.).
   - Filter by relationship type.
   - Search-to-focus: type a name, graph reorients around that person + N hops.
4. **Mobile.** The original branch had specific mobile-filter fixes — confirms force-directed graphs are tricky on touch. Plan a mobile experience separate from desktop (maybe a list-with-relations view instead of a graph).
5. **Performance.** Force simulation on 200+ nodes is laggy on weak devices. Use `static: true` (pre-computed positions) for the default render, run the simulation only on demand or on filter change.
6. **Integration.** Where does this live?
   - Standalone `/people/network` page (the original branch's approach).
   - Modal/popup launched from a person card (the `PopUp.js` integration in the branch hints at this).
   - Both, ideally.

## Out of scope

- Editing the relationship graph in-app. Authoring belongs in the data layer.
- Time-aware animation (showing the network grow over BoM history). Cool, but a v2.
- Cross-text linking (relationships to figures in other LDS scripture). Not the BoM corpus's job.

## Appendix A: Vega force-directed spec (abbreviated, from `569f3ef`)

The full spec is ~180 lines. This is the structural skeleton — signals (interactive controls), data binding to `reldata.json`, and the force-simulation transform. If the next implementation also chooses Vega, this is a working starting point. If it chooses a different lib (react-force-graph, Cytoscape), the **signals** list documents what controls users had.

```js
const spec = {
    $schema: "https://vega.github.io/schema/vega/v5.json",
    description: "Force-directed character network",
    width: containerWidth,
    height: containerHeight,
    padding: 0,
    autosize: "none",

    // Interactive sliders / checkboxes — exposed to user
    signals: [
        { name: "cx", update: "width / 2" },
        { name: "cy", update: "height / 2" },
        { name: "nodeRadius",   value: 8,   bind: { input: "range", min: 1,    max: 50,  step: 1 } },
        { name: "nodeCharge",   value: -30, bind: { input: "range", min: -100, max: 10,  step: 1 } },
        { name: "linkDistance", value: 30,  bind: { input: "range", min: 5,    max: 100, step: 1 } },
        { name: "static",       value: false, bind: { input: "checkbox" } },
        // … plus `fix`, `node`, `restart` signals for hover/drag interaction
    ],

    // Data sources — separate node and link extraction from one JSON file
    data: [
        { name: "node-data", url: "reldata.json", format: { type: "json", property: "nodes" } },
        { name: "link-data", url: "reldata.json", format: { type: "json", property: "links" } },
    ],

    scales: [
        {
            name: "color",
            type: "ordinal",
            domain: { data: "node-data", field: "group" },
            range: { scheme: "category20c" },
        },
    ],

    marks: [
        {
            name: "nodes",
            type: "symbol",
            zindex: 1,
            from: { data: "node-data" },
            encode: {
                enter: {
                    fill:   { scale: "color", field: "group" },
                    stroke: { value: "white" },
                },
                update: {
                    size:   { signal: "2 * nodeRadius * nodeRadius" },
                    cursor: { value: "pointer" },
                },
            },
            transform: [
                {
                    type: "force",
                    iterations: 300,
                    restart: { signal: "restart" },
                    static:  { signal: "static" },
                    signal: "force",
                    forces: [
                        { force: "center",     x: { signal: "cx" }, y: { signal: "cy" } },
                        { force: "collide",    radius: { signal: "nodeRadius" } },
                        { force: "nbody",      strength: { signal: "nodeCharge" } },
                        { force: "link",       links: "link-data", distance: { signal: "linkDistance" } },
                    ],
                },
            ],
        },
        // … plus a "links" path mark using the force-simulation output
    ],
};
```

## Appendix B: Relationship data shape (from `public/reldata.json`)

The data file shipped in the branch is 338 lines of sample data — likely placeholder, not the real BoM corpus. The shape is what matters:

```json
{
    "nodes": [
        { "name": "Lehi",  "group": 1, "index": 0 },
        { "name": "Sariah", "group": 1, "index": 1 },
        { "name": "Nephi", "group": 1, "index": 2 }
    ],
    "links": [
        { "source": 0, "target": 1, "value": 5 },
        { "source": 0, "target": 2, "value": 4 }
    ]
}
```

`group` colors clusters; `value` weights links (thicker for stronger relationships). For BoM, `group` could be lineage (Nephite/Lamanite/Jaredite/etc.) and `value` could encode relationship type strength. The `index` references in `links` are positional — switch to string IDs (`source: "lehi"`) before scaling, since positional indexing doesn't survive data updates.

## Appendix C: Companion fixes worth knowing about

The 10 follow-up commits weren't trivial bug fixes — they document failure modes the next implementation will hit:

- **DOM-ready timing** (`60deb12`, `50fc0cf`): `vegaBoxElement` wasn't available on first render. Fix: query the element after mount, not during. Use a `useRef` + post-mount measurement.
- **Mobile filter UX** (`3172bcf`, `ff04353`): the slider/filter panel didn't open correctly on mobile. Fix: separate mobile filter behavior from desktop — don't try to render the same filter UI in both.
- **Canvas full-size** (`4b2806c`): Vega container needed explicit width/height; CSS-only sizing doesn't work for `<canvas>`-style elements. Use a ResizeObserver to push container size into Vega via signals.
- **Tooltip on relationship panel** (`6137b1d`): hover state for the side panel was tricky — Vega's hover events fire on the chart, but the tooltip was rendered outside it. Use a portal or shared state.
