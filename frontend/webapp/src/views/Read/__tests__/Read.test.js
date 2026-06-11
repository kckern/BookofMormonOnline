import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route } from "react-router-dom";
import { lookupReference } from "scripture-guide";
import ReadScripture from "../Read";
import BoMOnlineAPI from "../../../models/BoMOnlineAPI";

jest.mock("../../../models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
  assetUrl: "http://test-assets",
}));

// Build chapter data in the shape the GraphQL layer returns, using real
// verse ids from scripture-guide so verse links resolve to real slugs.
const buildChapterData = (ref) => {
  const ids = lookupReference(ref).verse_ids;
  return {
    sections: [
      {
        heading: `${ref} heading`,
        ref,
        blocks: [
          {
            voice: "narrator",
            person_slug: "alma2",
            lines: ids.map((verseId, i) => ({
              verse_id: verseId,
              verse_num: i + 1,
              text: `${ref} verse ${i + 1} text.`,
              format: "",
            })),
          },
        ],
      },
    ],
  };
};

const appController = { functions: { setPopUp: jest.fn() } };

const renderRead = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Route path="/read/:bookCh?/:verseNum?">
        <ReadScripture appController={appController} />
      </Route>
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  window.scrollTo = jest.fn();
  Element.prototype.scrollIntoView = jest.fn();
  BoMOnlineAPI.mockImplementation(({ read }) =>
    Promise.resolve({ read: { [read]: buildChapterData(read) } })
  );
});

test("clicking a verse highlights it without refetching the chapter", async () => {
  renderRead("/read/alma.32");

  const verse21 = await screen.findByText("Alma 32 verse 21 text.");
  const callsAfterInitialLoad = BoMOnlineAPI.mock.calls.length;

  // Each verse is a <Link> to /read/alma.32/21 — clicking it is a route change
  userEvent.click(verse21);

  await waitFor(() => {
    expect(
      screen.getByText("Alma 32 verse 21 text.").closest("a").className
    ).toContain("highlighted");
  });

  // The chapter was already mounted: highlighting must not trigger a refetch
  expect(BoMOnlineAPI.mock.calls.length).toBe(callsAfterInitialLoad);
  // ...and the rest of the chapter must still be mounted
  expect(screen.getByText("Alma 32 verse 1 text.")).toBeTruthy();
});

test("navigating to a different chapter still refetches", async () => {
  renderRead("/read/alma.32");
  await screen.findByText("Alma 32 verse 1 text.");
  const callsAfterInitialLoad = BoMOnlineAPI.mock.calls.length;

  // Header next-chapter button reads "Alma 33 ▶" (there may also be a footer button)
  userEvent.click(screen.getAllByText(/Alma 33/)[0]);

  await waitFor(() => {
    expect(BoMOnlineAPI.mock.calls.length).toBeGreaterThan(
      callsAfterInitialLoad
    );
  });
});

test("verse click in an appended chapter updates header without teardown", async () => {
  renderRead("/read/alma.32");
  await screen.findByText("Alma 32 verse 1 text.");

  // Append Alma 33 via the manual footer load button (header next button
  // renders first in the DOM, footer button last)
  const nextButtons = screen.getAllByText(/Alma 33/);
  userEvent.click(nextButtons[nextButtons.length - 1]);
  await screen.findByText("Alma 33 verse 1 text.");
  const callsAfterAppend = BoMOnlineAPI.mock.calls.length;

  userEvent.click(screen.getByText("Alma 33 verse 5 text."));
  await waitFor(() => {
    expect(
      screen.getByText("Alma 33 verse 5 text.").closest("a").className
    ).toContain("highlighted");
  });

  // Header reflects the chapter actually being read...
  expect(
    screen.getByRole("heading", { level: 3 }).textContent
  ).toContain("Alma 33");
  // ...and the prev button points at Alma 32, not Alma 31
  expect(screen.getByText(/◀/).textContent).toContain("Alma 32");
  // No refetch; both chapters still mounted
  expect(BoMOnlineAPI.mock.calls.length).toBe(callsAfterAppend);
  expect(screen.getByText("Alma 32 verse 1 text.")).toBeTruthy();
});
