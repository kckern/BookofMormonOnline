import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

test("touch: the Contents and Reading progress eyebrow links get the 44px heading hit (contents-F2)", () => {
  const coarse = css.split("@media").filter((b) => /^\s*\(pointer:\s*coarse\)/.test(b));
  for (const tile of [".contentsTile", ".readingProgressTile"]) {
    const block = coarse.find((b) => b.includes(`${tile} .tileHeading a::after`));
    expect(block).toBeTruthy();
    // the heading holds the extension's height so it never covers the banner/user row under it
    expect(block).toMatch(new RegExp(`${tile.replace(".", "\\.")} > \\.tileHeading[^{]*\\{[^}]*min-height:\\s*calc\\(44px - 12px\\)`));
  }
});
