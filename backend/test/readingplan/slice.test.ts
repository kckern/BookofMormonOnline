import { describe, expect, it } from 'vitest';
import { sliceSections } from '../../src/readingplan/slice.js';
import { parsePlanConfig } from '../../src/readingplan/types.js';
import type { ScopedSection } from '../../src/readingplan/types.js';

const sec = (guid: string, blocks: number, page = 'pg1', v = 0): ScopedSection =>
  ({ guid, pageGuid: page, blocks, minVerse: v, maxVerse: v + blocks - 1 });

describe('sliceSections', () => {
  it('even: divides equal sections into equal parts', () => {
    const sections = Array.from({ length: 6 }, (_, i) => sec(`s${i}`, 10, 'pg1', i * 10));
    const { chunks, warnings } = sliceSections(sections, { type: 'even', parts: 3 });
    expect(warnings).toEqual([]);
    expect(chunks.map((c) => c.length)).toEqual([2, 2, 2]);
  });

  it('even: weights by block count (Alma vs Omni)', () => {
    const sections = [sec('alma', 100, 'pg1', 0), ...Array.from({ length: 5 }, (_, i) => sec(`t${i}`, 10, 'pg2', 200 + i * 10))];
    const { chunks } = sliceSections(sections, { type: 'even', parts: 2 });
    expect(chunks[0].map((s) => s.guid)).toEqual(['alma']);
    expect(chunks[1]).toHaveLength(5);
  });

  it('even: clamps when parts exceed section count', () => {
    const sections = [sec('a', 5), sec('b', 5)];
    const { chunks, warnings } = sliceSections(sections, { type: 'even', parts: 30 });
    expect(chunks).toHaveLength(2);
    expect(warnings).toEqual([{ code: 'PARTS_CLAMPED', detail: 2 }]);
  });

  it('even: every part is non-empty and covers all sections in order', () => {
    const sections = Array.from({ length: 17 }, (_, i) => sec(`s${i}`, 1 + (i * 7) % 13, 'pg1', i * 100));
    const { chunks } = sliceSections(sections, { type: 'even', parts: 5 });
    expect(chunks).toHaveLength(5);
    expect(chunks.flat().map((s) => s.guid)).toEqual(sections.map((s) => s.guid));
    chunks.forEach((c) => expect(c.length).toBeGreaterThan(0));
  });

  it('section: one segment per section', () => {
    const sections = [sec('a', 5), sec('b', 7)];
    const { chunks } = sliceSections(sections, { type: 'section' });
    expect(chunks.map((c) => c.map((s) => s.guid))).toEqual([['a'], ['b']]);
  });

  it('page: groups contiguous sections of the same page', () => {
    const sections = [sec('a', 5, 'p1'), sec('b', 5, 'p1'), sec('c', 5, 'p2'), sec('d', 5, 'p3')];
    const { chunks } = sliceSections(sections, { type: 'page' });
    expect(chunks.map((c) => c.map((s) => s.guid))).toEqual([['a', 'b'], ['c'], ['d']]);
  });

  it('empty scope warns', () => {
    const { chunks, warnings } = sliceSections([], { type: 'even', parts: 3 });
    expect(chunks).toEqual([]);
    expect(warnings).toEqual([{ code: 'EMPTY_SCOPE' }]);
  });

  it('even: parts=1 returns one chunk covering all sections', () => {
    const sections = [sec('a', 5), sec('b', 10), sec('c', 3)];
    const { chunks, warnings } = sliceSections(sections, { type: 'even', parts: 1 });
    expect(warnings).toEqual([]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].map((s) => s.guid)).toEqual(['a', 'b', 'c']);
  });

  it('even: parts=sections.length gives one section per chunk, no clamp warning', () => {
    const sections = [sec('a', 5), sec('b', 10), sec('c', 3)];
    const { chunks, warnings } = sliceSections(sections, { type: 'even', parts: 3 });
    expect(warnings).toEqual([]);
    expect(chunks.map((c) => c.map((s) => s.guid))).toEqual([['a'], ['b'], ['c']]);
  });
});

describe('parsePlanConfig parts guard', () => {
  const base = { scope: { type: 'range', start: 1, end: 10 }, pacing: { type: 'selfpaced' }, credit: 'fresh' };
  it('rejects even parts < 1', () => {
    expect(parsePlanConfig(JSON.stringify({ ...base, segmentation: { type: 'even', parts: 0 } }))).toBeNull();
    expect(parsePlanConfig(JSON.stringify({ ...base, segmentation: { type: 'even', parts: -3 } }))).toBeNull();
  });
  it('accepts even parts >= 1 and non-even segmentations', () => {
    expect(parsePlanConfig(JSON.stringify({ ...base, segmentation: { type: 'even', parts: 5 } }))).not.toBeNull();
    expect(parsePlanConfig(JSON.stringify({ ...base, segmentation: { type: 'section' } }))).not.toBeNull();
  });
});
