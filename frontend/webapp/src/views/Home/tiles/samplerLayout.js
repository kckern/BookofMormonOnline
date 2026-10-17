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

/**
 * Reserve balancer gate. Reserves render BEFORE the infinite tiles in both the
 * rail and the masonry, and react-masonry-css deals items round-robin (item j
 * → column j % 2), so one reserve inserted after a batch is on the page
 * re-splits every batch tile below it into the other column — the on-screen
 * reshuffle seen while scrolling and on Back into a restored feed (audit
 * places-B3 / placeProfile-E2). Once a batch is revealed the reserves freeze.
 */
export function canGrowReserves({ reserves, max, batches }) {
  return reserves < max && batches === 0;
}

/**
 * Decide rail vs main for each infinite-batch tile, in order. A tile goes to
 * the shorter of the rail and a main column (by estimate), unless the column
 * it would land in already ends with a tile of the same key — then it takes
 * the other side, so a batch tile never reads as a repeat of the one above it
 * (audit places-H4). The main column a tile lands in is known exactly: the
 * masonry puts main item n in column n % 2. Pure and deterministic, so every
 * re-render (and a Back restore) puts each tile in the same column.
 *
 * @param {{railH:number, mainColH:number, mainCount:number,
 *   last:{rail:?string, main:[?string, ?string]}, tiles:{key:string, e:number}[]}} input
 * @returns {("rail"|"main")[]}
 */
export function placeBatchTiles({ railH, mainColH, mainCount, last, tiles }) {
  let rH = railH;
  let mH = mainColH;
  let n = mainCount;
  let railLast = last?.rail ?? null;
  const mainLast = [...(last?.main || [null, null])];
  return tiles.map(({ key, e }) => {
    let side = rH <= mH ? "rail" : "main";
    const clash = (s) => (s === "rail" ? railLast === key : mainLast[n % 2] === key);
    if (clash(side) && !clash(side === "rail" ? "main" : "rail")) side = side === "rail" ? "main" : "rail";
    if (side === "rail") { rH += e; railLast = key; }
    else { mH += e / 2; mainLast[n % 2] = key; n += 1; }
    return side;
  });
}

/**
 * Space a tile family (the three commentaries) evenly through the others so it
 * never reads as a spam column. Positions are FINAL indices; with cols > 1 each
 * family tile also takes the opposite masonry column from the previous one
 * (react-masonry-css: item j → column j % cols) — even fractional spacing
 * alone landed all three on 2/6/10 of a 12-item grid, one column.
 */
export function spaceAcrossColumns(others, family, cols = 2) {
  const k = family.length;
  if (!k) return [...others];
  const slots = others.length + k;
  const taken = [];
  family.forEach((_, i) => {
    let p = Math.max(1, Math.min(slots - 1, Math.round(((i + 0.5) / k) * slots)));
    const prev = taken[taken.length - 1];
    if (cols > 1 && prev != null && p % cols === prev % cols) p = p + 1 < slots ? p + 1 : p - 1;
    while (taken.includes(p) && p < slots - 1) p++;
    while (taken.includes(p)) p--;
    taken.push(p);
  });
  const out = new Array(slots);
  taken.forEach((p, i) => (out[p] = family[i]));
  let j = 0;
  for (let i = 0; i < slots; i++) if (out[i] === undefined) out[i] = others[j++];
  return out;
}
