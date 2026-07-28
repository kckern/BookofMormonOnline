import { lastScriptureRef } from "../lastScriptureRef";

test("single reference", () => {
  expect(lastScriptureRef("see 1 Nephi 2:11 here", "en")).toBe("1 Nephi 2:11");
});
test("nearest when separated by prose", () => {
  expect(lastScriptureRef("1 Nephi 2:11 then later 3 Nephi 11:8", "en")).toBe("3 Nephi 11:8");
});
test("nearest when adjacent by comma — NOT the earlier ref", () => {
  expect(lastScriptureRef("1 Nephi 2:11, 3 Nephi 11:8", "en")).toBe("3 Nephi 11:8");
});
test("nearest when adjacent by 'and'", () => {
  expect(lastScriptureRef("1 Nephi 2:11 and 3 Nephi 11:8", "en")).toBe("3 Nephi 11:8");
});
test("no reference yields null", () => {
  expect(lastScriptureRef("no refs here", "en")).toBeNull();
});
test("empty / undefined input yields null", () => {
  expect(lastScriptureRef("", "en")).toBeNull();
  expect(lastScriptureRef(undefined, "en")).toBeNull();
});
