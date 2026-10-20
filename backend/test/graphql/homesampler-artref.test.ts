/**
 * R7 art-H3: the art tile's scripture ref. The image's bom_text heading is
 * sometimes compound ("2 Nephi 5:34; Jacob 1:13–14, Enos 20") and sometimes
 * misses the verse the title quotes (the "Bloodthirsty People" phrase is
 * 2 Nephi 5:24), so the tile showed two unrelated fragments with no highlight.
 * Pure — no DB.
 */
import { describe, expect, it } from 'vitest';
import { lookupReference } from 'scripture-guide';
import { anchorArtRef, artCandidateIds, ART_ANCHOR_WINDOW } from '../../src/graphql/resolvers/artRef.js';

const id = (r: string) => lookupReference(r).verse_ids[0] as number;

describe('anchorArtRef', () => {
  const v24 = id('2 Nephi 5:24');
  const v34 = id('2 Nephi 5:34');
  const text = new Map<number, string>([
    [v24 - 1, 'And the Lord God said unto me: They shall be a scourge unto thy seed'],
    [v24, 'And because of their cursing which was upon them they did become a bloodthirsty people, full of idolatry and filthiness'],
    [v34, 'And it sufficeth me to say that forty years had passed away'],
  ]);

  it('moves the ref to the nearby verse that holds the quoted title', () => {
    expect(anchorArtRef({
      title: '“A Bloodthirsty People Full of Idolatry and Filthiness”',
      heading: '2 Nephi 5:34; Jacob 1:13–14, Enos 20',
      minVerseId: v34,
      textById: text,
    })).toBe('2 Nephi 5:24');
  });

  it('keeps a heading range that already holds the phrase', () => {
    const a = id('Alma 17:7');
    const t = new Map([[a, 'they did journey, and the land of Zarahemla is rebuilt here']]);
    expect(anchorArtRef({ title: '“Zarahemla is Rebuilt”', heading: 'Alma 17:6–8', minVerseId: a - 1, textById: t })).toBe('Alma 17:6-8');
  });

  it('no match: only the FIRST segment of a compound heading (no cross-book fragments)', () => {
    expect(anchorArtRef({ title: 'Return with Food', heading: '2 Nephi 5:34; Jacob 1:13–14', minVerseId: v34, textById: new Map() })).toBe('2 Nephi 5:34');
  });

  it('descriptive heading falls back to the passage first verse', () => {
    expect(anchorArtRef({ title: 'x', heading: 'The scattering of Israel', minVerseId: v34, textById: new Map() })).toBe('2 Nephi 5:34');
    expect(anchorArtRef({ title: 'x', heading: null, minVerseId: null, textById: new Map() })).toBeNull();
  });

  it('candidate ids cover the heading and a window around the passage', () => {
    const ids = artCandidateIds('2 Nephi 5:34', v34);
    expect(ids).toContain(v34);
    expect(ids).toContain(v34 - ART_ANCHOR_WINDOW);
    expect(ids).toContain(v34 + ART_ANCHOR_WINDOW);
  });
});
