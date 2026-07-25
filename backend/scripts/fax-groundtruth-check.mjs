/**
 * fax-groundtruth-check.mjs — render verse crops across editions and lay them out
 * side-by-side against a known-good control, so a human (or later, OCR) can confirm
 * the RIGHT physical page is being cropped for each edition.
 *
 * This is the acceptance harness for the fax box-data remediation. The DOM-overlay
 * hotspot count only proves index<->box consistency; this proves box<->scan ground
 * truth. See docs/plans/2026-07-25-fax-box-data-remediation.md.
 *
 * Usage (backend/ must be reachable at RENDER_BASE, default http://localhost:5006):
 *   node scripts/fax-groundtruth-check.mjs \
 *     --editions 1852,1854,1854l,1866,1871,1874,1877,1849,rebom,poetic \
 *     --control 1920 \
 *     --verses alma-52.20,1-nephi-11.18,3-nephi-11.10,moroni-10.4 \
 *     --out /tmp/fax-gt
 *
 * Emits <out>/<verse>__<edition>.jpg for every cell plus <out>/index.html, a grid
 * with the control column first. Wrong-page cells are obvious: the text differs
 * from the control. Re-run after a data fix to confirm the crops now match.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const RENDER_BASE = process.env.RENDER_BASE || 'http://localhost:5006';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const editions = arg('editions', '').split(',').map((s) => s.trim()).filter(Boolean);
const control = arg('control', '1920');
const verses = arg('verses', 'alma-52.20').split(',').map((s) => s.trim()).filter(Boolean);
const out = arg('out', '/tmp/fax-gt');
const width = arg('width', 'w800');

if (!editions.length) {
  console.error('usage: --editions a,b,c --verses ref1,ref2 [--control 1920] [--out dir]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const cols = [control, ...editions];
const cell = (v, e) => `${v.replace(/[^a-z0-9.-]/gi, '_')}__${e}.jpg`;

async function fetchCrop(edition, verse) {
  const url = `${RENDER_BASE}/fax/render/${edition}/crop/${width}/${verse}.jpg`;
  const r = await fetch(url).catch((e) => ({ ok: false, err: e.message }));
  if (!r.ok) return { ok: false, status: r.status ?? 0, url };
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(`${out}/${cell(verse, edition)}`, buf);
  return { ok: true, bytes: buf.length, url };
}

const results = [];
for (const v of verses) {
  for (const e of cols) {
    const res = await fetchCrop(e, v);
    results.push({ verse: v, edition: e, ...res });
    console.error(`${v}  ${e.padEnd(8)} ${res.ok ? `ok ${res.bytes}b` : `FAIL ${res.status ?? res.err}`}`);
  }
}

// Build a simple review grid: rows = verses, cols = control + editions.
const th = cols.map((e) => `<th>${e}${e === control ? ' (control)' : ''}</th>`).join('');
const rowsHtml = verses.map((v) => {
  const tds = cols.map((e) => {
    const r = results.find((x) => x.verse === v && x.edition === e);
    return r?.ok
      ? `<td><img src="${cell(v, e)}" loading="lazy"></td>`
      : `<td class="fail">render ${r?.status ?? 'err'}</td>`;
  }).join('');
  return `<tr><th class="ref">${v}</th>${tds}</tr>`;
}).join('');

writeFileSync(`${out}/index.html`, `<!doctype html><meta charset=utf8>
<title>fax ground-truth: ${verses.length} verses x ${cols.length} editions</title>
<style>
 body{font:13px system-ui;margin:16px;background:#fafafa}
 table{border-collapse:collapse} td,th{border:1px solid #ccc;padding:4px;vertical-align:top}
 th{background:#eee;position:sticky;top:0} th.ref{writing-mode:vertical-rl;font-size:11px}
 img{max-width:340px;display:block} td.fail{color:#b00;background:#fee;font-weight:bold}
 caption{text-align:left;font-weight:bold;margin-bottom:8px}
</style>
<table><caption>Each cell should show the SAME verse text as the control column. A different passage = wrong page (box-data mismap).</caption>
<tr><th></th>${th}</tr>${rowsHtml}</table>`);

const fails = results.filter((r) => !r.ok).length;
console.error(`\nwrote ${results.length - fails} crops + index.html to ${out}  (${fails} render failures)`);
console.error(`open: file://${out}/index.html`);
