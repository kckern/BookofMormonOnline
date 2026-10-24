// Facsimiles fixes: modal closes in one action, mobile verse links open the drawer,
// edition switch opens no modal, mobile back/scrub sheet, copy-link present. Usage: node verify-fax.mjs [base]
const { chromium, devices } = await import(new URL("../../frontend/next/node_modules/playwright/index.mjs", import.meta.url).href);
const base = process.argv[2] || "http://localhost:8210";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const b = await chromium.launch(); let bad = 0;
const ok = (c, m, extra = "") => { if (!c) bad++; console.log(c ? "ok  " : "FAIL", m, extra); };
const MODAL = ".faxVerseModal-card, .faxVerseModal, .faxVerseDrawer";

// ---- desktop
const dc = await b.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });
const open = async (url) => { const p = await dc.newPage(); await p.goto(base + url, { waitUntil: "domcontentloaded", timeout: 90000 }); return p; };
for (const how of ["x", "escape", "backdrop"]) {
  const p = await open("/fax/1830/2.nephi.23.11");
  await p.waitForSelector(".faxVerseModal-close", { timeout: 45000 }).catch(() => {});
  const had = await p.locator(".faxVerseModal-close").count();
  ok(had > 0, `[${how}] deep link opens the modal`);
  if (how === "x") await p.click(".faxVerseModal-close");
  else if (how === "escape") await p.keyboard.press("Escape");
  else await p.click(".faxVerseModal-backdrop", { position: { x: 720, y: 870 } });
  await p.waitForTimeout(2000);
  const still = await p.locator(".faxVerseModal-close").count();
  ok(still === 0, `[${how}] closes on the first action`, p.url().replace(base, ""));
  await p.close();
}
{ // share button + edition switch
  const p = await open("/fax/1830/2.nephi.23.11");
  await p.waitForSelector(".faxVerseModal-close", { timeout: 45000 }).catch(() => {});
  ok(await p.locator(".faxVerseModal-actions .faxCopyLink").count() === 1, "copy link in the verse modal");
  await p.click(".faxVerseModal-close"); await p.waitForTimeout(1500);
  ok(await p.locator(".fax-toolbar-share").count() === 1, "copy link in the toolbar");
  await p.keyboard.press("ArrowDown"); await p.waitForTimeout(5000);
  ok(await p.locator(".faxVerseModal-close").count() === 0, "edition switch opens no verse modal", p.url().replace(base, ""));
  await p.close();
}
await dc.close();

// ---- phone
const mc = await b.newContext({ ...devices["iPhone 13"], userAgent: devices["iPhone 13"].userAgent });
for (const slug of ["alma.32.21", "2.nephi.23.11"]) {
  const p = await mc.newPage();
  await p.goto(`${base}/fax/1830/${slug}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForSelector(".faxVerseDrawer, .faxVerseModal-close", { timeout: 40000 }).catch(() => {});
  const drawer = await p.locator(".faxVerseDrawer, .faxVerseModal-close").count();
  ok(drawer > 0, `[phone] ${slug} opens the verse drawer`, p.url().replace(base, ""));
  ok(p.url().includes(slug.split(".")[0]), `[phone] ${slug} keeps the ref in the URL`);
  await p.close();
}
{
  const p = await mc.newPage();
  await p.goto(`${base}/fax/1830/9`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForSelector(".faxScrubFab", { timeout: 40000 }).catch(() => {});
  ok((await p.getAttribute("#fax_back", "href")) === "/fax", "[phone] back goes to /fax");
  const bb = await p.locator("#fax_back").boundingBox();
  ok(bb && bb.width >= 44 && bb.height >= 44, "[phone] back target >= 44px", JSON.stringify(bb));
  await p.click(".faxScrubFab");
  ok(await p.locator(".faxScrubSheet .scrub-close").count() === 1, "[phone] scrub sheet has a close button");
  const cb = await p.locator(".scrub-close").boundingBox();
  ok(cb && cb.width >= 44 && cb.height >= 44, "[phone] close target >= 44px");
  await p.click(".faxScrubBackdrop", { position: { x: 20, y: 80 } });
  await p.waitForTimeout(300);
  ok(await p.locator(".faxScrubSheet").count() === 0, "[phone] tapping outside closes the sheet");
  await p.close();
}
await b.close(); process.exit(bad ? 1 : 0);
