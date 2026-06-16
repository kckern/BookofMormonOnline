import { describe, expect, test } from 'vitest';

// Loader imports only TYPES from codegen/db + a pure fn from scripture-guide,
// so importing it does NOT open a DB connection. Env guards mirror lang.test.ts.
process.env.MYSQL_HOST ||= 'test';
process.env.MYSQL_USER ||= 'test';
process.env.MYSQL_PASSWORD ||= 'test';

import { dedupeByVerseKeepFirstLink } from '../src/data/loaders/searchhist.js';

type Row = { verse_id: string; text_link: number | null; tag?: string };

describe('dedupeByVerseKeepFirstLink', () => {
  test('collapses repeated verse to the row with the lowest text_link', () => {
    const rows: Row[] = [
      { verse_id: '34567', text_link: 89, tag: 'jesus/89' },
      { verse_id: '34567', text_link: 88, tag: 'jesus/88' },
    ];
    const out = dedupeByVerseKeepFirstLink(rows);
    expect(out).toHaveLength(1);
    expect(out[0]!.tag).toBe('jesus/88');
  });

  test('keeps distinct verses and preserves first-appearance order', () => {
    const rows: Row[] = [
      { verse_id: '25010', text_link: 63 },
      { verse_id: '32024', text_link: 12 },
      { verse_id: '34567', text_link: 89 },
      { verse_id: '34567', text_link: 88 },
    ];
    const out = dedupeByVerseKeepFirstLink(rows);
    expect(out.map((r) => r.verse_id)).toEqual(['25010', '32024', '34567']);
    expect(out[2]!.text_link).toBe(88);
  });

  test('treats null text_link as lowest priority (loses to any real link)', () => {
    const rows: Row[] = [
      { verse_id: '1', text_link: null, tag: 'null-first' },
      { verse_id: '1', text_link: 5, tag: 'real' },
    ];
    expect(dedupeByVerseKeepFirstLink(rows)[0]!.tag).toBe('real');
  });

  test('keeps a single null-link row when it is the only one for the verse', () => {
    const rows: Row[] = [{ verse_id: '1', text_link: null, tag: 'only' }];
    const out = dedupeByVerseKeepFirstLink(rows);
    expect(out).toHaveLength(1);
    expect(out[0]!.tag).toBe('only');
  });

  test('returns empty array unchanged', () => {
    expect(dedupeByVerseKeepFirstLink([])).toEqual([]);
  });
});
