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

// "Nephi1" → "Nephi", "Alma2" → "Alma": bom_people.name carries slug-style
// disambiguation digits; strip them for display. A dictionary-based label of
// speaker.voice (the vox_* keys the Read view uses) could replace this later,
// but that needs the dictionary loaded — this stays deterministic.
export function formatSpeakerName(name) {
  if (!name) return null;
  return String(name).replace(/\d+$/, "");
}

const bibleVerseIdCache = {};
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
    // Server verse_id (Task 15) wins and skips the reference parse entirely;
    // the client lookup remains as a fallback for rows from stale caches or
    // older API responses that predate the field. Computed BEFORE the spread
    // below so the explicit `verse_id:` never clobbers a server value.
    const verse_id =
      c.verse_id ?? lookupReference(c.reference, lang).verse_ids?.[0] ?? null;
    const book = bookFromReference(c.reference);
    const parsed = parseScheme(c.scheme);
    const isBiblical = verse_id != null && bibleIds.has(verse_id);
    return {
      ...c, // line_lengths and speaker pass through untouched
      ...parsed,
      verse_id,
      book,
      bookGroup: BOOK_GROUPS[book] || "other",
      isBiblical,
      // color/legend dimension: type. Biblical wins over compound over simple,
      // matching the type-grouping label priority.
      typeGroup: isBiblical ? "biblical" : parsed.isCompound ? "compound" : "simple",
      speakerName: c.speaker?.name ? formatSpeakerName(c.speaker.name) : null,
    };
  });
}

const BOOK_ORDER = Object.keys(BOOK_GROUPS); // declaration order is canonical

/**
 * Pure selector: apply the URL-backed browse state (from useBrowseState) to
 * the enriched list. Returns { flat, groups } where groups is null when no
 * grouping is active. Note: state.depths arrives as STRINGS from the URL
 * ("3", "+") while depthBucket is number|"+", so comparison is via String().
 */
export function applyBrowseState(enriched, s) {
  let flat = (enriched || []).filter((c) => {
    if (s.depths.length && !s.depths.includes(String(c.depthBucket))) return false;
    if (s.type === "biblical" && !c.isBiblical) return false;
    if (s.type === "compound" && !c.isCompound) return false;
    if (s.type === "simple" && (c.isCompound || c.isBiblical)) return false;
    if (s.speaker && c.speaker?.person_slug !== s.speaker) return false;
    if (s.q) {
      const q = s.q.toLowerCase();
      if (!`${c.title} ${c.reference}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const cmp = {
    canonical: (a, b) => (a.verse_id ?? 0) - (b.verse_id ?? 0),
    depth: (a, b) => a.depth - b.depth || (a.verse_id ?? 0) - (b.verse_id ?? 0),
    length: (a, b) => a.lineCount - b.lineCount || (a.verse_id ?? 0) - (b.verse_id ?? 0),
    title: (a, b) => String(a.title).localeCompare(String(b.title)),
  }[s.sort] || (() => 0);
  flat = flat.sort((a, b) => (s.dir === "desc" ? -cmp(a, b) : cmp(a, b)));

  if (!s.group || s.group === "none") return { flat, groups: null };

  const keyFn = {
    book: (c) => c.book || "—",
    speaker: (c) => c.speakerName || "—", // display-formatted in enrichChiasmus from the server speaker field
    depth: (c) => `Level ${c.depthBucket}`,
    type: (c) => (c.isBiblical ? "Biblical" : c.isCompound ? "Compound" : "Simple"),
  }[s.group];
  if (!keyFn) return { flat, groups: null };

  const map = new Map();
  for (const c of flat) {
    const k = keyFn(c);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(c);
  }
  const keys = [...map.keys()];
  if (s.group === "book") {
    keys.sort((a, b) => BOOK_ORDER.indexOf(a) - BOOK_ORDER.indexOf(b));
  } else if (s.group === "depth") {
    // Deterministic level order regardless of active sort: numeric asc, "+" last.
    const levelRank = (k) => (k === "Level +" ? Infinity : Number(k.slice(6)));
    keys.sort((a, b) => levelRank(a) - levelRank(b));
  } else if (s.group === "speaker") {
    // Alphabetical regardless of active sort; unattributed ("—") last.
    keys.sort((a, b) => (a === "—") - (b === "—") || a.localeCompare(b));
  } else if (s.group === "type") {
    // Pinned header order regardless of active sort.
    const TYPE_ORDER = ["Simple", "Compound", "Biblical"];
    keys.sort((a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b));
  }
  const groups = keys.map((k) => ({ key: k, items: map.get(k) }));
  return { flat, groups };
}
