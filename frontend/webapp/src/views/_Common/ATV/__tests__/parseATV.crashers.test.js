import { parseApparatus } from "../parseATV";

// The two apparatus entries that BLANK THE ENTIRE PAGE under the old renderer.
// There are no error boundaries in this app, so a throw here unmounts everything.
// These strings are VERBATIM from the production corpus (the `.source` block,
// whitespace-collapsed). Do not "tidy" them — the quirks are the regression.
//
// Old failure modes:
//   1080616101 — a trailing space before the "|" (`… 1 |thing A|`); the old
//     sigla-strip mishandled it.
//   1610416602 — nested brackets (`Benjamin [Mosiah?] P`); the old non-greedy
//     `/\[([^]+?)\]/g` closed on the inner "]" and corrupted the parse.

const ENTRY_1080616101 =
  "and I will make my judgment to rest for a light [thing &gt;js NULL 1 |thing A| BCDEFGHIJKLMNOPQRST] [NULL &gt; of &gt;js for 1|of A|for BCDEFGHIJKLMNOPQRST] the people";

const ENTRY_1610416602 =
  "and for this cause did king [Benjamin 1ABCDGHK|Mosiah EFIJLMNOQRT| Benjamin [Mosiah?] P|Benjamin {Mosiah?} S] keep them";

describe("the two page-blanking entries parse cleanly", () => {
  test("1080616101 — trailing space before the pipe — two units, no warnings", () => {
    let result;
    expect(() => (result = parseApparatus(ENTRY_1080616101))).not.toThrow();
    const { segments, warnings } = result;
    expect(warnings).toEqual([]);
    expect(segments.map((s) => s.kind)).toEqual(["text", "unit", "unit", "text"]);

    const [, u1, u2] = segments;
    // first unit: the trailing-space reading still splits into 3 readings
    expect(u1.readings).toHaveLength(3);
    expect(u1.readings[0].sigla).toEqual(["1"]);
    expect(u1.readings[0].states).toHaveLength(2); // "thing" -> corrected (js)
    expect(u1.readings[2].sigla).toHaveLength(19); // B..T
    // second unit's Printer's-MS reading is a 3-state correction chain
    expect(u2.readings[0].sigla).toEqual(["1"]);
    expect(u2.readings[0].states).toHaveLength(3);

    expect(segments[0].text).toContain("a light");
    expect(segments[3].text).toBe("the people");
  });

  test("1610416602 — nested [Mosiah?] brackets — one unit of four readings", () => {
    let result;
    expect(() => (result = parseApparatus(ENTRY_1610416602))).not.toThrow();
    const { segments, warnings } = result;
    expect(warnings).toEqual([]);
    expect(segments.map((s) => s.kind)).toEqual(["text", "unit", "text"]);

    const unit = segments[1];
    expect(unit.readings).toHaveLength(4);
    // the nested bracket is preserved INSIDE the reading content, not split out
    expect(unit.readings[2].sigla).toEqual(["P"]);
    expect(unit.readings[2].states[0].content).toBe("Benjamin [Mosiah?]");
    expect(unit.readings[3].sigla).toEqual(["S"]);
    expect(unit.readings[3].states[0].content).toBe("Benjamin {Mosiah?}");

    expect(segments[0].text).toBe("and for this cause did king");
    expect(segments[2].text).toBe("keep them");
  });
});

describe("hostile and degenerate input never throws", () => {
  const inputs = [
    "",
    "[",
    "]",
    "[[[",
    "]]]",
    "[|]",
    "[A|]",
    "[|||A]",
    "[NULL]",
    "[&gt;js]",
    "[Mosiah?] P|",
    "text with a stray ] bracket",
    "unclosed [a A|b B",
    "&gt; &gt; &gt;",
    "[a A|b B][c A|d B]", // adjacent units, no separator
  ];

  test.each(inputs)("parseApparatus(%j) returns a shape and does not throw", (src) => {
    let out;
    expect(() => (out = parseApparatus(src))).not.toThrow();
    expect(Array.isArray(out.segments)).toBe(true);
    expect(Array.isArray(out.warnings)).toBe(true);
  });

  test("null and undefined are handled", () => {
    expect(() => parseApparatus(null)).not.toThrow();
    expect(() => parseApparatus(undefined)).not.toThrow();
    expect(parseApparatus(null).segments).toEqual([]);
    expect(parseApparatus(undefined).segments).toEqual([]);
  });
});
