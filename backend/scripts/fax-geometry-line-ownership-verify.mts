#!/usr/bin/env npx tsx
/**
 * Read-only post-apply verifier for the source-word ownership remediation.
 *
 * Accepted proposals must match their complete proposed row set. Proposals
 * intentionally kept unchanged (including unavailable media) must still match
 * their complete pre-remediation row set. Existing source UIDs are verified;
 * newly inserted fragments are matched by their full geometry.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getDb, closeDb } from '../src/data/db.ts';
import { loadShadowRows, openShadow } from './lib/fax-shadow-db.ts';

type Geometry = {
  uid: number | null;
  version: string;
  verseId: number;
  page: number;
  pageWidth: number;
  pageScale: number;
  X: number;
  Y: number;
  W: number;
  H: number;
  TLW: number;
  TLH: number;
  BRW: number;
  BRH: number;
};

type Proposal = {
  version: string;
  verseId: number;
  selector: string;
  outcome: string;
  currentRows: Geometry[];
  proposedRows?: Geometry[];
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const reportFile = path.resolve(flag(
  'report',
  '../docs/audits/fax-geometry/2026-07-26-line-ownership-final-v2/' +
    'line-ownership-report.json',
));
const outputFile = path.resolve(flag(
  'out',
  '../docs/audits/fax-geometry/2026-07-26-post-line-ownership/' +
    'db-verification.json',
));
const only = new Set(
  flag('only', '').split(',').map((value) => value.trim()).filter(Boolean),
);
const shadowFile = flag('shadow', '');

const report = JSON.parse(fs.readFileSync(reportFile, 'utf8')) as {
  proposals: Proposal[];
};
const proposals = report.proposals.filter((proposal) =>
  !only.size || only.has(`${proposal.version}:${proposal.selector}`));
if (!proposals.length) throw new Error('report selection has no proposals');
if (only.size && proposals.length !== only.size) {
  const found = new Set(proposals.map((proposal) => `${proposal.version}:${proposal.selector}`));
  throw new Error(
    `--only selector(s) absent from report: ${
      [...only].filter((value) => !found.has(value)).join(', ')
    }`,
  );
}

const keyFor = (version: string, verseId: number): string => `${version}|${verseId}`;
const fields = [
  'version', 'verseId', 'page', 'pageWidth', 'pageScale',
  'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH',
] as const;
const geometryKey = (row: Geometry): string =>
  fields.map((field) => String(row[field])).join('|');
const sameGeometry = (left: Geometry, right: Geometry): boolean =>
  fields.every((field) => left[field] === right[field]);
const versions = [...new Set(proposals.map((proposal) => proposal.version))].sort();
const verseIds = [...new Set(proposals.map((proposal) => proposal.verseId))]
  .sort((left, right) => left - right);

let actualRows: Geometry[] = [];
if (shadowFile) {
  const shadow = openShadow(shadowFile, { queryOnly: true });
  actualRows = loadShadowRows(shadow, { versions, verseIds });
  shadow.close();
} else {
  const db = getDb();
  try {
    const rawRows = await db.selectFrom('bom_xtras_fax_index')
      .select([
        'uid', 'version', 'verse_id', 'page', 'pageWidth', 'pageScale',
        'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH',
      ])
      .where('version', 'in', versions)
      .where('verse_id', 'in', verseIds)
      .execute();
    actualRows = rawRows.map((row) => ({
      uid: Number(row.uid),
      version: String(row.version),
      verseId: Number(row.verse_id),
      page: Number(row.page),
      pageWidth: Number(row.pageWidth),
      pageScale: Number(row.pageScale) || 700,
      X: Number(row.X),
      Y: Number(row.Y),
      W: Number(row.W),
      H: Number(row.H),
      TLW: Number(row.TLW),
      TLH: Number(row.TLH),
      BRW: Number(row.BRW),
      BRH: Number(row.BRH),
    }));
  } finally {
    await closeDb();
  }
}
const actualByPair = new Map<string, Geometry[]>();
for (const row of actualRows) {
  const key = keyFor(row.version, row.verseId);
  const rows = actualByPair.get(key) ?? [];
  rows.push(row);
  actualByPair.set(key, rows);
}

type Failure = {
  code: string;
  version: string;
  selector: string;
  outcome: string;
  detail?: unknown;
};
const failures: Failure[] = [];
let expectedRows = 0;
let matchedRows = 0;
let acceptedVerses = 0;
let retainedVerses = 0;

for (const proposal of proposals) {
  const accepted = proposal.outcome.startsWith('ACCEPTED_');
  const expected = accepted ? proposal.proposedRows ?? [] : proposal.currentRows;
  const actual = actualByPair.get(keyFor(proposal.version, proposal.verseId)) ?? [];
  if (accepted) acceptedVerses++;
  else retainedVerses++;
  expectedRows += expected.length;

  if (actual.length !== expected.length) {
    failures.push({
      code: 'ROW_COUNT_MISMATCH',
      version: proposal.version,
      selector: proposal.selector,
      outcome: proposal.outcome,
      detail: { expected: expected.length, actual: actual.length, actualRows: actual },
    });
    continue;
  }

  const unmatched = [...actual];
  for (const desired of expected) {
    const index = unmatched.findIndex((row) =>
      sameGeometry(row, desired) &&
      (accepted && desired.uid != null ? row.uid === desired.uid : true));
    if (index < 0) {
      failures.push({
        code: desired.uid == null ? 'INSERTED_GEOMETRY_MISSING' : 'GEOMETRY_MISMATCH',
        version: proposal.version,
        selector: proposal.selector,
        outcome: proposal.outcome,
        detail: {
          expected: desired,
          actualRows: actual,
          expectedGeometryKey: geometryKey(desired),
        },
      });
      continue;
    }
    unmatched.splice(index, 1);
    matchedRows++;
  }
  if (unmatched.length) {
    failures.push({
      code: 'UNEXPECTED_ROWS',
      version: proposal.version,
      selector: proposal.selector,
      outcome: proposal.outcome,
      detail: { rows: unmatched },
    });
  }

  if (accepted) {
    const desiredSourceUids = new Set(
      expected.map((row) => row.uid).filter((uid): uid is number => uid != null),
    );
    const staleUids = proposal.currentRows
      .map((row) => row.uid)
      .filter((uid): uid is number => uid != null && !desiredSourceUids.has(uid));
    const survivingStale = actual.filter((row) => row.uid != null && staleUids.includes(row.uid));
    if (survivingStale.length) {
      failures.push({
        code: 'STALE_ROWS_SURVIVED',
        version: proposal.version,
        selector: proposal.selector,
        outcome: proposal.outcome,
        detail: { rows: survivingStale },
      });
    }
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  reportFile,
  shadowFile: shadowFile || null,
  versions,
  proposals: proposals.length,
  acceptedVerses,
  retainedVerses,
  expectedRows,
  matchedRows,
  failures: failures.length,
  status: failures.length ? 'FAIL' : 'PASS',
  failureDetails: failures,
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile,
  versions,
  proposals: result.proposals,
  acceptedVerses,
  retainedVerses,
  expectedRows,
  matchedRows,
  failures: failures.length,
  status: result.status,
}, null, 2));
if (failures.length) process.exitCode = 1;
