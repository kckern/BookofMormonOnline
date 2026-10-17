import { hookLines } from "../PlacesTile";

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
