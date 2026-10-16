import React from "react";
import { render, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppControllerProvider } from "src/contexts/AppControllerContext";

vi.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: vi.fn(),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
const flags = vi.hoisted(() => ({ messenger: true }));
vi.mock("src/models/featureFlags", async (importOriginal) => ({
  ...(await importOriginal()),
  isMessengerEnabled: () => flags.messenger,
}));
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import Sampler, { __resetCommunityMemo } from "../Sampler";

const samplerResp = { homesampler: [{ seed: 5, people: [{ slug: "abish", name: "Abish", title: "t" }], places: [] }] };
const communityResp = {
  homegroups: [{ url: "g1", name: "Study Circle", members: [], latest: { id: 1, timestamp: Date.now(), msg: "hello" } }],
  leaderboard: [],
};
const app = { states: { user: { token: null, user: null }, studyGroup: { groupList: [] } }, functions: {} };
const mount = () =>
  render(
    <AppControllerProvider appController={app}>
      <MemoryRouter>
        <Sampler />
      </MemoryRouter>
    </AppControllerProvider>,
  );

let community;
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  __resetCommunityMemo();
  flags.messenger = true;
  community = [];
  BoMOnlineAPI.mockImplementation((input) => {
    if (input && "homegroups" in input) return new Promise((res, rej) => community.push({ res, rej }));
    if (input && "homesampler" in input) return Promise.resolve(samplerResp);
    return Promise.resolve({});
  });
});

describe("community tile holds its slot (story audit community B2/E1)", () => {
  test("a skeleton reserves the community slot until the live fetch lands", async () => {
    const { container } = mount();
    await act(async () => {});
    expect(container.querySelector(".tile-community.skeleton")).toBeTruthy();
    await act(async () => community[0].res(communityResp));
    expect(container.querySelector(".tile-community.skeleton")).toBeNull();
    expect(container.querySelector(".tile-community .communityTile")).toBeTruthy();
  });

  test("a failed community fetch releases the skeleton", async () => {
    const { container } = mount();
    await act(async () => {});
    await act(async () => community[0].rej(new Error("down")));
    expect(container.querySelector(".tile-community")).toBeNull();
  });

  test("coming Back renders the last community payload at once (no re-insert)", async () => {
    const first = mount();
    await act(async () => {});
    await act(async () => community[0].res(communityResp));
    first.unmount();
    const { container } = mount();
    await act(async () => {});
    // the refetch is still in flight, yet the tile is already there
    expect(community.length).toBe(2);
    expect(container.querySelector(".tile-community .communityTile")).toBeTruthy();
  });

  test("messenger off: no fetch and no tile (its links would redirect to Home)", async () => {
    flags.messenger = false;
    const { container } = mount();
    await act(async () => {});
    expect(community.length).toBe(0);
    expect(container.querySelector(".tile-community")).toBeNull();
  });
});
