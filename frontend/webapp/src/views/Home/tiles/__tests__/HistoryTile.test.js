import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import HistoryTile, { parseTeaser } from "../HistoryTile";

describe("parseTeaser", () => {
  test("extracts the lead paragraph before 'Key Points:' and the <li> bullets after", () => {
    const html =
      "<p>An intro lead sentence.</p> Key Points: <ul><li>First point</li><li>Second point</li></ul>";
    const { lead, bullets } = parseTeaser(html);
    expect(lead).toContain("An intro lead sentence");
    expect(bullets).toEqual(["First point", "Second point"]);
  });

  test("caps bullets at four", () => {
    const html =
      "Lead. Key points: <ul>" +
      "<li>a</li><li>b</li><li>c</li><li>d</li><li>e</li>" +
      "</ul>";
    expect(parseTeaser(html).bullets).toEqual(["a", "b", "c", "d"]);
  });

  test("returns empty bullets and the whole text as lead when there is no list", () => {
    const { lead, bullets } = parseTeaser("Just a plain teaser with no bullets.");
    expect(bullets).toEqual([]);
    expect(lead).toContain("Just a plain teaser");
  });

  test("tolerates empty/nullish input", () => {
    expect(parseTeaser("")).toEqual({ lead: "", bullets: [] });
    expect(parseTeaser(undefined)).toEqual({ lead: "", bullets: [] });
  });
});

const setup = (data) => render(<MemoryRouter><HistoryTile data={data} /></MemoryRouter>);
const base = { id: 7, slug: "d7", document: "A Notice", teaser: "<p>Long teaser lead here.</p> key points: <ul><li>x</li></ul>" };

describe("HistoryTile quote hero", () => {
  test("shows the full money quote with the mini excerpt highlighted", () => {
    const { container } = setup({ ...base, mini_quote: "saw the plates", money_quote: "I saw the plates and the engravings by the power of God", quote_speaker: "Martin Harris", quote_is_witness_voice: true });
    // the whole money quote is present, not just the mini excerpt
    expect(container.querySelector(".historyTileQuote").textContent).toMatch(/by the power of God/);
    expect(container.querySelector(".historyTileQuote .miniHighlight")).toHaveTextContent("saw the plates");
    expect(screen.getByText(/—\s*Martin Harris/)).toBeInTheDocument();
  });

  test("shows the full money quote when there is no mini", () => {
    const { container } = setup({ ...base, money_quote: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen", quote_speaker: "The Editor", quote_is_witness_voice: false });
    expect(screen.getByText(/The Editor:/)).toBeInTheDocument();
    expect(container.querySelector(".historyTileQuote").textContent).toMatch(/sixteen/);
    expect(container.querySelector(".historyTileQuote .miniHighlight")).toBeNull();
  });

  test("a bare quote (no speaker) renders without attribution", () => {
    const { container } = setup({ ...base, mini_quote: "spoken of as the Golden Bible", quote_speaker: null });
    expect(screen.getByText(/spoken of as the Golden Bible/)).toBeInTheDocument();
    expect(container.querySelector(".historyTileQuoteBy")).toBeNull();
  });

  test("falls back to the teaser lead when there is no quote at all", () => {
    const { container } = setup(base);
    expect(container.querySelector(".historyTileQuote")).toBeNull();
    expect(container.querySelector(".historyTileTeaser")).toBeInTheDocument();
  });
});

vi.mock("src/models/BoMOnlineAPI", () => ({ __esModule: true, default: vi.fn(), assetUrl: "https://media.test" }));

describe("HistoryTile frame + links", () => {
  test("the eyebrow links to the History index, like every sibling archive tile", () => {
    const { container } = setup({ ...base, mini_quote: "q" });
    expect(container.querySelector(".tileHeading a")).toHaveAttribute("href", "/history");
  });

  test("one tab stop to the document: title and rail are mouse shortcuts, the CTA is the stop", () => {
    const { container } = setup({ ...base, mini_quote: "q" });
    const toDoc = [...container.querySelectorAll("a[href='/history/d7']")];
    expect(toDoc.length).toBeGreaterThan(1);
    expect(toDoc.filter((a) => a.getAttribute("tabindex") !== "-1")).toHaveLength(1);
    expect(container.querySelector("a.historyTileRail")).toHaveAttribute("aria-hidden", "true");
  });

  test("thumbnails go through TileImage (relative media paths, no variant srcset)", () => {
    const { container } = setup({ ...base, mini_quote: "q" });
    const img = container.querySelector("img.historyTileThumb");
    expect(img).toHaveClass("tileImage");
    expect(img.getAttribute("src")).toBe("https://media.test/history/thumbs/0007");
    expect(img.hasAttribute("srcset")).toBe(false);
  });

  test("minimal payload: no undefined, no image without an id", () => {
    const { container } = setup({ slug: "z" });
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("archive dark-mode imagery (Sampler.css)", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");
  test("tile images are dimmed in dark mode", () => {
    expect(css).toMatch(/html\[data-theme="dark"\] \.tile img\.tileImage\s*{\s*filter:\s*brightness/);
  });
  test("white facsimile scans (covers, crops) are dimmed further and the verse excerpt has no slab (fax-L3, faxVerse-L3)", () => {
    expect(css).toMatch(/html\[data-theme="dark"\] \.faxTileEdition img\.tileImage,\s*html\[data-theme="dark"\] \.faxVerseTile img\.faxEditionCrop\s*{\s*filter:\s*brightness\(\.7\)/);
    expect(css).toMatch(/html\[data-theme="dark"\] \.faxVerseTile \.read-content[^{]*{[^}]*background:\s*transparent/);
  });
});
