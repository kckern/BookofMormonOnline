/**
 * Theology view — SCAFFOLD DATA.
 *
 * This is the single edit-point for the framework's shape. Every value here is a
 * PLACEHOLDER meant to demonstrate a slot, not final content. The real corpus
 * (39 typed nodes + ~50 runs) lives in the private workspace and is not yet
 * ingested — see docs/specs/2026-07-15-theology-view.md.
 *
 * Coordinate system (plane space):
 *   x ∈ [-1, 1]  →  -1 = Scattered / Dispersal (left),  +1 = Gathered / Dominion (right)
 *   y ∈ [-1, 1]  →  -1 = Death / Justice (bottom),       +1 = Life / Mercy (top)
 * The component projects (x, y) onto the SVG canvas; nothing here knows pixels.
 */

// ---------------------------------------------------------------------------
// Axes — the two orthogonal oppositions. Time is NOT an axis (it's trajectory).
// ---------------------------------------------------------------------------
export const AXES = {
  y: {
    id: "axis-y",
    label: "Life ↔ Death",
    positivePole: { label: "Life · Mercy · Spirit", term: "tree-of-life" },
    negativePole: { label: "Death · Justice · Hell", term: "tree-of-knowledge" },
  },
  x: {
    id: "axis-x",
    label: "Scattered ↔ Gathered",
    positivePole: { label: "Gathered · Dominion · Zion", term: "gathering" },
    negativePole: { label: "Scattered · Dispersal", term: "the-scattered" },
  },
};

// ---------------------------------------------------------------------------
// Quadrants — two absorbing corners, two transient. `kind` drives styling.
// ---------------------------------------------------------------------------
// NB: quadrant ids are prefixed `quad-` so they never collide with the point
// nodes that live inside them (e.g. the `gathering` pole vs. this corner).
export const QUADRANTS = [
  {
    id: "quad-gathering",
    title: "The Gathering / Zion",
    corner: "top-right",
    kind: "absorbing-stable",
    center: { x: 0.55, y: 0.55 },
    oneLiner: "Life + order — Zion, the held communion. The stable, absorbing terminus.",
  },
  {
    id: "quad-scattered-faithful",
    title: "Scattered Faithful",
    corner: "top-left",
    kind: "transient",
    center: { x: -0.55, y: 0.55 },
    oneLiner: "Life + scattered — the dispersed remnant in the wilderness, drawn toward gathering.",
  },
  {
    id: "quad-counter-order",
    title: "The Counter-Order",
    corner: "bottom-right",
    kind: "metastable",
    center: { x: 0.55, y: -0.55 },
    oneLiner: "Death + order — the adversary's institution (Nehor, Gadianton). Order without God; decays toward dispersal.",
  },
  {
    id: "quad-second-death",
    title: "Second Death",
    corner: "bottom-left",
    kind: "absorbing-static",
    center: { x: -0.55, y: -0.55 },
    oneLiner: "Death + scattered — outer darkness, stasis in dispersal. The static, absorbing terminus.",
  },
];

// ---------------------------------------------------------------------------
// Nodes on the plane. Every node carries the full slot-set so the shape is
// visible before ingestion. `scriptures` and `runs` are placeholder stubs.
//
//   type:  pole | terminus | threshold | vertex | node
// ---------------------------------------------------------------------------
const stubScriptures = [
  { ref: "1 Nephi 11:22", note: "placeholder — the tree = the love of God" },
  { ref: "Alma 5:34", note: "placeholder — come and partake" },
];
const stubRuns = [
  { id: "alma-the-younger", title: "Alma the Younger" },
  { id: "korihor", title: "Korihor" },
];

export const NODES = [
  // --- Y-axis poles ---
  {
    id: "tree-of-life",
    title: "Tree of Life",
    type: "pole",
    axis: "vertical-opposition",
    x: 0, y: 0.92,
    oneLiner: "The upward pole: Life, Mercy, Light. Its fruit is the love of God.",
    opposedTo: "tree-of-knowledge",
    related: ["choice", "doctrine-of-christ", "presence-of-god", "gathering"],
    scriptures: stubScriptures,
    runs: stubRuns,
  },
  {
    id: "tree-of-knowledge",
    title: "Tree of Knowledge / Death",
    type: "pole",
    axis: "vertical-opposition",
    x: 0, y: -0.92,
    oneLiner: "The downward pole: Death, Justice, the chains of hell. Defined by Christ's absence.",
    opposedTo: "tree-of-life",
    related: ["choice", "quad-counter-order", "second-death-node"],
    scriptures: stubScriptures,
    runs: stubRuns,
  },
  // --- X-axis poles ---
  {
    id: "gathering",
    title: "Gathering",
    type: "pole",
    axis: "scattering-gathering",
    x: 0.92, y: 0,
    oneLiner: "The rightward pole: union, dominion, at-one-ment as grafting.",
    opposedTo: "the-scattered",
    related: ["tree-of-life", "zion", "presence-of-god"],
    scriptures: stubScriptures,
    runs: stubRuns,
  },
  {
    id: "the-scattered",
    title: "The Scattered",
    type: "pole",
    axis: "scattering-gathering",
    x: -0.92, y: 0,
    oneLiner: "The leftward pole: dispersal — bivalent, raw material or dissolution.",
    opposedTo: "gathering",
    related: ["second-death-node", "quad-scattered-faithful"],
    scriptures: stubScriptures,
    runs: stubRuns,
  },
  // --- The apex & threshold ---
  {
    id: "the-father",
    title: "The Father",
    type: "terminus",
    axis: "vertical-opposition",
    x: 0, y: 1.02,
    oneLiner: "The constant Y-axis apex — heard not seen; the source and the terminus.",
    opposedTo: null,
    related: ["tree-of-life", "presence-of-god", "doctrine-of-christ"],
    scriptures: stubScriptures,
    runs: stubRuns,
  },
  {
    id: "presence-of-god",
    title: "Presence of God",
    type: "threshold",
    axis: "vertical-opposition",
    x: 0, y: 0.42,
    oneLiner: "The layered membrane — inner court, holy place, apex. Visitation now; dwelling at the consummation.",
    opposedTo: null,
    related: ["the-father", "ministry-of-angels", "heavenly-ascent"],
    scriptures: stubScriptures,
    runs: stubRuns,
  },
  // --- The fulcrum ---
  {
    id: "choice",
    title: "Choice",
    type: "vertex",
    axis: "vertical-opposition",
    x: 0, y: -0.36,
    oneLiner: "The moral operator — the baptismal fulcrum where the traversal's valence is set.",
    opposedTo: null,
    related: ["opposition", "doctrine-of-christ", "tree-of-life", "tree-of-knowledge"],
    scriptures: stubScriptures,
    runs: stubRuns,
  },
  // --- Termini in the corners ---
  {
    id: "zion",
    title: "Zion",
    type: "terminus",
    axis: "scattering-gathering",
    x: 0.62, y: 0.62,
    oneLiner: "The gathering realized as a mortal society — people + place + refined state.",
    opposedTo: "second-death-node",
    related: ["gathering", "presence-of-god"],
    scriptures: stubScriptures,
    runs: stubRuns,
  },
  {
    id: "second-death-node",
    title: "Second Death",
    type: "terminus",
    axis: "scattering-gathering",
    x: -0.62, y: -0.62,
    oneLiner: "The unconvergeable remainder — shrinking from the presence under perfect knowledge.",
    opposedTo: "zion",
    related: ["the-scattered", "tree-of-knowledge"],
    scriptures: stubScriptures,
    runs: stubRuns,
  },
];

// ---------------------------------------------------------------------------
// The Doctrine-of-Christ funnel (inverted triangle) — descent converges to the
// baptismal vertex (`choice`), then the ascent arm rises to the gathering.
// `arm`: "descent" | "vertex" | "ascent". Steps are ordered.
// ---------------------------------------------------------------------------
export const FUNNEL = {
  vertexId: "choice",
  // Top edge of the inverted triangle (the wide mouth of the descent).
  mouth: { left: { x: -0.34, y: 0.16 }, right: { x: 0.34, y: 0.16 } },
  steps: [
    { id: "faith", title: "Faith", arm: "descent", order: 1, x: -0.28, y: 0.10,
      oneLiner: "First rung — the experiment on the word.", scriptures: stubScriptures, runs: stubRuns },
    { id: "repentance", title: "Repentance", arm: "descent", order: 2, x: -0.17, y: -0.08,
      oneLiner: "The humbling descent — a broken heart.", scriptures: stubScriptures, runs: stubRuns },
    { id: "baptism-water", title: "Baptism by Water", arm: "descent", order: 3, x: -0.07, y: -0.24,
      oneLiner: "Down into the water — burial with Christ.", scriptures: stubScriptures, runs: stubRuns },
    { id: "baptism-fire", title: "Baptism by Fire", arm: "ascent", order: 4, x: 0.13, y: -0.14,
      oneLiner: "The weld — the first rung of the ascent; the tongue of angels turns on.", scriptures: stubScriptures, runs: stubRuns },
    { id: "endure", title: "Endure / Sanctify", arm: "ascent", order: 5, x: 0.28, y: 0.06,
      oneLiner: "The climb — the soul made pure.", scriptures: stubScriptures, runs: stubRuns },
    { id: "salvation", title: "Salvation", arm: "ascent", order: 6, x: 0.44, y: 0.30,
      oneLiner: "Rising out toward the gathering — inherit the kingdom.", scriptures: stubScriptures, runs: stubRuns },
  ],
};

// ---------------------------------------------------------------------------
// Off-pattern rail — material that does NOT sit on the plane. No coordinate;
// these reference plane nodes rather than occupying the plane.
// ---------------------------------------------------------------------------
export const OFF_PATTERN = [
  {
    id: "opposition",
    title: "Opposition",
    kind: "meta-principle",
    oneLiner: "The mechanism (2 Nephi 2) — may generate the plane rather than sit on it.",
    references: ["choice", "tree-of-life", "tree-of-knowledge"],
    scriptures: stubScriptures,
    runs: [],
  },
  {
    id: "bivalent-operators",
    title: "Bivalent Operators",
    kind: "engine",
    oneLiner: "Single operations (fire, knowledge, encircling) that produce opposite outcomes by the recipient's orientation.",
    references: ["gathering", "second-death-node"],
    scriptures: stubScriptures,
    runs: [],
  },
  {
    id: "internal-lenses",
    title: "Internal Lenses (stress-test)",
    kind: "external-lens",
    oneLiner: "The BoM's own theological vantage points — reads the framework against its Abinadite tilt.",
    references: ["doctrine-of-christ"],
    scriptures: [],
    runs: [],
  },
];

// Convenience: flat lookup of everything addressable by id (for related chips).
export const NODE_INDEX = (() => {
  const idx = {};
  [...NODES, ...FUNNEL.steps, ...OFF_PATTERN, ...QUADRANTS].forEach((n) => {
    idx[n.id] = n;
  });
  return idx;
})();
