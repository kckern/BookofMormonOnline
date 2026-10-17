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
  expect(base).toMatch(/padding-inline:\s*4px/);
  expect(base).toMatch(/margin-inline:\s*-4px/);
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

test("cards clip rather than hide overflow, so a chip's widened hit box can't make the card a scroll container (focus/scrollIntoView shifted the image up)", () => {
  const body = ruleBodies(css, ".samplerCard").find((b) => /border-radius/.test(b));
  expect(body).toMatch(/overflow:\s*clip/);
});

// blind audit r3 places-F2: the eyebrow links were 12px tap targets on touch.
test("touch: the Places and Places · Profile eyebrows get the 44px eyebrow hit (places-F2)", () => {
  const coarse = css.slice(css.indexOf("link was an 11px tap target on touch (blind audit XC4)"));
  const block = coarse.slice(0, coarse.indexOf("\n}\n"));
  expect(block).toMatch(/\.placesTilePlaces \.tileHeading a::after/);
  expect(block).toMatch(/\.placeProfilePlace \.tileHeading a::after/);
  expect(block).toMatch(/\.placesTilePlaces \.tileHeading a[,\s][^{]*\{\s*position:\s*relative/);
});

// blind audit r3 places-A1: "Carchemis / h" — the name chip may wrap between
// words only, never inside one.
test("the place name chip never breaks inside a word (places-A1)", () => {
  const bodies = ruleBodies(css, ".placesTilePlaces .placesNameOverlay");
  expect(bodies.some((b) => /overflow-wrap:\s*normal/.test(b))).toBe(true);
});

// blind audit r3 places-A2/H3: on the ~105px desktop card the name chip, pin
// and a 2-line info band covered most of the picture, and band + gloss both
// elided. Narrow cards drop the band (it stays in the card link's tooltip) and
// carry the name as a full-width caption along the image's foot.
test("narrow cards drop the info band and caption the name along the foot (places-A2/H3)", () => {
  expect(ruleBodies(css, ".placesTilePlaces .placesTileCard:not(.viewAllCard)").some((b) => /container-type:\s*inline-size/.test(b))).toBe(true);
  const q = css.split("@container").find((b) => /^\s*placeCard\s*\(max-width:\s*\d+px\)/.test(b));
  expect(q).toBeTruthy();
  expect(q).toMatch(/\.placesInfoOverlay\s*\{\s*display:\s*none/);
  expect(q).toMatch(/\.placesNameOverlay\s*\{[^}]*bottom:\s*0\.35rem/);
});
