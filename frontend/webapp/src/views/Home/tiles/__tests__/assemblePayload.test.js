import { assemblePayload } from "../../Sampler";

const NOW = Date.now();

const baseResponse = () => ({
  homesampler: [
    {
      people: [{ slug: "alma" }],
      commentaries: [{ id: 1 }, { id: 2 }, { id: 3 }],
    },
  ],
  homegroups: [
    {
      url: "g1",
      name: "Group One",
      picture: "p1",
      members: [{ user_id: 1 }],
      latest: { id: "m1", timestamp: NOW, msg: "Hello there", user: { nickname: "Al" } },
    },
    {
      url: "g2",
      name: "Group Two",
      picture: "p2",
      members: [],
      latest: { id: "m2", timestamp: NOW - 1000, msg: "Bob joined", user: { nickname: "Bob" } },
    },
  ],
  leaderboard: [
    {
      recentFinishers: [{ nickname: "Fin" }, { nickname: "Fin" }, { nickname: "Nia" }],
      currentProgress: [{ nickname: "Reader", progress: 40 }],
    },
  ],
});

describe("assemblePayload", () => {
  test("spreads the three commentaries into commentary / commentary2 / commentary3", () => {
    const p = assemblePayload(baseResponse());
    expect(p.commentary).toEqual({ id: 1 });
    expect(p.commentary2).toEqual({ id: 2 });
    expect(p.commentary3).toEqual({ id: 3 });
  });

  test("passes through the sampler's own fields", () => {
    const p = assemblePayload(baseResponse());
    expect(p.people).toEqual([{ slug: "alma" }]);
  });

  test("builds a community block sorted by recency", () => {
    const p = assemblePayload(baseResponse());
    expect(p.community.groups.map((g) => g.url)).toEqual(["g1", "g2"]);
  });

  test("drops join/left system messages from the message strip", () => {
    const p = assemblePayload(baseResponse());
    // g2's latest ("Bob joined") is a membership event → excluded; only g1 remains
    expect(p.community.messages).toHaveLength(1);
    expect(p.community.messages[0].channel).toBe("g1");
  });

  test("marks a recent message fresh and an old one stale", () => {
    const p = assemblePayload(baseResponse());
    expect(p.community.messages[0].fresh).toBe(true);
  });

  test("dedupes finishers and readers by nickname", () => {
    const p = assemblePayload(baseResponse());
    expect(p.community.finishers.map((u) => u.nickname)).toEqual(["Fin", "Nia"]);
    expect(p.community.reading).toHaveLength(1);
  });

  test("community is null when there are no groups and no finishers", () => {
    const empty = {
      homesampler: [{}],
      homegroups: [],
      leaderboard: [{ recentFinishers: [], currentProgress: [] }],
    };
    expect(assemblePayload(empty).community).toBeNull();
  });

  test("tolerates a wholly empty response", () => {
    expect(() => assemblePayload({})).not.toThrow();
    expect(assemblePayload({}).community).toBeNull();
  });
});
