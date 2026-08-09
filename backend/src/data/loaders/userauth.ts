/** userauth data access — see docs/reference/backend-mutation-porting-guide.md */
import { sql, type Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders } from '../loaders.js';
import { md5, cleanUsername, genUserAvatar } from '../../auth/identity.js';
import { hashPassword, verifyPassword, needsRehash } from '../../auth/password.js';
import { sendbird } from '../../auth/sendbirdShim.js';
import { resolveSigninAvatar } from '../../messaging/users.js';
import { runWrite } from '../writes.js';
import { bindToken, loadUserRowByToken } from '../../auth/sessionStore.js';
import axios from 'axios';

export { md5, cleanUsername, genUserAvatar };

export interface UserAuthRow {
  user: string;
  email: string | null;
  name: string | null;
  zip: string | null;
  finished: number | null;
  complete: string | number | null;
  started: string | number | null;
  time: number | null;
  pass: string;
  bookmark?: string | null;
}

export interface SignInResult {
  isSuccess: boolean;
  msg: string;
  user: UserAuthRow | null;
  social: { user_id: string; nickname: string; profile_url: string; access_token?: string | null } | null;
}

export interface NetworkRow {
  network: string;
  social_id: string;
}

export interface ProgressScoreResult {
  slug: string | null;
  count: number;
  started: number;
  completed: number;
  started_items: number[];
  completed_items: number[];
  active_items: number[];
  summary: null;
}

/**
 * Look up a user by username or email (OR match, like legacy AuthService).
 */
export async function findUserByCredential(
  db: Kysely<DB>,
  usernameOrEmail: string,
): Promise<UserAuthRow | null> {
  const rows = await db
    .selectFrom('bom_user')
    .select(['user', 'email', 'name', 'zip', 'finished', 'complete', 'started', 'time', 'pass'])
    .where((eb) =>
      eb.or([eb('user', '=', usernameOrEmail), eb('email', '=', usernameOrEmail)]),
    )
    .limit(1)
    .execute();
  return (rows[0] as UserAuthRow) ?? null;
}

/**
 * Look up a user by token (bom_user_token → bom_user join).
 * Returns the full user row including pass for the rehash path.
 */
export async function findUserByToken(
  db: Kysely<DB>,
  token: string,
): Promise<UserAuthRow | null> {
  return loadUserRowByToken(db, token) as Promise<UserAuthRow | null>;
}

/**
 * Fetch social networks (bom_user_social) for a username.
 * Returns empty array when no rows (null-strip handles []).
 */
export async function findNetworksByUser(
  db: Kysely<DB>,
  username: string,
): Promise<NetworkRow[]> {
  const rows = await db
    .selectFrom('bom_user_social')
    .select(['network', 'social_id'])
    .where('user', '=', username)
    .execute();
  return rows;
}

/**
 * Upsert a token row, then relink any existing bom_log rows for that token
 * to the real username.  Legacy does this on both signin and signup to merge
 * anonymous session logs into the authenticated account.
 *
 * Under sandbox the writes are suppressed (runWrite) but we still return normally.
 */
export async function upsertTokenAndRelinkLogs(
  ctx: { db: Kysely<DB>; sandbox: boolean },
  token: string,
  username: string,
): Promise<void> {
  await bindToken(ctx, token, username);
}

/**
 * Rehash a stored MD5 password to bcrypt if needed (organic migration).
 * Only called after a successful password verify.
 */
export async function maybeRehash(
  ctx: { db: Kysely<DB>; sandbox: boolean },
  username: string,
  plaintext: string,
  storedHash: string,
): Promise<void> {
  if (!needsRehash(storedHash)) return;
  const newHash = await hashPassword(plaintext);
  await runWrite(
    ctx,
    ctx.db
      .updateTable('bom_user')
      .set({ pass: newHash })
      .where('user', '=', username) as Parameters<typeof runWrite>[1],
  );
}

/**
 * Resolve an avatar URL for a new user.  Attempts Gravatar (404 probe); falls
 * back to genUserAvatar() if the email has no Gravatar or no email supplied.
 */
export async function resolveAvatarUrl(socialUserId: string, email: string | null): Promise<string> {
  let profile_url = genUserAvatar(socialUserId);
  if (email) {
    const emailHash = md5(email);
    const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}`;
    try {
      await axios.get(gravatarUrl + '?d=404');
      profile_url = gravatarUrl;
    } catch {
      // no Gravatar — fall through to dicebear
    }
  }
  return profile_url;
}

/**
 * Minimal progress scorer — returns the completion/started percentages by
 * querying bom_text joined against bom_log for this user.
 *
 * DONE_WITH_CONCERNS: This is a minimal port of scoreSlugsfromUserInfo (legacy
 * _common.ts:407). It counts text blocks with credit >= PERCENT_TO_COUNT_AS_COMPLETE
 * (40) as completed, credit >= 0 but < threshold as started. The full scorer
 * also computes started_items / completed_items / active_items arrays and
 * accepts a slug filter — we return those as empty arrays here since signin/
 * tokensignin selections only request `completed` and `started` scalars.
 * If any domain needs the full item arrays, this should be lifted into core.
 */
export async function scoreProgressForUser(
  db: Kysely<DB>,
  username: string,
  lastcompleted: number,
): Promise<ProgressScoreResult> {
  const PERCENT_COMPLETE = 40;

  // PERF/consolidation (2026-06-11): the old version LEFT JOINed the ENTIRE
  // bom_text table to bom_log and grouped by every guid (~40k rows scanned;
  // bom_log.value is un-indexed mediumtext) — ~3s. Instead aggregate only THIS
  // user's block logs (uses the bom_log(user) index, ~20ms), then map just those
  // guids to their bom_text.link via the PK. Same result, ~10x faster. This is
  // now the single scorer (computeUserProgress was the duplicate, removed).
  const [totalRes, logRes] = await Promise.all([
    sql<{ cnt: number }>`SELECT COUNT(*) AS cnt FROM bom_text`.execute(db),
    sql<{ guid: string | null; max_credit: number | null }>`
      SELECT value AS guid, MAX(credit) AS max_credit
      FROM bom_log
      WHERE user = ${username} AND type = 'block' AND timestamp > ${lastcompleted}
      GROUP BY value
    `.execute(db),
  ]);

  const count = Number(totalRes.rows[0]?.cnt) || 0;
  const logged = logRes.rows.filter((r): r is { guid: string; max_credit: number | null } => !!r.guid);

  // Map only the guids the user actually logged to their page link (PK lookup).
  const linkByGuid = new Map<string, number>();
  if (logged.length) {
    const textRows = await db
      .selectFrom('bom_text')
      .select(['guid', 'link'])
      .where('guid', 'in', logged.map((r) => r.guid))
      .execute();
    for (const t of textRows) if (t.link != null) linkByGuid.set(t.guid, Number(t.link));
  }

  const started: number[] = [];
  const completed: number[] = [];
  const active: number[] = [];

  for (const row of logged) {
    const link = linkByGuid.get(row.guid);
    if (link == null) continue;
    const credit = row.max_credit !== null ? Number(row.max_credit) : null;
    if (credit === null) continue;
    if (credit === -1) {
      active.push(link);
    } else if (credit >= PERCENT_COMPLETE) {
      completed.push(link);
    } else if (credit >= 0) {
      started.push(link);
    }
  }

  return {
    slug: null,
    count,
    started: count > 0 ? Math.round((started.length * 1000) / count) / 10 : 0,
    completed: count > 0 ? Math.round((completed.length * 1000) / count) / 10 : 0,
    started_items: started,
    completed_items: completed,
    active_items: active,
    summary: null,
  };
}

/**
 * Core signin logic: find user, verify password, rehash if needed, upsert
 * token, relink logs.  Returns a SignInResult ready for the GraphQL resolver.
 */
export async function doSignin(
  ctx: { db: Kysely<DB>; sandbox: boolean },
  username: string,
  password: string,
  token: string,
): Promise<SignInResult> {
  const user = await findUserByCredential(ctx.db, username);
  if (!user) {
    return { isSuccess: false, msg: 'Invalid credentials', user: null, social: null };
  }

  const isValid = await verifyPassword(password, user.pass);
  if (!isValid) {
    return { isSuccess: false, msg: 'Invalid credentials', user: null, social: null };
  }

  // Organic MD5→bcrypt migration
  await maybeRehash(ctx, user.user, password, user.pass);

  // Upsert token and relink logs
  await upsertTokenAndRelinkLogs(ctx, token, user.user);

  const hashed_id = md5(user.user);
  const social = sendbird.loadUser(hashed_id, user.name ?? undefined, await resolveSigninAvatar(ctx.db, hashed_id));

  return {
    isSuccess: true,
    msg: 'login_success',
    user,
    social,
  };
}

/**
 * Core signup logic: cleanUsername, bcrypt hash, create bom_user, upsert
 * token, relink logs, create sendbird shim user.
 */
export async function doSignup(
  ctx: { db: Kysely<DB>; sandbox: boolean },
  lang: string,
  rawUsername: string,
  email: string,
  password: string,
  token: string,
  name: string | null,
  zip: string | null,
): Promise<SignInResult> {
  const username = cleanUsername(rawUsername, email);

  if (!username || !password || !token) {
    return { isSuccess: false, msg: 'Sign-up Failed', user: null, social: null };
  }

  const socialUserId = md5(username);
  const profile_url = await resolveAvatarUrl(socialUserId, email);
  const hashedPassword = await hashPassword(password);

  try {
    // Write the user row (suppressed under sandbox)
    await runWrite(
      ctx,
      ctx.db
        .insertInto('bom_user')
        .values({
          user: username,
          name: name ?? null,
          email: email ?? null,
          pass: hashedPassword,
          zip: zip ?? null,
          lang: lang || 'en',
        }) as Parameters<typeof runWrite>[1],
    );

    // Under sandbox we still return a realistic shape — build a synthetic user row
    const userRow: UserAuthRow = {
      user: username,
      email: email ?? null,
      name: name ?? null,
      zip: zip ?? null,
      finished: null,
      complete: null,
      started: null,
      time: null,
      pass: hashedPassword,
    };

    // Upsert token and relink logs (also suppressed under sandbox)
    await upsertTokenAndRelinkLogs(ctx, token, username);

    const social = sendbird.createUser(socialUserId, name ?? username, profile_url);

    return {
      isSuccess: true,
      msg: 'sign_up_success',
      user: userRow,
      social,
    };
  } catch (err: unknown) {
    // A4: never surface raw DB error codes (e.g. ER_DUP_ENTRY) — they enable
    // username enumeration. Log internally and return a generic message.
    console.error('[signup] DB error during user creation:', err);
    return {
      isSuccess: false,
      msg: 'error_creating_user',
      user: null,
      social: null,
    };
  }
}

export function userauthLoaders(db: Kysely<DB>, lang: string, core: Loaders) {
  return {};
}
