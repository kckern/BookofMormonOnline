#!/usr/bin/env npx tsx
/** Emit an optimistic-locking repair SQL from the read-only audit report. */
import fs from 'node:fs';
import path from 'node:path';
import { getDb, closeDb } from '../src/data/db.ts';

const reportFile = process.argv[2];
const outFile = process.argv[3];
if (!reportFile || !outFile) throw new Error('usage: fax-boundary-remediate-prototype.mts audit.json forward.sql');

type DbRow = Record<string, number | string> & { verse_id: number; page: number; version: string };
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
const version = String(report.version);
const explicit = new Set(['33147|176', '36456|464', '32605|124']);
const stale = new Set(['31606|43', '31833|64']);
const structural = new Set([
  'FALSE_BR_PAGE_CONTINUATION_NOTCH',
  'FALSE_BR_LINE_END_NOTCH',
  'FALSE_TL_PAGE_CONTINUATION_NOTCH',
]);

const db = getDb();
const raw = await db.selectFrom('bom_xtras_fax_index')
  .select(['version','verse_id','page','pageWidth','pageScale','X','Y','W','H','TLW','TLH','BRW','BRH'])
  .where('version', '=', version)
  .execute();
await closeDb();
const rows = new Map<string, DbRow>();
for (const r of raw as any[]) rows.set(`${Number(r.verse_id)}|${Number(r.page)}`, {
  version, verse_id: Number(r.verse_id), page: Number(r.page),
  pageWidth: Number(r.pageWidth), pageScale: Number(r.pageScale),
  X: Number(r.X), Y: Number(r.Y), W: Number(r.W), H: Number(r.H),
  TLW: Number(r.TLW), TLH: Number(r.TLH), BRW: Number(r.BRW), BRH: Number(r.BRH),
});

const changes = new Map<string, { old: DbRow; next: DbRow; reasons: string[] }>();
for (const f of report.findings as any[]) {
  const key = `${f.verseId}|${f.page}`;
  const old = rows.get(key);
  if (!old) continue;
  const reasons: string[] = [];
  const next = { ...old };
  for (const code of f.flags ?? []) {
    const evidence = f.evidence ?? {};
    const isTl = code.startsWith('TL_');
    const isBr = code.startsWith('BR_');
    const residual = Number(evidence[isTl ? 'tlResidualPx' : 'brResidualPx'] ?? 0);
    const ink = Number(evidence[isTl ? 'tlCurrentInk' : 'brCurrentInk'] ?? 0);
    const safeStructural = structural.has(code);
    const explicitBoundary = explicit.has(key) && (isTl || isBr);
    const grossBoundary = (isTl || isBr) && (ink >= 0.25 || residual >= 40);
    if (!(safeStructural || explicitBoundary || grossBoundary)) continue;
    if (isTl && (old.TLH > 0 || safeStructural)) {
      next.TLW = code === 'FALSE_TL_PAGE_CONTINUATION_NOTCH' ? 0 : Number(f.proposals?.TLW ?? next.TLW);
      next.TLH = next.TLW === 0 ? 0 : next.TLH;
    }
    if (isBr && (old.BRH > 0 || safeStructural)) {
      next.BRW = safeStructural ? 0 : Number(f.proposals?.BRW ?? next.BRW);
      next.BRH = next.BRW === 0 ? 0 : next.BRH;
    }
    reasons.push(code);
  }
  if (next.TLW !== old.TLW || next.TLH !== old.TLH || next.BRW !== old.BRW || next.BRH !== old.BRH) {
    changes.set(key, { old, next, reasons: [...new Set(reasons)] });
  }
}

const deleted = [...stale].map((key) => rows.get(key)).filter(Boolean) as DbRow[];
const cols = ['version','verse_id','page','pageWidth','pageScale','X','Y','W','H','TLW','TLH','BRW','BRH'];
const vals = (r: DbRow) => `('${r.version}', ${r.verse_id}, ${r.page}, ${r.pageWidth}, ${r.pageScale}, ${r.X}, ${r.Y}, ${r.W}, ${r.H}, ${r.TLW}, ${r.TLH}, ${r.BRW}, ${r.BRH})`;
const whereOld = (r: DbRow) => `version='${r.version}' AND verse_id=${r.verse_id} AND page=${r.page} AND TLW=${r.TLW} AND TLH=${r.TLH} AND BRW=${r.BRW} AND BRH=${r.BRH}`;
const esc = (s: string) => s.replaceAll("'", "''");
const updates = [...changes.values()];
const forward: string[] = [
  '-- Deterministic fax boundary repair; generated from a read-only OCR/pixel audit.',
  `-- Version ${version}; ${updates.length} notch updates; ${deleted.length} stale continuation rows removed.`,
  '-- Optimistic old-value predicates prevent overwriting concurrent changes.',
  'START TRANSACTION;',
];
for (const { old, next, reasons } of updates) {
  forward.push(`-- ${old.verse_id}/${old.page}: ${reasons.join(', ')}`);
  forward.push(`UPDATE bom_xtras_fax_index SET TLW=${next.TLW}, TLH=${next.TLH}, BRW=${next.BRW}, BRH=${next.BRH} WHERE ${whereOld(old)};`);
}
for (const row of deleted) {
  forward.push(`-- stale continuation fragment ${row.verse_id}/${row.page}`);
  forward.push(`DELETE FROM bom_xtras_fax_index WHERE ${whereOld(row)};`);
}
forward.push('COMMIT;', '');

const rollback: string[] = [
  '-- Rollback for fax-boundary repair.',
  'START TRANSACTION;',
];
for (const { old, next, reasons } of updates) {
  rollback.push(`-- ${old.verse_id}/${old.page}: ${reasons.join(', ')}`);
  rollback.push(`UPDATE bom_xtras_fax_index SET TLW=${old.TLW}, TLH=${old.TLH}, BRW=${old.BRW}, BRH=${old.BRH} WHERE ${whereOld(next)};`);
}
if (deleted.length) {
  rollback.push(`INSERT INTO bom_xtras_fax_index (${cols.join(', ')}) VALUES`);
  rollback.push(`${deleted.map(vals).join(',\n')};`);
}
rollback.push('COMMIT;', '');

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, forward.join('\n'));
const rollbackFile = outFile.replace(/\.sql$/, '.rollback.sql');
fs.writeFileSync(rollbackFile, rollback.join('\n'));
console.log(JSON.stringify({ version, updates: updates.length, deletes: deleted.length, forward: outFile, rollback: rollbackFile }, null, 2));
