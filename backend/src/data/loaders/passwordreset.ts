/**
 * passwordreset.ts — single-use, time-limited password-reset tokens
 * (bom_password_reset). Tokens are 64-char random hex, valid 30 minutes.
 */
import crypto from 'node:crypto';
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';

const TTL_MS = 30 * 60 * 1000;

/** Mint + persist a reset token for `username`; returns the token. */
export async function createResetToken(db: Kysely<DB>, username: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex'); // 64 hex chars (fits varchar(64))
  const expires = new Date(Date.now() + TTL_MS);
  await db.transaction().execute(async (trx) => {
    // One live credential per account. A later legitimate request invalidates
    // the earlier link instead of leaving multiple reset capabilities active.
    await trx.deleteFrom('bom_password_reset').where('user', '=', username).execute();
    await trx.insertInto('bom_password_reset').values({ token, user: username, expires }).execute();
  });
  return token;
}

/**
 * Consume a token: return the username when it exists AND is unexpired, else
 * null. Single-use — the row is deleted regardless of validity so a token can
 * never be replayed.
 */
export async function consumeResetToken(db: Kysely<DB>, token: string): Promise<string | null> {
  const row = await db
    .selectFrom('bom_password_reset')
    .select(['user', 'expires'])
    .where('token', '=', token)
    .executeTakeFirst();
  await db.deleteFrom('bom_password_reset').where('token', '=', token).execute();
  if (!row) return null;
  if (new Date(row.expires).getTime() < Date.now()) return null;
  return row.user;
}
