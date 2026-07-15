import { extractTagIds } from "../tagIds";

test("extracts and dedupes ids for a tag across multiple texts", () => {
  expect(
    extractTagIds("i", "a [i]12[/i] b [i]12[/i]", "c [i]7[/i]")
  ).toEqual(["12", "7"]);
});

test("is case-insensitive and tag-scoped", () => {
  expect(extractTagIds("c", "x [C]005[/C] y [i]9[/i]")).toEqual(["005"]);
});

test("tolerates non-string and empty inputs", () => {
  expect(extractTagIds("i", undefined, null, "")).toEqual([]);
});
