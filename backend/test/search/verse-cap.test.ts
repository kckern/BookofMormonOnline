import { describe, expect, test } from 'vitest';
import { applyVerseCap, VERSE_CAP } from '../../src/data/loaders/searchhist.js';

describe('applyVerseCap', () => {
  test('VERSE_CAP is 100', () => {
    expect(VERSE_CAP).toBe(100);
  });
  test('caps hydrateIds to the cap while verseTotal reports the raw count', () => {
    const ids = Array.from({ length: 250 }, (_, i) => String(i));
    const { hydrateIds, verseTotal } = applyVerseCap(ids, 100);
    expect(hydrateIds).toHaveLength(100);
    expect(hydrateIds[0]).toBe('0');
    expect(hydrateIds[99]).toBe('99');
    expect(verseTotal).toBe(250);
  });
  test('leaves a short list untouched', () => {
    const { hydrateIds, verseTotal } = applyVerseCap(['a', 'b'], 100);
    expect(hydrateIds).toEqual(['a', 'b']);
    expect(verseTotal).toBe(2);
  });
});
