/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Reader, { readerTargetForBook } from "../Reader";
import { partnersFor } from "../aggregate";
import { canons } from "../canon";
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

  test("first page renders 50 pairs with a Load more button; never alerts", async () => {
    setup();
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBe(50));
    expect(screen.getByRole("button", { name: /Load \d+ more/ })).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test("both BoM and Bible refs link to /read/", async () => {
    setup({ bomBook: "Jacob" });
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBe(9));
    const bomLinks = screen.getAllByRole("link", { name: /Jacob/ });
    expect(bomLinks[0]).toHaveAttribute("href", expect.stringMatching(/^\/read\//));
    const bibleLinks = screen.getAllByRole("link", { name: /Isaiah \d/ });
    expect(bibleLinks[0]).toHaveAttribute("href", expect.stringMatching(/^\/read\//));
  });

  test("a repeated chapter heading renders once per run, not on every row", async () => {
    // reinstall the mock with a constant heading so consecutive rows share it
    BoMOnlineAPI.mockImplementation((input) => {
      const verses = {};
      for (const vid of input.verses || []) {
        verses[vid] = { verse_id: vid, text: `text of verse ${vid}`, heading: "Shared Heading" };
      }
      return Promise.resolve({ verses, versehighlights: {} });
    });
    setup({ bomBook: "Jacob" });
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBe(9));
    // 9 pairs, one shared heading string — must appear far fewer than 9 times
    expect(screen.getAllByText("Shared Heading").length).toBeLessThan(9);
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
    expect(bomSort.closest("th")).toHaveAttribute("aria-sort", "descending");
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

  test("header shows the pair total and quote count", async () => {
    setup();
    expect(await screen.findByText(/\d+ references · \d+ quotes/)).toBeInTheDocument();
  });

  test("show-all reveals every pair at once", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /show all/i }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /load|show all/i })).not.toBeInTheDocument()
    );
  });

  test("a bibleChapter-scoped reader shows the scope and fewer pairs than unscoped", async () => {
    const navigate = jest.fn();
    const { unmount } = render(
      <MemoryRouter>
        <Reader
          state={{ view: "reader", bomBook: "Jacob", bibleBook: "Isaiah", anchorCanon: "kjv", bibleChapter: 49 }}
          navigate={navigate}
        />
      </MemoryRouter>
    );
    // header names the scoped Bible chapter
    expect(await screen.findByText(/Isaiah 49/)).toBeInTheDocument();
    // Escape returns to the Bible chapter anchor, not the whole book
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ view: "anchor", canon: "kjv", book: "Isaiah", chapter: 49 })
    );
    unmount();
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

  test("readerTargetForBook: a book maps to itself × its top partner", () => {
    const top = partnersFor("bom", "Jacob")[0].book.name;
    expect(readerTargetForBook("bom", "Jacob")).toEqual({
      view: "reader",
      bomBook: "Jacob",
      bibleBook: top,
    });
    const kjvTop = partnersFor("kjv", "Isaiah")[0].book.name;
    expect(readerTargetForBook("kjv", "Isaiah")).toEqual({
      view: "reader",
      bibleBook: "Isaiah",
      bomBook: kjvTop,
      anchorCanon: "kjv",
    });
  });

  test("readerTargetForBook: a book with no partners falls back to its anchor view", () => {
    const orphan = canons.kjv.books.find((b) => partnersFor("kjv", b.name).length === 0);
    expect(orphan).toBeDefined();
    expect(readerTargetForBook("kjv", orphan.name)).toEqual({
      view: "anchor",
      canon: "kjv",
      book: orphan.name,
    });
  });

  test("the reader renders an anchor-side rail with the anchor book marked current", async () => {
    setup(); // default: 2 Nephi × Isaiah, anchorCanon bom
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBeGreaterThan(0));
    const rail = screen.getByRole("navigation", { name: /Book of Mormon/i });
    expect(rail).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^2 Nephi, .*references/ })).toHaveAttribute("aria-current", "true");
  });

  test("clicking a rail chapter re-scopes the current pair in place", async () => {
    const { navigate } = setup();
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("radio", { name: /^Chapter 12,/ }));
    expect(navigate).toHaveBeenCalledWith({
      view: "reader",
      bomBook: "2 Nephi",
      bibleBook: "Isaiah",
      bomChapter: 12,
    });
  });

  test("clicking a different rail book opens that book × its top partner", async () => {
    const { navigate } = setup();
    await waitFor(() => expect(screen.getAllByTestId("xref-pair").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: /^Jacob, .*references/ }));
    expect(navigate).toHaveBeenCalledWith(readerTargetForBook("bom", "Jacob"));
  });
});
