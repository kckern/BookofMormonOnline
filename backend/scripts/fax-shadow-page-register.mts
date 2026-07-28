#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Register printing-plate geometry to a derivative edition one source page at
 * a time.
 *
 * This is deterministic and model-free. Local Tesseract TSV words establish
 * exact n-gram correspondences between the source and target scans. Robust
 * per-page x/y transforms are accepted only when match coverage and residuals
 * pass fixed gates. A bounded target-image search detects duplicate, missing,
 * or misordered scan leaves.
 *
 * The script is read-only with respect to SQLite. Its output is compatible
 * with fax-shadow-apply.mts.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { canonicalSelector } from '../src/media/fax/canonical.ts';
import { normalizeWord } from './lib/fax-render-content-qa.ts';
import {
  loadShadowRows,
  openShadow,
  type ShadowGeometry,
} from './lib/fax-shadow-db.ts';

const execFileAsync = promisify(execFile);

type Registry = {
  version: string;
  format: string;
  offset: number;
};
type OcrWord = {
  normalized: string;
  left: number;
  top: number;
  width: number;
  height: number;
  lineKey: string;
};
type OcrPage = {
  version: string;
  imagePage: number;
  file: string;
  width: number;
  height: number;
  words: OcrWord[];
};
type Match = { sourceIndex: number; targetIndex: number };
type LinearFit = {
  scale: number;
  offset: number;
  observations: number;
  medianResidual: number;
  p95Residual: number;
  maxResidual: number;
};
type Registration = {
  storedPage: number;
  sourceImagePage: number;
  targetImagePage: number;
  expectedTargetImagePage: number;
  sourceWords: number;
  targetWords: number;
  matchedWords: number;
  sourceCoverage: number;
  targetCoverage: number;
  x: LinearFit;
  y: LinearFit;
  yKnots: Array<{ source: number; target: number; matches: number }>;
  lineMappings: Array<{
    sourceKey: string;
    targetKey: string;
    sourceCenter: number;
    targetCenter: number;
    matches: number;
  }>;
  yLocalP95: number;
  accepted: boolean;
  rejection: string[];
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const sourceVersion = flag('source-version');
const targetVersion = flag('target-version');
const mediaCache = path.resolve(flag(
  'media-cache',
  path.join(path.dirname(shadowFile), 'media'),
));
const ocrCache = path.resolve(flag(
  'ocr-cache',
  path.join(path.dirname(shadowFile), 'page-ocr'),
));
const outDir = path.resolve(flag(
  'out',
  '../docs/audits/fax-geometry/shadow/page-registration',
));
const searchRadius = Math.max(
  0,
  Math.min(24, Number(flag('search-radius', '16')) || 0),
);
const concurrency = Math.max(
  1,
  Math.min(8, Number(flag('concurrency', '4')) || 4),
);
const horizontalPad = Math.max(
  0,
  Math.min(48, Number(flag('horizontal-pad', '2')) || 0),
);
const verticalPad = Math.max(
  0,
  Math.min(24, Number(flag('vertical-pad', '2')) || 0),
);
const minYScale = Math.max(
  0.5,
  Math.min(1.5, Number(flag('min-y-scale', '0.85')) || 0.85),
);
const maxYScale = Math.max(
  0.5,
  Math.min(1.5, Number(flag('max-y-scale', '1.15')) || 1.15),
);
if (minYScale >= maxYScale) {
  throw new Error('--min-y-scale must be less than --max-y-scale');
}
if (!sourceVersion || !targetVersion || sourceVersion === targetVersion) {
  throw new Error(
    '--source-version and distinct --target-version are required',
  );
}

function selectedPages(spec: string): Set<number> | null {
  if (!spec.trim()) return null;
  const selected = new Set<number>();
  for (const part of spec.split(',').map((value) => value.trim())) {
    const range = /^(\d+)-(\d+)$/.exec(part);
    if (range) {
      for (let page = Number(range[1]); page <= Number(range[2]); page++) {
        selected.add(page);
      }
      continue;
    }
    const page = Number(part);
    if (!Number.isInteger(page)) throw new Error(`invalid --pages item ${part}`);
    selected.add(page);
  }
  return selected;
}
const requestedPages = selectedPages(flag('pages'));

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  return sorted[Math.min(
    sorted.length - 1,
    Math.floor((sorted.length - 1) * fraction),
  )]!;
}

async function mapConcurrent<T, R>(
  values: T[],
  limit: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from(
    { length: Math.min(limit, values.length) },
    async () => {
      while (true) {
        const index = cursor++;
        if (index >= values.length) return;
        output[index] = await worker(values[index]!, index);
      }
    },
  ));
  return output;
}

const db = openShadow(shadowFile, { queryOnly: true });
const rows = loadShadowRows(db, {
  versions: [sourceVersion, targetVersion],
});
const rawRegistry = db.prepare(`
  SELECT slug,pgfirstVerse,format
  FROM bom_xtras_fax
  WHERE slug IN (?,?)
`).all(sourceVersion, targetVersion) as Array<{
  slug: unknown;
  pgfirstVerse: unknown;
  format: unknown;
}>;
db.close();

const versionRows = new Map([
  [sourceVersion, rows.filter((row) => row.version === sourceVersion)],
  [targetVersion, rows.filter((row) => row.version === targetVersion)],
]);
const registry = new Map<string, Registry>();
for (const raw of rawRegistry) {
  const version = String(raw.slug);
  const owned = versionRows.get(version) ?? [];
  registry.set(version, {
    version,
    format: String(raw.format || '').trim() || 'jpg',
    offset: Number(raw.pgfirstVerse ?? 1) -
      Math.min(...owned.map((row) => row.page)),
  });
}
if (!registry.has(sourceVersion) || !registry.has(targetVersion)) {
  throw new Error('source or target registry metadata is missing');
}

const rowsByVersionPage = new Map<string, ShadowGeometry[]>();
const rowsByVersionVerse = new Map<string, ShadowGeometry[]>();
for (const row of rows) {
  const pageKey = `${row.version}|${row.page}`;
  const verseKey = `${row.version}|${row.verseId}`;
  (rowsByVersionPage.get(pageKey) ??
    rowsByVersionPage.set(pageKey, []).get(pageKey)!).push(row);
  (rowsByVersionVerse.get(verseKey) ??
    rowsByVersionVerse.set(verseKey, []).get(verseKey)!).push(row);
}
const sourcePages = [...new Set(
  (versionRows.get(sourceVersion) ?? []).map((row) => row.page),
)]
  .filter((page) =>
    rowsByVersionPage.has(`${targetVersion}|${page}`) &&
    (!requestedPages || requestedPages.has(page)))
  .sort((left, right) => left - right);

function imageFile(version: string, imagePage: number): string {
  const meta = registry.get(version)!;
  return path.join(
    mediaCache,
    version,
    `${String(imagePage).padStart(3, '0')}.${meta.format}`,
  );
}

async function ensureImage(version: string, imagePage: number): Promise<string> {
  const file = imageFile(version, imagePage);
  if (fs.existsSync(file)) return file;
  const meta = registry.get(version)!;
  const url = `https://media.bookofmormon.online/fax/pages/${version}/` +
    `${String(imagePage).padStart(3, '0')}.${meta.format}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`scan fetch failed ${response.status} ${url}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

const ocrPromises = new Map<string, Promise<OcrPage>>();
const resolvedOcrPages = new Map<string, OcrPage>();
async function ocrPage(version: string, imagePage: number): Promise<OcrPage> {
  const key = `${version}|${imagePage}`;
  let promise = ocrPromises.get(key);
  if (!promise) {
    promise = (async () => {
      const file = await ensureImage(version, imagePage);
      const cacheFile = path.join(
        ocrCache,
        version,
        `${String(imagePage).padStart(3, '0')}.psm3.tsv`,
      );
      let tsv: string;
      if (fs.existsSync(cacheFile)) {
        tsv = fs.readFileSync(cacheFile, 'utf8');
      } else {
        const result = await execFileAsync(
          'tesseract',
          [file, 'stdout', '-l', 'eng', '--psm', '3', 'tsv'],
          { maxBuffer: 16 * 1024 * 1024 },
        );
        tsv = result.stdout;
        fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
        fs.writeFileSync(cacheFile, tsv);
      }
      const metadata = await sharp(file).metadata();
      const words: OcrWord[] = [];
      for (const line of tsv.split(/\r?\n/).slice(1)) {
        const fields = line.split('\t');
        if (fields.length < 12 || fields[0] !== '5') continue;
        const normalized = normalizeWord(fields.slice(11).join('\t'));
        if (!normalized) continue;
        words.push({
          normalized,
          left: Number(fields[6]),
          top: Number(fields[7]),
          width: Number(fields[8]),
          height: Number(fields[9]),
          lineKey: `${fields[2]}|${fields[3]}|${fields[4]}`,
        });
      }
      const page = {
        version,
        imagePage,
        file,
        width: metadata.width!,
        height: metadata.height!,
        words,
      };
      resolvedOcrPages.set(key, page);
      return page;
    })();
    ocrPromises.set(key, promise);
  }
  return promise;
}

function ngramMatches(source: OcrPage, target: OcrPage): Match[] {
  const pairVotes = new Map<string, { match: Match; votes: number }>();
  for (const n of [5, 4, 3]) {
    const sourceIndex = new Map<string, number[]>();
    const targetIndex = new Map<string, number[]>();
    const index = (page: OcrPage, output: Map<string, number[]>) => {
      for (let start = 0; start <= page.words.length - n; start++) {
        const key = page.words.slice(start, start + n)
          .map((word) => word.normalized)
          .join(' ');
        const offsets = output.get(key) ?? [];
        offsets.push(start);
        output.set(key, offsets);
      }
    };
    index(source, sourceIndex);
    index(target, targetIndex);
    for (const [key, sourceStarts] of sourceIndex) {
      const targetStarts = targetIndex.get(key);
      if (sourceStarts.length !== 1 || targetStarts?.length !== 1) continue;
      for (let offset = 0; offset < n; offset++) {
        const match = {
          sourceIndex: sourceStarts[0]! + offset,
          targetIndex: targetStarts[0]! + offset,
        };
        const pairKey = `${match.sourceIndex}|${match.targetIndex}`;
        const prior = pairVotes.get(pairKey);
        pairVotes.set(pairKey, {
          match,
          votes: (prior?.votes ?? 0) + 1,
        });
      }
    }
    if (new Set(
      [...pairVotes.values()].map((item) => item.match.sourceIndex),
    ).size >= 60) break;
  }
  // Overlapping n-grams vote for the same word pair. Resolve each source and
  // target token to its strongest correspondence before enforcing monotonic
  // reading order; otherwise duplicate source indices can corrupt the LIS.
  const bySource = new Map<number, Array<{ match: Match; votes: number }>>();
  for (const item of pairVotes.values()) {
    const candidates = bySource.get(item.match.sourceIndex) ?? [];
    candidates.push(item);
    bySource.set(item.match.sourceIndex, candidates);
  }
  const sourceUnique = [...bySource.values()].map((candidates) =>
    candidates.sort((left, right) =>
      right.votes - left.votes ||
      left.match.targetIndex - right.match.targetIndex)[0]!);
  const byTarget = new Map<number, Array<{ match: Match; votes: number }>>();
  for (const item of sourceUnique) {
    const candidates = byTarget.get(item.match.targetIndex) ?? [];
    candidates.push(item);
    byTarget.set(item.match.targetIndex, candidates);
  }
  const deduped = [...byTarget.values()].map((candidates) =>
    candidates.sort((left, right) =>
      right.votes - left.votes ||
      left.match.sourceIndex - right.match.sourceIndex)[0]!.match)
    .sort((left, right) =>
    left.sourceIndex - right.sourceIndex ||
    left.targetIndex - right.targetIndex);

  // Longest increasing subsequence removes accidental repeated-text matches
  // while preserving reading order.
  const tails: number[] = [];
  const tailIndices: number[] = [];
  const previous = new Array<number>(deduped.length).fill(-1);
  for (let index = 0; index < deduped.length; index++) {
    const value = deduped[index]!.targetIndex;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (tails[middle]! < value) low = middle + 1;
      else high = middle;
    }
    tails[low] = value;
    previous[index] = low > 0 ? tailIndices[low - 1]! : -1;
    tailIndices[low] = index;
  }
  const selected: Match[] = [];
  let cursor = tailIndices.at(-1) ?? -1;
  while (cursor >= 0) {
    selected.push(deduped[cursor]!);
    cursor = previous[cursor]!;
  }
  return selected.reverse();
}

function simpleFit(points: Array<{ source: number; target: number }>): {
  scale: number;
  offset: number;
} {
  const sourceMean =
    points.reduce((sum, point) => sum + point.source, 0) / points.length;
  const targetMean =
    points.reduce((sum, point) => sum + point.target, 0) / points.length;
  const numerator = points.reduce((sum, point) =>
    sum + (point.source - sourceMean) * (point.target - targetMean), 0);
  const denominator = points.reduce((sum, point) =>
    sum + (point.source - sourceMean) ** 2, 0);
  const scale = denominator > 0 ? numerator / denominator : 1;
  return { scale, offset: targetMean - scale * sourceMean };
}

function robustFit(
  initial: Array<{ source: number; target: number }>,
): LinearFit {
  let points = [...initial];
  for (let iteration = 0; iteration < 5 && points.length >= 12; iteration++) {
    const fit = simpleFit(points);
    const residuals = points.map((point) =>
      Math.abs(point.target - (point.source * fit.scale + fit.offset)));
    const center = median(residuals);
    const mad = median(residuals.map((value) => Math.abs(value - center)));
    const threshold = Math.max(1.5, center + 4 * 1.4826 * mad);
    const filtered = points.filter((point) =>
      Math.abs(point.target - (point.source * fit.scale + fit.offset)) <=
      threshold);
    if (filtered.length === points.length || filtered.length < 12) break;
    points = filtered;
  }
  const fit = simpleFit(points);
  const residuals = points.map((point) =>
    Math.abs(point.target - (point.source * fit.scale + fit.offset)));
  return {
    ...fit,
    observations: points.length,
    medianResidual: median(residuals),
    p95Residual: percentile(residuals, 0.95),
    maxResidual: Math.max(0, ...residuals),
  };
}

function lineYKnots(
  source: OcrPage,
  target: OcrPage,
  matches: Match[],
): Array<{ source: number; target: number; matches: number }> {
  const groups = new Map<string, {
    sourceKey: string;
    targetKey: string;
    source: number[];
    target: number[];
  }>();
  for (const match of matches) {
    const from = source.words[match.sourceIndex]!;
    const to = target.words[match.targetIndex]!;
    const key = `${from.lineKey}|${to.lineKey}`;
    const group = groups.get(key) ?? {
      sourceKey: from.lineKey,
      targetKey: to.lineKey,
      source: [],
      target: [],
    };
    group.source.push(
      (from.top + from.height / 2) / source.width * 700,
    );
    group.target.push(
      (to.top + to.height / 2) / target.width * 700,
    );
    groups.set(key, group);
  }
  const strongestBySource = new Map<string, typeof groups extends Map<
    string,
    infer Value
  > ? Value : never>();
  for (const group of groups.values()) {
    if (group.source.length < 2) continue;
    const prior = strongestBySource.get(group.sourceKey);
    if (!prior || group.source.length > prior.source.length) {
      strongestBySource.set(group.sourceKey, group);
    }
  }
  const strongestByTarget = new Map<string, {
    sourceKey: string;
    targetKey: string;
    source: number[];
    target: number[];
  }>();
  for (const group of strongestBySource.values()) {
    const prior = strongestByTarget.get(group.targetKey);
    if (!prior || group.source.length > prior.source.length) {
      strongestByTarget.set(group.targetKey, group);
    }
  }
  const ordered = [...strongestByTarget.values()]
    .map((group) => ({
      source: median(group.source),
      target: median(group.target),
      matches: group.source.length,
    }))
    .sort((left, right) => left.source - right.source);
  const monotonic: typeof ordered = [];
  for (const knot of ordered) {
    if (!monotonic.length || knot.target > monotonic.at(-1)!.target) {
      monotonic.push(knot);
    }
  }
  return monotonic;
}

function matchedLineMappings(
  source: OcrPage,
  target: OcrPage,
  matches: Match[],
): Registration['lineMappings'] {
  const groups = new Map<string, {
    sourceKey: string;
    targetKey: string;
    source: number[];
    target: number[];
  }>();
  for (const match of matches) {
    const from = source.words[match.sourceIndex]!;
    const to = target.words[match.targetIndex]!;
    const key = `${from.lineKey}|${to.lineKey}`;
    const group = groups.get(key) ?? {
      sourceKey: from.lineKey,
      targetKey: to.lineKey,
      source: [],
      target: [],
    };
    group.source.push(
      (from.top + from.height / 2) / source.width * 700,
    );
    group.target.push(
      (to.top + to.height / 2) / target.width * 700,
    );
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((group) => group.source.length >= 2)
    .map((group) => ({
      sourceKey: group.sourceKey,
      targetKey: group.targetKey,
      sourceCenter: median(group.source),
      targetCenter: median(group.target),
      matches: group.source.length,
    }))
    .sort((left, right) =>
      left.sourceCenter - right.sourceCenter ||
      left.targetCenter - right.targetCenter);
}

function mappedYFrom(
  knots: Registration['yKnots'],
  fallback: LinearFit,
  value: number,
): number {
  if (knots.length < 2) {
    return value * fallback.scale + fallback.offset;
  }
  let upper = knots.findIndex((knot) => knot.source >= value);
  if (upper < 0) upper = knots.length - 1;
  let lower = Math.max(0, upper - 1);
  if (upper === 0) {
    lower = 0;
    upper = 1;
  }
  const before = knots[lower]!;
  const after = knots[upper]!;
  const scale = (after.target - before.target) /
    Math.max(0.001, after.source - before.source);
  return before.target + (value - before.source) * scale;
}

function mappedY(registration: Registration, value: number): number {
  return mappedYFrom(registration.yKnots, registration.y, value);
}

function register(
  storedPage: number,
  source: OcrPage,
  target: OcrPage,
  expectedTargetImagePage: number,
): Registration {
  const matches = ngramMatches(source, target);
  const xPoints = matches.flatMap((match) => {
    const from = source.words[match.sourceIndex]!;
    const to = target.words[match.targetIndex]!;
    return [
      {
        source: from.left / source.width * 700,
        target: to.left / target.width * 700,
      },
      {
        source: (from.left + from.width) / source.width * 700,
        target: (to.left + to.width) / target.width * 700,
      },
    ];
  });
  const yPoints = matches.flatMap((match) => {
    const from = source.words[match.sourceIndex]!;
    const to = target.words[match.targetIndex]!;
    return [
      {
        source: from.top / source.width * 700,
        target: to.top / target.width * 700,
      },
      {
        source: (from.top + from.height) / source.width * 700,
        target: (to.top + to.height) / target.width * 700,
      },
    ];
  });
  const x = robustFit(xPoints.length ? xPoints : [
    { source: 0, target: 0 },
    { source: 700, target: 700 },
  ]);
  const y = robustFit(yPoints.length ? yPoints : [
    { source: 0, target: 0 },
    { source: 700, target: 700 },
  ]);
  const yKnots = lineYKnots(source, target, matches);
  const lineMappings = matchedLineMappings(source, target, matches);
  const yLocalP95 = percentile(matches.map((match) => {
    const from = source.words[match.sourceIndex]!;
    const to = target.words[match.targetIndex]!;
    const sourceCenter =
      (from.top + from.height / 2) / source.width * 700;
    const targetCenter =
      (to.top + to.height / 2) / target.width * 700;
    return Math.abs(targetCenter - mappedYFrom(yKnots, y, sourceCenter));
  }), 0.95);
  const sourceCoverage = matches.length / Math.max(1, source.words.length);
  const targetCoverage = matches.length / Math.max(1, target.words.length);
  const rejection: string[] = [];
  if (matches.length < 35) rejection.push('insufficient-matched-words');
  if (sourceCoverage < 0.08) rejection.push('insufficient-source-coverage');
  if (targetCoverage < 0.08) rejection.push('insufficient-target-coverage');
  if (y.scale < minYScale || y.scale > maxYScale) {
    rejection.push('y-scale-outlier');
  }
  if (yKnots.length < 8) rejection.push('insufficient-line-knots');
  return {
    storedPage,
    sourceImagePage: source.imagePage,
    targetImagePage: target.imagePage,
    expectedTargetImagePage,
    sourceWords: source.words.length,
    targetWords: target.words.length,
    matchedWords: matches.length,
    sourceCoverage,
    targetCoverage,
    x,
    y,
    yKnots,
    lineMappings,
    yLocalP95,
    accepted: rejection.length === 0,
    rejection,
  };
}

function registrationRank(registration: Registration): number {
  return registration.matchedWords * 100 -
    registration.yLocalP95 * 10 -
    Math.abs(
      registration.targetImagePage - registration.expectedTargetImagePage,
    ) * 0.1;
}

async function bestRegistration(storedPage: number): Promise<Registration> {
  const sourceMeta = registry.get(sourceVersion)!;
  const targetMeta = registry.get(targetVersion)!;
  const sourceImagePage = storedPage + sourceMeta.offset;
  const expectedTargetImagePage = storedPage + targetMeta.offset;
  const source = await ocrPage(sourceVersion, sourceImagePage);
  const expectedTarget = await ocrPage(targetVersion, expectedTargetImagePage);
  const expected = register(
    storedPage,
    source,
    expectedTarget,
    expectedTargetImagePage,
  );
  if (expected.accepted || searchRadius === 0) return expected;
  const candidates = (
    await Promise.all(
      Array.from({ length: searchRadius * 2 + 1 }, (_, index) =>
        expectedTargetImagePage - searchRadius + index)
        .filter((imagePage) => imagePage > 0)
        .map(async (imagePage) => {
          try {
            const target = await ocrPage(targetVersion, imagePage);
            return register(
              storedPage,
              source,
              target,
              expectedTargetImagePage,
            );
          } catch {
            return null;
          }
        }),
    )
  ).filter((value): value is Registration => value != null);
  return candidates.sort((left, right) =>
    Number(right.accepted) - Number(left.accepted) ||
    registrationRank(right) - registrationRank(left))[0] ?? expected;
}

const registrations = await mapConcurrent(
  sourcePages,
  concurrency,
  async (storedPage, index) => {
    const result = await bestRegistration(storedPage);
    console.error(JSON.stringify({
      progress: `${index + 1}/${sourcePages.length}`,
      storedPage,
      sourceImagePage: result.sourceImagePage,
      targetImagePage: result.targetImagePage,
      expectedTargetImagePage: result.expectedTargetImagePage,
      matchedWords: result.matchedWords,
      xP95: Number(result.x.p95Residual.toFixed(2)),
      yP95: Number(result.y.p95Residual.toFixed(2)),
      accepted: result.accepted,
      rejection: result.rejection,
    }));
    return result;
  },
);
const registrationByPage = new Map(
  registrations
    .filter((registration) => registration.accepted)
    .map((registration) => [registration.storedPage, registration]),
);

function transformRow(
  source: ShadowGeometry,
  target: ShadowGeometry,
  registration: Registration,
): { row: ShadowGeometry; snappedWords: number } | null {
  const mapX = (value: number) =>
    value * registration.x.scale + registration.x.offset;
  const mapY = (value: number) => mappedY(registration, value);
  const sourcePage = resolvedOcrPages.get(
    `${sourceVersion}|${registration.sourceImagePage}`,
  );
  const targetPage = resolvedOcrPages.get(
    `${targetVersion}|${registration.targetImagePage}`,
  );
  if (!sourcePage || !targetPage) return null;
  const pageLines = (page: OcrPage) => {
    const words = page.words.map((word) => ({
      lineKey: word.lineKey,
      left: word.left / page.width * 700,
      right: (word.left + word.width) / page.width * 700,
      top: word.top / page.width * 700,
      bottom: (word.top + word.height) / page.width * 700,
    }));
    const byLine = new Map<string, typeof words>();
    for (const word of words) {
      const line = byLine.get(word.lineKey) ?? [];
      line.push(word);
      byLine.set(word.lineKey, line);
    }
    return new Map([...byLine].map(([key, line]) => {
      const medianHeight = median(line.map((word) => word.bottom - word.top));
      const normal = line.filter((word) =>
        word.bottom - word.top <= Math.max(1, medianHeight) * 1.60);
      return [key, normal.length ? normal : line];
    }));
  };
  const sourceLines = pageLines(sourcePage);
  const targetLines = pageLines(targetPage);
  const selectedSourceKeys = new Set(
    [...sourceLines]
      .filter(([, line]) => {
        const centerY = median(line.map((word) =>
          (word.top + word.bottom) / 2));
        return centerY >= source.Y - 1.5 &&
          centerY <= source.Y + source.H + 1.5;
      })
      .map(([key]) => key),
  );
  if (!selectedSourceKeys.size) return null;
  const mappings = registration.lineMappings.filter((mapping) =>
    selectedSourceKeys.has(mapping.sourceKey));
  const mappedSourceKeys = new Set(mappings.map((mapping) => mapping.sourceKey));
  if ([...selectedSourceKeys].some((key) => !mappedSourceKeys.has(key))) {
    return null;
  }
  const targetKeys = new Set(mappings.map((mapping) => mapping.targetKey));
  const selectedWords = [...targetKeys].flatMap((key) =>
    targetLines.get(key) ?? [])
    .filter((word) => word.right >= 20 && word.left <= 680);
  /*
   * The target line IDs above, rather than a y interval, are the ownership
   * proof. This prevents a tall OCR word or local page warp from pulling in an
   * adjacent verse line.
   */
  if (!selectedWords.length) return null;

  // Source geometry proves which line interval belongs to the verse. Target
  // OCR then supplies that edition's own whitespace-snapped outer extents.
  const detectedLeft =
    Math.min(...selectedWords.map((word) => word.left)) - horizontalPad;
  const detectedRight =
    Math.max(...selectedWords.map((word) => word.right)) + horizontalPad;
  const detectedTop =
    Math.min(...selectedWords.map((word) => word.top)) - verticalPad;
  const detectedBottom =
    Math.max(...selectedWords.map((word) => word.bottom)) + verticalPad;
  const X = Math.max(0, Math.round(Math.min(
    detectedLeft,
    target.X,
  )));
  const right = Math.min(700, Math.round(Math.max(
    detectedRight,
    target.X + target.W,
  )));
  const Y = Math.max(0, Math.round(detectedTop));
  const bottom = Math.max(Y + 1, Math.round(detectedBottom));
  const W = Math.max(1, right - X);
  const H = Math.max(1, bottom - Y);
  const tlActive = source.TLW > 0 && source.TLH > 0;
  const brActive = source.BRW > 0 && source.BRH > 0;
  const targetMeta = registry.get(targetVersion)!;
  const row: ShadowGeometry = {
    uid: target.uid,
    version: targetVersion,
    verseId: source.verseId,
    page: registration.targetImagePage - targetMeta.offset,
    pageWidth: targetPage.width,
    pageScale: 700,
    X,
    Y,
    W,
    H,
    TLW: tlActive
      ? Math.min(W, Math.max(0, Math.round(
        Math.abs(mapX(source.X + source.TLW) - mapX(source.X)),
      )))
      : 0,
    TLH: tlActive
      ? Math.min(H, Math.max(1, Math.round(
        Math.abs(mapY(source.Y + source.TLH) - mapY(source.Y)),
      )))
      : 0,
    BRW: brActive
      ? Math.min(W, Math.max(0, Math.round(
        Math.abs(
          mapX(source.X + source.W) -
          mapX(source.X + source.W - source.BRW),
        ),
      )))
      : 0,
    BRH: brActive
      ? Math.min(H, Math.max(1, Math.round(
        Math.abs(
          mapY(source.Y + source.H) -
          mapY(source.Y + source.H - source.BRH),
        ),
      )))
      : 0,
  };
  return { row, snappedWords: selectedWords.length };
}

const sourceByVerse = new Map<number, ShadowGeometry[]>();
for (const row of versionRows.get(sourceVersion) ?? []) {
  (sourceByVerse.get(row.verseId) ??
    sourceByVerse.set(row.verseId, []).get(row.verseId)!).push(row);
}
const proposals: Array<Record<string, unknown>> = [];
for (const [verseId, sourceVerseRows] of sourceByVerse) {
  const currentRows = [...(
    rowsByVersionVerse.get(`${targetVersion}|${verseId}`) ?? []
  )].sort((left, right) =>
    left.page - right.page || left.Y - right.Y || left.X - right.X);
  const orderedSource = [...sourceVerseRows].sort((left, right) =>
    left.page - right.page || left.Y - right.Y || left.X - right.X);
  if (!orderedSource.some((row) => registrationByPage.has(row.page))) continue;
  if (orderedSource.length !== currentRows.length) {
    proposals.push({
      version: targetVersion,
      verseId,
      selector: canonicalSelector([verseId]),
      outcome: 'PAGE_REGISTRATION_TOPOLOGY_MISMATCH',
      currentRows,
      proposedRows: undefined,
      error: `${orderedSource.length} source rows vs ${currentRows.length} target rows`,
    });
    continue;
  }
  const transformed = orderedSource.map((sourceRow, ordinal) => {
    const current = currentRows[ordinal]!;
    const registration = registrationByPage.get(sourceRow.page);
    return registration
      ? transformRow(sourceRow, current, registration)
      : { row: current, snappedWords: 0 };
  });
  if (transformed.some((item) => item == null)) {
    proposals.push({
      version: targetVersion,
      verseId,
      selector: canonicalSelector([verseId]),
      outcome: 'PAGE_REGISTRATION_ROW_UNSNAPPED',
      currentRows,
      proposedRows: undefined,
      error: 'target OCR has no words inside a transformed source row',
    });
    continue;
  }
  const proposedRows = transformed.map((item) => item!.row);
  proposals.push({
    version: targetVersion,
    verseId,
    selector: canonicalSelector([verseId]),
    outcome: 'ACCEPTED_PAGE_OCR_REGISTRATION',
    currentRows,
    proposedRows,
    evidence: {
      sourceVersion,
      pages: orderedSource.map((row) => row.page),
      registrations: orderedSource
        .map((row) => registrationByPage.get(row.page))
        .filter(Boolean),
      snappedWords: transformed.map((item) => item!.snappedWords),
    },
    error: null,
  });
}
proposals.sort((left, right) =>
  Number(left.verseId) - Number(right.verseId));

const byOutcome = Object.fromEntries(
  [...new Set(proposals.map((proposal) => String(proposal.outcome)))]
    .sort()
    .map((outcome) => [
      outcome,
      proposals.filter((proposal) => proposal.outcome === outcome).length,
    ]),
);
const report = {
  generatedAt: new Date().toISOString(),
  horizontalPad,
  verticalPad,
  minYScale,
  maxYScale,
  method: 'local Tesseract exact n-grams + robust per-page scan registration',
  modelCalls: 0,
  shadowFile,
  sourceVersion,
  targetVersion,
  sourcePages: sourcePages.length,
  acceptedPages: registrations.filter((item) => item.accepted).length,
  rejectedPages: registrations.filter((item) => !item.accepted).length,
  remappedPages: registrations.filter((item) =>
    item.accepted &&
    item.targetImagePage !== item.expectedTargetImagePage).length,
  registrations,
  byOutcome,
  proposals,
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'page-registration-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
fs.writeFileSync(path.join(outDir, 'README.md'), [
  '# Fax page registration',
  '',
  `- Source: ${sourceVersion}`,
  `- Target: ${targetVersion}`,
  '- Model/LLM/vision calls: none',
  `- Pages accepted: ${report.acceptedPages}/${report.sourcePages}`,
  `- Pages rejected: ${report.rejectedPages}`,
  `- Accepted y-scale range: ${minYScale}–${maxYScale}`,
  `- Pages remapped to a non-default source leaf: ${report.remappedPages}`,
  `- Proposal outcomes: ${Object.entries(byOutcome)
    .map(([key, value]) => `${key}=${value}`).join(', ')}`,
  '',
  'Rejected pages remain blockers and are never emitted as accepted proposals.',
  '',
].join('\n'));
console.log(JSON.stringify({
  outDir,
  sourceVersion,
  targetVersion,
  sourcePages: report.sourcePages,
  acceptedPages: report.acceptedPages,
  rejectedPages: report.rejectedPages,
  remappedPages: report.remappedPages,
  byOutcome,
}, null, 2));
if (report.rejectedPages > 0) process.exitCode = 1;
