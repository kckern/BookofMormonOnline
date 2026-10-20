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
  default: (props) => { globalThis.__excerptProps = props; return null; },
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

  // H3 + R3 B2: the excerpt starts at the anchor verse -1 and carries enough
  // verses to FILL its fixed box (the box clips with a fade; See in context
  // has the rest), so a short excerpt never leaves the box half empty.
  test("excerpt is focused around the title anchor with enough verses to fill the box", () => {
    renderTile();
    expect(globalThis.__excerptProps).toMatchObject({ refText: "Alma 17:7", highlight: "Zarahemla is Rebuilt", refAsPopup: true });
    expect(globalThis.__excerptProps.focusVerses).toBeGreaterThanOrEqual(5);
  });

  // A3: the art tile speaks the Home header grammar — an uppercase eyebrow
  // (outside the title+image link), then the title in the heading tier.
  test("carries the shared tileHeading eyebrow outside the artwork link", () => {
    const { container } = renderTile();
    const h = container.querySelector("h3.tileHeading");
    expect(h).not.toBeNull();
    expect(h.textContent).toMatch(/art/i);
    expect(h.closest("a")).toBeNull();
    expect(h.compareDocumentPosition(container.querySelector(".imageArtLink")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    expect(css).toMatch(/\.imageArtScripture \.samplerScriptureLoading\.isLoading\s*\{[^}]*height/);
    expect(css).toMatch(/html\[data-theme="dark"\] \.imageArtScripture[^{]*\{[^}]*background:\s*transparent/);
  });

  // art-G3: the link's name is the title, not "Title© Artist" (the badge is
  // visual credit; the alt is empty because the title names the link).
  // R4 H6: …but the credit is not hidden from AT: it is the link's description.
  test("the artwork link is named by the title; the © credit is its description", () => {
    const { container } = renderTile();
    const link = screen.getByRole("link", { name: "Zarahemla is Rebuilt" });
    const badge = container.querySelector(".imageArtArtistBadge");
    expect(badge.getAttribute("aria-hidden")).toBeNull();
    expect(link.getAttribute("aria-describedby")).toBe(badge.id);
    expect(badge.textContent).toMatch(/Jane Painter/);
  });

  // R3 B2/B1/E1: the 18rem placeholder collapsed to the real excerpt (99-564px)
  // on screen and churned on every Back. The excerpt is now a FIXED box —
  // placeholder and resolved excerpt alike — that clips (no focus-scroll) with
  // a fade, so the tile's height is known from the payload at first paint.
  test("the excerpt is a fixed-height clipped box the placeholder fills exactly", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");
    const box = css.match(/\.imageArtScripture\.read-content \{[^}]*\}/)[0];
    expect(box).toMatch(/height:\s*var\(--art-excerpt-h\)/);
    expect(box).toMatch(/overflow:\s*clip/);
    expect(box).toMatch(/mask-image:/);
    expect(css).toMatch(/--art-excerpt-h:\s*[\d.]+rem/);
    expect(css).toMatch(/\.imageArtScripture \.samplerScriptureLoading\.isLoading\s*\{[^}]*height:\s*100%/);
    expect(css).not.toMatch(/\.imageArtScripture \.samplerScriptureLoading\.isLoading\s*\{[^}]*min-height:\s*18rem/);
  });
});
