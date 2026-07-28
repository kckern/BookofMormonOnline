import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import type { FaxBox } from '../../src/media/fax/types.ts';

export type ShadowGeometry = {
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

export type ShadowFaxMeta = {
  slug: string;
  pgfirstVerse: number;
  format: string;
  bgcolor: string | null;
};

export const DEFAULT_SHADOW_FILE = path.resolve(
  process.cwd(),
  '.shadow/fax-shadow.sqlite',
);

export function openShadow(
  file: string,
  options: { queryOnly?: boolean } = {},
): DatabaseSync {
  const db = new DatabaseSync(path.resolve(file));
  db.exec('PRAGMA foreign_keys=ON');
  db.exec('PRAGMA busy_timeout=5000');
  if (options.queryOnly) db.exec('PRAGMA query_only=ON');
  return db;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(',');
}

export function loadShadowRows(
  db: DatabaseSync,
  options: { versions?: string[]; verseIds?: number[] } = {},
): ShadowGeometry[] {
  const where: string[] = [];
  const values: Array<string | number> = [];
  if (options.versions?.length) {
    where.push(`version IN (${placeholders(options.versions.length)})`);
    values.push(...options.versions);
  }
  if (options.verseIds?.length) {
    where.push(`verse_id IN (${placeholders(options.verseIds.length)})`);
    values.push(...options.verseIds);
  }
  const rows = db.prepare(`
    SELECT uid,version,verse_id,page,pageWidth,pageScale,X,Y,W,H,TLW,TLH,BRW,BRH
    FROM bom_xtras_fax_index
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY version,verse_id,page,Y,X,uid
  `).all(...values) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
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
}

export function shadowBoxes(
  db: DatabaseSync,
  version: string,
  verseIds: number[],
): FaxBox[] {
  if (!verseIds.length) return [];
  return loadShadowRows(db, { versions: [version], verseIds }).map((row) => ({
    uid: row.uid,
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
  }));
}

export function shadowVersions(db: DatabaseSync): string[] {
  return (db.prepare(
    'SELECT DISTINCT version FROM bom_xtras_fax_index ORDER BY version',
  ).all() as Array<{ version: unknown }>).map((row) => String(row.version));
}

export function shadowCanonicalText(
  db: DatabaseSync,
  verseIds?: number[],
): Map<number, string> {
  const rows = verseIds?.length
    ? db.prepare(`
        SELECT verse_id,verse_scripture FROM lds_scriptures_verses
        WHERE verse_id IN (${placeholders(verseIds.length)})
      `).all(...verseIds)
    : db.prepare(
      'SELECT verse_id,verse_scripture FROM lds_scriptures_verses ORDER BY verse_id',
    ).all();
  return new Map((rows as Array<Record<string, unknown>>).map((row) => [
    Number(row.verse_id),
    String(row.verse_scripture),
  ]));
}

const DEFAULT_PAPER = '#faf7f0';
function normalizePaper(bg: string | null): string {
  const value = (bg ?? '').trim();
  if (!value) return DEFAULT_PAPER;
  if (/^[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(value)) return `#${value}`;
  return value;
}

export function shadowImageMeta(
  db: DatabaseSync,
  version: string,
): { offset: number; format: string; paper: string } {
  const fax = db.prepare(`
    SELECT slug,pgfirstVerse,format,bgcolor
    FROM bom_xtras_fax WHERE slug=?
  `).get(version) as Record<string, unknown> | undefined;
  const minimum = db.prepare(`
    SELECT MIN(page) AS minp FROM bom_xtras_fax_index WHERE version=?
  `).get(version) as Record<string, unknown>;
  const pgFirst = Number(fax?.pgfirstVerse ?? 1);
  const minPage = Number(minimum?.minp ?? 0);
  const format = String(fax?.format ?? '').trim() || 'jpg';
  return {
    offset: pgFirst - minPage,
    format,
    paper: normalizePaper(fax?.bgcolor == null ? null : String(fax.bgcolor)),
  };
}

export function shadowMetadata(db: DatabaseSync): Record<string, string> {
  return Object.fromEntries((db.prepare(
    'SELECT key,value FROM fax_shadow_meta ORDER BY key',
  ).all() as Array<{ key: unknown; value: unknown }>).map((row) => [
    String(row.key),
    String(row.value),
  ]));
}
