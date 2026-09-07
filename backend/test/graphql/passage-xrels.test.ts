/**
 * test/graphql/passage-xrels.test.ts
 * Contract tests for passage-anchored xrels: bom_xrels rows whose note carries
 * a parseable scripture ref surface in passagenotes with BOTH endpoints
 * resolved (a passage has no implicit anchor entity).
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { getDb, closeDb } from '../../src/data/db.js';
import { buildSchema } from '../../src/graphql/schema.js';
import { buildContext } from '../../src/graphql/context.js';
import { parseVerseIdFromNote } from '../../src/data/loaders/matters.js';

const db = getDb();
let yoga: ReturnType<typeof createYoga>;
let verseId: number;

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
  const rows = await db.selectFrom('bom_xrels').select(['note']).where('note', 'is not', null).limit(500).execute();
  for (const r of rows) {
    const v = parseVerseIdFromNote(r.note);
    if (v) { verseId = v; break; }
  }
  expect(verseId).toBeGreaterThan(0);
}, 30000);

afterAll(async () => { await closeDb(); });

describe('passagenotes.xrels', () => {
  it('returns both-endpoint rows anchored to verses in range', async () => {
    const body = await gql(`{
      passagenotes(start_verse_id: ${verseId}, end_verse_id: ${verseId}) {
        xrels { rel src_type src_slug src_name dst_type dst_slug dst_name note verse_id }
      }
    }`);
    expect(body.errors).toBeUndefined();
    const xrels = body.data.passagenotes.xrels;
    expect(xrels.length).toBeGreaterThan(0);
    for (const x of xrels) {
      expect(x.verse_id).toBe(verseId);
      expect(x.src_name).toBeTruthy();
      expect(x.dst_name).toBeTruthy();
    }
  }, 30000);
});
