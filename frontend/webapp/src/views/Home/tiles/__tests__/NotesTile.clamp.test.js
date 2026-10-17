import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
vi.mock("src/views/_Common/ScriptureExcerpt", async (importOriginal) => ({
  ...(await importOriginal()),
  __esModule: true,
  default: () => null,
}));
vi.mock("../ScripturePopup", () => ({ openScripture: () => {} }));

import NotesTile from "../NotesTile";

// Blind audit r4 notes C4: a 794-char note grew the tile to 616px while the
// sibling commentary clamps with Read more. The note body is now a Layer-1
// ExpandableText (fade clamp), and See in context waits for the reveal.
describe("NotesTile long note", () => {
  let sh;
  beforeAll(() => {
    sh = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  });
  afterAll(() => {
    if (sh) Object.defineProperty(HTMLElement.prototype, "scrollHeight", sh);
    else delete HTMLElement.prototype.scrollHeight;
  });
  beforeEach(() => sessionStorage.clear());

  test("clamps the note with Read more; See in context appears after the reveal", () => {
    const { container } = render(
      <MemoryRouter>
        <NotesTile data={[{ id: "n1", text: "A long gloss. ".repeat(60), reference: "Mosiah 28:20" }]} />
      </MemoryRouter>,
    );
    expect(container.querySelector(".notesBody .clampLines.clampFade")).not.toBeNull();
    expect(screen.queryByRole("link", { name: /see in context/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    expect(screen.getByRole("link", { name: /see in context/i }).getAttribute("href")).toMatch(/mosiah/i);
  });
});

// notes F2: the excerpt box clips the section-ref chip's upward hit area.
test("touch: the excerpt's section-ref hit extends downward, not above the clipping box", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");
  expect(css).toMatch(/\.notesTile \.notesExcerpt \.read-section-header \.scripture_link::after\s*\{\s*inset:\s*-3px -4px -27px/);
});
