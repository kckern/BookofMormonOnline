#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Reclassify canonical-text QA failures using a trusted printing-family crop.
 *
 * This is a deterministic OCR comparison. It does not call an LLM or vision
 * model. Canonical results remain in `canonicalStatus`/`canonicalFlags`; only
 * proven source-equivalent target crops become geometry passes.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  assessFamilyReference,
  type FamilyReferenceRegistration,
} from './lib/fax-family-reference-qa.ts';

type QaResult = {
  key: string;
  version: string;
  verseId: number;
  selector: string;
  status: 'pass' | 'warning' | 'failure' | 'unavailable';
  flags: string[];
  ocrText: string | null;
  [key: string]: unknown;
};

type QaReport = {
  summary: Record<string, number>;
  byVersion?: Record<string, Record<string, number>>;
  byFlag?: Record<string, number>;
  results: QaResult[];
  [key: string]: unknown;
};

type Proposal = {
  version: string;
  verseId: number;
  selector: string;
  outcome: string;
  evidence?: {
    registrations?: FamilyReferenceRegistration[];
  };
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const referenceFile = path.resolve(flag('reference-qa'));
const targetFile = path.resolve(flag('target-qa'));
const proposalFile = flag('proposal-report')
  ? path.resolve(flag('proposal-report'))
  : null;
const outputFile = path.resolve(flag('out'));
if (!fs.existsSync(referenceFile) || !fs.existsSync(targetFile) || !flag('out')) {
  throw new Error('--reference-qa, --target-qa, and --out are required');
}

const reference = JSON.parse(fs.readFileSync(referenceFile, 'utf8')) as QaReport;
const target = JSON.parse(fs.readFileSync(targetFile, 'utf8')) as QaReport;
const referenceBySelector = new Map(
  reference.results.map((result) => [result.selector, result]),
);
const proposalByKey = new Map<string, Proposal>();
if (proposalFile) {
  const proposalReport = JSON.parse(
    fs.readFileSync(proposalFile, 'utf8'),
  ) as { proposals: Proposal[] };
  for (const proposal of proposalReport.proposals) {
    proposalByKey.set(
      `${proposal.version}|${proposal.verseId}`,
      proposal,
    );
  }
}

let accepted = 0;
const results = target.results.map((result) => {
  if (!result.ocrText || result.status === 'unavailable') return result;
  const source = referenceBySelector.get(result.selector);
  if (!source?.ocrText || source.status === 'unavailable') return result;
  const proposal = proposalByKey.get(`${result.version}|${result.verseId}`);
  const expectedLeadingNumberMatch = /\.(\d+)$/.exec(result.selector);
  const expectedLeadingNumber = expectedLeadingNumberMatch
    ? Number(expectedLeadingNumberMatch[1])
    : null;
  const assessment = assessFamilyReference({
    targetOcr: result.ocrText,
    targetFlags: result.flags,
    referenceOcr: source.ocrText,
    referenceFlags: source.flags,
    registrations: proposal?.evidence?.registrations ?? [],
    expectedLeadingNumber,
  });
  const next = {
    ...result,
    canonicalStatus: result.status,
    canonicalFlags: [...result.flags],
    familyReference: {
      referenceVersion: source.version,
      referenceStatus: source.status,
      referenceFlags: source.flags,
      proposalOutcome: proposal?.outcome ?? null,
      ...assessment,
    },
  };
  if (assessment.leadingNumberMismatch || assessment.adjacentNumberLeak) {
    const geometryNumberFlags = [
      ...(assessment.leadingNumberMismatch
        ? ['family-reference-leading-number-mismatch']
        : []),
      ...(assessment.adjacentNumberLeak
        ? ['family-reference-adjacent-number-leak']
        : []),
    ];
    return {
      ...next,
      status: 'failure' as const,
      flags: [
        ...result.flags,
        ...geometryNumberFlags,
      ],
    };
  }
  if (!assessment.accepted) return next;
  accepted++;
  return {
    ...next,
    status: 'pass' as const,
    flags: [
      ...result.flags,
      'family-reference-equivalent',
      `family-reference-${assessment.tier}`,
    ],
  };
});

const statuses = ['pass', 'warning', 'failure', 'unavailable'] as const;
const summary = {
  ...target.summary,
  pass: results.filter((result) => result.status === 'pass').length,
  warning: results.filter((result) => result.status === 'warning').length,
  failure: results.filter((result) => result.status === 'failure').length,
  unavailable: results.filter((result) => result.status === 'unavailable').length,
  familyReferenceAccepted: accepted,
};
const versions = [...new Set(results.map((result) => result.version))].sort();
const byVersion = Object.fromEntries(versions.map((version) => {
  const scoped = results.filter((result) => result.version === version);
  return [version, {
    candidates: scoped.length,
    ...Object.fromEntries(statuses.map((status) => [
      status,
      scoped.filter((result) => result.status === status).length,
    ])),
  }];
}));
const allFlags = [...new Set(results.flatMap((result) => result.flags))].sort();
const report = {
  ...target,
  generatedAt: new Date().toISOString(),
  referenceQaFile: referenceFile,
  targetQaFile: targetFile,
  proposalReportFile: proposalFile,
  summary,
  byVersion,
  byFlag: Object.fromEntries(allFlags.map((item) => [
    item,
    results.filter((result) => result.flags.includes(item)).length,
  ])),
  results,
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile,
  candidates: results.length,
  familyReferenceAccepted: accepted,
  pass: summary.pass,
  warning: summary.warning,
  failure: summary.failure,
  unavailable: summary.unavailable,
}, null, 2));
