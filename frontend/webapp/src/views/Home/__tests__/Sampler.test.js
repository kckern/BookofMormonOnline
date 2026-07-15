import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppControllerProvider } from "src/contexts/AppControllerContext";
import Sampler, { assemblePayload } from "../Sampler";
import { tileRegistry } from "../tiles/registry";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
  assetUrl: "https://media.test",
  ApiBaseUrl: "http://localhost:5005",
}));
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

const payloadFixture = {
  homesampler: [{
    seed: 42,
    people: [{ slug: "nephi", name: "Nephi", title: "Prophet" }],
    places: [{ slug: "zarahemla", name: "Zarahemla", info: null }],
    fax: { slug: "1830", title: "1830 Edition", pages: 590, info: null },
    commentary: { id: "77", title: "On Faith", text: "x".repeat(600), preview: "…", publication: { source_title: "Journal" } },
    contents: { slug: "1-nephi", title: "First Nephi", description: "The record of Nephi" },
  }],
  homegroups: [{ url: "g1", name: "Group One", picture: "", members: [], latest: { id: 9, timestamp: 1e12, msg: "hello", user: { nickname: "Sam", picture: "" } } }],
  leaderboard: [{ currentProgress: [{ nickname: "Sam", picture: "", progress: 50 }], recentFinishers: [] }],
};

const fakeAppController = {
  states: {
    user: { token: null, user: null },
    studyGroup: { groupList: [] },
  },
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

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});

describe("tileRegistry contract", () => {
  test("every entry has key/component/span/isReady of the right types", () => {
    expect(tileRegistry.length).toBeGreaterThan(0);
    tileRegistry.forEach((entry) => {
      expect(typeof entry.key).toBe("string");
      expect(typeof entry.component).toBe("function");
      expect(typeof entry.span).toBe("string");
      expect(typeof entry.isReady).toBe("function");
    });
  });

  test("every data tile except readingplan is not ready for an empty payload", () => {
    tileRegistry
      .filter((entry) => entry.key !== "readingplan")
      .forEach((entry) => {
        expect(entry.isReady({})).toBeFalsy();
      });
  });
});

describe("Sampler shell rendering", () => {
  test("renders People and Places content plus at least 6 non-skeleton tiles", async () => {
    BoMOnlineAPI.mockResolvedValue(payloadFixture);
    renderSampler();

    expect(await screen.findByText("Nephi")).toBeTruthy();
    expect(screen.getByText("Zarahemla")).toBeTruthy();

    await waitFor(() => {
      const tiles = document.querySelectorAll(".tile:not(.skeleton)");
      expect(tiles.length).toBeGreaterThanOrEqual(6);
    });
  });

  test("hides the fax tile when payload.fax is null but still renders People", async () => {
    BoMOnlineAPI.mockResolvedValue({
      ...payloadFixture,
      homesampler: [{ ...payloadFixture.homesampler[0], fax: null }],
    });
    renderSampler();

    expect(await screen.findByText("Nephi")).toBeTruthy();
    await waitFor(() => {
      expect(document.querySelectorAll(".tile.skeleton").length).toBe(0);
    });
    expect(document.querySelector(".tile-fax")).toBeNull();
  });

  test("renders exactly tileRegistry.length skeletons while loading", async () => {
    BoMOnlineAPI.mockReturnValue(new Promise(() => {}));
    renderSampler();

    await waitFor(() => {
      expect(document.querySelectorAll(".tile.skeleton").length).toBe(
        tileRegistry.length
      );
    });
  });

  test("shows the fallback (footer, no data tiles) when the API returns the timeout sentinel", async () => {
    // BoMOnlineAPI resolves (not rejects) an {error} sentinel on timeout; both
    // the initial attempt and the single retry hit it → SamplerFallback.
    BoMOnlineAPI.mockResolvedValue({ error: { data: null } });
    renderSampler();

    await waitFor(() => {
      expect(document.querySelector(".samplerFallback")).toBeTruthy();
    });
    expect(document.querySelector(".samplerFooter")).toBeTruthy();
    expect(document.querySelector(".tile-people")).toBeNull();
    expect(document.querySelectorAll(".tile").length).toBe(0);
  });
});

describe("assemblePayload derivations", () => {
  test("activity lists the freshest messages (newest first) with channel urls", () => {
    const out = assemblePayload({
      homesampler: [{ seed: 1 }],
      homegroups: [
        { url: "old", latest: { timestamp: 100, msg: "old" } },
        { url: "new", latest: { timestamp: 200, msg: "new" } },
      ],
      leaderboard: [{ currentProgress: [], recentFinishers: [] }],
    });
    expect(out.activity).toHaveLength(2);
    expect(out.activity[0].msg).toBe("new");
    expect(out.activity[0].channel).toBe("new");
    expect(out.activity[1].msg).toBe("old");
  });

  test("spotlight combines a group with a deduped user list", () => {
    const out = assemblePayload({
      homesampler: [{ seed: 1 }],
      homegroups: [{ url: "g1", name: "G", latest: { timestamp: 1, msg: "hi" } }],
      leaderboard: [{
        currentProgress: [{ nickname: "Sam", progress: 5 }, { nickname: "Sam", progress: 5 }, { nickname: "Jo", progress: 9 }],
        recentFinishers: [],
      }],
    });
    expect(out.spotlight).toBeTruthy();
    expect(out.spotlight.group.url).toBe("g1");
    expect(out.spotlight.users.map((u) => u.nickname)).toEqual(["Sam", "Jo"]); // deduped
    expect(out.spotlight.usersLabel).toBe("leader_board");
  });

  test("empty inputs yield null activity and spotlight without throwing", () => {
    const out = assemblePayload({ homesampler: [{ seed: 1 }], homegroups: [], leaderboard: [] });
    expect(out.activity).toBeNull();
    expect(out.spotlight).toBeNull();
  });
});
