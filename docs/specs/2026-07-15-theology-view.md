# Theology View — Interactive Framework (Design / README)

**Status:** scaffold in progress
**View:** `frontend/webapp/src/views/Theology/`
**Source corpus (not yet ingested):** `BoMOnlineWorkspace/theology/` (private) — 39 typed `nodes/`, ~50 `runs/`, system diagrams, README.

## What this is

An interactive, spatial exposition of the Book of Mormon theology framework. **It is not a place to read the book.** The reading corpus (dense prose, matrices, citations) lives in the workspace. This view is a **map you click through**: labels, tooltips, info boxes, drill-downs. The geometry carries the argument; prose is progressive-disclosure on demand.

The framework has a native geometry we render directly:

- **Two-opposition plane** — the core canvas.
  - **Y axis:** Life / Mercy (top) ↔ Death / Justice (bottom).
  - **X axis:** Gathered / Dominion (right) ↔ Scattered / Dispersal (left).
  - Time is *not* an axis — it is the trajectory a soul/people traces through the plane.
- **Four quadrants**, two absorbing and two transient:
  - **Top-right (life + order)** — the Gathering / Zion. *Absorbing, stable.*
  - **Bottom-left (death + scattered)** — Second Death. *Absorbing, static.*
  - **Bottom-right (death + order)** — the Counter-Order (the adversary / Nehor / Gadianton). *Metastable — decays toward bottom-left.*
  - **Top-left (life + scattered)** — the scattered faithful. *Transient — gathered toward top-right.*
- **The descent–ascent funnel (inverted triangle) with vertices** — the Doctrine of Christ read as a V: faith → repentance → baptism-by-water converge *down* to the **baptismal vertex** (the `choice` fulcrum, the die-with-Christ point); baptism-by-fire → endure → salvation rise *out* toward the top-right gathering corner. The straight six-rung ladder is this V flattened.

## The interaction ladder (progressive disclosure)

Everything lives in the axes, quadrants, and vertices. Four touch levels:

| Level | Trigger | Shows | Backed by (future) |
|---|---|---|---|
| **1. Label** | always on the map | node name at its coordinate | `title` |
| **2. Tooltip** | hover / tap-hold | one-line gloss + node type | node "In one line." |
| **3. Info box** | click | one-liner, axis position, **opposite** (`opposed_to`), **related** chips (clickable), and *counts* of attached scriptures & runs | frontmatter |
| **4. Drill-down** | expand in info box | full node: prose sections, **scripture list**, **runs that touch this node**, connection neighborhood | node body + runs |

## Node model (mirrors workspace frontmatter)

Each node the map renders carries: `id`, `title`, `type` (pole / terminus / vertex / threshold / off-pattern), `axis`, plane coordinates `(x, y)` in `[-1, 1]`, `oneLiner`, `opposedTo`, `related[]`, and the two attachment slots below. The scaffold ships placeholder values in every slot so the shape is visible before ingestion.

### Scripture-reference slot

Every node (and eventually every prose claim) has an attached list of BoM references. Scaffold shape:

```
scriptures: [{ ref: "Alma 5:34", note?: "…" }]
```

Open: **where scriptures surface.** Candidates — (a) a scripture list inside the drill-down; (b) inline citation chips within commentary that hover-preview the verse; (c) deep-link to the existing Read view (`/read/...`). Likely all three, but the *primary* surface is undecided.

### Run slot

A **run** is a worked case study (a figure or episode traced through the framework — Alma the Younger, Korihor, Jacob 5, 3 Nephi at Bountiful). Nodes list the runs that touch them:

```
runs: [{ id: "alma-the-younger", title: "Alma the Younger" }]
```

Open questions (deferred):
- **How is a run displayed?** A static path drawn across the plane, or an **animated traversal** (a token moving through quadrants/vertices over the narrative)?
- **Do runs use people images / portraits** for figures?
- Are runs launched from a node, from a global "runs" index, or both?

## Counter-order / off-pattern handling

Not everything maps onto the redemptive shape. Two homes:

1. **On-plane, bottom-right** — the counter-order *is* a quadrant (death + order): institutions that mimic the pattern inverted (Nehor's priestcraft, Gadianton, Babylon-wearing-Zion's-name). Rendered as a shadow region with its own nodes.
2. **Off-plane rail** — a side list for material that genuinely doesn't sit on the plane (meta-concepts, stress-tests, external lenses). These get labels + info boxes but **no coordinate**; they reference plane nodes rather than occupying the plane.

## Open questions (explicitly deferred)

- **Scripture surfacing** — primary surface (drill-down list vs. inline chips vs. Read-view deep link).
- **Commentary** — where the synthetic/interpretive prose lives, and how much shows before drill-down.
- **Scaffolding text** — how much scaffolding/definition is shown at info-box vs. drill-down level.
- **Runs** — static vs. animated traversal; people images; launch points.
- **Site integration** — relationship to Read, People, Places, Timeline, Map views; deep-linking in and out; whether a node can open the relevant Read passage or People portrait.
- **Data source** — the corpus is in the private workspace repo; the public webapp needs a code-safe ingestion/export path (build-time JSON, API, or curated subset). Not solved by the scaffold.
- **i18n** — node titles/one-liners are currently plain scaffold strings; real content needs a label strategy.

## Scaffold scope (this build)

In: the plane (axes + four quadrants), the inverted-triangle funnel with its vertices, a curated ~15–18 placeholder nodes using real framework concepts, the counter-order quadrant, the off-pattern rail, and the full interaction ladder (label → tooltip → info box → drill-down) wired to placeholder data.

Out: corpus ingestion, real scripture/run data, animation, people images, site cross-linking, i18n of node content.

## Files

- `Theology.data.js` — geometry + placeholder node graph (the single edit point for content shape).
- `Theology.js` — SVG map + interaction ladder (dependency-free, hand-rolled SVG).
- `Theology.css` — styles.
