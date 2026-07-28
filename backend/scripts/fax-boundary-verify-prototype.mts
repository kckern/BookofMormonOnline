#!/usr/bin/env npx tsx
/** Read-only optimistic-lock and geometry verifier for generated repair SQL. */
import fs from 'node:fs';
import { getDb, closeDb } from '../src/data/db.ts';

const files = process.argv.slice(2);
if (!files.length) throw new Error('usage: fax-boundary-verify-prototype.mts repair.sql [...]');
const updateRe = /UPDATE bom_xtras_fax_index SET TLW=(\d+), TLH=(\d+), BRW=(\d+), BRH=(\d+) WHERE version='([^']+)' AND verse_id=(\d+) AND page=(\d+) AND TLW=(\d+) AND TLH=(\d+) AND BRW=(\d+) AND BRH=(\d+);/g;
const deleteRe = /DELETE FROM bom_xtras_fax_index WHERE version='([^']+)' AND verse_id=(\d+) AND page=(\d+) AND TLW=(\d+) AND TLH=(\d+) AND BRW=(\d+) AND BRH=(\d+);/g;
const changes: any[] = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(updateRe)) changes.push({ file, kind: 'update', next: m.slice(1, 5).map(Number), key: `${m[5]}|${m[6]}|${m[7]}`, old: m.slice(8, 12).map(Number) });
  for (const m of text.matchAll(deleteRe)) changes.push({ file, kind: 'delete', key: `${m[1]}|${m[2]}|${m[3]}`, old: m.slice(4, 8).map(Number) });
}
const db = getDb();
const rows = await db.selectFrom('bom_xtras_fax_index')
  .select(['version','verse_id','page','W','H','TLW','TLH','BRW','BRH'])
  .where('version', 'in', [...new Set(changes.map((c) => c.key.split('|')[0]))])
  .execute();
await closeDb();
const actual = new Map<string, any>();
for (const r of rows as any[]) actual.set(`${r.version}|${Number(r.verse_id)}|${Number(r.page)}`, r);
const stale: any[] = [], badNext: any[] = [];
for (const c of changes) {
  const r = actual.get(c.key);
  const now = r ? [Number(r.TLW), Number(r.TLH), Number(r.BRW), Number(r.BRH)] : null;
  if (!r || now!.join(',') !== c.old.join(',')) stale.push({ key: c.key, kind: c.kind, expectedOld: c.old, actual: now });
  if (c.kind === 'update') {
    const [tlw, tlh, brw, brh] = c.next;
    if (r && (tlw < 0 || tlh < 0 || brw < 0 || brh < 0 || tlw > Number(r.W) || brw > Number(r.W) || tlh > Number(r.H) || brh > Number(r.H))) {
      badNext.push({ key: c.key, next: c.next, W: Number(r.W), H: Number(r.H) });
    }
  }
}
const result = { files, statements: changes.length, updates: changes.filter((c) => c.kind === 'update').length, deletes: changes.filter((c) => c.kind === 'delete').length, stalePredicates: stale.length, badNextGeometry: badNext.length, stale: stale.slice(0, 10), badNext: badNext.slice(0, 10) };
console.log(JSON.stringify(result, null, 2));
if (stale.length || badNext.length) process.exit(1);
