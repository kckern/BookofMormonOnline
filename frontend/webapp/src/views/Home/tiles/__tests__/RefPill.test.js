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

// Audit 2026-10-15 popup-B4 / notes-A7: detected refs that do not resolve
// must not become pills (a 'v. 25' chip opened a dead-end popup); relative
// verse refs resolve against the tile's own reference; dotted refs display
// in colon form.
import Parser from "html-react-parser";
import { makeRefPillParserOptions, refPillParserOptions } from "../RefPill";

test("an unresolvable detected ref renders as plain text, not a pill", () => {
  const { container } = render(
    <p>{Parser('see <a class="scripture_link">v. 25</a> here', refPillParserOptions)}</p>
  );
  expect(container.querySelector("button")).toBeNull();
  expect(container.textContent).toBe("see v. 25 here");
});

test("a relative verse ref resolves against the context ref", () => {
  render(
    <p>{Parser('see <a class="scripture_link">v. 25</a>', makeRefPillParserOptions({ contextRef: "Helaman 5:12-14" }))}</p>
  );
  fireEvent.click(screen.getByRole("button", { name: "v. 25" }));
  expect(openScripture).toHaveBeenCalledWith("Helaman 5:25");
});

test("a dotted ref displays in colon form", () => {
  render(<p>{Parser('<a class="scripture_link">Alma 5.51</a>', refPillParserOptions)}</p>);
  expect(screen.getByRole("button", { name: "Alma 5:51" })).toBeInTheDocument();
});
