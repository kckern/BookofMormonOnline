/** media domain loaders — see docs/reference/backend-resolver-porting-guide.md */
import DataLoader from 'dataloader';
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders } from '../loaders.js';
import type { PageRow, SectionRow, NarrationRow, TextRow } from '../loaders.js';

// ─── row shapes ──────────────────────────────────────────────────────────────

export interface ImageRow {
  id: number;
  file: string;
  title: string;
  artist: string;
  link: string;
  width: number;
  height: number;
  location_guid: string | null;
}

export interface CommentaryRow {
  id: number;
  old_id: number | null;
  verse_id: number | null;
  verse_range: number;
  location_guid: string | null;
  source: string;
  is_note: number;
  title: string;
  /** Verified excerpt of the source verse this commentary annotates (nullable). */
  text_highlight: string | null;
  text: string;
  length: number;
}

export interface SourceRow {
  source_id: number;
  source_rating: string;
  source_title: string;
  source_name: string;
  source_short: string;
  source_slug: string;
  source_url: string;
  source_description: string | null;
  source_publisher: string | null;
  source_year: number | null;
  source_lang: string | null;
  excerpt: number | null;
  item_count: number | null;
}

function groupBy<T>(rows: readonly T[], key: (r: T) => string | number | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (k === null) continue;
    const list = map.get(String(k)) ?? [];
    list.push(r);
    map.set(String(k), list);
  }
  return map;
}

export function mediaLoaders(db: Kysely<DB>, lang: string, core: Loaders) {

  // ── image by id (batched) ────────────────────────────────────────────────
  const imageById = new DataLoader<number, ImageRow | null>(async (ids) => {
    const rows = await db
      .selectFrom('bom_xtras_image')
      .selectAll()
      .where('id', 'in', [...ids])
      .execute();
    const byId = new Map(rows.map((r) => [r.id, r as ImageRow]));
    return ids.map((id) => byId.get(id) ?? null);
  });

  // ── commentary by id (batched) ───────────────────────────────────────────
  const commentaryById = new DataLoader<number, CommentaryRow | null>(async (ids) => {
    const rows = await db
      .selectFrom('bom_xtras_commentary')
      .selectAll()
      .where('id', 'in', [...ids])
      .execute();
    const byId = new Map(rows.map((r) => [r.id, r as unknown as CommentaryRow]));
    return ids.map((id) => byId.get(id) ?? null);
  });

  // ── source by id (batched) ───────────────────────────────────────────────
  const sourceById = new DataLoader<number, SourceRow | null>(async (ids) => {
    const rows = await db
      .selectFrom('bom_xtras_source')
      .selectAll()
      .where('source_id', 'in', [...ids])
      .execute();
    const byId = new Map(rows.map((r) => [r.source_id, r as SourceRow]));
    return ids.map((id) => byId.get(id) ?? null);
  });

  // ── text (location) by guid (batched) ────────────────────────────────────
  // Also fetches 'section' (not in core TEXT_COLUMNS) for parent_section resolution.
  const textByGuid = new DataLoader<string, (TextRow & { section: string | null }) | null>(async (guids) => {
    const rows = await db
      .selectFrom('bom_text')
      .select(['guid', 'parent', 'page', 'link', 'heading', 'content', 'chrono', 'duration', 'section'])
      .where('guid', 'in', [...guids])
      .execute();
    const byGuid = new Map(rows.map((r) => [r.guid, r as TextRow & { section: string | null }]));
    return guids.map((g) => byGuid.get(g) ?? null);
  });

  // ── page by guid (reuses core pageByGuid) ────────────────────────────────
  // core.pageByGuid loads bom_page rows — just expose for use in resolvers

  // ── section by guid (batched) ────────────────────────────────────────────
  const sectionByGuid = new DataLoader<string, SectionRow | null>(async (guids) => {
    const rows = await db
      .selectFrom('bom_section')
      .select(['guid', 'parent', 'title'])
      .where('guid', 'in', [...guids])
      .execute();
    const byGuid = new Map(rows.map((r) => [r.guid, r as SectionRow]));
    return guids.map((g) => byGuid.get(g) ?? null);
  });

  // ── narration by guid (batched) ──────────────────────────────────────────
  // The bom_text.parent column holds the bom_narration.guid
  const narrationByGuid = new DataLoader<string, NarrationRow | null>(async (guids) => {
    const rows = await db
      .selectFrom('bom_narration')
      .select(['guid', 'parent', 'description'])
      .where('guid', 'in', [...guids])
      .execute();
    const byGuid = new Map(rows.map((r) => [r.guid, r as NarrationRow]));
    return guids.map((g) => byGuid.get(g) ?? null);
  });

  // ── publications by lang (batched by lang string) ──────────────────────────
  // Legacy: findAll({ where: queryWhere('source_lang', lang) })
  // source_lang is always a non-null string for supported langs.
  const publicationsByLang = new DataLoader<string, SourceRow[]>(async (langs) => {
    const rows = await db
      .selectFrom('bom_xtras_source')
      .selectAll()
      .where('source_lang', 'in', [...langs])
      .orderBy('source_id', 'asc')
      .execute();
    const grouped = groupBy(rows, (r) => r.source_lang ?? '');
    return langs.map((l) => (grouped.get(l) ?? []) as SourceRow[]);
  });

  return {
    imageById,
    commentaryById,
    sourceById,
    textByGuid,
    sectionByGuid,
    narrationByGuid,
    publicationsByLang,
  };
}
