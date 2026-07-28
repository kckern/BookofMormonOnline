#!/usr/bin/env npx tsx
/**
 * Reconstruct failed verse geometry from deterministic OCR word ownership.
 *
 * No LLM or vision model is called. Source pages are OCRed with local
 * Tesseract TSV output. Canonical current/neighbor text anchors the first and
 * last owned words; scan word boxes determine outer bounds and notches.
 *
 * The script is read-only with respect to the DB and emits proposals only.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { getDb, closeDb } from '../src/data/db.ts';
import { sanitizeBoxes, toFragments } from '../src/media/fax/geometry.ts';
import { renderImage } from '../src/media/fax/render.ts';
import { selectorToVerseIds } from '../src/media/fax/resolve.ts';
import type { FaxBox } from '../src/media/fax/types.ts';
import {
  alignedRunAt,
  alignRenderedContent,
  type ContentAlignment,
  longestSharedRun,
  normalizeWord,
  scoreContentAlignment,
  sameWord,
  tokenizeWords,
} from './lib/fax-render-content-qa.ts';
import {
  loadShadowRows,
  openShadow,
  shadowCanonicalText,
} from './lib/fax-shadow-db.ts';

const execFileAsync = promisify(execFile);

type Geometry = {
  uid: number | null;
  version: string;
  verseId: number;
  page: number;
  pageWidth: number;
  pageScale: number;
  X: number;
  Y: number;
  W: number;
  H: number;
  TLW: number;
  TLH: number;
  BRW: number;
  BRH: number;
};

type RenderFailure = {
  version: string;
  verseId: number;
  selector: string;
  mode?: 'crop' | 'page';
  httpStatus: number;
  status: 'pass' | 'warning' | 'failure';
  flags: string[];
  ocrText: string | null;
  topEdgeInk: number | null;
  bottomEdgeInk: number | null;
  leftEdgeInk: number | null;
  rightEdgeInk: number | null;
};

type OcrWord = {
  text: string;
  normalized: string;
  left: number;
  top: number;
  width: number;
  height: number;
  lineIndex: number;
  indexInLine: number;
};

type OcrLine = {
  key: string;
  words: OcrWord[];
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type OcrPage = {
  storedPage: number;
  imagePage: number;
  imageWidth: number;
  imageHeight: number;
  scan: Buffer;
  media: {
    transparent: boolean;
    entropy: number;
  };
  lines: OcrLine[];
  words: OcrWord[];
};

type Anchor = {
  method:
    | 'current-prefix'
    | 'previous-suffix'
    | 'current-suffix'
    | 'next-prefix'
    | 'page-body-end';
  storedPage: number;
  imagePage: number;
  wordIndex: number;
  word: OcrWord;
  line: OcrLine;
  run: number;
};

type OcrPass = {
  psm: number;
  text: string;
  alignment: ContentAlignment;
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback?: string): string | undefined => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : fallback;
};

const qaRoot = path.resolve(flag(
  'qa-root',
  '../docs/audits/fax-geometry/2026-07-26-exhaustive',
)!);
const outDir = path.resolve(flag(
  'out',
  '../docs/audits/fax-geometry/2026-07-26-line-ownership',
)!);
const only = new Set((flag('only') ?? '').split(',').map((value) => value.trim()).filter(Boolean));
const requestedVersionFilter = new Set(
  (flag('versions') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
);
const concurrency = Math.max(1, Math.min(5, Number(flag('concurrency', '3')) || 3));
const sourcePsm = Math.max(3, Math.min(13, Number(flag('source-psm', '3')) || 3));
const explicitTargets = (flag('targets') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const shadowFile = flag('shadow');
const mediaCacheFlag = flag('media-cache');
const mediaCache = mediaCacheFlag || shadowFile
  ? path.resolve(
    mediaCacheFlag ??
      path.join(path.dirname(path.resolve(shadowFile!)), 'media'),
  )
  : null;
const qaReportFile = flag('qa-report');
const reportFiles = qaReportFile
  ? [path.resolve(qaReportFile)]
  : explicitTargets.length
    ? []
  : [
    '1842', '1849', '1852', '1854', '1854l',
    '1866', '1871', '1874', '1877', 'derivatives',
  ].map((name) => path.join(qaRoot, name, 'qa-report.json'));
const reportFailures = reportFiles.flatMap((file) => {
  const report = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    renderResults?: RenderFailure[];
    results?: RenderFailure[];
  };
  const results = report.renderResults ?? report.results ?? [];
  return results.filter((result) =>
    (result.mode == null || result.mode === 'crop') &&
    result.status === 'failure' &&
    (result.httpStatus === 200 || result.flags.includes('missing-box-row')) &&
    (!requestedVersionFilter.size || requestedVersionFilter.has(result.version)) &&
    (!only.size || only.has(`${result.version}:${result.selector}`)));
});
const targetFailures: RenderFailure[] = explicitTargets.map((target) => {
  const separator = target.indexOf(':');
  if (separator < 1 || separator === target.length - 1) {
    throw new Error(`invalid --targets entry ${target}; expected VERSION:SELECTOR`);
  }
  const version = target.slice(0, separator);
  const selector = target.slice(separator + 1);
  const verseIds = selectorToVerseIds(selector);
  if (verseIds.length !== 1) {
    throw new Error(`--targets requires one verse selector: ${target}`);
  }
  return {
    version,
    verseId: verseIds[0]!,
    selector,
    mode: 'crop',
    httpStatus: 200,
    status: 'failure',
    flags: ['explicit-source-ownership-audit'],
    ocrText: null,
    topEdgeInk: null,
    bottomEdgeInk: null,
    leftEdgeInk: null,
    rightEdgeInk: null,
  };
});
const failureMap = new Map<string, RenderFailure>();
for (const failure of [...reportFailures, ...targetFailures]) {
  failureMap.set(`${failure.version}:${failure.selector}`, failure);
}
const failures = [...failureMap.values()];
const versions = [...new Set(failures.map((failure) => failure.version))].sort();

let rows: Geometry[];
let canonical: Map<number, string>;
let registryRows: Array<{
  slug: unknown;
  pgfirstVerse: unknown;
  format: unknown;
  bgcolor: unknown;
}>;
if (shadowFile) {
  const shadow = openShadow(shadowFile, { queryOnly: true });
  rows = loadShadowRows(shadow, { versions }).map((row) => ({ ...row }));
  canonical = shadowCanonicalText(shadow);
  registryRows = shadow.prepare(`
    SELECT slug,pgfirstVerse,format,bgcolor FROM bom_xtras_fax
    WHERE slug IN (${versions.map(() => '?').join(',')})
  `).all(...versions) as typeof registryRows;
  shadow.close();
} else {
  const db = getDb();
  const [rawRows, canonicalRows, rawRegistryRows] = await Promise.all([
    db.selectFrom('bom_xtras_fax_index')
      .select([
        'uid', 'version', 'verse_id', 'page', 'pageWidth', 'pageScale',
        'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH',
      ])
      .where('version', 'in', versions)
      .execute(),
    db.selectFrom('lds_scriptures_verses')
      .select(['verse_id', 'verse_scripture'])
      .where('verse_id', '>=', 31103)
      .where('verse_id', '<=', 37706)
      .execute(),
    db.selectFrom('bom_xtras_fax')
      .select(['slug', 'pgfirstVerse', 'format', 'bgcolor'])
      .where('slug', 'in', versions)
      .execute(),
  ]);
  await closeDb();
  rows = rawRows.map((row) => ({
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
  canonical = new Map(canonicalRows.map((row) => [
    Number(row.verse_id),
    String(row.verse_scripture),
  ]));
  registryRows = rawRegistryRows;
}
const rowsByVerse = new Map<string, Geometry[]>();
const rowsByPage = new Map<string, Geometry[]>();
const minimumPage = new Map<string, number>();
for (const row of rows) {
  const verseKey = `${row.version}|${row.verseId}`;
  const pageKey = `${row.version}|${row.page}`;
  (rowsByVerse.get(verseKey) ?? rowsByVerse.set(verseKey, []).get(verseKey)!).push(row);
  (rowsByPage.get(pageKey) ?? rowsByPage.set(pageKey, []).get(pageKey)!).push(row);
  minimumPage.set(
    row.version,
    Math.min(minimumPage.get(row.version) ?? Number.POSITIVE_INFINITY, row.page),
  );
}
const normalizePaper = (value: unknown): string => {
  const text = String(value ?? '').trim();
  if (!text) return '#faf7f0';
  return /^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(text) ? `#${text}` : text;
};
const registry = new Map(registryRows.map((row) => {
  const version = String(row.slug);
  return [version, {
    offset: Number(row.pgfirstVerse ?? 1) - (minimumPage.get(version) ?? 0),
    format: String(row.format || '').trim() || 'jpg',
    paper: normalizePaper(row.bgcolor),
  }];
}));

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fax-line-ownership-'));
const pageCache = new Map<string, Promise<OcrPage>>();

function parseTsv(
  tsv: string,
  storedPage: number,
  imagePage: number,
  imageWidth: number,
  imageHeight: number,
  scan: Buffer,
  media: OcrPage['media'],
): OcrPage {
  const linesByKey = new Map<string, OcrLine>();
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const fields = row.split('\t');
    if (fields.length < 12 || fields[0] !== '5') continue;
    const normalized = normalizeWord(fields.slice(11).join('\t'));
    if (!normalized) continue;
    const key = `${fields[2]}|${fields[3]}|${fields[4]}`;
    const line = linesByKey.get(key) ?? {
      key,
      words: [],
      left: Number.POSITIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
    };
    const word: OcrWord = {
      text: fields.slice(11).join('\t'),
      normalized,
      left: Number(fields[6]),
      top: Number(fields[7]),
      width: Number(fields[8]),
      height: Number(fields[9]),
      lineIndex: -1,
      indexInLine: line.words.length,
    };
    line.words.push(word);
    line.left = Math.min(line.left, word.left);
    line.top = Math.min(line.top, word.top);
    line.right = Math.max(line.right, word.left + word.width);
    line.bottom = Math.max(line.bottom, word.top + word.height);
    linesByKey.set(key, line);
  }
  const lines = [...linesByKey.values()];
  lines.forEach((line, lineIndex) => {
    // Tesseract occasionally gives one word a box spanning two physical
    // lines. Exclude height outliers before taking line extents so that one
    // bad word cannot cross the interline whitespace into the next verse.
    const medianHeight = median(line.words.map((word) => word.height));
    const normalWords = line.words.filter((word) =>
      word.height <= Math.max(1, medianHeight) * 1.60);
    const extentWords = normalWords.length ? normalWords : line.words;
    line.top = Math.min(...extentWords.map((word) => word.top));
    line.bottom = Math.max(...extentWords.map((word) => word.top + word.height));
    line.words.forEach((word, indexInLine) => {
      word.lineIndex = lineIndex;
      word.indexInLine = indexInLine;
    });
  });
  return {
    storedPage,
    imagePage,
    imageWidth,
    imageHeight,
    scan,
    media,
    lines,
    words: lines.flatMap((line) => line.words),
  };
}

async function loadPage(version: string, storedPage: number): Promise<OcrPage> {
  const cacheKey = `${version}|${storedPage}`;
  let promise = pageCache.get(cacheKey);
  if (!promise) {
    promise = (async () => {
      const meta = registry.get(version);
      if (!meta) throw new Error(`missing registry metadata for ${version}`);
      const imagePage = storedPage + meta.offset;
      const url = `https://media.bookofmormon.online/fax/pages/${version}/` +
        `${String(imagePage).padStart(3, '0')}.${meta.format}`;
      const cachedFile = mediaCache
        ? path.join(
          mediaCache,
          version,
          `${String(imagePage).padStart(3, '0')}.${meta.format}`,
        )
        : null;
      let scan: Buffer;
      if (cachedFile && fs.existsSync(cachedFile)) {
        scan = fs.readFileSync(cachedFile);
      } else {
        const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (!response.ok) throw new Error(`scan fetch failed ${response.status} ${url}`);
        scan = Buffer.from(await response.arrayBuffer());
        if (cachedFile) {
          fs.mkdirSync(path.dirname(cachedFile), { recursive: true });
          fs.writeFileSync(cachedFile, scan);
        }
      }
      const imageFile = path.join(
        temporaryRoot,
        `${version}-${String(imagePage).padStart(3, '0')}.${meta.format}`,
      );
      fs.writeFileSync(imageFile, scan);
      const { stdout: tsv } = await execFileAsync(
        'tesseract',
        [path.basename(imageFile), 'stdout', '-l', 'eng', '--psm', String(sourcePsm), 'tsv'],
        { cwd: temporaryRoot, maxBuffer: 16 * 1024 * 1024 },
      );
      const { default: sharp } = await import('sharp');
      const [metadata, stats] = await Promise.all([
        sharp(scan).metadata(),
        sharp(scan).stats(),
      ]);
      const alpha = metadata.hasAlpha ? stats.channels.at(-1) : null;
      return parseTsv(
        tsv,
        storedPage,
        imagePage,
        metadata.width!,
        metadata.height!,
        scan,
        {
          transparent: Boolean(alpha && alpha.max === 0),
          entropy: Number(stats.entropy) || 0,
        },
      );
    })();
    pageCache.set(cacheKey, promise);
  }
  return promise;
}

function anchorCandidates(
  page: OcrPage,
  canonicalText: string,
  side: 'start' | 'end',
  method: Anchor['method'],
): Anchor[] {
  const ocr = page.words.map((word) => word.normalized);
  const expected = tokenizeWords(canonicalText);
  if (!ocr.length || !expected.length) return [];
  const minimumRun = Math.min(3, expected.length);
  const candidates: Anchor[] = [];
  for (let wordIndex = 0; wordIndex < ocr.length; wordIndex++) {
    const offset = side === 'start' ? wordIndex : ocr.length - 1 - wordIndex;
    const run = alignedRunAt(ocr, expected, side, offset);
    if (run < minimumRun) continue;
    const word = page.words[wordIndex]!;
    candidates.push({
      method,
      storedPage: page.storedPage,
      imagePage: page.imagePage,
      wordIndex,
      word,
      line: page.lines[word.lineIndex]!,
      run,
    });
  }
  // Do not promote an interior match to a physical-line boundary.  That used
  // to convert a match beginning at (for example) "harden" into a claimed
  // current-prefix anchor at the line's unrelated first word ("the"), which
  // silently erased the required notch across a preceding verse.  A damaged
  // exterior token is ambiguous: let the adjacent-verse anchor establish the
  // lexical boundary, or leave the item CONDITIONAL.
  return candidates;
}

function pageBodyEndCandidates(pages: OcrPage[]): Anchor[] {
  return pages.flatMap((page) => {
    const line = [...page.lines]
      .filter((candidate) =>
        !isLikelyHeading(candidate) &&
        candidate.bottom < page.imageHeight * 0.97)
      .sort((left, right) => right.bottom - left.bottom || right.right - left.right)[0];
    const word = line?.words.at(-1);
    if (!line || !word) return [];
    return [{
      method: 'page-body-end' as const,
      storedPage: page.storedPage,
      imagePage: page.imagePage,
      wordIndex: page.words.indexOf(word),
      word,
      line,
      run: sameWord(word.normalized, 'amen') ? 3 : 1,
    }];
  });
}

function anchorOrder(anchor: Anchor, pages: OcrPage[]): number {
  let order = 0;
  for (const page of pages) {
    if (page.storedPage === anchor.storedPage) return order + anchor.wordIndex;
    order += page.words.length;
  }
  return Number.POSITIVE_INFINITY;
}

function isLikelyHeading(line: OcrLine): boolean {
  const text = line.words.map((word) => word.text).join(' ');
  return isLikelyHeadingText(text);
}

function isLikelyHeadingText(text: string): boolean {
  if (/\b(?:BOOK\s+OF|CHAP(?:TER)?\.?)\b/.test(text)) return true;
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length < 5) return false;
  const uppercase = letters.replace(/[^A-Z]/g, '').length;
  return uppercase / letters.length >= 0.78;
}

function adjacentBoundary(
  anchor: Anchor,
  delta: -1 | 1,
  method: Anchor['method'],
  pages: OcrPage[],
): Anchor | null {
  const pageIndex = pages.findIndex((page) => page.storedPage === anchor.storedPage);
  if (pageIndex < 0) return null;
  let targetPage = pages[pageIndex]!;
  const sameLineWord = isLikelyHeading(anchor.line)
    ? undefined
    : anchor.line.words[anchor.word.indexInLine + delta];
  let word = sameLineWord;
  if (!word) {
    const lineCenter = (anchor.line.left + anchor.line.right) / 2;
    const viable = (line: OcrLine, continuation: boolean): boolean => {
      const width = line.right - line.left;
      const center = (line.left + line.right) / 2;
      return !isLikelyHeading(line) &&
        (!continuation || width >= targetPage.imageWidth * 0.20) &&
        Math.abs(center - lineCenter) <= targetPage.imageWidth * 0.30;
    };
    const neighboringLines = targetPage.lines.filter((line) =>
      line !== anchor.line &&
      viable(line, false) &&
      (delta > 0 ? line.top > anchor.line.top : line.top < anchor.line.top));
    const line = neighboringLines.sort((left, right) =>
      delta > 0
        ? left.top - right.top || left.left - right.left
        : right.top - left.top || right.left - left.left)[0];
    if (line) {
      word = delta > 0 ? line.words[0] : line.words.at(-1);
    } else {
      targetPage = pages[pageIndex + delta]!;
      if (targetPage) {
        const continuationLines = targetPage.lines
          .filter((line) => viable(line, true))
          .sort((left, right) =>
            delta > 0
              ? left.top - right.top || left.left - right.left
              : right.top - left.top || right.left - left.left);
        const continuation = continuationLines[0];
        word = continuation
          ? delta > 0 ? continuation.words[0] : continuation.words.at(-1)
          : undefined;
      }
    }
  }
  if (!word) return null;
  const wordIndex = targetPage.words.indexOf(word);
  if (wordIndex < 0) return null;
  return {
    ...anchor,
    method,
    storedPage: targetPage.storedPage,
    imagePage: targetPage.imagePage,
    wordIndex,
    word,
    line: targetPage.lines[word.lineIndex]!,
  };
}

function chooseCompatibleAnchors(
  starts: Anchor[],
  ends: Anchor[],
  pages: OcrPage[],
  canonicalTokenCount: number,
  firstPage: number,
  lastPage: number,
  currentRows: Geometry[],
): { start: Anchor; end: Anchor; spanTokens: number; spanRatio: number } | null {
  const candidates: Array<{
    start: Anchor;
    end: Anchor;
    spanTokens: number;
    spanRatio: number;
    rank: number;
  }> = [];
  for (const start of starts) {
    const startOrder = anchorOrder(start, pages);
    for (const end of ends) {
      const endOrder = anchorOrder(end, pages);
      if (!Number.isFinite(startOrder) || endOrder < startOrder) continue;
      const spanTokens = endOrder - startOrder + 1;
      const spanRatio = spanTokens / Math.max(1, canonicalTokenCount);
      if (spanRatio < 0.25 || spanRatio > 3) continue;
      const lexical = Math.min(60, start.run) + Math.min(60, end.run);
      const currentMethodBonus =
        Number(start.method === 'current-prefix') * 25 +
        Number(end.method === 'current-suffix') * 25;
      const pageDistance =
        Math.abs(start.storedPage - firstPage) +
        Math.abs(end.storedPage - lastPage);
      const lengthPenalty = Math.abs(Math.log(spanRatio)) * 20;
      const startCurrent = currentRows.find((row) => row.page === start.storedPage);
      const endCurrent = [...currentRows].reverse()
        .find((row) => row.page === end.storedPage);
      const startPage = pages.find((page) => page.storedPage === start.storedPage);
      const endPage = pages.find((page) => page.storedPage === end.storedPage);
      const geometryPenalty =
        (startCurrent && startPage
          ? Math.min(50, Math.abs(lineTop(start.line, startPage) - startCurrent.Y) / 4)
          : 0) +
        (endCurrent && endPage
          ? Math.min(
            50,
            Math.abs(
              lineBottom(end.line, endPage) -
              (endCurrent.Y + endCurrent.H),
            ) / 4,
          )
          : 0);
      candidates.push({
        start,
        end,
        spanTokens,
        spanRatio,
        rank: lexical + currentMethodBonus - pageDistance * 3 -
          lengthPenalty - geometryPenalty,
      });
    }
  }
  const ranked = candidates.sort((left, right) =>
    right.rank - left.rank ||
    right.start.run + right.end.run - left.start.run - left.end.run ||
    Math.abs(left.spanRatio - 1) - Math.abs(right.spanRatio - 1));
  // If the source page independently contains strong prefix and suffix runs
  // for the current canonical verse, that is a more direct ownership proof
  // than walking backward from the next verse across a chapter/book heading.
  const direct = ranked
    .filter((candidate) =>
      candidate.start.method === 'current-prefix' &&
      candidate.end.method === 'current-suffix' &&
      candidate.start.run >= 3 &&
      candidate.end.run >= 3 &&
      candidate.spanRatio >= 0.50 &&
      candidate.spanRatio <= 1.50)
    .sort((left, right) =>
      right.start.run + right.end.run - left.start.run - left.end.run ||
      Math.abs(left.spanRatio - 1) - Math.abs(right.spanRatio - 1))[0];
  return direct ?? ranked[0] ?? null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function quantile(values: number[], percentile: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * percentile))]!;
}

function pageTemplate(
  version: string,
  storedPage: number,
  page: OcrPage,
  referenceLine: OcrLine,
  preferred: Geometry | null,
  canonicalText: string,
): { x: number; right: number; top: number; bottom: number; pageWidth: number } {
  const k = 700 / page.imageWidth;
  const lineLeft = referenceLine.left * k;
  const lineRight = referenceLine.right * k;
  const referenceBlock = referenceLine.key.split('|')[0];
  const blockLines = page.lines.filter((line) => line.key.split('|')[0] === referenceBlock);
  const sourceLines = blockLines.length ? blockLines : [referenceLine];
  let sourceLeft = quantile(sourceLines.map((line) => line.left * k), 0.10);
  let sourceRight = quantile(sourceLines.map((line) => line.right * k), 0.90);
  const valid = (rowsByPage.get(`${version}|${storedPage}`) ?? [])
    .filter((row) => row.X > 0 && row.Y > 0 && row.W > 0 && row.H > 0);
  const typicalWidth = median(valid.map((row) => row.W));
  if (typicalWidth > 0 && sourceRight - sourceLeft < typicalWidth * 0.65) {
    sourceLeft = median(valid.map((row) => row.X));
    sourceRight = median(valid.map((row) => row.X + row.W));
  }
  const sourceWidth = Math.max(1, sourceRight - sourceLeft);
  const canonicalTokens = tokenizeWords(canonicalText);
  // Tesseract can split a continuation at the top of a new page into several
  // blocks. Restrict by the reference column, but derive its vertical extent
  // from all body lines in that column rather than only the anchor's block.
  const columnBodyLines = page.lines.filter((line) => {
    if (isLikelyHeading(line)) return false;
    const canonicalRun = longestSharedRun(
      line.words.map((word) => word.normalized),
      canonicalTokens,
    );
    if (canonicalRun < Math.min(2, canonicalTokens.length)) {
      return false;
    }
    const left = line.left * k;
    const right = line.right * k;
    const overlap = Math.max(0, Math.min(right, sourceRight) - Math.max(left, sourceLeft));
    return (right - left) >= sourceWidth * 0.25 &&
      overlap >= Math.min(right - left, sourceWidth) * 0.55;
  });
  const bodyLines = columnBodyLines.length
    ? columnBodyLines
    : sourceLines.filter((line) =>
      line === referenceLine ||
      (!isLikelyHeading(line) && (line.right - line.left) * k >= sourceWidth * 0.25));
  const extentLines = bodyLines.length ? bodyLines : [referenceLine];
  const sourceTop = Math.min(...extentLines.map((line) => lineTop(line, page)));
  const sourceBottom = Math.max(...extentLines.map((line) => lineBottom(line, page)));
  const horizontalOverlap = (row: Geometry): number =>
    Math.max(0, Math.min(row.X + row.W, lineRight) - Math.max(row.X, lineLeft));
  const best = preferred && preferred.X >= 0 && preferred.Y >= 0 && preferred.W > 0
    ? preferred
    : [...valid].sort((left, right) => horizontalOverlap(right) - horizontalOverlap(left))[0] ?? null;
  const columnRows = best
    ? valid.filter((row) =>
      Math.max(0, Math.min(row.X + row.W, best.X + best.W) - Math.max(row.X, best.X)) >
      Math.min(row.W, best.W) * 0.5)
    : valid;
  const templateRows = columnRows.length ? columnRows : valid;
  const preferredOverlap = preferred
    ? Math.max(
      0,
      Math.min(preferred.X + preferred.W, sourceRight) -
      Math.max(preferred.X, sourceLeft),
    )
    : 0;
  const preferredPlausible = Boolean(
    preferred &&
    preferred.X > 0 &&
    preferred.W >= sourceWidth * 0.78 &&
    preferred.W <= sourceWidth * 1.30 &&
    preferredOverlap >= sourceWidth * 0.75
  );
  const resolvedX = preferredPlausible
      ? preferred.X
      : sourceLeft || median(templateRows.map((row) => row.X)) || lineLeft;
  const resolvedRight = preferredPlausible
      ? preferred.X + preferred.W
      : sourceRight || median(templateRows.map((row) => row.X + row.W)) || lineRight;
  return {
    x: Math.max(0, Math.round(Math.min(resolvedX, sourceLeft) - 3)),
    right: Math.round(Math.max(resolvedRight, sourceRight) + 3),
    top: sourceTop,
    bottom: sourceBottom,
    pageWidth: Math.round(median(templateRows.map((row) => row.pageWidth)) || page.imageWidth),
  };
}

function lineTop(line: OcrLine, page: OcrPage): number {
  return Math.max(0, Math.round((line.top - 2) / page.imageWidth * 700));
}

function lineBottom(line: OcrLine, page: OcrPage): number {
  return Math.round((line.bottom + 2) / page.imageWidth * 700);
}

function boundaryBefore(word: OcrWord, line: OcrLine, page: OcrPage): number {
  const previous = line.words[word.indexInLine - 1];
  const pixel = previous
    ? (previous.left + previous.width + word.left) / 2
    : word.left - 2;
  return Math.round(pixel / page.imageWidth * 700);
}

function boundaryAfter(word: OcrWord, line: OcrLine, page: OcrPage): number {
  const following = line.words[word.indexInLine + 1];
  const pixel = following
    ? (word.left + word.width + following.left) / 2
    : word.left + word.width + 2;
  return Math.round(pixel / page.imageWidth * 700);
}

function toFaxBoxes(geometry: Geometry[]): FaxBox[] {
  return sanitizeBoxes(geometry.map((row) => ({
    verseId: row.verseId,
    page: row.page,
    pageWidth: row.pageWidth,
    pageScale: row.pageScale,
    x: row.X,
    y: row.Y,
    w: row.W,
    h: row.H,
    tlw: row.TLW,
    tlh: row.TLH,
    brw: row.BRW,
    brh: row.BRH,
  })));
}

async function runOcr(imageFile: string, canonicalText: string): Promise<OcrPass> {
  const execute = async (psm: number): Promise<OcrPass> => {
    const { stdout } = await execFileAsync(
      'tesseract',
      [path.basename(imageFile), 'stdout', '-l', 'eng', '--psm', String(psm)],
      { cwd: path.dirname(imageFile), maxBuffer: 2 * 1024 * 1024 },
    );
    return {
      psm,
      text: stdout.trim(),
      alignment: alignRenderedContent(stdout, canonicalText),
    };
  };
  const primary = await execute(6);
  if (primary.alignment.longestRun < 3 ||
      (primary.alignment.leading.boundaryRun > 0 &&
       primary.alignment.trailing.boundaryRun > 0)) return primary;
  const sparse = await execute(11);
  return scoreContentAlignment(sparse.alignment) > scoreContentAlignment(primary.alignment)
    ? sparse
    : primary;
}

async function mapConcurrent<T, R>(
  values: T[],
  limit: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      output[index] = await worker(values[index]!, index);
    }
  }));
  return output;
}

fs.mkdirSync(path.join(outDir, 'images'), { recursive: true });
async function buildProposal(failure: RenderFailure, index: number) {
  const verseKey = `${failure.version}|${failure.verseId}`;
  const currentRows = [...(rowsByVerse.get(verseKey) ?? [])]
    .sort((left, right) => left.page - right.page || left.Y - right.Y);
  const nearbyRows = (direction: -1 | 1): Geometry[] => {
    for (let distance = 1; distance <= 12; distance++) {
      const candidate = rowsByVerse.get(
        `${failure.version}|${failure.verseId + direction * distance}`,
      );
      if (candidate?.length) {
        return [...candidate].sort((left, right) =>
          left.page - right.page || left.Y - right.Y);
      }
    }
    return [];
  };
  const previousRows = nearbyRows(-1);
  const nextRows = nearbyRows(1);
  const base = {
    version: failure.version,
    verseId: failure.verseId,
    selector: failure.selector,
    sourceFlags: failure.flags,
    currentRows,
  };
  if (!currentRows.length && !previousRows.length && !nextRows.length) {
    return { ...base, outcome: 'NO_CURRENT_ROWS', error: null };
  }
  try {
    const previousPage = previousRows.at(-1)?.page;
    const nextPage = nextRows[0]?.page;
    const inferredPages = [previousPage, nextPage]
      .filter((page): page is number => page != null);
    const firstPage = currentRows[0]?.page ??
      Math.min(...inferredPages);
    const lastPage = currentRows.at(-1)?.page ??
      Math.max(...inferredPages);
    // A black/missing scan leaf can shift a plate-derived page assignment.
    // Search a bounded local neighborhood and let lexical anchors, not copied
    // page numbers, decide ownership.
    const candidatePageNumbers: number[] = [];
    for (let page = Math.max(1, firstPage - 3); page <= lastPage + 3; page++) {
      candidatePageNumbers.push(page);
    }
    const pages = (await Promise.all(candidatePageNumbers.map(async (page) => {
      try {
        return await loadPage(failure.version, page);
      } catch {
        return null;
      }
    }))).filter((page): page is OcrPage => page != null);
    const currentText = canonical.get(failure.verseId) ?? '';
    const previousText = canonical.get(failure.verseId - 1) ?? '';
    const nextText = canonical.get(failure.verseId + 1) ?? '';
    const currentAlignmentBefore = alignRenderedContent(
      failure.ocrText ?? '',
      currentText,
    );
    const leadingSubstitution =
      currentAlignmentBefore.leading.boundarySubstitution;
    const trailingSubstitution =
      currentAlignmentBefore.trailing.boundarySubstitution;
    const substitutionOnlyFlags = new Set([
      'canonical-leading-token-missing',
      'leading-fragment-missing',
      'canonical-trailing-token-missing',
      'trailing-fragment-missing',
    ]);
    const substitutionEdgesClear =
      (!leadingSubstitution ||
       (!currentRows.some((row) => row.TLW > 0 && row.TLH > 0) &&
        (failure.topEdgeInk ?? 1) < 0.10 &&
        (failure.leftEdgeInk ?? 1) < 0.05)) &&
      (!trailingSubstitution ||
       (!currentRows.some((row) => row.BRW > 0 && row.BRH > 0) &&
        (failure.bottomEdgeInk ?? 1) < 0.10 &&
        (failure.rightEdgeInk ?? 1) < 0.10));
    if ((leadingSubstitution || trailingSubstitution) &&
        currentAlignmentBefore.leading.boundaryRun >= 2 &&
        currentAlignmentBefore.trailing.boundaryRun >= 2 &&
        currentAlignmentBefore.longestRun >= 4 &&
        failure.flags.every((item) => substitutionOnlyFlags.has(item)) &&
        substitutionEdgesClear) {
      return {
        ...base,
        outcome: 'KEEP_CURRENT_OCR_SUBSTITUTION',
        currentOcr: {
          text: failure.ocrText,
          leadingRun: currentAlignmentBefore.leading.boundaryRun,
          trailingRun: currentAlignmentBefore.trailing.boundaryRun,
          longestRun: currentAlignmentBefore.longestRun,
          leadingSubstitution,
          trailingSubstitution,
          edges: {
            top: failure.topEdgeInk,
            bottom: failure.bottomEdgeInk,
            left: failure.leftEdgeInk,
            right: failure.rightEdgeInk,
          },
        },
        error: null,
      };
    }
    const mediaPages = currentRows
      .map((row) => pages.find((page) => page.storedPage === row.page))
      .filter((page): page is OcrPage => page != null);
    if (currentRows.length > 0 &&
        mediaPages.length === currentRows.length &&
        mediaPages.every((page) =>
          page.media.transparent ||
          (!page.words.length && page.media.entropy < 0.05))) {
      return {
        ...base,
        outcome: 'MEDIA_UNAVAILABLE',
        media: mediaPages.map((page) => ({
          page: page.storedPage,
          imagePage: page.imagePage,
          transparent: page.media.transparent,
          entropy: page.media.entropy,
          words: page.words.length,
        })),
        error: 'all assigned source leaves are transparent or blank',
      };
    }

    const startCurrent = pages.flatMap((page) =>
      anchorCandidates(page, currentText, 'start', 'current-prefix'));
    const startPrevious = pages.flatMap((page) =>
      anchorCandidates(page, previousText, 'end', 'previous-suffix'))
      .map((anchor) => adjacentBoundary(anchor, 1, 'previous-suffix', pages))
      .filter((anchor): anchor is Anchor => anchor != null);
    const endCurrent = pages.flatMap((page) =>
      anchorCandidates(page, currentText, 'end', 'current-suffix'));
    const endNext = pages.flatMap((page) =>
      anchorCandidates(page, nextText, 'start', 'next-prefix'))
      .map((anchor) => adjacentBoundary(anchor, -1, 'next-prefix', pages))
      .filter((anchor): anchor is Anchor => anchor != null);
    const endTerminal = nextText.trim() ? [] : pageBodyEndCandidates(pages);
    const compatible = chooseCompatibleAnchors(
      [...startCurrent, ...startPrevious],
      [...endCurrent, ...endNext, ...endTerminal],
      pages,
      tokenizeWords(currentText).length,
      firstPage,
      lastPage,
      currentRows,
    );
    if (!compatible) {
      throw new Error(
        `compatible anchors missing: starts=${startCurrent.length}+${startPrevious.length}, ` +
        `ends=${endCurrent.length}+${endNext.length}+${endTerminal.length}`,
      );
    }
    const { start, end, spanTokens, spanRatio } = compatible;

    const proposedRows: Geometry[] = [];
    for (let storedPage = start.storedPage; storedPage <= end.storedPage; storedPage++) {
      const page = pages.find((candidate) => candidate.storedPage === storedPage) ??
        await loadPage(failure.version, storedPage);
      const preferred = currentRows.find((row) => row.page === storedPage) ?? null;
      const referenceLine = storedPage === start.storedPage
        ? start.line
        : storedPage === end.storedPage
          ? end.line
          : page.lines[Math.floor(page.lines.length / 2)]!;
      const template = pageTemplate(
        failure.version,
        storedPage,
        page,
        referenceLine,
        preferred,
        currentText,
      );
      const top = storedPage === start.storedPage
        ? lineTop(start.line, page)
        : template.top;
      const bottom = storedPage === end.storedPage
        ? lineBottom(end.line, page)
        : template.bottom;
      const row: Geometry = {
        uid: preferred?.uid ?? null,
        version: failure.version,
        verseId: failure.verseId,
        page: storedPage,
        pageWidth: template.pageWidth,
        pageScale: 700,
        X: template.x,
        Y: top,
        W: Math.max(1, Math.min(
          700 - template.x,
          template.right - template.x,
        )),
        H: Math.max(1, bottom - top),
        TLW: 0,
        TLH: 0,
        BRW: 0,
        BRH: 0,
      };
      if (storedPage === start.storedPage && start.word.indexInLine > 0) {
        row.TLW = Math.max(0, Math.min(
          row.W,
          boundaryBefore(start.word, start.line, page) - row.X,
        ));
        row.TLH = Math.max(1, lineBottom(start.line, page) - row.Y);
      }
      if (storedPage === end.storedPage &&
          end.word.indexInLine < end.line.words.length - 1) {
        row.BRW = Math.max(0, Math.min(
          row.W,
          row.X + row.W - boundaryAfter(end.word, end.line, page),
        ));
        row.BRH = Math.max(1, row.Y + row.H - lineTop(end.line, page));
      }
      proposedRows.push(row);
    }

    const meta = registry.get(failure.version)!;
    const rendered = await renderImage({
      mode: 'crop',
      ext: 'jpg',
      width: 800,
      fragments: toFragments(toFaxBoxes(proposedRows)),
      paper: meta.paper,
      provider: async (storedPage) =>
        (pages.find((candidate) => candidate.storedPage === storedPage) ??
         await loadPage(failure.version, storedPage)).scan,
    });
    const imageFile = path.join(
      outDir,
      'images',
      `${failure.version}__${failure.selector}__proposed.jpg`,
    );
    fs.writeFileSync(imageFile, rendered);
    const candidateOcr = await runOcr(imageFile, currentText);
    const currentAlignment = alignRenderedContent(failure.ocrText ?? '', currentText);
    const candidateScore = scoreContentAlignment(candidateOcr.alignment);
    const currentScore = scoreContentAlignment(currentAlignment);
    const containsPageFurniture = candidateOcr.text.split(/\r?\n/).some((line) =>
      isLikelyHeadingText(line) &&
      /\b(?:book|chapter|chap)\b/i.test(line));
    const canonicalTokenCount = tokenizeWords(currentText).length;
    const proposedTokenCount = candidateOcr.alignment.ocrTokens.length;
    const cropSpanCoverage = spanTokens > 0 ? proposedTokenCount / spanTokens : 0;
    const cropSpanCoveragePass = cropSpanCoverage >= 0.72;
    const startPage = pages.find((page) => page.storedPage === start.storedPage)!;
    const endPage = pages.find((page) => page.storedPage === end.storedPage)!;
    const startRow = proposedRows.find((row) => row.page === start.storedPage)!;
    const endRow = proposedRows.find((row) => row.page === end.storedPage)!;
    const startWordLeft = start.word.left / startPage.imageWidth * 700;
    const endWordRight =
      (end.word.left + end.word.width) / endPage.imageWidth * 700;
    const visibleStart = startRow.X +
      (startRow.TLH > 0 ? startRow.TLW : 0);
    const visibleEnd = endRow.X + endRow.W -
      (endRow.BRH > 0 ? endRow.BRW : 0);
    const boundaryClearance = {
      startLeft: startWordLeft - visibleStart,
      endRight: visibleEnd - endWordRight,
    };
    const currentStartRow = currentRows.find((row) => row.page === start.storedPage);
    const currentEndRow = [...currentRows].reverse()
      .find((row) => row.page === end.storedPage);
    const currentBoundaryClearance = currentStartRow && currentEndRow
      ? {
        startLeft: startWordLeft - (
          currentStartRow.X +
          (currentStartRow.TLH > 0 ? currentStartRow.TLW : 0)
        ),
        endRight: (
          currentEndRow.X + currentEndRow.W -
          (currentEndRow.BRH > 0 ? currentEndRow.BRW : 0)
        ) - endWordRight,
        startTop: lineTop(start.line, startPage) - currentStartRow.Y,
        endBottom: currentEndRow.Y + currentEndRow.H -
          lineBottom(end.line, endPage),
      }
      : null;
    const currentBoundaryFit = currentStartRow && currentEndRow &&
      currentStartRow.page === start.storedPage &&
      currentEndRow.page === end.storedPage
      ? (() => {
        const expectedStart = boundaryBefore(start.word, start.line, startPage);
        const expectedEnd = boundaryAfter(end.word, end.line, endPage);
        const currentVisibleStart = currentStartRow.X +
          (currentStartRow.TLW > 0 && currentStartRow.TLH > 0
            ? currentStartRow.TLW
            : 0);
        const currentVisibleEnd = currentEndRow.X + currentEndRow.W -
          (currentEndRow.BRW > 0 && currentEndRow.BRH > 0
            ? currentEndRow.BRW
            : 0);
        const startHorizontalError = currentVisibleStart - expectedStart;
        const endHorizontalError = currentVisibleEnd - expectedEnd;
        const startTopInset = lineTop(start.line, startPage) - currentStartRow.Y;
        const endBottomInset = currentEndRow.Y + currentEndRow.H -
          lineBottom(end.line, endPage);
        const startAtLineEdge = start.word.indexInLine === 0;
        const endAtLineEdge =
          end.word.indexInLine === end.line.words.length - 1;
        // Mid-line verse ownership should meet the measured inter-word gap.
        // At a physical line edge the box normally spans the full text column
        // (and may include a printed verse number), so outward whitespace is
        // unbounded; only inward clipping is invalid.
        const startHorizontalPass = startAtLineEdge
          ? startHorizontalError <= 4
          : Math.abs(startHorizontalError) <= 10;
        const endHorizontalPass = endAtLineEdge
          ? endHorizontalError >= -4
          : Math.abs(endHorizontalError) <= 10;
        const startVerticalPass =
          startTopInset >= -3 && startTopInset <= 12;
        const endVerticalPass =
          endBottomInset >= -3 && endBottomInset <= 12;
        return {
          expectedStart,
          expectedEnd,
          currentVisibleStart,
          currentVisibleEnd,
          startHorizontalError,
          endHorizontalError,
          startTopInset,
          endBottomInset,
          startAtLineEdge,
          endAtLineEdge,
          startHorizontalPass,
          endHorizontalPass,
          startVerticalPass,
          endVerticalPass,
          pass: startHorizontalPass && endHorizontalPass &&
            startVerticalPass && endVerticalPass,
        };
      })()
      : null;
    const minimumBoundaryRun = Math.min(2, canonicalTokenCount);
    const minimumInteriorRun = Math.min(4, canonicalTokenCount);
    const sourceRunFloor = Math.min(5, canonicalTokenCount);
    const sourceStrong = start.run >= sourceRunFloor && end.run >= sourceRunFloor &&
      spanRatio >= 0.55 && spanRatio <= 1.65;
    const sourceComplete =
      start.run >= Math.max(1, canonicalTokenCount - 1) &&
      end.run >= Math.max(1, canonicalTokenCount - 1) &&
      boundaryClearance.startLeft >= 2 &&
      boundaryClearance.endRight >= 2;
    const exactMethods =
      start.method === 'current-prefix' && end.method === 'current-suffix';
    const currentSourceComplete = Boolean(
      exactMethods &&
      start.run >= Math.max(1, canonicalTokenCount - 1) &&
      end.run >= Math.max(1, canonicalTokenCount - 1) &&
      currentRows[0]?.page === start.storedPage &&
      currentRows.at(-1)?.page === end.storedPage &&
      currentBoundaryClearance &&
      currentBoundaryClearance.startLeft >= 2 &&
      currentBoundaryClearance.endRight >= 2 &&
      currentBoundaryClearance.startTop >= 0 &&
      currentBoundaryClearance.endBottom >= 0
    );
    const canonicalCropPass =
      candidateOcr.alignment.leading.boundaryRun >= minimumBoundaryRun &&
      candidateOcr.alignment.trailing.boundaryRun >= minimumBoundaryRun &&
      candidateOcr.alignment.longestRun >= minimumInteriorRun &&
      cropSpanCoveragePass;
    const historicalBoundary =
      start.method === 'previous-suffix' ||
      end.method === 'next-prefix' ||
      end.method === 'page-body-end';
    const historicalCropPass =
      candidateOcr.alignment.longestRun >= Math.min(6, canonicalTokenCount) &&
      cropSpanCoveragePass &&
      (start.method === 'previous-suffix' ||
       candidateOcr.alignment.leading.boundaryRun >= minimumBoundaryRun) &&
      (end.method === 'next-prefix' || end.method === 'page-body-end' ||
       candidateOcr.alignment.trailing.boundaryRun >= minimumBoundaryRun);
    const nonRegressing = candidateScore >= currentScore;
    const terminalEnd = !nextText.trim() &&
      pageBodyEndCandidates([endPage]).some((candidate) =>
        candidate.word === end.word);
    const historicalRunsStrong =
      Math.min(start.run, end.run) >= Math.min(5, canonicalTokenCount) &&
      start.run + end.run >= Math.min(12, canonicalTokenCount * 2);
    const terminalSourceStrong =
      terminalEnd &&
      start.run >= Math.min(5, canonicalTokenCount) &&
      spanRatio >= 0.55 && spanRatio <= 1.65 &&
      candidateOcr.alignment.longestRun >= Math.min(8, canonicalTokenCount) &&
      cropSpanCoveragePass;
    const exactCropPass = canonicalCropPass ||
      (sourceComplete &&
       candidateOcr.alignment.longestRun >= Math.min(8, canonicalTokenCount));
    // Tesseract can miss one boundary token even when both source anchors,
    // the reconstructed crop, and the canonical interior independently agree.
    // This tier is intentionally narrower than sourceStrong: both source
    // anchors need at least three words, their combined run must be substantial,
    // the crop must improve (or preserve) the score, and the measured source
    // word boxes must have positive clearance on both sides.
    const canonicalCropSourceConsensus =
      canonicalCropPass &&
      nonRegressing &&
      !containsPageFurniture &&
      spanRatio >= 0.75 && spanRatio <= 1.35 &&
      cropSpanCoverage >= 0.85 && cropSpanCoverage <= 1.15 &&
      start.run >= 3 && end.run >= 3 &&
      start.run + end.run >= Math.min(8, canonicalTokenCount) &&
      boundaryClearance.startLeft >= 2 &&
      boundaryClearance.endRight >= 2;
    const currentSourceOwnershipVerified = Boolean(
      currentBoundaryFit?.pass &&
      start.run >= 3 &&
      end.run >= 3 &&
      start.run + end.run >= Math.min(8, canonicalTokenCount) &&
      spanRatio >= 0.45 &&
      spanRatio <= 2.75
    );
    const exteriorOcrDamageConsensus =
      exactMethods &&
      sourceStrong &&
      !containsPageFurniture &&
      spanRatio >= 0.85 && spanRatio <= 1.15 &&
      cropSpanCoverage >= 0.85 && cropSpanCoverage <= 1.15 &&
      start.run + end.run >= Math.max(6, canonicalTokenCount - 2) &&
      candidateOcr.alignment.longestRun >= Math.min(
        12,
        Math.max(4, Math.floor(canonicalTokenCount / 3)),
      ) &&
      boundaryClearance.startLeft >= 2 &&
      boundaryClearance.endRight >= 2;
    const currentBoundarySubstitution =
      currentAlignmentBefore.leading.boundarySubstitution ||
      currentAlignmentBefore.trailing.boundarySubstitution;
    const outcome = currentSourceOwnershipVerified
      ? 'KEEP_CURRENT_SOURCE_OWNERSHIP'
      : currentSourceComplete && currentBoundarySubstitution
      ? 'KEEP_CURRENT_SOURCE_BOUNDARY'
      : sourceStrong && exactMethods && exactCropPass &&
        !containsPageFurniture
      ? 'ACCEPTED_EXACT'
      : exteriorOcrDamageConsensus
        ? 'ACCEPTED_EXTERIOR_OCR_DAMAGE'
      : canonicalCropSourceConsensus
        ? 'ACCEPTED_CANONICAL_CROP'
      : sourceStrong && historicalBoundary && historicalCropPass &&
          !containsPageFurniture &&
          (canonicalCropPass || historicalRunsStrong)
        ? 'ACCEPTED_HISTORICAL_VARIANT'
        : terminalSourceStrong && historicalCropPass && !containsPageFurniture
          ? 'ACCEPTED_TERMINAL_VARIANT'
        : 'CONDITIONAL';
    console.error(JSON.stringify({
      progress: `${index + 1}/${failures.length}`,
      version: failure.version,
      selector: failure.selector,
      outcome,
      start: `${start.method}:${start.run}@${start.storedPage}`,
      end: `${end.method}:${end.run}@${end.storedPage}`,
      score: `${currentScore}->${candidateScore}`,
      spanRatio: Number(spanRatio.toFixed(3)),
      cropSpanCoverage: Number(cropSpanCoverage.toFixed(3)),
    }));
    return {
      ...base,
      outcome,
      anchors: {
        start: {
          method: start.method,
          run: start.run,
          page: start.storedPage,
          imagePage: start.imagePage,
          line: start.line.words.map((word) => word.text).join(' '),
          word: start.word.text,
        },
        end: {
          method: end.method,
          run: end.run,
          page: end.storedPage,
          imagePage: end.imagePage,
          line: end.line.words.map((word) => word.text).join(' '),
          word: end.word.text,
        },
      },
      scores: {
        current: currentScore,
        proposed: candidateScore,
      },
      ownership: {
        spanTokens,
        canonicalTokens: canonicalTokenCount,
        spanRatio,
        proposedTokenCount,
        cropSpanCoverage,
        cropSpanCoveragePass,
        sourceStrong,
        sourceComplete,
        currentSourceComplete,
        exactMethods,
        canonicalCropPass,
        exactCropPass,
        canonicalCropSourceConsensus,
        historicalCropPass,
        historicalRunsStrong,
        terminalEnd,
        terminalSourceStrong,
        nonRegressing,
        containsPageFurniture,
        boundaryClearance,
        currentBoundaryClearance,
        currentBoundaryFit,
        currentSourceOwnershipVerified,
        exteriorOcrDamageConsensus,
      },
      proposedRows,
      proposedOcr: {
        psm: candidateOcr.psm,
        text: candidateOcr.text,
        leadingRun: candidateOcr.alignment.leading.boundaryRun,
        trailingRun: candidateOcr.alignment.trailing.boundaryRun,
        longestRun: candidateOcr.alignment.longestRun,
      },
      image: path.relative(outDir, imageFile),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({
      progress: `${index + 1}/${failures.length}`,
      version: failure.version,
      selector: failure.selector,
      outcome: 'NO_PROPOSAL',
      error: message,
    }));
    return { ...base, outcome: 'NO_PROPOSAL', error: message };
  }
}

type Proposal = Awaited<ReturnType<typeof buildProposal>>;
const checkpointFile = path.join(outDir, 'proposals.ndjson');
const resume = !argv.includes('--no-resume');
const completedByKey = new Map<string, Proposal>();
if (resume && fs.existsSync(checkpointFile)) {
  for (const line of fs.readFileSync(checkpointFile, 'utf8').split(/\n+/)) {
    if (!line.trim()) continue;
    const proposal = JSON.parse(line) as Proposal;
    completedByKey.set(`${proposal.version}:${proposal.selector}`, proposal);
  }
}
if (!resume) fs.writeFileSync(checkpointFile, '');
const selectedFailureKeys = new Set(failures.map((failure) =>
  `${failure.version}:${failure.selector}`));
const pendingFailures = failures.filter((failure) =>
  !completedByKey.has(`${failure.version}:${failure.selector}`));
const freshProposals = await mapConcurrent(
  pendingFailures,
  concurrency,
  async (failure, index) => {
    const proposal = await buildProposal(failure, index);
    fs.appendFileSync(checkpointFile, `${JSON.stringify(proposal)}\n`);
    return proposal;
  },
);
for (const proposal of freshProposals) {
  completedByKey.set(`${proposal.version}:${proposal.selector}`, proposal);
}
const proposals = [...completedByKey.values()]
  .filter((proposal) =>
    selectedFailureKeys.has(`${proposal.version}:${proposal.selector}`))
  .sort((left, right) =>
    left.version.localeCompare(right.version, undefined, { numeric: true }) ||
    left.verseId - right.verseId);

const byOutcome = Object.fromEntries(
  [...new Set(proposals.map((proposal) => proposal.outcome))].sort().map((outcome) => [
    outcome,
    proposals.filter((proposal) => proposal.outcome === outcome).length,
  ]),
);
fs.writeFileSync(path.join(outDir, 'line-ownership-report.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  method: 'local Tesseract TSV + canonical/neighbor token anchors + source word boxes',
  failures: failures.length,
  byOutcome,
  proposals,
}, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'README.md'), [
  '# Fax geometry line-ownership reconstruction',
  '',
  '- Model calls: none',
  `- Failed crops considered: ${failures.length}`,
  `- Outcomes: ${Object.entries(byOutcome).map(([key, value]) => `${key}=${value}`).join(', ')}`,
  '',
  '`ACCEPTED_EXACT` requires strong compatible source anchors and a locally',
  'rendered crop that passes both canonical boundaries. Historical variants',
  'must instead have a strong adjacent-verse ownership boundary. `CONDITIONAL`',
  'and `MEDIA_UNAVAILABLE` remain release blockers.',
  'No proposal is applied by this script.',
  '',
].join('\n'));
console.log(JSON.stringify({ outDir, failures: failures.length, byOutcome }, null, 2));
