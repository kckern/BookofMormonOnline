import { describe, expect, test } from 'vitest';
import { buildFilter, queryToSparse, searchVectors } from '../../src/search/retrieve.js';

describe('buildFilter', () => {
  test('no filters → undefined', () => {
    expect(buildFilter({ query: 'faith' })).toBeUndefined();
  });
  test('type + lang produce keyword match conditions', () => {
    expect(buildFilter({ query: 'faith', types: ['verse'], lang: 'en' })).toEqual({
      must: [
        { key: 'type', match: { any: ['verse'] } },
        { key: 'lang', match: { value: 'en' } },
      ],
    });
  });
  test('version uses match.any', () => {
    expect(buildFilter({ query: 'x', version: ['LDS', 'KJV'] })).toEqual({
      must: [{ key: 'version', match: { any: ['LDS', 'KJV'] } }],
    });
  });
});

describe('queryToSparse', () => {
  test('lowercases, dedupes terms, builds indices+values of equal length', () => {
    const s = queryToSparse('Faith faith HOPE');
    expect(s.indices.length).toBe(s.values.length);
    expect(s.indices.length).toBe(2); // faith, hope
    expect(s.values.every((v) => v > 0)).toBe(true);
  });
  test('empty query → empty sparse', () => {
    expect(queryToSparse('   ')).toEqual({ indices: [], values: [] });
  });
});

describe('searchVectors', () => {
  test('returns dense + sparse for a query (sparse from queryToSparse)', async () => {
    const v = await searchVectors('faith hope', async () => [1, 2, 3]); // injected dense embedder
    expect(v.dense).toEqual([1, 2, 3]);
    expect(v.sparse.indices.length).toBe(v.sparse.values.length);
    expect(v.sparse.indices.length).toBe(2); // faith, hope
  });
});
