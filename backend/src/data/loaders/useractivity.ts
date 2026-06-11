/** useractivity data access — see docs/reference/backend-mutation-porting-guide.md */
import { sql, type Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders } from '../loaders.js';

/**
 * Resolve the value stored in bom_log.value from the mutation args (key, val).
 *
 * Mirrors legacy getValueForLog (src/resolvers/_common.ts:451-498):
 *   - key='block': val is "<slug>/<linkNum>"; resolve to bom_text.guid by joining
 *     bom_slug (slug=slug, link=bom_text.page) + bom_text (link=linkNum).
 *   - all other keys: store val as-is.
 */
export async function resolveLogValue(
  db: Kysely<DB>,
  key: string,
  val: string,
): Promise<string> {
  if (key === 'block') {
    // Strip trailing /N to get page slug, extract link number
    const withoutNum = val.replace(/\/\d+$/, '');
    const pageSlug = withoutNum.split('/').pop() ?? withoutNum;
    const match = val.match(/(\d+)$/);
    const linkNum = match ? parseInt(match[1] ?? '0', 10) : 0;

    const row = await db
      .selectFrom('bom_text')
      .innerJoin('bom_slug', 'bom_slug.link', 'bom_text.page')
      .select('bom_text.guid')
      .where('bom_slug.slug', '=', pageSlug)
      .where('bom_text.link', '=', linkNum)
      .executeTakeFirst();

    // Return the guid if found; fall back to raw val on miss (same silent behaviour
    // as legacy crash propagation — the insert still proceeds but logs the raw val).
    return row?.guid ?? val;
  }

  // All other keys stored verbatim
  return val;
}

/**
 * Score recent (up to 5) block log entries for the user.
 *
 * Mirrors legacy scoreRecentItems (BomUser.ts:763-819): takes the 5 most recent
 * block logs, iterates pairs to compute time-based credit, and updates each
 * bom_log row.  This is the "scoring pass" that converts credit=-1 (active)
 * rows into real credit values.
 *
 * Under sandbox this function still computes scores but runWrite suppresses the
 * UPDATE — caller must pass a runWrite-compatible ctx.
 */
export async function scoreRecentBlockLogs(
  db: Kysely<DB>,
  queryBy: string,
  runWriteFn: (builder: any) => Promise<{ executed: boolean; rows: any[] }>,
): Promise<boolean> {
  // Fetch last 5 block logs with duration from bom_text
  const { rows: items } = await sql<{
    timestamp: number;
    type: string;
    value: string;
    duration: number | null;
  }>`
    SELECT l.timestamp, l.type, l.value, t.duration
    FROM bom_log l
    LEFT JOIN bom_text t ON t.guid = l.value
    WHERE l.user = ${queryBy}
      AND l.type = 'block'
    ORDER BY l.timestamp DESC
    LIMIT 5
  `.execute(db);

  for (let i = 0; i < items.length; i++) {
    const followingItem = items[i];
    const itemToScore = items[i + 1];
    if (!followingItem || !itemToScore || itemToScore.type !== 'block') continue;

    const nextTime = Number(followingItem.timestamp);
    const startTime = Number(itemToScore.timestamp);
    const timespent = nextTime - startTime;
    const duration = itemToScore.duration ? Number(itemToScore.duration) : 0;
    let score = duration > 0 ? Math.round((timespent * 100) / duration) : 0;
    if (score > 10000) score = 9999;

    await runWriteFn(
      db
        .updateTable('bom_log')
        .set({ credit: score })
        .where('user', '=', queryBy)
        .where('timestamp', '=', Number(itemToScore.timestamp))
        .where('value', '=', itemToScore.value),
    );
  }

  return true;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useractivityLoaders(db: Kysely<DB>, lang: string, core: Loaders) {
  return {};
}
