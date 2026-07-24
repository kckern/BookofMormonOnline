import {
  chunkIds, mergeBoxes, chapterRefOf, chapterRefsForVerseIds,
  indexReadByVerse, hydrateVerses, unionBox, spreadVerseIds, CHUNK_SIZE,
  hasNotch, notchPolygonPoints,
} from "../faxVerseData";
import { lookupReference } from "scripture-guide";

describe("faxVerseData", () => {
  test("chunkIds splits into <=40-id groups", () => {
    const ids = Array.from({ length: 41 }, (_, i) => i + 1);
    const chunks = chunkIds(ids);
    expect(CHUNK_SIZE).toBe(40);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(40);
    expect(chunks[1]).toEqual([41]);
  });

  test("mergeBoxes groups boxes by imagePage then verseId, preserving multiples", () => {
    const responses = [
      { pageScale: 700, boxes: [
        { verseId: 100, imagePage: 5, x: 1, y: 2, w: 3, h: 4, tlw: 10, tlh: 11, brw: 12, brh: 13 },
        { verseId: 100, imagePage: 5, x: 5, y: 6, w: 7, h: 8 },
        { verseId: 101, imagePage: 5, x: 9, y: 9, w: 9, h: 9 },
      ] },
      { pageScale: 700, boxes: [
        { verseId: 100, imagePage: 6, x: 0, y: 0, w: 1, h: 1 },
      ] },
    ];
    const { pageScale, byPageVerse } = mergeBoxes(responses);
    expect(pageScale).toBe(700);
    expect(byPageVerse.get(5).get(100)).toEqual([
      { x: 1, y: 2, w: 3, h: 4, tlw: 10, tlh: 11, brw: 12, brh: 13 }, // notches carried
      { x: 5, y: 6, w: 7, h: 8, tlw: 0, tlh: 0, brw: 0, brh: 0 },     // absent -> 0
    ]);
    expect(byPageVerse.get(5).get(101)).toHaveLength(1);
    expect(byPageVerse.get(6).get(100)).toHaveLength(1);
  });

  test("chapterRefOf strips the verse number", () => {
    expect(chapterRefOf("Alma 5:12")).toBe("Alma 5");
    expect(chapterRefOf("1 Nephi 2:11-12")).toBe("1 Nephi 2");
    expect(chapterRefOf("")).toBeNull();
  });

  test("chapterRefsForVerseIds returns distinct chapters spanning the ids", () => {
    const a = lookupReference("Alma 5:1").verse_ids[0];
    const b = lookupReference("Alma 7:1").verse_ids[0];
    const refs = chapterRefsForVerseIds([a, b, a]);
    expect(refs).toEqual(["Alma 5", "Alma 7"]);
  });

  test("indexReadByVerse flattens sections/blocks/lines into a verse map", () => {
    const chapters = [
      { sections: [
        { blocks: [
          { person_slug: "nephi-son-of-lehi", voice: "nephi", lines: [
            { verse_id: 100, text: "And it came to pass" },  // verse 100, line 1
            { verse_id: 100, text: "that in my days" },       // verse 100, line 2
          ] },
          { person_slug: null, voice: "narrator", lines: [
            { verse_id: 101, text: "that I, Nephi" },
          ] },
        ] },
      ] },
    ];
    const map = indexReadByVerse(chapters);
    // multi-line verse is CONCATENATED, not truncated to the last line
    expect(map.get(100)).toMatchObject({ text: "And it came to pass that in my days", person_slug: "nephi-son-of-lehi", voice: "nephi" });
    expect(typeof map.get(100).ref).toBe("string");
    expect(map.get(101).voice).toBe("narrator");
  });

  test("hydrateVerses merges boxes + text, sorted by verse_id", () => {
    const byPageVerse = new Map([[5, new Map([
      [101, [{ x: 9, y: 9, w: 9, h: 9 }]],
      [100, [{ x: 1, y: 2, w: 3, h: 4 }]],
    ])]]);
    const textByVerse = new Map([[100, { text: "t100", person_slug: "p", voice: "v", ref: "Alma 5:1" }]]);
    const out = hydrateVerses(byPageVerse, textByVerse);
    const verses = out.get(5);
    expect(verses.map((v) => v.verse_id)).toEqual([100, 101]);
    expect(verses[0]).toMatchObject({ verse_id: 100, text: "t100", ref: "Alma 5:1" });
    expect(verses[1].text).toBeUndefined();
    expect(typeof verses[1].ref).toBe("string");
  });

  test("hasNotch detects any notch inset", () => {
    expect(hasNotch({ x: 0, y: 0, w: 1, h: 1 })).toBe(false);
    expect(hasNotch({ x: 0, y: 0, w: 1, h: 1, tlw: 0, tlh: 0, brw: 0, brh: 0 })).toBe(false);
    expect(hasNotch({ x: 0, y: 0, w: 1, h: 1, brh: 5 })).toBe(true);
  });

  test("notchPolygonPoints degenerates to the rectangle corners without notches", () => {
    const p = notchPolygonPoints({ x: 10, y: 20, w: 100, h: 50 }, 1);
    expect(p).toContain("10,20");   // top-left
    expect(p).toContain("110,20");  // top-right
    expect(p).toContain("110,70");  // bottom-right
    expect(p).toContain("10,70");   // bottom-left
  });

  test("notchPolygonPoints insets the top-left and bottom-right notches", () => {
    const p = notchPolygonPoints({ x: 0, y: 0, w: 100, h: 100, tlw: 20, tlh: 10, brw: 30, brh: 15 }, 1);
    expect(p.startsWith("20,0")).toBe(true); // top edge starts right of the TL notch
    expect(p).toContain("20,10");            // TL notch inner corner
    expect(p).toContain("70,85");            // BR notch inner corner (100-30, 100-15)
    expect(p).toContain("70,100");           // BR notch bottom
  });

  test("unionBox returns the bounding rect of all boxes", () => {
    expect(unionBox([{ x: 10, y: 20, w: 5, h: 5 }, { x: 0, y: 0, w: 4, h: 4 }]))
      .toEqual({ x: 0, y: 0, w: 15, h: 25 });
    expect(unionBox([])).toBeNull();
  });

  test("spreadVerseIds unions both leaves' verse ids, sorted+unique", () => {
    const left = { pageReference: "Alma 5:1-3" };
    const right = { pageReference: "Alma 5:3-5" };
    const ids = spreadVerseIds(left, right);
    const expected = [...new Set([
      ...lookupReference("Alma 5:1-3").verse_ids,
      ...lookupReference("Alma 5:3-5").verse_ids,
    ])].sort((a, z) => a - z);
    expect(ids).toEqual(expected);
    expect(spreadVerseIds(null, null)).toEqual([]);
  });

  test("chunkIds([]) returns an empty array", () => {
    expect(chunkIds([])).toEqual([]);
  });

  test("unionBox with a single box returns that box's rect", () => {
    expect(unionBox([{ x: 5, y: 5, w: 10, h: 10 }])).toEqual({ x: 5, y: 5, w: 10, h: 10 });
  });

  test("invalid verse ids never throw (guarded generateReference)", () => {
    // 0 / out-of-range would make scripture-guide throw if unguarded
    expect(() => chapterRefsForVerseIds([0, 999999999])).not.toThrow();
    expect(chapterRefsForVerseIds([0, 999999999])).toEqual([]); // both skipped
    const map = indexReadByVerse([
      { sections: [{ blocks: [{ person_slug: "p", voice: "v", lines: [{ verse_id: 999999999, text: "x" }] }] }] },
    ]);
    expect(() => map.get(999999999)).not.toThrow();
    expect(map.get(999999999).ref).toBeNull(); // ref could not be generated
  });
});
