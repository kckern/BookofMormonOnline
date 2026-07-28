#!/usr/bin/env npx tsx
/**
 * Generate one guarded SQL transaction from accepted line-ownership results.
 *
 * The input report is deterministic and read-only. This generator refuses
 * unresolved outcomes, malformed geometry, duplicate fragments, ambiguous UID
 * mappings, and page/column topology that the current reconstructor cannot
 * represent safely.
 */
import fs from 'node:fs';
import path from 'node:path';

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

type Proposal = {
  version: string;
  verseId: number;
  selector: string;
  outcome: string;
  currentRows: Geometry[];
  proposedRows?: Geometry[];
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const reportFile = path.resolve(flag(
  'report',
  '../docs/audits/fax-geometry/2026-07-26-line-ownership-final-v2/' +
    'line-ownership-report.json',
));
const outputFile = path.resolve(flag(
  'out',
  '../docs/sql/fax-geometry-source-ownership-remediation-2026-07-26.sql',
));
const only = new Set(
  flag('only', '').split(',').map((value) => value.trim()).filter(Boolean),
);

const report = JSON.parse(fs.readFileSync(reportFile, 'utf8')) as {
  proposals: Proposal[];
};
const selected = report.proposals.filter((proposal) =>
  !only.size || only.has(`${proposal.version}:${proposal.selector}`));
if (only.size && selected.length !== only.size) {
  const found = new Set(selected.map((proposal) => `${proposal.version}:${proposal.selector}`));
  throw new Error(
    `--only selector(s) absent from report: ${
      [...only].filter((value) => !found.has(value)).join(', ')
    }`,
  );
}
const accepted = selected.filter((proposal) =>
  proposal.outcome.startsWith('ACCEPTED_'));
const unresolved = selected.filter((proposal) =>
  proposal.outcome === 'CONDITIONAL' ||
  proposal.outcome === 'NO_PROPOSAL' ||
  proposal.outcome === 'NO_CURRENT_ROWS');
if (unresolved.length) {
  throw new Error(
    `refusing SQL with unresolved proposals: ${
      unresolved.map((item) => `${item.version}/${item.selector}`).join(', ')
    }`,
  );
}
if (!accepted.length) throw new Error('no accepted proposals');

const fields = [
  'page', 'pageWidth', 'pageScale', 'X', 'Y', 'W', 'H',
  'TLW', 'TLH', 'BRW', 'BRH',
] as const;
const sameGeometry = (left: Geometry, right: Geometry): boolean =>
  left.version === right.version &&
  left.verseId === right.verseId &&
  fields.every((field) => left[field] === right[field]);
const key = (row: Geometry): string =>
  `${row.version}|${row.verseId}|${row.page}|${row.X}|${row.Y}|${row.W}|${row.H}|` +
  `${row.TLW}|${row.TLH}|${row.BRW}|${row.BRH}`;
const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`;
const reason = (proposal: Proposal): string =>
  `${proposal.outcome}:${proposal.selector}`;

const expectedRows: Array<Geometry & { uid: number; reason: string }> = [];
const desiredRows: Array<Geometry & {
  sourceUid: number | null;
  changed: number;
  reason: string;
}> = [];
const affectedKeys = new Set<string>();
const expectedUids = new Set<number>();
const desiredSourceUids = new Set<number>();
const desiredGeometry = new Set<string>();

for (const proposal of accepted) {
  const proposedRows = proposal.proposedRows ?? [];
  if (!proposal.currentRows.length || !proposedRows.length) {
    throw new Error(`empty geometry for ${proposal.version}/${proposal.selector}`);
  }
  affectedKeys.add(`${proposal.version}|${proposal.verseId}`);
  const pages = new Set<number>();
  for (const row of proposal.currentRows) {
    if (row.uid == null || expectedUids.has(row.uid)) {
      throw new Error(`duplicate/missing old uid for ${proposal.version}/${proposal.selector}`);
    }
    expectedUids.add(row.uid);
    expectedRows.push({ ...row, uid: row.uid, reason: reason(proposal) });
  }
  for (let index = 0; index < proposedRows.length; index++) {
    const row = proposedRows[index]!;
    if (pages.has(row.page)) {
      throw new Error(
        `same-page multi-fragment proposal is unsupported: ` +
        `${proposal.version}/${proposal.selector}/p${row.page}`,
      );
    }
    pages.add(row.page);
    if (row.W <= 0 || row.H <= 0 || row.X < 0 || row.Y < 0 ||
        row.X + row.W > row.pageScale ||
        row.TLW < 0 || row.TLW > row.W || row.BRW < 0 || row.BRW > row.W ||
        row.TLH < 0 || row.TLH > row.H || row.BRH < 0 || row.BRH > row.H ||
        (row.TLW === 0) !== (row.TLH === 0) ||
        (row.BRW === 0) !== (row.BRH === 0)) {
      throw new Error(
        `invalid proposed geometry for ${proposal.version}/${proposal.selector}`,
      );
    }
    if (index > 0 && (row.TLW !== 0 || row.TLH !== 0)) {
      throw new Error(
        `interior/page-continuation TL notch for ${proposal.version}/${proposal.selector}`,
      );
    }
    if (index < proposedRows.length - 1 && (row.BRW !== 0 || row.BRH !== 0)) {
      throw new Error(
        `interior/page-continuation BR notch for ${proposal.version}/${proposal.selector}`,
      );
    }
    const geometryKey = key(row);
    if (desiredGeometry.has(geometryKey)) {
      throw new Error(`duplicate desired geometry ${geometryKey}`);
    }
    desiredGeometry.add(geometryKey);
    const old = row.uid == null
      ? null
      : proposal.currentRows.find((candidate) => candidate.uid === row.uid) ?? null;
    if (row.uid != null && (!old || desiredSourceUids.has(row.uid))) {
      throw new Error(
        `ambiguous desired uid ${row.uid} for ${proposal.version}/${proposal.selector}`,
      );
    }
    if (row.uid != null) desiredSourceUids.add(row.uid);
    desiredRows.push({
      ...row,
      sourceUid: row.uid,
      changed: old && !sameGeometry(old, row) ? 1 : 0,
      reason: reason(proposal),
    });
  }
}

const updates = desiredRows.filter((row) => row.sourceUid != null && row.changed);
const inserts = desiredRows.filter((row) => row.sourceUid == null);
const deletes = expectedRows.filter((row) => !desiredSourceUids.has(row.uid));
const unchanged = desiredRows.filter((row) => row.sourceUid != null && !row.changed);
const affected = [...affectedKeys].map((value) => {
  const [version, verseId] = value.split('|');
  return { version: version!, verseId: Number(verseId) };
}).sort((left, right) =>
  left.version.localeCompare(right.version) || left.verseId - right.verseId);

const oldValue = (row: Geometry & { uid: number; reason: string }): string =>
  `(${row.uid},${quote(row.version)},${row.verseId},${row.page},${row.pageWidth},` +
  `${row.pageScale},${row.X},${row.Y},${row.W},${row.H},${row.TLW},${row.TLH},` +
  `${row.BRW},${row.BRH},${quote(row.reason)})`;
const desiredValue = (row: typeof desiredRows[number], proposalId: number): string =>
  `(${proposalId},${row.sourceUid ?? 'NULL'},${quote(row.version)},${row.verseId},` +
  `${row.page},${row.pageWidth},${row.pageScale},${row.X},${row.Y},${row.W},${row.H},` +
  `${row.TLW},${row.TLH},${row.BRW},${row.BRH},${row.changed},${quote(row.reason)})`;

const sql = [
  '-- Deterministic source-word ownership remediation.',
  '-- No LLM/vision calls. Generated from local Tesseract TSV, canonical/neighbor',
  '-- anchors, robust whitespace line extents, and source-word clearance checks.',
  '-- One guarded transaction: if the complete old row set differs, no mutation runs.',
  `-- Accepted verses: ${accepted.length}; old rows: ${expectedRows.length}; ` +
    `desired rows: ${desiredRows.length}.`,
  `-- Operations: ${updates.length} updates, ${deletes.length} deletes, ` +
    `${inserts.length} inserts; ${unchanged.length} accepted rows already exact.`,
  '-- Transparent/missing source media is intentionally not addressable by this SQL.',
  '',
  'START TRANSACTION;',
  'DROP TEMPORARY TABLE IF EXISTS fax_line_affected;',
  'DROP TEMPORARY TABLE IF EXISTS fax_line_expected;',
  'DROP TEMPORARY TABLE IF EXISTS fax_line_desired;',
  '',
  'CREATE TEMPORARY TABLE fax_line_affected (',
  '  version VARCHAR(32) NOT NULL, verse_id INT NOT NULL,',
  '  PRIMARY KEY (version, verse_id)',
  ');',
  'INSERT INTO fax_line_affected (version, verse_id) VALUES',
  `${affected.map((item) => `(${quote(item.version)},${item.verseId})`).join(',\n')};`,
  '',
  'CREATE TEMPORARY TABLE fax_line_expected (',
  '  uid BIGINT NOT NULL, version VARCHAR(32) NOT NULL, verse_id INT NOT NULL,',
  '  page INT NOT NULL, pageWidth INT NOT NULL, pageScale INT NOT NULL,',
  '  X INT NOT NULL, Y INT NOT NULL, W INT NOT NULL, H INT NOT NULL,',
  '  TLW INT NOT NULL, TLH INT NOT NULL, BRW INT NOT NULL, BRH INT NOT NULL,',
  '  reason VARCHAR(160) NOT NULL, PRIMARY KEY (uid)',
  ');',
  'INSERT INTO fax_line_expected',
  '  (uid,version,verse_id,page,pageWidth,pageScale,X,Y,W,H,TLW,TLH,BRW,BRH,reason)',
  'VALUES',
  `${expectedRows.map(oldValue).join(',\n')};`,
  '',
  'CREATE TEMPORARY TABLE fax_line_desired (',
  '  proposal_id INT NOT NULL, source_uid BIGINT NULL,',
  '  version VARCHAR(32) NOT NULL, verse_id INT NOT NULL,',
  '  page INT NOT NULL, pageWidth INT NOT NULL, pageScale INT NOT NULL,',
  '  X INT NOT NULL, Y INT NOT NULL, W INT NOT NULL, H INT NOT NULL,',
  '  TLW INT NOT NULL, TLH INT NOT NULL, BRW INT NOT NULL, BRH INT NOT NULL,',
  '  changed TINYINT NOT NULL, reason VARCHAR(160) NOT NULL,',
  '  PRIMARY KEY (proposal_id), UNIQUE KEY (source_uid)',
  ');',
  'INSERT INTO fax_line_desired',
  '  (proposal_id,source_uid,version,verse_id,page,pageWidth,pageScale,X,Y,W,H,',
  '   TLW,TLH,BRW,BRH,changed,reason)',
  'VALUES',
  `${desiredRows.map(desiredValue).join(',\n')};`,
  '',
  `SET @fax_old_expected = ${expectedRows.length};`,
  'SET @fax_old_matched = (',
  '  SELECT COUNT(*) FROM fax_line_expected e',
  '  JOIN bom_xtras_fax_index i',
  '    ON i.uid=e.uid AND i.version=e.version AND i.verse_id=e.verse_id',
  '   AND i.page=e.page AND i.pageWidth=e.pageWidth AND i.pageScale=e.pageScale',
  '   AND i.X=e.X AND i.Y=e.Y AND i.W=e.W AND i.H=e.H',
  '   AND i.TLW=e.TLW AND i.TLH=e.TLH AND i.BRW=e.BRW AND i.BRH=e.BRH',
  ');',
  'SET @fax_old_actual = (',
  '  SELECT COUNT(*) FROM bom_xtras_fax_index i',
  '  JOIN fax_line_affected a ON a.version=i.version AND a.verse_id=i.verse_id',
  ');',
  'SET @fax_guard_ok = (',
  '  @fax_old_matched=@fax_old_expected AND @fax_old_actual=@fax_old_expected',
  ');',
  '',
  'UPDATE bom_xtras_fax_index i',
  'JOIN fax_line_expected e ON e.uid=i.uid',
  'JOIN fax_line_desired d ON d.source_uid=i.uid AND d.changed=1',
  'SET i.version=d.version, i.verse_id=d.verse_id, i.page=d.page,',
  '    i.pageWidth=d.pageWidth, i.pageScale=d.pageScale,',
  '    i.X=d.X, i.Y=d.Y, i.W=d.W, i.H=d.H,',
  '    i.TLW=d.TLW, i.TLH=d.TLH, i.BRW=d.BRW, i.BRH=d.BRH',
  'WHERE @fax_guard_ok=1;',
  'SET @fax_updates = ROW_COUNT();',
  '',
  'DELETE i FROM bom_xtras_fax_index i',
  'JOIN fax_line_expected e ON e.uid=i.uid',
  'LEFT JOIN fax_line_desired d ON d.source_uid=i.uid',
  'WHERE d.proposal_id IS NULL AND @fax_guard_ok=1;',
  'SET @fax_deletes = ROW_COUNT();',
  '',
  'INSERT INTO bom_xtras_fax_index',
  '  (version,verse_id,page,pageWidth,pageScale,X,Y,W,H,TLW,TLH,BRW,BRH)',
  'SELECT d.version,d.verse_id,d.page,d.pageWidth,d.pageScale,',
  '       d.X,d.Y,d.W,d.H,d.TLW,d.TLH,d.BRW,d.BRH',
  'FROM fax_line_desired d',
  'WHERE d.source_uid IS NULL AND @fax_guard_ok=1',
  '  AND NOT EXISTS (',
  '    SELECT 1 FROM bom_xtras_fax_index i',
  '    WHERE i.version=d.version AND i.verse_id=d.verse_id AND i.page=d.page',
  '      AND i.pageWidth=d.pageWidth AND i.pageScale=d.pageScale',
  '      AND i.X=d.X AND i.Y=d.Y AND i.W=d.W AND i.H=d.H',
  '      AND i.TLW=d.TLW AND i.TLH=d.TLH AND i.BRW=d.BRW AND i.BRH=d.BRH',
  '  );',
  'SET @fax_inserts = ROW_COUNT();',
  '',
  'SET @fax_post_actual = (',
  '  SELECT COUNT(*) FROM bom_xtras_fax_index i',
  '  JOIN fax_line_affected a ON a.version=i.version AND a.verse_id=i.verse_id',
  ');',
  'SET @fax_post_matched = (',
  '  SELECT COUNT(*) FROM fax_line_desired d',
  '  JOIN bom_xtras_fax_index i',
  '    ON i.version=d.version AND i.verse_id=d.verse_id AND i.page=d.page',
  '   AND i.pageWidth=d.pageWidth AND i.pageScale=d.pageScale',
  '   AND i.X=d.X AND i.Y=d.Y AND i.W=d.W AND i.H=d.H',
  '   AND i.TLW=d.TLW AND i.TLH=d.TLH AND i.BRW=d.BRW AND i.BRH=d.BRH',
  ');',
  `SET @fax_post_ok = (@fax_guard_ok=1 AND @fax_updates=${updates.length} ` +
    `AND @fax_deletes=${deletes.length} AND @fax_inserts=${inserts.length} ` +
    `AND @fax_post_actual=${desiredRows.length} ` +
    `AND @fax_post_matched=${desiredRows.length});`,
  '',
  'DROP TEMPORARY TABLE fax_line_desired;',
  'DROP TEMPORARY TABLE fax_line_expected;',
  'DROP TEMPORARY TABLE fax_line_affected;',
  '',
  "-- Commit only on a complete post-state match; otherwise undo the transaction.",
  "SET @fax_finish_sql = IF(@fax_post_ok=1, 'COMMIT', 'ROLLBACK');",
  'PREPARE fax_finish FROM @fax_finish_sql;',
  'EXECUTE fax_finish;',
  'DEALLOCATE PREPARE fax_finish;',
  '',
  'SELECT @fax_guard_ok AS guard_ok, @fax_post_ok AS committed,',
  '       @fax_old_expected AS expected_old_rows,',
  '       @fax_old_matched AS matched_old_rows, @fax_old_actual AS actual_old_rows,',
  '       @fax_updates AS updates_applied, @fax_deletes AS deletes_applied,',
  '       @fax_inserts AS inserts_applied, @fax_post_actual AS checked_final_rows,',
  '       @fax_post_matched AS matched_final_rows;',
  '',
].join('\n');

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, sql);
console.log(JSON.stringify({
  reportFile,
  outputFile,
  acceptedVerses: accepted.length,
  expectedRows: expectedRows.length,
  desiredRows: desiredRows.length,
  updates: updates.length,
  deletes: deletes.length,
  inserts: inserts.length,
  unchanged: unchanged.length,
}, null, 2));
