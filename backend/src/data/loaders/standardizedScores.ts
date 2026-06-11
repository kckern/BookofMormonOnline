/**
 * standardizedScores loader — shared per-day cumulative progress scorer.
 *
 * Faithful port of legacy getStandardizedValuesFromUserList
 * (src/resolvers/_common.ts:523). Used by both userdailyscores (BomUser.ts) and
 * studygrouphistory (BomCommunity.ts).
 *
 * Algorithm (replicated exactly):
 *   1. Pull all 'finished' log timestamps per user (reset markers).
 *   2. Pull every bom_text guid that has a 'block' bom_log with credit >= 80 for
 *      one of the users (these are the "read a block" events). maxBlocks = the
 *      number of DISTINCT guids across that result set (legacy: guids.length).
 *   3. Replay every (user, timestamp, guid) block event in ascending key order
 *      (key = user + timestamp, string-sorted — matches legacy Object.keys.sort()),
 *      accumulating a per-user set of distinct guids. progress for a day =
 *      round(distinctGuids * 10000 / maxBlocks) / 100. A 'finished' timestamp that
 *      predates the current event forces that day's progress to 100, clears the
 *      user's content set, and shifts the finisher.
 *   4. Build the full date range from the earliest event date to today (carry the
 *      last value forward on days with no event). Dates are 'fr-CA' (YYYY-MM-DD) in
 *      America/New_York, matching legacy toLocaleString output.
 *
 * Read-only (sandbox-safe).
 */
import { sql, type Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';

export interface StandardizedValue {
  date: string;
  progress: Record<string, number>;
}

/** YYYY-MM-DD in America/New_York, matching legacy toLocaleString('fr-CA', …).substr(0,10). */
function nyDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000)
    .toLocaleString('fr-CA', { timeZone: 'America/New_York' })
    .substr(0, 10);
}

function nyDateFromDate(d: Date): string {
  return d.toLocaleString('fr-CA', { timeZone: 'America/New_York' }).substr(0, 10);
}

export async function getStandardizedValuesFromUserList(
  db: Kysely<DB>,
  userList: string[],
): Promise<StandardizedValue[]> {
  if (!userList.length) return [];

  // 1. 'finished' markers per user
  const finishes = await db
    .selectFrom('bom_log')
    .select(['timestamp', 'user'])
    .where('type', '=', 'finished')
    .where('user', 'in', userList)
    .execute();

  const finishers: Record<string, number[]> = {};
  for (const f of finishes) {
    (finishers[f.user] ??= []).push(Number(f.timestamp));
  }

  // 2. All block-credit>=80 log events joined to their text guid.
  //    Legacy fetches bom_text with a separate include of qualifying bom_log rows;
  //    equivalently we inner-join bom_log → bom_text and take (guid, user, timestamp).
  //    bom_log.value holds the text guid for type='block' rows.
  const logRows = await sql<{ guid: string; user: string; timestamp: number }>`
    SELECT t.guid AS guid, l.user AS user, l.timestamp AS timestamp
    FROM bom_text t
    INNER JOIN bom_log l ON l.value = t.guid
    WHERE l.type = 'block'
      AND l.credit >= 80
      AND l.user IN (${sql.join(userList)})
  `.execute(db);

  // maxBlocks = distinct guids across the qualifying set (legacy guids.length).
  const distinctGuids = new Set(logRows.rows.map((r) => r.guid));
  const maxBlocks = distinctGuids.size;

  // PRE-SORT: collapse to one entry per (user+timestamp) keyed string, like legacy
  // logItems[user + timestamp] = { guid, user, timestamp }.
  const logItems: Record<string, { guid: string; user: string; timestamp: number }> = {};
  for (const r of logRows.rows) {
    logItems[`${r.user}${r.timestamp}`] = {
      guid: r.guid,
      user: r.user,
      timestamp: Number(r.timestamp),
    };
  }

  const keys = Object.keys(logItems).sort();

  const history: Record<string, { content: Record<string, number>; progress: Record<string, number> }> = {};
  let earliestDate: string | null = null;
  let progress = 0;

  for (const key of keys) {
    const { guid, user, timestamp } = logItems[key]!;
    const date = nyDate(timestamp);
    if (!earliestDate || date < earliestDate) earliestDate = date;
    if (!history[user]) history[user] = { content: {}, progress: {} };
    if (!history[user]!.progress[date]) history[user]!.progress[date] = progress;
    if (!history[user]!.content[guid]) history[user]!.content[guid] = 0;
    history[user]!.content[guid]!++;
    progress = maxBlocks
      ? Math.round((Object.keys(history[user]!.content).length * 10000) / maxBlocks) / 100
      : 0;
    history[user]!.progress[date] = progress;
    if (finishers[user]?.[0] !== undefined && finishers[user]![0]! < timestamp) {
      history[user]!.progress[date] = 100;
      history[user]!.content = {};
      finishers[user]!.shift();
    }
  }

  if (!earliestDate) return [];

  const now = new Date();
  const fullDateRange: string[] = [];
  for (const d = new Date(earliestDate); d <= now; d.setDate(d.getDate() + 1)) {
    fullDateRange.push(nyDateFromDate(new Date(d)));
  }

  const standardizedValues: StandardizedValue[] = [];
  const lastValues: Record<string, number> = {};
  for (const date of fullDateRange) {
    const dateProgress: Record<string, number> = {};
    for (const user of userList) {
      if (!lastValues[user]) lastValues[user] = 0;
      const h = history[user];
      if (h && h.progress && h.progress[date]) {
        dateProgress[user] = h.progress[date]!;
      } else {
        dateProgress[user] = lastValues[user]!;
      }
      lastValues[user] = dateProgress[user]!;
    }
    standardizedValues.push({ date, progress: dateProgress });
  }

  return standardizedValues;
}
