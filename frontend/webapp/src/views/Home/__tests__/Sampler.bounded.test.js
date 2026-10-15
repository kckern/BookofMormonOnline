import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import Sampler from "../Sampler";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

const sampler = {
  seed: 42,
  people: [{ slug: "nephi", name: "Nephi", title: "Prophet" }],
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

const setSingle = (matches) => {
  window.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: q === "(max-width: 900px)" ? matches : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

const original = window.matchMedia;
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  window.matchMedia = original;
});

describe("single-column height bound", () => {
  test("phone: contents tile is a visible boundedTile, not a silent clip", async () => {
    setSingle(true);
    BoMOnlineAPI.mockResolvedValue({ homesampler: [sampler], homegroups: [], leaderboard: [] });
    renderSampler();
    expect(await screen.findByText("First Nephi")).toBeTruthy();
    const tile = document.querySelector(".tile.tile-contents");
    expect(tile.classList.contains("boundedTile")).toBe(true);
    // the people tile is not bounded
    expect(document.querySelector(".tile.tile-people").classList.contains("boundedTile")).toBe(false);
  });

  test("desktop: no bound on the rail fixtures", async () => {
    setSingle(false);
    BoMOnlineAPI.mockResolvedValue({ homesampler: [sampler], homegroups: [], leaderboard: [] });
    renderSampler();
    expect(await screen.findByText("First Nephi")).toBeTruthy();
    expect(document.querySelector(".tile.tile-contents").classList.contains("boundedTile")).toBe(false);
  });
});
