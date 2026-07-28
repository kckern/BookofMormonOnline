#!/usr/bin/env npx tsx
/**
 * Build one guarded fax-geometry remediation transaction from deterministic
 * structural findings and high-confidence cached-OCR/pixel findings.
 *
 * This script is read-only. It writes SQL, rollback SQL, and a JSON manifest;
 * it never executes the generated SQL.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, closeDb } from '../src/data/db.ts';
import {
  auditAbsoluteGeometry,
  type AuditFinding,
  type EditionMeta,
  type GeometryRow,
} from './lib/fax-geometry-audit-core.ts';

type DbRow = GeometryRow & {
  verse_id: number;
};

type ReviewedRule = {
  version: string;
  verseId: number;
  page: number;
  code: string;
  field: 'TLW' | 'TLH' | 'BRW' | 'BRH';
  reason: string;
};

type UpdatePatch = {
  action: 'UPDATE';
  old: DbRow;
  next: DbRow;
  reasons: string[];
  sources: Array<'automatic' | 'reviewed' | 'family-topology'>;
};

type DeletePatch = {
  action: 'DELETE';
  old: DbRow;
  keepUid: number;
  reasons: string[];
  sources: ['deterministic'];
};

type Patch = UpdatePatch | DeletePatch;

const argv = process.argv.slice(2);
const flag = (name: string, fallback?: string): string | undefined => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : fallback;
};

const structuralFile = path.resolve(flag(
  'structural',
  '../docs/audits/fax-geometry/2026-07-26-structural/audit.json',
)!);
const pixelFile = path.resolve(flag(
  'pixel',
  '../docs/audits/fax-geometry/2026-07-26-pixel-seeds/audit.json',
)!);
const reviewedFile = path.resolve(flag(
  'reviewed',
  'scripts/fax-geometry-reviewed-fixes.json',
)!);
const outFile = path.resolve(flag(
  'out',
  '../docs/sql/fax-geometry-remediation-2026-07-26.sql',
)!);
const rollbackFile = path.resolve(flag(
  'rollback',
  outFile.replace(/\.sql$/, '.rollback.sql'),
)!);
const manifestFile = path.resolve(flag(
  'manifest',
  outFile.replace(/\.sql$/, '.manifest.json'),
)!);

const structural = JSON.parse(fs.readFileSync(structuralFile, 'utf8')) as {
  findings: AuditFinding[];
};
const pixel = JSON.parse(fs.readFileSync(pixelFile, 'utf8')) as {
  findings: AuditFinding[];
};
const reviewedRules = fs.existsSync(reviewedFile)
  ? JSON.parse(fs.readFileSync(reviewedFile, 'utf8')) as ReviewedRule[]
  : [];

const sha256 = (file: string): string =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const db = getDb();
const [rawRows, registryRows] = await Promise.all([
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

const rows: DbRow[] = rawRows.map((raw) => ({
  uid: Number(raw.uid),
  version: String(raw.version),
  verse_id: Number(raw.verse_id),
  verseId: Number(raw.verse_id),
  page: Number(raw.page),
  imagePage: Number(raw.page),
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
}));
const rowByUid = new Map(rows.map((row) => [row.uid, row]));
const rowsByKey = new Map<string, DbRow[]>();
for (const row of rows) {
  const key = `${row.version}|${row.verseId}|${row.page}`;
  (rowsByKey.get(key) ?? rowsByKey.set(key, []).get(key)!).push(row);
}

const registry = new Map(registryRows.map((raw) => [
  String(raw.slug),
  {
    version: String(raw.slug),
    pages: raw.pages == null ? null : Number(raw.pages),
    pgfirstVerse: Number(raw.pgfirstVerse ?? 1),
    format: String(raw.format || '').trim() || 'jpg',
    imageOffset: 0,
  } satisfies EditionMeta,
]));

const findingsByUid = new Map<number, AuditFinding[]>();
for (const finding of [...structural.findings, ...pixel.findings]) {
  if (finding.uid == null) continue;
  (findingsByUid.get(finding.uid) ?? findingsByUid.set(finding.uid, []).get(finding.uid)!)
    .push(finding);
}

const automaticCodes = new Set([
  'FALSE_TL_NOTCH_SEMANTIC',
  'FALSE_BR_NOTCH_SEMANTIC',
  'TL_NOT_IN_EXPECTED_WORD_GAP',
  'BR_NOT_IN_EXPECTED_WORD_GAP',
  'CONTENT_PREVIOUS_LINE_LEAK',
]);
const blockingCodes = new Set([
  'NON_POSITIVE_SIZE',
  'EMPTY_POLYGON',
  'DISCONNECTED_POLYGON',
  'TINY_EFFECTIVE_AREA',
  'INVALID_TL_NOTCH_WIDTH',
  'INVALID_TL_NOTCH_HEIGHT',
  'INVALID_BR_NOTCH_WIDTH',
  'INVALID_BR_NOTCH_HEIGHT',
  'DIFFERENT_VERSE_EXACT_GEOMETRY',
  'DIFFERENT_VERSE_NEAR_DUPLICATE',
  'INTERLEAVED_VERSE_FRAGMENT',
  'PAGE_JUMP_WITHIN_VERSE',
  'VERSE_ORDER_INVERSION',
  'GREEDY_SEMANTIC_SNAP_DISTANCE',
  'PIXEL_SNAP_DISTANCE_OUTLIER',
  'HISTORICAL_SNAP_DISTANCE_OUTLIER',
]);

function automaticEvidenceGate(finding: AuditFinding): boolean {
  const evidence = finding.evidence ?? {};
  if (Number(evidence.alignmentLength ?? 0) < 4 ||
      Number(evidence.alignmentOccurrences ?? 0) !== 1) return false;
  if (finding.code === 'CONTENT_PREVIOUS_LINE_LEAK') {
    return Number(evidence.leakedCanonicalRun ?? -1) === 0;
  }
  if (finding.code === 'TL_NOT_IN_EXPECTED_WORD_GAP' ||
      finding.code === 'BR_NOT_IN_EXPECTED_WORD_GAP') {
    const gap = evidence.expectedGap as Record<string, unknown> | undefined;
    return evidence.pixelAgrees === true &&
      Number(evidence.crossedTokens ?? 99) === 0 &&
      Number(gap?.width ?? 0) >= 3 &&
      Number(gap?.ink ?? 1) <= 0.08;
  }
  return true;
}

function geometryErrorCodes(row: DbRow): Set<string> {
  return new Set(auditAbsoluteGeometry([row], registry)
    .filter((finding) => finding.severity === 'error')
    .map((finding) => finding.code));
}

function introducedGeometryErrors(old: DbRow, next: DbRow): string[] {
  const before = geometryErrorCodes(old);
  return [...geometryErrorCodes(next)].filter((code) => !before.has(code));
}

const rejected: Array<Record<string, unknown>> = [];
const updatesByUid = new Map<number, UpdatePatch>();

function mergeFinding(
  finding: AuditFinding,
  source: UpdatePatch['sources'][number],
  reason: string,
): void {
  if (finding.uid == null || !finding.proposedGeometry) return;
  const old = rowByUid.get(finding.uid);
  if (!old) {
    rejected.push({ uid: finding.uid, code: finding.code, reason: 'ROW_NOT_IN_CURRENT_DB' });
    return;
  }
  const existing = updatesByUid.get(old.uid) ?? {
    action: 'UPDATE' as const,
    old,
    next: { ...old },
    reasons: [],
    sources: [],
  };
  for (const field of ['TLW', 'TLH', 'BRW', 'BRH'] as const) {
    const proposed = finding.proposedGeometry[field];
    if (proposed == null) continue;
    if (existing.next[field] !== existing.old[field] && existing.next[field] !== proposed) {
      rejected.push({
        uid: old.uid,
        code: finding.code,
        field,
        reason: 'CONFLICTING_PROPOSALS',
        existing: existing.next[field],
        proposed,
      });
      return;
    }
    existing.next[field] = proposed;
  }
  existing.reasons.push(reason);
  existing.sources.push(source);
  updatesByUid.set(old.uid, existing);
}

for (const finding of pixel.findings) {
  if (!finding.autoRepairEligible || !automaticCodes.has(finding.code)) continue;
  if (!automaticEvidenceGate(finding)) {
    rejected.push({ uid: finding.uid, code: finding.code, reason: 'AUTOMATIC_EVIDENCE_GATE' });
    continue;
  }
  mergeFinding(finding, 'automatic', finding.code);
}

for (const rule of reviewedRules) {
  const finding = pixel.findings.find((candidate) =>
    candidate.version === rule.version &&
    candidate.verseId === rule.verseId &&
    candidate.page === rule.page &&
    candidate.code === rule.code &&
    candidate.proposedGeometry?.[rule.field] != null);
  if (!finding) {
    rejected.push({ ...rule, reason: 'REVIEWED_FINDING_NOT_PRESENT' });
    continue;
  }
  mergeFinding(finding, 'reviewed', `REVIEWED:${rule.reason}`);
}

// Only coordinate-free notch removals propagate from the OCR-backed 1852
// semantic seed. Each target must have exactly one corresponding current row.
const derivativeVersions = ['1854', '1854l', '1866', '1871', '1874', '1877'];
for (const patch of [...updatesByUid.values()]) {
  if (patch.old.version !== '1852') continue;
  const sourceRisks = (findingsByUid.get(patch.old.uid) ?? [])
    .filter((finding) => blockingCodes.has(finding.code))
    .map((finding) => finding.code);
  if (sourceRisks.length && !patch.sources.includes('reviewed')) continue;
  if (introducedGeometryErrors(patch.old, patch.next).length) continue;
  const clearsTl = patch.old.TLW > 1 && patch.old.TLH > 0 &&
    patch.next.TLW === 0 && patch.next.TLH === 0;
  const clearsBr = patch.old.BRW > 1 && patch.old.BRH > 0 &&
    patch.next.BRW === 0 && patch.next.BRH === 0;
  if (!clearsTl && !clearsBr) continue;
  for (const version of derivativeVersions) {
    const targets = rowsByKey.get(`${version}|${patch.old.verseId}|${patch.old.page}`) ?? [];
    if (targets.length !== 1) {
      rejected.push({
        version,
        verseId: patch.old.verseId,
        page: patch.old.page,
        reason: 'FAMILY_TARGET_NOT_UNIQUE',
        targetRows: targets.length,
      });
      continue;
    }
    const target = targets[0]!;
    const next = { ...target };
    if (clearsTl) {
      next.TLW = 0;
      next.TLH = 0;
    }
    if (clearsBr) {
      next.BRW = 0;
      next.BRH = 0;
    }
    if (next.TLW === target.TLW && next.TLH === target.TLH &&
        next.BRW === target.BRW && next.BRH === target.BRH) continue;
    updatesByUid.set(target.uid, {
      action: 'UPDATE',
      old: target,
      next,
      reasons: [`FAMILY_TOPOLOGY_FROM_1852:${patch.old.verseId}/${patch.old.page}`],
      sources: ['family-topology'],
    });
  }
}

for (const [uid, patch] of [...updatesByUid]) {
  const risks = (findingsByUid.get(uid) ?? [])
    .filter((finding) => blockingCodes.has(finding.code))
    .map((finding) => finding.code);
  const reviewed = patch.sources.includes('reviewed');
  if (risks.length && !reviewed) {
    updatesByUid.delete(uid);
    rejected.push({ uid, reason: 'BLOCKING_FINDINGS', risks: [...new Set(risks)] });
    continue;
  }
  const introduced = introducedGeometryErrors(patch.old, patch.next);
  if (introduced.length) {
    updatesByUid.delete(uid);
    rejected.push({ uid, reason: 'INTRODUCED_GEOMETRY_ERROR', introduced });
    continue;
  }
  if (patch.old.TLW === patch.next.TLW && patch.old.TLH === patch.next.TLH &&
      patch.old.BRW === patch.next.BRW && patch.old.BRH === patch.next.BRH) {
    updatesByUid.delete(uid);
    rejected.push({ uid, reason: 'NO_CHANGE' });
  }
  patch.reasons = [...new Set(patch.reasons)];
  patch.sources = [...new Set(patch.sources)];
}

const deletes: DeletePatch[] = [];
for (const finding of structural.findings) {
  if (finding.code !== 'EXACT_DUPLICATE_FRAGMENT' ||
      !finding.autoRepairEligible ||
      finding.uid == null) continue;
  const duplicateUid = Number(finding.evidence?.duplicateUid);
  const old = rowByUid.get(finding.uid);
  const keep = rowByUid.get(duplicateUid);
  if (!old || !keep) {
    rejected.push({ uid: finding.uid, duplicateUid, reason: 'DUPLICATE_ROW_MISSING' });
    continue;
  }
  const fields: Array<keyof DbRow> = [
    'version', 'verseId', 'page', 'pageWidth', 'pageScale',
    'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH',
  ];
  if (!fields.every((field) => old[field] === keep[field])) {
    rejected.push({ uid: old.uid, duplicateUid, reason: 'DUPLICATE_NO_LONGER_EXACT' });
    continue;
  }
  deletes.push({
    action: 'DELETE',
    old,
    keepUid: keep.uid,
    reasons: ['EXACT_DUPLICATE_FRAGMENT'],
    sources: ['deterministic'],
  });
}

const patches: Patch[] = [
  ...updatesByUid.values(),
  ...deletes,
].sort((a, b) =>
  a.old.version.localeCompare(b.old.version) ||
  a.old.page - b.old.page ||
  a.old.verseId - b.old.verseId ||
  a.old.uid - b.old.uid);

function csvTuple(patch: Patch): string {
  const old = patch.old;
  const next = patch.action === 'UPDATE' ? patch.next : old;
  const reason = patch.reasons.join('|').replaceAll("'", "''");
  return [
    patch.action === 'UPDATE' ? "'U'" : "'D'",
    old.uid,
    `'${old.version.replaceAll("'", "''")}'`,
    old.verseId,
    old.page,
    old.pageWidth,
    old.pageScale,
    old.X,
    old.Y,
    old.W,
    old.H,
    old.TLW,
    old.TLH,
    old.BRW,
    old.BRH,
    next.TLW,
    next.TLH,
    next.BRW,
    next.BRH,
    `'${reason}'`,
  ].join(', ');
}

const createTemp = [
  'CREATE TEMPORARY TABLE fax_geometry_patch (',
  '  action CHAR(1) NOT NULL, uid BIGINT NOT NULL, version VARCHAR(32) NOT NULL,',
  '  verse_id INT NOT NULL, page INT NOT NULL, pageWidth INT NOT NULL, pageScale INT NOT NULL,',
  '  X INT NOT NULL, Y INT NOT NULL, W INT NOT NULL, H INT NOT NULL,',
  '  oldTLW INT NOT NULL, oldTLH INT NOT NULL, oldBRW INT NOT NULL, oldBRH INT NOT NULL,',
  '  newTLW INT NOT NULL, newTLH INT NOT NULL, newBRW INT NOT NULL, newBRH INT NOT NULL,',
  '  reason VARCHAR(512) NOT NULL, PRIMARY KEY (uid)',
  ');',
].join('\n');

const insertColumns =
  '(action,uid,version,verse_id,page,pageWidth,pageScale,X,Y,W,H,' +
  'oldTLW,oldTLH,oldBRW,oldBRH,newTLW,newTLH,newBRW,newBRH,reason)';
const valueBatches: string[] = [];
for (let index = 0; index < patches.length; index += 250) {
  valueBatches.push(
    `INSERT INTO fax_geometry_patch ${insertColumns} VALUES\n` +
    patches.slice(index, index + 250).map((patch) => `(${csvTuple(patch)})`).join(',\n') +
    ';',
  );
}

const joinOld = [
  'i.uid=p.uid', 'i.version=p.version', 'i.verse_id=p.verse_id', 'i.page=p.page',
  'i.pageWidth=p.pageWidth', 'i.pageScale=p.pageScale',
  'i.X=p.X', 'i.Y=p.Y', 'i.W=p.W', 'i.H=p.H',
  'i.TLW=p.oldTLW', 'i.TLH=p.oldTLH', 'i.BRW=p.oldBRW', 'i.BRH=p.oldBRH',
].join(' AND ');

const forward = [
  '-- Fax geometry remediation generated from the current deterministic + pixel/OCR audit.',
  '-- One guarded transaction. If any old row differs, @fax_patch_ok=0 and NOTHING is changed.',
  `-- Patches: ${patches.length}; updates: ${updatesByUid.size}; exact duplicate deletes: ${deletes.length}.`,
  'START TRANSACTION;',
  'DROP TEMPORARY TABLE IF EXISTS fax_geometry_patch;',
  createTemp,
  ...valueBatches,
  'SET @fax_patch_expected = (SELECT COUNT(*) FROM fax_geometry_patch);',
  `SET @fax_patch_matched = (SELECT COUNT(*) FROM fax_geometry_patch p JOIN bom_xtras_fax_index i ON ${joinOld});`,
  'SET @fax_patch_ok = (@fax_patch_expected = @fax_patch_matched);',
  'UPDATE bom_xtras_fax_index i',
  `JOIN fax_geometry_patch p ON ${joinOld}`,
  'SET i.TLW=p.newTLW, i.TLH=p.newTLH, i.BRW=p.newBRW, i.BRH=p.newBRH',
  "WHERE p.action='U' AND @fax_patch_ok=1;",
  'SET @fax_patch_updates = ROW_COUNT();',
  'DELETE i FROM bom_xtras_fax_index i',
  `JOIN fax_geometry_patch p ON ${joinOld}`,
  "WHERE p.action='D' AND @fax_patch_ok=1;",
  'SET @fax_patch_deletes = ROW_COUNT();',
  'SELECT @fax_patch_expected AS expected_rows, @fax_patch_matched AS matched_old_rows,',
  '       @fax_patch_ok AS guard_ok, @fax_patch_updates AS updates_applied,',
  '       @fax_patch_deletes AS deletes_applied;',
  'DROP TEMPORARY TABLE fax_geometry_patch;',
  'COMMIT;',
  '',
].join('\n');

const updatePatches = patches.filter((patch): patch is UpdatePatch => patch.action === 'UPDATE');
const rollback = [
  '-- Rollback for fax geometry remediation. Uses exact post-change predicates.',
  'START TRANSACTION;',
  ...updatePatches.flatMap((patch) => [
    `-- ${patch.old.version} uid ${patch.old.uid}: ${patch.reasons.join(', ')}`,
    'UPDATE bom_xtras_fax_index SET ' +
      `TLW=${patch.old.TLW}, TLH=${patch.old.TLH}, BRW=${patch.old.BRW}, BRH=${patch.old.BRH} ` +
      `WHERE uid=${patch.old.uid} AND version='${patch.old.version}' ` +
      `AND verse_id=${patch.old.verseId} AND page=${patch.old.page} ` +
      `AND TLW=${patch.next.TLW} AND TLH=${patch.next.TLH} ` +
      `AND BRW=${patch.next.BRW} AND BRH=${patch.next.BRH};`,
  ]),
  ...(deletes.length ? [
    'INSERT INTO bom_xtras_fax_index ' +
      '(uid,version,verse_id,page,pageWidth,pageScale,X,Y,W,H,TLW,TLH,BRW,BRH) VALUES',
    deletes.map(({ old }) =>
      `(${old.uid},'${old.version}',${old.verseId},${old.page},${old.pageWidth},${old.pageScale},` +
      `${old.X},${old.Y},${old.W},${old.H},${old.TLW},${old.TLH},${old.BRW},${old.BRH})`)
      .join(',\n') + ';',
  ] : []),
  'COMMIT;',
  '',
].join('\n');

const byVersion = Object.fromEntries([...new Set(patches.map((patch) => patch.old.version))]
  .sort()
  .map((version) => [
    version,
    {
      updates: updatePatches.filter((patch) => patch.old.version === version).length,
      deletes: deletes.filter((patch) => patch.old.version === version).length,
    },
  ]));
const byReason = Object.fromEntries([...new Set(patches.flatMap((patch) => patch.reasons))]
  .sort()
  .map((reason) => [
    reason,
    patches.filter((patch) => patch.reasons.includes(reason)).length,
  ]));
const manifest = {
  generatedAt: new Date().toISOString(),
  readOnlyGenerator: true,
  sourceFiles: {
    structural: { path: structuralFile, sha256: sha256(structuralFile) },
    pixel: { path: pixelFile, sha256: sha256(pixelFile) },
    reviewed: fs.existsSync(reviewedFile)
      ? { path: reviewedFile, sha256: sha256(reviewedFile) }
      : null,
  },
  outputs: { forward: outFile, rollback: rollbackFile },
  counts: {
    patches: patches.length,
    updates: updatePatches.length,
    deletes: deletes.length,
    automatic: updatePatches.filter((patch) => patch.sources.includes('automatic')).length,
    reviewed: updatePatches.filter((patch) => patch.sources.includes('reviewed')).length,
    familyTopology: updatePatches.filter((patch) => patch.sources.includes('family-topology')).length,
    rejected: rejected.length,
  },
  byVersion,
  byReason,
  rejected,
  patches,
};

for (const file of [outFile, rollbackFile, manifestFile]) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}
fs.writeFileSync(outFile, forward);
fs.writeFileSync(rollbackFile, rollback);
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({
  outFile,
  rollbackFile,
  manifestFile,
  ...manifest.counts,
  byVersion,
}, null, 2));
