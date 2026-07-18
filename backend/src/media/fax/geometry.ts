import type { FaxBox } from './types.js';
import { DEDUPE_PX } from './constants.js';

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
