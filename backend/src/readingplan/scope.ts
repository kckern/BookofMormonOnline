// Scope → ordered WHOLE sections (spec D9). Canonical ranges snap outward to
// any section whose blocks overlap the range; pages resolve via bom_slug.
// Aggregates are computed over the whole section so refs/weights are honest.
import { sql, type Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { ScopeConfig, ScopedSection } from './types.js';

async function aggregateSections(
  db: Kysely<DB>,
  sectionGuids: string[],
  range?: { start: number; end: number },
): Promise<ScopedSection[]> {
  if (!sectionGuids.length) return [];
  let q = db
    .selectFrom('bom_text')
    .innerJoin('bom_lookup', 'bom_lookup.text_guid', 'bom_text.guid')
    .innerJoin('bom_section', (join) => join.onRef('bom_section.guid', '=', 'bom_text.section'))
    .select(({ fn }) => [
      'bom_section.guid as guid',
      'bom_section.parent as pageGuid',
      fn.count<number>('bom_text.guid').distinct().as('blocks'),
      fn.min<number>('bom_lookup.verse_id').as('minVerse'),
      fn.max<number>('bom_lookup.verse_id').as('maxVerse'),
    ])
    .where('bom_text.section', 'in', sectionGuids);
  if (range) {
    q = q.where(sql<boolean>`bom_lookup.verse_id BETWEEN ${range.start} AND ${range.end}`);
  }
  const rows = await q
    .groupBy(['bom_section.guid', 'bom_section.parent'])
    .orderBy(sql`MIN(bom_lookup.verse_id + 0)`, 'asc')
    .execute();
  return rows.map((r) => ({
    guid: String(r.guid),
    pageGuid: String(r.pageGuid ?? ''),
    blocks: Number(r.blocks),
    minVerse: Number(r.minVerse),
    maxVerse: Number(r.maxVerse),
  }));
}

export async function resolveScope(db: Kysely<DB>, scope: ScopeConfig): Promise<ScopedSection[]> {
  if (scope.type === 'sections') return aggregateSections(db, scope.guids);

  if (scope.type === 'range') {
    const rows = await db
      .selectFrom('bom_lookup')
      .innerJoin('bom_text', 'bom_text.guid', 'bom_lookup.text_guid')
      .select('bom_text.section')
      .distinct()
      .where(sql<boolean>`bom_lookup.verse_id BETWEEN ${scope.start} AND ${scope.end}`)
      .execute();
    return aggregateSections(
      db,
      rows.map((r) => r.section).filter((s): s is string => !!s),
      { start: scope.start, end: scope.end },
    );
  }

  // pages: slugs → page links → sections under those pages
  // .where('bom_slug.type', '=', 'PG') ensures page slugs only — bom_slug has both PG and SC rows
  if (!scope.slugs.length) return [];
  const rows = await db
    .selectFrom('bom_slug')
    .innerJoin('bom_section', 'bom_section.parent', 'bom_slug.link')
    .select('bom_section.guid')
    .where('bom_slug.slug', 'in', scope.slugs)
    .where('bom_slug.type', '=', 'PG')
    .execute();
  return aggregateSections(db, rows.map((r) => String(r.guid)));
}
