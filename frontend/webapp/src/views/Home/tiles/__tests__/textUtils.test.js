import { flatten, supDigits, enDash, clampWords } from "../textUtils";

describe("supDigits", () => {
  test("turns a name-attached disambiguation digit into a superscript", () => {
    expect(supDigits("Heth2")).toBe("Heth²");
    expect(supDigits("Nephi1 and Lamanite3")).toBe("Nephi¹ and Lamanite³");
  });
  test("leaves standalone or non-1-4 digits alone", () => {
    expect(supDigits("Alma 32")).toBe("Alma 32"); // space before the digit → no match
    expect(supDigits("A9")).toBe("A9"); // 9 is not in the 1-4 set
  });
  test("tolerates empty/nullish input", () => {
    expect(supDigits("")).toBe("");
    expect(supDigits(undefined)).toBe("");
  });
});

describe("flatten", () => {
  test("resolves {Name|slug} and [Name|slug] link markup to the display name", () => {
    expect(flatten("{Alma|alma} taught [Helaman|helaman]")).toBe("Alma taught Helaman");
  });
  test("strips HTML, collapses whitespace, and tightens parentheses", () => {
    expect(flatten("Alma said <b>hi</b>  ( there )")).toBe("Alma said hi (there)");
  });
  test("superscripts disambiguation digits after flattening", () => {
    expect(flatten("{Heth2|heth} reigned")).toBe("Heth² reigned");
  });
  test("tolerates empty/nullish input", () => {
    expect(flatten("")).toBe("");
    expect(flatten(undefined)).toBe("");
  });
});

describe("enDash", () => {
  test("renders a hyphen between two digits as an en-dash", () => {
    expect(enDash("2-3")).toBe("2–3");
    expect(enDash("1 Nephi 3:7-8")).toBe("1 Nephi 3:7–8");
  });
  test("leaves non-numeric hyphens alone", () => {
    expect(enDash("valley-of-gideon")).toBe("valley-of-gideon");
  });
});

describe("clampWords", () => {
  test("returns the text unchanged when within the word budget", () => {
    expect(clampWords("one two three", 5)).toBe("one two three");
  });
  test("truncates on the word boundary with an ellipsis when over budget", () => {
    expect(clampWords("one two three four five", 3)).toBe("one two three…");
  });
  test("prefers a sentence boundary that lands in the back half of the cut", () => {
    expect(clampWords("Gamma delta epsilon zeta. Eta theta iota", 6)).toBe(
      "Gamma delta epsilon zeta."
    );
  });
  test("never strands an open parenthetical", () => {
    expect(clampWords("word word word word (open paren here", 5)).toBe(
      "word word word word…"
    );
  });
});
