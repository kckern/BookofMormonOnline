import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.resolve(__dirname, "../Chiasmus.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const mediaBlock = (q) => {
  const i = css.indexOf(`@media (max-width: ${q}) {\n`);
  return i < 0 ? "" : css.slice(i, css.indexOf("\n}\n", i));
};

// Home audit chiasmus-D5-phone: the full-screen detail overlay was
// width:100% + 1rem padding in content-box, i.e. wider than the phone, so the
// lines and the Previous / Read in context / Copy link / Next bar were clipped.
test("the phone detail overlay fits the viewport (border-box, no fixed width past the insets)", () => {
  const b = mediaBlock("800px");
  const open = b.slice(b.indexOf(".chiasmPanel.open"), b.indexOf("}", b.indexOf(".chiasmPanel.open")));
  expect(open).toMatch(/box-sizing:\s*border-box/);
  expect(open).not.toMatch(/width:\s*100%/);
  // above the fixed site header (z 5300), below the scripture popup (9000)
  const z = Number(open.match(/z-index:\s*(\d+)/)[1]);
  expect(z).toBeGreaterThan(5300);
  expect(z).toBeLessThan(9000);
});

test("the action bar wraps on a narrow phone instead of running off the edge", () => {
  const b = mediaBlock("480px");
  expect(b).toMatch(/\.chiasmus_nav\s*\{[^}]*flex-wrap:\s*wrap/);
});

test("the browse toolbar wraps on a narrow phone (its spill widened the layout viewport)", () => {
  expect(mediaBlock("480px")).toMatch(/\.browse_toolbar\s*\{[^}]*flex-wrap:\s*wrap/);
});
