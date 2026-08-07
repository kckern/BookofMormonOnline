import { describe, expect, test } from 'vitest';
import { rankRowsByCandidateOrder, resolveCandidates } from '../../src/data/loaders/searchhist.js';

describe('resolveCandidates (keyword-first)', () => {
  const db = {} as never;
  test('keyword hits → semantic:false and the semantic lookup is NOT called', async () => {
    let semCalled = false;
    const r = await resolveCandidates(db, 'charity', 'en', true, {
      keyword: async () => ['101', '102'],
      semantic: async () => { semCalled = true; return ['999']; },
    });
    expect(r).toEqual({ ids: ['101', '102'], semantic: false });
    expect(semCalled).toBe(false);
  });
  test('zero keyword → semantic fallback runs and returns semantic:true', async () => {
    const r = await resolveCandidates(db, 'afterlife', 'en', true, {
      keyword: async () => [], semantic: async () => ['200', '201'],
    });
    expect(r).toEqual({ ids: ['200', '201'], semantic: true });
  });
  test('zero keyword + zero semantic → empty, semantic:false', async () => {
    const r = await resolveCandidates(db, 'zzz', 'en', true, { keyword: async () => [], semantic: async () => [] });
    expect(r).toEqual({ ids: [], semantic: false });
  });
  test('zero keyword + semantic throws → empty, never throws', async () => {
    const r = await resolveCandidates(db, 'x', 'en', true, { keyword: async () => [], semantic: async () => { throw new Error('down'); } });
    expect(r).toEqual({ ids: [], semantic: false });
  });
  test('rich mode runs semantic directly, skips keyword, semantic:true', async () => {
    let kwCalled = false;
    const r = await resolveCandidates(db, 'charity', 'en', true, {
      keyword: async () => { kwCalled = true; return ['1']; },
      semantic: async () => ['200', '201'],
    }, 'rich');
    expect(r).toEqual({ ids: ['200', '201'], semantic: true });
    expect(kwCalled).toBe(false);
  });
  test('rich mode with zero semantic hits but backend reachable → semantic:true, empty ids', async () => {
    const r = await resolveCandidates(db, 'q', 'en', true, { keyword: async () => ['x'], semantic: async () => [] }, 'rich');
    expect(r).toEqual({ ids: [], semantic: true });
  });
  test('rich mode when semantic throws → empty, semantic:false (degraded)', async () => {
    const r = await resolveCandidates(db, 'q', 'en', true, { keyword: async () => ['x'], semantic: async () => { throw new Error('down'); } }, 'rich');
    expect(r).toEqual({ ids: [], semantic: false });
  });
});

describe('rankRowsByCandidateOrder', () => {
  test('reorders rows to match the candidate verse_id order', () => {
    const rows = [{ verse_id: '31104' }, { verse_id: '31103' }, { verse_id: '31200' }];
    const ranked = rankRowsByCandidateOrder(rows, ['31200', '31103', '31104']);
    expect(ranked.map((r) => r.verse_id)).toEqual(['31200', '31103', '31104']);
  });
  test('rows whose verse_id is not in the candidate order go last, original order preserved', () => {
    const rows = [{ verse_id: 'a' }, { verse_id: 'b' }, { verse_id: 'c' }];
    const ranked = rankRowsByCandidateOrder(rows, ['c']);
    expect(ranked.map((r) => r.verse_id)).toEqual(['c', 'a', 'b']);
  });
  test('empty candidate order returns rows unchanged', () => {
    const rows = [{ verse_id: 'a' }, { verse_id: 'b' }];
    expect(rankRowsByCandidateOrder(rows, []).map((r) => r.verse_id)).toEqual(['a', 'b']);
  });
});
