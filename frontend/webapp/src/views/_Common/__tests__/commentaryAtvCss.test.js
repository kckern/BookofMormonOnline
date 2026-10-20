import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.resolve(__dirname, "../Commentary.css"), "utf8");
const rule = (sel) => {
  const re = new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g");
  return [...css.matchAll(re)].map((m) => m[2]).join("\n");
};

// Blind r8 commentary-D4: the tile's deeplink landed on a grey monospace
// apparatus box that contradicted the tile's ATV treatment (Scripture serif,
// hairline gold rule, cream variant pill). Popup and drawer now share it.
test("the commentary apparatus reads as scripture, not a grey monospace box", () => {
  const atv = rule(".atv");
  expect(atv).not.toMatch(/monospace/);
  expect(atv).not.toMatch(/#DDD/i);
  expect(atv).toMatch(/font-family:\s*"Scripture"/);
  expect(atv).toMatch(/border-left:[^;]*201,\s*162,\s*75/);
  expect(rule(".atv-string")).toMatch(/#f5ecd6/i);
});
