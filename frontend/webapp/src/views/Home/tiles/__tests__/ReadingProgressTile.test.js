import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

let mockPageResult = null; // "pending" | "fail" | object
const mockApi = vi.fn();
const applyApiImpl = () =>
  mockApi.mockImplementation(() => {
    if (mockPageResult === "pending") return new Promise(() => {});
    if (mockPageResult === "fail") return Promise.reject(new Error("down"));
    return Promise.resolve({ pageinfoprogress: mockPageResult });
  });

vi.mock("src/models/BoMOnlineAPI.js", () => ({ __esModule: true, default: (...a) => mockApi(...a) }));
vi.mock("src/contexts/AppControllerContext", () => ({
  __esModule: true,
  useAppController: () => ({ states: { user: { token: "tok", user: null, social: null, progress: {} } } }),
}));
vi.mock("src/components/UserAvatar", () => ({ __esModule: true, default: () => <span data-testid="avatar" /> }));
vi.mock("src/views/User/ProgressBox", () => ({
  __esModule: true,
  ProgressDetailsCircles: () => <div data-testid="circles" />,
  ProgressBar: () => <div data-testid="bar" />,
}));
vi.mock("src/views/User/ProgressBox.css", () => ({}));

import ReadingProgressTile from "../ReadingProgressTile";

const bookmark = { pageSlug: "lehi", pagetitle: "Lehi’s Vision" };
const renderTile = (bm = bookmark) =>
  render(<MemoryRouter><ReadingProgressTile token="tok" bookmark={bm} /></MemoryRouter>);

beforeEach(() => {
  mockApi.mockClear();
  applyApiImpl();
  mockPageResult = null;
});

test("no bookmark page → collapses fully", () => {
  expect(renderTile({}).container.firstChild).toBeNull();
});

test("while progress loads, the page box is reserved (no second grow)", () => {
  mockPageResult = "pending";
  const { container } = renderTile();
  expect(container.querySelector(".rpBoxPending")).toBeTruthy();
  expect(container.textContent).not.toMatch(/undefined|NaN/);
});

test("a failed progress fetch still offers the way back to the page", async () => {
  mockPageResult = "fail";
  const { container } = renderTile();
  await waitFor(() => expect(container.querySelector("a.rpContinue")).toBeTruthy());
  expect(container.querySelector("a.rpContinue").getAttribute("href")).toBe("/lehi");
  expect(container.querySelector(".rpBoxPending")).toBeNull();
});

test("loaded progress renders the circles", async () => {
  mockPageResult = { progress: { completed: 10, started: 5 }, sections: [] };
  const { findByTestId } = renderTile();
  expect(await findByTestId("circles")).toBeTruthy();
});
