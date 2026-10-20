import fs from "node:fs";
import path from "node:path";

// Systemic D4 (R2 notes/art, R3 community, R6 notes): deeplinks landed their
// target under the fixed 60px heading-bar or the 4rem phone bottom nav. The
// root scroller reserves both (scroll-padding), so EVERY scrollIntoView /
// #anchor / verse landing clears the chrome without per-page offsets — and no
// target adds the 60px again on top (it would land 120px low).
const read = (p) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const main = read("views/_Common/Main.css").replace(/\s+/g, " ");

test("html reserves the fixed heading-bar at the top at every width", () => {
  expect(main).toMatch(/html \{[^}]*scroll-padding-top: calc\(60px \+ [^)]*\)/);
});

test("at <=900px (bottom nav shown) html also reserves the 4rem bottom nav", () => {
  const block = main.split("@media only screen and (max-width: 900px)")[1] || "";
  expect(block).toMatch(/html \{[^}]*scroll-padding-bottom: calc\(4rem \+ [^)]*\)/);
});

test("no window-scrolled target re-adds the header height in scroll-margin", () => {
  const files = ["views/Home/Sampler.css", "views/Home/StudyGroupFeed.css", "views/Read/Read.css"].filter((f) =>
    fs.existsSync(path.resolve(__dirname, "../../..", f)),
  );
  const bad = files.filter((f) => /scroll-margin-top:\s*(calc\(\s*60px|7\dpx|6\dpx)/.test(read(f)));
  expect(bad).toEqual([]);
});
