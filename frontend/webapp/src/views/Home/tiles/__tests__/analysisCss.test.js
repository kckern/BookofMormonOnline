import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.resolve(__dirname, "../../Sampler.css"), "utf8");

// XC1: the page / batch skeleton is an empty <div class="tile skeleton tile-art">;
// the null-render collapse must not hide it, or the tile pops in from 0px.
test("the :empty collapse of the analysis/profile spans never matches a skeleton", () => {
  const hits = css.match(/[^{}]*:empty[^{}]*\{\s*display:\s*none/g) || [];
  const selectors = hits.flatMap((h) => h.replace(/\/\*[\s\S]*?\*\//g, "").split("{")[0].split(","));
  for (const span of ["biblephrases", "chiasmus", "art", "personProfile", "placeProfile", "matterProfile"]) {
    const sel = selectors.map((s) => s.trim()).filter((s) => s.includes(`.tile-${span}:empty`));
    expect(sel.length).toBeGreaterThan(0);
    for (const s of sel) expect(s).toContain(":not(.skeleton)");
  }
});

// chiasmus-D4: the glyph's pivot bars are house gold on the tile AND on the
// /analysis/chiasmus pages it links to (one rule, in the shared glyph CSS).
test("the chiasm glyph pivot is house gold in the shared glyph stylesheet", () => {
  const glyph = fs.readFileSync(path.resolve(__dirname, "../../../_Common/ChiasmGlyph.css"), "utf8");
  expect(glyph).toMatch(/\.glyphBar\.pivot\s*\{\s*fill:\s*#c9a24b/);
});
