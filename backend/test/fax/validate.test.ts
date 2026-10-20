import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { fragmentEdgeInk, cropVerdict, pickShowcaseEditions } from '../../src/media/fax/validate.js';

// A 1000x600 synthetic page: 6 "text lines" of 16px-tall glyph blocks every
// 30px, spanning x = [100, 700). Glyphs are 12px wide with 4px spaces.
async function page(opts: { rule?: number; textTo?: number } = {}): Promise<Buffer> {
  const textTo = opts.textTo ?? 700;
  const layers: sharp.OverlayOptions[] = [];
  for (let line = 0; line < 6; line++) {
    for (let x = 100; x + 12 <= textTo; x += 16) {
      layers.push({ input: { create: { width: 12, height: 16, channels: 3, background: '#111' } }, top: 200 + line * 30, left: x });
    }
  }
  if (opts.rule != null) {
    layers.push({ input: { create: { width: 2, height: 400, channels: 3, background: '#222' } }, top: 100, left: opts.rule });
  }
  return sharp({ create: { width: 1000, height: 600, channels: 3, background: '#f4efe4' } })
    .composite(layers).png().toBuffer();
}

describe('fragmentEdgeInk', () => {
  it('a box framing the whole text column has clean edges', async () => {
    const e = await fragmentEdgeInk(await page(), { x: 96, y: 196, w: 610, h: 180 });
    expect(e.left).toBeLessThan(0.05);
    expect(e.right).toBeLessThan(0.05);
    expect(e.ink).toBeGreaterThan(0.1);
  });

  it('a box narrower than the column cuts words at its right edge', async () => {
    // right edge at x=505 falls inside the glyph at [500, 512)
    const e = await fragmentEdgeInk(await page(), { x: 96, y: 196, w: 409, h: 180 });
    expect(e.right).toBeGreaterThan(0.3);
    expect(e.left).toBeLessThan(0.05);
  });

  it('a box starting inside the column cuts words at its left edge', async () => {
    const e = await fragmentEdgeInk(await page(), { x: 405, y: 196, w: 301, h: 180 });
    expect(e.left).toBeGreaterThan(0.3);
  });

  it('a column rule hugging the box edge is not text', async () => {
    const e = await fragmentEdgeInk(await page({ rule: 710 }), { x: 96, y: 196, w: 612, h: 180 });
    expect(e.right).toBeLessThan(0.05);
  });

  it('a box over bare paper has no ink', async () => {
    const e = await fragmentEdgeInk(await page(), { x: 100, y: 20, w: 600, h: 100 });
    expect(e.ink).toBeLessThan(0.002);
  });
});

describe('cropVerdict', () => {
  it('passes a clean crop, fails a clipped or blank one', () => {
    expect(cropVerdict({ left: 0, right: 0.02, ink: 0.2 })).toBe('ok');
    expect(cropVerdict({ left: 0, right: 0.4, ink: 0.2 })).toBe('clipped');
    expect(cropVerdict({ left: 0.4, right: 0, ink: 0.2 })).toBe('clipped');
    expect(cropVerdict({ left: 0, right: 0, ink: 0 })).toBe('blank');
  });
});

describe('pickShowcaseEditions', () => {
  it('keeps order, skips editions whose crop fails, stops at max', async () => {
    const bad = new Set(['b', 'd']);
    const seen: string[] = [];
    const out = await pickShowcaseEditions(['a', 'b', 'c', 'd', 'e', 'f'], async (v) => { seen.push(v); return !bad.has(v); }, 3);
    expect(out).toEqual(['a', 'c', 'e']);
    expect(seen).not.toContain('f'); // no more validation than needed
  });

  it('a validator that throws counts as a failed crop', async () => {
    const out = await pickShowcaseEditions(['a', 'b'], async (v) => { if (v === 'a') throw new Error('scan 404'); return true; }, 4);
    expect(out).toEqual(['b']);
  });
});
