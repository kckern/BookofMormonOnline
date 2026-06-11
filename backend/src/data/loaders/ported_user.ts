/**
 * ported_user loaders — data access for the previously-unresolved BomUser /
 * BomCommunity Query fields (closetab, sourceUsage, pageprogress, users).
 *
 * All read-only (sandbox-safe). Ports of the matching legacy resolvers in
 * src/resolvers/BomUser.ts. Token→user resolution reuses findUserByToken from
 * userauth.ts. The daily-score helpers live in standardizedScores.ts.
 */
import { sql, type Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';
import type { ProgressScoreResult } from './userauth.js';

const PERCENT_COMPLETE = 40;

/**
 * sourceUsage — fraction of a commentary source the user has consumed.
 *
 * Legacy BomUser.ts:219. Counts DISTINCT bom_log.value rows for the user where
 * type='commentary' AND value LIKE '_____' + source.padStart(3,'0') + '__'
 * (5 underscores, zero-padded 3-char source, 2 underscores). Then divides by the
 * source's item_count (bom_xtras_source). Returns
 *   round( 100*100*(1 + distinctCount) / (item_count || 100) ) / 100.
 *
 * Faithful to legacy: `1 + distinctCount` (legacy's `||1` only kicks in when the
 * whole `(1 + length)` expression is 0, which it never is, so it is a no-op).
 */
export async function getSourceUsage(
  db: Kysely<DB>,
  token: string | null | undefined,
  source: string | null | undefined,
): Promise<number> {
  if (!token || !source) return 0;

  // token → username
  const tokenRow = await db
    .selectFrom('bom_user_token')
    .select('user')
    .where('token', '=', token)
    .executeTakeFirst();
  if (!tokenRow) return 0;

  const like = '_____' + String(source).padStart(3, '0') + '__';

  const distinctRows = await db
    .selectFrom('bom_log')
    .select('value')
    .distinct()
    .where('user', '=', tokenRow.user)
    .where('type', '=', 'commentary')
    .where('value', 'like', like)
    .execute();

  const distinctCount = distinctRows.length;

  const sourceInfo = await db
    .selectFrom('bom_xtras_source')
    .select('item_count')
    .where('source_id', '=', Number(source))
    .executeTakeFirst();

  const nom = 100 * 100 * (1 + distinctCount);
  const denom = Number(sourceInfo?.item_count) || 100;
  return Math.round(nom / denom) / 100;
}

/**
 * pageprogress — per-page ProgressScore scoped to the given page slugs.
 *
 * Legacy BomUser.ts:317 (pageslugs = getSlugTip(slug); findScoredPageTextItems →
 * scoreTextItems per page). Resolution:
 *   slug tip → bom_slug.slug → bom_slug.link = page guid → bom_text.page rows →
 *   max(bom_log.credit) per text block (type='block', user, timestamp>lastcompleted).
 * Buckets per legacy scoreTextItems: credit==-1 → active+completed (legacy pushes
 * -1 into both active via `scores.includes(-1)` and completed via `credit===-1`),
 * credit>=40 → completed, credit>=0 → started.
 *
 * Returns one ProgressScore per requested slug (ordered to match args.slug). A
 * slug that resolves to no page yields a zeroed score with that slug set.
 */
export async function getPageProgress(
  db: Kysely<DB>,
  token: string | null | undefined,
  slugs: (string | null)[] | null | undefined,
): Promise<ProgressScoreResult[]> {
  const requested = (slugs ?? []).filter((s): s is string => !!s);
  if (!requested.length) return [];

  // getSlugTip: last path segment of each slug
  const tips = requested.map((s) => s.split('/').pop() as string);

  // token → user + lastcompleted (getUserForLog semantics)
  let queryBy = token ?? '';
  let lastcompleted = 0;
  if (token) {
    const userRow = await db
      .selectFrom('bom_user_token')
      .innerJoin('bom_user', 'bom_user.user', 'bom_user_token.user')
      .select(['bom_user.user as user', 'bom_user.finished as finished'])
      .where('bom_user_token.token', '=', token)
      .executeTakeFirst();
    if (userRow) {
      queryBy = userRow.user;
      lastcompleted = Number(userRow.finished ?? 0);
    }
  }

  // slug tip → page guid: bom_slug.slug = tip, bom_slug.link = page guid
  const slugRows = await db
    .selectFrom('bom_slug')
    .select(['slug', 'link'])
    .where('slug', 'in', tips)
    .execute();
  const pageGuidByTip = new Map<string, string>();
  for (const r of slugRows) if (r.link != null) pageGuidByTip.set(r.slug, r.link);

  const allPageGuids = [...new Set([...pageGuidByTip.values()])];

  // page guid → its text blocks (guid, link)
  const textRowsByPage = new Map<string, { guid: string; link: number }[]>();
  let logByGuid = new Map<string, number[]>();
  if (allPageGuids.length) {
    const textRows = await db
      .selectFrom('bom_text')
      .select(['guid', 'link', 'page'])
      .where('page', 'in', allPageGuids)
      .execute();
    const textGuids: string[] = [];
    for (const t of textRows) {
      if (t.page == null || t.link == null) continue;
      let arr = textRowsByPage.get(t.page);
      if (!arr) {
        arr = [];
        textRowsByPage.set(t.page, arr);
      }
      arr.push({ guid: t.guid, link: Number(t.link) });
      textGuids.push(t.guid);
    }

    // credit scores per text guid from this user's block logs (after lastcompleted)
    if (textGuids.length) {
      const creditRows = await sql<{ guid: string; credit: number }>`
        SELECT value AS guid, credit
        FROM bom_log
        WHERE user = ${queryBy}
          AND type = 'block'
          AND timestamp > ${lastcompleted}
          AND value IN (${sql.join(textGuids)})
      `.execute(db);
      logByGuid = new Map();
      for (const row of creditRows.rows) {
        let arr = logByGuid.get(row.guid);
        if (!arr) {
          arr = [];
          logByGuid.set(row.guid, arr);
        }
        arr.push(Number(row.credit));
      }
    }
  }

  // Build one ProgressScore per requested slug, in order.
  return requested.map((slug, i) => {
    const tip = tips[i]!;
    const pageGuid = pageGuidByTip.get(tip);
    const textItems = (pageGuid && textRowsByPage.get(pageGuid)) || [];

    const started: number[] = [];
    const completed: number[] = [];
    const active: number[] = [];

    for (const item of textItems) {
      const scores = logByGuid.get(item.guid);
      if (!scores || !scores.length) continue;
      const num = item.link;
      const credit = Math.max(...scores);
      if (scores.includes(-1)) active.push(num);
      else if (credit >= PERCENT_COMPLETE || credit === -1) completed.push(num);
      else if (credit >= 0) started.push(num);
    }

    const count = textItems.length;
    return {
      slug,
      count,
      started: count > 0 ? Math.round((started.length * 1000) / count) / 10 : 0,
      completed: count > 0 ? Math.round((completed.length * 1000) / count) / 10 : 0,
      started_items: started,
      completed_items: completed,
      active_items: active,
      summary: null,
    } satisfies ProgressScoreResult;
  });
}

export interface PublicUserRow {
  user: string;
  name: string | null;
  email: string | null;
}

/**
 * users — bom_user rows for the given ids. Exposes only user/name/email (never
 * pass/token). Not implemented in legacy; minimal safe read. Empty/null → [].
 */
export async function getUsersByIds(
  db: Kysely<DB>,
  userIds: (string | null)[] | null | undefined,
): Promise<PublicUserRow[]> {
  const ids = (userIds ?? []).filter((u): u is string => !!u);
  if (!ids.length) return [];
  const rows = await db
    .selectFrom('bom_user')
    .select(['user', 'name', 'email'])
    .where('user', 'in', ids)
    .execute();
  return rows as PublicUserRow[];
}
