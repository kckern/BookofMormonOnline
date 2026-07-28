#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Apply accepted deterministic ownership proposals to the local shadow only.
 *
 * The complete current row set is guarded before any mutation. Every change is
 * recorded in fax_shadow_changes. This script never connects to MySQL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadShadowRows, openShadow, type ShadowGeometry } from './lib/fax-shadow-db.ts';

type ProposalGeometry = Omit<ShadowGeometry, 'uid'> & { uid: number | null };
type Proposal = {
  version: string;
  verseId: number;
  selector: string;
  outcome: string;
  currentRows: ProposalGeometry[];
  proposedRows?: ProposalGeometry[];
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const hasFlag = (name: string): boolean => argv.includes(`--${name}`);
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const reportFile = path.resolve(flag('report', ''));
const outputFile = path.resolve(flag(
  'out',
  '.shadow/last-apply-report.json',
));
const only = new Set(
  flag('only', '').split(',').map((value) => value.trim()).filter(Boolean),
);
const dryRun = hasFlag('dry-run');
if (!reportFile || !fs.existsSync(reportFile)) {
  throw new Error(`ownership report not found: ${reportFile}`);
}

const report = JSON.parse(fs.readFileSync(reportFile, 'utf8')) as {
  proposals: Proposal[];
};
const selected = report.proposals.filter((proposal) =>
  (!only.size || only.has(`${proposal.version}:${proposal.selector}`)) &&
  proposal.outcome.startsWith('ACCEPTED_'));
if (!selected.length) throw new Error('no accepted proposals selected');
if (only.size && selected.length !== only.size) {
  const found = new Set(selected.map((proposal) => `${proposal.version}:${proposal.selector}`));
  throw new Error(
    `selected target(s) missing or not accepted: ${
      [...only].filter((value) => !found.has(value)).join(', ')
    }`,
  );
}

const geometryFields: Array<keyof Omit<ShadowGeometry, 'uid'>> = [
  'version', 'verseId', 'page', 'pageWidth', 'pageScale',
  'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH',
];
const same = (
  left: ProposalGeometry | ShadowGeometry,
  right: ProposalGeometry | ShadowGeometry,
): boolean =>
  left.uid === right.uid &&
  geometryFields.every((field) => left[field] === right[field]);
const validGeometry = (row: ProposalGeometry): boolean =>
  row.W > 0 && row.H > 0 && row.X >= 0 && row.Y >= 0 &&
  row.X + row.W <= row.pageScale &&
  row.TLW >= 0 && row.TLW <= row.W && row.BRW >= 0 && row.BRW <= row.W &&
  row.TLH >= 0 && row.TLH <= row.H && row.BRH >= 0 && row.BRH <= row.H &&
  (row.TLW === 0) === (row.TLH === 0) &&
  (row.BRW === 0) === (row.BRH === 0);

const db = openShadow(shadowFile);
const update = db.prepare(`
  UPDATE bom_xtras_fax_index SET
    version=?,verse_id=?,page=?,pageWidth=?,pageScale=?,
    X=?,Y=?,W=?,H=?,TLW=?,TLH=?,BRW=?,BRH=?
  WHERE uid=?
`);
const remove = db.prepare('DELETE FROM bom_xtras_fax_index WHERE uid=?');
const insert = db.prepare(`
  INSERT INTO bom_xtras_fax_index
    (uid,version,verse_id,page,pageWidth,pageScale,X,Y,W,H,TLW,TLH,BRW,BRH)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);
const audit = db.prepare(`
  INSERT INTO fax_shadow_changes
    (applied_at,source_report,version,verse_id,selector,outcome,before_json,after_json)
  VALUES (?,?,?,?,?,?,?,?)
`);
let nextUid = Number((db.prepare(
  'SELECT COALESCE(MAX(uid),0)+1 AS next_uid FROM bom_xtras_fax_index',
).get() as { next_uid: unknown }).next_uid);
let updates = 0;
let deletes = 0;
let inserts = 0;
const application: Array<Record<string, unknown>> = [];

db.exec('BEGIN IMMEDIATE');
try {
  for (const proposal of selected) {
    const before = loadShadowRows(db, {
      versions: [proposal.version],
      verseIds: [proposal.verseId],
    });
    const expected = [...proposal.currentRows].sort((a, b) =>
      Number(a.uid) - Number(b.uid));
    const actual = [...before].sort((a, b) => a.uid - b.uid);
    if (expected.length !== actual.length ||
        expected.some((row, index) => !same(row, actual[index]!))) {
      throw new Error(
        `shadow guard failed for ${proposal.version}/${proposal.selector}`,
      );
    }
    const desired = (proposal.proposedRows ?? []).map((row) => ({ ...row }));
    if (!desired.length) {
      throw new Error(`empty proposal for ${proposal.version}/${proposal.selector}`);
    }
    if (desired.some((row) => !validGeometry(row))) {
      throw new Error(`invalid proposed geometry for ${proposal.version}/${proposal.selector}`);
    }
    const desiredExisting = new Set(
      desired.map((row) => row.uid).filter((uid): uid is number => uid != null),
    );
    for (const row of actual) {
      if (!desiredExisting.has(row.uid)) {
        remove.run(row.uid);
        deletes++;
      }
    }
    for (const row of desired) {
      if (row.uid == null) {
        row.uid = nextUid++;
        insert.run(
          row.uid, row.version, row.verseId, row.page, row.pageWidth, row.pageScale,
          row.X, row.Y, row.W, row.H, row.TLW, row.TLH, row.BRW, row.BRH,
        );
        inserts++;
      } else {
        const result = update.run(
          row.version, row.verseId, row.page, row.pageWidth, row.pageScale,
          row.X, row.Y, row.W, row.H, row.TLW, row.TLH, row.BRW, row.BRH, row.uid,
        );
        if (Number(result.changes) !== 1) {
          throw new Error(`missing update uid ${row.uid}`);
        }
        updates++;
      }
    }
    const after = loadShadowRows(db, {
      versions: [proposal.version],
      verseIds: [proposal.verseId],
    });
    const desiredSorted = [...desired].sort((a, b) => Number(a.uid) - Number(b.uid));
    const afterSorted = [...after].sort((a, b) => a.uid - b.uid);
    if (desiredSorted.length !== afterSorted.length ||
        desiredSorted.some((row, index) => !same(row, afterSorted[index]!))) {
      throw new Error(
        `shadow post-state failed for ${proposal.version}/${proposal.selector}`,
      );
    }
    const appliedAt = new Date().toISOString();
    audit.run(
      appliedAt,
      reportFile,
      proposal.version,
      proposal.verseId,
      proposal.selector,
      proposal.outcome,
      JSON.stringify(before),
      JSON.stringify(after),
    );
    application.push({
      version: proposal.version,
      selector: proposal.selector,
      verseId: proposal.verseId,
      outcome: proposal.outcome,
      beforeRows: before.length,
      afterRows: after.length,
    });
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
  reportFile,
  dryRun,
  selected: selected.length,
  updates,
  deletes,
  inserts,
  status: dryRun ? 'DRY_RUN_PASS' : 'APPLIED',
  application,
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ outputFile, ...result }, null, 2));
