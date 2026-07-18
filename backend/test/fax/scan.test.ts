import { describe, it, expect } from 'vitest';
import { assertScanWidth } from '../../src/media/fax/scan.js';

describe('assertScanWidth', () => {
  it('returns scale 1 when scan width matches stored pageWidth', () => {
    expect(assertScanWidth(768, 768)).toBeCloseTo(1);
  });
  it('returns the rescale factor when they differ', () => {
    expect(assertScanWidth(768, 771)).toBeCloseTo(768 / 771);
  });
});
