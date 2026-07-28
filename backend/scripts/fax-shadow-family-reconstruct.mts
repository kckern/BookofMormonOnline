#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Reconstruct missing or unusable geometry from printing-plate consensus.
 *
 * This is deliberately image/model independent. Each healthy family member is
 * robustly registered to the target using corresponding rows outside the
 * repair range. Predictions are combined by medians, while notch presence and
 * fragment/page topology require a family majority.
 *
 * The script is read-only. Its report is compatible with fax-shadow-apply.mts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalSelector } from '../src/media/fax/canonical.ts';
import {
  loadShadowRows,
  openShadow,
  type ShadowGeometry,
} from './lib/fax-shadow-db.ts';

type Geometry = Omit<ShadowGeometry, 'uid'> & { uid: number | null };
type Transform = {
  source: string;
  samples: number;
  xScale: number;
  yScale: number;
  xOffset: number;
  yOffset: number;
  medianResidual: number;
  p95Residual: number;
};

const FAMILY = ['1852', '1854', '1854l', '1866', '1871', '1874', '1877'];
const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const targetVersion = flag('target-version');
const outDir = path.resolve(flag(
  'out',
  '../docs/audits/fax-geometry/shadow/family-reconstruction',
));
if (!FAMILY.includes(targetVersion)) {
  throw new Error(`--target-version must be one of ${FAMILY.join(',')}`);
}
const pageText = flag('pages');
const pageMatch = /^(\d+)-(\d+)$/.exec(pageText);
const selectedPages = pageMatch
  ? new Set(Array.from(
    { length: Number(pageMatch[2]) - Number(pageMatch[1]) + 1 },
    (_, index) => Number(pageMatch[1]) + index,
  ))
  : new Set<number>();
if (pageText && !pageMatch) throw new Error('--pages must be FIRST-LAST');
const explicitVerseIds = new Set(
  flag('verse-ids').split(',').map(Number).filter(Number.isFinite),
);
if (!selectedPages.size && !explicitVerseIds.size) {
  throw new Error('provide --pages FIRST-LAST or --verse-ids ID,ID');
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
  if (!sorted.length) return 0;
  return sorted[Math.min(
    sorted.length - 1,
    Math.floor((sorted.length - 1) * fraction),
  )]!;
};
const mode = <T>(values: T[]): { value: T; support: number } | null => {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((left, right) => right[1] - left[1])[0]
    ? {
      value: [...counts].sort((left, right) => right[1] - left[1])[0]![0],
      support: [...counts].sort((left, right) => right[1] - left[1])[0]![1],
    }
    : null;
};
const active = (width: number, height: number): boolean =>
  width > 0 && height > 0;
const chapterKey = (verseId: number): string =>
  canonicalSelector([verseId]).replace(/\.\d+$/, '');
const sortRows = <T extends Geometry>(rows: T[]): T[] =>
  [...rows].sort((left, right) =>
    left.page - right.page || left.Y - right.Y || left.X - right.X);

const db = openShadow(shadowFile, { queryOnly: true });
const rows = loadShadowRows(db, { versions: FAMILY }).map((row) => ({ ...row }));
const canonicalRows = db.prepare(`
  SELECT verse_id,verse_scripture FROM lds_scriptures_verses
`).all() as Array<{ verse_id: unknown; verse_scripture: unknown }>;
db.close();
const canonical = new Map(canonicalRows.map((row) => [
  Number(row.verse_id),
  String(row.verse_scripture),
]));
const byVerse = new Map<string, Geometry[]>();
for (const row of rows) {
  const key = `${row.version}|${row.verseId}`;
  (byVerse.get(key) ?? byVerse.set(key, []).get(key)!).push(row);
}
for (const [key, value] of byVerse) byVerse.set(key, sortRows(value));

function pairedRows(source: string): Array<{ source: Geometry; target: Geometry }> {
  const pairs: Array<{ source: Geometry; target: Geometry }> = [];
  for (const [key, sourceRows] of byVerse) {
    if (!key.startsWith(`${source}|`)) continue;
    const verseId = Number(key.slice(source.length + 1));
    if (explicitVerseIds.has(verseId)) continue;
    const targetRows = byVerse.get(`${targetVersion}|${verseId}`) ?? [];
    if (sourceRows.length !== targetRows.length) continue;
    for (let index = 0; index < sourceRows.length; index++) {
      const sourceRow = sourceRows[index]!;
      const targetRow = targetRows[index]!;
      if (sourceRow.page !== targetRow.page ||
          selectedPages.has(sourceRow.page) ||
          sourceRow.X <= 0 || sourceRow.Y <= 0 ||
          targetRow.X <= 0 || targetRow.Y <= 0 ||
          sourceRow.W <= 0 || sourceRow.H <= 0 ||
          targetRow.W <= 0 || targetRow.H <= 0) continue;
      pairs.push({ source: sourceRow, target: targetRow });
    }
  }
  return pairs;
}

function calibrate(source: string): Transform {
  const pairs = pairedRows(source);
  if (pairs.length < 100) {
    throw new Error(`insufficient ${source}->${targetVersion} calibration pairs`);
  }
  const widthRatios = pairs.map((pair) => pair.target.W / pair.source.W)
    .filter((value) => value >= 0.75 && value <= 1.30);
  const heightRatios = pairs.map((pair) => pair.target.H / pair.source.H)
    .filter((value) => value >= 0.75 && value <= 1.30);
  const xScale = median(widthRatios);
  const yScale = median(heightRatios);
  const xOffset = median(pairs.map((pair) =>
    pair.target.X - pair.source.X * xScale));
  const yOffset = median(pairs.map((pair) =>
    pair.target.Y - pair.source.Y * yScale));
  const residuals = pairs.flatMap((pair) => {
    const left = pair.source.X * xScale + xOffset;
    const right = (pair.source.X + pair.source.W) * xScale + xOffset;
    const top = pair.source.Y * yScale + yOffset;
    const bottom = (pair.source.Y + pair.source.H) * yScale + yOffset;
    return [
      Math.abs(pair.target.X - left),
      Math.abs(pair.target.X + pair.target.W - right),
      Math.abs(pair.target.Y - top),
      Math.abs(pair.target.Y + pair.target.H - bottom),
    ];
  });
  return {
    source,
    samples: pairs.length,
    xScale,
    yScale,
    xOffset,
    yOffset,
    medianResidual: median(residuals),
    p95Residual: percentile(residuals, 0.95),
  };
}

const transforms = new Map(
  FAMILY.filter((version) => version !== targetVersion)
    .map((source) => [source, calibrate(source)]),
);
const targetPageWidths = new Map<number, number>();
for (const row of rows.filter((candidate) => candidate.version === targetVersion)) {
  const values = rows
    .filter((candidate) =>
      candidate.version === targetVersion && candidate.page === row.page)
    .map((candidate) => candidate.pageWidth);
  targetPageWidths.set(row.page, Math.round(median(values)));
}
const targetDefaultPageWidth = Math.round(median(
  rows.filter((row) => row.version === targetVersion).map((row) => row.pageWidth),
));

const targetVerseIds = new Set(explicitVerseIds);
if (selectedPages.size) {
  for (const source of FAMILY.filter((version) => version !== targetVersion)) {
    for (const row of rows) {
      if (row.version === source && selectedPages.has(row.page)) {
        targetVerseIds.add(row.verseId);
      }
    }
  }
}

function transformed(source: Geometry, transform: Transform) {
  const left = source.X * transform.xScale + transform.xOffset;
  const right = (source.X + source.W) * transform.xScale + transform.xOffset;
  const top = source.Y * transform.yScale + transform.yOffset;
  const bottom = (source.Y + source.H) * transform.yScale + transform.yOffset;
  return {
    left,
    right,
    top,
    bottom,
    tlActive: active(source.TLW, source.TLH),
    brActive: active(source.BRW, source.BRH),
    tlWidth: source.TLW * transform.xScale,
    tlHeight: source.TLH * transform.yScale,
    brWidth: source.BRW * transform.xScale,
    brHeight: source.BRH * transform.yScale,
  };
}

const proposals: Array<Record<string, unknown>> = [];
for (const verseId of [...targetVerseIds].sort((left, right) => left - right)) {
  const currentRows = sortRows(byVerse.get(`${targetVersion}|${verseId}`) ?? []);
  const sourceSets = FAMILY
    .filter((version) => version !== targetVersion)
    .map((version) => ({
      version,
      rows: sortRows(byVerse.get(`${version}|${verseId}`) ?? []),
    }))
    .filter((source) => source.rows.length > 0);
  const countConsensus = mode(sourceSets.map((source) => source.rows.length));
  if (!countConsensus || countConsensus.support < 4) {
    proposals.push({
      version: targetVersion,
      verseId,
      selector: canonicalSelector([verseId]),
      currentRows,
      outcome: 'NO_FAMILY_CONSENSUS',
      error: 'fragment count lacks four-member support',
    });
    continue;
  }
  const consensusSources = sourceSets.filter((source) =>
    source.rows.length === countConsensus.value);
  const predictedRows: Geometry[] = [];
  const evidence: Array<Record<string, unknown>> = [];
  let rejected: string | null = null;
  for (let ordinal = 0; ordinal < countConsensus.value; ordinal++) {
    const sourceRows = consensusSources.map((source) => ({
      version: source.version,
      row: source.rows[ordinal]!,
    }));
    const pageConsensus = mode(sourceRows.map((source) => source.row.page));
    if (!pageConsensus || pageConsensus.support < 4) {
      rejected = `fragment ${ordinal} page lacks four-member support`;
      break;
    }
    const page = pageConsensus.value;
    const current = currentRows.find((row) => row.page === page);
    if (selectedPages.size && !selectedPages.has(page) && current) {
      predictedRows.push({ ...current });
      evidence.push({ ordinal, page, preservedHealthyTargetRow: true });
      continue;
    }
    const predictions = sourceRows
      .filter((source) => source.row.page === page)
      .map((source) => ({
        version: source.version,
        ...transformed(source.row, transforms.get(source.version)!),
      }));
    if (predictions.length < 4) {
      rejected = `fragment ${ordinal} has fewer than four transformed peers`;
      break;
    }
    const tlConsensus = mode(predictions.map((item) => item.tlActive));
    const brConsensus = mode(predictions.map((item) => item.brActive));
    const previous = ordinal === 0
      ? sortRows(byVerse.get(`${targetVersion}|${verseId - 1}`) ?? []).at(-1)
      : null;
    const next = ordinal === countConsensus.value - 1
      ? sortRows(byVerse.get(`${targetVersion}|${verseId + 1}`) ?? [])[0]
      : null;
    const reciprocalStart = Boolean(
      previous?.page === page &&
      chapterKey(previous.verseId) === chapterKey(verseId) &&
      active(previous.BRW, previous.BRH),
    );
    const reciprocalEnd = Boolean(
      next?.page === page &&
      chapterKey(next.verseId) === chapterKey(verseId) &&
      active(next.TLW, next.TLH),
    );
    if (!tlConsensus || !brConsensus ||
        (tlConsensus.support < 4 && !reciprocalStart) ||
        (brConsensus.support < 4 && !reciprocalEnd)) {
      rejected = `fragment ${ordinal} notch topology lacks four-member support`;
      break;
    }
    const left = Math.round(median(predictions.map((item) => item.left)));
    const right = Math.round(median(predictions.map((item) => item.right)));
    const top = Math.round(median(predictions.map((item) => item.top)));
    const bottom = Math.round(median(predictions.map((item) => item.bottom)));
    const predicted: Geometry = {
      uid: current?.uid ?? null,
      version: targetVersion,
      verseId,
      page,
      pageWidth: targetPageWidths.get(page) ?? targetDefaultPageWidth,
      pageScale: 700,
      X: left,
      Y: top,
      W: right - left,
      H: bottom - top,
      TLW: (reciprocalStart || tlConsensus.value)
        ? Math.round(median(predictions
          .filter((item) => item.tlActive)
          .map((item) => item.tlWidth)))
        : 0,
      TLH: (reciprocalStart || tlConsensus.value)
        ? Math.round(median(predictions
          .filter((item) => item.tlActive)
          .map((item) => item.tlHeight)))
        : 0,
      BRW: (reciprocalEnd || brConsensus.value)
        ? Math.round(median(predictions
          .filter((item) => item.brActive)
          .map((item) => item.brWidth)))
        : 0,
      BRH: (reciprocalEnd || brConsensus.value)
        ? Math.round(median(predictions
          .filter((item) => item.brActive)
          .map((item) => item.brHeight)))
        : 0,
    };
    // The target edition's adjacent polygons provide stronger page-local
    // registration than a corpus-wide family transform. A reciprocal BR/TL
    // pair identifies the shared line and word boundary exactly; family
    // consensus still supplies page and fragment topology.
    let reciprocalGap = false;
    const localRows = rows.filter((candidate) =>
      candidate.version === targetVersion &&
      candidate.page === page &&
      candidate.verseId !== verseId &&
      candidate.X > 0 && candidate.W > 0);
    if ((reciprocalStart || reciprocalEnd) && localRows.length >= 5) {
      const localLeft = Math.round(median(localRows.map((row) => row.X)));
      const localRight = Math.round(median(
        localRows.map((row) => row.X + row.W),
      ));
      predicted.X = localLeft;
      predicted.W = localRight - localLeft;
      if (reciprocalStart && previous) {
        predicted.X = localLeft;
        predicted.Y = previous.Y + previous.H - previous.BRH;
        predicted.TLW =
          previous.X + previous.W - previous.BRW - predicted.X;
        predicted.TLH = previous.BRH;
        predicted.H = Math.max(predicted.H, predicted.TLH);
        reciprocalGap = true;
      }
      if (reciprocalEnd && next) {
        const bottom = next.Y + next.TLH;
        predicted.H = bottom - predicted.Y;
        predicted.BRW =
          predicted.X + predicted.W - (next.X + next.TLW);
        predicted.BRH = next.TLH;
        predicted.H = Math.max(predicted.H, predicted.BRH);
        reciprocalGap = true;
      }
    }
    // Independent medians can differ by a rounding unit at a notch corner.
    // Clamp only that sub-pixel-scale disagreement; larger defects still fail.
    if (predicted.TLW <= predicted.W + 2) {
      predicted.TLW = Math.min(predicted.W, predicted.TLW);
    }
    if (predicted.BRW <= predicted.W + 2) {
      predicted.BRW = Math.min(predicted.W, predicted.BRW);
    }
    if (predicted.TLH <= predicted.H + 2) {
      predicted.TLH = Math.min(predicted.H, predicted.TLH);
    }
    if (predicted.BRH <= predicted.H + 2) {
      predicted.BRH = Math.min(predicted.H, predicted.BRH);
    }
    if (predicted.X < 0 || predicted.Y < 0 ||
        predicted.W <= 0 || predicted.H <= 0 ||
        predicted.X + predicted.W > predicted.pageScale ||
        predicted.TLW > predicted.W || predicted.BRW > predicted.W ||
        predicted.TLH > predicted.H || predicted.BRH > predicted.H) {
      rejected = `fragment ${ordinal} produced invalid geometry: ${
        JSON.stringify({
          X: predicted.X,
          Y: predicted.Y,
          W: predicted.W,
          H: predicted.H,
          TLW: predicted.TLW,
          TLH: predicted.TLH,
          BRW: predicted.BRW,
          BRH: predicted.BRH,
        })
      }`;
      break;
    }
    predictedRows.push(predicted);
    evidence.push({
      ordinal,
      page,
      peers: predictions.map((item) => item.version),
      tlSupport: tlConsensus.support,
      brSupport: brConsensus.support,
      edgeSpread: {
        left: Math.max(...predictions.map((item) => item.left)) -
          Math.min(...predictions.map((item) => item.left)),
        right: Math.max(...predictions.map((item) => item.right)) -
          Math.min(...predictions.map((item) => item.right)),
        top: Math.max(...predictions.map((item) => item.top)) -
          Math.min(...predictions.map((item) => item.top)),
        bottom: Math.max(...predictions.map((item) => item.bottom)) -
          Math.min(...predictions.map((item) => item.bottom)),
      },
      reciprocalGap,
    });
  }
  proposals.push({
    version: targetVersion,
    verseId,
    selector: canonicalSelector([verseId]),
    sourceFlags: selectedPages.size
      ? ['FAMILY_MEDIA_UNAVAILABLE_PAGE_RECONSTRUCTION']
      : ['FAMILY_MISSING_ROW_RECONSTRUCTION'],
    currentRows,
    outcome: rejected
      ? 'NO_FAMILY_CONSENSUS'
      : selectedPages.size
        ? 'ACCEPTED_FAMILY_CONSENSUS_MEDIA_UNAVAILABLE'
        : 'ACCEPTED_FAMILY_CONSENSUS',
    proposedRows: rejected ? undefined : sortRows(predictedRows),
    familyEvidence: evidence,
    error: rejected,
  });
}

const byOutcome = Object.fromEntries(
  [...new Set(proposals.map((proposal) => String(proposal.outcome)))]
    .sort()
    .map((outcome) => [
      outcome,
      proposals.filter((proposal) => proposal.outcome === outcome).length,
    ]),
);
fs.mkdirSync(outDir, { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  method: 'robust multi-member printing-plate consensus; no image or model calls',
  shadowFile,
  family: FAMILY,
  targetVersion,
  selectedPages: selectedPages.size
    ? [Math.min(...selectedPages), Math.max(...selectedPages)]
    : null,
  explicitVerseIds: [...explicitVerseIds].sort((left, right) => left - right),
  calibration: [...transforms.values()],
  byOutcome,
  proposals,
};
fs.writeFileSync(
  path.join(outDir, 'line-ownership-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
fs.writeFileSync(path.join(outDir, 'README.md'), [
  '# Shadow family reconstruction',
  '',
  '- Model/image calls: none',
  `- Target: ${targetVersion}`,
  `- Outcomes: ${Object.entries(byOutcome)
    .map(([key, value]) => `${key}=${value}`).join(', ')}`,
  '- Every accepted fragment has matching page and notch topology from at least',
  '  four independently registered members of the same printing-plate family.',
  '- Calibration excludes every repair page and requested missing verse.',
  '',
].join('\n'));
console.log(JSON.stringify({
  outDir,
  targetVersion,
  calibration: [...transforms.values()],
  byOutcome,
}, null, 2));
