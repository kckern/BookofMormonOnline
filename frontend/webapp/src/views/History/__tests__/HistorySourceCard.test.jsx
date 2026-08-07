/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import HistorySourceCard, { withBrackets } from "../HistorySourceCard";

const base = {
  slug: "doc-1", id: 42, date: "1830-03-26", source: "Palmyra Freeman",
  document: "The Golden Bible", citation: "Palmyra Freeman, 1830.", teaser: "<p>An early notice.</p>",
};

describe("HistorySourceCard", () => {
  test("first-hand voice renders the quote then an em-dash attribution", () => {
    render(<HistorySourceCard doc={{ ...base, money_quote: "I saw the plates", quote_speaker: "Martin Harris", quote_is_witness_voice: true }} onOpen={jest.fn()} />);
    expect(screen.getByText(/I saw the plates/)).toBeInTheDocument();
    expect(screen.getByText(/—\s*Martin Harris/)).toBeInTheDocument();
  });

  test("reporter voice renders a speaker prefix before the quote", () => {
    render(<HistorySourceCard doc={{ ...base, money_quote: "the plates were shown", quote_speaker: "The Editor", quote_is_witness_voice: false }} onOpen={jest.fn()} />);
    expect(screen.getByText(/The Editor:/)).toBeInTheDocument();
    expect(screen.getByText(/the plates were shown/)).toBeInTheDocument();
  });

  test("editorial marks [ ... ] become styled spans", () => {
    const { container } = render(<HistorySourceCard doc={{ ...base, money_quote: "he [Joseph] saw [...] them", quote_speaker: "A Witness", quote_is_witness_voice: true }} onOpen={jest.fn()} />);
    const marks = [...container.querySelectorAll(".editorialMark")].map((n) => n.textContent);
    expect(marks).toContain("[Joseph]");
    expect(marks).toContain("[...]");
  });

  test("a doc with no money quote renders no blockquote (teaser carries it)", () => {
    const { container } = render(<HistorySourceCard doc={base} onOpen={jest.fn()} />);
    expect(container.querySelector(".historyLead")).toBeNull();
    expect(container.querySelector(".historyTeaserText")).toBeInTheDocument();
  });

  test("reception variant shows source + document; witness variant does not", () => {
    const { container: rc } = render(<HistorySourceCard doc={base} variant="reception" onOpen={jest.fn()} />);
    expect(rc.querySelector(".historySource")).toHaveTextContent("Palmyra Freeman");
    expect(rc.querySelector(".historyDocTitle")).toHaveTextContent("The Golden Bible");
    const { container: wc } = render(<HistorySourceCard doc={base} variant="witness" onOpen={jest.fn()} />);
    expect(wc.querySelector(".historySource")).toBeNull();
    expect(wc.querySelector(".historyDocTitle")).toBeNull();
  });

  test("clicking the card calls onOpen with the doc", () => {
    const onOpen = jest.fn();
    render(<HistorySourceCard doc={base} onOpen={onOpen} />);
    fireEvent.click(screen.getByText(/An early notice/));
    expect(onOpen).toHaveBeenCalledWith(base);
  });

  test("withBrackets splits editorial marks from plain text", () => {
    const out = withBrackets("a [b] c");
    expect(out.filter((p) => p && p.props && p.props.className === "editorialMark")).toHaveLength(1);
  });

  test("a money quote with no speaker renders bare (no attribution)", () => {
    const { container } = render(<HistorySourceCard doc={{ ...base, money_quote: "It is spoken of as the Golden Bible", quote_speaker: null }} onOpen={jest.fn()} />);
    expect(container.querySelector(".historyLead")).toBeInTheDocument();
    expect(screen.getByText(/It is spoken of as the Golden Bible/)).toBeInTheDocument();
    expect(container.querySelector(".money_quote_attribution")).toBeNull();
    expect(container.querySelector(".money_quote_speaker-prefix")).toBeNull();
  });
});
