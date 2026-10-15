import fs from "node:fs";
import path from "node:path";

// Home audit D5: the story walker portrait was an OL Icon at `scale: 0.6` of a
// ~1024px people image, so it painted a ~600px portrait over the story map.
// It must be sized in pixels.
test("story walker portrait is pixel-sized, never scaled from the original", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../MapContents.js"), "utf8");
  const icon = src.slice(src.indexOf("people/${heroSlug}") - 200, src.indexOf("people/${heroSlug}") + 200);
  expect(icon).toMatch(/new Icon\(/);
  expect(icon).not.toMatch(/scale:/);
  expect(icon).toMatch(/width:\s*\d+/);
});
