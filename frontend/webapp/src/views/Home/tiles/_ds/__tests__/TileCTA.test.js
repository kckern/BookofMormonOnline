import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TileCTA from "../TileCTA";

describe("TileCTA", () => {
  test("renders a real <button> for onClick actions (native keyboard support)", () => {
    const onClick = vi.fn();
    render(<TileCTA variant="reveal" onClick={onClick}>More</TileCTA>);
    const el = screen.getByRole("button", { name: "More" });
    expect(el.tagName).toBe("BUTTON");
    expect(el).toHaveClass("readMorePill");
    expect(el).toHaveClass("tileCTA");
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("renders a real <a> for `to` navigation with the deeplink class", () => {
    render(
      <MemoryRouter>
        <TileCTA variant="deeplink" to="/places/nephi">Go</TileCTA>
      </MemoryRouter>
    );
    const el = screen.getByRole("link", { name: "Go" });
    expect(el.getAttribute("href")).toBe("/places/nephi");
    expect(el).toHaveClass("tileMoreLink");
  });
});

describe("TileCTA verb vocabulary (sentence-case fallbacks)", () => {
  test.each([
    ["readMore", "Read more"],
    ["showLess", "Show less"],
    ["seeInContext", "See in context"],
    ["viewAll", "View all"],
    ["explore", "Explore"],
  ])("verb=%s renders %s", (verb, text) => {
    render(<TileCTA variant="reveal" verb={verb} onClick={() => {}} />);
    expect(screen.getByRole("button", { name: text })).toBeInTheDocument();
  });

  test('verb="open" name="Nephi" renders "Open Nephi"', () => {
    render(
      <MemoryRouter>
        <TileCTA variant="deeplink" verb="open" name="Nephi" to="/people/nephi" />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Open Nephi" })).toBeInTheDocument();
  });

  test("children win over verb", () => {
    render(<TileCTA variant="reveal" verb="viewAll" onClick={() => {}}>Custom</TileCTA>);
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
    expect(screen.queryByText("View all")).toBeNull();
  });

  test("uses the DB label when the dictionary has the key", () => {
    const prev = global.dictionary;
    global.dictionary = { view_all: "See everything", open_x: "Visit $1" };
    try {
      const { unmount } = render(<TileCTA variant="reveal" verb="viewAll" onClick={() => {}} />);
      expect(screen.getByRole("button", { name: "See everything" })).toBeInTheDocument();
      unmount();
      render(<TileCTA variant="reveal" verb="open" name="Alma" onClick={() => {}} />);
      expect(screen.getByRole("button", { name: "Visit Alma" })).toBeInTheDocument();
    } finally {
      global.dictionary = prev;
    }
  });
});
