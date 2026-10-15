import React from "react";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mutable per-test fixtures (must be `mock`-prefixed to satisfy vi.mock hoisting).
let mockBookmark = null;
let mockSignedIn = false;
let mockBookmarkPending = false;
let mockProgramsFail = false;
let mockPlan = null;

const mockApi = vi.fn();

const PROGRAM = { slug: "bom-in-a-year", title: "Book of Mormon in a Year", durationLabel: "52 weeks", config: "{}" };
const PREVIEW_SEGMENTS = [
  { period: "Week 1", ref: "1 Nephi 1 - 2 Nephi 5:33" },
  { period: "Week 2", ref: "1 Nephi 5 - Alma 37:39" },
  { period: "Week 3", ref: "1 Nephi 11:13 - Alma 37:42" },
];

// react-scripts sets `resetMocks: true`, which strips a mock's implementation
// before every test — so the routing behaviour is (re)installed in beforeEach,
// not inline on the vi.fn(), or the tile would see `undefined` from the API.
const applyApiImpl = () =>
  mockApi.mockImplementation((q) => {
    if ("mybookmark" in q)
      return mockBookmarkPending ? new Promise(() => {}) : Promise.resolve({ mybookmark: mockBookmark });
    if ("readingplanprograms" in q)
      return mockProgramsFail ? Promise.reject(new Error("down")) : Promise.resolve({ readingplanprograms: { 0: PROGRAM } });
    if ("readingplanpreview" in q) return Promise.resolve({ readingplanpreview: { parts: 3, segments: PREVIEW_SEGMENTS } });
    if ("readingplan" in q) return Promise.resolve({ readingplan: mockPlan });
    return new Promise(() => {});
  });

vi.mock("src/models/BoMOnlineAPI.js", () => ({
  __esModule: true,
  default: (...args) => mockApi(...args),
}));
vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: (...args) => mockApi(...args),
  assetUrl: "https://media.test",
}));

vi.mock("src/contexts/AppControllerContext", () => ({
  __esModule: true,
  useAppController: () => ({
    states: { user: { token: "tok", user: mockSignedIn ? 42 : null, social: {}, progress: {} } },
  }),
}));

// The two heavy children are irrelevant to the routing decision — stub them.
vi.mock("../ReadingProgressTile", () => ({
  __esModule: true,
  default: () => <div data-testid="reading-progress" />,
}));
vi.mock("../../ReadingPlan", () => ({
  __esModule: true,
  ReadingPlan: () => <div data-testid="reading-plan-gallery" />,
}));

import ReadingPlanTile, { planStartPath } from "../ReadingPlanTile";
import { _resetForTests } from "../planPreviewCache";

const renderTile = () =>
  render(
    <MemoryRouter>
      <ReadingPlanTile />
    </MemoryRouter>
  );

beforeEach(() => {
  mockApi.mockClear();
  applyApiImpl();
  mockBookmark = null;
  mockSignedIn = false;
  mockBookmarkPending = false;
  mockProgramsFail = false;
  mockPlan = null;
  _resetForTests();
  try { window.localStorage.clear(); } catch { /* none */ }
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("ReadingPlanTile routing", () => {
  test("renders the reading-progress view when a bookmark exists", async () => {
    mockBookmark = { pageSlug: "1-nephi-1", pagetitle: "1 Nephi 1" };
    renderTile();
    expect(await screen.findByTestId("reading-progress")).toBeTruthy();
  });

  test("a guest with no bookmark sees the plan preview, not the progress view", async () => {
    const { container } = renderTile();
    await waitFor(() => expect(container.querySelector(".guestPlanTitle")?.textContent).toBe("Book of Mormon in a Year"));
    expect(screen.queryByTestId("reading-progress")).toBeNull();
  });

  test("a signed-in user with no bookmark queries their reading plan", async () => {
    mockSignedIn = true;
    renderTile();
    await waitFor(() =>
      expect(mockApi).toHaveBeenCalledWith(
        expect.objectContaining({ readingplan: expect.anything() }),
        expect.anything()
      )
    );
    expect(screen.queryByTestId("reading-progress")).toBeNull();
  });
});

describe("ReadingPlanTile states (B2/B4)", () => {
  test("while the bookmark is unknown: a neutral same-footprint placeholder, no variant content", () => {
    mockBookmarkPending = true;
    const { container } = renderTile();
    const shell = container.querySelector(".readingPlanPending");
    expect(shell).toBeTruthy();
    expect(shell.getAttribute("aria-busy")).toBe("true");
    // an invisible same-layout ghost: no words, no numbered bubbles, no links/buttons
    expect(container.textContent.trim()).toBe("");
    expect([...shell.children].every((c) => c.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(shell.querySelectorAll(".segmentListItem")).toHaveLength(52);
    expect(shell.querySelector("a, button")).toBeNull();
  });

  test("a failed program fetch shows heading + CTAs without bubbles (no placeholder grid forever)", async () => {
    mockProgramsFail = true;
    const { container } = renderTile();
    await waitFor(() => expect(container.querySelector(".valuePropCtas")).toBeTruthy());
    await waitFor(() => expect(container.querySelector(".segmentListItem")).toBeNull());
    expect(container.querySelector(".tileHeading")).toBeTruthy();
    expect(container.textContent).not.toMatch(/undefined|NaN/);
    expect(screen.getAllByRole("link").length).toBe(2);
  });
});

describe("ReadingPlanTile guest preview (C1/D4/A4)", () => {
  test("bubbles are a status picture: no interactive roles, hidden from AT", async () => {
    const { container } = renderTile();
    await waitFor(() => expect(container.querySelectorAll(".segmentListItem")).toHaveLength(3));
    const grid = container.querySelector(".guestSegmentList");
    expect(grid.getAttribute("aria-hidden")).toBe("true");
    expect(grid.querySelector("a, button, [role=button], [tabindex]")).toBeNull();
    // week 1 is marked as where a reader starts
    expect(container.querySelectorAll(".segmentListItem")[0].classList.contains("current")).toBe(true);
  });

  test("Start reading opens the plan's first segment, not the generic contents page", async () => {
    renderTile();
    await waitFor(() => expect(document.querySelectorAll(".segmentListItem")).toHaveLength(3));
    const start = document.querySelector("a.valuePropPrimary");
    expect(start.getAttribute("href")).toBe("/read/1-nephi-1");
  });

  test("planStartPath falls back to the first chapter when the preview is unknown", () => {
    expect(planStartPath(null)).toBe("/read/1-nephi-1");
    expect(planStartPath({ segments: [{ ref: "Mosiah 1 - Mosiah 3:27" }] })).toBe("/read/mosiah-1");
  });
});

describe("ReadingPlanTile signed-in chooser (L1)", () => {
  test("the chooser has a Close that returns to the bubbles with focus on the opener", async () => {
    mockSignedIn = true;
    const { container } = renderTile();
    const opener = await waitFor(() => {
      const b = container.querySelector("button.valuePropPrimary");
      if (!b) throw new Error("not yet");
      return b;
    });
    fireEvent.click(opener);
    expect(screen.getByTestId("reading-plan-gallery")).toBeTruthy();
    const close = screen.getByRole("button", { name: "Close" });
    expect(document.activeElement).toBe(close);
    await act(async () => { fireEvent.click(close); });
    expect(screen.queryByTestId("reading-plan-gallery")).toBeNull();
    const reopened = container.querySelector("button.valuePropPrimary");
    expect(reopened).toBeTruthy();
    expect(document.activeElement).toBe(reopened);
  });
});
