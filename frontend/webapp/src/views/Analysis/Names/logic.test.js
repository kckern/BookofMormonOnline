import { FIELD_DEFS, emptyFilters, applyFilters } from "./logic";

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
