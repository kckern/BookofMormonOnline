import fs from "node:fs";
import path from "node:path";

// Blind r8 popup-C5: Tab from Close landed on the section-header link inside
// the popup body, which showed the UA focus ring (black on desktop Chrome,
// orange on iOS) instead of the gold focus style of every other popup control.
test("links inside the scripture popup body take the gold focus ring", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../ScripturePopup.css"), "utf8");
  const m = /\.samplerScriptureBody a:focus-visible[^{]*\{([^}]*)\}/.exec(css);
  expect(m).not.toBeNull();
  expect(m[1]).toMatch(/outline:\s*2px solid #c9a24b/);
});
