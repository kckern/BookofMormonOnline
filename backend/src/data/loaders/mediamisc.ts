/** mediamisc domain loaders — see docs/reference/backend-resolver-porting-guide.md */
import DataLoader from 'dataloader';
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders } from '../loaders.js';

// ─── row shapes ──────────────────────────────────────────────────────────────

export interface FaxRow {
  slug: string;
  hide: number;
  fax: number;
  weight: number;
  format: string;
  pages: number | null;
  pgoffset: number | null;
  pgfirstVerse: number | null;
  code: string | null;
  title: string | null;
  info: string | null;
  com: number | null;
  indexRef: string | null;
  bgcolor: string | null;
  lang: string;
  /** True when this row was fetched with fallback lang='en'; skip translation. */
  _noTranslation?: boolean;
}

export interface FaxIndexPageRow {
  version: string;
  page: number;
  first_verse_id: string;
  last_verse_id: string;
  verse_count: string | number;
}

export interface TimelineRow {
  id: string;
  date: string;
  slug: string | null;
  file: string;
  x: number;
  y: number;
  w: number;
  h: number;
  o: number;
  z: number;
  p: number;
  reference: string;
  narr: string;
  html: string;
  heading: string;
  // Tile-grid placement. Optional because the grid_* columns + this row shape
  // only exist after the bom_timeline grid migration is applied (and
  // codegen/db.d.ts regenerated). Pre-migration, selectAll() omits them and
  // these read as undefined — the Event.grid resolver treats that as "no grid".
  // Keeping them optional avoids hand-editing the generated codegen/db.d.ts.
  grid_row?: number | null;
  grid_col?: number | null;
  grid_w?: number | null;
  grid_h?: number | null;
  grid_kind?: string | null;
  grid_bg?: string | null;
}

export interface MarkdownRow {
  guid: string;
  slug: string;
  markdown: string;
}

export interface TextSlimRow {
  guid: string;
  page: string | null;
  link: number | null;
}

// ─── loaders ─────────────────────────────────────────────────────────────────

export function mediamiscLoaders(db: Kysely<DB>, lang: string, core: Loaders) {

  // ── fax all (filter-based) ────────────────────────────────────────────────
  /**
   * Legacy fetches fax rows filtered by lang + fax:1 (or com:0,hide:0 for pdf).
   * If the lang result is empty (non-en langs have no ko/etc fax rows), fall
   * back to lang='en'. Titles/info do NOT go through translation here because
   * the fallback switches lang='en' and the legacy includeTranslation also used
   * lang='en' in the fallback — titles come from the DB base columns directly.
   */
  const faxByFilter = new DataLoader<string, FaxRow[]>(async (filters) => {
    return Promise.all(
      filters.map(async (filter) => {
        const isPdf = filter === 'pdf';
        // Try request lang first
        let queryLang = lang;
        let rows = await fetchFaxRows(db, isPdf, queryLang);
        // Fallback to 'en' if no results for non-en lang.
        // Tag rows _noTranslation=true so field resolvers skip translation and
        // return the English base strings directly (mirrors legacy behaviour where
        // includeTranslation was also called with lang='en' in the fallback path).
        if (rows.length === 0 && queryLang !== 'en') {
          rows = await fetchFaxRows(db, isPdf, 'en');
          return rows.map((r) => ({ ...r, _noTranslation: true }));
        }
        return rows;
      }),
    );
  });

  // ── fax index pages (by version/slug) ────────────────────────────────────
  const faxIndexBySlug = new DataLoader<string, FaxIndexPageRow[]>(async (slugs) => {
    return Promise.all(
      slugs.map(async (slug) => {
        const rows = await db
          .selectFrom('bom_xtras_fax_index')
          .select(['version', 'page'])
          .select((eb) => [
            eb.fn.min('verse_id').as('first_verse_id'),
            eb.fn.max('verse_id').as('last_verse_id'),
            eb.fn.count('verse_id').distinct().as('verse_count'),
          ])
          .where('version', '=', slug)
          .groupBy(['version', 'page'])
          .orderBy('version', 'asc')
          .orderBy('page', 'asc')
          .execute();
        return rows as FaxIndexPageRow[];
      }),
    );
  });

  // ── timeline all rows (ordered by y, matching legacy ORDER BY ['y']) ──────
  const allTimeline = new DataLoader<string, TimelineRow[]>(async (keys) => {
    const rows = await db
      .selectFrom('bom_timeline')
      .selectAll()
      .orderBy('y', 'asc')
      .execute();
    return keys.map(() => rows as TimelineRow[]);
  });

  // ── text slim (for timeline reference → slug resolution) ────────────────
  // Maps a bom_text.guid → { guid, page, link }
  const textSlimByGuid = new DataLoader<string, TextSlimRow | null>(async (guids) => {
    const rows = await db
      .selectFrom('bom_text')
      .select(['guid', 'page', 'link'])
      .where('guid', 'in', [...guids])
      .execute();
    const byGuid = new Map(rows.map((r) => [r.guid, r as TextSlimRow]));
    return guids.map((g) => byGuid.get(g) ?? null);
  });

  // ── markdown by slug list (keyed by sorted slug list string) ───────────────
  // Returns rows for the given slugs in slug-list order, missing ones omitted.
  function markdownBySlugs(slugs: string[]): Promise<MarkdownRow[]> {
    if (!slugs.length) return Promise.resolve([]);
    return db
      .selectFrom('bom_markdown')
      .selectAll()
      .where('slug', 'in', slugs)
      .execute()
      .then((rows) => {
        const bySlug = new Map(rows.map((r) => [r.slug, r as MarkdownRow]));
        return slugs.map((s) => bySlug.get(s)).filter((r): r is MarkdownRow => r !== null);
      });
  }

  return {
    faxByFilter,
    faxIndexBySlug,
    allTimeline,
    textSlimByGuid,
    markdownBySlugs,
  };
}

// ── helper ───────────────────────────────────────────────────────────────────

async function fetchFaxRows(db: Kysely<DB>, isPdf: boolean, queryLang: string): Promise<FaxRow[]> {
  let q = db.selectFrom('bom_xtras_fax').selectAll().where('lang', '=', queryLang);
  if (isPdf) {
    q = q.where('com', '=', 0).where('hide', '=', 0);
  } else {
    q = q.where('fax', '=', 1);
  }
  q = q.orderBy('weight', 'asc');
  return q.execute() as Promise<FaxRow[]>;
}
