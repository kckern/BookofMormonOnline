/**
 * Journey geometry for the map story tile — pure functions, no OpenLayers, so
 * the tricky parts (discontinuities, revisited places) are testable in jsdom.
 *
 * The tile used to collapse a story into ONE LineString through the first
 * move's start plus every move's end. That has two defects this module exists
 * to avoid:
 *
 *   1. It invents legs. Chaining stops assumes move N ends where move N+1
 *      begins, which is false for 47 move pairs across 21 of the 55 stories.
 *      Alma 2 move 2 ends at valley-of-gideon while move 3 starts at
 *      hill-amnihu, so the old path drew a valley-of-gideon → minon connection
 *      that appears nowhere in the data.
 *   2. It stacks markers. A story revisiting a place emitted a point per visit,
 *      drawing later markers on top of earlier ones at identical pixels.
 */

/** One entry per move, built from that move's own endpoints — never chained. */
export const legsOf = (moves) =>
  moves.map((m, i) => ({
    seq: m.seq,
    from: { slug: m.start, lat: m.startLat, lng: m.startLng },
    to: { slug: m.end, lat: m.endLat, lng: m.endLng },
    // True when this leg does not continue from the previous one. Rendered
    // distinctly rather than hidden: surfacing the break is how these rows get
    // found and cleaned up later.
    detached: i > 0 && moves[i - 1].end !== m.start,
  }));

/**
 * Distinct places in first-visit order. `steps` lists every move index touching
 * the place; `endSteps` lists the moves that ARRIVE there, which is what marks
 * a stop as the current destination during playback.
 */
export const stopsOf = (moves) => {
  const bySlug = new Map();
  const visit = (slug, lat, lng, step, isEnd) => {
    let s = bySlug.get(slug);
    if (!s) {
      s = { slug, lat, lng, steps: [], endSteps: [] };
      bySlug.set(slug, s);
    }
    if (!s.steps.includes(step)) s.steps.push(step);
    if (isEnd && !s.endSteps.includes(step)) s.endSteps.push(step);
  };
  moves.forEach((m, i) => {
    visit(m.start, m.startLat, m.startLng, i, false);
    visit(m.end, m.endLat, m.endLng, i, true);
  });
  return [...bySlug.values()];
};

/** Marker appearance for a given playhead position. */
export const stopStateAt = (stop, active, showAll) => {
  if (showAll) return "past";
  if (stop.endSteps.includes(active)) return "current";
  if (active === 0 && stop.steps.includes(0)) return "current";
  if (stop.steps.some((n) => n <= active)) return "past";
  return "future";
};
