// First-visit rule at "/": fresh context -> Discover; chapterRef or token -> Read. Usage: node verify-frontdoor.mjs [base]
const { chromium } = await import(new URL("../../frontend/next/node_modules/playwright/index.mjs", import.meta.url).href);
const base = process.argv[2] || "http://localhost:8210";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const b = await chromium.launch(); let bad = 0;
for (const [name, seed, want] of [["first visit", null, "discover"], ["has read", { chapterRef: "Alma 32" }, "read"], ["guest token only (as the app issues)", { token: "x" }, "discover"]]) {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });
  if (seed) await c.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed);
  const p = await c.newPage();
  await p.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForSelector(".home-shell, .read-container, [class*=chapter], .verse", { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => ({ url: location.pathname, discover: !!document.querySelector(".home-shell"), tiles: document.querySelectorAll(".tile").length,
    active: [...document.querySelectorAll(".sidebar-wrapper li.active, .sidebar li.active")].map((x) => x.textContent.trim().slice(0, 20)),
    nav: [...document.querySelectorAll(".sidebar-wrapper li")].slice(0, 3).map((x) => x.textContent.trim()) }));
  const got = r.discover ? "discover" : "read";
  if (got !== want) bad++;
  console.log(got === want ? "ok  " : "FAIL", name, "->", got, JSON.stringify(r));
  await c.close();
}
await b.close(); process.exit(bad ? 1 : 0);
