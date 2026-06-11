/** userauth mutations/queries — see docs/reference/backend-mutation-porting-guide.md */
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import {
  doSignin,
  doSignup,
  findUserByToken,
  findNetworksByUser,
  scoreProgressForUser,
  md5,
  genUserAvatar,
  type UserAuthRow,
} from '../../data/loaders/userauth.js';
import { sendbird } from '../../auth/sendbirdShim.js';
import { runWrite } from '../../data/writes.js';

/**
 * UserAuth parent row type — passed as `parent` to User field resolvers.
 */
type UserParent = UserAuthRow;

// Helpers to cast through any for the GraphQL Resolver union (ResolverFn |
// ResolverWithResolve) — the actual shape is correct; the codegen types are
// overly strict about the DB Decimal/string fields vs GQL Float.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asGql = <T>(v: T): any => v;

export const userauthResolvers: Resolvers = {
  Query: {
    /**
     * signin — Legacy BomUser.ts:99. Query (not Mutation) by legacy quirk.
     * Dual-verifies password (bcrypt + MD5 migration), rehashes on MD5 hash,
     * upserts bom_user_token, relinks bom_log rows to the authenticated user.
     */
    signin: async (_root, args, ctx: AppContext) => {
      const username = (args.username ?? '') as string;
      const password = (args.password ?? '') as string;
      const token = (args.token ?? '') as string;
      return asGql(await doSignin(ctx, username, password, token));
    },

    /**
     * tokensignin — Legacy BomUser.ts:179. Look up user by token, return SignIn.
     */
    tokensignin: async (_root, args, ctx: AppContext) => {
      const token = (args.token ?? '') as string;
      const user = await findUserByToken(ctx.db, token);
      if (!user) {
        return asGql({ isSuccess: false, msg: 'Token Login Failure', user: null, social: null });
      }
      const hashed_id = md5(user.user);
      const social = sendbird.loadUser(hashed_id, user.name ?? undefined, genUserAvatar(hashed_id));
      return asGql({ isSuccess: true, msg: 'Token Login Success', user, social });
    },

    /**
     * userprogress(token) — ProgressScore for the token's user (legacy BomUser.ts:331).
     * Returns the scored object (never null for a valid token) so the homepage's
     * completion callback can read .summary without crashing.
     */
    userprogress: async (_root, args, ctx: AppContext) => {
      const token = (args.token ?? '') as string;
      if (!token) return null;
      const user = await findUserByToken(ctx.db, token);
      if (!user) return null;
      return asGql(await scoreProgressForUser(ctx.db, user.user, Number(user.finished ?? 0)));
    },
  },

  Mutation: {
    /**
     * signup — Legacy BomUser.ts:395. cleanUsername (email local-part wins),
     * bcrypt hash, insert bom_user, upsert token, relink logs, sendbird shim.
     * Duplicate-user path returns msg = error.parent?.code (e.g. ER_DUP_ENTRY).
     */
    signup: async (_root, args, ctx: AppContext) => {
      const username = (args.username ?? '') as string;
      const email = (args.email ?? '') as string;
      const password = (args.password ?? '') as string;
      const token = (args.token ?? '') as string;
      const name = (args.name ?? null) as string | null;
      const zip = (args.zip ?? null) as string | null;
      return asGql(await doSignup(ctx, ctx.lang, username, email, password, token, name, zip));
    },

    /**
     * signout — Legacy BomUser.ts:382. Delete the bom_user_token row.
     * Returns true when a row was deleted, false otherwise (including sandbox).
     */
    signout: async (_root, args, ctx: AppContext) => {
      const token = (args.token ?? '') as string;
      if (!token) return false;
      const result = await runWrite(
        ctx,
        ctx.db
          .deleteFrom('bom_user_token')
          .where('token', '=', token) as Parameters<typeof runWrite>[1],
      );
      if (!result.executed) return false; // sandbox suppressed
      // Kysely deleteFrom().execute() returns DeleteResult[] whose row count is
      // numDeletedRows (NOT numAffectedRows — that was always undefined → false,
      // so signout reported failure even on a successful delete).
      const affected = result.rows as unknown as Array<{ numDeletedRows?: bigint; numAffectedRows?: bigint }>;
      const n = affected[0]?.numDeletedRows ?? affected[0]?.numAffectedRows ?? 0n;
      return affected.length > 0 && n >= 1n;
    },
  },

  /**
   * User type field resolvers.
   *
   * The parent is a UserAuthRow (plain object). Scalar fields pass through
   * directly; social, networks, and progress are lazy-computed when selected.
   */
  User: {
    user: (parent) => (parent as unknown as UserParent).user,
    email: (parent) => (parent as unknown as UserParent).email ?? null,
    name: (parent) => (parent as unknown as UserParent).name ?? null,
    zip: (parent) => (parent as unknown as UserParent).zip ?? null,
    // bookmark is not stored on bom_user in the current schema — return null
    // (stripped by null-filter).
    bookmark: (_parent) => null,
    complete: (parent) => {
      const v = (parent as unknown as UserParent).complete;
      return v !== null && v !== undefined ? Number(v) : null;
    },
    started: (parent) => {
      const v = (parent as unknown as UserParent).started;
      return v !== null && v !== undefined ? Number(v) : null;
    },
    finished: (parent) => {
      const v = (parent as unknown as UserParent).finished;
      return v !== null && v !== undefined ? Number(v) : null;
    },
    time: (parent) => {
      const v = (parent as unknown as UserParent).time;
      return v !== null && v !== undefined ? Number(v) : null;
    },
    sessions: (_parent) => null,

    /**
     * User.social — legacy has NO User.social resolver (bom_user has no social
     * column), so it resolves null → stripped. The shim lives only on
     * SignIn.social (top level). Returning the shim here would add an extra key
     * the baseline doesn't have. Match legacy: null.
     */
    social: () => null,

    /**
     * User.networks — bom_user_social rows.
     */
    networks: async (parent, _args, ctx: AppContext) => {
      const u = parent as unknown as UserParent;
      return findNetworksByUser(ctx.db, u.user);
    },

    /**
     * User.progress — DONE_WITH_CONCERNS (see loaders/userauth.ts).
     * Minimal scorer; see scoreProgressForUser for details.
     */
    progress: async (parent, _args, ctx: AppContext) => {
      const u = parent as unknown as UserParent;
      return asGql(await scoreProgressForUser(ctx.db, u.user, Number(u.finished ?? 0)));
    },

    // history is parked (not in scope for this slice)
    history: (_parent) => null,
  },
};
