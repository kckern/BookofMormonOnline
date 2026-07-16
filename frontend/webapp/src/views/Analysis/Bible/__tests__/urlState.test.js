import { parseValue, serialize } from "../urlState";

describe("urlState", () => {
  test.each([
    ["bible", { view: "overview" }],
    ["bible/", { view: "overview" }],
    ["bible/bom/2-nephi", { view: "anchor", canon: "bom", book: "2 Nephi" }],
    ["bible/bom/2-nephi/12", { view: "anchor", canon: "bom", book: "2 Nephi", chapter: 12 }],
    ["bible/kjv/isaiah", { view: "anchor", canon: "kjv", book: "Isaiah" }],
    ["bible/bom/2-nephi~isaiah", { view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah" }],
    ["bible/bom/2-nephi/12~isaiah", { view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah", bomChapter: 12 }],
  ])("parses %s", (value, expected) => {
    expect(parseValue(value)).toEqual(expected);
  });

  test("legacy two-book URL becomes a reader state", () => {
    expect(parseValue("bible/1-nephi~genesis")).toEqual({
      view: "reader",
      bomBook: "1 Nephi",
      bibleBook: "Genesis",
    });
  });

  test("legacy group/garbage slugs degrade to overview, never throw", () => {
    expect(parseValue("bible/plates-of-mormon~torah")).toEqual({ view: "overview" });
    expect(parseValue("bible/nonsense/whatever")).toEqual({ view: "overview" });
    expect(parseValue(undefined)).toEqual({ view: "overview" });
  });

  test("serialize ⇄ parse round-trips every state shape", () => {
    const states = [
      { view: "overview" },
      { view: "anchor", canon: "bom", book: "2 Nephi" },
      { view: "anchor", canon: "kjv", book: "Isaiah" },
      { view: "anchor", canon: "bom", book: "2 Nephi", chapter: 12 },
      { view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah" },
      { view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah", bomChapter: 12 },
    ];
    for (const s of states) {
      expect(parseValue(serialize(s).replace(/^\/analysis\//, ""))).toEqual(s);
    }
  });

  test("serialize produces /analysis/bible paths", () => {
    expect(serialize({ view: "anchor", canon: "kjv", book: "Isaiah" })).toBe(
      "/analysis/bible/kjv/isaiah"
    );
  });
});
