// FaxCrop is mocked so nothing hits the network; the mock echoes the props the
// modal passes so we can assert version + selector without an <img> load.
jest.mock("../FaxCrop", () => ({
  FaxCrop: (p) => (
    <img
      data-testid="crop"
      data-version={p.version}
      data-selector={p.selector}
      alt={p.alt}
    />
  ),
}));

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { VariantCompare } from "../VariantCompare";
import { parseApparatus } from "../parseATV";

const unitOf = (inner) =>
  parseApparatus(inner).segments.find((s) => s.kind === "unit");

test("renders a crop per geometry-bearing witness, chronological", () => {
  const unit = unitOf("[<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST]");
  render(
    <VariantCompare unit={unit} verseId={31103} reference="1 Nephi 1:3" onClose={() => {}} />
  );
  const versions = screen
    .getAllByTestId("crop")
    .map((c) => c.getAttribute("data-version"));
  expect(versions).toContain("1830"); // A, reading 1
  expect(versions).toContain("1837"); // B, reading 2
  expect(versions).toContain("1981"); // T, reading 2
  expect(versions).not.toContain(null); // no-geometry sigla don't produce crops
});

test("crop selector is ids/<verseId>", () => {
  const unit = unitOf("[<em>x</em> A|<em>y</em> BCDEFGHIJKLMNOPQRST]");
  render(<VariantCompare unit={unit} verseId={42} reference="r" onClose={() => {}} />);
  const selectors = screen
    .getAllByTestId("crop")
    .map((c) => c.getAttribute("data-selector"));
  expect(selectors.every((s) => s === "ids/42")).toBe(true);
});

test("an Original-Manuscript (0) witness shows its label but no crop", () => {
  const unit = unitOf("[<em>x</em> 0A|<em>y</em> BCDEFGHIJKLMNOPQRST]");
  render(<VariantCompare unit={unit} verseId={1} reference="r" onClose={() => {}} />);
  expect(screen.getByText(/Original Manuscript/)).toBeInTheDocument();
  expect(screen.getByText(/not yet indexed/i)).toBeInTheDocument();
});

test("a placeholder witness (J) is captioned with the scan title, not the Skousen name", () => {
  // reading 2 kept to B so the 1907 (O) placeholder's own "Deseret News" scan
  // title does not also match — this test is about J's caption specifically.
  const unit = unitOf("[<em>x</em> J|<em>y</em> B]");
  render(<VariantCompare unit={unit} verseId={1} reference="r" onClose={() => {}} />);
  expect(screen.getByText(/Deseret News/)).toBeInTheDocument();
});

test("an omission reading is captioned 'these words do not appear'", () => {
  const unit = unitOf("[NULL A|<em>y</em> BCDEFGHIJKLMNOPQRST]");
  render(<VariantCompare unit={unit} verseId={1} reference="r" onClose={() => {}} />);
  expect(screen.getByText(/these words do not appear/i)).toBeInTheDocument();
});

test("close button, Escape, and backdrop click all call onClose", () => {
  const unit = unitOf("[<em>x</em> A|<em>y</em> B]");
  const onClose = jest.fn();
  render(<VariantCompare unit={unit} verseId={1} reference="r" onClose={onClose} />);
  fireEvent.click(screen.getByRole("button", { name: /close/i }));
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByTestId("atv-vc-backdrop"));
  expect(onClose).toHaveBeenCalledTimes(3);
});

test("has dialog semantics", () => {
  const unit = unitOf("[<em>x</em> A|<em>y</em> B]");
  render(<VariantCompare unit={unit} verseId={1} reference="r" onClose={() => {}} />);
  const dialog = screen.getByRole("dialog");
  expect(dialog.getAttribute("aria-modal")).toBe("true");
});

test("dialog has an accessible name that names the passage", () => {
  const unit = unitOf("[<em>x</em> A|<em>y</em> B]");
  render(
    <VariantCompare unit={unit} verseId={1} reference="1 Nephi 1:3" onClose={() => {}} />
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAccessibleName(/1 Nephi 1:3/);
});

test("crops carry edition + reference alt text, never empty", () => {
  const unit = unitOf("[<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST]");
  render(
    <VariantCompare unit={unit} verseId={31103} reference="1 Nephi 1:3" onClose={() => {}} />
  );
  const alts = screen.getAllByTestId("crop").map((c) => c.getAttribute("alt"));
  expect(alts.length).toBeGreaterThan(0);
  alts.forEach((a) => {
    expect(a).toBeTruthy();
    expect(a).toMatch(/1 Nephi 1:3/);
  });
});
