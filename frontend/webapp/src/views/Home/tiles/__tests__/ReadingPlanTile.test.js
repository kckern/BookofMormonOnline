import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mutable per-test fixtures (must be `mock`-prefixed to satisfy jest.mock hoisting).
let mockBookmark = null;
let mockSignedIn = false;

const mockApi = jest.fn();

// react-scripts sets `resetMocks: true`, which strips a mock's implementation
// before every test — so the routing behaviour is (re)installed in beforeEach,
// not inline on the jest.fn(), or the tile would see `undefined` from the API.
const applyApiImpl = () =>
  mockApi.mockImplementation((q) => {
    if ("mybookmark" in q) return Promise.resolve({ mybookmark: mockBookmark });
    if ("readingplanprograms" in q) return Promise.resolve({ readingplanprograms: {} });
    if ("readingplan" in q) return Promise.resolve({ readingplan: null });
    return new Promise(() => {}); // readingplanpreview etc. — stay pending
  });

jest.mock("src/models/BoMOnlineAPI.js", () => ({
  __esModule: true,
  default: (...args) => mockApi(...args),
}));
jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: (...args) => mockApi(...args),
  assetUrl: "https://media.test",
}));

jest.mock("src/contexts/AppControllerContext", () => ({
  __esModule: true,
  useAppController: () => ({
    states: { user: { token: "tok", user: mockSignedIn ? 42 : null, social: {}, progress: {} } },
  }),
}));

// The two heavy children are irrelevant to the routing decision — stub them.
jest.mock("../ReadingProgressTile", () => ({
  __esModule: true,
  default: () => <div data-testid="reading-progress" />,
}));
jest.mock("../../ReadingPlan", () => ({
  __esModule: true,
  ReadingPlan: () => <div data-testid="reading-plan-gallery" />,
}));

import ReadingPlanTile from "../ReadingPlanTile";

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
});

describe("ReadingPlanTile routing", () => {
  test("renders the reading-progress view when a bookmark exists", async () => {
    mockBookmark = { pageSlug: "1-nephi-1", pagetitle: "1 Nephi 1" };
    renderTile();
    expect(await screen.findByTestId("reading-progress")).toBeTruthy();
  });

  test("a guest with no bookmark sees the plan preview, not the progress view", async () => {
    mockBookmark = null;
    mockSignedIn = false;
    const { container } = renderTile();
    await waitFor(() => expect(mockApi).toHaveBeenCalled());
    expect(screen.queryByTestId("reading-progress")).toBeNull();
    expect(container.querySelector(".valuePropTile")).toBeTruthy();
  });

  test("a signed-in user with no bookmark queries their reading plan", async () => {
    mockBookmark = null;
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
