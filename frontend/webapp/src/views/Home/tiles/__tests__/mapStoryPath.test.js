import { legsOf, stopsOf, stopStateAt } from "../mapStoryPath";

// Modelled on the real Alma 2 "Amlicite War" rows: zarahemla is revisited, and
// move 3 starts at hill-amnihu although move 2 ended at valley-of-gideon.
const amlicite = [
  { seq: 1, start: "zarahemla", end: "hill-amnihu", startLat: 1, startLng: 1, endLat: 2, endLng: 2 },
  { seq: 2, start: "hill-amnihu", end: "valley-of-gideon", startLat: 2, startLng: 2, endLat: 3, endLng: 3 },
  { seq: 3, start: "hill-amnihu", end: "minon", startLat: 2, startLng: 2, endLat: 4, endLng: 4 },
  { seq: 4, start: "minon", end: "zarahemla", startLat: 4, startLng: 4, endLat: 1, endLng: 1 },
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
    expect(zarahemla.endSteps).toEqual([3]);
  });
});

describe("stopStateAt", () => {
  const stops = stopsOf(amlicite);
  const bySlug = (slug) => stops.find((s) => s.slug === slug);

  test("the arrival place of the active move is current", () => {
    expect(stopStateAt(bySlug("hill-amnihu"), 0, false)).toBe("current");
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
