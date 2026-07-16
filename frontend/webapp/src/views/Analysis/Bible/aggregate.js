// One-pass rollups of the cross-reference pair index at module scope.
//
// index rows are [bomVerseId, bibleVerseId, isQuote] — verified against canon
// ranges (bom: 31103+, bible: <=31102). Keep this ordering everywhere; the
// old matrix code destructured these with reversed names — do not copy it.

import { generateReference } from "scripture-guide";
import { index } from "./data";
import { canons, bookOfVid } from "./canon";

const pairMap = new Map(); // "2 Nephi|Isaiah" -> {total, quotes}
const totals = { bom: new Map(), kjv: new Map() };

for (const [bomVid, bibleVid, isQuote] of index) {
  const bomBook = bookOfVid("bom", bomVid);
  const bibleBook = bookOfVid("kjv", bibleVid);
  if (!bomBook || !bibleBook) continue;
  const key = `${bomBook.name}|${bibleBook.name}`;
  const entry = pairMap.get(key) || { total: 0, quotes: 0 };
  entry.total += 1;
  if (isQuote) entry.quotes += 1;
  pairMap.set(key, entry);
  totals.bom.set(bomBook.name, (totals.bom.get(bomBook.name) || 0) + 1);
  totals.kjv.set(bibleBook.name, (totals.kjv.get(bibleBook.name) || 0) + 1);
}

export const headline = {
  total: index.length,
  quotes: index.reduce((a, [, , q]) => a + (q ? 1 : 0), 0),
  get phrases() {
    return this.total - this.quotes;
  },
};

export const pairStats = (bomBookName, bibleBookName) => {
  const e = pairMap.get(`${bomBookName}|${bibleBookName}`);
  return e
    ? { total: e.total, quotes: e.quotes, phrases: e.total - e.quotes }
    : { total: 0, quotes: 0, phrases: 0 };
};

export const bookTotal = (canonKey, bookName) => totals[canonKey].get(bookName) || 0;

export const allPairs = () =>
  [...pairMap.entries()].map(([key, e]) => {
    const [bomBookName, bibleBookName] = key.split("|");
    return {
      bomBookName,
      bibleBookName,
      total: e.total,
      quotes: e.quotes,
      phrases: e.total - e.quotes,
    };
  });

export const partnersFor = (canonKey, bookName) => {
  const partnerCanon = canonKey === "bom" ? "kjv" : "bom";
  return canons[partnerCanon].books
    .map((book) => {
      const s =
        canonKey === "bom" ? pairStats(bookName, book.name) : pairStats(book.name, bookName);
      return { book, ...s };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total);
};

// --- chapter machinery -------------------------------------------------
const chapterCache = new Map();

const vidChapterCache = new Map();

export const chapterOfVid = (vid) => {
  if (vidChapterCache.has(vid)) return vidChapterCache.get(vid);
  // "1 Nephi 3:12" -> 3. Digits-before-colon is locale-stable for our use.
  const ref = generateReference(vid);
  const m = String(ref).match(/(\d+):\d+\s*$/);
  const chapter = m ? Number(m[1]) : 1; // single-chapter books may omit the chapter
  vidChapterCache.set(vid, chapter);
  return chapter;
};

export const chapterCounts = (canonKey, bookName, partnerName) => {
  const cacheKey = `${canonKey}|${bookName}|${partnerName || ""}`;
  if (chapterCache.has(cacheKey)) return chapterCache.get(cacheKey);
  const book = canons[canonKey].books.find((b) => b.name === bookName);
  const counts = Array.from({ length: book.chapters }, () => 0);
  const vidCol = canonKey === "bom" ? 0 : 1;
  const otherCol = 1 - vidCol;
  const partnerCanon = canonKey === "bom" ? "kjv" : "bom";
  for (const row of index) {
    const vid = row[vidCol];
    if (vid < book.start || vid > book.end) continue;
    if (partnerName && bookOfVid(partnerCanon, row[otherCol])?.name !== partnerName) continue;
    const ch = chapterOfVid(vid);
    if (ch >= 1 && ch <= book.chapters) counts[ch - 1] += 1;
  }
  chapterCache.set(cacheKey, counts);
  return counts;
};

// Partner ranking scoped to one chapter of the anchored book.
export const scopedPartnersFor = (canonKey, bookName, chapter) => {
  const book = canons[canonKey].books.find((b) => b.name === bookName);
  if (!book) return [];
  const vidCol = canonKey === "bom" ? 0 : 1;
  const otherCol = 1 - vidCol;
  const partnerCanon = canonKey === "bom" ? "kjv" : "bom";
  const byPartner = new Map();
  for (const row of index) {
    const vid = row[vidCol];
    if (vid < book.start || vid > book.end) continue;
    if (chapterOfVid(vid) !== chapter) continue;
    const partner = bookOfVid(partnerCanon, row[otherCol]);
    if (!partner) continue;
    const entry = byPartner.get(partner.name) || { book: partner, total: 0, quotes: 0 };
    entry.total += 1;
    if (row[2]) entry.quotes += 1;
    byPartner.set(partner.name, entry);
  }
  return [...byPartner.values()]
    .map((e) => ({ ...e, phrases: e.total - e.quotes }))
    .sort((a, b) => b.total - a.total);
};

export const pairsFor = (bomBookName, bibleBookName, bomChapter) => {
  const bom = canons.bom.books.find((b) => b.name === bomBookName);
  const bible = canons.kjv.books.find((b) => b.name === bibleBookName);
  if (!bom || !bible) return [];
  return index.filter(([bomVid, bibleVid]) => {
    if (bomVid < bom.start || bomVid > bom.end) return false;
    if (bibleVid < bible.start || bibleVid > bible.end) return false;
    if (bomChapter && chapterOfVid(bomVid) !== bomChapter) return false;
    return true;
  });
};
