import { deriveSignal, formatSignal } from "./historySignal";

test("deriveSignal returns count and year range, ignoring missing years", () => {
  const list = [{ year: 1830 }, { year: 1829 }, { year: null }, { year: 1844 }];
  expect(deriveSignal(list)).toEqual({ count: 4, minYear: 1829, maxYear: 1844 });
});

test("deriveSignal handles empty / non-array input", () => {
  expect(deriveSignal([])).toEqual({ count: 0, minYear: null, maxYear: null });
  expect(deriveSignal(null)).toEqual({ count: 0, minYear: null, maxYear: null });
});

test("formatSignal builds the uppercase COUNT · RANGE line", () => {
  expect(formatSignal(580, "documents", 1829, 1844)).toBe("580 DOCUMENTS · 1829–1844");
});

test("formatSignal collapses a single-year range", () => {
  expect(formatSignal(3, "statements", 1830, 1830)).toBe("3 STATEMENTS · 1830");
});

test("formatSignal returns null when there is no count", () => {
  expect(formatSignal(0, "documents", null, null)).toBeNull();
});

test("formatSignal omits the range when years are unknown", () => {
  expect(formatSignal(5, "documents", null, null)).toBe("5 DOCUMENTS");
});
