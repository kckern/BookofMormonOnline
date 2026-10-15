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
