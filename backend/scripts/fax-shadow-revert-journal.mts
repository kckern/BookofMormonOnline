#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/** Restore exact pre-application rows from a single local shadow journal entry. */
import path from 'node:path';
import { openShadow, type ShadowGeometry } from './lib/fax-shadow-db.ts';

const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const sourceReport = path.resolve(flag('source-report'));
const keys = new Set(flag('only').split(',').map((value) => value.trim()).filter(Boolean));
if (!sourceReport || !keys.size) throw new Error('require --source-report and --only version:selector,...');

type Change = { version: string; selector: string; before_json: string; after_json: string };
const db = openShadow(shadowFile);
const rows = db.prepare(`
  SELECT version,selector,before_json,after_json FROM fax_shadow_changes
  WHERE source_report=?
`).all(sourceReport) as Change[];
const selected = rows.filter((row) => keys.has(`${row.version}:${row.selector}`));
if (selected.length !== keys.size) throw new Error('missing journal entry for requested restore');
const deleteRows = db.prepare('DELETE FROM bom_xtras_fax_index WHERE version=? AND verse_id=?');
const insert = db.prepare(`
  INSERT INTO bom_xtras_fax_index
    (uid,version,verse_id,page,pageWidth,pageScale,X,Y,W,H,TLW,TLH,BRW,BRH)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);
db.exec('BEGIN IMMEDIATE');
try {
  for (const change of selected) {
    const before = JSON.parse(change.before_json) as ShadowGeometry[];
    const after = JSON.parse(change.after_json) as ShadowGeometry[];
    const verseId = before[0]?.verseId ?? after[0]?.verseId;
    if (verseId == null || before.some((row) => row.verseId !== verseId) || after.some((row) => row.verseId !== verseId)) {
      throw new Error(`invalid journal geometry for ${change.version}/${change.selector}`);
    }
    deleteRows.run(change.version, verseId);
    for (const row of before) insert.run(
      row.uid,row.version,row.verseId,row.page,row.pageWidth,row.pageScale,
      row.X,row.Y,row.W,row.H,row.TLW,row.TLH,row.BRW,row.BRH,
    );
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally { db.close(); }
console.log(JSON.stringify({ restored: selected.map((row) => `${row.version}:${row.selector}`) }, null, 2));
