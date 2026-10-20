// Blind r8 commentary-H1: one sampled Home commentary in three was a dud
// (pointer, stub, citation dump, mid-sentence fragment). None may be served.
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';
import { isDudCommentary } from '../../src/graphql/resolvers/commentaryFilters.js';

const db = getDb();
let yoga: ReturnType<typeof createYoga>;
beforeAll(() => {
  yoga = createYoga({ schema: buildSchema(), context: () => buildContext(db, 'en') });
});
afterAll(async () => { await closeDb(); });

const QUERY = /* GraphQL */ `
  query Sampler($seed: Int) { homesampler(seed: $seed) { commentaries { id text } } }
`;

describe('homesampler commentaries are never duds', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 42])('seed %i', async (seed) => {
    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { seed } }),
    });
    const json = (await res.json()) as any;
    expect(json.errors).toBeUndefined();
    const coms = json.data.homesampler.commentaries as { id: string; text: string }[];
    expect(coms.length).toBe(3);
    for (const c of coms) expect(isDudCommentary({ text: c.text, is_note: 0 }), `commentary ${c.id}`).toBe(false);
  }, 60000);
});
