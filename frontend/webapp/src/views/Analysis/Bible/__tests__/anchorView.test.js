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
    expect(screen.getByRole("button", { name: /anchor on Bible/i })).toBeInTheDocument();
  });

  test("Bible anchor renders the mirrored heading", () => {
    setup({ view: "anchor", canon: "kjv", book: "Isaiah" });
    expect(screen.getByRole("heading", { name: /Isaiah appears in/ })).toBeInTheDocument();
  });

  test("flip with no highlight re-anchors on the top partner", () => {
    const { navigate } = setup();
    fireEvent.click(screen.getByRole("button", { name: /anchor on Bible/i }));
    expect(navigate).toHaveBeenCalledWith({ view: "anchor", canon: "kjv", book: "Isaiah" });
  });

  test("selecting a partner opens the reader scoped to the anchor", () => {
    const { navigate } = setup();
    fireEvent.click(screen.getAllByRole("listitem")[0]); // Isaiah bar
    expect(navigate).toHaveBeenCalledWith({
      view: "reader",
      bomBook: "2 Nephi",
      bibleBook: "Isaiah",
    });
  });

  test("selecting a partner from a Bible anchor maps books correctly", () => {
    const { navigate } = setup({ view: "anchor", canon: "kjv", book: "Isaiah" });
    fireEvent.click(screen.getAllByRole("listitem")[0]); // 2 Nephi bar
    expect(navigate).toHaveBeenCalledWith({
      view: "reader",
      bomBook: "2 Nephi",
      bibleBook: "Isaiah",
    });
  });

  test("chapter selection navigates and the scope chip clears it", () => {
    const { navigate } = setup({ view: "anchor", canon: "bom", book: "2 Nephi", chapter: 12 });
    // chapter is included in reader navigation
    fireEvent.click(screen.getAllByRole("listitem")[0]);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ view: "reader", bomChapter: 12 })
    );
    // scope chip clears the chapter
    fireEvent.click(screen.getByRole("button", { name: /clear chapter/i }));
    expect(navigate).toHaveBeenCalledWith({ view: "anchor", canon: "bom", book: "2 Nephi" });
  });
});
