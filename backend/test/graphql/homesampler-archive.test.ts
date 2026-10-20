/**
 * test/graphql/homesampler-archive.test.ts
 *
 * Archive-doc sampler fields (history, josephSmith). Audit 2026-10-15 R2.5
 * josephSmith H1: the joseph-smith-statements rows have id NULL, so seeding on
 * id made every seed return the same document (the 1839 title-page statement).
 * Same harness as homesampler-wave1.test.ts: in-process yoga, read-only live DB.
 */

import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';

const db = getDb();
let yoga: ReturnType<typeof createYoga>;

beforeAll(async () => {
  yoga = createYoga({ schema: buildSchema(), context: () => buildContext(db, 'en') });
  await db.selectFrom('bom_people').select('slug').limit(1).execute();
}, 60000);

afterAll(async () => {
  await closeDb();
});

async function slugFor(field: string, seed: number): Promise<string | null> {
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      query: `query A($seed: Int) { homesampler(seed: $seed) { seed ${field} { slug } } }`,
      variables: { seed },
    }),
  });
  const body = (await res.json()) as { data?: { homesampler: Record<string, { slug: string } | null> | null } };
  return body.data?.homesampler?.[field]?.slug ?? null;
}

// The sampler payload is cached per seed (L1 + shared L2, 6h), so fixed seeds
// would replay whatever an older build computed. Fresh seeds per run.
const base = (Math.floor(Date.now() / 1000) % 1_000_000) * 1000 + 7;
const SEEDS = [0, 1, 2, 3, 4, 5].map((i) => base + i * 7919);

describe('homesampler archive docs', () => {
  it('josephSmith rotates across seeds (not one fixed statement)', async () => {
    const slugs = await Promise.all(SEEDS.map((s) => slugFor('josephSmith', s)));
    expect(slugs.every(Boolean)).toBe(true);
    expect(new Set(slugs).size).toBeGreaterThanOrEqual(4);
  }, 180000);

  it('josephSmith is deterministic per seed', async () => {
    expect(await slugFor('josephSmith', SEEDS[0])).toBe(await slugFor('josephSmith', SEEDS[0]));
  }, 180000);

  it('history still rotates across seeds', async () => {
    const slugs = await Promise.all(SEEDS.map((s) => slugFor('history', s)));
    expect(new Set(slugs.filter(Boolean)).size).toBeGreaterThanOrEqual(4);
  }, 180000);
});

describe('homesampler faxVerse crops (blind R7 faxVerse-A2)', () => {
  it('offers only editions whose crop of the verse validates', async () => {
    const { verseCropOk } = await import('../../src/media/fax/showcase.js');
    for (const seed of SEEDS.slice(0, 3)) {
      const res = await yoga.fetch('http://localhost/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          query: 'query A($seed: Int) { homesampler(seed: $seed) { faxVerse { version verseId editions { version } } } }',
          variables: { seed },
        }),
      });
      const fv = ((await res.json()) as { data?: { homesampler?: { faxVerse?: { version: string; verseId: number; editions: { version: string }[] } } } }).data?.homesampler?.faxVerse;
      expect(fv).toBeTruthy();
      expect(fv!.editions.length).toBeGreaterThan(0);
      expect(fv!.version).toBe(fv!.editions[0]!.version);
      for (const ed of fv!.editions) expect(await verseCropOk(ed.version, fv!.verseId)).toBe(true);
    }
  }, 180000);
});

describe('homesampler josephSmith: no hookless fragments (blind R7 josephSmith-H1)', () => {
  it('never features an editorially excluded one-line fragment', async () => {
    const { sampleJosephSmith, JOSEPH_SMITH_NOT_TILE_WORTHY } = await import('../../src/graphql/resolvers/homesampler.js');
    const { buildContext } = await import('../../src/graphql/context.js');
    const ctx = await buildContext(db, 'en');
    expect(JOSEPH_SMITH_NOT_TILE_WORTHY).toContain('1838-07-elders-journal-jesus-book-of-mormon');
    const slugs = await Promise.all(Array.from({ length: 40 }, (_, i) => sampleJosephSmith(ctx, base + i * 104729).then((r) => r?.slug)));
    expect(slugs.every(Boolean)).toBe(true);
    for (const s of slugs) expect(JOSEPH_SMITH_NOT_TILE_WORTHY).not.toContain(s);
  }, 180000);
});
