import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { setEmailPreference } from '../../email/outbox.js';

export const OPTIONAL_EMAIL_CATEGORIES = ['reply', 'mention', 'direct_message', 'invite'] as const;

function requireUser(ctx: AppContext): string {
  if (!ctx.auth) throw new Error('Authentication required');
  return ctx.auth.userId;
}

function validateCategory(category: string): typeof OPTIONAL_EMAIL_CATEGORIES[number] {
  if (!OPTIONAL_EMAIL_CATEGORIES.includes(category as typeof OPTIONAL_EMAIL_CATEGORIES[number])) {
    throw new Error('Unsupported email preference category');
  }
  return category as typeof OPTIONAL_EMAIL_CATEGORIES[number];
}

export const emailResolvers: Resolvers = {
  Query: {
    emailPreferences: async (_root, _args, ctx: AppContext) => {
      const userId = requireUser(ctx);
      const rows = await ctx.db.selectFrom('bom_email_preference').select(['category', 'enabled'])
        .where('user_id', '=', userId).where('category', 'in', [...OPTIONAL_EMAIL_CATEGORIES]).execute();
      const enabled = new Map(rows.map((row) => [row.category, row.enabled === 1]));
      return OPTIONAL_EMAIL_CATEGORIES.map((category) => ({ category, enabled: enabled.get(category) ?? false }));
    },
  },
  Mutation: {
    updateEmailPreference: async (_root, args, ctx: AppContext) => {
      const userId = requireUser(ctx);
      const category = validateCategory(args.category);
      await setEmailPreference(ctx.db, {
        userId, category, enabled: args.enabled, cadence: args.enabled ? 'immediate' : 'never', locale: ctx.lang,
      });
      return { category, enabled: args.enabled };
    },
  },
};
