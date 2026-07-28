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

test("two headings + a persisting heading resolve each unit end-to-end", () => {
  const refA = "1 Nephi 2:11"; // over units 0 and 1 (unit 1 has no heading of its own)
  const refB = "3 Nephi 11:8"; // over unit 2
  const idA = lookupReference(refA).verse_ids[0];
  const idB = lookupReference(refB).verse_ids[0];

  const { container } = renderBody(
    `<ul>` +
      `<li>${refA}<ul>` +
        `<li>because [<em>that</em> 01A| BCDEFGHIJKLMNOPQRST] he was</li>` +
        `<li>and [<em>then</em> 1|<em>now</em> A] more</li>` + // no heading -> refA persists
      `</ul></li>` +
      `<li>${refB}<ul>` +
        `<li>so [<em>x</em> 1|<em>y</em> A] end</li>` +
      `</ul></li>` +
    `</ul>`
  );

  const pills = container.querySelectorAll(".atv-string");
  // 2 + 2 + 2 pills across the three units.
  expect(pills.length).toBe(6);

  const cropSelectors = () =>
    Array.from(document.querySelectorAll('[data-testid="crop"]')).map((c) =>
      c.getAttribute("data-selector")
    );

  const openAndCheck = (pill, expectedRef, expectedId) => {
    fireEvent.click(pill);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain(expectedRef);
    const sels = cropSelectors();
    expect(sels.length).toBeGreaterThan(0);
    sels.forEach((s) => expect(s).toBe(`ids/${expectedId}`));
    // Close before opening the next, so only one unit's crops are in the DOM.
    fireEvent.click(dialog.querySelector(".atv-vc-close"));
  };

  openAndCheck(pills[0], refA, idA); // unit 0, own heading
  openAndCheck(pills[2], refA, idA); // unit 1, heading persisted from unit 0
  openAndCheck(pills[4], refB, idB); // unit 2, second heading (document order)
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
