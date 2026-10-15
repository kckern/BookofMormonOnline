import { singleColumnOrder } from "../samplerLayout";

describe("singleColumnOrder (phone / narrow layout)", () => {
  const variable = ["text", "art", "community", "commentary", "places", "notes"];

  test("leads with reading plan, People, then narration", () => {
    expect(singleColumnOrder(variable).slice(0, 3)).toEqual(["readingplan", "people", "section"]);
  });

  test("places contents a few tiles in, after the first three variable tiles", () => {
    const order = singleColumnOrder(variable);
    expect(order.slice(3, 7)).toEqual(["text", "art", "community", "contents"]);
  });

  test("keeps every variable tile in its shuffled order and ends with the map story", () => {
    const order = singleColumnOrder(variable);
    expect(order.filter((k) => variable.includes(k))).toEqual(variable);
    expect(order.at(-1)).toBe("mapstory");
  });

  test("with fewer than three variable tiles, contents still lands before the map story", () => {
    expect(singleColumnOrder(["text"])).toEqual(["readingplan", "people", "section", "text", "contents", "mapstory"]);
  });
});
