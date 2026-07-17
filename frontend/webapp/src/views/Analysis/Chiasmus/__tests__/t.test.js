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
  test("substitutes inserts through label() when key exists", () => {
    global.dictionary = { depth_chip_label: "Profundidad $1 — $2 quiasmos" };
    expect(t("depth_chip_label", "Depth $1 — $2 chiasms", ["4", 128])).toBe("Profundidad 4 — 128 quiasmos");
  });
  test("substitutes inserts into the fallback when key is missing", () => {
    global.dictionary = { other_key: "Other" };
    expect(t("depth_chip_label", "Depth $1 — $2 chiasms", ["4", 128])).toBe("Depth 4 — 128 chiasms");
  });
});
