import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import Bible from "../index";

jest.mock("src/models/Utils", () => ({
  label: (key) => key,
  determineLanguage: () => "en",
}));

const at = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Route path="/analysis/:value*">
        <Bible />
      </Route>
    </MemoryRouter>
  );

describe("controller", () => {
  test("overview at /analysis/bible", () => {
    at("/analysis/bible");
    expect(screen.getByTestId("xref-overview")).toBeInTheDocument();
  });
  test("anchor at /analysis/bible/bom/2-nephi", () => {
    at("/analysis/bible/bom/2-nephi");
    expect(screen.getByTestId("xref-anchor")).toBeInTheDocument();
    expect(document.title).toMatch(/2 Nephi/);
  });
  test("reader at /analysis/bible/bom/2-nephi~isaiah", () => {
    at("/analysis/bible/bom/2-nephi~isaiah");
    expect(screen.getByTestId("xref-reader")).toBeInTheDocument();
  });
  test("garbage URL falls back to overview", () => {
    at("/analysis/bible/plates-of-mormon~torah");
    expect(screen.getByTestId("xref-overview")).toBeInTheDocument();
  });
});
