/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ArchiveDocTile from "../ArchiveDocTile";
import TranslationTile from "../TranslationTile";
import JosephSmithTile from "../JosephSmithTile";

vi.mock("src/models/BoMOnlineAPI", () => ({
  assetUrl: "https://media.test",
}));

const base = { slug: "d1", year: 1830, source: "Wayne Sentinel", document: "A Notice", citation: "Cite.", teaser: "<p>Lead here.</p> key points: <ul><li>x</li></ul>" };
const setup = (props) => render(<MemoryRouter><ArchiveDocTile heading="H" to="/x" {...props} /></MemoryRouter>);

describe("ArchiveDocTile", () => {
  test("returns null when there is no data (but renders an id-less doc)", () => {
    const { container } = setup({ data: null });
    expect(container).toBeEmptyDOMElement();
    setup({ data: { ...base, mini_quote: "a bare quote" }, images: [] }); // no id
    expect(screen.getByText(/a bare quote/)).toBeInTheDocument();
  });

  test("shows the FULL money quote with the mini-quote excerpt highlighted", () => {
    const { container } = setup({
      data: { ...base, money_quote: "I truly saw the plates myself", mini_quote: "saw the plates" },
      images: [],
    });
    // the whole money quote is present, not just the mini excerpt
    expect(container.querySelector(".historyTileQuote").textContent).toMatch(/I truly saw the plates myself/);
    // and the mini excerpt is the highlighted span
    expect(container.querySelector(".historyTileQuote .miniHighlight")).toHaveTextContent("saw the plates");
    expect(screen.getByText("A Notice")).toBeInTheDocument();
  });

  test("falls back to a bare mini quote when there is no money quote", () => {
    setup({ data: { ...base, mini_quote: "a bare quote" }, images: [] });
    expect(screen.getByText(/a bare quote/)).toBeInTheDocument();
  });

  test("renders a single thumbnail (natural aspect, not a multi rail)", () => {
    const { container } = setup({ data: { ...base, id: 7 }, images: ["https://ex/img.jpg"] });
    const rail = container.querySelector(".historyTileRail");
    expect(rail).toBeTruthy();
    expect(rail.className).not.toMatch(/multi/);
    expect(container.querySelectorAll("img.historyTileThumb")).toHaveLength(1);
    expect(container.querySelector("img.historyTileThumb")).toHaveAttribute("src", "https://ex/img.jpg");
  });

  test("fills a multi-page rail with every supplied thumbnail", () => {
    const imgs = ["https://ex/1.jpg", "https://ex/2.jpg", "https://ex/3.jpg"];
    const { container } = setup({ data: { ...base, id: 7 }, images: imgs });
    expect(container.querySelector(".historyTileRail.multi")).toBeTruthy();
    expect([...container.querySelectorAll("img.historyTileThumb")].map((i) => i.getAttribute("src"))).toEqual(imgs);
  });

  test("renders NO rail when images is empty (translation case)", () => {
    const { container } = setup({ data: { ...base, id: 7 }, images: [] });
    expect(container.querySelector(".historyTileRail")).toBeNull();
    expect(container.querySelector("img.historyTileThumb")).toBeNull();
  });

  test("does not render the archive chip", () => {
    const { container } = setup({ data: { ...base, archive: "reception" }, images: [] });
    expect(container.querySelector(".historyTileArchive")).toBeNull();
  });
});

describe("archive tile wrappers", () => {
  const doc = { slug: "d1", document: "A Doc", mini_quote: "a quote", citation: "C." };
  const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

  test("TranslationTile: localized heading, NO image, links to the document itself", () => {
    const { container } = wrap(<TranslationTile data={{ ...doc, id: 9 }} />);
    expect(screen.getByText(/a quote/)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".tileHeading")).toHaveTextContent("Translation");
    expect(container.querySelector(".tileHeading a")).toHaveAttribute("href", "/history/translation");
    expect(container.querySelector("a.tileMoreLink")).toHaveAttribute("href", "/history/d1");
  });

  test("JosephSmithTile renders the witness-style portrait, name and quote", () => {
    const { container } = wrap(<JosephSmithTile data={doc} />); // no id
    expect(screen.getByText(/a quote/)).toBeInTheDocument();
    expect(container.querySelector(".witnessName")).toHaveTextContent("Joseph Smith");
    const img = container.querySelector(".witnessHero img");
    expect(img).toHaveClass("tileImage");
    expect(img.getAttribute("src")).toMatch(/joseph-smith\.jpg$/);
    expect(img.getAttribute("alt")).toBe("");
  });

  test("JosephSmithTile: heading → the statements page; CTA → the featured document; portrait is not a 2nd tab stop", () => {
    const { container } = wrap(<JosephSmithTile data={doc} />);
    expect(container.querySelector(".tileHeading a")).toHaveAttribute("href", "/history/joseph-smith");
    const cta = container.querySelector("a.tileMoreLink");
    expect(cta).toHaveAttribute("href", "/history/d1");
    expect(cta).toHaveTextContent("See in context");
    const portrait = container.querySelector("a.witnessLeft");
    expect(portrait).toHaveAttribute("tabindex", "-1");
  });

  test("JosephSmithTile: speaker prefix is a meta line outside the clamp; quote clamps via ExpandableText", () => {
    const { container } = wrap(<JosephSmithTile data={{ ...doc, money_quote: "Long words here", quote_speaker: "Wilford Woodruff", quote_is_witness_voice: false }} />);
    const sp = container.querySelector(".witnessSpeaker");
    expect(sp).toHaveTextContent("Wilford Woodruff");
    expect(sp.closest(".witnessStatementWrap")).toBeNull();
    expect(container.querySelector(".witnessStatementWrap .witnessStatement")).toHaveTextContent("Long words here");
  });

  test("JosephSmithTile minimal payload: no undefined", () => {
    const { container } = wrap(<JosephSmithTile data={{ slug: "x" }} />);
    expect(container.textContent).not.toMatch(/undefined|NaN/);
  });
});
