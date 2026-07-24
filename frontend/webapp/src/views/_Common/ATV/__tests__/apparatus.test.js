import {
  WITNESSES,
  SIGLA_ORDER,
  CHANGES,
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
});
