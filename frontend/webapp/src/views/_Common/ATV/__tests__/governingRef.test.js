import { governingRefs } from "../governingRef";

// fake detector: returns the LAST "Book c:v"-looking token in a context slice
const fakeDetect = (html) => {
  const m = (html || "").match(/\b\d?\s?[A-Z][a-z]+ \d+:\d+/g);
  return m ? m[m.length - 1] : null;
};

test("each unit inherits the nearest preceding citation", () => {
  const contexts = ["heading 1 Nephi 2:11 because", "and 3 Nephi 11:8 they saw"];
  expect(governingRefs(contexts, fakeDetect)).toEqual(["1 Nephi 2:11", "3 Nephi 11:8"]);
});

test("a citation persists over following units that have none", () => {
  const contexts = ["1 Nephi 2:11 first", "second unit, no ref here"];
  expect(governingRefs(contexts, fakeDetect)).toEqual(["1 Nephi 2:11", "1 Nephi 2:11"]);
});

test("units before any citation resolve to null (label-only fallback)", () => {
  const contexts = ["intro prose, no ref", "then 1 Nephi 1:9 here"];
  expect(governingRefs(contexts, fakeDetect)).toEqual([null, "1 Nephi 1:9"]);
});

test("empty input yields empty output", () => {
  expect(governingRefs([], fakeDetect)).toEqual([]);
});
