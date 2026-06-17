import { describe, expect, test } from 'vitest';
import { verseToPoint, toUnits, unitToPoint } from '../../src/search/indexer.js';
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
    expect(p.sparse.indices.length).toBe(p.sparse.values.length);
    expect(p.sparse.indices.length).toBeGreaterThan(0);
  });
});

describe('toUnits', () => {
  test('single-chunk type yields one unit per row (chunkIndex 0)', () => {
    const cfg = { type: 'person' as const, chunk: false };
    const units = toUnits(cfg, [{ entity_id: 'abinadi', title: 'Abinadi', text: 'Abinadi prophet', slug: 'people/abinadi', ref: null }]);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ type: 'person', entity_id: 'abinadi', chunkIndex: 0, text: 'Abinadi prophet', title: 'Abinadi', slug: 'people/abinadi' });
  });
  test('chunked type splits long text into multiple units with incrementing chunkIndex', () => {
    const cfg = { type: 'commentary' as const, chunk: true, maxChars: 20 };
    const long = 'Sentence one here. Sentence two here. Sentence three here.';
    const units = toUnits(cfg, [{ entity_id: 'c1', title: null, text: long, slug: 'x', ref: null }]);
    expect(units.length).toBeGreaterThan(1);
    expect(units.map((u) => u.chunkIndex)).toEqual(units.map((_, i) => i));
  });
  test('empty text rows are dropped', () => {
    const cfg = { type: 'page' as const, chunk: false };
    expect(toUnits(cfg, [{ entity_id: 'p', title: 'T', text: '   ', slug: 's', ref: null }])).toEqual([]);
  });
});

describe('unitToPoint', () => {
  test('builds an IndexPoint with deterministic id, dense, title', () => {
    const unit = { type: 'person' as const, entity_id: 'abinadi', chunkIndex: 0, text: 'Abinadi prophet', title: 'Abinadi', slug: 'people/abinadi', ref: null };
    const p = unitToPoint(unit, [0.1, 0.2], 'en');
    expect(p.id).toBe(pointId('person', 'abinadi', 0));
    expect(p).toMatchObject({ type: 'person', entity_id: 'abinadi', chunkIndex: 0, text: 'Abinadi prophet', title: 'Abinadi', slug: 'people/abinadi', lang: 'en', version: null });
    expect(p.dense).toEqual([0.1, 0.2]);
    expect(p.sparse.indices.length).toBe(p.sparse.values.length);
  });
});
