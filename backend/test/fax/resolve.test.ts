import { describe, it, expect } from 'vitest';
import { selectorToVerseIds, verseIdsToBoxes, legacyUnitToVerseIds } from '../../src/media/fax/resolve.js';

describe('selectorToVerseIds', () => {
  it('parses an ids/ selector', () => {
    expect(selectorToVerseIds('ids/31103-31104-31108')).toEqual([31103, 31104, 31108]);
  });
  it('parses a ref slug', () => {
    const ids = selectorToVerseIds('1-nephi-1.1');
    expect(ids).toContain(31103);
  });
});

describe('DB integration', () => {   // hits live DB
  it('verseIdsToBoxes returns sanitized boxes for 1837/31103', async () => {
    const boxes = await verseIdsToBoxes('1837', [31103]);
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes[0].page).toBe(11);
  });
  it('legacyUnitToVerseIds resolves ammon-132 -> Alma 26:1-9 (9 verses)', async () => {
    const ids = await legacyUnitToVerseIds('ammon', 132);
    expect(ids).toHaveLength(9);
    expect(ids[0]).toBe(34345);
  });
});
