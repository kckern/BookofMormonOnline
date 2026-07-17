jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
  assetUrl: "https://media.test",
  ApiBaseUrl: "",
}));
jest.mock("../../../Home/tiles/ScripturePopup", () => ({
  __esModule: true,
  default: () => null,
  openScripture: jest.fn(),
}));

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { Router, Route } from "react-router-dom";
import { createMemoryHistory } from "history";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import Container from "../Chiasmus";
import { __clearChiasmCache } from "../Chiasm";

const LIST = [
  // speaker mirrors the real API shape (bom_people row: slug-style name digits)
  { chiasmus_id: "x1", title: "First Chiasm", reference: "1 Nephi 1:1-3", scheme: "ABBA", verse_id: 31103,
    speaker: { name: "Nephi1", person_slug: "nephi1" } },
  { chiasmus_id: "x2", title: "Second Chiasm", reference: "1 Nephi 2:2-4", scheme: "ABA", verse_id: 31120,
    speaker: { name: "Nephi1", person_slug: "nephi1" } },
];
const DETAIL = (id) => ({
  chiasmus_id: id,
  title: `Detail ${id}`,
  reference: "1 Nephi 1:1-3",
  scheme: "ABBA",
  lines: [{ line_key: "A", label: "1", line_text: "alpha", highlights: "[]" }],
});

beforeAll(() => {
  // jsdom has no scrollIntoView; Container's active-card effect calls it
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  __clearChiasmCache();
  jest.clearAllMocks();
  BoMOnlineAPI.mockImplementation((input) =>
    input.chiasmus
      ? Promise.resolve({ chiasmus: LIST })
      : input.chiasm
      ? Promise.resolve({ chiasm: { [input.chiasm[0]]: DETAIL(input.chiasm[0]) } })
      : Promise.resolve({})
  );
});

// Real route pattern from src/models/Routes.js: { path: "/analysis/:value*" }
const renderAt = (path) => {
  const history = createMemoryHistory({ initialEntries: [path] });
  render(
    <Router history={history}>
      <Route path="/analysis/:value*">
        <Container />
      </Route>
    </Router>
  );
  return history;
};

test("deep link opens the detail panel without navigating", async () => {
  const history = renderAt("/analysis/chiasmus/x1");
  expect(await screen.findByText("Detail x1")).toBeInTheDocument();
  expect(history.location.pathname).toBe("/analysis/chiasmus/x1");
  expect(history.length).toBe(1); // no push/replace performed on mount
});

test("opening a chiasm pushes one entry; Back closes the panel", async () => {
  const history = renderAt("/analysis/chiasmus");
  fireEvent.click(await screen.findByRole("button", { name: /first chiasm/i }));
  expect(await screen.findByText("Detail x1")).toBeInTheDocument();
  expect(history.location.pathname).toBe("/analysis/chiasmus/x1");
  expect(history.length).toBe(2);
  act(() => history.goBack());
  expect(history.location.pathname).toBe("/analysis/chiasmus");
  expect(screen.queryByText("Detail x1")).not.toBeInTheDocument();
});

test("switching chiasms while open replaces instead of pushing", async () => {
  const history = renderAt("/analysis/chiasmus");
  fireEvent.click(await screen.findByRole("button", { name: /first chiasm/i }));
  await screen.findByText("Detail x1");
  fireEvent.click(screen.getByRole("button", { name: /second chiasm/i }));
  await screen.findByText("Detail x2");
  expect(history.location.pathname).toBe("/analysis/chiasmus/x2");
  expect(history.length).toBe(2); // still one pushed entry
});

test("arrow-key navigation replaces and keeps working after open", async () => {
  const history = renderAt("/analysis/chiasmus");
  fireEvent.click(await screen.findByRole("button", { name: /first chiasm/i }));
  await screen.findByText("Detail x1");
  fireEvent.keyDown(document, { key: "ArrowRight" });
  await screen.findByText("Detail x2");
  expect(history.location.pathname).toBe("/analysis/chiasmus/x2");
  expect(history.length).toBe(2);
  fireEvent.keyDown(document, { key: "ArrowLeft" });
  await screen.findByText("Detail x1");
  expect(history.location.pathname).toBe("/analysis/chiasmus/x1");
  expect(history.length).toBe(2);
});

test("browse query string survives open and close", async () => {
  const history = renderAt("/analysis/chiasmus?group=speaker");
  fireEvent.click(await screen.findByRole("button", { name: /first chiasm/i }));
  await screen.findByText("Detail x1");
  expect(history.location.search).toBe("?group=speaker");
  act(() => history.goBack());
  expect(history.location.search).toBe("?group=speaker");
});

test("Escape closes via replace, preserving the query string", async () => {
  const history = renderAt("/analysis/chiasmus?group=speaker");
  fireEvent.click(await screen.findByRole("button", { name: /first chiasm/i }));
  await screen.findByText("Detail x1");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByText("Detail x1")).not.toBeInTheDocument();
  expect(history.location.pathname).toBe("/analysis/chiasmus");
  expect(history.location.search).toBe("?group=speaker");
  expect(history.length).toBe(2); // close replaces — no extra entry
});

test("heading's accessible name separates and labels the total count", async () => {
  renderAt("/analysis/chiasmus");
  await screen.findByRole("button", { name: /first chiasm/i });
  // Without the visually-hidden separators the name reads "…Book of Mormon2"
  const heading = screen.getByRole("heading", { name: /Book of Mormon — 2 chiasms/ });
  expect(heading).toBeInTheDocument();
});

test("rail legend shows when grouped by book, hidden otherwise", async () => {
  const history = renderAt("/analysis/chiasmus");           // default group=book
  await screen.findByRole("button", { name: /first chiasm/i });
  expect(screen.getByText(/small plates/i)).toBeInTheDocument();
  act(() => history.replace("/analysis/chiasmus?group=speaker"));
  expect(screen.queryByText(/small plates/i)).not.toBeInTheDocument();
});

test("non-speaker grouping keeps the per-card speaker name and avatar", async () => {
  // positive counterpart to the speaker-grouping test below: a regression
  // that hid speakers everywhere would pass an absence-only assertion
  renderAt("/analysis/chiasmus"); // default group=book
  await screen.findByRole("button", { name: /first chiasm/i });
  expect(document.querySelectorAll(".speaker-name").length).toBe(2);
  expect(document.querySelectorAll(".speaker-avatar").length).toBe(2);
});

test("speaker grouping drops the redundant per-card speaker line", async () => {
  renderAt("/analysis/chiasmus?group=speaker");
  await screen.findByRole("button", { name: /first chiasm/i });
  expect(screen.getByRole("heading", { name: /nephi/i })).toBeInTheDocument(); // group header
  expect(document.querySelectorAll(".speaker-name").length).toBe(0);           // not on cards
  expect(document.querySelectorAll(".speaker-avatar").length).toBe(0);
});

test("group headers show a parenthesized count", async () => {
  renderAt("/analysis/chiasmus");
  await screen.findByRole("button", { name: /first chiasm/i });
  expect(screen.getByText("(2)")).toBeInTheDocument();
});

test("document.title resets to the list title when the panel closes", async () => {
  const history = renderAt("/analysis/chiasmus");
  fireEvent.click(await screen.findByRole("button", { name: /first chiasm/i }));
  await screen.findByText("Detail x1");
  expect(document.title).toMatch(/Detail x1/);
  act(() => history.goBack());
  expect(document.title).toMatch(/Chiasmus/);
  expect(document.title).not.toMatch(/Detail x1/);
});
