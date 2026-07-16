import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Names from "./Names";

jest.mock("src/models/Utils", () => ({ label: (k) => k }));
jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: () => new Promise(() => {}),
}));
jest.mock("src/contexts/AppControllerContext", () => ({
  useAppController: () => ({ functions: { setPopUp: jest.fn() } }),
}));

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

it("opens a detail panel when a tile is clicked", () => {
  const { container } = renderAt("/analysis/names");
  fireEvent.click(screen.getByText("Abinadi"));
  const region = screen.getByRole("region", { name: "Abinadi" });
  expect(region).toBeInTheDocument();
  expect(region.textContent).toContain("my father");
  fireEvent.click(container.querySelector(".nameDetailClose"));
  expect(screen.queryByRole("region", { name: "Abinadi" })).not.toBeInTheDocument();
});

it("applies filters from the querystring on load", () => {
  renderAt("/analysis/names?stem=Mor");
  expect(screen.getByText(/9 of 210 names/)).toBeInTheDocument();
  expect(screen.getByText("Moroni")).toBeInTheDocument();
  expect(screen.queryByText("Shiz")).not.toBeInTheDocument();
});
