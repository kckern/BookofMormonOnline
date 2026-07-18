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
    // no inline timeout: 3 parallel full-homesampler requests against the remote
    // DB can exceed 15s under full-suite concurrency — inherit the 30s global
    // (vitest.config.ts), matching the crossrefs/relationship determinism tests.
  });
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
  it('returns a source verse with 2-4 cross-references', async () => {
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

// ─── relationship ─────────────────────────────────────────────────────────────

type RelationshipPayload = {
  relationship: {
    hubType: string; hubSlug: string; hubName: string; hubTitle: string | null;
    edges: {
      rel: string; dstType: string; dstSlug: string; dstName: string;
      dstTitle: string | null; note: string | null; ref: string | null;
    }[];
  } | null;
};
const REL_SEL = `relationship { hubType hubSlug hubName hubTitle edges { rel dstType dstSlug dstName dstTitle note ref } }`;

describe('homesampler.relationship', () => {
  it('returns a hub with 2-4 resolved edges', async () => {
    const s = await exec<RelationshipPayload>(REL_SEL, 34004);
    expect(s.relationship).toBeTruthy();
    const r = s.relationship!;
    expect(['people', 'place', 'object']).toContain(r.hubType);
    expect(r.hubSlug).toBeTruthy();
    expect(r.hubName).toBeTruthy();
    expect(r.edges.length).toBeGreaterThanOrEqual(2);
    expect(r.edges.length).toBeLessThanOrEqual(4);
    for (const e of r.edges) {
      expect(e.rel).toBeTruthy();
      expect(['people', 'place', 'object']).toContain(e.dstType);
      expect(e.dstSlug).toBeTruthy();
      expect(e.dstName).toBeTruthy(); // resolved, not just the slug echoed on a miss
    }
  });

  it('is deterministic per seed and varies across seeds', async () => {
    const [a, b, c] = await Promise.all([
      exec<RelationshipPayload>(REL_SEL, 1111),
      exec<RelationshipPayload>(REL_SEL, 1111),
      exec<RelationshipPayload>(REL_SEL, 1112),
    ]);
    expect(`${a.relationship!.hubType}:${a.relationship!.hubSlug}`)
      .toBe(`${b.relationship!.hubType}:${b.relationship!.hubSlug}`);
    expect(`${a.relationship!.hubType}:${a.relationship!.hubSlug}`)
      .not.toBe(`${c.relationship!.hubType}:${c.relationship!.hubSlug}`);
  });
});

// ─── mapstory ─────────────────────────────────────────────────────────────────

type MapStoryPayload = {
  mapstory: {
    slug: string; title: string; description: string | null;
    moves: {
      seq: number; start: string; end: string;
      startName: string | null; endName: string | null;
      travelers: string | null; people: { slug: string; name: string | null }[] | null;
      description: string | null; duration: string | null; ref: string | null;
      startLat: number; startLng: number; endLat: number; endLng: number;
    }[];
  } | null;
};
const MAPSTORY_SEL = `mapstory { slug title description moves { seq start end startName endName travelers people { slug name } description duration ref startLat startLng endLat endLng } }`;

describe('homesampler.mapstory', () => {
  it('returns one story with >=2 ordered, coordinated moves', async () => {
    const s = await exec<MapStoryPayload>(MAPSTORY_SEL, 35005);
    expect(s.mapstory).toBeTruthy();
    const m = s.mapstory!;
    expect(m.slug).toBeTruthy();
    expect(m.title).toBeTruthy();
    expect(m.moves.length).toBeGreaterThanOrEqual(2);
    const seqs = m.moves.map((x) => x.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs); // ordered by seq
    for (const mv of m.moves) {
      expect(mv.start).toBeTruthy();
      expect(mv.end).toBeTruthy();
      expect(Number.isFinite(mv.startLat)).toBe(true);
      expect(Number.isFinite(mv.startLng)).toBe(true);
      expect(Number.isFinite(mv.endLat)).toBe(true);
      expect(Number.isFinite(mv.endLng)).toBe(true);
    }
  });

  it('is deterministic per seed', async () => {
    const [a, b] = await Promise.all([
      exec<MapStoryPayload>(MAPSTORY_SEL, 1212),
      exec<MapStoryPayload>(MAPSTORY_SEL, 1212),
    ]);
    expect(a.mapstory!.slug).toBe(b.mapstory!.slug);
    expect(a.mapstory!.moves.length).toBe(b.mapstory!.moves.length);
  });

  // The tile renders these instead of the raw slugs (`hill-amnihu` →
  // `Hill Amnihu`). bom_places.name is populated for every place with coords,
  // and the sampler INNER JOINs bom_places, so every move must carry both.
  it('carries display names for both endpoints', async () => {
    const s = await exec<MapStoryPayload>(MAPSTORY_SEL, 35005);
    for (const mv of s.mapstory!.moves) {
      expect(mv.startName).toBeTruthy();
      expect(mv.endName).toBeTruthy();
    }
  });

  // 234 of 238 moves have bom_map_move_people rows; the remaining 4 must come
  // back as [] rather than null so the card can render without them.
  it('returns a traveler array for every move, empty where none exist', async () => {
    const s = await exec<MapStoryPayload>(MAPSTORY_SEL, 35005);
    for (const mv of s.mapstory!.moves) {
      expect(Array.isArray(mv.people)).toBe(true);
      for (const p of mv.people!) expect(p.slug).toBeTruthy();
    }
    // At least one move in a typical story has travelers.
    expect(s.mapstory!.moves.some((mv) => (mv.people?.length ?? 0) > 0)).toBe(true);
  });
});
