import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HistoryTile from "../HistoryTile";

const data = {
  id: 12,
  slug: "joseph-diary",
  document: "Joseph's Diary",
  year: "1832",
  teaser: "<p>A lead paragraph.</p> Key Points: <ul><li>One</li><li>Two</li></ul>",
};

test("outer element is a div (not an anchor) so it can hold inner links", () => {
  const { container } = render(
    <MemoryRouter>
      <HistoryTile data={data} />
    </MemoryRouter>
  );
  const inner = container.querySelector(".historyTile");
  expect(inner).not.toBeNull();
  expect(inner.tagName).toBe("DIV"); // was an <a> before this task
});

// The read-more expander was removed (the quote is right-sized at the data
// level), so there is no Layer-1 reveal to gate the deeplink — it is present
// immediately, and no read-more pill is rendered.
test("deeplink is present immediately; no read-more pill", () => {
  render(
    <MemoryRouter>
      <HistoryTile data={data} />
    </MemoryRouter>
  );
  const deep = screen.queryByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });
  expect(deep).not.toBeNull();
  expect(deep.getAttribute("href")).toBe("/history/joseph-diary");
  expect(screen.queryByRole("button", { name: (n, el) => el.classList.contains("readMorePill") })).toBeNull();
});
