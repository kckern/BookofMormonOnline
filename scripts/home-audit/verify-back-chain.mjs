// Chained link->Back cycles from one tile: each Back must land the tile where it was.
//   TILE=tile-chiasmus VP=desktop PRESCROLL=0 node scripts/home-audit/verify-back-chain.mjs
import { open } from "./tileharness.mjs";
const TILE = process.env.TILE || "tile-chiasmus";
const VP = process.env.VP || "desktop";
const PRESCROLL = +(process.env.PRESCROLL || 0);
const h = await open(VP, "backchain");
const p = h.page;
await h.home();
for (let i = 0; i < PRESCROLL; i++) { await p.mouse.wheel(0, 2000); await p.waitForTimeout(700); }
if (!(await h.scrollUntil(TILE))) { console.log("no tile", TILE); process.exit(1); }
// identify the tile by its own links; pick the first in DOM after any prescroll
const info = await p.evaluate((cls) => {
  const ts = [...document.querySelectorAll(`.tile.${cls}`)].filter((t) => t.querySelector("a[href^='/']"));
  const t = ts[+(window.__NTH || 0)] || ts[0];
  t.scrollIntoView({ block: "start", behavior: "instant" });
  window.scrollBy(0, -180);
  const links = [...t.querySelectorAll("a[href^='/']")].map((a) => a.getAttribute("href"));
  return { links: [...new Set(links)] };
}, TILE);
await p.waitForTimeout(800);
await p.mouse.wheel(0, 1); await p.waitForTimeout(400);
const topOf = (href) => p.evaluate(({ cls, href }) => {
  const a = [...document.querySelectorAll(`.tile.${cls} a[href="${href}"]`)][0];
  const t = a && a.closest(".tile");
  return t ? Math.round(t.getBoundingClientRect().top) : null;
}, { cls: TILE, href });
const key = [...info.links].sort((a, b) => b.length - a.length)[0];
const start = await topOf(key);
console.log(TILE, VP, "links", info.links.length, "start top", start, "tiles", await p.evaluate(() => document.querySelectorAll(".tile").length));
for (let k = 0; k < Math.min(3, info.links.length); k++) {
  const href = info.links[k];
  const before = await topOf(key);
  const loc = p.locator(`.tile.${TILE} a[href="${href}"]`).first();
  if (!(await loc.isVisible())) { console.log(" skip invisible", href); continue; }
  if (process.env.CLICK === "js") await loc.evaluate((a) => a.click()); else await loc.click();
  await p.waitForTimeout(2200);
  const dest = p.url();
  await p.goBack();
  await p.waitForTimeout(+(process.env.WAIT || 4200));
  const after = await topOf(key);
  console.log(` #${k} ${href} -> ${dest.replace(/^https?:\/\/[^/]+/, "")} before ${before} after ${after} drift ${after == null ? "LOST" : after - before} tiles ${await p.evaluate(() => document.querySelectorAll(".tile").length)}`);
  await h.shot(`${TILE}-chain${k}`);
}
await h.close();
