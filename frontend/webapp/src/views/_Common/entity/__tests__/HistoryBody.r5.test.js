import React from "react";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import HistoryBody from "../HistoryBody";

vi.mock("src/models/BoMOnlineAPI", () => ({ __esModule: true, default: vi.fn(), assetUrl: "https://media.test" }));

// blind audit R5 witness-D5: the statement modal a witness tile opens.
describe("HistoryBody (R5)", () => {
  test("a first-hand title 'Name — Name' reads once, with its source", () => {
    const { container } = render(<HistoryBody data={{ document: "Martin Harris — Martin Harris", source: "Tiffany's Monthly" }} />);
    expect(container.querySelector("h3")).toHaveTextContent(/^Martin Harris — Tiffany's Monthly$/);
  });
  test("a first-hand title with no distinct source is just the name", () => {
    const { container } = render(<HistoryBody data={{ document: "Martin Harris — Martin Harris", source: "Martin Harris" }} />);
    expect(container.querySelector("h3")).toHaveTextContent(/^Martin Harris$/);
  });
  test("a plain-text interview transcript renders its *Speaker:* marks, one turn per paragraph", () => {
    const transcript = '*Orson Pratt:* "Can you tell the date?" *David Whitmer:* "I do not know." *Joseph F. Smith:* "Did Oliver die here?"';
    const { container } = render(<HistoryBody data={{ document: "Interview", transcript }} />);
    const t = container.querySelector(".transcript");
    expect(t.textContent).not.toMatch(/\*/);
    expect(t.querySelectorAll("p")).toHaveLength(3);
    expect(t.querySelector("p em")).toHaveTextContent("Orson Pratt:");
  });
  test("HTML transcripts keep their markup; marks inside tags are untouched", () => {
    const transcript = '<p>See <a href="/x_y_z">the *record*</a>.</p>';
    const { container } = render(<HistoryBody data={{ document: "Doc", transcript }} />);
    const a = container.querySelector(".transcript a");
    expect(a.getAttribute("href")).toBe("/x_y_z");
    expect(a.querySelector("em")).toHaveTextContent("record");
  });
});
