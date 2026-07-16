/**
 * test/graphql/homesampler-wave1.test.ts
 *
 * Contract tests for the Wave-1 sampler fields (notes, faxVerse, crossrefs,
 * relationship, mapstory). Spec: docs/specs/2026-07-16-home-sampler-wave1-tiles-design.md
 * Same harness as homesampler.test.ts: in-process yoga, read-only live-DB queries.
 * Each tile gets its own describe block with its own query, so blocks land
 * one per implementation task without touching earlier blocks.
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
  yoga = createYoga({
    schema: buildSchema(),
    context: () => buildContext(db, 'en'),
  });
  // warm the pool so the first timed assertion doesn't hit a cold connection
  await db.selectFrom('bom_people').select('slug').limit(1).execute();
});

afterAll(async () => {
  await closeDb();
});

/** Execute a homesampler selection through yoga; returns data.homesampler. */
async function exec<T>(selection: string, seed: number): Promise<T> {
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      query: `query W($seed: Int) { homesampler(seed: $seed) { seed ${selection} } }`,
      variables: { seed },
    }),
  });
  const body = (await res.json()) as {
    data?: { homesampler: T | null };
    errors?: Array<{ message: string }>;
  };
  if (body.errors?.length) {
    throw new Error(`GraphQL errors: ${body.errors.map((e) => e.message).join('; ')}`);
  }
  return body.data!.homesampler as T;
}

// ─── notes ────────────────────────────────────────────────────────────────────

type NotesPayload = {
  notes: { id: string; text: string; reference: string }[] | null;
};
const NOTES_SEL = `notes { id text reference }`;

describe('homesampler.notes', () => {
  it('returns 1-2 short annotations with references', async () => {
    const s = await exec<NotesPayload>(NOTES_SEL, 31001);
    expect(s.notes?.length).toBeGreaterThanOrEqual(1);
    expect(s.notes!.length).toBeLessThanOrEqual(2);
    for (const n of s.notes!) {
      expect(n.id).toBeTruthy();
      expect(n.text.length).toBeGreaterThan(40);
      expect(n.reference).toBeTruthy(); // e.g. "Alma 32:21"
    }
  });

  it('is deterministic per seed and varies across seeds', async () => {
    const [a, b, c] = await Promise.all([
      exec<NotesPayload>(NOTES_SEL, 777),
      exec<NotesPayload>(NOTES_SEL, 777),
      exec<NotesPayload>(NOTES_SEL, 778),
    ]);
    expect(a.notes!.map((n) => n.id)).toEqual(b.notes!.map((n) => n.id));
    // assumes >=3 qualifying notes exist so adjacent seeds pick different rows
    expect(a.notes!.map((n) => n.id)).not.toEqual(c.notes!.map((n) => n.id));
  }, 15000);
});
