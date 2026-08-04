// Importing the registry pulls every tile component. Stub the API layer so no
// module-level network/side effects fire during the import.
jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(() => new Promise(() => {})),
  assetUrl: "https://media.test",
  renderBaseUrl: "http://localhost:5006",
  ApiBaseUrl: "http://localhost:5005",
}));

import { tileRegistry, reservePool, batchTiles } from "../registry";

const isFn = (x) => typeof x === "function";
const allEntriesValid = (pool) =>
  pool.every((t) => typeof t.key === "string" && isFn(t.component) && isFn(t.isReady));
const uniqueKeys = (pool) => new Set(pool.map((t) => t.key)).size === pool.length;

describe("tile registry", () => {
  test("all three pools export a non-empty array", () => {
    [tileRegistry, reservePool, batchTiles].forEach((p) => {
      expect(Array.isArray(p)).toBe(true);
      expect(p.length).toBeGreaterThan(0);
    });
  });

  test("every entry has a key, a component, and an isReady predicate", () => {
    expect(allEntriesValid(tileRegistry)).toBe(true);
    expect(allEntriesValid(reservePool)).toBe(true);
    expect(allEntriesValid(batchTiles)).toBe(true);
  });

  test("keys are unique within each pool", () => {
    expect(uniqueKeys(tileRegistry)).toBe(true);
    expect(uniqueKeys(reservePool)).toBe(true);
    expect(uniqueKeys(batchTiles)).toBe(true);
  });

  test("batchTiles carries the repeatable content types", () => {
    const keys = batchTiles.map((t) => t.key);
    ["commentary", "history", "fax", "places", "text"].forEach((k) =>
      expect(keys).toContain(k)
    );
  });

  test("the map reserve is main-only so it lands below the fold", () => {
    expect(reservePool.find((t) => t.key === "map").mainOnly).toBe(true);
  });
});
