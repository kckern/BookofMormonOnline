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
  test("a <sup>N</sup> disambiguator stays attached to its name (no 'Alma 2' scripture leak)", () => {
    expect(flatten("{Alma<sup>2</sup>|alma2} was teaching")).toBe("Alma² was teaching");
    expect(flatten("Ammon<sup> 2 </sup> and his brethren")).toBe("Ammon² and his brethren");
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
  test("an initial or abbreviation is not a sentence end (blind audit witness-H3)", () => {
    const a = clampWords("Interview with David Whitmer at his home in Richmond, Missouri, in I. Woodbury Pratt papers collection here", 14);
    expect(a).not.toMatch(/ I\.$/);
    expect(a).toMatch(/…$/);
    // a real sentence end is still preferred
    expect(clampWords("Gamma delta epsilon zeta. Eta theta iota", 6)).toBe("Gamma delta epsilon zeta.");
    expect(clampWords("Letter to the editor, rep. Saints' Herald 22, no. 4 (1875) pp. 1-3 more", 9)).not.toMatch(/no\.$/);
    expect(clampWords("Letter to the editor, rep. Saints' Herald 22, no. 4 (1875) pp. 1-3 more", 9)).toMatch(/…$/);
  });
  test("never strands an open parenthetical", () => {
    expect(clampWords("word word word word (open paren here", 5)).toBe(
      "word word word word…"
    );
  });
});

describe("clampWords — no orphan punctuation before the ellipsis (blind audit matters-04)", () => {
  test.each([
    ["Jacob names the purpose of his temple sermon – to declare the word", 8, "Jacob names the purpose of his temple sermon…"],
    ["He records “the genealogy of my fathers” in full", 3, "He records…"],
    ["Nephi keeps the record “ of his people", 5, "Nephi keeps the record…"],
  ])("%s", (text, n, want) => {
    expect(clampWords(text, n)).toBe(want);
  });
});

describe("clampWords phrase mode: no dangling verbs/time words (audit places-H3)", () => {
  test.each([
    ["Land established by Nephi, later occupied by Lamanites, Zeniffites", 5, "Land established by Nephi…"],
    ["Lamanites in Shimnilom are converted to the Lord", 4, "Lamanites in Shimnilom…"],
    ["City in Northwest Syria, currently known as Hama", 5, "City in Northwest Syria…"],
    ["Site of battle between Shared and Coriantumr", 5, "Site of battle…"],
  ])("%s / %d", (text, n, out) => {
    expect(clampWords(text, n, { phrase: true })).toBe(out);
  });
  test("non-phrase mode is unchanged", () => {
    expect(clampWords("Lamanites in Shimnilom are converted to the Lord", 4)).toBe("Lamanites in Shimnilom are…");
  });
});
