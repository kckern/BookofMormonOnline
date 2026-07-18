// Pure geometry for the bipartite ribbon overview. No React, no DOM.

export const layoutSpine = (items, height, gap = 2, minPx = 0) => {
  const totalWeight = items.reduce((a, i) => a + i.weight, 0) || 1;
  const usable = height - gap * (items.length - 1);
  const raw = items.map((i) => (i.weight / totalWeight) * usable);
  const scaled = raw.map((h) => Math.max(h, minPx));
  const overflow = scaled.reduce((a, b) => a + b, 0) - usable;
  // if the floor pushed us over the height, shrink the largest items to fit
  if (overflow > 0) {
    const shrinkable = scaled.map((h) => h - minPx);
    const shrinkTotal = shrinkable.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < scaled.length; i++)
      scaled[i] -= (shrinkable[i] / shrinkTotal) * overflow;
  }
  const out = new Map();
  let y = 0;
  items.forEach((item, i) => {
    out.set(item.key, { y0: y, y1: y + scaled[i] });
    y += scaled[i] + gap;
  });
  return out;
};

// Allocate each node's span among its ribbons pro-rata by value, ordered by
// the partner's position (reduces crossings). minPx keeps hairlines visible.
export const layoutRibbons = ({ left, right, links, height, gap = 2, minPx = 1.5, spineMinPx = 0 }) => {
  const leftSpine = layoutSpine(left, height, gap, spineMinPx);
  const rightSpine = layoutSpine(right, height, gap, spineMinPx);

  const slot = (spine, key, myLinks, valueOf, partnerY) => {
    const { y0, y1 } = spine.get(key);
    const span = y1 - y0;
    const total = myLinks.reduce((a, l) => a + valueOf(l), 0);
    const sorted = [...myLinks].sort((a, b) => partnerY(a) - partnerY(b));
    const raw = sorted.map((l) => (valueOf(l) / total) * span);
    const scaled = raw.map((h) => Math.max(h, minPx));
    const overflow = scaled.reduce((a, b) => a + b, 0) - span;
    // if minPx pushed us over the span, shrink the largest slots to fit
    if (overflow > 0) {
      const shrinkable = scaled.map((h) => h - minPx);
      const shrinkTotal = shrinkable.reduce((a, b) => a + b, 0) || 1;
      for (let i = 0; i < scaled.length; i++)
        scaled[i] -= (shrinkable[i] / shrinkTotal) * overflow;
    }
    const out = new Map();
    let y = y0;
    for (let i = 0; i < sorted.length; i++) {
      out.set(sorted[i], { y0: y, y1: y + scaled[i] });
      y += scaled[i];
    }
    return out;
  };

  const byLeft = new Map();
  const byRight = new Map();
  for (const l of links) {
    if (!byLeft.has(l.left)) byLeft.set(l.left, []);
    byLeft.get(l.left).push(l);
    if (!byRight.has(l.right)) byRight.set(l.right, []);
    byRight.get(l.right).push(l);
  }

  const leftSlots = new Map();
  const rightSlots = new Map();
  for (const [key, ls] of byLeft)
    leftSlots.set(
      key,
      slot(leftSpine, key, ls, (l) => l.value, (l) => rightSpine.get(l.right).y0)
    );
  for (const [key, ls] of byRight)
    rightSlots.set(
      key,
      slot(rightSpine, key, ls, (l) => l.value, (l) => leftSpine.get(l.left).y0)
    );

  const ribbons = [];
  for (const l of links) {
    const L = leftSlots.get(l.left).get(l);
    const R = rightSlots.get(l.right).get(l);
    ribbons.push({ ...l, lY0: L.y0, lY1: L.y1, rY0: R.y0, rY1: R.y1 });
  }
  return { leftSpine, rightSpine, ribbons };
};

export const ribbonPath = ({ lY0, lY1, rY0, rY1 }, x0, x1) => {
  const mx = (x0 + x1) / 2;
  return [
    `M ${x0},${lY0}`,
    `C ${mx},${lY0} ${mx},${rY0} ${x1},${rY0}`,
    `L ${x1},${rY1}`,
    `C ${mx},${rY1} ${mx},${lY1} ${x0},${lY1}`,
    "Z",
  ].join(" ");
};
