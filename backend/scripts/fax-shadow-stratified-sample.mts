#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Select a deterministic, stratified render-QA sample from the actual
 * baseline -> live shadow delta.
 *
 * The output audit.json is intentionally compatible with
 * fax-shadow-candidate-qa.mts (`--codes STRATIFIED_SAMPLE`). This script does
 * not mutate the shadow database and does not call OCR, an LLM, or a vision
 * service.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalSelector } from '../src/media/fax/canonical.ts';
import {
  loadShadowRows,
  openShadow,
  type ShadowGeometry,
} from './lib/fax-shadow-db.ts';

type Stratum =
  | 'cross-page'
  | 'cross-column'
  | 'multi-fragment'
  | 'tl-notch'
  | 'br-notch'
  | 'insert-or-delete'
  | 'largest-delta'
  | 'random-control';

type Candidate = {
  key: string;
  version: string;
  verseId: number;
  selector: string;
  rows: ShadowGeometry[];
  baselineRows: ShadowGeometry[];
  changedUids: number[];
  deltaScore: number;
  tags: Set<Stratum>;
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const outDir = path.resolve(flag(
  'out',
  '../docs/audits/fax-geometry/shadow/stratified-delta-sample',
));
const perVersion = Math.max(
  5,
  Math.min(10, Number(flag('per-version', '8')) || 8),
);
const seed = flag('seed', '20260726-shadow-delta');
const requestedVersions = new Set(
  flag('versions', '').split(',').map((value) => value.trim()).filter(Boolean),
);

const fields: Array<keyof Omit<ShadowGeometry, 'uid'>> = [
  'version', 'verseId', 'page', 'pageWidth', 'pageScale',
  'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH',
];
const same = (left: ShadowGeometry, right: ShadowGeometry): boolean =>
  fields.every((field) => left[field] === right[field]);
const keyFor = (version: string, verseId: number): string =>
  `${version}|${verseId}`;
const pushByPair = (
  target: Map<string, ShadowGeometry[]>,
  row: ShadowGeometry,
): void => {
  const key = keyFor(row.version, row.verseId);
  const rows = target.get(key) ?? [];
  rows.push(row);
  target.set(key, rows);
};
const notchActive = (width: number, height: number): boolean =>
  width > 1 && height > 0;

const db = openShadow(shadowFile, { queryOnly: true });
const currentRows = loadShadowRows(db);
const baselineRows = (db.prepare(`
  SELECT uid,version,verse_id,page,pageWidth,pageScale,X,Y,W,H,TLW,TLH,BRW,BRH
  FROM fax_index_baseline
  ORDER BY version,verse_id,page,Y,X,uid
`).all() as Array<Record<string, unknown>>).map((row): ShadowGeometry => ({
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
db.close();

const currentByUid = new Map(currentRows.map((row) => [row.uid, row]));
const baselineByUid = new Map(baselineRows.map((row) => [row.uid, row]));
const currentByPair = new Map<string, ShadowGeometry[]>();
const baselineByPair = new Map<string, ShadowGeometry[]>();
for (const row of currentRows) pushByPair(currentByPair, row);
for (const row of baselineRows) pushByPair(baselineByPair, row);

const changedPairs = new Set<string>();
const changedUidsByPair = new Map<string, Set<number>>();
const mark = (row: ShadowGeometry): void => {
  const key = keyFor(row.version, row.verseId);
  changedPairs.add(key);
  const uids = changedUidsByPair.get(key) ?? new Set<number>();
  uids.add(row.uid);
  changedUidsByPair.set(key, uids);
};
for (const uid of new Set([...baselineByUid.keys(), ...currentByUid.keys()])) {
  const before = baselineByUid.get(uid);
  const after = currentByUid.get(uid);
  if (before && after && same(before, after)) continue;
  if (before) mark(before);
  if (after) mark(after);
}

function geometryDelta(
  before: ShadowGeometry | undefined,
  after: ShadowGeometry | undefined,
): number {
  if (!before || !after) return 20;
  const scale = Math.max(1, before.pageScale, after.pageScale);
  const numeric = [
    Math.abs(before.page - after.page) * scale,
    Math.abs(before.X - after.X),
    Math.abs(before.Y - after.Y),
    Math.abs(before.W - after.W),
    Math.abs(before.H - after.H),
    Math.abs(before.TLW - after.TLW),
    Math.abs(before.TLH - after.TLH),
    Math.abs(before.BRW - after.BRW),
    Math.abs(before.BRH - after.BRH),
  ];
  return numeric.reduce((sum, value) => sum + value / scale, 0);
}

const candidates: Candidate[] = [];
const deletedOnly: Array<{ version: string; verseId: number; selector: string }> = [];
for (const key of changedPairs) {
  const [version, verseIdText] = key.split('|');
  const verseId = Number(verseIdText);
  if (requestedVersions.size && !requestedVersions.has(version!)) continue;
  const rows = currentByPair.get(key) ?? [];
  const beforeRows = baselineByPair.get(key) ?? [];
  if (!rows.length) {
    deletedOnly.push({
      version: version!,
      verseId,
      selector: canonicalSelector([verseId]),
    });
    continue;
  }
  const changedUids = [...(changedUidsByPair.get(key) ?? [])].sort((a, b) => a - b);
  let deltaScore = 0;
  for (const uid of changedUids) {
    deltaScore += geometryDelta(baselineByUid.get(uid), currentByUid.get(uid));
  }
  const tags = new Set<Stratum>();
  if (rows.length > 1) tags.add('multi-fragment');
  if (new Set(rows.map((row) => row.page)).size > 1) tags.add('cross-page');
  if (rows.some((row) => notchActive(row.TLW, row.TLH))) tags.add('tl-notch');
  if (rows.some((row) => notchActive(row.BRW, row.BRH))) tags.add('br-notch');
  if (changedUids.some((uid) =>
    !baselineByUid.has(uid) || !currentByUid.has(uid))) {
    tags.add('insert-or-delete');
  }
  const byPage = new Map<number, ShadowGeometry[]>();
  for (const row of rows) {
    const pageRows = byPage.get(row.page) ?? [];
    pageRows.push(row);
    byPage.set(row.page, pageRows);
  }
  if ([...byPage.values()].some((pageRows) =>
    pageRows.some((left, leftIndex) => pageRows.some((right, rightIndex) =>
      rightIndex > leftIndex &&
      Math.abs((left.X + left.W / 2) - (right.X + right.W / 2)) >=
        Math.min(left.pageScale, right.pageScale) * 0.25)))) {
    tags.add('cross-column');
  }
  candidates.push({
    key,
    version: version!,
    verseId,
    selector: canonicalSelector([verseId]),
    rows,
    baselineRows: beforeRows,
    changedUids,
    deltaScore,
    tags,
  });
}

const stableScore = (candidate: Candidate, stratum: Stratum): string =>
  crypto.createHash('sha256')
    .update(`${seed}|${candidate.version}|${stratum}|${candidate.verseId}`)
    .digest('hex');
const strata: Stratum[] = [
  'cross-page',
  'cross-column',
  'multi-fragment',
  'tl-notch',
  'br-notch',
  'insert-or-delete',
  'largest-delta',
  'random-control',
];

const affectedVersions = [...new Set(candidates.map((candidate) =>
  candidate.version))].sort((left, right) =>
  left.localeCompare(right, undefined, { numeric: true }));
const samples: Candidate[] = [];
for (const version of affectedVersions) {
  const pool = candidates.filter((candidate) => candidate.version === version);
  const selected: Candidate[] = [];
  const selectedKeys = new Set<string>();
  for (const stratum of strata) {
    if (selected.length >= perVersion) break;
    let eligible = pool.filter((candidate) => !selectedKeys.has(candidate.key));
    if (stratum === 'largest-delta') {
      eligible.sort((left, right) =>
        right.deltaScore - left.deltaScore ||
        stableScore(left, stratum).localeCompare(stableScore(right, stratum)));
    } else if (stratum === 'random-control') {
      eligible.sort((left, right) =>
        stableScore(left, stratum).localeCompare(stableScore(right, stratum)));
    } else {
      eligible = eligible
        .filter((candidate) => candidate.tags.has(stratum))
        .sort((left, right) =>
          stableScore(left, stratum).localeCompare(stableScore(right, stratum)));
    }
    const chosen = eligible[0];
    if (!chosen) continue;
    chosen.tags.add(stratum);
    selected.push(chosen);
    selectedKeys.add(chosen.key);
  }
  if (selected.length < perVersion) {
    const fill = pool
      .filter((candidate) => !selectedKeys.has(candidate.key))
      .sort((left, right) =>
        stableScore(left, 'random-control').localeCompare(
          stableScore(right, 'random-control'),
        ));
    for (const candidate of fill) {
      if (selected.length >= perVersion) break;
      candidate.tags.add('random-control');
      selected.push(candidate);
      selectedKeys.add(candidate.key);
    }
  }
  samples.push(...selected);
}

const findings = samples.map((candidate) => ({
  severity: 'critical',
  code: 'STRATIFIED_SAMPLE',
  message: 'Deterministic stratified sample from baseline-to-shadow delta',
  version: candidate.version,
  verseId: candidate.verseId,
  page: Math.min(...candidate.rows.map((row) => row.page)),
  details: {
    selector: candidate.selector,
    tags: [...candidate.tags].sort(),
    deltaScore: candidate.deltaScore,
    changedUids: candidate.changedUids,
    rowCount: candidate.rows.length,
    pageCount: new Set(candidate.rows.map((row) => row.page)).size,
  },
}));
const report = {
  generatedAt: new Date().toISOString(),
  method: 'deterministic stratified sampling of baseline-to-shadow geometry delta',
  shadowFile,
  seed,
  perVersion,
  counts: {
    baselineRows: baselineRows.length,
    currentRows: currentRows.length,
    changedPairs: changedPairs.size,
    renderableChangedPairs: candidates.length,
    deletedOnlyPairs: deletedOnly.length,
    affectedVersions: affectedVersions.length,
    samples: samples.length,
  },
  affectedVersions,
  strata,
  deletedOnly,
  samples: samples.map((candidate) => ({
    version: candidate.version,
    verseId: candidate.verseId,
    selector: candidate.selector,
    tags: [...candidate.tags].sort(),
    deltaScore: candidate.deltaScore,
    changedUids: candidate.changedUids,
    baselineRows: candidate.baselineRows,
    currentRows: candidate.rows,
  })),
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'audit.json'),
  `${JSON.stringify({ ...report, findings }, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(outDir, 'sample-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify({
  outDir,
  ...report.counts,
  sampleCounts: Object.fromEntries(affectedVersions.map((version) => [
    version,
    samples.filter((candidate) => candidate.version === version).length,
  ])),
}, null, 2));
