import { createPickMemo } from "../pickMemo";

test("remembers values by key and evicts the oldest past the cap", () => {
  const m = createPickMemo(2);
  m.set("a", 1);
  m.set("b", 2);
  expect(m.get("a")).toBe(1);
  m.set("c", 3);
  expect(m.get("a")).toBeUndefined();
  expect(m.get("c")).toBe(3);
  m.clear();
  expect(m.get("b")).toBeUndefined();
});
