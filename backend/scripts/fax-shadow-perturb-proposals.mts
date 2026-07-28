#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Emit guarded geometry-perturbation proposals for hard render-QA failures.
 *
 * This is intentionally a variant generator, not an acceptance oracle. Every
 * proposal must be rendered and selected by fax-shadow-qa-select-proposals.mts
 * before it may be applied to the working shadow.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  loadShadowRows,
  openShadow,
  type ShadowGeometry,
} from './lib/fax-shadow-db.ts';

type QaResult = {
  version: string;
  verseId: number;
  selector: string;
  status: 'pass' | 'warning' | 'failure' | 'unavailable';
  flags: string[];
};
type SeedProposal = {
  version: string;
  verseId: number;
  selector: string;
  outcome: string;
  proposedRows?: ShadowGeometry[];
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const amount = (name: string): number =>
  Math.max(0, Math.min(128, Number(flag(name, '0')) || 0));

const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const qaFile = path.resolve(flag('qa-report'));
const outputFile = path.resolve(flag('out'));
const seedReportFlag = flag('seed-report');
const seedReportFile = seedReportFlag ? path.resolve(seedReportFlag) : null;
const left = amount('left');
const right = amount('right');
const top = amount('top');
const bottom = amount('bottom');
const insetLeft = amount('inset-left');
const insetRight = amount('inset-right');
const insetTop = amount('inset-top');
const insetBottom = amount('inset-bottom');
if (!fs.existsSync(qaFile) || !flag('out')) {
  throw new Error('--qa-report and --out are required');
}
if (!(left || right || top || bottom ||
      insetLeft || insetRight || insetTop || insetBottom || seedReportFile)) {
  throw new Error(
    'at least one padding or --inset-left/--inset-right/--inset-top/--inset-bottom is required',
  );
}

const qa = JSON.parse(fs.readFileSync(qaFile, 'utf8')) as {
  results: QaResult[];
};
const failures = qa.results.filter((result) => result.status === 'failure');
const seedByKey = new Map<string, SeedProposal>();
if (seedReportFile) {
  const seed = JSON.parse(fs.readFileSync(seedReportFile, 'utf8')) as {
    proposals: SeedProposal[];
  };
  for (const proposal of seed.proposals) {
    if (proposal.proposedRows?.length) {
      seedByKey.set(`${proposal.version}|${proposal.verseId}`, proposal);
    }
  }
}
const db = openShadow(shadowFile, { queryOnly: true });

function perturb(row: ShadowGeometry): ShadowGeometry {
  const oldRight = row.X + row.W;
  const oldBottom = row.Y + row.H;
  const newX = Math.min(
    oldRight - 1,
    Math.max(0, row.X - left + insetLeft),
  );
  const newY = Math.min(
    oldBottom - 1,
    Math.max(0, row.Y - top + insetTop),
  );
  const leftAdded = row.X - newX;
  const topAdded = row.Y - newY;
  const newRight = Math.max(
    newX + 1,
    Math.min(row.pageScale, oldRight + right - insetRight),
  );
  const newBottom = Math.max(
    newY + 1,
    oldBottom + bottom - insetBottom,
  );
  const W = Math.max(1, newRight - newX);
  const H = Math.max(1, newBottom - newY);
  const tlActive = row.TLW > 0 && row.TLH > 0;
  const brActive = row.BRW > 0 && row.BRH > 0;
  return {
    ...row,
    X: newX,
    Y: newY,
    W,
    H,
    // Preserve the authored visible start/end boundary when padding is added
    // on the orthogonal exterior. Right padding deliberately exposes more of
    // the final line; render QA rejects it if that crosses into the neighbor.
    TLW: tlActive ? Math.min(W, Math.max(0, row.TLW + leftAdded)) : 0,
    TLH: tlActive ? Math.min(H, Math.max(0, row.TLH + topAdded)) : 0,
    BRW: brActive ? Math.min(W, Math.max(0, row.BRW - insetRight)) : 0,
    BRH: brActive
      ? Math.min(H, Math.max(0, row.BRH + bottom - insetBottom))
      : 0,
  };
}

const proposals = failures.map((failure) => {
  const currentRows = loadShadowRows(db, {
    versions: [failure.version],
    verseIds: [failure.verseId],
  });
  const seed = seedByKey.get(`${failure.version}|${failure.verseId}`);
  const seedRows = seed?.proposedRows;
  const compatibleSeed = seedRows?.length === currentRows.length &&
    seedRows.every((row, index) =>
      row.version === failure.version &&
      row.verseId === failure.verseId &&
      row.uid === currentRows[index]?.uid);
  const baseRows = compatibleSeed ? seedRows! : currentRows;
  return {
    version: failure.version,
    verseId: failure.verseId,
    selector: failure.selector,
    outcome: 'ACCEPTED_PERTURBATION_VARIANT',
    currentRows,
    proposedRows: baseRows.map(perturb),
    evidence: {
      sourceQaFile: qaFile,
      sourceFlags: failure.flags,
      padding: { left, right, top, bottom },
      insets: { left: insetLeft, right: insetRight, top: insetTop, bottom: insetBottom },
      seedReportFile,
      seedOutcome: compatibleSeed ? seed?.outcome : null,
      seedUsed: Boolean(compatibleSeed),
    },
    error: null,
  };
});
db.close();

const report = {
  generatedAt: new Date().toISOString(),
  method: 'bounded geometry perturbation; requires exhaustive before/after QA selection',
  shadowFile,
  qaFile,
  seedReportFile,
  padding: { left, right, top, bottom },
  insets: { left: insetLeft, right: insetRight, top: insetTop, bottom: insetBottom },
  proposals,
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile,
  proposals: proposals.length,
  padding: report.padding,
}, null, 2));
