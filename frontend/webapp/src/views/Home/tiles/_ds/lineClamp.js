/**
 * Whole-line clamp height: the bottom (px from `top`) of the lowest line box
 * that fits inside `target`, so a clamp never slices a line through its glyphs
 * (paragraph gaps included — the rects carry real positions). `rects` are a
 * Range's client rects over the clamped content. No layout (jsdom), or no line
 * that fits → the target itself.
 */
export function snapToLines(rects, top, target) {
  let best = 0;
  for (const r of rects || []) {
    if (!(r.height > 0)) continue;
    const b = r.bottom - top;
    if (b <= target + 0.5 && b > best) best = b;
  }
  return best > 0 ? Math.round(best) : target;
}

/** Client rects of an element's content (text + inline boxes), [] without layout. */
export function contentRects(el) {
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...(range.getClientRects?.() || [])];
  } catch {
    return [];
  }
}
