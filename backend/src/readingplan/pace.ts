// Pure pacing: chunks → SegmentDrafts with dates/periods/refs (spec generator §3).
// Date math is UTC string math — no moment, no local-tz drift (audit P1 #8).
import { generateReference } from 'scripture-guide';
import type { PacingConfig, ScopedSection, SegmentDraft } from './types.js';

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function refFor(start: number, end: number): string {
  const ids = Array.from({ length: end - start + 1 }, (_, k) => start + k);
  return generateReference(ids);
}

export function assignPacing(
  chunks: ScopedSection[][],
  pacing: PacingConfig,
  startdate: string,
): SegmentDraft[] {
  const n = chunks.length;
  return chunks.map((chunk, i) => {
    const start = Math.min(...chunk.map((s) => s.minVerse));
    const end = Math.max(...chunk.map((s) => s.maxVerse));
    let duedate: string | null = null;
    let period: string;
    if (pacing.type === 'cadence') {
      const step = pacing.unit === 'week' ? 7 : 1;
      duedate = addDays(startdate, (i + 1) * step);
      period = `${pacing.unit === 'week' ? 'Week' : 'Day'} ${i + 1}`;
    } else if (pacing.type === 'calendar') {
      // PRECONDITION: `due` is after `startdate` with room for `n` segments.
      // The generator/mutation layer validates this and rejects past-or-too-soon
      // due dates before calling (this pure fn has no warning channel). The
      // Math.max(n, ...) floor is a last-resort guard guaranteeing >=1 day per
      // segment; when the window is shorter than n the plan will extend past `due`.
      const span = Math.max(n, daysBetween(startdate, pacing.due));
      duedate = addDays(startdate, Math.round((span * (i + 1)) / n));
      period = `Part ${i + 1}`;
    } else {
      period = `Part ${i + 1}`;
    }
    return { period, ref: refFor(start, end), duedate, start, end, sectionGuids: chunk.map((s) => s.guid) };
  });
}
