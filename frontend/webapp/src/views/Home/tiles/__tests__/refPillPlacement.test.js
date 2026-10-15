import fs from "node:fs";
import path from "node:path";

// Static guard (G1): a RefPill is an interactive <button>; it must never sit
// lexically inside a <Link> or <a> (nested interactive content — screen readers
// announce a button inside a link, Tab stops twice, and a missed tap navigates).
// Place pills as siblings of card links instead.

const TILES_DIR = path.resolve(__dirname, "..");

// Current violators, fixed per family in Phase 4. Remove the entry when fixed.
const ALLOW = new Set([
  "NarrationTile.js", // Task 10a
  "PeopleTile.js", // Task 10b
]);

function listTileFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (d.name === "__tests__") return [];
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return listTileFiles(p);
    return /\.(js|jsx)$/.test(d.name) && !/\.test\.js$/.test(d.name) ? [p] : [];
  });
}

// From the `<` of an opening tag, find its closing `>` (skipping `>` inside
// `{...}` attribute expressions, e.g. arrow functions) and report self-closing.
function scanOpenTag(src, start) {
  let depth = 0;
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return { end: i, selfClosing: src[i - 1] === "/" };
  }
  return { end: src.length, selfClosing: true };
}

// Returns the line numbers of every <RefPill that is inside an open <Link>/<a>.
export function findNestedRefPills(src) {
  const re = /<\/(Link|a)>|<(Link|a|RefPill)(?=[\s>/])/g;
  const hits = [];
  let depth = 0;
  let m;
  while ((m = re.exec(src))) {
    if (m[1]) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (m[2] === "RefPill") {
      if (depth > 0) hits.push(src.slice(0, m.index).split("\n").length);
      continue;
    }
    const { end, selfClosing } = scanOpenTag(src, m.index);
    if (!selfClosing) depth++;
    re.lastIndex = end + 1;
  }
  return hits;
}

describe("findNestedRefPills (tracker sanity)", () => {
  test("flags a pill inside a Link, not a sibling or self-closing link", () => {
    expect(findNestedRefPills(`<Link to="/x" onClick={() => a > b}><RefPill refText="A" /></Link>`)).toEqual([1]);
    expect(findNestedRefPills(`<div><Link to="/x">x</Link><RefPill refText="A" /></div>`)).toEqual([]);
    expect(findNestedRefPills(`<a href="/x" /><RefPill refText="A" />`)).toEqual([]);
    expect(findNestedRefPills(`<a\n href="/x">\n<RefPill refText="A" /></a>`)).toEqual([3]);
  });
});

const files = listTileFiles(TILES_DIR).map((p) => path.relative(TILES_DIR, p));

describe("RefPill placement: never inside <Link>/<a>", () => {
  test.each(files.filter((f) => !ALLOW.has(f)))("%s", (file) => {
    const src = fs.readFileSync(path.join(TILES_DIR, file), "utf8");
    expect(findNestedRefPills(src)).toEqual([]);
  });

  test.each([...ALLOW])("%s is still a violator (drop it from ALLOW once fixed)", (file) => {
    const src = fs.readFileSync(path.join(TILES_DIR, file), "utf8");
    expect(findNestedRefPills(src).length).toBeGreaterThan(0);
  });
});
