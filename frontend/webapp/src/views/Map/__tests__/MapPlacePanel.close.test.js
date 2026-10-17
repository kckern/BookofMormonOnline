import fs from "node:fs";
import path from "node:path";

// Home audit places-D3: the place panel × was a styled <span> that PUSHED
// /map/<slug>, so Back after closing needed two presses and re-opened the
// panel. It must be a real button that replaces the history entry.
const panel = fs.readFileSync(path.resolve(__dirname, "../MapPanel.js"), "utf8");
const css = fs.readFileSync(path.resolve(__dirname, "../Map.css"), "utf8");

test("place panel close is a <button> with an accessible name that replaces history", () => {
  const head = panel.slice(panel.indexOf('className="mapPanelHeadRow"'), panel.indexOf('className="info"'));
  expect(head).toMatch(/<button[\s\S]{0,60}type="button"[\s\S]{0,60}className="closePanelButton"/);
  expect(head).toMatch(/aria-label=/);
  expect(head).toMatch(/replace:\s*true/);
  expect(head).not.toMatch(/<span\s+className="closePanelButton"/);
});

test("the close button drops native button chrome and keeps a 44px target", () => {
  const rule = css.slice(css.indexOf(".closePanelButton{"), css.indexOf("}", css.indexOf(".closePanelButton{")));
  expect(rule).toMatch(/background:\s*none/);
  expect(rule).toMatch(/border:\s*0/);
  expect(rule).toMatch(/min-width:\s*44px/);
  expect(rule).toMatch(/min-height:\s*44px/);
});
