import { describe, it, expect } from 'vitest';
import { canonicalSelector } from '../../src/media/fax/canonical.js';

describe('canonicalSelector', () => {
  // Single-verse in-book reference: round-trip succeeds because there is no
  // range hyphen to lose in deslugify. 31148 = 1 Nephi 3:2.
  it('uses a ref slug for a single-verse in-book reference that round-trips', () => {
    const r = canonicalSelector([31148]);
    expect(r).toMatch(/^1-nephi-3\.2$/);
  });

  // Words of Mormon multi-verse range: slugify produces a range hyphen
  // (e.g. "words-of-mormon-1.1-2") that deslugify converts to a space,
  // breaking the verse range so the round-trip returns fewer verses.
  // 32775 = WoM 1:1, 32776 = WoM 1:2.
  it('falls back to ids/ for a Words of Mormon multi-verse range (slug does not round-trip)', () => {
    const r = canonicalSelector([32775, 32776]);
    expect(r.startsWith('ids/')).toBe(true);
  });

  // Cross-book contiguous run: verse ids are globally sequential, so a
  // contiguous run can span a book boundary. The generated ref looks like
  // "1 Nephi 22:31 - 2 Nephi 1:3" which slugifies with a triple-hyphen
  // separator that deslugify cannot reconstruct.
  // 31720 = 1 Ne 22:31, 31721-31723 = 2 Ne 1:1-3.
  it('falls back to ids/ for cross-book contiguous runs', () => {
    const r = canonicalSelector([31720, 31721, 31722, 31723]);
    expect(r.startsWith('ids/')).toBe(true);
  });

  // Non-contiguous selection that contains a multi-verse range with a gap:
  // generateReference produces "1 Nephi 3:2-4; 3:6", whose slug contains a
  // range hyphen that deslugify converts to a space, breaking the round-trip.
  // 31148-31150 = 1 Ne 3:2-4, 31152 = 1 Ne 3:6 (skipping 31151 = 3:5).
  it('uses ids/ for non-contiguous selections whose ref contains a range', () => {
    const r = canonicalSelector([31148, 31149, 31150, 31152]);
    expect(r.startsWith('ids/')).toBe(true);
  });
});
