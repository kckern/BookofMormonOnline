import {
  read,
  write,
  clear,
  isFresh,
  currentBucket,
  TTL_MS,
} from "../homeSamplerCache";

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

const samplePayload = { seed: 42, people: [{ slug: "nephi" }], text: { id: 1 } };

describe("homeSamplerCache", () => {
  test("write then read round-trips the payload and seed, stamped with the current bucket", () => {
    write(samplePayload, 42);
    const entry = read();
    expect(entry.payload).toEqual(samplePayload);
    expect(entry.seed).toBe(42);
    expect(entry.bucket).toBe(currentBucket(Date.now()));
  });

  test("read returns null when nothing is stored", () => {
    expect(read()).toBeNull();
  });

  test("isFresh is true within the same bucket, false a full window later", () => {
    write(samplePayload, 42);
    const entry = read();
    expect(isFresh(entry, Date.now())).toBe(true);
    expect(isFresh(entry, Date.now() + TTL_MS)).toBe(false);
  });

  test("read returns null on corrupt JSON", () => {
    localStorage.setItem("bom:homeSampler:v1", "{not json");
    expect(read()).toBeNull();
  });

  test("clear removes the entry", () => {
    write(samplePayload, 42);
    clear();
    expect(read()).toBeNull();
  });

  test("write skips an implausibly large payload (size guard) rather than throwing", () => {
    const huge = { seed: 1, blob: "x".repeat(1_100_000) };
    expect(() => write(huge, 1)).not.toThrow();
    expect(read()).toBeNull();
  });

  test("write swallows a storage quota/security error", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceeded");
    });
    expect(() => write(samplePayload, 42)).not.toThrow();
  });

  test("read swallows a storage access error and returns null", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(read()).toBeNull();
  });
});
