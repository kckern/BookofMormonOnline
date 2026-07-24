import { generateReference, lookupReference } from "scripture-guide";

/** generateReference that returns null instead of throwing on invalid ids. */
function safeGenerateReference(id) {
  try {
    return generateReference([id]);
  } catch {
    return null;
  }
}

// Backend caps /fax/boxes at 40 ids per request (MAX_VERSE_IDS in
// backend/src/media/fax/route.ts) and SILENTLY slices the overflow. Chunk to
// this size and merge client-side.
export const CHUNK_SIZE = 40;

export function chunkIds(ids, size = CHUNK_SIZE) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/**
 * Merge one-or-more /fax/boxes responses into boxes grouped by scan page then
 * verse. A verse has 1+ boxes (multi-line/column); a verse straddling a page
 * break appears under two imagePage keys.
 * @returns { pageScale, byPageVerse: Map<imagePage, Map<verseId, Array<{x,y,w,h}>>> }
 */
export function mergeBoxes(responses) {
  const byPageVerse = new Map();
  let pageScale = 700;
  for (const res of responses || []) {
    if (res && res.pageScale != null) pageScale = res.pageScale;
    for (const b of (res && res.boxes) || []) {
      const page = byPageVerse.get(b.imagePage) || new Map();
      const arr = page.get(b.verseId) || [];
      // Carry notch insets (tlw/tlh top-left, brw/brh bottom-right) so the cutout
      // can draw a notched polygon; 0 for a plain-rectangle box.
      arr.push({
        x: b.x, y: b.y, w: b.w, h: b.h,
        tlw: b.tlw || 0, tlh: b.tlh || 0, brw: b.brw || 0, brh: b.brh || 0,
      });
      page.set(b.verseId, arr);
      byPageVerse.set(b.imagePage, page);
    }
  }
  return { pageScale, byPageVerse };
}

/** "Alma 5:12" / "1 Nephi 2:11-12" -> "Alma 5" / "1 Nephi 2". */
export function chapterRefOf(ref) {
  return (/^(.+?\s+\d+)(?::|\s*$)/.exec(ref || "")?.[1]) || null;
}

/** verse ids -> distinct chapter refs covering them, in first-seen order. */
export function chapterRefsForVerseIds(verseIds) {
  const seen = new Set();
  const out = [];
  for (const id of verseIds || []) {
    const ref = safeGenerateReference(id);
    if (!ref) continue;
    const ch = chapterRefOf(ref);
    if (ch && !seen.has(ch)) { seen.add(ch); out.push(ch); }
  }
  return out;
}

/** read() chapter payloads -> Map<verse_id, { text, person_slug, voice, ref }>. */
export function indexReadByVerse(chapters) {
  const map = new Map();
  for (const chapter of chapters || []) {
    for (const section of (chapter && chapter.sections) || []) {
      for (const block of (section && section.blocks) || []) {
        for (const line of (block && block.lines) || []) {
          if (!line || line.verse_id == null) continue;
          const existing = map.get(line.verse_id);
          if (existing) {
            // A verse can span multiple lines — CONCATENATE, don't overwrite (that
            // dropped everything but the last line). Keep the first block's speaker.
            existing.text = `${existing.text || ""} ${line.text || ""}`.replace(/\s+/g, " ").trim();
          } else {
            map.set(line.verse_id, {
              text: line.text,
              person_slug: block.person_slug,
              voice: block.voice,
              ref: safeGenerateReference(line.verse_id),
            });
          }
        }
      }
    }
  }
  return map;
}

/** boxes + text -> Map<imagePage, Array<verse object>>, verses sorted by verse_id. */
export function hydrateVerses(byPageVerse, textByVerse) {
  const out = new Map();
  for (const [page, verseMap] of byPageVerse) {
    const verses = [];
    for (const [verse_id, boxes] of verseMap) {
      const t = (textByVerse && textByVerse.get(verse_id)) || {};
      verses.push({
        verse_id,
        ref: t.ref || safeGenerateReference(verse_id),
        boxes,
        text: t.text,
        person_slug: t.person_slug,
        voice: t.voice,
      });
    }
    verses.sort((a, z) => a.verse_id - z.verse_id);
    out.set(page, verses);
  }
  return out;
}

/** Bounding rect of a list of boxes (or null). */
export function unionBox(boxes) {
  if (!boxes || !boxes.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** True if the box has any notch inset (top-left or bottom-right). */
export function hasNotch(b) {
  return !!(b && (b.tlw || b.tlh || b.brw || b.brh));
}

/**
 * SVG polygon points (scaled by k) for a box with optional top-left (tlw/tlh)
 * and bottom-right (brw/brh) notches. Walks clockwise from just right of the
 * top-left notch. With no notches it degenerates to the four rectangle corners.
 */
export function notchPolygonPoints(b, k = 1) {
  const x = b.x * k, y = b.y * k, w = b.w * k, h = b.h * k;
  const tlw = (b.tlw || 0) * k, tlh = (b.tlh || 0) * k;
  const brw = (b.brw || 0) * k, brh = (b.brh || 0) * k;
  const pts = [
    [x + tlw, y],
    [x + w, y],
    [x + w, y + h - brh],
    [x + w - brw, y + h - brh],
    [x + w - brw, y + h],
    [x, y + h],
    [x, y + tlh],
    [x + tlw, y + tlh],
  ];
  return pts.map(([px, py]) => `${Math.round(px)},${Math.round(py)}`).join(" ");
}

/** left/right leaf objects -> sorted, unique verse-id union for the spread. */
export function spreadVerseIds(leftLeaf, rightLeaf) {
  const ids = new Set();
  for (const leaf of [leftLeaf, rightLeaf]) {
    const ref = leaf && leaf.pageReference;
    if (!ref) continue;
    for (const id of (lookupReference(ref) || {}).verse_ids || []) ids.add(id);
  }
  return [...ids].sort((a, z) => a - z);
}
