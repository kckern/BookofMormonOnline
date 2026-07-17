import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import MiniChiasm from "../MiniChiasm";

const lines = [
  { line_key: "A", line_text: "remember the _captivity_ of our fathers" },
  { line_key: "B", line_text: "trust in _God_ and be _delivered_" },
  { line_key: "B", line_text: "put your trust in God" },
  { line_key: "A", line_text: "the captivity, remembered" },
];

describe("MiniChiasm", () => {
  test("renders one row per line and turns _markers_ into <mark>", () => {
    const { container } = render(<MiniChiasm lines={lines} />);
    expect(container.querySelectorAll(".miniChiasmLine")).toHaveLength(4);
    // one mark in line A, two in the first B, none in the rest
    expect(container.querySelectorAll("mark")).toHaveLength(3);
    expect(container.querySelector("mark").textContent).toBe("captivity");
  });

  test("indentation tracks letter depth: B rows sit deeper than A rows", () => {
    const { container } = render(<MiniChiasm lines={lines} />);
    const rows = container.querySelectorAll(".miniChiasmLine");
    expect(rows[0].style.paddingLeft).toBe("0rem");
    expect(rows[1].style.paddingLeft).toBe("0.9rem");
    expect(rows[1].style.paddingLeft).not.toBe(rows[0].style.paddingLeft);
    // mirrored: the closing A returns to the opening A's indent
    expect(rows[3].style.paddingLeft).toBe(rows[0].style.paddingLeft);
  });

  test("null / empty lines render nothing", () => {
    expect(render(<MiniChiasm lines={null} />).container.firstChild).toBeNull();
    expect(render(<MiniChiasm lines={[]} />).container.firstChild).toBeNull();
    expect(render(<MiniChiasm />).container.firstChild).toBeNull();
  });

  test("missing line_key doesn't crash and indents like an A line", () => {
    const { container } = render(<MiniChiasm lines={[{ line_text: "no key here" }]} />);
    const row = container.querySelector(".miniChiasmLine");
    expect(row).toBeInTheDocument();
    expect(row.style.paddingLeft).toBe("0rem");
  });

  test("className prop is appended to the wrapper", () => {
    const { container } = render(<MiniChiasm lines={lines} className="chiasmusTileLines" />);
    expect(container.querySelector(".miniChiasm.chiasmusTileLines")).toBeInTheDocument();
  });
});
