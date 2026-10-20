// Prod smoke: Home renders (desktop+phone), phone single column, CLS, media variants, one-Back, guest /home/user, /matters/narrative.
// usage: node scripts/home-audit/prod-smoke.mjs   (BASE=https://… to point elsewhere)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || new URL("../../frontend/next/node_modules/playwright/index.mjs", import.meta.url).href);
const BASE = process.env.BASE || "https://bookofmormon.online";
const b = await chromium.launch();
let bad = 0;
const ok = (name, cond, extra = "") => { console.log(cond ? "ok  " : "FAIL", name, extra); if (!cond) bad++; };
for (const vp of ["desktop", "phone"]) {
  const phone = vp === "phone";
  const ctx = await b.newContext({ serviceWorkers: "block", userAgent: phone ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36", viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone });
  const p = await ctx.newPage();
  const errs = [], variantBytes = { n: 0, bad: 0 };
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  p.on("response", (r) => { if (r.url().includes("/variants/")) { variantBytes.n++; if (r.status() >= 400) variantBytes.bad++; } });
  await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
  await p.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".tile:not(.skeleton)", { state: "attached", timeout: 60000 }); await p.waitForTimeout(4000);
  const st = await p.evaluate(() => ({ tiles: document.querySelectorAll(".sampler .tile").length, single: !!document.querySelector(".samplerSingle"), peopleTop: Math.round(document.querySelector(".tile-people")?.getBoundingClientRect().top + scrollY) }));
  ok(`${vp} home renders`, st.tiles >= 15, JSON.stringify(st));
  if (phone) ok("phone: People near the top (single column)", st.single && st.peopleTop < 900, `peopleTop=${st.peopleTop}`);
  ok(`${vp} warm CLS`, (await p.evaluate(() => window.__cls)) < 0.1, String((await p.evaluate(() => window.__cls)).toFixed(3)));
  ok(`${vp} media variants served`, variantBytes.n > 0 && variantBytes.bad === 0, JSON.stringify(variantBytes));
  // one click, one Back
  const href = await p.evaluate(() => [...document.querySelectorAll(".sampler a[href^='/people/'], .sampler a[href^='/places/']")].find((a) => a.offsetParent)?.getAttribute("href"));
  if (href) {
    await p.evaluate((h) => [...document.querySelectorAll(".sampler a")].find((x) => x.getAttribute("href") === h).click(), href);
    await p.waitForTimeout(4000);
    const landed = new URL(p.url()).pathname;
    await p.goBack(); await p.waitForTimeout(3500);
    ok(`${vp} Back from ${href}`, landed === href && new URL(p.url()).pathname === "/home", `landed ${landed}, back ${new URL(p.url()).pathname}`);
  }
  // guest /home/user must not crash (phone P0)
  await p.goto(BASE + "/home/user", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(6000);
  ok(`${vp} guest /home/user renders`, await p.evaluate(() => document.getElementById("root")?.children.length > 0 && document.body.innerText.length > 100));
  await p.goto(BASE + "/matters/narrative", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(6000);
  ok(`${vp} /matters/narrative is the index, not Not found`, await p.evaluate(() => !/not found/i.test(document.body.innerText.slice(0, 800)) && document.querySelectorAll("a[href^='/matters/']").length > 20));
  ok(`${vp} no page errors`, errs.length === 0, errs.slice(0, 2).join(" | "));
  await ctx.close();
}
await b.close();
console.log(bad ? `${bad} FAILED` : "all prod smoke checks passed");
process.exit(bad ? 1 : 0);
