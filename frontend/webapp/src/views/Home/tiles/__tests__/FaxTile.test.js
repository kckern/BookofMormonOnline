/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FaxTile from "../FaxTile";
import { openScripture } from "../ScripturePopup";
import { shortEdition } from "../faxLabels";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(),
  assetUrl: "https://media.test",
}));
// label() echoes the key when the labels table lacks it → labelOr falls back.
vi.mock("src/models/Utils", () => ({ label: (k) => (k === "facsimiles" ? "Facsimiles" : k) }));
vi.mock("../ScripturePopup", () => ({ openScripture: vi.fn() }));

const data = { slug: "1883", title: "1883 Liverpool Edition", pages: 568, format: "jpg" };
const payload = {
  faxPages: [
    { page: 12, imageFile: 14, ref: "1 Nephi 3:1-7" },
    { page: 13, imageFile: 15, ref: null },
  ],
  faxMore: [
    { slug: "1830", title: "1830 Palmyra Edition" },
    { slug: "2013", title: "2013 Salt Lake City (Current) Edition" },
    { slug: null, title: "junk" },
  ],
};
const setup = (d = data, p = payload) => render(<MemoryRouter><FaxTile data={d} payload={p} /></MemoryRouter>);

describe("FaxTile", () => {
  test("no data / no slug: collapses", () => {
    expect(setup(null).container.firstChild).toBeNull();
    expect(setup({ title: "x" }).container.firstChild).toBeNull();
  });

  test("minimal payload: title + CTA only, no broken image, no undefined/NaN", () => {
    const { container } = setup({ slug: "1830", title: "1830 Palmyra Edition" }, {});
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    expect(container.querySelector(".faxTileMeta")).toBeNull();
  });

  test("the scripture ref is a native button BESIDE the page link, never inside it", () => {
    const { container } = setup();
    const pill = screen.getByRole("button", { name: "1 Nephi 3:1–7" });
    expect(pill.closest("a")).toBeNull();
    fireEvent.click(pill);
    expect(openScripture).toHaveBeenCalledWith("1 Nephi 3:1-7");
    // each page has exactly one link, into the viewer at that folio
    const pageLinks = [...container.querySelectorAll("a.faxTilePageLink")];
    expect(pageLinks.map((a) => a.getAttribute("href"))).toEqual(["/fax/1883/12", "/fax/1883/13"]);
    expect(container.querySelector("a .scripture_link")).toBeNull();
  });

  test("page images go through TileImage with a localized alt and page label", () => {
    const { container } = setup();
    const img = container.querySelector("a.faxTilePageLink img");
    expect(img).toHaveClass("tileImage");
    expect(img.getAttribute("src")).toBe("https://media.test/fax/thumb/1883/014.jpg");
    expect(img.getAttribute("alt")).toBe("1883 Liverpool Edition, page 12");
    expect(container.querySelector(".faxPageBarNum")).toHaveTextContent("p. 12");
    expect(container.querySelector(".faxTileMeta")).toHaveTextContent("568 pages");
  });

  test("edition covers: decorative img (title is the visible label), slugless entries dropped", () => {
    const { container } = setup();
    const covers = [...container.querySelectorAll("a.faxTileEdition")];
    expect(covers).toHaveLength(2);
    expect(covers[0].querySelector("img").getAttribute("alt")).toBe("");
    expect(covers[0].querySelector("img")).toHaveClass("tileImage");
    expect(covers[1]).toHaveTextContent("2013 Salt Lake City");
  });

  test("CTA uses the TileCTA verb vocabulary: Open <edition>", () => {
    setup();
    const cta = screen.getByRole("link", { name: "Open 1883 Liverpool" });
    expect(cta).toHaveClass("tileMoreLink");
    expect(cta.getAttribute("href")).toBe("/fax/1883");
  });

  test("heading and title don't add a second tab stop to the CTA's href", () => {
    const { container } = setup();
    const tabbable = [...container.querySelectorAll("a[href='/fax/1883']")].filter((a) => a.getAttribute("tabindex") !== "-1");
    expect(tabbable).toHaveLength(1);
  });
});

describe("shortEdition", () => {
  test.each([
    ["2013 Salt Lake City (Current) Edition", "2013 Salt Lake City"],
    ["1854 Liverpool 2nd Edition", "1854 Liverpool 2nd ed."],
    ["2011 The Abridging Works: The Epic and Historic Book", "2011 The Abridging Works"],
    ["1829 Printer's Manuscript", "1829 Printer's Manuscript"],
    [null, ""],
  ])("%s → %s", (t, out) => expect(shortEdition(t)).toBe(out));
});

// Blind audit fax-B1 / XC2: the pages reserved no box, so the tile grew when
// its thumbnails loaded — on cold load (CLS) and, worse, after Back (the
// restored tile came back ~370px tall, then grew to ~600px under the anchor).
describe("FaxTile reserves its page boxes", () => {
  const imgs = (c) => [...c.querySelectorAll("a.faxTilePageLink img")];
  test("before any image loads, every page has an aspect-ratio box", () => {
    const { container } = setup();
    imgs(container).forEach((img) => expect(img.style.aspectRatio).not.toBe(""));
  });
  test("a remount (Back) reserves the natural aspect learned on the first load", () => {
    const first = setup();
    imgs(first.container).forEach((img) => {
      Object.defineProperty(img, "naturalWidth", { configurable: true, value: 500 });
      Object.defineProperty(img, "naturalHeight", { configurable: true, value: 1000 });
      fireEvent.load(img);
    });
    first.unmount();
    const again = setup();
    imgs(again.container).forEach((img) => expect(img.style.aspectRatio).toBe("0.5"));
    const pages = [...again.container.querySelectorAll(".faxTilePage")];
    pages.forEach((p) => expect(p.style.flexGrow).toBe("0.5"));
  });
});
