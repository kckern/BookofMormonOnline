#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Build a guarded shadow-apply report for complete verse-row replacements.
 *
 * Unlike the field-only targeted patch helper, this supports adding and
 * removing fragments. It never mutates the database; fax-shadow-apply.mts
 * performs the guarded transaction and records the before/after state.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  loadShadowRows,
  openShadow,
  type ShadowGeometry,
} from './lib/fax-shadow-db.ts';

type ReplacementRow = Partial<ShadowGeometry> & {
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
type ProposalGeometry = Omit<ShadowGeometry, 'uid'> & { uid: number | null };

type Replacement = {
  version: string;
  verseId: number;
  selector: string;
  outcome?: string;
  reason: string;
  evidence?: Record<string, unknown>;
  rows: ReplacementRow[];
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const replacementsFile = path.resolve(flag('replacements'));
const outputFile = path.resolve(flag('out'));
if (!flag('replacements') || !fs.existsSync(replacementsFile)) {
  throw new Error(`replacement specification not found: ${replacementsFile}`);
}
if (!flag('out')) throw new Error('--out is required');

const input = JSON.parse(fs.readFileSync(replacementsFile, 'utf8')) as {
  replacements: Replacement[];
};
if (!Array.isArray(input.replacements) || !input.replacements.length) {
  throw new Error('replacement specification has no replacements');
}

const db = openShadow(shadowFile, { queryOnly: true });
const proposals = input.replacements.map((replacement) => {
  const currentRows = loadShadowRows(db, {
    versions: [replacement.version],
    verseIds: [replacement.verseId],
  });
  if (!currentRows.length) {
    throw new Error(
      `no current rows for ${replacement.version}/${replacement.selector}`,
    );
  }
  if (!replacement.rows.length) {
    throw new Error(
      `empty replacement for ${replacement.version}/${replacement.selector}`,
    );
  }
  const currentIds = new Set(currentRows.map((row) => row.uid));
  const proposedRows = replacement.rows.map((row): ProposalGeometry => {
    const uid = row.uid == null ? null : Number(row.uid);
    if (uid != null && (!Number.isInteger(uid) || !currentIds.has(uid))) {
      throw new Error(
        `uid ${String(row.uid)} is not owned by ` +
        `${replacement.version}/${replacement.selector}`,
      );
    }
    const proposed = {
      uid,
      version: replacement.version,
      verseId: replacement.verseId,
      page: Number(row.page),
      pageWidth: Number(row.pageWidth),
      pageScale: Number(row.pageScale),
      X: Number(row.X),
      Y: Number(row.Y),
      W: Number(row.W),
      H: Number(row.H),
      TLW: Number(row.TLW),
      TLH: Number(row.TLH),
      BRW: Number(row.BRW),
      BRH: Number(row.BRH),
    };
    if (Object.entries(proposed).some(([key, value]) =>
      key !== 'uid' &&
      (value == null ||
       (typeof value === 'number' && !Number.isInteger(value))))) {
      throw new Error(
        `non-integer replacement geometry for ` +
        `${replacement.version}/${replacement.selector}`,
      );
    }
    if (proposed.page < 1 || proposed.pageWidth <= 0 ||
        proposed.pageScale <= 0 || proposed.X < 0 || proposed.Y < 0 ||
        proposed.W <= 0 || proposed.H <= 0 ||
        proposed.X + proposed.W > proposed.pageScale ||
        proposed.TLW < 0 || proposed.TLH < 0 ||
        proposed.BRW < 0 || proposed.BRH < 0 ||
        proposed.TLW > proposed.W || proposed.BRW > proposed.W ||
        proposed.TLH > proposed.H || proposed.BRH > proposed.H) {
      throw new Error(
        `invalid replacement geometry for ` +
        `${replacement.version}/${replacement.selector}: ` +
        JSON.stringify(proposed),
      );
    }
    return proposed;
  });
  const duplicateUids = proposedRows
    .map((row) => row.uid)
    .filter((uid): uid is number => uid != null)
    .filter((uid, index, values) => values.indexOf(uid) !== index);
  if (duplicateUids.length) {
    throw new Error(
      `duplicate replacement uid(s): ${[...new Set(duplicateUids)].join(',')}`,
    );
  }
  return {
    version: replacement.version,
    verseId: replacement.verseId,
    selector: replacement.selector,
    outcome: replacement.outcome ?? 'ACCEPTED_REVIEWED_ROW_REPLACEMENT',
    sourceFlags: ['REVIEWED_COMPLETE_ROW_REPLACEMENT'],
    currentRows,
    proposedRows,
    evidence: {
      reason: replacement.reason,
      ...replacement.evidence,
      retainedUids: proposedRows
        .map((row) => row.uid)
        .filter((uid): uid is number => uid != null),
      insertedRows: proposedRows.filter((row) => row.uid == null).length,
      removedUids: currentRows
        .filter((row) => !proposedRows.some((candidate) => candidate.uid === row.uid))
        .map((row) => row.uid),
    },
  };
});
db.close();

const report = {
  generatedAt: new Date().toISOString(),
  method: 'guarded reviewed complete verse-row replacements',
  sourceFile: replacementsFile,
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
