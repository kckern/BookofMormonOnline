#!/usr/bin/env npx tsx
/**
 * Post-remediation QA for fax geometry.
 *
 * This script is read-only with respect to the database. It:
 *   1. proves the current DB matches the applied remediation manifest;
 *   2. selects deterministic, stratified random verse samples for every
 *      impacted version;
 *   3. requests real crop renders and one page render per version when a
 *      cross-page/cross-column sample exists;
 *   4. validates response/image invariants and writes a human review grid.
 *
 * Usage:
 *   npx tsx scripts/fax-geometry-render-qa.mts \
 *     --base http://10.0.0.10:5006 \
 *     --per-version 5 \
 *     --seed 20260726 \
 *     --out ../docs/audits/fax-geometry/2026-07-26-postapply-render-qa
 *
 * Exhaustive QA can be kept below the render endpoint's 120-request window by
 * running one version at a time:
 *   npx tsx scripts/fax-geometry-render-qa.mts \
 *     --all-changed \
 *     --versions 1852 \
 *     --out ../docs/audits/fax-geometry/exhaustive/1852
 */
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { getDb, closeDb } from '../src/data/db.ts';
import { canonicalSelector } from '../src/media/fax/canonical.ts';
import { selectorToVerseIds } from '../src/media/fax/resolve.ts';
import {
  alignRenderedContent,
  type ContentAlignment,
  scoreContentAlignment,
  tokenizeWords,
} from './lib/fax-render-content-qa.ts';
import {
  loadShadowRows,
  openShadow,
  shadowCanonicalText,
} from './lib/fax-shadow-db.ts';

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
  keepUid?: number;
  reasons: string[];
  sources?: string[];
};

type Manifest = {
  counts: {
    patches: number;
    updates: number;
    deletes: number;
  };
  patches: ManifestPatch[];
};

type OwnershipGeometry = Omit<Geometry, 'uid'> & { uid: number | null };

type OwnershipProposal = {
  version: string;
  verseId: number;
  selector: string;
  outcome: string;
  sourceFlags?: string[];
  currentRows: OwnershipGeometry[];
  proposedRows?: OwnershipGeometry[];
};

type OwnershipReport = {
  proposals: OwnershipProposal[];
};

type StructuralFinding = {
  code: string;
  version: string;
  verseId?: number;
  page?: number;
};

type SampleTag =
  | 'reviewed-fix'
  | 'automatic-fix'
  | 'family-fix'
  | 'duplicate-cleanup'
  | 'cross-page'
  | 'cross-column'
  | 'page-boundary'
  | 'column-boundary'
  | 'multi-fragment'
  | 'tl-notch'
  | 'br-notch'
  | 'plain-control'
  | 'regression-fixture'
  | 'source-ownership-fix'
  | 'retained-control';

type Candidate = {
  version: string;
  verseId: number;
  selector: string;
  rows: Geometry[];
  tags: Set<SampleTag>;
  reasons: Set<string>;
  patchedUids: Set<number>;
};

type RenderResult = {
  mode: 'crop' | 'page';
  version: string;
  verseId: number;
  selector: string;
  url: string;
  file: string | null;
  httpStatus: number;
  contentType: string | null;
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
  canonicalLeading: string | null;
  canonicalTrailing: string | null;
  leadingRun: number | null;
  trailingRun: number | null;
  leadingBestRun: number | null;
  leadingBestOffset: number | null;
  trailingBestRun: number | null;
  trailingBestOffset: number | null;
  longestCanonicalRun: number | null;
  canonicalTokenCount: number | null;
  orderedMatchedTokens: number | null;
  orderedCoverage: number | null;
  largestInteriorCanonicalGap: number | null;
  status: 'pass' | 'warning' | 'failure';
  flags: string[];
  error: string | null;
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback?: string): string | undefined => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : fallback;
};
const hasFlag = (name: string): boolean => argv.includes(`--${name}`);

const base = flag('base', 'http://10.0.0.10:5006')!.replace(/\/+$/, '');
const perVersion = Math.max(5, Math.min(10, Number(flag('per-version', '5')) || 5));
const seed = flag('seed', '20260726')!;
const width = [200, 400, 800, 1600].includes(Number(flag('width', '800')))
  ? Number(flag('width', '800'))
  : 800;
const concurrency = Math.max(1, Math.min(8, Number(flag('concurrency', '3')) || 3));
const planOnly = hasFlag('plan-only');
const reuseImages = hasFlag('reuse-images');
const allChanged = hasFlag('all-changed');
const requestedVersions = flag('versions')
  ?.split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const manifestFile = path.resolve(flag(
  'manifest',
  '../docs/sql/fax-geometry-remediation-2026-07-26.manifest.json',
)!);
const ownershipReportFlag = flag('ownership-report');
const ownershipReportFile = ownershipReportFlag
  ? path.resolve(ownershipReportFlag)
  : null;
const outDir = path.resolve(flag(
  'out',
  '../docs/audits/fax-geometry/2026-07-26-postapply-render-qa',
)!);
const structuralFile = path.resolve(flag(
  'structural',
  '../docs/audits/fax-geometry/2026-07-26-postapply-structural/audit.json',
)!);
const shadowFile = flag('shadow');

const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as Manifest;
const ownershipReport = ownershipReportFile
  ? JSON.parse(fs.readFileSync(ownershipReportFile, 'utf8')) as OwnershipReport
  : null;
const ownershipOnly = new Set(
  (flag('only') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
);
const selectedOwnershipProposals = ownershipReport?.proposals.filter((proposal) =>
  !ownershipOnly.size ||
  ownershipOnly.has(`${proposal.version}:${proposal.selector}`)) ?? [];
if (ownershipOnly.size && selectedOwnershipProposals.length !== ownershipOnly.size) {
  const found = new Set(selectedOwnershipProposals.map(
    (proposal) => `${proposal.version}:${proposal.selector}`,
  ));
  throw new Error(
    `--only selector(s) absent from ownership report: ${
      [...ownershipOnly].filter((value) => !found.has(value)).join(', ')
    }`,
  );
}
const ownershipQaProposals = ownershipReport?.proposals.filter(
  (proposal) =>
    selectedOwnershipProposals.includes(proposal) &&
    proposal.outcome !== 'MEDIA_UNAVAILABLE',
) ?? [];
const structural = fs.existsSync(structuralFile)
  ? JSON.parse(fs.readFileSync(structuralFile, 'utf8')) as { findings: StructuralFinding[] }
  : null;
const residualStructuralCodes = new Set([
  'ORPHAN_TL_NOTCH',
  'ORPHAN_BR_NOTCH',
  'TL_NOTCH_AT_PAGE_CONTINUATION',
  'BR_NOTCH_AT_PAGE_CONTINUATION',
  'NONRECIPROCAL_NOTCH_PAIR',
  'INTERLEAVED_VERSE_FRAGMENT',
  'PAGE_JUMP_WITHIN_VERSE',
  'FAMILY_FRAGMENT_COUNT_MISMATCH',
]);
const residualStructural = structural?.findings.filter((finding) =>
  residualStructuralCodes.has(finding.code)) ?? [];
const allImpactedVersions = [
  ...new Set(
    ownershipReport
      ? ownershipQaProposals.map((proposal) => proposal.version)
      : manifest.patches.map((patch) => patch.old.version),
  ),
].sort();
const unknownVersions = requestedVersions?.filter(
  (version) => !allImpactedVersions.includes(version),
) ?? [];
if (unknownVersions.length) {
  throw new Error(
    `--versions contains version(s) not present in the manifest: ${unknownVersions.join(', ')}`,
  );
}
const impactedVersions = requestedVersions?.length
  ? allImpactedVersions.filter((version) => requestedVersions.includes(version))
  : allImpactedVersions;

let rows: Geometry[] = [];
let canonicalText = new Map<number, string>();
if (shadowFile) {
  const shadow = openShadow(shadowFile, { queryOnly: true });
  rows = loadShadowRows(shadow, { versions: allImpactedVersions });
  canonicalText = shadowCanonicalText(shadow);
  shadow.close();
} else {
  const db = getDb();
  try {
    const [rawRows, canonicalRows] = await Promise.all([
      db.selectFrom('bom_xtras_fax_index')
        .select([
          'uid', 'version', 'verse_id', 'page', 'pageWidth', 'pageScale',
          'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH',
        ])
        .where('version', 'in', allImpactedVersions)
        .execute(),
      db.selectFrom('lds_scriptures_verses')
        .select(['verse_id', 'verse_scripture'])
        .where('verse_id', '>=', 31103)
        .where('verse_id', '<=', 37706)
        .execute(),
    ]);
    canonicalText = new Map(canonicalRows.map((row) => [
      Number(row.verse_id),
      String(row.verse_scripture),
    ]));
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
  } finally {
    await closeDb();
  }
}

const exactFields: Array<keyof Geometry> = [
  'uid', 'version', 'verseId', 'page', 'pageWidth', 'pageScale',
  'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH',
];
const geometryFields: Array<keyof Omit<Geometry, 'uid'>> = [
  'version', 'verseId', 'page', 'pageWidth', 'pageScale',
  'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH',
];
const sameGeometry = (left: Geometry, right: Geometry): boolean =>
  exactFields.every((field) => left[field] === right[field]);
const sameGeometryIgnoringUid = (
  left: Omit<Geometry, 'uid'>,
  right: Omit<Geometry, 'uid'>,
): boolean =>
  geometryFields.every((field) => left[field] === right[field]);
const currentByUid = new Map(rows.map((row) => [row.uid, row]));
const keyFor = (version: string, verseId: number): string => `${version}|${verseId}`;
const currentByPair = new Map<string, Geometry[]>();
for (const row of rows) {
  const key = keyFor(row.version, row.verseId);
  const pairRows = currentByPair.get(key) ?? [];
  pairRows.push(row);
  currentByPair.set(key, pairRows);
}
const applyFailures: Array<Record<string, unknown>> = [];
if (ownershipReport) {
  for (const proposal of selectedOwnershipProposals) {
    const expected = proposal.outcome.startsWith('ACCEPTED_')
      ? proposal.proposedRows ?? []
      : proposal.currentRows;
    const actual = currentByPair.get(keyFor(proposal.version, proposal.verseId)) ?? [];
    const unmatched = [...actual];
    for (const desired of expected) {
      const index = unmatched.findIndex((row) =>
        sameGeometryIgnoringUid(row, desired) &&
        (desired.uid == null || row.uid === desired.uid));
      if (index >= 0) unmatched.splice(index, 1);
    }
    if (expected.length !== actual.length || unmatched.length) {
      applyFailures.push({
        code: 'OWNERSHIP_ROWSET_MISMATCH',
        version: proposal.version,
        verseId: proposal.verseId,
        selector: proposal.selector,
        outcome: proposal.outcome,
        expected,
        actual,
      });
    }
  }
} else {
  for (const patch of manifest.patches) {
    const current = currentByUid.get(patch.old.uid);
    if (patch.action === 'UPDATE') {
      if (!current || !patch.next || !sameGeometry(current, patch.next)) {
        applyFailures.push({
          code: 'UPDATE_NOT_APPLIED',
          uid: patch.old.uid,
          version: patch.old.version,
          verseId: patch.old.verseId,
          current: current ?? null,
          expected: patch.next ?? null,
        });
      }
    } else {
      if (current) {
        applyFailures.push({
          code: 'DELETE_NOT_APPLIED',
          uid: patch.old.uid,
          version: patch.old.version,
          verseId: patch.old.verseId,
        });
      }
      if (patch.keepUid != null && !currentByUid.has(patch.keepUid)) {
        applyFailures.push({
          code: 'DUPLICATE_KEEP_ROW_MISSING',
          uid: patch.old.uid,
          keepUid: patch.keepUid,
          version: patch.old.version,
          verseId: patch.old.verseId,
        });
      }
    }
  }
}

if (applyFailures.length) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'apply-verification-failures.json'),
    `${JSON.stringify(applyFailures, null, 2)}\n`,
  );
  console.error(JSON.stringify({
    stage: 'post-apply-verification',
    failures: applyFailures.length,
    out: path.join(outDir, 'apply-verification-failures.json'),
  }, null, 2));
  process.exit(1);
}

const candidates = new Map<string, Candidate>();
for (const row of rows) {
  const key = keyFor(row.version, row.verseId);
  const candidate = candidates.get(key) ?? {
    version: row.version,
    verseId: row.verseId,
    selector: canonicalSelector([row.verseId]),
    rows: [],
    tags: new Set<SampleTag>(),
    reasons: new Set<string>(),
    patchedUids: new Set<number>(),
  };
  candidate.rows.push(row);
  candidates.set(key, candidate);
}

if (ownershipReport) {
  for (const proposal of ownershipQaProposals) {
    const candidate = candidates.get(keyFor(proposal.version, proposal.verseId));
    if (!candidate) continue;
    for (const row of candidate.rows) candidate.patchedUids.add(row.uid);
    candidate.reasons.add(proposal.outcome);
    for (const sourceFlag of proposal.sourceFlags ?? []) {
      candidate.reasons.add(sourceFlag);
    }
    if (proposal.outcome.startsWith('ACCEPTED_')) {
      candidate.tags.add('source-ownership-fix');
      candidate.tags.add('automatic-fix');
    } else {
      candidate.tags.add('retained-control');
    }
  }
} else {
  for (const patch of manifest.patches) {
    const candidate = candidates.get(keyFor(patch.old.version, patch.old.verseId));
    if (!candidate) continue;
    candidate.patchedUids.add(patch.old.uid);
    for (const reason of patch.reasons) candidate.reasons.add(reason);
    if (patch.action === 'DELETE') candidate.tags.add('duplicate-cleanup');
    if (patch.sources?.includes('reviewed')) candidate.tags.add('reviewed-fix');
    if (patch.sources?.includes('automatic')) candidate.tags.add('automatic-fix');
    if (patch.sources?.includes('family-topology')) candidate.tags.add('family-fix');
  }
}

const notchActive = (notchWidth: number, notchHeight: number): boolean =>
  notchWidth > 1 && notchHeight > 0;
for (const candidate of candidates.values()) {
  if (candidate.rows.some((row) => notchActive(row.TLW, row.TLH))) {
    candidate.tags.add('tl-notch');
  }
  if (candidate.rows.some((row) => notchActive(row.BRW, row.BRH))) {
    candidate.tags.add('br-notch');
  }
  if (candidate.rows.length > 1) candidate.tags.add('multi-fragment');
  if (new Set(candidate.rows.map((row) => row.page)).size > 1) {
    candidate.tags.add('cross-page');
  }

  const byPage = new Map<number, Geometry[]>();
  for (const row of candidate.rows) {
    (byPage.get(row.page) ?? byPage.set(row.page, []).get(row.page)!).push(row);
  }
  const crossesColumn = [...byPage.values()].some((pageRows) =>
    pageRows.some((left, leftIndex) => pageRows.some((right, rightIndex) =>
      rightIndex > leftIndex &&
      Math.abs(
        (left.X + left.W / 2) - (right.X + right.W / 2),
      ) >= Math.min(left.pageScale, right.pageScale) * 0.25)));
  if (crossesColumn) candidate.tags.add('cross-column');
  if (candidate.rows.length === 1 &&
      !candidate.tags.has('tl-notch') &&
      !candidate.tags.has('br-notch')) {
    candidate.tags.add('plain-control');
  }
}

// A column/page transition normally occurs *between* consecutive verses, so it
// cannot be found by inspecting one verse's fragments alone. Tag both sides of
// each detected transition to make those reading-order edges sampleable.
for (const version of impactedVersions) {
  const ordered = [...candidates.values()]
    .filter((candidate) => candidate.version === version)
    .sort((left, right) => left.verseId - right.verseId);
  for (let index = 0; index < ordered.length - 1; index++) {
    const current = ordered[index]!;
    const next = ordered[index + 1]!;
    const currentPages = current.rows.map((row) => row.page);
    const nextPages = next.rows.map((row) => row.page);
    const currentLastPage = Math.max(...currentPages);
    const nextFirstPage = Math.min(...nextPages);
    if (nextFirstPage > currentLastPage) {
      current.tags.add('page-boundary');
      next.tags.add('page-boundary');
    }

    const sharedPages = new Set(currentPages.filter((page) => nextPages.includes(page)));
    const columnTransition = [...sharedPages].some((page) => {
      const currentRows = current.rows.filter((row) => row.page === page);
      const nextRows = next.rows.filter((row) => row.page === page);
      return currentRows.some((currentRow) => nextRows.some((nextRow) => {
        const horizontalJump = (nextRow.X + nextRow.W / 2) -
          (currentRow.X + currentRow.W / 2);
        const verticalReset = currentRow.Y - nextRow.Y;
        const scale = Math.min(currentRow.pageScale, nextRow.pageScale);
        return horizontalJump >= scale * 0.25 && verticalReset >= scale * 0.25;
      }));
    });
    if (columnTransition) {
      current.tags.add('column-boundary');
      next.tags.add('column-boundary');
    }
  }
}

function stableScore(candidate: Candidate, stratum: string): string {
  return crypto.createHash('sha256')
    .update(`${seed}|${candidate.version}|${stratum}|${candidate.verseId}`)
    .digest('hex');
}

const strata: SampleTag[] = [
  'reviewed-fix',
  'automatic-fix',
  'family-fix',
  'duplicate-cleanup',
  'cross-page',
  'cross-column',
  'column-boundary',
  'page-boundary',
  'tl-notch',
  'br-notch',
  'multi-fragment',
  'plain-control',
];

const samplesByVersion = new Map<string, Candidate[]>();
for (const version of impactedVersions) {
  const pool = [...candidates.values()].filter((candidate) => candidate.version === version);
  if (allChanged) {
    const ownershipKeys = new Set(ownershipQaProposals.map((proposal) =>
      keyFor(proposal.version, proposal.verseId)));
    samplesByVersion.set(
      version,
      pool
        .filter((candidate) => ownershipReport
          ? ownershipKeys.has(keyFor(candidate.version, candidate.verseId))
          : candidate.patchedUids.size > 0)
        .sort((left, right) => left.verseId - right.verseId),
    );
    continue;
  }
  const selected: Candidate[] = [];
  const selectedIds = new Set<number>();
  for (const stratum of strata) {
    if (selected.length >= perVersion) break;
    const eligible = pool
      .filter((candidate) => candidate.tags.has(stratum) && !selectedIds.has(candidate.verseId))
      .sort((left, right) => stableScore(left, stratum).localeCompare(stableScore(right, stratum)));
    if (!eligible.length) continue;
    selected.push(eligible[0]!);
    selectedIds.add(eligible[0]!.verseId);
  }
  if (selected.length < perVersion) {
    const fill = pool
      .filter((candidate) => !selectedIds.has(candidate.verseId))
      .sort((left, right) => stableScore(left, 'random-fill').localeCompare(
        stableScore(right, 'random-fill'),
      ));
    for (const candidate of fill) {
      if (selected.length >= perVersion) break;
      selected.push(candidate);
      selectedIds.add(candidate.verseId);
    }
  }
  samplesByVersion.set(version, selected);
}

// User-observed failures and high-risk historical cases stay in every QA run,
// regardless of the random seed. They supplement (never replace) the five
// stratified samples for their impacted version.
const regressionFixtures = [
  { version: '1849', selector: '1-nephi-9.4', reason: 'em-dash greedy end snap' },
  { version: '1849', selector: 'alma-51.23', reason: 'preceding-word leak' },
  { version: '1849', selector: 'alma-52.12', reason: 'misplaced notch' },
  { version: '1852', selector: 'mosiah-15.9', reason: 'missing leading having' },
  { version: '1852', selector: '3-nephi-12.2', reason: 'needless notches across pages' },
  { version: '1852', selector: '3-nephi-15.1', reason: 'notch cut through leading glyph' },
  { version: '1866', selector: '1-nephi-14.2', reason: 'missing leading And' },
  { version: '1874', selector: '1-nephi-14.7', reason: 'premature first-fragment BR notch' },
] as const;
for (const fixture of regressionFixtures) {
  if (!impactedVersions.includes(fixture.version)) continue;
  const verseId = selectorToVerseIds(fixture.selector)[0];
  if (verseId == null) continue;
  const candidate = candidates.get(keyFor(fixture.version, verseId));
  if (!candidate) continue;
  candidate.tags.add('regression-fixture');
  candidate.reasons.add(`REGRESSION:${fixture.reason}`);
  const versionSamples = samplesByVersion.get(fixture.version)!;
  if (!versionSamples.some((sample) => sample.verseId === verseId)) {
    versionSamples.push(candidate);
  }
}

fs.mkdirSync(outDir, { recursive: true });
const imageDir = path.join(outDir, 'images');
fs.mkdirSync(imageDir, { recursive: true });

function csv(value: unknown): string {
  if (value == null) return '';
  return `"${String(value).replaceAll('"', '""')}"`;
}

const sampleRows = [...samplesByVersion.entries()].flatMap(([version, versionSamples]) =>
  versionSamples.map((sample, index) => ({
    version,
    sample: index + 1,
    verseId: sample.verseId,
    selector: sample.selector,
    tags: [...sample.tags].sort().join('|'),
    reasons: [...sample.reasons].sort().join('|'),
    fragments: sample.rows.length,
    pages: new Set(sample.rows.map((row) => row.page)).size,
    patchedUids: [...sample.patchedUids].sort((a, b) => a - b).join('|'),
  })));

fs.writeFileSync(path.join(outDir, 'samples.csv'), [
  'version,sample,verseId,selector,tags,reasons,fragments,pages,patchedUids',
  ...sampleRows.map((row) => [
    row.version, row.sample, row.verseId, row.selector, row.tags,
    row.reasons, row.fragments, row.pages, row.patchedUids,
  ].map(csv).join(',')),
  '',
].join('\n'));

async function inspectImage(
  mode: 'crop' | 'page',
  candidate: Candidate,
): Promise<RenderResult> {
  const url = `${base}/fax/render/${candidate.version}/${mode}/w${width}/${candidate.selector}.jpg`;
  const fileName = `${candidate.version}__${candidate.selector.replaceAll('/', '__')}__${mode}.jpg`;
  const outputFile = path.join(imageDir, fileName);
  const baseResult: RenderResult = {
    mode,
    version: candidate.version,
    verseId: candidate.verseId,
    selector: candidate.selector,
    url,
    file: null,
    httpStatus: 0,
    contentType: null,
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
    canonicalLeading: null,
    canonicalTrailing: null,
    leadingRun: null,
    trailingRun: null,
    leadingBestRun: null,
    leadingBestOffset: null,
    trailingBestRun: null,
    trailingBestOffset: null,
    longestCanonicalRun: null,
    canonicalTokenCount: null,
    orderedMatchedTokens: null,
    orderedCoverage: null,
    largestInteriorCanonicalGap: null,
    status: 'failure',
    flags: [],
    error: null,
  };

  try {
    let buffer: Buffer;
    if (reuseImages && fs.existsSync(outputFile)) {
      buffer = fs.readFileSync(outputFile);
      baseResult.httpStatus = 200;
      baseResult.contentType = 'image/jpeg';
    } else {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { accept: 'image/jpeg' },
        redirect: 'follow',
      });
      baseResult.httpStatus = response.status;
      baseResult.contentType = response.headers.get('content-type');
      if (!response.ok) {
        baseResult.flags.push(`http-${response.status}`);
        baseResult.error = (await response.text()).slice(0, 500);
        return baseResult;
      }
      if (!baseResult.contentType?.startsWith('image/jpeg')) {
        baseResult.flags.push('wrong-content-type');
        baseResult.error = `expected image/jpeg, got ${baseResult.contentType}`;
        return baseResult;
      }
      buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(outputFile, buffer);
    }
    baseResult.bytes = buffer.length;
    baseResult.file = path.relative(outDir, outputFile);

    const decoded = await sharp(buffer).greyscale().raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = decoded.data;
    const imageWidth = decoded.info.width;
    const imageHeight = decoded.info.height;
    baseResult.width = imageWidth;
    baseResult.height = imageHeight;

    let dark = 0;
    let topDark = 0;
    let bottomDark = 0;
    let leftDark = 0;
    let rightDark = 0;
    const edgeDepth = Math.max(1, Math.min(3, Math.floor(Math.min(imageWidth, imageHeight) / 4)));
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const isDark = pixels[y * imageWidth + x]! < 160;
        if (!isDark) continue;
        dark++;
        if (y < edgeDepth) topDark++;
        if (y >= imageHeight - edgeDepth) bottomDark++;
        if (x < edgeDepth) leftDark++;
        if (x >= imageWidth - edgeDepth) rightDark++;
      }
    }
    baseResult.darkFraction = dark / Math.max(1, imageWidth * imageHeight);
    baseResult.topEdgeInk = topDark / Math.max(1, imageWidth * edgeDepth);
    baseResult.bottomEdgeInk = bottomDark / Math.max(1, imageWidth * edgeDepth);
    baseResult.leftEdgeInk = leftDark / Math.max(1, imageHeight * edgeDepth);
    baseResult.rightEdgeInk = rightDark / Math.max(1, imageHeight * edgeDepth);

    if (buffer.length < 1_000) baseResult.flags.push('suspiciously-small-response');
    if (imageWidth < 40 || imageHeight < 12) baseResult.flags.push('suspicious-dimensions');
    if (mode === 'crop' && imageWidth > width) baseResult.flags.push('width-exceeds-request');
    if (baseResult.darkFraction < 0.002) baseResult.flags.push('nearly-blank');
    if (mode === 'crop' && baseResult.darkFraction > 0.65) baseResult.flags.push('mostly-dark');
    if (mode === 'crop') {
      if (baseResult.topEdgeInk > 0.10) baseResult.flags.push('top-edge-ink-review');
      if (baseResult.bottomEdgeInk > 0.35) baseResult.flags.push('bottom-edge-ink-review');
      if (baseResult.leftEdgeInk > 0.20) baseResult.flags.push('left-edge-ink-review');
      if (baseResult.rightEdgeInk > 0.30) baseResult.flags.push('right-edge-ink-review');

      const canonical = canonicalText.get(candidate.verseId) ?? '';
      try {
        const runOcr = async (psm: number): Promise<{
          psm: number;
          text: string;
          alignment: ContentAlignment;
        }> => {
          const { stdout } = await execFileAsync(
            'tesseract',
            [path.basename(outputFile), 'stdout', '-l', 'eng', '--psm', String(psm)],
            { cwd: imageDir, maxBuffer: 2 * 1024 * 1024 },
          );
          return {
            psm,
            text: stdout.trim(),
            alignment: alignRenderedContent(stdout, canonical),
          };
        };
        const primary = await runOcr(6);
        const ocrPasses = [primary];
        // Sparse-text mode is materially better when a verse number, notch,
        // rule, or clipped glyph confuses Tesseract's single-block layout.
        // Only pay its cost when the primary pass questions a content edge.
        if (primary.alignment.longestRun >= 3 &&
            (primary.alignment.leading.boundaryRun === 0 ||
             primary.alignment.trailing.boundaryRun === 0)) {
          ocrPasses.push(await runOcr(11));
        }
        const selectedOcr = ocrPasses.sort((left, right) =>
          scoreContentAlignment(right.alignment) - scoreContentAlignment(left.alignment))[0]!;
        const { alignment } = selectedOcr;
        baseResult.ocrText = selectedOcr.text;
        baseResult.ocrMode = selectedOcr.psm;
        baseResult.ocrTokenCount = alignment.ocrTokens.length;
        baseResult.canonicalLeading = alignment.canonicalTokens.slice(0, 4).join(' ');
        baseResult.canonicalTrailing = alignment.canonicalTokens.slice(-4).join(' ');
        baseResult.leadingRun = alignment.leading.boundaryRun;
        baseResult.trailingRun = alignment.trailing.boundaryRun;
        baseResult.leadingBestRun = alignment.leading.bestRun;
        baseResult.leadingBestOffset = alignment.leading.bestOffset;
        baseResult.trailingBestRun = alignment.trailing.bestRun;
        baseResult.trailingBestOffset = alignment.trailing.bestOffset;
        baseResult.longestCanonicalRun = alignment.longestRun;
        baseResult.canonicalTokenCount = alignment.canonicalTokens.length;
        baseResult.orderedMatchedTokens = alignment.sequence.matchedCanonicalTokens;
        baseResult.orderedCoverage = alignment.sequence.canonicalCoverage;
        baseResult.largestInteriorCanonicalGap =
          alignment.sequence.largestInteriorCanonicalGap;
        if (alignment.leading.boundarySubstitution) {
          baseResult.flags.push('leading-boundary-ocr-substitution');
        }
        if (alignment.trailing.boundarySubstitution) {
          baseResult.flags.push('trailing-boundary-ocr-substitution');
        }
        if (alignment.ocrTokens.length < 3 || alignment.longestRun < 3) {
          baseResult.flags.push('ocr-content-unreliable');
        } else {
          if (alignment.leading.boundaryRun === 0) {
            if (alignment.leading.bestRun >= 3) {
              baseResult.flags.push('preceding-neighbor-text-leak');
            } else {
              baseResult.flags.push('canonical-leading-token-missing');
              if (candidate.rows.some((row) => notchActive(row.TLW, row.TLH))) {
                baseResult.flags.push('greedy-tl-notch-content-start-missing');
              } else {
                baseResult.flags.push('leading-fragment-missing');
              }
            }
          } else if (alignment.leading.boundaryRun === 1) {
            baseResult.flags.push('weak-leading-token-run');
          }
          if (alignment.trailing.boundaryRun === 0) {
            if (alignment.trailing.bestRun >= 3) {
              baseResult.flags.push('following-neighbor-text-leak');
            } else {
              baseResult.flags.push('canonical-trailing-token-missing');
              if (candidate.rows.some((row) => notchActive(row.BRW, row.BRH))) {
                baseResult.flags.push('premature-br-notch-content-continues');
              } else {
                baseResult.flags.push('trailing-fragment-missing');
              }
            }
          } else if (alignment.trailing.boundaryRun === 1) {
            baseResult.flags.push('weak-trailing-token-run');
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
            baseResult.flags.push('internal-canonical-span-missing');
          }
        }
      } catch (error) {
        baseResult.flags.push('ocr-unavailable');
        baseResult.error = error instanceof Error ? error.message : String(error);
      }
    }
    const hardFlags = new Set([
      'suspiciously-small-response',
      'suspicious-dimensions',
      'width-exceeds-request',
      'nearly-blank',
      'mostly-dark',
      'canonical-leading-token-missing',
      'canonical-trailing-token-missing',
      'preceding-neighbor-text-leak',
      'following-neighbor-text-leak',
      'greedy-tl-notch-content-start-missing',
      'leading-fragment-missing',
      'premature-br-notch-content-continues',
      'trailing-fragment-missing',
      'internal-canonical-span-missing',
    ]);
    baseResult.status = baseResult.flags.some((item) => hardFlags.has(item))
      ? 'failure'
      : baseResult.flags.length ? 'warning' : 'pass';
    return baseResult;
  } catch (error) {
    baseResult.flags.push('request-or-decode-error');
    baseResult.error = error instanceof Error ? error.message : String(error);
    return baseResult;
  }
}

const renderJobs: Array<{ mode: 'crop' | 'page'; candidate: Candidate }> = [];
for (const version of impactedVersions) {
  const versionSamples = samplesByVersion.get(version) ?? [];
  for (const candidate of versionSamples) renderJobs.push({ mode: 'crop', candidate });
  const pageCandidates = versionSamples.filter((candidate) => {
    const geometryRisk =
      candidate.tags.has('cross-page') ||
      candidate.tags.has('cross-column') ||
      candidate.tags.has('multi-fragment') ||
      candidate.tags.has('tl-notch') ||
      candidate.tags.has('br-notch') ||
      candidate.tags.has('regression-fixture');
    return ownershipReport && allChanged
      ? geometryRisk
      : geometryRisk ||
          candidate.tags.has('column-boundary') ||
          candidate.tags.has('page-boundary');
  });
  if (ownershipReport && allChanged) {
    for (const candidate of pageCandidates) {
      renderJobs.push({ mode: 'page', candidate });
    }
  } else if (pageCandidates[0]) {
    renderJobs.push({ mode: 'page', candidate: pageCandidates[0] });
  }
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

let renderResults: RenderResult[] = [];
if (!planOnly) {
  renderResults = await mapConcurrent(renderJobs, concurrency, async (job, index) => {
    const result = await inspectImage(job.mode, job.candidate);
    console.error(JSON.stringify({
      progress: `${index + 1}/${renderJobs.length}`,
      version: result.version,
      selector: result.selector,
      mode: result.mode,
      status: result.status,
      flags: result.flags,
      httpStatus: result.httpStatus,
    }));
    return result;
  });
}

const resultKey = (version: string, verseId: number, mode: 'crop' | 'page'): string =>
  `${version}|${verseId}|${mode}`;
const resultsByKey = new Map(renderResults.map((result) => [
  resultKey(result.version, result.verseId, result.mode),
  result,
]));
const escapeHtml = (value: unknown): string => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const versionSections = impactedVersions.map((version) => {
  const cards = (samplesByVersion.get(version) ?? []).map((candidate) => {
    const crop = resultsByKey.get(resultKey(version, candidate.verseId, 'crop'));
    const page = resultsByKey.get(resultKey(version, candidate.verseId, 'page'));
    const tagText = [...candidate.tags].sort().join(', ');
    const reasonText = [...candidate.reasons].sort().join(', ') || 'unmodified control';
    const image = crop?.file
      ? `<a href="${escapeHtml(crop.url)}"><img src="${escapeHtml(crop.file)}" loading="lazy"></a>`
      : `<div class="missing">${escapeHtml(crop?.error ?? (planOnly ? 'plan only' : 'no render'))}</div>`;
    const pageLink = page?.file
      ? `<a href="${escapeHtml(page.file)}">page render</a>`
      : (candidate.tags.has('cross-page') ||
          candidate.tags.has('cross-column') ||
          candidate.tags.has('column-boundary') ||
          candidate.tags.has('page-boundary'))
        ? `<a href="${escapeHtml(`${base}/fax/render/${version}/page/w${width}/${candidate.selector}.jpg`)}">page URL</a>`
        : '';
    return `<article class="${escapeHtml(crop?.status ?? 'planned')}">
      <h3>${escapeHtml(candidate.selector)} <small>id ${candidate.verseId}</small></h3>
      ${image}
      <p><b>Tags:</b> ${escapeHtml(tagText)}</p>
      <p><b>Repair:</b> ${escapeHtml(reasonText)}</p>
      <p><b>Geometry:</b> ${candidate.rows.length} fragment(s), ${new Set(candidate.rows.map((row) => row.page)).size} page(s)</p>
      <p><b>Machine:</b> ${escapeHtml(crop?.status ?? 'planned')}
        ${escapeHtml(crop?.flags.join(', ') || '')}
        ${crop?.width ? `${crop.width}×${crop.height}, ${(100 * (crop.darkFraction ?? 0)).toFixed(1)}% ink` : ''}
        ${pageLink}</p>
      ${crop?.ocrText ? `<details><summary>OCR boundary evidence</summary>
        <p><b>Expected start:</b> ${escapeHtml(crop.canonicalLeading)}</p>
        <p><b>Rendered OCR start:</b> ${escapeHtml(tokenizeWords(crop.ocrText).slice(0, 12).join(' '))}</p>
        <p><b>Expected end:</b> ${escapeHtml(crop.canonicalTrailing)}</p>
        <p><b>Rendered OCR end:</b> ${escapeHtml(tokenizeWords(crop.ocrText).slice(-12).join(' '))}</p>
        <p>Runs: leading ${crop.leadingRun}, trailing ${crop.trailingRun}, longest ${crop.longestCanonicalRun}</p>
      </details>` : ''}
      <label><input type="checkbox"> text complete</label>
      <label><input type="checkbox"> no neighboring text</label>
      <label><input type="checkbox"> notches in whitespace</label>
      <label><input type="checkbox"> fragment order correct</label>
    </article>`;
  }).join('\n');
  return `<section><h2>${escapeHtml(version)}</h2><div class="grid">${cards}</div></section>`;
}).join('\n');

fs.writeFileSync(path.join(outDir, 'index.html'), `<!doctype html>
<meta charset="utf-8">
<title>Fax geometry post-apply render QA</title>
<style>
  body{font:14px system-ui;margin:18px;background:#f5f5f4;color:#222}
  h1,h2{margin-bottom:8px} section{border-top:2px solid #aaa;margin-top:28px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}
  article{background:white;border:2px solid #bbb;border-radius:8px;padding:10px;overflow:auto}
  article.failure{border-color:#c00;background:#fff5f5} article.warning{border-color:#d98c00}
  article.pass{border-color:#198754} img{display:block;max-width:100%;max-height:600px;margin:auto}
  h3{margin:0 0 8px} small{font-weight:normal;color:#666}
  p{margin:6px 0} label{display:block}.missing{color:#900;font-weight:bold}
</style>
<h1>Fax geometry post-apply render QA</h1>
<p>${allChanged
    ? 'Every manifest-touched verse'
    : `Seed <code>${escapeHtml(seed)}</code>; ${perVersion} stratified samples per impacted version`};
render base <code>${escapeHtml(base)}</code>.</p>
<p><b>Reviewer:</b> Check that the first and last words are complete, no adjacent verse text is
included, every notch edge lands in whitespace without cutting glyphs, and multi-fragment
passages remain in reading order across columns/pages.</p>
${versionSections}
`);

const report = {
  generatedAt: new Date().toISOString(),
  base,
  manifestFile,
  ownershipReportFile,
  shadowFile: shadowFile ? path.resolve(shadowFile) : null,
  seed,
  perVersion,
  allChanged,
  width,
  planOnly,
  reuseImages,
  allImpactedVersions,
  selectedVersions: impactedVersions,
  postApply: {
    verificationSource: ownershipReportFile ?? manifestFile,
    manifestPatches: ownershipReport ? null : manifest.counts.patches,
    ownershipProposals: ownershipReport ? selectedOwnershipProposals.length : null,
    ownershipQaProposals: ownershipReport ? ownershipQaProposals.length : null,
    verifiedUpdates: ownershipReport ? null : manifest.counts.updates,
    verifiedDeletes: ownershipReport ? null : manifest.counts.deletes,
    failures: applyFailures.length,
  },
  structuralResiduals: {
    source: structural ? structuralFile : null,
    sourceMissing: structural == null,
    count: residualStructural.length,
    byCode: Object.fromEntries([...residualStructuralCodes].sort().map((code) => [
      code,
      residualStructural.filter((finding) => finding.code === code).length,
    ])),
    byVersion: Object.fromEntries(impactedVersions.map((version) => [
      version,
      residualStructural.filter((finding) => finding.version === version).length,
    ])),
  },
  sampling: Object.fromEntries(impactedVersions.map((version) => [
    version,
    (samplesByVersion.get(version) ?? []).map((candidate) => ({
      verseId: candidate.verseId,
      selector: candidate.selector,
      tags: [...candidate.tags].sort(),
      reasons: [...candidate.reasons].sort(),
      fragments: candidate.rows.length,
      pages: new Set(candidate.rows.map((row) => row.page)).size,
      patchedUids: [...candidate.patchedUids].sort((a, b) => a - b),
    })),
  ])),
  renderSummary: {
    requested: renderJobs.length,
    completed: renderResults.length,
    passed: renderResults.filter((result) => result.status === 'pass').length,
    warnings: renderResults.filter((result) => result.status === 'warning').length,
    failures: renderResults.filter((result) => result.status === 'failure').length,
  },
  renderResults,
};
const releaseBlocked = applyFailures.length > 0 ||
  structural == null ||
  residualStructural.length > 0 ||
  report.renderSummary.failures > 0;
fs.writeFileSync(path.join(outDir, 'qa-report.json'), `${JSON.stringify(report, null, 2)}\n`);

const byVersion = impactedVersions.map((version) => {
  const versionResults = renderResults.filter((result) => result.version === version);
  return {
    version,
    samples: samplesByVersion.get(version)?.length ?? 0,
    crops: versionResults.filter((result) => result.mode === 'crop').length,
    pages: versionResults.filter((result) => result.mode === 'page').length,
    pass: versionResults.filter((result) => result.status === 'pass').length,
    warning: versionResults.filter((result) => result.status === 'warning').length,
    failure: versionResults.filter((result) => result.status === 'failure').length,
  };
});
fs.writeFileSync(path.join(outDir, 'README.md'), [
  '# Fax geometry post-apply render QA',
  '',
  `- Release status: **${releaseBlocked ? 'BLOCKED' : 'PASS'}**`,
  `- Render base: \`${base}\``,
  `- QA scope: ${allChanged ? 'every manifest-touched verse' : 'stratified random sample'}`,
  `- Selected versions: ${impactedVersions.join(', ')}`,
  ...(allChanged
    ? []
    : [`- Sampling seed: \`${seed}\``, `- Samples per impacted version: ${perVersion}`]),
  `- Post-apply manifest verification: ${applyFailures.length ? 'FAIL' : 'PASS'}`,
  `- Untriaged structural notch/fragment findings: ${residualStructural.length}` +
    `${structural ? '' : ' (structural report missing)'}`,
  `- Render requests: ${renderResults.length}/${renderJobs.length}`,
  `- Machine results: ${report.renderSummary.passed} pass, ` +
    `${report.renderSummary.warnings} warning, ${report.renderSummary.failures} failure`,
  '',
  '| Version | Samples | Crop renders | Page renders | Pass | Warning | Failure |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...byVersion.map((row) =>
    `| ${row.version} | ${row.samples} | ${row.crops} | ${row.pages} | ` +
    `${row.pass} | ${row.warning} | ${row.failure} |`),
  '',
  '## Human review',
  '',
  'Open `index.html` and check every card:',
  '',
  '1. The first and last words are complete.',
  '2. No word or line from an adjacent verse is included.',
  '3. Top-left and bottom-right notch edges lie in whitespace and do not cut glyphs.',
  '4. Cross-column and cross-page fragments appear once, in reading order.',
  '5. Page renders highlight the same fragments shown by their crop.',
  '',
  'Machine edge-ink warnings are review priorities, not automatic failures.',
  '',
].join('\n'));

const renderBlockers = renderResults.filter((result) => result.status === 'failure');
fs.writeFileSync(path.join(outDir, 'BLOCKERS.md'), [
  '# Fax geometry QA blockers',
  '',
  `Release status: **${releaseBlocked ? 'BLOCKED' : 'PASS'}**`,
  '',
  '## Render/content blockers',
  '',
  '| Version | Selector | Mode | Flags | Expected boundary | Rendered OCR boundary |',
  '|---|---|---|---|---|---|',
  ...renderBlockers.map((result) => {
    const expected = [
      result.canonicalLeading ? `start: ${result.canonicalLeading}` : '',
      result.canonicalTrailing ? `end: ${result.canonicalTrailing}` : '',
    ].filter(Boolean).join('; ');
    const tokens = tokenizeWords(result.ocrText ?? '');
    const observed = result.ocrText
      ? `start: ${tokens.slice(0, 6).join(' ')}; end: ${tokens.slice(-6).join(' ')}`
      : result.error ?? '';
    return `| ${result.version} | ${result.selector} | ${result.mode} | ` +
      `${result.flags.join(', ')} | ${expected.replaceAll('|', '\\|')} | ` +
      `${observed.replaceAll('|', '\\|')} |`;
  }),
  '',
  '## Exhaustive structural residuals',
  '',
  structural
    ? `The complete individual queue is in \`${path.relative(outDir, structuralFile)}\`.`
    : 'The required post-apply structural report is missing.',
  '',
  '| Code | Count |',
  '|---|---:|',
  ...[...residualStructuralCodes].sort().map((code) =>
    `| ${code} | ${residualStructural.filter((finding) => finding.code === code).length} |`),
  '',
  'These findings are not all proven defects, but they remain blockers until a deterministic',
  'classifier clears them or a remediation/review record adjudicates them.',
  '',
].join('\n'));

console.log(JSON.stringify({
  outDir,
  selectedVersions: impactedVersions,
  allChanged,
  samples: sampleRows.length,
  renderRequests: renderJobs.length,
  postApplyFailures: applyFailures.length,
  structuralResiduals: residualStructural.length,
  releaseStatus: releaseBlocked ? 'BLOCKED' : 'PASS',
  ...report.renderSummary,
}, null, 2));
if (!planOnly && releaseBlocked) process.exitCode = 1;
