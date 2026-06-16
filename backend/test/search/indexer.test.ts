import { describe, expect, test } from 'vitest';
import { verseToPoint } from '../../src/search/indexer.js';
import { pointId } from '../../src/search/points.js';

describe('verseToPoint', () => {
  test('builds a verse IndexPoint with deterministic id and dense vector', () => {
    const p = verseToPoint({ verse_id: 31103, verse_scripture: 'I Nephi having been born' }, [0.1, 0.2], 'en');
    expect(p.id).toBe(pointId('verse', '31103', 0));
    expect(p.type).toBe('verse');
    expect(p.entity_id).toBe('31103');
    expect(p.chunkIndex).toBe(0);
    expect(p.text).toBe('I Nephi having been born');
    expect(p.lang).toBe('en');
    expect(p.dense).toEqual([0.1, 0.2]);
  });
});
