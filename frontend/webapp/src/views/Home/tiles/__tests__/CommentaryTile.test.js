import "@testing-library/jest-dom";
import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CommentaryTile from "../CommentaryTile";

const wrap = (data) =>
  render(
    <MemoryRouter>
      <CommentaryTile data={data} />
    </MemoryRouter>
  );

const atvData = {
  id: 42,
  title: "1 Nephi 1:3 Textual Variants",
  reference: "1 Nephi 1:3",
  text:
    "<div class='source'>and I know that the record which I make " +
    "[<em>to be</em> &gt;js <em>is</em> 1|<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST] " +
    "<em>true</em></div><div class='analysis'><p>Joseph Smith replaced the infinitive.</p></div>",
  preview: "Joseph Smith replaced the infinitive.",
  publication: { source_id: "161", source_title: "Analysis of Textual Variants", source_name: "Royal Skousen" },
};

const plainData = {
  id: 7,
  title: "A commentary note",
  reference: "Alma 32:21",
  text: "<p>Faith is not to have a perfect knowledge of things.</p>",
  preview: "Faith is not to have a perfect knowledge of things.",
  publication: { source_id: "11", source_title: "CES", source_name: "CES" },
};

test("ATV commentary renders the apparatus as pills, not raw brackets", () => {
  const { container } = wrap(atvData);
  expect(container.querySelector(".atv .source")).not.toBeNull();
  expect(container.querySelectorAll(".atv-string").length).toBeGreaterThan(0);
});

test("ATV excerpt is the bracket-free preview — no raw sigla leak", () => {
  const { container } = wrap(atvData);
  const excerpt = container.querySelector(".commentaryTileExcerpt").textContent;
  expect(excerpt).toContain("Joseph Smith replaced");
  expect(excerpt).not.toContain("[");
  expect(excerpt).not.toContain("|");
  expect(excerpt).not.toContain("BCDEFGHIJKLMNOPQRST");
});

test("plain commentary renders its text excerpt with no apparatus box", () => {
  const { container } = wrap(plainData);
  expect(container.querySelector(".atv")).toBeNull();
  expect(container.querySelector(".commentaryTileExcerpt").textContent).toContain(
    "Faith is not to have a perfect knowledge"
  );
});
