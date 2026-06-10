/**
 * Contents (table-of-contents) aggregate: divisions → pages → sections.
 *
 * Replicates the legacy division resolver (src/resolvers/BomPage.ts:15-40) with
 * four batched queries instead of one five-way Sequelize join:
 *   1. divisions (slug-filtered through bom_slug, weight order) + titlepages
 *   2. pages (parent in division guids, weight order)
 *   3. sections (parent in page guids)
 *   4. bom_text aggregate (GROUP BY page, section ORDER BY min(link)) — yields
 *      BOTH the section reading order (the legacy ordering was a side-effect of
 *      its sectionText join) AND the per-section text counts.
 */
import { sql, type Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { Division, PageSummary, SectionSummary } from '../domain/contents.js';
import { SlugResolver } from './slugResolver.js';
import type { Translator } from './translator.js';

export class ContentsRepository {
  private readonly slugs: SlugResolver;

  constructor(
    private readonly db: Kysely<DB>,
    private readonly translator: Translator,
  ) {
    this.slugs = new SlugResolver(db);
  }

  /** Legacy getSlugTip: incoming slugs may be paths; the last segment matters. */
  private static slugTips(slugs: readonly string[]): string[] {
    return slugs.map((s) => s.split('/').pop() ?? s);
  }

  async divisions(slugArgs: readonly string[] | null): Promise<Division[]> {
    // Tiebreak on guid: legacy had no explicit secondary order, but its join
    // emitted equal-weight rows in guid order (verified against live legacy
    // output for the three weight ties in reign-of-judges).
    let divisionQuery = this.db
      .selectFrom('bom_division')
      .select(['guid', 'page', 'description', 'weight'])
      .orderBy('weight', 'asc')
      .orderBy('guid', 'asc');
    if (slugArgs && slugArgs.length) {
      const tips = ContentsRepository.slugTips(slugArgs);
      divisionQuery = divisionQuery.where('page', 'in', (eb) =>
        eb.selectFrom('bom_slug').select('link').where('slug', 'in', tips),
      );
    }
    const divisions = await divisionQuery.execute();
    if (!divisions.length) return [];

    const divisionGuids = divisions.map((d) => d.guid);
    const titlepageGuids = divisions.map((d) => d.page);

    const [titlepages, pages] = await Promise.all([
      this.db
        .selectFrom('bom_page')
        .select(['guid', 'title'])
        .where('guid', 'in', titlepageGuids)
        .execute(),
      this.db
        .selectFrom('bom_page')
        .select(['guid', 'parent', 'title', 'weight'])
        .where('parent', 'in', divisionGuids)
        .orderBy('weight', 'asc')
        .orderBy('guid', 'asc')
        .execute(),
    ]);

    const pageGuids = pages.map((p) => p.guid);
    const [sections, textAgg] = await Promise.all([
      pageGuids.length
        ? this.db
            .selectFrom('bom_section')
            .select(['guid', 'parent', 'title'])
            .where('parent', 'in', pageGuids)
            .execute()
        : Promise.resolve([]),
      pageGuids.length
        ? this.db
            .selectFrom('bom_text')
            .select(['page', 'section'])
            .select((eb) => eb.fn.countAll<number>().as('count'))
            .select((eb) => eb.fn.min('link').as('first_link'))
            .where('page', 'in', pageGuids)
            .groupBy(['page', 'section'])
            .orderBy(sql`min(link)`, 'asc')
            .execute()
        : Promise.resolve([]),
    ]);

    // Translations + slug paths, batched across the whole aggregate.
    const sectionGuids = sections.map((s) => s.guid);
    const [descriptionT, titleT, sectionTitleT, slugPaths] = await Promise.all([
      this.translator.forGuids(divisionGuids, 'description'),
      this.translator.forGuids([...titlepageGuids, ...pageGuids], 'title'),
      this.translator.forGuids(sectionGuids, 'title'),
      this.slugs.pathsForLinks([...titlepageGuids, ...pageGuids, ...sectionGuids]),
    ]);

    const titlepageByGuid = new Map(titlepages.map((t) => [t.guid, t]));
    const sectionsByGuid = new Map(sections.map((s) => [s.guid, s]));
    const sectionsByPage = new Map<string, typeof sections>();
    for (const s of sections) {
      const list = sectionsByPage.get(s.parent) ?? [];
      list.push(s);
      sectionsByPage.set(s.parent, list);
    }

    // Reading order + counts per page, from the single bom_text aggregate.
    const orderedSectionGuids = new Map<string, string[]>();
    const countsByPage = new Map<string, number[]>();
    for (const row of textAgg) {
      if (row.page === null) continue; // typed nullable; excluded by the WHERE page IN
      // bom_text.section is nullable: a NULL group still contributes a count
      // (legacy mapped every GROUP BY row) but can't order a section.
      if (row.section !== null) {
        const order = orderedSectionGuids.get(row.page) ?? [];
        order.push(row.section);
        orderedSectionGuids.set(row.page, order);
      }
      const counts = countsByPage.get(row.page) ?? [];
      counts.push(Number(row.count));
      countsByPage.set(row.page, counts);
    }

    const buildSection = (guid: string): SectionSummary | null => {
      const s = sectionsByGuid.get(guid);
      if (!s) return null;
      return {
        title: this.translator.pick(sectionTitleT, s.guid, s.title),
        slug: slugPaths.get(s.guid) ?? null,
      };
    };

    const buildPage = (page: (typeof pages)[number]): PageSummary => {
      const ordered = orderedSectionGuids.get(page.guid) ?? [];
      const orderedSet = new Set(ordered);
      // Sections without any text rows: the legacy LEFT JOIN sorted their NULL
      // link first, so they precede the text-ordered sections.
      const textless = (sectionsByPage.get(page.guid) ?? [])
        .filter((s) => !orderedSet.has(s.guid))
        .map((s) => s.guid);
      return {
        title: this.translator.pick(titleT, page.guid, page.title),
        slug: slugPaths.get(page.guid) ?? null,
        counts: countsByPage.get(page.guid) ?? [],
        sections: [...textless, ...ordered]
          .map(buildSection)
          .filter((s): s is SectionSummary => s !== null),
      };
    };

    return divisions.map((d) => {
      const titlepage = titlepageByGuid.get(d.page);
      return {
        title: titlepage ? this.translator.pick(titleT, titlepage.guid, titlepage.title) : null,
        slug: slugPaths.get(d.page) ?? null,
        description: this.translator.pick(descriptionT, d.guid, d.description),
        weight: d.weight,
        pages: pages.filter((p) => p.parent === d.guid).map(buildPage),
      };
    });
  }
}
