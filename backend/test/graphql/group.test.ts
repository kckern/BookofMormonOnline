/**
 * test/graphql/group.test.ts
 * Contract tests for the synthesized Group entity. Groups have no table —
 * 79 slugs exist only as bom_xrels.dst_slug values (nephites ×124 …), so a
 * Group is: slug + de-slugged name + reverse xrels.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';

const db = getDb();
let yoga: ReturnType<typeof createYoga>;
let groupSlug: string;
let secondGroupSlug: string;
let groupRowCount: number;

async function gql(query: string) {
  const res = await yoga.fetch('http://yoga/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

beforeAll(async () => {
  yoga = createYoga({ schema: buildSchema(), context: () => buildContext(db, 'en') });
  const [top, second] = await db
    .selectFrom('bom_xrels')
    .select(['dst_slug', (eb) => eb.fn.countAll().as('n')])
    .where('dst_type', '=', 'group')
    .groupBy('dst_slug')
    .orderBy('n', 'desc')
    .limit(2)
    .execute();
  if (!top || !second) throw new Error('expected at least two group slugs in bom_xrels');
  groupSlug = top.dst_slug;             // expected: 'nephites'
  groupRowCount = Number(top.n);        // expected: 124
  secondGroupSlug = second.dst_slug;    // expected: 'jaredites'
}, 30000);

afterAll(async () => { await closeDb(); });

describe('Group', () => {
  it('resolves a synthesized group with de-slugged name and reverse xrels', async () => {
    const body = await gql(`{
      group(slug: "${groupSlug}") {
        slug name
        xrels { rel dst_type dst_slug dst_name direction }
      }
    }`);
    expect(body.errors).toBeUndefined();
    const g = body.data.group[0];
    expect(g.slug).toBe(groupSlug);
    expect(g.name).toMatch(/^[A-Z]/);          // "Nephites", not "nephites"
    // Round-trip: the name is the slug with word casing applied, nothing added or lost.
    expect(g.name.toLowerCase().split(' ').join('-')).toBe(groupSlug);
    expect(g.xrels).toHaveLength(groupRowCount);
    for (const x of g.xrels) {
      expect(x.direction).toBe('dst');
      expect(x.dst_name).toBeTruthy();          // source entity resolved
    }
  }, 30000);

  it('multi-slug query keeps order and drops unknown slugs', async () => {
    const body = await gql(`{
      group(slug: ["${groupSlug}", "no-such-group", "${secondGroupSlug}"]) { slug }
    }`);
    expect(body.errors).toBeUndefined();
    expect(body.data.group.map((g: { slug: string }) => g.slug)).toEqual([groupSlug, secondGroupSlug]);
  }, 30000);

  it('unknown group slug resolves to an empty list, not an error', async () => {
    const body = await gql(`{ group(slug: "no-such-group") { slug } }`);
    expect(body.errors).toBeUndefined();
    expect(body.data.group ?? []).toHaveLength(0);
  }, 30000);
});
