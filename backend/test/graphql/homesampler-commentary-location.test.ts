/**
 * Home commentary tiles deep-link to /commentary/:id, which resolves by opening
 * the commentary's host text block (Commentary.location). A sampled commentary
 * without a host (location_guid NULL or dangling — ~6% of the eligible pool)
 * landed on a not-found card (blind audit r4, scripture C4). Every sampled
 * commentary must therefore carry a resolvable location.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';

const db = getDb();
let yoga: ReturnType<typeof createYoga>;
beforeAll(() => {
  yoga = createYoga({ schema: buildSchema(), context: () => buildContext(db, 'en') });
});
afterAll(async () => { await closeDb(); });

const QUERY = /* GraphQL */ `
  query Sampler($seed: Int) {
    homesampler(seed: $seed) { seed commentaries { id location { slug } } }
  }
`;
const run = async (seed: number) => {
  const res = await yoga.fetch('http://yoga/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { seed } }),
  });
  const json = (await res.json()) as any;
  expect(json.errors).toBeUndefined();
  return json.data.homesampler.commentaries as { id: string; location: { slug: string | null } | null }[];
};

describe('homesampler commentaries', () => {
  // seed 1569518101's window was one that served a host-less commentary
  it.each([0, 1, 2, 3, 4, 7, 11, 42, 1882094833, 963618077])('seed %i: every commentary has a host location', async (seed) => {
    const coms = await run(seed);
    expect(coms.length).toBe(3);
    for (const c of coms) expect(c.location?.slug, `commentary ${c.id}`).toBeTruthy();
  }, 60000);
});
