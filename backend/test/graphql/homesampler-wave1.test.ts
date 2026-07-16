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

// ─── faxVerse ─────────────────────────────────────────────────────────────────

type FaxVersePayload = {
  faxVerse: {
    version: string; title: string | null; format: string;
    page: number; verseId: number; ref: string;
  } | null;
};
const FAXVERSE_SEL = `faxVerse { version title format page verseId ref }`;

describe('homesampler.faxVerse', () => {
  it('returns one verse-anchored facsimile page', async () => {
    const s = await exec<FaxVersePayload>(FAXVERSE_SEL, 32002);
    expect(s.faxVerse).toBeTruthy();
    expect(s.faxVerse!.version).toBeTruthy();
    expect(s.faxVerse!.page).toBeGreaterThan(0);
    expect(s.faxVerse!.verseId).toBeGreaterThan(0);
    expect(s.faxVerse!.ref).toBeTruthy();
    expect(s.faxVerse!.format).toBeTruthy();
  });

  it('is deterministic per seed and varies across seeds', async () => {
    const [a, b, c] = await Promise.all([
      exec<FaxVersePayload>(FAXVERSE_SEL, 888),
      exec<FaxVersePayload>(FAXVERSE_SEL, 888),
      exec<FaxVersePayload>(FAXVERSE_SEL, 889),
    ]);
    expect(`${a.faxVerse!.version}:${a.faxVerse!.page}`).toBe(`${b.faxVerse!.version}:${b.faxVerse!.page}`);
    expect(`${a.faxVerse!.version}:${a.faxVerse!.page}`).not.toBe(`${c.faxVerse!.version}:${c.faxVerse!.page}`);
  });
});

// ─── crossrefs ────────────────────────────────────────────────────────────────

type CrossRefsPayload = {
  crossrefs: {
    srcRef: string; srcVerseId: number;
    refs: { ref: string; verseId: number }[];
  } | null;
};
const CROSSREFS_SEL = `crossrefs { srcRef srcVerseId refs { ref verseId } }`;

describe('homesampler.crossrefs', () => {
  it('returns a source verse with 2-4 significant cross-references', async () => {
    const s = await exec<CrossRefsPayload>(CROSSREFS_SEL, 33003);
    expect(s.crossrefs).toBeTruthy();
    expect(s.crossrefs!.srcVerseId).toBeGreaterThan(0);
    expect(s.crossrefs!.srcRef).toBeTruthy();
    expect(s.crossrefs!.refs.length).toBeGreaterThanOrEqual(2);
    expect(s.crossrefs!.refs.length).toBeLessThanOrEqual(4);
    for (const r of s.crossrefs!.refs) {
      expect(r.verseId).toBeGreaterThan(0);
      expect(r.ref).toBeTruthy();
      expect(r.verseId).not.toBe(s.crossrefs!.srcVerseId); // no self-reference
    }
    // no duplicate destinations
    const ids = s.crossrefs!.refs.map((r) => r.verseId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is deterministic per seed and varies across seeds', async () => {
    const [a, b, c] = await Promise.all([
      exec<CrossRefsPayload>(CROSSREFS_SEL, 999),
      exec<CrossRefsPayload>(CROSSREFS_SEL, 999),
      exec<CrossRefsPayload>(CROSSREFS_SEL, 1000),
    ]);
    expect(a.crossrefs!.srcVerseId).toBe(b.crossrefs!.srcVerseId);
    expect(a.crossrefs!.srcVerseId).not.toBe(c.crossrefs!.srcVerseId);
  });
});
