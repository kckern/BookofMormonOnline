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
  type UserAuthRow,
} from '../../data/loaders/userauth.js';
import { resolveSigninAvatar } from '../../messaging/users.js';
import { sendbird } from '../../auth/sendbirdShim.js';
import { runWrite } from '../../data/writes.js';
import * as store from '../../auth/sessionStore.js';
import { hashPassword } from '../../auth/password.js';
import { cleanUsername } from '../../auth/identity.js';
import { createResetToken, consumeResetToken } from '../../data/loaders/passwordreset.js';
import { createHash } from 'node:crypto';
import { enqueueEmail } from '../../email/outbox.js';
import { renderTransactionalTemplate } from '../../email/templates.js';
import { env } from '../../config/env.js';
import { consumeEmailRateLimit } from '../../email/rateLimit.js';

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
     * checkUsernameAvailable — true when the (normalized) username is free.
     * USERNAME-only by design: usernames are semi-public UX (restores the
     * "username taken" hint the A4 hardening removed from the signup response)
     * WITHOUT reopening the email-enumeration oracle A5 closed. Normalized via
     * cleanUsername so it matches what signup would actually store.
     */
    checkUsernameAvailable: async (_root, args: { username?: string | null }, ctx: AppContext) => {
      const raw = (args.username ?? '').trim();
      if (!raw) return false;
      const username = cleanUsername(raw, '');
      const existing = await ctx.db
        .selectFrom('bom_user')
        .select('user')
        .where('user', '=', username)
        .limit(1)
        .executeTakeFirst();
      return !existing;
    },

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

      // Onboarding: provision the messenger identity on sign-in. messenger_members
      // / messages / reactions / files all FK to messenger_users.user_id, so a
      // post-Sendbird-migration user with no row silently can't join, post, react,
      // or open a socket. Insert-if-missing (suppressed under sandbox on dev).
      // profile_url stays NULL — generated avatars are never persisted; the read
      // path (getUser → avatarAssets) derives and verifies on demand, so an S3
      // upload or social refresh wins automatically.
      const hasMessengerRow = await ctx.db
        .selectFrom('messenger_users')
        .select('user_id')
        .where('user_id', '=', hashed_id)
        .executeTakeFirst();
      if (!hasMessengerRow) {
        await runWrite(
          ctx,
          ctx.db.insertInto('messenger_users').values({
            user_id: hashed_id,
            bom_user_id: user.user,
            nickname: user.name ?? user.user,
            profile_url: null,
            is_bot: 0,
          }) as Parameters<typeof runWrite>[1],
        );
      }

      const social = sendbird.loadUser(
        hashed_id,
        user.name ?? undefined,
        await resolveSigninAvatar(ctx.db, hashed_id),
      );
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
      return store.revokeToken(ctx, token);
    },

    /**
     * requestPasswordReset — mint a single-use, 30-min token for the account
     * matching `email` (email OR username) and email a reset link via the
     * transactional mailer. ALWAYS returns true (never reveals whether the
     * account exists — anti-enumeration, consistent with the A4/A5 hardening).
     */
    requestPasswordReset: async (_root, args: { email?: string | null }, ctx: AppContext) => {
      const email = (args.email ?? '').trim();
      if (!email) return true;
      try {
        if (!(await consumeEmailRateLimit(ctx.db, {
          scope: `ip:${ctx.ip}`, action: 'account-recovery', limit: 5,
        }))) return true;
        const user = await ctx.db
          .selectFrom('bom_user')
          .select(['user', 'name', 'email'])
          .where((eb) => eb.or([eb('email', '=', email), eb('user', '=', email)]))
          .limit(1)
          .executeTakeFirst();
        if (user) {
          if (!(await consumeEmailRateLimit(ctx.db, {
            scope: `account:${user.user}`, action: 'account-recovery', limit: 3,
          }))) return true;
          const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
          const idempotencyKey = `password-reset:${createHash('sha256').update(`${user.user}:${bucket}`).digest('hex')}`;
          const alreadyQueued = await ctx.db.selectFrom('bom_email_outbox').select('id')
            .where('idempotency_key', '=', idempotencyKey).executeTakeFirst();
          if (alreadyQueued) return true;
          const token = await createResetToken(ctx.db, user.user);
          const resetUrl = `${env.APP_BASE_URL}/reset-password?token=${token}`;
          const rendered = await renderTransactionalTemplate(ctx.db, 'password-reset', ctx.lang, { resetUrl });
          await enqueueEmail(ctx.db, {
            kind: 'transactional',
            category: 'security',
            recipientEmail: user.email ?? email,
            userId: user.user,
            templateKey: rendered.templateKey,
            templateVersion: rendered.templateVersion,
            locale: rendered.lang,
            variables: { resetUrl },
            sensitive: true,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            idempotencyKey,
          });
        }
      } catch (err) {
        console.error('requestPasswordReset error:', err);
      }
      return true;
    },

    /** Email the account name without disclosing whether the address exists. */
    requestAccountRecovery: async (_root, args: { email?: string | null }, ctx: AppContext) => {
      const email = (args.email ?? '').trim();
      if (!email) return true;
      try {
        if (!(await consumeEmailRateLimit(ctx.db, {
          scope: `ip:${ctx.ip}`, action: 'account-recovery', limit: 5,
        }))) return true;
        const user = await ctx.db.selectFrom('bom_user')
          .select(['user', 'email'])
          .where('email', '=', email)
          .limit(1)
          .executeTakeFirst();
        if (user?.email) {
          if (!(await consumeEmailRateLimit(ctx.db, {
            scope: `account:${user.user}`, action: 'account-recovery', limit: 3,
          }))) return true;
          const signinUrl = new URL('/', env.APP_BASE_URL).toString();
          const rendered = await renderTransactionalTemplate(ctx.db, 'account-recovery', ctx.lang, {
            username: user.user,
            signinUrl,
          });
          const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
          await enqueueEmail(ctx.db, {
            kind: 'transactional',
            category: 'security',
            recipientEmail: user.email,
            userId: user.user,
            templateKey: rendered.templateKey,
            templateVersion: rendered.templateVersion,
            locale: rendered.lang,
            variables: { username: user.user, signinUrl },
            sensitive: true,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            idempotencyKey: `account-recovery:${createHash('sha256').update(`${user.user}:${bucket}`).digest('hex')}`,
          });
        }
      } catch (err) {
        console.error('requestAccountRecovery error:', err);
      }
      return true;
    },

    /**
     * resetPassword — consume a reset token (single-use, must be unexpired) and
     * set a new bcrypt-hashed password for the token's user. Returns a minimal
     * SignIn ({isSuccess,msg}); the client then signs in normally.
     */
    resetPassword: async (_root, args: { token?: string | null; password?: string | null }, ctx: AppContext) => {
      const token = (args.token ?? '') as string;
      const password = (args.password ?? '') as string;
      if (!token || !password) {
        return { isSuccess: false, msg: 'invalid_request', user: null, social: null };
      }
      const username = await consumeResetToken(ctx.db, token);
      if (!username) {
        return { isSuccess: false, msg: 'invalid_or_expired_token', user: null, social: null };
      }
      const hashed = await hashPassword(password);
      await ctx.db.updateTable('bom_user').set({ pass: hashed }).where('user', '=', username).execute();
      return { isSuccess: true, msg: 'password_reset', user: null, social: null };
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
