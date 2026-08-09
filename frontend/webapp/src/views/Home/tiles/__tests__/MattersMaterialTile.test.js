import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MattersMaterialTile from "../MattersMaterialTile";

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

test("renders a places-style card with a seeded index ref, links to the matter", () => {
  const data = [
    {
      slug: "swords",
      name: "Swords",
      subtitle: "War blade of Nephite armies",
      nrefs: 118,
      index: [{ ref: "Alma 43:18", slug: "alma/43/18", text: "Armed with swords and with cimeters." }],
    },
  ];
  renderIn(<MattersMaterialTile data={data} seed={0} payload={{ mattersMaterialCount: 192 }} />);
  const link = screen.getByRole("link", { name: /Swords/ });
  expect(link.getAttribute("href")).toBe("/matters/swords");
  // seeded index ref renders as the shared scripture-link pill
  expect(screen.getByText(/Alma 43:18/)).toBeInTheDocument();
});

test("does not crash on empty data", () => {
  expect(() => renderIn(<MattersMaterialTile data={[]} payload={{}} />)).not.toThrow();
});
