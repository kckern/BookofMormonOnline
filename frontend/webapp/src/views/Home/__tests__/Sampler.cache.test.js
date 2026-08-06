import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import Sampler from "../Sampler";
import { tileRegistry } from "../tiles/registry";
import { write as writeCache } from "../tiles/homeSamplerCache";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

const cachedSampler = {
  seed: 42,
  people: [{ slug: "nephi", name: "Nephi", title: "Prophet" }],
  places: [{ slug: "zarahemla", name: "Zarahemla", info: null }],
  contents: { slug: "1-nephi", title: "First Nephi", description: "The record of Nephi" },
};

const communityResp = {
  homegroups: [{ url: "g1", name: "Group One", latest: { id: 9, timestamp: Date.now(), msg: "hi", user: { nickname: "Sam" } } }],
  leaderboard: [{ currentProgress: [{ nickname: "Sam", progress: 50 }], recentFinishers: [] }],
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
    </AppControllerProvider>
  );

/** Did any BoMOnlineAPI call request the homesampler stream? */
const sawSamplerFetch = () =>
  BoMOnlineAPI.mock.calls.some(([input]) => input && "homesampler" in input);

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

describe("Sampler client cache", () => {
  test("paints instantly from a fresh cache with no homesampler network call", async () => {
    // community still fetches live; sampler must NOT
    BoMOnlineAPI.mockResolvedValue(communityResp);
    writeCache(cachedSampler, 42); // fresh: stamped with the current bucket

    renderSampler();

    // Synchronous first paint from cache — no await on the sampler fetch.
    expect(screen.getByText("Nephi")).toBeTruthy();
    expect(screen.getByText("Zarahemla")).toBeTruthy();

    await waitFor(() => {
      expect(sawSamplerFetch()).toBe(false);
    });
  });

  test("community arriving before the sampler does not blank the page (skeletons remain)", async () => {
    // sampler pending forever; community resolves immediately.
    BoMOnlineAPI.mockImplementation((input) => {
      if (input && "homesampler" in input) return new Promise(() => {});
      return Promise.resolve(communityResp);
    });

    renderSampler();

    // Let the community microtask flush, then assert the page is still all
    // skeletons — community must not force empty content tiles to render.
    await waitFor(() => {
      expect(document.querySelectorAll(".tile.skeleton").length).toBe(
        tileRegistry.length
      );
    });
    expect(screen.queryByText("Nephi")).toBeNull();
  });
});
