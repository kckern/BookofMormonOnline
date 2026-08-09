/**
 * ported_user resolvers — previously-unresolved BomUser / BomCommunity Query
 * fields that were declared in the SDL but had no resolver (silently null).
 *
 * Faithful ports of the legacy resolvers in src/resolvers/BomUser.ts and
 * src/resolvers/BomCommunity.ts. All read-only (sandbox-safe) and never throw —
 * each catches and returns the legacy empty/fallback shape.
 *
 *   closetab(token)              — presence beacon on tab close; resolve user, return []
 *   sourceUsage(token, source)   — commentary-source consumption fraction
 *   pageprogress(token, slug[])  — per-page ProgressScore over the page's blocks
 *   userdailyscores(token)       — { dates, progress } per-day cumulative %
 *   studygrouphistory(token,id)  — hardcoded group history (legacy stub)
 *   generateToken(seed)          — deterministic 32-char hex token (new)
 *   users(user_ids[])            — public bom_user rows (new, minimal)
 */
import type { Resolvers } from '../../../codegen/graphql.js';
import { findUserByToken, md5 } from '../../data/loaders/userauth.js';
import {
  getSourceUsage,
  getPageProgress,
  getUsersByIds,
} from '../../data/loaders/ported_user.js';
import { getStandardizedValuesFromUserList } from '../../data/loaders/standardizedScores.js';
import { resolveUsername } from '../../auth/sessionStore.js';

export const portedUserResolvers: Resolvers = {
  Query: {
    /**
     * closetab — analytics/presence beacon fired by the frontend exitBeacon on
     * tab close. Legacy BomUser.ts:156 resolves the user by token and calls
     * sendbird.closeTab (a no-op shim returning {}). The green-field sendbird shim
     * has no closeTab, so we replicate faithfully: resolve the user (best-effort)
     * and return [] — the SDL return is [String] and the frontend fire-and-forgets.
     */
    closetab: async (_root, args, ctx) => {
      try {
        if (args.token) await findUserByToken(ctx.db, args.token);
      } catch {
        // never throw — beacon is fire-and-forget
      }
      return [];
    },

    /**
     * sourceUsage — fraction of a commentary source consumed by the user.
     * Legacy BomUser.ts:219. Returns 0 on missing token/source or DB error.
     */
    sourceUsage: async (_root, args, ctx) => {
      try {
        return await getSourceUsage(ctx.db, args.token, args.source);
      } catch (error) {
        console.error('Database error during sourceUsage:', error);
        return 0;
      }
    },

    /**
     * pageprogress — per-page ProgressScore scoped to the requested slugs.
     * Legacy BomUser.ts:317. One ProgressScore per requested slug.
     */
    pageprogress: async (_root, args, ctx) => {
      try {
        return (await getPageProgress(ctx.db, args.token, args.slug)) as unknown as never;
      } catch (error) {
        console.error('Database error during pageprogress:', error);
        return [];
      }
    },

    /**
     * userdailyscores — { dates, progress } per-day cumulative progress % for the
     * token's user. Legacy BomUser.ts:288 (getStandardizedValuesFromUserList on a
     * single-user list). When the token is unknown, legacy falls back to using the
     * raw token as the username (yields an empty series).
     */
    userdailyscores: async (_root, args, ctx) => {
      try {
        const resolved = args.token ? await resolveUsername(ctx.db, args.token) : null;
        const username = resolved ?? args.token ?? '';
        const values = await getStandardizedValuesFromUserList(ctx.db, [username]);
        return {
          dates: values.map((v) => v.date),
          progress: values.map((v) => v.progress[username] ?? 0),
        };
      } catch (error) {
        console.error('Database error during userdailyscores:', error);
        return { dates: [], progress: [] };
      }
    },

    /**
     * studygrouphistory — per-user daily progress for a study group.
     * C-4a: the legacy stub hardcoded ['tytus','kckern'] and returned their real
     * reading progress regardless of the requested studyGroupID — a dev-account
     * data leak for any caller. There is no real implementation (no
     * bom_studygroup_members table lookup). Return a safe empty shape until a
     * proper implementation exists.
     */
    studygrouphistory: async (_root, args) => {
      const studyGroupID = args.studyGroupID;
      return {
        studyGroupID,
        studyGroupName: '',
        dates: [],
        userHistories: [],
      };
    },

    /**
     * generateToken — deterministic token derived from a seed. Not implemented in
     * legacy; minimal sensible version: md5 hex of the seed → 32-char hex string.
     */
    generateToken: (_root, args) => {
      const seed = args.seed ?? 0;
      return md5(`bom-token-seed:${seed}`);
    },

    /**
     * users — public bom_user rows for the given ids (user/name only).
     * A5: email was returned to unauthenticated callers, allowing anyone who
     * knows a username to harvest real email addresses. Fix: drop email from
     * the response entirely (it is not needed by any known public consumer).
     * Also cap the batch to 100 ids to prevent unbounded enumeration.
     */
    users: async (_root, args, ctx) => {
      try {
        // Cap the batch — no unbounded enumeration.
        const cappedIds = (args.user_ids ?? []).filter(Boolean).slice(0, 100);
        const rows = await getUsersByIds(ctx.db, cappedIds);
        // Strip email — never return it without auth.
        return rows.map(({ user, name }) => ({ user, name, email: null })) as unknown as never;
      } catch (error) {
        console.error('Database error during users:', error);
        return [];
      }
    },
  },
};
