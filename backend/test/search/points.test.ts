import { describe, expect, test } from 'vitest';
import { pointId, fuseRrf, hitsToRankedVerseIds } from '../../src/search/points.js';
import type { SearchHit } from '../../src/search/types.js';

describe('pointId', () => {
  test('is deterministic for the same key', () => {
    expect(pointId('verse', '31103', 0)).toBe(pointId('verse', '31103', 0));
  });
  test('differs by type, entity, and chunk', () => {
    const a = pointId('verse', '31103', 0);
    expect(a).not.toBe(pointId('person', '31103', 0));
    expect(a).not.toBe(pointId('verse', '31104', 0));
    expect(a).not.toBe(pointId('verse', '31103', 1));
  });
  test('looks like a uuid', () => {
    expect(pointId('verse', '31103', 0)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('fuseRrf', () => {
  test('reciprocal-rank-fuses two ranked id lists (k=60)', () => {
    const dense = ['a', 'b', 'c'];
    const sparse = ['b', 'd', 'a'];
    const fused = fuseRrf([dense, sparse], 60);
    expect(fused[0]).toBe('b');
    expect(fused).toContain('d');
    expect(fused.indexOf('a')).toBeLessThan(fused.indexOf('c'));
  });
  test('empty lists → empty result', () => {
    expect(fuseRrf([[], []], 60)).toEqual([]);
  });
});

describe('hitsToRankedVerseIds', () => {
  test('maps verse hits to entity_ids preserving order, de-dupes', () => {
    const hits: SearchHit[] = [
      { type: 'verse', entity_id: '31103', score: 0.9, text: '', ref: null, slug: null, version: null },
      { type: 'verse', entity_id: '31104', score: 0.8, text: '', ref: null, slug: null, version: null },
      { type: 'verse', entity_id: '31103', score: 0.7, text: '', ref: null, slug: null, version: null },
    ];
    expect(hitsToRankedVerseIds(hits)).toEqual(['31103', '31104']);
  });
});
