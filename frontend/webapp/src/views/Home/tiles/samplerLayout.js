/**
 * Single-column (phone / narrow) tile order.
 *
 * On desktop the sampler is a left rail + a two-column masonry. Stacking that
 * on a phone put the whole rail (reading plan, narration, contents, plus every
 * balancer reserve) above People, ~5 screens down. One curated column instead:
 * reading plan, People, narration, then the shuffled variable tiles with
 * contents a few tiles in, and the map story as the feature tail.
 */
const CONTENTS_AFTER = 3;

export function singleColumnOrder(variableKeys) {
  const vars = [...variableKeys];
  vars.splice(Math.min(CONTENTS_AFTER, vars.length), 0, "contents");
  return ["readingplan", "people", "section", ...vars, "mapstory"];
}
