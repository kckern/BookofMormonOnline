import fs from "node:fs";
import path from "node:path";

// Home audit places-C1/D5, placeProfile-D3: at ≤900px (Utils.isMobile) the map
// route opens the place drawer and canonicalises to /places/<slug> — the same
// destination as the card itself — so the pin is a dishonest second target
// there. It is hidden at that breakpoint; the place page keeps "View on map".
const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");

test("map pins on Places cards and the place profile hide at the map's mobile breakpoint", () => {
  const blocks = css.split("@media").filter((b) => /^\s*(screen and )?\(max-width:\s*900px\)/.test(b));
  const hit = blocks.find((b) => /\.placesMapBtn[^{]*\{[^}]*display:\s*none/.test(b));
  expect(hit).toBeTruthy();
});

const ruleBodies = (src, selector) => {
  const out = [];
  let i = src.indexOf(selector);
  while (i !== -1) {
    const open = src.indexOf("{", i);
    if (!src.slice(i, open).includes(";")) out.push(src.slice(open + 1, src.indexOf("}", open)));
    i = src.indexOf(selector, i + selector.length);
  }
  return out;
};

test("touch: the index row pads top AND bottom so a one-line gloss keeps a 44px chip hit (places-F2)", () => {
  const coarse = css.slice(css.indexOf("Touch: >=44px hit for the tiny ref chips"));
  const body = ruleBodies(coarse, ".placesTilePlaces .placesTileIndexRow.fitWords")[0];
  expect(body).toMatch(/padding-bottom:\s*16px/);
  expect(body).toMatch(/margin-bottom:\s*-16px/);
});

test("every pointer: the index row leaves room for the chip's 2px focus ring (places-C5)", () => {
  const bodies = ruleBodies(css, ".placesTilePlaces .placesTileIndexRow.fitWords");
  const base = bodies.find((b) => /padding-top:\s*4px/.test(b));
  expect(base).toMatch(/margin-top:\s*-4px/);
  expect(base).toMatch(/padding-bottom:\s*4px/);
});

test("place profile: Read more (left) and Open <place> (right) share one CTA row, as the person profile does (placeProfile-A5)", () => {
  const text = ruleBodies(css, ".placeProfilePlace .placeProfileText").find((b) => /grid-template-areas/.test(b));
  expect(text).toMatch(/display:\s*grid/);
  expect(text).toMatch(/"more open"/);
  expect(ruleBodies(css, ".placeProfilePlace .placeProfileDesc").some((b) => /display:\s*contents/.test(b))).toBe(true);
  expect(ruleBodies(css, ".placeProfilePlace .placeProfileDesc > .readMorePill").join()).toMatch(/grid-area:\s*more/);
  const open = ruleBodies(css, ".placeProfilePlace .placeProfileText > .tileMoreLink").join();
  expect(open).toMatch(/grid-area:\s*open/);
  expect(open).toMatch(/justify-self:\s*end/);
});
