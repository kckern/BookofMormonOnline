#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Compose independently verified first/last fragments into one proposal.
 *
 * Typical use: local OCR owns the exact mid-line start, while printing-family
 * consensus supplies a continuation page whose OCR is weak. The script never
 * guesses coordinates and never mutates the shadow database.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  loadShadowRows,
  openShadow,
  type ShadowGeometry,
} from './lib/fax-shadow-db.ts';

type Geometry = Omit<ShadowGeometry, 'uid'> & { uid: number | null };
type Proposal = {
  version: string;
  verseId: number;
  selector: string;
  currentRows?: Geometry[];
  proposedRows?: Geometry[];
};

const argv = process.argv.slice(2);
const flag = (name: string): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : '';
};
const shadowFile = path.resolve(flag('shadow') || '.shadow/fax-shadow.sqlite');
const startFile = path.resolve(flag('start-report'));
const endFile = path.resolve(flag('end-report'));
const outputFile = path.resolve(flag('out'));
const target = flag('target');
if (!target.includes(':')) throw new Error('--target must be VERSION:SELECTOR');
if (!fs.existsSync(startFile)) throw new Error(`start report not found: ${startFile}`);
if (!fs.existsSync(endFile)) throw new Error(`end report not found: ${endFile}`);
if (!flag('out')) throw new Error('--out is required');
const [version, selector] = target.split(':', 2) as [string, string];

const readProposal = (file: string): Proposal => {
  const report = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    proposals: Proposal[];
  };
  const proposal = report.proposals.find((candidate) =>
    candidate.version === version && candidate.selector === selector);
  if (!proposal?.proposedRows?.length) {
    throw new Error(`proposal ${target} not found in ${file}`);
  }
  return proposal;
};
const startProposal = readProposal(startFile);
const endProposal = readProposal(endFile);
if (startProposal.verseId !== endProposal.verseId) {
  throw new Error('proposal verse IDs disagree');
}

const sortRows = (rows: Geometry[]): Geometry[] => [...rows].sort((left, right) =>
  left.page - right.page || left.Y - right.Y || left.X - right.X);
const startRows = sortRows(startProposal.proposedRows!);
const endRows = sortRows(endProposal.proposedRows!);
const first = startRows[0]!;
const last = endRows.at(-1)!;
if (first.page > last.page) throw new Error('composed page order is invalid');

const byPage = new Map<number, Geometry>();
for (const row of endRows) byPage.set(row.page, { ...row });
byPage.set(first.page, { ...first });
byPage.set(last.page, { ...last });
const proposedRows = sortRows([...byPage.values()]);
for (const row of proposedRows) {
  if (row.X < 0 || row.Y < 0 || row.W <= 0 || row.H <= 0 ||
      row.TLW < 0 || row.TLH < 0 || row.BRW < 0 || row.BRH < 0 ||
      row.TLW > row.W || row.BRW > row.W ||
      row.TLH > row.H || row.BRH > row.H) {
    throw new Error(`invalid composed geometry: ${JSON.stringify(row)}`);
  }
}

const db = openShadow(shadowFile, { queryOnly: true });
const currentRows = loadShadowRows(db, {
  versions: [version],
  verseIds: [startProposal.verseId],
});
db.close();
// Preserve existing UIDs page-for-page so the guarded apply is minimal.
const currentByPage = new Map(currentRows.map((row) => [row.page, row]));
for (const row of proposedRows) {
  row.uid = currentByPage.get(row.page)?.uid ?? null;
}
const report = {
  generatedAt: new Date().toISOString(),
  method: 'source-owned first fragment + family-consensus final fragment',
  sourceReports: { start: startFile, end: endFile },
  proposals: [{
    version,
    verseId: startProposal.verseId,
    selector,
    outcome: 'ACCEPTED_COMPOSED_SOURCE_FAMILY',
    sourceFlags: ['COMPOSED_INDEPENDENT_BOUNDARY_EVIDENCE'],
    currentRows,
    proposedRows,
    evidence: {
      firstPage: first.page,
      firstSource: startFile,
      lastPage: last.page,
      lastSource: endFile,
    },
  }],
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile,
  target,
  currentRows: currentRows.length,
  proposedRows: proposedRows.length,
  pages: proposedRows.map((row) => row.page),
}, null, 2));
