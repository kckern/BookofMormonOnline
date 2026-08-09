import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { isValidToken } from './identity.js';

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
