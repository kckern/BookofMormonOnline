import { filterMenu } from "../menuFilter";

const base = { isDev: false, lang: "en", useMessenger: false, hiddenFlags: {} };
const slugs = (items) => items.map((i) => i.slug);

describe("filterMenu", () => {
  test("keeps a plain item", () => {
    const out = filterMenu([{ slug: "read" }], base);
    expect(slugs(out)).toEqual(["read"]);
  });

  test("hides an item whose hiddenFlag is set true", () => {
    const items = [{ slug: "read" }, { slug: "matters", hiddenFlag: "matters" }];
    const out = filterMenu(items, { ...base, hiddenFlags: { matters: true } });
    expect(slugs(out)).toEqual(["read"]);
  });

  test("keeps a hiddenFlag item when its flag is false", () => {
    const items = [{ slug: "matters", hiddenFlag: "matters" }];
    const out = filterMenu(items, { ...base, hiddenFlags: { matters: false } });
    expect(slugs(out)).toEqual(["matters"]);
  });

  test("hides only the flagged features, not siblings", () => {
    const items = [
      { slug: "home", hiddenFlag: "home" },
      { slug: "matters", hiddenFlag: "matters" },
      { slug: "history", hiddenFlag: "history" },
      { slug: "read" },
    ];
    const out = filterMenu(items, {
      ...base,
      hiddenFlags: { home: true, matters: true, history: true },
    });
    expect(slugs(out)).toEqual(["read"]);
  });

  test("respects requiresMessenger", () => {
    const items = [{ slug: "groups", requiresMessenger: true }];
    expect(slugs(filterMenu(items, { ...base, useMessenger: false }))).toEqual([]);
    expect(slugs(filterMenu(items, { ...base, useMessenger: true }))).toEqual(["groups"]);
  });

  test("respects dev-only items", () => {
    const items = [{ slug: "theology", dev: true }];
    expect(slugs(filterMenu(items, { ...base, isDev: false }))).toEqual([]);
    expect(slugs(filterMenu(items, { ...base, isDev: true }))).toEqual(["theology"]);
  });

  test("respects lang whitelist and langNot blacklist", () => {
    const items = [
      { slug: "fax", lang: ["en", "ko"] },
      { slug: "audit", langNot: ["en"] },
    ];
    expect(slugs(filterMenu(items, { ...base, lang: "en" }))).toEqual(["fax"]);
    expect(slugs(filterMenu(items, { ...base, lang: "fr" }))).toEqual(["audit"]);
  });
});
