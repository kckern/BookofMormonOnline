import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

let mockPageResult = null; // "pending" | "fail" | object
let mockUserState = { token: "tok", user: null, social: null, progress: {} };
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
  useAppController: () => ({ states: { user: mockUserState } }),
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
  mockUserState = { token: "tok", user: null, social: null, progress: {} };
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

test("guest: shows the guest label; signed in: the nickname and the overall-progress tooltip", async () => {
  const guest = renderTile();
  await waitFor(() => expect(guest.container.querySelector(".rpUserName")).toBeTruthy());
  expect(guest.container.querySelector(".rpUserName").textContent.length).toBeGreaterThan(0); // label("guest") (or its key)
  guest.unmount();

  mockUserState = { token: "tok", user: 7, social: { nickname: "Reader", profile_url: "x" }, progress: { completed: 12.34, started: 40 } };
  const { container } = renderTile();
  await waitFor(() => expect(container.querySelector(".rpUserName").textContent).toBe("Reader"));
  expect(container.querySelector(".rpUserProgress").getAttribute("title")).toMatch(/12\.3%/);
  expect(container.querySelector(".rpUserProgress").getAttribute("title")).toMatch(/40\.0%/);
});

test.each([
  ["a direct object", { progress: { completed: 1, started: 1 }, sections: [] }],
  ["an array", [{ progress: { completed: 1, started: 1 }, sections: [] }]],
  ["a slug-keyed map", { lehi: { progress: { completed: 1, started: 1 }, sections: [] } }],
])("the progress response unwraps from %s", async (_name, shape) => {
  mockPageResult = shape;
  const { findByTestId } = renderTile();
  expect(await findByTestId("circles")).toBeTruthy();
});
