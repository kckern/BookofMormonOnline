/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ArchiveDocTile from "../ArchiveDocTile";

const base = { slug: "d1", year: 1830, source: "Wayne Sentinel", document: "A Notice", citation: "Cite.", teaser: "<p>Lead here.</p> key points: <ul><li>x</li></ul>" };
const setup = (props) => render(<MemoryRouter><ArchiveDocTile heading="H" to="/x" {...props} /></MemoryRouter>);

describe("ArchiveDocTile", () => {
  test("returns null when there is no data (but renders an id-less doc)", () => {
    const { container } = setup({ data: null });
    expect(container).toBeEmptyDOMElement();
    setup({ data: { ...base, mini_quote: "a bare quote" }, image: null }); // no id
    expect(screen.getByText(/a bare quote/)).toBeInTheDocument();
  });

  test("leads with the mini quote and shows the document title", () => {
    setup({ data: { ...base, mini_quote: "I saw the plates", money_quote: "long form" }, image: null });
    expect(screen.getByText(/I saw the plates/)).toBeInTheDocument();
    expect(screen.getByText("A Notice")).toBeInTheDocument();
  });

  test("renders the image when a URL is given", () => {
    const { container } = setup({ data: { ...base, id: 7 }, image: "https://ex/img.jpg" });
    const img = container.querySelector("img.historyTileThumb");
    expect(img).toHaveAttribute("src", "https://ex/img.jpg");
  });

  test("renders NO image when image is null (translation case)", () => {
    const { container } = setup({ data: { ...base, id: 7 }, image: null });
    expect(container.querySelector("img.historyTileThumb")).toBeNull();
  });
});
