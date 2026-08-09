import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MattersMaterialTile from "../MattersMaterialTile";

const renderIn = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

test("renders a ref-count badge and subtitle, links to the matter", () => {
  const data = [{ slug: "swords", name: "Swords", subtitle: "War blade of Nephite armies", nrefs: 118 }];
  renderIn(<MattersMaterialTile data={data} seed={0} payload={{ mattersMaterialCount: 192 }} />);
  const link = screen.getByRole("link", { name: /Swords/ });
  expect(link.getAttribute("href")).toBe("/matters/swords");
  expect(screen.getByText("118×")).toBeInTheDocument();
  expect(screen.getByText(/War blade/)).toBeInTheDocument();
});

test("does not crash on empty data", () => {
  expect(() => renderIn(<MattersMaterialTile data={[]} payload={{}} />)).not.toThrow();
});
