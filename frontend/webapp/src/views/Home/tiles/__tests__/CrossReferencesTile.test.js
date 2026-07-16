import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CrossReferencesTile from "../CrossReferencesTile";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
jest.mock("src/views/_Common/ScriptureExcerpt", () => ({
  __esModule: true,
  default: () => null,
  readPath: (ref) => (ref ? `/read/${ref}` : null),
}));
jest.mock("src/views/_Common/ScripturePopup", () => ({
  __esModule: true,
  default: () => null,
  openScripture: jest.fn(),
}));
import { openScripture } from "src/views/_Common/ScripturePopup";

const data = {
  srcRef: "Alma 32:21",
  srcVerseId: 20000,
  refs: [
    { ref: "Hebrews 11:1", verseId: 30001 },
    { ref: "Ether 12:6", verseId: 30002 },
  ],
};

const renderTile = (d) =>
  render(
    <MemoryRouter>
      <CrossReferencesTile data={d} />
    </MemoryRouter>
  );

describe("CrossReferencesTile", () => {
  test("renders each cross-reference labeled by its ref", () => {
    renderTile(data);
    expect(screen.getByText("Hebrews 11:1")).toBeTruthy();
    expect(screen.getByText("Ether 12:6")).toBeTruthy();
  });

  test("clicking a cross-reference opens the scripture popup", () => {
    renderTile(data);
    fireEvent.click(screen.getByText("Hebrews 11:1"));
    expect(openScripture).toHaveBeenCalledWith("Hebrews 11:1");
  });

  test("returns null without refs", () => {
    const { container } = renderTile({ srcRef: "Alma 32:21", refs: [] });
    expect(container.firstChild).toBeNull();
  });
});
