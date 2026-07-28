#!/usr/bin/env npx tsx
/**
 * Read-only verifier for fax-geometry-remediation manifests.
 *
 * Confirms source hashes, exact current-row predicates, retained duplicate
 * peers, simulated post-change geometry, and the SQL's global all-or-none
 * guard. It never executes the SQL.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, closeDb } from '../src/data/db.ts';
import {
  auditAbsoluteGeometry,
  auditDuplicatesAndOverlaps,
  type EditionMeta,
  type GeometryRow,
} from './lib/fax-geometry-audit-core.ts';

type ManifestRow = GeometryRow & { verse_id: number };
type ManifestPatch = {
  action: 'UPDATE' | 'DELETE';
  old: ManifestRow;
  next?: ManifestRow;
  keepUid?: number;
  reasons: string[];
};
type Manifest = {
  sourceFiles: Record<string, { path: string; sha256: string } | null>;
  outputs: { forward: string; rollback: string };
  counts: { patches: number; updates: number; deletes: number };
  patches: ManifestPatch[];
};

const manifestFile = path.resolve(
  process.argv[2] ?? '../docs/sql/fax-geometry-remediation-2026-07-26.manifest.json',
);
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as Manifest;
const failures: Array<Record<string, unknown>> = [];

const sha256 = (file: string): string =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const [name, source] of Object.entries(manifest.sourceFiles)) {
  if (!source) continue;
  if (!fs.existsSync(source.path)) {
    failures.push({ code: 'SOURCE_MISSING', name, path: source.path });
  } else if (sha256(source.path) !== source.sha256) {
    failures.push({ code: 'SOURCE_HASH_MISMATCH', name, path: source.path });
  }
}

const sql = fs.readFileSync(manifest.outputs.forward, 'utf8');
const tupleCount = (sql.match(/^\('[UD]',/gm) ?? []).length;
if (tupleCount !== manifest.counts.patches) {
  failures.push({
    code: 'SQL_PATCH_COUNT_MISMATCH',
    manifest: manifest.counts.patches,
    sql: tupleCount,
  });
}
for (const required of [
  'SET @fax_patch_ok = (@fax_patch_expected = @fax_patch_matched);',
  "WHERE p.action='U' AND @fax_patch_ok=1;",
  "WHERE p.action='D' AND @fax_patch_ok=1;",
]) {
  if (!sql.includes(required)) failures.push({ code: 'SQL_GUARD_MISSING', required });
}

const db = getDb();
const [rawRows, rawRegistry] = await Promise.all([
  db.selectFrom('bom_xtras_fax_index')
    .select([
      'uid', 'version', 'verse_id', 'page', 'pageWidth', 'pageScale',
      'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH',
    ])
    .execute(),
  db.selectFrom('bom_xtras_fax')
    .select(['slug', 'pages', 'pgfirstVerse', 'format'])
    .execute(),
]);
await closeDb();

const minimumPage = new Map<string, number>();
for (const raw of rawRows) {
  const version = String(raw.version);
  const page = Number(raw.page);
  minimumPage.set(version, Math.min(minimumPage.get(version) ?? page, page));
}
const registryByVersion = new Map(rawRegistry.map((raw) => [String(raw.slug), raw]));
const metas = new Map<string, EditionMeta>();
for (const version of new Set(rawRows.map((raw) => String(raw.version)))) {
  const registry = registryByVersion.get(version);
  const first = Number(registry?.pgfirstVerse ?? 1);
  metas.set(version, {
    version,
    pages: registry?.pages == null ? null : Number(registry.pages),
    pgfirstVerse: first,
    format: String(registry?.format || '').trim() || 'jpg',
    imageOffset: first - (minimumPage.get(version) ?? first),
  });
}

const currentRows: ManifestRow[] = rawRows.map((raw) => {
  const version = String(raw.version);
  const page = Number(raw.page);
  return {
    uid: Number(raw.uid),
    version,
    verse_id: Number(raw.verse_id),
    verseId: Number(raw.verse_id),
    page,
    imagePage: page + (metas.get(version)?.imageOffset ?? 0),
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
const currentByUid = new Map(currentRows.map((row) => [row.uid, row]));

const exactFields: Array<keyof ManifestRow> = [
  'uid', 'version', 'verseId', 'page', 'pageWidth', 'pageScale',
  'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH',
];
const same = (a: ManifestRow, b: ManifestRow): boolean =>
  exactFields.every((field) => a[field] === b[field]);

for (const patch of manifest.patches) {
  const current = currentByUid.get(patch.old.uid);
  if (!current || !same(current, patch.old)) {
    failures.push({
      code: 'STALE_OLD_ROW',
      uid: patch.old.uid,
      expected: patch.old,
      current: current ?? null,
    });
  }
  if (patch.action === 'DELETE') {
    const keep = patch.keepUid == null ? null : currentByUid.get(patch.keepUid);
    if (!keep || !same({ ...keep, uid: patch.old.uid }, patch.old)) {
      failures.push({
        code: 'DUPLICATE_KEEP_ROW_INVALID',
        uid: patch.old.uid,
        keepUid: patch.keepUid,
      });
    }
  }
}

const patchedRows = new Map(currentByUid);
for (const patch of manifest.patches) {
  if (patch.action === 'DELETE') patchedRows.delete(patch.old.uid);
  else if (patch.next) {
    const current = patchedRows.get(patch.old.uid);
    if (current) patchedRows.set(patch.old.uid, {
      ...current,
      TLW: patch.next.TLW,
      TLH: patch.next.TLH,
      BRW: patch.next.BRW,
      BRH: patch.next.BRH,
    });
  }
}

const beforeAbsolute = auditAbsoluteGeometry(currentRows, metas);
const afterRows = [...patchedRows.values()];
const afterAbsolute = auditAbsoluteGeometry(afterRows, metas);
const hardSignature = (finding: { severity: string; code: string; uid?: number }): string =>
  `${finding.uid ?? ''}|${finding.code}`;
const beforeHard = new Set(beforeAbsolute
  .filter((finding) => finding.severity === 'error')
  .map(hardSignature));
const introducedHard = afterAbsolute
  .filter((finding) => finding.severity === 'error' && !beforeHard.has(hardSignature(finding)));
if (introducedHard.length) {
  failures.push({
    code: 'SIMULATION_INTRODUCES_HARD_GEOMETRY_FINDINGS',
    count: introducedHard.length,
    sample: introducedHard.slice(0, 20),
  });
}

const beforeDuplicates = auditDuplicatesAndOverlaps(currentRows)
  .filter((finding) => finding.code === 'EXACT_DUPLICATE_FRAGMENT').length;
const afterDuplicates = auditDuplicatesAndOverlaps(afterRows)
  .filter((finding) => finding.code === 'EXACT_DUPLICATE_FRAGMENT').length;
if (beforeDuplicates - afterDuplicates !== manifest.counts.deletes) {
  failures.push({
    code: 'SIMULATED_DUPLICATE_REDUCTION_MISMATCH',
    beforeDuplicates,
    afterDuplicates,
    expectedReduction: manifest.counts.deletes,
  });
}

const reviewedPatches = manifest.patches.filter((patch) =>
  patch.reasons.some((reason) => reason.startsWith('REVIEWED:')));
for (const patch of reviewedPatches) {
  if (patch.action !== 'UPDATE' || !patch.next) {
    failures.push({ code: 'REVIEWED_PATCH_NOT_UPDATE', uid: patch.old.uid });
  }
}

const result = {
  manifestFile,
  forwardSql: manifest.outputs.forward,
  patchCount: manifest.patches.length,
  updateCount: manifest.counts.updates,
  deleteCount: manifest.counts.deletes,
  currentRowsMatched: manifest.patches.length -
    failures.filter((failure) => failure.code === 'STALE_OLD_ROW').length,
  beforeHardGeometryFindings: beforeHard.size,
  afterHardGeometryFindings: afterAbsolute.filter((finding) => finding.severity === 'error').length,
  beforeExactDuplicates: beforeDuplicates,
  afterExactDuplicates: afterDuplicates,
  reviewedPatches: reviewedPatches.length,
  failures: failures.length,
  failureDetails: failures.slice(0, 50),
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
