// Shared harness for the Home/Discover tile audit. Import from an agent script:
//   import { open, OUT } from "<repo>/scripts/home-audit/tileharness.mjs";
//   const h = await open("desktop", "people");   // or "phone"
//   await h.home();                               // loads /home warm-ish, waits for tiles
//   const t = h.tile("tile-people");              // locator for the first tile with that span class
//   await h.shot("at-rest", t);                   // element screenshot (community masked)
//   ... interact via h.page ...
//   console.log(await h.cls(), h.errors);
//   await h.close();
// Playwright lives in frontend/next; override with PLAYWRIGHT_MODULE (e.g. from a worktree).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || new URL("../../frontend/next/node_modules/playwright/index.mjs", import.meta.url).href);
import fs from "node:fs";

export const BASE = process.env.BASE || "http://localhost:8201"; // Vite dev — what human browsers get (see audit doc §4)
export const OUT = process.env.OUT || new URL("../../docs/audits/home-discover-audit-2026-10-15/", import.meta.url).pathname + "tiles";
// Real user data (community nicknames/messages) must never be captured unmasked.
const MASK = [".tile-community", ".communityMessage", ".communityMsgUser"];

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false,
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36" },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
};

const OBSERVERS = () => {
  window.__cls = [];
  const desc = (n) => {
    const t = n && n.closest && n.closest(".tile");
    return t ? [...t.classList].filter((c) => c !== "tile").join(".") : (n && n.className && String(n.className).slice(0, 50)) || (n && n.nodeName);
  };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__cls.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), input: e.hadRecentInput, src: (e.sources || []).map((s) => desc(s.node)).slice(0, 4) });
  }).observe({ type: "layout-shift", buffered: true });
};

export async function open(vpName = "desktop", group = "misc", { reducedMotion = "no-preference", colorScheme = "light" } = {}) {
  const dir = `${OUT}/${group}`;
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...VIEWPORTS[vpName], reducedMotion, colorScheme, serviceWorkers: "block" });
  await ctx.addInitScript(OBSERVERS);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)));
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text().slice(0, 300)));
  page.on("response", (r) => r.status() >= 400 && errors.push(`http ${r.status()}: ${r.url().slice(0, 160)}`));
  const masks = () => MASK.map((s) => page.locator(s));
  return {
    page, ctx, browser, errors, dir,
    /** Load Home and wait until tiles render and the balancer settles. */
    async home(path = "/home") {
      await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".tile:not(.skeleton)", { timeout: 30000 });
      await page.waitForTimeout(3500);
    },
    /** Locator for the nth tile carrying span class `cls` (e.g. "tile-people"). */
    tile(cls, n = 0) { return page.locator(`.tile.${cls}`).nth(n); },
    /** Screenshot: pass a locator for an element shot, or nothing for the viewport. */
    async shot(name, locator, opts = {}) {
      const path = `${dir}/${vpName}-${name}.png`;
      if (locator) { await locator.scrollIntoViewIfNeeded(); await locator.screenshot({ path, mask: masks(), ...opts }); }
      else await page.screenshot({ path, mask: masks(), ...opts });
      return path;
    },
    /** Scroll the page until a tile with span class `cls` exists (infinite batches), up to maxSteps. */
    async scrollUntil(cls, maxSteps = 40) {
      for (let i = 0; i < maxSteps; i++) {
        if (await page.locator(`.tile.${cls}`).count()) return true;
        await page.mouse.wheel(0, 1500); await page.waitForTimeout(600);
      }
      return false;
    },
    /** Trigger the Home resample (desktop only; the control isn't rendered on phone). */
    async resample() { await page.evaluate(() => window.dispatchEvent(new Event("home:resample"))); await page.waitForSelector(".tile:not(.skeleton)"); await page.waitForTimeout(3500); },
    /**
     * Touch hit heights (px) for every `selector` match inside `locator`: an
     * elementFromPoint scan down each target's centre column, counting points
     * that land on the target (its ::after hit area included). The tile
     * standard wants >= 44 on touch viewports. Targets must be on screen.
     */
    async hitHeights(locator, selector) {
      return locator.evaluate((root, sel) => [...root.querySelectorAll(sel)].map((el) => {
        el.scrollIntoView({ block: "center", behavior: "instant" });
        const r = el.getBoundingClientRect();
        const x = r.left + Math.min(r.width / 2, 6);
        let hit = 0;
        for (let y = Math.floor(r.top - 40); y <= r.bottom + 40; y++) {
          const at = document.elementFromPoint(x, y);
          if (at && (at === el || el.contains(at))) hit++;
        }
        return { text: (el.textContent || "").trim().slice(0, 24), box: Math.round(r.height), hit };
      }), selector);
    },
    async cls() { return page.evaluate(() => window.__cls); },
    async resetCls() { await page.evaluate(() => (window.__cls = [])); },
    async close() { await browser.close(); },
  };
}
