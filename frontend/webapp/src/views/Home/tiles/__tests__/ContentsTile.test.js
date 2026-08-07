import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ContentsTile from "../ContentsTile";

// Force ExpandableText to see overflow so its read-more (and thus the gate) fires.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 100 });
});

const data = {
  slug: "1-nephi",
  title: "1 Nephi",
  description: "A long description that overflows the clamp and truncates.",
  pages: [{ slug: "1-nephi/1", title: "Chapter 1", sections: [] }],
};

const deep = () => screen.queryByRole("link", { name: (n, el) => el.classList.contains("tileMoreLink") });

test("deeplink is gated: hidden until the description is expanded", () => {
  render(<MemoryRouter><ContentsTile data={data} /></MemoryRouter>);
  expect(deep()).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: (n, el) => el.classList.contains("readMorePill") }));
  expect(deep().getAttribute("href")).toBe("/1-nephi");
});

test("with NO description there is no gate, so the deeplink shows immediately", () => {
  render(<MemoryRouter><ContentsTile data={{ ...data, description: null }} /></MemoryRouter>);
  expect(deep().getAttribute("href")).toBe("/1-nephi");
});
