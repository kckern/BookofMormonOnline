import { singleColumnOrder } from "../samplerLayout";

describe("singleColumnOrder (phone / narrow layout)", () => {
  const variable = ["text", "art", "community", "commentary", "places", "notes"];

  test("leads with reading plan, People, then narration", () => {
    expect(singleColumnOrder(variable).slice(0, 3)).toEqual(["readingplan", "people", "section"]);
  });

  test("places contents a few tiles in, after the first three variable tiles", () => {
    const order = singleColumnOrder(variable);
    expect(order.slice(3, 7)).toEqual(["text", "art", "community", "contents"]);
  });

  test("keeps every variable tile in its shuffled order and ends with the map story", () => {
    const order = singleColumnOrder(variable);
    expect(order.filter((k) => variable.includes(k))).toEqual(variable);
    expect(order.at(-1)).toBe("mapstory");
  });

  test("with fewer than three variable tiles, contents still lands before the map story", () => {
    expect(singleColumnOrder(["text"])).toEqual(["readingplan", "people", "section", "text", "contents", "mapstory"]);
  });
});

import { canGrowReserves, placeBatchTiles } from "../samplerLayout";

describe("canGrowReserves (balancer freeze)", () => {
  test("grows while under the cap and no batch has been revealed", () => {
    expect(canGrowReserves({ reserves: 1, max: 5, batches: 0 })).toBe(true);
  });
  test("frozen once any infinite batch is on the page: a reserve inserted before the batch tiles would re-split every masonry column (audit places-B3 / placeProfile-E2)", () => {
    expect(canGrowReserves({ reserves: 1, max: 5, batches: 1 })).toBe(false);
  });
  test("frozen at the cap", () => {
    expect(canGrowReserves({ reserves: 5, max: 5, batches: 0 })).toBe(false);
  });
});

describe("placeBatchTiles (infinite tiles → rail | main)", () => {
  const base = { railH: 100, mainColH: 100, mainCount: 4, last: { rail: "contents", main: ["art", "notes"] } };

  test("goes to the shorter of rail and main, as before", () => {
    expect(placeBatchTiles({ ...base, railH: 50, tiles: [{ key: "text", e: 10 }] })).toEqual(["rail"]);
    expect(placeBatchTiles({ ...base, railH: 150, tiles: [{ key: "text", e: 10 }] })).toEqual(["main"]);
  });

  test("never stacks a tile directly under one of the same key (audit places-H4)", () => {
    // next main item lands in masonry column mainCount % 2 = 0, whose last tile is "art"
    expect(placeBatchTiles({ ...base, railH: 150, tiles: [{ key: "art", e: 10 }] })).toEqual(["rail"]);
    // rail is shorter but its last tile is "contents" → a contents batch tile goes main
    expect(placeBatchTiles({ ...base, railH: 50, tiles: [{ key: "contents", e: 10 }] })).toEqual(["main"]);
  });

  test("tracks each column's last key across the batch", () => {
    // places → main col 0, then places again: main col 1 is "notes" (ok) but
    // the heights say rail; rail last is contents → rail
    const out = placeBatchTiles({ ...base, railH: 1000, mainColH: 0, tiles: [{ key: "places", e: 10 }, { key: "places", e: 10 }, { key: "places", e: 10 }] });
    expect(out).toEqual(["main", "main", "rail"]);
  });

  test("is deterministic for the same input (re-render places tiles in the same columns)", () => {
    const input = { ...base, tiles: [{ key: "a", e: 30 }, { key: "b", e: 5 }, { key: "a", e: 9 }] };
    expect(placeBatchTiles(input)).toEqual(placeBatchTiles(input));
  });
});

import { spaceAcrossColumns } from "../samplerLayout";

// Live audit (scripture r4, 2026-10-17): the old even-fraction spacing put the
// three commentaries at masonry indices 2/6/10 for a 12-item grid — all in
// column 0 (item j → column j % 2), the exact "spam column" it meant to avoid.
describe("spaceAcrossColumns (commentary anti-stacking)", () => {
  const others = (n) => Array.from({ length: n }, (_, i) => `o${i}`);
  it.each([3, 5, 8, 9, 10, 12, 15])("%i others: neighbours in the family never share a column", (n) => {
    const out = spaceAcrossColumns(others(n), ["c1", "c2", "c3"], 2);
    const at = ["c1", "c2", "c3"].map((c) => out.indexOf(c));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(out).toHaveLength(n + 3);
    expect(at[0] % 2).not.toBe(at[1] % 2);
    expect(at[1] % 2).not.toBe(at[2] % 2);
    // no family tile leads the grid, and the others keep their order
    expect(at[0]).toBeGreaterThan(0);
    expect(out.filter((x) => x.startsWith("o"))).toEqual(others(n));
  });
  it("single column: evenly spaced, order kept", () => {
    const out = spaceAcrossColumns(others(9), ["c1", "c2", "c3"], 1);
    expect(out.indexOf("c1")).toBeGreaterThan(0);
    expect(out.indexOf("c2") - out.indexOf("c1")).toBeGreaterThan(1);
    expect(out.indexOf("c3") - out.indexOf("c2")).toBeGreaterThan(1);
  });
  it("no family items → others unchanged", () => {
    expect(spaceAcrossColumns(others(4), [], 2)).toEqual(others(4));
  });
});
