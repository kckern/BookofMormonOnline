/**
 * homeSamplerCacheStore — binds the pure homeSamplerCache to its real L2 store,
 * the `bom_cache` table, and exposes a process-wide singleton.
 *
 * bom_cache shape (verified 2026-08-06): PRIMARY KEY (`hash`), non-unique KEY
 * (`key`), `timestamp` INT (Unix SECONDS), `content` JSON. So:
 *   - the upsert targets `hash` = md5(key) (the real PK) — ON DUPLICATE KEY works
 *   - timestamps are written/compared in SECONDS (ms would overflow the signed INT)
 *   - content is JSON.stringify'd on write (CAST … AS JSON) and arrives parsed on read
 * Writes are best-effort at the cache layer; in dev they are suppressed by
 * sandboxDialect and/or a read-only DB user, leaving L1 to carry caching.
 */

import { createHash } from 'crypto';
import { sql, type Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { getDb } from '../data/db.js';
import {
  createHomeSamplerCache,
  type HomeSamplerCache,
  type L2Adapter,
} from './homeSamplerCache.js';

const md5 = (s: string): string => createHash('md5').update(s).digest('hex');

/** Only our own keys are ever evicted, so a stray other tool's rows are untouched. */
const KEY_PREFIX = 'homesampler:v1:';

export function bomCacheL2(db: Kysely<DB>): L2Adapter {
  return {
    async read(key) {
      const row = await db
        .selectFrom('bom_cache')
        .select(['content', 'timestamp'])
        .where('hash', '=', md5(key))
        .executeTakeFirst();
      return row ? { content: row.content, ts: Number(row.timestamp) } : null;
    },
    async write(key, content, ts) {
      await sql`
        INSERT INTO bom_cache (\`hash\`, \`key\`, \`timestamp\`, \`content\`)
        VALUES (${md5(key)}, ${key}, ${ts}, CAST(${JSON.stringify(content)} AS JSON))
        ON DUPLICATE KEY UPDATE \`timestamp\` = VALUES(\`timestamp\`), \`content\` = VALUES(\`content\`)
      `.execute(db);
    },
    async evict(beforeTs) {
      await sql`
        DELETE FROM bom_cache
        WHERE \`key\` LIKE ${KEY_PREFIX + '%'} AND \`timestamp\` < ${beforeTs}
      `.execute(db);
    },
  };
}

let instance: HomeSamplerCache | null = null;

/** Process-wide singleton, lazily bound to the app DB. */
export function getHomeSamplerCache(): HomeSamplerCache {
  if (!instance) {
    instance = createHomeSamplerCache({ l2: bomCacheL2(getDb()), now: Date.now });
  }
  return instance;
}
