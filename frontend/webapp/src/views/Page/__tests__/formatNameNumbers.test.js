import { formatNameNumbers } from "../PersonPlace";

test("converts homonym digits 1-4 to superscripts, all occurrences", () => {
  expect(formatNameNumbers("Lehi1")).toBe("Lehi¹");
  expect(formatNameNumbers("Alma2 son of Alma1")).toBe("Alma² son of Alma¹");
});

test("tolerates null/undefined", () => {
  expect(formatNameNumbers(null)).toBeNull();
  expect(formatNameNumbers(undefined)).toBeNull();
});
