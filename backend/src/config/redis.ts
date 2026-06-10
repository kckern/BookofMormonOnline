/**
 * config/redis.ts — shared Redis client factory for the green-field backend.
 *
 * Usage:
 *   import { getRedis, closeRedis } from '../config/redis.js';
 *   const client = await getRedis();     // null when REDIS_URL is unset
 *   if (client) await client.set(…);
 *
 * Design:
 * - Connects lazily on first call using REDIS_URL env.
 * - If REDIS_URL is unset → returns null (single-instance mode, no throw).
 * - Connection errors are logged and demote the client to null (never crash).
 * - The module caches the connected instance; repeated calls return the same object.
 * - closeRedis() disconnects and resets the cache (primarily for test teardown).
 */

import { createClient } from 'redis';

// Use a locally-inferred type so the generic parameters match exactly what
// createClient() returns, avoiding contravariant narrowing mismatches with the
// redis package's wide RedisClientType generic.
type LocalClient = Awaited<ReturnType<ReturnType<typeof createClient>['connect']>> extends void
  ? ReturnType<typeof createClient>
  : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRedisClient = any;

/** Opaque handle to the connected redis client. */
export type RedisClient = AnyRedisClient;

// Module-level singleton state.
let instance: AnyRedisClient | null = null;
let connecting = false;
let connectPromise: Promise<AnyRedisClient | null> | null = null;

// Suppress unused warning — LocalClient is a type-level probe only.
type _unused = LocalClient;

/**
 * Returns the connected Redis client, or null when unavailable.
 *
 * The first call initiates an async connect; subsequent calls during that
 * window share the same promise (no duplicate connects).  Once resolved the
 * instance is cached and returned synchronously on all future calls.
 */
export async function getRedis(): Promise<RedisClient | null> {
  // Already connected — return immediately.
  if (instance !== null) return instance as RedisClient;

  // No REDIS_URL configured → single-instance mode.
  const url = process.env['REDIS_URL'];
  if (!url) return null;

  // Connection already in progress — share the promise.
  if (connecting && connectPromise) return connectPromise;

  connecting = true;
  connectPromise = (async (): Promise<RedisClient | null> => {
    try {
      const client = createClient({ url });

      client.on('error', (err: Error) => {
        console.error('[redis] client error:', err.message);
      });

      await client.connect();
      instance = client;
      return client as RedisClient;
    } catch (err) {
      console.error('[redis] failed to connect — degrading to single-instance mode:', err);
      instance = null;
      return null;
    } finally {
      connecting = false;
      connectPromise = null;
    }
  })();

  return connectPromise;
}

/**
 * Disconnect and reset the cached instance.
 * Intended for test teardown and graceful shutdown.
 */
export async function closeRedis(): Promise<void> {
  if (instance) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (instance as ReturnType<typeof createClient>).disconnect();
    } catch {
      // ignore disconnect errors during cleanup
    }
    instance = null;
  }
}
