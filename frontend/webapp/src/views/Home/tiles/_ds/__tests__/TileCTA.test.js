import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TileCTA from "../TileCTA";

describe("TileCTA", () => {
  test("renders a real <button> for onClick actions (native keyboard support)", () => {
    const onClick = jest.fn();
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
