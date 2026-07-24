import { scanBrackets, isApparatus, trailingSigla } from "../parseATV";

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
