#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Exhaustive computational render QA for geometry-audit candidates.
 *
 * The source of truth is a local SQLite shadow database. Renders are requested
 * from the local shadow API, OCR uses local Tesseract, and no LLM/vision model
 * is called. Results are checkpointed as NDJSON so an interrupted sweep can be
 * resumed without repeating completed candidates.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { canonicalSelector } from '../src/media/fax/canonical.ts';
import { selectorToVerseIds } from '../src/media/fax/resolve.ts';
import {
  alignBoundary,
  alignRenderedContent,
  assessFocusedBoundaryRecovery,
  classifyRenderedContentFlags,
  type ContentAlignment,
  sameWord,
  scoreContentAlignment,
  tokenizeWords,
} from './lib/fax-render-content-qa.ts';
import {
  loadShadowRows,
  openShadow,
  shadowCanonicalText,
  shadowImageMeta,
  type ShadowGeometry,
} from './lib/fax-shadow-db.ts';

const execFileAsync = promisify(execFile);

type Finding = {
  code: string;
  version: string;
  verseId?: number;
  severity?: string;
  page?: number;
};

type Candidate = {
  version: string;
  verseId: number;
  selector: string;
  codes: string[];
  rows: ShadowGeometry[];
};

type OcrPass = {
  psm: number;
  text: string;
  alignment: ContentAlignment;
};

type CandidateResult = {
  key: string;
  version: string;
  verseId: number;
  selector: string;
  codes: string[];
  rowCount: number;
  pageCount: number;
  url: string;
  httpStatus: number;
  bytes: number;
  width: number | null;
  height: number | null;
  darkFraction: number | null;
  topEdgeInk: number | null;
  bottomEdgeInk: number | null;
  leftEdgeInk: number | null;
  rightEdgeInk: number | null;
  ocrText: string | null;
  ocrMode: number | null;
  ocrTokenCount: number | null;
  canonicalTokenCount: number | null;
  leadingRun: number | null;
  trailingRun: number | null;
  leadingOffset: number | null;
  trailingOffset: number | null;
  longestCanonicalRun: number | null;
  orderedCoverage: number | null;
  largestInteriorCanonicalGap: number | null;
  previousLeakTokens: number;
  followingLeakTokens: number;
  contentQaMode: 'printed-ocr' | 'handwritten-structural';
  sourceMediaUnavailable: boolean;
  sourceMediaEvidence: Array<{
    page: number;
    imagePage: number;
    file: string;
    reason: string;
  }>;
  focusedBoundaryOcr: Array<{
    side: 'start' | 'end';
    stripHeight: number;
    psm: number;
    text: string;
    boundaryRun: number;
    exactBoundaryToken: boolean;
    accepted: boolean;
    reason: string;
  }>;
  status: 'pass' | 'warning' | 'failure' | 'unavailable';
  flags: string[];
  error: string | null;
  file: string | null;
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback?: string): string | undefined => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : fallback;
};
const hasFlag = (name: string): boolean => argv.includes(`--${name}`);
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite')!);
const mediaCache = path.resolve(flag(
  'media-cache',
  path.join(path.dirname(shadowFile), 'media'),
)!);
const auditFile = path.resolve(flag(
  'audit',
  '../docs/audits/fax-geometry/shadow/full-structural-normalized/audit.json',
)!);
const base = flag('base', 'http://127.0.0.1:8311')!.replace(/\/+$/, '');
const outDir = path.resolve(flag(
  'out',
  '../docs/audits/fax-geometry/shadow/candidate-render-qa',
)!);
const width = [400, 800, 1600].includes(Number(flag('width', '800')))
  ? Number(flag('width', '800'))
  : 800;
const concurrency = Math.max(1, Math.min(12, Number(flag('concurrency', '4')) || 4));
const limit = Math.max(0, Number(flag('limit', '0')) || 0);
const resume = !hasFlag('no-resume');
const savePasses = hasFlag('save-passes');
const requestedVersions = new Set(
  (flag('versions') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
);
const ownershipReportFiles = (flag('ownership-report') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => path.resolve(value));
const candidateReportFile = flag('candidate-report');

const criticalCodes = new Set([
  'EMPTY_POLYGON',
  'NON_POSITIVE_SIZE',
  'DISCONNECTED_POLYGON',
  'TINY_EFFECTIVE_AREA',
  'INVALID_TL_NOTCH_WIDTH',
  'INVALID_TL_NOTCH_HEIGHT',
  'INVALID_BR_NOTCH_WIDTH',
  'INVALID_BR_NOTCH_HEIGHT',
  'HALF_TL_NOTCH',
  'HALF_BR_NOTCH',
  'HORIZONTAL_BOUNDS',
  'EXTREME_HEIGHT',
  'DIFFERENT_VERSE_EXACT_GEOMETRY',
  'DIFFERENT_VERSE_NEAR_DUPLICATE',
  'INTERLEAVED_VERSE_FRAGMENT',
  'VERSE_ORDER_INVERSION',
  'PAGE_JUMP_WITHIN_VERSE',
  'TL_NOTCH_AT_PAGE_CONTINUATION',
  'BR_NOTCH_AT_PAGE_CONTINUATION',
  'FAMILY_FRAGMENT_COUNT_MISMATCH',
  'FAMILY_TL_TOPOLOGY_MISMATCH',
  'FAMILY_BR_TOPOLOGY_MISMATCH',
  'MISSING_VERSE',
]);
const risk = flag('risk', 'critical');
const explicitCodes = new Set(
  (flag('codes') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
);

const audit = JSON.parse(fs.readFileSync(auditFile, 'utf8')) as {
  findings: Finding[];
};
const selectedFindings = audit.findings.filter((finding) =>
  finding.verseId != null &&
  (!requestedVersions.size || requestedVersions.has(finding.version)) &&
  (explicitCodes.size
    ? explicitCodes.has(finding.code)
    : risk === 'all' || criticalCodes.has(finding.code)));

const findingCodes = new Map<string, Set<string>>();
for (const finding of selectedFindings) {
  const key = `${finding.version}|${finding.verseId}`;
  const codes = findingCodes.get(key) ?? new Set<string>();
  codes.add(finding.code);
  findingCodes.set(key, codes);
}

if (candidateReportFile) {
  const prior = JSON.parse(fs.readFileSync(
    path.resolve(candidateReportFile),
    'utf8',
  )) as { results: CandidateResult[] };
  for (const result of prior.results) {
    if (result.status !== 'failure') continue;
    if (requestedVersions.size && !requestedVersions.has(result.version)) continue;
    const key = `${result.version}|${result.verseId}`;
    const codes = findingCodes.get(key) ?? new Set<string>();
    codes.add('FAILURE_RECHECK');
    findingCodes.set(key, codes);
  }
}

for (const ownershipReportFile of ownershipReportFiles) {
  const ownership = JSON.parse(fs.readFileSync(ownershipReportFile, 'utf8')) as {
    targetVersion?: string;
    selectedPages?: [number, number] | null;
    proposals: Array<{
      version: string;
      verseId: number;
      outcome: string;
      currentRows?: Array<{ page: number }>;
      proposedRows?: Array<{ page: number }>;
    }>;
  };
  for (const proposal of ownership.proposals) {
    const mediaRange = ownership.selectedPages;
    const proposalPages = [
      ...(proposal.currentRows ?? []),
      ...(proposal.proposedRows ?? []),
    ].map((row) => row.page);
    const isKnownUnavailableMedia = Boolean(
      mediaRange &&
      proposal.version === ownership.targetVersion &&
      proposalPages.some((page) => page >= mediaRange[0] && page <= mediaRange[1]),
    );
    if (isKnownUnavailableMedia) {
      const key = `${proposal.version}|${proposal.verseId}`;
      const codes = findingCodes.get(key) ?? new Set<string>();
      codes.add('SOURCE_MEDIA_UNAVAILABLE');
      findingCodes.set(key, codes);
    }
    if (!proposal.outcome.startsWith('ACCEPTED_')) continue;
    if (requestedVersions.size && !requestedVersions.has(proposal.version)) continue;
    const key = `${proposal.version}|${proposal.verseId}`;
    const codes = findingCodes.get(key) ?? new Set<string>();
    codes.add('REMEDIATION_VERIFICATION');
    codes.add(proposal.outcome);
    findingCodes.set(key, codes);
  }
}

// User-reported regressions are permanent fixtures, even when a later
// structural pass no longer emits a finding for them.
const regressionFixtures = [
  ['1849', '1-nephi-9.4'],
  ['1849', 'alma-51.23'],
  ['1849', 'alma-52.12'],
  ['1852', 'mosiah-15.9'],
  ['1852', '3-nephi-12.2'],
  ['1852', '3-nephi-15.1'],
  ['1854', 'moroni-7.40'],
  ['1854', 'moroni-7.41'],
  ['1866', '1-nephi-14.2'],
  ['1874', '1-nephi-14.7'],
  ['1882', 'alma-40.19'],
] as const;
for (const [version, selector] of regressionFixtures) {
  if (requestedVersions.size && !requestedVersions.has(version)) continue;
  const verseId = selectorToVerseIds(selector)[0];
  if (verseId == null) throw new Error(`invalid regression fixture: ${version}/${selector}`);
  const key = `${version}|${verseId}`;
  const codes = findingCodes.get(key) ?? new Set<string>();
  codes.add('REGRESSION_FIXTURE');
  findingCodes.set(key, codes);
}

const db = openShadow(shadowFile, { queryOnly: true });
const canonical = shadowCanonicalText(db);
const versions = [...new Set([...findingCodes.keys()].map((key) => key.split('|')[0]!))];
const imageMeta = new Map(versions.map((version) => [
  version,
  shadowImageMeta(db, version),
]));
const allRows = loadShadowRows(db, { versions });
db.close();
const rowsByPair = new Map<string, ShadowGeometry[]>();
for (const row of allRows) {
  const key = `${row.version}|${row.verseId}`;
  const rows = rowsByPair.get(key) ?? [];
  rows.push(row);
  rowsByPair.set(key, rows);
}

let candidates = [...findingCodes.entries()].map(([key, codes]): Candidate => {
  const [version, verseIdText] = key.split('|');
  const verseId = Number(verseIdText);
  return {
    version: version!,
    verseId,
    selector: canonicalSelector([verseId]),
    codes: [...codes].sort(),
    rows: rowsByPair.get(key) ?? [],
  };
}).sort((left, right) =>
  left.version.localeCompare(right.version, undefined, { numeric: true }) ||
  left.verseId - right.verseId);
if (limit) candidates = candidates.slice(0, limit);

fs.mkdirSync(outDir, { recursive: true });
const imageDir = path.join(outDir, 'images');
fs.mkdirSync(imageDir, { recursive: true });
const checkpointFile = path.join(outDir, 'results.ndjson');
const completed = new Map<string, CandidateResult>();
if (resume && fs.existsSync(checkpointFile)) {
  for (const line of fs.readFileSync(checkpointFile, 'utf8').split(/\n+/)) {
    if (!line.trim()) continue;
    const result = JSON.parse(line) as CandidateResult;
    completed.set(result.key, result);
  }
}
if (!resume) fs.writeFileSync(checkpointFile, '');

function boundaryNeighborMatch(
  extras: string[],
  neighborText: string,
  side: 'previous' | 'following',
): number {
  if (!extras.length || !neighborText) return 0;
  const neighbor = tokenizeWords(neighborText);
  if (!neighbor.length) return 0;
  const alignment = alignBoundary(
    extras,
    neighbor,
    side === 'previous' ? 'end' : 'start',
    1,
  );
  return alignment.boundaryRun;
}

function baseResult(candidate: Candidate): CandidateResult {
  return {
    key: `${candidate.version}|${candidate.verseId}`,
    version: candidate.version,
    verseId: candidate.verseId,
    selector: candidate.selector,
    codes: candidate.codes,
    rowCount: candidate.rows.length,
    pageCount: new Set(candidate.rows.map((row) => row.page)).size,
    url: `${base}/fax/render/${candidate.version}/crop/w${width}/${candidate.selector}.jpg`,
    httpStatus: 0,
    bytes: 0,
    width: null,
    height: null,
    darkFraction: null,
    topEdgeInk: null,
    bottomEdgeInk: null,
    leftEdgeInk: null,
    rightEdgeInk: null,
    ocrText: null,
    ocrMode: null,
    ocrTokenCount: null,
    canonicalTokenCount: null,
    leadingRun: null,
    trailingRun: null,
    leadingOffset: null,
    trailingOffset: null,
    longestCanonicalRun: null,
    orderedCoverage: null,
    largestInteriorCanonicalGap: null,
    previousLeakTokens: 0,
    followingLeakTokens: 0,
    contentQaMode: candidate.version === 'printer'
      ? 'handwritten-structural'
      : 'printed-ocr',
    sourceMediaUnavailable: false,
    sourceMediaEvidence: [],
    focusedBoundaryOcr: [],
    status: 'failure',
    flags: [],
    error: null,
    file: null,
  };
}

async function inspectUnavailableSourceMedia(
  candidate: Candidate,
): Promise<CandidateResult['sourceMediaEvidence']> {
  const meta = imageMeta.get(candidate.version);
  if (!meta) return [];
  const evidence: CandidateResult['sourceMediaEvidence'] = [];
  for (const page of [...new Set(candidate.rows.map((row) => row.page))]) {
    const imagePage = page + meta.offset;
    const file = path.join(
      mediaCache,
      candidate.version,
      `${String(imagePage).padStart(3, '0')}.${meta.format}`,
    );
    if (!fs.existsSync(file)) continue;
    const metadata = await sharp(file).metadata();
    if (!metadata.hasAlpha) continue;
    const alpha = await sharp(file)
      .ensureAlpha()
      .extractChannel('alpha')
      .stats();
    if ((alpha.channels[0]?.max ?? 255) > 1) continue;
    evidence.push({
      page,
      imagePage,
      file: path.relative(path.dirname(shadowFile), file),
      reason: 'fully-transparent-source-scan',
    });
  }
  return evidence;
}

async function runOcr(file: string, psm: number, canonicalText: string): Promise<OcrPass> {
  const { stdout } = await execFileAsync(
    'tesseract',
    [path.basename(file), 'stdout', '-l', 'eng', '--psm', String(psm)],
    { cwd: path.dirname(file), maxBuffer: 4 * 1024 * 1024 },
  );
  return {
    psm,
    text: stdout.trim(),
    alignment: alignRenderedContent(stdout, canonicalText),
  };
}

async function focusedBoundaryOcr(
  file: string,
  side: 'start' | 'end',
  canonicalText: string,
  fullAlignment: ContentAlignment,
  edgeInk: number,
): Promise<CandidateResult['focusedBoundaryOcr'][number] | null> {
  const metadata = await sharp(file).metadata();
  const imageWidth = metadata.width ?? 0;
  const imageHeight = metadata.height ?? 0;
  if (imageWidth < 40 || imageHeight < 20) return null;
  const stripHeights = [...new Set([
    Math.round(imageHeight * 0.10),
    Math.round(imageHeight * 0.14),
    Math.round(imageHeight * 0.18),
  ].map((value) => Math.max(18, Math.min(64, value))))];
  const attempts: CandidateResult['focusedBoundaryOcr'] = [];
  for (const stripHeight of stripHeights) {
    const temporary = path.join(
      path.dirname(file),
      `.${path.basename(file)}.${side}.${stripHeight}.focused.png`,
    );
    try {
      const top = side === 'start' ? 0 : imageHeight - stripHeight;
      await sharp(file)
        .extract({ left: 0, top, width: imageWidth, height: stripHeight })
        .extend({
          top: 24,
          bottom: 24,
          left: 24,
          right: 24,
          background: '#ffffff',
        })
        .resize({ width: (imageWidth + 48) * 2 })
        .png()
        .toFile(temporary);
      for (const psm of [7, 11]) {
        const pass = await runOcr(temporary, psm, canonicalText);
        const assessment = assessFocusedBoundaryRecovery({
          side,
          fullAlignment,
          stripAlignment: pass.alignment,
          edgeInk,
        });
        attempts.push({
          side,
          stripHeight,
          psm,
          text: pass.text,
          boundaryRun: assessment.boundaryRun,
          exactBoundaryToken: assessment.exactBoundaryToken,
          accepted: assessment.accepted,
          reason: assessment.reason,
        });
      }
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  return attempts.sort((left, right) =>
    Number(right.accepted) - Number(left.accepted) ||
    right.boundaryRun - left.boundaryRun ||
    left.stripHeight - right.stripHeight ||
    left.psm - right.psm)[0] ?? null;
}

async function inspect(candidate: Candidate): Promise<CandidateResult> {
  const result = baseResult(candidate);
  if (!candidate.rows.length) {
    result.flags.push('missing-box-row');
    result.error = 'No shadow geometry row exists for this verse';
    return result;
  }
  const finalFile = path.join(
    imageDir,
    `${candidate.version}__${candidate.selector.replaceAll('/', '__')}.jpg`,
  );
  try {
    const response = await fetch(result.url, {
      signal: AbortSignal.timeout(45_000),
      headers: { accept: 'image/jpeg' },
    });
    result.httpStatus = response.status;
    if (!response.ok) {
      result.flags.push(`http-${response.status}`);
      result.error = (await response.text()).slice(0, 500);
      result.status = response.status === 404 ||
          /scan fetch failed 404/i.test(result.error)
        ? 'unavailable'
        : 'failure';
      return result;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    result.bytes = buffer.length;
    fs.writeFileSync(finalFile, buffer);
    result.file = path.relative(outDir, finalFile);

    const decoded = await sharp(buffer).greyscale().raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = decoded.data;
    const imageWidth = decoded.info.width;
    const imageHeight = decoded.info.height;
    result.width = imageWidth;
    result.height = imageHeight;
    const edgeDepth = Math.max(1, Math.min(3, Math.floor(Math.min(
      imageWidth,
      imageHeight,
    ) / 4)));
    let dark = 0;
    let top = 0;
    let bottom = 0;
    let left = 0;
    let right = 0;
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        if (pixels[y * imageWidth + x]! >= 160) continue;
        dark++;
        if (y < edgeDepth) top++;
        if (y >= imageHeight - edgeDepth) bottom++;
        if (x < edgeDepth) left++;
        if (x >= imageWidth - edgeDepth) right++;
      }
    }
    result.darkFraction = dark / Math.max(1, imageWidth * imageHeight);
    result.topEdgeInk = top / Math.max(1, imageWidth * edgeDepth);
    result.bottomEdgeInk = bottom / Math.max(1, imageWidth * edgeDepth);
    result.leftEdgeInk = left / Math.max(1, imageHeight * edgeDepth);
    result.rightEdgeInk = right / Math.max(1, imageHeight * edgeDepth);

    if (buffer.length < 1_000) result.flags.push('suspiciously-small-response');
    if (imageWidth < 40 || imageHeight < 12) result.flags.push('suspicious-dimensions');
    if (imageWidth > width) result.flags.push('width-exceeds-request');
    if (result.darkFraction < 0.002) result.flags.push('nearly-blank');
    if (result.darkFraction > 0.65) result.flags.push('mostly-dark');
    if (result.topEdgeInk > 0.10) result.flags.push('top-edge-ink-review');
    if (result.bottomEdgeInk > 0.35) result.flags.push('bottom-edge-ink-review');
    if (result.leftEdgeInk > 0.20) result.flags.push('left-edge-ink-review');
    if (result.rightEdgeInk > 0.30) result.flags.push('right-edge-ink-review');

    if (result.flags.includes('nearly-blank') ||
        result.flags.includes('suspiciously-small-response')) {
      result.sourceMediaEvidence = await inspectUnavailableSourceMedia(candidate);
      if (result.sourceMediaEvidence.length) {
        result.sourceMediaUnavailable = true;
        result.flags.push('source-media-unavailable');
        result.status = 'unavailable';
        return result;
      }
    }

    // The printer source is a handwritten manuscript. Printed-text Tesseract
    // scores are not evidence of missing content for this modality; retain
    // decode, nonblank, dimensions, and edge-contact checks as its render gate.
    if (result.contentQaMode === 'handwritten-structural') {
      result.flags.push('handwritten-content-ocr-skipped');
      const hardPixelFlags = new Set([
        'suspiciously-small-response',
        'suspicious-dimensions',
        'width-exceeds-request',
        'nearly-blank',
        'mostly-dark',
        'request-decode-or-ocr-error',
      ]);
      result.status = result.flags.some((value) => hardPixelFlags.has(value))
        ? 'failure'
        : result.flags.some((value) => value !== 'handwritten-content-ocr-skipped')
          ? 'warning'
          : 'pass';
      if (!savePasses && result.status === 'pass') {
        fs.unlinkSync(finalFile);
        result.file = null;
      }
      return result;
    }

    const expected = canonical.get(candidate.verseId) ?? '';
    const primary = await runOcr(finalFile, 6, expected);
    const passes = [primary];
    if (primary.alignment.longestRun < 3 ||
        primary.alignment.leading.boundaryRun < 2 ||
        primary.alignment.trailing.boundaryRun < 2 ||
        primary.alignment.sequence.canonicalCoverage < 0.78) {
      passes.push(await runOcr(finalFile, 11, expected));
    }
    const selected = passes.sort((leftPass, rightPass) =>
      scoreContentAlignment(rightPass.alignment) -
      scoreContentAlignment(leftPass.alignment))[0]!;
    const alignment = selected.alignment;
    result.ocrText = selected.text;
    result.ocrMode = selected.psm;
    result.ocrTokenCount = alignment.ocrTokens.length;
    result.canonicalTokenCount = alignment.canonicalTokens.length;
    result.leadingRun = alignment.leading.boundaryRun;
    result.trailingRun = alignment.trailing.boundaryRun;
    result.leadingOffset = alignment.leading.boundaryOffset;
    result.trailingOffset = alignment.trailing.boundaryOffset;
    result.longestCanonicalRun = alignment.longestRun;
    result.orderedCoverage = alignment.sequence.canonicalCoverage;
    result.largestInteriorCanonicalGap =
      alignment.sequence.largestInteriorCanonicalGap;
    if (alignment.leading.boundaryRun === 0 &&
        alignment.sequence.canonicalCoverage >= 0.85) {
      const focused = await focusedBoundaryOcr(
        finalFile,
        'start',
        expected,
        alignment,
        result.topEdgeInk ?? 1,
      );
      if (focused) {
        result.focusedBoundaryOcr.push(focused);
        if (focused.accepted) {
          result.leadingRun = Math.max(
            result.leadingRun ?? 0,
            focused.boundaryRun,
          );
        }
      }
    }
    if (alignment.trailing.boundaryRun === 0 &&
        alignment.sequence.canonicalCoverage >= 0.85) {
      const focused = await focusedBoundaryOcr(
        finalFile,
        'end',
        expected,
        alignment,
        result.bottomEdgeInk ?? 1,
      );
      if (focused) {
        result.focusedBoundaryOcr.push(focused);
        if (focused.accepted) {
          result.trailingRun = Math.max(
            result.trailingRun ?? 0,
            focused.boundaryRun,
          );
        }
      }
    }
    const leadingRecovered = result.focusedBoundaryOcr.some((item) =>
      item.side === 'start' && item.accepted);
    const trailingRecovered = result.focusedBoundaryOcr.some((item) =>
      item.side === 'end' && item.accepted);

    if (alignment.ocrTokens.length < 3 || alignment.longestRun < 3) {
      result.flags.push('ocr-content-unreliable');
    } else {
      const leadingOffset = alignment.leading.boundaryOffset ??
        alignment.leading.bestOffset ?? 0;
      const trailingOffset = alignment.trailing.boundaryOffset ??
        alignment.trailing.bestOffset ?? 0;
      const leadingExtras = alignment.ocrTokens.slice(0, leadingOffset);
      const trailingExtras = trailingOffset
        ? alignment.ocrTokens.slice(-trailingOffset)
        : [];
      result.previousLeakTokens = boundaryNeighborMatch(
        leadingExtras,
        canonical.get(candidate.verseId - 1) ?? '',
        'previous',
      );
      result.followingLeakTokens = boundaryNeighborMatch(
        trailingExtras,
        canonical.get(candidate.verseId + 1) ?? '',
        'following',
      );
      if (result.previousLeakTokens > 0) {
        result.flags.push('preceding-neighbor-text-leak');
      } else if (leadingExtras.length) {
        result.flags.push('unmatched-leading-content');
      }
      if (result.followingLeakTokens > 0) {
        result.flags.push('following-neighbor-text-leak');
      } else if (trailingExtras.length) {
        result.flags.push('unmatched-trailing-content');
      }

      if (alignment.leading.boundaryRun === 0 && !leadingRecovered) {
        if ((alignment.leading.bestOffset ?? 0) > 0 &&
            alignment.leading.bestRun >= 3) {
          result.flags.push('preceding-content-before-verse');
        } else {
          result.flags.push('canonical-leading-token-missing');
        }
      } else if (alignment.leading.boundaryRun === 1) {
        result.flags.push('weak-leading-token-run');
      }
      if (alignment.trailing.boundaryRun === 0 && !trailingRecovered) {
        if ((alignment.trailing.bestOffset ?? 0) > 0 &&
            alignment.trailing.bestRun >= 3) {
          result.flags.push('following-content-after-verse');
        } else {
          result.flags.push('canonical-trailing-token-missing');
        }
      } else if (alignment.trailing.boundaryRun === 1) {
        result.flags.push('weak-trailing-token-run');
      }
      if (leadingRecovered) {
        result.flags.push('leading-token-recovered-by-focused-ocr');
      }
      if (trailingRecovered) {
        result.flags.push('trailing-token-recovered-by-focused-ocr');
      }
      const interiorGapLimit = Math.max(
        4,
        Math.ceil(alignment.canonicalTokens.length * 0.12),
      );
      if (alignment.leading.boundaryRun > 0 &&
          alignment.trailing.boundaryRun > 0 &&
          alignment.canonicalTokens.length >= 12 &&
          alignment.sequence.canonicalCoverage < 0.78 &&
          alignment.sequence.largestInteriorCanonicalGap > interiorGapLimit) {
        result.flags.push('internal-canonical-span-missing');
      }
    }
  } catch (error) {
    result.flags.push('request-decode-or-ocr-error');
    result.error = error instanceof Error ? error.message : String(error);
    if (/404|fetch failed|timeout/i.test(result.error)) result.status = 'unavailable';
    return result;
  }

  result.status = classifyRenderedContentFlags(result.flags);
  const familyMediaUnavailable =
    candidate.codes.includes('ACCEPTED_FAMILY_CONSENSUS_MEDIA_UNAVAILABLE') ||
    candidate.codes.includes('SOURCE_MEDIA_UNAVAILABLE');
  const unavailableMediaFlags = new Set([
    'suspiciously-small-response',
    'suspicious-dimensions',
    'nearly-blank',
    'ocr-content-unreliable',
  ]);
  if (familyMediaUnavailable &&
      result.flags.length > 0 &&
      result.flags.every((value) => unavailableMediaFlags.has(value))) {
    result.flags.push('source-media-unavailable');
    result.status = 'unavailable';
  }
  if (!savePasses && result.status === 'pass') {
    fs.unlinkSync(finalFile);
    result.file = null;
  }
  return result;
}

async function mapConcurrent<T, R>(
  values: T[],
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from(
    { length: Math.min(concurrency, values.length) },
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

const pending = candidates.filter((candidate) =>
  !completed.has(`${candidate.version}|${candidate.verseId}`));
const fresh = await mapConcurrent(pending, async (candidate, index) => {
  const result = await inspect(candidate);
  fs.appendFileSync(checkpointFile, `${JSON.stringify(result)}\n`);
  console.error(JSON.stringify({
    progress: `${index + 1}/${pending.length}`,
    version: result.version,
    selector: result.selector,
    status: result.status,
    flags: result.flags,
  }));
  return result;
});
for (const result of fresh) completed.set(result.key, result);
const selectedKeys = new Set(candidates.map((candidate) =>
  `${candidate.version}|${candidate.verseId}`));
const results = [...completed.values()]
  .filter((result) => selectedKeys.has(result.key))
  .sort((left, right) =>
    left.version.localeCompare(right.version, undefined, { numeric: true }) ||
    left.verseId - right.verseId);

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

// Edge contact is naturally edition-specific. Flag robust within-version
// outliers (six MADs) instead of imposing one global typography threshold.
const edgeMetrics = [
  ['topEdgeInk', 'top-edge-ink-statistical-outlier'],
  ['bottomEdgeInk', 'bottom-edge-ink-statistical-outlier'],
  ['leftEdgeInk', 'left-edge-ink-statistical-outlier'],
  ['rightEdgeInk', 'right-edge-ink-statistical-outlier'],
] as const;
for (const version of new Set(results.map((result) => result.version))) {
  const versionResults = results.filter((result) =>
    result.version === version && result.httpStatus === 200);
  for (const [field, outlierFlag] of edgeMetrics) {
    const population = versionResults
      .map((result) => result[field])
      .filter((value): value is number => value != null);
    if (population.length < 20) continue;
    const center = median(population);
    const mad = median(population.map((value) => Math.abs(value - center)));
    const floor = field === 'bottomEdgeInk' ? 0.20 : 0.08;
    const cutoff = Math.max(floor, center + Math.max(0.01, 6 * 1.4826 * mad));
    for (const result of versionResults) {
      if ((result[field] ?? 0) > cutoff && !result.flags.includes(outlierFlag)) {
        result.flags.push(outlierFlag);
        if (result.status === 'pass') result.status = 'warning';
      }
    }
  }
}

const summary = {
  candidates: candidates.length,
  resumed: candidates.length - pending.length,
  rendered: results.filter((result) => result.httpStatus === 200).length,
  pass: results.filter((result) => result.status === 'pass').length,
  warning: results.filter((result) => result.status === 'warning').length,
  failure: results.filter((result) => result.status === 'failure').length,
  unavailable: results.filter((result) => result.status === 'unavailable').length,
};
const report = {
  generatedAt: new Date().toISOString(),
  shadowFile,
  mediaCache,
  auditFile,
  ownershipReportFiles,
  candidateReportFile: candidateReportFile
    ? path.resolve(candidateReportFile)
    : null,
  base,
  risk,
  requestedCodes: explicitCodes.size ? [...explicitCodes].sort() : null,
  requestedVersions: requestedVersions.size ? [...requestedVersions].sort() : null,
  width,
  concurrency,
  summary,
  byVersion: Object.fromEntries(
    [...new Set(results.map((result) => result.version))].sort().map((version) => {
      const scoped = results.filter((result) => result.version === version);
      return [version, {
        candidates: scoped.length,
        pass: scoped.filter((result) => result.status === 'pass').length,
        warning: scoped.filter((result) => result.status === 'warning').length,
        failure: scoped.filter((result) => result.status === 'failure').length,
        unavailable: scoped.filter((result) => result.status === 'unavailable').length,
      }];
    }),
  ),
  byFlag: Object.fromEntries(
    [...new Set(results.flatMap((result) => result.flags))].sort().map((value) => [
      value,
      results.filter((result) => result.flags.includes(value)).length,
    ]),
  ),
  results,
};
fs.writeFileSync(path.join(outDir, 'qa-report.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'remediation-targets.txt'), [
  ...results
    .filter((result) => result.status === 'failure')
    .map((result) => `${result.version}:${result.selector}`),
  '',
].join('\n'));
fs.writeFileSync(path.join(outDir, 'unavailable-targets.txt'), [
  ...results
    .filter((result) => result.status === 'unavailable')
    .map((result) => `${result.version}:${result.selector}`),
  '',
].join('\n'));
console.log(JSON.stringify({ outDir, ...summary }, null, 2));
if (summary.failure || summary.unavailable) process.exitCode = 1;
