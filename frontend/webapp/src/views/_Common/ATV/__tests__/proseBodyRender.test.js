import React from "react";
import { render } from "@testing-library/react";
import Parser from "html-react-parser";
import { extractApparatusUnits } from "../parseATV";
import { ATVApparatus } from "../ATVApparatus";

// mirrors the Commentary.js body pipeline (tokenize -> Parser with composed replace)
function renderBody(html) {
  const { html: tokenized, units } = extractApparatusUnits(html);
  const options = {
    replace: (node) => {
      if (node && node.name === "atv-unit") {
        const i = Number(node.attribs && node.attribs["data-atv-i"]);
        return <ATVApparatus readings={units[i]} variant="inline" />;
      }
      return undefined;
    },
  };
  return render(<div>{Parser(tokenized, options)}</div>);
}

test("a prose-body unit renders as inline pills, block structure intact", () => {
  const { container } = renderBody(
    "<ul><li>1 Nephi 2:11<ul><li>because [<em>that</em> 01A| BCDEFGHIJKLMNOPQRST] he was</li></ul></li></ul>"
  );
  expect(container.querySelector("ul li ul li")).not.toBeNull();          // nesting preserved
  expect(container.querySelector(".atv-apparatus.atv-inline")).not.toBeNull();
  expect(container.querySelectorAll(".atv-string")).toHaveLength(2);
  expect(container.textContent).toContain("because");
  expect(container.textContent).toContain("he was");
});

test("prose with no apparatus renders unchanged", () => {
  const { container } = renderBody("<p>just prose, no variants</p>");
  expect(container.querySelector(".atv-apparatus")).toBeNull();
  expect(container.textContent).toBe("just prose, no variants");
});

test("multiple units in one body each resolve to their own readings", () => {
  const { container } = renderBody(
    "<p>a [<em>x</em> 1|<em>y</em> A] b [<em>p</em> 1|<em>q</em> A] c</p>"
  );
  expect(container.querySelectorAll(".atv-apparatus")).toHaveLength(2);
});
