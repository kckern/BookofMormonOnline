import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import PartnerBars from "../PartnerBars";
import { partnersFor } from "../aggregate";

describe("PartnerBars", () => {
  test("ranks Isaiah first for 2 Nephi with a labeled count", () => {
    render(<PartnerBars canon="bom" book="2 Nephi" onSelect={jest.fn()} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveAccessibleName(/^Isaiah, \d+ references, \d+ quotes$/);
  });

  test("folds rows past 8 behind a Show all button", () => {
    const total = partnersFor("bom", "2 Nephi").length;
    render(<PartnerBars canon="bom" book="2 Nephi" onSelect={jest.fn()} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    fireEvent.click(screen.getByText(new RegExp(`Show all ${total}`)));
    expect(screen.getAllByRole("listitem")).toHaveLength(total);
  });

  test("clicking a row reports the partner book name", () => {
    const onSelect = jest.fn();
    render(<PartnerBars canon="bom" book="2 Nephi" onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole("listitem")[0]);
    expect(onSelect).toHaveBeenCalledWith("Isaiah");
  });

  test("zero-correspondence anchor renders an empty state, not bars", () => {
    // Ruth has no known correspondences in the dataset
    render(<PartnerBars canon="kjv" book="Ruth" onSelect={jest.fn()} />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText(/No known correspondences/)).toBeInTheDocument();
  });

  test("a division highlight marks every partner book in that division", () => {
    render(
      <PartnerBars canon="bom" book="2 Nephi" highlight="Major Prophets" onSelect={jest.fn()} />
    );
    // Bars render as role="listitem" (button role arrives in Task 15).
    const isaiah = screen.getByRole("listitem", { name: /^Isaiah,/ });
    expect(isaiah.className).toMatch(/highlighted/);
    const matthew = screen.getByRole("listitem", { name: /^Matthew,/ });
    expect(matthew.className).not.toMatch(/highlighted/);
  });
});
