/** @format */
import { HISTORY_SECTIONS, getSection, pickRandom } from "../sections";

describe("sections", () => {
  test("HISTORY_SECTIONS exports an array with at least four entries", () => {
    expect(Array.isArray(HISTORY_SECTIONS)).toBe(true);
    expect(HISTORY_SECTIONS.length).toBeGreaterThanOrEqual(4);
  });

  test("every section has key, title, path, icon, blurb, and status", () => {
    HISTORY_SECTIONS.forEach((s) => {
      expect(s).toHaveProperty("key");
      expect(s).toHaveProperty("title");
      expect(s).toHaveProperty("path");
      expect(s).toHaveProperty("icon");
      expect(s).toHaveProperty("blurb");
      expect(s).toHaveProperty("status");
    });
  });

  test("getSection returns the matching section by key", () => {
    const w = getSection("witnesses");
    expect(w).not.toBeNull();
    expect(w.title).toMatch(/witnesses/i);
  });

  test("getSection returns null for an unknown key", () => {
    expect(getSection("nonexistent")).toBeNull();
  });

  test("pickRandom returns an element from a non-empty array", () => {
    const arr = [1, 2, 3];
    expect(arr).toContain(pickRandom(arr));
  });

  test("pickRandom returns null for empty / non-array", () => {
    expect(pickRandom([])).toBeNull();
    expect(pickRandom(null)).toBeNull();
    expect(pickRandom(undefined)).toBeNull();
  });

  test("the translation, joseph-smith, and lostPages sections are live", () => {
    expect(getSection("translation").status).toBe("live");
    expect(getSection("josephSmith").status).toBe("live");
    expect(getSection("lostPages").status).toBe("live");
  });
});
