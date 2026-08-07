import {
  headline,
  partnersFor,
  pairStats,
  chapterCounts,
  pairsFor,
  bookTotal,
  scopedPartnersFor,
} from "../aggregate";

describe("aggregate", () => {
  test("headline matches the dataset", () => {
    expect(headline.total).toBe(2957);
    expect(headline.quotes).toBe(766);
    expect(headline.phrases).toBe(2957 - 766);
  });

  test("partnersFor(bom, 2 Nephi) is ranked with Isaiah first", () => {
    const partners = partnersFor("bom", "2 Nephi");
    expect(partners[0].book.name).toBe("Isaiah");
    expect(partners[0].total).toBeGreaterThan(partners[1]?.total ?? 0);
    for (const p of partners) expect(p.quotes + p.phrases).toBe(p.total);
  });

  test("partnersFor is symmetric in total mass", () => {
    const fromBom = partnersFor("bom", "2 Nephi").find((p) => p.book.name === "Isaiah");
    const fromKjv = partnersFor("kjv", "Isaiah").find((p) => p.book.name === "2 Nephi");
    expect(fromBom.total).toBe(fromKjv.total);
    expect(pairStats("2 Nephi", "Isaiah").total).toBe(fromBom.total);
  });

  test("bookTotal sums that book's partner list", () => {
    const partners = partnersFor("bom", "2 Nephi");
    const sum = partners.reduce((a, p) => a + p.total, 0);
    expect(bookTotal("bom", "2 Nephi")).toBe(sum);
  });

  test("chapterCounts covers every chapter and sums to the book total", () => {
    const counts = chapterCounts("bom", "2 Nephi");
    expect(counts).toHaveLength(33);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(bookTotal("bom", "2 Nephi"));
  });

  test("scopedPartnersFor sums across chapters to the unscoped ranking", () => {
    const book = "2 Nephi";
    const unscoped = partnersFor("bom", book);
    const summed = new Map();
    for (let ch = 1; ch <= 33; ch++) {
      for (const p of scopedPartnersFor("bom", book, ch)) {
        summed.set(p.book.name, (summed.get(p.book.name) || 0) + p.total);
      }
    }
    for (const p of unscoped) {
      expect(summed.get(p.book.name)).toBe(p.total);
    }
    // scoped entries carry a consistent quote/phrase split
    for (const p of scopedPartnersFor("bom", book, 12)) {
      expect(p.quotes + p.phrases).toBe(p.total);
    }
  });

  test("pairsFor returns raw triplets scoped to the pair (and chapter)", () => {
    const all = pairsFor("2 Nephi", "Isaiah");
    expect(all.length).toBe(pairStats("2 Nephi", "Isaiah").total);
    const ch12 = pairsFor("2 Nephi", "Isaiah", 12);
    expect(ch12.length).toBeGreaterThan(0);
    expect(ch12.length).toBeLessThan(all.length);
  });

  test("pairsFor scopes to a Bible chapter when given one", () => {
    const all = pairsFor("2 Nephi", "Isaiah");
    const scoped = pairsFor("2 Nephi", "Isaiah", undefined, 2); // Isaiah 2
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.length).toBeLessThan(all.length);
    // every returned Bible verse must live in Isaiah 2
    const { chapterOfVid } = require("../aggregate");
    for (const [, bibleVid] of scoped) expect(chapterOfVid(bibleVid)).toBe(2);
  });
});
