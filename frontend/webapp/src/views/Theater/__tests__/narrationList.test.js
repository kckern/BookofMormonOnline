import { deriveNarrationList } from "../narrationList";

const item = (description) =>
  description === null ? { narration: null } : { narration: { description } };

test("items without narration do not produce null entries (crash repro)", () => {
  const queue = [item("Lehi preaches"), item(null), item("Lehi flees")];
  const { uniqueNarrations } = deriveNarrationList(queue);
  // Old logic kept a null placeholder, which the component then passed to
  // string.replace() — the reported TypeError.
  expect(uniqueNarrations.every((n) => typeof n === "string")).toBe(true);
  expect(uniqueNarrations).toEqual(["Lehi preaches", "Lehi flees"]);
});

test("duplicate narrations collapse and map back to the first queue index", () => {
  const queue = [item("A"), item("A"), item("B")];
  const { uniqueNarrations, narrationMap, allNarrations } = deriveNarrationList(queue);
  expect(uniqueNarrations).toEqual(["A", "B"]);
  expect(narrationMap).toEqual({ 0: 0, 1: 0, 2: 1 });
  expect(allNarrations.indexOf("B")).toBe(2);
});

test("cursor on a narration-less item highlights nothing", () => {
  const queue = [item("A"), item(null), item("B")];
  const { narrationMap } = deriveNarrationList(queue);
  expect(narrationMap[1]).toBe(-1);
});

test("empty or missing queue yields empty list", () => {
  expect(deriveNarrationList([]).uniqueNarrations).toEqual([]);
  expect(deriveNarrationList(undefined).uniqueNarrations).toEqual([]);
});
