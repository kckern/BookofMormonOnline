import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MattersConceptTile from "../MattersConceptTile";

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

test("renders a places-style concept card linking to the matter", () => {
  const data = [
    {
      slug: "judgment-seat",
      name: "Judgment Seat",
      index: [{ ref: "Alma 1:1", slug: "alma/1/1", text: "The reign of the judges began over the land." }],
    },
  ];
  renderIn(<MattersConceptTile data={data} seed={0} payload={{ mattersConceptCount: 123 }} />);
  const link = screen.getByRole("link", { name: /Judgment Seat/ });
  expect(link.getAttribute("href")).toBe("/matters/judgment-seat");
  // seeded index ref renders as the shared scripture-link pill
  expect(screen.getByText(/Alma 1:1/)).toBeInTheDocument();
});

test("does not crash on empty data", () => {
  expect(() => renderIn(<MattersConceptTile data={[]} payload={{}} />)).not.toThrow();
});
