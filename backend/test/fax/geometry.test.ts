import { describe, it, expect } from 'vitest';
import { sanitizeBoxes } from '../../src/media/fax/geometry.js';
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
