// Scan hidden/unfinished surfaces on a base URL at desktop+phone: status, console/page errors, overflow, text volume, screenshot.
// Usage: node surface-scan.mjs <outdir> <base> path[,path…]
const { chromium } = await import(new URL("../../frontend/next/node_modules/playwright/index.mjs", import.meta.url).href);
const [out, base, list] = [process.argv[2], process.argv[3], process.argv[4].split(",")];
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const b = await chromium.launch();
for (const path of list) for (const [name, vp, t] of [["d", { width: 1440, height: 900 }, false], ["m", { width: 390, height: 844 }, true]]) {
  const c = await b.newContext({ viewport: vp, userAgent: UA, hasTouch: t, isMobile: t });
  const p = await c.newPage(); const errs = [], bad = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 100)));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 100)));
  p.on("response", (r) => r.status() >= 400 && bad.push(r.status() + " " + r.url().replace(/^https?:\/\/[^/]+/, "").slice(0, 70)));
  let st = "?";
  try { const r = await p.goto(base + path, { waitUntil: "domcontentloaded", timeout: 60000 }); st = r.status(); await p.waitForTimeout(5000);
    const m = await p.evaluate(() => ({ ox: document.documentElement.scrollWidth - innerWidth, h: document.documentElement.scrollHeight, txt: document.body.innerText.replace(/\s+/g, " ").length,
      raw: (document.body.innerText.match(/\b(menu|home|rp|label)_[a-z_]+\b|undefined|\[object/g) || []).slice(0, 4), title: document.title.slice(0, 50), imgs: [...document.images].filter((i) => i.complete && !i.naturalWidth).length }));
    await p.screenshot({ path: `${out}/${path.replace(/[^a-z0-9]+/gi, "_")}-${name}.png` });
    console.log(`${name} ${path} ${st} ox=${m.ox} h=${m.h} txt=${m.txt} brokenImg=${m.imgs} raw=${JSON.stringify(m.raw)} errs=${errs.length}${errs[0] ? " [" + errs[0] + "]" : ""}${bad.length ? " bad=" + JSON.stringify(bad.slice(0, 3)) : ""} | ${m.title}`);
  } catch (e) { console.log(name, path, "ERR", String(e).slice(0, 80)); }
  await c.close();
}
await b.close();
