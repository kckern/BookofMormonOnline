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

describe("assemblePayload community derivation", () => {
  test("liveliest group leads; fresh messages carry group chips; finishers dedupe", () => {
    const now = Date.now();
    const out = assemblePayload({
      homesampler: [{ seed: 1 }],
      homegroups: [
        { url: "old", name: "Old", latest: { timestamp: now - 1000, msg: "hello" } },
        { url: "new", name: "New", latest: { timestamp: now, msg: "newest" } },
      ],
      leaderboard: [{ currentProgress: [], recentFinishers: [{ nickname: "Jo" }, { nickname: "Jo" }, { nickname: "Sam" }] }],
    });
    expect(out.community.groups[0].url).toBe("new");
    expect(out.community.messages[0].msg).toBe("newest");
    expect(out.community.messages[0].groupName).toBe("New");
    expect(out.community.messages[0].fresh).toBe(true);
    expect(out.community.finishers.map((u) => u.nickname)).toEqual(["Jo", "Sam"]);
  });

  test("stale messages are unfresh; membership system events filtered; reading fallback kept", () => {
    const out = assemblePayload({
      homesampler: [{ seed: 1 }],
      homegroups: [
        { url: "g", name: "G", latest: { timestamp: 1000, msg: "old msg" } },
        { url: "j", name: "J", latest: { timestamp: Date.now(), msg: "bob joined." } },
      ],
      leaderboard: [{ currentProgress: [{ nickname: "Sam", progress: 5 }], recentFinishers: [] }],
    });
    expect(out.community.messages).toHaveLength(1);
    expect(out.community.messages[0].fresh).toBe(false);
    expect(out.community.reading[0].nickname).toBe("Sam");
  });

  test("empty inputs yield null community without throwing", () => {
    const out = assemblePayload({ homesampler: [{ seed: 1 }], homegroups: [], leaderboard: [] });
    expect(out.community).toBeNull();
  });
});
