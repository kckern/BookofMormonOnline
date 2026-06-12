/**
 * socialsignin — verify an OAuth social token with its provider, then
 * find-or-create the bom_user and mint a session token. Port of legacy
 * src/resolvers/BomUser.ts (facebook/google/naver/kakao signin + processSocialUser).
 *
 * The client obtains the provider token; we only VERIFY it server-side (a GET to
 * the provider's tokeninfo/me endpoint — no app secret required) and map it to a
 * profile. Writes (user/token/social rows) go through runWrite, so SANDBOX
 * suppresses them while still returning a realistic shape.
 */
import type { Kysely } from 'kysely';
import axios from 'axios';
import type { DB } from '../../../codegen/db.js';
import { md5, cleanUsername, genUserAvatar } from '../../auth/identity.js';
import { avatarAssetExists, shouldRefreshStoredAvatar } from '../../messaging/avatarAssets.js';
import { PROFILE_IMAGE_BASE } from '../../messaging/users.js';
import { hashPassword } from '../../auth/password.js';
import { sendbird } from '../../auth/sendbirdShim.js';
import { runWrite } from '../writes.js';
import { upsertTokenAndRelinkLogs } from './userauth.js';

interface SocialProfile {
  network: string;
  social_id: string;
  name: string;
  profile_url: string;
  email: string;
}

type Ctx = { db: Kysely<DB>; sandbox: boolean };

/** Verify the provider token and return the normalized profile (null on failure). */
export async function verifySocialToken(
  network: string,
  socialToken: string,
): Promise<SocialProfile | null> {
  if (!socialToken) return null;
  try {
    if (network === 'google') {
      const { data } = await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${encodeURIComponent(socialToken)}`);
      if (!data?.sub) return null;
      return { network, social_id: String(data.sub), name: data.name ?? '', profile_url: data.picture ?? '', email: data.email ?? '' };
    }
    if (network === 'facebook') {
      const { data } = await axios.get(`https://graph.facebook.com/me?fields=email,name&access_token=${encodeURIComponent(socialToken)}`);
      if (!data?.id) return null;
      const profile_url = `https://graph.facebook.com/${data.id}/picture?type=large&access_token=${encodeURIComponent(socialToken)}`;
      return { network, social_id: String(data.id), name: data.name ?? '', profile_url, email: data.email || `${data.id}@fb.com` };
    }
    if (network === 'naver') {
      const { data } = await axios.post('https://openapi.naver.com/v1/nid/me', null, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Bearer ${socialToken}` },
      });
      const r = data?.response;
      if (!r?.id) return null;
      return { network, social_id: String(r.id), name: r.nickname || r.name || '', profile_url: r.profile_image ?? '', email: r.email ?? '' };
    }
    if (network === 'kakao') {
      const { data } = await axios.get('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${socialToken}` },
      });
      if (!data?.id) return null;
      const acct = data.kakao_account ?? {};
      const profile = acct.profile ?? {};
      return { network, social_id: String(data.id), name: profile.nickname ?? '', profile_url: profile.profile_image_url ?? '', email: acct.email ?? '' };
    }
    return null;
  } catch {
    return null;
  }
}

const fail = (network: string) => ({ isSuccess: false, msg: `${network} failure`, user: null, social: null, profile_url: null });

/**
 * Find a free username derived from name/email (legacy collision = append .N).
 * Email collisions are handled by the link path before create, so we only need a
 * username that doesn't already exist.
 */
async function freeUsername(db: Kysely<DB>, name: string, email: string): Promise<string> {
  const base = cleanUsername(name, email);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}.${i}`;
    const clash = await db.selectFrom('bom_user').select('user').where('user', '=', candidate).executeTakeFirst();
    if (!clash) return candidate;
  }
  return `${base}.${Date.now()}`;
}

/**
 * Persist the provider's fresh avatar URL to messenger_users at sign-in, so
 * social avatars stay current without any by-id re-fetch API (Google has
 * none). Policy lives in avatarAssets.shouldRefreshStoredAvatar: an explicit
 * S3 upload or the migrated assets-host mirror always wins; only gaps and
 * stale external provider URLs are refreshed. No-op when the messenger row
 * doesn't exist yet — tokensignin provisions it on the next call.
 */
async function refreshMessengerAvatar(ctx: Ctx, username: string, freshUrl: string) {
  if (!freshUrl) return;
  // Never persist provider access tokens (the FB picture URL embeds one and
  // expires with it; the bare edge URL serves the photo publicly).
  try {
    const u = new URL(freshUrl);
    u.searchParams.delete('access_token');
    freshUrl = u.toString();
  } catch {
    return;
  }
  const userId = md5(username);
  const row = await ctx.db
    .selectFrom('messenger_users')
    .select(['profile_url'])
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!row) return;
  const s3Exists = await avatarAssetExists(`${PROFILE_IMAGE_BASE}/profiles/${userId}.jpg`);
  if (!shouldRefreshStoredAvatar({ fresh: freshUrl, stored: row.profile_url, s3Exists })) return;
  await runWrite(
    ctx,
    ctx.db
      .updateTable('messenger_users')
      .set({ profile_url: freshUrl })
      .where('user_id', '=', userId) as Parameters<typeof runWrite>[1],
  );
}

/**
 * Find-or-create the user for a verified social profile + mint the session token.
 * Three paths (mirrors legacy processSocialUser): create new, link to an existing
 * email account, or plain login for a known social id.
 */
export async function processSocialUser(ctx: Ctx, profile: SocialProfile, token: string) {
  const { network, social_id, name, profile_url, email } = profile;
  if (!social_id) return fail(network);

  const existingSocial = await ctx.db
    .selectFrom('bom_user_social')
    .select(['user', 'network', 'social_id'])
    .where('network', '=', network)
    .where('social_id', '=', social_id)
    .executeTakeFirst();

  const existingEmailUser = email
    ? await ctx.db.selectFrom('bom_user').select(['user', 'name', 'email']).where('email', '=', email).executeTakeFirst()
    : undefined;

  // ── Plain login: known social id ──────────────────────────────────────────
  if (existingSocial) {
    await upsertTokenAndRelinkLogs(ctx, token, existingSocial.user);
    await refreshMessengerAvatar(ctx, existingSocial.user, profile_url);
    const userRow = await ctx.db.selectFrom('bom_user').selectAll().where('user', '=', existingSocial.user).executeTakeFirst();
    const social = sendbird.loadUser(md5(existingSocial.user), userRow?.name ?? name, profile_url || genUserAvatar(md5(existingSocial.user)));
    return { isSuccess: true, msg: `${network} login success`, user: userRow ?? null, social, profile_url };
  }

  // ── Link: email already has an account, no social link yet ────────────────
  if (existingEmailUser) {
    await upsertTokenAndRelinkLogs(ctx, token, existingEmailUser.user);
    await refreshMessengerAvatar(ctx, existingEmailUser.user, profile_url);
    await runWrite(ctx, ctx.db.insertInto('bom_user_social').values({ user: existingEmailUser.user, network, social_id }) as Parameters<typeof runWrite>[1]);
    const social = sendbird.loadUser(md5(existingEmailUser.user), existingEmailUser.name ?? name, profile_url || genUserAvatar(md5(existingEmailUser.user)));
    return { isSuccess: true, msg: `${network} link account success`, user: existingEmailUser, social, profile_url };
  }

  // ── Create: brand-new user ────────────────────────────────────────────────
  const username = await freeUsername(ctx.db, name, email);
  // Social accounts never sign in with a password; store an unusable random hash.
  const pass = await hashPassword(md5(`${social_id}:${network}:${token}`));
  await runWrite(ctx, ctx.db.insertInto('bom_user').values({ user: username, pass, name: name || null, email: email || null, zip: '', lang: 'en' }) as Parameters<typeof runWrite>[1]);
  await upsertTokenAndRelinkLogs(ctx, token, username);
  await runWrite(ctx, ctx.db.insertInto('bom_user_social').values({ user: username, network, social_id }) as Parameters<typeof runWrite>[1]);

  const userRow = (await ctx.db.selectFrom('bom_user').selectAll().where('user', '=', username).executeTakeFirst())
    ?? { user: username, name: name || null, email: email || null, zip: '', pass, lang: 'en' };
  const social = sendbird.loadUser(md5(username), name, profile_url || genUserAvatar(md5(username)));
  return { isSuccess: true, msg: `${network} create + login Success`, user: userRow, social, profile_url };
}

/** Top-level: verify the provider token then find-or-create. Returns a SignIn shape. */
export async function socialSignIn(
  ctx: Ctx,
  network: string,
  token: string,
  socialToken: string,
) {
  if (!['facebook', 'google', 'naver', 'kakao'].includes(network)) {
    return { isSuccess: false, msg: 'social_sign_in_failed', user: null, social: null, profile_url: null };
  }
  const profile = await verifySocialToken(network, socialToken);
  if (!profile) return fail(network);
  return processSocialUser(ctx, profile, token);
}
