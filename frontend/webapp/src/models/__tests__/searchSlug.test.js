import { getSearchSlug, getSearchValue } from "../searchSlug";

describe("getSearchSlug (encode keyword -> URL slug)", () => {
  test("replaces spaces with dots", () => {
    expect(getSearchSlug("what ye shall")).toBe("what.ye.shall");
  });

  test("collapses whitespace runs and trims surrounding space", () => {
    expect(getSearchSlug("  what   ye  shall  ")).toBe("what.ye.shall");
  });

  test("lowercases", () => {
    expect(getSearchSlug("What Ye Shall")).toBe("what.ye.shall");
  });

  test("normalizes stray ,;. punctuation to a single separator", () => {
    expect(getSearchSlug("faith, hope; charity")).toBe("faith.hope.charity");
  });

  test("strips leading/trailing separators", () => {
    expect(getSearchSlug(". what ye shall .")).toBe("what.ye.shall");
  });

  test("handles empty and undefined", () => {
    expect(getSearchSlug("")).toBe("");
    expect(getSearchSlug(undefined)).toBe("");
  });
});

describe("getSearchValue (decode URL slug -> keyword)", () => {
  test("treats dots as whitespace", () => {
    expect(getSearchValue("what.ye.shall")).toBe("what ye shall");
  });

  test("legacy space-encoded URLs decode unchanged (backward compatible)", () => {
    expect(getSearchValue("what ye shall")).toBe("what ye shall");
  });

  test("handles undefined", () => {
    expect(getSearchValue(undefined)).toBe("");
  });
});

describe("round-trip", () => {
  test("encode then decode yields the normalized phrase", () => {
    expect(getSearchValue(getSearchSlug("What  Ye Shall"))).toBe("what ye shall");
  });
});
