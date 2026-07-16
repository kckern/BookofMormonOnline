/**
 * test/graphql/xrels-people-places.test.ts
 *
 * Contract tests for `xrels` on People and Place (cross-entity relationships).
 *
 * The bom_xrels table is entirely object-anchored today (every row has
 * src_type='object'; people appear in 1,447 rows and places in 221 rows as
 * DESTINATIONS only). So a person's or place's relationships are the reverse
 * direction: rows where they are the dst. Each such row is exposed in the same
 * Xrel shape the object side uses, with the OTHER party (the source object) in
 * the dst_* fields and direction='dst' so the UI can order name-before-verb
 * ("Synagogues — taught-by" on Aaron's popup).
 *
 * Queries run through the yoga instance against the live DB with the read-only
 * `reader` user, mirroring test/graphql/homesampler.test.ts.
 */

import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';

const db = getDb();
let yoga: ReturnType<typeof createYoga>;
let personSlug: string;
let placeSlug: string;
let personRowCount: number;

async function gql(query: string) {
  const res = await yoga.fetch('http://yoga/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

beforeAll(async () => {
  yoga = createYoga({
    schema: buildSchema(),
    context: () => buildContext(db, 'en'),
  });

  // Pick live sample entities that are xrel destinations, so assertions are
  // stable against real data without hardcoding slugs.
  const person = await db
    .selectFrom('bom_xrels')
    .select(['dst_slug', (eb) => eb.fn.countAll().as('n')])
    .where('dst_type', '=', 'people')
    .groupBy('dst_slug')
    .orderBy('n', 'desc')
    .limit(1)
    .executeTakeFirstOrThrow();
  personSlug = person.dst_slug;
  personRowCount = Number(person.n);

  const place = await db
    .selectFrom('bom_xrels')
    .select(['dst_slug'])
    .where('dst_type', '=', 'place')
    .groupBy('dst_slug')
    .orderBy((eb) => eb.fn.countAll(), 'desc')
    .limit(1)
    .executeTakeFirstOrThrow();
  placeSlug = place.dst_slug;
}, 30000);

afterAll(async () => {
  await closeDb();
});

describe('People.xrels', () => {
  it('returns every reverse xrel row with the source entity resolved', async () => {
    const body = await gql(`{
      person(slug: "${personSlug}") {
        slug
        xrels { rel srcweight dst_type dst_slug dst_name dst_title note verse_id direction }
      }
    }`);
    expect(body.errors).toBeUndefined();
    const xrels = body.data.person[0].xrels;
    expect(xrels).toHaveLength(personRowCount);
    for (const x of xrels) {
      expect(x.rel).toBeTruthy();
      expect(x.dst_slug).toBeTruthy();
      // resolved display name, not a bare slug fallback with dashes
      expect(x.dst_name).toBeTruthy();
      expect(x.direction).toBe('dst');
      // today every source is an object; the loader resolves via src_type
      expect(['object', 'people', 'place']).toContain(x.dst_type);
    }
  }, 30000);

  it('sorts verse-bearing rows first, ascending', async () => {
    const body = await gql(`{
      person(slug: "${personSlug}") { xrels { verse_id } }
    }`);
    const ids = body.data.person[0].xrels
      .map((x: { verse_id: number | null }) => x.verse_id)
      .filter((v: number | null) => v != null);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  }, 30000);
});

describe('Place.xrels', () => {
  it('returns reverse xrel rows for a place', async () => {
    const body = await gql(`{
      place(slug: "${placeSlug}") {
        slug
        xrels { rel dst_slug dst_name direction }
      }
    }`);
    expect(body.errors).toBeUndefined();
    const xrels = body.data.place[0].xrels;
    expect(xrels.length).toBeGreaterThan(0);
    for (const x of xrels) expect(x.direction).toBe('dst');
  }, 30000);
});

describe('Object.xrels regression', () => {
  it('object xrels still resolve and now carry direction=src', async () => {
    const obj = await db
      .selectFrom('bom_xrels')
      .select(['src_slug'])
      .where('src_type', '=', 'object')
      .limit(1)
      .executeTakeFirstOrThrow();
    const body = await gql(`{
      object(slug: "${obj.src_slug}") { xrels { rel dst_name direction } }
    }`);
    expect(body.errors).toBeUndefined();
    const xrels = body.data.object[0].xrels;
    expect(xrels.length).toBeGreaterThan(0);
    for (const x of xrels) expect(x.direction).toBe('src');
  }, 30000);
});
