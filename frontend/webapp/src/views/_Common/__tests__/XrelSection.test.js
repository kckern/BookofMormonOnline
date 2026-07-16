/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import XrelSection from "../XrelSection";

const mockSetPopUp = jest.fn();
jest.mock("src/contexts/AppControllerContext", () => ({
  useAppController: () => ({ functions: { setPopUp: (...args) => mockSetPopUp(...args) } }),
}));

jest.mock("src/models/Utils", () => ({
  label: (key) => key,
}));

const srcRow = {
  rel: "held-by",
  dst_type: "people",
  dst_slug: "nephi",
  dst_name: "Nephi",
  dst_title: "Son of Lehi",
  note: null,
  direction: "src",
};
const dstRow = {
  rel: "taught-by",
  dst_type: "object",
  dst_slug: "synagogues",
  dst_name: "Synagogues",
  dst_title: null,
  note: "Taught boldly (Alma 21:4)",
  direction: "dst",
};

describe("XrelSection", () => {
  beforeEach(() => mockSetPopUp.mockClear());

  test("renders nothing when empty and showEmpty is off", () => {
    const { container } = render(<XrelSection xrels={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("renders the empty message when showEmpty is set", () => {
    render(<XrelSection xrels={[]} showEmpty />);
    expect(screen.getByText("no_relationships")).toBeInTheDocument();
  });

  test("src rows read verb-then-name; dst rows read name-then-verb", () => {
    const { container } = render(<XrelSection xrels={[srcRow, dstRow]} />);
    const [first, second] = container.querySelectorAll("li.xrel");
    expect(first.textContent.indexOf("held-by")).toBeLessThan(first.textContent.indexOf("Nephi"));
    expect(second.textContent.indexOf("Synagogues")).toBeLessThan(second.textContent.indexOf("taught-by"));
    expect(second.classList.contains("reverse")).toBe(true);
  });

  test("notes render beneath the row", () => {
    render(<XrelSection xrels={[dstRow]} />);
    expect(screen.getByText(/Taught boldly/)).toBeInTheDocument();
  });

  test("clicking a row opens the destination popup by type", () => {
    render(<XrelSection xrels={[srcRow, dstRow]} />);
    fireEvent.click(screen.getByText("Nephi"));
    expect(mockSetPopUp).toHaveBeenCalledWith({ type: "people", ids: ["nephi"], underSlug: "people" });
    fireEvent.click(screen.getByText("Synagogues"));
    expect(mockSetPopUp).toHaveBeenCalledWith({ type: "object", ids: ["synagogues"], underSlug: "objects" });
  });

  test("group rows are not clickable", () => {
    render(<XrelSection xrels={[{ ...srcRow, dst_type: "group", dst_name: "Nephites" }]} />);
    fireEvent.click(screen.getByText("Nephites"));
    expect(mockSetPopUp).not.toHaveBeenCalled();
  });

  test("noHeading suppresses the section heading", () => {
    render(<XrelSection xrels={[srcRow]} noHeading />);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
