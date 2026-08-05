import { resolveNoteRefs } from "../noteRefs";

describe("resolveNoteRefs — qualified note-refs", () => {
  test("book-qualified <ref>n is detected with resolved verseId", () => {
    const out = resolveNoteRefs("see 1 Nephi 2:13n here", null);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ verseId: 31135, rawText: "1 Nephi 2:13" });
    // span covers the trailing n so the mask strips it
    expect("see 1 Nephi 2:13n here".slice(out[0].start, out[0].end)).toBe("1 Nephi 2:13n");
  });

  test("a plain ref with no trailing n is NOT a note-ref", () => {
    expect(resolveNoteRefs("see Alma 5:14 here", null)).toEqual([]);
  });

  test("ref followed by a word starting with n is not a note-ref", () => {
    expect(resolveNoteRefs("Alma 5:14 near the end", null)).toEqual([]);
  });
});
