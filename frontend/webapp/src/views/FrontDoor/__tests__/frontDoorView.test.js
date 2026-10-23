import { frontDoorView, readChapterRef } from "../frontDoorView";

const base = { enabled: true, signedIn: false, chapterRef: null };
describe("frontDoorView", () => {
  test("first visit sees Discover", () => expect(frontDoorView(base)).toBe("discover"));
  test("flag off: always Read", () => expect(frontDoorView({ ...base, enabled: false })).toBe("read"));
  test("signed-in account -> Read", () => expect(frontDoorView({ ...base, signedIn: true })).toBe("read"));
  test("has read a chapter -> Read", () => expect(frontDoorView({ ...base, chapterRef: "Alma 32" })).toBe("read"));
  test("blank chapterRef counts as first visit", () => expect(frontDoorView({ ...base, chapterRef: "  " })).toBe("discover"));
});

describe("readChapterRef", () => {
  test("reads storage", () => expect(readChapterRef({ getItem: () => "1 Nephi 3" })).toBe("1 Nephi 3"));
  test("throwing storage is a first visit, not a crash", () => {
    expect(readChapterRef({ getItem() { throw new Error("blocked"); } })).toBeNull();
  });
});
