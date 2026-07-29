import { verbLabel } from "../xrelVerbs";

jest.mock("src/models/Utils", () => ({ label: (k) => k }));

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
    jest.resetModules();
  });

  test('treats label() returning " " as a miss', () => {
    jest.doMock("src/models/Utils", () => ({ label: () => " " }));
    // eslint-disable-next-line global-require
    const { verbLabel: blankVerbLabel } = require("../xrelVerbs");
    expect(blankVerbLabel("wielded-by")).toBe("wielded by");
    expect(blankVerbLabel("made-by")).toBe("made by");
    expect(blankVerbLabel("includes")).toBe("includes");
  });

  test("uses the dictionary entry when there is a real one", () => {
    jest.doMock("src/models/Utils", () => ({ label: () => "wielded by" }));
    // eslint-disable-next-line global-require
    const { verbLabel: hitVerbLabel } = require("../xrelVerbs");
    expect(hitVerbLabel("wielded-by")).toBe("wielded by");
  });
});
