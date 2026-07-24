import { WITNESSES, SIGLA_ORDER, CHANGES, isSiglum } from "../witnesses";

test("covers exactly the 22 sigla, in chronological order", () => {
  expect(SIGLA_ORDER.join("")).toBe("01ABCDEFGHIJKLMNOPQRST");
  expect(Object.keys(WITNESSES).sort()).toEqual([...SIGLA_ORDER].sort());
});

test("every witness has a short label and a provenance paragraph", () => {
  for (const s of SIGLA_ORDER) {
    expect(WITNESSES[s].label).toBeTruthy();
    expect(WITNESSES[s].provenance.length).toBeGreaterThan(20);
  }
});

test("isSiglum accepts known letters and rejects everything else", () => {
  expect(isSiglum("A")).toBe(true);
  expect(isSiglum("0")).toBe(true);
  expect(isSiglum("U")).toBe(false); // in [A-Z] but not a witness
  expect(isSiglum("a")).toBe(false);
  expect(isSiglum("")).toBe(false);
});

test("correction codes include the multi-character forms found in the data", () => {
  expect(CHANGES["js"]).toMatch(/Joseph Smith/);
  expect(CHANGES["jg"]).toMatch(/John Gilbert/);
  expect(CHANGES["%"]).toMatch(/erasure/);
  expect(CHANGES[""]).toBeTruthy(); // bare ">" — 632 occurrences
});
