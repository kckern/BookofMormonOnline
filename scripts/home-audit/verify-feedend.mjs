// Playwright lives in frontend/next; override with PLAYWRIGHT_MODULE (e.g. from a worktree).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || new URL("../../frontend/next/node_modules/playwright/index.mjs", import.meta.url).href);
const BASE = process.env.BASE || "http://localhost:8201";
const OUT = process.env.OUT || new URL("../../docs/audits/home-discover-audit-2026-10-15/", import.meta.url).pathname + "page-after";
const b = await chromium.launch();
for (const vp of ["desktop", "phone"]) {
  const phone = vp === "phone";
  const ctx = await b.newContext({
    userAgent: phone ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone, serviceWorkers: "block",
  });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__cls = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls.push(e.value); }).observe({ type: "layout-shift", buffered: true }); });
  // warm the 6h cache, then measure a warm load's CLS
  await p.goto(BASE + "/home"); await p.waitForTimeout(5000);
  await p.goto(BASE + "/home"); await p.waitForTimeout(6000);
  const warmCls = await p.evaluate(() => window.__cls.reduce((a, v) => a + v, 0));
  // block infinite-scroll batches (they carry an explicit seed); the front-door load does not
  let blocked = 0;
  await p.route(/\/graphql/, (r) => {
    const body = r.request().postData() || "";
    if (/homesampler\(seed:/.test(body)) { blocked++; return r.abort(); }
    return r.continue();
  });
  await p.mouse.move(phone ? 200 : 900, 500);
  for (let i = 0; i < 25; i++) { await p.mouse.wheel(0, 2500); await p.waitForTimeout(300); }
  await p.waitForTimeout(5000);
  for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, 3000); await p.waitForTimeout(200); }
  const st = await p.evaluate(() => ({ end: document.querySelector(".samplerFeedEnd")?.innerText.replace(/\s+/g, " "), sk: document.querySelectorAll(".tile.skeleton").length, inf: document.querySelectorAll(".infiniteTile").length }));
  console.log(vp, "warmCLS", warmCls.toFixed(3), "blocked", blocked, JSON.stringify(st));
  await p.screenshot({ path: `${OUT}/${vp}-feedend.png`, mask: [p.locator(".tile-community")] });
  await p.unroute(/\/graphql/);
  if (st.end) {
    await p.locator(".samplerFeedEndAction").click(); await p.waitForTimeout(4000);
    console.log(vp, "after retry", JSON.stringify(await p.evaluate(() => ({ end: !!document.querySelector(".samplerFeedEnd"), inf: document.querySelectorAll(".infiniteTile").length }))));
  }
  await ctx.close();
}
await b.close();
