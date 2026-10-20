import fs from "node:fs";
import path from "node:path";
import { landTarget } from "../landTarget";

// Systemic D4: a deeplink target scrolled into view while the page is still
// growing (Read: the chapter shorter than the target's scroll position, so the
// scroll clamps at the document end) ended below the fold once content landed
// (R6 notes-D4: Helaman 5:50 at y=948 of a 900px desktop viewport).

let roCb;
beforeEach(() => {
  roCb = null;
  global.ResizeObserver = class { constructor(cb) { roCb = cb; } observe() {} disconnect() { roCb = null; } };
});

const fakeEl = (top) => {
  const el = document.createElement("div");
  el.getBoundingClientRect = () => ({ top: el._top, bottom: el._top + 40, height: 40 });
  el._top = top;
  el.scrollIntoView = vi.fn(() => { el._top = 80; });
  document.body.appendChild(el);
  return el;
};

test("lands once, then re-lands when the page grows and the target drifts off", () => {
  const el = fakeEl(2000);
  const stop = landTarget(() => el, { block: "start" });
  expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
  el._top = 948; // content above / below grew; the clamped scroll left it low
  roCb?.();
  expect(el.scrollIntoView).toHaveBeenCalledTimes(2);
  stop();
});

test("a target already in view is left alone", () => {
  const el = fakeEl(2000);
  const stop = landTarget(() => el, { block: "start" });
  el._top = 300;
  roCb?.();
  expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
  stop();
});

test("the reader's own scroll input ends the landing", () => {
  const el = fakeEl(2000);
  landTarget(() => el, { block: "start" });
  window.dispatchEvent(new Event("wheel"));
  el._top = 1500;
  roCb?.();
  expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
});

test("Read's highlighted-verse landing goes through landTarget", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../../Read/Read.js"), "utf8");
  expect(src).toMatch(/landTarget\(/);
});
