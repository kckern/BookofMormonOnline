import fs from "node:fs";
import path from "node:path";

// R8 matters concept-D5: button.ppref inherited white-space:nowrap from the UA
// button style, so one long reference forced the matter page to a 745px layout
// viewport at 390px (header clipped, page panned sideways).
const css = fs.readFileSync(path.resolve(__dirname, "../entityLists.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ");

test("reference buttons wrap inside their column", () => {
  const rule = css.match(/button\.ppref \{([^}]*)\}/)[1];
  expect(rule).toMatch(/white-space: normal/);
  expect(rule).toMatch(/overflow-wrap: anywhere/);
  expect(rule).toMatch(/max-width: 100%/);
});
