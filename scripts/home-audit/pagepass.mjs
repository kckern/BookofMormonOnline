// Page-level pass (§K + B/E at page scope) for the Home/Discover audit.
// Playwright lives in frontend/next; override with PLAYWRIGHT_MODULE (e.g. from a worktree).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || new URL("../../frontend/next/node_modules/playwright/index.mjs", import.meta.url).href);
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:8201";
const OUT = process.env.OUT || new URL("../../docs/audits/home-discover-audit-2026-10-15/", import.meta.url).pathname + "page";
fs.mkdirSync(OUT, { recursive: true });
// Real user data (community nicknames/messages) must never land in the public repo.
const MASK = [".tile-community", ".communityMessage", ".communityMsgUser"];

const OBSERVERS = () => {
  window.__cls = [];
  window.__lt = [];
  const desc = (n) => {
    if (!n || !n.closest) return String(n && n.nodeName);
    const t = n.closest(".tile");
    return t ? "tile:" + [...t.classList].filter((c) => c !== "tile").join(".") : (n.className && String(n.className).slice(0, 60)) || n.nodeName;
  };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      window.__cls.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), input: e.hadRecentInput, scrollY: Math.round(scrollY), src: (e.sources || []).map((s) => desc(s.node)).slice(0, 4) });
    }
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__lt.push({ t: Math.round(e.startTime), d: Math.round(e.duration) });
  }).observe({ type: "longtask", buffered: true });
};

const snapshotLayout = () => {
  const col = (sel) => [...document.querySelectorAll(sel + " > .tile, " + sel + " .samplerMasonryCol > .tile")].map((t) => {
    const r = t.getBoundingClientRect();
    return { cls: [...t.classList].filter((c) => c !== "tile").join("."), top: Math.round(r.top + scrollY), h: Math.round(r.height), x: Math.round(r.left) };
  });
  const rail = document.querySelector(".samplerLeftRail");
  const main = document.querySelector(".samplerMain");
  const mcols = [...document.querySelectorAll(".samplerMasonryCol")].map((c) => Math.round(c.getBoundingClientRect().height));
  return {
    scrollY: Math.round(scrollY),
    docH: document.documentElement.scrollHeight,
    railH: rail ? Math.round(rail.offsetHeight) : null,
    mainH: main ? Math.round(main.offsetHeight) : null,
    masonryColsH: mcols,
    rail: col(".samplerLeftRail"),
    main: col(".samplerMain"),
    skeletons: document.querySelectorAll(".tile.skeleton").length,
    hOverflow: document.documentElement.scrollWidth > innerWidth,
  };
};

const report = {};
const browser = await chromium.launch();

for (const vp of [{ name: "desktop", width: 1440, height: 900, isMobile: false }, { name: "phone", width: 390, height: 844, isMobile: true }]) {
  const R = (report[vp.name] = {});
  const UA = vp.isMobile ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
  const ctx = await browser.newContext({ serviceWorkers: "block", userAgent: UA, viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, isMobile: vp.isMobile, hasTouch: vp.isMobile });
  await ctx.addInitScript(OBSERVERS);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text().slice(0, 200)));
  const shot = (name, opts = {}) => page.screenshot({ path: `${OUT}/${vp.name}-${name}.png`, mask: MASK.map((s) => page.locator(s)), ...opts });

  // 1. cold load, then warm load (cache now populated)
  await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  R.coldCls = await page.evaluate(() => window.__cls);
  R.coldLayout = await page.evaluate(snapshotLayout);

  await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
  const timeline = [];
  for (const ms of [300, 1000, 3000, 6000]) {
    await page.waitForTimeout(ms - (timeline.at(-1)?.ms || 0));
    timeline.push({ ms, layout: await page.evaluate(snapshotLayout) });
    await shot(`warm-${ms}ms`);
  }
  R.warmTimeline = timeline.map((t) => ({ ms: t.ms, order: [...t.layout.rail.map((x) => "R:" + x.cls), ...t.layout.main.map((x) => "M:" + x.cls)], railH: t.layout.railH, mainH: t.layout.mainH, cols: t.layout.masonryColsH, skeletons: t.layout.skeletons, hOverflow: t.layout.hOverflow }));
  R.warmCls = await page.evaluate(() => window.__cls);
  R.warmLayout = timeline.at(-1).layout;
  await shot("warm-full", { fullPage: true });

  // 2. infinite scroll: step down, record shifts while scrolling
  await page.evaluate(() => (window.__cls = []));
  const scrollSteps = [];
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, vp.height * 0.9);
    await page.waitForTimeout(700);
    scrollSteps.push(await page.evaluate(() => ({ y: Math.round(scrollY), docH: document.documentElement.scrollHeight, sk: document.querySelectorAll(".tile.skeleton").length, inf: document.querySelectorAll(".infiniteTile").length })));
  }
  R.scrollSteps = scrollSteps;
  R.scrollCls = await page.evaluate(() => window.__cls.filter((e) => e.v > 0.001));
  await shot("scrolled-viewport");
  R.longTasks = await page.evaluate(() => window.__lt.filter((e) => e.d > 100));

  // 3. Back/return: from mid-feed, follow a tile deeplink, then Back
  await page.evaluate(() => window.scrollTo(0, Math.min(3000, document.documentElement.scrollHeight - innerHeight)));
  await page.waitForTimeout(800);
  const before = await page.evaluate(snapshotLayout);
  const link = page.locator('.samplerMain a[href^="/people/"], .samplerMain a[href^="/places/"]').first();
  const href = await link.getAttribute("href").catch(() => null);
  // click the first deeplink that is currently near the viewport
  const target = await page.evaluate(() => {
    const as = [...document.querySelectorAll(".samplerColumns a[href^='/']")].filter((a) => { const r = a.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight && r.width > 20; });
    return as[0] ? as[0].getAttribute("href") : null;
  });
  if (target) {
    await page.locator(`.samplerColumns a[href="${target}"]`).first().click();
    await page.waitForTimeout(2500);
    R.backTest = { clicked: target, landedUrl: page.url(), landedScrollY: await page.evaluate(() => scrollY) };
    await shot("destination-sample");
    await page.goBack();
    await page.waitForTimeout(3500);
    const after = await page.evaluate(snapshotLayout);
    R.backTest.beforeY = before.scrollY;
    R.backTest.afterY = after.scrollY;
    R.backTest.beforeInfinite = scrollSteps.at(-1).inf;
    R.backTest.afterInfinite = await page.evaluate(() => document.querySelectorAll(".infiniteTile").length);
    R.backTest.orderBefore = before.main.slice(0, 10).map((x) => x.cls);
    R.backTest.orderAfter = after.main.slice(0, 10).map((x) => x.cls);
    R.backTest.railBefore = before.rail.map((x) => x.cls);
    R.backTest.railAfter = after.rail.map((x) => x.cls);
    await shot("after-back");
  }
  R.unusedHref = href;

  // 4. Tab round-trip: Discover → Community → Discover
  await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const order1 = (await page.evaluate(snapshotLayout)).main.map((x) => x.cls);
  const tabs = await page.locator(".home-tab").all();
  R.tabs = await Promise.all(tabs.map((t) => t.innerText()));
  if (tabs[1]) {
    await tabs[1].click(); await page.waitForTimeout(2000);
    await shot("tab-community");
    await page.locator(".home-tab").first().click(); await page.waitForTimeout(2500);
    const order2 = (await page.evaluate(snapshotLayout)).main.map((x) => x.cls);
    R.tabRoundTrip = { sameOrder: JSON.stringify(order1) === JSON.stringify(order2), order1: order1.slice(0, 8), order2: order2.slice(0, 8) };
  }

  // 5. Manual resample control
  await page.evaluate(() => (window.__cls = []));
  const reload = page.locator(".home-tabs-reload");
  if (await reload.count()) {
    await reload.click();
    await page.waitForTimeout(150); await shot("resample-150ms");
    await page.waitForTimeout(2500); await shot("resample-2650ms");
    R.resampleCls = await page.evaluate(() => window.__cls.filter((e) => e.v > 0.001));
  }

  // 6. End of feed on fetch failure: block homesampler batch fetches, scroll to the bottom
  await page.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.route("**/graphql", (route) => (route.request().postData() || "").includes("homesampler") ? route.abort() : route.continue());
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 3000); await page.waitForTimeout(500); }
  await page.waitForTimeout(3000);
  R.fetchFailEnd = await page.evaluate(() => ({ skeletons: document.querySelectorAll(".tile.skeleton").length, atBottom: Math.round(innerHeight + scrollY) >= document.documentElement.scrollHeight - 5 }));
  await shot("fetchfail-bottom");
  await page.unroute("**/graphql");

  R.errors = errors.slice(0, 20);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(OUT + "/pagepass.json", JSON.stringify(report, null, 1));
console.log("done");
