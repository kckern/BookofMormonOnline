import { lookupReference } from "scripture-guide";

// Isaiah/Malachi/Matthew quotation blocks — chiasms here mirror Biblical text.
// (Same list previously hardcoded inside the component.)
const BIBLE_REFS = "2 Nephi 12-24, 1 Nephi 20-21, 3 Nephi 12-14, 3 Nephi 24-25, Mosiah 14";

// The record's own 6-part structure — the categorical color/grouping dimension.
export const BOOK_GROUPS = {
  "1 Nephi": "small-plates",
  "2 Nephi": "small-plates",
  "Jacob": "small-plates",
  "Enos": "small-plates",
  "Jarom": "small-plates",
  "Omni": "small-plates",
  "Words of Mormon": "abridgment",
  "Mosiah": "abridgment",
  "Alma": "abridgment",
  "Helaman": "abridgment",
  "3 Nephi": "ministry",
  "4 Nephi": "ministry",
  "Mormon": "mormon",
  "Ether": "ether",
  "Moroni": "moroni",
};

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseScheme(scheme) {
  const s = scheme || "";
  const seq = s.replace(/[^A-Z]/g, ""); // original order, majors only
  const depth = seq ? Math.max(...seq.split("").map((c) => c.charCodeAt(0) - 64)) : 0;
  const reversed = seq.split("").reverse().join("");
  return {
    depth,
    depthBucket: depth > 7 ? "+" : depth,
    lineCount: s.length,
    isCompound: /Aa/.test(s),
    isPerfectMirror: seq.length > 0 && seq === reversed,
  };
}

// "Words of Mormon 1:4" → "Words of Mormon"; "1 Nephi 19:7-14" → "1 Nephi"
export function bookFromReference(reference) {
  const m = String(reference || "").match(/^([1-4]?\s?[A-Za-z][A-Za-z ]*?)\s+\d/);
  return m ? m[1].trim() : null;
}

let bibleVerseIdCache = {};
function bibleVerseIds(lang) {
  if (!bibleVerseIdCache[lang]) {
    bibleVerseIdCache[lang] = new Set(lookupReference(BIBLE_REFS, lang).verse_ids);
  }
  return bibleVerseIdCache[lang];
}

/**
 * One-shot enrichment of the raw `chiasmus` list query result. Called from a
 * useMemo — after this, every filter/sort/group is a plain array op and
 * lookupReference never runs in a render path again.
 */
export function enrichChiasmus(list, lang) {
  const bibleIds = bibleVerseIds(lang);
  return (list || []).map((c) => {
    const [verse_id] = lookupReference(c.reference, lang).verse_ids || [];
    const book = bookFromReference(c.reference);
    return {
      ...c,
      ...parseScheme(c.scheme),
      verse_id: verse_id ?? null,
      book,
      bookGroup: BOOK_GROUPS[book] || "other",
      isBiblical: verse_id != null && bibleIds.has(verse_id),
    };
  });
}
