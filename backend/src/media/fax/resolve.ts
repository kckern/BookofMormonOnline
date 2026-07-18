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
    .select(['verse_id', 'page', 'pageWidth', 'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH'])
    .where('version', '=', version)
    .where('verse_id', 'in', verseIds.map(String))
    .execute();
  const boxes: FaxBox[] = rows.map((r) => ({
    verseId: Number(r.verse_id), page: Number(r.page), pageWidth: Number(r.pageWidth),
    x: Number(r.X), y: Number(r.Y), w: Number(r.W), h: Number(r.H),
    tlw: Number(r.TLW), tlh: Number(r.TLH), brw: Number(r.BRW), brh: Number(r.BRH),
  }));
  return sanitizeBoxes(boxes);
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
