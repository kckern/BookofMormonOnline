/** scriptureread domain resolvers — see docs/reference/backend-resolver-porting-guide.md */
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import {
  fetchRead,
  fetchLookup,
  fetchVerseHighlights,
  type ReadLineRow,
} from '../../data/loaders/scriptureread.js';
import { SKIP_HEADING_TRANSLATION } from '../../data/loaders.js';
import { getBlocksToQueue, type QueueItemInput } from '../../data/loaders/queue.js';

/** Extract the db instance that scripturereadLoaders stashed in ctx.loaders. */
function getDb(ctx: AppContext): Kysely<DB> {
  return (ctx.loaders as unknown as { _scripturereadDb: Kysely<DB> })._scripturereadDb;
}

export const scripturereadResolvers: Resolvers = {
  Query: {
    read: async (_root, args, ctx: AppContext) => {
      const ref = args.ref;
      if (!ref) return null;
      const db = getDb(ctx);
      return fetchRead(db, ctx.lang, ref) as Promise<never>;
    },

    /**
     * queue(token, items) — Theater playback queue (legacy BomPage.ts:153).
     * getBlocksToQueue resolves an ordered [{slug, blocks}]; we then fetch the
     * bom_text rows for each and return them (in block order) as TextRow[]. The
     * core/media TextBlock field resolvers (content, narration, heading, slug,
     * people, places, duration…) resolve off each row.
     */
    queue: async (_root, args, ctx: AppContext) => {
      const db = getDb(ctx);
      const token = (args.token ?? null) as string | null;
      const items = (args.items ?? null) as QueueItemInput[] | null;
      const slugBlocks = await getBlocksToQueue(db, token, items);
      if (!slugBlocks.length) return [] as unknown as never;

      // Batch: resolve every page slug in ONE query and fetch every block in ONE
      // query, instead of two sequential queries per slug (the legacy loop was an
      // N+1 over the queue's pages). Rows are partitioned back per (page, link),
      // preserving the queue's slug + block order.
      const tipFor = (slug: string) => slug.split('/').pop() ?? slug;
      const tips = [...new Set(slugBlocks.map((sb) => tipFor(sb.slug)))];
      const pageRows = await db
        .selectFrom('bom_slug')
        .select(['slug', 'link'])
        .where('slug', 'in', tips)
        .where('type', '=', 'PG')
        .execute();
      const linkByTip = new Map(pageRows.map((p) => [p.slug, p.link]));

      const pages = [...new Set([...linkByTip.values()])];
      const allLinks = [...new Set(slugBlocks.flatMap((sb) => sb.blocks))];
      const textRows = pages.length && allLinks.length
        ? await db.selectFrom('bom_text').selectAll().where('page', 'in', pages).where('link', 'in', allLinks).execute()
        : [];
      const byPageLink = new Map(textRows.map((r) => [`${r.page}:${r.link}`, r]));

      const out: unknown[] = [];
      for (const { slug, blocks } of slugBlocks) {
        const pageLink = linkByTip.get(tipFor(slug));
        if (pageLink == null) continue;
        for (const b of blocks) {
          const row = byPageLink.get(`${pageLink}:${b}`);
          if (row) out.push(row);
        }
      }
      return out as unknown as never;
    },

    lookup: async (_root, args, ctx: AppContext) => {
      const refs = (args.ref ?? []).filter((r): r is string => r !== null);
      if (!refs.length) return [];
      const db = getDb(ctx);
      const results = await fetchLookup(db, ctx.lang, refs);

      // Legacy lookup did NOT include translation for the text's own heading
      // (only narration/section/page titles were translated). Tag rows so the
      // core TextBlock.heading resolver returns the raw heading.
      return results.map((row) => ({ ...row, [SKIP_HEADING_TRANSLATION]: true })) as unknown as never;
    },

    versehighlights: async (_root, args, ctx: AppContext) => {
      const rawPairs = args.verse_pairs;
      if (!rawPairs || !rawPairs.length) return [];

      // The SDL is [[Int]] — each element should be an array [bomId, bibleId].
      // Single-element unwrap via q() sends a flat [Int, Int] which doesn't
      // match [[Int]] at the GraphQL type level, so the engine strips it and
      // returns empty data. We only receive well-formed [[Int]] inputs here.
      const pairs: [number, number][] = rawPairs
        .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2)
        .map((p) => [p[0] as number, p[1] as number]);

      if (!pairs.length) return [];
      const db = getDb(ctx);
      return fetchVerseHighlights(db, pairs) as Promise<never>;
    },
  },

  // ─── ReadLine ─────────────────────────────────────────────────────────────
  // verse_num is a raw string from generateReference().split(':').pop().
  // Korean refs have no colon, so split(':').pop() returns the whole ref string,
  // which the GraphQL Int scalar rejects — matching the error messages in the
  // ko baselines. We return the raw value; the executor throws as expected.

  ReadLine: {
    verse_num: (parent) => {
      const line = parent as unknown as ReadLineRow;
      // Pass raw string; GraphQL Int coercion will crash for Korean non-integer strings.
      return line.verse_num as unknown as number;
    },
  },
};
