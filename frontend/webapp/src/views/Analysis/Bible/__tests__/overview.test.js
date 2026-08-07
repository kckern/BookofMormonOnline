/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import Overview from "../Overview";
import { allPairs, divisionBookPairs, groupPairs, headline } from "../aggregate";

const setup = (props = {}) => {
  const navigate = jest.fn();
  const { container } = render(<Overview navigate={navigate} {...props} />);
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
    const { navigate, container } = setup({ state: { expanded: "Major Prophets" } });
    // 5 Major Prophets books now present alongside the 15 BoM books
    expect(container.querySelectorAll("[data-division]")).toHaveLength(8);
    expect(container.querySelector('[data-book="Isaiah"]')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /^Isaiah, \d+ references, \d+ partner books$/ })
    );
    expect(navigate).toHaveBeenCalledWith({ view: "anchor", canon: "kjv", book: "Isaiah" });
  });

  test("expanded book-level ribbon anchors the BoM side with the partner highlighted", () => {
    const { navigate, container } = setup({ state: { expanded: "Major Prophets" } });
    fireEvent.click(container.querySelector('[data-ribbon="2 Nephi|Isaiah"]'));
    expect(navigate).toHaveBeenCalledWith({
      view: "anchor",
      canon: "bom",
      book: "2 Nephi",
      highlight: "Isaiah",
    });
  });

  test("division-level ribbon anchors the BoM book carrying the division as highlight", () => {
    const { navigate, container } = setup();
    fireEvent.click(container.querySelector('[data-ribbon="2 Nephi|Major Prophets"]'));
    expect(navigate).toHaveBeenCalledWith({
      view: "anchor",
      canon: "bom",
      book: "2 Nephi",
      highlight: "Major Prophets",
    });
  });

  test("table twin lists every book pair and sorts by refs", () => {
    setup({ state: { mode: "table" } });
    const rows = screen.getAllByTestId("xref-pairrow");
    expect(rows).toHaveLength(allPairs().length);
    const max = Math.max(...allPairs().map((p) => p.total));
    expect(rows[0].textContent).toContain(String(max));
  });

  test("every spine segment on screen has a visible label (true-Sankey floor)", () => {
    render(<Overview navigate={jest.fn()} />);
    // small books were unlabeled slivers before; with ref-count weights + the
    // 14px floor, every BoM book that HAS references gets a text label
    expect(screen.getByText("Moroni")).toBeInTheDocument();
    expect(screen.getByText("Ether")).toBeInTheDocument();
    // Jarom has only 3 references (verified nonzero): a sliver under both
    // verse-weighting and ref-weighting-without-floor. The 14px floor is what
    // makes it tall enough to clear the > 9 label guard, so it exercises the fix.
    expect(screen.getByText("Jarom")).toBeInTheDocument();
  });

  test("small books stay labeled at the compressed fallback height", () => {
    render(<Overview navigate={jest.fn()} />);
    // FALLBACK_H is now 420 (was 640); the spineMinPx floor must still clear the
    // ~9px label guard so slivers like Jarom (3 refs) and Omni (9 refs) keep
    // their labels at the smaller default height.
    expect(screen.getByText("Jarom")).toBeInTheDocument();
    expect(screen.getByText("Omni")).toBeInTheDocument();
  });

  test("hovering a spine segment fills the readout line", () => {
    render(<Overview navigate={jest.fn()} />);
    const readout = screen.getByTestId("xref-readout");
    expect(readout).toHaveTextContent(/hover/i);
    fireEvent.mouseEnter(screen.getAllByRole("button", { name: /2 Nephi,/ })[0]);
    expect(readout).toHaveTextContent(/2 Nephi · \d+ references/);
  });

  test("mode and expansion round-trip through navigate, not local state", () => {
    const navigate = jest.fn();
    render(<Overview state={{ view: "overview" }} navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: /view as table/i }));
    expect(navigate).toHaveBeenCalledWith({ view: "overview", mode: "table", expanded: undefined });
    fireEvent.click(screen.getByRole("button", { name: /Major Prophets,.*expand/i }));
    expect(navigate).toHaveBeenCalledWith({ view: "overview", mode: undefined, expanded: "Major Prophets" });
  });

  test("ribbons paint largest-last so big cables win the click", () => {
    const { container } = setup();
    const ribbons = [...container.querySelectorAll("[data-ribbon]")];
    // map each rendered ribbon to its reference count via the title text
    const values = ribbons.map((g) => {
      const t = g.querySelector("title").textContent;
      return Number(t.match(/· (\d+) refs/)[1]);
    });
    // ascending: later (on-top) ribbons have >= value of earlier ones
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
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
