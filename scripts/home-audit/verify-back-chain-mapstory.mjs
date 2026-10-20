// Chained Backs through DIFFERENT links of the map-story tile (title, Explore
// CTA, Map eyebrow — two of them share an href). Each Back must put the link
// that was clicked back where it was. Usage: VP=phone node verify-back-chain-mapstory.mjs
const { open } = await import(new URL("./tileharness.mjs", import.meta.url).href);
const VP = process.env.VP || "desktop";
const TOL = Number(process.env.TOL || 40);
const h = await open(VP, "chain-mapstory");
const p = h.page;
await h.home();
if (!(await h.scrollUntil("tile-mapstory", 80))) { console.log("mapstory tile not rendered"); process.exit(2); }
await p.locator(".tile.tile-mapstory").first().scrollIntoViewIfNeeded();
await p.waitForTimeout(4000);

// the tile's distinct links: [label, href, text]
const links = await p.evaluate(() => {
  const t = document.querySelector(".tile.tile-mapstory");
  return [...t.querySelectorAll("a[href^='/']")].map((a) => ({ href: a.getAttribute("href"), text: (a.getAttribute("aria-label") || a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80) }))
    .filter((l, i, all) => all.findIndex((x) => x.href === l.href && x.text === l.text) === i);
});
const pick = (re) => links.find((l) => re.test(l.text) || re.test(l.href));
const title = links.find((l) => /\/story\//.test(l.href) && !/explore/i.test(l.text));
const explore = pick(/explore/i);
const eyebrow = links.find((l) => l.href === "/map") || pick(/^map$/i);
const seq = [title, explore, eyebrow, title, explore].filter(Boolean);
console.log("links:", seq.map((l) => `${l.text} → ${l.href}`).join(" | "));

const top = (l) => p.evaluate(({ href, text }) => {
  const t = document.querySelector(".tile.tile-mapstory");
  const a = t && [...t.querySelectorAll("a[href]")].find((x) => x.getAttribute("href") === href && (x.getAttribute("aria-label") || x.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80) === text);
  return a ? Math.round(a.getBoundingClientRect().top) : null;
}, l);
let fails = 0;
for (const [i, l] of seq.entries()) {
  // put the link at ~45% of the viewport
  await p.evaluate(({ href, text }) => {
    const t = document.querySelector(".tile.tile-mapstory");
    const a = [...t.querySelectorAll("a[href]")].find((x) => x.getAttribute("href") === href && (x.getAttribute("aria-label") || x.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80) === text);
    window.scrollBy({ top: a.getBoundingClientRect().top - innerHeight * 0.45, behavior: "instant" });
  }, l);
  await p.mouse.move(5, 5); await p.waitForTimeout(700);
  const before = await top(l);
  await p.evaluate(({ href, text }) => {
    const t = document.querySelector(".tile.tile-mapstory");
    [...t.querySelectorAll("a[href]")].find((x) => x.getAttribute("href") === href && (x.getAttribute("aria-label") || x.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80) === text).click();
  }, l);
  await p.waitForTimeout(3500);
  await p.goBack(); await p.waitForTimeout(4500);
  const after = await top(l);
  const d = after == null || before == null ? null : after - before;
  const ok = d != null && Math.abs(d) <= TOL;
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${VP} step ${i + 1} ${l.text.slice(0, 30)} → ${l.href}: before ${before} after ${after} Δ ${d}`);
}
console.log(`${VP}: ${seq.length - fails}/${seq.length} ok`);
await h.close();
process.exit(fails ? 1 : 0);
