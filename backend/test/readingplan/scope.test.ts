import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { getDb } from '../../src/data/db.js';
import { resolveScope } from '../../src/readingplan/scope.js';

const db = getDb();

describe('resolveScope (live DB, read-only)', () => {
  it('range: returns ordered whole sections with block counts', async () => {
    const sections = await resolveScope(db, { type: 'range', start: 31103, end: 31300 });
    expect(sections.length).toBeGreaterThan(0);
    for (const s of sections) {
      expect(s.blocks).toBeGreaterThan(0);
      expect(s.minVerse).toBeLessThanOrEqual(s.maxVerse);
    }
    const mins = sections.map((s) => s.minVerse);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins); // ordered by narrative position
  });

  it('pages: resolves a real page slug to its sections', async () => {
    const sections = await resolveScope(db, { type: 'pages', slugs: ['lehites'] });
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.every((s) => s.guid && s.blocks > 0)).toBe(true);
  });

  it('sections passthrough aggregates the given guids', async () => {
    const range = await resolveScope(db, { type: 'range', start: 31103, end: 31300 });
    const guids = range.slice(0, 2).map((s) => s.guid);
    const out = await resolveScope(db, { type: 'sections', guids });
    expect(out.map((s) => s.guid).sort()).toEqual([...guids].sort());
  });

  it('empty input returns empty', async () => {
    expect(await resolveScope(db, { type: 'sections', guids: [] })).toEqual([]);
  });
});
