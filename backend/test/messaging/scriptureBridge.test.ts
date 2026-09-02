import { describe, expect, test } from 'vitest';
import { detectReferenceStrings } from '../../src/bots/scriptureBridge.js';

describe('scripture bridge reference detection', () => {
  test('detects Book of Mormon references embedded in discussion text', () => {
    const references = detectReferenceStrings('Compare Alma 32:21 with Romans 5:1, then return to Alma 32:21.');
    expect(references.some((reference) => /Alma 32:21/i.test(reference))).toBe(true);
    expect(new Set(references).size).toBe(references.length);
  });

  test('returns no references for ordinary prose', () => {
    expect(detectReferenceStrings('Faith and hope are being discussed here.')).toEqual([]);
  });
});
