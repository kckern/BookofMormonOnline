import { readSession, writeSession, clearSession, MAX_STORED_BATCHES } from "../samplerSession";

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

const snap = (over = {}) => ({
  seed: 42,
  order: ["text", "art", "commentary"],
  reserves: [{ key: "witness", side: "rail" }],
  batches: [{ payload: { seed: 7, art: [1] }, tiles: ["art", "history"] }],
  batchSeed: 7,
  ...over,
});

describe("samplerSession", () => {
  test("round-trips a snapshot for the same seed", () => {
    writeSession(snap());
    expect(readSession(42)).toEqual(snap());
  });

  test("returns null for a different seed (new 6h window or a resample)", () => {
    writeSession(snap());
    expect(readSession(43)).toBeNull();
  });

  test("returns null when nothing is stored, the seed is missing, or JSON is corrupt", () => {
    expect(readSession(42)).toBeNull();
    writeSession(snap());
    expect(readSession(undefined)).toBeNull();
    sessionStorage.setItem("bom:homeSession:v1", "{nope");
    expect(readSession(42)).toBeNull();
  });

  test("keeps only the first MAX_STORED_BATCHES batches", () => {
    const batches = Array.from({ length: MAX_STORED_BATCHES + 4 }, (_, i) => ({ payload: { seed: i }, tiles: ["art"] }));
    writeSession(snap({ batches }));
    expect(readSession(42).batches).toHaveLength(MAX_STORED_BATCHES);
  });

  test("on a quota error, drops batches and still saves the layout", () => {
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (k, v) {
      if (JSON.parse(v).batches.length) throw new DOMException("full", "QuotaExceededError");
      return real.call(this, k, v);
    });
    writeSession(snap());
    const got = readSession(42);
    expect(got.order).toEqual(["text", "art", "commentary"]);
    expect(got.batches).toEqual([]);
  });

  test("clearSession forgets the snapshot", () => {
    writeSession(snap());
    clearSession();
    expect(readSession(42)).toBeNull();
  });

  test("never throws when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("SecurityError"); });
    expect(() => writeSession(snap())).not.toThrow();
    expect(readSession(42)).toBeNull();
  });
});

import { readAnchor, writeAnchor } from "../samplerSession";

describe("scroll anchor (Back restores the tile the reader was looking at)", () => {
  beforeEach(() => sessionStorage.clear());
  test("round-trips for the same seed only", () => {
    writeAnchor(42, { index: 7, cls: "tile-art", offset: 210 });
    expect(readAnchor(42)).toEqual({ index: 7, cls: "tile-art", offset: 210 });
    expect(readAnchor(43)).toBeNull();
  });
  test("clearSession forgets it too", () => {
    writeAnchor(42, { index: 7, cls: "tile-art", offset: 210 });
    clearSession();
    expect(readAnchor(42)).toBeNull();
  });
});
