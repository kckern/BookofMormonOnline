/** searchhist domain resolvers — see docs/reference/backend-resolver-porting-guide.md */
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { searchQuery, historyQuery } from '../../data/loaders/searchhist.js';
import type { SearchResultRow, HistoryRow } from '../../data/loaders/searchhist.js';

/** getSlugTip: incoming slug args may be paths — take the last segment. */
function getSlugTip(slug: string): string {
  return slug.split('/').pop() ?? slug;
}

type DbAccessor = { _db: Parameters<typeof searchQuery>[0] };

export const searchhistResolvers: Resolvers = {
  Query: {
    search: async (_root, args, ctx: AppContext) => {
      const lang = ctx.lang ?? 'en';
      const query = args.query ?? '';
      const db = (ctx.loaders as unknown as DbAccessor)._db;
      return searchQuery(db, query, lang) as unknown as never[];
    },

    shortlink: async (_root, args, ctx: AppContext) => {
      const hashes = (args.hash ?? []).filter((h): h is string => h !== null && h !== undefined);
      if (!hashes.length) return null;
      const hash = hashes[0]!;
      const db = (ctx.loaders as unknown as DbAccessor)._db;
      const row = await db
        .selectFrom('bom_shortlinks')
        .select(['hash', 'string'])
        .where('hash', '=', hash)
        .limit(1)
        .execute();
      return (row[0] ?? null) as unknown as never;
    },

    history: async (_root, args, ctx: AppContext) => {
      const lang = ctx.lang ?? 'en';
      const db = (ctx.loaders as unknown as DbAccessor)._db;
      const slugs = (args.slug ?? [])
        .filter((s): s is string => s !== null && s !== undefined)
        .map(getSlugTip);
      return historyQuery(db, { ...args, slug: slugs }, lang) as unknown as never[];
    },
  },

  // Mutation.shortlink lives in useractivity.ts (the runWrite-based, sandbox-aware
  // find-or-create). This module owns only Query.shortlink (lookup by hash).

  SearchResult: {
    reference: (parent) => (parent as unknown as SearchResultRow).reference ?? null,
    text: (parent) => (parent as unknown as SearchResultRow).text ?? null,
    slug: (parent) => {
      const row = parent as unknown as SearchResultRow & { _slug?: string | null };
      return row._slug ?? null;
    },
    page: (parent) => (parent as unknown as SearchResultRow).page ?? null,
    section: (parent) => (parent as unknown as SearchResultRow).section ?? null,
    narration: (parent) => (parent as unknown as SearchResultRow).narration ?? null,
    speaker: (parent) => (parent as unknown as SearchResultRow).speaker ?? null,
    voice: (parent) => (parent as unknown as SearchResultRow).voice ?? null,
    lang: (parent) => (parent as unknown as SearchResultRow).lang ?? null,
  },

  HistoricalDocument: {
    id: (parent) => (parent as unknown as HistoryRow).id ?? null,
    slug: (parent) => (parent as unknown as HistoryRow).slug ?? null,
    seq: (parent) => (parent as unknown as HistoryRow).seq ?? null,
    year: (parent) => (parent as unknown as HistoryRow).year ?? null,
    date: (parent) => (parent as unknown as HistoryRow).date ?? null,
    link: (parent) => (parent as unknown as HistoryRow).link ?? null,
    type: (parent) => (parent as unknown as HistoryRow).type ?? null,
    source: (parent) => (parent as unknown as HistoryRow).source ?? null,
    author: (parent) => (parent as unknown as HistoryRow).author ?? null,
    document: (parent) => (parent as unknown as HistoryRow).document ?? null,
    pages: (parent) => (parent as unknown as HistoryRow).pages ?? null,
    citation: (parent) => (parent as unknown as HistoryRow).citation ?? null,
    teaser: (parent) => (parent as unknown as HistoryRow).teaser ?? null,
    transcript: (parent) => (parent as unknown as HistoryRow).transcript ?? null,
    aspect: (parent) => (parent as unknown as HistoryRow).aspect ?? null,
    archive: (parent) => (parent as unknown as HistoryRow).archive ?? null,
    principal: (parent) => (parent as unknown as HistoryRow).principal ?? null,
    event_year: (parent) => (parent as unknown as HistoryRow).event_year ?? null,
    event_date: (parent) => (parent as unknown as HistoryRow).event_date ?? null,
  },
};
