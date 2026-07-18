import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { renderFragmentCrop, renderPageDimmed } from '../../src/media/fax/render.js';
import type { Fragment } from '../../src/media/fax/types.js';

// A 400x300 synthetic "scan": white paper with a black bar where the "text" is.
async function fakeScan(): Promise<Buffer> {
  return sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } })
    .composite([{ input: { create: { width: 300, height: 60, channels: 3, background: '#000000' } }, top: 100, left: 50 }])
    .jpeg().toBuffer();
}

describe('renderFragmentCrop', () => {
  it('crops to the fragment bbox and paper-fills the exterior notches', async () => {
    const frag: Fragment = {
      page: 1, pageWidth: 400, x: 50, y: 100, w: 300, h: 60,
      boxes: [{ verseId: 1, page: 1, pageWidth: 400, x: 50, y: 100, w: 300, h: 60,
        tlw: 40, tlh: 20, brw: 30, brh: 20 }],
    };
    const out = await renderFragmentCrop(await fakeScan(), frag, {
      tl: { w: 40, h: 20 }, br: { w: 30, h: 20 }, paper: '#ffffff',
    });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(60);
    // top-left 40x20 should now be white (paper-filled), not black
    const px = await sharp(out).extract({ left: 0, top: 0, width: 5, height: 5 }).raw().toBuffer();
    expect(px[0]).toBeGreaterThan(240); // near-white R
  });
});

describe('renderPageDimmed', () => {
  it('keeps full page size and brightens only the highlight rects', async () => {
    const rects = [{ x: 50, y: 100, w: 300, h: 60 }];
    const out = await renderPageDimmed(await fakeScan(), 400, 300, rects, 0.55);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
    // a corner outside the highlight should be dimmed (darker than pure white)
    const corner = await sharp(out).extract({ left: 0, top: 0, width: 5, height: 5 }).raw().toBuffer();
    expect(corner[0]).toBeLessThan(200);
  });
});
