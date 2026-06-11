/**
 * socialsignin Query resolver — OAuth login (facebook/google/naver/kakao).
 * Legacy: src/resolvers/BomUser.ts. Verifies the client's provider token, then
 * finds-or-creates the user and mints a session token. See
 * data/loaders/socialsignin.ts.
 */
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { socialSignIn } from '../../data/loaders/socialsignin.js';

export const socialsigninResolvers: Resolvers = {
  Query: {
    socialsignin: async (_root, args, ctx: AppContext) => {
      const network = (args.network ?? '') as string;
      const token = (args.token ?? '') as string;
      const socialToken = (args.social_token ?? '') as string;
      return (await socialSignIn(ctx, network, token, socialToken)) as unknown as never;
    },
  },
};
