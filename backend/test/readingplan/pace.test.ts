import { describe, expect, it } from 'vitest';
import { addDays, assignPacing } from '../../src/readingplan/pace.js';
import type { ScopedSection } from '../../src/readingplan/types.js';

const sec = (guid: string, minVerse: number, maxVerse: number): ScopedSection =>
  ({ guid, pageGuid: 'pg', blocks: 3, minVerse, maxVerse });

describe('addDays', () => {
  it('adds across month boundaries in UTC', () => {
    expect(addDays('2026-07-30', 3)).toBe('2026-08-02');
  });
});

describe('assignPacing', () => {
  const chunks = [[sec('a', 1, 20)], [sec('b', 21, 60)], [sec('c', 61, 90)]];

  it('cadence daily: sequential duedates and Day N periods', () => {
    const drafts = assignPacing(chunks, { type: 'cadence', unit: 'day', count: 3 }, '2026-07-15');
    expect(drafts.map((d) => d.duedate)).toEqual(['2026-07-16', '2026-07-17', '2026-07-18']);
    expect(drafts.map((d) => d.period)).toEqual(['Day 1', 'Day 2', 'Day 3']);
  });

  it('cadence weekly: 7-day steps, Week N', () => {
    const drafts = assignPacing(chunks, { type: 'cadence', unit: 'week', count: 3 }, '2026-07-15');
    expect(drafts.map((d) => d.duedate)).toEqual(['2026-07-22', '2026-07-29', '2026-08-05']);
    expect(drafts[0]!.period).toBe('Week 1');
  });

  it('calendar: spreads evenly to the due date', () => {
    const drafts = assignPacing(chunks, { type: 'calendar', due: '2026-07-24' }, '2026-07-15');
    expect(drafts[2]!.duedate).toBe('2026-07-24');
    expect(drafts.map((d) => d.duedate)).toEqual(['2026-07-18', '2026-07-21', '2026-07-24']);
  });

  it('selfpaced: null dates, Part N', () => {
    const drafts = assignPacing(chunks, { type: 'selfpaced' }, '2026-07-15');
    expect(drafts.every((d) => d.duedate === null)).toBe(true);
    expect(drafts.map((d) => d.period)).toEqual(['Part 1', 'Part 2', 'Part 3']);
  });

  it('carries verse extents and sectionGuids; generates a ref', () => {
    const drafts = assignPacing(chunks, { type: 'selfpaced' }, '2026-07-15');
    expect(drafts[0]).toMatchObject({ start: 1, end: 20, sectionGuids: ['a'] });
    expect(typeof drafts[0]!.ref).toBe('string');
    expect(drafts[0]!.ref.length).toBeGreaterThan(0);
  });
});
