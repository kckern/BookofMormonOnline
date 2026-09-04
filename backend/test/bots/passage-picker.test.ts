/**
 * test/bots/passage-picker.test.ts — style bucket weighting.
 * (The DB-bound pickStyleWeightedPassage is validated by the dry-run harness.)
 */
import { describe, it, expect } from 'vitest';
import { pickBucket } from '../../src/bots/passagePicker.js';

describe('pickBucket', () => {
  it('maps the random draw to buckets by weight (85 / 15)', () => {
    expect(pickBucket(() => 0.0)).toBe('discourse_poetry');
    expect(pickBucket(() => 0.84)).toBe('discourse_poetry');
    expect(pickBucket(() => 0.86)).toBe('narrative');
    expect(pickBucket(() => 0.999)).toBe('narrative');
  });

  it('roughly honors the 85/15 split over many draws', () => {
    let dp = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) if (pickBucket() === 'discourse_poetry') dp++;
    const ratio = dp / N;
    expect(ratio).toBeGreaterThan(0.80);
    expect(ratio).toBeLessThan(0.90);
  });
});
