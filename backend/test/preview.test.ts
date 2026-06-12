import { describe, it, expect } from 'vitest';
import { buildPreview } from '../src/graphql/resolvers/scriptureextras';

// Real commentary texts from bom_prd that regressed when the sentence split
// moved from the sentence-splitter package to a bare /(?<=[.!?])\s+/ regex:
// the regex breaks at abbreviation periods ("R.", "Oct.", "pp."), so citation
// sentences fragment and the per-sentence junk filters (parens, brackets,
// p. N, 3+ semicolon segments) pass the fragments through.

const HOLLAND_TREE = // id 1017218101 — single sentence, citation-laden
  '<p>Elder Jeffrey R. Holland suggested that “the tree of life … [is a symbol] of Christ’s redemption. … The life, mission, and atonement of Christ are the ultimate manifestations of the Tree of Life” (<em>Christ and the New Covenant</em>, 160–61; see Griggs, “Tree of Life in Ancient Cultures,” 26–31; see also commentary in this volume on 1 Nephi 11:13–25). </p>';

const HOLLAND_MAXWELL = // id 1017201201 — two citation-laden sentences
  '<p>Elder Jeffrey R. Holland of the Quorum of the Twelve Apostles taught that the tree of life represents the Savior and His Atonement: “The Spirit made explicit that the Tree of Life and its precious fruit are symbols of Christ’s redemption” (Christ and the New Covenant: The Messianic Message of the Book of Mormon [1997], 160).</p><p>Elder Neal A. Maxwell (1926–2004) of the Quorum of the Twelve Apostles further emphasized that partaking of the love of God means partaking of the blessings of the Atonement.</p>';

const CITATION_BLOB = // id 1016409101 — pure cross-reference list
  '<p>1 Ne. 2; Matt. 1, 2, 27; Conference Report, Apr. 1974, pp. 173-174; Mormon Doctrine, McConkie, p. 208; Ensign, Mar. 1993, p. 64; BYU Studies, v. 23, No. 3, pp. 52-53; Articles of Faith, Talmage, p. 229</p>';

describe('buildPreview citation filtering', () => {
  it('drops a citation-laden sentence whole — no dangling initials', () => {
    // Legacy (sentence-splitter) produced "" here; the comment was then
    // hidden by the frontend preview?.trim() check. It must not surface
    // fragments like "Elder Jeffrey R."
    expect(buildPreview(HOLLAND_TREE, 0)).toBeNull();
  });

  it('does not leak citation debris like "1999, 6; or Ensign, Nov."', () => {
    const preview = buildPreview(HOLLAND_MAXWELL, 0);
    if (preview !== null) {
      expect(preview).not.toMatch(/Ensign|Conference Report|\d{4}, \d/);
      expect(preview).not.toMatch(/[A-Z]\.$/); // no dangling initial
    }
  });

  it('returns null for a pure cross-reference list', () => {
    expect(buildPreview(CITATION_BLOB, 0)).toBeNull();
  });

  it('keeps ordinary prose sentences and caps at 50 words', () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const text = `<p>${words}.</p>`;
    const preview = buildPreview(text, 0);
    expect(preview).not.toBeNull();
    expect(preview!.endsWith('...')).toBe(true);
    expect(preview!.split(' ').length).toBe(50);
  });

  it('keeps prose and drops only the trailing citation sentence', () => {
    const text =
      '<p>The tree is a symbol of divine love. He taught this in Conference Report, Oct. 1999, 6; or Ensign, Nov. 1999, 8; and elsewhere (emphasis added).</p>';
    expect(buildPreview(text, 0)).toBe('The tree is a symbol of divine love.');
  });

  it('passes notes through with tags stripped', () => {
    expect(buildPreview('<p>A note (with parens).</p>', 1)).toBe(
      'A note (with parens).'
    );
  });
});
