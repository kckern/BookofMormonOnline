import { faxVerseReducer, initialFaxVerseState } from "../faxVerseState";

const verse = { verse_id: 100, ref: "Alma 5:1", boxes: [], text: "t" };

describe("faxVerseReducer", () => {
  test("HOVER sets the active verse from the hover source", () => {
    const s = faxVerseReducer(initialFaxVerseState, { type: "HOVER", verseId: 100 });
    expect(s).toMatchObject({ activeVerseId: 100, source: "hover" });
  });

  test("LEAVE clears a hover-sourced active verse", () => {
    const hovered = { ...initialFaxVerseState, activeVerseId: 100, source: "hover" };
    expect(faxVerseReducer(hovered, { type: "LEAVE" }))
      .toMatchObject({ activeVerseId: null, source: null });
  });

  test("LEAVE does not clear a non-hover source (forward-compat with pin)", () => {
    const pinned = { ...initialFaxVerseState, activeVerseId: 100, source: "pinned" };
    expect(faxVerseReducer(pinned, { type: "LEAVE" })).toBe(pinned);
  });

  test("OPEN stores the opened verse; CLOSE clears it", () => {
    const opened = faxVerseReducer(initialFaxVerseState, { type: "OPEN", verse });
    expect(opened.openVerse).toBe(verse);
    expect(faxVerseReducer(opened, { type: "CLOSE" }).openVerse).toBeNull();
  });

  test("RESET returns the initial state", () => {
    const dirty = { activeVerseId: 100, source: "hover", openVerse: verse };
    expect(faxVerseReducer(dirty, { type: "RESET" })).toEqual(initialFaxVerseState);
  });

  test("unknown action is a no-op", () => {
    expect(faxVerseReducer(initialFaxVerseState, { type: "NOPE" })).toBe(initialFaxVerseState);
  });
});
