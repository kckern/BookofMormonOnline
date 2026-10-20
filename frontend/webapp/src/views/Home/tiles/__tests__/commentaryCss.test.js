import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");
const rule = (sel) => {
  const re = new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g");
  return [...css.matchAll(re)].map((m) => m[2]).join("\n");
};

// Blind audit r4 commentary H3: -webkit-line-clamp ellipsized mid-word and the
// fade then half-erased the "…". The clamp is whole-line (JS) + last-line fade.
test("the commentary excerpt clamps without -webkit-line-clamp and fades the last line", () => {
  expect(rule(".commentaryTileExcerpt")).not.toMatch(/line-clamp/);
  expect(rule(".commentaryTileExcerpt.isClamped")).toMatch(/--line-end/);
});

// A1: on a wide single-column card (tablet) the cover column dictated the card
// height and left ~200px blank under short prose. Wide cards move cover +
// attribution into a footer row beside "See in context".
test("wide commentary cards put the aside in a footer row", () => {
  expect(css).toMatch(/\.tile-commentary\s*\{[^}]*container-type:\s*inline-size/);
  const wide = css.slice(css.indexOf("@container commentaryCard (min-width"));
  expect(wide).toMatch(/grid-template-areas:[^;]*"aside foot"/);
});

// A3: the ATV apparatus reads as scripture, not a monospace debug box.
test("the tile's ATV apparatus uses the Scripture serif, never monospace", () => {
  expect(rule(".commentaryTile .atv")).toMatch(/font-family:\s*"Scripture"/);
});

test("a ref pill and its bracket never part at a line break", () => {
  expect(rule(".sampler .refNoBreak")).toMatch(/white-space:\s*nowrap/);
});

// Blind r8 commentary-A1: the excerpt was a flex-start child of the main column,
// so a wide unbreakable chip grew it to 465px inside a 233px column and the
// prose ran under the cover. It is bound to the column; a citation list wraps.
test("the commentary excerpt can never outgrow its column", () => {
  const ex = rule(".commentaryTileExcerpt");
  expect(ex).toMatch(/align-self:\s*stretch/);
  expect(ex).toMatch(/max-width:\s*100%/);
  expect(ex).toMatch(/overflow-wrap:\s*anywhere/);
  expect(rule(".sampler .refList")).toMatch(/white-space:\s*normal/);
  expect(rule(".commentaryTileExcerpt .scripture_link")).toMatch(/max-width:\s*100%/);
});

// Blind r8 commentary-A3: a long publication name wrapped into a 6-7 line
// italic stack in the narrow aside, taller than the cover. Three lines max.
test("the commentary attribution is clamped to three lines", () => {
  const src = rule(".commentaryTileSource");
  expect(src).toMatch(/-webkit-line-clamp:\s*3/);
  expect(src).toMatch(/overflow:\s*clip/);
});
