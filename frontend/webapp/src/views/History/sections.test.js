import { HISTORY_SECTIONS, getSection, pickRandom } from "./sections";

test("registry has four sections in the JS → Witnesses → Translation → Reception order", () => {
  expect(HISTORY_SECTIONS.map((s) => s.key)).toEqual([
    "josephSmith",
    "witnesses",
    "translation",
    "reception",
  ]);
});

test("every section has the required display + hero fields", () => {
  const HERO_TYPES = ["image", "witnesses", "placeholder", "randomThumb"];
  for (const s of HISTORY_SECTIONS) {
    expect(s.key).toBeTruthy();
    expect(s.title).toBeTruthy();
    expect(s.path).toMatch(/^\/history/);
    expect(s.blurb).toBeTruthy();
    expect(s.unit).toBeTruthy();
    expect(["live", "placeholder"]).toContain(s.status);
    expect(s.hero).toBeTruthy();
    expect(HERO_TYPES).toContain(s.hero.type);
  }
});

test("Translation is retitled to 'Translation Process'", () => {
  expect(getSection("translation").title).toBe("Translation Process");
});

test("hero descriptors carry the data each type needs", () => {
  expect(getSection("josephSmith").hero.src).toMatch(/joseph-smith\.jpg$/);
  expect(getSection("witnesses").hero.three).toHaveLength(3);
  expect(getSection("witnesses").hero.eight).toHaveLength(8);
  expect(getSection("translation").hero.icon).toBeTruthy();
  expect(getSection("reception").hero.archive).toBe("reception");
});

test("getSection resolves by key, null otherwise", () => {
  expect(getSection("reception").title).toBe("Reception History");
  expect(getSection("nope")).toBeNull();
});

test("pickRandom returns a member or null", () => {
  expect([1, 2, 3]).toContain(pickRandom([1, 2, 3]));
  expect(pickRandom([])).toBeNull();
  expect(pickRandom(null)).toBeNull();
});
