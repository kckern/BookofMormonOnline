import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import Overview from "../Overview";
import { allPairs, divisionBookPairs, groupPairs, headline } from "../aggregate";

const setup = () => {
  const navigate = jest.fn();
  const { container } = render(<Overview navigate={navigate} />);
  return { navigate, container };
};

describe("Overview", () => {
  test("default renders 9 Bible divisions + 15 BoM books with one ribbon per division-book pair", () => {
    const { container } = setup();
    expect(container.querySelectorAll("[data-division]")).toHaveLength(9);
    expect(container.querySelectorAll("[data-book]")).toHaveLength(15);
    expect(container.querySelectorAll("[data-ribbon]")).toHaveLength(divisionBookPairs().length);
  });

  test("headline strip shows the dataset totals", () => {
    setup();
    expect(
      screen.getByText(new RegExp(headline.total.toLocaleString("en-US")))
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`${headline.quotes.toLocaleString("en-US")} direct quotes`))
    ).toBeInTheDocument();
  });

  test("clicking a BoM segment anchors it", () => {
    const { navigate } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^2 Nephi,/ }));
    expect(navigate).toHaveBeenCalledWith({ view: "anchor", canon: "bom", book: "2 Nephi" });
  });

  test("clicking a Bible division expands it into books; clicking a book anchors it", () => {
    const { navigate, container } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Major Prophets,/ }));
    // 5 Major Prophets books now present alongside the 15 BoM books
    expect(container.querySelectorAll("[data-division]")).toHaveLength(8);
    expect(container.querySelector('[data-book="Isaiah"]')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /^Isaiah, \d+ references, \d+ partner books$/ })
    );
    expect(navigate).toHaveBeenCalledWith({ view: "anchor", canon: "kjv", book: "Isaiah" });
  });

  test("expanded book-level ribbon anchors the BoM side with the partner highlighted", () => {
    const { navigate, container } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Major Prophets,/ }));
    fireEvent.click(container.querySelector('[data-ribbon="2 Nephi|Isaiah"]'));
    expect(navigate).toHaveBeenCalledWith({
      view: "anchor",
      canon: "bom",
      book: "2 Nephi",
      highlight: "Isaiah",
    });
  });

  test("division-level ribbon anchors the BoM book without a highlight", () => {
    const { navigate, container } = setup();
    fireEvent.click(container.querySelector('[data-ribbon="2 Nephi|Major Prophets"]'));
    expect(navigate).toHaveBeenCalledWith({ view: "anchor", canon: "bom", book: "2 Nephi" });
  });

  test("table twin lists every book pair and sorts by refs", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /view as table/i }));
    const rows = screen.getAllByTestId("xref-pairrow");
    expect(rows).toHaveLength(allPairs().length);
    const max = Math.max(...allPairs().map((p) => p.total));
    expect(rows[0].textContent).toContain(String(max));
  });
});

describe("aggregations", () => {
  test("division-book pairs preserve the dataset total", () => {
    expect(divisionBookPairs().reduce((a, p) => a + p.total, 0)).toBe(headline.total);
  });
  test("group pairs preserve the dataset total", () => {
    const pairs = groupPairs();
    expect(pairs.reduce((a, p) => a + p.total, 0)).toBe(headline.total);
    expect(pairs.length).toBeLessThanOrEqual(27);
  });
});
