import { describe, it, expect } from 'vitest';
import { sanitizeBoxes, dedupeBoxes, clusterColumns, toFragments, clampPages } from '../../src/media/fax/geometry.js';
import type { FaxBox } from '../../src/media/fax/types.js';

const raw = (o: Partial<FaxBox>): FaxBox => ({
  verseId: 1, page: 1, pageWidth: 800, x: 0, y: 0, w: 100, h: 20,
  tlw: 0, tlh: 0, brw: 0, brh: 0, ...o,
});

describe('sanitizeBoxes', () => {
  it('clamps negative X/Y to 0', () => {
    const [b] = sanitizeBoxes([raw({ x: -3, y: -1 })]);
    expect(b.x).toBe(0); expect(b.y).toBe(0);
  });
  it('clamps negative notches to 0', () => {
    const [b] = sanitizeBoxes([raw({ brw: -1 })]);
    expect(b.brw).toBe(0);
  });
  it('clips width to the page bound', () => {
    const [b] = sanitizeBoxes([raw({ x: 750, w: 100, pageWidth: 800 })]);
    expect(b.x + b.w).toBe(800);
  });
  it('drops zero-size boxes', () => {
    expect(sanitizeBoxes([raw({ w: 0, h: 0 })])).toHaveLength(0);
  });
});

describe('dedupeBoxes', () => {
  it('merges boxes within DEDUPE_PX on all corners (same verse)', () => {
    const a = raw({ verseId: 5, x: 357, y: 70, w: 289, h: 87 });
    const b = raw({ verseId: 5, x: 357, y: 71, w: 289, h: 86 });
    expect(dedupeBoxes([a, b])).toHaveLength(1);
  });
  it('keeps legitimately distinct boxes of the same verse', () => {
    const a = raw({ verseId: 5, x: 56, y: 795, w: 285, h: 54 });
    const b = raw({ verseId: 5, x: 357, y: 70, w: 289, h: 87 });
    expect(dedupeBoxes([a, b])).toHaveLength(2);
  });
});

describe('clusterColumns', () => {
  it('collapses a single column when a small fragment is inside the column span', () => {
    // 1830 p459: fragment [482,512] inside column [38,513]
    const col = raw({ x: 38, y: 100, w: 475, h: 400 });   // [38,513]
    const frag = raw({ x: 482, y: 60, w: 30, h: 20 });    // [482,512] ⊂ [38,513]
    expect(clusterColumns([col, frag])).toHaveLength(1);
  });
  it('splits two disjoint columns', () => {
    // 2013 p276: [56,341] vs [357,646]
    const left = raw({ x: 56, y: 795, w: 285, h: 54 });
    const right = raw({ x: 357, y: 70, w: 289, h: 87 });
    const cols = clusterColumns([left, right]);
    expect(cols).toHaveLength(2);
    expect(cols[0][0].x).toBe(56);   // ordered left→right by min X
    expect(cols[1][0].x).toBe(357);
  });
  it('merges a transitive overlap chain (A-B, B-C overlap; A-C do not)', () => {
    const a = raw({ x: 0, y: 10, w: 100, h: 20 });     // [0,100]
    const b = raw({ x: 90, y: 40, w: 90, h: 20 });     // [90,180] overlaps A
    const cc = raw({ x: 170, y: 70, w: 90, h: 20 });   // [170,260] overlaps B, not A
    expect(clusterColumns([a, b, cc])).toHaveLength(1);
  });
});

describe('toFragments', () => {
  it('orders a nested tail fragment after the taller box it sits inside', () => {
    // 1829 p40: 31631 (x18,y45,small) nested inside 31632 (y37, tall)
    const tall = raw({ verseId: 31632, page: 40, x: 18, y: 37, w: 600, h: 900 });
    const tail = raw({ verseId: 31631, page: 40, x: 18, y: 45, w: 200, h: 20 });
    const frags = toFragments([tail, tall]);
    // single column, boxes vertically overlap -> one merged run
    expect(frags).toHaveLength(1);
    expect(frags[0].y).toBe(37);
  });
  it('emits page→column→run order across a column break', () => {
    const leftBottom = raw({ verseId: 100, page: 276, x: 56, y: 795, w: 285, h: 54 });
    const rightTop = raw({ verseId: 101, page: 276, x: 357, y: 70, w: 289, h: 87 });
    const frags = toFragments([rightTop, leftBottom]);
    expect(frags.map((f) => f.x)).toEqual([56, 357]); // left column first
  });
  it('orders across pages', () => {
    const p15 = raw({ verseId: 200, page: 15, x: 53, y: 162, w: 507, h: 89 });
    const p14 = raw({ verseId: 199, page: 14, x: 170, y: 977, w: 453, h: 77 });
    const frags = toFragments([p15, p14]);
    expect(frags.map((f) => f.page)).toEqual([14, 15]);
  });
});

describe('clampPages', () => {
  it('keeps only the first N distinct pages and flags truncation', () => {
    const frags = [1, 2, 3, 4, 5, 6, 7].map((p) =>
      ({ page: p, pageWidth: 800, x: 0, y: 0, w: 10, h: 10, boxes: [] }));
    const { fragments, clamped } = clampPages(frags, 5);
    expect(new Set(fragments.map((f) => f.page)).size).toBe(5);
    expect(clamped).toBe(true);
  });
  it('does not flag when within budget', () => {
    const frags = [1, 2].map((p) => ({ page: p, pageWidth: 800, x: 0, y: 0, w: 10, h: 10, boxes: [] }));
    expect(clampPages(frags, 5).clamped).toBe(false);
  });
});
