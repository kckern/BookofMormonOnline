import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ImageArtTile from "../ImageArtTile";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
}));
vi.mock("src/views/_Common/ScriptureExcerpt", () => ({
  __esModule: true,
  default: () => null,
  readPath: (ref) => (ref ? "/read/alma-17/7" : null),
}));

const ART = { id: 1943, title: "Zarahemla is Rebuilt", artist: "Jane Painter", ref: "Alma 17:7", width: 1000, height: 600 };
const renderTile = (art = [ART], props = {}) =>
  render(
    <MemoryRouter>
      <ImageArtTile payload={{ art }} {...props} />
    </MemoryRouter>,
  );

const KEY = "REACT_APP_MEDIA_VARIANTS";

describe("ImageArtTile", () => {
  const saved = process.env[KEY];
  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  });

  test("empty payload / art without id collapse", () => {
    expect(renderTile([]).container.firstChild).toBeNull();
    expect(renderTile([{ title: "x" }]).container.firstChild).toBeNull();
  });

  test("minimal art (no title, artist or ref) renders the image without undefined", () => {
    const { container } = renderTile([{ id: 7 }]);
    expect(container.querySelector("img").getAttribute("src")).toBe("https://media.test/art/7");
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    expect(screen.queryByRole("link", { name: "See in context" })).toBeNull();
  });

  // G2: title bar and image frame were two tab stops to the same /art/:id.
  test("title + image are ONE link to /art/:id", () => {
    const { container } = renderTile();
    const links = container.querySelectorAll('a[href="/art/1943"]');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toContain("Zarahemla is Rebuilt");
    expect(links[0].querySelector("img")).not.toBeNull();
  });

  // H6: the artist is credited on the tile.
  test("credits the artist", () => {
    renderTile();
    expect(screen.getByText(/Jane Painter/)).toBeTruthy();
  });

  test("CTA uses the 'See in context' verb into Read", () => {
    renderTile();
    expect(screen.getByRole("link", { name: "See in context" }).getAttribute("href")).toBe("/read/alma-17/7");
  });

  // M2: a failed image left a blank beige frame with a © badge.
  test("a failed image collapses the whole tile", () => {
    const { container } = renderTile();
    fireEvent.error(container.querySelector("img"));
    expect(container.firstChild).toBeNull();
  });

  // J1: art has no uploaded variants — never request a srcset that 404s.
  test("uses TileImage with no variant srcset even when variants are on", () => {
    process.env[KEY] = "1";
    const { container } = renderTile();
    const img = container.querySelector("img");
    expect(img.classList.contains("tileImage")).toBe(true);
    expect(img.hasAttribute("srcset")).toBe(false);
  });

  test("Sampler.css: no doubled title in the excerpt, reserved excerpt height, transparent dark inset", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");
    expect(css).toMatch(/\.imageArtScripture \.read-section-header h4\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.imageArtScripture \.samplerScriptureLoading\.isLoading\s*\{[^}]*min-height/);
    expect(css).toMatch(/html\[data-theme="dark"\] \.imageArtScripture[^{]*\{[^}]*background:\s*transparent/);
  });
});
