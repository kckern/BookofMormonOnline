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

describe("resolveNoteRefs — in-context implied book", () => {
  test("bare <ref>n inherits a book named earlier in the same note", () => {
    const out = resolveNoteRefs("As in 1 Nephi 3:7, see 5:21n.", null);
    const bare = out.find((r) => r.rawText.replace(/\s/g, "").endsWith("5:21"));
    expect(bare).toBeTruthy();
    expect(bare.verseId).toBe(31236); // 1 Nephi 5:21
  });
});
