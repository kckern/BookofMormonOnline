// Blind r8 commentary-H1: about 1 in 3 sampled Home commentaries were duds —
// a bare pointer ("For a general discussion, see under … volume 3."), a title
// stub, a citation dump, or a mid-sentence fragment. The sampler drops them.
import { describe, expect, it } from 'vitest';
import { isDudCommentary, commentaryProse } from '../../src/graphql/resolvers/commentaryFilters.js';

const PROSE =
  'Alma teaches that faith is not a perfect knowledge of things. He compares the word to a seed planted in the heart, ' +
  'and invites the poor among the Zoramites to experiment upon it. The image grows through the rest of the chapter, ' +
  'from a swelling seed to a tree springing up unto everlasting life.';
const atv = (preview: string) =>
  `<div class='source'>having prayed [NULL &gt; <em>that</em> 1|<em>that</em> ABCDEFGHIJKLMNOPQRST] he would</div><p>${preview}</p>`;

describe('commentaryFilters', () => {
  it('keeps a row with real prose', () => {
    expect(isDudCommentary({ text: `<p>${PROSE}</p>`, is_note: 0 })).toBe(false);
  });
  it('drops a bare pointer', () => {
    expect(isDudCommentary({ text: atv('For a general discussion, see under subject-verb agreement in volume 3.'), is_note: 0 })).toBe(true);
    expect(isDudCommentary({ text: `<p>For a general discussion, see under the conjunction. ${PROSE}</p>`, is_note: 0 })).toBe(true);
  });
  it('drops a stub shorter than a paragraph', () => {
    expect(isDudCommentary({ text: '<p>2 Nephi 19:1 Textual Variants and the reading of the printer.</p>', is_note: 0 })).toBe(true);
  });
  it('drops a row that opens with a citation run', () => {
    expect(isDudCommentary({ text: `<p>Hel. 8:2; Moses 6:63; Psalm 19:1–2: D&amp;C 88:7–13,42–47; Articles of Faith. ${PROSE}</p>`, is_note: 0 })).toBe(true);
  });
  it('drops a row that opens mid-sentence', () => {
    expect(isDudCommentary({ text: `<p>refer in this text to 1 Ne. 19:10. ${PROSE}</p>`, is_note: 0 })).toBe(true);
  });
  it('reads an ATV row by its bracket-free preview, as the tile does', () => {
    expect(commentaryProse({ text: atv(PROSE), is_note: 0 })).not.toMatch(/\[|\|/);
  });
});
