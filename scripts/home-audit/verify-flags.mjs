// Flags behave: dark flags hide their nav/route/card, ?ff= turns them on. Usage: node verify-flags.mjs [base] [dark]
// dark=1 (default for prod) -> expect theology/1820s/notes dark by config; dark=0 (dev build) -> pass ?ff=-… overrides.
const { chromium } = await import(new URL("../../frontend/next/node_modules/playwright/index.mjs", import.meta.url).href);
const base = process.argv[2] || "http://localhost:8210"; const prodLike = process.argv[3] === "prod";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const b = await chromium.launch(); let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log(c ? "ok  " : "FAIL", m); };
const q = prodLike ? "" : "ff=-theology,-history1820s,-passageNotes";
const ctx = async () => (await b.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA })).newPage();
const go = async (p, path, extra = "") => { const qs = extra === null ? "" : extra || q; await p.goto(base + path + (qs ? "?" + qs : ""), { waitUntil: "domcontentloaded", timeout: 90000 }); await p.waitForTimeout(prodLike ? 9000 : 5000); };
const nav = (p) => p.evaluate(() => [...document.querySelectorAll(".sidebar-wrapper li")].map((x) => x.textContent.trim().replace(/\s+/g, " ").slice(0, 14)).filter((t) => t && t.length < 14));
let p = await ctx(); await go(p, "/contents");
const n = await nav(p);
ok(["Matters", "History"].every((x) => n.includes(x)), `nav shows Matters and History: ${n.join(",")}`);
ok(!n.includes("Theology"), "nav hides Theology");
await go(p, "/history");
ok(!(await p.evaluate(() => /New York & Pennsylvania/.test(document.body.innerText))), "history hub has no 1820s card");
await go(p, "/history/1820s-ny-pa"); { const path = new URL(p.url()).pathname; const gone = await p.evaluate(() => /could not be found/i.test(document.body.innerText)); ok(path === "/history" || gone, "/history/1820s-ny-pa is dark: redirected or clean 404 (got " + path + (gone ? ", 404 page" : "") + ")"); }
await go(p, "/theology"); ok(new URL(p.url()).pathname === "/", "/theology -> / (got " + new URL(p.url()).pathname + ")");
p = await ctx(); await go(p, "/contents", "ff=theology"); ok((await nav(p)).includes("Theology"), "?ff=theology shows Theology in nav");
await go(p, "/theology", null); ok(new URL(p.url()).pathname === "/theology", "override persists to the next page");
await b.close(); process.exit(bad ? 1 : 0);
