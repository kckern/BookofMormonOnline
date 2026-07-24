import { buildYearBuckets, monthChipsForYear, matchesYearMonth, colorBucket } from "../WitnessLifeStrip";

const SOURCES = [
  { date: "1829-06-01" }, { date: "1878-09-07" }, { date: "1878-09-20" }, { date: "1878-11-02" },
  { date: "1881" }, { date: "bogus" }, { date: "1200-01-01" },
];
const WITNESS = { birthday: "1805-01-07", deathday: "1888-01-25", excommunication: "1838-04-13" };

describe("colorBucket", () => {
  test("bins: 0 / 1 / 2-3 / 4-6 / 7+", () => {
    expect([0,1,2,3,4,6,7,20].map(colorBucket)).toEqual([0,1,2,2,3,3,4,4]);
  });
});

describe("buildYearBuckets", () => {
  const b = buildYearBuckets(SOURCES, WITNESS);
  test("spans 1829..deathYear and counts dated in-range sources per year", () => {
    expect(b.years[0]).toBe(1829);
    expect(b.years[b.years.length - 1]).toBe(1888);
    const y1878 = b.byYear.get(1878);
    expect(y1878).toBe(3);
    expect(b.byYear.get(1881)).toBe(1);
  });
  test("flags death and excommunication years", () => {
    expect(b.deathYear).toBe(1888);
    expect(b.excomYear).toBe(1838);
  });
  test("counts undated / out-of-range separately (not placed)", () => {
    expect(b.undated).toBe(2);
  });
});

describe("monthChipsForYear", () => {
  test("returns months with sources in that year, with counts, in order", () => {
    const chips = monthChipsForYear(SOURCES, 1878);
    expect(chips).toEqual([{ month: 9, count: 2 }, { month: 11, count: 1 }]);
  });
  test("empty for a year with no dated-month sources", () => {
    expect(monthChipsForYear(SOURCES, 1881)).toEqual([]);
  });
});

describe("matchesYearMonth", () => {
  test("month key matches a same year+month source", () => {
    expect(matchesYearMonth({ date: "1878-09-07" }, "1878-09")).toBe(true);
    expect(matchesYearMonth({ date: "1878-11-02" }, "1878-09")).toBe(false);
  });
  test("YEAR-ONLY key matches any source in that year (incl. year-only dates)", () => {
    expect(matchesYearMonth({ date: "1878-11-02" }, "1878")).toBe(true);
    expect(matchesYearMonth({ date: "1881" }, "1881")).toBe(true);
    expect(matchesYearMonth({ date: "1878-11-02" }, "1879")).toBe(false);
  });
  test("null key matches everything", () => {
    expect(matchesYearMonth({ date: "x" }, null)).toBe(true);
  });
});
