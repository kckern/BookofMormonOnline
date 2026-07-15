import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { getDb } from '../../src/data/db.js';
import { generatePlanSegments } from '../../src/readingplan/generate.js';
import type { PlanConfig } from '../../src/readingplan/types.js';

const db = getDb();
const cfg = (over: Partial<PlanConfig> = {}): PlanConfig => ({
  scope: { type: 'range', start: 31103, end: 31602 },
  pacing: { type: 'cadence', unit: 'day', count: 5 },
  segmentation: { type: 'even', parts: 5 },
  credit: 'fresh',
  ...over,
});

describe('generatePlanSegments (live DB)', () => {
  it('produces dated, ref-labeled segments covering the scope', async () => {
    const { segments, warnings } = await generatePlanSegments(db, cfg(), '2026-07-15');
    expect(segments).toHaveLength(5);
    expect(warnings).toEqual([]);
    expect(segments[0]!.duedate).toBe('2026-07-16');
    expect(segments.every((s) => s.sectionGuids.length > 0)).toBe(true);
    expect(segments.every((s) => s.ref.length > 0)).toBe(true);
  });

  it('is deterministic', async () => {
    const a = await generatePlanSegments(db, cfg(), '2026-07-15');
    const b = await generatePlanSegments(db, cfg(), '2026-07-15');
    expect(a).toEqual(b);
  });

  it('clamps and warns when parts exceed sections', async () => {
    const { segments, warnings } = await generatePlanSegments(
      db, cfg({ segmentation: { type: 'even', parts: 5000 } }), '2026-07-15');
    expect(warnings.some((w) => w.code === 'PARTS_CLAMPED')).toBe(true);
    const clamp = warnings.find((w) => w.code === 'PARTS_CLAMPED');
    expect(segments.length).toBe(clamp!.detail);
  });

  it('empty scope yields EMPTY_SCOPE', async () => {
    const { segments, warnings } = await generatePlanSegments(
      db, cfg({ scope: { type: 'sections', guids: [] } }), '2026-07-15');
    expect(segments).toEqual([]);
    expect(warnings).toEqual([{ code: 'EMPTY_SCOPE' }]);
  });

  it('calendar due on/before startdate → INVALID_DUE warning', async () => {
    const { warnings } = await generatePlanSegments(
      db, cfg({ pacing: { type: 'calendar', due: '2026-07-15' }, segmentation: { type: 'even', parts: 5 } }), '2026-07-15');
    expect(warnings.some((w) => w.code === 'INVALID_DUE')).toBe(true);
  });

  it('calendar window shorter than parts → DUE_TOO_SOON warning (still generates)', async () => {
    const { segments, warnings } = await generatePlanSegments(
      db, cfg({ pacing: { type: 'calendar', due: '2026-07-17' }, segmentation: { type: 'even', parts: 5 } }), '2026-07-15');
    expect(warnings.some((w) => w.code === 'DUE_TOO_SOON')).toBe(true);
    expect(segments.length).toBeGreaterThan(0);
  });
});
