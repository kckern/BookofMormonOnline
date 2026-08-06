import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CommentaryTile from "../CommentaryTile";

// Force the excerpt to look overflowing so the read-more pill renders.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 100 });
});

const data = {
  id: 7,
  title: "A commentary",
  reference: "Alma 32:21",
  preview: "word ".repeat(80),
  publication: { source_name: "Author", source_title: "Work", source_id: 3 },
};

test("the 'see in context' deeplink appears only after read-more is clicked", () => {
  render(
    <MemoryRouter>
      <CommentaryTile data={data} />
    </MemoryRouter>
  );
  const deep = () => screen.queryByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });
  // Layer 2 hidden until Layer 1 fires.
  expect(deep()).toBeNull();
  // Click the read-more pill (Layer 1).
  const readMore = screen.getByRole("button", { name: (n, el) => el.classList.contains("readMorePill") });
  fireEvent.click(readMore);
  expect(deep()).not.toBeNull();
  expect(deep().getAttribute("href")).toBe("/commentary/7");
});
