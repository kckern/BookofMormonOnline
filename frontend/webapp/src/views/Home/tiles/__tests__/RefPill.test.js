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
  expect(openScripture.mock.calls.map((c) => c[0])).toContain("Alma 32:21");
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
  expect(openScripture.mock.calls.map((c) => c[0])).toContain("Helaman 5:25");
});

test("a dotted ref displays in colon form", () => {
  render(<p>{Parser('<a class="scripture_link">Alma 5.51</a>', refPillParserOptions)}</p>);
  expect(screen.getByRole("button", { name: "Alma 5:51" })).toBeInTheDocument();
});

test("the pill hands itself to the popup as the opener (scroll place, audit xc-popup-E3)", () => {
  render(<RefPill refText="Alma 32:21" />);
  const btn = screen.getByRole("button", { name: "Alma 32:21" });
  fireEvent.click(btn);
  expect(openScripture.mock.calls.at(-1)[1]).toEqual({ opener: btn });
});

test("a spaced cross-chapter range reads closed, like the popup title (audit text-A3)", () => {
  render(<RefPill refText="3 Nephi 12:1 – 13:24" />);
  expect(screen.getByRole("button").textContent).toBe("3 Nephi 12:1–13:24");
});

// Blind r8 commentary-A1: scripture detection hands back a whole citation list
// as ONE ref ("1 Nephi 15:25; 19:15–16; Jacob 3:9–11; …"); as one nowrap chip
// it was 465px wide and pushed the commentary excerpt out of its 233px column.
// A list becomes one pill per reference (book carried forward), inside a run
// that may wrap between them.
test("a detected citation list splits into one pill per reference", () => {
  const LIST = "1 Nephi 15:25; 19:15–16; Jacob 3:9–11; Alma 37:35; 3 Nephi 18:7, 11; Moroni 4–5";
  const { container } = render(<p>{Parser(`see <a class="scripture_link">${LIST}</a>.`, refPillParserOptions)}</p>);
  const names = [...container.querySelectorAll("button")].map((b) => b.textContent);
  expect(names).toEqual(["1 Nephi 15:25", "19:15–16", "Jacob 3:9–11", "Alma 37:35", "3 Nephi 18:7, 11", "Moroni 4–5"]);
  expect(container.textContent).toBe(`see ${LIST}.`);
  expect(container.querySelector(".refList")).not.toBeNull();
  // the "; " separator travels with the pill before it, never opening a line
  const first = container.querySelector(".refList button").parentElement;
  expect(first).toHaveClass("refNoBreak");
  expect(first.textContent).toBe("1 Nephi 15:25;");
  fireEvent.click(screen.getByRole("button", { name: "19:15–16" }));
  expect(openScripture.mock.calls.at(-1)[0]).toBe("1 Nephi 19:15–16");
});

test("a short single ref is not split", () => {
  const { container } = render(<p>{Parser('<a class="scripture_link">Alma 32:21</a>', refPillParserOptions)}</p>);
  expect(container.querySelectorAll("button")).toHaveLength(1);
  expect(container.querySelector(".refList")).toBeNull();
});
