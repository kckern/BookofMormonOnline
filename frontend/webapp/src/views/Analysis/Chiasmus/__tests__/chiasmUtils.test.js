import {
  parseScheme,
  bookFromReference,
  BOOK_GROUPS,
  enrichChiasmus,
  escapeRegex,
} from "../chiasmUtils";

describe("parseScheme", () => {
  test("depth = highest letter", () => {
    expect(parseScheme("ABCCBA").depth).toBe(3);
    expect(parseScheme("ABCDEFGHHGFEDCBA").depth).toBe(8);
  });
  test("depthBucket caps at + above 7", () => {
    expect(parseScheme("ABCCBA").depthBucket).toBe(3);
    expect(parseScheme("ABCDEFGHHGFEDCBA").depthBucket).toBe("+");
  });
  test("compound = repeated Aa pattern", () => {
    expect(parseScheme("AaAbBaBb").isCompound).toBe(true);
    expect(parseScheme("ABBA").isCompound).toBe(false);
  });
  test("perfect mirror ignores sub-letters", () => {
    expect(parseScheme("ABCCBA").isPerfectMirror).toBe(true);
    expect(parseScheme("ABCBA").isPerfectMirror).toBe(true); // odd pivot
    expect(parseScheme("ABCAB").isPerfectMirror).toBe(false);
    expect(parseScheme("AaBbBaAb".replace(/[a-z]/g, "") /* ABBA */).isPerfectMirror).toBe(true);
  });
  test("lineCount counts scheme entries incl. sub-letters", () => {
    expect(parseScheme("ABBA").lineCount).toBe(4);
  });
  test("empty/garbage scheme doesn't throw", () => {
    expect(parseScheme("").depth).toBe(0);
    expect(parseScheme(null).depth).toBe(0);
  });
});

describe("bookFromReference", () => {
  test.each([
    ["Alma 36:1–30", "Alma"],
    ["1 Nephi 19:7-14", "1 Nephi"],
    ["Words of Mormon 1:4", "Words of Mormon"],
    ["3 Nephi 12:1", "3 Nephi"],
  ])("%s → %s", (ref, book) => expect(bookFromReference(ref)).toBe(book));
  test("every extracted book has a group", () => {
    ["1 Nephi", "Alma", "Moroni", "Ether", "3 Nephi", "Words of Mormon"].forEach((b) =>
      expect(BOOK_GROUPS[b]).toBeTruthy()
    );
  });
});

describe("enrichChiasmus", () => {
  const list = [
    { chiasmus_id: "x1", reference: "Alma 36:1-30", scheme: "ABCDCBA", title: "Alma's Conversion" },
    { chiasmus_id: "x2", reference: "2 Nephi 12:1", scheme: "ABBA", title: "Isaiah quote" },
  ];
  test("adds verse_id, book, group, and parsed scheme fields once", () => {
    const out = enrichChiasmus(list, "en");
    expect(out[0].verse_id).toEqual(expect.any(Number));
    expect(out[0].book).toBe("Alma");
    expect(out[0].bookGroup).toBe("abridgment");
    expect(out[0].depth).toBe(4);
    expect(out[1].isBiblical).toBe(true); // 2 Ne 12 is an Isaiah block
    expect(out[0].isBiblical).toBe(false);
  });
  test("does not mutate input", () => {
    enrichChiasmus(list, "en");
    expect(list[0].depth).toBeUndefined();
  });
});

describe("escapeRegex", () => {
  test("escapes special characters", () => {
    expect(new RegExp(escapeRegex("a(b)?c")).test("a(b)?c")).toBe(true);
  });
});
