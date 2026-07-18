import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AnchorView from "../AnchorView";

describe("AnchorView", () => {
  const setup = (state = { view: "anchor", canon: "bom", book: "2 Nephi" }) => {
    const navigate = jest.fn();
    render(
      <MemoryRouter>
        <AnchorView state={state} navigate={navigate} />
      </MemoryRouter>
    );
    return { navigate };
  };

  test("heading, total, breadcrumb, and flip control render", () => {
    setup();
    expect(screen.getByRole("heading", { name: /2 Nephi draws on/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Overview/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view from Isaiah/i })).toBeInTheDocument();
  });

  test("Bible anchor renders the mirrored heading", () => {
    setup({ view: "anchor", canon: "kjv", book: "Isaiah" });
    expect(screen.getByRole("heading", { name: /Isaiah appears in/ })).toBeInTheDocument();
  });

  test("flip with no highlight re-anchors on the top partner", () => {
    const { navigate } = setup();
    fireEvent.click(screen.getByRole("button", { name: /view from Isaiah/i }));
    expect(navigate).toHaveBeenCalledWith({ view: "anchor", canon: "kjv", book: "Isaiah" });
  });

  test("selecting a partner opens the reader scoped to the anchor", () => {
    const { navigate } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Isaiah,/ })); // Isaiah bar
    expect(navigate).toHaveBeenCalledWith({
      view: "reader",
      bomBook: "2 Nephi",
      bibleBook: "Isaiah",
    });
  });

  test("selecting a partner from a Bible anchor maps books correctly", () => {
    const { navigate } = setup({ view: "anchor", canon: "kjv", book: "Isaiah" });
    fireEvent.click(screen.getByRole("button", { name: /^2 Nephi,/ })); // 2 Nephi bar
    expect(navigate).toHaveBeenCalledWith({
      view: "reader",
      bomBook: "2 Nephi",
      bibleBook: "Isaiah",
      anchorCanon: "kjv",
    });
  });

  test("flip() with a division-valued highlight targets a real book, not the division", () => {
    const navigate = jest.fn();
    render(
      <MemoryRouter>
        <AnchorView
          state={{ view: "anchor", canon: "bom", book: "2 Nephi", highlight: "Major Prophets" }}
          navigate={navigate}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: /view from|anchor on/i }));
    const call = navigate.mock.calls[0][0];
    expect(call.canon).toBe("kjv");
    // must be a real KJV book, never the division "Major Prophets"
    expect(call.book).not.toBe("Major Prophets");
    expect(call.book).toBeTruthy();
  });

  test("chapter selection navigates and the scope chip clears it", () => {
    const { navigate } = setup({ view: "anchor", canon: "bom", book: "2 Nephi", chapter: 12 });
    // chapter is included in reader navigation
    fireEvent.click(screen.getAllByRole("button", { name: /references, \d+ quotes$/ })[0]);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ view: "reader", bomChapter: 12 })
    );
    // scope chip clears the chapter
    fireEvent.click(screen.getByRole("button", { name: /clear chapter/i }));
    expect(navigate).toHaveBeenCalledWith({ view: "anchor", canon: "bom", book: "2 Nephi" });
  });

  test("chapter scope appears once — heading owns it, breadcrumb stays clean", () => {
    setup({ view: "anchor", canon: "bom", book: "2 Nephi", chapter: 12 });
    expect(screen.getByRole("navigation", { name: /breadcrumb/i })).not.toHaveTextContent(/ch\. 12/);
    expect(screen.getByRole("heading", { name: /2 Nephi 12/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear chapter 12/i })).toBeInTheDocument();
  });

  test("flip button names its destination book", () => {
    setup({ view: "anchor", canon: "bom", book: "2 Nephi" });
    // scoped to the flip control — the Isaiah partner bar also matches /isaiah/i
    expect(screen.getByRole("button", { name: /view from isaiah/i })).toBeInTheDocument();
  });

  test("headings say references, not refs", () => {
    setup({ view: "anchor", canon: "bom", book: "2 Nephi" });
    expect(screen.getByRole("heading", { name: /692 references/ })).toBeInTheDocument();
  });
});
