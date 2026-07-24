import { describe, it, expect } from 'vitest';
import { selectorToVerseIds, verseIdsToBoxes, legacyUnitToVerseIds, imageScanMeta } from '../../src/media/fax/resolve.js';

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
  // per edition (front-matter/plate leaves), and the source format varies.
  it('imageScanMeta gives per-edition page offset + scan format', async () => {
    // toMatchObject: imageScanMeta also returns `paper` (bgcolor) now — assert the
    // offset/format contract without coupling to the paper value.
    expect(await imageScanMeta('1837')).toMatchObject({ offset: -4, format: 'jpg' }); // fax p11 (1 Ne 1:1) -> image 007
    expect(await imageScanMeta('1841')).toMatchObject({ offset: 0, format: 'jpg' });  // no front-matter shift
    expect(await imageScanMeta('2013')).toMatchObject({ offset: -9, format: 'png' }); // png-only edition
  });
});
