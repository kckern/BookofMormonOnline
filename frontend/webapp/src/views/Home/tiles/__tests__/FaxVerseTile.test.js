import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FaxVerseTile from "../FaxVerseTile";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
  renderBaseUrl: "http://localhost:5006",
}));
jest.mock("src/views/_Common/ScriptureExcerpt", () => ({
  __esModule: true,
  default: () => null,
}));

const data = {
  version: "1830",
  title: "1830 Edition",
  format: "jpg",
  page: 117,
  verseId: 15234,
  ref: "Mosiah 2:17",
  selector: "mosiah-2.17",
  editions: [
    { version: "1830", title: "1830 Edition", page: 117 },
    { version: "1837", title: "1837 Edition", page: 120 },
    { version: "2013", title: "2013 Edition", page: 250 },
  ],
};

const renderTile = (d) =>
  render(
    <MemoryRouter>
      <FaxVerseTile data={d} />
    </MemoryRouter>
  );

describe("FaxVerseTile", () => {
  test("renders one cropped image per edition with render URL + per-edition deep link", () => {
    renderTile(data);
    const img = screen.getByAltText("1830 Edition Mosiah 2:17");
    expect(img.getAttribute("src")).toBe(
      "http://localhost:5006/fax/render/1830/crop/w800/mosiah-2.17.jpg"
    );
    expect(img.closest("a").getAttribute("href")).toBe("/fax/1830/mosiah.2.17");
    // one cropped image per edition (each row also carries an edition tab img)
    expect(document.querySelectorAll(".faxEditionCrop").length).toBe(3);
  });

  test("falls back to a single row from legacy fields when editions is absent", () => {
    const legacy = { ...data, editions: undefined };
    renderTile(legacy);
    expect(document.querySelectorAll(".faxEditionCrop").length).toBe(1);
  });

  test("returns null without data", () => {
    const { container } = renderTile(null);
    expect(container.firstChild).toBeNull();
  });

  test("returns null when selector is absent", () => {
    const noSelector = { ...data, selector: undefined };
    const { container } = renderTile(noSelector);
    expect(container.firstChild).toBeNull();
  });

  test("onError hides the failing edition row", () => {
    renderTile(data);
    const img = screen.getByAltText("1830 Edition Mosiah 2:17");
    const row = img.closest("a");
    fireEvent.error(img);
    expect(row.style.display).toBe("none");
  });
});
