import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotesTile, { NOTES_EXCERPT_VERSES, isVariantNote } from "../NotesTile";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
vi.mock("src/views/_Common/ScriptureExcerpt", () => ({
  __esModule: true,
  default: (props) => { globalThis.__notesExcerpt = props; return null; },
  readPath: (ref) => (ref ? `/read/${ref}` : null),
}));

const renderTile = (data) => render(<MemoryRouter><NotesTile data={data} /></MemoryRouter>);
const box = (c) => c.querySelector(".notesExcerpt");

describe("NotesTile verse window + fixed box (notes-A1, notes-B2)", () => {
  test("a long-range note is windowed, not rendered whole", () => {
    renderTile([{ id: "a", title: null, text: "On faith, hope and charity.", reference: "Moroni 7:20-39", publication: {} }]);
    expect(globalThis.__notesExcerpt.focusVerses).toBe(NOTES_EXCERPT_VERSES);
    expect(NOTES_EXCERPT_VERSES).toBeLessThanOrEqual(4);
  });

  test("an anchored note leads with the annotated verse", () => {
    renderTile([{ id: "a", title: "“peace to my soul”", text: "A gloss.", reference: "Alma 38:7-8", publication: {} }]);
    expect(globalThis.__notesExcerpt.focusLead).toBe(0);
  });

  test("the excerpt box is sized from the verse count at mount (no growth when verses land)", () => {
    const { container, unmount } = renderTile([{ id: "a", title: null, text: "x note", reference: "Mosiah 24:23", publication: {} }]);
    expect(box(container).dataset.verses).toBe("1");
    unmount();
    const r2 = renderTile([{ id: "b", title: null, text: "y note", reference: "Moroni 7:20-39", publication: {} }]);
    expect(box(r2.container).dataset.verses).toBe(String(NOTES_EXCERPT_VERSES));
  });
});

describe("NotesTile skips sigla-only textual-variant notes (notes-H1)", () => {
  test("isVariantNote", () => {
    expect(isVariantNote("\u{1D4AA}, \u{1D4AB}was as eternal")).toBe(true);
    expect(isVariantNote("ATV raise up one unto or raise up a seer unto")).toBe(true);
    expect(isVariantNote("Alma gave the same admonition to Helaman.")).toBe(false);
  });
  test("prefers a readable note over a variant note", () => {
    const { container } = renderTile([
      { id: "v", title: "“which also was eternal”", text: "\u{1D4AA}, \u{1D4AB}was as eternal", reference: "Alma 1:1", publication: {} },
      { id: "r", title: null, text: "Fulfilled at Mosiah 19:13-15.", reference: "Mosiah 12:3", publication: {} },
    ]);
    expect(container.textContent).toMatch(/Fulfilled at/);
    expect(container.textContent).not.toMatch(/was as eternal/);
  });
  test("falls back to a variant note when that is all there is", () => {
    const { container } = renderTile([{ id: "v", title: null, text: "ATV raise up one unto", reference: "2 Nephi 3:6", publication: {} }]);
    expect(container.textContent).toMatch(/raise up one unto/);
  });
});

import { revealMark } from "../NotesTile";
describe("revealMark (anchor phrase stays above the fade)", () => {
  const rect = (top, bottom) => ({ top, bottom, height: bottom - top });
  const make = (markTop, markBottom) => {
    const box = document.createElement("div");
    const mark = document.createElement("mark");
    mark.className = "scriptureAnchorMark";
    box.appendChild(mark);
    box.getBoundingClientRect = () => rect(0, 168);
    mark.getBoundingClientRect = () => rect(markTop, markBottom);
    return box;
  };
  test("a mark inside the clear area leaves the box alone", () => {
    const box = make(40, 64);
    revealMark(box);
    expect(box.scrollTop).toBe(0);
    expect(box.classList.contains("isScrolled")).toBe(false);
  });
  test("a mark under the fade scrolls it up and fades the top edge", () => {
    const box = make(150, 174);
    revealMark(box);
    expect(box.scrollTop).toBeGreaterThan(0);
    expect(box.classList.contains("isScrolled")).toBe(true);
  });
});
