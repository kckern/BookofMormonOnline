import {
  scanBrackets,
  isApparatus,
  trailingSigla,
  splitReading,
  parseStates,
} from "../parseATV";

describe("scanBrackets", () => {
  test("returns the inner text of each top-level bracket group", () => {
    expect(scanBrackets("a [x|y A] b [p|q B] c")).toEqual(["x|y A", "p|q B"]);
  });

  test("nested brackets close on the OUTER bracket, not the inner one", () => {
    // entry 1610416602 — one of the two live crashers
    const src =
      "did king [Benjamin 1ABCDGHK|Mosiah EFIJLMNOQRT| Benjamin [Mosiah?] P|Benjamin {Mosiah?} S] keep them";
    expect(scanBrackets(src)).toEqual([
      "Benjamin 1ABCDGHK|Mosiah EFIJLMNOQRT| Benjamin [Mosiah?] P|Benjamin {Mosiah?} S",
    ]);
  });

  test("unbalanced brackets are dropped rather than throwing", () => {
    expect(scanBrackets("a [x|y A")).toEqual([]);
    expect(scanBrackets("a ] b")).toEqual([]);
  });

  test("a stray closing bracket does not swallow a later group", () => {
    // depth must never go negative, or the next "[" opens at the wrong depth
    expect(scanBrackets("a ] b [x|y A] c")).toEqual(["x|y A"]);
  });

  test("no brackets yields an empty list", () => {
    expect(scanBrackets("plain text")).toEqual([]);
  });
});

describe("isApparatus / trailingSigla", () => {
  test("accepts a group whose every part ends in known sigla", () => {
    expect(isApparatus("<em>to be</em> A|<em>is</em> BCDEFGHIJKLMNOPQRST")).toBe(true);
  });

  test("rejects a single-part group — a unit needs a disagreement", () => {
    expect(isApparatus("<em>the</em> 1ABCDEFGHIJKLMNOPRST")).toBe(false);
  });

  test("rejects [JST] — all valid sigla, but not apparatus shape", () => {
    expect(isApparatus("JST")).toBe(false);
  });

  test("rejects a piped bracket that is not an apparatus", () => {
    // entry 1023516101 — a spelling note in prose, not a variation unit
    expect(isApparatus("<em>a</em>|<em>o</em>")).toBe(false);
  });

  test("rejects when any single part lacks trailing sigla", () => {
    expect(isApparatus("<em>in</em> 01ABCDEFGHIJKLMNOPQRST|<em>into</em> ")).toBe(false);
  });

  test("tolerates whitespace before the pipe", () => {
    // entry 1080616101 — the other live crasher
    expect(isApparatus("thing &gt;js NULL 1 |thing A| BCDEFGHIJKLMNOPQRST")).toBe(true);
  });

  test("rejects sigla-shaped runs containing letters that are not witnesses", () => {
    expect(trailingSigla("something UVW")).toBeNull(); // U-Z are not witnesses
    expect(trailingSigla("<em>is</em> BCD")).toBe("BCD");
  });

  test("returns the whole run when a part is nothing but sigla", () => {
    expect(trailingSigla(" BCDEFGHIJKLMNOPQRST")).toBe("BCDEFGHIJKLMNOPQRST");
    expect(trailingSigla("01")).toBe("01");
  });

  test("returns null when a part ends in no sigla at all", () => {
    expect(trailingSigla("<em>into</em> ")).toBeNull();
    expect(trailingSigla("")).toBeNull();
  });

  test("a rejected part rejects the whole group even in third position", () => {
    expect(isApparatus("<em>a</em> A|<em>b</em> B|<em>c</em>")).toBe(false);
  });
});

describe("splitReading", () => {
  test("strips sigla from the END, not the first occurrence", () => {
    // entry 1022316101 — currently renders as "nd it came to pass that A"
    // because replace("A","") kills the capital A in "And".
    const r = splitReading(" And it came to pass that A");
    expect(r.sigla).toEqual(["A"]);
    expect(r.content).toBe("And it came to pass that");
  });

  test("preserves HTML entities in content", () => {
    // entry 1005916101 — the 𝒪① supralinear-insert marks
    const r = splitReading("&#120034;&#9312; <em>of the Lord</em> 0");
    expect(r.sigla).toEqual(["0"]);
    expect(r.content).toBe("&#120034;&#9312; <em>of the Lord</em>");
  });

  test("expands a multi-letter run into individual sigla", () => {
    const r = splitReading("<em>is</em> BCDEFGHIJKLMNOPQRST");
    expect(r.sigla).toEqual("BCDEFGHIJKLMNOPQRST".split(""));
    expect(r.content).toBe("<em>is</em>");
  });

  test("a part with no trailing sigla yields empty sigla and no throw", () => {
    const r = splitReading("<em>into</em> ");
    expect(r.sigla).toEqual([]);
    expect(r.content).toBe("<em>into</em>");
  });

  test("an empty or NULL reading keeps its sigla", () => {
    expect(splitReading(" BCDEFGHIJKLMNOPQRST").content).toBe("");
    expect(splitReading(" BCDEFGHIJKLMNOPQRST").sigla).toEqual(
      "BCDEFGHIJKLMNOPQRST".split("")
    );
    expect(splitReading("NULL 1").content).toBe("NULL");
    expect(splitReading("NULL 1").sigla).toEqual(["1"]);
  });

  test("a non-witness trailing run stays in the content", () => {
    // U-Z are not sigla, so "UVW" is text, not witnesses
    const r = splitReading("something UVW");
    expect(r.sigla).toEqual([]);
    expect(r.content).toBe("something UVW");
  });

  test("leaves correction markers in the content for the chain parser", () => {
    const r = splitReading("thing &gt;js NULL 1 ");
    expect(r.sigla).toEqual(["1"]);
    expect(r.content).toBe("thing &gt;js NULL");
  });

  test("sigla-shaped content resolves correctly when a separator precedes the sigla", () => {
    // "ALMA" is four valid sigla; the space before the real run is what saves it.
    const r = splitReading("THE SON OF ALMA ABCDEFGHIJKLMNOPQRST");
    expect(r.sigla).toEqual("ABCDEFGHIJKLMNOPQRST".split(""));
    expect(r.content).toBe("THE SON OF ALMA");
  });
});

describe("parseStates", () => {
  test("a reading with no correction is a single original state", () => {
    const s = parseStates("<em>to be</em>");
    expect(s).toEqual([{ content: "<em>to be</em>", omitted: false, via: null }]);
  });

  test("tight and spaced markers parse to the same code (entry 1000216101/102)", () => {
    const spaced = parseStates("<em>to be</em> &gt; js <em>is</em>");
    const tight = parseStates("to be >js is");   // literal '>' preceded by space — mirror row
    expect(spaced.map((x) => x.content)).toEqual(["<em>to be</em>", "<em>is</em>"]);
    expect(spaced[1].via.code).toBe("js");
    expect(spaced[1].via.label).toMatch(/Joseph Smith/);
    expect(tight.map((x) => x.content)).toEqual(["to be", "is"]);
    expect(tight[1].via.code).toBe("js");
  });

  test("a bare marker has code null and the BARE_CHANGE label (entry 1000316102)", () => {
    const s = parseStates("that &gt; the");
    expect(s).toHaveLength(2);
    expect(s[1].via.code).toBe(null);
    expect(s[1].via.label).toBe("change");
  });

  test("NULL as the original state is an omission (entry 1000316101)", () => {
    const s = parseStates("NULL &gt; <em>first year of the</em>");
    expect(s[0].omitted).toBe(true);
    expect(s[0].content).toBe("");
    expect(s[1].omitted).toBe(false);
  });

  test("three states, absent -> read it -> read (entry 1001016101)", () => {
    const s = parseStates("NULL &gt;+ <em>read it</em> &gt;% <em>read</em>");
    expect(s).toHaveLength(3);
    expect(s[0].omitted).toBe(true);
    expect(s[1].content).toBe("<em>read it</em>");
    expect(s[1].via.code).toBe("+");
    expect(s[2].via.code).toBe("%");
  });

  test("present -> omitted -> present, the case a boolean cannot hold (entry 1022216101)", () => {
    const s = parseStates("<em>of</em> &gt;js NULL &gt;js <em>of</em>");
    expect(s.map((x) => x.omitted)).toEqual([false, true, false]);
    expect(s.map((x) => x.via && x.via.code)).toEqual([null, "js", "js"]);
  });

  test("the en-dash code arrives as an entity (&gt;&ndash;)", () => {
    const s = parseStates("<em>x</em> &gt;&ndash; <em>y</em>");
    expect(s[1].via.code).toBe("–");   // U+2013
    expect(s[1].via.label).toMatch(/less ink/);
  });

  test("longest-match: &gt;%+ is the two-char code, not % then +", () => {
    const s = parseStates("<em>a</em> &gt;%+ <em>b</em>");
    expect(s[1].via.code).toBe("%+");
    expect(s).toHaveLength(2);
  });

  test("an unknown code still yields a state, with a null label", () => {
    const s = parseStates("<em>x</em> &gt;zz <em>y</em>");
    expect(s).toHaveLength(2);
    expect(s[1].via.code).toBe("zz");
    expect(s[1].via.label).toBe(null);
  });

  test("a marker abutting a non-code word keeps the word as content, not ∅", () => {
    const s = parseStates("go &gt;people now");
    // "people" is 6 alpha chars — not a code. Marker degrades to bare; word survives.
    expect(s[1].content).toContain("people");
    expect(s[1].omitted).toBe(false);
  });

  test("a tag-closing '>' is NOT a marker", () => {
    // no whitespace before the '>' of </em>, and it is not an entity
    const s = parseStates("<em>whoso</em>");
    expect(s).toHaveLength(1);
    expect(s[0].content).toBe("<em>whoso</em>");
  });

  test("never throws on odd input", () => {
    for (const c of ["", "&gt;", "&gt;js", "NULL", "&gt; &gt; &gt;"]) {
      expect(() => parseStates(c)).not.toThrow();
      expect(Array.isArray(parseStates(c))).toBe(true);
      expect(parseStates(c).length).toBeGreaterThanOrEqual(1);
    }
  });
});
