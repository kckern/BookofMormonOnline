import { getRedis } from '../config/redis.js';

const local = new Map<string, { count: number; resetAt: number }>();

/** Redis-backed fixed-window guard with a bounded single-node fallback. */
export async function consumeRealtimeRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `messenger:rate:${action}:${userId}:${window}`;
  const redis = await getRedis();
  if (redis) {
    const count = Number(await redis.incr(key));
    if (count === 1) await redis.expire(key, windowSeconds + 5);
    return count <= limit;
  }

  const now = Date.now();
  const current = local.get(key);
  if (!current || current.resetAt <= now) {
    local.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    if (local.size > 10_000) {
      for (const [candidate, value] of local) {
        if (value.resetAt <= now) local.delete(candidate);
      }
    }
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

