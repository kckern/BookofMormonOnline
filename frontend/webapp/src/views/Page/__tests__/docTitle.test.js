import { setBaseDocTitle, pushDocTitle, popDocTitle, __resetDocTitleForTests } from "../docTitle";

beforeEach(() => {
  __resetDocTitleForTests();
  document.title = "";
});

test("base title applies when nothing is pushed", () => {
  setBaseDocTitle("Lehites | Book of Mormon Online");
  expect(document.title).toBe("Lehites | Book of Mormon Online");
});

test("push overrides base; pop restores it", () => {
  setBaseDocTitle("Lehites");
  pushDocTitle("row", "1 Nephi 1 | Home");
  expect(document.title).toBe("1 Nephi 1 | Home");
  popDocTitle("row");
  expect(document.title).toBe("Lehites");
});

test("nested pushes restore in LIFO order; popping a middle key keeps the top", () => {
  setBaseDocTitle("Lehites");
  pushDocTitle("row", "1 Nephi 1");
  pushDocTitle("image", "Art: Liahona");
  expect(document.title).toBe("Art: Liahona");
  popDocTitle("row"); // middle entry removed, top stays
  expect(document.title).toBe("Art: Liahona");
  popDocTitle("image");
  expect(document.title).toBe("Lehites");
});

test("re-pushing the same key replaces its entry (no duplicates)", () => {
  setBaseDocTitle("Lehites");
  pushDocTitle("image", "Art: A");
  pushDocTitle("image", "Art: B");
  expect(document.title).toBe("Art: B");
  popDocTitle("image");
  expect(document.title).toBe("Lehites");
});

test("changing the base while an entry is pushed applies after pop", () => {
  setBaseDocTitle("Lehites");
  pushDocTitle("row", "1 Nephi 1");
  setBaseDocTitle("Mulekites");
  expect(document.title).toBe("1 Nephi 1");
  popDocTitle("row");
  expect(document.title).toBe("Mulekites");
});

test("pushing a falsy title is coerced to empty string, never 'undefined'", () => {
  setBaseDocTitle("Lehites");
  pushDocTitle("panel", undefined);
  expect(document.title).toBe(""); // coerced, not the string "undefined"
  popDocTitle("panel");
  expect(document.title).toBe("Lehites");
});
