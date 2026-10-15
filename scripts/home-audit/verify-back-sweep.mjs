// One click, one Back, per destination class: every tile link must add exactly
// one history entry (Back lands on /home). Usage: node verify-back-sweep.mjs [desktop|phone]
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || new URL("../../frontend/next/node_modules/playwright/index.mjs", import.meta.url).href);
const BASE = process.env.BASE || "http://localhost:8201";
const VP = process.argv[2] || "desktop";
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
await p.goto(BASE + "/home"); await p.waitForSelector(".tile:not(.skeleton)", { state: "attached", timeout: 90000 }); await p.waitForTimeout(3000);
// scroll a little so reserves/batches exist, then back to top
for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 1500); await p.waitForTimeout(300); }
await p.waitForTimeout(1500);
// one sample href per first path segment
const hrefs = await p.evaluate(() => {
  const seen = new Map();
  for (const a of document.querySelectorAll(".sampler a[href^='/']")) {
    const h = a.getAttribute("href");
    const seg = h.split("/")[1] || "";
    if (!seen.has(seg)) seen.set(seg, h);
  }
  return [...seen.values()];
});
let fails = 0;
for (const href of hrefs) {
  await p.goto(BASE + "/home"); await p.waitForSelector(".tile:not(.skeleton)", { state: "attached", timeout: 90000 }); await p.waitForTimeout(1500);
  const ok = await p.evaluate((h) => { const a = [...document.querySelectorAll(".sampler a")].find((x) => x.getAttribute("href") === h); if (!a) return false; a.click(); return true; }, href);
  if (!ok) { console.log("SKIP (not rendered this sample)", href); continue; }
  await p.waitForTimeout(3500);
  const landed = p.url().replace(BASE, "");
  await p.goBack(); await p.waitForTimeout(2000);
  const back = new URL(p.url()).pathname;
  const pass = back === "/home";
  if (!pass) fails++;
  console.log(pass ? "ok  " : "FAIL", href.padEnd(48), "→", landed.padEnd(48), "Back →", back);
}
console.log(`${VP}: ${hrefs.length} destination classes, ${fails} failing`);
await b.close();
process.exit(fails ? 1 : 0);
