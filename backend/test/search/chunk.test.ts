import { describe, expect, test } from 'vitest';
import { chunkText } from '../../src/search/chunk.js';

describe('chunkText', () => {
  test('short text returns a single chunk', () => {
    expect(chunkText('And it came to pass', 100)).toEqual(['And it came to pass']);
  });

  test('long text splits on sentence boundaries within the limit', () => {
    const text = 'Alpha sentence one. Beta sentence two. Gamma sentence three.';
    const chunks = chunkText(text, 25);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(40); // limit + one sentence slack
    expect(chunks.join(' ')).toContain('Gamma sentence three.');
  });

  test('empty/whitespace returns no chunks', () => {
    expect(chunkText('   ', 100)).toEqual([]);
  });
});
