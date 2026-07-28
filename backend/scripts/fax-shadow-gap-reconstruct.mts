#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Reconstruct an absent first-of-page verse from deterministic page geometry.
 *
 * Intended for editions whose source media is unavailable but whose generated
 * page layout is internally regular. The top margin is a leave-neighborhood-out
 * median; the following verse supplies the exact end boundary. A holdout test
 * over known page-opening verses is included in the report.
 */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalSelector } from '../src/media/fax/canonical.ts';
import {
  loadShadowRows,
  openShadow,
  shadowCanonicalText,
  type ShadowGeometry,
} from './lib/fax-shadow-db.ts';

const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const version = flag('version');
const verseId = Number(flag('verse-id'));
const outDir = path.resolve(flag(
  'out',
  '../docs/audits/fax-geometry/shadow/gap-reconstruction',
));
if (!version || !Number.isFinite(verseId)) {
  throw new Error('provide --version VERSION --verse-id ID');
}
const median = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
};
const percentile = (values: number[], fraction: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(
    sorted.length - 1,
    Math.floor((sorted.length - 1) * fraction),
  )] ?? 0;
};

const db = openShadow(shadowFile, { queryOnly: true });
const rows = loadShadowRows(db, { versions: [version] });
const canonical = shadowCanonicalText(db);
db.close();
const byVerse = new Map<number, ShadowGeometry[]>();
const byPage = new Map<number, ShadowGeometry[]>();
for (const row of rows) {
  (byVerse.get(row.verseId) ??
    byVerse.set(row.verseId, []).get(row.verseId)!).push(row);
  (byPage.get(row.page) ?? byPage.set(row.page, []).get(row.page)!).push(row);
}
const ordered = (input: ShadowGeometry[]): ShadowGeometry[] =>
  [...input].sort((left, right) =>
    left.page - right.page || left.Y - right.Y || left.X - right.X);
const currentRows = ordered(byVerse.get(verseId) ?? []);
const previous = ordered(byVerse.get(verseId - 1) ?? []).at(-1);
const next = ordered(byVerse.get(verseId + 1) ?? [])[0];
if (currentRows.length) throw new Error('target already has geometry');
if (!previous || !next || previous.page >= next.page) {
  throw new Error('target is not a page-opening gap between adjacent verses');
}
const targetPage = next.page;
const targetPeers = (byPage.get(targetPage) ?? [])
  .filter((row) => row.X > 0 && row.Y > 0 && row.W > 0 && row.H > 0);
if (targetPeers.length < 5) throw new Error('insufficient target-page peers');

const pageStats = [...byPage]
  .map(([page, pageRows]) => {
    const valid = pageRows.filter((row) =>
      row.X > 0 && row.Y > 0 && row.W > 0 && row.H > 0);
    return valid.length >= 5
      ? {
        page,
        top: Math.min(...valid.map((row) => row.Y)),
        left: median(valid.map((row) => row.X)),
        right: median(valid.map((row) => row.X + row.W)),
      }
      : null;
  })
  .filter((value): value is NonNullable<typeof value> => value != null);
const localStats = pageStats.filter((stat) =>
  stat.page !== targetPage && Math.abs(stat.page - targetPage) <= 12);
if (localStats.length < 8) throw new Error('insufficient neighboring pages');
const top = Math.round(median(localStats.map((stat) => stat.top)));
const left = Math.round(median(targetPeers.map((row) => row.X)));
const right = Math.round(median(targetPeers.map((row) => row.X + row.W)));
const bottom = next.Y + (next.TLW > 0 && next.TLH > 0 ? next.TLH : 0);
const proposed = {
  uid: null,
  version,
  verseId,
  page: targetPage,
  pageWidth: Math.round(median(targetPeers.map((row) => row.pageWidth))),
  pageScale: Math.round(median(targetPeers.map((row) => row.pageScale))),
  X: left,
  Y: top,
  W: right - left,
  H: bottom - top,
  TLW: 0,
  TLH: 0,
  BRW: next.TLW > 0 && next.TLH > 0
    ? right - (next.X + next.TLW)
    : 0,
  BRH: next.TLW > 0 && next.TLH > 0 ? next.TLH : 0,
};

// Hold out each known page opener and predict its top from nearby pages.
const holdoutErrors: number[] = [];
for (const stat of pageStats) {
  const neighbors = pageStats.filter((candidate) =>
    candidate.page !== stat.page && Math.abs(candidate.page - stat.page) <= 12);
  if (neighbors.length < 8) continue;
  holdoutErrors.push(Math.abs(
    stat.top - Math.round(median(neighbors.map((candidate) => candidate.top))),
  ));
}
const valid = proposed.X >= 0 && proposed.Y >= 0 &&
  proposed.W > 0 && proposed.H > 0 &&
  proposed.X + proposed.W <= proposed.pageScale &&
  proposed.BRW >= 0 && proposed.BRW <= proposed.W &&
  proposed.BRH >= 0 && proposed.BRH <= proposed.H;
const validation = {
  holdouts: holdoutErrors.length,
  medianTopError: median(holdoutErrors),
  p95TopError: percentile(holdoutErrors, 0.95),
  targetTopDistanceFromMedian: Math.abs(
    top - median(localStats.map((stat) => stat.top)),
  ),
  canonicalTokens: (canonical.get(verseId) ?? '').split(/\s+/).filter(Boolean).length,
  valid,
};
const accepted = valid &&
  validation.holdouts >= 100 &&
  validation.medianTopError <= 10 &&
  validation.p95TopError <= 35;
const proposal = {
  version,
  verseId,
  selector: canonicalSelector([verseId]),
  sourceFlags: ['PAGE_OPENING_GEOMETRIC_GAP'],
  currentRows,
  outcome: accepted ? 'ACCEPTED_PAGE_GEOMETRY' : 'CONDITIONAL_PAGE_GEOMETRY',
  proposedRows: accepted ? [proposed] : undefined,
  validation,
  error: accepted ? null : 'holdout or geometry acceptance gate failed',
};
const report = {
  generatedAt: new Date().toISOString(),
  method: 'page-neighborhood holdout statistics + following-verse boundary',
  shadowFile,
  byOutcome: { [proposal.outcome]: 1 },
  proposals: [proposal],
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'line-ownership-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify({ outDir, proposal }, null, 2));
