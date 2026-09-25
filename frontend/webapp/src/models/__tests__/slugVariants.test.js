import fs from "node:fs";
import path from "node:path";
import { resolveSlug } from "../slugVariants";

// Same fixtures as frontend/next/test/unit/slug-variants.test.ts — the two
// implementations must agree outcome-for-outcome.
const PEOPLE = [
  "noah1", "noah2", "noah3", "noahs-priests", "people-of-noah",
  "nephi1", "nephi2", "nephites", "nephihah", "nephite-spies",
  "shem2",
  "angels-to-nephi", "angels-to-nephi3",
  "abinadi",
];
const PLACES = ["jerusalem-1", "jerusalem-2", "zarahemla", "bountiful-1"];

describe("resolveSlug", () => {
  test("exact slug wins even when numeric variants exist", () => {
    expect(resolveSlug("angels-to-nephi", PEOPLE)).toEqual({ kind: "exact", slug: "angels-to-nephi" });
    expect(resolveSlug("abinadi", PEOPLE)).toEqual({ kind: "exact", slug: "abinadi" });
  });

  test("exactly one variant → redirect", () => {
    expect(resolveSlug("shem", PEOPLE)).toEqual({ kind: "redirect", slug: "shem2" });
    expect(resolveSlug("bountiful", PLACES)).toEqual({ kind: "redirect", slug: "bountiful-1" });
  });

  test("several variants → chooser, in dataset order", () => {
    expect(resolveSlug("noah", PEOPLE)).toEqual({ kind: "chooser", candidates: ["noah1", "noah2", "noah3"] });
    expect(resolveSlug("jerusalem", PLACES)).toEqual({ kind: "chooser", candidates: ["jerusalem-1", "jerusalem-2"] });
  });

  test("rejects the loose prefix matches the old startsWith rule accepted", () => {
    expect(resolveSlug("noah", PEOPLE).candidates).not.toContain("noahs-priests");
    expect(resolveSlug("nephi", PEOPLE).candidates).toEqual(["nephi1", "nephi2"]);
  });

  test("no match → none", () => {
    expect(resolveSlug("king-noah", PEOPLE)).toEqual({ kind: "none" });
    expect(resolveSlug("", PEOPLE)).toEqual({ kind: "none" });
  });

  test("input is case-insensitive and trimmed", () => {
    expect(resolveSlug("NOAH", PEOPLE)).toEqual({ kind: "chooser", candidates: ["noah1", "noah2", "noah3"] });
    expect(resolveSlug("  Shem ", PEOPLE)).toEqual({ kind: "redirect", slug: "shem2" });
  });

  test("regex metacharacters are escaped, not interpreted", () => {
    expect(resolveSlug("noah.", PEOPLE)).toEqual({ kind: "none" });
    expect(resolveSlug("n(o)ah", PEOPLE)).toEqual({ kind: "none" });
  });

  // Drift guard, modelled on frontend/next/test/unit/vector-taxonomy-drift.test.ts:
  // the rule now lives in two languages in two packages. If one side is edited,
  // fail here rather than let SSR and the CRA disagree about what /people/noah means.
  test("stays in sync with the SSR implementation", () => {
    const ssr = fs.readFileSync(
      path.resolve(__dirname, "../../../../next/lib/slug-variants.ts"),
      "utf8",
    );
    // Strip comments first: the SSR file's header explains why it ABANDONED
    // startsWith, so asserting against the raw text would match the prose.
    const code = ssr.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // The variant pattern fragment, verbatim in both files.
    expect(code).toContain("-?\\\\d+$");
    // Neither side may fall back to prefix matching.
    expect(code).not.toContain("startsWith");
    // Exact-match-wins ordering must still be present on the SSR side.
    expect(ssr.indexOf("kind: 'exact'")).toBeLessThan(ssr.indexOf("kind: 'redirect'"));
  });
});
