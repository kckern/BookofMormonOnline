import { HISTORY_SECTIONS, getSection, pickRandom } from "./sections";

test("registry has four sections, each with required fields", () => {
  expect(HISTORY_SECTIONS).toHaveLength(4);
  for (const s of HISTORY_SECTIONS) {
    expect(s.key).toBeTruthy();
    expect(s.title).toBeTruthy();
    expect(s.path).toMatch(/^\/history/);
    expect(s.icon).toBeTruthy();
    expect(["live", "placeholder"]).toContain(s.status);
  }
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
