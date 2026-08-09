import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MattersConceptTile from "../MattersConceptTile";

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

test("renders a text-forward concept card linking to the matter", () => {
  const data = [
    { slug: "judgment-seat", name: "Judgment Seat", subtitle: "Civic seat of Nephite judges",
      description: "The people established a reign of judges over the land." },
  ];
  renderIn(<MattersConceptTile data={data} seed={0} payload={{ mattersConceptCount: 123 }} />);
  const link = screen.getByRole("link", { name: /Judgment Seat/ });
  expect(link.getAttribute("href")).toBe("/matters/judgment-seat");
  expect(screen.getByText(/reign of judges/)).toBeInTheDocument();
});

test("does not crash on empty data", () => {
  expect(() => renderIn(<MattersConceptTile data={[]} payload={{}} />)).not.toThrow();
});
