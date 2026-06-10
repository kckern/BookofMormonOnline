/** useractivity data access — see docs/reference/backend-mutation-porting-guide.md */
import { sql, type Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { Loaders } from '../loaders.js';

const PERCENT_TO_COUNT_AS_COMPLETE = parseInt(process.env.PERCENT_TO_COUNT_AS_COMPLETE ?? '40', 10);

/**
 * Lightweight progress scorer for the `log` mutation.
 *
 * Legacy `scoreSlugsfromUserInfo(null, userInfo)` scans ALL bom_text rows and
 * joins each one's bom_log rows to compute percentage started/completed.  That
 * full scorer lives in src/resolvers/lib.ts (via _common.ts) and is also needed
 * by the userauth agent's User.progress field resolver.
 *
 * COORDINATION NOTE: Do NOT duplicate the full scorer here.  The userauth agent
 * is deciding whether to lift it into core.  This helper reproduces the exact
 * two values the frontend requests (completed, started) via a single aggregate
 * SQL query instead of the Sequelize ORM multi-round-trip approach, matching the
 * legacy output byte-for-byte without needing the Sequelize models.
 *
 * Lifecycle: once the scorer is promoted to core, replace this helper with a
 * call to `ctx.loaders.<scorerLoader>`.  For now it is the canonical
 * implementation for the progress field on LogResult only.
 *
 * Algorithm mirrors scoreTextItems from src/resolvers/_common.ts:
 *   - group bom_log rows by value (text guid) for the user since lastcompleted
 *   - per group: if MIN(credit) = -1 → active; elif MAX(credit) >= threshold → completed; else started
 *   - pct = round(count * 1000 / total_texts) / 10
 */
export async function computeUserProgress(
  db: Kysely<DB>,
  queryBy: string,
  lastcompleted: number,
): Promise<{ completed: number; started: number }> {
  const [totalResult, logGroups] = await Promise.all([
    sql<{ cnt: number }>`SELECT COUNT(*) AS cnt FROM bom_text`.execute(db),
    sql<{ value: string; maxcredit: number; mincredit: number }>`
      SELECT value, MAX(credit) AS maxcredit, MIN(credit) AS mincredit
      FROM bom_log
      WHERE user = ${queryBy}
        AND type = 'block'
        AND timestamp > ${lastcompleted}
      GROUP BY value
    `.execute(db),
  ]);

  const total = Number(totalResult.rows[0]?.cnt) || 1;
  let completedCount = 0;
  let startedCount = 0;

  for (const row of logGroups.rows) {
    const maxC = Number(row.maxcredit);
    const minC = Number(row.mincredit);
    if (minC === -1) {
      // active — counts neither started nor completed (mirrors legacy active_items)
    } else if (maxC >= PERCENT_TO_COUNT_AS_COMPLETE || maxC === -1) {
      completedCount++;
    } else if (maxC >= 0) {
      startedCount++;
    }
  }

  return {
    completed: Math.round((completedCount * 1000) / total) / 10,
    started: Math.round((startedCount * 1000) / total) / 10,
  };
}

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
