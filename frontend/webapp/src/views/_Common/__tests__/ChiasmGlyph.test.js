import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import ChiasmGlyph, { glyphBars } from "../ChiasmGlyph";

describe("glyphBars", () => {
  test("one bar per scheme entry, indent tracks letter depth", () => {
    const bars = glyphBars("ABBA");
    expect(bars).toHaveLength(4);
    expect(bars[0].indent).toBe(0);
    expect(bars[1].indent).toBe(1);
    expect(bars[2].indent).toBe(1);
    expect(bars[3].indent).toBe(0);
  });
  test("pivot = bars at maximum depth", () => {
    expect(glyphBars("ABCBA").map((b) => b.isPivot)).toEqual([false, false, true, false, false]);
    expect(glyphBars("ABBA").map((b) => b.isPivot)).toEqual([false, true, true, false]);
  });
  test("sub-letters indent +0.5 under their major", () => {
    const bars = glyphBars("AaB");
    expect(bars[0].indent).toBe(0);
    expect(bars[1].indent).toBe(0.5);
    expect(bars[2].indent).toBe(1);
  });
  test("length tertiles map to 0.4/0.7/1.0 width factors when lineLengths provided", () => {
    const bars = glyphBars("ABA", [10, 200, 12]);
    expect(bars.map((b) => b.widthFactor)).toEqual([0.4, 1.0, 0.7]);
  });
  test("uniform lineLengths → all widthFactor 1 (no fake tertiles)", () => {
    expect(glyphBars("ABBA", [5, 5, 5, 5]).every((b) => b.widthFactor === 1)).toBe(true);
  });
  test("no lineLengths → all widthFactor 1", () => {
    expect(glyphBars("ABBA").every((b) => b.widthFactor === 1)).toBe(true);
  });
  test("mismatched lineLengths length → ignored (all 1)", () => {
    expect(glyphBars("ABBA", [1, 2]).every((b) => b.widthFactor === 1)).toBe(true);
  });
  test("empty/null scheme → empty array", () => {
    expect(glyphBars("")).toEqual([]);
    expect(glyphBars(null)).toEqual([]);
  });
  test("greek sub-letters (αβγδ) don't crash and indent as sub-lines", () => {
    const bars = glyphBars("AαB");
    expect(bars).toHaveLength(3);
    expect(bars[1].indent).toBeGreaterThan(bars[0].indent);
    expect(bars[1].indent).toBeLessThan(bars[2].indent);
  });
});

describe("ChiasmGlyph", () => {
  test("renders svg with role=img, aria-label, one rect per bar", () => {
    const { container } = render(<ChiasmGlyph scheme="ABCCBA" size={40} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("role", "img");
    expect(svg.getAttribute("aria-label")).toBeTruthy();
    expect(container.querySelectorAll("rect")).toHaveLength(6);
  });
  test("pivot rects get the pivot class", () => {
    const { container } = render(<ChiasmGlyph scheme="ABCBA" size={40} />);
    expect(container.querySelectorAll("rect.pivot")).toHaveLength(1);
  });
  test("null scheme renders nothing", () => {
    const { container } = render(<ChiasmGlyph scheme={null} />);
    expect(container.firstChild).toBeNull();
  });
  test("title prop becomes <title> child and aria-label", () => {
    const { container } = render(<ChiasmGlyph scheme="ABBA" title="Alma 36" />);
    expect(container.querySelector("svg title").textContent).toBe("Alma 36");
    expect(container.querySelector("svg").getAttribute("aria-label")).toBe("Alma 36");
  });
});
