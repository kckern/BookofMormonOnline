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
