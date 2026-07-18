import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { legacyUnitToVerseIds, verseIdsToBoxes } from '../../src/media/fax/resolve.js';
import { toFragments } from '../../src/media/fax/geometry.js';

// The golden 2022 asset came from a different scan generation, so we compare
// the RELATIVE vertical band of the highlight, not raw pixels.
describe('golden parity: ammon-132', () => {
  it('resolves to Alma 26:1-9 and the highlight band matches (normalized)', async () => {
    const ids = await legacyUnitToVerseIds('ammon', 132);
    expect(ids).toHaveLength(9);
    const boxes = await verseIdsToBoxes('1837', ids);
    const frags = toFragments(boxes);
    expect(new Set(frags.map((f) => f.page))).toEqual(new Set([317]));

    // current scan height for 1837 p317
    const scan = Buffer.from(await (await fetch('https://media.bookofmormon.online/fax/pages/1837/317.jpg')).arrayBuffer());
    const h = (await sharp(scan).metadata()).height!;
    const top = Math.min(...frags.map((f) => f.y)) / h;
    const bot = Math.max(...frags.map((f) => f.y + f.h)) / h;
    // golden bright band ≈ rows 224..1164 of 1500 => 0.149..0.776 (normalized)
    expect(top).toBeGreaterThan(0.10);
    expect(top).toBeLessThan(0.25);
    expect(bot).toBeGreaterThan(0.60);
    expect(bot).toBeLessThan(0.85);
  });
});
