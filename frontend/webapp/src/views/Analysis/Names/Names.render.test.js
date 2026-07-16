import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Names from "./Names";

jest.mock("src/models/Utils", () => ({ label: (k) => k }));

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Names />
    </MemoryRouter>
  );

it("renders the grid and the facet controls", () => {
  renderAt("/analysis/names");
  expect(screen.getByText("Moroni")).toBeInTheDocument();
  expect(screen.getByText(/210 names/)).toBeInTheDocument();
});

it("applies filters from the querystring on load", () => {
  renderAt("/analysis/names?stem=Mor");
  expect(screen.getByText(/9 of 210 names/)).toBeInTheDocument();
  expect(screen.getByText("Moroni")).toBeInTheDocument();
  expect(screen.queryByText("Shiz")).not.toBeInTheDocument();
});
