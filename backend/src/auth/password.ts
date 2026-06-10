/**
 * Password hashing — verbatim behavior port of legacy
 * src/library/auth/password.ts. bcrypt for new hashes; legacy MD5 (32 hex)
 * accepted for migration and organically rehashed to bcrypt on next successful
 * signin. See memory: bcrypt migration is organic-only — dormant accounts keep
 * their MD5 hash until they log in.
 */
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

const SALT_ROUNDS = 12;

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, SALT_ROUNDS);

/** bcrypt hashes are 60 chars starting `$2`; legacy MD5 is exactly 32 hex chars. */
export function needsRehash(hash: string): boolean {
  return hash.length === 32 && /^[a-f0-9]+$/i.test(hash);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  if (needsRehash(hash)) {
    return createHash('md5').update(password, 'utf8').digest('hex') === hash;
  }
  return bcrypt.compare(password, hash);
}
