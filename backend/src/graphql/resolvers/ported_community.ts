/**
 * ported_community resolvers — the three BomCommunity Query fields that were
 * declared in schema/BomCommunity.graphql but had NO resolver (so they silently
 * returned null).
 *
 *   moregroups(token, grouping)      → [] (legacy STUB — pagination placeholder)
 *   postcomments(token, message)     → [] (legacy STUB)
 *   readingplansegment(token, guid)  → ReadingPlanSegment (REAL port of legacy
 *                                       loadReadingPlanSegment)
 *
 * Registered separately from community.ts (do NOT edit existing files). Read-only
 * (sandbox-safe); resolvers never throw.
 */
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { loadReadingPlanSegment } from '../../data/loaders/ported_community.js';
import { resolveUsername as resolveUsernameByToken } from '../../auth/sessionStore.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asGql = <T>(v: T): any => v;

/**
 * Resolve a token to the bom_user.user it belongs to (the raw username used to
 * score bom_log credit). Falls back to the token itself for anon users, who log
 * progress under their token — matches legacy readingplan queryBy
 * (queryBy = user?.user || token).
 */
async function resolveUsername(ctx: AppContext, token: string | null | undefined): Promise<string> {
  if (!token) return '';
  const username = await resolveUsernameByToken(ctx.db, token);
  return username ?? token;
}

export const portedCommunityResolvers: Resolvers = {
  Query: {
    /**
     * moregroups — legacy BomCommunity.ts returns [] (pagination placeholder,
     * never implemented). Match legacy.
     */
    moregroups: async () => asGql([]),

    /**
     * postcomments — legacy BomCommunity.ts returns [] (STUB). Match legacy.
     */
    postcomments: async () => asGql([]),

    /**
     * readingplansegment(token, guid) — one reading-plan segment expanded into
     * its sections + scored text blocks. Legacy: resolve user by token →
     * username (queryBy = user?.user || token), then loadReadingPlanSegment.
     * Returns null when token/guid missing or the segment is unknown.
     */
    readingplansegment: async (_root, args, ctx: AppContext) => {
      const token = args.token as string | null | undefined;
      const guid = args.guid as string | null | undefined;
      if (!token || !guid) return null;
      try {
        const queryBy = await resolveUsername(ctx, token);
        return asGql(await loadReadingPlanSegment(ctx.db, guid, queryBy, ctx.lang ?? null));
      } catch (error) {
        console.error('readingplansegment error:', error);
        return null;
      }
    },
  },
};
