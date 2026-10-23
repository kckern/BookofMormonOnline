// From the front door ("/"): open a place tile -> popup; close; Back. Must stay on Discover at "/".
const { chromium } = await import(new URL("../../frontend/next/node_modules/playwright/index.mjs", import.meta.url).href);
const base = process.argv[2] || "http://localhost:8210";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const b = await chromium.launch(); let bad = 0;
const ok = (c, m) => { if (!c) bad++; console.log(c ? "ok  " : "FAIL", m); };
for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  const c = await b.newContext({ viewport: vp, userAgent: UA, hasTouch: name === "phone", isMobile: name === "phone" });
  const p = await c.newPage();
  await p.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForSelector(".tile", { timeout: 60000 }); await p.waitForTimeout(2500);
  const href = await p.evaluate(() => { const a = [...document.querySelectorAll(".tile a[href^='/places/'], .tile a[href^='/people/']")].find((x) => x.offsetParent && !x.closest("[data-clamp-hidden]")); if (!a) return null; a.scrollIntoView({ block: "center", behavior: "instant" }); return a.getAttribute("href"); });
  ok(!!href, `${name}: found a tile entity link ${href}`);
  if (!href) { await c.close(); continue; }
  await p.waitForTimeout(500);
  await p.locator(`.tile a[href="${href}"]`).first().click();
  await p.waitForTimeout(2500);
  ok(new URL(p.url()).pathname === href, `${name}: popup URL is ${href}`);
  ok(await p.evaluate(() => !!document.querySelector(".tile")), `${name}: Discover still mounted under the popup`);
  await p.goBack(); await p.waitForTimeout(2000);
  const path = new URL(p.url()).pathname;
  ok(path === "/", `${name}: Back returns to "/" (got ${path})`);
  ok(await p.evaluate(() => !!document.querySelector(".tile")), `${name}: Discover visible after Back`);
  await c.close();
}
await b.close(); process.exit(bad ? 1 : 0);
