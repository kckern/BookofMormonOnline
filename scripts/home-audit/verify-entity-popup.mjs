// Tile → entity popup → Back / Full page → back control, on desktop and phone (prod 2026-10-20 regression).
// Usage: BASE=http://localhost:8201 node scripts/home-audit/verify-entity-popup.mjs
const { open } = await import(new URL("./tileharness.mjs", import.meta.url).href);
let fails = 0;
for (const vp of ["desktop", "phone"]) {
  const phone = vp === "phone";
  const h = await open(vp, "popup-" + vp);
  const p = h.page;
  const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  const path = () => new URL(p.url()).pathname;
  const home = async () => { await h.home(); };
  const find = async (sel) => { let n = 0; while (!(await p.locator(sel).count()) && n++ < 30) { await p.mouse.move(phone ? 200 : 700, 500); await p.mouse.wheel(0, 1000); await p.waitForTimeout(450); } return p.locator(sel).first(); };
  const popupOpen = () => p.evaluate(() => !!document.querySelector("#popUp, .mobileDrawer, [class*=Drawer], [class*=popUp]"));
  const ok = (c, m) => { if (!c) fails++; console.log(`${c ? "ok  " : "FAIL"} ${vp} ${m}`); };
  for (const [name, sel, re] of [["place tile", ".tile-places a[href^='/places/']", /^\/places\//], ["person tile", ".tile-people a[href^='/people/']", /^\/people\//], ["matter tile", ".tile-mattersConcept a[href^='/matters/']:not([href='/matters/concepts']):not([href='/matters/material']):not([href='/matters/narrative'])", /^\/matters\//]]) {
    await home();
    const l = await find(sel);
    if (!(await l.count())) { console.log("skip", vp, name, "(not rendered)"); continue; }
    await l.scrollIntoViewIfNeeded(); const y = await p.evaluate(() => scrollY);
    await l.click(); await p.waitForTimeout(2500);
    ok(re.test(path()), `${name}: URL is the entity URL (${path()})`);
    ok(await p.locator(".tile").count() > 3, `${name}: Home tiles still mounted behind the popup`);
    ok(await popupOpen(), `${name}: popup/drawer is open`);
    const shown = await p.evaluate(() => { const d = document.querySelector("#popUp, .popupDrawer"); return d ? d.innerText.replace(/\s+/g, " ").trim().slice(0, 70) : ""; });
    ok(shown.length > 25 && !/^(matters|places|people)$/i.test(shown), `${name}: popup has real content ("${shown.slice(0, 50)}")`);
    ok(Math.abs((await p.evaluate(() => scrollY)) - y) < 400, `${name}: Home scroll not reset`);
    await p.goBack(); await p.waitForTimeout(2500);
    ok(path() === "/home/discover" || path() === "/home", `${name}: Back → Home (${path()})`);
    ok(!(await p.locator("#popUp:visible").count()), `${name}: popup closed after Back`);
  }
  // popup → Maximize → page → its back control → Home
  await home(); const l = await find(".tile-places a[href^='/places/']"); await l.scrollIntoViewIfNeeded(); await l.click(); await p.waitForTimeout(2500);
  const max = p.locator(".maximize, .drawerEntityFull").first();
  if (await max.count()) {
    await max.click(); await p.waitForTimeout(3000);
    ok(await p.locator(".entity-page").count() > 0, "Maximize → full page");
    await p.locator(".entity-page-crumb button, .entity-page-crumb a").first().click(); await p.waitForTimeout(3000);
    ok(/^\/home/.test(path()), `page's back control → Home, not /places (${path()})`);
  } else console.log("skip maximize: control not found");
  ok(errs.length === 0, `no page errors ${errs.join(" | ")}`);
  await h.close();
}
 console.log(fails ? `${fails} FAILURES` : "ALL OK"); process.exit(fails ? 1 : 0);
