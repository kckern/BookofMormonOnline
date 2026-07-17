import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import ChiasmusPanel from "../ChiasmusPanel";

const renderPanel = (data) =>
  render(
    <MemoryRouter>
      <ChiasmusPanel data={data} />
    </MemoryRouter>
  );

describe("ChiasmusPanel", () => {
  test("renders glyph, title, reference, and a deep link per chiasm (no raw JSON)", () => {
    const { container, queryByText } = renderPanel([
      { chiasmus_id: "alma36", title: "Alma's Conversion", reference: "Alma 36", scheme: "ABCBA" },
    ]);
    expect(container.querySelector("pre")).toBeNull();
    expect(container.querySelector(".chiasmus-panel-titles strong")).toHaveTextContent("Alma's Conversion");
    expect(queryByText("Alma 36")).toBeInTheDocument();
    expect(container.querySelector("svg.chiasmGlyph")).toBeInTheDocument();
    expect(container.querySelector("a.chiasmus-panel-link")).toHaveAttribute(
      "href",
      "/analysis/chiasmus/alma36"
    );
  });

  test("dedupes repeated chiasmus_id entries (same chiasm across verse batches)", () => {
    const { container } = renderPanel([
      { chiasmus_id: "x1", title: "One", reference: "Alma 36:1", scheme: "A" },
      { chiasmus_id: "x1", title: "One", reference: "Alma 36:2", scheme: "A" },
      { chiasmus_id: "x2", title: "Two", reference: "Alma 41:1", scheme: "B" },
    ]);
    expect(container.querySelectorAll(".chiasmus-panel-item")).toHaveLength(2);
  });

  test("renders MiniChiasm lines when present, omits it when absent", () => {
    const withLines = renderPanel([
      {
        chiasmus_id: "x1",
        title: "T",
        reference: "R",
        scheme: "ABA",
        lines: [{ line_key: "A", line_text: "first _word_" }],
      },
    ]);
    expect(withLines.container.querySelector(".miniChiasm")).toBeInTheDocument();
    expect(withLines.container.querySelector("mark").textContent).toBe("word");

    const withoutLines = renderPanel([
      { chiasmus_id: "x1", title: "T", reference: "R", scheme: "ABA", lines: [] },
    ]);
    expect(withoutLines.container.querySelector(".miniChiasm")).toBeNull();
  });

  test("null / empty data renders nothing; missing chiasmus_id renders no link", () => {
    expect(renderPanel(null).container.querySelector(".chiasmus-panel")).toBeNull();
    expect(renderPanel([]).container.querySelector(".chiasmus-panel")).toBeNull();
    const { container } = renderPanel([{ title: "T", reference: "R", scheme: "AB" }]);
    expect(container.querySelector(".chiasmus-panel-item")).toBeInTheDocument();
    expect(container.querySelector("a")).toBeNull();
  });
});
