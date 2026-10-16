import { skeletonHeight } from "../skeletonHeights";

// Re-measured live 2026-10-16 (tileharness, 1440px desktop / 390px phone) after
// the matters fixes: the old 373/670 left a 32-58px jump on paint (audit matters-06).
describe("skeletonHeights — matters family", () => {
  test.each([
    ["tile-mattersNarrative", false, "407px"],
    ["tile-mattersMaterial", false, "407px"],
    ["tile-mattersConcept", false, "407px"],
    ["tile-mattersNarrative", true, "706px"],
    ["tile-mattersMaterial", true, "706px"],
    ["tile-mattersConcept", true, "732px"],
    ["tile-matterProfile", false, "420px"],
    ["tile-matterProfile", true, "410px"],
  ])("%s (phone=%s) reserves %s", (span, single, h) => {
    expect(skeletonHeight(span, single)).toBe(h);
  });
});
