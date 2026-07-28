import { lookupReference } from 'scripture-guide';
import { getDb } from '../../data/db.js';
import { sanitizeBoxes } from './geometry.js';
import { deslugify } from './canonical.js';
import type { FaxBox } from './types.js';

/** A selector path segment -> sorted, de-duped verse ids. */
export function selectorToVerseIds(selector: string): number[] {
  let ids: number[];
  if (selector.startsWith('ids/')) {
    ids = selector.slice(4).split('-').map(Number).filter((n) => Number.isInteger(n) && n > 0);
  } else {
    ids = lookupReference(deslugify(selector))?.verse_ids ?? [];
  }
  return [...new Set(ids)].sort((a, z) => a - z);
}

/** version + verse ids -> sanitized boxes from bom_xtras_fax_index. */
export async function verseIdsToBoxes(version: string, verseIds: number[]): Promise<FaxBox[]> {
  if (verseIds.length === 0) return [];
  const rows = await getDb()
    .selectFrom('bom_xtras_fax_index')
    .select(['uid', 'verse_id', 'page', 'pageWidth', 'pageScale', 'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH'])
    .where('version', '=', version)
    .where('verse_id', 'in', verseIds.map(String))
    .orderBy('uid')
    .execute();
  const boxes: FaxBox[] = rows.map((r) => ({
    uid: Number(r.uid), verseId: Number(r.verse_id), page: Number(r.page),
    pageWidth: Number(r.pageWidth), pageScale: Number(r.pageScale) || 700,
    x: Number(r.X), y: Number(r.Y), w: Number(r.W), h: Number(r.H),
    tlw: Number(r.TLW), tlh: Number(r.TLH), brw: Number(r.BRW), brh: Number(r.BRH),
  }));
  return sanitizeBoxes(boxes);
}

/**
 * Per-edition scan metadata for mapping a stored `bom_xtras_fax_index.page` to
 * an actual source-scan file.
 *
 * `offset`: the box coordinates are authored against the scan file, but the
 * stored `page` is numbered differently (front-matter/plate leaves shift it).
 * The first indexed page (MIN(page)) maps to image file `pgfirstVerse`, so:
 *   imageFile = faxPage + (pgfirstVerse - MIN(page))
 * Verified constant across an edition (e.g. 1837 = -4, 2013 = -9, 1841 = 0).
 *
 * `format`: the source-scan file extension. Most editions are jpg (stored as an
 * empty string); 1920/1981/2013 are png. Not to be confused with the render
 * OUTPUT format (jpg/webp), which is chosen by the request.
 */
const DEFAULT_PAPER = '#faf7f0';

/** Normalize the stored `bgcolor` into a sharp-acceptable CSS color. Accepts
 * `#faf7f0`, bare `faf7f0`/`fff`, or any full CSS color; falls back to paper. */
function normalizePaper(bg: string | null | undefined): string {
  const s = (bg ?? '').trim();
  if (!s) return DEFAULT_PAPER;
  if (/^[0-9a-fA-F]{6}$/.test(s) || /^[0-9a-fA-F]{3}$/.test(s)) return `#${s}`;
  return s;
}

export async function imageScanMeta(
  version: string
): Promise<{ offset: number; format: string; paper: string }> {
  const db = getDb();
  const [fax, minRow] = await Promise.all([
    db.selectFrom('bom_xtras_fax').select(['pgfirstVerse', 'format', 'bgcolor']).where('slug', '=', version).executeTakeFirst(),
    db.selectFrom('bom_xtras_fax_index')
      .select((eb) => eb.fn.min('page').as('minp'))
      .where('version', '=', version).executeTakeFirst(),
  ]);
  const pgFirst = Number(fax?.pgfirstVerse ?? 1);
  const minPage = Number(minRow?.minp ?? 0);
  const format = fax?.format && String(fax.format).trim() ? String(fax.format).trim() : 'jpg';
  const paper = normalizePaper(fax?.bgcolor);
  return { offset: pgFirst - minPage, format, paper };
}

/** Legacy alias: {slug}/{id} text-unit -> verse ids via bom_slug -> bom_text.heading. */
export async function legacyUnitToVerseIds(slug: string, id: number): Promise<number[]> {
  const db = getDb();
  const page = await db.selectFrom('bom_slug')
    .select('link').where('slug', '=', slug).where('type', '=', 'PG').executeTakeFirst();
  if (!page?.link) return [];
  const unit = await db.selectFrom('bom_text')
    .select('heading').where('page', '=', page.link).where('link', '=', id).executeTakeFirst();
  if (!unit?.heading) return [];
  const ref = String(unit.heading).replace(/[–—]/g, '-');
  const ids = lookupReference(ref)?.verse_ids ?? [];
  return [...new Set(ids)].sort((a, z) => a - z);
}
