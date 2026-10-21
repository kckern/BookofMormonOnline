// Click EVERY distinct link/pill in EVERY tile like a user would, then go Back.
// For each: where did it land (page / popup / drawer / external), is the landing
// healthy (no "Not found", no error boundary, not blank), and does Back return to
// Discover with the tile still there? (verify-back* only pressed Back; this is the
// path that missed "tile → place → '< Places'" on prod 2026-10-20.)
// Usage: BASE=https://bookofmormon.online VP=phone [MAXTILES=40] [PER=8] node scripts/home-audit/click-sweep.mjs
const { open } = await import(new URL("./tileharness.mjs", import.meta.url).href);
const VP = process.env.VP || "phone";
const MAXTILES = +(process.env.MAXTILES || 40);
const PER = +(process.env.PER || 8);
const h = await open(VP, `click-sweep-${VP}`);
const p = h.page;
const homePath = () => /^\/home(\/discover)?\/?$/.test(new URL(p.url()).pathname);
const rows = [];
const log = (r) => { rows.push(r); console.log(`${r.ok ? "ok  " : "FAIL"} ${VP} ${r.tile} [${r.label}] ${r.href} → ${r.landed}${r.note ? "  ‹" + r.note + "›" : ""}`); };

const loadHome = async () => {
  for (let i = 0; i < 3; i++) { try { await h.home(); break; } catch (e) { if (i === 2) throw e; await p.waitForTimeout(8000); } }
  let n = 0, last = 0;
  while (n++ < 40) { const c = await p.locator(".tile[data-tile-id]:not(.skeleton)").count(); if (c >= MAXTILES || (c === last && n > 12)) break; last = c; await p.mouse.move(VP === "phone" ? 200 : 700, 500); await p.mouse.wheel(0, 1500); await p.waitForTimeout(500); }
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await p.waitForTimeout(800);
};
await loadHome();

// inventory: tile id → distinct controls
const inventory = await p.evaluate((PER) => {
  const out = [];
  for (const t of document.querySelectorAll(".tile[data-tile-id]:not(.skeleton)")) {
    const id = t.getAttribute("data-tile-id"); const cls = [...t.classList].find((c) => c.startsWith("tile-")) || "tile";
    if (/community/.test(cls)) continue; // real user data / live; separate audit
    const seen = new Set(); const items = [];
    for (const a of t.querySelectorAll("a[href]")) { if (a.getAttribute("aria-hidden") === "true" || a.tabIndex < 0 || a.closest("[data-clamp-hidden]")) continue; const href = a.getAttribute("href"); if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/.test(href)) continue; const label = (a.getAttribute("aria-label") || a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40); const k = href + "|" + label; if (seen.has(k)) continue; seen.add(k); items.push({ kind: "a", href, label }); }
    for (const b of t.querySelectorAll("button")) { if (b.hasAttribute("data-clamp-hidden") || b.tabIndex < 0 || b.closest("[data-clamp-hidden]")) continue; const label = (b.getAttribute("aria-label") || b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40); if (!/\d|:/.test(label) && !/ref/i.test(b.className)) continue; const k = "btn|" + label; if (seen.has(k)) continue; seen.add(k); items.push({ kind: "btn", href: "(pill)", label }); }
    if (items.length) out.push({ id, cls, items: items.slice(0, PER) });
  }
  return out;
}, PER);
console.log(`inventory: ${inventory.length} tiles, ${inventory.reduce((n, t) => n + t.items.length, 0)} controls (${VP})`);

const landing = async () => p.evaluate(() => {
  const txt = (document.body.innerText || "").replace(/\s+/g, " ");
  const popup = document.querySelector("#popUp, .popupDrawer[class*=open], .EZDrawer__container, [class*=scripturePopup], [class*=ScripturePopup]");
  const popupVisible = !!popup && popup.getBoundingClientRect().width > 50 && getComputedStyle(popup).visibility !== "hidden";
  const main = document.querySelector(".main-panel, main, #root");
  return { path: location.pathname + location.search, popupVisible, mainLen: (main?.innerText || "").trim().length, bad: /Not found|Something went wrong|Application error|Unexpected error|undefined|\[object/i.test(txt) ? (txt.match(/Not found|Something went wrong|Application error|Unexpected error|undefined|\[object Object\]/i) || [""])[0] : "" };
});

for (const t of inventory) {
  for (const it of t.items) {
    const tileLoc = p.locator(`.tile[data-tile-id="${t.id}"]`).first();
    if (!(await tileLoc.count())) { log({ tile: t.cls, label: it.label, href: it.href, landed: "tile gone", ok: false, note: "tile vanished after a previous Back" }); continue; }
    // locate by href + the same computed label the inventory used (card links carry only an aria-label)
    let ctl = tileLoc.locator("never");
    const labelOf = (e) => (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
    if (it.kind === "a") {
      const all = tileLoc.locator(`a[href="${it.href.replace(/"/g, '\\"')}"]`);
      const labels = await all.evaluateAll((els, src) => els.map((e) => new Function("e", "return (" + src + ")(e)")(e)), labelOf.toString());
      const k = labels.indexOf(it.label); if (k >= 0) ctl = all.nth(k);
    } else {
      const all = tileLoc.locator("button");
      const labels = await all.evaluateAll((els, src) => els.map((e) => new Function("e", "return (" + src + ")(e)")(e)), labelOf.toString());
      const k = labels.indexOf(it.label); if (k >= 0) ctl = all.nth(k);
    }
    if (!(await ctl.count())) { log({ tile: t.cls, label: it.label, href: it.href, landed: "control gone", ok: true, note: "skipped" }); continue; }
    const external = it.kind === "a" && /^https?:\/\//.test(it.href) && !it.href.includes(new URL(p.url()).host);
    if (external) { log({ tile: t.cls, label: it.label, href: it.href, landed: "external (not clicked)", ok: true }); continue; }
    const errCount = h.errors.length;
    if (!(await ctl.isVisible()) || (await ctl.evaluate((e) => e.hasAttribute("data-clamp-hidden") || !!e.closest("[data-clamp-hidden]")).catch(() => false))) { log({ tile: t.cls, label: it.label, href: it.href, landed: "not visible (clamped/hidden)", ok: true, note: "skipped" }); continue; }
    const norm = (x) => x.replace(/\s+/g, " ").trim();
    const textBefore = norm(await tileLoc.innerText().catch(() => ""));
    let beforeTop = null;
    try { // instant, to mid-viewport: scrollIntoViewIfNeeded honors the site's scroll-behavior:smooth, so its position read mid-animation
      await ctl.evaluate((e) => { const r = e.getBoundingClientRect(); window.scrollBy({ top: r.top - innerHeight * 0.45, behavior: "instant" }); }); await p.waitForTimeout(700); beforeTop = (await ctl.boundingBox())?.y ?? null; await ctl.click({ timeout: 5000 }); } catch (e) { log({ tile: t.cls, label: it.label, href: it.href, landed: "click failed", ok: false, note: String(e.message).split("\n")[0].slice(0, 90) }); continue; }
    await p.waitForTimeout(2600);
    const L = await landing();
    const popupOpened = L.popupVisible && (it.kind === "btn" || /^\/(people|places|matters)\//.test(it.href));
    const kind = L.path === new URL(p.url()).pathname + new URL(p.url()).search && homePath() ? (L.popupVisible ? "popup(home)" : "stayed home") : (L.popupVisible ? "popup" : "page");
    const issues = [];
    if (L.bad) issues.push(`text "${L.bad}"`);
    if (!homePath() && L.mainLen < 60) issues.push("blank/near-empty page");
    const newErrs = h.errors.slice(errCount).filter((e) => /pageerror/.test(e));
    if (newErrs.length) issues.push(newErrs[0].slice(0, 80));
    if (it.kind === "a" && /^\/(people|places|matters)\/[^/]+$/.test(it.href) && !/matters\/(narrative|material|concepts)$/.test(it.href) && !popupOpened) issues.push("entity link did not open the popup");
    // go back
    let back = "";
    if (it.kind === "btn") { await p.keyboard.press("Escape"); await p.waitForTimeout(500); if ((await landing()).popupVisible) { const x = p.locator(".popupDrawer button[aria-label*=lose], #popUp .close, [class*=ScripturePopup] [class*=lose], button[aria-label=Close]").first(); if (await x.count()) await x.click().catch(() => {}); await p.waitForTimeout(400); } }
    else { await p.goBack().catch(() => {}); await p.waitForTimeout(3600); } // > pinAnchor's 3 s window (programmatic scrolls don't cancel it)
    const A = await landing();
    const atHome = homePath(); const stillThere = await p.locator(`.tile[data-tile-id="${t.id}"]`).count();
    if (!atHome) { issues.push(`Back landed on ${A.path}`); }
    else if (!stillThere) issues.push("Back: tile gone");
    else if (beforeTop != null) {
      // the control the reader clicked should be where they left it (content-anchored Back)
      const vis = (await ctl.count()) ? await ctl.first().boundingBox() : null;
      if (!vis) issues.push("Back: clicked control no longer found");
      else if (Math.abs(vis.y - beforeTop) > 120) issues.push(`Back: control moved ${Math.round(vis.y - beforeTop)}px from where it was`);
    }
    if (A.popupVisible && it.kind === "a") issues.push("popup still open after Back");
    if (atHome && stillThere) { const textAfter = norm(await p.locator(`.tile[data-tile-id="${t.id}"]`).first().innerText().catch(() => "")); if (textBefore && textAfter && textBefore !== textAfter) { const w = (x) => new Set(x.split(" ")); const a = w(textBefore), b = w(textAfter); const shared = [...a].filter((x) => b.has(x)).length / Math.max(a.size, b.size); if (shared < 0.9) issues.push(`tile content changed after Back (${Math.round(shared * 100)}% same)`); } }
    log({ tile: t.cls, label: it.label, href: it.href, landed: `${kind} ${L.path.slice(0, 50)}`, ok: !issues.length, note: issues.join("; ") });
    if (!atHome) { await loadHome(); }
  }
}
const bad = rows.filter((r) => !r.ok);
console.log(`\n${VP}: ${rows.length - bad.length}/${rows.length} ok, ${bad.length} FAIL`);
await h.close();
process.exit(bad.length ? 1 : 0);
