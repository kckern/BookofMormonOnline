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

  test("renders all 15 BoM books with the anchor marked current", () => {
    setup();
    const books = screen.getAllByRole("button", { name: /references$/ });
    expect(books).toHaveLength(15);
    expect(screen.getByRole("button", { name: /^2 Nephi,/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  test("clicking a book anchors it", () => {
    const { onAnchor } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Alma,/ }));
    expect(onAnchor).toHaveBeenCalledWith("Alma");
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
