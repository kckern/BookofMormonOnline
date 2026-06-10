/** feedsmisc domain loaders — see docs/reference/backend-resolver-porting-guide.md */
import DataLoader from 'dataloader';
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders, TextRow, SectionRow } from '../loaders.js';

/** A text row that also carries the `section` column (needed for parent_section resolution). */
export type TextRowWithSection = TextRow & { section: string | null };

/**
 * Key for loading a text block: the full slug path (e.g. "jaredites/1").
 * We parse out the page slug tip and link number at load time.
 */
export type TextSlugKey = string;

function groupBy<T>(rows: readonly T[], key: (r: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (k === null) continue;
    const list = map.get(k) ?? [];
    list.push(r);
    map.set(k, list);
  }
  return map;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function feedsmiscLoaders(db: Kysely<DB>, lang: string, core: Loaders) {
  /**
   * Load a TextBlock by its slug path "pageSlug/linkNum" (e.g. "jaredites/1").
   *
   * Legacy `Query.text` (BomPage.ts:102-150):
   *  - parses link numbers from slug path: s.match(/\d+$/).pop()
   *  - parses slug tip: s.replace(/\/\d+$/, '').split('/').pop()
   *  - dedupes link numbers
   *  - finds bom_text WHERE link IN (linkNums) JOIN bom_slug WHERE slug IN (slugTips)
   *  - re-maps results back to original arg order by slug+link key
   */
  const textBySlugPath = new DataLoader<TextSlugKey, TextRowWithSection | null>(async (keys) => {
    // Parse each key into {slugTip, linkNum, original}
    const parsed = (keys as string[]).map((k) => {
      const lastSlash = k.lastIndexOf('/');
      const linkNum = lastSlash >= 0 ? parseInt(k.slice(lastSlash + 1), 10) : NaN;
      const slugPart = lastSlash >= 0 ? k.slice(0, lastSlash) : k;
      const slugTip = slugPart.split('/').pop() ?? slugPart;
      return { key: k, slugTip, linkNum };
    });

    const slugTips = [...new Set(parsed.map((p) => p.slugTip))];
    const linkNums = [...new Set(parsed.map((p) => p.linkNum).filter((n) => !isNaN(n)))];

    if (!slugTips.length || !linkNums.length) {
      return keys.map(() => null);
    }

    // Find page guids by slug tip
    const slugRows = await db
      .selectFrom('bom_slug')
      .select(['slug', 'link'])
      .where('slug', 'in', slugTips)
      .execute();

    // Map slug tip → page guid (the bom_slug.link column = entity guid)
    const pageGuidBySlugTip = new Map(slugRows.map((r) => [r.slug, r.link]));
    const pageGuids = [...new Set(slugRows.map((r) => r.link))];

    if (!pageGuids.length) return keys.map(() => null);

    // Fetch bom_text rows with page + link constraints (includes 'section' for parent_section)
    const textRows = await db
      .selectFrom('bom_text')
      .select(['guid', 'parent', 'page', 'link', 'heading', 'content', 'chrono', 'duration', 'section'])
      .where('page', 'in', pageGuids)
      .where('link', 'in', linkNums)
      .execute();

    // Build result map: "slugTip/linkNum" → TextRowWithSection
    const resultMap = new Map<string, TextRowWithSection>();
    for (const row of textRows) {
      if (row.page === null || row.link === null) continue;
      // Find slug tip for this page guid
      for (const [slugTip, pageGuid] of pageGuidBySlugTip) {
        if (pageGuid === row.page) {
          const mapKey = `${slugTip}/${row.link}`;
          resultMap.set(mapKey, row as TextRowWithSection);
        }
      }
    }

    // Map each original key back to its result
    return parsed.map(({ key, slugTip, linkNum }) => {
      if (isNaN(linkNum)) return null;
      return resultMap.get(`${slugTip}/${linkNum}`) ?? null;
    });
  });

  /**
   * Load a Section by its slug path "parentSlug/sectionSlug" or just "sectionSlug".
   * Uses the slug tip (last segment) to look up bom_slug WHERE type='SC'.
   * Returns the bom_section row.
   */
  const sectionBySlugPath = new DataLoader<string, SectionRow | null>(async (keys) => {
    // Extract slug tips (last path segment)
    const slugTips = (keys as string[]).map((k) => k.split('/').pop() ?? k);
    const uniqueTips = [...new Set(slugTips)];

    const slugRows = await db
      .selectFrom('bom_slug')
      .select(['slug', 'link'])
      .where('slug', 'in', uniqueTips)
      .where('type', '=', 'SC')
      .execute();

    const guidBySlugTip = new Map(slugRows.map((r) => [r.slug, r.link]));
    const sectionGuids = [...new Set(slugRows.map((r) => r.link))];

    if (!sectionGuids.length) return keys.map(() => null);

    const sectionRows = await db
      .selectFrom('bom_section')
      .select(['guid', 'parent', 'title'])
      .where('guid', 'in', sectionGuids)
      .execute();

    const sectionByGuid = new Map(sectionRows.map((r) => [r.guid, r as SectionRow]));

    return slugTips.map((tip) => {
      const guid = guidBySlugTip.get(tip);
      if (!guid) return null;
      return sectionByGuid.get(guid) ?? null;
    });
  });

  return {
    textBySlugPath,
    sectionBySlugPath,
  };
}
