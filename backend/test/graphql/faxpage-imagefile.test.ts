import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';
import { imageScanMeta } from '../../src/media/fax/resolve.js';

const db = getDb();
let yoga: ReturnType<typeof createYoga>;

beforeAll(async () => {
  yoga = createYoga({ schema: buildSchema(), context: () => buildContext(db, 'en') });
  await db.selectFrom('bom_people').select('slug').limit(1).execute();
});
afterAll(async () => { await closeDb(); });

const QUERY = /* GraphQL */ `
  query FaxPages($seed: Int) {
    homesampler(seed: $seed) {
      fax { slug }
      faxPages { page imageFile ref }
    }
  }
`;

type Sample = {
  fax: { slug: string } | null;
  faxPages: { page: number; imageFile: number; ref: string | null }[];
};

async function exec(seed: number): Promise<Sample> {
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { seed } }),
  });
  const body = (await res.json()) as { data?: { homesampler: Sample }; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data!.homesampler;
}

describe('faxPages.imageFile', () => {
  it('an INDEXED edition maps imageFile = page + scan offset', async () => {
    let indexed: Sample | null = null;
    for (let seed = 1; seed <= 30 && !indexed; seed++) {
      const s = await exec(seed);
      if (s.faxPages.length && s.faxPages.every((p) => p.ref)) indexed = s;
    }
    expect(indexed, 'no indexed edition sampled in seeds 1..30').toBeTruthy();
    const { offset } = await imageScanMeta(String(indexed!.fax!.slug));
    for (const p of indexed!.faxPages) {
      expect(p.imageFile).toBe(p.page + offset);
    }
  });

  it('an UN-INDEXED edition sets imageFile = page (no offset applied)', async () => {
    let unindexed: Sample | null = null;
    for (let seed = 1; seed <= 60 && !unindexed; seed++) {
      const s = await exec(seed);
      if (s.faxPages.length && s.faxPages.every((p) => p.ref === null)) unindexed = s;
    }
    if (unindexed) {
      for (const p of unindexed.faxPages) expect(p.imageFile).toBe(p.page);
    }
  });
});
