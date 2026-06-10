/**
 * Identity helpers — port of the small utilities in legacy
 * src/resolvers/BomUser.ts (md5, cleanUsername, genUserAvatar).
 */
import { createHash } from 'node:crypto';

export function md5(value: string): string {
  if (!value) return '';
  return createHash('md5').update(value, 'utf8').digest('hex');
}

/**
 * Legacy cleanUsername (BomUser.ts:83): if an email is supplied, the stored
 * username is FORCED to the email's local-part — a real constraint (the
 * regression test user had to match this). Otherwise the raw username is
 * slugified.
 */
export function cleanUsername(username: string, email: string): string {
  const emailPrefix = email ? email.split('@')[0] : '';
  if (emailPrefix) return emailPrefix;
  let u = (username || '').toLowerCase().replace(/[^A-Za-z0-9.-]/gi, '.').replace(/[.]+/, '.');
  u = u.replace(/[([].*[)\]]/, '').trim();
  u = u.replace(/[.]+/, '.');
  return u;
}

/** Dicebear avatar URL seeded by the user's md5 hash (legacy genUserAvatar). */
export function genUserAvatar(hash: string): string {
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${hash}`;
}
