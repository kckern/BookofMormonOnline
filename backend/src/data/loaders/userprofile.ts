/** userprofile data access — see docs/reference/backend-mutation-porting-guide.md */
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders } from '../loaders.js';
import { loadUserRowByToken } from '../../auth/sessionStore.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function userprofileLoaders(db: Kysely<DB>, lang: string, core: Loaders) {
  return {};
}

/**
 * Look up a bom_user row via its token in bom_user_token.
 * Returns the user row or null if the token is invalid.
 * Used by editProfile, changePassword, and uploadProfileImage.
 */
export async function getUserByToken(
  db: Kysely<DB>,
  token: string,
): Promise<{
  user: string;
  email: string | null;
  name: string | null;
  zip: string | null;
  complete: string | null;
  started: string | null;
  time: number | null;
  finished: number | null;
  pass: string;
} | null> {
  return loadUserRowByToken(db, token);
}
