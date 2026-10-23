import { parseOverrides, bucketFor, loadOverrides, decide } from "../flags";

const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };

describe("parseOverrides", () => {
  test("on, off, and mixed", () => expect(parseOverrides("a,-b, c")).toEqual({ a: true, b: false, c: true }));
  test("reset clears", () => expect(parseOverrides("reset")).toBeNull());
  test("nothing", () => { expect(parseOverrides(null)).toEqual({}); expect(parseOverrides("")).toEqual({}); });
});

describe("bucketFor", () => {
  test("random once, then stable", () => {
    const s = mem();
    expect(bucketFor(s, () => 0.42)).toBe(42);
    expect(bucketFor(s, () => 0.99)).toBe(42);
  });
  test("garbage in storage is replaced", () => {
    const s = mem(); s.setItem("bom.bucket", "banana");
    expect(bucketFor(s, () => 0.07)).toBe(7);
  });
  test("blocked storage still returns a bucket", () => {
    const s = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); } };
    expect(bucketFor(s, () => 0.5)).toBe(50);
  });
});

describe("loadOverrides", () => {
  test("URL override is remembered for the next page", () => {
    const s = mem();
    expect(loadOverrides(s, "?ff=theology")).toEqual({ theology: true });
    expect(loadOverrides(s, "")).toEqual({ theology: true });
  });
  test("reset forgets", () => {
    const s = mem(); loadOverrides(s, "?ff=a");
    expect(loadOverrides(s, "?ff=reset")).toEqual({});
    expect(loadOverrides(s, "")).toEqual({});
  });
});

describe("decide", () => {
  const config = { on: { rollout: 100 }, off: { rollout: 0 }, half: { rollout: 50 } };
  const base = { config, overrides: {}, bucket: 10, isProd: true };
  test("100 on, 0 off, unknown off", () => {
    expect(decide("on", base)).toBe(true);
    expect(decide("off", base)).toBe(false);
    expect(decide("nope", base)).toBe(false);
  });
  test("percentage uses the bucket", () => {
    expect(decide("half", { ...base, bucket: 49 })).toBe(true);
    expect(decide("half", { ...base, bucket: 50 })).toBe(false);
  });
  test("override beats config in both directions", () => {
    expect(decide("off", { ...base, overrides: { off: true } })).toBe(true);
    expect(decide("on", { ...base, overrides: { on: false } })).toBe(false);
  });
  test("non-prod builds show everything unless overridden", () => {
    expect(decide("off", { ...base, isProd: false })).toBe(true);
    expect(decide("off", { ...base, isProd: false, overrides: { off: false } })).toBe(false);
  });
});
