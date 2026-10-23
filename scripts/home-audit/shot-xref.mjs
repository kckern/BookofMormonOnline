// Screenshots of the Analysis reader at desktop + phone. Usage: node shot-xref.mjs <outdir> [base]
const { chromium } = await import(new URL("../../frontend/next/node_modules/playwright/index.mjs", import.meta.url).href);
const out = process.argv[2], base = process.argv[3] || "http://localhost:8210";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const b = await chromium.launch();
for (const [name, vp, touch] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
  const c = await b.newContext({ viewport: vp, userAgent: UA, hasTouch: touch, isMobile: touch });
  const p = await c.newPage();
  await p.goto(base + "/analysis/bible/bom/3-nephi/13~matthew?bch=6", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForSelector('[data-testid="xref-pair"]', { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${name}-top.png` });
  await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/${name}-scrolled.png` });
  const m = await p.evaluate(() => {
    const r = document.querySelector(".xref-rail"), q = (s) => document.querySelector(s);
    const cc = q(".xref-chaptercell");
    return { railTop: r && Math.round(r.getBoundingClientRect().top), cell: cc && [cc.offsetWidth, cc.offsetHeight], overflowX: document.documentElement.scrollWidth - innerWidth,
      bc: q(".bc-link") && getComputedStyle(q(".bc-link")).color, count: q(".xref-readercount")?.textContent.trim() };
  });
  console.log(name, JSON.stringify(m));
  await c.close();
}
await b.close();
