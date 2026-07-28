#!/usr/bin/env npx tsx
/**
 * Export a guarded MySQL transaction from an immutable shadow baseline and an
 * independently verified candidate.  No historical proposal report is used:
 * the emitted delta is exactly the current baseline-to-candidate difference.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadShadowRows, openShadow, type ShadowGeometry } from './lib/fax-shadow-db.ts';

const argv = process.argv.slice(2);
const flag = (name: string, fallback?: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const baselineFile = path.resolve(flag('baseline') ?? '');
const candidateFile = path.resolve(flag('candidate') ?? '');
const outputFile = path.resolve(flag('out') ?? '../docs/sql/fax-geometry-recovery.sql');
const manifestFile = path.resolve(flag('manifest') ?? `${outputFile}.manifest.json`);
if (!fs.existsSync(baselineFile) || !fs.existsSync(candidateFile)) {
  throw new Error('--baseline and --candidate must name existing SQLite files');
}

type Row = ShadowGeometry;
const fields = ['version', 'verseId', 'page', 'pageWidth', 'pageScale', 'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH'] as const;
const geometry = (row: Row): string => fields.map((field) => String(row[field])).join('|');
const verseKey = (row: Row): string => `${row.version}|${row.verseId}`;
const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`;
const valid = (row: Row): boolean => row.W > 0 && row.H > 0 && row.X >= 0 && row.Y >= 0 &&
  row.X + row.W <= row.pageScale && row.TLW >= 0 && row.TLW <= row.W &&
  row.BRW >= 0 && row.BRW <= row.W && row.TLH >= 0 && row.TLH <= row.H &&
  row.BRH >= 0 && row.BRH <= row.H && (row.TLW === 0) === (row.TLH === 0) &&
  (row.BRW === 0) === (row.BRH === 0);
const sorted = (rows: Row[]) => [...rows].sort((a, b) => a.uid - b.uid);
const group = (rows: Row[]) => {
  const map = new Map<string, Row[]>();
  for (const row of rows) map.set(verseKey(row), [...(map.get(verseKey(row)) ?? []), row]);
  return map;
};
const sameSet = (left: Row[], right: Row[]): boolean =>
  left.length === right.length && sorted(left).every((row, index) =>
    row.uid === sorted(right)[index]!.uid && geometry(row) === geometry(sorted(right)[index]!));

const baselineDb = openShadow(baselineFile, { queryOnly: true });
const candidateDb = openShadow(candidateFile, { queryOnly: true });
const baseline = loadShadowRows(baselineDb);
const candidate = loadShadowRows(candidateDb);
baselineDb.close(); candidateDb.close();
const oldByVerse = group(baseline);
const newByVerse = group(candidate);
const keys = [...new Set([...oldByVerse.keys(), ...newByVerse.keys()])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const changes = keys.map((key) => ({ key, old: oldByVerse.get(key) ?? [], next: newByVerse.get(key) ?? [] }))
  .filter(({ old, next }) => !sameSet(old, next));
if (!changes.length) throw new Error('baseline and candidate are identical; refusing empty export');
// Baseline rows may be malformed: repairing those rows is one reason this
// export exists.  They remain exact guard preconditions; only the desired
// candidate state must satisfy the current geometry invariants.
for (const change of changes) for (const row of change.next) {
  if (!valid(row)) throw new Error(`invalid candidate geometry in ${verseKey(row)} uid=${row.uid}`);
}

type Expected = Row;
type Desired = Row & { sourceUid: number | null; changed: boolean };
const expected: Expected[] = changes.flatMap((change) => change.old);
const desired: Desired[] = changes.flatMap((change) => {
  const oldByUid = new Map(change.old.map((row) => [row.uid, row]));
  return change.next.map((row) => ({ ...row, sourceUid: oldByUid.has(row.uid) ? row.uid : null,
    changed: oldByUid.has(row.uid) && geometry(oldByUid.get(row.uid)!) !== geometry(row) }));
});
const oldUids = new Set(expected.map((row) => row.uid));
const retainedUids = new Set(desired.map((row) => row.sourceUid).filter((uid): uid is number => uid != null));
const updates = desired.filter((row) => row.sourceUid != null && row.changed);
const deletes = expected.filter((row) => !retainedUids.has(row.uid));
const inserts = desired.filter((row) => row.sourceUid == null);
const affected = changes.map(({ key }) => { const [version, verseId] = key.split('|'); return { version: version!, verseId: Number(verseId) }; });
if (new Set(expected.map((row) => row.uid)).size !== expected.length) throw new Error('duplicate baseline uid');
if (new Set(desired.map((row) => row.sourceUid).filter(Boolean)).size !== retainedUids.size) throw new Error('duplicate retained uid');
if (desired.some((row) => row.sourceUid != null && !oldUids.has(row.sourceUid))) throw new Error('unknown retained uid');

const oldValue = (row: Row) => `(${row.uid},${quote(row.version)},${row.verseId},${row.page},${row.pageWidth},${row.pageScale},${row.X},${row.Y},${row.W},${row.H},${row.TLW},${row.TLH},${row.BRW},${row.BRH})`;
const desiredValue = (row: Desired, id: number) => `(${id},${row.sourceUid ?? 'NULL'},${quote(row.version)},${row.verseId},${row.page},${row.pageWidth},${row.pageScale},${row.X},${row.Y},${row.W},${row.H},${row.TLW},${row.TLH},${row.BRW},${row.BRH},${row.changed ? 1 : 0})`;
const sql = [
  '-- GENERATED FILE. Do not hand edit; regenerate from sealed baseline + candidate.',
  `-- Changed verses: ${changes.length}; old rows: ${expected.length}; desired rows: ${desired.length}.`,
  `-- Operations: ${updates.length} updates, ${deletes.length} deletes, ${inserts.length} inserts.`,
  '-- Temporary staging is deliberately outside the transaction: it does not touch production rows.',
  '-- The short transaction below contains only guard reads and mutations.',
  'CREATE TEMPORARY TABLE fax_recovery_affected (version VARCHAR(32) NOT NULL, verse_id INT NOT NULL, PRIMARY KEY(version,verse_id));',
  `INSERT INTO fax_recovery_affected VALUES\n${affected.map((row) => `(${quote(row.version)},${row.verseId})`).join(',\n')};`,
  'CREATE TEMPORARY TABLE fax_recovery_expected (uid BIGINT NOT NULL PRIMARY KEY,version VARCHAR(32) NOT NULL,verse_id INT NOT NULL,page INT NOT NULL,pageWidth INT NOT NULL,pageScale INT NOT NULL,X INT NOT NULL,Y INT NOT NULL,W INT NOT NULL,H INT NOT NULL,TLW INT NOT NULL,TLH INT NOT NULL,BRW INT NOT NULL,BRH INT NOT NULL);',
  `INSERT INTO fax_recovery_expected VALUES\n${expected.map(oldValue).join(',\n')};`,
  'CREATE TEMPORARY TABLE fax_recovery_desired (id INT NOT NULL PRIMARY KEY,source_uid BIGINT NULL UNIQUE,version VARCHAR(32) NOT NULL,verse_id INT NOT NULL,page INT NOT NULL,pageWidth INT NOT NULL,pageScale INT NOT NULL,X INT NOT NULL,Y INT NOT NULL,W INT NOT NULL,H INT NOT NULL,TLW INT NOT NULL,TLH INT NOT NULL,BRW INT NOT NULL,BRH INT NOT NULL,changed TINYINT NOT NULL);',
  `INSERT INTO fax_recovery_desired VALUES\n${desired.map(desiredValue).join(',\n')};`,
  'SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;',
  'SET SESSION innodb_lock_wait_timeout=300;',
  'START TRANSACTION;',
  `SET @expected=${expected.length};`,
  'SET @matched=(SELECT COUNT(*) FROM fax_recovery_expected e JOIN bom_xtras_fax_index i ON i.uid=e.uid AND i.version=e.version AND i.verse_id=e.verse_id AND i.page=e.page AND i.pageWidth=e.pageWidth AND i.pageScale=e.pageScale AND i.X=e.X AND i.Y=e.Y AND i.W=e.W AND i.H=e.H AND i.TLW=e.TLW AND i.TLH=e.TLH AND i.BRW=e.BRW AND i.BRH=e.BRH);',
  'SET @actual=(SELECT COUNT(*) FROM bom_xtras_fax_index i JOIN fax_recovery_affected a ON a.version=i.version AND a.verse_id=i.verse_id);',
  'SET @guard_ok=(@matched=@expected AND @actual=@expected);',
  'UPDATE bom_xtras_fax_index i JOIN fax_recovery_desired d ON d.source_uid=i.uid AND d.changed=1 SET i.version=d.version,i.verse_id=d.verse_id,i.page=d.page,i.pageWidth=d.pageWidth,i.pageScale=d.pageScale,i.X=d.X,i.Y=d.Y,i.W=d.W,i.H=d.H,i.TLW=d.TLW,i.TLH=d.TLH,i.BRW=d.BRW,i.BRH=d.BRH WHERE @guard_ok=1;',
  'SET @updates=ROW_COUNT();',
  'DELETE i FROM bom_xtras_fax_index i JOIN fax_recovery_expected e ON e.uid=i.uid LEFT JOIN fax_recovery_desired d ON d.source_uid=i.uid WHERE d.id IS NULL AND @guard_ok=1;',
  'SET @deletes=ROW_COUNT();',
  'INSERT INTO bom_xtras_fax_index (version,verse_id,page,pageWidth,pageScale,X,Y,W,H,TLW,TLH,BRW,BRH) SELECT version,verse_id,page,pageWidth,pageScale,X,Y,W,H,TLW,TLH,BRW,BRH FROM fax_recovery_desired WHERE source_uid IS NULL AND @guard_ok=1;',
  'SET @inserts=ROW_COUNT();',
  `SET @post_actual=(SELECT COUNT(*) FROM bom_xtras_fax_index i JOIN fax_recovery_affected a ON a.version=i.version AND a.verse_id=i.verse_id);`,
  'SET @post_matched=(SELECT COUNT(*) FROM fax_recovery_desired d JOIN bom_xtras_fax_index i ON i.version=d.version AND i.verse_id=d.verse_id AND i.page=d.page AND i.pageWidth=d.pageWidth AND i.pageScale=d.pageScale AND i.X=d.X AND i.Y=d.Y AND i.W=d.W AND i.H=d.H AND i.TLW=d.TLW AND i.TLH=d.TLH AND i.BRW=d.BRW AND i.BRH=d.BRH);',
  `SET @post_ok=(@guard_ok=1 AND @updates=${updates.length} AND @deletes=${deletes.length} AND @inserts=${inserts.length} AND @post_actual=${desired.length} AND @post_matched=${desired.length});`,
  "SET @finish=IF(@post_ok=1,'COMMIT','ROLLBACK'); PREPARE finish FROM @finish; EXECUTE finish; DEALLOCATE PREPARE finish;",
  'SELECT @guard_ok AS guard_ok,@post_ok AS committed,@expected AS expected_old_rows,@matched AS matched_old_rows,@actual AS actual_old_rows,@updates AS updates_applied,@deletes AS deletes_applied,@inserts AS inserts_applied,@post_actual AS checked_final_rows,@post_matched AS matched_final_rows;',
].join('\n') + '\n';
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, sql);
const manifest = { generatedAt: new Date().toISOString(), baselineFile, candidateFile, outputFile, changedVerses: changes.length, expectedRows: expected.length, desiredRows: desired.length, updates: updates.length, deletes: deletes.length, inserts: inserts.length, affected };
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
