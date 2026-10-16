import React from "react";
import fs from "node:fs";
import path from "node:path";
import { act, cleanup as cleanupAll, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MapStoryTile, {
  homeStoryTitle,
  playbackTiming,
} from "../MapStoryTile";

// OpenLayers requires a real canvas. This contract stub exposes all important
// state and callbacks owned by the tile without replacing their semantics.
vi.mock("../MapStoryTileInner", () => ({
  __esModule: true,
  default: ({ moves, step, complete, animate, playing, onSelectStep, onMapInteraction, onRecenter }) => {
    if (globalThis.__throwMapStoryInner) throw new Error("ol exploded");
    return (
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
    );
  },
}));
vi.mock("src/views/_Common/ScripturePopup", () => ({
  __esModule: true,
  default: () => null,
  openScripture: vi.fn(),
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
    value: vi.fn(() => ({
      matches: reduceMotion,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
});

beforeEach(() => {
  reduceMotion = false;
  window.matchMedia.mockImplementation(() => ({
    matches: reduceMotion,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  vi.useFakeTimers();
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
  globalThis.__throwMapStoryInner = false;
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
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
    expect(screen.getByRole("link", { name: "Explore" }).getAttribute("href"))
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

    act(() => { vi.advanceTimersByTime(stepOne); });
    expect(mapState("step")).toBe("1");
    act(() => { vi.advanceTimersByTime(stepTwo); });
    expect(mapState("complete")).toBe("true");
    expect(screen.getAllByText("Journey complete").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Replay journey")).toBeTruthy();
    expect(screen.getByLabelText("Journey move").value).toBe(String(data.moves.length));

    act(() => { vi.advanceTimersByTime(stepOne + stepTwo + 10000); });
    expect(mapState("complete")).toBe("true");
    expect(mapState("step")).toBe("1");
  });

  test("pause freezes automatic progression and play resumes it", () => {
    renderTile();
    fireEvent.click(screen.getByLabelText("Pause journey"));
    act(() => { vi.advanceTimersByTime(60000); });
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
    act(() => { vi.advanceTimersByTime(60000); });
    expect(mapState("complete")).toBe("true");
  });

  test("shows start and end place thumbnails in the active move card", () => {
    const { container } = renderTile();
    expect(container.querySelector('img[src$="/places/jerusalem"]')).toBeTruthy();
    expect(container.querySelector('img[src$="/places/valley-of-lemuel"]')).toBeTruthy();
  });
});

test("MapStoryTileInner never shadows the global Map", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../MapStoryTileInner.js"), "utf8");
  expect(src).not.toMatch(/import\s+Map\s+from\s+["']ol\/Map["']/);
  expect(src).toMatch(/import\s+OlMap\s+from\s+["']ol\/Map["']/);
});

describe("MapStoryTile — Task 10h regressions", () => {
  test("empty and minimal payloads collapse or render without undefined/NaN/broken images", () => {
    const { container: c1 } = renderTile(null);
    expect(c1.firstChild).toBeNull();
    cleanupAll();
    const { container: c2 } = renderTile({ slug: "x", moves: [] });
    expect(c2.firstChild).toBeNull();
    cleanupAll();
    const bare = (s, e, a, b) => ({ start: s, end: e, startLat: a, startLng: a, endLat: b, endLng: b });
    const { container } = renderTile({ slug: "bare", title: "", moves: [bare("a", "b", 1, 2), bare("b", "c", 2, 3)] });
    expect(container.textContent).not.toMatch(/undefined|NaN|null/);
    container.querySelectorAll("img").forEach((img) => expect(img.getAttribute("src")).not.toMatch(/undefined|null/));
  });

  test("no raw i18n keys leak when the labels table lacks the mapstory_* rows", () => {
    global.dictionary = { map: "Map" }; // label() echoes unknown keys
    const { container } = renderTile();
    const attrs = [...container.querySelectorAll("*")].flatMap((el) =>
      ["aria-label", "title", "aria-valuetext"].map((a) => el.getAttribute(a) || ""));
    expect(container.textContent + attrs.join(" ")).not.toMatch(/mapstory_|view_more|\bexplore\b/);
    expect(screen.getByLabelText("Pause journey")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(60000); });
    expect(container.textContent).not.toMatch(/mapstory_/);
    expect(container.textContent).toMatch(/2 moves · 3 places/);
  });

  test("the Layer-2 CTA uses the TileCTA explore verb", () => {
    const { container } = renderTile();
    const cta = container.querySelector(".mapStoryFooter .tileCTA");
    expect(cta.textContent.trim()).toBe("Explore");
    expect(cta.getAttribute("href")).toBe("/map/internal/story/lehis-journey");
  });

  test("disambiguation digits render as superscripts, never 'Alma2'", () => {
    const story = { ...data, moves: data.moves.map((m) => ({ ...m, people: [{ slug: "alma2", name: "Alma2" }] })) };
    const { container } = renderTile(story);
    expect(container.textContent).not.toMatch(/Alma2/);
    expect(container.textContent).toMatch(/Alma²/);
  });

  test("inverted Recolonization titles read naturally", () => {
    expect(homeStoryTitle("Recolonization Limhi")).toBe("Limhi’s Recolonization");
  });

  test("a round trip reads 'Round trip from X', not 'X → X'", () => {
    const story = { ...data, moves: [data.moves[0], { ...data.moves[1], end: "jerusalem", endName: "Jerusalem" }] };
    const { container } = renderTile(story);
    expect(container.textContent).not.toMatch(/Jerusalem\s*→\s*Jerusalem/);
    expect(container.textContent).toMatch(/Round trip from Jerusalem/);
  });

  test("when the map boundary trips, autoplay stops and the transport hides", () => {
    globalThis.__throwMapStoryInner = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = renderTile();
    spy.mockRestore();
    expect(container.querySelector(".mapStoryFallback")).toBeTruthy();
    expect(container.querySelector(".mapStoryControls")).toBeNull();
    expect(container.querySelector(".mapStoryPlaybackStatus")).toBeNull();
    const before = container.textContent;
    act(() => { vi.advanceTimersByTime(60000); });
    expect(container.textContent).toBe(before);
  });

  test("autoplay stops while the tab is hidden and resumes when it is visible again", () => {
    renderTile();
    expect(mapState("playing")).toBe("true");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(mapState("playing")).toBe("false");
    act(() => { vi.advanceTimersByTime(60000); });
    expect(mapState("step")).toBe("0");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(mapState("playing")).toBe("true");
  });

  test("autoplay stops while the tile is offscreen", () => {
    let cb;
    const prev = global.IntersectionObserver;
    global.IntersectionObserver = class { constructor(fn) { cb = fn; } observe() {} disconnect() {} };
    try {
      renderTile();
      act(() => cb([{ isIntersecting: true, intersectionRatio: 1 }]));
      expect(mapState("playing")).toBe("true");
      act(() => cb([{ isIntersecting: false, intersectionRatio: 0 }]));
      expect(mapState("playing")).toBe("false");
      act(() => { vi.advanceTimersByTime(60000); });
      expect(mapState("step")).toBe("0");
    } finally {
      global.IntersectionObserver = prev;
    }
  });

  test("thumbnails and the place images go through TileImage (srcset-capable)", () => {
    const { container } = renderTile();
    const thumbs = container.querySelectorAll("img.mapStoryPlaceThumb");
    expect(thumbs.length).toBe(2);
    thumbs.forEach((img) => expect(img.classList.contains("tileImage")).toBe(true));
  });
});

describe("MapStory source/CSS guards", () => {
  const inner = fs.readFileSync(path.resolve(__dirname, "../MapStoryTileInner.js"), "utf8");
  const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");
  test("cluster keys cannot collide (no bare key={cluster.id})", () => {
    expect(inner).not.toMatch(/key=\{cluster\.id\}/);
  });
  test("overlay registries are lazily initialized (no Map construction per render)", () => {
    expect(inner).not.toMatch(/useRef\(\s*new Map\(\)/);
    expect(inner).not.toMatch(/useRef\(\{\s*markers:\s*new Map/);
  });
  test("no off-palette blue/oxblood/green chrome in the MapStory CSS", () => {
    const block = css.split("\n").filter((l) => /mapStory|mapTileFrame/.test(l) || true).join("\n");
    const start = block.indexOf("---- map-story tile");
    const end = block.indexOf("Multi-edition cropped-verse");
    const story = block.slice(start, end);
    expect(story.length).toBeGreaterThan(100);
    expect(story).not.toMatch(/#45679e|69,\s*103,\s*158|#96362f|#2f6749|#397054|#8b2f29|#8b302a|#7f2d28|#2e5943|#9f3932|#c85a51|#b95850/i);
  });
});

describe("MapStoryTile — story audit fixes (2026-10-16)", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");
  const rule = (sel) => {
    const i = css.indexOf(`${sel} {`);
    return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
  };

  test("C4/H3: the move description is an in-place Read more, not a dead CSS clamp", () => {
    const long = Array.from({ length: 80 }, (_, i) => `w${i}`).join(" ");
    const { container } = renderTile({ ...data, moves: data.moves.map((m) => ({ ...m, description: long })) });
    const desc = container.querySelector(".mapStoryDesc");
    expect(desc.querySelector(".clampLines")).toBeTruthy();
    expect(rule(".mapStoryTile .mapStoryDesc")).not.toMatch(/line-clamp/);
  });

  test("clicking inside the beat card (Read more, ref) pauses autoplay", () => {
    const { container } = renderTile();
    act(() => { vi.advanceTimersByTime(10); });
    fireEvent.click(container.querySelector(".mapStoryStage"));
    expect(mapState("playing")).toBe("false");
  });

  test("B2: the paused hint lives inside the map frame (no tile growth)", () => {
    const { container } = renderTile();
    fireEvent.click(screen.getByTestId("map-manipulate"));
    const hint = screen.getByText("Playback paused while you explore the map.");
    expect(container.querySelector(".mapTileFrame").contains(hint)).toBe(true);
  });

  test("A1: the title wraps to two lines instead of a one-line ellipsis", () => {
    const t = rule(".mapStoryTitle");
    expect(t).not.toMatch(/white-space:\s*nowrap/);
    expect(t).toMatch(/line-clamp:\s*2/);
  });

  test("C5: the scrubber gets the gold house focus ring", () => {
    expect(rule(".mapStoryScrubber:focus-visible")).toMatch(/outline:\s*2px solid #c9a24b/);
  });

  test("F2: coarse pointers get a 44px scrubber", () => {
    expect(css).toMatch(/@media \(pointer: coarse\)\s*\{[^}]*\.mapStoryScrubber\s*\{\s*height:\s*44px/);
  });

  test("A4: gold stays on the primary action; scrubber fill and the complete mark are neutral", () => {
    expect(rule(".mapStoryScrubber::-webkit-slider-runnable-track")).not.toMatch(/#c9a24b/);
    expect(rule(".mapStoryScrubber::-webkit-slider-thumb")).not.toMatch(/#c9a24b/);
    expect(rule(".mapStoryCompleteMark")).not.toMatch(/#c9a24b/);
    // Visited reads as a hollow ring, not a second near-identical red dot
    expect(rule(".mapStoryLegend i.isVisited")).toMatch(/background:\s*transparent/);
  });
});

// Story audit A2: labels collided on screen although the collision solver
// placed them apart. syncOverlay writes left/top straight to the DOM every
// frame; after the settle-time layout, React skipped rewriting a style whose
// prop value had not changed since ITS last render, so the DOM kept a stale,
// mid-animation position. The settled overlay must be pushed to the DOM.
test("MapStoryTileInner re-syncs the DOM overlay whenever a new layout lands", () => {
  const inner = fs.readFileSync(path.resolve(__dirname, "../MapStoryTileInner.js"), "utf8");
  expect(inner).toMatch(/useLayoutEffect\(\(\) => \{\s*syncOverlayRef\.current\?\.\(\);?\s*\}, \[overlay\]\)/);
});
