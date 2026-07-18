import type { FaxBox, Fragment } from './types.js';
import { DEDUPE_PX, EPSILON_PX } from './constants.js';

/** Clamp negatives, clip to page width, drop zero-size boxes. Height has no
 * stored page bound, so H is only floored at 0 via the drop rule. */
export function sanitizeBoxes(boxes: FaxBox[]): FaxBox[] {
  const out: FaxBox[] = [];
  for (const b0 of boxes) {
    const x = Math.max(0, b0.x);
    const y = Math.max(0, b0.y);
    let w = b0.w - (x - b0.x);
    let h = b0.h - (y - b0.y);
    if (x + w > b0.pageWidth) w = b0.pageWidth - x;
    if (w <= 0 || h <= 0) continue;
    out.push({
      ...b0, x, y, w, h,
      tlw: Math.max(0, b0.tlw), tlh: Math.max(0, b0.tlh),
      brw: Math.max(0, b0.brw), brh: Math.max(0, b0.brh),
    });
  }
  return out;
}

/** Merge near-identical boxes (same verse/page, all corners within DEDUPE_PX). */
export function dedupeBoxes(boxes: FaxBox[]): FaxBox[] {
  const kept: FaxBox[] = [];
  const near = (a: FaxBox, b: FaxBox) =>
    a.verseId === b.verseId && a.page === b.page &&
    Math.abs(a.x - b.x) <= DEDUPE_PX && Math.abs(a.y - b.y) <= DEDUPE_PX &&
    Math.abs(a.w - b.w) <= DEDUPE_PX && Math.abs(a.h - b.h) <= DEDUPE_PX;
  for (const b of boxes) {
    if (!kept.some((k) => near(k, b))) kept.push(b);
  }
  return kept;
}

/** Group boxes on one page into columns by X-interval [x, x+w] overlap
 * (transitive closure). Returns columns ordered left→right by min X. */
export function clusterColumns(boxes: FaxBox[]): FaxBox[][] {
  const cols: { lo: number; hi: number; boxes: FaxBox[] }[] = [];
  // Process by X so overlap chains form left→right.
  for (const b of [...boxes].sort((a, z) => a.x - z.x)) {
    const lo = b.x, hi = b.x + b.w;
    const hit = cols.find((c) => lo < c.hi - EPSILON_PX && hi > c.lo + EPSILON_PX);
    if (hit) {
      hit.lo = Math.min(hit.lo, lo);
      hit.hi = Math.max(hit.hi, hi);
      hit.boxes.push(b);
    } else {
      cols.push({ lo, hi, boxes: [b] });
    }
  }
  return cols.sort((a, z) => a.lo - z.lo).map((c) => c.boxes);
}

/** Merge a column's boxes into maximal vertical runs (union of boxes whose
 * Y-intervals overlap or touch), ordered top→bottom. */
function mergeRuns(colBoxes: FaxBox[]): Fragment[] {
  const runs: Fragment[] = [];
  for (const b of [...colBoxes].sort((a, z) => a.y - z.y)) {
    const top = b.y, bot = b.y + b.h;
    const last = runs[runs.length - 1];
    if (last && top <= last.y + last.h) {
      // vertically overlaps/touches the open run -> extend it
      const newTop = Math.min(last.y, top);
      const newBot = Math.max(last.y + last.h, bot);
      const newLeft = Math.min(last.x, b.x);
      const newRight = Math.max(last.x + last.w, b.x + b.w);
      last.x = newLeft; last.y = newTop;
      last.w = newRight - newLeft; last.h = newBot - newTop;
      last.boxes.push(b);
    } else {
      runs.push({ page: b.page, pageWidth: b.pageWidth, x: b.x, y: b.y, w: b.w, h: b.h, boxes: [b] });
    }
  }
  for (const r of runs) r.boxes.sort((a, z) => a.verseId - z.verseId);
  return runs;
}

/** Sanitized boxes -> fragments in reading order (page asc, column L→R, run top→bottom). */
export function toFragments(boxes: FaxBox[]): Fragment[] {
  const byPage = new Map<number, FaxBox[]>();
  for (const b of boxes) (byPage.get(b.page) ?? byPage.set(b.page, []).get(b.page)!).push(b);
  const out: Fragment[] = [];
  for (const page of [...byPage.keys()].sort((a, z) => a - z)) {
    for (const col of clusterColumns(byPage.get(page)!)) {
      out.push(...mergeRuns(col));
    }
  }
  return out;
}
