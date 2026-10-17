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
