#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Turn small, reviewed geometry deltas into a guarded shadow-apply report.
 *
 * The patch specification names an existing UID and only the fields that may
 * change. Current rows are loaded from the shadow database, so fax-shadow-apply
 * can reject stale or accidentally broadened edits.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  loadShadowRows,
  openShadow,
  type ShadowGeometry,
} from './lib/fax-shadow-db.ts';

type GeometryField =
  | 'page' | 'pageWidth' | 'pageScale'
  | 'X' | 'Y' | 'W' | 'H'
  | 'TLW' | 'TLH' | 'BRW' | 'BRH';

type PatchSpec = {
  version: string;
  verseId: number;
  selector: string;
  outcome?: string;
  reason: string;
  evidence?: Record<string, unknown>;
  changes: Array<{
    uid: number;
    set: Partial<Record<GeometryField, number>>;
  }>;
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const patchesFile = path.resolve(flag('patches'));
const outputFile = path.resolve(flag('out'));
if (!flag('patches') || !fs.existsSync(patchesFile)) {
  throw new Error(`patch specification not found: ${patchesFile}`);
}
if (!flag('out')) throw new Error('--out is required');

const input = JSON.parse(fs.readFileSync(patchesFile, 'utf8')) as {
  patches: PatchSpec[];
};
if (!Array.isArray(input.patches) || !input.patches.length) {
  throw new Error('patch specification has no patches');
}

const allowed = new Set<GeometryField>([
  'page', 'pageWidth', 'pageScale',
  'X', 'Y', 'W', 'H',
  'TLW', 'TLH', 'BRW', 'BRH',
]);
const db = openShadow(shadowFile, { queryOnly: true });
const proposals = input.patches.map((patch) => {
  const currentRows = loadShadowRows(db, {
    versions: [patch.version],
    verseIds: [patch.verseId],
  });
  if (!currentRows.length) {
    throw new Error(`no current rows for ${patch.version}/${patch.selector}`);
  }
  const proposedRows: ShadowGeometry[] = currentRows.map((row) => ({ ...row }));
  for (const change of patch.changes) {
    const row = proposedRows.find((candidate) => candidate.uid === change.uid);
    if (!row) {
      throw new Error(
        `uid ${change.uid} is not owned by ${patch.version}/${patch.selector}`,
      );
    }
    for (const [field, value] of Object.entries(change.set)) {
      if (!allowed.has(field as GeometryField) ||
          !Number.isInteger(value)) {
        throw new Error(
          `invalid ${field}=${String(value)} for uid ${change.uid}`,
        );
      }
      (row as unknown as Record<string, number>)[field] = value;
    }
  }
  for (const row of proposedRows) {
    if (row.X < 0 || row.Y < 0 || row.W <= 0 || row.H <= 0 ||
        row.X + row.W > row.pageScale ||
        row.TLW < 0 || row.TLH < 0 || row.BRW < 0 || row.BRH < 0 ||
        row.TLW > row.W || row.BRW > row.W ||
        row.TLH > row.H || row.BRH > row.H) {
      throw new Error(
        `invalid proposed geometry for ${patch.version}/${patch.selector}: ` +
        JSON.stringify(row),
      );
    }
  }
  return {
    version: patch.version,
    verseId: patch.verseId,
    selector: patch.selector,
    outcome: patch.outcome ?? 'ACCEPTED_TARGETED_GEOMETRY',
    sourceFlags: ['REVIEWED_TARGETED_PATCH'],
    currentRows,
    proposedRows,
    evidence: {
      reason: patch.reason,
      ...patch.evidence,
      changedUids: patch.changes.map((change) => change.uid),
    },
  };
});
db.close();

const report = {
  generatedAt: new Date().toISOString(),
  method: 'guarded reviewed field-level geometry patches',
  sourceFile: patchesFile,
  proposals,
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile,
  proposals: proposals.length,
  targets: proposals.map((proposal) =>
    `${proposal.version}:${proposal.selector}`),
}, null, 2));
