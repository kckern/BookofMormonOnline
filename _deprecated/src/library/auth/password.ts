import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Verify a password against a stored hash.
 * Supports both bcrypt hashes and legacy MD5 hashes for migration.
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  // Support legacy MD5 hashes during migration
  // MD5 hashes are 32 hex characters
  if (needsRehash(hash)) {
    const md5Hash = crypto.createHash('md5').update(password, 'utf8').digest('hex');
    return md5Hash === hash;
  }
  return bcrypt.compare(password, hash);
};

/**
 * Check if a stored hash needs to be rehashed (i.e., is a legacy MD5 hash)
 * MD5 hashes are exactly 32 lowercase hex characters
 * bcrypt hashes are 60 characters and start with $2
 */
export const needsRehash = (hash: string): boolean => {
  return hash.length === 32 && /^[a-f0-9]+$/i.test(hash);
};
