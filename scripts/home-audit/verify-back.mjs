// Focused verification of the P1 fixes against BASE (default Vite dev :8201; set BASE for another instance).
// Playwright lives in frontend/next; override with PLAYWRIGHT_MODULE (e.g. from a worktree).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || new URL("../../frontend/next/node_modules/playwright/index.mjs", import.meta.url).href);
const BASE = process.env.BASE || "http://localhost:8201";
const VP = process.env.VP || "desktop";
const UA = VP === "phone"
  ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
  : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const b = await chromium.launch();
const ctx = await b.newContext({ serviceWorkers: "block", userAgent: UA, viewport: VP === "phone" ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: VP === "phone", hasTouch: VP === "phone" });
const p = await ctx.newPage();
const errs = [];
p.on("console", async (m) => { if (m.type() === "error" && /same key/.test(m.text())) { const args = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => "?"))); errs.push(JSON.stringify(args).slice(0, 400)); } });
const tiles = () => p.evaluate(() => [...document.querySelectorAll(".tile:not(.skeleton)")].slice(0, 30).map((t) => [...t.classList].filter((c) => c !== "tile").join(".")));
const state = () => p.evaluate(() => ({ y: Math.round(scrollY), docH: document.documentElement.scrollHeight, inf: document.querySelectorAll(".infiniteTile").length }));

await p.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
await p.waitForSelector(".tile:not(.skeleton)", { state: "attached" }); await p.waitForTimeout(4000);
// phone: where does People sit?
console.log("people top:", await p.evaluate(() => Math.round(document.querySelector(".tile.tile-people")?.getBoundingClientRect().top + scrollY)));
for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, 900); await p.waitForTimeout(500); }
await p.waitForTimeout(1500);
const before = { ...(await state()), tiles: await tiles() };
const href = await p.evaluate((process_SEL) => {
  const as = [...document.querySelectorAll(process_SEL)].filter((a) => { const r = a.getBoundingClientRect(); return r.top > 60 && r.bottom < innerHeight - 60 && r.width > 20; });
  return as[0]?.getAttribute("href");
}, process.env.SEL || ".sampler a[href^='/']:not([href^='/fax'])");
console.log("before", JSON.stringify({ y: before.y, docH: before.docH, inf: before.inf }), "click", href);
await p.evaluate((h) => document.querySelector(`.sampler a[href="${h}"]`).click(), href);
await p.waitForTimeout(2500);
console.log("on dest", p.url().replace(BASE, ""), JSON.stringify(await state()));
await p.goBack();
for (const ms of [100, 400, 1000, 2000, 3500, 5000]) {
  await p.waitForTimeout(ms - (globalThis.__last || 0)); globalThis.__last = ms;
  console.log(" back+" + ms, p.url().replace(BASE, ""), JSON.stringify(await state()));
}
const scrollers = await p.evaluate(() => [...document.querySelectorAll("*")].filter((e) => e.scrollHeight > e.clientHeight + 50 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)).map((e) => ({ id: e.id, cls: String(e.className).slice(0, 40), top: Math.round(e.scrollTop), sh: e.scrollHeight, ch: e.clientHeight })));
console.log("scrollers after back:", JSON.stringify(scrollers));
await p.mouse.wheel(0, 1200); await p.waitForTimeout(800);
console.log("after user wheel:", JSON.stringify(await p.evaluate(() => ({ winY: Math.round(scrollY), bodyTop: document.body.scrollTop, htmlTop: document.documentElement.scrollTop, bodyCls: document.body.className, bodyOverflow: getComputedStyle(document.body).overflowY, htmlOverflow: getComputedStyle(document.documentElement).overflowY, bodyX: getComputedStyle(document.body).overflowX, htmlX: getComputedStyle(document.documentElement).overflowX, bodyStyle: document.body.getAttribute("style"), htmlStyle: document.documentElement.getAttribute("style"), bodyH: getComputedStyle(document.body).height, htmlH: getComputedStyle(document.documentElement).height, htmlCls: document.documentElement.className }))));
const after = await tiles();
console.log("same tiles:", JSON.stringify(after) === JSON.stringify(before.tiles));
if (errs.length) console.log("dup-key:", errs.slice(0, 2));

// tab round trip (desktop only: tabs aren't rendered on phone)
if (VP === "desktop") {
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(500);
  const t1 = await tiles();
  await p.locator(".home-tab").nth(1).click(); await p.waitForTimeout(2000);
  await p.locator(".home-tab").first().click(); await p.waitForTimeout(3000);
  const t2 = await tiles();
  console.log("tab round-trip same:", JSON.stringify(t1) === JSON.stringify(t2));
  if (JSON.stringify(t1) !== JSON.stringify(t2)) console.log(" t1", t1.slice(0, 8).join(" "), "\n t2", t2.slice(0, 8).join(" "));
}
await b.close();
