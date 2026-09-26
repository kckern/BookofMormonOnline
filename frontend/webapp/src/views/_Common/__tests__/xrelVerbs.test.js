import { verbLabel, tagLabel } from "../xrelVerbs";

vi.mock("src/models/Utils", () => ({ label: (k) => k }));

describe("verbLabel", () => {
  test("de-hyphenates when the dictionary has no entry", () => {
    expect(verbLabel("wielded-by")).toBe("wielded by");
    expect(verbLabel("instance-of")).toBe("instance of");
  });
  test("handles a bare verb", () => {
    expect(verbLabel("includes")).toBe("includes");
  });
  test("is safe on null and undefined", () => {
    expect(verbLabel(null)).toBe("");
    expect(verbLabel(undefined)).toBe("");
  });
});

describe("verbLabel before the dictionary loads", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('treats label() returning " " as a miss', async () => {
    vi.doMock("src/models/Utils", () => ({ label: () => " " }));
    const { verbLabel: blankVerbLabel } = await import("../xrelVerbs");
    expect(blankVerbLabel("wielded-by")).toBe("wielded by");
    expect(blankVerbLabel("made-by")).toBe("made by");
    expect(blankVerbLabel("includes")).toBe("includes");
  });

  test("uses the dictionary entry when there is a real one", async () => {
    vi.doMock("src/models/Utils", () => ({ label: () => "wielded by" }));
    const { verbLabel: hitVerbLabel } = await import("../xrelVerbs");
    expect(hitVerbLabel("wielded-by")).toBe("wielded by");
  });
});

describe("tagLabel", () => {
  test("keeps joining words lowercase", () => {
    expect(tagLabel("brother-of-jared")).toBe("Brother of Jared");
  });
  test("title-cases a plain slug", () => {
    expect(tagLabel("lamanites")).toBe("Lamanites");
    expect(tagLabel("joseph-smith")).toBe("Joseph Smith");
    expect(tagLabel("lord")).toBe("Lord");
  });
  test("is safe on empty input", () => {
    expect(tagLabel(null)).toBe("");
    expect(tagLabel("")).toBe("");
  });
});
