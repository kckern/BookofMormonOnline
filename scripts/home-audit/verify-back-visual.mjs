// Back must put the reader back in front of the SAME content: the tile at the
// viewport's center before leaving is the tile there after Back, at ~the same
// offset. (Raw scrollY can differ legitimately: scroll anchoring compensates for
// late layout above the viewport.) Usage: node verify-back-visual.mjs [desktop|phone] [depthPx]
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || new URL("../../frontend/next/node_modules/playwright/index.mjs", import.meta.url).href);
const BASE = process.env.BASE || "http://localhost:8201";
const VP = process.argv[2] || "desktop";
const DEPTH = Number(process.argv[3] || 3500);
const phone = VP === "phone";
const b = await chromium.launch();
const ctx = await b.newContext({
  serviceWorkers: "block",
  userAgent: phone
    ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
    : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone,
});
const p = await ctx.newPage();
const anchor = () => p.evaluate(() => {
  const tiles = [...document.querySelectorAll(".sampler .tile")];
  const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest(".tile");
  return el ? { index: tiles.indexOf(el), cls: [...el.classList].filter((c) => c.startsWith("tile-")).join("."), top: Math.round(el.getBoundingClientRect().top), y: Math.round(scrollY) } : null;
});
await p.goto(BASE + "/home"); await p.waitForSelector(".tile:not(.skeleton)", { state: "attached", timeout: 90000 }); await p.waitForTimeout(3000);
await p.mouse.move(phone ? 200 : 900, 400);
while ((await p.evaluate(() => scrollY)) < DEPTH) { await p.mouse.wheel(0, 400); await p.waitForTimeout(120); }
await p.waitForTimeout(3000);
const before = await anchor();
const href = await p.evaluate(() => {
  const a = [...document.querySelectorAll(".sampler a[href^='/']")].find((x) => { const r = x.getBoundingClientRect(); return r.top > 80 && r.bottom < innerHeight - 80 && r.width > 20; });
  return a?.getAttribute("href");
});
await p.evaluate((h) => [...document.querySelectorAll(".sampler a")].find((x) => x.getAttribute("href") === h).click(), href);
await p.waitForTimeout(3000);
await p.goBack();
await p.waitForTimeout(5000);
const after = await anchor();
const same = before && after && before.index === after.index && before.cls === after.cls;
const drift = same ? Math.abs(before.top - after.top) : null;
const pass = same && drift <= 80;
console.log(`${pass ? "ok  " : "FAIL"} ${VP} via ${href}: before ${JSON.stringify(before)} after ${JSON.stringify(after)}${drift !== null ? ` drift ${drift}px` : ""}`);
await b.close();
process.exit(pass ? 0 : 1);
