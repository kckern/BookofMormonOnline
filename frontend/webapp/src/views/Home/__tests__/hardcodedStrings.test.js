import fs from "node:fs";
import path from "node:path";

// Every user-visible string in a Home tile goes through label()/labelOr()/tr() so
// non-English hosts translate it. This flags JSX text and aria-label/alt/title/
// placeholder string literals that contain English words and aren't routed
// through them. Data (names from the API) is never a literal, so it never trips.
const TILES = path.resolve(__dirname, "../tiles");
const files = fs.readdirSync(TILES).filter((f) => /\.jsx?$/.test(f));
// "<file>:<literal>" entries, each with the reason it is not UI copy.
const ALLOW = new Set([]);

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const found = (src) => {
  const out = [];
  for (const m of src.matchAll(/\b(?:aria-label|alt|title|placeholder)="([A-Za-z][^"{}]*[A-Za-z])"/g)) out.push(m[1]);
  for (const m of src.matchAll(/>\s*([A-Z][A-Za-z’'.,!?-]+(?:\s+[A-Za-z’'.,!?-]+)+)\s*</g)) out.push(m[1]);
  return out;
};

describe("Home tiles have no hardcoded English", () => {
  test.each(files)("%s", (f) => {
    const src = strip(fs.readFileSync(path.join(TILES, f), "utf8"));
    const bad = found(src).filter((s) => !ALLOW.has(`${f}:${s}`));
    expect(bad).toEqual([]);
  });
});

describe("the scanner itself", () => {
  test("flags English in attributes and JSX text, ignores routed and non-English-word content", () => {
    expect(found('<button aria-label="Play journey">x</button>')).toEqual(["Play journey"]);
    expect(found("<p>Read more here</p>")).toEqual(["Read more here"]);
    expect(found('<img alt={label("art")} aria-label={labelOr("k", "Fallback text")} />')).toEqual([]);
    expect(found("<span>{name}</span><b>2</b>")).toEqual([]);
  });
});
