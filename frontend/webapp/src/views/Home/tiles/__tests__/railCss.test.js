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

test("plan week cells read as a flat status strip, not a row of pill buttons (readingplan-C1)", () => {
  const m = css.match(/\.guestSegmentList \.segmentListItem \{([^}]*)\}/);
  expect(m[1]).toMatch(/border-radius:\s*3px/);
  expect(m[1]).toMatch(/font-weight:\s*500/);
  expect(m[1]).toMatch(/cursor:\s*default/);
  const rest = css.match(/\.guestSegmentList \.segmentListItem\.future\.notStarted \{([^}]*)\}/)[1];
  expect(rest).toMatch(/background-color:\s*#f2f2f2/);
});
