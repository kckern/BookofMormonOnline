#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Compose proposal reports using exhaustive before/after QA.
 *
 * Only verses that are hard failures in the current database are eligible.
 * A variant is selectable only when its exhaustive render result is pass or
 * warning. Existing pass/warning geometry is therefore retained verbatim and
 * the resulting report has zero hard-status regressions by construction.
 */
import fs from 'node:fs';
import path from 'node:path';

type QaResult = {
  key: string;
  version: string;
  verseId: number;
  selector: string;
  status: 'pass' | 'warning' | 'failure' | 'unavailable';
  flags: string[];
  leadingRun: number | null;
  trailingRun: number | null;
  longestCanonicalRun: number | null;
  orderedCoverage: number | null;
};
type Proposal = {
  version: string;
  verseId: number;
  selector: string;
  outcome: string;
  currentRows: unknown[];
  proposedRows?: unknown[];
  evidence?: Record<string, unknown>;
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const currentQaFile = path.resolve(flag('current-qa'));
const variants = flag('variants')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    const fields = value.split('|');
    if (fields.length !== 3) {
      throw new Error(
        '--variants entries must be NAME|QA_REPORT|PROPOSAL_REPORT',
      );
    }
    return {
      name: fields[0]!,
      qaFile: path.resolve(fields[1]!),
      proposalFile: path.resolve(fields[2]!),
    };
  });
const outputFile = path.resolve(flag('out'));
const vetoQaFiles = flag('veto-qa')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => path.resolve(value));
if (!fs.existsSync(currentQaFile) || !variants.length || !flag('out')) {
  throw new Error('--current-qa, --variants, and --out are required');
}

const readQa = (file: string): QaResult[] =>
  (JSON.parse(fs.readFileSync(file, 'utf8')) as { results: QaResult[] }).results;
const current = readQa(currentQaFile);
const currentByKey = new Map(current.map((result) => [result.key, result]));
const vetoQa = vetoQaFiles.map((file) => ({
  file,
  byKey: new Map(readQa(file).map((result) => [result.key, result])),
}));
const unsafeVariantFlags = new Set([
  'ocr-content-unreliable',
  'preceding-neighbor-text-leak',
  'following-neighbor-text-leak',
  'preceding-content-before-verse',
  'following-content-after-verse',
  'internal-canonical-span-missing',
]);
const hasUnsafeVariantEvidence = (result: QaResult): boolean =>
  result.flags.some((flag) => unsafeVariantFlags.has(flag));
const loadedVariants = variants.map((variant) => {
  const qa = readQa(variant.qaFile);
  const report = JSON.parse(fs.readFileSync(
    variant.proposalFile,
    'utf8',
  )) as { proposals: Proposal[] };
  return {
    ...variant,
    qaByKey: new Map(qa.map((result) => [result.key, result])),
    proposalByKey: new Map(report.proposals
      .filter((proposal) =>
        proposal.outcome.startsWith('ACCEPTED_') &&
        proposal.proposedRows?.length)
      .map((proposal) => [
        `${proposal.version}|${proposal.verseId}`,
        proposal,
      ])),
  };
});

function resultRank(
  result: QaResult,
  variantName: string,
): number {
  const status = result.status === 'pass'
    ? 2_000_000
    : result.status === 'warning'
      ? 1_000_000
      : 0;
  const neighborPenalty = result.flags.filter((item) =>
    /neighbor-text-leak|content-(?:before|after)-verse/.test(item)).length *
    100_000;
  const boundary =
    (result.leadingRun ?? 0) +
    (result.trailingRun ?? 0) +
    (result.longestCanonicalRun ?? 0);
  const coverage = Math.round((result.orderedCoverage ?? 0) * 10_000);
  // Exact-line ownership wins only as a final tie-breaker.
  const methodTieBreak = /line/i.test(variantName) ? 1 : 0;
  return status - neighborPenalty + coverage + boundary + methodTieBreak;
}

const proposals: Array<Proposal & {
  selectionEvidence: Record<string, unknown>;
}> = [];
const rejected: Array<Record<string, unknown>> = [];
for (const currentResult of current) {
  if (currentResult.status !== 'failure') continue;
  const candidates = loadedVariants.flatMap((variant) => {
    const result = variant.qaByKey.get(currentResult.key);
    const proposal = variant.proposalByKey.get(currentResult.key);
    if (!result || !proposal ||
        (result.status !== 'pass' && result.status !== 'warning') ||
        hasUnsafeVariantEvidence(result) ||
        vetoQa.some((veto) => {
          const repeated = veto.byKey.get(currentResult.key);
          return repeated ? hasUnsafeVariantEvidence(repeated) : false;
        })) return [];
    return [{
      variant: variant.name,
      result,
      proposal,
      rank: resultRank(result, variant.name),
    }];
  }).sort((left, right) =>
    right.rank - left.rank ||
    left.variant.localeCompare(right.variant));
  const selected = candidates[0];
  if (!selected) {
    rejected.push({
      key: currentResult.key,
      selector: currentResult.selector,
      reason: 'NO_NONFAILURE_VARIANT',
      currentStatus: currentResult.status,
      variants: loadedVariants.map((variant) => {
        const result = variant.qaByKey.get(currentResult.key);
        return {
          variant: variant.name,
          status: result?.status ?? 'missing',
          flags: result?.flags ?? [],
          hasProposal: variant.proposalByKey.has(currentResult.key),
        };
      }),
    });
    continue;
  }
  proposals.push({
    ...selected.proposal,
    outcome: 'ACCEPTED_EXHAUSTIVE_QA_IMPROVEMENT',
    selectionEvidence: {
      current: {
        status: currentResult.status,
        flags: currentResult.flags,
      },
      selectedVariant: selected.variant,
      selectedResult: selected.result,
      alternatives: candidates.map((candidate) => ({
        variant: candidate.variant,
        rank: candidate.rank,
        status: candidate.result.status,
        flags: candidate.result.flags,
      })),
    },
  });
}
proposals.sort((left, right) =>
  left.version.localeCompare(right.version, undefined, { numeric: true }) ||
  left.verseId - right.verseId);

const selectedByVariant = Object.fromEntries(loadedVariants.map((variant) => [
  variant.name,
  proposals.filter((proposal) =>
    proposal.selectionEvidence.selectedVariant === variant.name).length,
]));
const report = {
  generatedAt: new Date().toISOString(),
  method: 'exhaustive per-verse before/after QA selection; no hard regressions',
  currentQaFile,
  variants: variants.map((variant) => ({
    name: variant.name,
    qaFile: variant.qaFile,
    proposalFile: variant.proposalFile,
  })),
  vetoQaFiles,
  currentHardFailures: current.filter((result) =>
    result.status === 'failure').length,
  selected: proposals.length,
  residualHardFailures: rejected.length,
  selectedByVariant,
  hardStatusRegressions: 0,
  proposals,
  rejected,
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile,
  currentHardFailures: report.currentHardFailures,
  selected: report.selected,
  residualHardFailures: report.residualHardFailures,
  selectedByVariant,
  hardStatusRegressions: 0,
}, null, 2));
