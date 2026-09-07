import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AnalysisBreadcrumb from "../AnalysisBreadcrumb";

test("links back to the analysis hub and names the current view", () => {
  render(<MemoryRouter><AnalysisBreadcrumb>Chiasmus</AnalysisBreadcrumb></MemoryRouter>);
  expect(screen.getByRole("link", { name: /analysis/i })).toHaveAttribute("href", "/analysis");
  expect(screen.getByText("Chiasmus")).toBeInTheDocument();
});

test("hub link uses the dictionary's menu_analysis label when loaded", () => {
  global.dictionary = { menu_analysis: "Análisis" };
  try {
    render(<MemoryRouter><AnalysisBreadcrumb>Chiasmus</AnalysisBreadcrumb></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Análisis" })).toHaveAttribute("href", "/analysis");
  } finally {
    delete global.dictionary;
  }
});
