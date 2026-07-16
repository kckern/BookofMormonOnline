import { FIELD_DEFS, emptyFilters, applyFilters, facetCounts, segmentName, filtersToQuery, queryToFilters, entitySlugs } from "./logic";

const fixture = [
  { name: "Moroni", types: ["person", "place"], cultures: ["Nephite"], prefix: null, stems: ["Mor"], affix: "~on~", suffix: "~i", note: null },
  { name: "Ammoron", types: ["person"], cultures: ["Nephite"], prefix: "Am~", stems: ["Mor"], affix: null, suffix: "~on", note: null },
  { name: "Shiz", types: ["person"], cultures: ["Jaredite"], prefix: null, stems: ["Shiz"], affix: null, suffix: null, note: null },
  { name: "Teancum", types: ["person", "place"], cultures: ["Nephite"], prefix: null, stems: ["Tean", "Cum"], affix: null, suffix: null, note: null },
];

describe("applyFilters", () => {
  it("returns everything for empty filters", () => {
    expect(applyFilters(fixture, emptyFilters())).toHaveLength(4);
  });
  it("ORs within a facet", () => {
    const f = { ...emptyFilters(), cultures: ["Jaredite", "Nephite"] };
    expect(applyFilters(fixture, f)).toHaveLength(4);
  });
  it("ANDs across facets", () => {
    const f = { ...emptyFilters(), stems: ["Mor"], prefix: ["Am~"] };
    expect(applyFilters(fixture, f).map((e) => e.name)).toEqual(["Ammoron"]);
  });
  it("matches any stem of a multi-stem name", () => {
    const f = { ...emptyFilters(), stems: ["Cum"] };
    expect(applyFilters(fixture, f).map((e) => e.name)).toEqual(["Teancum"]);
  });
  it("never matches null prefix/affix/suffix against a selection", () => {
    const f = { ...emptyFilters(), suffix: ["~on"] };
    expect(applyFilters(fixture, f).map((e) => e.name)).toEqual(["Ammoron"]);
  });
});

describe("facetCounts", () => {
  it("counts values with no filters active", () => {
    const counts = facetCounts(fixture, emptyFilters(), "stems");
    expect(counts.get("Mor")).toBe(2);
    expect(counts.get("Cum")).toBe(1);
  });
  it("ignores the facet's own selection but honors others", () => {
    const f = { ...emptyFilters(), stems: ["Shiz"], cultures: ["Nephite"] };
    const counts = facetCounts(fixture, f, "stems");
    expect(counts.get("Mor")).toBe(2);
    expect(counts.get("Shiz")).toBeUndefined();
  });
});

describe("segmentName", () => {
  const seg = (over) => segmentName({ prefix: null, stems: [], affix: null, suffix: null, ...over });
  it("splits stem + affix + suffix", () => {
    expect(seg({ name: "Moroni", stems: ["Mor"], affix: "~on~", suffix: "~i" }))
      .toEqual([{ text: "Mor", role: "stem" }, { text: "on", role: "affix" }, { text: "i", role: "suffix" }]);
  });
  it("splits prefix + stem + suffix", () => {
    expect(seg({ name: "Ammoron", prefix: "Am~", stems: ["Mor"], suffix: "~on" }))
      .toEqual([{ text: "Am", role: "prefix" }, { text: "mor", role: "stem" }, { text: "on", role: "suffix" }]);
  });
  it("splits two stems with medial affix", () => {
    expect(seg({ name: "Moriancumer", stems: ["Mor", "Cum"], affix: "~ian~", suffix: "~er" }))
      .toEqual([{ text: "Mor", role: "stem" }, { text: "ian", role: "affix" }, { text: "cum", role: "stem" }, { text: "er", role: "suffix" }]);
  });
  it("tolerates hyphens between parts, preserving original text", () => {
    expect(seg({ name: "Ani-Anti", stems: ["Ani", "Ant"], suffix: "~i" }))
      .toEqual([{ text: "Ani", role: "stem" }, { text: "-", role: "sep" }, { text: "Ant", role: "stem" }, { text: "i", role: "suffix" }]);
  });
  it("returns null when morphemes cannot reconstruct the name", () => {
    expect(seg({ name: "Kumen", stems: ["Cumen"] })).toBeNull();
  });
  it("returns single whole-name stem span", () => {
    expect(seg({ name: "Shiz", stems: ["Shiz"] })).toEqual([{ text: "Shiz", role: "stem" }]);
  });
});

describe("querystring codec", () => {
  it("round-trips filters", () => {
    const f = { ...emptyFilters(), stems: ["Mor", "Cum"], cultures: ["Jaredite"], prefix: ["Am~"] };
    expect(queryToFilters(filtersToQuery(f))).toEqual(f);
  });
  it("omits empty facets and returns empty string for no filters", () => {
    expect(filtersToQuery(emptyFilters())).toBe("");
  });
  it("ignores unknown params", () => {
    expect(queryToFilters("?stem=Mor&foo=1").stems).toEqual(["Mor"]);
  });
  it("encodes tildes safely", () => {
    const f = { ...emptyFilters(), suffix: ["~iah"] };
    expect(queryToFilters(filtersToQuery(f)).suffix).toEqual(["~iah"]);
  });
});

describe("entitySlugs", () => {
  const people = { nephi1: { name: "Nephi1", slug: "nephi1" }, abinadi: { name: "Abinadi", slug: "abinadi" } };
  const places = { "hill-cumorah": { name: "Hill Cumorah", slug: "hill-cumorah" } };
  it("matches a person by base name, digits stripped", () => {
    expect(entitySlugs("Nephi", people, places).person).toBe("nephi1");
  });
  it("matches a place by last word of descriptive name", () => {
    expect(entitySlugs("Cumorah", people, places).place).toBe("hill-cumorah");
  });
  it("returns nulls when nothing matches", () => {
    expect(entitySlugs("Ziff", people, places)).toEqual({ person: null, place: null });
  });
});
