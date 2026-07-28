#!/usr/bin/env npx tsx
/**
 * Test failed post-apply crops against the exact pre-transaction geometry
 * preserved in the remediation manifest.
 *
 * This is read-only with respect to the database. It locally renders the
 * counterfactual geometry from source scans, runs deterministic Tesseract
 * boundary alignment, and reports which failures are safely reversible.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { getDb, closeDb } from '../src/data/db.ts';
import { sanitizeBoxes, toFragments } from '../src/media/fax/geometry.ts';
import { renderImage } from '../src/media/fax/render.ts';
import type { FaxBox } from '../src/media/fax/types.ts';
import {
  alignRenderedContent,
  type ContentAlignment,
  scoreContentAlignment,
} from './lib/fax-render-content-qa.ts';

const execFileAsync = promisify(execFile);

type Geometry = {
  uid: number;
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

type ManifestPatch = {
  action: 'UPDATE' | 'DELETE';
  old: Geometry;
  next?: Geometry;
};

type RenderFailure = {
  version: string;
  verseId: number;
  selector: string;
  mode: 'crop' | 'page';
  httpStatus: number;
  status: 'pass' | 'warning' | 'failure';
  flags: string[];
  ocrText: string | null;
};

type QaReport = {
  renderResults: RenderFailure[];
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

const manifestFile = path.resolve(flag(
  'manifest',
  '../docs/sql/fax-geometry-remediation-2026-07-26.manifest.json',
)!);
const qaRoot = path.resolve(flag(
  'qa-root',
  '../docs/audits/fax-geometry/2026-07-26-exhaustive',
)!);
const outDir = path.resolve(flag(
  'out',
  '../docs/audits/fax-geometry/2026-07-26-counterfactual',
)!);
const concurrency = Math.max(1, Math.min(6, Number(flag('concurrency', '3')) || 3));
const reportFiles = [
  '1842', '1849', '1852', '1854', '1854l',
  '1866', '1871', '1874', '1877', 'derivatives',
].map((name) => path.join(qaRoot, name, 'qa-report.json'));

const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as {
  patches: ManifestPatch[];
};
const failures = reportFiles.flatMap((file) => {
  const report = JSON.parse(fs.readFileSync(file, 'utf8')) as QaReport;
  return report.renderResults.filter((result) =>
    result.mode === 'crop' &&
    result.status === 'failure' &&
    result.httpStatus === 200);
});
const versions = [...new Set(failures.map((failure) => failure.version))].sort();

const db = getDb();
const [rawRows, canonicalRows, registryRows] = await Promise.all([
  db.selectFrom('bom_xtras_fax_index')
    .select([
      'uid', 'version', 'verse_id', 'page', 'pageWidth', 'pageScale',
      'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH',
    ])
    .where('version', 'in', versions)
    .execute(),
  db.selectFrom('lds_scriptures_verses')
    .select(['verse_id', 'verse_scripture'])
    .where('verse_id', 'in', failures.map((failure) => failure.verseId))
    .execute(),
  db.selectFrom('bom_xtras_fax')
    .select(['slug', 'pgfirstVerse', 'format', 'bgcolor'])
    .where('slug', 'in', versions)
    .execute(),
]);
await closeDb();

const rows: Geometry[] = rawRows.map((row) => ({
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
const canonical = new Map(canonicalRows.map((row) => [
  Number(row.verse_id),
  String(row.verse_scripture),
]));
const minimumPage = new Map<string, number>();
for (const row of rows) {
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

const keyFor = (version: string, verseId: number): string => `${version}|${verseId}`;
const currentByKey = new Map<string, Geometry[]>();
for (const row of rows) {
  const key = keyFor(row.version, row.verseId);
  (currentByKey.get(key) ?? currentByKey.set(key, []).get(key)!).push(row);
}
const patchesByKey = new Map<string, ManifestPatch[]>();
for (const patch of manifest.patches) {
  const key = keyFor(patch.old.version, patch.old.verseId);
  (patchesByKey.get(key) ?? patchesByKey.set(key, []).get(key)!).push(patch);
}

function preTransactionRows(version: string, verseId: number): Geometry[] {
  const byUid = new Map(
    (currentByKey.get(keyFor(version, verseId)) ?? []).map((row) => [row.uid, row]),
  );
  for (const patch of patchesByKey.get(keyFor(version, verseId)) ?? []) {
    byUid.set(patch.old.uid, patch.old);
  }
  return [...byUid.values()].sort((left, right) =>
    left.page - right.page || left.X - right.X || left.Y - right.Y || left.uid - right.uid);
}

function geometrySignature(rowsToSign: Geometry[]): string {
  return rowsToSign.map((row) => [
    row.uid, row.page, row.X, row.Y, row.W, row.H,
    row.TLW, row.TLH, row.BRW, row.BRH,
  ].join(':')).sort().join('|');
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

const scanCache = new Map<string, Promise<Buffer>>();
async function fetchScan(version: string, storedPage: number): Promise<Buffer> {
  const meta = registry.get(version);
  if (!meta) throw new Error(`missing registry metadata for ${version}`);
  const imagePage = storedPage + meta.offset;
  const cacheKey = `${version}|${imagePage}`;
  let request = scanCache.get(cacheKey);
  if (!request) {
    const url = `https://media.bookofmormon.online/fax/pages/${version}/` +
      `${String(imagePage).padStart(3, '0')}.${meta.format}`;
    request = fetch(url, { signal: AbortSignal.timeout(30_000) }).then(async (response) => {
      if (!response.ok) throw new Error(`scan fetch failed ${response.status} ${url}`);
      return Buffer.from(await response.arrayBuffer());
    });
    scanCache.set(cacheKey, request);
  }
  return request;
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
       primary.alignment.trailing.boundaryRun > 0)) {
    return primary;
  }
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
const results = await mapConcurrent(failures, concurrency, async (failure, index) => {
  const key = keyFor(failure.version, failure.verseId);
  const currentRows = currentByKey.get(key) ?? [];
  const oldRows = preTransactionRows(failure.version, failure.verseId);
  const changed = geometrySignature(currentRows) !== geometrySignature(oldRows);
  const currentAlignment = alignRenderedContent(
    failure.ocrText ?? '',
    canonical.get(failure.verseId) ?? '',
  );
  const base = {
    version: failure.version,
    verseId: failure.verseId,
    selector: failure.selector,
    flags: failure.flags,
    manifestPatches: patchesByKey.get(key)?.length ?? 0,
    changed,
    current: {
      fragments: currentRows.length,
      score: scoreContentAlignment(currentAlignment),
      leadingRun: currentAlignment.leading.boundaryRun,
      trailingRun: currentAlignment.trailing.boundaryRun,
      longestRun: currentAlignment.longestRun,
      ocrText: failure.ocrText,
    },
  };
  if (!changed) {
    console.error(JSON.stringify({
      progress: `${index + 1}/${failures.length}`,
      version: failure.version,
      selector: failure.selector,
      outcome: 'NO_MANIFEST_CHANGE',
    }));
    return { ...base, outcome: 'NO_MANIFEST_CHANGE', old: null, error: null };
  }
  try {
    const meta = registry.get(failure.version);
    if (!meta) throw new Error(`missing registry metadata for ${failure.version}`);
    const image = await renderImage({
      mode: 'crop',
      ext: 'jpg',
      width: 800,
      fragments: toFragments(toFaxBoxes(oldRows)),
      paper: meta.paper,
      provider: (page) => fetchScan(failure.version, page),
    });
    const imageFile = path.join(
      outDir,
      'images',
      `${failure.version}__${failure.selector}__pre-transaction.jpg`,
    );
    fs.writeFileSync(imageFile, image);
    const oldOcr = await runOcr(imageFile, canonical.get(failure.verseId) ?? '');
    const oldPass = oldOcr.alignment.longestRun >= 3 &&
      oldOcr.alignment.leading.boundaryRun >= 2 &&
      oldOcr.alignment.trailing.boundaryRun >= 2;
    const scoreDelta =
      scoreContentAlignment(oldOcr.alignment) - scoreContentAlignment(currentAlignment);
    const outcome = oldPass
      ? 'ROLLBACK_VERSE'
      : scoreDelta >= 10
        ? 'ROLLBACK_IMPROVES'
        : 'NO_IMPROVEMENT';
    console.error(JSON.stringify({
      progress: `${index + 1}/${failures.length}`,
      version: failure.version,
      selector: failure.selector,
      outcome,
      scoreDelta,
    }));
    return {
      ...base,
      outcome,
      old: {
        fragments: oldRows.length,
        score: scoreContentAlignment(oldOcr.alignment),
        scoreDelta,
        psm: oldOcr.psm,
        leadingRun: oldOcr.alignment.leading.boundaryRun,
        trailingRun: oldOcr.alignment.trailing.boundaryRun,
        longestRun: oldOcr.alignment.longestRun,
        ocrText: oldOcr.text,
        image: path.relative(outDir, imageFile),
        rows: oldRows,
      },
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({
      progress: `${index + 1}/${failures.length}`,
      version: failure.version,
      selector: failure.selector,
      outcome: 'SOURCE_ERROR',
      error: message,
    }));
    return { ...base, outcome: 'SOURCE_ERROR', old: null, error: message };
  }
});

const byOutcome = Object.fromEntries(
  [...new Set(results.map((result) => result.outcome))].sort().map((outcome) => [
    outcome,
    results.filter((result) => result.outcome === outcome).length,
  ]),
);
const report = {
  generatedAt: new Date().toISOString(),
  sourceManifest: manifestFile,
  sourceQaReports: reportFiles,
  failureCrops: failures.length,
  byOutcome,
  results,
};
fs.writeFileSync(path.join(outDir, 'counterfactual-report.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'README.md'), [
  '# Fax geometry counterfactual QA',
  '',
  `- Failed HTTP-200 crop renders tested: ${failures.length}`,
  `- Outcomes: ${Object.entries(byOutcome).map(([key, value]) => `${key}=${value}`).join(', ')}`,
  '',
  '`ROLLBACK_VERSE` means the exact pre-transaction geometry restored both canonical content',
  'boundaries under deterministic OCR. `ROLLBACK_IMPROVES` is evidence only and is not',
  'automatically safe. `NO_MANIFEST_CHANGE` predates the transaction.',
  '',
].join('\n'));
console.log(JSON.stringify({
  outDir,
  failureCrops: failures.length,
  byOutcome,
}, null, 2));
