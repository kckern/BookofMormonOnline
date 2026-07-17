import { menuConfig } from "../menuConfig";

describe("menuConfig after Home unification", () => {
  test("keeps the home item", () => {
    expect(menuConfig.some((i) => i.slug === "home")).toBe(true);
  });
  test("no separate community item", () => {
    expect(menuConfig.some((i) => i.slug === "community")).toBe(false);
  });
});
