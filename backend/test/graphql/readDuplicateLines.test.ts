// Blind r8 notes-D5: /read/alma.20/30 rendered verse 30 twice — the
// lds_scriptures_lines table carries a duplicate row for 34 verses (same verse,
// same full text, a second line_num). The Read assembly drops the copy.
import { describe, expect, it } from 'vitest';
import { dropDuplicateLines } from '../../src/data/loaders/scriptureread.js';

const V30 = 'And, as it happened, it was their lot to have fallen into the hands of a more hardened people.';

describe('dropDuplicateLines', () => {
  it('keeps one copy of a duplicated verse line, with its paragraph mark', () => {
    const out = dropDuplicateLines([
      { verse_id: 34220, line_num: 1, text: 'And when Ammon did meet them he was exceedingly sorrowful.', format: '¶' },
      { verse_id: 34221, line_num: 1, text: V30, format: null },
      { verse_id: 34221, line_num: 2, text: V30, format: '¶' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ verse_id: 34221, line_num: 1, format: '¶' });
  });
  it('keeps a short refrain repeated within a verse', () => {
    const lines = [
      { verse_id: 36619, line_num: 1, text: 'saith the Father,', format: null },
      { verse_id: 36619, line_num: 2, text: 'and they shall be my people', format: null },
      { verse_id: 36619, line_num: 3, text: 'saith the Father,', format: null },
    ];
    expect(dropDuplicateLines(lines)).toHaveLength(3);
  });
  it('keeps identical text in different verses', () => {
    const a = { verse_id: 1, line_num: 1, text: V30, format: null };
    expect(dropDuplicateLines([a, { ...a, verse_id: 2 }])).toHaveLength(2);
  });
});
