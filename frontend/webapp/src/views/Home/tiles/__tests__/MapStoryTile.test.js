import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MapStoryTile, {
  homeStoryTitle,
  playbackTiming,
} from "../MapStoryTile";

// OpenLayers requires a real canvas. This contract stub exposes all important
// state and callbacks owned by the tile without replacing their semantics.
jest.mock("../MapStoryTileInner", () => ({
  __esModule: true,
  default: ({ moves, step, complete, animate, playing, onSelectStep, onMapInteraction, onRecenter }) => (
    <div
      data-testid="map-canvas"
      data-step={step}
      data-complete={String(complete)}
      data-animate={String(animate)}
      data-playing={String(playing)}
      data-stop-names={moves.map((move) => `${move.startName}|${move.endName}`).join(",")}
    >
      <button type="button" data-testid="map-cluster" onClick={() => onSelectStep(1)}>cluster</button>
      <button type="button" data-testid="map-manipulate" onClick={onMapInteraction}>manipulate</button>
      <button type="button" data-testid="map-recenter" onClick={onRecenter}>recenter</button>
    </div>
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
      seq: 1,
      start: "jerusalem",
      end: "valley-of-lemuel",
      startName: "Jerusalem",
      endName: "Valley of Lemuel",
      people: [{ slug: "lehi", name: "Lehi" }, { slug: "nephi1", name: "Nephi" }],
      description: "Fled into the wilderness",
      duration: "3 days",
      ref: "1 Nephi 2:4",
      startLat: "18.1",
      startLng: "-87.2",
      endLat: "18.3",
      endLng: "-87.0",
    },
    {
      seq: 2,
      start: "valley-of-lemuel",
      end: "bountiful",
      startName: "Valley of Lemuel",
      endName: "Bountiful",
      people: [{ slug: "lehi", name: "Lehi" }],
      description: "Eight years in the wilderness",
      duration: "8 years",
      ref: "1 Nephi 17:4",
      startLat: "18.3",
      startLng: "-87.0",
      endLat: "18.6",
      endLng: "-86.7",
    },
  ],
};

let reduceMotion = false;

const renderTile = (story = data) =>
  render(
    <MemoryRouter>
      <MapStoryTile data={story} />
    </MemoryRouter>,
  );

const mapCanvas = () => screen.getByTestId("map-canvas");
const mapState = (name) => mapCanvas().getAttribute(`data-${name}`);

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: jest.fn(() => ({
      matches: reduceMotion,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
  });
});

beforeEach(() => {
  reduceMotion = false;
  window.matchMedia.mockImplementation(() => ({
    matches: reduceMotion,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }));
  jest.useFakeTimers();
  openScripture.mockClear();
  // The component now routes its strings through label(); seed the dictionary so
  // label() resolves to real English (it returns " " when the dictionary is unset).
  global.dictionary = {
    mapstory_play: "Play journey",
    mapstory_pause: "Pause journey",
    mapstory_summary: "Story summary",
    mapstory_move: "Move $1",
    mapstory_detached: "story resumes elsewhere",
    mapstory_detached_title: "This movement begins a new geographic run",
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
  test("communicates the whole journey before the user waits for playback", () => {
    renderTile();
    expect(screen.getByText("Lehi's Journey")).toBeTruthy();
    expect(screen.getByText("2 moves · 3 places")).toBeTruthy();
    expect(screen.getByText("Move 1 of 2")).toBeTruthy();
    expect(screen.getAllByText(/Jerusalem/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bountiful/).length).toBeGreaterThan(0);
  });

  test("paces each move for readability and gives content-rich beats more dwell", () => {
    const rich = playbackTiming({ description: "Eight years in the wilderness", ref: "1 Nephi 17:4" });
    const plain = playbackTiming({});
    expect(rich.travelMs).toBe(plain.travelMs);
    expect(rich.stepMs).toBeGreaterThan(plain.stepMs);
    expect(plain.stepMs).toBeGreaterThanOrEqual(3000);
    expect(plain.stepMs).toBe(plain.travelMs + 2000);
  });

  test("deep-links both title and CTA to the sampled story", () => {
    renderTile();
    expect(screen.getByRole("link", { name: "Lehi's Journey" }).getAttribute("href"))
      .toBe("/map/internal/story/lehis-journey");
    expect(screen.getByRole("link", { name: "Explore full journey" }).getAttribute("href"))
      .toBe("/map/internal/story/lehis-journey");
  });

  test("uses display names and does not leak place slugs", () => {
    renderTile();
    expect(screen.getAllByText(/Valley of Lemuel/).length).toBeGreaterThan(0);
    expect(screen.queryByText("valley-of-lemuel")).toBeNull();
  });

  test("corrects the known inverted Home title", () => {
    expect(homeStoryTitle("Recolonization Noah")).toBe("Noah’s Recolonization");
    renderTile({ ...data, title: "Recolonization Noah" });
    expect(screen.getByText("Noah’s Recolonization")).toBeTruthy();
  });

  test("opens the active move's scripture reference", () => {
    renderTile();
    fireEvent.click(screen.getByRole("button", { name: "1 Nephi 2:4" }));
    expect(openScripture).toHaveBeenCalledWith("1 Nephi 2:4");
  });

  test("returns null with fewer than two coordinate-complete moves", () => {
    const { container } = renderTile({ ...data, moves: data.moves.slice(0, 1) });
    expect(container.firstChild).toBeNull();
  });

  test("drops invalid geometry instead of taking down the map", () => {
    const invalid = { ...data, moves: [data.moves[0], { ...data.moves[1], endLat: "not-a-number" }] };
    const { container } = renderTile(invalid);
    expect(container.firstChild).toBeNull();
  });

  test("autoplay advances through each move and holds on completion instead of looping", () => {
    renderTile();
    const stepOne = playbackTiming(data.moves[0]).stepMs;
    const stepTwo = playbackTiming(data.moves[1]).stepMs;

    act(() => { jest.advanceTimersByTime(stepOne); });
    expect(mapState("step")).toBe("1");
    act(() => { jest.advanceTimersByTime(stepTwo); });
    expect(mapState("complete")).toBe("true");
    expect(screen.getAllByText("Journey complete").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Replay journey")).toBeTruthy();
    expect(screen.getByLabelText("Journey move").value).toBe(String(data.moves.length));

    act(() => { jest.advanceTimersByTime(stepOne + stepTwo + 10000); });
    expect(mapState("complete")).toBe("true");
    expect(mapState("step")).toBe("1");
  });

  test("pause freezes automatic progression and play resumes it", () => {
    renderTile();
    fireEvent.click(screen.getByLabelText("Pause journey"));
    act(() => { jest.advanceTimersByTime(60000); });
    expect(mapState("step")).toBe("0");
    expect(mapState("playing")).toBe("false");
    fireEvent.click(screen.getByLabelText("Play journey"));
    expect(mapState("playing")).toBe("true");
  });

  test("keyboard entry pauses automatic updates", () => {
    renderTile();
    fireEvent.keyDown(screen.getByTestId("map-story-tile"), { key: "Tab" });
    expect(screen.getByLabelText("Play journey")).toBeTruthy();
    expect(mapState("playing")).toBe("false");
  });

  test("previous, next, and the labeled scrubber select moves and pause", () => {
    renderTile();
    fireEvent.click(screen.getByLabelText("Next move"));
    expect(mapState("step")).toBe("1");
    expect(screen.getByText("Move 2 of 2")).toBeTruthy();
    expect(screen.getByLabelText("Play journey")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Previous move"));
    expect(mapState("step")).toBe("0");
    fireEvent.change(screen.getByLabelText("Journey move"), { target: { value: "2" } });
    expect(mapState("step")).toBe("1");
    expect(screen.getByLabelText("Journey move").getAttribute("aria-valuetext"))
      .toContain("Valley of Lemuel to Bountiful");
  });

  test("next from the last move enters the useful completed state", () => {
    renderTile();
    fireEvent.click(screen.getByLabelText("Next move"));
    fireEvent.click(screen.getByLabelText("Next move"));
    expect(mapState("complete")).toBe("true");
    expect(screen.getByLabelText("Next move").disabled).toBe(true);
  });

  test("replay returns to the first movement", () => {
    renderTile();
    fireEvent.click(screen.getByLabelText("Next move"));
    fireEvent.click(screen.getByLabelText("Next move"));
    fireEvent.click(screen.getByLabelText("Replay journey"));
    expect(mapState("complete")).toBe("false");
    expect(mapState("step")).toBe("0");
    expect(mapState("playing")).toBe("true");
  });

  test("map clusters can progressively jump to a future move", () => {
    renderTile();
    fireEvent.click(screen.getByTestId("map-cluster"));
    expect(mapState("step")).toBe("1");
    expect(mapState("playing")).toBe("false");
  });

  test("map manipulation pauses playback and exposes recovery context", () => {
    renderTile();
    fireEvent.click(screen.getByTestId("map-manipulate"));
    expect(screen.getByText("Playback paused while you explore the map.")).toBeTruthy();
    expect(mapState("playing")).toBe("false");
    fireEvent.click(screen.getByTestId("map-recenter"));
    expect(screen.queryByText("Playback paused while you explore the map.")).toBeNull();
  });

  test("shows only the selected beat instead of height-influencing hidden slides", () => {
    renderTile();
    expect(screen.getByText("Fled into the wilderness")).toBeTruthy();
    expect(screen.queryByText("Eight years in the wilderness")).toBeNull();
    fireEvent.click(screen.getByLabelText("Next move"));
    expect(screen.queryByText("Fled into the wilderness")).toBeNull();
    expect(screen.getByText("Eight years in the wilderness")).toBeTruthy();
  });

  test("keeps traveler identity in the text equivalent and active caption", () => {
    renderTile();
    expect(screen.getAllByText(/Lehi, Nephi/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Traveling:/).length).toBeGreaterThan(0);
  });

  test("explains discontinuities without drawing a fabricated connection", () => {
    const broken = {
      ...data,
      moves: [data.moves[0], { ...data.moves[1], start: "somewhere-else", startName: "Somewhere Else" }],
    };
    renderTile(broken);
    fireEvent.click(screen.getByLabelText("Next move"));
    expect(screen.getByText("story resumes elsewhere")).toBeTruthy();
  });

  test("reduced motion opens on a complete static route without automatic churn", () => {
    reduceMotion = true;
    renderTile();
    expect(mapState("animate")).toBe("false");
    expect(mapState("playing")).toBe("false");
    expect(mapState("complete")).toBe("true");
    expect(screen.getByLabelText("Journey move").value).toBe(String(data.moves.length));
    act(() => { jest.advanceTimersByTime(60000); });
    expect(mapState("complete")).toBe("true");
  });
});
