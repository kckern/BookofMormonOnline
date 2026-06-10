/**
 * messaging/presence.ts — Redis-backed online presence service.
 *
 * Key scheme
 * ----------
 * SET  `presence:online`          — SADD / SREM on connect / disconnect.
 * KEY  `presence:heartbeat:<uid>` — TTL key (default 90 s); renewed on
 *                                   setOnline.  Stale entries are evicted
 *                                   by Redis TTL expiry even if a crash
 *                                   prevents setOffline from running.
 *
 * No-Redis fallback
 * -----------------
 * When getRedis() returns null, an in-process Set<string> is used to track
 * online users.  This is process-local (correct for single-instance deployments;
 * Redis remains the multi-instance path).  setOffline still writes last_seen_at
 * to the DB (best-effort) regardless of Redis availability.
 *
 * last_seen_at
 * ------------
 * setOffline() writes messenger_users.last_seen_at = NOW() via Kysely using
 * the singleton getDb().  This mirrors the legacy Sequelize behaviour in
 * src/library/messenger.ts:172.
 */

import { getRedis } from '../config/redis.js';
import { getDb } from '../data/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// In-process fallback (no-Redis path)
// ─────────────────────────────────────────────────────────────────────────────

/** Module-level Set used only when Redis is unavailable (single-instance). */
const inMemoryOnline = new Set<string>();

// ─────────────────────────────────────────────────────────────────────────────
// Key constants
// ─────────────────────────────────────────────────────────────────────────────

const ONLINE_SET_KEY = 'presence:online';
const HEARTBEAT_TTL_SECONDS = 90;

function heartbeatKey(userId: string): string {
  return `presence:heartbeat:${userId}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a user online.
 *  - Redis available: adds userId to the online SET and creates/renews the
 *    per-user TTL heartbeat key.
 *  - Redis absent: adds userId to the in-process fallback Set.
 */
export async function setOnline(userId: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) {
    inMemoryOnline.add(userId);
    return;
  }

  try {
    await Promise.all([
      redis.sAdd(ONLINE_SET_KEY, userId),
      redis.set(heartbeatKey(userId), '1', { EX: HEARTBEAT_TTL_SECONDS }),
    ]);
  } catch (err) {
    console.error('[presence] setOnline error:', err);
  }
}

/**
 * Mark a user offline.
 *  - Redis available: removes userId from the online SET and deletes the
 *    heartbeat key.
 *  - Redis absent: removes userId from the in-process fallback Set.
 *  - Always (best-effort): writes messenger_users.last_seen_at = NOW() via
 *    Kysely so the durable fallback is up-to-date.
 */
export async function setOffline(userId: string): Promise<void> {
  // Always update the DB timestamp regardless of Redis availability (best-effort).
  try {
    const db = getDb();
    await db
      .updateTable('messenger_users')
      .set({ last_seen_at: new Date() })
      .where('user_id', '=', userId)
      .execute();
  } catch (err) {
    console.error('[presence] setOffline DB write error:', err);
  }

  const redis = await getRedis();
  if (!redis) {
    inMemoryOnline.delete(userId);
    return;
  }

  try {
    await Promise.all([
      redis.sRem(ONLINE_SET_KEY, userId),
      redis.del(heartbeatKey(userId)),
    ]);
  } catch (err) {
    console.error('[presence] setOffline redis error:', err);
  }
}

/**
 * Returns true when the user is currently online.
 *
 * Redis available: checks both the online SET (for membership) and the
 * heartbeat key (TTL guard against stale SET entries from a crash).  A user
 * is online only when BOTH conditions hold.
 *
 * Redis absent: checks the in-process fallback Set.
 */
export async function isOnline(userId: string): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return inMemoryOnline.has(userId);

  try {
    const [inSet, heartbeat] = await Promise.all([
      redis.sIsMember(ONLINE_SET_KEY, userId) as Promise<boolean>,
      redis.exists(heartbeatKey(userId)) as Promise<number>,
    ]);
    return Boolean(inSet) && (heartbeat as number) > 0;
  } catch (err) {
    console.error('[presence] isOnline error:', err);
    return false;
  }
}

/**
 * Returns the list of currently-online user IDs.
 *
 * Redis available: filters the online SET by the existence of the
 * corresponding heartbeat key, so any entries left behind by a crash (whose
 * TTL has expired) are excluded.
 *
 * Redis absent: returns a snapshot of the in-process fallback Set.
 */
export async function onlineUserIds(): Promise<string[]> {
  const redis = await getRedis();
  if (!redis) return [...inMemoryOnline];

  try {
    const members: string[] = await redis.sMembers(ONLINE_SET_KEY) as string[];
    if (members.length === 0) return [];

    // Batch-check all heartbeat keys in one pipeline-style multi-call.
    const heartbeatChecks: number[] = await Promise.all(
      members.map((uid: string) => redis.exists(heartbeatKey(uid)) as Promise<number>),
    );

    return members.filter((_: string, i: number) => (heartbeatChecks[i] ?? 0) > 0);
  } catch (err) {
    console.error('[presence] onlineUserIds error:', err);
    return [];
  }
}
