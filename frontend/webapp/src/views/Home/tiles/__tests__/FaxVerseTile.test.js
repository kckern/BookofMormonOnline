import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FaxVerseTile from "../FaxVerseTile";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
jest.mock("src/views/_Common/ScripturePopup", () => ({
  __esModule: true,
  default: () => null,
  openScripture: jest.fn(),
}));
// ScriptureExcerpt imports BoMOnlineAPI with a .js extension — mock it directly
// so the sub-component renders nothing rather than trying a real API call.
jest.mock("src/views/_Common/ScriptureExcerpt", () => ({
  __esModule: true,
  default: () => null,
}));
import { openScripture } from "src/views/_Common/ScripturePopup";

const data = {
  version: "1830",
  title: "1830 Edition",
  format: "jpg",
  page: 117,
  verseId: 15234,
  ref: "Mosiah 2:17",
};

const renderTile = (d) =>
  render(
    <MemoryRouter>
      <FaxVerseTile data={d} />
    </MemoryRouter>
  );

describe("FaxVerseTile", () => {
  test("renders the page image with zero-padded thumb URL and deep link", () => {
    renderTile(data);
    const img = screen.getByAltText("1830 Edition p.117");
    expect(img.getAttribute("src")).toBe("https://media.test/fax/thumb/1830/117.jpg");
    expect(img.closest("a").getAttribute("href")).toBe("/fax/1830/117");
  });

  test("ref bar opens the scripture popup", () => {
    renderTile(data);
    fireEvent.click(screen.getByText("Mosiah 2:17"));
    expect(openScripture).toHaveBeenCalledWith("Mosiah 2:17");
  });

  test("returns null without a page", () => {
    const { container } = renderTile(null);
    expect(container.firstChild).toBeNull();
  });
});
