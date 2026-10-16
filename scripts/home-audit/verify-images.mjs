// Image weight on a Home load: bytes per media family, variant usage, broken images.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || new URL("../../frontend/next/node_modules/playwright/index.mjs", import.meta.url).href);
const BASE = process.env.BASE || "http://localhost:8201";
const VP = process.argv[2] || "desktop";
const phone = VP === "phone";
const b = await chromium.launch();
const ctx = await b.newContext({
  serviceWorkers: "block",
  deviceScaleFactor: 2,
  userAgent: phone
    ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
    : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone,
});
const p = await ctx.newPage();
const bytes = {};
const errors = [];
p.on("response", async (r) => {
  const u = r.url();
  if (!/media\.bookofmormon\.online|assets\.bookofmormon\.online/.test(u)) return;
  if (r.status() >= 400) { errors.push(`${r.status()} ${u.replace(/^https?:\/\/[^/]+/, "")}`); return; }
  const fam = u.includes("/variants/") ? "variant:" + u.split("/variants/")[1].split("/")[1] : "orig:" + u.replace(/^https?:\/\/[^/]+\//, "").split("/")[0];
  try { const len = (await r.body()).length; bytes[fam] = (bytes[fam] || 0) + len; } catch {}
});
await p.goto(BASE + "/home"); await p.waitForSelector(".tile:not(.skeleton)", { state: "attached", timeout: 90000 });
await p.mouse.move(phone ? 200 : 900, 500);
for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 1200); await p.waitForTimeout(500); }
await p.waitForTimeout(3000);
const imgs = await p.evaluate(() => {
  const all = [...document.querySelectorAll(".sampler img")];
  return {
    total: all.length,
    withSrcset: all.filter((i) => i.srcset).length,
    broken: all.filter((i) => i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0).map((i) => i.currentSrc || i.src).slice(0, 8),
    noAlt: all.filter((i) => !i.hasAttribute("alt")).length,
  };
});
const kb = (n) => Math.round(n / 1024) + "KB";
console.log(VP, JSON.stringify({ ...imgs, bytes: Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, kb(v)])), total: kb(Object.values(bytes).reduce((a, x) => a + x, 0)), httpErrors: errors.slice(0, 8) }, null, 1));
await b.close();
