import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

export const REQUIRED_EMAIL_CATEGORIES = new Set(['security', 'transactional']);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function csvSet(value: string): Set<string> {
  return new Set(value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean));
}

export function isStaffUser(userId: string): boolean {
  return csvSet(env.MAIL_STAFF_USERS).has(userId.trim().toLowerCase());
}

export function isRecipientAllowedInEnvironment(email: string): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  return csvSet(env.MAIL_NONPROD_ALLOWLIST).has(normalizeEmail(email));
}

/** Signed, expiring token for preference-center and one-click unsubscribe links. */
export function signUnsubscribeToken(userId: string, category: string, expiresAt: Date): string {
  if (!env.MAIL_UNSUBSCRIBE_SECRET) throw new Error('MAIL_UNSUBSCRIBE_SECRET is not configured');
  const payload = Buffer.from(JSON.stringify({ userId, category, exp: expiresAt.getTime() })).toString('base64url');
  const signature = createHmac('sha256', env.MAIL_UNSUBSCRIBE_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyUnsubscribeToken(token: string): { userId: string; category: string } | null {
  if (!env.MAIL_UNSUBSCRIBE_SECRET) return null;
  const [payload, supplied] = token.split('.');
  if (!payload || !supplied) return null;
  const expected = createHmac('sha256', env.MAIL_UNSUBSCRIBE_SECRET).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(supplied, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      userId?: unknown; category?: unknown; exp?: unknown;
    };
    if (typeof parsed.userId !== 'string' || typeof parsed.category !== 'string' || typeof parsed.exp !== 'number') return null;
    if (parsed.exp < Date.now()) return null;
    return { userId: parsed.userId, category: parsed.category };
  } catch {
    return null;
  }
}
