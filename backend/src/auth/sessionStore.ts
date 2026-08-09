import { randomBytes } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { isValidToken } from './identity.js';
import { runWrite } from '../data/writes.js';

export { isValidToken };

export interface Principal {
  userId: string;            // bom_user.user (the username)
  displayName?: string;
  email?: string;
  roles?: string[];
}
export interface Session {
  token: string;
  expiresAt?: Date;
  refreshToken?: string;
}

/** token → Principal (lean identity; NOT the full profile row). */
export async function verifyToken(db: Kysely<DB>, token: string): Promise<Principal | null> {
  if (!isValidToken(token)) return null;
  const row = await db
    .selectFrom('bom_user_token')
    .innerJoin('bom_user', 'bom_user.user', 'bom_user_token.user')
    .select(['bom_user.user as user', 'bom_user.name as name', 'bom_user.email as email'])
    .where('bom_user_token.token', '=', token)
    .limit(1)
    .executeTakeFirst();
  if (!row) return null;
  return { userId: row.user, displayName: row.name ?? undefined, email: row.email ?? undefined };
}

/** token → username, the thin form the many call sites need. */
export async function resolveUsername(db: Kysely<DB>, token: string): Promise<string | null> {
  return (await verifyToken(db, token))?.userId ?? null;
}

type WriteCtx = { db: Kysely<DB>; sandbox: boolean };

/**
 * Phase-0 behavior-preserving bind: verbatim extraction of the legacy
 * upsertTokenAndRelinkLogs — upsert the (client-supplied) token, then relink
 * bom_log rows for all of this user's tokens. Kept so signin/signup behave
 * exactly as today until Phase 1 flips to server-minted issuance.
 */
export async function bindToken(ctx: WriteCtx, token: string, username: string): Promise<void> {
  if (!isValidToken(token)) return;
  await runWrite(
    ctx,
    ctx.db.insertInto('bom_user_token').values({ token, user: username })
      .onDuplicateKeyUpdate({ user: username }) as Parameters<typeof runWrite>[1],
  );
  const tokenRows = await ctx.db.selectFrom('bom_user_token').select('token').where('user', '=', username).execute();
  const tokens = tokenRows.map((r) => r.token);
  if (tokens.length > 0) {
    await runWrite(
      ctx,
      ctx.db.updateTable('bom_log').set({ user: username }).where('user', 'in', tokens) as Parameters<typeof runWrite>[1],
    );
  }
}

/** Server-minted session. Implemented + tested now; wired into resolvers in Phase 1. */
export async function issueToken(ctx: WriteCtx, username: string): Promise<Session> {
  const token = randomBytes(32).toString('hex');
  await runWrite(
    ctx,
    ctx.db.insertInto('bom_user_token').values({ token, user: username })
      .onDuplicateKeyUpdate({ user: username }) as Parameters<typeof runWrite>[1],
  );
  return { token };
}

export async function revokeToken(ctx: WriteCtx, token: string): Promise<boolean> {
  if (!isValidToken(token)) return false;
  const res = await runWrite(
    ctx,
    ctx.db.deleteFrom('bom_user_token').where('token', '=', token) as Parameters<typeof runWrite>[1],
  );
  if (!res.executed) return false;
  const rows = res.rows as unknown as Array<{ numDeletedRows?: bigint }>;
  return rows.length > 0 && (rows[0]?.numDeletedRows ?? 0n) >= 1n;
}

export async function revokeAllForUser(ctx: WriteCtx, username: string): Promise<number> {
  const res = await runWrite(
    ctx,
    ctx.db.deleteFrom('bom_user_token').where('user', '=', username) as Parameters<typeof runWrite>[1],
  );
  if (!res.executed) return 0;
  const rows = res.rows as unknown as Array<{ numDeletedRows?: bigint }>;
  return Number(rows[0]?.numDeletedRows ?? 0n);
}
