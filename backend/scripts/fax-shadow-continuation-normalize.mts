#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Remove interior continuation notches that the renderer never consumes.
 *
 * Crop rendering uses only the first fragment's TL notch and the final
 * fragment's BR notch. Page rendering uses no notch masks. Therefore a TL/BR
 * notch on the interior side of a page/column continuation is provably
 * render-equivalent dead data and can be normalized to zero.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  loadShadowRows,
  openShadow,
} from './lib/fax-shadow-db.ts';

type Finding = {
  code: string;
  uid?: number;
  version: string;
  verseId?: number;
};
const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const dryRun = argv.includes('--dry-run');
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const auditFile = path.resolve(flag('audit'));
const outputFile = path.resolve(flag(
  'out',
  '.shadow/continuation-normalization-report.json',
));
if (!fs.existsSync(auditFile)) throw new Error(`audit not found: ${auditFile}`);
const auditReport = JSON.parse(fs.readFileSync(auditFile, 'utf8')) as {
  findings: Finding[];
};
const targets = auditReport.findings
  .filter((finding) =>
    finding.uid != null &&
    [
      'TL_NOTCH_AT_PAGE_CONTINUATION',
      'TL_NOTCH_AT_COLUMN_CONTINUATION',
      'BR_NOTCH_AT_PAGE_CONTINUATION',
      'BR_NOTCH_AT_COLUMN_CONTINUATION',
    ].includes(finding.code))
  .map((finding) => ({
    uid: finding.uid!,
    version: finding.version,
    verseId: finding.verseId!,
    side: finding.code.startsWith('TL_') ? 'TL' as const : 'BR' as const,
    code: finding.code,
  }));
const uniqueTargets = new Map(
  targets.map((target) => [`${target.uid}|${target.side}`, target]),
);
const db = openShadow(shadowFile);
const lookup = db.prepare(`
  SELECT uid,version,verse_id,TLW,TLH,BRW,BRH
  FROM bom_xtras_fax_index WHERE uid=?
`);
const zeroTl = db.prepare(`
  UPDATE bom_xtras_fax_index SET TLW=0,TLH=0 WHERE uid=?
`);
const zeroBr = db.prepare(`
  UPDATE bom_xtras_fax_index SET BRW=0,BRH=0 WHERE uid=?
`);
const changeAudit = db.prepare(`
  INSERT INTO fax_shadow_changes
    (applied_at,source_report,version,verse_id,selector,outcome,before_json,after_json)
  VALUES (?,?,?,?,?,?,?,?)
`);
const affected = new Map<string, { version: string; verseId: number }>();
for (const target of uniqueTargets.values()) {
  affected.set(`${target.version}|${target.verseId}`, {
    version: target.version,
    verseId: target.verseId,
  });
}
const before = new Map([...affected].map(([key, pair]) => [
  key,
  loadShadowRows(db, { versions: [pair.version], verseIds: [pair.verseId] }),
]));
let zeroedTl = 0;
let zeroedBr = 0;
db.exec('BEGIN IMMEDIATE');
try {
  for (const target of uniqueTargets.values()) {
    const row = lookup.get(target.uid) as {
      uid: unknown;
      version: unknown;
      verse_id: unknown;
      TLW: unknown;
      TLH: unknown;
      BRW: unknown;
      BRH: unknown;
    } | undefined;
    if (!row ||
        String(row.version) !== target.version ||
        Number(row.verse_id) !== target.verseId) {
      throw new Error(`continuation guard failed for uid ${target.uid}`);
    }
    if (target.side === 'TL') {
      if (Number(row.TLW) <= 0 || Number(row.TLH) <= 0) {
        throw new Error(`TL continuation is no longer active for uid ${target.uid}`);
      }
      zeroTl.run(target.uid);
      zeroedTl++;
    } else {
      if (Number(row.BRW) <= 0 || Number(row.BRH) <= 0) {
        throw new Error(`BR continuation is no longer active for uid ${target.uid}`);
      }
      zeroBr.run(target.uid);
      zeroedBr++;
    }
  }
  for (const [key, pair] of affected) {
    const after = loadShadowRows(db, {
      versions: [pair.version],
      verseIds: [pair.verseId],
    });
    changeAudit.run(
      new Date().toISOString(),
      auditFile,
      pair.version,
      pair.verseId,
      `ids/${pair.verseId}`,
      'RENDER_EQUIVALENT_CONTINUATION_NOTCH_NORMALIZATION',
      JSON.stringify(before.get(key)),
      JSON.stringify(after),
    );
  }
  if (dryRun) db.exec('ROLLBACK');
  else db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  db.close();
  throw error;
}
db.close();
const result = {
  generatedAt: new Date().toISOString(),
  shadowFile,
  auditFile,
  dryRun,
  targets: uniqueTargets.size,
  affectedVerses: affected.size,
  zeroedTl,
  zeroedBr,
  status: dryRun ? 'DRY_RUN_PASS' : 'APPLIED',
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ outputFile, ...result }, null, 2));
