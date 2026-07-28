import "@testing-library/jest-dom";
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import Parser from "html-react-parser";
import { detectScriptures, lookupReference } from "scripture-guide";
import { extractApparatusUnits } from "../parseATV";
import { governingRefs } from "../governingRef";
import { ATVApparatus } from "../ATVApparatus";

// Keep the compare modal off the network; echo the selector so a test can assert
// which verse each crop points at.
jest.mock("../FaxCrop", () => ({
  FaxCrop: (p) => <img data-testid="crop" data-selector={p.selector} alt={p.alt} />,
}));

// Collect the last scripture reference in a context slice without altering it —
// mirrors the cb Commentary.js passes to detectScriptures.
const lastRef = (html) => {
  let last = null;
  detectScriptures(html || "", (s) => { if (s) last = s; return s; }, "en");
  return last;
};

// Mirrors the Commentary.js body pipeline: tokenize -> governing refs -> Parser
// with the atv-unit replace that resolves each unit's citation to a verseId.
function renderBody(html) {
  const { html: tokenized, units, contexts } = extractApparatusUnits(html);
  const refs = governingRefs(contexts, lastRef);
  const options = {
    replace: (node) => {
      if (node && node.name === "atv-unit") {
        const i = Number(node.attribs && node.attribs["data-atv-i"]);
        const ref = refs[i];
        const verseId = ref ? (lookupReference(ref)?.verse_ids?.[0] ?? null) : null;
        return (
          <ATVApparatus
            readings={units[i]}
            variant="inline"
            verseId={verseId}
            reference={ref || "fallback"}
          />
        );
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

test("a unit under a citation heading crops to that verse", () => {
  const ref = "1 Nephi 2:11";
  const verseId = lookupReference(ref).verse_ids[0];
  const { container } = renderBody(
    `<ul><li>${ref}<ul><li>because [<em>that</em> 01A| BCDEFGHIJKLMNOPQRST] he was</li></ul></li></ul>`
  );

  // Open the compare modal from the first reading pill.
  fireEvent.click(container.querySelector(".atv-string"));

  const dialog = screen.getByRole("dialog");
  expect(dialog).toBeInTheDocument();
  expect(dialog.textContent).toContain(ref);

  const crops = document.querySelectorAll('[data-testid="crop"]');
  expect(crops.length).toBeGreaterThan(0);
  crops.forEach((c) => {
    expect(c.getAttribute("data-selector")).toBe(`ids/${verseId}`);
  });
});

test("a unit with no preceding citation degrades to verseId null", () => {
  const { container } = renderBody(
    "<p>no citation here [<em>x</em> 1|<em>y</em> A] tail</p>"
  );

  fireEvent.click(container.querySelector(".atv-string"));

  expect(screen.getByRole("dialog")).toBeInTheDocument();
  const crops = document.querySelectorAll('[data-testid="crop"]');
  expect(crops.length).toBeGreaterThan(0);
  crops.forEach((c) => {
    expect(c.getAttribute("data-selector")).toBe("ids/null");
  });
});
