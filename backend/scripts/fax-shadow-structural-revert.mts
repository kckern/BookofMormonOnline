#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Revert changed verses implicated by structural-audit findings.
 *
 * The candidate and baseline databases are read-only. Output is a guarded
 * proposal report for fax-shadow-apply.mts. A finding's primary uid and any
 * previous/following/peer/intervening uids are considered; only rows that
 * actually differ from baseline are selected.
 */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalSelector } from '../src/media/fax/canonical.ts';
import {
  loadShadowRows,
  openShadow,
  type ShadowGeometry,
} from './lib/fax-shadow-db.ts';

type Finding = {
  code: string;
  version: string;
  uid: number | null;
  verseId: number | null;
  evidence?: {
    previousUid?: number;
    followingUid?: number;
    peerUid?: number;
    intervening?: Array<{ uid?: number }>;
  } | null;
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const candidateFile = path.resolve(flag('candidate'));
const baselineFile = path.resolve(flag('baseline'));
const auditFile = path.resolve(flag('audit'));
const outputFile = path.resolve(flag('out'));
const requestedVersion = flag('version');
if (!flag('candidate') || !fs.existsSync(candidateFile) ||
    !flag('baseline') || !fs.existsSync(baselineFile) ||
    !flag('audit') || !fs.existsSync(auditFile) ||
    !flag('out')) {
  throw new Error('--candidate, --baseline, --audit, and --out are required');
}

const audit = JSON.parse(fs.readFileSync(auditFile, 'utf8')) as {
  findings: Finding[];
};
const candidateDb = openShadow(candidateFile, { queryOnly: true });
const baselineDb = openShadow(baselineFile, { queryOnly: true });
const candidateRows = loadShadowRows(candidateDb, requestedVersion
  ? { versions: [requestedVersion] }
  : {});
const baselineRows = loadShadowRows(baselineDb, requestedVersion
  ? { versions: [requestedVersion] }
  : {});
const candidateByUid = new Map(candidateRows.map((row) => [row.uid, row]));
const baselineByUid = new Map(baselineRows.map((row) => [row.uid, row]));
const fields: Array<keyof ShadowGeometry> = [
  'uid', 'version', 'verseId', 'page', 'pageWidth', 'pageScale',
  'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH',
];
const same = (left: ShadowGeometry, right: ShadowGeometry): boolean =>
  fields.every((field) => left[field] === right[field]);

const findings = audit.findings.filter((finding) =>
  !requestedVersion || finding.version === requestedVersion);
const implicatedUids = new Set<number>();
for (const finding of findings) {
  if (finding.uid != null) implicatedUids.add(finding.uid);
  for (const uid of [
    finding.evidence?.previousUid,
    finding.evidence?.followingUid,
    finding.evidence?.peerUid,
    ...(finding.evidence?.intervening ?? []).map((item) => item.uid),
  ]) {
    if (uid != null) implicatedUids.add(uid);
  }
}
const changedImplicatedRows = [...implicatedUids]
  .map((uid) => candidateByUid.get(uid))
  .filter((row): row is ShadowGeometry => {
    if (!row) return false;
    const baseline = baselineByUid.get(row.uid);
    return Boolean(baseline && !same(row, baseline));
  });
const targets = new Map<string, {
  version: string;
  verseId: number;
  findingCodes: Set<string>;
  implicatedUids: Set<number>;
}>();
for (const row of changedImplicatedRows) {
  const key = `${row.version}|${row.verseId}`;
  const target = targets.get(key) ?? {
    version: row.version,
    verseId: row.verseId,
    findingCodes: new Set<string>(),
    implicatedUids: new Set<number>(),
  };
  target.implicatedUids.add(row.uid);
  for (const finding of findings) {
    const findingUids = new Set([
      finding.uid,
      finding.evidence?.previousUid,
      finding.evidence?.followingUid,
      finding.evidence?.peerUid,
      ...(finding.evidence?.intervening ?? []).map((item) => item.uid),
    ].filter((uid): uid is number => uid != null));
    if (findingUids.has(row.uid)) target.findingCodes.add(finding.code);
  }
  targets.set(key, target);
}

const proposals = [...targets.values()].map((target) => {
  const currentRows = loadShadowRows(candidateDb, {
    versions: [target.version],
    verseIds: [target.verseId],
  });
  const proposedRows = loadShadowRows(baselineDb, {
    versions: [target.version],
    verseIds: [target.verseId],
  });
  if (!currentRows.length || !proposedRows.length) {
    throw new Error(
      `missing candidate or baseline rows for ` +
      `${target.version}/${target.verseId}`,
    );
  }
  return {
    version: target.version,
    verseId: target.verseId,
    selector: canonicalSelector([target.verseId]),
    outcome: 'ACCEPTED_STRUCTURAL_REGRESSION_REVERT',
    currentRows,
    proposedRows,
    evidence: {
      auditFile,
      baselineFile,
      findingCodes: [...target.findingCodes].sort(),
      implicatedUids: [...target.implicatedUids].sort((a, b) => a - b),
    },
    error: null,
  };
}).sort((left, right) =>
  left.version.localeCompare(right.version, undefined, { numeric: true }) ||
  left.verseId - right.verseId);
candidateDb.close();
baselineDb.close();

const report = {
  generatedAt: new Date().toISOString(),
  method:
    'guarded baseline revert of changed rows implicated by structural findings',
  candidateFile,
  baselineFile,
  auditFile,
  findings: findings.length,
  implicatedUids: implicatedUids.size,
  changedImplicatedRows: changedImplicatedRows.length,
  selected: proposals.length,
  proposals,
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile,
  findings: report.findings,
  implicatedUids: report.implicatedUids,
  changedImplicatedRows: report.changedImplicatedRows,
  selected: report.selected,
}, null, 2));
