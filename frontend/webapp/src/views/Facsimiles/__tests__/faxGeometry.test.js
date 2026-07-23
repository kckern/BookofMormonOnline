import { resolvePgOffset } from "../faxGeometry";

describe("resolvePgOffset", () => {
  test("prefers numeric pgOffset (camelCase)", () => {
    expect(resolvePgOffset({ pgOffset: 4, pgoffset: 9 })).toBe(4);
  });
  test("falls back to lowercase pgoffset", () => {
    expect(resolvePgOffset({ pgoffset: 7 })).toBe(7);
  });
  test("coerces numeric strings", () => {
    expect(resolvePgOffset({ pgoffset: "5" })).toBe(5);
  });
  test("defaults to 0 when neither present or non-numeric", () => {
    expect(resolvePgOffset({})).toBe(0);
    expect(resolvePgOffset(null)).toBe(0);
    expect(resolvePgOffset({ pgOffset: "x" })).toBe(0);
  });
});
