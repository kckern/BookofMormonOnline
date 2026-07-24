import React from "react";
import { render } from "@testing-library/react";
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

test("pill carries data-indexes, data-tip (witness labels), data-for", () => {
  const readings = readingsOf("[<em>x</em> 1|<em>y</em> BCDEFGHIJKLMNOPQRST]");
  const { container } = render(<ATVApparatus readings={readings} />);
  const last = container.querySelectorAll(".atv-string")[1];
  expect(last.getAttribute("data-indexes")).toBe("BCDEFGHIJKLMNOPQRST");
  expect(last.getAttribute("data-for")).toBe("atv-tooltip");
  expect(last.getAttribute("data-tip")).toContain("1837");
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
