import "@testing-library/jest-dom";
import React from "react";
import { render } from "@testing-library/react";
import { renderCommentaryTextInFeed } from "../StudyInFeed";

const atvText =
  "<div class='source'>and I know that the record which I make " +
  "[<em>to be</em> &gt;js <em>is</em> 1|<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST] " +
  "<em>true</em></div>" +
  "<div class='analysis'><p>For instance elsewhere we have " +
  "[<em>that</em> 01A| BCDEFGHIJKLMNOPQRST] examples.</p></div>";

const draw = (text, ref) => render(<div>{renderCommentaryTextInFeed(text, ref, [])}</div>);

test("ATV feed commentary renders the header apparatus as pills", () => {
  const { container } = draw(atvText, "1 Nephi 1:3");
  expect(container.querySelector(".atv .source")).not.toBeNull();
  expect(container.querySelectorAll(".atv-string").length).toBeGreaterThan(0);
});

test("ATV feed body units render as inline pills, no raw brackets leak", () => {
  const { container } = draw(atvText, "1 Nephi 1:3");
  // the body [that 01A|...] unit became an inline apparatus, not literal text
  expect(container.querySelector(".atv-apparatus.atv-inline")).not.toBeNull();
  expect(container.textContent).not.toContain("[");
  expect(container.textContent).not.toContain("|");
});

test("plain (non-ATV) commentary falls back to the normal feed renderer", () => {
  const { container } = draw("<p>Faith is the substance of things hoped for.</p>", "Alma 32:21");
  expect(container.querySelector(".atv")).toBeNull();
  expect(container.textContent).toContain("Faith is the substance");
});
