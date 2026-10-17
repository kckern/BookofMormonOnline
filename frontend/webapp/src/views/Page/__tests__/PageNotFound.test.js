import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import PageNotFound from "../PageNotFound";
import { __resetDocTitleForTests, pushDocTitle, resetDocTitleStack, setBaseDocTitle } from "../docTitle";

beforeEach(() => {
  __resetDocTitleForTests();
  document.title = "";
});

// label() echoes the key when the labels table lacks it (blind audit r4
// commentary D5: "not_found_title not_found_body … back_home" leaked).
test("falls back to English copy, never raw label keys", () => {
  const { container } = render(<PageNotFound type="commentary" id="123" />);
  expect(container.textContent).not.toMatch(/not_found_title|not_found_body|back_home/);
  expect(screen.getByRole("heading")).toHaveTextContent(/not found/i);
  expect(screen.getByRole("link")).toHaveTextContent(/home/i);
});

// D4: the tab title must not keep the previously visited page's row heading.
test("sets a not-found document title over a stale row title", () => {
  setBaseDocTitle("Old page");
  pushDocTitle("row", "3 Nephi 19:10–11 | Book of Mormon Online");
  render(<PageNotFound type="commentary" id="123" />);
  expect(document.title).toMatch(/^Not found/);
});

test("resetDocTitleStack drops leftover pushes without touching the title", () => {
  setBaseDocTitle("Base");
  pushDocTitle("row", "Row");
  resetDocTitleStack();
  expect(document.title).toBe("Row");
  setBaseDocTitle("Next");
  expect(document.title).toBe("Next");
});
