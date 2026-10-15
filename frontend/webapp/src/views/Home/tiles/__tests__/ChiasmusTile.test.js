import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import ChiasmusTile, { speakerLabel, displayable } from "../ChiasmusTile";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(),
  assetUrl: "https://media.test",
}));
vi.mock("../ScripturePopup", () => ({ openScripture: vi.fn() }));

const CHIASM = {
  chiasmus_id: "abc123",
  scheme: "ABCCBA",
  title: "Law and Heart",
  reference: "Alma 31:16-23",
  speaker: { name: "Alma2", person_slug: "alma2" },
  lines: ["A", "B", "C", "C", "B", "A"].map((k, i) => ({ line_key: k, line_text: `line ${i} _word_` })),
};

const api = (chiasm = CHIASM, list = { abc123: { chiasmus_id: "abc123", scheme: "ABCCBA" } }) =>
  BoMOnlineAPI.mockImplementation(async (q) =>
    q.chiasmus ? { chiasmus: list } : { chiasm: chiasm ? { [chiasm.chiasmus_id]: chiasm } : {} },
  );

const renderTile = () =>
  render(
    <MemoryRouter>
      <ChiasmusTile seed={1} />
    </MemoryRouter>,
  );

describe("ChiasmusTile", () => {
  beforeEach(() => vi.clearAllMocks());

  test("shows a sized skeleton while loading (no 2px pop-in)", () => {
    BoMOnlineAPI.mockImplementation(() => new Promise(() => {}));
    const { container } = renderTile();
    const inner = container.querySelector(".chiasmusTile");
    expect(inner.getAttribute("aria-busy")).toBe("true");
    expect(inner.style.minHeight).toMatch(/px|rem/);
  });

  test("collapses when no chiasm is displayable", async () => {
    api(CHIASM, {});
    const { container } = renderTile();
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  test("collapses when the fetch fails", async () => {
    BoMOnlineAPI.mockRejectedValue(new Error("network"));
    const { container } = renderTile();
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  test("minimal chiasm (no speaker, no title) renders without undefined", async () => {
    api({ ...CHIASM, speaker: null, title: null });
    const { container } = renderTile();
    await screen.findByRole("link", { name: "See in context" });
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    expect(container.querySelector(".chiasmusTileSpeaker")).toBeNull();
  });

  test("speaker face + name are ONE link to the person page; the ref pill sits outside it", async () => {
    api();
    const { container } = renderTile();
    const link = await screen.findByRole("link", { name: /Alma²/ });
    expect(link.getAttribute("href")).toBe("/people/alma2");
    expect(link.querySelector("img.tileImage")).not.toBeNull();
    expect(container.querySelectorAll('a[href="/people/alma2"]')).toHaveLength(1);
    expect(container.querySelector("a .scripture_link")).toBeNull();
    expect(screen.getByRole("button", { name: /Alma 31:16/ })).toBeTruthy();
  });

  test("CTA verb 'See in context' into the matching chiasm panel; heading → index", async () => {
    api();
    const { container } = renderTile();
    const cta = await screen.findByRole("link", { name: "See in context" });
    expect(cta.getAttribute("href")).toBe("/analysis/chiasmus/abc123");
    expect(container.querySelector(".tileHeading a").getAttribute("href")).toBe("/analysis/chiasmus");
  });

  test("displayable: mirrored 6–12 line schemes that fit the tile (≤ 600 chars)", () => {
    expect(displayable({ scheme: "ABCCBA", line_lengths: [80, 80, 80, 80, 80, 80] })).toBe(true);
    expect(displayable({ scheme: "ABCCBA", line_lengths: [200, 200, 200, 200, 200, 200] })).toBe(false);
    expect(displayable({ scheme: "ABBA" })).toBe(false);
    expect(displayable({ scheme: "AbCCbA" })).toBe(false);
  });

  test("speakerLabel keeps the disambiguator as a superscript", () => {
    expect(speakerLabel("Alma2")).toBe("Alma²");
    expect(speakerLabel("Nephi")).toBe("Nephi");
    expect(speakerLabel(null)).toBeNull();
  });

  // A4/L3: the chiasm key letters were --link (#cfcfcf, 1.6:1; #a8c7fa blue in
  // dark). The tile must color them with the meta token instead.
  test("Sampler.css gives the tile's chiasm keys the meta token and readable line-height", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");
    expect(css).toMatch(/\.chiasmusTile \.miniChiasmKey\s*\{[^}]*color:\s*var\(--tile-meta\)/);
    expect(css).toMatch(/\.chiasmusTile \.miniChiasmText\s*\{[^}]*line-height:\s*1\.3/);
  });
});
