/**
 * test/graphql/homesampler.test.ts
 *
 * Contract tests for the `homesampler` GraphQL query (Home Sampler Redesign).
 * Written TDD-first: the SDL exists (schema/HomeSampler.graphql) but the resolver
 * does NOT yet, so `homesampler` resolves to null and these assertions fail. That
 * red state is expected — the resolver lands in a later task.
 *
 * Operations execute through the yoga instance itself (not the raw `graphql`
 * package) so the schema and executor share one graphql realm — this avoids
 * vitest's cross-realm GraphQLSchema error and exercises the real HTTP → yoga →
 * resolver path. Queries are READ-ONLY, running against the live DB with the
 * read-only `reader` user.
 *
 * Design contract asserted here (so the future resolver matches):
 *   - people   → exactly 8 rows, each with a slug
 *   - places   → exactly 5 rows
 *   - fax      → 1 object with a slug
 *   - commentary → 1 object with an id and substantive text (>500 chars)
 *   - contents → 1 Division with a slug
 *   - sampling is deterministic per seed, varies across seeds
 *   - with no seed, the resolver generates a positive integer seed and echoes it
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
  yoga = createYoga({
    schema: buildSchema(),
    context: () => buildContext(db, 'en'),
  });
});

afterAll(async () => {
  await closeDb();
});

const QUERY = /* GraphQL */ `
  query Sampler($seed: Int) {
    homesampler(seed: $seed) {
      seed
      people { slug name }
      places { slug name }
      fax { slug title }
      commentary { id title text }
      contents { slug title }
    }
  }
`;

type Sampler = {
  seed: number;
  people: { slug: string; name: string | null }[];
  places: { slug: string; name: string | null }[];
  fax: { slug: string; title: string | null } | null;
  commentary: { id: string; title: string | null; text: string | null } | null;
  contents: { slug: string | null; title: string | null } | null;
};

/** Execute the sampler query through yoga and return the `homesampler` payload. */
async function exec(seed?: number): Promise<Sampler> {
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { seed } }),
  });
  const body = (await res.json()) as {
    data?: { homesampler: Sampler | null };
    errors?: Array<{ message: string }>;
  };
  if (body.errors?.length) {
    throw new Error(`GraphQL errors: ${body.errors.map((e) => e.message).join('; ')}`);
  }
  return body.data!.homesampler as Sampler;
}

describe('homesampler', () => {
  it('returns a full sampler payload', async () => {
    const s = await exec(12345);
    expect(s.people).toHaveLength(8);
    expect(s.people.every((p) => p.slug)).toBe(true);
    expect(s.places).toHaveLength(5);
    expect(s.fax?.slug).toBeTruthy();
    expect(s.commentary?.id).toBeTruthy();
    expect(s.contents?.slug).toBeTruthy();
    expect(s.seed).toBe(12345);
  });

  it('is deterministic for the same seed', async () => {
    const [a, b] = await Promise.all([exec(777), exec(777)]);
    expect(a.people.map((p) => p.slug)).toEqual(b.people.map((p) => p.slug));
    expect(a.places.map((p) => p.slug)).toEqual(b.places.map((p) => p.slug));
    expect(a.commentary?.id).toBe(b.commentary?.id);
    expect(a.fax?.slug).toBe(b.fax?.slug);
    expect(a.contents?.slug).toBe(b.contents?.slug);
  });

  it('varies across seeds', async () => {
    const [a, b] = await Promise.all([exec(1001), exec(2002)]);
    expect(a.people.map((p) => p.slug)).not.toEqual(b.people.map((p) => p.slug));
  });

  it('generates and echoes a seed when none is given', async () => {
    const s = await exec(undefined);
    expect(Number.isInteger(s.seed)).toBe(true);
    expect(s.seed).toBeGreaterThan(0);
    expect(s.people).toHaveLength(8);
  });

  it('samples only substantive commentary', async () => {
    const s = await exec(4242);
    expect((s.commentary?.text ?? '').length).toBeGreaterThan(500);
  });
});
