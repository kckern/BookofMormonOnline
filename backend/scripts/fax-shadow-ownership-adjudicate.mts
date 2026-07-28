#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Re-adjudicate a line-ownership report from its persisted source metrics.
 *
 * This is intentionally read-only. It lets boundary policy be refined without
 * OCRing the same source leaves again. A physical line edge may include an
 * arbitrary amount of outward column whitespace (or a printed verse number);
 * mid-line ownership still must meet the measured inter-word gap.
 */
import fs from 'node:fs';
import path from 'node:path';

type Proposal = {
  outcome: string;
  anchors?: {
    start?: { run?: number };
    end?: { run?: number };
  };
  ownership?: {
    canonicalTokens?: number;
    spanRatio?: number;
    currentBoundaryFit?: {
      startHorizontalError?: number;
      endHorizontalError?: number;
      startTopInset?: number;
      endBottomInset?: number;
      startAtLineEdge?: boolean;
      endAtLineEdge?: boolean;
      startHorizontalPass?: boolean;
      endHorizontalPass?: boolean;
      startVerticalPass?: boolean;
      endVerticalPass?: boolean;
      pass?: boolean;
    } | null;
    currentSourceOwnershipVerified?: boolean;
  };
};

const argv = process.argv.slice(2);
const flag = (name: string): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : '';
};
const sourceFile = path.resolve(flag('report'));
const outputFile = path.resolve(flag('out'));
if (!fs.existsSync(sourceFile)) throw new Error(`report not found: ${sourceFile}`);
if (!flag('out')) throw new Error('--out is required');

const report = JSON.parse(fs.readFileSync(sourceFile, 'utf8')) as {
  proposals: Proposal[];
  [key: string]: unknown;
};
let newlyVerified = 0;
for (const proposal of report.proposals) {
  const fit = proposal.ownership?.currentBoundaryFit;
  if (!fit) continue;
  const startError = Number(fit.startHorizontalError);
  const endError = Number(fit.endHorizontalError);
  const topInset = Number(fit.startTopInset);
  const bottomInset = Number(fit.endBottomInset);
  const startHorizontalPass = fit.startAtLineEdge
    ? startError <= 4
    : Math.abs(startError) <= 10;
  const endHorizontalPass = fit.endAtLineEdge
    ? endError >= -4
    : Math.abs(endError) <= 10;
  const startVerticalPass = topInset >= -3 && topInset <= 12;
  const endVerticalPass = bottomInset >= -3 && bottomInset <= 12;
  const pass = startHorizontalPass && endHorizontalPass &&
    startVerticalPass && endVerticalPass;
  Object.assign(fit, {
    startHorizontalPass,
    endHorizontalPass,
    startVerticalPass,
    endVerticalPass,
    pass,
  });
  const startRun = Number(proposal.anchors?.start?.run ?? 0);
  const endRun = Number(proposal.anchors?.end?.run ?? 0);
  const canonicalTokens = Number(proposal.ownership?.canonicalTokens ?? 0);
  const spanRatio = Number(proposal.ownership?.spanRatio ?? 0);
  const verified = pass &&
    startRun >= 3 &&
    endRun >= 3 &&
    startRun + endRun >= Math.min(8, canonicalTokens) &&
    spanRatio >= 0.45 &&
    spanRatio <= 2.75;
  proposal.ownership!.currentSourceOwnershipVerified = verified;
  if (verified && proposal.outcome !== 'KEEP_CURRENT_SOURCE_OWNERSHIP') {
    proposal.outcome = 'KEEP_CURRENT_SOURCE_OWNERSHIP';
    newlyVerified++;
  }
}

const byOutcome = Object.fromEntries(
  [...new Set(report.proposals.map((proposal) => proposal.outcome))]
    .sort()
    .map((outcome) => [
      outcome,
      report.proposals.filter((proposal) => proposal.outcome === outcome).length,
    ]),
);
const output = {
  ...report,
  generatedAt: new Date().toISOString(),
  sourceReport: sourceFile,
  adjudication:
    'source word ownership; unbounded outward whitespace at physical line edges',
  newlyVerified,
  byOutcome,
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ outputFile, newlyVerified, byOutcome }, null, 2));
