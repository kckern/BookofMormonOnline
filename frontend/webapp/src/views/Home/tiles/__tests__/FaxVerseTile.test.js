/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FaxVerseTile from "../FaxVerseTile";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
  renderBaseUrl: "http://localhost:5006",
}));
vi.mock("src/views/_Common/ScriptureExcerpt", () => ({
  __esModule: true,
  default: () => null,
  readPath: (ref) => (ref === "Mosiah 2:17" ? "/read/mosiah-2/17" : null),
}));

const data = {
  version: "1830",
  title: "1830 Palmyra Edition",
  format: "jpg",
  page: 117,
  verseId: 15234,
  ref: "Mosiah 2:17",
  selector: "mosiah-2.17",
  editions: [
    { version: "1830", title: "1830 Palmyra Edition", page: 117 },
    { version: "1837", title: "1837 Kirtland Edition", page: 120 },
    { version: "2013", title: "2013 Salt Lake City (Current) Edition", page: 250 },
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
    const { container } = renderTile(data);
    const crops = [...container.querySelectorAll("img.faxEditionCrop")];
    expect(crops).toHaveLength(3);
    expect(crops[0].getAttribute("src")).toBe("http://localhost:5006/fax/render/1830/crop/w800/mosiah-2.17.jpg");
    // 2x crop for high-DPR screens; the crop renders at its honest size
    expect(crops[0].getAttribute("srcset")).toContain("/crop/w1600/mosiah-2.17.jpg 2x");
    expect(crops[0].closest("a").getAttribute("href")).toBe("/fax/1830/mosiah.2.17");
    expect(crops[0]).toHaveClass("tileImage");
  });

  test("rows carry a compact edition name only: no tab graphic (404s), no look-alike ref pill", () => {
    const { container } = renderTile(data);
    expect(container.querySelector("img.faxEditionTab")).toBeNull();
    expect(container.querySelector(".faxEditionRow .scripture_link")).toBeNull();
    const titles = [...container.querySelectorAll(".faxEditionRailTitle")].map((n) => n.textContent);
    expect(titles).toEqual(["1830 Palmyra", "1837 Kirtland", "2013 Salt Lake City"]);
    // the full title stays as the hover title
    expect(container.querySelectorAll("a.faxEditionRow")[2].getAttribute("title")).toBe("2013 Salt Lake City (Current) Edition");
  });

  test("CTA: 'See in context' into Read (not a duplicate of the first row's href)", () => {
    renderTile(data);
    const cta = screen.getByRole("link", { name: "See in context" });
    expect(cta).toHaveClass("tileMoreLink");
    expect(cta.getAttribute("href")).toBe("/read/mosiah-2/17");
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

  test("minimal payload (no ref, untitled edition): no undefined, CTA falls back to the viewer", () => {
    const { container } = renderTile({ selector: "x-1.1", editions: [{ version: "1866", page: 3 }] });
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    expect(container.querySelector(".faxEditionRailTitle")).toHaveTextContent("1866");
    expect(screen.getByRole("link", { name: "See in context" }).getAttribute("href")).toBe("/fax/1866/3");
  });

  test("onError hides the failing edition row", () => {
    const { container } = renderTile(data);
    const img = container.querySelector("img.faxEditionCrop");
    const row = img.closest("a");
    fireEvent.error(img);
    expect(row.style.display).toBe("none");
  });
});
