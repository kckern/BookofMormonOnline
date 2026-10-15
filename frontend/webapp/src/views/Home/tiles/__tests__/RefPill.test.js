import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../ScripturePopup", () => ({ openScripture: vi.fn(), default: () => null }));

import { openScripture } from "../ScripturePopup";
import RefPill from "../RefPill";

beforeEach(() => openScripture.mockClear());

test("renders a native <button type=button> named by the ref", () => {
  render(<RefPill refText="Alma 32:21" className="extra" />);
  const btn = screen.getByRole("button", { name: "Alma 32:21" });
  expect(btn.tagName).toBe("BUTTON");
  expect(btn).toHaveAttribute("type", "button");
  expect(btn).toHaveClass("scripture_link", "extra");
});

test("click opens the scripture popup and does not bubble to a parent handler", () => {
  const parentClick = vi.fn();
  render(
    <div onClick={parentClick}>
      <RefPill refText="Alma 32:21" />
    </div>
  );
  fireEvent.click(screen.getByRole("button", { name: "Alma 32:21" }));
  expect(openScripture).toHaveBeenCalledWith("Alma 32:21");
  expect(parentClick).not.toHaveBeenCalled();
});

test("renders nothing without a ref", () => {
  const { container } = render(<RefPill refText="" />);
  expect(container).toBeEmptyDOMElement();
});
