import { assembleSampler } from "../Sampler";

// blind audit r4 places-H1: the five Places cards go to places with a strong
// hook. Ranked once at assembly, so the cached payload, both place tiles and
// the infinite batches' seen-place bookkeeping all see the same order.
test("assembleSampler ranks the sample's places by card-hook strength", () => {
  const P = (i, text) => ({ slug: `p${i}`, name: `P${i}`, index: [{ ref: "Alma 1:1", text }] });
  const places = [P(0, "Is burned"), P(1, "Nephites march to Jordan"), P(2, "Is burned"), P(3, "Lamanites flee")];
  const out = assembleSampler({ homesampler: [{ seed: 4, places }] });
  expect(out.places.map((p) => p.slug)).toEqual(["p1", "p0", "p2", "p3"]);
  expect(out.seed).toBe(4);
});
