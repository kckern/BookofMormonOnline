import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HistoryBreadcrumb from "./HistoryBreadcrumb";

test("renders History and the section title", () => {
  render(
    <MemoryRouter>
      <HistoryBreadcrumb sectionKey="reception" />
    </MemoryRouter>
  );
  expect(screen.getByText("History")).toBeInTheDocument();
  expect(screen.getByText("Reception History")).toBeInTheDocument();
});
