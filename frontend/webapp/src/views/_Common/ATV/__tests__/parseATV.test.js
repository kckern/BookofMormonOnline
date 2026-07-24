import {
  scanBrackets,
  isApparatus,
  trailingSigla,
  splitReading,
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
});
