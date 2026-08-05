import { findReferences } from "scripture-guide";

// A findReferences match is a note-ref iff the char right after its end is the
// note marker 'n' followed by a word boundary (so "2:13n)" yes, "2:13 near" no).
const isNoteMarker = (text, end) => {
  if (text[end] !== "n") return false;
  const after = text[end + 1];
  return after === undefined || /[^A-Za-z0-9]/.test(after);
};

export function resolveNoteRefs(text, hostVerseId) {
  if (typeof text !== "string" || !text) return [];
  const results = [];
  const matches = findReferences(text, { chainAcrossMarkers: false }) || [];
  for (const m of matches) {
    if (!isNoteMarker(text, m.end)) continue;
    const verseId = m.verse_ids && m.verse_ids[0];
    if (!verseId) continue;
    results.push({ start: m.start, end: m.end + 1, verseId, rawText: text.slice(m.start, m.end) });
  }
  return results.sort((a, b) => a.start - b.start);
}
