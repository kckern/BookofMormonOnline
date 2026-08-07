import { canons, bookBySlug, bookOfVid, slugify } from "../canon";

describe("canon", () => {
  test("slugify strips apostrophes and lowercases", () => {
    expect(slugify("Solomon's Song")).toBe("solomons-song");
    expect(slugify("1 Nephi")).toBe("1-nephi");
  });

  test("slugify emits only url-safe characters", () => {
    expect(slugify("Gospels & Acts")).toBe("gospels-acts");
    expect(slugify("1 Corinthians")).toBe("1-corinthians");
    expect(slugify("Solomon's Song")).toBe("solomons-song");
  });

  test("bible canon has 66 books in 9 groups; bom has 15 in 3", () => {
    expect(canons.kjv.books).toHaveLength(66);
    expect(canons.kjv.groups).toHaveLength(9);
    expect(canons.bom.books).toHaveLength(15);
    expect(canons.bom.groups).toHaveLength(3);
  });

  test("duplicate Mormon rows are merged into one 9-chapter book", () => {
    const mormon = canons.bom.books.filter((b) => b.name === "Mormon");
    expect(mormon).toHaveLength(1);
    expect(mormon[0]).toMatchObject({ start: 36884, end: 37110, chapters: 9 });
  });

  test("bookBySlug is case-insensitive and canon-scoped", () => {
    expect(bookBySlug("bom", "2-NEPHI").name).toBe("2 Nephi");
    expect(bookBySlug("kjv", "isaiah").name).toBe("Isaiah");
    expect(bookBySlug("kjv", "2-nephi")).toBeUndefined();
  });

  test("bookOfVid finds the containing book", () => {
    expect(bookOfVid("bom", 31103).name).toBe("1 Nephi");
    expect(bookOfVid("kjv", 17656).name).toBe("Isaiah");
    expect(bookOfVid("bom", 37110).name).toBe("Mormon");
    expect(bookOfVid("kjv", 99999)).toBeUndefined();
  });

  test("every book knows its group and verse count", () => {
    const isaiah = bookBySlug("kjv", "isaiah");
    expect(isaiah.group).toBe("Major Prophets");
    expect(isaiah.verses).toBe(18947 - 17656 + 1);
  });
});
