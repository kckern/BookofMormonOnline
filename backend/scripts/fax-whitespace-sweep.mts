#!/usr/bin/env npx tsx
/**
 * Page-level, LLM-free whitespace audit for fax geometry.
 *
 * It inspects every stored box edge against its own scan, using the edition's
 * stored-page -> image-file offset.  Only a clearly inked edge with a nearby,
 * materially cleaner whitespace band is emitted as a repair.  This catches
 * boundary cuts without copying geometry from another edition.
 *
 * Usage:
 *   npx tsx scripts/fax-whitespace-sweep.mts --all-nonseeds \
 *     --out ../docs/audits/fax-whitespace-nonseeds.json \
 *     --sql ../docs/sql/fax-whitespace-nonseeds.sql
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getDb, closeDb } from '../src/data/db.ts';

type Row = {
  uid: number; version: string; verseId: number; page: number; pageWidth: number;
  X: number; Y: number; W: number; H: number; TLW: number; TLH: number; BRW: number; BRH: number;
};
type Scan = { data: Buffer; width: number; height: number; ink: (v: number) => number };
type Change = { field: string; from: number; to: number; before: number; after: number };

const args = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const allNonseeds = args.includes('--all-nonseeds');
const requested = (flag('versions') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const media = flag('media', 'https://media.bookofmormon.online')!;
const reportFile = flag('out');
const sqlFile = flag('sql');
const pageConcurrency = Math.max(1, Number(flag('concurrency', '5')));
const seedVersions = new Set(['1842', '1849', '1852']);

async function pool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>) {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  }));
  return out;
}

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0;
}

function scanModel(data: Buffer, width: number, height: number): Scan {
  const sample: number[] = [];
  for (let i = 0; i < data.length; i += 997) sample.push(data[i]!);
  const black = percentile(sample, 0.12);
  const paper = percentile(sample, 0.88);
  const span = Math.max(1, paper - black);
  return { data, width, height, ink: (v) => Math.max(0, Math.min(1, (paper - v) / span)) };
}

function horizontalInk(scan: Scan, y: number, xa: number, xb: number) {
  const yy = Math.round(y);
  const lo = Math.max(0, Math.round(xa)), hi = Math.min(scan.width - 1, Math.round(xb));
  if (yy < 0 || yy >= scan.height || hi <= lo) return 1;
  let sum = 0, n = 0;
  for (let x = lo; x <= hi; x += 2) { sum += scan.ink(scan.data[yy * scan.width + x]!); n++; }
  return n ? sum / n : 1;
}

function verticalInk(scan: Scan, x: number, ya: number, yb: number) {
  const xx = Math.round(x);
  const lo = Math.max(0, Math.round(ya)), hi = Math.min(scan.height - 1, Math.round(yb));
  if (xx < 0 || xx >= scan.width || hi <= lo) return 1;
  let sum = 0, n = 0;
  for (let y = lo; y <= hi; y += 2) { sum += scan.ink(scan.data[y * scan.width + xx]!); n++; }
  return n ? sum / n : 1;
}

function bestHorizontal(scan: Scan, y: number, xa: number, xb: number, radius: number) {
  const before = horizontalInk(scan, y, xa, xb);
  let bestY = y, bestCost = before;
  for (let d = -radius; d <= radius; d++) {
    const ink = horizontalInk(scan, y + d, xa, xb);
    const cost = ink + Math.abs(d) * 0.0025;
    if (cost < bestCost) { bestCost = cost; bestY = y + d; }
  }
  return { before, after: horizontalInk(scan, bestY, xa, xb), delta: bestY - y };
}

function bestVertical(scan: Scan, x: number, ya: number, yb: number, radius: number) {
  const before = verticalInk(scan, x, ya, yb);
  let bestX = x, bestCost = before;
  for (let d = -radius; d <= radius; d++) {
    const ink = verticalInk(scan, x + d, ya, yb);
    const cost = ink + Math.abs(d) * 0.0015;
    if (cost < bestCost) { bestCost = cost; bestX = x + d; }
  }
  return { before, after: verticalInk(scan, bestX, ya, yb), delta: bestX - x };
}

// A repair must move off visible ink into a substantially cleaner band, and
// it must not be a large jump that is likely to cross a word boundary or jump
// past the true page/column edge.  This keeps the sweep conservative enough to
// avoid the over-snapping failures seen in QA.
function accept(r: { before: number; after: number; delta: number }, limit: number) {
  return r.delta !== 0 &&
    Math.abs(r.delta) <= limit &&
    r.before >= 0.14 &&
    r.after <= 0.065 &&
    r.before - r.after >= 0.085;
}

function roundStored(px: number, scale: number) { return Math.round(px / scale); }

function repairRow(row: Row, scan: Scan): { next: Row; changes: Change[] } {
  const k = scan.width / 700;
  const radiusH = Math.max(8, Math.round(11 * k));
  const radiusV = Math.max(12, Math.round(26 * k));
  let left = row.X * k, right = (row.X + row.W) * k;
  let top = row.Y * k, bottom = (row.Y + row.H) * k;
  let tlAbs = (row.X + row.TLW) * k, brAbs = (row.X + row.W - row.BRW) * k;
  let tlBottom = (row.Y + row.TLH) * k, brTop = (row.Y + row.H - row.BRH) * k;
  const changes: Change[] = [];
  const move = (field: string, from: number, to: number, r: { before: number; after: number }) => {
    if (from !== to) changes.push({ field, from, to, before: Number(r.before.toFixed(3)), after: Number(r.after.toFixed(3)) });
  };

  // Outer vertical margins.
  const leftResult = bestVertical(scan, left, top, bottom, radiusH);
  if (accept(leftResult, Math.max(6, Math.round(10 * k)))) {
    const prev = left;
    left += leftResult.delta;
    move('X', row.X, roundStored(left, k), leftResult);
  }
  const rightResult = bestVertical(scan, right, top, bottom, radiusH);
  if (accept(rightResult, Math.max(6, Math.round(10 * k)))) right += rightResult.delta;

  // Horizontal bands exclude neighboring-text corners when a notch exists.
  const topResult = bestHorizontal(scan, top, tlAbs, right, radiusH);
  if (accept(topResult, Math.max(6, Math.round(8 * k)))) {
    const prev = top;
    top += topResult.delta;
    tlBottom += topResult.delta;
    move('Y', row.Y, roundStored(top, k), topResult);
  }
  const bottomResult = bestHorizontal(scan, bottom, left, brAbs, radiusH);
  if (accept(bottomResult, Math.max(6, Math.round(8 * k)))) {
    bottom += bottomResult.delta;
    brTop += bottomResult.delta;
  }

  // Existing notch edges: snap only the intended word/line boundary, never
  // invent a notch from pixels alone (that needs textual ownership evidence).
  if (row.TLW > 1 && row.TLH > 0) {
    const r = bestVertical(scan, tlAbs, top, tlBottom, radiusV);
    if (accept(r, Math.max(5, Math.round(7 * k)))) {
      tlAbs += r.delta;
      move('TLW', row.TLW, roundStored(tlAbs - left, k), r);
    }
  }
  if (row.BRW > 1 && row.BRH > 0) {
    const r = bestVertical(scan, brAbs, brTop, bottom, radiusV);
    if (accept(r, Math.max(5, Math.round(7 * k)))) {
      brAbs += r.delta;
      move('BRW', row.BRW, roundStored(right - brAbs, k), r);
    }
  }

  const next = { ...row,
    X: roundStored(left, k),
    Y: roundStored(top, k),
    W: roundStored(right - left, k),
    H: roundStored(bottom - top, k),
    TLW: roundStored(tlAbs - left, k),
    TLH: roundStored(tlBottom - top, k),
    BRW: roundStored(right - brAbs, k),
    BRH: roundStored(bottom - brTop, k),
  };
  next.W = Math.max(1, next.W); next.H = Math.max(1, next.H);
  next.TLW = Math.max(0, Math.min(next.W, next.TLW)); next.BRW = Math.max(0, Math.min(next.W, next.BRW));
  next.TLH = Math.max(0, Math.min(next.H, next.TLH)); next.BRH = Math.max(0, Math.min(next.H, next.BRH));
  if (next.X !== row.X && !changes.some((c) => c.field === 'X')) changes.push({ field: 'X', from: row.X, to: next.X, before: leftResult.before, after: leftResult.after });
  if (next.W !== row.W) changes.push({ field: 'W', from: row.W, to: next.W, before: rightResult.before, after: rightResult.after });
  if (next.H !== row.H) changes.push({ field: 'H', from: row.H, to: next.H, before: bottomResult.before, after: bottomResult.after });
  if (next.TLH !== row.TLH) changes.push({ field: 'TLH', from: row.TLH, to: next.TLH, before: topResult.before, after: topResult.after });
  if (next.BRH !== row.BRH) changes.push({ field: 'BRH', from: row.BRH, to: next.BRH, before: bottomResult.before, after: bottomResult.after });
  return { next, changes };
}

function sameGeometry(a: Row, b: Row) {
  return ['X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH'].every((f) => a[f as keyof Row] === b[f as keyof Row]);
}

function whereOld(r: Row) {
  return `uid=${r.uid} AND version='${r.version}' AND verse_id=${r.verseId} AND page=${r.page}` +
    ` AND X=${r.X} AND Y=${r.Y} AND W=${r.W} AND H=${r.H}` +
    ` AND TLW=${r.TLW} AND TLH=${r.TLH} AND BRW=${r.BRW} AND BRH=${r.BRH}`;
}

async function main() {
  const db = getDb();
  const [rawRows, registryRows] = await Promise.all([
    db.selectFrom('bom_xtras_fax_index').select(['uid', 'version', 'verse_id', 'page', 'pageWidth', 'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH']).execute(),
    db.selectFrom('bom_xtras_fax').select(['slug', 'format', 'pgfirstVerse']).execute(),
  ]);
  await closeDb();
  const registry = new Map(registryRows.map((r: any) => [String(r.slug), { format: String(r.format || '').trim() || 'jpg', first: Number(r.pgfirstVerse ?? 1) }]));
  const allVersions = [...new Set(rawRows.map((r: any) => String(r.version)))].sort();
  const versions = requested.length ? requested : allNonseeds ? allVersions.filter((v) => !seedVersions.has(v)) : [];
  if (!versions.length) throw new Error('pass --versions a,b or --all-nonseeds');
  const reports: any[] = [];
  const repairs: { old: Row; next: Row; changes: Change[] }[] = [];

  for (const version of versions) {
    const rows: Row[] = rawRows.filter((r: any) => String(r.version) === version).map((r: any) => ({
      uid: Number(r.uid), version, verseId: Number(r.verse_id), page: Number(r.page), pageWidth: Number(r.pageWidth),
      X: Number(r.X), Y: Number(r.Y), W: Number(r.W), H: Number(r.H), TLW: Number(r.TLW), TLH: Number(r.TLH), BRW: Number(r.BRW), BRH: Number(r.BRH),
    }));
    const firstStored = Math.min(...rows.map((r) => r.page));
    const meta = registry.get(version) ?? { format: 'jpg', first: 1 };
    const offset = meta.first - firstStored;
    const byPage = new Map<number, Row[]>();
    for (const row of rows) (byPage.get(row.page) ?? byPage.set(row.page, []).get(row.page)!).push(row);
    let fetched = 0, failed = 0, candidates = 0;
    const pages = [...byPage.keys()].sort((a, b) => a - b);
    await pool(pages, pageConcurrency, async (page) => {
      const pageRows = byPage.get(page)!;
      const imagePage = page + offset;
      try {
        const res = await fetch(`${media}/fax/pages/${version}/${String(imagePage).padStart(3, '0')}.${meta.format}`, { signal: AbortSignal.timeout(25_000) });
        if (!res.ok) throw new Error(String(res.status));
        const width = pageRows[0]!.pageWidth;
        const raw = await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize({ width }).greyscale().raw().toBuffer({ resolveWithObject: true });
        const scan = scanModel(raw.data, raw.info.width, raw.info.height);
        fetched++;
        for (const row of pageRows) {
          const { next, changes } = repairRow(row, scan);
          if (!sameGeometry(row, next)) { repairs.push({ old: row, next, changes }); candidates++; }
        }
      } catch { failed++; }
    });
    reports.push({ version, rows: rows.length, storedPages: pages.length, imageOffset: offset, fetchedPages: fetched, failedPages: failed, candidates });
    console.log(JSON.stringify(reports.at(-1)));
  }

  repairs.sort((a, b) => a.old.version.localeCompare(b.old.version) || a.old.page - b.old.page || a.old.verseId - b.old.verseId);
  const report = { generatedAt: new Date().toISOString(), source: 'live DB + source scans; no OCR/LLM', seedVersions: [...seedVersions], versions: reports, repairCount: repairs.length, repairs };
  if (reportFile) { fs.mkdirSync(path.dirname(reportFile), { recursive: true }); fs.writeFileSync(reportFile, JSON.stringify(report, null, 2)); }
  if (sqlFile) {
    const lines = ['-- High-confidence scan-pixel whitespace repairs. Generated read-only; optimistic predicates prevent stale writes.', 'START TRANSACTION;'];
    for (const { old, next, changes } of repairs) {
      lines.push(`-- ${old.version} uid ${old.uid}, ${changes.map((c) => `${c.field}:${c.from}->${c.to}`).join(', ')}`);
      lines.push(`UPDATE bom_xtras_fax_index SET X=${next.X}, Y=${next.Y}, W=${next.W}, H=${next.H}, TLW=${next.TLW}, TLH=${next.TLH}, BRW=${next.BRW}, BRH=${next.BRH} WHERE ${whereOld(old)};`);
    }
    lines.push('COMMIT;', '');
    fs.mkdirSync(path.dirname(sqlFile), { recursive: true }); fs.writeFileSync(sqlFile, lines.join('\n'));
  }
  console.log(JSON.stringify({ reportFile, sqlFile, versions: reports.length, repairCount: repairs.length }));
}

await main();
