import { describe, expect, it } from 'vitest';

// Loader imports only TYPES from codegen/db + a pure fn from scripture-guide,
// so importing it does NOT open a DB connection. Env guards mirror lang.test.ts.
process.env.MYSQL_HOST ||= 'test';
process.env.MYSQL_USER ||= 'test';
process.env.MYSQL_PASSWORD ||= 'test';

import {
  expandChiasmusVerseIds,
  pickDominantSpeaker,
  reduceChiasmusLines,
  resolveChiasmusSpeakers,
  type ChiasmusLineRow,
  type ChiasmusRow,
} from '../src/data/loaders/scriptureextras.js';

// ─── fixtures ────────────────────────────────────────────────────────────────

function line(partial: Partial<ChiasmusLineRow>): ChiasmusLineRow {
  return {
    guid: null,
    chiasmus_id: null,
    i: null,
    verse_id: null,
    verses: 1,
    line_key: null,
    line_text: null,
    highlights: null,
    label: null,
    title: null,
    ...partial,
  };
}

const fakeRef = (vids: number[]) => `ref:${vids.join(',')}`;

// ─── pickDominantSpeaker ─────────────────────────────────────────────────────

describe('pickDominantSpeaker', () => {
  it('picks the modal person_slug with its first-seen voice', () => {
    const rows = [
      { person_slug: 'nephi', voice: 'narrator' },
      { person_slug: 'lehi', voice: 'quote' },
      { person_slug: 'nephi', voice: 'quote' },
    ];
    expect(pickDominantSpeaker(rows)).toEqual({ person_slug: 'nephi', voice: 'narrator' });
  });

  it('breaks ties by first-encountered slug', () => {
    const rows = [
      { person_slug: 'alma', voice: 'sermon' },
      { person_slug: 'amulek', voice: 'sermon' },
      { person_slug: 'amulek', voice: 'quote' },
      { person_slug: 'alma', voice: 'quote' },
    ];
    // 2-2 tie: alma was seen first, so alma wins
    expect(pickDominantSpeaker(rows)).toEqual({ person_slug: 'alma', voice: 'sermon' });
  });

  it('returns null for an empty row list', () => {
    expect(pickDominantSpeaker([])).toBeNull();
  });

  it('returns null when no row carries a person_slug', () => {
    const rows = [
      { person_slug: null, voice: 'narrator' },
      { person_slug: null, voice: null },
    ];
    expect(pickDominantSpeaker(rows)).toBeNull();
  });

  it('ignores null-slug rows when a real slug exists', () => {
    const rows = [
      { person_slug: null, voice: 'narrator' },
      { person_slug: 'mormon', voice: 'editor' },
    ];
    expect(pickDominantSpeaker(rows)).toEqual({ person_slug: 'mormon', voice: 'editor' });
  });
});

// ─── expandChiasmusVerseIds ──────────────────────────────────────────────────

describe('expandChiasmusVerseIds', () => {
  it('expands multi-verse lines and dedupes overlaps in first-appearance order', () => {
    const lines = [
      line({ verse_id: 100, verses: 3 }), // 100, 101, 102
      line({ verse_id: 102, verses: 2 }), // 102 (dup), 103
      line({ verse_id: null }),           // skipped
    ];
    expect(expandChiasmusVerseIds(lines)).toEqual([100, 101, 102, 103]);
  });

  it('treats null verses as 1', () => {
    expect(expandChiasmusVerseIds([line({ verse_id: 5, verses: null })])).toEqual([5]);
  });
});

// ─── reduceChiasmusLines: verse_id + line_lengths ────────────────────────────

describe('reduceChiasmusLines verse_id and line_lengths', () => {
  const allLines = [
    line({ chiasmus_id: 'c1', verse_id: 200, line_key: 'a', line_text: 'alpha' }),
    line({ chiasmus_id: 'c1', verse_id: 201, line_key: 'b', line_text: 'be' }),
    line({ chiasmus_id: 'c1', verse_id: 202, line_key: 'b', line_text: '' }),
    line({ chiasmus_id: 'c1', verse_id: 203, line_key: 'a', line_text: null }),
  ];

  it('sets verse_id to the FIRST line of ALL lines, even when the match is later', () => {
    // matched line is the third line (202), but verse_id must be 200
    const matched = [allLines[2]!];
    const [row] = reduceChiasmusLines(allLines, matched, fakeRef, false, false);
    expect(row!.verse_id).toBe(200);
  });

  it('computes line_lengths across all lines, null text as 0', () => {
    const [row] = reduceChiasmusLines(allLines, allLines, fakeRef, true, false);
    expect(row!.line_lengths).toEqual([5, 2, 0, 0]);
  });
});

// ─── passagenotes reduce path: full scheme + full-span reference ─────────────

describe('passagenotes chiasmus entries (reduce with passageNoteScheme=false)', () => {
  const c1Lines = [
    line({ chiasmus_id: 'c1', verse_id: 10, line_key: 'a', line_text: 'x' }),
    line({ chiasmus_id: 'c1', verse_id: 11, line_key: 'b', line_text: 'xx' }),
    line({ chiasmus_id: 'c1', verse_id: 12, line_key: 'b', line_text: 'xxx' }),
    line({ chiasmus_id: 'c1', verse_id: 13, line_key: 'a', line_text: 'xxxx' }),
  ];
  const c2Lines = [
    line({ chiasmus_id: 'c2', verse_id: 50, line_key: 'a', line_text: 'y' }),
    line({ chiasmus_id: 'c2', verse_id: 52, line_key: 'a', line_text: 'yy' }),
  ];
  const allLines = [...c1Lines, ...c2Lines];

  it('carries the FULL scheme and full-span reference, not the legacy single letter', () => {
    // Passage only touches verse 12 (one 'b' line of c1) and verse 50 of c2
    const matched = [c1Lines[2]!, c2Lines[0]!];
    const rows = reduceChiasmusLines(allLines, matched, fakeRef, false, false);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.chiasmus_id).toBe('c1');
    expect(rows[0]!.scheme).toBe('abba');           // legacy returned 'b'
    expect(rows[0]!.reference).toBe('ref:10,11,12,13'); // legacy: single matched verse
    expect(rows[1]!.scheme).toBe('aa');
    expect(rows[1]!.reference).toBe('ref:50,52');
  });

  it('preserves first-match order and dedupes repeated chiasmus_ids', () => {
    const matched = [c2Lines[1]!, c1Lines[0]!, c1Lines[3]!];
    const rows = reduceChiasmusLines(allLines, matched, fakeRef, false, false);
    expect(rows.map((r) => r.chiasmus_id)).toEqual(['c2', 'c1']);
  });

  it('does not include line payloads (includeLines=false)', () => {
    const rows = reduceChiasmusLines(allLines, allLines, fakeRef, false, false);
    for (const r of rows) expect(r.lines).toEqual([]);
  });
});

// ─── resolveChiasmusSpeakers (stubbed db) ────────────────────────────────────

type StubRow = Record<string, unknown>;

function makeStubDb(rowsByTable: Record<string, StubRow[]>) {
  const calls: string[] = [];
  const db = {
    selectFrom(table: string) {
      calls.push(table);
      const chain = {
        select: () => chain,
        where: () => chain,
        execute: async () => rowsByTable[table] ?? [],
      };
      return chain;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: db as any, calls };
}

function chiasmRow(id: string, lines: ChiasmusLineRow[]): ChiasmusRow {
  return {
    chiasmus_id: id,
    reference: '',
    scheme: '',
    title: null,
    start_verse_id: null,
    verse_id: lines[0]?.verse_id ?? null,
    line_lengths: [],
    lines,
  };
}

describe('resolveChiasmusSpeakers', () => {
  it('issues ONE batched lds_scriptures_lines select and ONE bom_people select', async () => {
    const chiasms = [
      chiasmRow('c1', [line({ verse_id: 1 }), line({ verse_id: 2 })]),
      chiasmRow('c2', [line({ verse_id: 10, verses: 2 })]),
    ];
    const { db, calls } = makeStubDb({
      lds_scriptures_lines: [
        { verse_id: 1, person_slug: 'nephi', voice: 'narrator' },
        { verse_id: 2, person_slug: 'nephi', voice: 'quote' },
        { verse_id: 10, person_slug: 'jacob', voice: 'sermon' },
        { verse_id: 11, person_slug: 'jacob', voice: 'sermon' },
      ],
      bom_people: [
        { slug: 'nephi', name: 'Nephi' },
        { slug: 'jacob', name: 'Jacob' },
      ],
    });

    await resolveChiasmusSpeakers(chiasms, db);

    expect(calls.filter((t) => t === 'lds_scriptures_lines')).toHaveLength(1);
    expect(calls.filter((t) => t === 'bom_people')).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(chiasms[0]!.speaker).toEqual({ person_slug: 'nephi', name: 'Nephi', voice: 'narrator' });
    expect(chiasms[1]!.speaker).toEqual({ person_slug: 'jacob', name: 'Jacob', voice: 'sermon' });
  });

  it('picks the dominant speaker per chiasm span', async () => {
    const chiasms = [chiasmRow('c1', [line({ verse_id: 1, verses: 3 })])]; // spans 1,2,3
    const { db } = makeStubDb({
      lds_scriptures_lines: [
        { verse_id: 1, person_slug: 'lehi', voice: 'quote' },
        { verse_id: 2, person_slug: 'nephi', voice: 'narrator' },
        { verse_id: 3, person_slug: 'nephi', voice: 'narrator' },
      ],
      bom_people: [{ slug: 'nephi', name: 'Nephi' }],
    });
    await resolveChiasmusSpeakers(chiasms, db);
    expect(chiasms[0]!.speaker).toEqual({ person_slug: 'nephi', name: 'Nephi', voice: 'narrator' });
  });

  it('sets speaker null when no speaker rows carry a slug, without querying bom_people', async () => {
    const chiasms = [chiasmRow('c1', [line({ verse_id: 1 })])];
    const { db, calls } = makeStubDb({
      lds_scriptures_lines: [{ verse_id: 1, person_slug: null, voice: null }],
    });
    await resolveChiasmusSpeakers(chiasms, db);
    expect(chiasms[0]!.speaker).toBeNull();
    expect(calls).toEqual(['lds_scriptures_lines']);
  });

  it('sets speaker null on all rows without any query when no chiasm has verse ids', async () => {
    const chiasms = [chiasmRow('c1', [line({ verse_id: null })]), chiasmRow('c2', [])];
    const { db, calls } = makeStubDb({});
    await resolveChiasmusSpeakers(chiasms, db);
    expect(calls).toEqual([]);
    expect(chiasms[0]!.speaker).toBeNull();
    expect(chiasms[1]!.speaker).toBeNull();
  });

  it('falls back to name null when the slug is missing from bom_people', async () => {
    const chiasms = [chiasmRow('c1', [line({ verse_id: 1 })])];
    const { db } = makeStubDb({
      lds_scriptures_lines: [{ verse_id: 1, person_slug: 'ghost', voice: 'v' }],
      bom_people: [],
    });
    await resolveChiasmusSpeakers(chiasms, db);
    expect(chiasms[0]!.speaker).toEqual({ person_slug: 'ghost', name: null, voice: 'v' });
  });
});
