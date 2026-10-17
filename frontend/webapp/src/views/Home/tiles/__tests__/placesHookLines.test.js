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
