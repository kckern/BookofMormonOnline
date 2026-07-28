#!/usr/bin/env npx tsx
import fs from 'node:fs';
import path from 'node:path';
import { getDb, closeDb } from '../src/data/db.ts';

const outFile = process.argv[2] ?? '../docs/sql/fax-boundary-repair-all-2026-07-26.sql';
const seedFile = '../docs/sql/fax-boundary-1852-safe-repair-2026-07-26.sql';
const baseFiles = [
  '../docs/sql/fax-boundary-1842-safe-repair-2026-07-26.sql',
  '../docs/sql/fax-boundary-1849-safe-repair-2026-07-26.sql',
  seedFile,
];
const derivatives = ['1854', '1854l', '1866', '1871', '1874', '1877'];
const updateRe = /UPDATE bom_xtras_fax_index SET TLW=(\d+), TLH=(\d+), BRW=(\d+), BRH=(\d+) WHERE version='([^']+)' AND verse_id=(\d+) AND page=(\d+) AND TLW=(\d+) AND TLH=(\d+) AND BRW=(\d+) AND BRH=(\d+);/g;
const deleteRe = /DELETE FROM bom_xtras_fax_index WHERE version='([^']+)' AND verse_id=(\d+) AND page=(\d+) AND TLW=(\d+) AND TLH=(\d+) AND BRW=(\d+) AND BRH=(\d+);/g;
const seedUpdates: any[] = [], seedDeletes: any[] = [];
for (const m of fs.readFileSync(seedFile, 'utf8').matchAll(updateRe)) seedUpdates.push({ next: m.slice(1, 5).map(Number), version: m[5], id: Number(m[6]), page: Number(m[7]), old: m.slice(8, 12).map(Number) });
for (const m of fs.readFileSync(seedFile, 'utf8').matchAll(deleteRe)) seedDeletes.push({ version: m[1], id: Number(m[2]), page: Number(m[3]), old: m.slice(4, 8).map(Number) });

const db = getDb();
const versions = ['1852', ...derivatives];
const raw = await db.selectFrom('bom_xtras_fax_index')
  .select(['version','verse_id','page','pageWidth','pageScale','X','Y','W','H','TLW','TLH','BRW','BRH'])
  .where('version', 'in', versions)
  .execute();
await closeDb();
const rows = new Map<string, any>();
for (const r of raw as any[]) rows.set(`${r.version}|${Number(r.verse_id)}|${Number(r.page)}`, { version: r.version, verse_id: Number(r.verse_id), page: Number(r.page), pageWidth: Number(r.pageWidth), pageScale: Number(r.pageScale), X: Number(r.X), Y: Number(r.Y), W: Number(r.W), H: Number(r.H), TLW: Number(r.TLW), TLH: Number(r.TLH), BRW: Number(r.BRW), BRH: Number(r.BRH) });
const seedRows = new Map<string, any>();
for (const r of raw as any[]) if (String(r.version) === '1852') seedRows.set(`${Number(r.verse_id)}|${Number(r.page)}`, rows.get(`1852|${Number(r.verse_id)}|${Number(r.page)}`));
const vals = (r: any) => `('${r.version}', ${r.verse_id}, ${r.page}, ${r.pageWidth}, ${r.pageScale}, ${r.X}, ${r.Y}, ${r.W}, ${r.H}, ${r.TLW}, ${r.TLH}, ${r.BRW}, ${r.BRH})`;
const whereOld = (r: any) => `version='${r.version}' AND verse_id=${r.verse_id} AND page=${r.page} AND TLW=${r.TLW} AND TLH=${r.TLH} AND BRW=${r.BRW} AND BRH=${r.BRH}`;
const derivativeUpdates: any[] = [], derivativeDeletes: any[] = [];
function scaled(width: number, seedWidth: number, targetWidth: number) { return Math.max(0, Math.min(Math.max(0, targetWidth - 1), Math.round(width * targetWidth / Math.max(1, seedWidth)))); }
for (const s of seedUpdates) {
  const seed = seedRows.get(`${s.id}|${s.page}`); if (!seed) continue;
  for (const v of derivatives) {
    const old = rows.get(`${v}|${s.id}|${s.page}`); if (!old) continue;
    const next = { ...old };
    next.TLW = s.next[0] === 0 ? 0 : scaled(s.next[0], seed.W, old.W);
    next.TLH = next.TLW === 0 ? 0 : (s.old[1] === 0 && s.next[1] > 0 ? scaled(s.next[1], seed.H, old.H) : old.TLH);
    next.BRW = s.next[2] === 0 ? 0 : scaled(s.next[2], seed.W, old.W);
    next.BRH = next.BRW === 0 ? 0 : (s.old[3] === 0 && s.next[3] > 0 ? scaled(s.next[3], seed.H, old.H) : old.BRH);
    if (next.TLW !== old.TLW || next.TLH !== old.TLH || next.BRW !== old.BRW || next.BRH !== old.BRH) derivativeUpdates.push({ old, next, source: `${s.id}/${s.page}` });
  }
}
for (const s of seedDeletes) for (const v of derivatives) { const row = rows.get(`${v}|${s.id}|${s.page}`); if (row) derivativeDeletes.push(row); }

const lines = [
  '-- Single transaction: OCR-backed seed repairs plus derivative-version propagation.',
  '-- Derivative nonzero notches are scaled to each stored band; no missing rows are fabricated.',
  '-- Run this file only after reviewing the companion rollback files if needed.',
  'START TRANSACTION;',
];
for (const file of baseFiles) {
  const text = fs.readFileSync(file, 'utf8').replace(/START TRANSACTION;|COMMIT;/g, '').trim();
  lines.push(`-- BEGIN ${path.basename(file)}`, text, `-- END ${path.basename(file)}`);
}
for (const { old, next, source } of derivativeUpdates) {
  lines.push(`-- derivative ${old.version} ${source}`);
  lines.push(`UPDATE bom_xtras_fax_index SET TLW=${next.TLW}, TLH=${next.TLH}, BRW=${next.BRW}, BRH=${next.BRH} WHERE ${whereOld(old)};`);
}
for (const row of derivativeDeletes) {
  lines.push(`-- derivative stale continuation ${row.version} ${row.verse_id}/${row.page}`);
  lines.push(`DELETE FROM bom_xtras_fax_index WHERE ${whereOld(row)};`);
}
lines.push('COMMIT;', '');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, lines.join('\n'));
console.log(JSON.stringify({ out: outFile, seedStatements: baseFiles.length, derivativeUpdates: derivativeUpdates.length, derivativeDeletes: derivativeDeletes.length, totalBytes: fs.statSync(outFile).size }, null, 2));
