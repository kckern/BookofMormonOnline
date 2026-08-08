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
    from: {
      slug: m.start,
      name: m.startName || m.start,
      lat: m.startLat,
      lng: m.startLng,
    },
    to: {
      slug: m.end,
      name: m.endName || m.end,
      lat: m.endLat,
      lng: m.endLng,
    },
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
  const visit = (slug, name, lat, lng, step, isEnd) => {
    let s = bySlug.get(slug);
    if (!s) {
      s = {
        slug,
        name: name || slug,
        lat,
        lng,
        steps: [],
        startSteps: [],
        endSteps: [],
        firstStep: step,
      };
      bySlug.set(slug, s);
    }
    if ((!s.name || s.name === s.slug) && name) s.name = name;
    if (!s.steps.includes(step)) s.steps.push(step);
    if (!isEnd && !s.startSteps.includes(step)) s.startSteps.push(step);
    if (isEnd && !s.endSteps.includes(step)) s.endSteps.push(step);
  };
  moves.forEach((m, i) => {
    visit(m.start, m.startName, m.startLat, m.startLng, i, false);
    visit(m.end, m.endName, m.endLat, m.endLng, i, true);
  });
  return [...bySlug.values()];
};

/** Marker appearance for a given playhead position. */
export const stopStateAt = (stop, active, showAll) => {
  if (showAll) return "past";
  if (stop.startSteps.includes(active) || stop.endSteps.includes(active)) return "current";
  if (stop.steps.some((n) => n < active)) return "past";
  return "future";
};

/** Default number of past legs that stay in the "recent" (fading) trailing tail. */
export const TRAILING_WINDOW = 3;

/**
 * How prominently a leg should render for a given playhead position.
 *   - active:  the leg being traveled now (full color)
 *   - recent:  a visited leg still inside the trailing window (fades with age)
 *   - old:     a visited leg past the trailing window (faint route context)
 *   - future:  not yet reached (hidden until the playhead arrives)
 *   - visited: the completed-frame state where the whole journey is shown
 */
export const legVisibility = (index, step, complete = false, trailingWindow = TRAILING_WINDOW) => {
  if (complete) return { role: "visited", opacity: 0.6 };
  if (index === step) return { role: "active", opacity: 1 };
  if (index < step) {
    const age = step - index; // 1 = most recently completed
    if (age > trailingWindow) return { role: "old", opacity: 0.16 };
    const span = Math.max(1, trailingWindow - 1);
    const opacity = 0.72 - (age - 1) * (0.72 - 0.28) / span;
    return { role: "recent", opacity };
  }
  return { role: "future", opacity: 0 };
};

/**
 * Which leg indices the camera should frame for a given playhead: the active leg
 * plus a short trailing tail for context. The completed frame shows every leg.
 */
export const framedLegIndices = (step, complete, total, tail = 1) => {
  if (total <= 0) return [];
  if (complete) return Array.from({ length: total }, (_, i) => i);
  const end = Math.min(Math.max(0, step), total - 1);
  const start = Math.max(0, end - tail);
  const indices = [];
  for (let i = start; i <= end; i += 1) indices.push(i);
  return indices;
};
