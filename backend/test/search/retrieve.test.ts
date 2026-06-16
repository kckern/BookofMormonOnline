import { describe, expect, test } from 'vitest';
import { buildFilter, queryToSparse } from '../../src/search/retrieve.js';

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
