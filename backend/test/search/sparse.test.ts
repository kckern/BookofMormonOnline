import { describe, expect, test } from 'vitest';
import { textToSparse } from '../../src/search/sparse.js';

describe('textToSparse', () => {
  test('one entry per distinct lowercased alphanumeric term; values all 1; equal lengths', () => {
    const s = textToSparse('Faith faith HOPE');
    expect(s.indices.length).toBe(s.values.length);
    expect(s.indices.length).toBe(2);
    expect(s.values.every((v) => v === 1)).toBe(true);
  });
  test('deterministic: same text → same indices', () => {
    expect(textToSparse('charity')).toEqual(textToSparse('charity'));
  });
  test('distinct terms → distinct indices', () => {
    const a = textToSparse('faith').indices[0];
    const b = textToSparse('hope').indices[0];
    expect(a).not.toBe(b);
  });
  test('empty / whitespace → empty sparse', () => {
    expect(textToSparse('   ')).toEqual({ indices: [], values: [] });
  });
});
