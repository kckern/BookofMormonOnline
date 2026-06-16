import { describe, expect, test } from 'vitest';
import { rankRowsByCandidateOrder } from '../../src/data/loaders/searchhist.js';

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
