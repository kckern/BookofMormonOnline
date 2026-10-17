import { hookLines, rankPlaces, hookStrength } from "../PlacesTile";

// audit places-H2: Isaiah toponyms surfaced quotation fragments as hooks
// ("Is not Hamath as Arpad?", "Also known as Ai, possibly Et-Tell").
describe("hookLines", () => {
  test("prefers a statement over a rhetorical question or an alias note", () => {
    const idx = [
      { ref: "2 Nephi 20:9", text: "Is not Hamath as Arpad?" },
      { ref: "2 Nephi 20:28", text: "Also known as Ai, possibly Et-Tell" },
      { ref: "2 Nephi 20:28", text: "Assyrians have come to Aiath" },
    ];
    expect(hookLines(idx).map((x) => x.text)).toEqual(["Assyrians have come to Aiath"]);
  });
  test("falls back to what there is when every line is weak", () => {
    const idx = [{ ref: "2 Nephi 20:9", text: "Is not Hamath as Arpad?" }];
    expect(hookLines(idx)).toHaveLength(1);
  });
  test("still prefers 3+ word phrases over one-word glosses", () => {
    const idx = [{ ref: "A 1:1", text: "Retained" }, { ref: "A 1:2", text: "Moroni makes camp" }];
    expect(hookLines(idx).map((x) => x.text)).toEqual(["Moroni makes camp"]);
  });
});

// blind audit r3 places-H1: on the 105px desktop card the gloss gets ~3 lines
// beside its ref chip, so long index lines ended as "The Lord will stir up…".
// Lines that fit the card's budget win; when none does, the shortest does.
describe("hookLines card budget (places-H1)", () => {
  test("a line that fits the card beats one that would be cut", () => {
    const idx = [
      { ref: "2 Nephi 20:28", text: "The Lord will stir up a scourge for him according to the slaughter of Midian" },
      { ref: "Alma 47:5", text: "Amalickiah goes to place of Onidah" },
    ];
    expect(hookLines(idx).map((x) => x.text)).toEqual(["Amalickiah goes to place of Onidah"]);
  });
  test("the budget counts the ref chip too", () => {
    const idx = [
      { ref: "2 Nephi 20:28", text: "Assyria laid up carriages at Michmash" },
      { ref: "Alma 47:5", text: "Nephites pitch their tents" },
    ];
    expect(hookLines(idx).map((x) => x.ref)).toEqual(["Alma 47:5"]);
  });
  test("when nothing fits, the shortest real line is the hook", () => {
    const idx = [
      { ref: "Alma 50:1", text: "Key location in Moroni's tactical defense of the whole Nephite land" },
      { ref: "Alma 50:2", text: "Ammaron deposited records here for safekeeping until a later day" },
      { ref: "Alma 50:3", text: "The children of Ammon shall obey Ephraim in that day" },
    ];
    expect(hookLines(idx).map((x) => x.ref)).toEqual(["Alma 50:3"]);
  });
});

// blind audit r4 places-H1: ~40% of cards carried a stub ("Ramath is afraid",
// "Is not Calno as Carchemish", "Is captured by Lamanites", "Gibeah of Saul
// mentioned…"). Subject-less and narrator stubs are weak hooks, and the five
// card slots go to places with a strong hook (weak ones feed the mosaic).
describe("weak hooks (places-H1, r4)", () => {
  test.each([
    "Is not Calno as Carchemish",
    "Is captured by Lamanites",
    "Ramath is afraid",
    "Gibeah of Saul mentioned as a place of flight.",
    "Destroyed at time of crucifixion",
    "Gallim is told to lift its voice",
    "O poor Anathoth",
    "As yet shall he remain at Nob that day",
  ])("%s", (text) => {
    expect(hookStrength([{ ref: "2 Nephi 20:9", text }])).toBeLessThan(2);
    const idx = [{ ref: "2 Nephi 20:9", text }, { ref: "Alma 1:1", text: "Moroni makes camp there" }];
    expect(hookLines(idx).map((x) => x.text)).toEqual(["Moroni makes camp there"]);
  });
  test("a named actor doing something is strong", () => {
    expect(hookStrength([{ ref: "Alma 24:5", text: "Ammon² meets his brethren in Midian" }])).toBe(2);
    expect(hookStrength([{ ref: "Alma 47:7", text: "Lamanites gather on Antipas" }])).toBe(2);
  });
  test("a hook that would be cut on the card is not strong", () => {
    expect(hookStrength([{ ref: "Alma 25:8", text: "Escape route for Amulon’s followers under Lamanite pursuit." }])).toBe(1);
  });
});

describe("rankPlaces: strong hooks take the five card slots (places-H1, r4)", () => {
  const P = (i, text) => ({ slug: `p${i}`, name: `P${i}`, index: text ? [{ ref: "Alma 1:1", text }] : [] });
  const strong = (i) => P(i, `Nephites march to land ${i}`);
  const weak = (i) => P(i, "Is burned");
  test("strong-hook places move ahead of weak ones, otherwise in seeded order; the profile slot stays put", () => {
    const list = [weak(0), strong(1), weak(2), P(3, null), strong(4), strong(5), weak(6), strong(7), strong(8), weak(9),
      weak(10), weak(11), weak(12), weak(13), weak(14), weak(15), weak(16)];
    const out = rankPlaces(list);
    expect(out).toHaveLength(17);
    expect(out.slice(0, 5).map((p) => p.slug)).toEqual(["p1", "p4", "p5", "p7", "p8"]);
    expect(out[16].slug).toBe("p16"); // the profiled place (last of 17) is not moved
    expect(new Set(out.map((p) => p.slug)).size).toBe(17);
  });
  test("slugless entries drop out and a short list still works", () => {
    expect(rankPlaces([{ name: "x" }, weak(0), strong(1), weak(2)]).map((p) => p.slug)).toEqual(["p1", "p0", "p2"]);
    expect(rankPlaces(undefined)).toEqual([]);
  });
});
