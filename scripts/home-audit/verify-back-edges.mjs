// Back edge cases (systemic E1): the clicked link must come back where it was.
//   VP=phone node scripts/home-audit/verify-back-edges.mjs
// Scenarios, each from a tile deep in the feed:
//   keyboard  — page scrolled by Tab focus, link opened with Enter
//   abovefold — tile top ~250px above the viewport, link low in the tile
//   chain     — three link→Back cycles from the same tile
//   indest    — link → a link inside the destination → Back → Back
// DEEP=1 picks only infinite-batch tiles (data-tile-id b<batch>:…).
// Prints Δ (px) of the clicked link's top before vs after; |Δ| > TOL fails.
import { open } from "./tileharness.mjs";
const VP = process.env.VP || "desktop";
const TOL = +(process.env.TOL || 40);
const h = await open(VP, "backedges");
const p = h.page;
if (process.env.DEBUG) { await h.ctx.addInitScript(() => { window.__DBG = 1; }); p.on("console", (m) => m.text().startsWith("dbg") && console.log("   ", m.text())); }
await h.home();
for (let i = 0; i < +(process.env.PRESCROLL || (VP === "phone" ? 12 : 5)); i++) { await p.mouse.wheel(0, 1500); await p.waitForTimeout(700); }
await p.waitForTimeout(1500);

// pick candidate links: internal, visible, inside an identified tile, below the first screen
const pick = (skip = 0) => p.evaluate(({ skip, deep }) => {
  const as = [...document.querySelectorAll(".sampler .tile[data-tile-id] a[href^='/'], .sampler .tile [data-tile-id] a[href^='/']")]
    .filter((a) => a.offsetParent && a.getAttribute("tabindex") !== "-1" && !a.closest(".tile-community") && !a.getAttribute("href").startsWith("/home"))
    .filter((a) => a.getBoundingClientRect().top + scrollY > innerHeight * 1.5)
    .filter((a) => !deep || /^b\d+:/.test(a.closest("[data-tile-id]").dataset.tileId));
  const a = as[skip % as.length];
  if (!a) return null;
  const tile = a.closest("[data-tile-id]");
  const id = tile.dataset.tileId;
  const href = a.getAttribute("href");
  const n = [...tile.querySelectorAll(`a[href="${CSS.escape(href)}"]`)].indexOf(a);
  return { id, href, n };
}, { skip, deep: !!process.env.DEEP });
const linkTop = (t) => p.evaluate(({ id, href, n }) => {
  const tile = [...document.querySelectorAll("[data-tile-id]")].find((x) => x.dataset.tileId === id);
  const a = tile && [...tile.querySelectorAll("a[href]")].filter((x) => x.getAttribute("href") === href)[n];
  if (window.__DBG) console.log("dbg", id, "tileTop", tile && Math.round(tile.getBoundingClientRect().top), "tileH", tile && Math.round(tile.getBoundingClientRect().height), "y", Math.round(scrollY), sessionStorage.getItem("bom:homeAnchor:v1"));
  return a ? Math.round(a.getBoundingClientRect().top) : null;
}, t);
const place = (t, where) => p.evaluate(({ id, href, n, where }) => {
  const tile = [...document.querySelectorAll("[data-tile-id]")].find((x) => x.dataset.tileId === id);
  const a = [...tile.querySelectorAll("a[href]")].filter((x) => x.getAttribute("href") === href)[n];
  const tt = tile.getBoundingClientRect().top + scrollY;
  const at = a.getBoundingClientRect().top + scrollY;
  if (where === "abovefold") window.scrollTo({ top: Math.max(0, tt + 250, at - innerHeight * 0.6), behavior: "instant" });
  else window.scrollTo({ top: Math.max(0, at - innerHeight * 0.45), behavior: "instant" });
}, { ...t, where });
const settle = async () => { await p.mouse.move(5, 5); await p.waitForTimeout(600); };
const back = async () => { await p.goBack(); await p.waitForTimeout(+(process.env.WAIT || 4500)); };
const results = [];
const report = (name, t, before, after) => {
  const d = after == null || before == null ? null : after - before;
  const ok = d != null && Math.abs(d) <= TOL;
  results.push({ name, ok });
  console.log(`${ok ? "ok  " : "FAIL"} ${VP} ${name.padEnd(10)} ${t.id} ${t.href} before ${before} after ${after} Δ ${d}`);
};

// keyboard
{
  const t = await pick(0);
  await place(t, "mid"); await settle();
  // focus the link via Tab from its preceding focusable (real focus scroll)
  await p.evaluate(({ id, href, n }) => {
    const tile = [...document.querySelectorAll("[data-tile-id]")].find((x) => x.dataset.tileId === id);
    const a = [...tile.querySelectorAll("a[href]")].filter((x) => x.getAttribute("href") === href)[n];
    a.focus();
  }, t);
  await p.waitForTimeout(400);
  const before = await linkTop(t);
  await p.keyboard.press("Enter"); await p.waitForTimeout(2500);
  await back();
  report("keyboard", t, before, await linkTop(t));
}
// tile top above the fold
{
  const t = await pick(3);
  await place(t, "abovefold"); await settle();
  const before = await linkTop(t);
  await p.evaluate(({ id, href, n }) => { const tile = [...document.querySelectorAll("[data-tile-id]")].find((x) => x.dataset.tileId === id); [...tile.querySelectorAll("a[href]")].filter((x) => x.getAttribute("href") === href)[n].click(); }, t);
  await p.waitForTimeout(2500); await back();
  report("abovefold", t, before, await linkTop(t));
}
// chained
{
  const t = await pick(6);
  await place(t, "mid"); await settle();
  for (let k = 0; k < 3; k++) {
    const before = await linkTop(t);
    await p.evaluate(({ id, href, n }) => { const tile = [...document.querySelectorAll("[data-tile-id]")].find((x) => x.dataset.tileId === id); [...tile.querySelectorAll("a[href]")].filter((x) => x.getAttribute("href") === href)[n].click(); }, t);
    await p.waitForTimeout(2500); await back();
    report(`chain${k + 1}`, t, before, await linkTop(t));
    await settle();
  }
}
// in-destination navigation
{
  const t = await pick(9);
  await place(t, "mid"); await settle();
  const before = await linkTop(t);
  await p.evaluate(({ id, href, n }) => { const tile = [...document.querySelectorAll("[data-tile-id]")].find((x) => x.dataset.tileId === id); [...tile.querySelectorAll("a[href]")].filter((x) => x.getAttribute("href") === href)[n].click(); }, t);
  await p.waitForTimeout(3500);
  const from = new URL(p.url()).pathname;
  const moved = await p.evaluate((from) => {
    const a = [...document.querySelectorAll("main a[href^='/'], #root a[href^='/']")].find((x) => x.offsetParent && !x.closest(".heading-bar, .bottom-nav, .sidebar") && x.getAttribute("href") !== from && !x.getAttribute("href").startsWith("/home"));
    if (!a) return null; a.click(); return a.getAttribute("href");
  }, from);
  await p.waitForTimeout(3000);
  if (moved) await back();
  await back();
  report("indest", t, before, await linkTop(t));
}
console.log(VP, `${results.filter((r) => r.ok).length}/${results.length} ok`, h.errors.filter((e) => /pageerror/.test(e)).slice(0, 3));
await h.close();
