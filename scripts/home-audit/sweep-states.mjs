// Objective sweep of the states the main passes skip: tablet (820), desktop+dark, phone+dark.
// Prints per-state metrics and saves screenshots (gitignored). Usage: node sweep-states.mjs [state…]
const { open } = await import(new URL("./tileharness.mjs", import.meta.url).href);
const STATES = {
  tablet: { vp: "tablet", dark: false },
  "desktop-dark": { vp: "desktop", dark: true },
  "phone-dark": { vp: "phone", dark: true },
};
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STATES);
let findings = 0;
const note = (s) => { findings++; console.log("  ✗", s); };

for (const name of want) {
  const { vp, dark } = STATES[name];
  const h = await open(vp, `sweep-${name}`);
  const p = h.page;
  console.log(`\n== ${name}`);
  await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
  await h.home();
  if (dark) { await p.evaluate(() => document.documentElement.setAttribute("data-theme", "dark")); await p.waitForTimeout(600); }
  await h.shot("top");
  await p.mouse.move(vp === "phone" || vp === "tablet" ? 200 : 900, 500);
  for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, Math.round((await p.evaluate(() => innerHeight)) * 0.9)); await p.waitForTimeout(500); }
  await p.waitForTimeout(2500);
  await h.shot("deep");

  const m = await p.evaluate((isDark) => {
    const vh = innerHeight;
    const out = { overflow: document.documentElement.scrollWidth > innerWidth + 1, tall: [], broken: [], lowContrast: {} };
    for (const t of document.querySelectorAll(".sampler .tile")) {
      const r = t.getBoundingClientRect();
      if (r.height > vh * 1.5) out.tall.push([[...t.classList].find((c) => c.startsWith("tile-")), Math.round(r.height)]);
    }
    for (const i of document.querySelectorAll(".sampler img")) {
      const r = i.getBoundingClientRect();
      if (i.complete && i.naturalWidth === 0 && r.width > 0 && getComputedStyle(i).visibility !== "hidden") out.broken.push((i.currentSrc || i.src).replace(/^https?:\/\/[^/]+/, "").slice(0, 70));
    }
    if (isDark) {
      const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(",").map(parseFloat); return { c: [r, g, b], a }; };
      const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== "none") return null; const b = parse(s.backgroundColor); if (b && b.a > 0.9) return b.c; } return [255, 255, 255]; };
      let n = 0;
      for (const el of document.querySelectorAll(".sampler .tile p, .sampler .tile span, .sampler .tile a, .sampler .tile h3, .sampler .tile h4, .sampler .tile li")) {
        if (n > 500) break;
        if (![...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim().length > 2)) continue;
        const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
        const fg = parse(getComputedStyle(el).color); const bg = bgOf(el); if (!fg || !bg) continue;
        n++;
        const a = lum(fg.c), b = lum(bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (ratio < 4.5) { const k = [...el.closest(".tile").classList].find((c) => c.startsWith("tile-")); const w = out.lowContrast[k] || { n: 0, worst: 99 }; w.n++; w.worst = Math.min(w.worst, ratio); out.lowContrast[k] = w; }
      }
      out.sampled = n;
    }
    return out;
  }, dark);

  const cls = await p.evaluate(() => window.__cls);
  console.log(`  tiles ${await p.locator(".sampler .tile").count()} · CLS ${cls.toFixed(3)} · page errors ${h.errors.filter((e) => /^pageerror/.test(e)).length}`);
  if (m.overflow) note("horizontal overflow");
  for (const [k, hgt] of m.tall) note(`${k} is ${hgt}px tall (> 1.5 viewports)`);
  for (const s of m.broken.slice(0, 6)) note(`broken image ${s}`);
  for (const [k, v] of Object.entries(m.lowContrast)) note(`${k}: ${v.n} text nodes below 4.5:1 (worst ${v.worst.toFixed(1)}:1)`);
  if (dark) console.log(`  contrast sampled ${m.sampled} text nodes`);
  if (cls > 0.1) note(`CLS ${cls.toFixed(3)} > 0.1`);

  // keyboard focus visibility on the first 8 tabbable controls inside the sampler
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await p.locator(".sampler").first().focus().catch(() => {});
  let bare = 0;
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press("Tab");
    const f = await p.evaluate(() => { const a = document.activeElement; if (!a || !a.closest(".sampler")) return null; const s = getComputedStyle(a); return { tag: a.tagName, cls: String(a.className).slice(0, 30), out: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0, shadow: s.boxShadow !== "none" }; });
    if (f && !f.out && !f.shadow) { bare++; note(`no visible focus style on ${f.tag}.${f.cls}`); }
  }
  console.log(`  focus: ${bare} controls without a visible focus style (of up to 12 tabbed)`);
  await h.close();
}
console.log(`\n${findings} findings`);
process.exit(0);
