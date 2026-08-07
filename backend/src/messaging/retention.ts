/**
 * retention.ts — Message retention job.
 *
 * Hard-purges soft-deleted messenger_messages rows that are older than
 * MESSAGE_RETENTION_DAYS days. Safe by default: if the env var is unset or
 * zero, this module is a no-op and nothing is ever deleted.
 *
 * Multi-instance safety: the Redis lock pattern from bots/scheduler.ts is the
 * ideal guard here, but the retention job runs only once per 24h and the cost
 * of a duplicate purge is just a redundant (empty) DELETE — not data loss.
 * A plain setInterval with the env-var gate is therefore acceptable. If Redis
 * is available in the future and multi-instance stomping becomes a concern,
 * mirror the NX/EX lock in bots/scheduler.ts around the purge call.
 */

import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { purgeDeletedMessages } from './messages.js';

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const INITIAL_DELAY_MS = 60 * 1000;       // run once ~60s after boot

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Parse MESSAGE_RETENTION_DAYS from the environment.
 * Returns a positive integer, or null if unset / non-positive / non-numeric.
 */
function getRetentionDays(): number | null {
  const raw = process.env.MESSAGE_RETENTION_DAYS;
  if (!raw) return null;
  const days = parseInt(raw, 10);
  if (!Number.isFinite(days) || days <= 0) return null;
  return days;
}

async function runPurge(db: Kysely<DB>): Promise<void> {
  const days = getRetentionDays();
  if (days === null) return; // env var unset or invalid — no-op

  try {
    const deleted = await purgeDeletedMessages(db, days);
    if (deleted > 0) {
      console.info(`[retention] purged ${deleted} soft-deleted message(s) older than ${days} days`);
    }
  } catch (e) {
    console.error('[retention] purge error:', (e as Error).message);
  }
}

/**
 * Start the retention job. Runs once ~60s after boot, then every 24h.
 * Completely inert (no timer created) when MESSAGE_RETENTION_DAYS is unset or
 * non-positive — so leaving the env var out of the environment is safe.
 */
export function startRetentionJob(db: Kysely<DB>): void {
  if (getRetentionDays() === null) return; // no-op when unconfigured

  if (timer) return; // idempotent

  // Delayed initial run so startup noise settles before the first purge.
  setTimeout(() => { void runPurge(db); }, INITIAL_DELAY_MS);

  timer = setInterval(() => { void runPurge(db); }, INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref(); // don't keep process alive

  const days = getRetentionDays()!;
  console.info(`[retention] job started — purging soft-deleted messages older than ${days} days (24h interval)`);
}

export function stopRetentionJob(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
