import { describe, it, expect } from 'vitest';
// @ts-expect-error plain .mjs script module
import { FAMILIES, variantKey, servedPath, plan } from '../../scripts/lib/mediaVariantKeys.mjs';

describe('variantKey', () => {
  it('keeps the original key (incl. extension) so keys never collide', () => {
    expect(variantKey(256, 'fax/thumb/1830/010.jpg')).toBe('variants/256/fax/thumb/1830/010.jpg.webp');
    expect(variantKey(256, 'art/1039')).toBe('variants/256/art/1039.webp');
    expect(variantKey(640, 'history/fax/0120.001.jpg')).toBe('variants/640/history/fax/0120.001.jpg.webp');
  });
});

describe('plan', () => {
  const listed = ['art/1', 'art/2', 'fax/pages/1830/010.jpg', 'fax/thumb/1830/010.jpg', 'history/thumbs/0120', 'people/nephi1', 'art/'];
  it('keeps only tile families: never fax/pages, never the already-done people/places/matters, never bare prefixes', () => {
    const keys = plan(listed, new Set()).map((p: { key: string }) => p.key);
    expect(keys).toEqual(['art/1', 'art/2', 'fax/thumb/1830/010.jpg', 'history/thumbs/0120']);
  });
  it('skips keys whose every variant already exists (idempotent)', () => {
    const have = new Set([variantKey(256, 'art/1'), variantKey(640, 'art/1')]);
    expect(plan(listed, have).map((p: { key: string }) => p.key)).not.toContain('art/1');
  });
  it('plans only the missing widths', () => {
    const have = new Set([variantKey(256, 'art/1')]);
    const p = plan(['art/1'], have)[0];
    expect(p.missing).toEqual([640]);
    expect(p.widths).toEqual(FAMILIES.find((f: { name: string }) => f.name === 'art').widths);
  });
  it('does not plan a 640 variant for fax thumbnails (originals are ~261px wide)', () => {
    const p = plan(['fax/thumb/1830/010.jpg'], new Set())[0];
    expect(p.widths).toEqual([256]);
  });

  // Review Focus 2: S3 holds art/1000.jpg but tiles (and the media host) use art/1000 —
  // the variant is keyed by the path the TILE requests, or the frontend never finds it.
  it('keys variants by the tile-facing path: extension stripped where tiles omit it', () => {
    expect(servedPath('art/1000.jpg')).toBe('art/1000');
    expect(servedPath('history/thumbs/0155.jpg')).toBe('history/thumbs/0155');
    expect(servedPath('fax/covers/1830.jpg')).toBe('fax/covers/1830');
    expect(servedPath('source/cover/012.jpg')).toBe('source/cover/012');
    // these tile paths keep their extension
    expect(servedPath('fax/thumb/1830/010.jpg')).toBe('fax/thumb/1830/010.jpg');
    expect(servedPath('history/fax/0101.001.jpg')).toBe('history/fax/0101.001.jpg');
  });
  it('plans against the served-path variant key (so existing variants are recognised)', () => {
    const have = new Set([variantKey(256, 'art/1000'), variantKey(640, 'art/1000')]);
    expect(plan(['art/1000.jpg'], have)).toEqual([]);
    expect(plan(['art/1000.jpg'], new Set())[0].served).toBe('art/1000');
  });
});
