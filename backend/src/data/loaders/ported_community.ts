/**
 * ported_community loader — loadReadingPlanSegment.
 *
 * Faithful port of legacy src/resolvers/lib.ts loadReadingPlanSegment. Powers
 * the `readingplansegment(token, guid)` GraphQL query: a single reading-plan
 * segment expanded into its component sections + text blocks, each block scored
 * (completed / started / incomplete) against the user's bom_log block credit
 * since the plan start.
 *
 * The big completion query is ported verbatim from legacy via Kysely's `sql`
 * raw template (safer than rebuilding it in the query builder). Read-only
 * (sandbox-safe); never throws — returns null on the empty/error path.
 */
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import { SlugResolver } from '../slugResolver.js';

const COMPLETE_THRESHOLD = Number(process.env.PERCENT_TO_COUNT_AS_COMPLETE ?? 40);

interface SegmentMeta {
  guid: string | null;
  plan: string | null;
  period: string | null;
  ref: string | null;
  title: string | null;
  duedate: Date | string | null;
  start: number | null;
  end: number | null;
  plan_start: Date | string | null;
}

/** Row shape of the big completion query (legacy `sql`). */
interface TextBlockRow {
  guid: string;
  page: string;
  section: string;
  min_verse_id: number | null;
  heading: string | null;
  heading_lang: string | null;
  link: number | null;
  completion_status: number | null;
}

interface SectionTextItem {
  heading: string | null;
  slug: string;
  status: 'completed' | 'started' | 'incomplete';
}

interface SectionShape {
  guid: string;
  title: string | null;
  slug: string;
  sectionText: SectionTextItem[];
  // satisfy the Section GQL type's other (nullable) fields
  weight: number | null;
  parent: string | null;
  page: null;
  ref: string | null;
  badge: string | null;
  rows: null;
  ambient: string | null;
}

export interface ReadingPlanSegmentShape {
  guid: string;
  period: string | null;
  ref: string | null;
  url: string | null;
  title: string | null;
  duedate: string | null;
  progress: number;
  start: number | null;
  end: number | null;
  sections: SectionShape[];
}

/** Format a DB date as YYYY-MM-DD in local time (matches legacy moment()). */
function fmtDate(d: Date | string | null): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * loadReadingPlanSegment — assemble one ReadingPlanSegment, scored for `queryBy`.
 * Returns null when the guid is unknown or token/guid is missing (matches legacy,
 * which returns null on the no-segment path).
 */
export async function loadReadingPlanSegment(
  db: Kysely<DB>,
  guid: string | null | undefined,
  queryBy: string,
  lang: string | null,
): Promise<ReadingPlanSegmentShape | null> {
  if (!guid) return null;
  try {
    // 1. Segment + plan title + plan startdate.
    const segmentData = (await db
      .selectFrom('bom_readingplan_seg as s')
      .innerJoin('bom_readingplan as p', 'p.slug', 's.plan')
      .select([
        's.guid as guid',
        's.plan as plan',
        's.period as period',
        's.ref as ref',
        'p.title as title',
        's.duedate as duedate',
        's.start as start',
        's.end as end',
        'p.startdate as plan_start',
      ])
      .where('s.guid', '=', guid)
      .executeTakeFirst()) as SegmentMeta | undefined;
    if (!segmentData) return null;

    const { plan_start, duedate, start, end } = segmentData;
    const planStartTimestamp = plan_start
      ? Math.floor((plan_start instanceof Date ? plan_start : new Date(plan_start)).getTime() / 1000)
      : 0;

    // Use the requested lang only for translation overrides (legacy passed lang
    // straight into bom_translation joins; en/null/dev have no rows so they no-op).
    const useLang = lang ?? null;

    // 2. The big per-block completion query — ported verbatim via raw SQL.
    //    threshold / plan-start interpolated as numbers (legacy did the same).
    const threshold = COMPLETE_THRESHOLD;
    const textRows = (
      await sql<TextBlockRow>`
        SELECT bom_text.guid, bom_text.page, bom_text.section, bom_text.min_verse_id, bom_text.heading,
        bom_translation.value AS heading_lang, bom_text.link,
        (CASE
            WHEN bom_log.credit < ${sql.lit(threshold)} THEN 0
            WHEN bom_log.credit >= ${sql.lit(threshold)} THEN 1
            ELSE NULL END) AS completion_status,
        bom_log.credit AS credit
        FROM bom_text
        LEFT JOIN (
            SELECT value as guid, MAX(credit) as credit FROM bom_log
            WHERE type = "block" AND user = ${queryBy} AND timestamp > ${sql.lit(planStartTimestamp || 0)}
            GROUP BY guid
            ) bom_log ON bom_text.guid = bom_log.guid
            LEFT JOIN bom_translation ON bom_text.guid = bom_translation.guid
                AND bom_translation.lang = ${useLang} AND bom_translation.refkey = "heading"
        WHERE bom_text.section IN (
            SELECT DISTINCT bom_text.section FROM bom_readingplan_seg AS segment
            LEFT JOIN bom_lookup ON bom_lookup.verse_id BETWEEN segment.start AND segment.end
            LEFT JOIN bom_text ON bom_text.guid = bom_lookup.text_guid
            WHERE segment.guid = ${guid} )
        ORDER BY bom_text.min_verse_id ASC
      `.execute(db)
    ).rows as unknown as TextBlockRow[];

    const uniqueSectionGuids = Array.from(new Set(textRows.map((b) => b.section).filter((s): s is string => !!s)));
    const pageGuids = Array.from(new Set(textRows.map((b) => b.page).filter((p): p is string => !!p)));

    // 3. Resolve page slugs (legacy getSlug('link', pageGuid)) — batched.
    const slugResolver = new SlugResolver(db);
    const pageSlugMap = await slugResolver.pathsForLinks(pageGuids);

    // 4. Section rows (bom_section) — parent is the page guid.
    const sectionRows = uniqueSectionGuids.length
      ? await db
          .selectFrom('bom_section')
          .select(['guid', 'title', 'parent', 'weight', 'ref', 'badge', 'ambient'])
          .where('guid', 'in', uniqueSectionGuids)
          .execute()
      : [];
    const sectionByGuid = new Map(sectionRows.map((s) => [s.guid, s]));

    // Section slugs: the section's own bom_slug.slug (by link = section guid),
    // not the full ancestor path — legacy's BomSection.sectionSlug association is
    // bom_section.guid = bom_slug.link with no type filter.
    const sectionOwnSlug = uniqueSectionGuids.length
      ? await db
          .selectFrom('bom_slug')
          .select(['link', 'slug'])
          .where('link', 'in', uniqueSectionGuids)
          .execute()
      : [];
    const sectionSlugByGuid = new Map<string, string>();
    for (const r of sectionOwnSlug) if (!sectionSlugByGuid.has(r.link)) sectionSlugByGuid.set(r.link, r.slug);

    // 5. Section title translations (lang).
    const sectionTranslations = useLang && uniqueSectionGuids.length
      ? await db
          .selectFrom('bom_translation')
          .select(['guid', 'value'])
          .where('guid', 'in', uniqueSectionGuids)
          .where('refkey', '=', 'title')
          .where('lang', '=', useLang)
          .execute()
      : [];
    const sectionTitleByGuid = new Map(sectionTranslations.map((t) => [t.guid, t.value]));

    // 6. Assemble sections in min_verse_id order (uniqueSectionGuids already is).
    const sections: SectionShape[] = uniqueSectionGuids.map((g) => {
      const sec = sectionByGuid.get(g);
      const pageGuid = sec?.parent ?? null;
      const pageSlug = (pageGuid && pageSlugMap.get(pageGuid)) || null;
      const ownSlug = sectionSlugByGuid.get(g) ?? null;
      const sectionText: SectionTextItem[] = textRows
        .filter((b) => b.section === g)
        .map((b) => ({
          heading: b.heading_lang || b.heading,
          slug: `${pageSlug ?? ''}/${b.link ?? ''}`,
          status:
            b.completion_status === 1 ? 'completed' : b.completion_status === 0 ? 'started' : 'incomplete',
        }));
      return {
        guid: g,
        title: sectionTitleByGuid.get(g) ?? sec?.title ?? null,
        slug: `${pageSlug ?? ''}/${ownSlug ?? ''}`,
        sectionText,
        weight: sec?.weight ?? null,
        parent: pageGuid,
        page: null,
        ref: sec?.ref ?? null,
        badge: sec?.badge ?? null,
        rows: null,
        ambient: sec?.ambient ?? null,
      };
    });

    // 7. Progress: completed-items / total-items across all sections.
    const countOfSectionItems = sections.reduce((a, b) => a + b.sectionText.length, 0);
    const countOfSectionItemsCompleted = sections.reduce(
      (a, b) => a + b.sectionText.filter((i) => i.status === 'completed').length,
      0,
    );
    const progress = countOfSectionItems
      ? Math.round((countOfSectionItemsCompleted / countOfSectionItems) * 10000) / 100
      : 0;

    // 8. Segment-level translations (title/ref/period).
    const segmentTranslations = useLang
      ? await db
          .selectFrom('bom_translation')
          .select(['refkey', 'value'])
          .where('guid', '=', guid)
          .where('refkey', 'in', ['title', 'ref', 'period'])
          .where('lang', '=', useLang)
          .execute()
      : [];
    const segTr = (refkey: string): string | null =>
      segmentTranslations.find((t) => t.refkey === refkey)?.value ?? null;

    return {
      guid,
      period: segTr('period') ?? segmentData.period,
      ref: segTr('ref') ?? segmentData.ref,
      url: null,
      title: segTr('title') ?? segmentData.title,
      duedate: fmtDate(duedate),
      progress,
      start,
      end,
      sections,
    };
  } catch (error) {
    console.error('loadReadingPlanSegment error:', error);
    return null;
  }
}
