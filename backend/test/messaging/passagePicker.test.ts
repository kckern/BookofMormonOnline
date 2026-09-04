import { describe, expect, test } from 'vitest';
import { localDateInTimeZone, pickBucket, rangeMatch, type PassageWindow } from '../../src/bots/passagePicker.js';

const window: PassageWindow = {
  windowKey: 'week-1', sequence: 0, label: 'Week 1',
  ranges: [{ ordinal: 0, passageRef: '1 Nephi 1:1-3', minVerseId: 31103, maxVerseId: 31105 }],
};

describe('managed passage selection', () => {
  test('uses the channel timezone to choose the curriculum date', () => {
    const instant = new Date('2027-01-01T01:00:00Z');
    expect(localDateInTimeZone(instant, 'America/Los_Angeles')).toBe('2026-12-31');
    expect(localDateInTimeZone(instant, 'Asia/Seoul')).toBe('2027-01-01');
  });

  test('a block is eligible when any bom_lookup verse overlaps a range', () => {
    expect(rangeMatch([31102, 31103], window)?.ordinal).toBe(0);
    expect(rangeMatch([31106, 31107], window)).toBeNull();
  });

  test('style roll observes the 85/15 boundary', () => {
    expect(pickBucket(() => 0.849)).toBe('discourse_poetry');
    expect(pickBucket(() => 0.85)).toBe('narrative');
  });
});
