/**
 * artRef — the scripture reference the Home art tile excerpts (R7 art-H3).
 *
 * An image's bom_text heading is a ref ("1 Nephi 13:40–41"), a compound ref
 * ("2 Nephi 5:34; Jacob 1:13–14, Enos 20") or a descriptive title. Most titles
 * quote their verse, but ~6% of headings miss it (the "Bloodthirsty People"
 * phrase is 2 Nephi 5:24, not 5:34), and a compound heading made the tile show
 * two unrelated fragments. So: anchor on the verse that holds the title phrase
 * (inside the heading first, then nearby), else the heading's FIRST segment,
 * else the passage's first verse.
 */
import { generateReference, lookupReference } from 'scripture-guide';

/** Verses either side of the passage's first verse searched for the phrase. */
export const ART_ANCHOR_WINDOW = 40;
const MAX_REF_VERSES = 20; // a bare book name ("Alma") must not explode

// letters and digits only: "blood-thirsty" (Enos 1:20) matches "Bloodthirsty"
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

const headingIds = (heading: string | null): number[] => {
  if (!heading) return [];
  const ids = (lookupReference(heading)?.verse_ids || []) as number[];
  return ids.length && ids.length <= MAX_REF_VERSES ? ids : [];
};

/** Contiguous runs of verse ids, in order. */
const runs = (ids: number[]): number[][] => {
  const out: number[][] = [];
  for (const v of ids) {
    const last = out[out.length - 1];
    if (last && v === (last[last.length - 1] ?? NaN) + 1) last.push(v);
    else out.push([v]);
  }
  return out;
};

/** Verse ids whose text anchorArtRef may consult. */
export const artCandidateIds = (heading: string | null, minVerseId: number | null): number[] => {
  const ids = new Set(headingIds(heading));
  const m = Number(minVerseId) || 0;
  if (m) for (let d = -ART_ANCHOR_WINDOW; d <= ART_ANCHOR_WINDOW; d++) if (m + d > 0) ids.add(m + d);
  return [...ids];
};

export const anchorArtRef = ({ title, heading, minVerseId, textById }: {
  title: string | null;
  heading: string | null;
  minVerseId: number | null;
  textById: Map<number, string>;
}): string | null => {
  const ids = headingIds(heading);
  const segs = runs(ids);
  const frags = (title || '')
    .replace(/[“”"‘’]/g, '')
    .split(/…|\.\.\./)
    .map(norm)
    .filter((f) => f.length >= 3);
  const holds = (id: number) => {
    const t = textById.get(id);
    if (!t || !frags.length) return false;
    const n = norm(t);
    return frags.every((f) => n.includes(f));
  };
  if (frags.length) {
    const inHeading = segs.find((run) => run.some(holds));
    if (inHeading) return generateReference(inHeading);
    const m = Number(minVerseId) || ids[0] || 0;
    if (m) {
      for (let d = 0; d <= ART_ANCHOR_WINDOW; d++) {
        if (holds(m - d)) return generateReference([m - d]);
        if (d && holds(m + d)) return generateReference([m + d]);
      }
    }
  }
  if (segs[0]) return generateReference(segs[0]);
  return minVerseId ? generateReference([Number(minVerseId)]) : null;
};
