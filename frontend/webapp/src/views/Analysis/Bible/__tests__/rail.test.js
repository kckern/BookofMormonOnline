import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, within } from "@testing-library/react";
import Rail from "../Rail";

describe("Rail", () => {
  const setup = (props = {}) => {
    const onAnchor = jest.fn();
    const onChapter = jest.fn();
    render(
      <Rail
        canon="bom"
        book="2 Nephi"
        onAnchor={onAnchor}
        onChapter={onChapter}
        {...props}
      />
    );
    return { onAnchor, onChapter };
  };

  test("renders the open group's books and marks the anchor current; collapsed groups are header buttons", () => {
    // With 2 Nephi anchored, "Small Plates" is the open group (6 books visible as
    // book buttons). The other two groups collapse to single header buttons — so the
    // total button count for "…references" patterns drops to just the 6 open books.
    setup();
    const bookBtns = screen.getAllByRole("button", { name: /references$/ });
    expect(bookBtns).toHaveLength(6); // Small Plates: 1Ne, 2Ne, Jacob, Enos, Jarom, Omni
    expect(screen.getByRole("button", { name: /^2 Nephi,/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
    // Collapsed groups render as header buttons (aria-label ends with "…open")
    expect(screen.getByRole("button", { name: /Plates of Mormon.*open/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Moroni.*open/i })).toBeInTheDocument();
  });

  test("clicking a book in the open group anchors it", () => {
    // "Jacob" is a sibling of "2 Nephi" inside the open "Small Plates" group, so
    // it renders as a book button and can be clicked without expanding first.
    // (Alma is in a collapsed group when 2 Nephi is anchored, so we test Jacob here.)
    const { onAnchor } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Jacob,/ }));
    expect(onAnchor).toHaveBeenCalledWith("Jacob");
  });

  test("chapter strip is a 33-cell radiogroup with counts in labels", () => {
    setup();
    const strip = screen.getByRole("radiogroup");
    const cells = within(strip).getAllByRole("radio");
    expect(cells).toHaveLength(33);
    expect(cells[11]).toHaveAccessibleName(/Chapter 12, \d+ references/);
  });

  test("clicking a chapter selects it; clicking the current chapter clears", () => {
    const { onChapter } = setup({ chapter: 12 });
    const strip = screen.getByRole("radiogroup");
    const cells = within(strip).getAllByRole("radio");
    expect(cells[11]).toHaveAttribute("aria-checked", "true");
    fireEvent.click(cells[4]);
    expect(onChapter).toHaveBeenCalledWith(5);
    fireEvent.click(cells[11]);
    expect(onChapter).toHaveBeenCalledWith(undefined);
  });

  test("only the anchored book's group is expanded; other groups collapse to headers", () => {
    const onAnchor = jest.fn();
    render(
      <Rail canon="bom" book="Alma" chapter={undefined} onAnchor={onAnchor} onChapter={jest.fn()} />
    );
    // Alma lives in "Plates of Mormon" — its sibling Mosiah is visible
    expect(screen.getByRole("button", { name: /^Mosiah,/ })).toBeInTheDocument();
    // a book in a different, collapsed group is NOT rendered as a book button
    expect(screen.queryByRole("button", { name: /^Enos,/ })).toBeNull();
    // its group header is a button that re-anchors when clicked
    fireEvent.click(screen.getByRole("button", { name: /Small Plates/i }));
    expect(onAnchor).toHaveBeenCalledWith("1 Nephi"); // first book of Small Plates
  });

  test("centers the anchored book inside the rail on mount", () => {
    // jsdom has zero geometry; fake distinct heights so the centering math is
    // observable: rail 200px tall, anchored book 40px, sitting at offsetTop 500.
    // Expected scrollTop = 500 - 200/2 + 40/2 = 420.
    try {
      jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
        function () {
          return this.classList?.contains("anchored") ? 40 : 200;
        }
      );
      Object.defineProperty(HTMLElement.prototype, "offsetTop", {
        configurable: true,
        get() {
          return this.classList?.contains("anchored") ? 500 : 0;
        },
      });
      render(
        <Rail canon="kjv" book="Isaiah" onAnchor={jest.fn()} onChapter={jest.fn()} />
      );
      expect(screen.getByRole("navigation").scrollTop).toBe(420);
    } finally {
      delete HTMLElement.prototype.offsetTop;
      jest.restoreAllMocks();
    }
  });
});
