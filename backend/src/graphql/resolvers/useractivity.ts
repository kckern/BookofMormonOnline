/** useractivity mutations/queries — see docs/reference/backend-mutation-porting-guide.md */
import type { Resolvers } from '../../../codegen/graphql.js';
import { runWrite } from '../../data/writes.js';
import {
  resolveLogValue,
  scoreRecentBlockLogs,
} from '../../data/loaders/useractivity.js';
import { scoreProgressForUser } from '../../data/loaders/userauth.js';
import { getStudyLog } from '../../data/loaders/studylog.js';
import { forwardPageview } from '../../media/ping.js';

/**
 * Generate a random 9-character alphanumeric hash for new shortlinks.
 * Mirrors legacy makeid(9) in src/resolvers/BomUtils.ts.
 */
function makeShortlinkHash(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const useractivityResolvers: Resolvers = {
  Query: {
    /**
     * studylog — the user's study sessions + summary, aggregated from bom_log.
     * Legacy: BomUser.ts:259 (getLoggedTextItems → sessions → summary). Feeds the
     * /user "date started / study time / study sessions" widgets. Read-only.
     */
    studylog: async (_root, args, ctx) => {
      return getStudyLog(ctx.db, args.token) as unknown as never;
    },
  },
  Mutation: {
    /**
     * log — insert a bom_log row, score recent items, return progress.
     *
     * Legacy: BomUser.ts:561-595
     *   1. getUserForLog: resolve user (or token) + lastcompleted (bom_user.finished)
     *   2. update bom_user.last_active to now
     *   3. getValueForLog: for key='block', resolve val to bom_text.guid; else val verbatim
     *   4. BomLog.create with timestamp/user/ip/type/value/credit=-1/flag=0
     *   5. scoreRecentItems: update credit scores for last 5 block logs
     *   6. scoreSlugsfromUserInfo(null, userInfo): compute global progress
     *   7. return { logged: true/false, progress: { completed, started, … } }
     *
     * Progress: the frontend only selects { completed started } from ProgressScore.
     * The full scoreSlugsfromUserInfo scorer is NOT duplicated here — instead a
     * lightweight aggregate query (computeUserProgress) produces the same two values.
     * If the userauth agent promotes the scorer to core, swap computeUserProgress out.
     */
    log: async (_root, args, ctx) => {
      const { token, key, val } = args;
      const now = Math.round(Date.now() / 1000);

      // 1. Resolve acting user from token (may be null for anonymous)
      const userRow = await ctx.loaders.userByToken.load(token);
      const queryBy: string = userRow?.user ?? token;
      const lastcompleted: number = Number(userRow?.finished ?? 0);

      // 2. Update last_active if user exists
      if (userRow) {
        await runWrite(
          ctx,
          ctx.db
            .updateTable('bom_user')
            .set({ last_active: now })
            .where('user', '=', userRow.user),
        );
      }

      // 3. Resolve the stored value from args
      const resolvedValue = await resolveLogValue(ctx.db, key, val ?? '');

      // 4. Insert bom_log row
      const clientIp = ctx.ip
        ? (ctx.ip.split(',')[0] ?? '').trim().substring(0, 45)
        : '';

      const insertResult = await runWrite(
        ctx,
        // The legacy table has a unique (timestamp,user) key. Browsers can send
        // more than one progress beacon within the same second, and retries can
        // replay the same beacon. Treat that collision as an idempotent success
        // instead of surfacing ER_DUP_ENTRY through GraphQL.
        ctx.db
          .insertInto('bom_log')
          .values({
            timestamp: now,
            user: queryBy,
            ip: clientIp,
            type: key,
            value: resolvedValue,
            credit: -1,
            flag: 0,
          })
          .ignore(),
      );

      // Under sandbox, insertResult.executed is false — treat as if insert succeeded
      // (same convention as legacy sandboxMode: still return logged:true + progress)
      const logged = insertResult.executed || ctx.sandbox;

      // 5. Score recent block logs (updates credit values for prior items)
      await scoreRecentBlockLogs(ctx.db, queryBy, (builder) => runWrite(ctx, builder));

      // 6. Compute global progress via the single shared scorer (consolidated:
      //    was the now-removed computeUserProgress, which double-implemented this).
      const progress = await scoreProgressForUser(ctx.db, queryBy, lastcompleted);

      return { logged, progress };
    },

    /**
     * shortlink (aka setShortLink) — find-or-create a bom_shortlinks row by string.
     *
     * Legacy: BomUtils.ts:208-222
     *   - BomShortlinks.findOne({ where: { string } })
     *   - if found: return the existing row (no write)
     *   - if not found: create with random 9-char hash
     *
     * Sandbox-safe: the SELECT path never writes.  On a find-miss a new row would
     * be created, but under sandbox the INSERT is suppressed.  The returned
     * { hash } on a miss under sandbox will be the generated hash (not persisted).
     *
     * The find-or-create pattern is NOT atomic (no unique-index guard in the app
     * layer) — same as legacy.  Race conditions are silently tolerated.
     */
    shortlink: async (_root, args, ctx) => {
      const string = args.string ?? '';

      // Try to find existing row first
      const existing = await ctx.db
        .selectFrom('bom_shortlinks')
        .select(['hash', 'string'])
        .where('string', '=', string)
        .executeTakeFirst();

      if (existing) {
        return { hash: existing.hash, string: existing.string };
      }

      // Create new
      const newHash = makeShortlinkHash(9);
      await runWrite(
        ctx,
        ctx.db.insertInto('bom_shortlinks').values({ hash: newHash, string }),
      );

      return { hash: newHash, string };
    },

    /**
     * ping — analytics pageview beacon (replaces legacy POST /ping). Forwards the
     * base64 payload to Clicky with the server-injected IP + UA. Fire-and-forget:
     * returns immediately and never blocks/throws. Skipped under sandbox so dev
     * testing doesn't pollute analytics (legacy /ping wasn't reachable on dev either).
     */
    ping: async (_root, args, ctx) => {
      const data = (args.data ?? '') as string;
      if (!data) return false;
      if (ctx.sandbox) return true;
      void forwardPageview(data, ctx.ip ?? '', ctx.ua ?? '');
      return true;
    },
  },
};
