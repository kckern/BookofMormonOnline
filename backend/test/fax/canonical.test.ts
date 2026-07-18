import { describe, it, expect } from 'vitest';
import { canonicalSelector } from '../../src/media/fax/canonical.js';

describe('canonicalSelector', () => {
  it('uses a readable ref slug for an in-book contiguous range', () => {
    expect(canonicalSelector([31148, 31149, 31150])).toBe('1-nephi-3.2-4');
  });
  it('uses a readable ref slug for a single verse', () => {
    expect(canonicalSelector([31148])).toBe('1-nephi-3.2');
  });
  it('uses a readable slug for a Words of Mormon range', () => {
    expect(canonicalSelector([32775, 32776])).toBe('words-of-mormon-1.1-2');
  });
  it('falls back to ids/ for cross-book contiguous runs', () => {
    expect(canonicalSelector([31720, 31721, 31722, 31723]).startsWith('ids/')).toBe(true);
  });
  it('falls back to ids/ for non-contiguous selections (URL-unsafe slug)', () => {
    expect(canonicalSelector([31103, 31108]).startsWith('ids/')).toBe(true);
  });
});
