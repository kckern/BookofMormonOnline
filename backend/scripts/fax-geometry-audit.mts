#!/usr/bin/env npx tsx
/**
 * Deterministic fax geometry audit.
 *
 * This script is strictly read-only. It never calls Gemini or another LLM.
 * It can optionally use:
 *   - source scan pixels for classical whitespace/ink measurements; and
 *   - existing page-level Gemini OCR cache files as immutable text/line input.
 *   - paired relabeled.sql/snapped.sql artifacts for actual snap lineage.
 *
 * Examples:
 *   # Fast DB/family audit of every indexed edition:
 *   npx tsx scripts/fax-geometry-audit.mts \
 *     --out ../docs/audits/fax-geometry/current
 *
 *   # Add scan pixels and cached OCR for selected editions:
 *   npx tsx scripts/fax-geometry-audit.mts \
 *     --versions 1849,1852,1882 --pixels \
 *     --ocr-root /path/to/ocr-cache \
 *     --out ../docs/audits/fax-geometry/pixel-ocr
 *
 *   # Override or disable automatic local snap-lineage discovery:
 *   npx tsx scripts/fax-geometry-audit.mts \
 *     --lineage-root /path/to/families --out /tmp/fax-audit
 *   npx tsx scripts/fax-geometry-audit.mts --no-lineage --out /tmp/fax-audit
 *
 *   # Target regression verses while calibrating:
 *   npx tsx scripts/fax-geometry-audit.mts \
 *     --versions 1849,1852,1882 --pixels \
 *     --verse-ids 31307,33147,34793,34939,35143,35169,36348,36456 \
 *     --out /tmp/fax-audit-regressions
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getDb, closeDb } from '../src/data/db.ts';
import {
  DEFAULT_FAMILIES,
  auditAbsoluteGeometry,
  auditCoverage,
  auditDuplicatesAndOverlaps,
  auditEditionStatistics,
  auditFamilies,
  auditOrderingAndNotches,
  dedupeFindings,
  median,
  notchActive,
  percentile,
  robustDistanceSummary,
  type AuditFinding,
  type EditionMeta,
  type FamilyDefinition,
  type GeometryRow,
} from './lib/fax-geometry-audit-core.ts';
import {
  loadShadowRows,
  openShadow,
  shadowCanonicalText,
} from './lib/fax-shadow-db.ts';

type OcrLine = { text: string; box_2d: [number, number, number, number] };
type OcrPage = { imgW: number; imgH: number; lines: OcrLine[] };
type TextToken = { text: string; start: number; end: number };
type PixelGap = { lo: number; hi: number; mid: number; width: number; ink: number };
type Scan = {
  data: Buffer;
  width: number;
  height: number;
  threshold: number;
  ink: (value: number) => number;
};
type EdgeResult = {
  before: number;
  after: number;
  deltaPx: number;
  currentPx: number;
  candidatePx: number;
  currentDarkRuns: number;
  candidateDarkRuns: number;
};
type SnapSource = 'pixel' | 'semantic' | 'lineage';
type SnapBoundary = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM' | 'TL' | 'TLH' | 'BR' | 'BRH';
type SnapMeasurement = {
  source: SnapSource;
  boundary: SnapBoundary;
  version: string;
  uid: number | null;
  verseId: number;
  page: number;
  imagePage: number;
  signedDistancePx: number;
  absoluteDistancePx: number;
  signedDistanceStored: number;
  absoluteDistanceStored: number;
  distanceLineHeights: number;
  currentInk: number | null;
  candidateInk: number | null;
  crossedTokens: number | null;
  baselineSource?: Exclude<SnapSource, 'semantic'>;
  classicZ?: number | null;
  robustZ?: number | null;
  percentile?: number;
  statisticalOutlier?: boolean;
};
type SnapDistribution = {
  source: Exclude<SnapSource, 'semantic'>;
  version: string;
  boundary: SnapBoundary;
  count: number;
  meanSignedStored: number;
  medianSignedStored: number;
  standardDeviationSignedStored: number;
  meanAbsoluteStored: number;
  standardDeviationStored: number;
  medianStored: number;
  madStored: number;
  p95Stored: number;
  p99Stored: number;
  maxStored: number;
  meanLineHeights: number;
  p99LineHeights: number;
};

const argv = process.argv.slice(2);
const hasFlag = (name: string) => argv.includes(`--${name}`);
const flag = (name: string, fallback?: string): string | undefined => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : fallback;
};
const splitFlag = (name: string): string[] =>
  (flag(name, '') ?? '').split(',').map((item) => item.trim()).filter(Boolean);

const requestedVersions = splitFlag('versions');
const requestedVerseIds = new Set(splitFlag('verse-ids').map(Number).filter(Number.isInteger));
const usePixels = hasFlag('pixels');
const ocrRoot = flag(
  'ocr-root',
  '/Users/kckern/Documents/GitHub/BoMOnlineWorkspace/scripts/out/ocr-cache',
)!;
const mediaRoot = flag('media', 'https://media.bookofmormon.online')!;
const mediaCache = flag('media-cache')
  ? path.resolve(flag('media-cache')!)
  : null;
const outDir = path.resolve(flag('out', '../docs/audits/fax-geometry/current')!);
const concurrency = Math.max(1, Number(flag('concurrency', '5')));
const maxPages = Math.max(0, Number(flag('max-pages', '0')));
const zThreshold = Math.max(3, Number(flag('z-threshold', '7')));
const classicZThreshold = Math.max(2, Number(flag('classic-z-threshold', '3')));
const familiesFile = flag('families');
const strictOcr = hasFlag('require-ocr');
const defaultLineageRoot =
  '/Users/kckern/Documents/GitHub/BoMOnlineWorkspace/scripts/out/families';
const lineageRoot = path.resolve(flag('lineage-root', defaultLineageRoot)!);
const useLineage = !hasFlag('no-lineage') && fs.existsSync(lineageRoot);
const shadowFile = flag('shadow');

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ſ]/g, 's')
    .replace(/[ﬀﬁﬂﬃﬄ]/g, (ligature) => ({
      'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl',
    })[ligature] ?? ligature)
    .replace(/[^a-z']/g, '');
}

function tokenize(value: string): TextToken[] {
  const normalized = value.replace(/[—–]/g, ' ');
  const tokens: TextToken[] = [];
  for (const match of normalized.matchAll(/[A-Za-zſﬀﬁﬂﬃﬄ]+(?:'[A-Za-z]+)?/g)) {
    const text = normalizeToken(match[0]);
    if (text) tokens.push({ text, start: match.index!, end: match.index! + match[0].length });
  }
  return tokens;
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 5) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    edits++;
    if (edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}

function sameToken(a: string, b: string): boolean {
  return a === b ||
    editDistanceAtMostOne(a, b) ||
    (a.length >= 5 && b.length >= 5 && a.replace(/s$/, '') === b.replace(/s$/, ''));
}

type TokenMatch = { index: number; length: number; occurrences: number };

function findPrefix(haystack: TextToken[], needle: string[]): TokenMatch | null {
  for (let length = Math.min(5, needle.length); length >= 2; length--) {
    const indexes: number[] = [];
    for (let index = 0; index <= haystack.length - length; index++) {
      if (needle.slice(0, length).every((token, offset) => sameToken(token, haystack[index + offset]!.text))) {
        indexes.push(index);
      }
    }
    if (indexes.length) return { index: indexes[0]!, length, occurrences: indexes.length };
  }
  return null;
}

function findSuffix(haystack: TextToken[], needle: string[]): TokenMatch | null {
  for (let length = Math.min(5, needle.length); length >= 2; length--) {
    const suffix = needle.slice(-length);
    const indexes: number[] = [];
    for (let index = haystack.length - length; index >= 0; index--) {
      if (suffix.every((token, offset) => sameToken(token, haystack[index + offset]!.text))) {
        indexes.push(index);
      }
    }
    if (indexes.length) return {
      index: indexes[0]!,
      length,
      occurrences: indexes.length,
    };
  }
  return null;
}

function longestCanonicalRun(haystack: TextToken[], canonical: string[]): number {
  if (!haystack.length || !canonical.length) return 0;
  let previous = new Array<number>(canonical.length + 1).fill(0);
  let longest = 0;
  for (const token of haystack) {
    const current = new Array<number>(canonical.length + 1).fill(0);
    for (let index = 1; index <= canonical.length; index++) {
      if (sameToken(token.text, canonical[index - 1]!)) {
        current[index] = previous[index - 1]! + 1;
        longest = Math.max(longest, current[index]!);
      }
    }
    previous = current;
  }
  return longest;
}

function strongUniqueMatch(match: TokenMatch | null): match is TokenMatch {
  return match != null && match.length >= 4 && match.occurrences === 1;
}

async function pool<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await work(item);
    }
  }));
}

function scanModel(data: Buffer, width: number, height: number): Scan {
  const sample: number[] = [];
  for (let index = 0; index < data.length; index += 997) sample.push(data[index]!);
  const black = percentile(sample, 0.12);
  const paper = percentile(sample, 0.88);
  const span = Math.max(1, paper - black);
  const threshold = black + span * 0.46;
  return {
    data,
    width,
    height,
    threshold,
    ink: (value) => Math.max(0, Math.min(1, (paper - value) / span)),
  };
}

function horizontalSamples(scan: Scan, y: number, x0: number, x1: number): number[] {
  const yy = Math.round(y);
  const lo = Math.max(0, Math.round(Math.min(x0, x1)));
  const hi = Math.min(scan.width - 1, Math.round(Math.max(x0, x1)));
  if (yy < 0 || yy >= scan.height || hi <= lo) return [1];
  const values: number[] = [];
  for (let x = lo; x <= hi; x++) values.push(scan.ink(scan.data[yy * scan.width + x]!));
  return values;
}

function verticalSamples(scan: Scan, x: number, y0: number, y1: number): number[] {
  const xx = Math.round(x);
  const lo = Math.max(0, Math.round(Math.min(y0, y1)));
  const hi = Math.min(scan.height - 1, Math.round(Math.max(y0, y1)));
  if (xx < 0 || xx >= scan.width || hi <= lo) return [1];
  const values: number[] = [];
  for (let y = lo; y <= hi; y++) values.push(scan.ink(scan.data[y * scan.width + xx]!));
  return values;
}

function inkMean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function darkRuns(values: number[], threshold = 0.5): number {
  let runs = 0;
  let active = false;
  for (const value of values) {
    if (value >= threshold && !active) {
      runs++;
      active = true;
    } else if (value < threshold) {
      active = false;
    }
  }
  return runs;
}

function bestHorizontal(
  scan: Scan,
  y: number,
  x0: number,
  x1: number,
  radiusPx: number,
): EdgeResult {
  const current = horizontalSamples(scan, y, x0, x1);
  const before = inkMean(current);
  let candidatePx = y;
  let bestCost = before;
  for (let delta = -radiusPx; delta <= radiusPx; delta++) {
    const samples = horizontalSamples(scan, y + delta, x0, x1);
    const cost = inkMean(samples) + darkRuns(samples) * 0.003 + Math.abs(delta) * 0.0025;
    if (cost < bestCost) {
      bestCost = cost;
      candidatePx = y + delta;
    }
  }
  const candidate = horizontalSamples(scan, candidatePx, x0, x1);
  return {
    before,
    after: inkMean(candidate),
    deltaPx: candidatePx - y,
    currentPx: y,
    candidatePx,
    currentDarkRuns: darkRuns(current),
    candidateDarkRuns: darkRuns(candidate),
  };
}

function bestVertical(
  scan: Scan,
  x: number,
  y0: number,
  y1: number,
  radiusPx: number,
): EdgeResult {
  const current = verticalSamples(scan, x, y0, y1);
  const before = inkMean(current);
  let candidatePx = x;
  let bestCost = before;
  for (let delta = -radiusPx; delta <= radiusPx; delta++) {
    const samples = verticalSamples(scan, x + delta, y0, y1);
    const cost = inkMean(samples) + darkRuns(samples) * 0.003 + Math.abs(delta) * 0.0015;
    if (cost < bestCost) {
      bestCost = cost;
      candidatePx = x + delta;
    }
  }
  const candidate = verticalSamples(scan, candidatePx, y0, y1);
  return {
    before,
    after: inkMean(candidate),
    deltaPx: candidatePx - x,
    currentPx: x,
    candidatePx,
    currentDarkRuns: darkRuns(current),
    candidateDarkRuns: darkRuns(candidate),
  };
}

function strongPixelCandidate(result: EdgeResult): boolean {
  return result.deltaPx !== 0 &&
    result.before >= 0.16 &&
    result.after <= 0.05 &&
    result.before - result.after >= 0.12 &&
    result.currentDarkRuns > 0;
}

function ocrLineRect(page: OcrPage, line: OcrLine) {
  const [y0, x0, y1, x1] = line.box_2d.map(Number);
  return {
    x0: x0 / 1000 * page.imgW,
    x1: x1 / 1000 * page.imgW,
    y0: y0 / 1000 * page.imgH,
    y1: y1 / 1000 * page.imgH,
  };
}

function nearestOcrLine(
  page: OcrPage,
  row: GeometryRow,
  edge: 'top' | 'bottom',
): { line: OcrLine; rect: ReturnType<typeof ocrLineRect>; distance: number } | null {
  const scale = page.imgW / row.pageScale;
  const target = edge === 'top'
    ? (row.Y + (notchActive(row.TLW, row.TLH) ? row.TLH / 2 : 0)) * scale
    : (row.Y + row.H - (notchActive(row.BRW, row.BRH) ? row.BRH / 2 : 0)) * scale;
  return page.lines
    .filter((line) => line?.text && Array.isArray(line.box_2d) && line.box_2d.length === 4)
    .map((line) => {
      const rect = ocrLineRect(page, line);
      const y = edge === 'top'
        ? (notchActive(row.TLW, row.TLH) ? (rect.y0 + rect.y1) / 2 : rect.y0)
        : (notchActive(row.BRW, row.BRH) ? (rect.y0 + rect.y1) / 2 : rect.y1);
      return { line, rect, distance: Math.abs(y - target) };
    })
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

function verticalGapProfile(scan: Scan, rect: ReturnType<typeof ocrLineRect>): PixelGap[] {
  const x0 = Math.max(0, Math.floor(rect.x0));
  const x1 = Math.min(scan.width - 1, Math.ceil(rect.x1));
  const y0 = Math.max(0, Math.floor(rect.y0));
  const y1 = Math.min(scan.height - 1, Math.ceil(rect.y1));
  const profile: number[] = [];
  for (let x = x0; x <= x1; x++) {
    let dark = 0;
    let count = 0;
    for (let y = y0; y <= y1; y++) {
      dark += Number(scan.data[y * scan.width + x]! < scan.threshold);
      count++;
    }
    profile.push(count ? dark / count : 1);
  }
  const gaps: PixelGap[] = [];
  let start = -1;
  for (let index = 0; index <= profile.length; index++) {
    const white = index < profile.length && profile[index]! <= 0.08;
    if (white && start < 0) start = index;
    if (!white && start >= 0) {
      if (index - start >= 2) {
        const slice = profile.slice(start, index);
        gaps.push({
          lo: x0 + start,
          hi: x0 + index - 1,
          mid: x0 + (start + index - 1) / 2,
          width: index - start,
          ink: slice.reduce((sum, value) => sum + value, 0) / slice.length,
        });
      }
      start = -1;
    }
  }
  // Edge whitespace is a margin, not an inter-token gap.
  return gaps.filter((gap) => gap.lo > x0 + 1 && gap.hi < x1 - 1);
}

function mapTokenBoundariesToGaps(
  line: OcrLine,
  rect: ReturnType<typeof ocrLineRect>,
  gaps: PixelGap[],
): Array<PixelGap | null> {
  const lineTokens = tokenize(line.text);
  if (lineTokens.length < 2 || !gaps.length) return [];
  const expected = lineTokens.slice(0, -1).map((token, index) => {
    const next = lineTokens[index + 1]!;
    const charMid = (token.end + next.start) / 2;
    return rect.x0 + charMid / Math.max(1, line.text.length) * (rect.x1 - rect.x0);
  });
  const minimumWordGap = Math.max(2, (rect.x1 - rect.x0) / Math.max(1, line.text.length) * 0.45);
  const cost = (boundary: number, gap: PixelGap) =>
    Math.abs(gap.mid - boundary) / Math.max(1, rect.x1 - rect.x0) * 12 +
    gap.ink * 4 +
    Math.max(0, minimumWordGap - gap.width) / minimumWordGap * 2;

  const states = Array.from({ length: expected.length }, () =>
    Array.from({ length: gaps.length }, () => ({ cost: Number.POSITIVE_INFINITY, previous: -1 })));
  for (let gapIndex = 0; gapIndex < gaps.length; gapIndex++) {
    states[0]![gapIndex] = { cost: cost(expected[0]!, gaps[gapIndex]!), previous: -1 };
  }
  for (let boundaryIndex = 1; boundaryIndex < expected.length; boundaryIndex++) {
    for (let gapIndex = boundaryIndex; gapIndex < gaps.length; gapIndex++) {
      let best = Number.POSITIVE_INFINITY;
      let previous = -1;
      for (let prior = boundaryIndex - 1; prior < gapIndex; prior++) {
        const candidate = states[boundaryIndex - 1]![prior]!.cost;
        if (candidate < best) {
          best = candidate;
          previous = prior;
        }
      }
      if (previous >= 0) {
        states[boundaryIndex]![gapIndex] = {
          cost: best + cost(expected[boundaryIndex]!, gaps[gapIndex]!),
          previous,
        };
      }
    }
  }
  const result: Array<PixelGap | null> = Array.from({ length: expected.length }, () => null);
  const final = states.at(-1)!;
  let gapIndex = final.reduce(
    (best, state, index) => state.cost < final[best]!.cost ? index : best,
    0,
  );
  if (!Number.isFinite(final[gapIndex]!.cost)) return result;
  for (let boundaryIndex = expected.length - 1; boundaryIndex >= 0; boundaryIndex--) {
    result[boundaryIndex] = gaps[gapIndex]!;
    gapIndex = states[boundaryIndex]![gapIndex]!.previous;
  }
  return result;
}

function safelyInsideGap(value: number, gap: PixelGap | null): boolean {
  if (!gap) return false;
  const margin = Math.min(2, Math.max(0.5, gap.width / 3));
  return value >= gap.lo + margin && value <= gap.hi - margin;
}

function countCrossedMappedTokens(
  rect: ReturnType<typeof ocrLineRect>,
  mappedGaps: Array<PixelGap | null>,
  tokenCount: number,
  tokenIndexes: number[],
  from: number,
  to: number,
): number {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  // The monotonic token→gap alignment gives much better word extents than
  // proportional character widths on historical fonts. Count any traversed
  // portion, including a boundary that lands inside a word.
  return tokenIndexes.filter((index) => {
    const tokenLo = index === 0 ? rect.x0 : mappedGaps[index - 1]?.mid;
    const tokenHi = index === tokenCount - 1 ? rect.x1 : mappedGaps[index]?.mid;
    return tokenLo != null && tokenHi != null &&
      Math.min(hi, tokenHi) - Math.max(lo, tokenLo) >= 1;
  }).length;
}

function pixelFinding(
  row: GeometryRow,
  code: string,
  message: string,
  evidence: Record<string, unknown>,
  proposedGeometry: AuditFinding['proposedGeometry'] = null,
  confidence = 0.85,
  autoRepairEligible = false,
): AuditFinding {
  return {
    code,
    severity: autoRepairEligible ? 'error' : 'warning',
    tier: autoRepairEligible ? 'forced' : 'statistical',
    confidence,
    version: row.version,
    uid: row.uid,
    verseId: row.verseId,
    page: row.page,
    imagePage: row.imagePage,
    message,
    evidence,
    proposedGeometry,
    autoRepairEligible,
  };
}

function auditPixelEdges(
  row: GeometryRow,
  scan: Scan,
  measurements: SnapMeasurement[],
  lineHeightStored: number,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const scale = scan.width / row.pageScale;
  const left = row.X * scale;
  const right = (row.X + row.W) * scale;
  const top = row.Y * scale;
  const bottom = (row.Y + row.H) * scale;
  const tlBoundary = (row.X + row.TLW) * scale;
  const brBoundary = (row.X + row.W - row.BRW) * scale;
  const tlBottom = (row.Y + row.TLH) * scale;
  const brTop = (row.Y + row.H - row.BRH) * scale;
  const radius = Math.max(5, Math.round(11 * scale));
  const notchRadius = Math.max(8, Math.round(26 * scale));
  const edges: Array<{
    name: string;
    result: EdgeResult;
    proposal: () => AuditFinding['proposedGeometry'];
  }> = [
    {
      name: 'LEFT',
      result: bestVertical(scan, left, top, bottom, radius),
      proposal: function () {
        const delta = Math.round(this.result.deltaPx / scale);
        return { X: row.X + delta, W: row.W - delta };
      },
    },
    {
      name: 'RIGHT',
      result: bestVertical(scan, right, top, bottom, radius),
      proposal: function () {
        return { W: row.W + Math.round(this.result.deltaPx / scale) };
      },
    },
    {
      name: 'TOP',
      result: bestHorizontal(scan, top, notchActive(row.TLW, row.TLH) ? tlBoundary : left, right, radius),
      proposal: function () {
        const delta = Math.round(this.result.deltaPx / scale);
        return { Y: row.Y + delta, H: row.H - delta };
      },
    },
    {
      name: 'BOTTOM',
      result: bestHorizontal(scan, bottom, left, notchActive(row.BRW, row.BRH) ? brBoundary : right, radius),
      proposal: function () {
        return { H: row.H + Math.round(this.result.deltaPx / scale) };
      },
    },
  ];
  if (notchActive(row.TLW, row.TLH)) {
    edges.push({
      name: 'TL',
      result: bestVertical(scan, tlBoundary, top, tlBottom, notchRadius),
      proposal: function () {
        return { TLW: row.TLW + Math.round(this.result.deltaPx / scale) };
      },
    });
    edges.push({
      name: 'TLH',
      result: bestHorizontal(scan, tlBottom, left, tlBoundary, radius),
      proposal: function () {
        return { TLH: row.TLH + Math.round(this.result.deltaPx / scale) };
      },
    });
  }
  if (notchActive(row.BRW, row.BRH)) {
    edges.push({
      name: 'BR',
      result: bestVertical(scan, brBoundary, brTop, bottom, notchRadius),
      proposal: function () {
        return { BRW: row.BRW - Math.round(this.result.deltaPx / scale) };
      },
    });
    edges.push({
      name: 'BRH',
      result: bestHorizontal(scan, brTop, brBoundary, right, radius),
      proposal: function () {
        return { BRH: row.BRH - Math.round(this.result.deltaPx / scale) };
      },
    });
  }
  for (const edge of edges) {
    const signedDistanceStored = edge.result.deltaPx / scale;
    measurements.push({
      source: 'pixel',
      boundary: edge.name as SnapBoundary,
      version: row.version,
      uid: row.uid,
      verseId: row.verseId,
      page: row.page,
      imagePage: row.imagePage,
      signedDistancePx: edge.result.deltaPx,
      absoluteDistancePx: Math.abs(edge.result.deltaPx),
      signedDistanceStored,
      absoluteDistanceStored: Math.abs(signedDistanceStored),
      distanceLineHeights: Math.abs(signedDistanceStored) / Math.max(1, lineHeightStored),
      currentInk: edge.result.before,
      candidateInk: edge.result.after,
      crossedTokens: null,
    });
    if (!strongPixelCandidate(edge.result)) continue;
    findings.push(pixelFinding(row, `PIXEL_${edge.name}_EDGE_CANDIDATE`,
      `${edge.name} edge intersects ink and has a materially cleaner nearby band`,
      {
        edge: edge.name,
        currentPx: Number(edge.result.currentPx.toFixed(2)),
        candidatePx: Number(edge.result.candidatePx.toFixed(2)),
        deltaPx: Number(edge.result.deltaPx.toFixed(2)),
        deltaStored: Math.round(edge.result.deltaPx / scale),
        currentInk: Number(edge.result.before.toFixed(4)),
        candidateInk: Number(edge.result.after.toFixed(4)),
        currentDarkRuns: edge.result.currentDarkRuns,
        candidateDarkRuns: edge.result.candidateDarkRuns,
        semanticStatus: 'UNVALIDATED',
      },
      edge.proposal(), 0.82, false));
  }
  return findings;
}

function auditSemanticNotches(
  row: GeometryRow,
  scan: Scan,
  ocr: OcrPage,
  canonical: string[],
  measurements: SnapMeasurement[],
  lineHeightStored: number,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  if (!canonical.length) return findings;
  const scale = scan.width / row.pageScale;
  const top = nearestOcrLine(ocr, row, 'top');
  const bottom = nearestOcrLine(ocr, row, 'bottom');

  if (top) {
    const lineTokens = tokenize(top.line.text);
    const prefix = findPrefix(lineTokens, canonical);
    if (prefix) {
      const strongPrefix = strongUniqueMatch(prefix);
      const gaps = verticalGapProfile(scan, top.rect);
      const mapped = mapTokenBoundariesToGaps(top.line, top.rect, gaps);
      const currentPx = (row.X + row.TLW) * scale;
      const rawPrefix = top.line.text.slice(0, lineTokens[prefix.index]?.start ?? 0);
      if (prefix.index === 0 && notchActive(row.TLW, row.TLH) && !/[A-Za-z0-9]/.test(rawPrefix)) {
        findings.push(pixelFinding(row, 'FALSE_TL_NOTCH_SEMANTIC',
          'Canonical verse begins with the first aligned token on the OCR line',
          {
            ocrLine: top.line.text,
            alignedToken: lineTokens[0]?.text ?? null,
            alignmentLength: prefix.length,
            alignmentOccurrences: prefix.occurrences,
          },
          { TLW: 0, TLH: 0 }, strongPrefix ? 0.97 : 0.8, strongPrefix));
      } else if (prefix.index > 0) {
        const gap = mapped[prefix.index - 1] ?? null;
        const crossed = gap
          ? countCrossedMappedTokens(
            top.rect,
            mapped,
            lineTokens.length,
            Array.from({ length: prefix.index }, (_, index) => index),
            currentPx,
            gap.mid,
          )
          : 0;
        const pixelOptimum = bestVertical(
          scan,
          currentPx,
          top.rect.y0,
          top.rect.y1,
          Math.max(8, Math.round(26 * scale)),
        );
        const pixelAgrees = safelyInsideGap(pixelOptimum.candidatePx, gap);
        if (gap) {
          const signedDistanceStored = (gap.mid - currentPx) / scale;
          measurements.push({
            source: 'semantic',
            boundary: 'TL',
            version: row.version,
            uid: row.uid,
            verseId: row.verseId,
            page: row.page,
            imagePage: row.imagePage,
            signedDistancePx: gap.mid - currentPx,
            absoluteDistancePx: Math.abs(gap.mid - currentPx),
            signedDistanceStored,
            absoluteDistanceStored: Math.abs(signedDistanceStored),
            distanceLineHeights: Math.abs(signedDistanceStored) / Math.max(1, lineHeightStored),
            currentInk: null,
            candidateInk: gap.ink,
            crossedTokens: crossed,
          });
        }
        if (!safelyInsideGap(currentPx, gap)) {
          const proposedTlw = gap
            ? Math.max(0, Math.min(row.W, Math.round(gap.mid / scale - row.X)))
            : null;
          const auto = proposedTlw != null && proposedTlw !== row.TLW &&
            crossed === 0 && gap!.width >= 3 && pixelAgrees;
          findings.push(pixelFinding(row, 'TL_NOT_IN_EXPECTED_WORD_GAP',
            'Top-left notch is not inside the whitespace immediately before the first canonical token',
            {
              ocrLine: top.line.text,
              firstCanonicalToken: canonical[0],
              alignedOcrToken: lineTokens[prefix.index]?.text ?? null,
              alignmentLength: prefix.length,
              alignmentOccurrences: prefix.occurrences,
              currentPx: Number(currentPx.toFixed(2)),
              expectedGap: gap,
              crossedTokens: crossed,
              pixelOptimumPx: Number(pixelOptimum.candidatePx.toFixed(2)),
              pixelAgrees,
            },
            proposedTlw == null ? null : { TLW: proposedTlw },
            gap && strongPrefix ? 0.96 : 0.75,
            auto && strongPrefix));
        }
      }
    } else {
      // A common semantic leak is an entire preceding line retained at the top
      // of the polygon. Search the following two OCR lines in the same column;
      // if the canonical prefix starts there, the current line must be fully
      // excluded rather than snapped to one of its word gaps.
      const lineIndex = ocr.lines.indexOf(top.line);
      const leakedCanonicalRun = longestCanonicalRun(lineTokens, canonical);
      const following = ocr.lines
        .slice(lineIndex + 1, lineIndex + 3)
        .map((line) => {
          const tokens = tokenize(line.text);
          return {
            line,
            rect: ocrLineRect(ocr, line),
            tokens,
            prefix: findPrefix(tokens, canonical),
          };
        })
        .filter((candidate) => {
          const horizontalOverlap = Math.max(0,
            Math.min(top.rect.x1, candidate.rect.x1) - Math.max(top.rect.x0, candidate.rect.x0));
          return horizontalOverlap >= Math.min(top.rect.x1 - top.rect.x0, candidate.rect.x1 - candidate.rect.x0) * 0.5;
        })
        .find((candidate) => strongUniqueMatch(candidate.prefix));
      if (following && leakedCanonicalRun < 3) {
        const proposedTlh = row.TLH > 0
          ? row.TLH
          : Math.max(1, Math.round((following.rect.y0 - row.Y * scale) / scale));
        const alreadyExcluded = row.TLW >= row.W - 1 && row.TLH >= proposedTlh;
        if (!alreadyExcluded) {
          findings.push(pixelFinding(row, 'CONTENT_PREVIOUS_LINE_LEAK',
            'The canonical verse begins on a following OCR line, so the complete current top line should be excluded',
            {
              leakedLine: top.line.text,
              canonicalStartLine: following.line.text,
              currentTLW: row.TLW,
              expectedTLW: row.W,
              leakedCanonicalRun,
              alignmentLength: following.prefix!.length,
              alignmentOccurrences: following.prefix!.occurrences,
            },
            { TLW: row.W, TLH: proposedTlh },
            leakedCanonicalRun === 0 ? 0.98 : 0.84,
            leakedCanonicalRun === 0 && row.TLW !== row.W && proposedTlh > 0));
        }
      }
    }
  }

  if (bottom) {
    const lineTokens = tokenize(bottom.line.text);
    const suffix = findSuffix(lineTokens, canonical);
    if (suffix) {
      const strongSuffix = strongUniqueMatch(suffix);
      const suffixEnd = suffix.index + suffix.length - 1;
      const gaps = verticalGapProfile(scan, bottom.rect);
      const mapped = mapTokenBoundariesToGaps(bottom.line, bottom.rect, gaps);
      const currentPx = (row.X + row.W - row.BRW) * scale;
      const finalToken = lineTokens[suffixEnd];
      const rawSuffix = finalToken ? bottom.line.text.slice(finalToken.end) : '';
      if (suffixEnd === lineTokens.length - 1 && notchActive(row.BRW, row.BRH) &&
          !/[A-Za-z0-9]/.test(rawSuffix)) {
        findings.push(pixelFinding(row, 'FALSE_BR_NOTCH_SEMANTIC',
          'Canonical verse ends with the final aligned token on the OCR line',
          {
            ocrLine: bottom.line.text,
            alignedToken: lineTokens.at(-1)?.text ?? null,
            alignmentLength: suffix.length,
            alignmentOccurrences: suffix.occurrences,
          },
          { BRW: 0, BRH: 0 }, strongSuffix ? 0.97 : 0.8, strongSuffix));
      } else if (suffixEnd < lineTokens.length - 1) {
        const gap = mapped[suffixEnd] ?? null;
        const crossed = gap
          ? countCrossedMappedTokens(
            bottom.rect,
            mapped,
            lineTokens.length,
            Array.from(
              { length: lineTokens.length - suffixEnd - 1 },
              (_, index) => suffixEnd + 1 + index,
            ),
            currentPx,
            gap.mid,
          )
          : 0;
        const pixelOptimum = bestVertical(
          scan,
          currentPx,
          bottom.rect.y0,
          bottom.rect.y1,
          Math.max(8, Math.round(26 * scale)),
        );
        const pixelAgrees = safelyInsideGap(pixelOptimum.candidatePx, gap);
        if (gap) {
          const signedDistanceStored = (gap.mid - currentPx) / scale;
          measurements.push({
            source: 'semantic',
            boundary: 'BR',
            version: row.version,
            uid: row.uid,
            verseId: row.verseId,
            page: row.page,
            imagePage: row.imagePage,
            signedDistancePx: gap.mid - currentPx,
            absoluteDistancePx: Math.abs(gap.mid - currentPx),
            signedDistanceStored,
            absoluteDistanceStored: Math.abs(signedDistanceStored),
            distanceLineHeights: Math.abs(signedDistanceStored) / Math.max(1, lineHeightStored),
            currentInk: null,
            candidateInk: gap.ink,
            crossedTokens: crossed,
          });
        }
        if (!safelyInsideGap(currentPx, gap)) {
          const proposedBrw = gap
            ? Math.max(0, Math.min(row.W, Math.round(row.X + row.W - gap.mid / scale)))
            : null;
          const auto = proposedBrw != null && proposedBrw !== row.BRW &&
            crossed === 0 && gap!.width >= 3 && pixelAgrees;
          findings.push(pixelFinding(row, 'BR_NOT_IN_EXPECTED_WORD_GAP',
            'Bottom-right notch is not inside the whitespace immediately after the final canonical token',
            {
              ocrLine: bottom.line.text,
              finalCanonicalToken: canonical.at(-1),
              alignedOcrToken: lineTokens[suffixEnd]?.text ?? null,
              alignmentLength: suffix.length,
              alignmentOccurrences: suffix.occurrences,
              currentPx: Number(currentPx.toFixed(2)),
              expectedGap: gap,
              crossedTokens: crossed,
              pixelOptimumPx: Number(pixelOptimum.candidatePx.toFixed(2)),
              pixelAgrees,
            },
            proposedBrw == null ? null : { BRW: proposedBrw },
            gap && strongSuffix ? 0.96 : 0.75,
            auto && strongSuffix));
        }
      }
    }
  }
  return findings;
}

type ArtifactGeometryRow = Omit<GeometryRow, 'uid' | 'imagePage'>;
type LineageCoverage = {
  rawRows: number;
  snappedRows: number;
  matchedRows: number;
  unmatchedRawRows: number;
  unmatchedSnappedRows: number;
};

function parseGeometrySql(sql: string): ArtifactGeometryRow[] {
  const rows: ArtifactGeometryRow[] = [];
  for (const line of sql.split(/\r?\n/)) {
    const tupleStart = line.indexOf("('");
    if (tupleStart < 0) continue;
    const trimmed = line.slice(tupleStart).trim().replace(/[,;]$/, '');
    if (!trimmed.endsWith(')')) continue;
    const fields = trimmed.slice(1, -1).split(',').map((field) =>
      field.trim().replace(/^'(.*)'$/, '$1'));
    if (fields.length !== 13 || fields.slice(1).some((field) => !/^-?\d+$/.test(field))) continue;
    rows.push({
      version: fields[0]!,
      verseId: Number(fields[1]),
      page: Number(fields[2]),
      pageWidth: Number(fields[3]),
      pageScale: Number(fields[4]),
      X: Number(fields[5]),
      Y: Number(fields[6]),
      W: Number(fields[7]),
      H: Number(fields[8]),
      TLW: Number(fields[9]),
      TLH: Number(fields[10]),
      BRW: Number(fields[11]),
      BRH: Number(fields[12]),
    });
  }
  return rows;
}

function artifactDistance(a: ArtifactGeometryRow, b: ArtifactGeometryRow): number {
  return Math.abs(a.X - b.X) + Math.abs(a.Y - b.Y) +
    Math.abs(a.W - b.W) + Math.abs(a.H - b.H) +
    Math.abs(a.TLW - b.TLW) + Math.abs(a.TLH - b.TLH) +
    Math.abs(a.BRW - b.BRW) + Math.abs(a.BRH - b.BRH);
}

function artifactGroups(rows: ArtifactGeometryRow[]): Map<string, ArtifactGeometryRow[]> {
  const groups = new Map<string, ArtifactGeometryRow[]>();
  for (const row of rows) {
    const key = `${row.version}|${row.verseId}|${row.page}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(row);
  }
  return groups;
}

function boundaryPositions(row: ArtifactGeometryRow): Partial<Record<SnapBoundary, number>> {
  const boundaries: Partial<Record<SnapBoundary, number>> = {
    LEFT: row.X,
    RIGHT: row.X + row.W,
    TOP: row.Y,
    BOTTOM: row.Y + row.H,
  };
  if (notchActive(row.TLW, row.TLH)) {
    boundaries.TL = row.X + row.TLW;
    boundaries.TLH = row.Y + row.TLH;
  }
  if (notchActive(row.BRW, row.BRH)) {
    boundaries.BR = row.X + row.W - row.BRW;
    boundaries.BRH = row.Y + row.H - row.BRH;
  }
  return boundaries;
}

function loadSnapLineage(
  versions: string[],
  dbRows: GeometryRow[],
  metas: Map<string, EditionMeta>,
  lineHeightByVersion: Map<string, number>,
): {
  measurements: SnapMeasurement[];
  coverage: Record<string, LineageCoverage>;
  findings: AuditFinding[];
} {
  const measurements: SnapMeasurement[] = [];
  const coverage: Record<string, LineageCoverage> = {};
  const findings: AuditFinding[] = [];
  const currentGroups = new Map<string, GeometryRow[]>();
  for (const row of dbRows) {
    const key = `${row.version}|${row.verseId}|${row.page}`;
    (currentGroups.get(key) ?? currentGroups.set(key, []).get(key)!).push(row);
  }

  for (const version of versions) {
    const rawPath = path.join(lineageRoot, `${version}-relabeled.sql`);
    const snappedPath = path.join(lineageRoot, `${version}-snapped.sql`);
    if (!fs.existsSync(rawPath) || !fs.existsSync(snappedPath)) continue;
    let rawRows = parseGeometrySql(fs.readFileSync(rawPath, 'utf8'))
      .filter((row) => row.version === version);
    let snappedRows = parseGeometrySql(fs.readFileSync(snappedPath, 'utf8'))
      .filter((row) => row.version === version);
    if (requestedVerseIds.size) {
      rawRows = rawRows.filter((row) => requestedVerseIds.has(row.verseId));
      snappedRows = snappedRows.filter((row) => requestedVerseIds.has(row.verseId));
    }

    const rawGroups = artifactGroups(rawRows);
    const snappedGroups = artifactGroups(snappedRows);
    let matchedRows = 0;
    let unmatchedRawRows = 0;
    let unmatchedSnappedRows = 0;
    for (const key of new Set([...rawGroups.keys(), ...snappedGroups.keys()])) {
      const beforeRows = rawGroups.get(key) ?? [];
      const unusedAfter = [...(snappedGroups.get(key) ?? [])];
      for (const before of beforeRows) {
        if (!unusedAfter.length) {
          unmatchedRawRows++;
          continue;
        }
        let bestIndex = 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        unusedAfter.forEach((after, index) => {
          const distance = artifactDistance(before, after);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
          }
        });
        const after = unusedAfter.splice(bestIndex, 1)[0]!;
        matchedRows++;
        const current = (currentGroups.get(key) ?? [])
          .reduce<GeometryRow | null>((best, candidate) =>
            !best || artifactDistance(after, candidate) < artifactDistance(after, best)
              ? candidate
              : best, null);
        const beforeBoundaries = boundaryPositions(before);
        const afterBoundaries = boundaryPositions(after);
        const lineHeight = lineHeightByVersion.get(version) ?? 24;
        const pixelScale = after.pageWidth / Math.max(1, after.pageScale);
        for (const boundary of Object.keys(beforeBoundaries) as SnapBoundary[]) {
          const beforePosition = beforeBoundaries[boundary];
          const afterPosition = afterBoundaries[boundary];
          if (beforePosition == null || afterPosition == null) continue;
          const signedDistanceStored = afterPosition - beforePosition;
          measurements.push({
            source: 'lineage',
            boundary,
            version,
            uid: current?.uid ?? null,
            verseId: after.verseId,
            page: after.page,
            imagePage: current?.imagePage ?? after.page + (metas.get(version)?.imageOffset ?? 0),
            signedDistancePx: signedDistanceStored * pixelScale,
            absoluteDistancePx: Math.abs(signedDistanceStored * pixelScale),
            signedDistanceStored,
            absoluteDistanceStored: Math.abs(signedDistanceStored),
            distanceLineHeights: Math.abs(signedDistanceStored) / Math.max(1, lineHeight),
            currentInk: null,
            candidateInk: null,
            crossedTokens: null,
          });
        }
      }
      unmatchedSnappedRows += unusedAfter.length;
    }
    coverage[version] = {
      rawRows: rawRows.length,
      snappedRows: snappedRows.length,
      matchedRows,
      unmatchedRawRows,
      unmatchedSnappedRows,
    };
    if (unmatchedRawRows || unmatchedSnappedRows) {
      findings.push({
        code: 'SNAP_LINEAGE_ROW_MISMATCH',
        severity: 'warning',
        tier: 'coverage',
        confidence: 1,
        version,
        message: 'Pre-snap and post-snap SQL artifacts do not contain the same geometry rows',
        evidence: { rawPath, snappedPath, ...coverage[version] },
        autoRepairEligible: false,
      });
    }
  }
  return { measurements, coverage, findings };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function populationStandardDeviation(values: number[], center = mean(values)): number {
  return Math.sqrt(mean(values.map((value) => (value - center) ** 2)));
}

function upperBound(sorted: number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function analyzeSnapDistances(measurements: SnapMeasurement[]): {
  distributions: SnapDistribution[];
  findings: AuditFinding[];
} {
  const distributions: SnapDistribution[] = [];
  const findings: AuditFinding[] = [];
  const populations = new Map<string, SnapMeasurement[]>();
  const sortedValuesByKey = new Map<string, number[]>();
  for (const measurement of measurements) {
    if (measurement.source === 'semantic') continue;
    const key = `${measurement.source}|${measurement.version}|${measurement.boundary}`;
    (populations.get(key) ?? populations.set(key, []).get(key)!).push(measurement);
  }
  const distributionByKey = new Map<string, SnapDistribution>();
  for (const [key, population] of populations) {
    const [source, version, boundary] = key.split('|') as [
      Exclude<SnapSource, 'semantic'>,
      string,
      SnapBoundary,
    ];
    const values = population.map((item) => item.absoluteDistanceStored);
    const signedValues = population.map((item) => item.signedDistanceStored);
    const lineHeightValues = population.map((item) => item.distanceLineHeights);
    const summary = robustDistanceSummary(values);
    const absoluteMean = mean(values);
    const signedMean = mean(signedValues);
    const distribution: SnapDistribution = {
      source,
      version,
      boundary,
      count: summary.count,
      meanSignedStored: Number(signedMean.toFixed(4)),
      medianSignedStored: Number(median(signedValues).toFixed(4)),
      standardDeviationSignedStored: Number(
        populationStandardDeviation(signedValues, signedMean).toFixed(4),
      ),
      meanAbsoluteStored: Number(absoluteMean.toFixed(4)),
      standardDeviationStored: Number(populationStandardDeviation(values, absoluteMean).toFixed(4)),
      medianStored: Number(summary.median.toFixed(4)),
      madStored: Number(summary.mad.toFixed(4)),
      p95Stored: Number(summary.p95.toFixed(4)),
      p99Stored: Number(summary.p99.toFixed(4)),
      maxStored: Number(summary.max.toFixed(4)),
      meanLineHeights: Number(mean(lineHeightValues).toFixed(4)),
      p99LineHeights: Number(percentile(lineHeightValues, 0.99).toFixed(4)),
    };
    distributions.push(distribution);
    distributionByKey.set(key, distribution);
    sortedValuesByKey.set(key, [...values].sort((a, b) => a - b));
  }

  for (const measurement of measurements) {
    const baselineSource = measurement.source === 'semantic' ? 'pixel' : measurement.source;
    const key = `${baselineSource}|${measurement.version}|${measurement.boundary}`;
    const distribution = distributionByKey.get(key);
    const sortedValues = sortedValuesByKey.get(key);
    if (!distribution || !sortedValues) continue;
    const value = measurement.absoluteDistanceStored;
    const robustZ = distribution.madStored > 0
      ? Math.abs(value - distribution.medianStored) / (1.4826 * distribution.madStored)
      : value === distribution.medianStored ? 0 : null;
    const rank = upperBound(sortedValues, value) / Math.max(1, sortedValues.length);
    const classicZ = distribution.standardDeviationStored > 0
      ? Math.abs(value - distribution.meanAbsoluteStored) /
        distribution.standardDeviationStored
      : null;
    const outlier = distribution.count >= 20 &&
      value >= Math.max(3, distribution.p99Stored) &&
      (robustZ == null
        ? classicZ != null && classicZ >= classicZThreshold
        : robustZ >= zThreshold);
    measurement.baselineSource = baselineSource;
    measurement.classicZ = classicZ == null ? null : Number(classicZ.toFixed(4));
    measurement.robustZ = robustZ == null ? null : Number(robustZ.toFixed(4));
    measurement.percentile = Number(rank.toFixed(6));
    measurement.statisticalOutlier = outlier;

    // All distance-tail findings are review-only. The semantic and pixel
    // populations measure current→optimum correction; lineage measures the
    // actual pre-snap→post-snap move retained in generation artifacts.
    const semanticallyRisky = measurement.source === 'semantic' &&
      ((measurement.crossedTokens ?? 0) > 0 || measurement.distanceLineHeights >= 0.35);
    const pixelRisky = measurement.source === 'pixel' &&
      measurement.currentInk != null && measurement.candidateInk != null &&
      measurement.currentInk - measurement.candidateInk >= 0.12;
    const lineageRisky = measurement.source === 'lineage' &&
      measurement.distanceLineHeights >= 0.35;
    if (!outlier || (!semanticallyRisky && !pixelRisky && !lineageRisky)) continue;
    findings.push({
      code: measurement.source === 'semantic'
        ? 'GREEDY_SEMANTIC_SNAP_DISTANCE'
        : measurement.source === 'lineage'
          ? 'HISTORICAL_SNAP_DISTANCE_OUTLIER'
          : 'PIXEL_SNAP_DISTANCE_OUTLIER',
      severity: 'warning',
      tier: 'statistical',
      confidence: measurement.source === 'semantic' ? 0.95 : measurement.source === 'lineage' ? 0.9 : 0.82,
      version: measurement.version,
      uid: measurement.uid ?? undefined,
      verseId: measurement.verseId,
      page: measurement.page,
      imagePage: measurement.imagePage,
      message: measurement.source === 'lineage'
        ? `${measurement.boundary} raw-to-snapped move is outside the edition/boundary lineage distribution`
        : `${measurement.boundary} correction distance is outside the edition/boundary snap distribution`,
      evidence: {
        source: measurement.source,
        boundary: measurement.boundary,
        signedDistancePx: Number(measurement.signedDistancePx.toFixed(3)),
        absoluteDistancePx: Number(measurement.absoluteDistancePx.toFixed(3)),
        signedDistanceStored: Number(measurement.signedDistanceStored.toFixed(3)),
        absoluteDistanceStored: Number(measurement.absoluteDistanceStored.toFixed(3)),
        distanceLineHeights: Number(measurement.distanceLineHeights.toFixed(4)),
        crossedTokens: measurement.crossedTokens,
        classicZ: measurement.classicZ,
        robustZ: measurement.robustZ,
        percentile: measurement.percentile,
        distribution,
      },
      autoRepairEligible: false,
    });
  }
  distributions.sort((a, b) =>
    a.source.localeCompare(b.source) ||
    a.version.localeCompare(b.version) ||
    a.boundary.localeCompare(b.boundary));
  return { distributions, findings };
}

function loadFamilies(): FamilyDefinition[] {
  const defaultFile = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'fax-plate-families.json');
  const source = familiesFile ? path.resolve(familiesFile) : defaultFile;
  if (!fs.existsSync(source)) return DEFAULT_FAMILIES;
  const parsed = JSON.parse(fs.readFileSync(source, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('--families must point to a JSON array');
  return parsed;
}

function csvValue(value: unknown): string {
  const text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function writeOutputs(
  findings: AuditFinding[],
  report: Record<string, unknown>,
  versions: string[],
  snapMeasurements: SnapMeasurement[],
  snapDistributions: SnapDistribution[],
): void {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  const headers = [
    'code', 'severity', 'tier', 'confidence', 'version', 'uid', 'verseId', 'page', 'imagePage',
    'autoRepairEligible', 'message', 'evidence', 'proposedGeometry',
  ];
  const csv = [
    headers.join(','),
    ...findings.map((finding) => headers.map((header) =>
      csvValue((finding as unknown as Record<string, unknown>)[header])).join(',')),
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'findings.csv'), `${csv}\n`);
  if (snapMeasurements.length) {
    const snapHeaders: Array<keyof SnapMeasurement> = [
      'source', 'boundary', 'version', 'uid', 'verseId', 'page', 'imagePage',
      'signedDistancePx', 'absoluteDistancePx', 'signedDistanceStored', 'absoluteDistanceStored',
      'distanceLineHeights', 'currentInk', 'candidateInk', 'crossedTokens', 'baselineSource',
      'classicZ', 'robustZ', 'percentile', 'statisticalOutlier',
    ];
    fs.writeFileSync(path.join(outDir, 'snap-measurements.csv'), [
      snapHeaders.join(','),
      ...snapMeasurements.map((measurement) =>
        snapHeaders.map((header) => csvValue(measurement[header])).join(',')),
      '',
    ].join('\n'));
    const distributionHeaders: Array<keyof SnapDistribution> = [
      'source', 'version', 'boundary', 'count', 'meanSignedStored', 'medianSignedStored',
      'standardDeviationSignedStored', 'meanAbsoluteStored', 'standardDeviationStored',
      'medianStored', 'madStored', 'p95Stored', 'p99Stored', 'maxStored',
      'meanLineHeights', 'p99LineHeights',
    ];
    fs.writeFileSync(path.join(outDir, 'snap-distributions.csv'), [
      distributionHeaders.join(','),
      ...snapDistributions.map((distribution) =>
        distributionHeaders.map((header) => csvValue(distribution[header])).join(',')),
      '',
    ].join('\n'));
  }

  const byCode = new Map<string, number>();
  const byVersion = new Map<string, number>();
  const snapBySource = new Map<SnapSource, number>();
  for (const item of findings) {
    byCode.set(item.code, (byCode.get(item.code) ?? 0) + 1);
    byVersion.set(item.version, (byVersion.get(item.version) ?? 0) + 1);
  }
  for (const measurement of snapMeasurements) {
    snapBySource.set(measurement.source, (snapBySource.get(measurement.source) ?? 0) + 1);
  }
  const lines = [
    '# Fax Geometry Audit',
    '',
    `Generated: ${String(report.generatedAt)}`,
    '',
    `Versions: ${versions.join(', ')}`,
    '',
    `Findings: ${findings.length}`,
    '',
    `Automatic candidates: ${findings.filter((finding) => finding.autoRepairEligible).length}`,
    '',
    '## Snap-distance coverage',
    '',
    '| Source | Measurements | Distributions |',
    '|---|---:|---:|',
    ...(['lineage', 'pixel', 'semantic'] as SnapSource[]).map((source) =>
      `| ${source} | ${snapBySource.get(source) ?? 0} | ` +
      `${snapDistributions.filter((distribution) => distribution.source === source).length} |`),
    '',
    'Full mean/standard-deviation, median/MAD, p95, p99, and maximum tables are in `snap-distributions.csv`.',
    '',
    '## Findings by code',
    '',
    '| Code | Count |',
    '|---|---:|',
    ...[...byCode].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([code, count]) => `| ${code} | ${count} |`),
    '',
    '## Findings by version',
    '',
    '| Version | Count |',
    '|---|---:|',
    ...versions.map((version) => `| ${version} | ${byVersion.get(version) ?? 0} |`),
    '',
    '## Safety',
    '',
    '- Read-only: no SQL was executed or generated.',
    '- Pixel findings are not automatic unless cached OCR identifies the unique canonical word gap.',
    '- Pixel/semantic correction distance is measured from current geometry to the deterministic optimum.',
    '- Historical raw→snapped distance is measured directly when paired relabeled/snapped lineage artifacts exist.',
    '- Distances are ranked against the same source, edition, and boundary distribution.',
    '- Missing scans or OCR are recorded as coverage findings, never interpreted as clean geometry.',
    '',
  ];
  fs.writeFileSync(path.join(outDir, 'summary.md'), lines.join('\n'));
  fs.writeFileSync(path.join(outDir, 'source-manifest.json'), `${JSON.stringify({
    generatedAt: report.generatedAt,
    source: shadowFile
      ? `local SQLite shadow ${path.resolve(shadowFile)} + optional source scans/OCR/lineage`
      : 'live bom_xtras_fax_index + bom_xtras_fax metadata + optional source scans + optional immutable OCR cache + optional pre/post snap SQL lineage',
    versions,
    mediaRoot: usePixels ? mediaRoot : null,
    ocrRoot: usePixels ? ocrRoot : null,
    lineageRoot: useLineage ? lineageRoot : null,
    pixels: usePixels,
    lineage: useLineage,
    callsExternalModels: false,
  }, null, 2)}\n`);
}

async function main(): Promise<void> {
  const timed = <T>(name: string, work: () => T): T => {
    const started = performance.now();
    const result = work();
    console.error(JSON.stringify({
      stage: name,
      elapsedMs: Math.round(performance.now() - started),
      findings: Array.isArray(result) ? result.length : undefined,
    }));
    return result;
  };
  let rawRows: Array<Record<string, unknown>>;
  let rawRegistry: Array<Record<string, unknown>>;
  let canonicalRows: Array<Record<string, unknown>>;
  if (shadowFile) {
    const shadow = openShadow(shadowFile, { queryOnly: true });
    rawRows = loadShadowRows(shadow).map((row) => ({
      uid: row.uid,
      version: row.version,
      verse_id: row.verseId,
      page: row.page,
      pageWidth: row.pageWidth,
      pageScale: row.pageScale,
      X: row.X,
      Y: row.Y,
      W: row.W,
      H: row.H,
      TLW: row.TLW,
      TLH: row.TLH,
      BRW: row.BRW,
      BRH: row.BRH,
    }));
    rawRegistry = shadow.prepare(`
      SELECT slug,NULL AS pages,pgfirstVerse,format FROM bom_xtras_fax
    `).all() as Array<Record<string, unknown>>;
    canonicalRows = usePixels
      ? [...shadowCanonicalText(shadow)].map(([verseId, scripture]) => ({
        verse_id: verseId,
        verse_scripture: scripture,
      }))
      : [];
    shadow.close();
  } else {
    const db = getDb();
    [rawRows, rawRegistry, canonicalRows] = await Promise.all([
      db.selectFrom('bom_xtras_fax_index')
        .select(['uid', 'version', 'verse_id', 'page', 'pageWidth', 'pageScale', 'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH'])
        .execute(),
      db.selectFrom('bom_xtras_fax')
        .select(['slug', 'pages', 'pgfirstVerse', 'format'])
        .execute(),
      usePixels
        ? db.selectFrom('lds_scriptures_verses')
          .select(['verse_id', 'verse_scripture'])
          .where('verse_id', '>=', 31103)
          .where('verse_id', '<=', 37706)
          .execute()
        : Promise.resolve([]),
    ]);
    await closeDb();
  }

  const allDbVersions = [...new Set(rawRows.map((row) => String(row.version)))].sort();
  const versions = requestedVersions.length ? requestedVersions : allDbVersions;
  const registryByVersion = new Map(rawRegistry.map((row) => [String(row.slug), row]));
  const minimumPageByVersion = new Map<string, number>();
  for (const version of versions) {
    const pages = rawRows.filter((row) => String(row.version) === version).map((row) => Number(row.page));
    if (pages.length) minimumPageByVersion.set(version, Math.min(...pages));
  }
  const metas = new Map<string, EditionMeta>();
  for (const version of versions) {
    const registry = registryByVersion.get(version);
    const first = Number(registry?.pgfirstVerse ?? 1);
    const minimum = minimumPageByVersion.get(version) ?? first;
    metas.set(version, {
      version,
      pages: registry?.pages == null ? null : Number(registry.pages),
      pgfirstVerse: first,
      format: String(registry?.format || '').trim() || 'jpg',
      imageOffset: first - minimum,
    });
  }

  const rows: GeometryRow[] = rawRows
    .filter((raw) => versions.includes(String(raw.version)))
    .map((raw) => {
      const version = String(raw.version);
      const meta = metas.get(version)!;
      return {
        uid: Number(raw.uid),
        version,
        verseId: Number(raw.verse_id),
        page: Number(raw.page),
        imagePage: Number(raw.page) + meta.imageOffset,
        pageWidth: Number(raw.pageWidth),
        pageScale: Number(raw.pageScale) || 700,
        X: Number(raw.X),
        Y: Number(raw.Y),
        W: Number(raw.W),
        H: Number(raw.H),
        TLW: Number(raw.TLW),
        TLH: Number(raw.TLH),
        BRW: Number(raw.BRW),
        BRH: Number(raw.BRH),
      };
    });
  const selectedRows = requestedVerseIds.size
    ? rows.filter((row) => requestedVerseIds.has(row.verseId))
    : rows;

  let findings = [
    ...timed('absolute-geometry', () => auditAbsoluteGeometry(selectedRows, metas)),
    ...timed('duplicates-overlaps', () => auditDuplicatesAndOverlaps(selectedRows)),
    ...timed('ordering-notches', () => auditOrderingAndNotches(selectedRows)),
    ...timed('edition-statistics', () => auditEditionStatistics(selectedRows, zThreshold)),
  ];
  // Coverage and family checks need complete edition row sets. Do not emit
  // misleading missing-verse/family results for a targeted verse selection.
  if (!requestedVerseIds.size) {
    findings.push(...timed('coverage', () => auditCoverage(rows, versions)));
    findings.push(...timed('families', () => auditFamilies(rows, loadFamilies())));
  }

  const pixelCoverage: Record<string, {
    selectedPages: number;
    fetchedPages: number;
    failedScans: number;
    ocrPages: number;
    missingOcr: number;
  }> = {};
  const lineHeightByVersion = new Map(versions.map((version) => {
    const heights = rows
      .filter((row) => row.version === version)
      .flatMap((row) => [
        notchActive(row.TLW, row.TLH) ? row.TLH : 0,
        notchActive(row.BRW, row.BRH) ? row.BRH : 0,
      ])
      .filter((height) => height > 0);
    return [version, median(heights) || 24] as const;
  }));
  const snapMeasurements: SnapMeasurement[] = [];
  let snapDistributions: SnapDistribution[] = [];
  let lineageCoverage: Record<string, LineageCoverage> = {};
  if (useLineage) {
    const lineage = loadSnapLineage(versions, selectedRows, metas, lineHeightByVersion);
    for (const measurement of lineage.measurements) snapMeasurements.push(measurement);
    findings.push(...lineage.findings);
    lineageCoverage = lineage.coverage;
  }
  if (usePixels) {
    const canonical = new Map(canonicalRows.map((row: any) => [
      Number(row.verse_id),
      tokenize(String(row.verse_scripture)).map((token) => token.text),
    ]));
    const byVersionPage = new Map<string, GeometryRow[]>();
    for (const row of selectedRows) {
      const key = `${row.version}|${row.imagePage}`;
      (byVersionPage.get(key) ?? byVersionPage.set(key, []).get(key)!).push(row);
    }
    let pageEntries = [...byVersionPage.entries()];
    if (maxPages) pageEntries = pageEntries.slice(0, maxPages);
    for (const version of versions) {
      const selectedPages = pageEntries.filter(([key]) => key.startsWith(`${version}|`)).length;
      pixelCoverage[version] = { selectedPages, fetchedPages: 0, failedScans: 0, ocrPages: 0, missingOcr: 0 };
    }
    await pool(pageEntries, concurrency, async ([key, pageRows]) => {
      const separator = key.lastIndexOf('|');
      const version = key.slice(0, separator);
      const imagePage = Number(key.slice(separator + 1));
      const meta = metas.get(version)!;
      const coverage = pixelCoverage[version]!;
      let ocr: OcrPage | null = null;
      const ocrPath = path.join(ocrRoot, version, `${String(imagePage).padStart(3, '0')}.json`);
      try {
        const candidate = JSON.parse(fs.readFileSync(ocrPath, 'utf8')) as OcrPage;
        if (candidate?.lines?.length && candidate.imgW > 0 && candidate.imgH > 0) {
          ocr = candidate;
          coverage.ocrPages++;
        } else {
          coverage.missingOcr++;
        }
      } catch {
        coverage.missingOcr++;
      }
      let scan: Scan | null = null;
      try {
        const url = `${mediaRoot}/fax/pages/${version}/${String(imagePage).padStart(3, '0')}.${meta.format}`;
        const cachedFile = mediaCache
          ? path.join(
            mediaCache,
            version,
            `${String(imagePage).padStart(3, '0')}.${meta.format}`,
          )
          : null;
        let source: Buffer;
        if (cachedFile && fs.existsSync(cachedFile)) {
          source = fs.readFileSync(cachedFile);
        } else {
          const response = await fetch(url, { signal: AbortSignal.timeout(25_000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          source = Buffer.from(await response.arrayBuffer());
          if (cachedFile) {
            fs.mkdirSync(path.dirname(cachedFile), { recursive: true });
            fs.writeFileSync(cachedFile, source);
          }
        }
        const width = median(pageRows.map((row) => row.pageWidth));
        const raw = await sharp(source)
          .rotate()
          .resize({ width })
          .greyscale()
          .raw()
          .toBuffer({ resolveWithObject: true });
        scan = scanModel(raw.data, raw.info.width, raw.info.height);
        coverage.fetchedPages++;
      } catch (error) {
        coverage.failedScans++;
        findings.push({
          code: 'NO_SCAN',
          severity: 'warning',
          tier: 'coverage',
          confidence: 1,
          version,
          page: pageRows[0]?.page,
          imagePage,
          message: `Source scan could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
          autoRepairEligible: false,
        });
      }
      if (!ocr) {
        findings.push({
          code: 'NO_OCR',
          severity: strictOcr ? 'error' : 'info',
          tier: 'coverage',
          confidence: 1,
          version,
          page: pageRows[0]?.page,
          imagePage,
          message: 'No non-empty cached page OCR is available',
          evidence: { ocrPath },
          autoRepairEligible: false,
        });
      }
      if (!scan) return;
      for (const row of pageRows) {
        const lineHeight = lineHeightByVersion.get(row.version) ?? 24;
        findings.push(...auditPixelEdges(row, scan, snapMeasurements, lineHeight));
        if (ocr) {
          findings.push(...auditSemanticNotches(
            row,
            scan,
            ocr,
            canonical.get(row.verseId) ?? [],
            snapMeasurements,
            lineHeight,
          ));
        }
      }
    });
  }
  const snapAnalysis = analyzeSnapDistances(snapMeasurements);
  snapDistributions = snapAnalysis.distributions;
  const outlierUids = new Set(snapAnalysis.findings
    .map((finding) => finding.uid)
    .filter((uid): uid is number => Number.isInteger(uid)));
  for (const finding of findings) {
    if (finding.uid != null && outlierUids.has(finding.uid) && finding.autoRepairEligible) {
      finding.autoRepairEligible = false;
      finding.evidence = {
        ...(finding.evidence ?? {}),
        automaticRepairBlockedBy: 'SNAP_DISTANCE_OUTLIER',
      };
    }
  }
  findings.push(...snapAnalysis.findings);

  findings = dedupeFindings(findings).sort((a, b) =>
    a.version.localeCompare(b.version) ||
    (a.imagePage ?? 0) - (b.imagePage ?? 0) ||
    (a.verseId ?? 0) - (b.verseId ?? 0) ||
    a.code.localeCompare(b.code));

  const byCode = findings.reduce<Record<string, number>>((counts, item) => {
    counts[item.code] = (counts[item.code] ?? 0) + 1;
    return counts;
  }, {});
  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    callsExternalModels: false,
    configuration: {
      versions,
      shadowFile: shadowFile ? path.resolve(shadowFile) : null,
      pixels: usePixels,
      ocrRoot: usePixels ? ocrRoot : null,
      mediaCache: usePixels ? mediaCache : null,
      requestedVerseIds: [...requestedVerseIds],
      maxPages,
      zThreshold,
      classicZThreshold,
      families: loadFamilies(),
      lineageRoot: useLineage ? lineageRoot : null,
    },
    coverage: {
      geometryRows: selectedRows.length,
      versions: versions.length,
      pixelPages: pixelCoverage,
      snapLineage: lineageCoverage,
    },
    snapDistance: {
      definition: {
        pixel: 'Distance from current DB boundary to deterministic scan-pixel optimum.',
        semantic: 'Distance from current DB notch boundary to the cached-OCR/canonical token gap, ranked against the pixel distribution.',
        lineage: 'Actual raw-to-snapped distance from paired relabeled.sql and snapped.sql generation artifacts.',
      },
      measurements: snapMeasurements.length,
      distributions: snapDistributions,
    },
    summary: {
      findings: findings.length,
      deterministicErrors: findings.filter((item) => item.tier === 'deterministic').length,
      forcedCandidates: findings.filter((item) => item.tier === 'forced').length,
      statisticalWarnings: findings.filter((item) => item.tier === 'statistical').length,
      coverageFindings: findings.filter((item) => item.tier === 'coverage').length,
      autoRepairEligible: findings.filter((item) => item.autoRepairEligible).length,
      byCode,
    },
    findings,
  };
  writeOutputs(findings, report, versions, snapMeasurements, snapDistributions);
  console.log(JSON.stringify({
    out: outDir,
    versions: versions.length,
    rows: selectedRows.length,
    pixels: usePixels,
    findings: findings.length,
    automaticCandidates: report.summary.autoRepairEligible,
    byCode,
  }));
}

await main();
