import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import TableTwin from "../TableTwin";

describe("TableTwin", () => {
  test("filter narrows rows by either book name", () => {
    render(<TableTwin navigate={jest.fn()} />);
    const before = screen.getAllByTestId("xref-pairrow").length;
    fireEvent.change(screen.getByRole("searchbox", { name: /filter/i }), {
      target: { value: "isaiah" },
    });
    const after = screen.getAllByTestId("xref-pairrow").length;
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  test("a row link opens the reader for its pair", () => {
    const navigate = jest.fn();
    render(<TableTwin navigate={navigate} />);
    fireEvent.change(screen.getByRole("searchbox", { name: /filter/i }), {
      target: { value: "isaiah" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /open .* × .*/i })[0]);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ view: "reader", bibleBook: "Isaiah" })
    );
  });

  test("active sort column exposes aria-sort", () => {
    render(<TableTwin navigate={jest.fn()} />);
    expect(screen.getByRole("columnheader", { name: /refs/i })).toHaveAttribute(
      "aria-sort",
      "descending"
    );
  });

  test("the Bible column is a link that opens the reader", () => {
    const navigate = jest.fn();
    const { container } = render(<TableTwin navigate={navigate} />);
    const rows = container.querySelectorAll("[data-testid='xref-pairrow']").length;
    // one rowlink per cell that navigates: BoM + Bible = 2 per row
    expect(container.querySelectorAll(".xref-rowlink").length).toBe(rows * 2);
  });
});
