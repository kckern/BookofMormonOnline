import { resolveNoteRefs, buildNoteBodyHtml } from "../noteRefs";

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

describe("resolveNoteRefs — host-seeded bare refs", () => {
  const HOST_1NE = 31135; // a verse in 1 Nephi -> host book = "1 Nephi"

  test("truly-bare <ref>n seeds the host book", () => {
    const out = resolveNoteRefs("see 5:21n.", HOST_1NE);
    expect(out).toHaveLength(1);
    expect(out[0].verseId).toBe(31236); // 1 Nephi 5:21
  });

  test("malformed explicit-book ref (invalid chapter) is NOT host-seeded", () => {
    // Jacob has 7 chapters; "Jacob 22:30" is invalid. Host is in 1 Nephi (has ch 22).
    // Must NOT fabricate 1 Nephi 22:30 — render as plain text.
    expect(resolveNoteRefs("see Jacob 22.30n.", HOST_1NE)).toEqual([]);
  });

  test("no host verse and no in-text book -> nothing", () => {
    expect(resolveNoteRefs("see 5:21n.", null)).toEqual([]);
  });
});

describe("buildNoteBodyHtml", () => {
  test("note-ref becomes a note_ref anchor (no trailing n); plain ref stays scripture_link", () => {
    const html = buildNoteBodyHtml("see 1 Nephi 2:13n and Alma 5:14", 31135, "193");
    expect(html).toContain('class="note_ref"');
    expect(html).toContain('data-verse="31135"');
    expect(html).toContain('data-source="193"');
    expect(html).toContain(">1 Nephi 2:13<"); // n stripped from visible text
    expect(html).not.toContain("2:13n");
    expect(html).toContain('scripture_link'); // Alma 5:14 still a scripture link
  });
});
