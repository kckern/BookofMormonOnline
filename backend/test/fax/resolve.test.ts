import { describe, it, expect } from 'vitest';
import { selectorToVerseIds, verseIdsToBoxes, legacyUnitToVerseIds, imagePageOffset } from '../../src/media/fax/resolve.js';

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
  // Stored fax_index.page is NOT the scan image-file number; the offset shifts it
  // per edition (front-matter/plate leaves). Locks the page-mapping bug fix.
  it('imagePageOffset maps fax page -> image file per edition', async () => {
    expect(await imagePageOffset('1837')).toBe(-4);  // fax p11 (1 Ne 1:1) -> image 007
    expect(await imagePageOffset('1841')).toBe(0);   // no front-matter shift
    expect(await imagePageOffset('2013')).toBe(-9);
  });
});
