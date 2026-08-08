import { framedLegIndices, legVisibility, legsOf, stopsOf, stopStateAt } from "../mapStoryPath";

// Modelled on the real Alma 2 "Amlicite War" rows: zarahemla is revisited, and
// move 3 starts at hill-amnihu although move 2 ended at valley-of-gideon.
const amlicite = [
  { seq: 1, start: "zarahemla", end: "hill-amnihu", startName: "Zarahemla", endName: "Hill Amnihu", startLat: 1, startLng: 1, endLat: 2, endLng: 2 },
  { seq: 2, start: "hill-amnihu", end: "valley-of-gideon", startName: "Hill Amnihu", endName: "Valley of Gideon", startLat: 2, startLng: 2, endLat: 3, endLng: 3 },
  { seq: 3, start: "hill-amnihu", end: "minon", startName: "Hill Amnihu", endName: "Minon", startLat: 2, startLng: 2, endLat: 4, endLng: 4 },
  { seq: 4, start: "minon", end: "zarahemla", startName: "Minon", endName: "Zarahemla", startLat: 4, startLng: 4, endLat: 1, endLng: 1 },
];

describe("legsOf", () => {
  test("emits one leg per move, never chaining across moves", () => {
    const legs = legsOf(amlicite);
    expect(legs).toHaveLength(amlicite.length);
    legs.forEach((leg, i) => {
      expect(leg.from.slug).toBe(amlicite[i].start);
      expect(leg.to.slug).toBe(amlicite[i].end);
    });
  });

  // The regression guard for the fabricated-leg bug: the old single-LineString
  // path drew valley-of-gideon → minon, a connection absent from the data.
  test("never produces a segment between a move's end and the next move's start", () => {
    const legs = legsOf(amlicite);
    const drawn = legs.map((l) => `${l.from.slug}->${l.to.slug}`);
    expect(drawn).not.toContain("valley-of-gideon->minon");
    expect(drawn).toEqual([
      "zarahemla->hill-amnihu",
      "hill-amnihu->valley-of-gideon",
      "hill-amnihu->minon",
      "minon->zarahemla",
    ]);
  });

  test("marks a leg detached when it does not continue from the previous one", () => {
    expect(legsOf(amlicite).map((l) => l.detached)).toEqual([false, false, true, false]);
  });

  test("a fully continuous story has no detached legs", () => {
    const continuous = [
      { seq: 1, start: "a", end: "b", startLat: 1, startLng: 1, endLat: 2, endLng: 2 },
      { seq: 2, start: "b", end: "c", startLat: 2, startLng: 2, endLat: 3, endLng: 3 },
    ];
    expect(legsOf(continuous).every((l) => !l.detached)).toBe(true);
  });
});

describe("stopsOf", () => {
  // The regression guard for the marker-stacking bug: the old path emitted a
  // point per visit, so zarahemla drew twice at identical coordinates.
  test("dedupes revisited places", () => {
    const stops = stopsOf(amlicite);
    expect(stops.map((s) => s.slug)).toEqual([
      "zarahemla",
      "hill-amnihu",
      "valley-of-gideon",
      "minon",
    ]);
    expect(stops).toHaveLength(4);
  });

  test("stop count is distinct places, not endpoint count", () => {
    // 4 moves → 8 endpoints under the old scheme, but only 4 distinct places.
    expect(stopsOf(amlicite).length).toBeLessThan(amlicite.length * 2);
  });

  test("records every move touching a place, and which moves arrive there", () => {
    const zarahemla = stopsOf(amlicite).find((s) => s.slug === "zarahemla");
    expect(zarahemla.steps).toEqual([0, 3]);
    expect(zarahemla.startSteps).toEqual([0]);
    expect(zarahemla.endSteps).toEqual([3]);
  });

  test("retains human-readable place names through geometry construction", () => {
    const stops = stopsOf(amlicite);
    expect(stops.find((stop) => stop.slug === "valley-of-gideon").name).toBe("Valley of Gideon");
    expect(legsOf(amlicite)[0].from.name).toBe("Zarahemla");
    expect(legsOf(amlicite)[0].to.name).toBe("Hill Amnihu");
  });
});

describe("stopStateAt", () => {
  const stops = stopsOf(amlicite);
  const bySlug = (slug) => stops.find((s) => s.slug === slug);

  test("the arrival place of the active move is current", () => {
    expect(stopStateAt(bySlug("hill-amnihu"), 0, false)).toBe("current");
  });

  test("the departure place of every active move is current", () => {
    expect(stopStateAt(bySlug("hill-amnihu"), 2, false)).toBe("current");
  });

  test("places not yet reached are future", () => {
    expect(stopStateAt(bySlug("minon"), 0, false)).toBe("future");
  });

  test("already-visited places are past", () => {
    expect(stopStateAt(bySlug("hill-amnihu"), 3, false)).toBe("past");
  });

  test("showAll marks everything past — the title card shows the whole journey", () => {
    stops.forEach((s) => expect(stopStateAt(s, 0, true)).toBe("past"));
  });
});

describe("legVisibility", () => {
  test("marks the leg at the playhead as the bold active leg", () => {
    expect(legVisibility(2, 2)).toEqual({ role: "active", opacity: 1 });
  });

  test("fades recently visited legs with age across the trailing window", () => {
    expect(legVisibility(1, 2, false, 3)).toMatchObject({ role: "recent" });
    expect(legVisibility(1, 2, false, 3).opacity).toBeCloseTo(0.72, 5);
    expect(legVisibility(0, 2, false, 3).opacity).toBeLessThan(legVisibility(1, 2, false, 3).opacity);
  });

  test("recedes legs older than the trailing window to faint context", () => {
    expect(legVisibility(0, 5, false, 3)).toEqual({ role: "old", opacity: 0.16 });
  });

  test("hides future legs until the playhead reaches them", () => {
    expect(legVisibility(4, 2)).toEqual({ role: "future", opacity: 0 });
  });

  test("shows the whole journey as visited context on the completed frame", () => {
    expect(legVisibility(0, 3, true)).toEqual({ role: "visited", opacity: 0.6 });
  });
});

describe("framedLegIndices", () => {
  test("frames just the active leg at the start", () => {
    expect(framedLegIndices(0, false, 4, 1)).toEqual([0]);
  });

  test("frames the active leg plus a trailing tail", () => {
    expect(framedLegIndices(2, false, 4, 1)).toEqual([1, 2]);
    expect(framedLegIndices(3, false, 4, 2)).toEqual([1, 2, 3]);
  });

  test("tail of zero frames only the active leg", () => {
    expect(framedLegIndices(2, false, 4, 0)).toEqual([2]);
  });

  test("frames the entire journey on the completed frame", () => {
    expect(framedLegIndices(3, true, 4, 1)).toEqual([0, 1, 2, 3]);
  });

  test("clamps the active index to the available legs", () => {
    expect(framedLegIndices(99, false, 3, 1)).toEqual([1, 2]);
  });
});
