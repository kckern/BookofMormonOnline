/** searchhist domain loaders — see docs/reference/backend-resolver-porting-guide.md */
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders } from '../loaders.js';
import { generateReference } from 'scripture-guide';
import { searchContent } from '../../search/retrieve.js';
import { hitsToRankedVerseIds } from '../../search/points.js';

export interface SearchResultRow {
  reference: string | null;
  text: string;
  pageguid: string | null;
  link: number | null;
  page: string | null;
  section: string | null;
  narration: string | null;
  speaker: string | null;
  voice: string | null;
  lang: string | null;
  /** verse_id as string (bom_lookup.verse_id is a STRING column) */
  verse_id: string;
}

export interface HistoryRow {
  id: number | null;
  slug: string;
  seq: number;
  year: number | null;
  date: string | null;
  link: string | null;
  type: string | null;
  source: string | null;
  author: string | null;
  document: string | null;
  pages: number | null;
  citation: string | null;
  teaser: string | null;
  transcript: string | null;
  aspect: number | null;
  archive: string | null;
  principal: string | null;
  event_year: number | null;
  event_date: string | null;
  money_quote: string | null;
  quote_is_witness_voice: boolean | null;
  quote_speaker: string | null;
  quote_contains_witness_speech: boolean | null;
  witness_label: string | null;
  reporter_label: string | null;
}

/**
 * Collapse lookup rows so each verse appears once.
 *
 * A single verse can be mapped into multiple study segments (multiple bom_lookup
 * rows -> multiple text_link values). We keep the row with the LOWEST text_link
 * (the "first" study link). A null text_link sorts last, so a real link always
 * wins over a null one; a lone null-link row is still kept.
 *
 * First-appearance order of verses is preserved (today this is scriptural order).
 */
export function dedupeByVerseKeepFirstLink<
  T extends { verse_id: string; text_link: number | null },
>(rows: T[]): T[] {
  const byVerse = new Map<string, T>();
  const order: string[] = [];
  for (const row of rows) {
    const existing = byVerse.get(row.verse_id);
    if (!existing) {
      byVerse.set(row.verse_id, row);
      order.push(row.verse_id);
      continue;
    }
    const existingLink = existing.text_link ?? Number.POSITIVE_INFINITY;
    const candidateLink = row.text_link ?? Number.POSITIVE_INFINITY;
    if (candidateLink < existingLink) byVerse.set(row.verse_id, row);
  }
  return order.map((verseId) => byVerse.get(verseId)!);
}

/** Stable reorder of hydrated rows to follow a ranked verse_id list; unranked rows keep original order, last. */
export function rankRowsByCandidateOrder<T extends { verse_id: string }>(rows: T[], order: string[]): T[] {
  if (!order.length) return rows;
  const rank = new Map(order.map((id, i) => [id, i]));
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const ra = rank.get(a.row.verse_id) ?? Number.POSITIVE_INFINITY;
      const rb = rank.get(b.row.verse_id) ?? Number.POSITIVE_INFINITY;
      return ra === rb ? a.i - b.i : ra - rb;
    })
    .map(({ row }) => row);
}

/** The legacy LIKE candidate generation, extracted verbatim. */
export async function getCandidateVerseIds(
  db: Kysely<DB>,
  query: string,
  lang: string,
  isEnglish: boolean,
): Promise<string[]> {
  if (isEnglish) {
    const rows = await db
      .selectFrom('lds_scriptures_verses')
      .select('verse_id')
      .where('verse_scripture', 'like', `%${query}%`)
      .where('verse_id', '>=', 31103)
      .where('verse_id', '<=', 37706)
      .execute();
    return rows.map((r) => String(r.verse_id));
  }
  const rows = await db
    .selectFrom('lds_scriptures_translations')
    .select('verse_id')
    .where('text', 'like', `%${query}%`)
    .where('lang', '=', lang)
    .execute();
  return rows.map((r) => String(r.verse_id));
}

/**
 * Resolve candidate verse_ids, keyword-first. Tier 1: literal LIKE. Tier 2 (only when Tier 1
 * is empty): semantic Qdrant vector search. `semantic` is true only when the vector tier
 * produced the result (downstream then applies relevance ordering). Never throws.
 */
export async function resolveCandidates(
  db: Kysely<DB>,
  query: string,
  lang: string,
  isEnglish: boolean,
  deps: {
    keyword?: (q: string) => Promise<string[]>;
    semantic?: (q: string) => Promise<string[]>;
  } = {},
): Promise<{ ids: string[]; semantic: boolean }> {
  const keyword = deps.keyword ?? ((q: string) => getCandidateVerseIds(db, q, lang, isEnglish));
  const semantic =
    deps.semantic ??
    (async (q: string) => {
      const searchLang = isEnglish ? 'en' : lang;
      const hits = await searchContent({ query: q, types: ['verse'], lang: searchLang });
      return hitsToRankedVerseIds(hits);
    });

  const keywordIds = await keyword(query);
  if (keywordIds.length) return { ids: keywordIds, semantic: false };

  try {
    const ids = await semantic(query);
    if (ids.length) return { ids, semantic: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[search] semantic fallback failed:', err instanceof Error ? err.message : err);
  }
  return { ids: [], semantic: false };
}

/**
 * Run the search query and return raw result rows.
 * Shape tier: structure must match, values may churn.
 *
 * English: LIKE on lds_scriptures_verses.verse_scripture
 * Korean (non-English): LIKE on lds_scriptures_translations.text WHERE lang=?
 *
 * Min length: 1 for Korean, 3 for English (legacy exact rule).
 */
export async function searchQuery(
  db: Kysely<DB>,
  query: string,
  lang: string,
): Promise<{ verses: SearchResultRow[]; semantic: boolean }> {
  const isEnglish = !lang || lang === 'en' || lang === 'eng' || lang === 'dev';
  const isKorean = lang === 'ko';
  const minLen = isKorean ? 1 : 3;

  if (!query || query.length < minLen) return { verses: [], semantic: false };

  const { ids: verseIds, semantic } = await resolveCandidates(db, query, lang, isEnglish);

  if (!verseIds.length) return { verses: [], semantic };

  // Fetch bom_lookup rows + joined text data
  const lookupRows = await db
    .selectFrom('bom_lookup as l')
    .innerJoin('bom_text as t', 't.guid', 'l.text_guid')
    .select([
      'l.verse_id',
      't.guid as text_guid',
      't.link as text_link',
      't.page as text_page',
      't.section as text_section',
      't.parent as text_parent',
    ])
    .where('l.verse_id', 'in', verseIds)
    .execute();

  if (!lookupRows.length) return { verses: [], semantic };

  // One result per verse: keep the lowest-link study segment (see helper doc).
  const dedupedRows = dedupeByVerseKeepFirstLink(lookupRows);

  // Collect unique guids for batch translation
  const pageGuids = [...new Set(dedupedRows.map((r) => r.text_page).filter((g): g is string => !!g))];
  const sectionGuids = [...new Set(dedupedRows.map((r) => r.text_section).filter((g): g is string => !!g))];
  const narrationGuids = [...new Set(dedupedRows.map((r) => r.text_parent).filter((g): g is string => !!g))];

  // Batch-fetch all page, section, narration data
  const [pageRows, sectionRows, narrationRows, verseTextRows, translationVerseRows, speakerRows] =
    await Promise.all([
      pageGuids.length
        ? db.selectFrom('bom_page').select(['guid', 'title']).where('guid', 'in', pageGuids).execute()
        : [],
      sectionGuids.length
        ? db.selectFrom('bom_section').select(['guid', 'title']).where('guid', 'in', sectionGuids).execute()
        : [],
      narrationGuids.length
        ? db.selectFrom('bom_narration').select(['guid', 'description']).where('guid', 'in', narrationGuids).execute()
        : [],
      // English: fetch verse text from lds_scriptures_verses
      isEnglish && verseIds.length
        ? db
            .selectFrom('lds_scriptures_verses')
            .select(['verse_id', 'verse_scripture'])
            .where('verse_id', 'in', verseIds.map(Number))
            .execute()
        : [],
      // Non-English: fetch verse text from lds_scriptures_translations
      !isEnglish && verseIds.length
        ? db
            .selectFrom('lds_scriptures_translations')
            .select(['verse_id', 'text'])
            .where('verse_id', 'in', verseIds.map(Number))
            .where('lang', '=', lang)
            .execute()
        : [],
      // Speaker/voice from lds_scriptures_lines
      verseIds.length
        ? db
            .selectFrom('lds_scriptures_lines')
            .select(['verse_id', 'person_slug', 'voice'])
            .where('verse_id', 'in', verseIds.map(Number))
            .execute()
        : [],
    ]);

  // Build lookup maps
  const pageByGuid = new Map(pageRows.map((r) => [r.guid, r.title]));
  const sectionByGuid = new Map(sectionRows.map((r) => [r.guid, r.title]));
  const narrationByGuid = new Map(narrationRows.map((r) => [r.guid, r.description]));
  const verseTextById = isEnglish
    ? new Map((verseTextRows as { verse_id: number; verse_scripture: string }[]).map((r) => [String(r.verse_id), r.verse_scripture]))
    : new Map((translationVerseRows as { verse_id: number; text: string }[]).map((r) => [String(r.verse_id), r.text]));
  const speakerByVid = new Map(
    speakerRows.map((r) => [String(r.verse_id), { person_slug: r.person_slug, voice: r.voice }]),
  );

  // For non-English: translate page titles, section titles, narration descriptions
  let pageTitleMap = new Map<string, string>();
  let sectionTitleMap = new Map<string, string>();
  let narrationDescMap = new Map<string, string>();

  if (!isEnglish && pageGuids.length) {
    const rows = await db
      .selectFrom('bom_translation')
      .select(['guid', 'value'])
      .where('lang', '=', lang)
      .where('refkey', '=', 'title')
      .where('guid', 'in', pageGuids)
      .execute();
    pageTitleMap = new Map(rows.map((r) => [r.guid, String(r.value)]));
  }
  if (!isEnglish && sectionGuids.length) {
    const rows = await db
      .selectFrom('bom_translation')
      .select(['guid', 'value'])
      .where('lang', '=', lang)
      .where('refkey', '=', 'title')
      .where('guid', 'in', sectionGuids)
      .execute();
    sectionTitleMap = new Map(rows.map((r) => [r.guid, String(r.value)]));
  }
  if (!isEnglish && narrationGuids.length) {
    const rows = await db
      .selectFrom('bom_translation')
      .select(['guid', 'value'])
      .where('lang', '=', lang)
      .where('refkey', '=', 'description')
      .where('guid', 'in', narrationGuids)
      .execute();
    narrationDescMap = new Map(rows.map((r) => [r.guid, String(r.value)]));
  }

  // Build slug paths for page guids
  // We load these via slug resolution inline (no DataLoader here since this is a top-level query)
  const slugPathMap = new Map<string, string>();
  if (pageGuids.length) {
    const slugRows = await db
      .selectFrom('bom_slug as s')
      .select(['s.guid', 's.slug', 's.parent', 's.link'])
      .where('s.link', 'in', pageGuids)
      .execute();

    // Build ancestor paths (up to depth 10)
    const byGuid = new Map(slugRows.map((r) => [r.guid, r]));
    let parents = [...new Set(slugRows.map((r) => r.parent).filter((p) => p && !byGuid.has(p)))];
    for (let depth = 0; parents.length && depth < 10; depth++) {
      const ancestorRows = await db
        .selectFrom('bom_slug')
        .select(['guid', 'slug', 'parent', 'link'])
        .where('guid', 'in', parents)
        .execute();
      for (const r of ancestorRows) byGuid.set(r.guid, r);
      parents = [...new Set(ancestorRows.map((r) => r.parent).filter((p) => p && !byGuid.has(p)))];
    }

    const firstByLink = new Map<string, typeof slugRows[0]>();
    for (const r of slugRows) if (!firstByLink.has(r.link)) firstByLink.set(r.link, r);

    for (const pageGuid of pageGuids) {
      const startRow = firstByLink.get(pageGuid);
      if (!startRow) continue;
      const segments = [startRow.slug];
      let cursor = startRow.parent ? byGuid.get(startRow.parent) : undefined;
      for (let depth = 0; cursor && depth < 10; depth++) {
        segments.unshift(cursor.slug);
        cursor = cursor.parent ? byGuid.get(cursor.parent) : undefined;
      }
      slugPathMap.set(pageGuid, segments.join('/'));
    }
  }

  // Assemble results
  const displayLang = (isEnglish ? 'en' : lang) as Parameters<typeof generateReference>[1];

  const results = dedupedRows.map((row) => {
    const verseId = row.verse_id;
    const pageGuid = row.text_page ?? null;
    const sectionGuid = row.text_section ?? null;
    const narrationGuid = row.text_parent ?? null;
    const pageTitle = pageGuid
      ? (pageTitleMap.get(pageGuid) ?? pageByGuid.get(pageGuid) ?? null)
      : null;
    const sectionTitle = sectionGuid
      ? (sectionTitleMap.get(sectionGuid) ?? sectionByGuid.get(sectionGuid) ?? null)
      : null;
    const narrationDesc = narrationGuid
      ? (narrationDescMap.get(narrationGuid) ?? narrationByGuid.get(narrationGuid) ?? null)
      : null;

    const verseIdNum = Number(verseId);
    const reference = generateReference(verseIdNum, displayLang);
    const speaker = speakerByVid.get(verseId);
    const text = verseTextById.get(verseId) ?? null;
    const pagePath = pageGuid ? (slugPathMap.get(pageGuid) ?? null) : null;
    const slug = pagePath !== null && row.text_link !== null ? `${pagePath}/${row.text_link}` : null;

    return {
      reference,
      text: text ?? '',
      pageguid: pageGuid,
      link: row.text_link,
      page: pageTitle,
      section: sectionTitle,
      narration: narrationDesc,
      speaker: speaker?.person_slug ?? null,
      voice: speaker?.voice ?? null,
      lang: `lang: ${lang} • isEnglish: ${isEnglish} • isKorean: ${isKorean}`,
      verse_id: verseId,
      _slug: slug,
    } as unknown as SearchResultRow;
  });
  return { verses: semantic ? rankRowsByCandidateOrder(results, verseIds) : results, semantic };
}

/**
 * Fetch history documents.
 * Translation key is `id` (sourceKey='id' in legacy Sequelize config).
 * Translated fields: source, author, document, citation, teaser, transcript.
 * Order by seq ASC.
 */
export async function historyQuery(
  db: Kysely<DB>,
  args: { slug?: (string | null)[] | null; archive?: string | null; principal?: (string | null)[] | null },
  lang: string,
): Promise<HistoryRow[]> {
  // Order by `date` to match the legacy /history page (MySQL filesort: NULL
  // dates first in physical/PK order, then date ASC). This is the order the
  // SSR parity benchmark renders the full collection in.
  let query = db
    .selectFrom('bom_xtras_history')
    .selectAll()
    .orderBy('date', 'asc');

  const slugs = (args.slug ?? []).filter((s): s is string => s !== null && s !== undefined);
  const principals = (args.principal ?? []).filter((p): p is string => p !== null && p !== undefined);

  if (slugs.length === 1) {
    query = query.where('slug', '=', slugs[0]!);
  } else if (slugs.length > 1) {
    query = query.where('slug', 'in', slugs);
  }

  if (args.archive) {
    query = query.where('archive', '=', args.archive);
  }

  if (principals.length) {
    query = query.where('principal', 'in', principals);
  }

  const rows = await query.execute();
  if (!rows.length) return [];

  // Translations use id (number) as the key in bom_translation.guid
  const isEnglish = !lang || lang === 'en' || lang === 'eng' || lang === 'dev';
  const idStrings = rows.map((r) => String(r.id)).filter((id) => id !== 'null');

  // Translation maps by refkey
  const translatable = ['source', 'author', 'document', 'citation', 'teaser', 'transcript'];
  const transMaps = new Map<string, Map<string, string>>();

  if (!isEnglish && idStrings.length) {
    const transRows = await db
      .selectFrom('bom_translation')
      .select(['guid', 'refkey', 'value'])
      .where('lang', '=', lang)
      .where('refkey', 'in', translatable)
      .where('guid', 'in', idStrings)
      .execute();

    for (const row of transRows) {
      let map = transMaps.get(row.refkey);
      if (!map) {
        map = new Map();
        transMaps.set(row.refkey, map);
      }
      map.set(row.guid, String(row.value));
    }
  }

  return rows.map((r) => {
    const idStr = String(r.id);
    const t = (refkey: string, base: string | null): string | null => {
      if (isEnglish) return base;
      return transMaps.get(refkey)?.get(idStr) ?? base;
    };

    const meta =
      r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : null;
    const metaString = (key: string): string | null => {
      const v = meta?.[key];
      return typeof v === 'string' ? v : null;
    };
    const metaBool = (key: string): boolean | null => {
      const v = meta?.[key];
      return typeof v === 'boolean' ? v : null;
    };

    return {
      id: r.id,
      slug: r.slug,
      seq: r.seq,
      year: r.year,
      date: r.date,
      link: r.link,
      type: r.type,
      source: t('source', r.source),
      author: t('author', r.author),
      document: t('document', r.document),
      pages: r.pages,
      citation: t('citation', r.citation),
      teaser: t('teaser', r.teaser),
      transcript: t('transcript', r.transcript),
      aspect: r.aspect,
      archive: r.archive,
      principal: r.principal,
      event_year: r.event_year,
      event_date: r.event_date,
      money_quote: metaString('money_quote'),
      quote_is_witness_voice: metaBool('quote_is_witness_voice'),
      quote_speaker: metaString('quote_speaker'),
      quote_contains_witness_speech: metaBool('quote_contains_witness_speech'),
      witness_label: metaString('witness_label'),
      reporter_label: metaString('reporter_label'),
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function searchhistLoaders(db: Kysely<DB>, lang: string, core: Loaders) {
  // Expose db so resolvers can call searchQuery/historyQuery directly
  return { _db: db };
}
