import { createHmac } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { env } from '../config/env.js';

function bucketStart(windowMinutes: number, now = Date.now()): Date {
  const width = windowMinutes * 60_000;
  return new Date(Math.floor(now / width) * width);
}

function scopeHash(scope: string): string {
  const secret = env.MAIL_RATE_LIMIT_SECRET || 'bookofmormon-online-email-rate-limit';
  return createHmac('sha256', secret).update(scope.trim().toLowerCase()).digest('hex');
}

/** Atomic fixed-window limiter. No raw email, username, or IP is persisted. */
export async function consumeEmailRateLimit(db: Kysely<DB>, input: {
  scope: string; action: string; limit: number; windowMinutes?: number;
}): Promise<boolean> {
  const windowStart = bucketStart(input.windowMinutes ?? 60);
  const hash = scopeHash(input.scope);
  await db.insertInto('bom_email_rate_limit').values({
    scope_hash: hash, action: input.action, window_start: windowStart, request_count: 1,
  }).onDuplicateKeyUpdate({ request_count: sql`request_count + 1` }).execute();
  const row = await db.selectFrom('bom_email_rate_limit').select('request_count')
    .where('scope_hash', '=', hash).where('action', '=', input.action)
    .where('window_start', '=', windowStart).executeTakeFirstOrThrow();
  return row.request_count <= input.limit;
}
