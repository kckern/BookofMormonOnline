// FaxCrop is mocked so opening the modal / peek never hits the network.
jest.mock("../FaxCrop", () => ({
  FaxCrop: (p) => <img data-testid="crop" data-version={p.version} alt={p.alt} />,
}));

import "@testing-library/jest-dom";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { ATVApparatus } from "../ATVApparatus";
import { parseApparatus } from "../parseATV";

// one unit's readings, straight from the parser
const readingsOf = (inner) =>
  parseApparatus(inner).segments.find((s) => s.kind === "unit").readings;

test("renders one .atv-string pill per reading, joined by ' / '", () => {
  const readings = readingsOf("[<em>to be</em> &gt; js <em>is</em> 1|<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST]");
  const { container } = render(<ATVApparatus readings={readings} />);
  expect(container.querySelectorAll(".atv-string")).toHaveLength(3);
  expect(container.textContent).toContain(" / ");
});

test("pill carries data-indexes", () => {
  const readings = readingsOf("[<em>x</em> 1|<em>y</em> BCDEFGHIJKLMNOPQRST]");
  const { container } = render(<ATVApparatus readings={readings} />);
  const last = container.querySelectorAll(".atv-string")[1];
  expect(last.getAttribute("data-indexes")).toBe("BCDEFGHIJKLMNOPQRST");
});

// pills are operable and open the modal
test("a pill is a keyboard-operable button that opens the compare modal", () => {
  const readings = parseApparatus("[<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST]")
    .segments.find((s) => s.kind === "unit").readings;
  const { container } = render(
    <ATVApparatus readings={readings} verseId={31103} reference="1 Nephi 1:3" />
  );
  const pill = container.querySelector(".atv-string");
  expect(pill.getAttribute("role")).toBe("button");
  expect(pill.getAttribute("tabindex")).toBe("0");
  fireEvent.click(pill);
  expect(document.querySelector('[role="dialog"]')).not.toBeNull(); // VariantCompare opened
});

test("Enter and Space on a pill open the compare modal", () => {
  const readings = readingsOf("[<em>x</em> A|<em>y</em> B]");
  const { container, unmount } = render(
    <ATVApparatus readings={readings} verseId={1} reference="r" />
  );
  fireEvent.keyDown(container.querySelector(".atv-string"), { key: "Enter" });
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  unmount();

  const { container: c2 } = render(
    <ATVApparatus readings={readings} verseId={1} reference="r" />
  );
  fireEvent.keyDown(c2.querySelector(".atv-string"), { key: " " });
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
});

test("pills no longer carry the retired tooltip attributes", () => {
  const readings = parseApparatus("[<em>x</em> A|<em>y</em> B]").segments.find(
    (s) => s.kind === "unit"
  ).readings;
  const { container } = render(<ATVApparatus readings={readings} verseId={1} reference="r" />);
  expect(container.querySelector("[data-for='atv-tooltip']")).toBeNull();
  expect(container.querySelector("[data-tip]")).toBeNull();
});

test("omission renders as <b>∅</b> inside the pill; correction as .atv-change", () => {
  const readings = readingsOf("[NULL 1|<em>of</em> &gt;js <em>off</em> A]");
  const { container } = render(<ATVApparatus readings={readings} />);
  expect(container.querySelector(".atv-string b").textContent).toContain("∅");
  expect(container.querySelector(".atv-change")).not.toBeNull();
});

test("reading content HTML renders as elements, not literal tags", () => {
  const readings = readingsOf("[<em>to be</em> 1|<em>is</em> A]");
  const { container } = render(<ATVApparatus readings={readings} />);
  expect(container.querySelector(".atv-string em")).not.toBeNull();
  expect(container.textContent).not.toContain("<em>");
});

test("a variant class is applied when given", () => {
  const readings = readingsOf("[<em>x</em> 1|<em>y</em> A]");
  const { container } = render(<ATVApparatus readings={readings} variant="inline" />);
  expect(container.querySelector(".atv-apparatus.atv-inline")).not.toBeNull();
});

test("renders nothing for empty readings", () => {
  const { container } = render(<ATVApparatus readings={[]} />);
  expect(container.firstChild).toBeNull();
});
