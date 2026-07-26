import { describe, expect, it } from 'vitest';
import { buildDensePages } from '../../src/graphql/resolvers/mediamisc.js';

// first_verse_id / last_verse_id are strings in FaxIndexPageRow (SQL MIN/MAX).
const row = (page: number, first: number, last: number, count: number) => ({
  version: 'x',
  page,
  first_verse_id: String(first),
  last_verse_id: String(last),
  verse_count: count,
});

describe('buildDensePages', () => {
  it('places each page at index page-1 and fills interior gaps with [0,0]', () => {
    // pages 1, 2, 4 have verses; page 3 is a pageless scan (no row emitted)
    const items = [row(1, 10, 12, 3), row(2, 13, 15, 3), row(4, 20, 24, 5)];
    const dense = buildDensePages(items as any);
    expect(dense).toHaveLength(4);        // padded to the max page number (4)
    expect(dense[0]).toEqual([10, 3, 1]); // page 1: fresh-content flag
    expect(dense[1]).toEqual([13, 3, 1]); // page 2: 13 !== prev.last(12) -> flag
    expect(dense[2]).toEqual([0, 0]);     // page 3: interior gap
    expect(dense[3]).toEqual([20, 5, 1]); // page 4 lands at index 3, NOT index 2
  });

  it('omits the fresh-content flag when the first verse continues from the previous page', () => {
    // page 2's first verse equals page 1's last verse (verse straddles the break)
    const items = [row(1, 10, 12, 3), row(2, 12, 14, 3)];
    const dense = buildDensePages(items as any);
    expect(dense[1]).toEqual([12, 3]);    // no trailing 1
  });

  it('pads a leading gap so the first indexed page lands at its true index', () => {
    // Front-matter edition: pages 1 and 2 are unindexed; page 3 is the first content.
    const items = [row(3, 10, 12, 3), row(4, 13, 15, 3)];
    const dense = buildDensePages(items as any);
    expect(dense).toHaveLength(4);
    expect(dense[0]).toEqual([0, 0]);     // page 1: leading gap
    expect(dense[1]).toEqual([0, 0]);     // page 2: leading gap
    expect(dense[2]).toEqual([10, 3, 1]); // page 3: first indexed content at index 2
    expect(dense[3]).toEqual([13, 3, 1]); // page 4
  });

  it('returns an empty array when there are no indexed rows', () => {
    expect(buildDensePages([])).toEqual([]);
  });

  it('keys stored fax pages by image-file page when an edition has an offset', () => {
    // 1879-style mapping: stored page 9 is scan image 1, so stored page 262
    // must be exposed at image page 254 (page 262 + offset -8).
    const items = [row(9, 100, 109, 10), row(262, 200, 209, 10)];
    const dense = buildDensePages(items as any, -8);
    expect(dense).toHaveLength(254);
    expect(dense[0]).toEqual([100, 10, 1]);
    expect(dense[253]).toEqual([200, 10, 1]);
    expect(dense[261]).toBeUndefined();
  });
});
