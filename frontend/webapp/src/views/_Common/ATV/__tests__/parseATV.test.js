import { scanBrackets } from "../parseATV";

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
