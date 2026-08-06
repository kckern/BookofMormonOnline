import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HistoryTile from "../HistoryTile";

// Force truncation so ExpandableText registers the gate and TileDeepLink is
// hidden until the user expands the lead. Without this, jsdom reports
// scrollHeight=clientHeight=0, the gate is never registered, and the deeplink
// is visible immediately (matching the "short prose → no gate" design).
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
});

const data = {
  id: 12,
  slug: "joseph-diary",
  document: "Joseph's Diary",
  year: "1832",
  teaser: "<p>A lead paragraph.</p> Key Points: <ul><li>One</li><li>Two</li></ul>",
};

test("outer element is a div (not an anchor) so it can hold an inner expand", () => {
  const { container } = render(
    <MemoryRouter>
      <HistoryTile data={data} />
    </MemoryRouter>
  );
  const inner = container.querySelector(".historyTile");
  expect(inner).not.toBeNull();
  expect(inner.tagName).toBe("DIV"); // was an <a> before this task
});

test("deeplink into the document is gated: absent before expand, present after", () => {
  render(
    <MemoryRouter>
      <HistoryTile data={data} />
    </MemoryRouter>
  );
  const deep = () => screen.queryByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });
  expect(deep()).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: (n, el) => el.classList.contains("readMorePill") }));
  expect(deep().getAttribute("href")).toBe("/history/joseph-diary");
});
