import fs from "node:fs";
import path from "node:path";

// Static checks on the sampler stylesheets: house style (no blue), reduced
// motion, and no silent clipping. CSS is a no-op under vitest, so read the text.
const read = (f) => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const css = read("Sampler.css");
const mcss = read("Sampler.m.css");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const norm = (s) => strip(s).replace(/\s+/g, " ").toLowerCase();

// Every top-level-or-nested rule as [selector, body] (one brace level deep).
const rules = (s) => {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(strip(s)))) out.push([m[1].trim(), m[2]]);
  return out;
};

describe("Sampler CSS", () => {
  test.each([["Sampler.css", css], ["Sampler.m.css", mcss]])("%s has no blue", (_, text) => {
    const t = norm(text).replace(/\s/g, "");
    expect(t).not.toContain("#345496");
    expect(t).not.toContain("rgba(147,198,239");
    expect(t).not.toContain("#a8c7fa");
  });

  test("prefers-reduced-motion disables the hover transform", () => {
    const n = norm(css);
    const blocks = n.split("@media (prefers-reduced-motion: reduce)").slice(1);
    const hit = blocks.some((b) => /:hover[^{}]*\{[^}]*transform: none/.test(b));
    expect(hit).toBe(true);
  });

  test("hover lift is not on every .tile, only link tiles/cards", () => {
    const bare = rules(css).filter(
      ([sel, body]) => /transform:\s*translateY/.test(body) && sel.split(",").some((s) => s.trim() === ".tile:hover"),
    );
    expect(bare).toEqual([]);
  });

  test("no bare max-height: 24rem outside a .boundedTile rule", () => {
    for (const text of [css, mcss]) {
      const bad = rules(text).filter(([sel, body]) => /max-height:\s*24rem/.test(body) && !sel.includes(".boundedTile"));
      expect(bad).toEqual([]);
    }
  });

  test("meta/eyebrow tokens exist with >=4.5:1 light values and dark overrides", () => {
    const n = norm(css);
    expect(n).toMatch(/--tile-meta: #6b6b6b/);
    expect(n).toMatch(/--tile-eyebrow: #6b6b6b/);
    expect(n).toMatch(/html\[data-theme="dark"\][^{]*\{[^}]*--tile-meta:/);
    expect(n).toMatch(/\.tileheading \{[^}]*color: var\(--tile-eyebrow\)/);
  });

  test("dark mode dims tile images", () => {
    expect(norm(css)).toMatch(/html\[data-theme="dark"\] \.tile img\.tileimage \{[^}]*filter: brightness\(\.85\)/);
  });

  test("phone/tablet overflow guard: main + rail shrink to the viewport at <=900px", () => {
    const n = norm(mcss);
    const block = n.split("@media only screen and (max-width: 900px)")[1] || "";
    expect(block).toMatch(/\.samplermain, \.samplerleftrail \{[^}]*min-width: 0[^}]*width: 100%/);
  });
});
