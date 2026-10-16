import fs from "node:fs";
import path from "node:path";

// Home audit (story) D3/D4/D5: on phone the story panel rendered UNDERNEATH the
// map canvas, so a Home "Explore" deeplink landed on a bare map with no title,
// no movements and no back control. The panel must be a sheet over the map on
// narrow screens, with a real (button) back control.
const panel = fs.readFileSync(path.resolve(__dirname, "../MapPanel.js"), "utf8");
const css = fs.readFileSync(path.resolve(__dirname, "../Map.css"), "utf8");

test("story panel is marked for the phone sheet and has a button back control", () => {
  const story = panel.slice(panel.indexOf("function MapStoryPanel"));
  expect(story).toMatch(/className="mapPanel mapStoryPanel"/);
  expect(story).toMatch(/<button[\s\S]{0,80}className="mapStoryBack"[\s\S]{0,80}onClick=\{closeStory\}/);
});

test("phone CSS lifts the story panel above the map canvas", () => {
  const phone = css.slice(css.lastIndexOf("@media screen and (max-width: 900px)"));
  const rule = phone.slice(phone.indexOf(".mapPanel.mapStoryPanel"), phone.indexOf("}", phone.indexOf(".mapPanel.mapStoryPanel")));
  expect(rule).toMatch(/position:\s*absolute/);
  expect(rule).toMatch(/bottom:\s*0/);
  expect(rule).toMatch(/z-index:\s*\d+/);
  expect(rule).toMatch(/opacity:\s*1/);
});
