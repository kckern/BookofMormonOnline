import fs from "node:fs";
import path from "node:path";

// Home audit XC4: the phone bottom sheet keeps its close control in thumb reach.
test("the phone scripture sheet is capped at <= 62vh", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../ScripturePopup.css"), "utf8");
  const phone = css.slice(css.indexOf("@media (max-width: 900px)"));
  const card = phone.slice(phone.indexOf(".samplerScriptureCard"), phone.indexOf("}", phone.indexOf(".samplerScriptureCard")));
  const vh = Number(card.match(/max-height:\s*([\d.]+)vh/)[1]);
  expect(vh).toBeLessThanOrEqual(62);
});
