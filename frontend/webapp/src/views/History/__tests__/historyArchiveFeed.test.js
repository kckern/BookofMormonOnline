/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { useAppController } from "src/contexts/AppControllerContext";
import HistoryArchiveFeed, { groupByYearAscending, principalOptions } from "../HistoryArchiveFeed";

jest.mock("src/models/BoMOnlineAPI", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("src/contexts/AppControllerContext");

const MULTI = [
  { slug: "a", id: 1, event_year: 1830, seq: 2, date: "1830-03-26", principal: "Joseph Smith, Jr.", document: "Doc A", citation: "Cite A.", money_quote: "I translated by the gift of God", quote_speaker: "Joseph Smith, Jr.", quote_is_witness_voice: true },
  { slug: "b", id: 2, event_year: 1829, seq: 1, date: "1829", principal: "Oliver Cowdery", document: "Doc B", citation: "Cite B.", money_quote: "day of days", quote_speaker: "Oliver Cowdery", quote_is_witness_voice: true },
  { slug: "c", id: 3, event_year: 1830, seq: 1, date: "1830", principal: "David Whitmer", document: "Doc C", citation: "Cite C.", money_quote: "a seer stone", quote_speaker: "David Whitmer", quote_is_witness_voice: true },
];
const SINGLE = [
  { slug: "j1", event_year: 1830, seq: 1, date: "1830", principal: "Joseph Smith", document: "JS 1", citation: "C1.", money_quote: "by the gift and power of God" },
  { slug: "j2", event_year: 1831, seq: 1, date: "1831", principal: "Joseph Smith", document: "JS 2", citation: "C2.", money_quote: "the fulness of the everlasting gospel" },
];

describe("archive feed helpers", () => {
  test("groupByYearAscending buckets ascending, seq-ordered within a year", () => {
    const buckets = groupByYearAscending(MULTI);
    expect(buckets.map((x) => x.year)).toEqual([1829, 1830]);
    expect(buckets[1].items.map((d) => d.slug)).toEqual(["c", "a"]);
  });
  test("groupByYearAscending puts undated docs last", () => {
    const buckets = groupByYearAscending([...MULTI, { slug: "z", seq: 0 }]);
    expect(buckets[buckets.length - 1].year).toBeNull();
    expect(buckets[buckets.length - 1].items[0].slug).toBe("z");
  });
  test("principalOptions returns distinct principals with counts, most-frequent first", () => {
    const opts = principalOptions([...MULTI, { principal: "Joseph Smith, Jr." }]);
    expect(opts[0]).toEqual(["Joseph Smith, Jr.", 2]);
    expect(opts.map((o) => o[0])).toContain("Oliver Cowdery");
  });
});

describe("HistoryArchiveFeed view", () => {
  const setPopUp = jest.fn();
  beforeEach(() => {
    useAppController.mockReturnValue({ functions: { setPopUp } });
  });
  const setup = (archive, sectionKey) =>
    render(
      <MemoryRouter>
        <HistoryArchiveFeed archive={archive} sectionKey={sectionKey} />
      </MemoryRouter>
    );

  test("renders year headers, the section title, and a money-quote card per account", async () => {
    BoMOnlineAPI.mockResolvedValue({ history: MULTI });
    setup("translation", "translation");
    await waitFor(() => expect(screen.getByRole("heading", { name: "1829" })).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: /Translation Sources/ })).toBeInTheDocument();
    expect(screen.getByText(/I translated by the gift of God/)).toBeInTheDocument();
  });

  test("the person filter narrows to one voice (multi-principal archive)", async () => {
    BoMOnlineAPI.mockResolvedValue({ history: MULTI });
    setup("translation", "translation");
    await waitFor(() => expect(screen.getByText(/a seer stone/)).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "David Whitmer" } });
    expect(screen.getByText(/a seer stone/)).toBeInTheDocument();
    expect(screen.queryByText(/I translated by the gift of God/)).toBeNull();
  });

  test("the filter is hidden for a single-principal archive (joseph)", async () => {
    BoMOnlineAPI.mockResolvedValue({ history: SINGLE });
    setup("joseph-smith-statements", "josephSmith");
    await waitFor(() => expect(screen.getByText(/by the gift and power of God/)).toBeInTheDocument());
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText(/the fulness of the everlasting gospel/)).toBeInTheDocument();
  });

  test("clicking a card opens the history popup with the section's underSlug", async () => {
    BoMOnlineAPI.mockResolvedValue({ history: MULTI });
    setup("translation", "translation");
    await waitFor(() => expect(screen.getByText(/day of days/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/day of days/));
    expect(setPopUp).toHaveBeenCalledWith(
      expect.objectContaining({ type: "history", ids: ["b"], underSlug: "history/translation" })
    );
  });
});
