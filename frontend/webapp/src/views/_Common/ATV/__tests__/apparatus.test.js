import {
  WITNESSES,
  SIGLA_ORDER,
  CHANGES,
  CHANGE_CODES,
  BARE_CHANGE,
  isSiglum,
  decodeMarker,
} from "../apparatus";

test("covers exactly the 22 sigla, in chronological order", () => {
  expect(SIGLA_ORDER.join("")).toBe("01ABCDEFGHIJKLMNOPQRST");
  expect(Object.keys(WITNESSES).sort()).toEqual([...SIGLA_ORDER].sort());
});

test("printed-edition labels run forward in time", () => {
  // 0 and 1 are the manuscripts; every other label starts with its year.
  const years = SIGLA_ORDER.slice(2).map((s) => {
    const year = /^(\d{4})/.exec(WITNESSES[s].label);
    expect(year).not.toBeNull();
    return Number(year[1]);
  });
  expect(years).toHaveLength(20);
  years.forEach((year, i) => {
    if (i > 0) expect(year).toBeGreaterThanOrEqual(years[i - 1]);
  });
});

test("every witness has a short label and a provenance paragraph", () => {
  for (const s of SIGLA_ORDER) {
    expect(WITNESSES[s].label).toBeTruthy();
    expect(WITNESSES[s].provenance.length).toBeGreaterThan(20);
  }
});

test("no witness label or provenance paragraph is duplicated", () => {
  const labels = SIGLA_ORDER.map((s) => WITNESSES[s].label);
  const provenances = SIGLA_ORDER.map((s) => WITNESSES[s].provenance);
  expect(new Set(labels).size).toBe(SIGLA_ORDER.length);
  expect(new Set(provenances).size).toBe(SIGLA_ORDER.length);
});

test("isSiglum accepts known letters and rejects everything else", () => {
  expect(isSiglum("A")).toBe(true);
  expect(isSiglum("0")).toBe(true);
  expect(isSiglum("U")).toBe(false); // in [A-Z] but not a witness
  expect(isSiglum("a")).toBe(false);
  expect(isSiglum("")).toBe(false);
  expect(isSiglum("constructor")).toBe(false); // inherited, not own
});

test("correction codes include the multi-character forms found in the data", () => {
  expect(CHANGES["js"]).toMatch(/Joseph Smith/);
  expect(CHANGES["jg"]).toMatch(/John Gilbert/);
  expect(CHANGES["%"]).toMatch(/erasure/);
});

test("every code attested in the corpus resolves to a description", () => {
  const attested = ["js", "jg", "+", "%", "p", "–", "+–", "%+", "++", "?", "%?"];
  for (const code of attested) {
    expect(typeof CHANGES[code]).toBe("string");
    expect(CHANGES[code].length).toBeGreaterThan(0);
  }
});

test("every correction code maps to a non-empty description", () => {
  const codes = Object.keys(CHANGES);
  expect(codes.length).toBeGreaterThan(0);
  for (const code of codes) {
    expect(typeof CHANGES[code]).toBe("string");
    expect(CHANGES[code].trim().length).toBeGreaterThan(0);
  }
});

test("a bare marker has its own description and no empty-string key", () => {
  // "" would match at every position in a longest-match tokeniser (task 5).
  expect(Object.keys(CHANGES)).not.toContain("");
  expect(BARE_CHANGE).toBeTruthy();
});

test("decodeMarker turns corpus entities into the characters CHANGES is keyed on", () => {
  expect(decodeMarker("&gt;&ndash;")).toBe(">–");
  expect(decodeMarker("&gt;+&ndash;")).toBe(">+–");
  expect(decodeMarker("&gt;js")).toBe(">js");
  expect(decodeMarker(">js")).toBe(">js"); // already literal, unchanged
  expect(CHANGES[decodeMarker("&gt;&ndash;").slice(1)]).toBeTruthy();
  expect(CHANGES[decodeMarker("&gt;+&ndash;").slice(1)]).toBeTruthy();
});

test("the exported tables are frozen", () => {
  expect(Object.isFrozen(WITNESSES)).toBe(true);
  expect(Object.isFrozen(CHANGES)).toBe(true);
  expect(Object.isFrozen(SIGLA_ORDER)).toBe(true);
  expect(Array.isArray(CHANGE_CODES)).toBe(true); // isFrozen(undefined) is true
  expect(Object.isFrozen(CHANGE_CODES)).toBe(true);
});

test("witness entries are frozen too, so the citations cannot be rewritten", () => {
  const before = WITNESSES.A.label;
  expect(Object.isFrozen(WITNESSES.A)).toBe(true);
  try {
    WITNESSES.A.label = "MUTATED"; // throws under strict mode, no-ops otherwise
  } catch (e) {
    // expected in strict mode
  }
  expect(WITNESSES.A.label).toBe(before);
  for (const s of SIGLA_ORDER) expect(Object.isFrozen(WITNESSES[s])).toBe(true);
});

test("CHANGE_CODES is ordered longest-first for longest-match tokenising", () => {
  expect([...CHANGE_CODES].sort()).toEqual(Object.keys(CHANGES).sort());
  CHANGE_CODES.forEach((code, i) => {
    if (i > 0) expect(code.length).toBeLessThanOrEqual(CHANGE_CODES[i - 1].length);
  });
  // the specific collisions that would truncate a real code
  expect(CHANGE_CODES.indexOf("+–")).toBeLessThan(CHANGE_CODES.indexOf("+"));
  expect(CHANGE_CODES.indexOf("%+")).toBeLessThan(CHANGE_CODES.indexOf("%"));
  expect(CHANGE_CODES.indexOf("%?")).toBeLessThan(CHANGE_CODES.indexOf("%"));
});
