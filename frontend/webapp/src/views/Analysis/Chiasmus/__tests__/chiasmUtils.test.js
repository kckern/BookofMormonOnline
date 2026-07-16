import {
  parseScheme,
  bookFromReference,
  BOOK_GROUPS,
  enrichChiasmus,
  escapeRegex,
  applyBrowseState,
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
  test("lineCount counts sub-letters too", () => {
    expect(parseScheme("AaBbBaAb").lineCount).toBe(8);
  });
  test("perfect mirror computed from raw compound scheme (sub-letters stripped internally)", () => {
    expect(parseScheme("AaBbBaAb").isPerfectMirror).toBe(true); // majors: ABBA
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

describe("applyBrowseState", () => {
  const mk = (over) => ({
    chiasmus_id: over.id, title: over.title || "t", reference: over.ref || "r",
    verse_id: over.v === undefined ? 1 : over.v, book: over.book || "Alma", bookGroup: over.bookGroup || "abridgment",
    depth: over.depth || 2, depthBucket: over.depth > 7 ? "+" : (over.depth || 2), lineCount: over.lines || 4,
    isCompound: !!over.compound, isBiblical: !!over.biblical, isPerfectMirror: true,
  });
  const list = [
    mk({ id: "a", v: 300, depth: 5, title: "Zeta" }),
    mk({ id: "b", v: 100, depth: 2, title: "Alpha", compound: true }),
    mk({ id: "c", v: 200, depth: 7, title: "Midway", biblical: true, book: "2 Nephi", bookGroup: "small-plates", ref: "2 Nephi 12:1" }),
  ];
  const S = (over) => ({ q: "", group: "none", sort: "canonical", dir: "asc", depths: [], type: null, ...over });

  test("canonical sort by verse_id asc", () =>
    expect(applyBrowseState(list, S()).flat.map((c) => c.chiasmus_id)).toEqual(["b", "c", "a"]));
  test("dir desc reverses", () =>
    expect(applyBrowseState(list, S({ dir: "desc" })).flat.map((c) => c.chiasmus_id)).toEqual(["a", "c", "b"]));
  test("depth inclusion filter with STRING depths (URL form)", () =>
    expect(applyBrowseState(list, S({ depths: ["5", "7"] })).flat.map((c) => c.chiasmus_id)).toEqual(["c", "a"]));
  test("type filter: biblical only", () =>
    expect(applyBrowseState(list, S({ type: "biblical" })).flat).toHaveLength(1));
  test("type filter: compound only", () =>
    expect(applyBrowseState(list, S({ type: "compound" })).flat.map(c => c.chiasmus_id)).toEqual(["b"]));
  test("type filter: simple excludes compound and biblical", () =>
    expect(applyBrowseState(list, S({ type: "simple" })).flat.map(c => c.chiasmus_id)).toEqual(["a"]));
  test("search matches title case-insensitively", () =>
    expect(applyBrowseState(list, S({ q: "alpha" })).flat[0].chiasmus_id).toBe("b"));
  test("search matches reference", () =>
    expect(applyBrowseState(list, S({ q: "2 nephi" })).flat[0].chiasmus_id).toBe("c"));
  test("sort by depth ties break canonically", () =>
    expect(applyBrowseState(list, S({ sort: "depth" })).flat.map(c => c.chiasmus_id)).toEqual(["b", "a", "c"]));
  test("sort by title A–Z", () =>
    expect(applyBrowseState(list, S({ sort: "title" })).flat.map(c => c.chiasmus_id)).toEqual(["b", "c", "a"]));
  test("group none → groups null", () =>
    expect(applyBrowseState(list, S()).groups).toBeNull());
  test("grouping by book returns canonical book order with items", () => {
    const { groups } = applyBrowseState(list, S({ group: "book" }));
    expect(groups.map((g) => g.key)).toEqual(["2 Nephi", "Alma"]);
    expect(groups[1].items).toHaveLength(2);
  });
  test("grouping by depth", () => {
    const { groups } = applyBrowseState(list, S({ group: "depth" }));
    expect(groups.map(g => g.key)).toEqual(["Level 2", "Level 5", "Level 7"]);
  });
  test("grouping by depth: Level + sorts last regardless of sort order", () => {
    const withDeep = [mk({ id: "d", v: 50, depth: 9 }), ...list];
    const { groups } = applyBrowseState(withDeep, S({ group: "depth" }));
    expect(groups.map(g => g.key)).toEqual(["Level 2", "Level 5", "Level 7", "Level +"]);
  });
  test("grouping by type", () => {
    const { groups } = applyBrowseState(list, S({ group: "type" }));
    expect(groups.map(g => g.key).sort()).toEqual(["Biblical", "Compound", "Simple"]);
  });
  test("grouping by type pins Simple → Compound → Biblical regardless of sort", () => {
    // canonical asc puts the compound item first, so unpinned insertion
    // order would be Compound, Biblical, Simple
    const { groups } = applyBrowseState(list, S({ group: "type" }));
    expect(groups.map(g => g.key)).toEqual(["Simple", "Compound", "Biblical"]);
    const desc = applyBrowseState(list, S({ group: "type", dir: "desc" }));
    expect(desc.groups.map(g => g.key)).toEqual(["Simple", "Compound", "Biblical"]);
  });
  test("groups respect the active filter", () => {
    const { groups, flat } = applyBrowseState(list, S({ group: "book", type: "biblical" }));
    expect(flat).toHaveLength(1);
    expect(groups).toHaveLength(1);
  });
  test("null verse_id sorts first deterministically, no crash", () => {
    const withNull = [...list, mk({ id: "n", v: null, depth: 3 })];
    const out = applyBrowseState(withNull, S()).flat.map(c => c.chiasmus_id);
    expect(out[0]).toBe("n");
  });
});

describe("escapeRegex", () => {
  test("escapes special characters", () => {
    expect(new RegExp(escapeRegex("a(b)?c")).test("a(b)?c")).toBe(true);
  });
});
