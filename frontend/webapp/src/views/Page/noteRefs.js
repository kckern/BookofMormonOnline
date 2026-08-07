import { findReferences, generateReference, lookupReference, detectReferences } from "scripture-guide";

// A findReferences match is a note-ref iff the char right after its end is the
// note marker 'n' followed by a word boundary (so "2:13n)" yes, "2:13 near" no).
const isNoteMarker = (text, end) => {
  if (text[end] !== "n") return false;
  const after = text[end + 1];
  return after === undefined || /[^A-Za-z0-9]/.test(after);
};

// Cross-reference markers that may legitimately precede a bare note-ref.
const LEADING_MARKER = /(?:see also|see|cf\.?|c\.f\.?|compare|cited\s+at|cp\.?)\s*$/i;
// A bare chapter[:.]verse(range)? immediately followed by the 'n' marker.
const BARE_NOTEREF = /(\d+)[:.](\d+)(?:[-–]\d+)?n(?![A-Za-z0-9])/g;

const bookOf = (verseId) => {
  const ref = generateReference(verseId);
  const m = ref && ref.match(/^(.*?)\s+\d+:\d+/);
  return m ? m[1] : null;
};
const overlaps = (s, e, ranges) => ranges.some(([cs, ce]) => s < ce && e > cs);

export function resolveNoteRefs(text, hostVerseId) {
  if (typeof text !== "string" || !text) return [];
  const results = [];
  const matches = findReferences(text, { chainAcrossMarkers: false }) || [];

  // (pass 1) record covered ranges as you iterate matches:
  const covered = [];
  for (const m of matches) {
    covered.push([m.start, m.end]);
    if (!isNoteMarker(text, m.end)) continue;
    const verseId = m.verse_ids && m.verse_ids[0];
    if (!verseId) continue;
    results.push({ start: m.start, end: m.end + 1, verseId, rawText: text.slice(m.start, m.end) });
  }

  // (pass 2) host-seed truly-bare tokens findReferences didn't cover
  const hostBook = hostVerseId ? bookOf(hostVerseId) : null;
  if (hostBook) {
    let mm;
    BARE_NOTEREF.lastIndex = 0;
    while ((mm = BARE_NOTEREF.exec(text))) {
      const start = mm.index;
      const end = start + mm[0].length; // includes trailing 'n'
      if (overlaps(start, end, covered)) continue;
      const before = text.slice(0, start).replace(LEADING_MARKER, "").trimEnd();
      if (/[A-Za-z]$/.test(before)) continue; // explicit (invalid) book -> plain text
      const lr = lookupReference(`${hostBook} ${mm[1]}:${mm[2]}`);
      const verseId = lr && lr.verse_ids && lr.verse_ids[0];
      if (!verseId) continue;
      results.push({ start, end, verseId, rawText: mm[0].slice(0, -1) });
    }
  }

  return results.sort((a, b) => a.start - b.start);
}

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Replace note-ref spans with note_ref anchors (trailing 'n' dropped), then run
// the existing scripture detection on the untouched remainder. Working
// right-to-left keeps earlier offsets valid as we splice.
export function buildNoteBodyHtml(text, hostVerseId, source) {
  if (typeof text !== "string" || !text) return text || "";
  const refs = resolveNoteRefs(text, hostVerseId);
  const scriptureLinks = (s) => `<a className="scripture_link">${s}</a>`;
  if (!refs.length) return detectReferences(text, scriptureLinks, { chainAcrossMarkers: false });

  const segments = [];
  let cursor = text.length;
  for (let i = refs.length - 1; i >= 0; i--) {
    const r = refs[i];
    const tail = text.slice(r.end, cursor);
    segments.unshift(detectReferences(tail, scriptureLinks, { chainAcrossMarkers: false }));
    segments.unshift(
      `<a class="note_ref" data-source="${escapeHtml(String(source ?? ""))}" data-verse="${r.verseId}">${escapeHtml(r.rawText)}</a>`,
    );
    cursor = r.start;
  }
  segments.unshift(detectReferences(text.slice(0, cursor), scriptureLinks, { chainAcrossMarkers: false }));
  return segments.join("");
}
