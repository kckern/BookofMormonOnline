/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Reader from "../Reader";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
}));

// CRA sets resetMocks: true, so (re)install the implementation per test.
const installApiMock = () =>
  BoMOnlineAPI.mockImplementation((input) => {
    const verses = {};
    for (const vid of input.verses || []) {
      verses[vid] = { verse_id: vid, text: `text of verse ${vid}`, heading: "" };
    }
    return Promise.resolve({ verses, versehighlights: {} });
  });

const setup = (state) => {
  const navigate = jest.fn();
  render(
    <MemoryRouter>
      <Reader
        state={{ view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah", ...state }}
        navigate={navigate}
      />
    </MemoryRouter>
  );
  return { navigate };
};

describe("Reader", () => {
  let alertSpy;
  beforeEach(() => {
    installApiMock();
    alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
  });
  afterEach(() => alertSpy.mockRestore());

  test("first page renders 20 pairs with a Load more button; never alerts", async () => {
    setup();
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBe(20));
    expect(screen.getByRole("button", { name: /Load more/ })).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test("BoM refs link to /read/, Bible refs are plain text", async () => {
    setup({ bomBook: "Jacob" });
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBe(9));
    const bomLinks = screen.getAllByRole("link", { name: /Jacob/ });
    expect(bomLinks[0]).toHaveAttribute("href", expect.stringMatching(/^\/read\//));
    expect(screen.queryByRole("link", { name: /Isaiah \d/ })).toBeNull();
  });

  test("quote pairs carry a QUOTE badge", async () => {
    setup({ bomBook: "Jacob" });
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBe(9));
    expect(screen.getAllByText("QUOTE")).toHaveLength(2);
  });

  test("zero-pair scope renders an inline empty state, not an alert", async () => {
    setup({ bomBook: "Enos", bibleBook: "Revelation" });
    expect(await screen.findByText(/No known correspondences/)).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test("sort toggle flips order and moves the active arrow", async () => {
    setup({ bomBook: "Jacob" });
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBe(9));
    const first = () => screen.getAllByTestId("xref-pair")[0].textContent;
    const ascFirst = first();
    const bomSort = screen.getByRole("button", { name: /sort by Jacob/i });
    fireEvent.click(bomSort); // toggles to desc
    expect(first()).not.toBe(ascFirst);
    expect(bomSort).toHaveAttribute("aria-pressed", "true");
  });

  test("Escape returns to the anchored view", async () => {
    const { navigate } = setup({ bomBook: "Jacob" });
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBe(9));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(navigate).toHaveBeenCalledWith({ view: "anchor", canon: "bom", book: "Jacob" });
  });

  test("breadcrumb back target honors a kjv origin", () => {
    const navigate = jest.fn();
    render(
      <MemoryRouter>
        <Reader
          state={{ view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah", anchorCanon: "kjv" }}
          navigate={navigate}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "Isaiah" }));
    expect(navigate).toHaveBeenCalledWith({ view: "anchor", canon: "kjv", book: "Isaiah" });
  });

  test("Escape inside an input does not navigate", () => {
    const navigate = jest.fn();
    render(
      <MemoryRouter>
        <input data-testid="searchbox" />
        <Reader state={{ view: "reader", bomBook: "2 Nephi", bibleBook: "Isaiah" }} navigate={navigate} />
      </MemoryRouter>
    );
    fireEvent.keyDown(screen.getByTestId("searchbox"), { key: "Escape" });
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ view: "anchor", canon: "bom", book: "2 Nephi" })
    );
  });
});
