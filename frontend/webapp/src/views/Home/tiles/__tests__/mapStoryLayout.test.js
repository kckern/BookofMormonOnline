import {
  buildStoryOverlay,
  clusterFutureStops,
  layoutLabels,
  layoutSymbols,
  rectanglesOverlap,
  roleForStop,
  storyStepForStop,
  symbolRequired,
  travelerPosition,
} from "../mapStoryLayout";
import { stopsOf } from "../mapStoryPath";

const moves = [
  { seq: 1, start: "a", end: "b", startName: "Land of A", endName: "City B", startLat: 1, startLng: 1, endLat: 2, endLng: 2 },
  { seq: 2, start: "b", end: "c", startName: "City B", endName: "Valley C", startLat: 2, startLng: 2, endLat: 3, endLng: 3 },
  { seq: 3, start: "c", end: "d", startName: "Valley C", endName: "Hill D", startLat: 3, startLng: 3, endLat: 4, endLng: 4 },
  { seq: 4, start: "d", end: "e", startName: "Hill D", endName: "Final Land E", startLat: 4, startLng: 4, endLat: 5, endLng: 5 },
];

const pixels = {
  a: [38, 210],
  b: [105, 165],
  c: [178, 105],
  d: [195, 116],
  e: [330, 42],
};

const overlapPairs = (labels) => {
  const pairs = [];
  labels.forEach((left, leftIndex) => {
    labels.slice(leftIndex + 1).forEach((right) => {
      if (rectanglesOverlap(left, right, 3)) pairs.push([left.slug, right.slug]);
    });
  });
  return pairs;
};

describe("future-place clustering", () => {
  test("clusters nearby points in screen space and leaves distant points separate", () => {
    const groups = clusterFutureStops([
      { slug: "one", x: 10, y: 10, firstStep: 2 },
      { slug: "two", x: 24, y: 20, firstStep: 3 },
      { slug: "three", x: 180, y: 180, firstStep: 4 },
    ], 32);
    expect(groups).toHaveLength(2);
    expect(groups[0].stops.map((stop) => stop.slug)).toEqual(["one", "two"]);
    expect(groups[1].stops.map((stop) => stop.slug)).toEqual(["three"]);
  });

  test("is deterministic regardless of input order", () => {
    const points = [
      { slug: "b", x: 22, y: 20, firstStep: 2 },
      { slug: "a", x: 10, y: 10, firstStep: 1 },
      { slug: "c", x: 180, y: 180, firstStep: 3 },
    ];
    expect(clusterFutureStops(points, 32)).toEqual(clusterFutureStops([...points].reverse(), 32));
  });
});

describe("semantic progressive reveal", () => {
  test("never clusters active endpoints or the persistent origin/final anchors", () => {
    const stops = stopsOf(moves);
    const overlay = buildStoryOverlay({
      stops,
      moves,
      step: 0,
      pixels,
      width: 370,
      height: 250,
    });
    expect(overlay.markers.filter((marker) => marker.role === "active").map((marker) => marker.slug))
      .toEqual(["a", "b"]);
    expect(overlay.labels.map((label) => label.slug)).toEqual(expect.arrayContaining(["a", "b", "e"]));
    expect(overlay.clusters).toHaveLength(1);
    expect(overlay.clusters[0].stops.map((stop) => stop.slug)).toEqual(["c", "d"]);
  });

  test("promotes the next destination and shrinks future detail as the story advances", () => {
    const stops = stopsOf(moves);
    const first = buildStoryOverlay({ stops, moves, step: 0, pixels, width: 370, height: 250 });
    const second = buildStoryOverlay({ stops, moves, step: 1, pixels, width: 370, height: 250 });
    expect(first.labels.some((label) => label.slug === "c")).toBe(false);
    expect(second.labels.some((label) => label.slug === "c" && label.role === "active")).toBe(true);
    expect(second.clusters).toHaveLength(0);
    expect(second.markers.some((marker) => marker.slug === "d" && marker.role === "future")).toBe(true);
  });

  test("complete state exposes the full route without future clusters", () => {
    const overlay = buildStoryOverlay({
      stops: stopsOf(moves),
      moves,
      step: moves.length - 1,
      complete: true,
      pixels,
      width: 370,
      height: 250,
    });
    expect(overlay.clusters).toHaveLength(0);
    expect(overlay.markers.every((marker) => marker.role !== "future")).toBe(true);
    expect(overlay.labels.map((label) => label.slug)).toEqual(expect.arrayContaining(["a", "e"]));
  });
});

describe("collision-aware label layout", () => {
  test("keeps required labels while preventing label-to-label overlap", () => {
    const items = [
      { slug: "origin", name: "Origin Place", x: 150, y: 110, priority: 0, firstStep: 0, required: true },
      { slug: "active", name: "Active Destination", x: 153, y: 112, priority: 0, firstStep: 1, required: true },
      { slug: "final", name: "Final Destination", x: 156, y: 114, priority: 1, firstStep: 8, required: true },
      { slug: "visited", name: "Visited Place", x: 158, y: 116, priority: 2, firstStep: 2, required: false },
    ];
    const obstacles = items.map((item) => ({
      id: `marker:${item.slug}`,
      x: item.x - 10,
      y: item.y - 10,
      width: 20,
      height: 20,
    }));
    const labels = layoutLabels({ items, obstacles, width: 320, height: 240 });
    expect(labels.map((label) => label.slug)).toEqual(expect.arrayContaining(["origin", "active", "final"]));
    expect(overlapPairs(labels)).toEqual([]);
  });

  test("overlay label boxes do not overlap at the narrow-card target", () => {
    const overlay = buildStoryOverlay({
      stops: stopsOf(moves),
      moves,
      step: 2,
      pixels,
      width: 320,
      height: 240,
    });
    expect(overlapPairs(overlay.labels)).toEqual([]);
  });
});

describe("collision-aware map symbols", () => {
  test("displaces co-located active places instead of stacking their markers", () => {
    const symbols = layoutSymbols({
      width: 320,
      height: 240,
      symbols: [
        { id: "marker:a", slug: "a", x: 150, y: 120, width: 26, height: 26, priority: 0, firstStep: 0, required: true },
        { id: "marker:b", slug: "b", x: 150, y: 120, width: 26, height: 26, priority: 0, firstStep: 0, required: true },
      ],
    });
    expect(symbols).toHaveLength(2);
    const boxes = symbols.map((symbol) => ({
      x: symbol.x - symbol.width / 2,
      y: symbol.y - symbol.height / 2,
      width: symbol.width,
      height: symbol.height,
    }));
    expect(rectanglesOverlap(boxes[0], boxes[1], 3)).toBe(false);
    expect(symbols.some((symbol) => symbol.leader)).toBe(true);
  });

  test("keeps clusters clear of higher-priority markers and reserved controls", () => {
    const reserved = { id: "control", x: 230, y: 180, width: 84, height: 48 };
    const symbols = layoutSymbols({
      width: 320,
      height: 240,
      reservedRects: [reserved],
      symbols: [
        { id: "marker:a", x: 150, y: 120, width: 26, height: 26, priority: 0, firstStep: 0, required: true },
        { id: "cluster:future", x: 150, y: 120, width: 62, height: 34, priority: 3, firstStep: 2, required: false },
      ],
    });
    expect(symbols).toHaveLength(2);
    const [marker, cluster] = symbols;
    const markerBox = { x: marker.x - 13, y: marker.y - 13, width: 26, height: 26 };
    const clusterBox = { x: cluster.x - 31, y: cluster.y - 17, width: 62, height: 34 };
    expect(rectanglesOverlap(markerBox, clusterBox, 3)).toBe(false);
    expect(rectanglesOverlap(clusterBox, reserved, 3)).toBe(false);
  });
});

describe("traveler placement", () => {
  test("chooses an alternate side when the preferred avatar position is occupied", () => {
    const result = travelerPosition({
      x: 150,
      y: 120,
      dx: 100,
      dy: 0,
      width: 320,
      height: 240,
      obstacles: [{ id: "label", x: 118, y: 124, width: 64, height: 42 }],
    });
    const party = { x: result.x - 31, y: result.y - 19, width: 62, height: 38 };
    expect(rectanglesOverlap(party, { x: 118, y: 124, width: 64, height: 42 })).toBe(false);
  });

  test("stays inside the frame without covering a destination label at the map edge", () => {
    const destinationLabel = { id: "label", x: 167, y: 222, width: 110, height: 42 };
    const result = travelerPosition({
      x: 150,
      y: 252,
      dx: -90,
      dy: 120,
      width: 320,
      height: 270,
      obstacles: [destinationLabel],
    });
    const party = { x: result.x - 31, y: result.y - 19, width: 62, height: 38 };
    expect(party.x).toBeGreaterThanOrEqual(6);
    expect(party.y).toBeGreaterThanOrEqual(6);
    expect(party.x + party.width).toBeLessThanOrEqual(314);
    expect(party.y + party.height).toBeLessThanOrEqual(264);
    expect(rectanglesOverlap(party, destinationLabel, 3)).toBe(false);
  });

  test("finds a clear radial offset between co-located destinations in a dense edge frame", () => {
    const obstacles = [
      { id: "city-label", x: 28, y: 222, width: 118, height: 28 },
      { id: "manti-label", x: 197, y: 222, width: 107, height: 28 },
      { id: "city-marker", x: 138, y: 232, width: 20, height: 20 },
      { id: "manti-marker", x: 171, y: 232, width: 18, height: 18 },
    ];
    const result = travelerPosition({
      x: 150,
      y: 242,
      dx: 0,
      dy: 0,
      width: 320,
      height: 270,
      obstacles,
    });
    const party = { x: result.x - 31, y: result.y - 19, width: 62, height: 38 };
    expect(obstacles.some((obstacle) => rectanglesOverlap(party, obstacle, 3))).toBe(false);
  });

  test("stop roles prioritize current endpoints above anchors and visited places", () => {
    const stops = stopsOf(moves);
    expect(roleForStop(stops.find((stop) => stop.slug === "b"), moves, 0)).toMatchObject({ role: "active", priority: 0 });
    expect(roleForStop(stops.find((stop) => stop.slug === "e"), moves, 0)).toMatchObject({ role: "anchor", priority: 1 });
  });

  test("named place selection chooses the relevant current, visited, or final beat", () => {
    const stops = stopsOf(moves);
    const b = stops.find((stop) => stop.slug === "b");
    const c = stops.find((stop) => stop.slug === "c");
    const e = stops.find((stop) => stop.slug === "e");
    expect(storyStepForStop({ stop: b, moves, step: 0 })).toBe(0);
    expect(storyStepForStop({ stop: b, moves, step: 2 })).toBe(1);
    expect(storyStepForStop({ stop: c, moves, step: 0 })).toBe(1);
    expect(storyStepForStop({ stop: e, moves, step: 0 })).toBe(3);
    expect(storyStepForStop({ stop: c, moves, step: 3, complete: true })).toBe(1);
  });
});

describe("marker requiredness", () => {
  test("always keeps active and anchor markers", () => {
    expect(symbolRequired("active", false)).toBe(true);
    expect(symbolRequired("anchor", false)).toBe(true);
  });

  test("does not force visited markers during playback but keeps them on completion", () => {
    expect(symbolRequired("visited", false)).toBe(false);
    expect(symbolRequired("visited", true)).toBe(true);
  });
});
