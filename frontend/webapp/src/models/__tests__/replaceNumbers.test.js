import { replaceNumbers } from "../Utils";

test("converts homonym digits 1-4 to superscripts, all occurrences", () => {
  expect(replaceNumbers("Lehi1")).toBe("Lehi¹");
  expect(replaceNumbers("Alma2 son of Alma1")).toBe("Alma² son of Alma¹");
});

test("leaves digits 5-9 unchanged", () => {
  expect(replaceNumbers("Mosiah5")).toBe("Mosiah5");
});

test("returns empty string for falsy input", () => {
  expect(replaceNumbers(null)).toBe("");
  expect(replaceNumbers(undefined)).toBe("");
  expect(replaceNumbers("")).toBe("");
});
