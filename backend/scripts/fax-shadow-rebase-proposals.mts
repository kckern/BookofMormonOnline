#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Rebase previously generated geometry onto the shadow's current guarded rows.
 *
 * Proposal geometry can remain useful after other accepted batches have changed
 * the same verse. This utility updates only `currentRows`; the desired geometry
 * and its evidence stay intact and must still pass fresh render/structural QA.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  loadShadowRows,
  openShadow,
  type ShadowGeometry,
} from './lib/fax-shadow-db.ts';

type Proposal = {
  version: string;
  verseId: number;
  selector: string;
  outcome: string;
  currentRows?: ShadowGeometry[];
  proposedRows?: ShadowGeometry[];
  evidence?: Record<string, unknown>;
  [key: string]: unknown;
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const seedFile = path.resolve(flag('seed-report'));
const outputFile = path.resolve(flag('out'));
const targets = new Set(
  flag('only').split(',').map((value) => value.trim()).filter(Boolean),
);
if (!flag('seed-report') || !fs.existsSync(seedFile)) {
  throw new Error(`seed proposal report not found: ${seedFile}`);
}
if (!flag('out')) throw new Error('--out is required');
if (!targets.size) {
  throw new Error('--only requires comma-separated version:selector targets');
}

const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8')) as {
  proposals: Proposal[];
};
const seedByTarget = new Map(
  seed.proposals.map((proposal) => [
    `${proposal.version}:${proposal.selector}`,
    proposal,
  ]),
);
const db = openShadow(shadowFile, { queryOnly: true });
const proposals = [...targets].map((target) => {
  const proposal = seedByTarget.get(target);
  if (!proposal?.proposedRows?.length) {
    throw new Error(`target missing proposed geometry: ${target}`);
  }
  const currentRows = loadShadowRows(db, {
    versions: [proposal.version],
    verseIds: [proposal.verseId],
  });
  if (!currentRows.length) throw new Error(`shadow target has no rows: ${target}`);
  const currentUids = new Set(currentRows.map((row) => row.uid));
  const desiredUids = proposal.proposedRows
    .map((row) => row.uid)
    .filter((uid): uid is number => uid != null);
  if (desiredUids.length !== proposal.proposedRows.length ||
      desiredUids.some((uid) => !currentUids.has(uid))) {
    throw new Error(`seed/current UID mismatch: ${target}`);
  }
  for (const row of proposal.proposedRows) {
    if (row.version !== proposal.version || row.verseId !== proposal.verseId ||
        row.X < 0 || row.Y < 0 || row.W <= 0 || row.H <= 0 ||
        row.X + row.W > row.pageScale ||
        row.TLW < 0 || row.TLH < 0 || row.BRW < 0 || row.BRH < 0 ||
        row.TLW > row.W || row.BRW > row.W ||
        row.TLH > row.H || row.BRH > row.H) {
      throw new Error(`invalid desired geometry: ${target}`);
    }
  }
  return {
    ...proposal,
    outcome: 'ACCEPTED_REBASED_VARIANT',
    currentRows,
    evidence: {
      ...proposal.evidence,
      rebase: {
        sourceReport: seedFile,
        sourceOutcome: proposal.outcome,
        shadowFile,
      },
    },
  };
});
db.close();

const report = {
  generatedAt: new Date().toISOString(),
  method: 'guarded proposal rebase; requires fresh render and structural QA',
  shadowFile,
  seedReportFile: seedFile,
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
