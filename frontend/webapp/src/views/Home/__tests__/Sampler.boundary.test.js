import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import Sampler, { assemblePayload } from "../Sampler";
import { tileRegistry } from "../tiles/registry";
import { write as writeCache } from "../tiles/homeSamplerCache";
import { writeSession } from "../tiles/samplerSession";
import { skeletonHeight } from "../tiles/_ds/skeletonHeights";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

// The fax tile throws on render wherever it appears (first batch, reserves and
// infinite batches); every other tile is the real component.
vi.mock("../tiles/registry", async (importOriginal) => {
  const real = await importOriginal();
  const Boom = () => {
    throw new Error("boom");
  };
  const swap = (list) => list.map((t) => (t.key === "fax" ? { ...t, component: Boom } : t));
  return {
    ...real,
    tileRegistry: swap(real.tileRegistry),
    reservePool: swap(real.reservePool),
    batchTiles: swap(real.batchTiles),
  };
});

const sampler = {
  seed: 42,
  people: [{ slug: "nephi", name: "Nephi", title: "Prophet", description: "Son of Lehi; kept the small plates." }],
  places: [{ slug: "zarahemla", name: "Zarahemla", info: null }],
  fax: { slug: "1830", title: "1830 Edition", pages: 590, info: null },
  commentary: { id: "77", title: "On Faith", text: "x".repeat(600), preview: "…", publication: { source_title: "Journal" } },
  contents: { slug: "1-nephi", title: "First Nephi", description: "The record of Nephi" },
};

const fakeAppController = {
  states: { user: { token: null, user: null }, studyGroup: { groupList: [] } },
  functions: {},
};

const renderSampler = () =>
  render(
    <AppControllerProvider appController={fakeAppController}>
      <MemoryRouter>
        <Sampler />
      </MemoryRouter>
    </AppControllerProvider>,
  );

let warn;
let error;
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
});

describe("per-tile error boundary", () => {
  test("a throwing tile disappears with no shell; the rest of the grid survives", async () => {
    BoMOnlineAPI.mockResolvedValue({ homesampler: [sampler], homegroups: [], leaderboard: [] });
    renderSampler();

    expect(await screen.findByText("Nephi")).toBeTruthy();
    const payload = assemblePayload({ homesampler: [sampler], homegroups: [], leaderboard: [] });
    const ready = tileRegistry.filter((t) => t.isReady(payload)).length;
    await waitFor(() => {
      expect(document.querySelectorAll(".tile.skeleton").length).toBe(0);
      expect(document.querySelectorAll(".tile").length).toBe(ready - 1);
    });
    expect(document.querySelector(".tile-fax")).toBeNull();
    expect(screen.getByText("Zarahemla")).toBeTruthy();
    expect(warn).toHaveBeenCalledWith("tile crashed:", "fax", expect.any(Error));
  });

  test("two restored infinite batches render with no duplicate React keys", async () => {
    BoMOnlineAPI.mockReturnValue(new Promise(() => {}));
    writeCache(sampler, 42);
    const batch = (seed) => ({
      payload: { ...sampler, seed },
      tiles: ["places", "personProfile", "placeProfile", "fax"],
    });
    writeSession({
      seed: 42,
      order: tileRegistry.map((t) => t.key).filter((k) => !["readingplan", "section", "contents", "people", "mapstory"].includes(k)),
      reserves: [],
      batches: [batch(101), batch(202)],
      batchSeed: 202,
    });
    renderSampler();

    await waitFor(() => {
      // places + personProfile + placeProfile per batch; the throwing fax collapses
      expect(document.querySelectorAll(".tile.infiniteTile").length).toBe(6);
    });
    const keyWarnings = error.mock.calls.filter((args) => args.some((a) => /same key/.test(String(a))));
    expect(keyWarnings).toEqual([]);
    expect(warn).toHaveBeenCalledWith("tile crashed:", "fax", expect.any(Error));
  });
});

describe("skeleton sizing table", () => {
  test("measured spans get their own height; unknown spans fall back to 14rem", () => {
    expect(skeletonHeight("tile-readingplan", false)).toBe("233px");
    expect(skeletonHeight("tile-unknown", false)).toBe("14rem");
    expect(skeletonHeight("tile-unknown", true)).toBe("14rem");
    // phone overrides exist where the stacked footprint differs
    expect(skeletonHeight("tile-mattersNarrative", true)).not.toBe(skeletonHeight("tile-mattersNarrative", false));
  });

  test("every loading skeleton carries the table height inline", async () => {
    BoMOnlineAPI.mockReturnValue(new Promise(() => {}));
    renderSampler();
    await waitFor(() => {
      expect(document.querySelectorAll(".tile.skeleton").length).toBe(tileRegistry.length);
    });
    document.querySelectorAll(".tile.skeleton").forEach((el) => {
      const span = [...el.classList].find((c) => c.startsWith("tile-"));
      expect(el.style.minHeight).toBe(skeletonHeight(span, false));
    });
  });
});
