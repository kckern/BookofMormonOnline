import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import PartnerBars from "../PartnerBars";
import { partnersFor } from "../aggregate";

describe("PartnerBars", () => {
  test("ranks Isaiah first for 2 Nephi with a labeled count", () => {
    render(<PartnerBars canon="bom" book="2 Nephi" onSelect={jest.fn()} />);
    // Each bar is a button wrapped in a listitem; the accessible name is on the button.
    const rows = screen.getAllByRole("button");
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
    fireEvent.click(screen.getAllByRole("button")[0]);
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
    // The accessible name is on the button (a listitem wraps it as of Task 15).
    const isaiah = screen.getByRole("button", { name: /^Isaiah,/ });
    expect(isaiah.className).toMatch(/highlighted/);
    const matthew = screen.getByRole("button", { name: /^Matthew,/ });
    expect(matthew.className).not.toMatch(/highlighted/);
  });

  test("items are buttons inside listitems, not role-overridden buttons", () => {
    render(<PartnerBars canon="bom" book="2 Nephi" onSelect={jest.fn()} />);
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].tagName).not.toBe("BUTTON");
    expect(screen.getAllByRole("button", { name: /Isaiah,/ }).length).toBe(1);
  });

  test("chapter scope keeps the unscoped scale (no lone full-width bar)", () => {
    render(<PartnerBars canon="bom" book="2 Nephi" chapter={12} onSelect={jest.fn()} />);
    const track = document.querySelector(".xref-bar-quote, .xref-bar-phrase");
    // ch.12 has ~23 refs vs the unscoped max of ~406 — the widest segment
    // must be nowhere near 100%
    expect(parseFloat(track.style.width)).toBeLessThan(50);
  });
});
