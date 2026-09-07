import {
  compositionDate,
  recalledEvent,
  parseYearMonth,
  byCompositionDesc,
  accountSources,
  ymKey,
  matchesYearMonth,
  ymOrdinal,
  isPosthumousComp,
  groupByDecade,
} from "../witnessSources";

// Fixtures mirror real bom_xtras_history rows (see plan's data table).
const caseB = { year: 1918, date: "2003", event_year: 1918, event_date: "1918-04-25" };
const caseA = { year: 1940, date: "1885-06-28", event_year: 1885, event_date: "1885-06-28" };
const yearOnly = { year: 1888, date: "2003", event_year: 1888, event_date: "1888-10" };
const noEventDate = { year: 1875, date: "1875-07-10", event_year: 1875, event_date: null };
// `date` here is valid AND wrong: wiring it back in yields month 11, not a degraded parse.
const wrongDate = { year: 1907, date: "1907-11-02", event_year: 1907, event_date: "1907-05-10" };
// Oliver Cowdery to W. W. Phelps, Letter I — written Sep 1834, recounting the 1829
// translation. event_date is the composition date; event_year points at the occasion.
const composedLater = { year: 1834, event_year: 1829, event_date: "1834-09-07" };
const composedLaterMonthOnly = { year: 1837, event_year: 1829, event_date: "1837-02" };
// Martin Harris — John A. Clark. event_year postdates composition, which is impossible.
const eventAfterComposition = { year: 1840, event_year: 1842, event_date: "1840-08-31" };

describe("compositionDate", () => {
  it("takes the month from event_date when event_year matches year", () => {
    expect(compositionDate(caseB)).toEqual({ year: 1918, month: 4, precision: "month" });
  });
  it("accepts month-only event_date", () => {
    expect(compositionDate(yearOnly)).toEqual({ year: 1888, month: 10, precision: "month" });
  });
  it("falls back to year precision when the event is an earlier one", () => {
    expect(compositionDate(caseA)).toEqual({ year: 1940, month: null, precision: "year" });
  });
  it("falls back to year precision when event_date is missing", () => {
    expect(compositionDate(noEventDate)).toEqual({ year: 1875, month: null, precision: "year" });
  });
  it("never reads the corrupt date column", () => {
    expect(compositionDate(wrongDate)).toEqual({ year: 1907, month: 5, precision: "month" });
  });
  it("declines an out-of-range month rather than trusting it", () => {
    expect(compositionDate({ year: 1918, event_date: "1918-13" }))
      .toEqual({ year: 1918, month: null, precision: "year" });
    expect(compositionDate({ year: 1918, event_date: "1918-00-05" }))
      .toEqual({ year: 1918, month: null, precision: "year" });
  });
  it("takes the month when event_date describes the composition year, even though event_year points elsewhere", () => {
    expect(compositionDate(composedLater)).toEqual({ year: 1834, month: 9, precision: "month" });
  });
  it("does the same for a month-only event_date describing the composition year", () => {
    expect(compositionDate(composedLaterMonthOnly)).toEqual({ year: 1837, month: 2, precision: "month" });
  });
  it("returns null when year is missing", () => {
    expect(compositionDate({ year: 0, event_date: "1850-01" })).toBeNull();
    expect(compositionDate({})).toBeNull();
  });
});

describe("recalledEvent", () => {
  it("returns the earlier event when event_year differs from year", () => {
    expect(recalledEvent(caseA)).toEqual({ year: 1885, month: 6, precision: "month" });
  });
  it("returns null when the event is the composition occasion", () => {
    expect(recalledEvent(caseB)).toBeNull();
    expect(recalledEvent(yearOnly)).toBeNull();
  });
  it("returns year precision when event_date is missing but event_year differs", () => {
    expect(recalledEvent({ year: 1901, event_year: 1850, event_date: null }))
      .toEqual({ year: 1850, month: null, precision: "year" });
  });
  it("still reports the older occasion when event_date holds the composition date", () => {
    expect(recalledEvent(composedLater)).toEqual({ year: 1829, month: null, precision: "year" });
  });
  it("returns null when the recounted event postdates composition", () => {
    expect(recalledEvent(eventAfterComposition)).toBeNull();
  });
  it("returns null when there is no composition date to anchor the recollection to", () => {
    // compositionDate is null here, so a card would render "recalling ..." under an empty date.
    expect(recalledEvent({ event_year: 1900, event_date: "1900-05" })).toBeNull();
    expect(recalledEvent({ year: 0, event_year: 1900 })).toBeNull();
  });
});

describe("parseYearMonth", () => {
  it("reads a year, with or without a month", () => {
    expect(parseYearMonth("1918-04")).toEqual({ year: 1918, month: 4 });
    expect(parseYearMonth("1918")).toEqual({ year: 1918, month: null });
  });
  it("matches a prefix, tolerating trailing text", () => {
    expect(parseYearMonth("1918-04-25")).toEqual({ year: 1918, month: 4 });
    expect(parseYearMonth("1918-04-25 (approx)")).toEqual({ year: 1918, month: 4 });
  });
  it("keeps the year but drops an out-of-range month", () => {
    expect(parseYearMonth("1918-13")).toEqual({ year: 1918, month: null });
    expect(parseYearMonth("1918-00")).toEqual({ year: 1918, month: null });
  });
  it("returns null for empty or unparseable input", () => {
    expect(parseYearMonth(null)).toBeNull();
    expect(parseYearMonth("")).toBeNull();
    expect(parseYearMonth("n.d.")).toBeNull();
  });
});

describe("byCompositionDesc", () => {
  const list = [
    { slug: "a", year: 1930, event_year: 1930, event_date: "1930-04-08", seq: 1 },
    { slug: "b", year: 1945, event_year: 1945, event_date: "1945-09", seq: 2 },
    { slug: "c", year: 1940, event_year: 1885, event_date: "1885-06-28", seq: 3 },
    { slug: "d", year: 1938, event_year: 1938, event_date: "1938-09-13", seq: 4 },
  ];
  it("sorts newest composition first", () => {
    expect([...list].sort(byCompositionDesc).map(s => s.slug)).toEqual(["b", "c", "d", "a"]);
  });
  it("orders within a year by month descending", () => {
    const sameYear = [
      { slug: "jan", year: 1885, event_year: 1885, event_date: "1885-01", seq: 1 },
      { slug: "dec", year: 1885, event_year: 1885, event_date: "1885-12", seq: 2 },
    ];
    expect([...sameYear].sort(byCompositionDesc).map(s => s.slug)).toEqual(["dec", "jan"]);
  });
  it("puts year-only sources after month-dated ones in the same year", () => {
    const mixed = [
      { slug: "vague", year: 1885, event_year: 1870, event_date: "1870-01", seq: 9 },
      { slug: "precise", year: 1885, event_year: 1885, event_date: "1885-03", seq: 1 },
    ];
    expect([...mixed].sort(byCompositionDesc).map(s => s.slug)).toEqual(["precise", "vague"]);
  });
  it("sinks unusable sources below every dated one", () => {
    const withUnusable = [
      { slug: "nodate", year: 0, seq: 1 },
      { slug: "dated", year: 1885, event_year: 1885, event_date: "1885-03", seq: 2 },
    ];
    expect([...withUnusable].sort(byCompositionDesc).map(s => s.slug)).toEqual(["dated", "nodate"]);
  });
  it("breaks exact ties on seq ascending, which is unique per row in the archive", () => {
    const tied = [
      { slug: "later", year: 1885, event_year: 1885, event_date: "1885-03", seq: 200 },
      { slug: "earlier", year: 1885, event_year: 1885, event_date: "1885-03", seq: 100 },
    ];
    expect([...tied].sort(byCompositionDesc).map(s => s.slug)).toEqual(["earlier", "later"]);
  });
});

describe("accountSources", () => {
  const list = [
    { year: 1885, event_year: 1885, event_date: "1885-06" },   // month-precise
    { year: 1886, event_year: 1886, event_date: null },        // year-only
    { year: 1940, event_year: 1885, event_date: "1885-06-28" },// year-only AND recalls earlier
    { year: 1834, event_year: 1829, event_date: "1834-09-07" },// month-precise AND recalls earlier
    { year: 0 },                                               // unusable
  ];

  it("puts every source in exactly one placement bucket", () => {
    const a = accountSources(list);
    expect(a.monthPrecise).toBe(2);
    expect(a.yearOnly).toBe(2);
    expect(a.unusable).toBe(1);
    expect(a.monthPrecise + a.yearOnly + a.unusable).toBe(a.total);
  });

  it("counts recalled events as an overlapping annotation, not a placement", () => {
    const a = accountSources(list);
    expect(a.recallsEarlier).toBe(2);
    // Overlap stated directly: the four buckets sum past `total` precisely because
    // recallsEarlier double-counts sources already placed elsewhere.
    expect(a.monthPrecise + a.yearOnly + a.unusable + a.recallsEarlier)
      .toBeGreaterThan(a.total);
  });

  it("counts a month-precise source that recalls an earlier event in BOTH buckets", () => {
    // The Cowdery shape on its own — written Sep 1834, recounting 1829. It draws a
    // grid cell in Sep 1834 AND carries a "recalling 1829" line, so it is not a
    // placement bucket that recallsEarlier can be derived by subtracting.
    const a = accountSources([{ year: 1834, event_year: 1829, event_date: "1834-09-07" }]);
    expect(a).toEqual({
      total: 1, monthPrecise: 1, yearOnly: 0, unusable: 0, recallsEarlier: 1,
    });
  });

  it("returns a zeroed account for an empty or missing list", () => {
    expect(accountSources([])).toEqual({
      total: 0, monthPrecise: 0, yearOnly: 0, unusable: 0, recallsEarlier: 0,
    });
    expect(accountSources(null).total).toBe(0);
  });
});

/**
 * Task 8 — the posthumous bucket. WHITMER died 25 Jan 1888 (ordinal ymOrdinal(1888, 1)).
 */
describe("accountSources with deathOrdinal (Task 8 posthumous bucket)", () => {
  const deathOrdinal = ymOrdinal(1888, 1); // 25 Jan 1888

  it("omitting the second argument entirely preserves the pre-Task-8 3-bucket shape", () => {
    // Same fixture and assertions as the pre-Task-8 tests above, called with no options
    // argument at all. This is the exact call shape all 88 pre-Task-8 tests use, and it
    // must keep returning a 5-key object -- no `posthumous` key, even set to 0 -- because
    // the tests above assert `toEqual` against that literal shape and Jest's `toEqual`
    // does not treat a real `0` as equal to a missing key.
    const list = [
      { year: 1885, event_year: 1885, event_date: "1885-06" },
      { year: 1886, event_year: 1886, event_date: null },
    ];
    expect(accountSources(list)).toEqual({
      total: 2, monthPrecise: 1, yearOnly: 1, unusable: 0, recallsEarlier: 0,
    });
    expect(Object.keys(accountSources(list))).not.toContain("posthumous");
  });

  it("tolerates an explicit null options argument -- degrades to 3-bucket, doesn't throw", () => {
    // Caught by code review: `opts !== undefined` alone still lets `opts.deathOrdinal` throw
    // on a null opts. No current caller passes null, but `witness.deathday ? {...} : null` is
    // a natural future call shape, and it should degrade gracefully like an omitted argument.
    const list = [
      { year: 1885, event_year: 1885, event_date: "1885-06" },
      { year: 1886, event_year: 1886, event_date: null },
    ];
    expect(() => accountSources(list, null)).not.toThrow();
    expect(accountSources(list, null)).toEqual({
      total: 2, monthPrecise: 1, yearOnly: 1, unusable: 0, recallsEarlier: 0,
    });
    expect(Object.keys(accountSources(list, null))).not.toContain("posthumous");
  });

  it("moves a source composed after death out of monthPrecise/yearOnly and into posthumous", () => {
    const monthPrecisePosthumous = { year: 1918, event_year: 1918, event_date: "1918-04-25" };
    const yearOnlyPosthumous = { year: 1940, event_year: 1885, event_date: "1885-06-28" };
    const a = accountSources([monthPrecisePosthumous, yearOnlyPosthumous], { deathOrdinal });
    expect(a.posthumous).toBe(2);
    expect(a.monthPrecise).toBe(0);
    expect(a.yearOnly).toBe(0);
  });

  it("counts a month-precise posthumous source as posthumous, NOT monthPrecise -- the exact bug", () => {
    // Composed Apr 1918: has a month, and would satisfy `comp.precision === 'month'`, so a
    // buggy implementation that checked precision before deathOrdinal would file it as
    // monthPrecise. It must land in posthumous instead.
    const a = accountSources(
      [{ year: 1918, event_year: 1918, event_date: "1918-04-25" }],
      { deathOrdinal },
    );
    expect(a.posthumous).toBe(1);
    expect(a.monthPrecise).toBe(0);
  });

  it("excludes a source composed later in the death year itself, ordinal not year-only", () => {
    // The amendment's case: Whitmer died 25 Jan 1888; a source composed Feb 1888 is later
    // in the SAME calendar year. `comp.year > deathYear` (1888 > 1888) is false and would
    // wrongly keep this monthPrecise; the ordinal check correctly calls it posthumous.
    const feb1888 = { year: 1888, event_year: 1888, event_date: "1888-02-02" };
    const a = accountSources([feb1888], { deathOrdinal });
    expect(a.posthumous).toBe(1);
    expect(a.monthPrecise).toBe(0);
  });

  it("holds the four-bucket sum invariant with deathOrdinal given", () => {
    const list = [
      { year: 1885, event_year: 1885, event_date: "1885-06" },        // monthPrecise
      { year: 1886, event_year: 1886, event_date: null },             // yearOnly
      { year: 1918, event_year: 1918, event_date: "1918-04-25" },     // posthumous (month)
      { year: 1940, event_year: 1885, event_date: "1885-06-28" },     // posthumous (year)
      { year: 1888, event_year: 1888, event_date: "1888-02-02" },     // posthumous (same-year)
      { year: 0 },                                                     // unusable
    ];
    const a = accountSources(list, { deathOrdinal });
    expect(a.monthPrecise + a.yearOnly + a.posthumous + a.unusable).toBe(a.total);
    expect(a.total).toBe(6);
    expect(a.posthumous).toBe(3);
  });

  it("gives a witness with no deathday posthumous === 0 while still bucketing every source", () => {
    // Hussey/Vandruver has no `deathday` at all, so WitnessLifeHeatmap's memo computes
    // deathOrdinal as null but still always passes the options object -- unlike the
    // "omitting the second argument" case above, `posthumous` must be a real 0 here, not
    // absent, so `accounting.posthumous > 0` in the render layer never sees `undefined`.
    const list = [
      { year: 1885, event_year: 1885, event_date: "1885-06" },
      { year: 1940, event_year: 1885, event_date: "1885-06-28" },
      { year: 0 },
    ];
    const a = accountSources(list, { deathOrdinal: null });
    expect(a.posthumous).toBe(0);
    expect(a.monthPrecise + a.yearOnly + a.posthumous + a.unusable).toBe(a.total);
  });
});

describe("isPosthumousComp", () => {
  const deathOrdinal = ymOrdinal(1888, 1);

  it("returns false when deathOrdinal is null or undefined", () => {
    expect(isPosthumousComp({ year: 1999, month: 1, precision: "month" }, null)).toBe(false);
    expect(isPosthumousComp({ year: 1999, month: 1, precision: "month" }, undefined)).toBe(false);
  });

  it("compares month-precise compositions at ordinal precision", () => {
    expect(isPosthumousComp({ year: 1888, month: 2, precision: "month" }, deathOrdinal)).toBe(true);
    expect(isPosthumousComp({ year: 1888, month: 1, precision: "month" }, deathOrdinal)).toBe(false);
  });

  it("falls back to year comparison for year-only compositions", () => {
    expect(isPosthumousComp({ year: 1889, month: null, precision: "year" }, deathOrdinal)).toBe(true);
    expect(isPosthumousComp({ year: 1888, month: null, precision: "year" }, deathOrdinal)).toBe(false);
  });
});

describe("matchesYearMonth", () => {
  const monthSrc = { year: 1885, event_year: 1885, event_date: "1885-06-28" };
  const yearSrc  = { year: 1885, event_year: 1885, event_date: null };

  describe("a month key is month-strict", () => {
    it("matches a month-precise source to its own month only", () => {
      expect(matchesYearMonth(monthSrc, "1885-06")).toBe(true);
      expect(matchesYearMonth(monthSrc, "1885-07")).toBe(false);
    });
    it("excludes a year-only source from a month of its own year", () => {
      // It was never dated to June. Matching here would open cards the cell never counted.
      expect(matchesYearMonth(yearSrc, "1885-06")).toBe(false);
      expect(matchesYearMonth(yearSrc, "1885-03")).toBe(false);
    });
    it("excludes unusable sources", () => {
      expect(matchesYearMonth({ year: 0 }, "1885-06")).toBe(false);
    });
  });

  describe("a bare year key selects the whole year", () => {
    it("matches both precisions from that year", () => {
      expect(matchesYearMonth(monthSrc, "1885")).toBe(true);
      expect(matchesYearMonth(yearSrc, "1885")).toBe(true);
    });
    it("excludes sources from an adjacent year", () => {
      expect(matchesYearMonth(monthSrc, "1884")).toBe(false);
      expect(matchesYearMonth(yearSrc, "1886")).toBe(false);
    });
  });

  it("returns everything when nothing is selected", () => {
    expect(matchesYearMonth(yearSrc, null)).toBe(true);
    expect(matchesYearMonth(monthSrc, null)).toBe(true);
  });

  it("keeps every heatmap cell honest: month matches == month-precise sources in it", () => {
    // THE invariant this month-strict rule exists to protect. The number rendered on a
    // heatmap cell is the count of month-precise sources in that month; clicking it must
    // open exactly that many cards. The Lucy Mack Smith 1845 shape is the stress case —
    // one month-precise source surrounded by year-only ones from the same year.
    const cluster = [
      { year: 1845, event_year: 1845, event_date: "1845-06-12" }, // month-precise, June
      { year: 1845, event_year: 1845, event_date: "1845-11" },    // month-precise, November
      { year: 1845, event_year: 1845, event_date: null },         // year-only
      { year: 1845, event_year: 1845, event_date: null },         // year-only
      { year: 1845, event_year: 1830, event_date: "1830-04-06" }, // year-only (recalls 1830)
    ];
    const monthPreciseInJune = cluster.filter(
      s => compositionDate(s).precision === "month" && compositionDate(s).month === 6
    ).length;

    expect(cluster.filter(s => matchesYearMonth(s, "1845-06")).length).toBe(monthPreciseInJune);
    expect(monthPreciseInJune).toBe(1);
    // ...while the year key still reaches all five, which is how the excluded four
    // stay discoverable via Task 13's "N more are dated 1845 without a month".
    expect(cluster.filter(s => matchesYearMonth(s, "1845")).length).toBe(5);
  });
});

describe("ymKey", () => {
  // Task 4 deletes WitnessLifeHeatmap's local ymKey and swaps its callers to this one,
  // so the two must produce byte-identical keys.
  it("zero-pads the month to two digits", () => {
    expect(ymKey(1885, 6)).toBe("1885-06");
    expect(ymKey(1885, 12)).toBe("1885-12");
  });
  it("round-trips through matchesYearMonth", () => {
    const src = { year: 1885, event_year: 1885, event_date: "1885-06-28" };
    expect(matchesYearMonth(src, ymKey(1885, 6))).toBe(true);
  });
});

/**
 * Comparator consistency, property-tested.
 *
 * WHY THIS EXISTS — do not delete it as redundant with the byCompositionDesc cases above.
 * Those fixtures hold 2 to 4 rows, and a comparator can be inconsistent while ordering any
 * small fixture correctly by luck. `Array.prototype.sort` REQUIRES a consistent comparator:
 * given an inconsistent one the spec permits any result, so a defect surfaces as ordering
 * that varies by engine, by array length (V8 switches between insertion sort and Timsort),
 * or by input order — a bug that reproduces on nobody else's machine. These properties are
 * what the small fixtures cannot establish. Task 12's groupByDecade may re-sort, which is
 * more opportunity for an inconsistency to matter.
 */
describe("byCompositionDesc consistency", () => {
  // Adversarial by construction: both precisions, both unusable shapes (`year: 0` and
  // `year: null`), duplicate seq, zero seq, absent seq, an out-of-range month, and an
  // event_date holding a data-entry timestamp rather than a real event date.
  const pool = [
    { id: "jun85a",  year: 1885, event_year: 1885, event_date: "1885-06-12", seq: 10 },
    { id: "jun85b",  year: 1885, event_year: 1885, event_date: "1885-06-30", seq: 10 }, // dup seq → exact tie
    { id: "dec85",   year: 1885, event_year: 1885, event_date: "1885-12",    seq: 0 },  // zero seq
    { id: "yr85",    year: 1885, event_year: 1885, event_date: null,         seq: 7 },
    { id: "noseq",   year: 1900, event_year: 1900, event_date: "1900-03" },             // seq absent
    { id: "cowdery", year: 1834, event_year: 1829, event_date: "1834-09-07", seq: 3 },
    { id: "moyle",   year: 1940, event_year: 1885, event_date: "1885-06-28", seq: 4 },
    { id: "badmon",  year: 1918, event_year: 1918, event_date: "1918-13",    seq: 5 },  // out-of-range month
    { id: "stamp",   year: 1888, event_year: 1888, event_date: "2022-11-02", seq: 6 },  // data-entry timestamp
    { id: "zeroyr",  year: 0,                                                seq: 5 },  // unusable, seq dup of badmon
    { id: "nullyr",  year: null,                                             seq: 0 },  // unusable, zero seq
    { id: "noyr",                 event_year: 1850 },                                   // unusable, no seq
  ];

  it("is antisymmetric over every ordered pair", () => {
    // Sum rather than negate: Math.sign returns -0 for ties and Object.is(-0, 0) is false,
    // so `expect(sign(a,b)).toBe(-sign(b,a))` fails on every tie against a correct comparator.
    for (const a of pool) for (const b of pool) {
      expect(Math.sign(byCompositionDesc(a, b)) + Math.sign(byCompositionDesc(b, a))).toBe(0);
    }
  });

  it("is transitive over every triple", () => {
    for (const a of pool) for (const b of pool) for (const c of pool) {
      if (byCompositionDesc(a, b) <= 0 && byCompositionDesc(b, c) <= 0) {
        expect(byCompositionDesc(a, c)).toBeLessThanOrEqual(0);
      }
    }
  });

  it("leaves sorted output non-decreasing under itself", () => {
    const sorted = [...pool].sort(byCompositionDesc);
    for (let i = 1; i < sorted.length; i++) {
      expect(byCompositionDesc(sorted[i - 1], sorted[i])).toBeLessThanOrEqual(0);
    }
  });

  it("orders identically no matter how the input was shuffled", () => {
    // Compared on sort key, not id: `jun85a`/`jun85b` tie exactly, and sort is stable, so a
    // correct comparator preserves whatever INPUT order a shuffle gave them. Determinism is
    // therefore only claimable up to genuine ties — asserting on ids would fail spuriously.
    const sortKey = (s) => {
      const c = compositionDate(s);
      return `${c ? c.year : "x"}|${c ? c.month : "x"}|${s.seq || 0}`;
    };
    const canonical = [...pool].sort(byCompositionDesc).map(sortKey).join(",");
    for (let i = 0; i < 100; i++) {
      const shuffled = [...pool];
      for (let j = shuffled.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
      }
      expect(shuffled.sort(byCompositionDesc).map(sortKey).join(",")).toBe(canonical);
    }
  });
});

/**
 * Task 3b — bom_xtras_history holds two archives with incompatible date semantics.
 *
 *   witnesses (444 rows) — `date` is corrupt (76 divergent rows: publication dates,
 *                          data-entry timestamps, typos). Month comes from `event_date`.
 *   reception (580 rows) — no `event_year`/`event_date` at all (580/580 null), and
 *                          `date` is clean (0 divergent). Month comes from `date`.
 *
 * Dispatch is on `src.archive`, never on row shape: 16 witnesses rows have no
 * `event_date`, so a per-row "use event_date if present, else date" fallback would
 * read the corrupt column on exactly those rows.
 */
describe("archive-polymorphic date resolution", () => {
  const receptionFull = { archive: "reception", year: 1842, date: "1842-09-14" };
  const receptionMonth = { archive: "reception", year: 1836, date: "1836-03" };
  const receptionYear = { archive: "reception", year: 1830, date: "1830" };

  describe("reception rows resolve months from `date`", () => {
    it("keeps month precision from a full date", () => {
      expect(compositionDate(receptionFull)).toEqual({ year: 1842, month: 9, precision: "month" });
    });
    it("keeps month precision from a month-only date", () => {
      expect(compositionDate(receptionMonth)).toEqual({ year: 1836, month: 3, precision: "month" });
    });
    it("degrades to year precision for a year-only date", () => {
      expect(compositionDate(receptionYear)).toEqual({ year: 1830, month: null, precision: "year" });
    });
    it("declines a month whose date disagrees with `year`", () => {
      // No such row exists in reception today (0 divergent of 580). The guard is kept in
      // BOTH strategy paths so future corruption degrades to honest year precision rather
      // than fabricating a month — the same invariant that neutralized the 18 witnesses
      // rows carrying data-entry timestamps.
      expect(compositionDate({ archive: "reception", year: 1841, date: "2019-05-02" }))
        .toEqual({ year: 1841, month: null, precision: "year" });
    });
  });

  describe("witnesses rows still never read `date`", () => {
    it("ignores a valid-but-wrong `date` in favour of event_date", () => {
      expect(compositionDate({ ...wrongDate, archive: "witnesses" }))
        .toEqual({ year: 1907, month: 5, precision: "month" });
    });
    it("degrades to year precision when event_date is missing, rather than falling back to `date`", () => {
      // THE case per-row capability dispatch gets wrong. 16 real witnesses rows look like
      // this. `date` here is a perfectly parseable 1875-07-10 that agrees with `year`, so a
      // shape-based fallback would happily report July — reading the column this module
      // exists to avoid. Archive-based dispatch declines it.
      expect(compositionDate({ ...noEventDate, archive: "witnesses" }))
        .toEqual({ year: 1875, month: null, precision: "year" });
    });
  });

  describe("unknown or missing archive", () => {
    // DELIBERATE DEVIATION from the plan's Task 3b text, which specifies a `date` default.
    // That default is unsafe here and breaks 6 existing tests: no fixture in either suite
    // sets `archive`, and the render suite's "never reads the corrupt date column" case
    // feeds date:"8795" to rows that must still resolve via event_date.
    //
    // Fail-safe direction: an unregistered archive degrades to year-only (honest) rather
    // than fabricating a month off an untrusted column. Every consumer of this module today
    // is a witnesses consumer, so a missing `archive` is far likelier to be a witnesses row.
    it("declines to read `date` for a row with no archive", () => {
      expect(compositionDate({ year: 1907, date: "1907-11-02", event_date: "1907-05-10" }))
        .toEqual({ year: 1907, month: 5, precision: "month" });
    });
    it("degrades to year precision for an unregistered archive", () => {
      expect(compositionDate({ archive: "some-future-archive", year: 1850, date: "1850-04-02" }))
        .toEqual({ year: 1850, month: null, precision: "year" });
    });
    it("does not resolve a strategy from an inherited property name", () => {
      // The strategy table is a Map for this reason. As an object literal,
      // DATE_STRATEGY["constructor"] is truthy and not 'event', so the `??`
      // fallback never fires and the row reads `date` — the corrupt column.
      for (const key of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
        expect(compositionDate({ archive: key, year: 1850, date: "1850-04-02" }))
          .toEqual({ year: 1850, month: null, precision: "year" });
      }
    });
  });

  describe("recalledEvent", () => {
    it("returns null for a reception row, which has no event_year", () => {
      expect(recalledEvent(receptionFull)).toBeNull();
      expect(recalledEvent({ archive: "reception", year: 1842, date: "1842-09-14", event_year: null, event_date: null }))
        .toBeNull();
    });
  });

  describe("byCompositionDesc across a mixed-archive list", () => {
    it("inherits dispatch, ordering both archives by their own resolved dates", () => {
      const mixed = [
        { id: "r1836", archive: "reception", year: 1836, date: "1836-03", seq: 1 },
        { id: "w1907", archive: "witnesses", year: 1907, date: "1907-11-02", event_date: "1907-05-10", seq: 2 },
        { id: "r1842", archive: "reception", year: 1842, date: "1842-09-14", seq: 3 },
        { id: "w1836dec", archive: "witnesses", year: 1836, date: "1899", event_date: "1836-12", seq: 4 },
      ];
      // w1907 (1907) > r1842 (Sep 1842) > w1836dec (Dec 1836) > r1836 (Mar 1836).
      // w1836dec beats r1836 on month, which is only true if the witnesses row read
      // event_date (Dec) and the reception row read date (Mar).
      expect([...mixed].sort(byCompositionDesc).map((s) => s.id))
        .toEqual(["w1907", "r1842", "w1836dec", "r1836"]);
    });
  });
});

describe("groupByDecade", () => {
  const sorted = [
    { slug: "a", year: 1945, event_year: 1945, event_date: "1945-09" },
    { slug: "b", year: 1888, event_year: 1888, event_date: "1888-01" },
    { slug: "c", year: 1885, event_year: 1885, event_date: "1885-06" },
    { slug: "d", year: 1881, event_year: 1881, event_date: "1881-12" },
  ];
  it("groups into decades, preserving the incoming order", () => {
    expect(groupByDecade(sorted)).toEqual([
      { decade: 1940, label: "1940s", sources: [sorted[0]] },
      { decade: 1880, label: "1880s", sources: [sorted[1], sorted[2], sorted[3]] },
    ]);
  });
  it("returns an empty array for no sources", () => {
    expect(groupByDecade([])).toEqual([]);
  });
  it("does not merge two runs of the same decade separated by another decade", () => {
    // Composition order is caller-controlled; groupByDecade only merges ADJACENT
    // same-decade runs. A caller who passes an already-sorted (by year) list never
    // hits this, but the function itself makes no such assumption.
    const nonAdjacent = [
      { slug: "x", year: 1945 },
      { slug: "y", year: 1888 },
      { slug: "z", year: 1941 },
    ];
    expect(groupByDecade(nonAdjacent).map((g) => g.label)).toEqual(["1940s", "1880s", "1940s"]);
  });
  it("labels a source with no usable composition year as Undated", () => {
    // Defensive only: every live witnesses/reception row has a non-null `year`
    // (see the plan's data-profiling table), so this branch is unreached by real
    // data today. Pinned anyway because groupByDecade is a pure function tested
    // in isolation, and `compositionDate` returning null is a real, reachable
    // return value of a function this one calls directly.
    const withUndated = [{ slug: "u", year: 0 }, ...sorted];
    const groups = groupByDecade(withUndated);
    expect(groups[0]).toEqual({ decade: null, label: "Undated", sources: [withUndated[0]] });
    expect(groups[1].label).toBe("1940s");
  });
});
