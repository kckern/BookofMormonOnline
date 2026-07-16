import { t } from "../t";

describe("t", () => {
  afterEach(() => { delete global.dictionary; });

  test("returns fallback when no dictionary is loaded", () => {
    delete global.dictionary;
    expect(t("some_key", "Fallback")).toBe("Fallback");
  });
  test("returns fallback when key is missing from dictionary", () => {
    global.dictionary = { other_key: "Other" };
    expect(t("some_key", "Fallback")).toBe("Fallback");
  });
  test("returns translation when key exists", () => {
    global.dictionary = { some_key: "Translated" };
    expect(t("some_key", "Fallback")).toBe("Translated");
  });
});
