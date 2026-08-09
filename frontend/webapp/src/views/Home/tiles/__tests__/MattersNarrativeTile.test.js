import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MattersNarrativeTile from "../MattersNarrativeTile";

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

test("renders an artifact card that links to the matter popup route", () => {
  const data = [
    { slug: "plates-of-brass", name: "Plates of Brass", subtitle: "Brass plates kept by Laban",
      index: [{ ref: "1 Nephi 3:3", slug: "1-nephi/3", text: "the record of the Jews" }] },
  ];
  renderIn(<MattersNarrativeTile data={data} seed={0} payload={{ mattersNarrativeCount: 161 }} />);
  const link = screen.getByRole("link", { name: /Plates of Brass/ });
  expect(link.getAttribute("href")).toBe("/matters/plates-of-brass");
  expect(screen.getByText("1 Nephi 3:3")).toBeInTheDocument();
});

test("does not crash on empty data", () => {
  expect(() => renderIn(<MattersNarrativeTile data={[]} payload={{}} />)).not.toThrow();
});
