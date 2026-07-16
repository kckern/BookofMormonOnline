import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import Names from "./Names";

jest.mock("src/models/Utils", () => ({ label: (k) => k }));

it("renders the grid and the six facet controls", () => {
  render(<Names />);
  expect(screen.getByText("Moroni")).toBeInTheDocument();
  expect(screen.getByText(/210 names/)).toBeInTheDocument();
});
