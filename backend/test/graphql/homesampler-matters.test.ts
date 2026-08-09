/**
 * Contract tests for the matters samplers on `homesampler`.
 * Groups derive from bom_matters.branch × specificity:
 *   narrative = concrete + instance,  material = concrete + !instance,
 *   concept   = concepts.
 * Read-only, runs against the live DB via the `reader` user (mirrors homesampler.test.ts).
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
  await db.selectFrom('bom_matters').select('slug').limit(1).execute();
});
afterAll(async () => { await closeDb(); });

const QUERY = /* GraphQL */ `
  query M($seed: Int) {
    homesampler(seed: $seed) {
      mattersNarrative { slug branch specificity }
      mattersMaterial  { slug branch specificity }
      mattersConcept   { slug branch }
      mattersNarrativeCount
      mattersMaterialCount
      mattersConceptCount
    }
  }
`;

type M = { slug: string; branch: string; specificity?: string };
type Payload = {
  mattersNarrative: M[]; mattersMaterial: M[]; mattersConcept: M[];
  mattersNarrativeCount: number; mattersMaterialCount: number; mattersConceptCount: number;
};

async function exec(seed?: number): Promise<Payload> {
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { seed } }),
  });
  const body = (await res.json()) as { data?: { homesampler: Payload }; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data!.homesampler;
}

describe('homesampler matters', () => {
  it('narrative = concrete + instance', async () => {
    const s = await exec(12345);
    expect(s.mattersNarrative.length).toBeGreaterThan(0);
    expect(s.mattersNarrative.length).toBeLessThanOrEqual(17);
    expect(s.mattersNarrative.every((m) => m.branch === 'concrete' && m.specificity === 'instance')).toBe(true);
  });

  it('material = concrete + not-instance', async () => {
    const s = await exec(12345);
    expect(s.mattersMaterial.length).toBeGreaterThan(0);
    expect(s.mattersMaterial.every((m) => m.branch === 'concrete' && m.specificity !== 'instance')).toBe(true);
  });

  it('concept = concepts branch', async () => {
    const s = await exec(12345);
    expect(s.mattersConcept.length).toBeGreaterThan(0);
    expect(s.mattersConcept.every((m) => m.branch === 'concepts')).toBe(true);
  });

  it('the three groups are disjoint within one sample', async () => {
    const s = await exec(12345);
    const all = [...s.mattersNarrative, ...s.mattersMaterial, ...s.mattersConcept].map((m) => m.slug);
    expect(new Set(all).size).toBe(all.length);
  });

  it('counts are populated and plausible', async () => {
    const s = await exec(999);
    expect(s.mattersNarrativeCount).toBeGreaterThan(100);
    expect(s.mattersMaterialCount).toBeGreaterThan(100);
    expect(s.mattersConceptCount).toBeGreaterThan(100);
  });

  it('is deterministic for the same seed', async () => {
    const [a, b] = await Promise.all([exec(777), exec(777)]);
    expect(a.mattersNarrative.map((m) => m.slug)).toEqual(b.mattersNarrative.map((m) => m.slug));
    expect(a.mattersConcept.map((m) => m.slug)).toEqual(b.mattersConcept.map((m) => m.slug));
  });

  it('varies across seeds', async () => {
    const [a, b] = await Promise.all([exec(1001), exec(2002)]);
    expect(a.mattersMaterial.map((m) => m.slug)).not.toEqual(b.mattersMaterial.map((m) => m.slug));
  });
});
