#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Emit a guarded inverse of the latest shadow change for one verse.
 *
 * The actual mutation is still performed by fax-shadow-apply.mts, which checks
 * that the complete current row set equals the recorded post-state.
 */
import fs from 'node:fs';
import path from 'node:path';
import { openShadow, type ShadowGeometry } from './lib/fax-shadow-db.ts';

const argv = process.argv.slice(2);
const flag = (name: string): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : '';
};
const shadowFile = path.resolve(flag('shadow') || '.shadow/fax-shadow.sqlite');
const target = flag('target');
const outputFile = path.resolve(flag('out'));
if (!target.includes(':')) throw new Error('--target must be VERSION:SELECTOR');
if (!flag('out')) throw new Error('--out is required');
const [version, selector] = target.split(':', 2) as [string, string];

const db = openShadow(shadowFile, { queryOnly: true });
const change = db.prepare(`
  SELECT version,verse_id,selector,before_json,after_json,source_report,outcome
  FROM fax_shadow_changes
  WHERE version=? AND selector=?
  ORDER BY change_id DESC LIMIT 1
`).get(version, selector) as {
  version: string;
  verse_id: number;
  selector: string;
  before_json: string;
  after_json: string;
  source_report: string;
  outcome: string;
} | undefined;
db.close();
if (!change) throw new Error(`no shadow change found for ${target}`);

const currentRows = JSON.parse(change.after_json) as ShadowGeometry[];
const proposedRows = JSON.parse(change.before_json) as ShadowGeometry[];
const currentIds = new Set(currentRows.map((row) => row.uid));
const availableCurrentIds = currentRows.map((row) => row.uid);
const reused = new Set<number>();
for (let index = 0; index < proposedRows.length; index++) {
  const row = proposedRows[index]!;
  if (currentIds.has(row.uid) && !reused.has(row.uid)) {
    reused.add(row.uid);
    continue;
  }
  const replacement = availableCurrentIds.find((uid) => !reused.has(uid));
  if (replacement != null) {
    row.uid = replacement;
    reused.add(replacement);
  } else {
    // The inverse needs a fresh row; the apply script allocates a shadow UID.
    (row as { uid: number | null }).uid = null;
  }
}
const report = {
  generatedAt: new Date().toISOString(),
  method: 'guarded inverse of latest shadow proposal',
  reversedSourceReport: change.source_report,
  reversedOutcome: change.outcome,
  proposals: [{
    version: change.version,
    verseId: Number(change.verse_id),
    selector: change.selector,
    outcome: 'ACCEPTED_SHADOW_REVERSAL',
    sourceFlags: ['POST_RENDER_QA_REJECTED_PROPOSAL'],
    currentRows,
    proposedRows,
  }],
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile,
  target,
  reversedSourceReport: change.source_report,
  currentRows: currentRows.length,
  proposedRows: proposedRows.length,
}, null, 2));
