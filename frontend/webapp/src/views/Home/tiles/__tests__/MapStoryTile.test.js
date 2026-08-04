import React from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MapStoryTile from "../MapStoryTile";

// The inner map is OpenLayers — mock it out (jsdom has no canvas); the lazy
// import resolves to this stub. It echoes its props so the playhead wiring is
// observable without a real map.
jest.mock("../MapStoryTileInner", () => ({
  __esModule: true,
  default: ({ step, animate }) => (
    <div data-testid="map-canvas" data-step={step} data-animate={String(animate)} />
  ),
}));
jest.mock("src/views/_Common/ScripturePopup", () => ({
  __esModule: true,
  default: () => null,
  openScripture: jest.fn(),
}));
import { openScripture } from "src/views/_Common/ScripturePopup";

const data = {
  slug: "lehis-journey",
  title: "Lehi's Journey",
  description: "From Jerusalem to the promised land",
  moves: [
    {
      seq: 1, start: "jerusalem", end: "valley-of-lemuel",
      startName: "Jerusalem", endName: "Valley of Lemuel",
      people: [{ slug: "lehi", name: "Lehi" }, { slug: "nephi1", name: "Nephi" }],
      description: "Fled into the wilderness", duration: "3 days", ref: "1 Nephi 2:4",
      startLat: "18.1", startLng: "-97.2", endLat: "18.3", endLng: "-97.0",
    },
    {
      seq: 2, start: "valley-of-lemuel", end: "bountiful",
      startName: "Valley of Lemuel", endName: "Bountiful",
      people: [{ slug: "lehi", name: "Lehi" }],
      description: "Eight years in the wilderness", duration: "8 years", ref: "1 Nephi 17:4",
      startLat: "18.3", startLng: "-97.0", endLat: "18.6", endLng: "-96.7",
    },
  ],
};

const renderTile = (d) =>
  render(
    <MemoryRouter>
      <MapStoryTile data={d} />
    </MemoryRouter>
  );

const stepOf = () => screen.getByTestId("map-canvas").getAttribute("data-step");

// jsdom has no IntersectionObserver; the tile falls back to "visible" so
// playback runs. Freeze timers so it doesn't advance unless a test asks.
beforeEach(() => {
  jest.useFakeTimers();
  openScripture.mockClear();
  // The component now routes its strings through label(); seed the dictionary so
  // label() resolves to real English (it returns " " when the dictionary is unset).
  global.dictionary = {
    mapstory_play: "Play journey",
    mapstory_pause: "Pause journey",
    mapstory_summary: "Story summary",
    mapstory_move: "Move $1",
    mapstory_detached: "not continuous",
    mapstory_detached_title: "This move does not continue from the previous one",
    mapstory_meta: "$1 moves · $2 places",
    map: "Map",
    view_more: "View more",
  };
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  delete global.dictionary;
});

describe("MapStoryTile", () => {
  test("renders each move as a card with display names, not slugs", () => {
    renderTile(data);
    expect(screen.getAllByText(/Jerusalem/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bountiful/).length).toBeGreaterThan(0);
    // The raw slug must not leak into the UI.
    expect(screen.queryByText("valley-of-lemuel")).toBeNull();
  });

  test("move ref opens the scripture popup", () => {
    renderTile(data);
    fireEvent.click(screen.getByText("1 Nephi 2:4"));
    expect(openScripture).toHaveBeenCalledWith("1 Nephi 2:4");
  });

  test("renders the lazy map canvas", async () => {
    renderTile(data);
    expect(await screen.findByTestId("map-canvas")).toBeTruthy();
  });

  test("returns null with fewer than 2 moves", () => {
    const { container } = renderTile({ ...data, moves: data.moves.slice(0, 1) });
    expect(container.firstChild).toBeNull();
  });

  test("exposes a pause control (WCAG 2.2.2 — auto-updating content)", () => {
    renderTile(data);
    expect(screen.getByLabelText("Pause journey")).toBeTruthy();
  });

  test("advances the playhead on a timer and loops through the title card", () => {
    renderTile(data);
    expect(stepOf()).toBe("0");

    act(() => { jest.advanceTimersByTime(5500); });
    expect(stepOf()).toBe("1");

    act(() => { jest.advanceTimersByTime(5500); });
    // 2 moves → step 2 is the title card.
    expect(stepOf()).toBe("2");

    act(() => { jest.advanceTimersByTime(3500); });
    expect(stepOf()).toBe("0");
  });

  test("pausing stops the playhead", () => {
    renderTile(data);
    fireEvent.click(screen.getByLabelText("Pause journey"));
    act(() => { jest.advanceTimersByTime(20000); });
    expect(stepOf()).toBe("0");
    expect(screen.getByLabelText("Play journey")).toBeTruthy();
  });

  test("one step dot per move plus the title card; clicking pins and pauses", () => {
    renderTile(data);
    const dots = screen.getAllByRole("button", { name: /^(Move \d+|Story summary)$/ });
    expect(dots).toHaveLength(data.moves.length + 1);

    fireEvent.click(screen.getByLabelText("Story summary"));
    expect(stepOf()).toBe("2");
    act(() => { jest.advanceTimersByTime(20000); });
    expect(stepOf()).toBe("2");
  });

  test("flags a move that does not continue from the previous one", () => {
    const broken = {
      ...data,
      moves: [
        data.moves[0],
        { ...data.moves[1], start: "somewhere-else", startName: "Somewhere Else" },
      ],
    };
    renderTile(broken);
    expect(screen.getByText("not continuous")).toBeTruthy();
  });

  test("no discontinuity flag on a continuous story", () => {
    renderTile(data);
    expect(screen.queryByText("not continuous")).toBeNull();
  });

  test("renders traveler avatars for the active move", () => {
    renderTile(data);
    // Lehi travels on both moves, and both are inside the image window at step 0.
    expect(screen.getAllByAltText("Lehi").length).toBeGreaterThan(0);
    expect(screen.getByAltText("Nephi")).toBeTruthy();
  });

  // Place images run 358–399 KB and avatars up to 233 KB, so a long story must
  // not fetch every card's imagery on mount.
  test("only loads imagery within a window around the active step", () => {
    const far = {
      ...data,
      moves: [
        data.moves[0],
        { ...data.moves[1], seq: 2 },
        {
          seq: 3, start: "bountiful", end: "promised-land",
          startName: "Bountiful", endName: "Promised Land",
          people: [{ slug: "jacob", name: "Jacob" }],
          description: "Crossed the sea", ref: "1 Nephi 18:23",
          startLat: "18.6", startLng: "-96.7", endLat: "19.0", endLng: "-96.0",
        },
      ],
    };
    renderTile(far);
    // Step 0: moves 0 and 1 are in window, move 2 is not.
    expect(screen.getByAltText("Valley of Lemuel")).toBeTruthy();
    expect(screen.queryByAltText("Promised Land")).toBeNull();
    expect(screen.queryByAltText("Jacob")).toBeNull();

    act(() => { jest.advanceTimersByTime(5500); });
    act(() => { jest.advanceTimersByTime(5500); });
    // Step 2 now active — its imagery loads.
    expect(screen.getByAltText("Promised Land")).toBeTruthy();
  });

  test("survives a move with no travelers", () => {
    const noPeople = { ...data, moves: data.moves.map((m) => ({ ...m, people: [] })) };
    expect(() => renderTile(noPeople)).not.toThrow();
    expect(screen.getAllByText(/Jerusalem/).length).toBeGreaterThan(0);
  });
});
