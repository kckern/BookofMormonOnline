import { compileHighlightRegex } from "../highlightPattern";

test("compiles an intentional pattern as-is", () => {
  const re = compileHighlightRegex("waters([^a-z]|<[^>]*>)+?of([^a-z]|<[^>]*>)+?Mormon");
  expect(re.test("waters <b>of</b> Mormon")).toBe(true);
});

test("falls back to literal matching for raw text with regex metacharacters", () => {
  const re = compileHighlightRegex("wicked (as to the) King");
  const re2 = compileHighlightRegex("wicked (as to the King");
  expect(re2).not.toBeNull();
  expect(re2.test("and he was wicked (as to the King")).toBe(true);
  expect(re.test("wicked (as to the) King")).toBe(true);
});

test("returns null only if even the escaped form cannot compile", () => {
  expect(compileHighlightRegex("plain words")).not.toBeNull();
});
