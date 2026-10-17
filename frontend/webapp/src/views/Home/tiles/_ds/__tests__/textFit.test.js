import { rows, estimateChiasmLinesPx, estimatePairTextPx } from "../textFit";

describe("textFit estimates (audit R3 B2: resolve into the reserved box)", () => {
  test("rows: whole wrapped rows, never fewer than one", () => {
    expect(rows(0, 334)).toBe(1);
    expect(rows(55, 334)).toBe(1);
    expect(rows(56, 334)).toBe(2);
    expect(rows(273, 334)).toBe(5);
  });

  // measured live (calib 2026-10-16): chiasm 1fc9e1da29 → 243px of lines at 334px
  test("a chiasm estimate lands within one row of the measured height", () => {
    const est = estimateChiasmLinesPx("ABCDCBA", [84, 65, 21, 29, 35, 46, 63], 334);
    expect(Math.abs(est - 243)).toBeLessThanOrEqual(21);
  });

  test("deeper letters indent, so the same text wraps into more rows", () => {
    expect(estimateChiasmLinesPx("F", [50], 200)).toBeGreaterThan(estimateChiasmLinesPx("A", [50], 200));
  });

  // measured live: 273 + 58 chars stacked at 334px → 110 + 44 = 154px
  test("a stacked pair estimate matches the measured passages", () => {
    expect(Math.round(estimatePairTextPx(273, 58, 334))).toBe(154);
  });

  test("a wide tile sets the pair side by side: height is the taller passage", () => {
    expect(estimatePairTextPx(273, 58, 700)).toBeLessThan(estimatePairTextPx(273, 58, 334));
  });
});
